import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import * as xlsx from 'xlsx';
import * as SecureJSON from 'secure-json-parse';
import { Logger } from 'tslog';
import { compact, keyBy } from 'lodash';
import { ObjectQuery } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/sqlite';

import {
  IngestError,
  IngestPhase,
  IngestSession
} from '../../common/ingest.interfaces';
import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';

import {
  AssetImportEntity,
  FileImport,
  ImportSessionEntity
} from './asset-import.entity';
import { AssetIngestService } from './asset-ingest.service';
import { Dict } from '../../common/util/types';
import { CollectionService } from '../asset/collection.service';
import {
  SchemaProperty,
  SchemaPropertyType
} from '../../common/asset.interfaces';
import { AssetService } from '../asset/asset.service';
import { error, FetchError, ok } from '../../common/util/error';
import { arrayify } from '../../common/util/collection';

/**
 * Encapsulates an import operation.
 *
 * A directory containing asset files (schema documents with references to media files) is used to populate the
 * database with staged imported assets and copy the media files into the archive.
 *
 *
 *
 * This stage should:
 * - Validates that the media files are supported by the archive.
 * - Copies media into the archive.
 * - Stages assets for inserting into the archive.
 * - Can recover from interruptions if the import is cancelled.
 *
 *
 */
export class AssetIngestOperation implements IngestSession {
  private _totalFiles?: number;
  private _filesRead?: number;
  private _active = false;
  private log = new Logger({
    name: 'AssetIngestOperation',
    instanceName: this.id
  });

  /** Supported file extensions for metadata sheets */
  private static SPREADSHEET_TYPES = ['.xlsx', '.csv', '.xls', '.ods'];

  constructor(
    readonly archive: ArchivePackage,
    readonly session: ImportSessionEntity,
    private ingestService: AssetIngestService,
    private mediaService: MediaFileService,
    private collectionService: CollectionService,
    private assetService: AssetService
  ) {}

  /**
   * Unique id for this operation
   **/
  get id() {
    return this.session.id;
  }

  /**
   * Human-readable name for the session
   **/
  get title() {
    return path.basename(this.session.basePath);
  }

  /**
   * False if there are validation errors, otherwise true
   **/
  get valid() {
    return this.session.valid;
  }

  /**
   * Local file path to ingest from
   **/
  get basePath() {
    return this.session.basePath;
  }

  /**
   * The current phase of the ingest operation
   **/
  get phase() {
    return this.session.phase;
  }

  /**
   * The total of media files being ingested, or undefined if this is not yet known
   **/
  get totalFiles() {
    return this._totalFiles;
  }

  /**
   * The total of media files that have been read so far
   **/
  get filesRead() {
    return this._filesRead ?? 0;
  }

  /**
   * Whether the ingest operation is currently processing assets or files.
   **/
  get active() {
    return this._active;
  }

  /**
   * Absolute path to root directory of imported metadata
   **/
  get metadataPath() {
    return path.join(this.session.basePath, 'metadata');
  }

  /**
   * Absolute path to root directory of imported media files
   **/
  get mediaPath() {
    return path.join(this.session.basePath, 'media');
  }

  /**
   * Either start or continue the import operation from its most recent point
   **/
  async run() {
    if (this._active) {
      this.log.warn(
        'Attempting to call run() on an ingest sesison that is already running.'
      );
      return;
    }

    this.collectionService.on('change', this.handleCollectionChanged);

    this._active = true;

    this.log.info('Starting session');

    try {
      if (this.session.phase === IngestPhase.READ_METADATA) {
        await this.readMetadata();
      }
      if (this.session.phase === IngestPhase.READ_FILES) {
        await this.readMediaFiles();
      }

      await this.revalidate();
    } finally {
      this._active = false;
      this.ingestService.emit('importRunCompleted', this);
    }

    this.log.info('Completed session');
  }

  /**
   * Abort any pending tasks for the ingest operation.
   **/
  async teardown() {
    this.collectionService.off('change', this.handleCollectionChanged);
    this._active = false;
  }

  /**
   * Read all metadata files under `basePath` into the database and stage them for import
   **/
  async readMetadata() {
    this.emitStatus();

    await this.archive.useDb(async (db) => {
      await this.readDirectoryMetadata(this.metadataPath);

      this.session.phase = IngestPhase.READ_FILES;
      await db.persistAndFlush(this.session);
      this.emitStatus();
    });
  }

  /**
   * Read all metadata files under a specified path into the database and stage them for import
   *
   * @param currentPath Directory to traverse for files to ignest
   */
  async readDirectoryMetadata(currentPath: string) {
    this.log.info('Reading metadata directory', currentPath);

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

      if (
        AssetIngestOperation.SPREADSHEET_TYPES.includes(path.extname(item.name))
      ) {
        await this.readMetadataSheet(path.join(currentPath, item.name));
      }
    }
  }

  /**
   * Read a metadata json file into the database and move it to the `READ_FILES` phase
   *
   * @param jsonPath Absolute path to a json file of metadata
   **/
  async readJsonMetadata(jsonPath: string) {
    this.log.info('Reading metadata file', jsonPath);

    const contents = MetadataFileSchema.safeParse(
      SecureJSON.parse(await readFile(jsonPath, 'utf8'))
    );

    const relativePath = path.relative(this.metadataPath, jsonPath);

    if (!contents.success) {
      await this.archive.useDb((db) => {
        this.session.phase = IngestPhase.ERROR;
        db.persistAndFlush(this.session);
      });
      return;
    }

    const { metadata, files = [] } = contents.data;

    await this.readMetadataObject(metadata, files, relativePath);
  }

  /**
   * Read all metadata rows from a spreadsheet into the database and move it to the `READ_FILES` phase
   *
   * @param sheetPath Absolute path to a spreadsheet of metadata
   **/
  async readMetadataSheet(sheetPath: string) {
    this.log.info('Reading metadata sheet', sheetPath);

    const workbook = xlsx.readFile(sheetPath, { codepage: 65001 });
    const relativePath = path.relative(this.metadataPath, sheetPath);

    for (const [sheetName, sheet] of Object.entries(workbook.Sheets)) {
      const rows = xlsx.utils.sheet_to_json<Dict>(sheet);
      let i = 0;

      for (const { files: fileRecord = '', ...metadata } of rows) {
        const locator = `${relativePath}:${sheetName},${i}`;
        const files = compact(String(fileRecord).split(';'));

        await this.readMetadataObject(metadata, files, locator);

        i += 1;
      }
    }
  }

  /**
   * Read a single asset's metadata into the database and move it to the `READ_FILES` phase
   *
   * @param metadata Record of metadata to import
   * @param files Array of paths to media files (relative to `mediaPath`) to import
   * @param locator Unique string representing the location (path, path + line number, etc) this item was imported from
   */
  async readMetadataObject(metadata: Dict, files: string[], locator: string) {
    const collection = await this.collectionService.getRootAssetCollection(
      this.archive
    );
    const convertToSchema = this.getMetadataConverter(collection.schema);
    metadata = await convertToSchema(metadata);

    await this.archive.useDbTransaction(async (db) => {
      const assetsRepository = db.getRepository(AssetImportEntity);
      const fileRepository = db.getRepository(FileImport);
      const collection = await this.collectionService.getRootAssetCollection(
        this.archive
      );

      const exists = !!(await assetsRepository.count({
        path: locator,
        session: this.session
      }));
      if (exists) {
        return;
      }

      const [validationResult] =
        await this.collectionService.validateItemsForCollection(
          this.archive,
          collection.id,
          [{ id: locator, metadata }]
        );

      if (!validationResult.success) {
        this.session.valid = false;
        db.persist(this.session);
      }

      const asset = assetsRepository.create({
        metadata,
        path: locator,
        session: this.session,
        phase: IngestPhase.READ_FILES,
        validationErrors: validationResult.success
          ? undefined
          : validationResult.errors
      });
      db.persist(asset);

      db.persist(
        files.map((file) =>
          fileRepository.create({
            asset,
            path: file
          })
        )
      );

      this.log.info('Staged media files for import', files);
      this.log.info('Staged asset from source', locator);
    });

    this.emitStatus();
  }

  async convertTypeForImport(property: SchemaProperty, value: unknown) {
    const castedValue = await this.assetService.castOrCreateProperty(
      this.archive,
      property,
      value
    );

    return arrayify(castedValue.status === 'error' ? value : castedValue.value);
  }

  /**
   * Revalidate all metadata in the import session and update their (and the session's) validation state.
   */
  private async revalidate() {
    await this.archive.useDb(async (db) => {
      const assets = await db.find(AssetImportEntity, {});
      const collection = await this.collectionService.getRootAssetCollection(
        this.archive
      );
      const validation =
        await this.collectionService.validateItemsForCollection(
          this.archive,
          collection.id,
          assets
        );
      const assetsById = keyBy(assets, 'id');

      for (const a of validation) {
        assetsById[a.id].validationErrors = a.success ? undefined : a.errors;
      }

      this.session.valid = validation.every((v) => v.success);
      db.persist(assets);
      db.persist(this.session);
    });
  }

  /**
   * Return a function that transforms imported metadata keys from their the human-readable label to the metadata
   * property id.
   *
   * We also coerce the values into arrays, as this is the format they are stored in.
   *
   * This is a distinct step from metadata validation – since metadata values are not stored by their human-readable id,
   * we need to transform imported metadata into the schema format before we validate it.
   *
   * @param schema The collection schema we are importing into.
   * @returns A function from import format metadata to storage format metadata.
   */
  getMetadataConverter(schema: SchemaProperty[]) {
    const byLabel = Object.fromEntries(
      schema.map((property) => [property.label.toLowerCase(), property])
    );

    return async (metadata: Dict) => {
      const entries = await Promise.all(
        Object.entries(metadata).map(async ([label, val]) => {
          const property = byLabel[label.toLowerCase()];
          if (!property) {
            return undefined;
          }

          const preparedValue = await this.convertTypeForImport(property, val);
          return [property.id, preparedValue];
        })
      );

      return Object.fromEntries(compact(entries));
    };
  }

  /**
   * For every asset in the `READ_FILES' phase:
   *
   * - Ensure that the media file it references exists and is a supported format.
   * - Resolve the media files it references and load them into the archive.
   * - Associate the media files with the imported asset.
   **/
  async readMediaFiles() {
    await this.archive.useDb(async (db) => {
      const assetsRepository = db.getRepository(AssetImportEntity);

      this._totalFiles = await this.queryImportedFiles(db).getCount();

      // Assume a file is read if it either has an error or a media file
      this._filesRead = await this.queryImportedFiles(db, {
        $or: [{ media: { $ne: null } }, { error: { $ne: null } }]
      }).getCount();

      this.emitStatus();

      const assets = await assetsRepository.find({
        session: this.session,
        phase: IngestPhase.READ_FILES
      });

      for (const asset of assets) {
        if (!this._active) {
          return;
        }

        await this.readAssetMediaFiles(asset);
        asset.phase = IngestPhase.COMPLETED;

        await db.persistAndFlush(asset);
      }

      this.session.phase = IngestPhase.COMPLETED;
      await db.persistAndFlush(this.session);
      this.emitStatus();

      this.log.info('Finished reading media files');
    });
  }

  /**
   * Ingest all media files referenced by an asset
   *
   * @param asset Imported asset to find media files for
   **/
  async readAssetMediaFiles(asset: AssetImportEntity) {
    this.log.info('Read media file for asset', asset.path);

    await this.archive.useDb(async (db) => {
      asset.phase = IngestPhase.PROCESS_FILES;
      db.persistAndFlush(asset);
      this.emitStatus([asset.id]);

      for (const file of await asset.files.loadItems()) {
        if (!this._active) {
          return;
        }

        try {
          const res = await this.mediaService.putFile(
            this.archive,
            path.join(this.mediaPath, file.path)
          );

          if (this._filesRead !== undefined) {
            this._filesRead += 1;
          }

          this.emitStatus([asset.id]);

          if (res.status === 'error') {
            this.log.error('Failed to import file', file.path, res.error);

            file.error = res.error;
            db.persist(file);
            continue;
          }

          file.media = res.value;
          db.persist(file);

          this.log.info('Read media file', file.path);
        } catch (error) {
          this.log.error('Failed to import file', file.path, error);

          file.error = IngestError.UNEXPECTED_ERROR;

          db.persist(file);
          continue;
        }
      }
    });
  }

  /**
   * Query the files imported by this ingest session
   *
   * @param db Database entity manager to use for running the query
   * @returns QueryBuilder of `FileImport` entities representing all files imported by this session
   */
  queryImportedFiles(
    db: SqlEntityManager,
    where: ObjectQuery<FileImport> = {}
  ) {
    return db
      .createQueryBuilder(FileImport)
      .join('asset', 'asset')
      .where({ asset: { session_id: this.session.id }, ...where });
  }

  /**
   * Update the metadata for an imported asset.
   *
   * Unlike the update method for assets in the archive proper, this allows edits that are invalid according to the
   * schema.
   *
   * @param assetId ID of the asset to update metadata for.
   * @param metadata Dictionary mapping property ids to metadata values
   * @returns Result indicating whether the edit is valid or invalid.
   */
  async updateImportedAsset(assetId: string, metadata: Dict<unknown[]>) {
    const res = await this.archive.useDb(async (db) => {
      const asset = await db.findOne(AssetImportEntity, assetId);
      if (!asset) {
        return error(FetchError.DOES_NOT_EXIST);
      }

      const collection = await this.collectionService.getRootAssetCollection(
        this.archive
      );

      asset.metadata = metadata;

      const [validationResult] =
        await this.collectionService.validateItemsForCollection(
          this.archive,
          collection.id,
          [{ id: asset.id, metadata: metadata ?? asset?.metadata }]
        );

      if (!validationResult.success) {
        asset.validationErrors = validationResult.errors;
      } else {
        asset.validationErrors = undefined;
      }

      db.persist(asset);
      return ok();
    });

    await this.revalidate();

    this.ingestService.emit('edit', {
      archive: this.archive,
      assetIds: [assetId],
      session: this
    });

    return res;
  }

  /**
   * Convenience for emitting a `status` event for this ingest operation.
   *
   * @param affectedIds Asset ids affected by the current change.
   */
  private emitStatus(affectedIds: string[] = []) {
    this.ingestService.emit('status', {
      archive: this.archive,
      assetIds: affectedIds,
      session: this
    });
  }

  private handleCollectionChanged = async () => {
    await this.revalidate();
    this.emitStatus();
  };
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
