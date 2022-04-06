import { EventEmitter } from 'eventemitter3';
import { compact } from 'lodash';

import { IngestPhase, IngestedAsset } from '../../common/ingest.interfaces';
import { ResourceList } from '../../common/resource';
import { DefaultMap } from '../../common/util/collection';
import { ok } from '../../common/util/error';
import { AssetService } from '../asset/asset.service';
import { CollectionService } from '../asset/collection.service';
import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import { AssetImportEntity, ImportSessionEntity } from './asset-import.entity';
import { AssetIngestOperation } from './asset-ingest.operation';

export class AssetIngestService extends EventEmitter<Events> {
  constructor(
    private mediaService: MediaFileService,
    private assetService: AssetService,
    private collectionService: CollectionService
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
   * @param archive Archive to start managing ingests for.
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
   * @param archive Archive to stop managing ingests for.
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
          phase: IngestPhase.READ_METADATA,
          valid: true
        });
        em.persist(session);
        return session;
      })
    );

    session.run();

    return session;
  }

  /**
   * List all active ingest sessions for an archive.
   *
   * @param archive Archive owning the sessions.
   */
  listSessions(archive: ArchivePackage): ResourceList<AssetIngestOperation> {
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
   * @param archive Archive owning the session.
   * @param id Id of the session to return.
   */
  getSession(archive: ArchivePackage, id: string) {
    return this.archiveSessions.get(archive.id).sessions.get(id);
  }

  /**
   * List the assets in an active ingest session.
   *
   * @param archive Archive to import files into.
   * @param sessionId Id of the session to return.
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
      validationErrors: entity.validationErrors,
      media: compact(
        entity.files.getItems().map(
          ({ media }) =>
            media && {
              id: media.id,
              mimeType: media.mimeType,
              rendition: this.mediaService.getRenditionUri(archive, media),
              type: 'image'
            }
        )
      )
    }));
  }

  /**
   * Move all the assets ingested as part of an ingest operation into the archive and delete the operation.
   *
   * @param archive Archive to import files into.
   * @param sessionId Id of the session to return.
   */
  async commitSession(archive: ArchivePackage, sessionId: string) {
    const collection = await this.collectionService.getRootCollection(archive);

    const res = await archive.useDbTransaction(async (db) => {
      const assets = await db.find(AssetImportEntity, { session: sessionId });

      for (const assetImport of assets) {
        await assetImport.files.loadItems({
          populate: ['media']
        });

        const createResult = await this.assetService.createAsset(
          archive,
          collection.id,
          {
            metadata: assetImport.metadata,
            media: compact(
              assetImport.files.getItems().map((item) => item.media)
            )
          }
        );

        if (createResult.status !== 'ok') {
          return createResult;
        }
      }

      db.remove(db.getReference(ImportSessionEntity, sessionId));
      return ok();
    });

    await this.closeSession(archive, sessionId);
    return res;
  }

  /**
   * Remove a session and delete its associated metadata and media files. The source directory is not affected.
   *
   * @param archive Archive to import files into.
   * @param sessionId Id of the session to return.
   */
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
          .queryImportedFiles(db)
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

  /**
   * Remove the AssetIngestOperation instance managing an ingest session.
   *
   * @param archive Archive associated with the operation.
   * @param sessionId Id of the session to close.
   */
  private async closeSession(archive: ArchivePackage, sessionId: string) {
    // Remove the import service
    const { sessions } = this.archiveSessions.get(archive.id);
    sessions.delete(sessionId);

    this.emit('status', {
      archive,
      assetIds: []
    });
  }

  /**
   * Add the AssetIngestOperation instance managing an ingest session to the list of active sessions.
   *
   * @param archive Archive associated with the operation.
   * @param state Database entity holding state for the operation.
   */
  private openSession(archive: ArchivePackage, state: ImportSessionEntity) {
    const activeSessions = this.archiveSessions.get(archive.id);
    let session = activeSessions.sessions.get(archive.id);
    if (session) {
      return session;
    }

    session = new AssetIngestOperation(
      archive,
      state,
      this,
      this.mediaService,
      this.collectionService
    );

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
  importRunCompleted: [AssetIngestOperation];
}

/**
 * Emitted whenever any state change occurs affecting asset ingestion for an archive.
 */
export interface ImportStateChanged {
  /**
   * Archive affected by the change.
   **/
  archive: ArchivePackage;

  /**
   * The operatiom whose state updated.
   *
   * This will be undefined for archive-level changes (for example adding or remiving a session)
   **/
  session?: AssetIngestOperation;

  /** Ids for any ingested assets that have been updated by the change */
  assetIds: string[];
}

interface ArchiveSessions {
  sessions: Map<string, AssetIngestOperation>;
}

const defaultArchiveSessions = () => ({ sessions: new Map() });
