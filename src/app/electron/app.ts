import { randomUUID } from 'crypto';
import { app, ipcMain } from 'electron';
import path from 'path';
import { OpenArchive } from '../../common/interfaces/archive.interfaces';
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

  router.bindRpc(OpenArchive, async ({}) => {
    const docs = path.join(app.getPath('documents'), 'dana');
    const id = randomUUID();
    const location = path.join(docs, 'New Archive_' + id);

    return archiveService.openArchive(location, id);
  });

  return {
    router,
    archiveService
  };
}
