import { EventEmitter } from 'eventemitter3';
import {
  Asset,
  SchemaProperty,
  SchemaPropertyType
} from '../../common/asset.interfaces';
import { mapValues } from 'lodash';
import { PageRange } from '../../common/ipc.interfaces';
import { ResourceList } from '../../common/resource';
import { error, FetchError, ok, Result } from '../../common/util/error';
import { Dict } from '../../common/util/types';
import { MediaFile } from '../media/media-file.entity';
import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import { AssetCollectionEntity, AssetEntity } from './asset.entity';
import { CollectionService } from './collection.service';
import { SchemaPropertyValue } from './metadata.entity';

interface CreateAssetOpts {
  /** Metadata to associate with the asset. This must be valid according to the archive schema */
  metadata: Record<string, unknown[]>;

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
      const collection = await db.findOne(AssetCollectionEntity, collectionId);
      const asset = db.create(AssetEntity, {
        mediaFiles: [],
        collection,
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

      return ok<Asset>(
        await this.entityToAsset(archive, asset, { shallow: false })
      );
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
        { populate: ['collection', 'mediaFiles'] }
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
      return ok(await this.entityToAsset(archive, asset, { shallow: false }));
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
        asset.metadata = mapValues(valid.metadata, (attribute) =>
          attribute.filter((x) => typeof x !== 'undefined')
        );
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
          populate: ['collection', 'mediaFiles'],
          range
        }
      );

      const result = {
        ...entities,
        items: await Promise.all(
          entities.items.map(async (entity) =>
            this.entityToAsset(archive, entity, { shallow: false })
          )
        )
      };

      return result;
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
    return archive.useDb(async (db) => {
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

      let matchingRefs;
      const fieldIdParam = `$.${title.id}`;

      // We need to run a raw query here to filter on the metadata values due to them being embedded in arrays and
      // therefore not being able to use the ORM's abstractions.
      //
      // We just take the IDs here, then get back into ORM-land as quickly as possible.
      //
      // We may well end up deciding that recurrent properties should be modelled relationally rather than via json
      // arrays, but it works for now.
      if (exact) {
        matchingRefs = await db.execute(
          `SELECT asset.id id FROM asset, json_each(json_extract(metadata, ?)) AS titles
           WHERE titles.value = ? AND collection_id = ?`,
          [fieldIdParam, query, collectionId]
        );
      } else {
        const queryParam = `${query}%`;

        matchingRefs = await db.execute(
          `SELECT asset.id id FROM asset, json_each(json_extract(metadata, ?)) AS titles
           WHERE titles.value LIKE ? AND collection_id = ?;`,
          [fieldIdParam, queryParam, collectionId]
        );
      }

      const entities = await archive.list(
        AssetEntity,
        {
          id: matchingRefs.map((ref) => ref.id)
        },
        {
          populate: ['collection', 'mediaFiles'],
          range
        }
      );

      return ok({
        ...entities,
        items: await Promise.all(
          entities.items.map(async (entity) =>
            this.entityToAsset(archive, entity, { shallow: false })
          )
        )
      });
    });
  }

  /**
   * Get a single asset by ID from the archive
   *
   * @param archive Archive to get asset from
   * @param asset Id of the asset
   * @param opts Options for fetching the asset
   * @returns The asset represented by `id`, or undefined if it does not exist.
   */
  get(archive: ArchivePackage, asset: string, opts?: GetAssetOpts) {
    return this.getMultiple(archive, [asset], opts).then((assets) => assets[0]);
  }

  /**
   * Get a multiple assets by ID from the archive
   *
   * @param archive Archive to get assets from
   * @param asset Ids of the assets to fetch
   * @param opts Options for fetching the asset
   * @returns Array containing any referenced assets found.
   */
  getMultiple(
    archive: ArchivePackage,
    assetIds: string[],
    opts?: GetAssetOpts
  ) {
    return archive
      .useDb((db) =>
        db.find(
          AssetEntity,
          { id: assetIds },
          {
            populate: ['collection', 'mediaFiles']
          }
        )
      )
      .then((assets) =>
        Promise.all(
          assets.map((asset) => this.entityToAsset(archive, asset, opts))
        )
      );
  }

  /**
   * Cast a value of unknown type to the type expected by the schema property.
   *
   * If this succeeds, the returned value is valid according to the the schema at the time of casting.
   *
   * This method may have side effects, such as creating new entries in a controlled database.
   *
   * @param archive Archive that owns `property`
   * @param property Property value representing the expected type
   * @param value Value to cast to the type represented by `value`
   * @returns A result value indicating whether the cast was successful and if so, the casted value.
   */
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

  /**
   * Convert a database entity representing to an Asset value sutable for returning to the frontend or passing to other
   * areas of the application.
   *
   * This recurses into the asset's related properties and media in order to provide useful
   *
   * @param archive
   * @param entity
   * @param opts
   * @returns
   */
  private entityToAsset(
    archive: ArchivePackage,
    entity: AssetEntity,
    opts: GetAssetOpts | undefined
  ) {
    const { shallow } = opts ?? {};
    const titleField = entity.collection.schema.find(
      (x) => x.type === SchemaPropertyType.FREE_TEXT
    );
    const titleValue = titleField
      ? entity.metadata[titleField.id]?.[0]
      : undefined;

    return archive.useDb(async (db): Promise<Asset> => {
      await db.populate(entity, ['mediaFiles']);

      return {
        id: entity.id,
        title: typeof titleValue === 'string' ? titleValue : entity.id,
        media: shallow
          ? []
          : await this.mediaService.getMedia(
              archive,
              entity.mediaFiles.getIdentifiers()
            ),
        metadata: shallow
          ? {}
          : Object.fromEntries(
              await Promise.all(
                entity.collection.schema.map(async (property) => [
                  property.id,
                  await property.convertToMetadataItems(
                    {
                      archive,
                      collections: this.collectionService,
                      assets: this
                    },
                    entity.metadata[property.id] ?? []
                  )
                ])
              )
            )
      };
    });
  }
}

interface GetAssetOpts {
  /**
   * If false, recurse into the asset, fetching related media and metadata from the database (default is false).
   *
   * This will usually want to be false, except in contexts where a related property is being fetched and you want to
   * avoid an infinite recursion.
   **/
  shallow?: boolean;
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
