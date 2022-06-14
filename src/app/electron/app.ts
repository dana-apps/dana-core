import { dialog, ipcMain } from 'electron';
import {
  OpenArchive,
  ArchiveOpeningError
} from '../../common/interfaces/archive.interfaces';
import { error } from '../../common/util/error';
import { UnwrapPromise } from '../../common/util/types';
import { ArchiveService } from '../package/archive.service';
import { getUserConfig } from './config';
import { ElectronRouter } from './router';

export type AppInstance = UnwrapPromise<ReturnType<typeof initApp>>;

/**
 * Starts all application services and binds them to the frontend.
 *
 * @returns Service instances for the application.
 */
export async function initApp() {
  const archiveService = new ArchiveService({
    async getCmsSyncConfig(location: string) {
      const config = await getUserConfig();
      return config.archives[location]?.syncConfig;
    }
  });
  const router = new ElectronRouter(ipcMain, archiveService);

  router.bindRpc(OpenArchive, async ({ create }) => {
    const location = create
      ? await dialog
          .showSaveDialog({
            title: 'New Archive',
            message: 'Chose a location to store files for the new archive'
          })
          .then((x) => x.filePath)
      : await dialog
          .showOpenDialog({
            title: 'Open Archive',
            message: 'Find a dana archive to open',
            properties: ['openDirectory']
          })
          .then((x) => x.filePaths[0]);

    if (!location) {
      return error(ArchiveOpeningError.CANCELLED);
    }

    return archiveService.openArchive(location);
  });

  return {
    router,
    archiveService
  };
}
