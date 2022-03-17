import path from 'path';
import os from 'os';

import { app } from 'electron';
import isDev from 'electron-is-dev';

/** Resolve a static resource bundled into the app */
export function getResourcePath(resource: string) {
  if (isDev) {
    return path.resolve(process.cwd(), 'static', resource);
  }

  if (os.platform() === 'darwin') {
    return path.resolve(
      path.dirname(app.getPath('exe')),
      '..',
      'Resources',
      'static',
      resource
    );
  }

  return path.resolve(
    path.dirname(app.getPath('exe')),
    'resources',
    'static',
    resource
  );
}
