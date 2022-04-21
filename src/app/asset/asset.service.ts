import { EventEmitter } from 'eventemitter3';
import { Asset, SchemaProperty } from '../../common/asset.interfaces';
import { PageRange } from '../../common/ipc.interfaces';
import { ResourceList } from '../../common/resource';
import { error, FetchError, ok, Result } from '../../common/util/error';
import { Dict } from '../../common/util/types';
import { MediaFile } from '../media/media-file.entity';
import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import { AssetEntity } from './asset.entity';
import { CollectionService } from './collection.service';
import { SchemaPropertyValue } from './metadata.entity';

interface CreateAssetOpts {
  /** Metadata to associate with the asset. This must be valid according to the archive schema */
  metadata: Record<string, unknown>;

  /** Media to associate with the asset */
  media?: MediaFile[];
}

/**
 * Manages creation, administration and retreival of assets.
 */
export class AssetService extends EventEmitter<AssetEvents> {
  constructor(
    private collectionService: CollectionService,
    private mediaService: MediaFileService
  ) {
    super();
  }

  /**
   * Persist an asset to the database, associate it with zero or more media files and index its metadata.
   *
   * Emits `change` to inform observers that the asset has changed.
   *
   * This should fail if the asset's metadata is not valid according to the archive's schema.
   *
   * @param archive The archive to store the asset in.
   * @param param1 Options for creating the asset.
   * @returns An `Asset` object representing the inserted asset.
   */
  async createAsset(
    archive: ArchivePackage,
    collectionId: string,
    { metadata, media = [] }: CreateAssetOpts
  ) {
    const res = await archive.useDb(async (db) => {
      const asset = db.create(AssetEntity, {
        mediaFiles: [],
        collection: collectionId,
        metadata: {}
      });

      const validationResult = await this.setMetadataAndMedia(
        archive,
        collectionId,
        asset,
        metadata,
        media
      );

      if (validationResult.status === 'error') {
        return validationResult;
      }

      db.persist(asset);

      return ok<Asset>({
        id: asset.id,
        metadata: asset.metadata,
        media: media.map((m) => ({
          id: m.id,
          mimeType: m.mimeType,
          rendition: this.mediaService.getRenditionUri(archive, m),
          type: 'image'
        }))
      });
    });

    if (res.status === 'ok') {
      this.emit('change', {
        created: [res.value.id],
        updated: []
      });
    }

    return res;
  }

  /**
   * Given an existing asset in the archive, update its metadata and/or media files.
   *
   * Both the metadata and media options _fully replace_ the current values.
   *
   * Changes are validated against the collection schema and rejected if validation doesn't pass.
   *
   * @param archive The archive the asset is stored in.
   * @param assetId Id of the asset to update
   * @param param2 Media and metadata to update. Undefined values are left as-is.
   * @returns A Result indicating the success of the operation.
   */
  async updateAsset(
    archive: ArchivePackage,
    assetId: string,
    { metadata, media }: Partial<CreateAssetOpts>
  ) {
    const res = await archive.useDb(async (db) => {
      const asset = await db.findOne(
        AssetEntity,
        { id: assetId },
        { populate: ['collection'] }
      );
      if (!asset) {
        return error(FetchError.DOES_NOT_EXIST);
      }

      const validationResult = await this.setMetadataAndMedia(
        archive,
        asset.collection.id,
        asset,
        metadata,
        media
      );

      if (validationResult.status === 'error') {
        return validationResult;
      }

      db.persist(asset);
      return ok(this.entityToAsset(archive, asset));
    });

    if (res.status === 'ok') {
      this.emit('change', { updated: [res.value.id], created: [] });
    }

    return res;
  }

  async setMetadataAndMedia(
    archive: ArchivePackage,
    collectionId: string,
    asset: AssetEntity,
    metadata?: Dict,
    media?: MediaFile[]
  ) {
    if (metadata) {
      const [valid] = await this.collectionService.validateItemsForCollection(
        archive,
        collectionId,
        [{ id: 'asset', metadata }]
      );

      if (!valid.success) {
        return error(valid.errors);
      }

      if (valid.metadata) {
        asset.metadata = valid.metadata;
      }
    }

    if (media) {
      asset.mediaFiles.set(media);
    }

    return ok();
  }

  /**
   * List assets in the archive.
   *
   * @returns ResourceList representing the query.
   */
  async listAssets(
    archive: ArchivePackage,
    collectionId: string,
    range?: PageRange
  ): Promise<ResourceList<Asset>> {
    return archive.useDb(async () => {
      const entities = await archive.list(
        AssetEntity,
        {
          collection: collectionId
        },
        {
          populate: ['mediaFiles'],
          range
        }
      );

      return {
        ...entities,
        items: await Promise.all(
          entities.items.map(async (entity) =>
            this.entityToAsset(archive, entity)
          )
        )
      };
    });
  }

  /**
   * List assets in the archive.
   *
   * @returns ResourceList representing the query.
   */
  async searchAssets(
    archive: ArchivePackage,
    collectionId: string,
    { query, exact }: { query: string; exact?: boolean },
    range?: PageRange
  ): Promise<Result<ResourceList<Asset>>> {
    return archive.useDb(async () => {
      const collection = await this.collectionService.getCollection(
        archive,
        collectionId
      );
      if (!collection) {
        return error(FetchError.DOES_NOT_EXIST);
      }

      const title = await this.collectionService.getTitleProperty(
        archive,
        collectionId
      );

      if (!title) {
        return error(FetchError.DOES_NOT_EXIST);
      }

      const entities = await archive.list(
        AssetEntity,
        {
          collection: collectionId,
          metadata: {
            [title.id]: exact
              ? query
              : {
                  $like: `${query}%`
                }
          }
        },
        {
          populate: ['mediaFiles'],
          range
        }
      );

      return ok({
        ...entities,
        items: await Promise.all(
          entities.items.map(async (entity) =>
            this.entityToAsset(archive, entity)
          )
        )
      });
    });
  }

  get(archive: ArchivePackage, asset: string) {
    return archive
      .get(AssetEntity, asset)
      .then((asset) =>
        asset ? this.entityToAsset(archive, asset) : undefined
      );
  }

  castOrCreateProperty(
    archive: ArchivePackage,
    property: SchemaProperty,
    value: unknown
  ) {
    return SchemaPropertyValue.fromJson(property).castOrCreateValue(value, {
      archive,
      assets: this,
      collections: this.collectionService
    });
  }

  private entityToAsset(archive: ArchivePackage, entity: AssetEntity): Asset {
    return {
      id: entity.id,
      media: Array.from(entity.mediaFiles).map((file) => ({
        id: file.id,
        type: 'image',
        rendition: this.mediaService.getRenditionUri(archive, file),
        mimeType: file.mimeType
      })),
      metadata: entity.metadata
    };
  }
}

interface AssetEvents {
  change: [AssetsChangedEvent];
}

/** Emitted when the assets managed by the archive have changed */
export interface AssetsChangedEvent {
  /** Ids of newly created assets */
  created: string[];

  /** Ids of updated assets */
  updated: string[];
}
