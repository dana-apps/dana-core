import { app, BrowserWindow, ipcMain, protocol, session } from 'electron';
import { uniqueId } from 'lodash';
import { platform } from 'os';
import path from 'path';
import { URL } from 'url';

import { FrontendConfig } from '../../common/frontend-config';
import {
  GetMaximizationState,
  MaximizationState,
  MaximizationStateChanged,
  ToggleMaximizeWindow,
  MinimizeWindow
} from '../../common/ui.interfaces';
import { error, ok } from '../../common/util/error';
import { getFrontendPlatform } from '../util/platform';
import {
  FRONTEND_BUNDLE_DIR,
  FRONTEND_ENTRYPOINT,
  SHOW_DEVTOOLS
} from './config';
import { getResourcePath } from './resources';
import { ElectronRouter } from './router';

interface CreateFrontendWindow {
  /** Title of the window */
  title: string;

  /** Config object passed to frontend */
  config: Omit<FrontendConfig, 'platform' | 'windowId'>;

  /** Resolve `media:` url schemes to an absolute path */
  resolveMedia?: MediaResolveFn;

  router: ElectronRouter;
}

/** Resolve `media:` url schemes to an absolute path */
type MediaResolveFn = (uri: string) => string;

/** Show a new frontend window */
export async function createFrontendWindow({
  title,
  config,
  resolveMedia,
  router
}: CreateFrontendWindow) {
  const mergedConfig: FrontendConfig = {
    ...config,
    windowId: uniqueId(),
    platform: getFrontendPlatform(),
    title
  };

  const partition = initUrlSchemePartition(resolveMedia);
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
    titleBarStyle: 'hidden',
    titleBarOverlay: platform() !== 'darwin',
    thickFrame: false,

    webPreferences: {
      additionalArguments: [
        '--frontend-config=' + JSON.stringify(mergedConfig)
      ],
      webSecurity: true,
      partition,
      preload: getResourcePath('preload/browser-preload.js')
    }
  });

  const emitState = (state: MaximizationState) => {
    router.emit(MaximizationStateChanged, state, frontendWindow.webContents);
  };

  frontendWindow.on('minimize', () => emitState('minimized'));
  frontendWindow.on('maximize', () => emitState('maximized'));
  frontendWindow.on('unmaximize', () => emitState('normal'));

  await Promise.all([
    frontendWindow.loadURL(FRONTEND_ENTRYPOINT),
    showWindowAfterFirstRender(mergedConfig, frontendWindow)
  ]);

  app.dock?.show();

  return frontendWindow;
}

/**
 * Grants the window access to custom url schemes to access media and source files over custom url schemes.
 * See: https://www.electronjs.org/docs/latest/api/protocol#using-protocol-with-a-custom-partition-or-session
 *
 * This is needed because we can't safely allow the renderer process access to `file://` urls.
 *
 * @param mediaDir Directory to serve media from.
 * @returns An electron partition id defining the privilages we're granting to the new window.
 */
function initUrlSchemePartition(resolveMedia?: MediaResolveFn) {
  const partition = uniqueId('partition:');
  const ses = session.fromPartition(partition);

  // Delegate resolution of `media:` urls to the caller of `createFrontendWindow()`
  if (resolveMedia) {
    ses.protocol.registerFileProtocol('media', (request, cb) => {
      cb(resolveMedia(request.url));
    });
  }

  // If we're running against a built source bundle, resolve `app:` urls from the frontend bundle directory.
  const bundleDir = FRONTEND_BUNDLE_DIR;
  if (bundleDir) {
    ses.protocol.registerFileProtocol('app', (request, cb) => {
      const { pathname } = new URL(request.url);
      cb(path.join(bundleDir, pathname));
    });
  }

  return partition;
}

/** Don't show the window immediately – wait for react to render first */
function showWindowAfterFirstRender(
  config: FrontendConfig,
  window: BrowserWindow
) {
  return new Promise<void>((resolve) => {
    const onWindowRendered = (_evt: unknown, id: string) => {
      if (id !== config.windowId) {
        return;
      }

      ipcMain.off('render-window', onWindowRendered);
      if (window.isDestroyed()) {
        return;
      }

      window.show();
      resolve();

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
  });
}

const getMaximizationState = (window: BrowserWindow): MaximizationState => {
  if (window.isMinimized()) {
    return 'minimized';
  } else if (window.isMaximized()) {
    return 'maximized';
  } else {
    return 'normal';
  }
};

/**
 * Declare elevated privilages for our custom uri schemes safe and not subject to the CSP.
 * This must happen before the electron app is initialized, so we do it at module scope.
 *
 * See: https://www.electronjs.org/docs/latest/api/protocol#using-protocol-with-a-custom-partition-or-session
 */
protocol.registerSchemesAsPrivileged([
  // `media:` urls load media renditions from user data on the local filesystem.
  // This tells the browser to treat them like https: urls.
  { scheme: 'media', privileges: { secure: true } },

  // `app:` urls load static assets and source files from the app bundle.
  // This tells the browser to:
  // - Treat them like https: urls
  // - Treat them as origins (including a domain portion) so that they can reference each other via relative paths.
  {
    scheme: 'app',
    privileges: { secure: true, standard: true }
  }
]);

/**
 * Setup IPC handlers for managing windows
 *
 * @param router The IPC router to bind to
 */
export async function initWindows(router: ElectronRouter) {
  router.bindRpc(MinimizeWindow, async (_1, _2, _3, contents) => {
    BrowserWindow.fromWebContents(contents)?.minimize();
    return ok();
  });

  router.bindRpc(ToggleMaximizeWindow, async (_1, _2, _3, contents) => {
    const window = BrowserWindow.fromWebContents(contents);
    if (window?.isMaximized()) {
      router.emit(MaximizationStateChanged, 'normal');
      window.unmaximize();
    } else {
      router.emit(MaximizationStateChanged, 'maximized');
      window?.maximize();
    }

    return ok();
  });

  router.bindRpc(GetMaximizationState, async (_1, _2, _3, contents) => {
    const window = BrowserWindow.fromWebContents(contents);
    return window
      ? ok<MaximizationState>(getMaximizationState(window))
      : error('UNKNOWN_WINDOW');
  });
}
