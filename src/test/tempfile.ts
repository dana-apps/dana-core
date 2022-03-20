import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { ArchiveService } from '../app/package/archive.service';
import { onCleanup } from './teardown';

export const getTempfiles = async () => {
  const dir = await fs.mkdtemp((await fs.realpath(os.tmpdir())) + path.sep);
  onCleanup(() => fs.rm(dir, { recursive: true }));

  return () => path.join(dir, randomUUID());
};

export async function getTempPackage(location: string) {
  const archiveService = new ArchiveService();
  const archive = await archiveService.openArchive(location);

  onCleanup(() => archiveService.closeArchive(location));

  if (archive.status === 'error') {
    throw Error(archive.error);
  }

  return archive.value;
}
