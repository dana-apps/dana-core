/* eslint-disable @typescript-eslint/no-var-requires */

const { ipcRenderer, contextBridge, Menu } = require('electron');

const getFrontendConfig = () => {
  const configArg = process.argv.find((x) =>
    x.startsWith('--frontend-config=')
  );
  const configStr = configArg && configArg.replace(/^--frontend-config=/, '');

  return (configStr && JSON.parse(configStr)) || undefined;
};

contextBridge.exposeInMainWorld('bridge', {
  // Expose args passed in to the renderer process
  config: getFrontendConfig(),

  ui: {
    showContextMenu: (location, contents) => {
      const menu = Menu.buildFromTemplate(contents);
      menu.popup(location);

      return () => menu.closePopup();
    }
  },

  ipcRenderer: {
    ...ipcRenderer,

    // Bind the event handler functions so we can listen to events from the app.
    on: ipcRenderer.on.bind(ipcRenderer),
    off: ipcRenderer.off.bind(ipcRenderer)
  }
});
