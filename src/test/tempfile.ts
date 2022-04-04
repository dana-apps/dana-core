import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { ArchiveService } from '../app/package/archive.service';
import { onCleanup } from './teardown';

/**
 *
 * Create a temporary directory and return a function that generates a random path within it.
 *
 * Tries to be nice and remove the directory when the test ends.
 *
 * @param root Specify the parent directory of created paths. Defaults to creating a new directory in the system's
 * temp dir.
 * @returns Function for generating valid paths for temporary files.
 */
export const getTempfiles = async (root?: string) => {
  const dir =
    root ?? (await fs.mkdtemp((await fs.realpath(os.tmpdir())) + path.sep));
  onCleanup(() => fs.rm(dir, { recursive: true }));

  return () => path.join(dir, randomUUID());
};

/**
 * Create a fresh archive package. Closes it when tests finish.
 *
 * @param location Location of the archive.
 * @returns A new archive package for use in tests.
 */
export async function getTempPackage(location: string) {
  const archiveService = new ArchiveService();
  const archive = await archiveService.openArchive(location);

  onCleanup(() => archiveService.closeArchive(location));

  if (archive.status === 'error') {
    throw Error(archive.error);
  }

  return archive.value;
}
