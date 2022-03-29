import { z } from 'zod';

/**
 * Represents an image media file.
 */
export const ImageMedia = z.object({
  id: z.string(),
  type: z.literal('image'),
  mimeType: z.string()
});

/**
 * Union type for any media file.
 */
export const Media = ImageMedia;
