import path, { extname } from 'path';
import * as xlsx from 'xlsx';
import { Logger } from 'tslog';
import { compact, keyBy, mapValues } from 'lodash';
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
import { AccessControl, SchemaProperty } from '../../common/asset.interfaces';
import { AssetService } from '../asset/asset.service';
import { error, FetchError, ok } from '../../common/util/error';
import { arrayify } from '../../common/util/collection';
import { required } from '../../common/util/assert';
import { Danapack, openDanapack } from './danapack';

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
  private _state: 'active' | 'stopping' | 'stopped' = 'stopped';
  private log = new Logger({
    name: 'AssetIngestOperation',
    instanceName: this.id
  });

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
    return this._state === 'active';
  }

  /**
   * The collection this asset is being imported into
   **/
  async getTargetCollection() {
    return required(
      await this.collectionService.getCollection(
        this.archive,
        this.targetCollectionId
      ),
      'Target collection does not exist'
    );
  }

  /**
   * The collection this asset is being imported into
   **/
  get targetCollectionId() {
    return this.session.targetCollection.id;
  }

  /**
   * Either start or continue the import operation from its most recent point
   **/
  async run() {
    if (this._state === 'active') {
      this.log.warn(
        'Attempting to call run() on an ingest sesison that is already running.'
      );
      return;
    }

    this.collectionService.on('change', this.handleCollectionChanged);

    this._state = 'active';

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
      this._state = 'stopped';
      this.ingestService.emit('importRunCompleted', this);
    }

    this.log.info('Completed session');
  }

  stop() {
    if (this._state === 'stopped') {
      return;
    }

    this._state = 'stopping';

    return new Promise<void>((resolve) => {
      this.ingestService.on('importRunCompleted', () => {
        if (this._state === 'stopped') {
          resolve();
        }
      });
    });
  }

  /**
   * Abort any pending tasks for the ingest operation.
   **/
  async teardown() {
    this.collectionService.off('change', this.handleCollectionChanged);
    await this.stop();
  }

  /**
   * Read metadata from the imported file and create staged assets.
   */
  async readMetadata() {
    this.emitStatus();

    await this.archive.useDb(async (db) => {
      if (path.extname(this.basePath) === AssetIngestService.PACKAGE_TYPE) {
        await this.readPackageMetadata();
      } else if (
        AssetIngestService.SPREADSHEET_TYPES.includes(
          path.extname(this.basePath)
        )
      ) {
        await this.readMetadataSheet();
      }

      this.session.phase = IngestPhase.READ_FILES;
      await db.persistAndFlush(this.session);
      this.emitStatus();
    });
  }

  /**
   * Read assset metadata and file references from a danapack file.
   */
  async readPackageMetadata() {
    this.log.info('Reading metadata package', this.basePath);

    const archive = await openDanapack(this.basePath);

    for (const loadEntry of archive.metadataEntries) {
      const entry = await loadEntry();
      if (entry.status === 'error') {
        this.log.error(
          'Metadata file validation failed with error:',
          entry.error
        );

        await this.archive.useDb((db) => {
          this.session.phase = IngestPhase.ERROR;
          db.persist(this.session);
        });

        this.emitStatus();
        return;
      }

      const { collection, assets } = entry.value;

      if (collection && collection !== this.targetCollectionId) {
        continue;
      }

      for (const [key, val] of Object.entries(assets)) {
        await this.readMetadataObject(val.metadata, val.files ?? [], key, {
          convert: !collection
        });
      }
    }
  }

  /**
   * Read all metadata rows from a spreadsheet into the database and move it to the `READ_FILES` phase
   *
   * @param sheetPath Absolute path to a spreadsheet of metadata
   **/
  async readMetadataSheet() {
    this.log.info('Reading metadata sheet', this.basePath);

    const workbook = xlsx.readFile(this.basePath, { codepage: 65001 });

    for (const [sheetName, sheet] of Object.entries(workbook.Sheets)) {
      const rows = xlsx.utils.sheet_to_json<Dict>(sheet);
      let i = 0;

      for (const metadata of rows) {
        const locator = `${sheetName},${i}`;

        await this.readMetadataObject(
          mapValues(metadata, (value) => [value]),
          [],
          locator
        );

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
  async readMetadataObject(
    metadata: Dict<unknown[]>,
    files: string[],
    locator: string,
    { convert = true }: { convert?: boolean } = {}
  ) {
    const collection = await this.getTargetCollection();

    if (convert) {
      const convertToSchema = this.getMetadataConverter(collection.schema);
      metadata = await convertToSchema(metadata);
    }

    await this.archive.useDbTransaction(async (db) => {
      const assetsRepository = db.getRepository(AssetImportEntity);
      const fileRepository = db.getRepository(FileImport);

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
        accessControl: AccessControl.RESTRICTED,
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

  /**
   * Given a property defined in the schema and an imported value of unknown type, coerce the value to the type expected
   * by the schema property
   *
   * @param property Schema property reepresenting the expectedf type
   * @param value Value to convert
   * @returns The provided value, converted to the expected type if possible
   */
  async convertTypeForImport(property: SchemaProperty, value: unknown) {
    return Promise.all(
      arrayify(value).map(async (val) => {
        const castedValue = await this.assetService.castOrCreatePropertyValue(
          this.archive,
          property,
          val
        );

        if (castedValue.status === 'error') {
          return [val];
        }

        if (castedValue.value === undefined) {
          return [];
        }

        return [castedValue.value];
      })
    ).then((x) => x.flat());
  }

  /**
   * Revalidate all metadata in the import session and update their (and the session's) validation state.
   */
  private async revalidate() {
    await this.archive.useDb(async (db) => {
      const assets = await db.find(AssetImportEntity, {});
      const validation =
        await this.collectionService.validateItemsForCollection(
          this.archive,
          this.targetCollectionId,
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

    return async (metadata: Dict<unknown[]>) => {
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
   * If the current session is importing from a DanaPack file, then for every asset in the `READ_FILES' phase:
   *
   * - Ensure that the media file it references exists and is a supported format.
   * - Resolve the media files it references and load them into the archive.
   * - Associate the media files with the imported asset.
   **/
  async readMediaFiles() {
    // Only read media files from a dana package
    if (extname(this.session.basePath) !== AssetIngestService.PACKAGE_TYPE) {
      await this.archive.useDb(async (db) => {
        this.session.phase = IngestPhase.COMPLETED;

        const assets = await db.find(AssetImportEntity, {
          session: this.session
        });
        for (const a of assets) {
          a.phase = IngestPhase.COMPLETED;
        }

        db.persist([this.session, ...assets]);
      });
      this.emitStatus();

      return;
    }

    const pack = await openDanapack(this.basePath);

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
        if (this._state !== 'active') {
          return;
        }

        await this.readAssetMediaFiles(asset, pack);
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
   * Ingest all media files from a DanaPack file that are referenced by an asset imported from that DanaPack file
   *
   * @param asset Imported asset to find media files for
   * @param pack DanaPack file to import media from
   **/
  async readAssetMediaFiles(asset: AssetImportEntity, pack: Danapack) {
    this.log.info('Read media file for asset', asset.path);

    await this.archive.useDb(async (db) => {
      asset.phase = IngestPhase.PROCESS_FILES;
      db.persistAndFlush(asset);
      this.emitStatus([asset.id]);

      for (const file of await asset.files.loadItems()) {
        if (this._state !== 'active') {
          return;
        }

        try {
          const res = await this.mediaService.putFile(this.archive, {
            extension: extname(file.path),
            extractTo: (dest) => pack.extractMedia(file.path, dest)
          });

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
  async updateImportedAsset(
    assetId: string,
    metadata: Dict<unknown[]>,
    accessControl: AccessControl
  ) {
    const res = await this.archive.useDb(async (db) => {
      const asset = await db.findOne(AssetImportEntity, assetId);
      if (!asset) {
        return error(FetchError.DOES_NOT_EXIST);
      }

      asset.metadata = metadata;
      asset.accessControl = accessControl;

      const [validationResult] =
        await this.collectionService.validateItemsForCollection(
          this.archive,
          this.targetCollectionId,
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
   * Delete any media files created during this import.
   */
  async removeImportedFiles() {
    // Delete the import, returning any imported media
    const importedMedia = await this.archive.useDbTransaction(async (db) => {
      const importedMedia = await this.archive.useDb((db) =>
        this.queryImportedFiles(db)
          .populate([{ field: 'media' }])
          .getResultList()
      );

      db.remove(db.getReference(ImportSessionEntity, this.id));

      return compact(importedMedia.map((file) => file.media?.id));
    });

    // Delete the imported media
    await this.mediaService.deleteFiles(this.archive, importedMedia);
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
