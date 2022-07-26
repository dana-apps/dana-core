import {
  AccessControl,
  defaultSchemaProperty,
  SchemaPropertyType
} from '../../../common/asset.interfaces';
import { UnwrapPromise } from '../../../common/util/types';
import { requireSuccess } from '../../../test/result';
import { getTempfiles, getTempPackage } from '../../../test/tempfile';
import { MediaFileService } from '../../media/media-file.service';
import { AssetService } from '../asset.service';
import { CollectionService } from '../collection.service';

describe(CollectionService, () => {
  test('supports getting the root collection', async () => {
    const fixture = await setup();

    expect(
      await fixture.service.getRootAssetCollection(fixture.archive)
    ).toEqual(await fixture.service.getRootAssetCollection(fixture.archive));
  });

  test('supports defining a schema and validating a list of objects for the collection', async () => {
    const fixture = await setup();
    const root = await fixture.service.getRootAssetCollection(fixture.archive);

    await fixture.service.updateCollectionSchema(fixture.archive, root.id, [
      {
        ...defaultSchemaProperty(),
        id: 'dogtype',
        label: 'Dog Type',
        required: true,
        repeated: false,
        type: SchemaPropertyType.FREE_TEXT
      }
    ]);

    const validationResult = await fixture.service.validateItemsForCollection(
      fixture.archive,
      root.id,
      [
        {
          id: 'myLab',
          metadata: {
            dogtype: ['Labrador']
          }
        },
        {
          id: 'myPoodle',
          metadata: {
            dogtype: ['Poodle']
          }
        },
        {
          id: 'notADog',
          metadata: {}
        }
      ]
    );

    expect(validationResult).toEqual(
      expect.arrayContaining([
        {
          id: 'myLab',
          metadata: { dogtype: ['Labrador'] },
          success: true
        },
        {
          id: 'myPoodle',
          metadata: { dogtype: ['Poodle'] },
          success: true
        },
        {
          id: 'notADog',
          success: false,
          errors: expect.any(Object)
        }
      ])
    );
  });

  test('merges with schema from parents', async () => {
    const fixture = await setup();
    const root = await fixture.service.getRootAssetCollection(fixture.archive);

    await fixture.service.updateCollectionSchema(fixture.archive, root.id, [
      {
        id: 'dogtype',
        label: 'Dog Type',
        required: true,
        repeated: false,
        type: SchemaPropertyType.FREE_TEXT,
        visible: true
      }
    ]);

    const collection = await fixture.service.createCollection(
      fixture.archive,
      root.id,
      {
        title: 'Child collection',
        schema: [
          {
            id: 'fluffiness',
            label: 'Fluffyness',
            required: true,
            repeated: true,
            type: SchemaPropertyType.FREE_TEXT,
            visible: true
          }
        ]
      }
    );

    expect(collection.schema).toEqual([
      {
        id: 'dogtype',
        label: 'Dog Type',
        required: true,
        visible: true,
        repeated: false,
        type: SchemaPropertyType.FREE_TEXT
      },
      {
        id: 'fluffiness',
        label: 'Fluffyness',
        visible: true,
        required: true,
        repeated: true,
        type: SchemaPropertyType.FREE_TEXT
      }
    ]);

    const validationResult = await fixture.service.validateItemsForCollection(
      fixture.archive,
      collection.id,
      [
        {
          id: 'myLab',
          metadata: {
            dogtype: ['Labrador'],
            fluffiness: ['50%']
          }
        }
      ]
    );

    expect(validationResult).toEqual(
      expect.arrayContaining([
        {
          id: 'myLab',
          metadata: { dogtype: ['Labrador'], fluffiness: ['50%'] },
          success: true
        }
      ])
    );
  });

  test('altering the schema validates it against the existing archive', async () => {
    const fixture = await setup();
    const root = await fixture.service.getRootAssetCollection(fixture.archive);

    requireSuccess(
      await fixture.service.updateCollectionSchema(fixture.archive, root.id, [
        {
          ...defaultSchemaProperty(),
          id: 'dogtype',
          label: 'Dog Type',
          required: false,
          repeated: false,
          type: SchemaPropertyType.FREE_TEXT
        }
      ])
    );

    const testAsset = requireSuccess(
      await fixture.assets.createAsset(fixture.archive, root.id, {
        accessControl: AccessControl.RESTRICTED,
        metadata: {}
      })
    );

    const resultMissingValue = await fixture.service.updateCollectionSchema(
      fixture.archive,
      root.id,
      [
        {
          ...defaultSchemaProperty(),
          id: 'dogtype',
          label: 'Dog Type',
          required: true,
          repeated: false,
          type: SchemaPropertyType.FREE_TEXT
        }
      ]
    );
    expect(resultMissingValue.status).toEqual('error');

    requireSuccess(
      await fixture.assets.updateAsset(fixture.archive, testAsset.id, {
        metadata: { dogtype: ['Husky'] }
      })
    );

    const resultWithValue = await fixture.service.updateCollectionSchema(
      fixture.archive,
      root.id,
      [
        {
          ...defaultSchemaProperty(),
          id: 'dogtype',
          label: 'Dog Type',
          required: true,
          repeated: false,
          type: SchemaPropertyType.FREE_TEXT
        }
      ]
    );
    expect(resultWithValue.status).toEqual('ok');
  });

  describe('Controlled databases', () => {
    async function setupCollection(
      fixture: UnwrapPromise<ReturnType<typeof setup>>
    ) {
      const db = await fixture.service.createCollection(
        fixture.archive,
        fixture.dbCollection.id,
        {
          title: 'Some Database',
          schema: [
            {
              ...defaultSchemaProperty(),
              id: 'title',
              label: 'Title',
              type: SchemaPropertyType.FREE_TEXT,
              repeated: false,
              required: true
            }
          ]
        }
      );

      await fixture.service.updateCollectionSchema(
        fixture.archive,
        fixture.assetCollection.id,
        [
          {
            ...defaultSchemaProperty(),
            id: 'dbRef',
            label: 'Database Reference',
            type: SchemaPropertyType.CONTROLLED_DATABASE,
            databaseId: db.id,
            repeated: false,
            required: true
          }
        ]
      );

      return db;
    }

    test('Accepts reference to a controlled database', async () => {
      const fixture = await setup();
      const db = await setupCollection(fixture);

      const dbRecord = requireSuccess(
        await fixture.assets.createAsset(fixture.archive, db.id, {
          accessControl: AccessControl.RESTRICTED,
          metadata: {
            title: ['My Database Record']
          }
        })
      );

      const res = await fixture.assets.createAsset(
        fixture.archive,
        fixture.assetCollection.id,
        {
          accessControl: AccessControl.RESTRICTED,
          metadata: {
            dbRef: [dbRecord.id]
          }
        }
      );

      expect(res.status).toBe('ok');
    });

    test('Rejects controlled database refs that are not in the linked database', async () => {
      const fixture = await setup();
      await setupCollection(fixture);

      const res = await fixture.assets.createAsset(
        fixture.archive,
        fixture.assetCollection.id,
        {
          accessControl: AccessControl.RESTRICTED,
          metadata: {
            dbRef: ['this is not a valid id']
          }
        }
      );

      expect(res.status).toBe('error');
    });
  });
});

async function setup() {
  const tmp = await getTempfiles();
  const archive = await getTempPackage(tmp());
  const service = new CollectionService();
  const media = new MediaFileService();
  const assets = new AssetService(service, media);
  const assetCollection = await service.getRootAssetCollection(archive);
  const dbCollection = await service.getRootDatabaseCollection(archive);

  return {
    archive,
    media,
    service,
    assets,
    dbCollection,
    assetCollection
  };
}
