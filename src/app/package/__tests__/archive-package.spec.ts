import { times } from 'lodash';
import { collect } from 'streaming-iterables';

import { getTempfiles, getTempPackage } from '../../../test/tempfile';
import { AssetEntity } from '../../asset/asset.entity';
import { ArchivePackage } from '../archive-package';

describe(ArchivePackage, () => {
  test('get() returns an object in the archive', async () => {
    const temp = await getTempfiles();
    const archive = await getTempPackage(temp());

    const entity = await archive.useDb((db) => {
      const entity = db.create(AssetEntity, {});
      db.persistAndFlush(entity);
      return entity;
    });

    expect(await archive.get(AssetEntity, entity.id)).toEqual(entity);
  });

  test('list() returns all objects matching the query', async () => {
    const temp = await getTempfiles();
    const archive = await getTempPackage(temp());

    const entities = await archive.useDb((db) => {
      const entities = times(10, () => db.create(AssetEntity, {}));
      db.persistAndFlush(entities);

      return entities;
    });

    const listQuery = await archive.list(AssetEntity, {}, { pageSize: 3 });

    expect(await collect(listQuery)).toHaveLength(entities.length);
  });
});
