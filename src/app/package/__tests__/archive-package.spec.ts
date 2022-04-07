import { Entity, MikroORM, PrimaryKey } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { randomUUID } from 'crypto';
import { mkdir } from 'fs/promises';
import { times } from 'lodash';
import { collect } from 'streaming-iterables';

import { getTempfiles } from '../../../test/tempfile';
import { ArchivePackage } from '../archive-package';

@Entity()
class ExampleEntity {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();
}

describe(ArchivePackage, () => {
  test('get() returns an object in the archive', async () => {
    const { archive } = await setup();

    const entity = await archive.useDb((db) => {
      const entity = db.create(ExampleEntity, {});
      db.persistAndFlush(entity);
      return entity;
    });

    expect(await archive.get(ExampleEntity, entity.id)).toEqual(entity);
  });

  test('list() returns all objects matching the query', async () => {
    const { archive } = await setup();

    const entities = await archive.useDb((db) => {
      const entities = times(10, () => db.create(ExampleEntity, {}));
      db.persistAndFlush(entities);

      return entities;
    });

    const listQuery = await archive.list(ExampleEntity, {}, { pageSize: 3 });

    expect(await collect(listQuery)).toHaveLength(entities.length);
  });
});

async function setup() {
  const temp = await getTempfiles('tmp/test-migrations');
  const migrationsPath = temp();
  await mkdir(migrationsPath, { recursive: true });

  const db = await MikroORM.init<SqliteDriver>({
    type: 'sqlite',
    dbName: temp(),
    migrations: {
      path: migrationsPath,
      emit: 'js'
    },
    entities: [ExampleEntity]
  });

  await db.getMigrator().createInitialMigration();
  await db.getMigrator().up();

  return {
    archive: new ArchivePackage(temp(), db)
  };
}
