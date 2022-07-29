import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { ArchiveHooks, ArchiveService } from '../app/package/archive.service';
import { requireSuccess } from './result';
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

  onCleanup(async () => {
    const timeout = 2000;
    const deadline = Date.now() + timeout;

    // Windows seems to have a small delay before actually releasing the lock on closed files.
    // When removing a directory, spin for a couple of seconds if it fails to give time to catch up.
    while (Date.now() < deadline) {
      try {
        await fs.rm(dir, { recursive: true });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  });

  return () => path.join(dir, randomUUID());
};

/**
 * Create a fresh archive package. Closes it when tests finish.
 *
 * @param location Location of the archive.
 * @returns A new archive package for use in tests.
 */
export async function getTempPackage(location: string, hooks?: ArchiveHooks) {
  const archiveService = new ArchiveService(hooks);
  const archive = requireSuccess(await archiveService.openArchive(location));

  onCleanup(() => archiveService.closeArchive(archive.id));

  return archive;
}
