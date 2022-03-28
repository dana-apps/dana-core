import { app } from 'electron';
import isDev from 'electron-is-dev';
import { mkdir } from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { getFileUrl } from '../../common/platform';
import { readJson, writeJson } from '../util/json-utils';

const CONFIG_DIR = path.join(app.getPath('userData'), 'danacore');

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

const UserConfig = z.object({
  autoload: z.record(
    z.object({
      autoload: z.boolean()
    })
  )
});
export type UserConfig = z.TypeOf<typeof UserConfig>;

export async function getUserConfig() {
  await mkdir(CONFIG_DIR, { recursive: true });
  return readJson(path.join(CONFIG_DIR, 'settings.json'), UserConfig, {
    autoload: {}
  });
}

export async function writeUserConfig(val: UserConfig) {
  await mkdir(CONFIG_DIR, { recursive: true });
  return writeJson(path.join(CONFIG_DIR, 'settings.json'), UserConfig, val);
}

export async function updateUserConfig(fn: (val: UserConfig) => void) {
  const config = await getUserConfig();
  fn(config);
  await writeUserConfig(config);

  return config;
}
