import {
  AnyEntity,
  Constructor,
  FilterQuery,
  MikroORM,
  RequestContext
} from '@mikro-orm/core';
import { AutoPath } from '@mikro-orm/core/typings';
import { SqlEntityManager, SqliteDriver } from '@mikro-orm/sqlite';
import path from 'path';

import { PaginatedResourceList, Resource } from '../../common/resource';

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
    return this.useDb((db) => db.transactional(cb));
  }

  get<T extends Resource>(
    type: Constructor<T>,
    id: string
  ): Promise<T | undefined> {
    return this.useDb(async (db) => {
      return db.findOne(type, { id });
    });
  }

  list<T extends Resource & AnyEntity<T>, P extends string = never>(
    type: Constructor<T>,
    query?: FilterQuery<T>,
    opts: string | ListOpts<T, P> = {}
  ) {
    const { paginationToken, populate } =
      typeof opts === 'string'
        ? ({ paginationToken: opts } as ListOpts<T>)
        : opts;

    return this.useDb(async (db): Promise<PaginatedResourceList<T>> => {
      const PAGE_SIZE = 100;
      const pageNumber = opts ? Number(paginationToken) : 0;

      const [items, count] = await db.findAndCount(type, query, {
        offset: pageNumber * PAGE_SIZE,
        limit: PAGE_SIZE,
        populate: populate
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

interface ListOpts<T extends AnyEntity<T>, P extends string = never> {
  paginationToken?: string;
  populate?: Array<AutoPath<T, P>>;
}
