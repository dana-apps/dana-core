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
  static fromJson(json: SchemaProperty) {
    if (json.type === SchemaPropertyType.FREE_TEXT) {
      return Object.assign(new FreeTextSchemaPropertyValue(), json);
    }

    return never(json.type);
  }

  @Property({ type: 'string' })
  id = randomUUID();

  @Property({ type: 'string ' })
  label!: string;

  @Property({ type: 'string' })
  type!: SchemaPropertyType;

  @Property({ type: 'boolean' })
  required!: boolean;

  /**
   * Override point to customize the validation behaviour.
   */
  protected abstract getValueSchema(): z.Schema<unknown>;

  /**
   * Return a validator for this schema property.
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
