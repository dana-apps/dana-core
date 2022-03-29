import path from 'path';
import os from 'os';
import { FrontendPlatform } from '../../common/frontend-config';

/**
 * Cross-platform utility for creating a file url representing an absolute path.
 *
 * @param pathString Absolute path to represent.
 * @param pathModule NodeJS path module to construct the url from. Defaults to the host os's native path format.
 * @returns A `file://` representing `pathString`
 */
export function getFileUrl(pathString: string, pathModule = path) {
  if (pathModule.sep === '\\') {
    return 'file:///' + pathModule.resolve(pathString).replace(/\\/g, '/');
  }

  return 'file://' + pathModule.resolve(pathString);
}

/**
 * Return the correct `FrontendPlatform` value for the current os.
 *
 * @returns A `FrontendPlatform` for the current os.
 */
export const getFrontendPlatform = (): FrontendPlatform => {
  if (os.platform() === 'darwin') {
    return 'mac';
  }
  if (os.platform() === 'win32') {
    return 'windows';
  }

  return 'linuxish';
};
