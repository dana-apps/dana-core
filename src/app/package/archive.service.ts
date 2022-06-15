import { AnyEntity, Constructor, EntityClass, MikroORM } from '@mikro-orm/core';
import { Migration } from '@mikro-orm/migrations';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { EventEmitter } from 'eventemitter3';
import { mkdir } from 'fs/promises';
import { sortBy } from 'lodash';
import path from 'path';
import { Logger } from 'tslog';
import { ArchiveOpeningError } from '../../common/interfaces/archive.interfaces';

import { required } from '../../common/util/assert';
import { error, ok } from '../../common/util/error';
import { discoverModuleExports } from '../util/module-utils';
import { ArchivePackage, ArchiveSyncConfig } from './archive-package';

/**
 * Manages get/open/create/close operations on archive packages.
 */
export class ArchiveService extends EventEmitter<ArchiveEvents> {
  private _archives = new Map<string, ArchivePackage>();
  private log = new Logger({ name: 'ArchiveService' });

  constructor(private hooks: ArchiveHooks = {}) {
    super();
  }

  /**
   * Open an archive, start any processes associated with it and add it to the list of open archives.
   *
   * The directory will be created (along with intermediate directories) if it does not already exist.
   *
   * @param location Absolute path to the archive package on disk
   * @returns An ArchivePackage instance
   */
  async openArchive(location: string) {
    const { entities, migrations } = readSchema();

    const db = await MikroORM.init<SqliteDriver>({
      type: 'sqlite',
      dbName: path.join(location, 'db.sqlite3'),
      debug: !!process.env.SQL_LOG_ENABLED,
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
    } catch (err) {
      this.log.error(err);
      return error(ArchiveOpeningError.DATABASE_INCONSISTENCY);
    }

    try {
      await mkdir(path.join(location, 'blob'), { recursive: true });
    } catch (err) {
      this.log.error(err);

      return error(ArchiveOpeningError.IO_ERROR);
    }

    const normalizedLocation = path.normalize(location);

    const archive = new ArchivePackage(
      normalizedLocation,
      db,
      await this.hooks.getCmsSyncConfig?.(normalizedLocation)
    );
    this._archives.set(normalizedLocation, archive);

    this.emit('opened', {
      archive
    });

    return ok(archive);
  }

  /**
   * Close an archive, stop any processes associated with it and remove from the list of open archives.
   *
   * @param location Absolute path to the archive package on disk
   * @returns An ArchivePackage instance
   */
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

  /**
   * Return an open archive instance
   *
   * @param location Absolute path to the archive
   * @returns The archive instance, or undefined if not open.
   */
  getArchive(location: string) {
    return this._archives.get(path.normalize(location));
  }

  /**
   * Return all open archive instances
   */
  get archives() {
    return this._archives.values();
  }
}

/**
 * Dispatched when an archive is opened or closed.
 */
interface ArchiveEvent {
  archive: ArchivePackage;
}

export interface ArchiveEvents {
  opened: [ArchiveEvent];
  closed: [ArchiveEvent];
}

/**
 * Locate all database entities and migrations in the built js bundle. This uses a vite-specific API and will fail if
 * the app wasn't either built using vite or its import.meta api shimmed.
 *
 * @returns All database entities and migrations in the built js bundle
 */
function readSchema() {
  const isClass = (x: unknown) =>
    typeof x === 'function' && x.prototype !== Function.prototype;

  const exportedEntities = discoverModuleExports<EntityClass<AnyEntity>>(
    import.meta.globEager('../**/*.entity.ts'),
    isClass
  );
  const exportedMigrations = discoverModuleExports<Constructor<Migration>>(
    import.meta.globEager('../migrations/*.ts'),
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

export interface ArchiveHooks {
  getCmsSyncConfig?(path: string): Promise<ArchiveSyncConfig | undefined>;
}
