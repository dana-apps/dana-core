import { createReadStream } from 'fs';
import { copyFile, unlink } from 'fs/promises';
import mime from 'mime';
import path from 'path';

import { FileImportResult, IngestError } from '../../common/ingest.interfaces';
import { error, ok } from '../../common/util/error';
import { ArchivePackage } from '../package/archive-package';
import { hashStream } from '../util/stream-utils';
import { MediaFile } from './media-file.entity';
import { getMediaType } from './media-types';

export class MediaFileService {
  /**
   * Persist a media file in the archive.
   *
   * @param archive Archive to store the file in
   * @param source File path to the source file
   * @returns A MediaFile instance representing the file
   */
  putFile(archive: ArchivePackage, source: string) {
    return archive.useDb(async (db): Promise<FileImportResult<MediaFile>> => {
      const mediaRepository = db.getRepository(MediaFile);
      const mediaType = getMediaType(source);
      if (!mediaType) {
        return error(IngestError.UNSUPPORTED_MEDIA_TYPE);
      }

      const sha256 = await hashStream(createReadStream(source));
      const mediaFile = mediaRepository.create({
        sha256,
        mimeType: mediaType.mimeType
      });

      try {
        await copyFile(source, this.getMediaPath(archive, mediaFile));
      } catch {
        return error(IngestError.IO_ERROR);
      }

      await mediaRepository.persistAndFlush(mediaFile);

      return ok(mediaFile);
    });
  }

  /**
   * Delete one or more media files from the archive.
   *
   * @param archive Archive to store the file in
   * @param ids Ids of the files to delete
   * @returns Success or failure of each deletion request
   */
  async deleteFiles(
    archive: ArchivePackage,
    ids: string[]
  ): Promise<FileImportResult[]> {
    const results: FileImportResult[] = [];

    await archive.useDbTransaction(async (db) => {
      const fileRecords = await db.find(MediaFile, { id: ids });

      for (const file of fileRecords) {
        // Remove the file
        try {
          await unlink(this.getMediaPath(archive, file));

          // Mark record for deletion
          db.remove(file);

          results.push(ok());
        } catch {
          results.push(error(IngestError.IO_ERROR));
        }
      }
    });

    return results;
  }

  /**
   * List all media files in an archive
   *
   * @param archive Archive to list media from
   * @returns List of media files
   */
  listMedia(archive: ArchivePackage) {
    return archive.list(MediaFile);
  }

  /**
   * Return the absolute path for the file represented by a MediaFile instance
   *
   * @param archive Archive that `mediaFile` belongs to.
   * @returns Absolute path for the file represented by a MediaFile instance
   */
  private getMediaPath(archive: ArchivePackage, mediaFile: MediaFile) {
    const ext = mime.getExtension(mediaFile.mimeType);
    return path.join(archive.blobPath, mediaFile.id + '.' + ext);
  }
}
