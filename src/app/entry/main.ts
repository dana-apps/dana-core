import {
  app as electronApp,
  BrowserWindow,
  ipcMain,
  ipcRenderer,
  Menu
} from 'electron';
import path from 'path';
import { createApp } from '../app';
import { SHOW_DEVTOOLS } from '../electron/config';
import { ElectronRouter } from '../electron/router';
import { getSystray } from '../electron/systray';
import { createFrontendWindow } from '../electron/window';
import { ArchivePackage } from '../package/archive-package';

async function main() {
  let newArchiveWindow: BrowserWindow | undefined;

  initDevtools();
  initSystray();

  const ipc = new ElectronRouter(ipcMain);
  const app = await createApp(ipc);

  // Quit when all windows are closed.
  app.archiveService.on('opened', ({ archive }) => {
    showArchiveWindow(archive);
  });

  // Quit when all windows are closed.
  electronApp.on('window-all-closed', () => {
    electronApp.dock?.hide();
  });

  ipcMain.on('restart', () => {
    electronApp.relaunch();
    electronApp.exit();
  });

  // First-launch
  showNewArchiveWindow();

  function showArchiveWindow(archive: ArchivePackage) {
    const window = createFrontendWindow({
      title: path.basename(archive.location, path.extname(archive.location)),
      config: { documentId: archive.location }
    });

    window.on('close', () => {
      app.archiveService.closeArchive(archive.location);
      ipc.removeWindow(window.webContents);
    });

    electronApp.dock?.show();
  }

  function showNewArchiveWindow() {
    if (newArchiveWindow) {
      newArchiveWindow.focus();
      return;
    }

    const window = createFrontendWindow({ title: 'New Archive', config: {} });

    window.on('close', () => {
      ipc.removeWindow(window.webContents);
      newArchiveWindow = undefined;
    });

    electronApp.dock?.show();
    newArchiveWindow = window;
  }

  function initSystray() {
    const systray = getSystray();
    systray.on('click', showNewArchiveWindow);

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
