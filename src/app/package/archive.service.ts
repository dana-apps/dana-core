import { EventEmitter } from 'eventemitter3';
import path from 'path';

import { required } from '../../common/util/assert';
import { ok, OkResult } from '../../common/util/error';
import { ArchivePackage } from './archive-package';

export class ArchiveService extends EventEmitter<ArchiveEvents> {
  private _archives = new Map<string, ArchivePackage>();

  async openArchive(location: string) {
    const archive = await ArchivePackage.open(location);
    this._archives.set(path.normalize(location), archive);

    this.emit('opened', {
      archive
    });
  }

  async closeArchive(location: string) {
    location = path.normalize(location);
    const archive = required(
      this._archives.get(location),
      'Archive is not open:',
      location
    );
    this._archives.delete(location);
    this.emit('closed', {
      archive
    });

    await archive.teardown();
  }

  get archives() {
    return this._archives.values();
  }
}

interface ArchiveEvent {
  archive: ArchivePackage;
}

export interface ArchiveEvents {
  opened: [ArchiveEvent];
  closed: [ArchiveEvent];
}
