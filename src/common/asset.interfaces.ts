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

export enum SchemaPropertyType {
  FREE_TEXT = 'FREE_TEXT'
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

/**
 * List all assets in the collection.
 */
export const ListAssets = RpcInterface({
  id: 'assets/list',
  request: z.object({}),
  response: ResourceList(Asset),
  error: z.nativeEnum(FetchError)
});
