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
import { safeParse } from 'secure-json-parse';
import { z } from 'zod';

import { PaginatedResourceList, Resource } from '../../common/resource';

/**
 * Represents file and metadata storage for an archive.
 */
export class ArchivePackage {
  constructor(readonly location: string, private db: MikroORM<SqliteDriver>) {}

  /**
   * Unique id for the archive.
   */
  get id() {
    return this.location;
  }

  /**
   * Teardown any long-running processes managed by this object.
   */
  async teardown() {
    await this.db.close();
  }

  /**
   * Execute a block in the context of a unit of work in the ORM.
   *
   * See https://mikro-orm.io/docs/unit-of-work for more information about this.
   *
   * It is fine to nest these, it won't result in multiple transactions or units of work.
   *
   * However, all database operations must happen within the context of at _least one_ of these blocks (or
   * useDbTransaction), otherwise an exception will be thrown.
   */
  useDb<T>(cb: (db: SqlEntityManager<SqliteDriver>) => T | Promise<T>) {
    return RequestContext.createAsync<T>(this.db.em, async () =>
      cb(this.db.em)
    );
  }

  /**
   * Execute a block in the context of a database transaction. A unit of work will be set up for the transaction
   * if not already in the context of one.
   *
   * See https://mikro-orm.io/docs/unit-of-work for more information about units of work.
   */
  useDbTransaction<T>(cb: (db: SqlEntityManager<SqliteDriver>) => Promise<T>) {
    return this.useDb((db) => db.transactional(cb));
  }

  /**
   * Convenience for getting a database entity by id.
   */
  get<T extends Resource>(
    type: Constructor<T>,
    id: string
  ): Promise<T | undefined> {
    return this.useDb(async (db) => {
      return db.findOne(type, { id });
    });
  }

  /**
   * Convenience for listing a database entity and returning a pageable list of results.
   */
  list<T extends Resource & AnyEntity<T>, P extends string = never>(
    type: Constructor<T>,
    query?: FilterQuery<T>,
    opts: string | ListOpts<T, P> = {}
  ) {
    const {
      paginationToken,
      populate,
      pageSize: defaultPageSize = 100
    } = typeof opts === 'string'
      ? ({ paginationToken: opts } as ListOpts<T>)
      : opts;

    return this.useDb(async (db): Promise<PaginatedResourceList<T>> => {
      const { pageNumber, pageSize } = paginationToken
        ? decodePaginationToken(paginationToken)
        : { pageNumber: 0, pageSize: defaultPageSize };

      const [items, count] = await db.findAndCount(type, query, {
        offset: pageNumber * pageSize,
        limit: pageSize,
        populate: populate
      });

      const lastPage = Math.floor(count / pageSize);

      const currentPageToken = encodePaginationToken({ pageNumber, pageSize });
      const nextPageToken =
        pageNumber >= lastPage
          ? undefined
          : encodePaginationToken({ pageNumber: pageNumber + 1, pageSize });
      const prevPageToken =
        pageNumber === 0
          ? undefined
          : encodePaginationToken({ pageNumber: pageNumber - 1, pageSize });

      return new PaginatedResourceList(
        (paginationToken) => this.list(type, query, paginationToken),
        count,
        items,
        currentPageToken,
        nextPageToken,
        prevPageToken
      );
    });
  }

  /** Absolute path to directory containing blob data managed by the archive */
  get blobPath() {
    return path.join(this.location, 'blob');
  }
}

interface ListOpts<T extends AnyEntity<T>, P extends string = never> {
  /** Token for paginating over multiple pages */
  paginationToken?: string;

  /** Page size. Ignored if paginationToken is provided. */
  pageSize?: number;

  /** Populate option for eagerly fetching relationships */
  populate?: Array<AutoPath<T, P>>;
}

/**
 * State for paginating over multiple pages
 */
const PaginationToken = z.object({
  pageNumber: z.number(),
  pageSize: z.number()
});
type PaginationToken = z.TypeOf<typeof PaginationToken>;

const encodePaginationToken = (token: PaginationToken) => {
  return Buffer.from(JSON.stringify(token), 'utf8').toString('base64url');
};

const decodePaginationToken = (token: string): PaginationToken => {
  return PaginationToken.parse(safeParse(Buffer.from(token, 'base64url')));
};
