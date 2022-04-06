import { app, BrowserWindow, ipcMain, protocol, session } from 'electron';
import { uniqueId } from 'lodash';
import path from 'path';

import { FrontendConfig } from '../../common/frontend-config';
import { getFrontendPlatform } from '../util/platform';
import { FRONTEND_SOURCE_URL, SHOW_DEVTOOLS } from './config';
import { getResourcePath } from './resources';

interface CreateFrontendWindow {
  /** Title of the window */
  title: string;

  /** Config object passed to frontend */
  config: Omit<FrontendConfig, 'platform' | 'windowId'>;

  /** Directory from which `media:` url schemes will be resolved from */
  mediaDir?: string;
}

/** Show a new frontend window */
export function createFrontendWindow({
  title,
  config,
  mediaDir
}: CreateFrontendWindow) {
  const mergedConfig: FrontendConfig = {
    ...config,
    windowId: uniqueId(),
    platform: getFrontendPlatform(),
    title
  };

  const partition = initUrlSchemePartition(mediaDir);
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
      partition,
      preload: getResourcePath('preload/browser-preload.js')
    }
  });

  showWindowAfterFirstRender(mergedConfig, frontendWindow);
  frontendWindow.loadURL(FRONTEND_SOURCE_URL);

  app.dock?.show();

  return frontendWindow;
}

/**
 * Grants the window access to custom url schemes to access media files over media: uris.
 * See: https://www.electronjs.org/docs/latest/api/protocol#using-protocol-with-a-custom-partition-or-session
 *
 * This is needed because we can't safely allow the renderer process access to `file://` urls.
 *
 * @param mediaDir Directory to serve media from.
 * @returns An electron partition id defining the privilages we're granting to the new window.
 */
function initUrlSchemePartition(mediaDir?: string) {
  if (mediaDir) {
    const partition = uniqueId('partition:');
    const ses = session.fromPartition(partition);
    const slugOffset = 'media://'.length;

    ses.protocol.registerFileProtocol('media', (request, cb) => {
      const slug = request.url.substring(slugOffset);
      const mediaPath = path.join(mediaDir, slug);

      cb(path.normalize(mediaPath));
    });

    return partition;
  }
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

/**
 * Declare that our custom media: uri scheme is safe and not subject to the CSP.
 * This must happen before the electron app is initialized, so we do it at module scope.
 *
 * See: https://www.electronjs.org/docs/latest/api/protocol#using-protocol-with-a-custom-partition-or-session
 */
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true } }
]);
