import { ThemeProvider } from 'theme-ui';
import { theme } from '../src/frontend/ui/theme';
import { FrontendConfigContext } from '../src/frontend/config';
import { MockIpc } from '../src/frontend/ipc/mock-ipc';
import { IpcContext } from '../src/frontend/ipc/ipc.hooks';

export const parameters = {
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/
    }
  }
};

const config = {
  platform: 'web',
  windowId: 'win',
  documentId: 'doc'
};

const defaultIpc = new MockIpc();

export const decorators = [
  (Story) => (
    <IpcContext.Provider value={{ ipc: defaultIpc }}>
      <FrontendConfigContext.Provider value={config}>
        <ThemeProvider theme={theme}>
          <Story />
        </ThemeProvider>
      </FrontendConfigContext.Provider>
    </IpcContext.Provider>
  )
];
