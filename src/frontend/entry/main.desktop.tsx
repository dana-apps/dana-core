/** @jsxImportSource theme-ui */

import './shell.css';

import { render } from 'react-dom';
import { ThemeProvider } from 'theme-ui';
import type { IpcRenderer } from 'electron';

import { theme } from '../ui/theme';
import { Window, WindowInset } from '../ui/window';
import { FrontendConfigContext } from '../config';
import { FrontendConfig } from '../../common/frontend-config';

/** Exposed from main process via browser-preload.js */
declare const bridge: {
  config: FrontendConfig;
  ipcRenderer: IpcRenderer;
};

const app = (
  <FrontendConfigContext.Provider value={bridge.config}>
    <ThemeProvider theme={theme}>
      <Window>
        <WindowInset />
        <div sx={{ px: 3 }}>Hello {bridge.config.platform}</div>
      </Window>
    </ThemeProvider>
  </FrontendConfigContext.Provider>
);

render(app, document.getElementById('root'), () =>
  setTimeout(() =>
    bridge.ipcRenderer.send('render-window', bridge.config.windowId)
  )
);
