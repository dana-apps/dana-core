import { EventEmitter } from 'eventemitter3';
import { compact } from 'lodash';

import { ImportPhase, IngestedAsset } from '../../common/ingest.interfaces';
import { ResourceList } from '../../common/resource';
import { DefaultMap } from '../../common/util/collection';
import { AssetService } from '../asset/asset.service';
import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import { AssetImportEntity, ImportSessionEntity } from './asset-import.entity';
import { AssetImportOperation } from './asset-import.operation';

export class AssetIngestService extends EventEmitter<Events> {
  constructor(
    private mediaService: MediaFileService,
    private assetService: AssetService
  ) {
    super();
  }

  private archiveSessions = new DefaultMap<string, ArchiveSessions>(
    defaultArchiveSessions
  );

  /**
   * Start managing ingest sessions for an open archive.
   *
   * Loads any uncomitted ingest operations and resumes them.
   *
   * @param archive
   */
  async addArchive(archive: ArchivePackage) {
    const savedState = await archive.list(ImportSessionEntity);

    for await (const sessionState of savedState) {
      const session = this.openSession(archive, sessionState);
      session.run();
    }
  }

  /**
   * Stop managing ingest sessions for an open archive (for example when it is closed)
   *
   * @param archive
   */
  removeArchive(archive: ArchivePackage) {
    const state = this.archiveSessions.get(archive.id);
    this.archiveSessions.delete(archive.id);

    for (const sessions of state.sessions.values()) {
      sessions.teardown();
    }
  }

  /**
   * Create a new import operation to import files from `basePath` into `archive`
   *
   * @param archive Archive to import files into.
   * @param basePath Absolute path to the local directory to ingest from.
   */
  async beginSession(archive: ArchivePackage, basePath: string) {
    const session = this.openSession(
      archive,

      await archive.useDb((em) => {
        const session = em.create(ImportSessionEntity, {
          basePath,
          phase: ImportPhase.READ_METADATA
        });
        em.persist(session);
        return session;
      })
    );

    session.run();

    return session;
  }

  /**
   * Get an active ingest session.
   *
   * @param archive Archive to import files into.
   * @param id Id of the session to return.
   */
  listSessions(archive: ArchivePackage): ResourceList<AssetImportOperation> {
    const sessions = Array.from(
      this.archiveSessions.get(archive.id).sessions.values()
    );

    return {
      total: sessions.length,
      items: sessions,
      page: 'all'
    };
  }

  /**
   * Get an active ingest session.
   *
   * @param archive Archive to import files into.
   * @param id Id of the session to return.
   */
  getSession(archive: ArchivePackage, id: string) {
    return this.archiveSessions.get(archive.id).sessions.get(id);
  }

  /**
   * Get an active ingest session.
   *
   * @param archive Archive to import files into.
   * @param id Id of the session to return.
   * @param paginationToken Paginate over
   */
  async listSessionAssets(
    archive: ArchivePackage,
    sessionId: string,
    paginationToken?: string
  ) {
    const res = await archive.list(
      AssetImportEntity,
      { session: sessionId },
      { populate: ['files.media'], paginationToken }
    );

    return res.map<IngestedAsset>((entity) => ({
      id: entity.id,
      metadata: entity.metadata,
      phase: entity.phase,
      media: compact(
        entity.files.getItems().map(
          ({ media }) =>
            media && {
              id: media.id,
              mimeType: media.mimeType,
              type: 'image'
            }
        )
      )
    }));
  }

  /**
   * Commit an ingest session.
   *
   * @param archive Archive to import files into.
   * @param id Id of the session to return.
   * @param paginationToken Paginate over
   */
  async commitSession(archive: ArchivePackage, sessionId: string) {
    await archive.useDbTransaction(async (db) => {
      const assets = await db.find(AssetImportEntity, { session: sessionId });

      for (const assetImport of assets) {
        await assetImport.files.loadItems({
          populate: ['media']
        });

        this.assetService.createAsset(archive, {
          metadata: assetImport.metadata,
          media: compact(assetImport.files.getItems().map((item) => item.media))
        });
      }

      db.remove(db.getReference(ImportSessionEntity, sessionId));
    });

    await this.closeSession(archive, sessionId);
  }

  async cancelSession(archive: ArchivePackage, sessionId: string) {
    const session = this.getSession(archive, sessionId);
    if (!session) {
      return;
    }

    // Stop any pending activity in the session
    await session.teardown();

    // Delete the import, returning any imported media
    const importedMedia = await archive.useDbTransaction(async (db) => {
      const importedMedia = await archive.useDb((db) =>
        session
          .queryFiles(db)
          .populate([{ field: 'media' }])
          .getResultList()
      );

      db.remove(db.getReference(ImportSessionEntity, sessionId));

      return compact(importedMedia.map((file) => file.media?.id));
    });

    // Delete the imported media
    await this.mediaService.deleteFiles(archive, importedMedia);

    await this.closeSession(archive, sessionId);
  }

  private async closeSession(archive: ArchivePackage, sessionId: string) {
    // Remove the import service
    const { sessions } = this.archiveSessions.get(archive.id);
    sessions.delete(sessionId);

    this.emit('status', {
      archive,
      assetIds: []
    });
  }

  private openSession(archive: ArchivePackage, state: ImportSessionEntity) {
    const activeSessions = this.archiveSessions.get(archive.id);
    let session = activeSessions.sessions.get(archive.id);
    if (session) {
      return session;
    }

    session = new AssetImportOperation(archive, state, this, this.mediaService);

    activeSessions.sessions.set(session.id, session);

    this.emit('status', {
      archive,
      session,
      assetIds: []
    });

    return session;
  }
}

/**
 * Lifecycle events for asset imports
 */
interface Events {
  status: [ImportStateChanged];
  importRunCompleted: [AssetImportOperation];
}

export interface ImportStateChanged {
  archive: ArchivePackage;
  session?: AssetImportOperation;
  assetIds: string[];
}

interface ArchiveSessions {
  sessions: Map<string, AssetImportOperation>;
}

const defaultArchiveSessions = () => ({ sessions: new Map() });
