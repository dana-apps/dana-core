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
 * Enum vale for possible schema property types.
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
 * Represent a simple scalar
 */
export const ScalarSchemaProperty = z.object({
  ...BaseSchemaProperty.shape,

  type: z.enum([SchemaPropertyType.FREE_TEXT])
});
export type ScalarSchemaProperty = z.TypeOf<typeof ScalarSchemaProperty>;

export const SchemaProperty = ScalarSchemaProperty;
export type SchemaProperty = z.TypeOf<typeof SchemaProperty>;

export const defaultSchemaProperty = (i: number): SchemaProperty => ({
  id: v4(),
  label: `Property ${i}`,
  required: false,
  type: SchemaPropertyType.FREE_TEXT
});

export const Collection = z.object({
  id: z.string(),
  schema: z.array(SchemaProperty)
});
export type Collection = z.TypeOf<typeof Collection>;

export const GetRootCollection = RpcInterface({
  id: 'collection/get',
  request: z.undefined(),
  response: Collection
});

export const UpdateCollectionSchema = RpcInterface({
  id: 'collection/schema/update',
  request: z.object({
    schemaId: z.string(),
    value: z.array(SchemaProperty)
  }),
  response: z.object({})
});

/**
 * List all assets in the collection.
 */
export const ListAssets = RpcInterface({
  id: 'assets/list',
  request: z.object({}),
  response: ResourceList(Asset),
  error: z.nativeEnum(FetchError)
});
