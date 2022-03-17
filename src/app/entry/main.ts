import { app, ipcMain } from 'electron';
import { SHOW_DEVTOOLS } from '../electron/config';
import { getSystray } from '../electron/systray';
import { createFrontendWindow } from '../electron/window';

function showMainWindow() {
  createFrontendWindow({ title: 'Hello' });
}

async function main() {
  initDevtools();
  initSystray();

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    app.dock?.hide();
  });

  ipcMain.on('restart', () => {
    app.relaunch();
    app.exit();
  });
}

function initSystray() {
  const systray = getSystray();
  systray.on('click', showMainWindow);

  app.dock?.hide();
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

app.whenReady().then(main);
