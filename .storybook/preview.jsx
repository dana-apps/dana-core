import { ThemeProvider } from 'theme-ui';
import { theme } from '../src/frontend/ui/theme';
import { FrontendConfigContext } from '../src/frontend/config';

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

export const decorators = [
  (Story) => (
    <FrontendConfigContext.Provider value={config}>
      <ThemeProvider theme={theme}>
        <Story />
      </ThemeProvider>
    </FrontendConfigContext.Provider>
  )
];
