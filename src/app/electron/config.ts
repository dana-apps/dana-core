import { app } from 'electron';
import isDev from 'electron-is-dev';
import { mkdir } from 'fs/promises';
import path from 'path';
import { z } from 'zod';

import { readJsonSync, writeJson } from '../util/json-utils';

const CONFIG_DIR = path.join(app.getPath('userData'), 'danacore');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

/**
 * Schema for the user's config file.
 */
const UserConfig = z.object({
  /** List of archives to automatically open on load */
  archives: z.record(
    z.object({
      autoload: z.boolean(),
      syncConfig: z
        .object({
          url: z.string(),
          auth: z.string()
        })
        .optional()
    })
  ),
  flags: z.record(z.unknown()).optional()
});
export type UserConfig = z.TypeOf<typeof UserConfig>;

let config = readJsonSync(CONFIG_FILE, UserConfig, {
  archives: {}
});

/**
 * Load and return the saved user config, or return the default configuration if none previously saved.
 *
 * @returns Config object for the current user.
 */
export async function getUserConfig() {
  return config;
}

/**
 * Save configuration for the current user.
 */
export async function writeUserConfig(val: UserConfig) {
  config = val;
  await mkdir(CONFIG_DIR, { recursive: true });
  return writeJson(CONFIG_FILE, UserConfig, val);
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

const parseRuntimeFlag = (key: string, defaultValue = false) => {
  const flag = parseRuntimeConfig(key, String(defaultValue));
  return Boolean(JSON.parse(flag));
};

const parseRuntimeConfig = (key: string, defaultValue: string) => {
  let value = process.env['DANA_' + key];
  if (typeof value === 'undefined') {
    const configValue = config.flags?.[key];

    if (typeof configValue !== 'undefined') {
      value = String(config.flags?.[key]);
    }
  }

  if (typeof value === 'undefined') {
    return defaultValue;
  }

  return value;
};

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
export const SHOW_DEVTOOLS = parseRuntimeFlag('SHOW_DEVTOOLS', isDev);

/** Enable developer tools */
export const HIDE_UNTIL_RENDER = parseRuntimeFlag('HIDE_UNTIL_RENDER', !isDev);

/** Override frontend source URL */
export const FRONTEND_ENTRYPOINT = parseRuntimeConfig(
  'FRONTEND_ENTRYPOINT',
  DEFAULT_FRONTEND_ENTRYPOINT
);

/** Should archives default to autoloading on startup? */
export const DEFAULT_AUTOLOAD_ARCHIVES = parseRuntimeFlag(
  'AUTOLOAD_ARCHIVES',
  isDev
);
