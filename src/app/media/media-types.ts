import { createReadStream } from 'fs';
import { copyFile } from 'fs/promises';
import * as mime from 'mime';
import path from 'path';
import {
  FileImportError,
  FileImportResult
} from '../../common/ingest.interfaces';
import { error, ok } from '../../common/util/error';
import { ArchivePackage } from '../package/archive-package';
import { hashStream } from '../util/stream-utils';
import { MediaFile } from './media-file.entity';

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

export function putMediaFile(archive: ArchivePackage, source: string) {
  return archive.useDb(async (db): Promise<FileImportResult<MediaFile>> => {
    const mediaRepository = db.getRepository(MediaFile);
    const mediaType = getMediaType(source);
    if (!mediaType) {
      return error(FileImportError.UNSUPPORTED_MEDIA_TYPE);
    }

    const sha256 = await hashStream(createReadStream(source));
    const mediaFile = mediaRepository.create({
      sha256,
      mimeType: mediaType.mimeType
    });

    try {
      await copyFile(source, path.join(archive.blobPath, sha256));
    } catch {
      return error(FileImportError.IO_ERROR);
    }

    await mediaRepository.persistAndFlush(mediaFile);

    return ok(mediaFile);
  });
}
