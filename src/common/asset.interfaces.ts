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
 * List all assets in the collection.
 */
export const ListAssets = RpcInterface({
  id: 'assets/list',
  request: z.object({}),
  response: ResourceList(Asset),
  error: z.nativeEnum(FetchError)
});
