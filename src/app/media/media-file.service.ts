import { createReadStream } from 'fs';
import { copyFile, unlink } from 'fs/promises';
import path from 'path';

import {
  FileImportResult,
  FileImportError
} from '../../common/ingest.interfaces';
import { error, ok } from '../../common/util/error';
import { ArchivePackage } from '../package/archive-package';
import { hashStream } from '../util/stream-utils';
import { MediaFile } from './media-file.entity';
import { getMediaType } from './media-types';

export class MediaFileService {
  putFile(archive: ArchivePackage, source: string) {
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

  async deleteFiles(archive: ArchivePackage, ids: string[]) {
    const orphanedBlobs = await archive.useDbTransaction(async (db) => {
      const fileRecords = await db.find(MediaFile, { id: ids });

      // Mark them for deletion
      db.remove(fileRecords);

      // Find all the file records referencing a deleted file record's blob
      const remainingRefs = await db.find(MediaFile, {
        sha256: fileRecords.map((file) => file.sha256)
      });

      // Return all the blobs that have become unreferenced
      const remainingRefShas = new Set(remainingRefs.map((ref) => ref.sha256));
      return fileRecords
        .filter((file) => !remainingRefShas.has(file.sha256))
        .map((file) => file.sha256);
    });

    // Delete the oprhaned blobs after the transaction commits
    for await (const file of orphanedBlobs) {
      await unlink(this.getMediaPath(archive, file));
    }
  }

  listMedia(archive: ArchivePackage) {
    return archive.list(MediaFile);
  }

  private getMediaPath(archive: ArchivePackage, id: string) {
    return path.join(archive.blobPath, id);
  }
}
