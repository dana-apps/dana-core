import { app } from 'electron';
import isDev from 'electron-is-dev';
import { mkdir } from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { readJson, writeJson } from '../util/json-utils';

const CONFIG_DIR = path.join(app.getPath('userData'), 'danacore');

/**
 * Absolute path of built frontend bundle (if we're running in production).
 * Note that `__dirname` here is that of the built electron process bundle, not this source file
 **/
export const FRONTEND_BUNDLE_DIR = isDev
  ? undefined
  : path.join(__dirname, '..', 'renderer');

/** Default frontend entrypoint (if not overriden through environment) */
const DEFAULT_FRONTEND_ENTRYPOINT = FRONTEND_BUNDLE_DIR
  ? 'app://app/desktop.html'
  : 'http://localhost:3000/desktop.html';

/** Enable developer tools */
export const SHOW_DEVTOOLS =
  process.env['SHOW_DEVTOOLS'] || isDev ? true : false;

/** Override frontend source URL */
export const FRONTEND_ENTRYPOINT =
  process.env['FRONTEND_SOURCE_URL'] ?? DEFAULT_FRONTEND_ENTRYPOINT;

/**
 * Schema for the user's config file.
 */
const UserConfig = z.object({
  /** List of archives to automatically open on load */
  autoload: z.record(
    z.object({
      autoload: z.boolean()
    })
  )
});
export type UserConfig = z.TypeOf<typeof UserConfig>;

/**
 * Load and return the saved user config, or return the default configuration if none previously saved.
 *
 * @returns Config object for the current user.
 */
export async function getUserConfig() {
  await mkdir(CONFIG_DIR, { recursive: true });
  return readJson(path.join(CONFIG_DIR, 'settings.json'), UserConfig, {
    autoload: {}
  });
}

/**
 * Save configuration for the current user.
 */
export async function writeUserConfig(val: UserConfig) {
  await mkdir(CONFIG_DIR, { recursive: true });
  return writeJson(path.join(CONFIG_DIR, 'settings.json'), UserConfig, val);
}

/**
 * Convenience function for loading, updating and saving the user config.
 *
 * @param updater Updater function to mutate the user config before saving
 * @returns The updated user config.
 */
export async function updateUserConfig(updater: (val: UserConfig) => void) {
  const config = await getUserConfig();
  updater(config);
  await writeUserConfig(config);

  return config;
}
