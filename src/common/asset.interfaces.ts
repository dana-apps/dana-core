import { z } from 'zod';
import { Media } from './media.interfaces';

export const Asset = z.object({
  id: z.string(),
  metadata: z.record(z.unknown()),
  media: z.array(Media)
});
export type Asset = z.TypeOf<typeof Asset>;
