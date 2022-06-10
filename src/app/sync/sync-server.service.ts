import { randomUUID } from 'crypto';
import path from 'path';
import { tmpdir } from 'os';
import { Readable } from 'stream';
import { createReadStream, createWriteStream } from 'fs';
import { RequiredEntityData } from '@mikro-orm/core';
import { Logger } from 'tslog';
import { mkdir } from 'fs/promises';

import {
  AcceptAssetRequest,
  AcceptedAsset,
  AcceptedMedia,
  AcceptMediaRequest,
  SyncedCollection,
  SyncRequest
} from '../../common/sync.interfaces';
import { ok, error, FetchError } from '../../common/util/error';
import { required } from '../../common/util/assert';
import { hashJson } from '../../common/util/collection';
import { AssetCollectionEntity, AssetEntity } from '../asset/asset.entity';
import { MediaFile } from '../media/media-file.entity';
import { ArchivePackage } from '../package/archive-package';
import { hashStream, streamEnded } from '../util/stream-utils';
import { MediaFileService } from '../media/media-file.service';
import { SqlEntityManager } from '@mikro-orm/sqlite';

class SyncTransaction {
  constructor(
    readonly collections: SyncedCollection[],
    private onTimeout: () => void
  ) {}

  timeout?: NodeJS.Timeout;
  id = randomUUID();
  deleteAssets?: Set<string>;
  deleteMedia?: Set<string>;
  assets?: AcceptedAsset[];
  createdAssets?: Set<string>;
  createdCollections?: Set<string>;
  putMedia: AcceptedMedia[] = [];
  tmpLocation = path.join(tmpdir(), 'dana-sync', this.id);

  getTmpfile(slug: string) {
    return path.join(this.tmpLocation, slug);
  }

  touch() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(this.onTimeout, 30_000);
    return this;
  }

  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }
}

export class SyncServer {
  constructor(private media: MediaFileService) {}

  private transactions = new Map<string, SyncTransaction>();
  private logger = new Logger({ name: 'sync-server' });

  async beginSync(archive: ArchivePackage, syncRequest: SyncRequest) {
    const assets = await this.beginEntitySync(
      archive,
      AssetEntity,
      syncRequest.assets,
      async (x) =>
        hashJson(
          required(
            await archive.get(AssetEntity, x),
            'Expected entity to exist'
          )
        )
    );

    const media = await this.beginEntitySync(
      archive,
      MediaFile,
      syncRequest.media,
      async (x) =>
        hashJson(
          required(await archive.get(MediaFile, x), 'Expected entity to exist')
        )
    );

    const t: SyncTransaction = new SyncTransaction(
      syncRequest.collections,
      () => this.closeTransaction(t)
    );
    this.transactions.set(t.id, t.touch());
    const existingCollections = await archive.useDb((db) =>
      existingSet(db, AssetCollectionEntity)
    );

    t.deleteAssets = assets.deleted;
    t.deleteMedia = media.deleted;
    t.createdAssets = assets.created;
    t.createdCollections = new Set(
      syncRequest.collections
        .filter((x) => !existingCollections.has(x.id))
        .map((x) => x.id)
    );

    await mkdir(t.tmpLocation, { recursive: true });

    return ok({
      id: t.id,
      wantMedia: Array.from(media.want),
      wantAssets: Array.from(assets.want)
    });
  }

  async acceptAssets(
    archive: ArchivePackage,
    transactionId: string,
    syncRequest: AcceptAssetRequest
  ) {
    const t = this.transactions.get(transactionId);
    if (!t) {
      return error(FetchError.DOES_NOT_EXIST);
    }

    t.touch();

    t.assets = syncRequest.assets;
    return ok();
  }

  async acceptMedia(
    archive: ArchivePackage,
    transactionId: string,
    syncRequest: AcceptMediaRequest,
    data: Readable
  ) {
    const t = this.transactions.get(transactionId);
    if (!t) {
      return error(FetchError.DOES_NOT_EXIST);
    }

    t.touch();
    t.putMedia.push(syncRequest.metadata);

    const fd = createWriteStream(t.getTmpfile(syncRequest.metadata.id));
    data.pipe(fd);

    await streamEnded(data);
    return ok();
  }

  async commit(archive: ArchivePackage, transactionId: string) {
    const t = this.transactions.get(transactionId);
    if (!t) {
      return error(FetchError.DOES_NOT_EXIST);
    }

    try {
      t.stop();

      await archive.useDb((db) =>
        db.transactional(async (db) => {
          if (t.collections.length > 0) {
            const deleted = await db.nativeDelete(AssetCollectionEntity, {
              id: { $nin: t.collections.map((t) => t.id) }
            });

            if (deleted > 0) {
              this.logger.info('Deleted', deleted, 'collections');
            }
          }

          await this.commitEntitySync(
            db,
            t.createdCollections ?? new Set(),
            AssetCollectionEntity,
            'collections',
            t.collections,
            (data) => ({
              schema: data.schema,
              title: data.title,
              type: data.type,
              parent: data.parent
            })
          );

          if (t.deleteAssets && t.deleteAssets.size > 0) {
            const deleted = await db.nativeDelete(AssetCollectionEntity, {
              id: Array.from(t.deleteAssets)
            });

            if (deleted > 0) {
              this.logger.info('Deleted', deleted, 'assets');
            }
          }

          await this.commitEntitySync(
            db,
            t.createdAssets ?? new Set(),
            AssetEntity,
            'assets',
            Array.from(t.assets ?? []),
            (data) => ({
              accessControl: data.accessControl,
              collection: data.collection,
              metadata: data.metadata
            })
          );

          await this.commitEntitySync(
            db,
            new Set(t.putMedia.map((m) => m.id)),
            MediaFile,
            'files',
            Array.from(t.putMedia ?? []),
            async (data) => {
              return {
                asset: data.assetId,
                mimeType: data.mimeType,
                sha256: await hashStream(
                  createReadStream(t.getTmpfile(data.id))
                )
              };
            }
          );
        })
      );

      if (t.deleteMedia && t.deleteMedia.size > 0) {
        this.logger.info('Delete', t.deleteMedia?.size ?? 0, 'files');
        await this.media.deleteFiles(archive, Array.from(t.deleteMedia ?? []));
      }

      this.logger.info('Sync transaction completed:', t.id);
      return ok();
    } finally {
      this.closeTransaction(t);
    }
  }

  private closeTransaction(t: SyncTransaction) {
    this.logger.info('Closing sync transaction', t.id);

    t.stop();
    this.transactions.delete(t.id);
  }

  private async commitEntitySync<
    E extends { id: string },
    V extends { id: string }
  >(
    db: SqlEntityManager,
    createdIds: Set<string>,
    entity: new () => E,
    entityName: string,
    items: V[],
    updater: (
      value: V
    ) => RequiredEntityData<E> | Promise<RequiredEntityData<E>>
  ) {
    let createdCount = 0,
      updatedCount = 0;

    for (const item of items) {
      if (createdIds.has(item.id)) {
        db.persist(
          db.create(entity, { ...(await updater(item)), id: item.id })
        );
        createdCount += 1;
      } else {
        const instance = await db.findOne(entity, item.id);
        Object.assign(instance, await updater(item));
        db.persist(instance);
        updatedCount += 1;
      }
    }

    if (createdCount > 0) {
      this.logger.info('created', createdCount, entityName);
    }

    if (updatedCount > 0) {
      this.logger.info('updated', updatedCount, entityName);
    }
  }

  private async beginEntitySync<
    E extends { id: string },
    V extends { id: string; sha256: string }
  >(
    archive: ArchivePackage,
    entity: new () => E,
    items: V[],
    hash: (x: string) => Promise<string>
  ) {
    const want = new Set<string>();
    const deleted = new Set<string>();
    const created = new Set<string>();
    const nextIds = new Set(items.map((x) => x.id));

    await archive.useDb(async (db) => {
      const existing = await existingSet(db, entity);

      for (const item of items) {
        if (!existing.has(item.id)) {
          want.add(item.id);
          created.add(item.id);
          continue;
        }

        if ((await hash(item.id)) !== item.sha256) {
          want.add(item.id);
        }
      }

      for (const id of existing) {
        if (!nextIds.has(id)) {
          deleted.add(id);
        }
      }
    });

    return {
      want,
      created,
      deleted
    };
  }
}

async function existingSet(db: SqlEntityManager, entity: new () => unknown) {
  const idRecords = await db.createQueryBuilder(entity).select('id');
  return new Set<string>(idRecords.map((x) => x.id));
}
