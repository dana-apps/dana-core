import { z } from 'zod';
import { Media } from './media.interfaces';

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
