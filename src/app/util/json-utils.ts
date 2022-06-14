import { readFile, writeFile } from 'fs/promises';
import { z } from 'zod';
import { parse } from 'secure-json-parse';
import { readFileSync } from 'fs';

/**
 * Convenience for loading a json configuration file and validating its schema
 *
 * @param path Absolute path to the configuration file.
 * @param schema Schema to validate the configuration againt.
 * @returns The validated schema, or undefined if the file wasn't found
 */
export async function readJson<T>(
  path: string,
  schema: z.Schema<T>
): Promise<T | undefined>;

/**
 * Convenience for loading a json configuration file and validating its schema, returning a default value if the file
 * does not exist.
 *
 * @param path Absolute path to the configuration file.
 * @param schema Schema to validate the configuration againt.
 * @param defaultVal Value to return if no configuration file found.
 * @returns The validated schema, or `defaultValue` if the file wasn't found
 */
export async function readJson<T>(
  path: string,
  schema: z.Schema<T>,
  defaultVal: T
): Promise<T>;
export async function readJson<T>(
  path: string,
  schema: z.Schema<T>,
  defaultVal?: T
) {
  let data;
  try {
    data = await readFile(path);
  } catch {
    return defaultVal;
  }

  const json = parse(data);
  return schema.parse(json);
}

/**
 * Convenience for loading a json configuration file and validating its schema, returning a default value if the file
 * does not exist.
 *
 * @param path Absolute path to the configuration file.
 * @param schema Schema to validate the configuration againt.
 * @param defaultVal Value to return if no configuration file found.
 * @returns The validated schema, or `defaultValue` if the file wasn't found
 */
export function readJsonSync<T>(
  path: string,
  schema: z.Schema<T>,
  defaultVal: T
): T;
export function readJsonSync<T>(
  path: string,
  schema: z.Schema<T>,
  defaultVal?: T
) {
  let data;
  try {
    data = readFileSync(path);
    const json = parse(data);
    return schema.parse(json);
  } catch {
    return defaultVal;
  }
}

/**
 * Convenience for writing a json configuration file and ensuring that it matches the expected schema
 *
 * @param path Absolute path to the write to.
 * @param schema Schema to validate the configuration againt.
 * @param schema Schema to validate the configuration againt.
 */
export async function writeJson<T>(path: string, schema: z.Schema<T>, data: T) {
  const json = schema.parse(data);
  return await writeFile(path, JSON.stringify(json));
}
