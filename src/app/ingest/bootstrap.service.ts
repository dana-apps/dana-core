import { EventEmitter } from 'eventemitter3';
import { groupBy } from 'lodash';
import { Collection, CollectionType } from '../../common/asset.interfaces';
import { IngestPhase } from '../../common/ingest.interfaces';
import { error, ok } from '../../common/util/error';
import { CollectionService } from '../asset/collection.service';
import { ArchivePackage } from '../package/archive-package';
import { ArchiveService } from '../package/archive.service';
import { AssetIngestOperation } from './asset-ingest.operation';
import { AssetIngestService } from './asset-ingest.service';
import { openDanapack } from './danapack';

export class BooststrapService extends EventEmitter<BootstrapEvents> {
  constructor(
    private archives: ArchiveService,
    private collections: CollectionService,
    private ingest: AssetIngestService
  ) {
    super();
  }

  /**
   * Initialize a local copy of a dana archive from a danapack
   *
   * @param archive
   * @param collections
   */
  async boostrapArchiveFromDanapack(
    danapackLocation: string,
    storageLocation: string
  ) {
    const danapack = await openDanapack(danapackLocation);
    const manifest = await danapack.manifest();

    if (manifest.status === 'error') {
      return error('cannot bootstrap');
    }

    if (!manifest.value.archiveId) {
      return error('cannot bootstrap');
    }

    const archive = await this.archives.openArchive(
      storageLocation,
      manifest.value.archiveId
    );
    if (archive.status === 'error') {
      return error('archive opening error');
    }

    await this.setupCollections(archive.value, manifest.value.collections);
    await this.importCollectionAssets(
      archive.value,
      danapackLocation,
      manifest.value.collections.filter(
        (x) => x.type === CollectionType.CONTROLLED_DATABASE
      )
    );
    await this.importCollectionAssets(
      archive.value,
      danapackLocation,
      manifest.value.collections.filter(
        (x) => x.type === CollectionType.ASSET_COLLECTION
      )
    );

    return archive;
  }

  /**
   * Build up the collection hierarchy by creating collections from the schema objects
   *
   * @param archive
   * @param collections
   */
  async setupCollections(archive: ArchivePackage, collections: Collection[]) {
    const byParent = groupBy(collections, (c) => c.parent);
    const queue: (string | undefined)[] = [undefined];
    const visited = new Set();

    while (queue.length > 0) {
      const parentId = queue.shift();
      if (visited.has(parentId)) {
        return error('invalid file');
      }

      visited.add(parentId);
      const collections = byParent[parentId as string] ?? [];

      for (const coll of collections) {
        queue.push(coll.id);

        await this.collections.createCollection(archive, parentId as string, {
          title: coll.title,
          schema: coll.schema,
          forceId: coll.id
        });
      }
    }

    return ok();
  }

  async importCollectionAssets(
    archive: ArchivePackage,
    danapackLocation: string,
    collections: Collection[]
  ) {
    const ee = new EventEmitter<{ done: [boolean] }>();
    const sessions = new Map<string, 'error' | 'pending' | 'ok'>();

    const handleImportSessionCompleted = async (op: AssetIngestOperation) => {
      if (op.phase === IngestPhase.COMPLETED && op.valid) {
        sessions.set(op.id, 'ok');
        await this.ingest.commitSession(op.archive, op.session.id, {
          danapack: true
        });
      } else if (op.phase === IngestPhase.ERROR || !op.valid) {
        sessions.set(op.id, 'error');
        await this.ingest.cancelSession(op.archive, op.session.id);
      }

      const statuses = Array.from(sessions.values());

      if (statuses.every((x) => x === 'ok')) {
        this.ingest.off('importRunCompleted', handleImportSessionCompleted);
        ee.emit('done', true);
        return;
      }

      if (statuses.every((x) => x === 'error' || x === 'ok')) {
        this.ingest.off('importRunCompleted', handleImportSessionCompleted);
        ee.emit('done', false);
        return;
      }
    };

    this.ingest.on('importRunCompleted', handleImportSessionCompleted);

    for (const collection of collections) {
      if (!collection.parent) {
        continue;
      }

      const session = await this.ingest.beginSession(
        archive,
        danapackLocation,
        collection.id
      );

      sessions.set(session.id, 'pending');
    }

    return new Promise<void>((resolve, reject) => {
      ee.once('done', (ok) => (ok ? resolve() : reject('error')));
    });
  }
}

interface BootstrapEvents {
  completed: [BootstrapCompletedEvent];
}

export interface BootstrapCompletedEvent {
  archive: ArchivePackage;
  error?: string;
}
