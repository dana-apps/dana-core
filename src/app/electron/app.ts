import { dialog, ipcMain } from 'electron';
import {
  CreateArchive,
  ArchiveOpeningError
} from '../../common/interfaces/archive.interfaces';
import { error } from '../../common/util/error';
import { UnwrapPromise } from '../../common/util/types';
import { ArchiveService } from '../package/archive.service';
import { ElectronRouter } from './router';

export type AppInstance = UnwrapPromise<ReturnType<typeof createApp>>;

export async function createApp() {
  const archiveService = new ArchiveService();
  const router = new ElectronRouter(ipcMain, archiveService);

  router.bindRpc(CreateArchive, async () => {
    const location = await dialog.showSaveDialog({});
    if (!location.filePath) {
      return error(ArchiveOpeningError.CANCELLED);
    }

    return archiveService.openArchive(location.filePath);
  });

  return {
    router,
    archiveService
  };
}
