import {
  Constructor,
  FilterQuery,
  MikroORM,
  RequestContext
} from '@mikro-orm/core';
import { SqlEntityManager, SqliteDriver } from '@mikro-orm/sqlite';
import path from 'path';

import {
  PaginatedResourceList,
  Resource,
  ResourceList
} from '../../common/resource';

export class ArchivePackage {
  constructor(readonly location: string, private db: MikroORM<SqliteDriver>) {}

  get id() {
    return this.location;
  }

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

  get<T extends Resource>(
    type: Constructor<T>,
    id: string
  ): Promise<T | undefined> {
    return this.useDb(async (db) => {
      return db.findOne(type, { id });
    });
  }

  list<T extends Resource>(
    type: Constructor<T>,
    query?: FilterQuery<T>,
    paginationToken?: string
  ) {
    return this.useDb(async (db): Promise<PaginatedResourceList<T>> => {
      const PAGE_SIZE = 100;
      const pageNumber = paginationToken ? Number(paginationToken) : 0;

      const [items, count] = await db.findAndCount(type, query, {
        offset: pageNumber * PAGE_SIZE,
        limit: PAGE_SIZE
      });

      const lastPage = Math.floor(count / PAGE_SIZE);

      return new PaginatedResourceList(
        (paginationToken) => this.list(type, query, paginationToken),
        count,
        items,
        String(pageNumber),
        pageNumber >= lastPage ? undefined : String(pageNumber + 1),
        pageNumber === 0 ? undefined : '0'
      );
    });
  }

  get blobPath() {
    return path.join(this.location, 'blob');
  }
}
