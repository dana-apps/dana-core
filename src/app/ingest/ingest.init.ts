import {
  CancelIngestSession,
  CommitIngestSession,
  GetIngestSession,
  ListIngestAssets,
  ListIngestSession,
  StartIngest
} from '../../common/ingest.interfaces';
import { ChangeEvent } from '../../common/resource';
import { ok, okIfExists } from '../../common/util/error';
import { AssetService } from '../asset/asset.service';
import type { ElectronRouter } from '../electron/router';
import { MediaFileService } from '../media/media-file.service';
import { ArchiveService } from '../package/archive.service';
import { AssetIngestService } from './asset-ingest.service';

export async function initIngest(
  router: ElectronRouter,
  archiveService: ArchiveService,
  mediaService: MediaFileService,
  assetService: AssetService
) {
  const assetIngest = new AssetIngestService(mediaService, assetService);

  archiveService.on('opened', ({ archive }) => {
    assetIngest.addArchive(archive);
  });

  archiveService.on('closed', ({ archive }) => {
    assetIngest.removeArchive(archive);
  });

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

  router.bindArchiveRpc(StartIngest, async (archive, { basePath }) => {
    const session = await assetIngest.beginSession(archive, basePath);
    return ok(session);
  });

  router.bindArchiveRpc(ListIngestSession, async (archive) => {
    const sessions = assetIngest.listSessions(archive);
    return ok(sessions);
  });

  router.bindArchiveRpc(GetIngestSession, async (archive, { sessionId }) => {
    const session = assetIngest.getSession(archive, sessionId);
    return okIfExists(session);
  });

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
    async (archive, { sessionId }, paginationToken) => {
      const assets = await assetIngest.listSessionAssets(
        archive,
        sessionId,
        paginationToken
      );

      return ok(assets);
    }
  );

  return {
    assetIngest
  };
}
