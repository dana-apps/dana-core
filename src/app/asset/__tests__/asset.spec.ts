import {
  SchemaProperty,
  SchemaPropertyType
} from '../../../common/asset.interfaces';
import { collectEvents } from '../../../test/event';
import { requireSuccess } from '../../../test/result';
import { getTempfiles, getTempPackage } from '../../../test/tempfile';
import { MediaFileService } from '../../media/media-file.service';
import { AssetsChangedEvent, AssetService } from '../asset.service';
import { CollectionService } from '../collection.service';

const SCHEMA: SchemaProperty[] = [
  {
    id: 'optionalProperty',
    label: 'Optional Property',
    type: SchemaPropertyType.FREE_TEXT,
    required: false
  },
  {
    id: 'requiredProperty',
    label: 'Some Property',
    type: SchemaPropertyType.FREE_TEXT,
    required: true
  }
];

describe(AssetService, () => {
  test('Creating and updating asset metadata replaces its metadata only with properties defined in the schema and emits the correct events', async () => {
    const fixture = await setup();
    const createEvents = collectEvents<AssetsChangedEvent>(
      fixture.service,
      'change'
    );

    const asset = requireSuccess(
      await fixture.service.createAsset(
        fixture.archive,
        fixture.rootCollection.id,
        {
          metadata: {
            requiredProperty: '1',
            optionalProperty: '2',
            unknownProperty: 'No'
          }
        }
      )
    );

    expect(createEvents.events).toEqual([
      expect.objectContaining({
        created: [asset.id],
        updated: []
      })
    ]);

    expect(
      await fixture.service.listAssets(
        fixture.archive,
        fixture.rootCollection.id
      )
    ).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            metadata: {
              requiredProperty: '1',
              optionalProperty: '2'
            }
          })
        ]
      })
    );

    const updateEvents = collectEvents<AssetsChangedEvent>(
      fixture.service,
      'change'
    );

    await fixture.service.updateAsset(fixture.archive, asset.id, {
      metadata: {
        requiredProperty: 'Replace'
      }
    });

    expect(updateEvents.events).toEqual([
      expect.objectContaining({
        updated: [asset.id]
      })
    ]);

    expect(
      await fixture.service.listAssets(
        fixture.archive,
        fixture.rootCollection.id
      )
    ).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            metadata: {
              requiredProperty: 'Replace'
            }
          })
        ]
      })
    );
  });

  test('Create asset requests with invalid metadata are rejected', async () => {
    const fixture = await setup();

    const res = await fixture.service.createAsset(
      fixture.archive,
      fixture.rootCollection.id,
      {
        metadata: {}
      }
    );

    expect(res).toMatchObject({
      status: 'error',
      error: expect.objectContaining({
        requiredProperty: expect.any(Array)
      })
    });
  });

  test('Invalid updates to asset metadata are rejected', async () => {
    const fixture = await setup();

    const asset = requireSuccess(
      await fixture.service.createAsset(
        fixture.archive,
        fixture.rootCollection.id,
        {
          metadata: {
            requiredProperty: '1'
          }
        }
      )
    );

    const res = await fixture.service.updateAsset(fixture.archive, asset.id, {
      metadata: {}
    });

    expect(res).toMatchObject({
      status: 'error',
      error: expect.objectContaining({
        requiredProperty: expect.any(Array)
      })
    });
  });

  describe('casting properties', () => {
    describe('string properties', () => {
      test('non-strings are converted to strings', async () => {
        const fixture = await setup();
        const [property] = await fixture.givenTheSchema([
          {
            type: SchemaPropertyType.FREE_TEXT,
            id: 'dbRecord',
            label: 'Label',
            required: false
          }
        ]);

        const res = requireSuccess(
          await fixture.service.castOrCreateProperty(
            fixture.archive,
            property,
            123
          )
        );
        expect(res).toEqual('123');
      });

      test('blank values are treated as nulls', async () => {
        const fixture = await setup();
        const [property] = await fixture.givenTheSchema([
          {
            type: SchemaPropertyType.FREE_TEXT,
            id: 'dbRecord',
            label: 'Label',
            required: false
          }
        ]);

        const res = requireSuccess(
          await fixture.service.castOrCreateProperty(
            fixture.archive,
            property,
            ' '
          )
        );
        expect(res).toBeUndefined();
      });
    });

    describe('database references', () => {
      test('existing controlled database entries are referenced by label', async () => {
        const fixture = await setup();
        const db = await fixture.givenALabelRecordDatabase();
        const [property] = await fixture.givenTheSchema([
          {
            type: SchemaPropertyType.CONTROLLED_DATABASE,
            databaseId: db.id,
            id: 'dbRecord',
            label: 'Label',
            required: true
          }
        ]);

        const referencedAsset = requireSuccess(
          await fixture.service.createAsset(fixture.archive, db.id, {
            metadata: { title: 'Value' }
          })
        );

        const res = requireSuccess(
          await fixture.service.castOrCreateProperty(
            fixture.archive,
            property,
            'Value'
          )
        );
        const dbAssets = await fixture.service.listAssets(
          fixture.archive,
          db.id
        );
        expect(dbAssets.total).toBe(1);
        expect(res).toEqual(referencedAsset.id);
      });
    });

    test('where the target database supports it, controlled database entries are created on demand', async () => {
      const fixture = await setup();
      const db = await fixture.givenALabelRecordDatabase();
      const [property] = await fixture.givenTheSchema([
        {
          type: SchemaPropertyType.CONTROLLED_DATABASE,
          databaseId: db.id,
          id: 'dbRecord',
          label: 'Label',
          required: true
        }
      ]);

      const res = requireSuccess(
        await fixture.service.castOrCreateProperty(
          fixture.archive,
          property,
          'Value'
        )
      );
      const dbAssets = await fixture.service.listAssets(fixture.archive, db.id);
      expect(dbAssets.total).toBe(1);
      expect(res).toEqual(dbAssets.items[0].id);
    });

    test('blank values are treated as nulls', async () => {
      const fixture = await setup();
      const db = await fixture.givenALabelRecordDatabase();
      const [property] = await fixture.givenTheSchema([
        {
          type: SchemaPropertyType.CONTROLLED_DATABASE,
          databaseId: db.id,
          id: 'dbRecord',
          label: 'Label',
          required: true
        }
      ]);

      const res = requireSuccess(
        await fixture.service.castOrCreateProperty(
          fixture.archive,
          property,
          ' '
        )
      );
      const dbAssets = await fixture.service.listAssets(fixture.archive, db.id);
      expect(dbAssets.total).toBe(0);
      expect(res).toBeUndefined();
    });
  });
});

async function setup() {
  const tmp = await getTempfiles();
  const archive = await getTempPackage(tmp());

  const collectionService = new CollectionService();
  const mediaService = new MediaFileService();
  const service = new AssetService(collectionService, mediaService);
  const rootCollection = await collectionService.getRootAssetCollection(
    archive
  );
  const rootDbCollection = await collectionService.getRootDatabaseCollection(
    archive
  );
  await collectionService.updateCollectionSchema(
    archive,
    rootCollection.id,
    SCHEMA
  );

  return {
    givenTheSchema: async (schema: SchemaProperty[]) => {
      await collectionService.updateCollectionSchema(
        archive,
        rootCollection.id,
        schema
      );
      return schema;
    },
    givenAControlledDatabaseWithSchema: (schema: SchemaProperty[]) => {
      return collectionService.createCollection(archive, rootDbCollection.id, {
        title: 'Some Database',
        schema
      });
    },
    givenALabelRecordDatabase: () => {
      return collectionService.createCollection(archive, rootDbCollection.id, {
        title: 'Some Database',
        schema: [
          {
            id: 'title',
            type: SchemaPropertyType.FREE_TEXT,
            label: 'Title',
            required: true
          }
        ]
      });
    },
    archive,
    collectionService,
    rootCollection,
    mediaService,
    service
  };
}
