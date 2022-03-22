import { app, BrowserWindow, ipcMain } from 'electron';
import { uniqueId } from 'lodash';

import { FrontendConfig } from '../../common/frontend-config';
import { getFrontendPlatform } from '../../common/platform';
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
    platform: getFrontendPlatform()
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

    window.show();

    if (SHOW_DEVTOOLS) {
      window.maximize();
      window.webContents.openDevTools();
    }
  };

  ipcMain.on('render-window', onWindowRendered);
}
