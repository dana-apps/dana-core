import { z } from 'zod';
import { SchemaProperty } from '../../common/asset.interfaces';
import { Resource } from '../../common/resource';
import { error, FetchError, ok } from '../../common/util/error';
import { ArchivePackage } from '../package/archive-package';
import { AssetCollectionEntity } from './asset.entity';
import { SchemaPropertyValue } from './metadata.entity';

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
   * @returns
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

      collection.schema = schema.map(SchemaPropertyValue.fromJson);
      await db.persistAndFlush(collection);

      return ok();
    });
  }

  async validateItemsForCollection<T extends Resource>(
    archive: ArchivePackage,
    collectionId: string,
    items: T[]
  ) {
    const collection = await archive.get(AssetCollectionEntity, collectionId);
    if (!collection) {
      throw Error('Collection does not exist: ' + collectionId);
    }

    const validator = this.getRecordValidator(collection?.schema);

    return items.map((asset) => {
      const result = validator.safeParse(asset);
      if (result.success) {
        return {
          id: asset.id,
          success: true
        };
      }

      return {
        id: asset.id,
        success: false,
        errors: result.error.flatten().fieldErrors
      };
    });
  }

  private getRecordValidator(schema: SchemaPropertyValue[]) {
    return z.object(
      Object.fromEntries(schema.map(({ id, validator }) => [id, validator]))
    );
  }
}
