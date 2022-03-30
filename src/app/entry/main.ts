import { app as electronApp, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { initAssets } from '../asset/asset.init';
import { initApp } from '../electron/app';
import {
  getUserConfig,
  SHOW_DEVTOOLS,
  updateUserConfig
} from '../electron/config';
import { getSystray } from '../electron/systray';
import { createFrontendWindow } from '../electron/window';
import { initIngest } from '../ingest/ingest.init';
import { initMedia } from '../media/media.init';
import { ArchivePackage } from '../package/archive-package';

async function main() {
  let newArchiveWindow: BrowserWindow | undefined;

  /** Setup the business logic of the app */
  const app = await initApp();
  const assets = initAssets(app.router);
  const media = initMedia();
  await initIngest(
    app.router,
    app.archiveService,
    media.fileService,
    assets.assetService
  );

  ipcMain.on('restart', () => {
    electronApp.relaunch();
    electronApp.exit();
  });

  await initDevtools();
  await initSystray();
  await initWindows();
  await initArchives();
  await showInitialScreen();

  /**
   * Setup electon bindings for archives.
   */
  async function initArchives() {
    // When an archive document is opened, show its window.
    app.archiveService.on('opened', ({ archive }) => {
      showArchiveWindow(archive);
    });

    // When an archive document is opened, add it to the autoload array.
    app.archiveService.on('opened', async ({ archive }) => {
      updateUserConfig((config) => {
        config.autoload[archive.location] = { autoload: true };
      });
    });
  }

  /**
   * Ensure that all opened windows are registered/unregistered with the ipc router and setup behaviour when all
   * windows are closed.
   */
  async function initWindows() {
    // Move to 'background' mode when all windows are closed.
    electronApp.on('window-all-closed', () => {
      electronApp.dock?.hide();
    });

    // Ensure windows are added to and removed from router when they are opened and closed.
    electronApp.on('browser-window-created', (_, window) => {
      // Move to 'foreground' mode.
      electronApp.dock?.show();

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
    const window = createFrontendWindow({
      title: path.basename(archive.location, path.extname(archive.location)),
      config: { documentId: archive.id }
    });

    app.router.addWindow(window.webContents, archive.location);

    window.on('close', () => {
      app.archiveService.closeArchive(archive.location);
    });
  }

  /**
   * Restore the previously opened windows, or else show the first launch window.
   */
  async function showInitialScreen() {
    let hasAutoloaded = false;

    // Open any autoloaded archives
    const settings = await getUserConfig();
    for (const [location, opts] of Object.entries(settings.autoload)) {
      if (opts.autoload) {
        hasAutoloaded = true;
        app.archiveService.openArchive(location);
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

    const window = createFrontendWindow({ title: 'New Archive', config: {} });

    window.on('close', () => {
      app.router.removeWindow(window.webContents);
      newArchiveWindow = undefined;
    });

    newArchiveWindow = window;
  }

  /**
   * Setup the systray menu and bind its event handlers.
   */
  async function initSystray() {
    const systray = getSystray();
    systray.on('click', showInitialScreen);

    systray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Exit',
          click: () => {
            process.exit();
          }
        }
      ])
    );

    electronApp.dock?.hide();
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
}

electronApp.whenReady().then(main);
