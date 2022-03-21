import { dialog } from 'electron';
import {
  CreateArchive,
  CreateArchiveError
} from '../common/interfaces/archive.interfaces';
import { error, ok } from '../common/util/error';
import { UnwrapPromise } from '../common/util/types';
import { ElectronRouter } from './electron/router';
import { ArchiveService } from './package/archive.service';

export type AppInstance = UnwrapPromise<ReturnType<typeof createApp>>;

export async function createApp(ipc: ElectronRouter) {
  const archiveService = new ArchiveService();

  ipc.bindRpc(CreateArchive, async () => {
    const location = await dialog.showSaveDialog({});
    if (!location.filePath) {
      return error(CreateArchiveError.CANCELLED);
    }

    await archiveService.openArchive(location.filePath);
    return ok();
  });

  return {
    archiveService
  };
}
