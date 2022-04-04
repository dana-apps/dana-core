import { Embeddable, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  ScalarSchemaProperty,
  SchemaProperty,
  SchemaPropertyType
} from '../../common/asset.interfaces';
import { never } from '../../common/util/assert';

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
    }

    return never(json.type);
  }

  /**
   * Id of the property. This will be the key used to record metadata values in an asset.
   */
  @Property({ type: 'string' })
  id = randomUUID();

  /**
   * Human-readable property value used for displaying metadata and as the source column for bulk imports.
   */
  @Property({ type: 'string ' })
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
   * Return a zod validator object for the schema type. It only needs to define behaviour related to the `type` field,
   * not to other ones such as `required`.
   */
  protected abstract getValueSchema(): z.Schema<unknown>;

  /**
   * Return a zod validator object for this schema property.
   */
  get validator() {
    if (!this.required) {
      return this.getValueSchema().optional();
    }

    return this.getValueSchema();
  }
}

/**
 * Schema type for a free text field
 */
@Embeddable({ discriminatorValue: SchemaPropertyType.FREE_TEXT })
export class FreeTextSchemaPropertyValue
  extends SchemaPropertyValue
  implements ScalarSchemaProperty
{
  type = SchemaPropertyType.FREE_TEXT;

  protected getValueSchema() {
    return z.string();
  }
}
