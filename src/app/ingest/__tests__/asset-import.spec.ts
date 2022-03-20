import { compact } from 'lodash';
import path from 'path';

import { ImportPhase } from '../../../common/ingest.interfaces';
import { getTempfiles, getTempPackage } from '../../../test/tempfile';
import { ImportSessionEntity } from '../asset-import.entity';
import {
  AssetIngestService,
  ImportStateChanged
} from '../asset-ingest.service';

describe('AssetImportOperation', () => {
  test('imports assets and sends notifications of progress', async () => {
    const fixture = await setup('basic-fixture');
    await fixture.importer.run();

    const session = await fixture.archive.useDb((db) =>
      db.findOneOrFail(ImportSessionEntity, { id: fixture.importer.session.id })
    );

    const items = await session.assets.loadItems();
    const files = await Promise.all(
      items.map((x) => x.files.loadItems({ populate: ['media'] }))
    ).then((x) => x.flat());

    expect(session.phase).toBe(ImportPhase.COMPLETED);
    expect(items).toHaveLength(2);
    expect(items.every((x) => x.phase === ImportPhase.COMPLETED)).toBeTruthy();
    expect(compact(files.map((file) => file.media))).toHaveLength(2);
  });

  test('dispatches status events while importing', async () => {
    const fixture = await setup('basic-fixture');
    const events = fixture.collectEvents(({ session }) => ({
      phase: session.phase,
      filesRead: session.filesRead,
      totalFiles: session.totalFiles
    }));
    await fixture.importer.run();

    expect(events).toEqual([
      {
        phase: ImportPhase.READ_FILES,
        filesRead: undefined,
        totalFiles: undefined
      },
      {
        phase: ImportPhase.READ_FILES,
        filesRead: 0,
        totalFiles: 2
      },
      {
        phase: ImportPhase.READ_FILES,
        filesRead: 1,
        totalFiles: 2
      },
      {
        phase: ImportPhase.READ_FILES,
        filesRead: 2,
        totalFiles: 2
      },
      {
        phase: ImportPhase.COMPLETED,
        filesRead: 2,
        totalFiles: 2
      }
    ]);
  });

  test('resumes asset imports if the import is interrupted', async () => {
    const fixture = await setup('basic-fixture');

    await fixture.importer.readMetadata();
    await fixture.importer.run();

    const session = await fixture.archive.useDb((db) =>
      db.findOneOrFail(ImportSessionEntity, { id: fixture.importer.session.id })
    );

    const items = await session.assets.loadItems();
    const files = await Promise.all(
      items.map((x) => x.files.loadItems({ populate: ['media'] }))
    ).then((x) => x.flat());

    expect(session.phase).toBe(ImportPhase.COMPLETED);
    expect(items).toHaveLength(2);
    expect(items.every((x) => x.phase === ImportPhase.COMPLETED)).toBeTruthy();
    expect(compact(files.map((file) => file.media))).toHaveLength(2);
  });
});

const setup = async (source: string) => {
  const sourceDir = path.join(__dirname, 'fixtures', source);
  const temp = await getTempfiles();
  const archive = await getTempPackage(temp());
  const importService = new AssetIngestService();

  const importer = await importService.beginSession(archive, sourceDir);

  return {
    archive,
    importer,
    sourceDir,
    collectEvents: <T>(fn: (event: ImportStateChanged) => T) => {
      const events: T[] = [];
      importService.on('status', (event) => events.push(fn(event)));

      return events;
    }
  };
};
