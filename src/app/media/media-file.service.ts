import { createReadStream } from 'fs';
import { copyFile, unlink } from 'fs/promises';
import mime from 'mime';
import path from 'path';
import sharp, { FormatEnum } from 'sharp';

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

      await this.createImageRendition(archive, mediaFile, 'png');

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
   * Returns a uri for a viewable rendition of the image represented by `mediaFile`.
   *
   * In future, the return value here may need to vary across platforms.
   *
   * @param archive Archive containing the media
   * @param mediaFile Media file to get a rendition url for
   * @returns A uri suitable for viewing a rendition of the file represented by `mediaFile`
   */
  getRenditionUri(archive: ArchivePackage, mediaFile: MediaFile) {
    return 'media://' + this.getRenditionSlug(mediaFile, 'png');
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
   * Create (and save to disk)
   *
   * Currently only supports image files and will always create a single rendition of a fixed size.
   * In future, this will accept a broader variety of media types and rendition sizes.
   *
   * @param archive Archive that `mediaFile` belongs to.
   * @param mediaFile Media file to generate a rendition for.
   * @param format Format of the
   */
  private async createImageRendition(
    archive: ArchivePackage,
    mediaFile: MediaFile,
    format: keyof FormatEnum
  ) {
    await sharp(this.getMediaPath(archive, mediaFile))
      .resize(1280)
      .toFormat(format)
      .toFile(this.getRenditionPath(archive, mediaFile, format));
  }

  /**
   * Return the absolute path for the original file represented by a MediaFile instance
   *
   * @param archive Archive that `mediaFile` belongs to.
   * @param mediaFile Media file to get the storage path of.
   * @returns Absolute path for the file represented by a MediaFile instance
   */
  private getMediaPath(archive: ArchivePackage, mediaFile: MediaFile) {
    const ext = mime.getExtension(mediaFile.mimeType);
    return path.join(archive.blobPath, mediaFile.id + '.' + ext);
  }

  /**
   * Return the absolute path to a rendition of a media file
   *
   * @param archive Archive that `mediaFile` belongs to.
   * @param mediaFile Media file to get the rendition path of.
   * @param ext File extension of the rendition
   * @returns Absolute path to a rendition of a media file
   */
  private getRenditionPath(
    archive: ArchivePackage,
    mediaFile: MediaFile,
    ext: string
  ) {
    return path.join(archive.blobPath, this.getRenditionSlug(mediaFile, ext));
  }

  /**
   * Return the unique slug for a rendition of a media file.
   *
   * This should be used to generate identifiers for the media file, such as its physical storage path, URIs for read
   * access, etc.
   *
   * @param archive Archive that `mediaFile` belongs to.
   * @param mediaFile Media file to get the slug of.
   * @param ext File extension of the rendition
   * @returns Unique slug for a rendition of a media file
   */
  private getRenditionSlug(mediaFile: MediaFile, ext: string) {
    return mediaFile.id + '.rendition' + '.' + ext;
  }
}
