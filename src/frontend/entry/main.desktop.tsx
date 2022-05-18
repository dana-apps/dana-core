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
import { ReactElement, StrictMode } from 'react';
import { SelectionContext } from '../ui/hooks/selection.hooks';
import { never } from '../../common/util/assert';
import { ModalScreen } from '../screens/modal.screen';

/** Exposed from main process via browser-preload.js */
declare const bridge: {
  config: FrontendConfig;
  ipcRenderer: IpcRenderer;
};

const ipc = new ElectronRendererIpc(bridge.ipcRenderer);

const renderWindow = (el: ReactElement) => {
  const app = (
    <StrictMode>
      <ThemeProvider theme={theme}>
        <SelectionContext.Provider>
          <MemoryRouter>
            <IpcContext.Provider
              value={{ ipc, documentId: bridge.config.documentId }}
            >
              <FrontendConfigContext.Provider value={bridge.config}>
                <Window>{el}</Window>
              </FrontendConfigContext.Provider>
            </IpcContext.Provider>
          </MemoryRouter>
        </SelectionContext.Provider>
      </ThemeProvider>
    </StrictMode>
  );

  render(app, document.getElementById('root'), () =>
    setTimeout(() =>
      bridge.ipcRenderer.send('render-window', bridge.config.windowId)
    )
  );
};

if (bridge.config.type === 'splash-screen') {
  import('../screens/initial.screen').then(({ InitialScreen }) =>
    renderWindow(<InitialScreen />)
  );
} else if (bridge.config.type === 'archive') {
  import('../app').then(({ ArchiveWindow }) =>
    renderWindow(<ArchiveWindow title={bridge.config.title} />)
  );
} else if (bridge.config.type === 'modal') {
  import('../screens/modal.screen').then(({ ModalScreen }) =>
    renderWindow(<ModalScreen />)
  );
} else {
  never(bridge.config.type);
}
