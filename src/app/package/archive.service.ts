import { AnyEntity, Constructor, EntityClass, MikroORM } from '@mikro-orm/core';
import { Migration } from '@mikro-orm/migrations';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { EventEmitter } from 'eventemitter3';
import { mkdir } from 'fs/promises';
import { sortBy } from 'lodash';
import path from 'path';
import { ArchiveOpeningError } from '../../common/interfaces/archive.interfaces';

import { required } from '../../common/util/assert';
import { error, ok } from '../../common/util/error';
import { discoverModuleExports } from '../util/module-utils';
import { ArchivePackage } from './archive-package';

/**
 * Main service for get/open/create/close operations on archive packages.
 */
export class ArchiveService extends EventEmitter<ArchiveEvents> {
  private _archives = new Map<string, ArchivePackage>();

  async openArchive(location: string) {
    const { entities, migrations } = readSchema();

    const db = await MikroORM.init<SqliteDriver>({
      type: 'sqlite',
      dbName: path.join(location, 'db.sqlite3'),
      entities,
      migrations: {
        migrationsList: migrations
      },
      discovery: {
        disableDynamicFileAccess: true
      }
    });

    try {
      await db.getMigrator().up();
    } catch {
      return error(ArchiveOpeningError.DATABASE_INCONSISTENCY);
    }

    try {
      await mkdir(path.join(location, 'blob'));
    } catch {
      return error(ArchiveOpeningError.IO_ERROR);
    }

    const normalizedLocation = path.normalize(location);

    const archive = new ArchivePackage(normalizedLocation, db);
    this._archives.set(normalizedLocation, archive);

    this.emit('opened', {
      archive
    });

    return ok(archive);
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

  getArchive(location: string) {
    return this._archives.get(location);
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

function readSchema() {
  const isClass = (x: unknown) =>
    typeof x === 'function' && x.prototype !== Function.prototype;

  const exportedEntities = discoverModuleExports<EntityClass<AnyEntity>>(
    import.meta.globEager('../**/*.entity.ts'),
    isClass
  );
  const exportedMigrations = discoverModuleExports<Constructor<Migration>>(
    import.meta.globEager('../migrations/*'),
    isClass
  );

  return {
    entities: exportedEntities.flatMap((e) => e.exports),
    migrations: sortBy(exportedMigrations, 'module').map((m) => ({
      name: m.module,
      class: m.exports[0]
    }))
  };
}
