import path from 'path';
import os from 'os';
import { FrontendPlatform } from './frontend-config';

export function getFileUrl(pathString: string, pathModule = path) {
  if (pathModule.sep === '\\') {
    return 'file:///' + pathModule.resolve(pathString).replace(/\\/g, '/');
  }

  return 'file://' + pathModule.resolve(pathString);
}

export const getFrontendPlatform = (): FrontendPlatform => {
  if (os.platform() === 'darwin') {
    return 'mac';
  }
  if (os.platform() === 'win32') {
    return 'windows';
  }

  return 'linuxish';
};
