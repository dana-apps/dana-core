import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { z } from 'zod';

import {
  FileImportError,
  ImportPhase,
  IngestSession
} from '../../common/ingest.interfaces';
import { putMediaFile } from '../media/media-types';
import { ArchivePackage } from '../package/archive-package';

import {
  AssetImportEntity,
  FileImport,
  ImportSessionEntity
} from './asset-import.entity';
import { AssetIngestService } from './asset-ingest.service';

/**
 * Encapsulates an import operation.
 *
 * Import is the first stage of the ingest process.
 *
 * A directory containing asset files (JSON documents with a flexible metadata schema and references to media files) is
 * used to populate the database with staged imported assets and copy the media files into the archive.
 *
 * This stage:
 * - Validates that the media files are supported by the archive.
 * - Copies media into the archive.
 * - Stages assets for inserting into the archive.
 * - Can recover from interruptions if the import is cancelled.
 *
 * It does not:
 * - Perform any validation of the metadata.
 * - Create assets in the archive – a subsequent phase is required to do this.
 */
export class AssetImportOperation implements IngestSession {
  private _totalFiles?: number;
  private _filesRead?: number;
  private _active = false;

  constructor(
    readonly archive: ArchivePackage,
    readonly session: ImportSessionEntity,
    private events: AssetIngestService
  ) {}

  get id() {
    return this.session.id;
  }

  get basePath() {
    return this.session.basePath;
  }

  get phase() {
    return this.session.phase;
  }

  get totalFiles() {
    return this._totalFiles;
  }

  get filesRead() {
    return this._filesRead;
  }

  /** Continue the import operation from its current stage, starting it if necessary */
  async run() {
    this._active = true;

    if (this.session.phase === ImportPhase.READ_METADATA) {
      await this.readMetadata();
    }
    if (this.session.phase === ImportPhase.READ_FILES) {
      await this.readMediaFiles();
    }

    return this;
  }

  async teardown() {
    this._active = false;
  }

  /** Read all metadata files into the database */
  async readMetadata() {
    if (!this._active) {
      return;
    }

    await this.archive.useDb(async (db) => {
      await this.readDirectoryMetadata(this.metadataPath);

      this.session.phase = ImportPhase.READ_FILES;
      await db.persistAndFlush(this.session);
      this.emitStatus();
    });
  }

  /** Read all metadata files into the database under a path */
  async readDirectoryMetadata(currentPath: string) {
    if (!this._active) {
      return;
    }

    for (const item of await readdir(currentPath, { withFileTypes: true })) {
      if (!this._active) {
        return;
      }

      if (item.isDirectory() && !item.isSymbolicLink()) {
        // Recurse into directories
        await this.readDirectoryMetadata(path.join(currentPath, item.name));
      }

      if (path.extname(item.name) === '.json') {
        await this.readJsonMetadata(path.join(currentPath, item.name));
      }
    }
  }

  /** Read a metadata file into the database and move it to the `READ_FILES` phase */
  async readJsonMetadata(jsonPath: string) {
    const contents = MetadataFileSchema.safeParse(
      JSON.parse(await readFile(jsonPath, 'utf8'))
    );

    const relativePath = path.relative(this.metadataPath, jsonPath);

    if (!contents.success) {
      await this.archive.useDb((db) => {
        this.session.phase = ImportPhase.ERROR;
        db.persistAndFlush(this.session);
      });
      return;
    }

    const { metadata, files = [] } = contents.data;

    await this.archive.useDbTransaction(async (db) => {
      const assetsRepository = db.getRepository(AssetImportEntity);
      const fileRepository = db.getRepository(FileImport);

      const exists = !!(await assetsRepository.count({
        path: relativePath,
        session: this.session
      }));
      if (exists) {
        return;
      }

      const asset = assetsRepository.create({
        metadata,
        path: relativePath,
        session: this.session,
        phase: ImportPhase.READ_FILES
      });
      assetsRepository.persist(asset);

      assetsRepository.persist(
        files.map((file) =>
          fileRepository.create({
            asset,
            path: file
          })
        )
      );
    });
  }

  /**
   * For every asset in the `READ_FILES' phase:
   *
   * - Ensure that the media file it references exists and is a supported format.
   * - Resolve the media files it references and load it into the archive.
   * - Associate the media with the
   **/
  async readMediaFiles() {
    await this.archive.useDb(async (db) => {
      const assetsRepository = db.getRepository(AssetImportEntity);

      this._totalFiles = await db
        .createQueryBuilder(FileImport)
        .join('asset', 'asset')
        .where({ asset: { session_id: this.session.id } })
        .getCount();

      this._filesRead = await db
        .createQueryBuilder(FileImport)
        .where({
          $or: [{ media: { $ne: null } }, { error: { $ne: null } }],
          asset: { session_id: this.session.id }
        })
        .getCount();

      this.emitStatus();

      const assets = await assetsRepository.find({
        session: this.session,
        phase: ImportPhase.READ_FILES
      });

      for (const asset of assets) {
        if (!this._active) {
          return;
        }

        await this.readAssetMediaFiles(asset);
        asset.phase = ImportPhase.COMPLETED;

        await db.persistAndFlush(asset);
      }

      this.session.phase = ImportPhase.COMPLETED;
      await db.persistAndFlush(this.session);
      this.emitStatus();
    });
  }

  /** Ingest all metadata files under a path */
  async readAssetMediaFiles(asset: AssetImportEntity) {
    await this.archive.useDb(async (db) => {
      for (const file of await asset.files.loadItems()) {
        if (!this._active) {
          return;
        }

        try {
          const res = await putMediaFile(
            this.archive,
            path.join(this.mediaPath, file.path)
          );

          if (this._filesRead !== undefined) {
            this._filesRead += 1;
          }

          this.emitStatus([asset.id]);

          if (res.status === 'error') {
            file.error = res.error;
            db.persist(file);
            continue;
          }

          file.media = res.value;
          db.persist(file);
        } catch {
          file.error = FileImportError.UNEXPECTED_ERROR;
          db.persist(file);
          continue;
        }
      }
    });
  }

  /** Absolute path to root directory of imported metadata */
  get metadataPath() {
    return path.join(this.session.basePath, 'metadata');
  }

  /** Absolute path to root directory of imported media files */
  get mediaPath() {
    return path.join(this.session.basePath, 'media');
  }

  emitStatus(affectedIds: string[] = []) {
    this.events.emit('status', {
      archive: this.archive,
      assetIds: affectedIds,
      session: this
    });
  }
}

/**
 * Structure of a metadata document.
 *
 * A metadata document contains the metadata and media files that compose an imported asset.
 * Metadata MUST be specified as a flat json map with.
 * Metadata need not fit any schema otherwise – it will be validated and
 * An imported asset MAY have zero, one or multiple associated media files.
 * Media files MUST be in a supported format.
 * Media files MUST be specified as a relative path (using posix conventions) from the media directory of the import
 * root.
 **/
const MetadataFileSchema = z.object({
  metadata: z.record(z.any()),
  files: z.optional(z.array(z.string()))
});
type MetadataFileSchema = z.TypeOf<typeof MetadataFileSchema>;
