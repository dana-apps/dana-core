import { app as electronApp, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { createApp } from '../electron/app';
import { SHOW_DEVTOOLS } from '../electron/config';
import { getSystray } from '../electron/systray';
import { createFrontendWindow } from '../electron/window';
import { ArchivePackage } from '../package/archive-package';

async function main() {
  let newArchiveWindow: BrowserWindow | undefined;

  /** Setup the business logic of the app */
  const app = await createApp();

  ipcMain.on('restart', () => {
    electronApp.relaunch();
    electronApp.exit();
  });

  initDevtools();
  initSystray();
  initWindows();
  initArchive();
  showLandingScreen();

  function initArchive() {
    // When an archive document is opened, show its window.
    app.archiveService.on('opened', ({ archive }) => {
      showArchiveWindow(archive);
    });
  }

  function initWindows() {
    // Move to 'background' mode when all windows are closed.
    electronApp.on('window-all-closed', () => {
      electronApp.dock?.hide();
    });

    // Ensure windows are added to and removed from router when they are opened and closed.
    electronApp.on('browser-window-created', (_, window) => {
      app.router.addWindow(window.webContents);

      window.on('close', () => {
        app.router.removeWindow(window.webContents);
      });
    });
  }

  function showArchiveWindow(archive: ArchivePackage) {
    const window = createFrontendWindow({
      title: path.basename(archive.location, path.extname(archive.location)),
      config: { documentId: archive.location }
    });

    app.router.addWindow(window.webContents, archive.location);

    window.on('close', () => {
      app.archiveService.closeArchive(archive.location);
    });
  }

  function showLandingScreen() {
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

  function initSystray() {
    const systray = getSystray();
    systray.on('click', showLandingScreen);

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
  function initDevtools() {
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
