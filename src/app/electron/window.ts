import { app, BrowserWindow, ipcMain } from 'electron';
import { uniqueId } from 'lodash';

import { FrontendConfig } from '../../common/frontend-config';
import { getFrontendPlatform } from '../util/platform';
import { FRONTEND_SOURCE_URL, SHOW_DEVTOOLS } from './config';
import { getResourcePath } from './resources';

interface CreateFrontendWindow {
  /** Title of the window */
  title: string;

  /** Config object passed to frontend */
  config: Omit<FrontendConfig, 'platform' | 'windowId'>;
}

/** Show a new frontend window */
export function createFrontendWindow({ title, config }: CreateFrontendWindow) {
  const mergedConfig: FrontendConfig = {
    ...config,
    windowId: uniqueId(),
    platform: getFrontendPlatform(),
    title
  };

  const frontendWindow = new BrowserWindow({
    title,

    height: 950,
    width: 1100,
    minWidth: 280,
    minHeight: 155,

    // Prevent flash of empty content by waiting until we've rendered before showing
    paintWhenInitiallyHidden: true,
    show: false,

    // Show a frameless window so that we can render our own chrome
    frame: false,
    transparent: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true,
    closable: true,
    titleBarStyle: 'customButtonsOnHover',
    thickFrame: false,

    webPreferences: {
      additionalArguments: [
        '--frontend-config=' + JSON.stringify(mergedConfig)
        // ...(isDev ? ['] : [])
      ],
      webSecurity: true,
      preload: getResourcePath('preload/browser-preload.js')
    }
  });

  showWindowAfterFirstRender(mergedConfig, frontendWindow);
  frontendWindow.loadURL(FRONTEND_SOURCE_URL);

  app.dock?.show();

  return frontendWindow;
}

/** Don't show the window immediately – wait for react to render first */
function showWindowAfterFirstRender(
  config: FrontendConfig,
  window: BrowserWindow
) {
  const onWindowRendered = (_evt: unknown, id: string) => {
    if (id !== config.windowId) {
      return;
    }

    ipcMain.off('render-window', onWindowRendered);
    if (window.isDestroyed()) {
      return;
    }

    window.show();

    if (SHOW_DEVTOOLS) {
      window.maximize();

      // Showing devtools immediately after loading the window seems to break devtools and result in a blank pane.
      // Wait for a few seconds before opening in order to keep electron happy.
      setTimeout(() => {
        window.webContents.openDevTools();
      }, 2000);
    }
  };

  ipcMain.on('render-window', onWindowRendered);
}
