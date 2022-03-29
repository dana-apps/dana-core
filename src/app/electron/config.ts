import { app } from 'electron';
import isDev from 'electron-is-dev';
import { mkdir } from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { getFileUrl } from '../util/platform';
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
