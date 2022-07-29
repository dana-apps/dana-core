import { EventEmitter } from 'eventemitter3';
import {
  AccessControl,
  AggregatedValidationError,
  Asset,
  CollectionType,
  ReferentialIntegrityError,
  SchemaProperty,
  SchemaPropertyType
} from '../../common/asset.interfaces';
import { mapValues, size, sumBy, uniq } from 'lodash';
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
import { never, required } from '../../common/util/assert';
import { DefaultMap } from '../../common/util/collection';

interface CreateAssetOpts {
  /** Metadata to associate with the asset. This must be valid according to the archive schema */
  metadata: Record<string, unknown[]>;

  /** Media to associate with the asset */
  media?: MediaFile[];

  /** Access control rights on the file */
  accessControl: AccessControl;

  /** Force an id value to use for the asset */
  forceId?: string;
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
    { metadata, media = [], accessControl, forceId }: CreateAssetOpts
  ) {
    const res = await archive.useDb(async (db) => {
      const collection = await db.findOne(AssetCollectionEntity, collectionId);
      const asset = db.create(AssetEntity, {
        id: forceId,
        mediaFiles: [],
        collection,
        metadata: {},
        accessControl
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
        archive,
        created: [res.value],
        updated: [],
        deleted: []
      });
    }

    return res;
  }

  async allIds(archive: ArchivePackage) {
    return archive.useDb(async (db) => {
      const ids = await db.createQueryBuilder(AssetEntity).select('id');
      return ids.map((x) => x.id);
    });
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
    { metadata, media, accessControl }: Partial<CreateAssetOpts>
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

      if (accessControl) {
        asset.accessControl = accessControl;
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
      this.emit('change', {
        archive,
        updated: [res.value],
        created: [],
        deleted: []
      });
    }

    return res;
  }

  async addMedia(archive: ArchivePackage, assetId: string, filePath: string) {
    const [res, collectionId] = await archive.useDb(async (db) => {
      const asset = await db.findOne(AssetEntity, assetId);
      if (!asset) {
        return [error({ filePath, error: FetchError.DOES_NOT_EXIST })];
      }

      const media = await this.mediaService.putFile(archive, filePath);
      if (media.status !== 'ok') {
        return [media];
      }

      asset.mediaFiles.add(media.value);
      const res = ok(
        await this.mediaService
          .getMedia(archive, [media.value.id])
          .then((x) => x[0])
      );

      return [res, asset.collection.id];
    });

    if (res.status === 'ok' && collectionId) {
      this.emit('change', {
        archive,
        updated: [{ id: assetId, collectionId }],
        created: [],
        deleted: []
      });
    }

    return res;
  }

  async removeMedia(
    archive: ArchivePackage,
    assetId: string,
    mediaFileIds: string[]
  ) {
    const asset = await archive.get(AssetEntity, assetId);
    const res = await this.mediaService.deleteFiles(archive, mediaFileIds);

    if (asset) {
      this.emit('change', {
        archive,
        updated: [{ id: asset.id, collectionId: asset.collection.id }],
        created: [],
        deleted: []
      });
    }

    return res;
  }

  private async setMetadataAndMedia(
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
        items: await this.entitiesToAssets(
          archive,
          entities.items,
          collectionId,
          { shallow: false }
        )
      };

      return result;
    });
  }

  /**
   * Search assets in the archive by title of the asset
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

      return ok(
        await this.filterAssets(
          archive,
          collectionId,
          {
            query: [query],
            match: exact ? 'any' : 'fuzzy',
            propertyId: title.id
          },
          range
        )
      );
    });
  }

  /**
   * Filter assets in the archive according to the value of a single column
   *
   * @returns ResourceList representing the query.
   */
  async filterAssets(
    archive: ArchivePackage,
    collectionId: string,
    opts: { query: unknown[]; propertyId: string; match: 'any' | 'fuzzy' },
    range?: PageRange
  ) {
    return archive.useDb(async () => {
      const entities = await this.filterAssetEntities(
        archive,
        collectionId,
        { ...opts, populate: ['collection', 'mediaFiles'] },
        range
      );

      return {
        ...entities,
        items: await this.entitiesToAssets(
          archive,
          entities.items,
          collectionId,
          {
            shallow: false
          }
        )
      };
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
  castOrCreatePropertyValue(
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

  async validateMoveAssets(
    archive: ArchivePackage,
    assetIds: string[],
    collectionId: string
  ) {
    return archive.useDb(async (db) => {
      const targetCollection = await this.collectionService.getCollection(
        archive,
        collectionId
      );
      const sourceCollectons = new DefaultMap((id: string) =>
        this.collectionService.getCollection(archive, id)
      );

      if (!targetCollection) {
        return error(FetchError.DOES_NOT_EXIST);
      }

      const assets = await db.find(AssetEntity, { id: assetIds });
      const errors: AggregatedValidationError = {};

      for (const asset of assets) {
        const source = await sourceCollectons.get(asset.collection.id);
        if (!source) {
          errors[asset.id] = [
            { count: 1, message: 'Source collection does not exist' }
          ];
          continue;
        }

        if (
          source.type === CollectionType.ASSET_COLLECTION &&
          targetCollection.type === CollectionType.ASSET_COLLECTION
        ) {
          continue;
        }

        if (source.id !== targetCollection.id) {
          errors[asset.id] = [
            {
              count: 1,
              message: 'Record is incompatible with target collection'
            }
          ];
        }
      }

      if (size(errors) > 0) {
        return error(errors);
      }

      return ok();
    });
  }

  /**
   * Move one or more assets into another collection
   *
   * @param archive
   * @param assetIds
   * @param collectionId
   * @returns
   */
  async moveAssets(
    archive: ArchivePackage,
    assetIds: string[],
    collectionId: string
  ): Promise<Result<object, FetchError | AggregatedValidationError>> {
    const res = await archive.useDb(async (db) => {
      const validationResult = await this.validateMoveAssets(
        archive,
        assetIds,
        collectionId
      );
      if (validationResult.status === 'error') {
        return validationResult;
      }

      const assets = await db.find(AssetEntity, { id: assetIds });

      const collection = await db.findOne(AssetCollectionEntity, collectionId);
      if (!collection) {
        return error(FetchError.DOES_NOT_EXIST);
      }

      for (const asset of assets) {
        asset.collection = collection;
      }

      db.persist(assets);
      return ok();
    });

    if (res.status === 'ok') {
      this.emit('change', {
        archive,
        updated: assetIds.map((id) => ({ id, collectionId })),
        created: [],
        deleted: []
      });
    }

    return res;
  }

  /**
   * Delete a group of assets. Rejects if the assets cannot be deleted.
   *
   * @param archive
   * @param collectionId
   * @param deletedIds
   * @returns
   */
  async deleteAssets(archive: ArchivePackage, deletedIds: string[]) {
    return archive.useDb(async (db) => {
      const deletedSet = new Set<unknown>(deletedIds);
      const schemas = new DefaultMap((key: string) =>
        this.collectionService.getCollectionSchema(archive, key)
      );

      // Return true if, once `deletedIds` are removed, the property will have at least one remaining value
      const hasRemainingValuesAfterDeletingAssets = (
        asset: AssetEntity,
        property: SchemaPropertyValue
      ) => {
        const propertyValues = asset.metadata[property.id];
        const count = sumBy(propertyValues, (x) => (deletedSet.has(x) ? 0 : 1));

        return count > 0;
      };

      // Check all collections for
      const deletedAssetCollections = await db.find(AssetCollectionEntity, {
        assets: deletedIds
      });

      const errors: ReferentialIntegrityError = [];
      const toPersist: AssetEntity[] = [];

      for (const deletedAssetCollection of deletedAssetCollections) {
        // Find all properties that may potentially reference assets being deleted from a collection
        const properties =
          await this.collectionService.findPropertiesReferencingCollection(
            archive,
            deletedAssetCollection.id
          );

        // For each of these properties, record an error if removing the property would move the collection into an
        // inconsistent state.
        //
        // Otherwise, modify the property and mark it for persistence.
        for (const { property, collection } of properties) {
          const references = await this.filterAssetEntities(
            archive,
            collection.id,
            { match: 'any', query: deletedIds, propertyId: property.id },
            { limit: Infinity, offset: 0 }
          );

          for (const reference of references.items) {
            if (
              property.required &&
              !hasRemainingValuesAfterDeletingAssets(reference, property)
            ) {
              const asset = required(
                await this.get(archive, reference.id),
                'Cannot resolve entity by id'
              );

              const referencedSchema = await schemas.get(collection.id);

              errors.push({
                assetId: reference.id,
                collectionId: collection.id,
                collectionTitle: collection.title,
                propertyId: property.id,
                propertyLabel:
                  referencedSchema.find((x) => x.id === property.id)?.label ??
                  property.id,
                assetTitle: asset.title
              });
            } else {
              const propertyVal = reference.metadata[property.id];

              reference.metadata[property.id] = propertyVal?.filter(
                (assetRef) =>
                  deletedIds.every((deletedId) => assetRef !== deletedId)
              );

              toPersist.push(reference);
            }
          }
        }
      }

      if (errors.length > 0) {
        return error(errors);
      }

      const assets = await db.find(
        AssetEntity,
        { id: deletedIds },
        { populate: ['mediaFiles'] }
      );
      const mediaFileIds = uniq(
        assets.flatMap((asset) => asset.mediaFiles.getIdentifiers())
      );

      await db.transactional(async (em) => {
        db.remove(assets);
        db.persist(toPersist);

        await em.flush();
      });

      this.emit('change', {
        archive,
        updated: [],
        created: [],
        deleted: assets.map((asset) => ({
          id: asset.id,
          collectionId: asset.collection.id
        }))
      });

      await this.mediaService.deleteFiles(archive, mediaFileIds);
      return ok();
    });
  }

  /**
   * Convert many database entities in the same collection to Asset values sutable for returning to the frontend
   * or passing to other areas of the application.
   *
   * This is more efficient than entityToAsset and should be used whenever you have a list of multiple assets.
   *
   * @param archive
   * @param entity
   * @param opts
   * @returns
   */
  private async entitiesToAssets(
    archive: ArchivePackage,
    entities: AssetEntity[],
    collectionId: string,
    opts: GetAssetOpts | undefined
  ) {
    const schema =
      opts?.schema ??
      (await this.collectionService.getCollectionSchema(archive, collectionId));

    return Promise.all(
      entities.map((e) => this.entityToAsset(archive, e, { ...opts, schema }))
    );
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
  private async entityToAsset(
    archive: ArchivePackage,
    entity: AssetEntity,
    opts: GetAssetOpts | undefined
  ) {
    const schema =
      opts?.schema ??
      (await this.collectionService.getCollectionSchema(
        archive,
        entity.collection.id
      ));
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
        collectionId: entity.collection.id,
        media: shallow
          ? []
          : await this.mediaService.getMedia(
              archive,
              entity.mediaFiles.getIdentifiers()
            ),
        accessControl: entity.accessControl,
        metadata: shallow
          ? {}
          : Object.fromEntries(
              await Promise.all(
                schema.map(async (property) => [
                  property.id,
                  await SchemaPropertyValue.fromJson(
                    property
                  ).convertToMetadataItems(
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

  /**
   * Filter assets in the archive according to the value of a single column
   */
  private async filterAssetEntities(
    archive: ArchivePackage,
    collectionId: string,
    {
      query,
      match,
      propertyId,
      populate
    }: {
      propertyId: string;
      query: unknown[];
      match: 'any' | 'fuzzy';
      populate?: (keyof AssetEntity)[];
    },
    range?: PageRange
  ) {
    return archive.useDb(async (db) => {
      let matchingRefs;
      const fieldIdParam = `$.${propertyId}`;

      // We need to run a raw query here to filter on the metadata values due to them being embedded in arrays and
      // therefore not being able to use the ORM's abstractions.
      //
      // We just take the IDs here, then get back into ORM-land as quickly as possible.
      //
      // We may well end up deciding that recurrent properties should be modelled relationally rather than via json
      // arrays, but it works for now.
      if (match === 'any') {
        matchingRefs = await db.execute(
          `SELECT asset.id id FROM asset, json_each(json_extract(metadata, ?)) AS titles
           WHERE titles.value IN (?) AND collection_id = ?`,
          [fieldIdParam, query, collectionId]
        );
      } else if (match === 'fuzzy') {
        const queryParam = `${query[0]}%`;

        matchingRefs = await db.execute(
          `SELECT asset.id id FROM asset, json_each(json_extract(metadata, ?)) AS titles
           WHERE titles.value LIKE ? AND collection_id = ?;`,
          [fieldIdParam, queryParam, collectionId]
        );
      } else {
        return never(match);
      }

      return await archive.list(
        AssetEntity,
        {
          id: matchingRefs.map((ref) => ref.id)
        },
        {
          populate,
          range
        }
      );
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

  /**
   * Schema to use to interpret the metadata associated with the asset.
   */
  schema?: SchemaProperty[];
}

interface AssetEvents {
  change: [AssetsChangedEvent];
}

/** Emitted when the assets managed by the archive have changed */
export interface AssetsChangedEvent {
  archive: ArchivePackage;

  /** Ids of newly created assets */
  created: { id: string; collectionId: string }[];

  /** Ids of updated assets */
  updated: { id: string; collectionId: string }[];

  /** Ids of deleted assets */
  deleted: { id: string; collectionId: string }[];
}
