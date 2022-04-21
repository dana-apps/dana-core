import { compact } from 'lodash';
import path from 'path';
import {
  SchemaProperty,
  SchemaPropertyType
} from '../../../common/asset.interfaces';

import { IngestPhase } from '../../../common/ingest.interfaces';
import { error, ok, Result } from '../../../common/util/error';
import { MaybeAsync } from '../../../common/util/types';
import { collectEvents, waitUntilEvent } from '../../../test/event';
import { getTempfiles, getTempPackage } from '../../../test/tempfile';
import { AssetsChangedEvent, AssetService } from '../../asset/asset.service';
import { CollectionService } from '../../asset/collection.service';
import { MediaFile } from '../../media/media-file.entity';
import { MediaFileService } from '../../media/media-file.service';
import { ArchivePackage } from '../../package/archive-package';
import {
  AssetImportEntity,
  FileImport,
  ImportSessionEntity
} from '../asset-import.entity';
import {
  AssetIngestService,
  ImportStateChanged
} from '../asset-ingest.service';

describe('AssetImportOperation', () => {
  if (!process.env.NO_OVERRIDE_TIMEOUTS) {
    jest.setTimeout(15000);
  }

  test('imports assets', async () => {
    const fixture = await setup();
    await fixture.givenACollectionMetadataSchema([
      {
        type: SchemaPropertyType.FREE_TEXT,
        id: 'internalPropertyId',
        label: 'property',
        required: true
      }
    ]);

    const sessionRun =
      await fixture.givenThatAnImportSessionHasRunSuccessfuly();

    const session = await fixture.archive.useDb((db) =>
      db.findOneOrFail(ImportSessionEntity, { id: sessionRun.id })
    );

    const items = await session.assets.loadItems();
    const files = await Promise.all(
      items.map((x) => x.files.loadItems({ populate: ['media'] }))
    ).then((x) => x.flat());

    expect(session.valid).toBeTruthy();
    expect(session.phase).toBe(IngestPhase.COMPLETED);
    expect(items).toHaveLength(2);
    expect(items.every((x) => x.phase === IngestPhase.COMPLETED)).toBeTruthy();
    expect(items.every((x) => !x.validationErrors)).toBeTruthy();
    expect(compact(files.map((file) => file.media))).toHaveLength(2);
  });

  test('validates assets while importing', async () => {
    const fixture = await setup();
    await fixture.givenACollectionMetadataSchema([
      {
        type: SchemaPropertyType.FREE_TEXT,
        id: 'missingProperty',
        label: 'not there',
        required: true
      }
    ]);

    const session = await fixture.givenThatAnImportSessionHasRunSuccessfuly();

    const { items } = await fixture.importService.listSessionAssets(
      fixture.archive,
      session.id
    );

    expect(session.valid).toBeFalsy();
    expect(items).toHaveLength(2);
    expect(items.every((x) => !!x.validationErrors)).toBeTruthy();
  });

  test('dispatches status events while importing', async () => {
    const fixture = await setup();
    const events = fixture.statusEvents(({ session }) => ({
      phase: session?.phase,
      filesRead: session?.filesRead,
      totalFiles: session?.totalFiles
    }));

    await fixture.givenThatAnImportSessionHasRunSuccessfuly();

    expect(events.events).toEqual(
      expect.arrayContaining([
        {
          phase: IngestPhase.READ_METADATA,
          filesRead: 0,
          totalFiles: undefined
        },
        {
          phase: IngestPhase.READ_FILES,
          filesRead: 0,
          totalFiles: undefined
        },
        {
          phase: IngestPhase.READ_FILES,
          filesRead: 0,
          totalFiles: 2
        },
        {
          phase: IngestPhase.READ_FILES,
          filesRead: 1,
          totalFiles: 2
        },
        {
          phase: IngestPhase.READ_FILES,
          filesRead: 2,
          totalFiles: 2
        },
        {
          phase: IngestPhase.COMPLETED,
          filesRead: 2,
          totalFiles: 2
        }
      ])
    );
  });

  test('resumes asset imports if the import is interrupted', async () => {
    const fixture = await setup();

    fixture.importService.once('status', ({ assetIds }) => {
      if (assetIds.length > 0) {
        session.teardown();
      }
    });

    const session = await fixture.importService.beginSession(
      fixture.archive,
      BASIC_EXAMPLE
    );
    await waitUntilEvent(fixture.importService, 'importRunCompleted', session);

    expect(session.phase).toBe(IngestPhase.COMPLETED);
  });

  test('returns active sessions', async () => {
    const fixture = await setup();

    const session = await fixture.givenThatAnImportSessionHasRunSuccessfuly();

    const sessionGet = fixture.importService.getSession(
      fixture.archive,
      session.id
    );
    expect(sessionGet).toBe(session);
  });

  test('lists active sessions', async () => {
    const fixture = await setup();

    const begunSessions = await Promise.all([
      fixture.importService.beginSession(fixture.archive, BASIC_EXAMPLE),
      fixture.importService.beginSession(fixture.archive, BASIC_EXAMPLE)
    ]);

    const sessions = fixture.importService.listSessions(fixture.archive);

    expect(sessions.items).toHaveLength(2);

    await Promise.all(
      begunSessions.map((session) =>
        waitUntilEvent(fixture.importService, 'importRunCompleted', session)
      )
    );
  });

  test('cancelling a session removes all imported assets and media files and emits a change event', async () => {
    const fixture = await setup();
    const session = await fixture.givenThatAnImportSessionHasRunSuccessfuly();

    const events = fixture.statusEvents(() => 'changed');
    await fixture.importService.cancelSession(fixture.archive, session.id);

    // Deletes all data
    const importedAssets = await fixture.archive.list(AssetImportEntity);
    const importedFiles = await fixture.archive.list(FileImport);
    const mediaFiles = await fixture.archive.list(MediaFile);
    expect(importedAssets.total).toBe(0);
    expect(importedFiles.total).toBe(0);
    expect(mediaFiles.total).toBe(0);

    // Emits change events
    expect(events.events).toEqual(['changed']);

    // Removes session
    const sessions = fixture.importService.listSessions(fixture.archive);
    expect(sessions.items).toHaveLength(0);
  });

  test('comitting a session deletes the import and notifies the change to imports', async () => {
    const fixture = await setup();
    const session = await fixture.givenThatAnImportSessionHasRunSuccessfuly();

    const events = fixture.statusEvents(() => 'changed');
    await fixture.importService.commitSession(fixture.archive, session.id);

    // Deletes all import data
    const importedAssets = await fixture.archive.list(AssetImportEntity);
    const importedFiles = await fixture.archive.list(FileImport);

    expect(importedAssets.total).toBe(0);
    expect(importedFiles.total).toBe(0);

    // Emits change events
    expect(events.events).toEqual(['changed']);

    // Removes session
    const sessions = fixture.importService.listSessions(fixture.archive);
    expect(sessions.items).toHaveLength(0);
  });

  test('comitting a session creates assets and notifies the changes to assets', async () => {
    const fixture = await setup();
    await fixture.givenACollectionMetadataSchema([
      {
        label: 'property',
        id: 'p',
        type: SchemaPropertyType.FREE_TEXT,
        required: true
      }
    ]);

    const session = await fixture.givenThatAnImportSessionHasRunSuccessfuly();

    const assetEvents = collectEvents<AssetsChangedEvent>(
      fixture.assetService,
      'change'
    );
    await fixture.importService.commitSession(fixture.archive, session.id);

    const assets = await fixture.assetService.listAssets(
      fixture.archive,
      fixture.rootCollection.id
    );

    // Creates the asssets and associates them with files
    expect(assets.total).toBe(2);
    expect(assets.items.map((item) => item.media)).toHaveLength(2);
    expect(assets.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metadata: { p: 'value1' } }),
        expect.objectContaining({ metadata: { p: 'value2' } })
      ])
    );

    // Emits change events for each created assets
    expect(assetEvents.events.flatMap((event) => event.created)).toHaveLength(
      2
    );
  });

  test('updating assets in a session changes their metadata and revalidates the import', async () => {
    const fixture = await setup();
    await fixture.givenACollectionMetadataSchema([
      {
        label: 'property',
        id: 'p',
        type: SchemaPropertyType.FREE_TEXT,
        required: true
      },
      {
        label: 'extraProperty',
        id: 'extra',
        type: SchemaPropertyType.FREE_TEXT,
        required: true
      }
    ]);

    const session = await fixture.givenThatAnImportSessionHasRunSuccessfuly();
    expect(session.valid).toBeFalsy();

    let assets = await fixture.importService.listSessionAssets(
      fixture.archive,
      session.id
    );

    const sessionsEmittingEdit = fixture.editEvents((e) => e.session);
    for (const asset of assets.items) {
      await session.updateImportedAsset(asset.id, {
        ...asset.metadata,
        extra: 'Some Value'
      });
    }

    assets = await fixture.importService.listSessionAssets(
      fixture.archive,
      session.id
    );

    expect(assets.items.every((a) => !a.validationErrors)).toBeTruthy();
    expect(session.valid).toBeTruthy();
    expect(sessionsEmittingEdit.events).toContain(session);
  });

  test('updating the schema revalidates the assets in the import session', async () => {
    const fixture = await setup();
    await fixture.givenACollectionMetadataSchema([
      {
        label: 'property',
        id: 'p',
        type: SchemaPropertyType.FREE_TEXT,
        required: true
      },
      {
        label: 'extraProperty',
        id: 'extra',
        type: SchemaPropertyType.FREE_TEXT,
        required: true
      }
    ]);

    const session = await fixture.givenThatAnImportSessionHasRunSuccessfuly();
    expect(session.valid).toBeFalsy();

    const fixtureStatusEvents = fixture.statusEvents((e) => e);
    await fixture.collectionService.updateCollectionSchema(
      fixture.archive,
      fixture.rootCollection.id,
      [
        {
          label: 'property',
          id: 'p',
          type: SchemaPropertyType.FREE_TEXT,
          required: true
        },
        {
          label: 'extraProperty',
          id: 'extra',
          type: SchemaPropertyType.FREE_TEXT,
          required: false
        }
      ]
    );

    await fixtureStatusEvents.received();
    expect(session.valid).toBeTruthy();
  });

  test('Properties are casted to the expected type', async () => {
    const fixture = await setup();
    await fixture.collectionService.updateCollectionSchema(
      fixture.archive,
      fixture.rootCollection.id,
      [
        {
          label: 'property',
          id: 'property',
          type: SchemaPropertyType.FREE_TEXT,
          required: true
        }
      ]
    );

    fixture.assetService.castOrCreateProperty = (_, _property, value) => {
      if (typeof value === 'string') {
        return ok(value.toUpperCase());
      }

      return ok(value);
    };

    const session = await fixture.givenThatAnImportSessionHasRunSuccessfuly();
    const assets = await fixture.importService.listSessionAssets(
      fixture.archive,
      session.id
    );

    expect(assets.items.map((item) => item.metadata.property)).toContain(
      'VALUE1'
    );
  });

  test('Where a property cannot be casted, the literal imported value is preserved', async () => {
    const fixture = await setup();
    await fixture.collectionService.updateCollectionSchema(
      fixture.archive,
      fixture.rootCollection.id,
      [
        {
          label: 'property',
          id: 'property',
          type: SchemaPropertyType.FREE_TEXT,
          required: true
        }
      ]
    );

    fixture.assetService.castOrCreateProperty = () => error('Cannot be casted');

    const session = await fixture.givenThatAnImportSessionHasRunSuccessfuly();
    const assets = await fixture.importService.listSessionAssets(
      fixture.archive,
      session.id
    );

    expect(assets.items.map((item) => item.metadata.property)).toContain(
      'value1'
    );
  });
});

const setup = async () => {
  const temp = await getTempfiles();
  const archive = await getTempPackage(temp());
  const mediaService = new MediaFileService();
  const collectionService = new CollectionService();
  const assetService = new AssetService(collectionService, mediaService);
  const importService = new AssetIngestService(
    mediaService,
    assetService,
    collectionService
  );
  const rootCollection = await collectionService.getRootAssetCollection(
    archive
  );

  return {
    archive,
    mediaService,
    importService,
    assetService,
    collectionService,
    rootCollection,
    givenACollectionMetadataSchema: async (schema: SchemaProperty[]) => {
      await collectionService.updateCollectionSchema(
        archive,
        rootCollection.id,
        schema
      );
    },
    statusEvents: <T>(fn: (event: ImportStateChanged) => T) => {
      return collectEvents(importService, 'status', fn);
    },
    editEvents: <T>(fn: (event: ImportStateChanged) => T) => {
      return collectEvents(importService, 'edit', fn);
    },
    givenThatAnImportSessionHasRunSuccessfuly: async (
      example: string = BASIC_EXAMPLE
    ) => {
      const session = await importService.beginSession(archive, example);

      await waitUntilEvent(importService, 'importRunCompleted', session);
      return session;
    }
  };
};

const BASIC_EXAMPLE = path.join(__dirname, 'fixtures', 'basic-fixture');
