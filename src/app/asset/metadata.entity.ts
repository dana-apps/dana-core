import { Embeddable, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  ControlledDatabaseSchemaProperty,
  ScalarSchemaProperty,
  SchemaProperty,
  SchemaPropertyType
} from '../../common/asset.interfaces';
import { never } from '../../common/util/assert';
import { MaybeAsync } from '../../common/util/types';
import { AssetEntity } from './asset.entity';

/**
 * Base class for schema property values.
 *
 * Defines the presentational and validation behaviour for a property of a collection in the archive.
 *
 * We structure these entities using our ORM's 'polymorphic embeddables' feature here to get a few nice things like
 * validation on json blobs.
 *
 * You might want to glance over the documentation at https://mikro-orm.io/docs/next/embeddables#polymorphic-embeddables
 * before doing any work here.
 */
@Embeddable({ abstract: true, discriminatorColumn: 'type' })
export abstract class SchemaPropertyValue {
  /**
   * Given a json representation of a schema property, return an instance of the subclass of SchemaPropertyValue for
   * the schema property type.
   *
   * @param json Json representation of the schema property.
   * @returns Concrete subclass of SchemaPropertyValue.
   */
  static fromJson(json: SchemaProperty) {
    if (json.type === SchemaPropertyType.FREE_TEXT) {
      return Object.assign(new FreeTextSchemaPropertyValue(), json);
    } else if (json.type === SchemaPropertyType.CONTROLLED_DATABASE) {
      return Object.assign(new ControlledDatabaseSchemaPropertyValue(), json);
    } else {
      return never(json);
    }
  }

  /**
   * Id of the property. This will be the key used to record metadata values in an asset.
   */
  @Property({ type: 'string' })
  id = randomUUID();

  /**
   * Human-readable property value used for displaying metadata and as the source column for bulk imports.
   */
  @Property({ type: 'string' })
  label!: string;

  /**
   * Type of the property. This is used to discriminate subclasses of SchemaPropertyValue when loaded from the database.
   */
  @Property({ type: 'string' })
  type!: SchemaPropertyType;

  /**
   * True if the property is required.
   */
  @Property({ type: 'boolean' })
  required!: boolean;

  /**
   * Override to define collections referenced by this property. Defaults to none.
   *
   * @returns The id of a referenced collection or undefined if none.
   */
  getReferencedCollection(): string | undefined {
    return undefined;
  }

  /**
   * Return a zod validator object for this schema property.
   */
  async getValidator(context: SchemaValidationContext) {
    if (!this.required) {
      const innerSchema = await this.getValueSchema(context);
      return innerSchema.optional();
    }

    return this.getValueSchema(context);
  }

  /**
   * Return a zod validator object for the schema type. It only needs to define behaviour related to the `type` field,
   * not to other ones such as `required`.
   */
  protected abstract getValueSchema(
    context: SchemaValidationContext
  ): MaybeAsync<z.Schema<unknown>>;

  /**
   * Cast to a SchemaProperty instance suitable for returning over APIs
   */
  abstract toJson(): SchemaProperty;
}

/**
 * Schema type for a free text field
 */
@Embeddable({ discriminatorValue: SchemaPropertyType.FREE_TEXT })
export class FreeTextSchemaPropertyValue
  extends SchemaPropertyValue
  implements ScalarSchemaProperty
{
  type: SchemaPropertyType.FREE_TEXT = SchemaPropertyType.FREE_TEXT;

  protected getValueSchema() {
    return z.string();
  }

  toJson() {
    return this;
  }
}

/**
 * Schema type for a link to a record in a controlled database
 */
@Embeddable({ discriminatorValue: SchemaPropertyType.CONTROLLED_DATABASE })
export class ControlledDatabaseSchemaPropertyValue
  extends SchemaPropertyValue
  implements ControlledDatabaseSchemaProperty
{
  type: SchemaPropertyType.CONTROLLED_DATABASE =
    SchemaPropertyType.CONTROLLED_DATABASE;

  @Property({ type: 'string' })
  databaseId!: string;

  /**
   * Validate that the value of this item points
   *
   * @param param0
   * @returns
   */
  protected getValueSchema({ getRecord }: SchemaValidationContext) {
    return z.string().superRefine(async (refId, ctx) => {
      const referencedItem = await getRecord(this.databaseId, refId);

      if (!referencedItem) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Record does not exist in referenced database'
        });
      }
    });
  }

  toJson() {
    return this;
  }

  getReferencedCollection(): string | undefined {
    return this.databaseId;
  }
}

/**
 * Context passed to the getValidator()
 */
export interface SchemaValidationContext {
  getRecord(
    collectionId: string,
    itemId: string
  ): Promise<AssetEntity | undefined>;
}
