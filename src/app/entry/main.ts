import { app as electronApp, BrowserWindow, dialog, ipcMain } from 'electron';
import { platform } from 'os';
import path from 'path';
import { autoUpdater } from 'electron-updater';

import { initAssets } from '../asset/asset.init';
import { initApp } from '../electron/app';
import {
  DEFAULT_AUTOLOAD_ARCHIVES,
  getUserConfig,
  SHOW_DEVTOOLS,
  updateUserConfig
} from '../electron/config';
import { createFrontendWindow, initWindows } from '../electron/window';
import { initIngest } from '../ingest/ingest.init';
import { initMedia } from '../media/media.init';
import { ArchivePackage } from '../package/archive-package';
import { Logger } from 'tslog';
import { mkdir, stat } from 'fs/promises';
import { MediaFileService } from '../media/media-file.service';
import { WindowSize } from '../../common/ui.interfaces';
import { initSync } from '../sync/sync.init';
import { BootstrapArchive } from '../../common/ingest.interfaces';
import { openDanapack } from '../ingest/danapack';
import { error, ok } from '../../common/util/error';
import { randomUUID } from 'crypto';

async function main() {
  let newArchiveWindow: BrowserWindow | undefined;
  const app = await initApp();
  const log = new Logger({ name: 'App' });

  /** Setup the business logic of the app */
  const media = initMedia();
  const assets = initAssets(app.router, media.fileService);
  const ingest = await initIngest(
    app.router,
    app.archiveService,
    media.fileService,
    assets.assetService,
    assets.collectionService
  );
  const sync = initSync(
    assets.collectionService,
    assets.assetService,
    media.fileService
  );

  /** Bind a few misc events that don't make sense elsewhere */
  app.router.bindRpc(BootstrapArchive, async () => {
    const openRes = await dialog.showOpenDialog(
      undefined as unknown as BrowserWindow,
      {
        filters: [{ name: 'Danapack', extensions: ['danapack'] }]
      }
    );

    const docs = path.join(electronApp.getPath('documents'), 'dana');
    const danapackLocation = openRes.filePaths[0];
    const id = await openDanapack(danapackLocation)
      .then((d) => d.manifest())
      .then((x) => x.status === 'ok' && x.value.archiveId);

    if (!id) {
      return error('invalid danapack');
    }

    await mkdir(docs, { recursive: true });
    const storageLocation = path.join(
      docs,
      path.basename(danapackLocation, path.extname(danapackLocation)) + '_' + id
    );

    const archive = await ingest.bootstrap.boostrapArchiveFromDanapack(
      danapackLocation,
      storageLocation
    );

    return archive.status === 'ok' ? ok() : archive;
  });

  ipcMain.on('restart', () => {
    electronApp.relaunch();
    electronApp.exit();
  });

  // Quit on non-osx platforms when windows all close.
  electronApp.on('window-all-closed', () => {
    if (platform() !== 'darwin') {
      electronApp.exit();
    }
  });

  await initUpdates();
  await initWindows(app.router);
  await initDevtools();
  await initRouter();
  await initArchives();
  await showInitialScreen();

  /**
   * Setup electon bindings for archives.
   */
  async function initArchives() {
    // When an archive document is opened, show its window.
    app.archiveService.on('opened', ({ archive }) => {
      showArchiveWindow(archive);
      sync.syncClient.sync(archive);
    });

    // When an archive document is opened, add it to the autoload array.
    app.archiveService.on('opened', async ({ archive }) => {
      updateUserConfig((config) => {
        config.archives[archive.location] = {
          ...config.archives[archive.location],
          autoload: DEFAULT_AUTOLOAD_ARCHIVES
        };
      });
    });
  }

  /**
   * Ensure that all opened windows are registered/unregistered with the ipc router and setup behaviour when all
   * windows are closed.
   */
  async function initRouter() {
    // Ensure windows are added to and removed from router when they are opened and closed.
    electronApp.on('browser-window-created', (_, window) => {
      app.router.addWindow(window.webContents);

      window.on('close', () => {
        app.router.removeWindow(window.webContents);
      });
    });
  }

  /**
   * Show the window for an archive.
   */
  async function showArchiveWindow(archive: ArchivePackage) {
    const baseTitle = path.basename(
      archive.location,
      path.extname(archive.location)
    );

    const window = await createFrontendWindow({
      title: baseTitle.replace(
        /_[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
        ''
      ),
      config: { documentId: archive.id, type: 'archive' },
      resolveMedia: (uri) => MediaFileService.resolveRenditionUri(archive, uri),
      router: app.router
    });

    app.router.addWindow(window.webContents, archive.id);

    window.on('close', () => {
      app.archiveService.closeArchive(archive.id);
    });
  }

  /**
   * Restore the previously opened windows, or else show the first launch window.
   */
  async function showInitialScreen() {
    let hasAutoloaded = false;

    // Open any autoloaded archives
    const settings = await getUserConfig();

    for (const [location, opts] of Object.entries(settings.archives)) {
      try {
        await stat(location);
      } catch {
        await updateUserConfig((prev) => {
          delete prev.archives[location];
        });
      }

      if (opts.autoload) {
        await app.archiveService.openArchive(location, opts.id);
        hasAutoloaded = true;
      }
    }

    if (!hasAutoloaded) {
      showLandingScreen();
    }
  }

  /**
   * Show the 'first launch' window if we have nothing else to show.
   */
  async function showLandingScreen() {
    if (newArchiveWindow) {
      newArchiveWindow.focus();
      return;
    }

    const window = await createFrontendWindow({
      title: 'New Archive',
      config: { type: 'splash-screen' },
      router: app.router,
      size: WindowSize.SMALL
    });

    window.on('close', () => {
      app.router.removeWindow(window.webContents);
      newArchiveWindow = undefined;
    });

    newArchiveWindow = window;
  }

  /** If we're running in dev mode, show the de */
  async function initDevtools() {
    if (SHOW_DEVTOOLS) {
      const {
        default: installExtension,
        REACT_DEVELOPER_TOOLS
        // eslint-disable-next-line @typescript-eslint/no-var-requires
      } = require('electron-devtools-installer');

      installExtension([REACT_DEVELOPER_TOOLS])
        .then((name: string) => console.log(`Added Extension:  ${name}`))
        .catch((err: unknown) => console.log('An error occurred: ', err));
    }
  }

  async function initUpdates() {
    autoUpdater.allowPrerelease = true;

    try {
      await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      log.error('Auto-update failed with error', error);
    }
  }
}

electronApp.whenReady().then(main);
