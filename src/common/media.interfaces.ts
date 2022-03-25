import { z } from 'zod';

export const ImageMedia = z.object({
  id: z.string(),
  type: z.literal('image'),
  mimeType: z.string(),
});

export const Media = ImageMedia;
