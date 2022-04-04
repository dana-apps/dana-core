import { z } from 'zod';
import {
  SchemaProperty,
  SchemaValidationError
} from '../../common/asset.interfaces';
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
   * @param archive Achive containing the collection.
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
   * @param archive Achive containing the schema
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
   * @param archive Achive containing the schema.
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

      let isValid = true;

      for await (const assets of this.iterateAssetsWithCollectionSchema(
        archive,
        collection
      )) {
        const validationResults = await this.validateItemsForSchema(
          archive,
          schema.map(SchemaPropertyValue.fromJson),
          assets
        );

        if (validationResults.some((res) => !res.success)) {
          isValid = false;
        }
      }

      if (!isValid) {
        return error(SchemaValidationError);
      }

      collection.schema = schema.map(SchemaPropertyValue.fromJson);
      await db.persistAndFlush(collection);

      return ok();
    });
  }

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

  private async validateItemsForSchema(
    archive: ArchivePackage,
    schema: SchemaPropertyValue[],
    items: { id: string; metadata: Dict }[]
  ) {
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

  private async *iterateAssetsWithCollectionSchema(
    archive: ArchivePackage,
    collection: AssetCollectionEntity
  ) {
    yield await collection.assets.loadItems();
  }

  private getRecordValidator(schema: SchemaPropertyValue[]) {
    return z.object(
      Object.fromEntries(schema.map(({ id, validator }) => [id, validator]))
    );
  }
}
