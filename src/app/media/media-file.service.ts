import { createReadStream } from 'fs';
import { copyFile, stat, unlink } from 'fs/promises';
import mime from 'mime';
import path, { extname } from 'path';
import sharp, { FormatEnum } from 'sharp';
import { Logger } from 'tslog';

import { FileImportResult, IngestError } from '../../common/ingest.interfaces';
import { Media } from '../../common/media.interfaces';
import { error, ok } from '../../common/util/error';
import { ArchivePackage } from '../package/archive-package';
import { hashStream } from '../util/stream-utils';
import { MediaFile } from './media-file.entity';
import { getMediaType } from './media-types';

interface Extractable {
  extension: string;
  extractTo: (path: string) => void | Promise<void>;
}

export class MediaFileService {
  private static RENDITION_URI_PREFIX = 'media://';
  private log = new Logger({ name: 'MediaFileService' });

  /**
   * Resolve rendition url to the absolute file path of the rendition.
   *
   * @param archive
   * @param uri A uri returned by `getRenditionUri`
   * @returns The resolved filename of the uri represented by `uri`
   */
  static resolveRenditionUri(archive: ArchivePackage, uri: string) {
    const slug = uri.substring(MediaFileService.RENDITION_URI_PREFIX.length);
    return path.join(archive.blobPath, slug);
  }

  /**
   * Persist a media file in the archive.
   *
   * @param archive Archive to store the file in
   * @param source File path to the source file
   * @returns A MediaFile instance representing the file
   */
  putFile(archive: ArchivePackage, source: string | Extractable) {
    return archive.useDb(async (db): Promise<FileImportResult<MediaFile>> => {
      if (typeof source === 'string') {
        const sourcePath = source;
        source = {
          extension: extname(sourcePath),
          extractTo: (path) => copyFile(sourcePath, path)
        };
      }

      const mediaRepository = db.getRepository(MediaFile);
      const mediaType = getMediaType(source.extension);
      if (!mediaType) {
        return error(IngestError.UNSUPPORTED_MEDIA_TYPE);
      }

      const mediaFile = mediaRepository.create({
        sha256: '',
        mimeType: mediaType.mimeType
      });
      const destPath = this.getMediaPath(archive, mediaFile);

      try {
        await source.extractTo(destPath);
      } catch (err) {
        this.log.error('Copy file to archive failed', source, err);
        return error(IngestError.IO_ERROR);
      }

      mediaFile.sha256 = await hashStream(createReadStream(destPath));
      await this.createImageRendition(archive, mediaFile, 'png');

      await mediaRepository.persistAndFlush(mediaFile);
      this.log.info('Created media file', mediaFile.id);

      return ok(mediaFile);
    });
  }

  /**
   * Get the metadata for a file from the archive.
   *
   * @param archive Archive the file is stored in
   * @param ids Ids of the file
   * @returns Metadata about the file
   */
  getFile(archive: ArchivePackage, id: string) {
    return archive.get(MediaFile, id);
  }

  /**
   * Get the media identified by a list of ids.
   *
   * @param archive Archive the file is stored in
   * @param ids Ids of the files
   * @returns Metadata about the file and its renditions
   */
  getMedia(archive: ArchivePackage, ids: string[]) {
    return archive.useDb(async (db) => {
      const files = await db.find(MediaFile, { id: { $in: ids } });
      return Promise.all(
        files.map((file) => this.entityToValue(archive, file))
      );
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
          await unlink(this.getRenditionPath(archive, file, 'png'));

          // Mark record for deletion
          db.remove(file);

          results.push(ok());
          this.log.info('Deleted file', file.id);
        } catch (err) {
          this.log.error('Failed to delete file', file.id, err);

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
    return (
      MediaFileService.RENDITION_URI_PREFIX +
      this.getRenditionSlug(mediaFile, 'png')
    );
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
   * Return the absolute path for the original file represented by a MediaFile instance
   *
   * @param archive Archive that `mediaFile` belongs to.
   * @param mediaFile Media file to get the storage path of.
   * @returns Absolute path for the file represented by a MediaFile instance
   */
  getMediaPath(archive: ArchivePackage, mediaFile: MediaFile) {
    const ext = mime.getExtension(mediaFile.mimeType);
    return path.join(archive.blobPath, mediaFile.id + '.' + ext);
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
    this.log.info('Create rendition for file', mediaFile.id);

    await sharp(this.getMediaPath(archive, mediaFile))
      .resize(1280)
      .toFormat(format)
      .toFile(this.getRenditionPath(archive, mediaFile, format));
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

  private async entityToValue(
    archive: ArchivePackage,
    entity: MediaFile
  ): Promise<Media> {
    const stats = await stat(this.getMediaPath(archive, entity));

    return {
      ...entity,
      type: 'image',
      rendition: this.getRenditionUri(archive, entity),
      fileSize: stats.size
    };
  }
}
