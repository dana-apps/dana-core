import { v4 } from 'uuid';
import { z } from 'zod';
import { RpcInterface } from './ipc.interfaces';
import { Media } from './media.interfaces';
import { ResourceList } from './resource';
import { FetchError } from './util/error';

/**
 * Represent a single asset.
 */
export const Asset = z.object({
  /** Unique id of the asset */
  id: z.string(),

  /** Record of metadata associated with the asset */
  metadata: z.record(z.unknown()),

  /** All media files associated with the asset */
  media: z.array(Media)
});
export type Asset = z.TypeOf<typeof Asset>;

/**
 * Enum value for possible schema property types.
 */
export enum SchemaPropertyType {
  FREE_TEXT = 'FREE_TEXT'
}

/**
 * Error code when a request fails due to a schema validation error.
 */
export enum SchemaValidationError {
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

/**
 * Common properties shared by all schema properties
 */
const BaseSchemaProperty = z.object({
  /** Unique id of the property */
  id: z.string(),

  /** Human-readable name for the property */
  label: z.string(),

  /** Is the property required? */
  required: z.boolean(),

  /** Underlying type of the property? */
  type: z.nativeEnum(SchemaPropertyType)
});

export const ValidationError = z.record(z.array(z.string()));

/**
 * Common interface for a schema property with no special configuration fields.
 */
export const ScalarSchemaProperty = z.object({
  ...BaseSchemaProperty.shape,

  type: z.enum([SchemaPropertyType.FREE_TEXT])
});
export type ScalarSchemaProperty = z.TypeOf<typeof ScalarSchemaProperty>;

/**
 * All schema property interface types
 */
export const SchemaProperty = ScalarSchemaProperty;
export type SchemaProperty = z.TypeOf<typeof SchemaProperty>;

/**
 * Return a new schema property with default values.
 *
 * @param i Index of the property in the schema – used to generate a unique label.
 * @returns A new schema property with default values.
 */
export const defaultSchemaProperty = (i: number): SchemaProperty => ({
  id: v4(),
  label: `Property ${i}`,
  required: false,
  type: SchemaPropertyType.FREE_TEXT
});

/**
 * Common interface for a collection in the archive.
 */
export const Collection = z.object({
  id: z.string(),
  schema: z.array(SchemaProperty)
});
export type Collection = z.TypeOf<typeof Collection>;

/**
 * Return the archive's root collection.
 */
export const GetRootCollection = RpcInterface({
  id: 'collection/get',
  request: z.undefined(),
  response: Collection
});

/**
 * Update the schema of a collection.
 */
export const UpdateCollectionSchema = RpcInterface({
  id: 'collection/schema/update',
  request: z.object({
    /** ID of the collection to update */
    collectionId: z.string(),
    /** New schema for the collection */
    value: z.array(SchemaProperty)
  }),
  response: z.object({}),
  error: z.nativeEnum(FetchError).or(z.nativeEnum(SchemaValidationError))
});

/**
 * List all assets in a collection.
 */
export const ListAssets = RpcInterface({
  id: 'assets/list',
  request: z.object({}),
  response: ResourceList(Asset),
  error: z.nativeEnum(FetchError)
});
