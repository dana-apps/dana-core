import * as mime from 'mime';

/**
 * List of mime types that we know how to manage.
 */
const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/pdf',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
  'application/mxf',
  'application/x-subrip',
  'audio/mpeg',
  'video/x-ms-wmv',
  'audio/wav',
  'video/mp4'
]);

/** Given a filename, return the canonical extension, or undefined for an unsupported media type */
export function getMediaType(filename: string) {
  const mimeType = mime.getType(filename);

  if (!mimeType) {
    return;
  }

  if (ACCEPTED_TYPES.has(mimeType)) {
    return { mimeType };
  }
}
