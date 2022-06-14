import {
  AnyEntity,
  Constructor,
  FilterQuery,
  MikroORM,
  RequestContext
} from '@mikro-orm/core';
import { AutoPath } from '@mikro-orm/core/typings';
import { SqlEntityManager } from '@mikro-orm/sqlite';
import path from 'path';

import { PageRange } from '../../common/ipc.interfaces';
import { Resource, ResourceList } from '../../common/resource';
import { required } from '../../common/util/assert';

/**
 * Represents file and metadata storage for an archive.
 */
export class ArchivePackage {
  constructor(
    readonly location: string,
    private db: MikroORM,
    readonly syncConfig?: ArchiveSyncConfig
  ) {}

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
  useDb<T>(cb: (db: SqlEntityManager) => T | Promise<T>): Promise<T> {
    return RequestContext.createAsync<T>(this.db.em, async () => {
      const em = required(
        RequestContext.getEntityManager() as SqlEntityManager,
        'Expected requestContext'
      );
      const res = await cb(em);

      // Ensure that any uncommitted changes from the unit of work are written to the db before we end.
      // We could potentially optimize this by only flushing the outermost unit of work.
      await em.flush();

      return res;
    });
  }

  /**
   * TODO: Currently has same behaviour as useDb() - needs to detect nested transactions as sqlite doesn't support them.
   * See: https://github.com/commonknowledge/dana-core/issues/19
   *
   * Execute a block in the context of a database transaction. A unit of work will be set up for the transaction
   * if not already in the context of one.
   *
   * If this is called within a database transaction, the parent transaction will be used.
   *
   * See https://mikro-orm.io/docs/unit-of-work for more information about units of work.
   */
  useDbTransaction<T>(cb: (db: SqlEntityManager) => Promise<T>) {
    return this.useDb<T>(cb);
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
    { range = { offset: 0, limit: 100 }, populate }: ListOpts<T, P> = {}
  ): Promise<ResourceList<T>> {
    return this.useDb(async (db): Promise<ResourceList<T>> => {
      const [items, count] = await db.findAndCount(type, query, {
        offset: range.offset,
        limit: Math.min(range.limit, 1000),
        populate: populate
      });

      return {
        items,
        total: count,
        range
      };
    });
  }

  /** Absolute path to directory containing blob data managed by the archive */
  get blobPath() {
    return path.join(this.location, 'blob');
  }
}

interface ListOpts<T extends AnyEntity<T>, P extends string = never> {
  /** Range of the query */
  range?: PageRange;

  /** Populate option for eagerly fetching relationships */
  populate?: Array<AutoPath<T, P>>;
}

export interface ArchiveSyncConfig {
  url: string;
  auth: string;
}
