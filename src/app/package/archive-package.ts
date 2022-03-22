import { MikroORM, RequestContext } from '@mikro-orm/core';
import { SqlEntityManager, SqliteDriver } from '@mikro-orm/sqlite';
import path from 'path';

export class ArchivePackage {
  constructor(readonly location: string, private db: MikroORM<SqliteDriver>) {}

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
