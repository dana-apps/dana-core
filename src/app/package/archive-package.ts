import {
  AnyEntity,
  EntityClass,
  MikroORM,
  RequestContext
} from '@mikro-orm/core';
import { Constructor, Migration } from '@mikro-orm/core/typings';
import { SqlEntityManager, SqliteDriver } from '@mikro-orm/sqlite';
import { mkdir } from 'fs/promises';
import { sortBy } from 'lodash';
import path from 'path';

import { discoverModuleExports } from '../util/module-utils';

export class ArchivePackage {
  static async open(location: string) {
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

    // TODO: This could fail
    await db.getMigrator().up();
    await mkdir(path.join(location, 'blob'));

    return new ArchivePackage(location, db);
  }

  private constructor(
    readonly location: string,
    private db: MikroORM<SqliteDriver>
  ) {}

  async teardown() {
    await this.db.close();
  }

  useDb<T>(cb: (db: SqlEntityManager<SqliteDriver>) => T | Promise<T>) {
    return RequestContext.createAsync<T>(this.db.em, async () =>
      cb(this.db.em)
    );
  }

  useDbTransaction<T>(cb: (db: SqlEntityManager<SqliteDriver>) => Promise<T>) {
    return this.db.em.transactional(cb);
  }

  get blobPath() {
    return path.join(this.location, 'blob');
  }
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
