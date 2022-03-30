import { compact } from 'lodash';
import path from 'path';

import { IngestPhase } from '../../../common/ingest.interfaces';
import { collectEvents, waitUntilEvent } from '../../../test/event';
import { getTempfiles, getTempPackage } from '../../../test/tempfile';
import { AssetsChangedEvent, AssetService } from '../../asset/asset.service';
import { MediaFile } from '../../media/media-file.entity';
import { MediaFileService } from '../../media/media-file.service';
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
  test('imports assets', async () => {
    const fixture = await setup();
    const sessionRun =
      await fixture.givenThatAnImportSessionHasRunSuccessfuly();

    const session = await fixture.archive.useDb((db) =>
      db.findOneOrFail(ImportSessionEntity, { id: sessionRun.id })
    );

    const items = await session.assets.loadItems();
    const files = await Promise.all(
      items.map((x) => x.files.loadItems({ populate: ['media'] }))
    ).then((x) => x.flat());

    expect(session.phase).toBe(IngestPhase.COMPLETED);
    expect(items).toHaveLength(2);
    expect(items.every((x) => x.phase === IngestPhase.COMPLETED)).toBeTruthy();
    expect(compact(files.map((file) => file.media))).toHaveLength(2);
  });

  test('dispatches status events while importing', async () => {
    const fixture = await setup();
    const events = fixture.statusEvents(({ session }) => ({
      phase: session?.phase,
      filesRead: session?.filesRead,
      totalFiles: session?.totalFiles
    }));

    await fixture.givenThatAnImportSessionHasRunSuccessfuly();

    expect(events).toEqual(
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
    expect(events).toEqual(['changed']);

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
    expect(events).toEqual(['changed']);

    // Removes session
    const sessions = fixture.importService.listSessions(fixture.archive);
    expect(sessions.items).toHaveLength(0);
  });

  test('comitting a session creates assets and notifies the changes to assets', async () => {
    const fixture = await setup();
    const session = await fixture.givenThatAnImportSessionHasRunSuccessfuly();

    const assetEvents = collectEvents<AssetsChangedEvent>(
      fixture.assetService,
      'change'
    );
    await fixture.importService.commitSession(fixture.archive, session.id);

    const assets = await fixture.assetService.listAssets(fixture.archive);

    // Creates the asssets and associates them with files
    expect(assets.total).toBe(2);
    expect(assets.items.map((item) => item.media)).toHaveLength(2);

    // Emits change events for each created assets
    expect(assetEvents.flatMap((event) => event.created)).toHaveLength(2);
  });
});

const setup = async () => {
  const temp = await getTempfiles();
  const archive = await getTempPackage(temp());
  const mediaService = new MediaFileService();
  const assetService = new AssetService();
  const importService = new AssetIngestService(mediaService, assetService);

  return {
    archive,
    mediaService,
    importService,
    assetService,
    statusEvents: <T>(fn: (event: ImportStateChanged) => T) => {
      return collectEvents(importService, 'status', fn);
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
