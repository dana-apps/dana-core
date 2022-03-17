import { ipcRenderer, contextBridge } from "electron";

contextBridge.exposeInMainWorld("bridge", {
  // Expose args passed in to the renderer process
  // TODO: Do this as a structured json options object
  argv: Array.from(process.argv.slice(2)),

  ipcRenderer: {
    ...ipcRenderer,

    // Bind the event handler functions so we can listen to events from the app.
    on: ipcRenderer.on.bind(ipcRenderer),
    off: ipcRenderer.off.bind(ipcRenderer),
  },
});
