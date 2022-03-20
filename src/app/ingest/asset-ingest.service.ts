import { EventEmitter } from 'eventemitter3';
import { ImportPhase } from '../../common/ingest.interfaces';
import { DefaultMap } from '../../common/util/collection';
import { ArchivePackage } from '../package/archive-package';
import { AssetImportEntity, ImportSessionEntity } from './asset-import.entity';
import { AssetImportOperation } from './asset-import.operation';

export class AssetIngestService extends EventEmitter<Events> {
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

    for (const sessions of state.sessions) {
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
    return new AssetImportOperation(
      archive,
      await archive.useDb((em) => {
        const session = em.create(ImportSessionEntity, {
          basePath,
          phase: ImportPhase.READ_METADATA
        });
        em.persist(session);
        return session;
      }),
      this
    );
  }

  /**
   * Get an active ingest session.
   *
   * @param archive Archive to import files into.
   * @param id Id of the session to return.
   */
  getSession(archive: ArchivePackage, id: string) {
    return this.archiveSessions
      .get(archive.id)
      .sessions.find((x) => x.id === id);
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
    return archive.list(
      AssetImportEntity,
      { session: sessionId },
      paginationToken
    );
  }

  async commitSession(archive: ArchivePackage, sessionId: string) {
    throw Error('Not implemented');
  }

  async discardSession(archive: ArchivePackage, sessionId: string) {
    throw Error('Not implemented');
  }

  private openSession(archive: ArchivePackage, state: ImportSessionEntity) {
    const activeSessions = this.archiveSessions.get(archive.id);
    const session = new AssetImportOperation(archive, state, this);

    activeSessions.sessions.push(session);

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
}

export interface ImportStateChanged {
  archive: ArchivePackage;
  session: AssetImportOperation;
  assetIds: string[];
}

interface ArchiveSessions {
  sessions: AssetImportOperation[];
}

const defaultArchiveSessions = () => ({ sessions: [] });
