import { mapValues } from 'lodash';
import { z } from 'zod';
import {
  AggregatedValidationError,
  SchemaProperty,
  SingleValidationError
} from '../../common/asset.interfaces';
import { DefaultMap } from '../../common/util/collection';
import { error, FetchError, ok } from '../../common/util/error';
import { Dict } from '../../common/util/types';
import { ArchivePackage } from '../package/archive-package';
import { AssetCollectionEntity } from './asset.entity';
import { SchemaPropertyValue } from './metadata.entity';

/**
 * Manages collections of assets and associates them with a schema.
 *
 * Collections are intended to be structured hierarchically, with a collection potentially having multiple
 * sub-collections.
 *
 * Assets in a collection may only have metadata that is defined by the schema.
 * Child collections inherit the parent collection's schema, or can override it with their own.
 * The archive has a root collection, which may define a default schema.
 * All other collections must be descendents of this.
 */
export class CollectionService {
  /**
   * Return the root collection of the archive. Created if it does not yet exist.
   *
   * Currently this is the only way of accessing a collection, but we anticipate in future to support hierarchically
   * aranged collections.
   *
   * @param archive Archive containing the collection.
   * @returns The root collection for `archive`
   */
  async getRootCollection(archive: ArchivePackage) {
    return archive.useDbTransaction(async (db) => {
      let collection = await db.findOne(AssetCollectionEntity, '$root');

      if (!collection) {
        collection = db.create(AssetCollectionEntity, {
          id: '$root',
          schema: []
        });
        db.persist(collection);
      }

      return collection;
    });
  }

  /**
   * Return the metadata schema for a collection.
   *
   * When we support multiple / nested collections, this should be able to inherit from parent collections.
   *
   * @param archive Archive containing the schema
   * @param collectionId Id of the collection we want a schema for.
   * @returns An object representing the collection schema.
   */
  async getCollectionSchema(archive: ArchivePackage, collectionId: string) {
    const collection = await archive.get(AssetCollectionEntity, collectionId);

    return collection?.schema;
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
    const validator = this.getRecordValidator(schema);

    return items.map(({ id, metadata }) => {
      const result = validator.safeParse(metadata);
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
        errors: result.error.flatten().fieldErrors
      };
    });
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

  /**
   * Given a schema definition, return a zod validator to validate entries against.
   *
   * @param schema Schema definition.
   * @returns a zod validator object generated from the schema.
   */
  private getRecordValidator(schema: SchemaPropertyValue[]) {
    return z.object(
      Object.fromEntries(schema.map(({ id, validator }) => [id, validator]))
    );
  }
}

type ValidateItemsResult =
  | { success: true; id: string; metadata: Dict }
  | { success: false; id: string; errors: Dict<string[]> };
