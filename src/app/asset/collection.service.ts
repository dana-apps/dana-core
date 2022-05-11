import { EventEmitter } from 'eventemitter3';
import { mapValues } from 'lodash';
import { z } from 'zod';
import {
  AggregatedValidationError,
  Collection,
  CollectionType,
  SchemaProperty
} from '../../common/asset.interfaces';
import { PageRange } from '../../common/ipc.interfaces';
import { compactDict, DefaultMap } from '../../common/util/collection';
import { error, FetchError, ok } from '../../common/util/error';
import { Dict } from '../../common/util/types';
import { ArchivePackage } from '../package/archive-package';
import { AssetCollectionEntity } from './asset.entity';
import { SchemaPropertyValue } from './metadata.entity';

/**
 * Manages collections of records and associates them with a schema.
 *
 * Collections are intended to be structured hierarchically, with a collection potentially having multiple
 * sub-collections.
 *
 * Assets in a collection may only have metadata that is defined by the schema.
 * Child collections inherit the parent collection's schema, or can override it with their own.
 * The archive has a root collection, which may define a default schema.
 * All other collections must be descendents of this.
 */
export class CollectionService extends EventEmitter<CollectionEvents> {
  private static ROOT_ASSET_ID = '$root';
  private static ROOT_DB_ID = '$databases';

  /**
   * Return the root asset collection of the archive. Created if it does not yet exist.
   *
   * @param archive Archive containing the collection.
   * @returns The root asset collection for `archive`
   */
  async getRootAssetCollection(archive: ArchivePackage) {
    return archive.useDbTransaction(async (db) => {
      let collection = await db.findOne(
        AssetCollectionEntity,
        CollectionService.ROOT_ASSET_ID
      );

      if (!collection) {
        collection = db.create(AssetCollectionEntity, {
          id: CollectionService.ROOT_ASSET_ID,
          title: 'Assets',
          schema: []
        });
        db.persist(collection);
      }

      return this.toCollectionValue(archive, collection);
    });
  }

  /**
   * Return the root controlled databases collection of the archive. Created if it does not yet exist.
   *
   * @param archive Archive containing the collection.
   * @returns The root controlled database collection for `archive`
   */
  async getRootDatabaseCollection(archive: ArchivePackage) {
    return archive.useDbTransaction(async (db) => {
      let collection = await db.findOne(
        AssetCollectionEntity,
        CollectionService.ROOT_DB_ID
      );

      if (!collection) {
        collection = db.create(AssetCollectionEntity, {
          id: CollectionService.ROOT_DB_ID,
          title: 'Databases',
          schema: []
        });
        db.persist(collection);
      }

      return this.toCollectionValue(archive, collection);
    });
  }

  /**
   * Get a collection by id.
   *
   * @param archive Archive containing the collection.
   * @param collectionId ID of the collection.
   * @returns The root controlled database collection for `archive`
   */
  async getCollection(archive: ArchivePackage, collectionId: string) {
    return archive
      .get(AssetCollectionEntity, collectionId)
      .then((entity) => entity && this.toCollectionValue(archive, entity));
  }

  /**
   * Return the root controlled databases collection of the archive. Created if it does not yet exist.
   *
   * @param archive Archive containing the collection.
   * @returns The root controlled database collection for `archive`
   */
  async listSubcollections(
    archive: ArchivePackage,
    parentCollectionId: string,
    range: PageRange | undefined
  ) {
    const listedAssets = await archive.list(
      AssetCollectionEntity,
      { parent: parentCollectionId },
      { range }
    );

    return {
      ...listedAssets,
      items: await Promise.all(
        listedAssets.items.map((item) => this.toCollectionValue(archive, item))
      )
    };
  }

  /**
   * Return the root controlled databases collection of the archive. Created if it does not yet exist.
   *
   * @param archive Archive containing the collection.
   * @param parentId Parent collection. All user-created collections must have a parent.
   * @param opts: Properties of the newly created collection.
   * @returns The root controlled database collection for `archive`
   */
  async createCollection(
    archive: ArchivePackage,
    parentId: string,
    opts: CreateCollectionOpts
  ) {
    return archive.useDbTransaction(async (db) => {
      const collection = db.create(AssetCollectionEntity, {
        parent: parentId,
        ...opts
      });
      db.persistAndFlush(collection);
      this.emit('change', { created: [collection.id] });

      return this.toCollectionValue(archive, collection);
    });
  }

  /**
   * Update properties of the collection other than its schema.
   *
   * @param archive Archive containing the collection.
   * @param collectionId Id of the collection.
   * @param props: New property values.
   * @returns The updated collection value
   */
  updateCollection(
    archive: ArchivePackage,
    collectionId: string,
    props: Pick<AssetCollectionEntity, 'title'>
  ) {
    return archive.useDbTransaction(async (db) => {
      const collection = await db.findOne(
        AssetCollectionEntity,
        {
          id: collectionId
        },
        { populate: ['parent'] }
      );
      if (!collection) {
        return error(FetchError.DOES_NOT_EXIST);
      }

      Object.assign(collection, props);
      db.persistAndFlush(collection);

      this.emit('change', { updated: [collectionId] });

      return ok(await this.toCollectionValue(archive, collection));
    });
  }

  /**
   * Update the metadata schema for a collection.
   *
   * This validates the collection against the schema and fails if it does not pass.
   *
   * @param archive Archive containing the schema.
   * @param collectionId Id of the collection we to update the schema schema for.
   * @param schema New schema value.
   * @returns A result indicating success or failure and the reason
   */
  updateCollectionSchema(
    archive: ArchivePackage,
    collectionId: string,
    schema: SchemaProperty[]
  ) {
    return archive.useDb(async (db) => {
      const collection = await db.findOne(AssetCollectionEntity, {
        id: collectionId
      });
      if (!collection) {
        return error(FetchError.DOES_NOT_EXIST);
      }

      // Map from schema property to counts of validation errors
      const errorTracker = new DefaultMap<string, DefaultMap<string, number>>(
        () => new DefaultMap(() => 0)
      );

      const schemaDef = schema.map(SchemaPropertyValue.fromJson);

      for await (const assets of this.recurseiveIterateAssetsWithinCollection(
        archive,
        collection
      )) {
        const validationResults = await this.validateItemsForSchema(
          archive,
          schemaDef,
          assets
        );

        // Collect counts of validation errors against properties
        for (const result of validationResults) {
          if (!result.success) {
            for (const [key, errors] of Object.entries(result.errors)) {
              const propertyErrors = errorTracker.get(key);

              for (const error of errors) {
                propertyErrors.set(error, propertyErrors.get(error) + 1);
              }
            }
          }
        }
      }

      if (errorTracker.size > 0) {
        const errors = mapValues(
          Object.fromEntries(errorTracker.entries()),
          (propertyErrors) =>
            Array.from(propertyErrors.entries()).map(([message, count]) => ({
              message,
              count
            }))
        );

        return error<AggregatedValidationError>(errors);
      }

      collection.schema = schema.map(SchemaPropertyValue.fromJson);
      await db.persistAndFlush(collection);
      this.emit('change', { updated: [collectionId] });

      return ok();
    });
  }

  /**
   * Validate a that a proposed addition into the collection is accepted by its metadata schema.
   *
   * @param archive Archive containing the schema.
   * @param collectionId Collection into which addition is proposed.
   * @param items Items to insert.
   * @returns Result indicating success or failure for each proposed addition.
   */
  async validateItemsForCollection(
    archive: ArchivePackage,
    collectionId: string,
    items: { id: string; metadata: Dict }[]
  ) {
    const collection = await archive.get(AssetCollectionEntity, collectionId);
    if (!collection) {
      throw Error('Collection does not exist: ' + collectionId);
    }

    return this.validateItemsForSchema(archive, collection.schema, items);
  }

  async validateMetaedataForCollection(
    archive: ArchivePackage,
    collectionId: string,
    metadata: Dict
  ) {
    const [res] = await this.validateItemsForCollection(archive, collectionId, [
      { id: '', metadata }
    ]);
    return res.success;
  }

  /**
   * Validate a that a proposed addition into the archive is valid according to a schema.
   *
   * @param archive Archive containing the schema.
   * @param schema Schema to validate against.
   * @param items Items to validate against the schema.
   * @returns Result indicating success or failure for each proposed addition.
   */
  private async validateItemsForSchema(
    archive: ArchivePackage,
    schema: SchemaPropertyValue[],
    items: { id: string; metadata: Dict }[]
  ): Promise<ValidateItemsResult[]> {
    const validator = await this.getRecordValidator(archive, schema);

    const results = items.map(
      async ({ id, metadata }): Promise<ValidateItemsResult> => {
        const result = await validator.safeParseAsync(metadata);
        if (result.success) {
          return {
            id,
            success: true,
            metadata: result.data
          };
        }

        return {
          id: id,
          success: false,
          errors: compactDict(result.error.flatten().fieldErrors)
        };
      }
    );

    return Promise.all(results);
  }

  /**
   * Iterate asynchronously over the assets in a collection collection and each of its sub-collections.
   * Yields assets in chunks.
   *
   * @param archive Archive containing the collection.
   * @param collection Collection to iterate over.
   */
  private async *recurseiveIterateAssetsWithinCollection(
    archive: ArchivePackage,
    collection: AssetCollectionEntity
  ) {
    yield await collection.assets.loadItems();
  }

  async getTitleProperty(archive: ArchivePackage, collectionId: string) {
    return archive
      .get(AssetCollectionEntity, collectionId)
      .then((x) => x?.getTitleProperty());
  }

  /**
   * Given a schema definition, return a zod validator to validate entries against.
   *
   * @param schema Schema definition.
   * @returns a zod validator object generated from the schema.
   */
  private async getRecordValidator(
    archive: ArchivePackage,
    schema: SchemaPropertyValue[]
  ) {
    const fieldValidators = await Promise.all(
      schema.map(async (property) => {
        const validator = await property.getValidator({
          archive,
          collections: this
        });
        return [property.id, validator];
      })
    );
    return z.object(Object.fromEntries(fieldValidators));
  }

  private async toCollectionValue(
    archive: ArchivePackage,
    entity: AssetCollectionEntity
  ): Promise<Collection> {
    return {
      id: entity.id,
      schema: entity.schema.map((e) => e.toJson()),
      title: entity.title,
      type: await this.inferCollectionType(archive, entity)
    };
  }

  private inferCollectionType(
    archive: ArchivePackage,
    entity: AssetCollectionEntity | undefined
  ) {
    return archive.useDb(async (db): Promise<CollectionType> => {
      while (entity) {
        if (entity.id === CollectionService.ROOT_ASSET_ID) {
          return CollectionType.ASSET_COLLECTION;
        }
        if (entity.id === CollectionService.ROOT_DB_ID) {
          return CollectionType.CONTROLLED_DATABASE;
        }

        await db.populate(entity, ['parent']);
        entity = entity.parent ?? undefined;
      }

      throw Error('Invalid collection: unknown collection root');
    });
  }
}

export interface CollectionsChangedEvent {
  created?: string[];
  updated?: string[];
  deleted?: string[];
}

interface CollectionEvents {
  change: [CollectionsChangedEvent];
}

type ValidateItemsResult =
  | { success: true; id: string; metadata: Dict }
  | { success: false; id: string; errors: Dict<string[]> };

type CreateCollectionOpts = Pick<Collection, 'schema' | 'title'>;
