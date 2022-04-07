import type { IpcRenderer } from 'electron';

declare const bridge: {
  ipc: IpcRenderer;
};
