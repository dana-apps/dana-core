import * as mime from 'mime';

interface MediaType {
  mimeType: string;
  extensions: string[];
  name: string;
}

export const MediaTypes: MediaType[] = [
  { name: 'PNG Image', mimeType: 'image/png', extensions: ['png'] },
  { name: 'JPEG Image', mimeType: 'image/jpeg', extensions: ['jpeg', 'jpg'] },
  { name: 'TIFF Image', mimeType: 'image/tiff', extensions: ['tiff', 'tif'] }

  // TODO:
  // 'application/pdf',
  // 'application/msword',
  // 'application/pdf',
  // 'application/pdf',
  // 'video/mp4',
  // 'video/quicktime',
  // 'application/mxf',
  // 'application/x-subrip',
  // 'audio/mpeg',
  // 'video/x-ms-wmv',
  // 'audio/wav',
  // 'video/mp4'
];

const ACCEPTED_TYPES = new Set(MediaTypes.map((t) => t.mimeType));

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
