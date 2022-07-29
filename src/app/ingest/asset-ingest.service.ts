import { EventEmitter } from 'eventemitter3';
import { compact, mapValues } from 'lodash';
import { Asset } from '../../common/asset.interfaces';

import { IngestPhase, IngestedAsset } from '../../common/ingest.interfaces';
import { PageRange } from '../../common/ipc.interfaces';
import { ResourceList } from '../../common/resource';
import { DefaultMap } from '../../common/util/collection';
import { error, FetchError, ok, Result } from '../../common/util/error';
import { AssetService } from '../asset/asset.service';
import { CollectionService } from '../asset/collection.service';
import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import { AssetImportEntity, ImportSessionEntity } from './asset-import.entity';
import { AssetIngestOperation } from './asset-ingest.operation';
import { openDanapack } from './danapack';

export class AssetIngestService extends EventEmitter<Events> {
  /** Supported file extensions for metadata sheets */
  static readonly SPREADSHEET_TYPES = ['.xlsx', '.csv', '.xls', '.ods'];

  /** Supported file extension for a dana package */
  static readonly PACKAGE_TYPE = '.danapack';

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
    const savedState = await archive.useDb((db) =>
      db.find(ImportSessionEntity, {})
    );

    for (const sessionState of savedState) {
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
  async beginSession(
    archive: ArchivePackage,
    basePath: string,
    targetCollectionId: string
  ) {
    const session = this.openSession(
      archive,

      await archive.useDb(async (em) => {
        const session = em.create(ImportSessionEntity, {
          basePath,
          targetCollection: targetCollectionId,
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
      range: {
        offset: 0,
        limit: sessions.length
      }
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
    range?: PageRange
  ): Promise<ResourceList<IngestedAsset>> {
    const res = await archive.list(
      AssetImportEntity,
      { session: sessionId },
      { populate: ['files.media'], range }
    );

    const ingestOperation = this.archiveSessions
      .get(archive.id)
      .sessions.get(sessionId);

    if (!ingestOperation) {
      return {
        total: 0,
        items: [],
        range: {
          limit: 0,
          offset: 0
        }
      };
    }

    return {
      ...res,
      items: await Promise.all(
        res.items.map(async (entity) => ({
          id: entity.id,
          title: entity.id,
          accessControl: entity.accessControl,
          collectionId: ingestOperation.targetCollectionId,
          redactedProperties: entity.redactedProperties,
          metadata: mapValues(entity.metadata, (rawValue) => ({
            rawValue,
            presentationValue: rawValue.map((x) => ({
              label: String(x),
              rawValue: x
            }))
          })),
          phase: entity.phase,
          validationErrors: entity.validationErrors,
          media: await this.mediaService.getMedia(
            archive,
            entity.files
              .toArray()
              .flatMap((file) => (file.media ? [file.media.id] : []))
          )
        }))
      )
    };
  }

  /**
   * Move all the assets ingested as part of an ingest operation into the archive and delete the operation.
   *
   * @param archive Archive to import files into.
   * @param sessionId Id of the session to return.
   */
  async commitSession(
    archive: ArchivePackage,
    sessionId: string,
    opts: { danapack?: boolean } = {}
  ) {
    const session = this.getSession(archive, sessionId);
    if (!session) {
      return error(FetchError.DOES_NOT_EXIST);
    }

    const forceIds =
      opts.danapack &&
      (await openDanapack(session.basePath)).metadataEntries.every((x) =>
        x().then((x) => x.status === 'ok' && x.value.collection)
      );

    const res = await archive.useDbTransaction(async (db): Promise<Result> => {
      const assets = await db.find(AssetImportEntity, { session: sessionId });

      for (const assetImport of assets) {
        await assetImport.files.loadItems({
          populate: ['media']
        });

        let createResult;
        if (forceIds) {
          try {
            createResult = await this.assetService.createAsset(
              archive,
              session.targetCollectionId,
              {
                forceId: forceIds ? assetImport.path : undefined,
                redactedProperties: [],
                metadata: assetImport.metadata,
                accessControl: assetImport.accessControl,
                media: compact(
                  assetImport.files.getItems().map((item) => item.media)
                )
              }
            );
          } catch {
            createResult = await this.assetService.updateAsset(
              archive,
              assetImport.path,
              {
                forceId: forceIds ? assetImport.path : undefined,
                metadata: assetImport.metadata,
                accessControl: assetImport.accessControl,
                // TODO: media should be deleted if dropped?
                media: compact(
                  assetImport.files.getItems().map((item) => item.media)
                )
              }
            );
          }
        } else {
          createResult = await this.assetService.createAsset(
            archive,
            session.targetCollectionId,
            {
              metadata: assetImport.metadata,
              redactedProperties: [],
              accessControl: assetImport.accessControl,
              media: compact(
                assetImport.files.getItems().map((item) => item.media)
              )
            }
          );
        }

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

    // Stop any pending activity in the session and return the archive to its initial state
    await session.teardown();
    await session.removeImportedFiles();

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
      this.collectionService,
      this.assetService
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
  edit: [ImportStateChanged];
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
