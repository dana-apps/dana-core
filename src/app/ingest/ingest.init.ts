import { BrowserWindow, dialog } from 'electron';
import { extname } from 'path';
import {
  CancelIngestSession,
  CommitIngestSession,
  ExportCollection,
  GetIngestSession,
  ListIngestAssets,
  ListIngestSession,
  StartIngest,
  StartIngestError,
  UpdateIngestedMetadata
} from '../../common/ingest.interfaces';
import { ChangeEvent } from '../../common/resource';
import { error, FetchError, ok, okIfExists } from '../../common/util/error';
import { createFileFilter } from '../../common/util/file';
import { AssetService } from '../asset/asset.service';
import { CollectionService } from '../asset/collection.service';
import type { ElectronRouter } from '../electron/router';
import { MediaFileService } from '../media/media-file.service';
import { ArchiveService } from '../package/archive.service';
import { AssetExportService } from './asset-export.service';
import { AssetIngestService } from './asset-ingest.service';

/**
 * Starts the ingest-related application services and binds them to the frontend.
 *
 * @returns Service instances for managing ingested assets and media.
 */
export async function initIngest(
  router: ElectronRouter,
  archiveService: ArchiveService,
  mediaService: MediaFileService,
  assetService: AssetService,
  collectionService: CollectionService
) {
  const assetIngest = new AssetIngestService(
    mediaService,
    assetService,
    collectionService
  );

  const assetExport = new AssetExportService(
    collectionService,
    assetService,
    mediaService
  );

  // When an archive opens, start managing its ingest operations
  archiveService.on('opened', ({ archive }) => {
    assetIngest.addArchive(archive);
  });

  for (const a of archiveService.archives) {
    assetIngest.addArchive(a);
  }

  // When an archive closes, stop managing its ingest operations
  archiveService.on('closed', ({ archive }) => {
    assetIngest.removeArchive(archive);
  });

  // Notify the frontend about state changes
  assetIngest.on('status', ({ archive, session, assetIds }) => {
    router.emit(
      ChangeEvent,
      { type: ListIngestAssets.id, ids: assetIds },
      archive.id
    );
    router.emit(
      ChangeEvent,
      { type: ListIngestSession.id, ids: [] },
      archive.id
    );
    router.emit(
      ChangeEvent,
      { type: GetIngestSession.id, ids: session ? [session.id] : [] },
      archive.id
    );
  });

  // Notify the frontend about state changes
  assetIngest.on('edit', ({ archive, session, assetIds }) => {
    router.emit(
      ChangeEvent,
      { type: ListIngestAssets.id, ids: assetIds },
      archive.id
    );
    router.emit(
      ChangeEvent,
      { type: ListIngestSession.id, ids: [] },
      archive.id
    );
    router.emit(
      ChangeEvent,
      { type: GetIngestSession.id, ids: session ? [session.id] : [] },
      archive.id
    );
  });

  router.bindArchiveRpc(
    StartIngest,
    async (archive, { basePath, targetCollectionId }) => {
      if (!basePath) {
        // Electron's types are wrong – it's fine for this to be undefined
        const openRes = await dialog.showOpenDialog(
          undefined as unknown as BrowserWindow,
          {
            title: 'Import assets',
            message: 'Select a directory of assets and metadata to import',
            filters: [
              createFileFilter('Any format', [
                AssetIngestService.PACKAGE_TYPE,
                ...AssetIngestService.SPREADSHEET_TYPES
              ]),
              createFileFilter(
                'Metadata listing',
                AssetIngestService.SPREADSHEET_TYPES
              ),
              createFileFilter('Dana asset package', [
                AssetIngestService.PACKAGE_TYPE
              ])
            ],
            buttonLabel: 'Import'
          }
        );

        basePath = openRes.filePaths[0];

        if (!basePath) {
          return error(StartIngestError.CANCELLED);
        }
      }

      const session = await assetIngest.beginSession(
        archive,
        basePath,
        targetCollectionId
      );
      return ok(session);
    }
  );

  router.bindArchiveRpc(ListIngestSession, async (archive) => {
    const sessions = assetIngest.listSessions(archive);
    return ok(sessions);
  });

  router.bindArchiveRpc(GetIngestSession, async (archive, { id }) => {
    const session = assetIngest.getSession(archive, id);
    return okIfExists(session);
  });

  router.bindArchiveRpc(
    UpdateIngestedMetadata,
    async (archive, { assetId, sessionId, metadata, accessControl }) => {
      const session = assetIngest.getSession(archive, sessionId);
      if (!session) {
        return error(FetchError.DOES_NOT_EXIST);
      }

      return session.updateImportedAsset(assetId, metadata, accessControl);
    }
  );

  router.bindArchiveRpc(CommitIngestSession, async (archive, { sessionId }) => {
    await assetIngest.commitSession(archive, sessionId);
    return ok();
  });

  router.bindArchiveRpc(CancelIngestSession, async (archive, { sessionId }) => {
    await assetIngest.cancelSession(archive, sessionId);
    return ok();
  });

  router.bindArchiveRpc(
    ListIngestAssets,
    async (archive, { sessionId }, range) => {
      const assets = await assetIngest.listSessionAssets(
        archive,
        sessionId,
        range
      );

      return ok(assets);
    }
  );

  router.bindArchiveRpc(ExportCollection, async (archive, { collectionId }) => {
    const res = await dialog.showSaveDialog(
      undefined as unknown as BrowserWindow,
      {
        buttonLabel: 'Export',
        title: 'Export Collection',
        properties: ['showOverwriteConfirmation'],
        filters: [createFileFilter('Dana Package', ['danapack'])]
      }
    );
    if (res.canceled || !res.filePath) {
      return ok();
    }

    const outpath =
      extname(res.filePath) === '.danapack'
        ? res.filePath
        : res.filePath + '.danapack';
    return assetExport.exportCollection(archive, collectionId, outpath);
  });

  return {
    assetExport,
    assetIngest
  };
}
