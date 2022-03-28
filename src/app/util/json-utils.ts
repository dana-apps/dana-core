import { readFile, writeFile } from 'fs/promises';
import { z } from 'zod';
import { parse } from 'secure-json-parse';

export async function readJson<T>(
  path: string,
  schema: z.Schema<T>
): Promise<T | undefined>;
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

export async function writeJson<T>(path: string, schema: z.Schema<T>, data: T) {
  const json = schema.parse(data);
  return await writeFile(path, JSON.stringify(json));
}
