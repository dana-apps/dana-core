import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { Logger } from 'tslog';
import {
  AcceptAssetRequest,
  AcceptedAsset,
  AcceptedMedia,
  AcceptMediaRequest,
  hashAsset,
  hashMedia,
  SyncRequest,
  SyncResponse
} from '../../common/sync.interfaces';
import { PageRangeAll } from '../../common/ipc.interfaces';
import { Result } from '../../common/util/error';
import { required } from '../../common/util/assert';
import { Scheduler } from '../../common/util/scheduler';
import { AssetEntity } from '../asset/asset.entity';
import { CollectionService } from '../asset/collection.service';
import { MediaFile } from '../media/media-file.entity';
import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import { stat } from 'fs/promises';
import { AccessControl, SchemaProperty } from '../entry/lib';
import { Dict } from '../../common/util/types';
import { keyBy, mapValues } from 'lodash';

export interface SyncTransport {
  beginSync(
    archive: ArchivePackage,
    syncRequest: SyncRequest
  ): Promise<Result<SyncResponse>>;
  acceptAssets(
    archive: ArchivePackage,
    transactionId: string,
    syncRequest: AcceptAssetRequest
  ): Promise<Result>;
  acceptMedia(
    archive: ArchivePackage,
    transactionId: string,
    syncRequest: AcceptMediaRequest,
    data: { stream: Readable; size: number }
  ): Promise<Result>;
  commit(archive: ArchivePackage, transactionId: string): Promise<Result>;
}

export class SyncClient {
  constructor(
    private transport: SyncTransport,
    private collections: CollectionService,
    private media: MediaFileService
  ) {}

  private logger = new Logger({ name: 'sync-client' });
  private scheduler = new Scheduler();

  sync(archive: ArchivePackage) {
    if (!archive.syncConfig) {
      return;
    }

    return this.scheduler.run(async () => {
      const { items: collections } = await this.collections.allCollections(
        archive,
        PageRangeAll
      );

      const sync = await this.prepareSync(archive);
      if (sync.status !== 'ok') {
        this.logger.error('Initiating sync failed with error', sync.error);
        return;
      }

      this.logger.info('Opened sync', sync.value.id);

      for (const media of sync.value.wantMedia) {
        this.logger.info('Sync media file', media);

        const mediaFile = await archive.useDb((db) =>
          db.findOne(MediaFile, { id: media })
        );
        if (!mediaFile) {
          this.logger.warn('Skipping mising media file', media);
          continue;
        }

        const mediaPath = this.media.getMediaPath(archive, mediaFile);
        const { size } = await stat(mediaPath);

        await this.transport.acceptMedia(
          archive,
          sync.value.id,
          { metadata: this.mediaJson(mediaFile) },
          { stream: createReadStream(mediaPath), size }
        );
      }

      this.logger.info('Fetching', sync.value.wantAssets.length, 'to sync');
      const assets = await archive.useDb((db) =>
        db.find(AssetEntity, { id: sync.value.wantAssets })
      );

      const hiddenProperties = mapValues(
        keyBy(collections, (x) => x.id),
        (collection) =>
          new Set(
            collection.schema
              .filter((prop) => !prop.visible)
              .map((prop) => prop.id)
          )
      );

      this.logger.info('Syncing', assets.length, 'assets');
      await this.transport.acceptAssets(archive, sync.value.id, {
        assets: assets.map((a) => this.assetJson(a, hiddenProperties))
      });

      this.logger.info('Commit sync', sync.value.id);
      const res = await this.transport.commit(archive, sync.value.id);

      if (res.status === 'ok') {
        this.logger.info('Sync', sync.value.id, 'completed successfuly');
      } else {
        this.logger.error(
          'Sync',
          sync.value.id,
          'failed to commit with error',
          res.error
        );
      }
    });
  }

  async prepareSync(archive: ArchivePackage) {
    const { items: collections } = await this.collections.allCollections(
      archive,
      PageRangeAll
    );

    const hiddenProperties = mapValues(
      keyBy(collections, (x) => x.id),
      (collection) =>
        new Set(
          collection.schema
            .filter((prop) => !prop.visible)
            .map((prop) => prop.id)
        )
    );

    const assets = await archive.list(
      AssetEntity,
      { $not: { accessControl: AccessControl.RESTRICTED } },
      { range: PageRangeAll }
    );
    const media = await archive.list(
      MediaFile,
      { asset: { accessControl: AccessControl.PUBLIC } },
      { range: PageRangeAll, populate: ['asset'] }
    );

    return this.transport.beginSync(archive, {
      collections: collections,
      assets: assets.items.map((asset) => ({
        id: asset.id,
        sha256: hashAsset(this.assetJson(asset, hiddenProperties))
      })),
      media: media.items.map((asset) => ({
        id: asset.id,
        sha256: hashMedia(this.mediaJson(asset))
      }))
    });
  }

  private assetJson(e: AssetEntity, hiddenProperties: Dict<Set<string>>) {
    const hddenColumns = hiddenProperties[e.collection.id];

    return AcceptedAsset.parse({
      accessControl: e.accessControl,
      collection: e.collection.id,
      id: e.id,
      metadata: Object.fromEntries(
        Object.entries(e.metadata).flatMap(([key, val]) => {
          if (e.redactedProperties.includes(key)) {
            return [];
          }

          if (hddenColumns.has(key)) {
            return [];
          }

          return [[key, val]];
        })
      )
    });
  }

  private mediaJson(e: MediaFile) {
    return AcceptedMedia.parse({
      ...e,
      assetId: required(e.asset?.id, 'Expected asset relation in entity')
    });
  }
}
