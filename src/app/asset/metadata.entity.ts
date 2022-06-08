import { Embeddable, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  AccessControl,
  AssetMetadataItem,
  ControlledDatabaseSchemaProperty,
  ScalarSchemaProperty,
  SchemaProperty,
  SchemaPropertyType
} from '../../common/asset.interfaces';
import { assert, never } from '../../common/util/assert';
import { error, FetchError, ok, Result } from '../../common/util/error';
import { MaybeAsync } from '../../common/util/types';
import { ArchivePackage } from '../package/archive-package';
import { AssetCollectionEntity, AssetEntity } from './asset.entity';
import { AssetService } from './asset.service';
import { CollectionService } from './collection.service';

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

  constructor() {
    if (typeof this.repeated === 'undefined') {
      this.repeated = false;
    }
    if (typeof this.visible === 'undefined') {
      this.visible = true;
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
  required = false;

  /**
   * True if the property supports multiple occurances.
   */
  @Property({ type: 'boolean', default: true })
  repeated!: boolean;

  /**
   * True if the property is visible to public.
   */
  @Property({ type: 'boolean', default: true })
  visible!: boolean;

  /**
   * Override to define how raw values in the database are converted into `AssetMetadataItem` values for presentation
   * in the UI
   */
  abstract convertToMetadataItems(
    context: AssetContext,
    value: unknown[]
  ): Promise<AssetMetadataItem>;

  /**
   *
   * @returns
   */
  referencedCollectionId(): string | undefined {
    return undefined;
  }

  /**
   * Return a zod validator object for this schema property.
   */
  async getValidator(context: CollectionContext) {
    let schema = z.array(await this.getValueSchema(context));

    if (!this.repeated) {
      schema = schema.max(1);
    }

    if (this.required) {
      return schema.min(1);
    } else {
      return schema.optional();
    }
  }

  /**
   * Return a zod validator object for the schema type. It only needs to define behaviour related to the `type` field,
   * not to other ones such as `required`.
   */
  protected abstract getValueSchema(
    context: CollectionContext
  ): MaybeAsync<z.Schema<unknown>>;

  /**
   * Coerce a value of unknown type to one that is valid according to this schema.
   * Implementations of this should not have side-effects.
   *
   * @param value A value of unknown type that should be coersce to one valid according to this property.
   * @param context Application context for casting the value.
   * @returns A result value that either contains the coersced value, or an error if coerscion is not possible.
   */
  abstract castValue(
    value: unknown,
    context: AssetContext
  ): MaybeAsync<Result<unknown>>;

  /**
   * Coerce a value of unknown type to one that is valid according to this schema.
   * This variant calls through to `castValue` by default but may be overridden to have side-effects.
   *
   * @param value A value of unknown type that should be coersce to one valid according to this property.
   * @param context Application context for casting the value.
   * @returns A result value that either contains the coersced value, or an error if coerscion is not possible.
   */
  castOrCreateValue(value: unknown, context: AssetContext) {
    return this.castValue(value, context);
  }

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

  castValue(value: unknown) {
    return ok(toOptionalString(value));
  }

  toJson() {
    return this;
  }

  async convertToMetadataItems(
    context: AssetContext,
    value: unknown[]
  ): Promise<AssetMetadataItem<unknown>> {
    return {
      rawValue: value,
      presentationValue: value.map((rawValue) => ({
        rawValue,
        label: String(rawValue)
      }))
    };
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
  protected getValueSchema({ archive }: CollectionContext) {
    return z.string().superRefine(async (refId, ctx) => {
      const referencedItem = await archive.useDb((db) =>
        db.count(AssetEntity, { collection: this.databaseId, id: refId })
      );

      if (!referencedItem) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Record does not exist in referenced database'
        });
      }
    });
  }

  referencedCollectionId(): string | undefined {
    return this.databaseId;
  }

  async castValue(value: unknown, { archive, assets }: AssetContext) {
    const title = toOptionalString(value);
    if (!title) {
      return ok(undefined);
    }

    const res = await assets.searchAssets(archive, this.databaseId, {
      query: title,
      exact: true
    });

    return res.status === 'ok' && res.value.total >= 1
      ? ok(res.value.items[0])
      : error(FetchError.DOES_NOT_EXIST);
  }

  async castOrCreateValue(value: unknown, context: AssetContext) {
    const existingValueRes = await this.castValue(value, context);
    if (existingValueRes.status === 'ok') {
      return ok(existingValueRes.value?.id);
    }

    const collection = await context.archive.get(
      AssetCollectionEntity,
      this.databaseId
    );

    if (!collection) {
      return error(FetchError.DOES_NOT_EXIST);
    }

    const stringValue = toOptionalString(value);
    const metadata = stringValue
      ? await context.collections.getLabelRecordMetadata(
          context.archive,
          collection.id,
          stringValue
        )
      : undefined;

    if (!metadata) {
      return error(FetchError.DOES_NOT_EXIST);
    }

    const res = await context.assets.createAsset(
      context.archive,
      this.databaseId,
      {
        accessControl: AccessControl.RESTRICTED,
        metadata
      }
    );
    if (res.status === 'error') {
      return res;
    }

    return ok(res.value.id);
  }

  toJson() {
    return this;
  }

  async convertToMetadataItems(
    { assets, archive }: AssetContext,
    value: unknown[]
  ): Promise<AssetMetadataItem> {
    assert(
      value.every((x) => typeof x === 'string'),
      'Expected array of asset ids'
    );

    const items = await assets.getMultiple(archive, value as string[], {
      shallow: true
    });

    return {
      rawValue: value,
      presentationValue: items.map((x) => ({
        rawValue: x.id,
        label: x.title
      }))
    };
  }
}

/**
 * Context passed to the cast and validation hooks
 */
export interface CollectionContext {
  archive: ArchivePackage;
  collections: CollectionService;
}

/**
 * Context passed to the cast and validation hooks
 */
export interface AssetContext {
  archive: ArchivePackage;
  assets: AssetService;
  collections: CollectionService;
}

function toOptionalString(value: unknown) {
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }

  const stringValue = String(value);
  return stringValue.trim().length === 0 ? undefined : stringValue;
}
