/** @jsxImportSource theme-ui */

import './shell.css';

import { render } from 'react-dom';
import { ThemeProvider } from 'theme-ui';
import type { IpcRenderer } from 'electron';
import { MemoryRouter } from 'react-router-dom';

import { theme } from '../ui/theme';
import { Window } from '../ui/window';
import { FrontendConfigContext } from '../config';
import { FrontendConfig } from '../../common/frontend-config';
import { IpcContext } from '../ipc/ipc.hooks';
import { ElectronRendererIpc } from '../ipc/electron-ipc';
import { ArchiveWindow, NewArchiveWindow } from '../app';
import { StrictMode } from 'react';

/** Exposed from main process via browser-preload.js */
declare const bridge: {
  config: FrontendConfig;
  ipcRenderer: IpcRenderer;
};

const ipc = new ElectronRendererIpc(bridge.ipcRenderer);

const app = (
  <StrictMode>
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <IpcContext.Provider
          value={{ ipc, documentId: bridge.config.documentId }}
        >
          <FrontendConfigContext.Provider value={bridge.config}>
            <Window>
              {bridge.config.documentId ? (
                <ArchiveWindow />
              ) : (
                <NewArchiveWindow />
              )}
            </Window>
          </FrontendConfigContext.Provider>
        </IpcContext.Provider>
      </MemoryRouter>
    </ThemeProvider>
  </StrictMode>
);

render(app, document.getElementById('root'), () =>
  setTimeout(() =>
    bridge.ipcRenderer.send('render-window', bridge.config.windowId)
  )
);
