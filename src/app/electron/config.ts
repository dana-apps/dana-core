import isDev from 'electron-is-dev';
import path from 'path';
import { getFileUrl } from '../../common/platform';

/** Relative location of app bundle root */
const BUILD_ROOT = path.join(__dirname, '..', '..');

/** Default frontend entrypoint (if not overriden through environment) */
const DEFAULT_FRONTEND_SOURCE_URL = isDev
  ? 'http://localhost:3000/desktop.html'
  : getFileUrl(path.join(BUILD_ROOT, 'build/renderer/desktop.html'));

/** Enable developer tools */
export const SHOW_DEVTOOLS = process.env.SHOW_DEVTOOLS || isDev ? true : false;

/** Override frontend source URL */
export const FRONTEND_SOURCE_URL =
  process.env.FRONTEND_SOURCE_URL ?? DEFAULT_FRONTEND_SOURCE_URL;
