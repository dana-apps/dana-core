import { randomUUID } from 'crypto';
import path from 'path';
import { Readable } from 'stream';
import { createReadStream, createWriteStream } from 'fs';
import { RequiredEntityData } from '@mikro-orm/core';
import { Logger } from 'tslog';
import { mkdir, rename, rm, unlink } from 'fs/promises';

import {
  AcceptAssetRequest,
  AcceptedAsset,
  AcceptedMedia,
  AcceptMediaRequest,
  hashAsset,
  hashMedia,
  SyncedCollection,
  SyncRequest
} from '../../common/sync.interfaces';
import { ok, error, FetchError, Result } from '../../common/util/error';
import { required } from '../../common/util/assert';
import { AssetCollectionEntity, AssetEntity } from '../asset/asset.entity';
import { MediaFile } from '../media/media-file.entity';
import { ArchivePackage } from '../package/archive-package';
import { hashStream, streamEnded } from '../util/stream-utils';
import { MediaFileService } from '../media/media-file.service';
import { SqlEntityManager } from '@mikro-orm/sqlite';
import { AssetService } from '../asset/asset.service';
import { PageRangeAll } from '../../common/ipc.interfaces';

export interface SyncServerConfig {
  syncValidator?: (request: SyncRequest) => Result<void, string>;
}

export class SyncServer {
  constructor(
    private assets: AssetService,
    private media: MediaFileService,
    private config: SyncServerConfig = {}
  ) {}

  private transactions = new Map<string, SyncTransaction>();
  private logger = new Logger({ name: 'sync-server' });

  async beginSync(archive: ArchivePackage, syncRequest: SyncRequest) {
    const validationResult =
      this.config.syncValidator && this.config.syncValidator(syncRequest);

    if (validationResult?.status === 'error') {
      return validationResult;
    }

    return archive.useDb(async (db) => {
      const assets = await this.beginEntitySync(
        archive,
        AssetEntity,
        syncRequest.assets,
        async (x) => {
          const asset = required(
            await db.findOne(AssetEntity, x, { populate: ['collection'] }),
            'Expected entity to exist'
          );

          return hashAsset({ ...asset, collection: asset.collection.id });
        }
      );

      const media = await this.beginEntitySync(
        archive,
        MediaFile,
        syncRequest.media,
        async (x) => {
          const file = required(
            await db.findOne(MediaFile, x, { populate: ['asset'] }),
            'Expected entity to exist'
          );
          if (!file.asset) {
            return undefined;
          }

          return hashMedia({ ...file, assetId: file.asset.id });
        }
      );

      const t: SyncTransaction = new SyncTransaction(
        syncRequest.collections,
        archive.location,
        () => this.closeTransaction(t)
      );
      this.transactions.set(t.id, t.touch());

      t.deleteAssets = assets.deleted;
      t.deleteMedia = media.deleted;
      t.createdAssets = assets.created;

      await mkdir(t.tmpLocation, { recursive: true });

      return ok({
        id: t.id,
        wantMedia: Array.from(media.want),
        wantAssets: Array.from(assets.want)
      });
    });
  }

  async acceptAssets(
    archive: ArchivePackage,
    transactionId: string,
    syncRequest: AcceptAssetRequest
  ) {
    const t = this.transactions.get(transactionId);
    if (!t) {
      return error(FetchError.DOES_NOT_EXIST);
    }

    t.touch();

    t.assets = syncRequest.assets;
    return ok();
  }

  async acceptMedia(
    archive: ArchivePackage,
    transactionId: string,
    syncRequest: AcceptMediaRequest,
    data: Readable
  ) {
    const t = this.transactions.get(transactionId);
    if (!t) {
      return error(FetchError.DOES_NOT_EXIST);
    }

    t.touch();
    t.putMedia.push(syncRequest.metadata);

    const fd = createWriteStream(t.getTmpfile(syncRequest.metadata.id));
    data.pipe(fd);

    await streamEnded(data);
    return ok();
  }

  async commit(archive: ArchivePackage, transactionId: string) {
    const t = this.transactions.get(transactionId);
    if (!t) {
      return error(FetchError.DOES_NOT_EXIST);
    }

    const { items: deletedAssets } = await archive.list(
      AssetEntity,
      { id: Array.from(t.deleteAssets ?? []) },
      { range: PageRangeAll }
    );
    const updatedAssets =
      t?.assets?.filter((x) => !t?.createdAssets?.has(x.id)) ?? [];
    const createdAssets =
      t?.assets?.filter((x) => t?.createdAssets?.has(x.id)) ?? [];

    const createMedia = Array.from(t?.putMedia?.map((x) => x.id) ?? []);

    try {
      t.stop();

      await archive.useDb((db) =>
        db.transactional(async (db) => {
          if (t.collections.length > 0) {
            const deleted = await db.nativeDelete(AssetCollectionEntity, {
              id: { $nin: t.collections.map((t) => t.id) }
            });

            if (deleted > 0) {
              this.logger.info('Deleted', deleted, 'collections');
            }
          }

          const existingCollections = await archive.useDb((db) =>
            existingSet(db, AssetCollectionEntity)
          );

          const createdCollections = new Set(
            t.collections
              .filter((x) => !existingCollections.has(x.id))
              .map((x) => x.id)
          );

          await this.commitEntitySync(
            db,
            createdCollections,
            AssetCollectionEntity,
            'collections',
            t.collections,
            (data) => ({
              schema: data.schema,
              title: data.title,
              type: data.type,
              parent: data.parent
            })
          );

          if (t.deleteAssets && t.deleteAssets.size > 0) {
            const deleted = await db.nativeDelete(AssetEntity, {
              id: Array.from(t.deleteAssets)
            });

            if (deleted > 0) {
              this.logger.info('Deleted', deleted, 'assets');
            }
          }

          await this.commitEntitySync(
            db,
            t.createdAssets ?? new Set(),
            AssetEntity,
            'assets',
            Array.from(t.assets ?? []),
            (data) => ({
              accessControl: data.accessControl,
              collection: data.collection,
              metadata: data.metadata
            })
          );

          await this.commitEntitySync(
            db,
            new Set(t.putMedia.map((m) => m.id)),
            MediaFile,
            'files',
            Array.from(t.putMedia ?? []),
            async (data) => {
              return {
                asset: data.assetId,
                mimeType: data.mimeType,
                sha256: await hashStream(
                  createReadStream(t.getTmpfile(data.id))
                )
              };
            }
          );

          if (t.putMedia && t.putMedia.length > 0) {
            for (const file of t.putMedia) {
              await rename(
                t.getTmpfile(file.id),
                this.media.getMediaPath(archive, file)
              );
              await this.media.createRenditions(archive, file);
            }
          }
        })
      );

      if (t.deleteMedia && t.deleteMedia.size > 0) {
        this.logger.info('Delete', t.deleteMedia?.size ?? 0, 'files');
        await this.media.deleteFiles(archive, Array.from(t.deleteMedia ?? []));
      }

      this.media.emit('change', {
        archive,
        created: createMedia,
        deleted: [] // handled above
      });

      this.assets.emit('change', {
        archive,
        created: createdAssets.map((x) => ({
          id: x.id,
          collectionId: x.collection
        })),
        deleted: deletedAssets.map((x) => ({
          id: x.id,
          collectionId: x.collection.id
        })),
        updated: updatedAssets.map((x) => ({
          id: x.id,
          collectionId: x.collection
        }))
      });

      this.logger.info('Sync transaction completed:', t.id);
      return ok();
    } catch (err) {
      if (t.putMedia) {
        for (const file of t.putMedia) {
          try {
            await unlink(this.media.getMediaPath(archive, file));
          } catch {}
        }
      }

      throw err;
    } finally {
      await this.closeTransaction(t);
    }
  }

  private async closeTransaction(t: SyncTransaction) {
    this.logger.info('Closing sync transaction', t.id);

    t.stop();
    this.transactions.delete(t.id);
    await rm(t.tmpLocation, { recursive: true });
  }

  private async commitEntitySync<
    E extends { id: string },
    V extends { id: string }
  >(
    db: SqlEntityManager,
    createdIds: Set<string>,
    entity: new () => E,
    entityName: string,
    items: V[],
    updater: (
      value: V
    ) => RequiredEntityData<E> | Promise<RequiredEntityData<E>>
  ) {
    let createdCount = 0,
      updatedCount = 0;

    for (const item of items) {
      if (createdIds.has(item.id)) {
        db.persist(
          db.create(entity, { ...(await updater(item)), id: item.id })
        );
        createdCount += 1;
      } else {
        const instance = await db.findOne(entity, item.id);
        Object.assign(instance, await updater(item));
        db.persist(instance);
        updatedCount += 1;
      }
    }

    if (createdCount > 0) {
      this.logger.info('created', createdCount, entityName);
    }

    if (updatedCount > 0) {
      this.logger.info('updated', updatedCount, entityName);
    }
  }

  private async beginEntitySync<
    E extends { id: string },
    V extends { id: string; sha256: string }
  >(
    archive: ArchivePackage,
    entity: new () => E,
    items: V[],
    hash: (x: string) => Promise<string | undefined>
  ) {
    const want = new Set<string>();
    const deleted = new Set<string>();
    const created = new Set<string>();
    const nextIds = new Set(items.map((x) => x.id));

    await archive.useDb(async (db) => {
      const existing = await existingSet(db, entity);

      for (const item of items) {
        if (!existing.has(item.id)) {
          want.add(item.id);
          created.add(item.id);
          continue;
        }

        const itemHash = await hash(item.id);
        if (!itemHash) {
          continue;
        }

        if (itemHash !== item.sha256) {
          want.add(item.id);
        }
      }

      for (const id of existing) {
        if (!nextIds.has(id)) {
          deleted.add(id);
        }
      }
    });

    return {
      want,
      created,
      deleted
    };
  }
}

class SyncTransaction {
  constructor(
    readonly collections: SyncedCollection[],
    private baseDir: string,
    private onTimeout: () => void
  ) {}

  id = randomUUID();
  timeout?: NodeJS.Timeout;

  assets?: AcceptedAsset[];
  createdAssets?: Set<string>;
  deleteAssets?: Set<string>;

  putMedia: AcceptedMedia[] = [];
  deleteMedia?: Set<string>;

  tmpLocation = path.join(this.baseDir, 'sync', this.id);

  getTmpfile(slug: string) {
    return path.join(this.tmpLocation, slug);
  }

  touch() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(this.onTimeout, 30_000);
    return this;
  }

  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }
}

async function existingSet(db: SqlEntityManager, entity: new () => unknown) {
  const idRecords = await db.createQueryBuilder(entity).select('id');
  return new Set<string>(idRecords.map((x) => x.id));
}
