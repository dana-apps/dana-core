import { z } from 'zod';

/**
 * Represents an image media file.
 */
export const ImageMedia = z.object({
  id: z.string(),
  type: z.literal('image'),
  rendition: z.string(),
  mimeType: z.string(),
  fileSize: z.number()
});

/**
 * Union type for any media file.
 */
export const Media = ImageMedia;
export type Media = z.TypeOf<typeof Media>;
