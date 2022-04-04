import { SchemaPropertyType } from '../../../common/asset.interfaces';
import { requireSuccess } from '../../../test/result';
import { getTempfiles, getTempPackage } from '../../../test/tempfile';
import { AssetService } from '../asset.service';
import { CollectionService } from '../collection.service';

describe(CollectionService, () => {
  test('supports getting the root collection', async () => {
    const fixture = await setup();

    expect(await fixture.service.getRootCollection(fixture.archive)).toEqual(
      await fixture.service.getRootCollection(fixture.archive)
    );
  });

  test('supports defining a schema and validating a list of objects for the collection', async () => {
    const fixture = await setup();
    const root = await fixture.service.getRootCollection(fixture.archive);

    await fixture.service.updateCollectionSchema(fixture.archive, root.id, [
      {
        id: 'dogtype',
        label: 'Dog Type',
        required: true,
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
            dogtype: 'Labrador'
          }
        },
        {
          id: 'myPoodle',
          metadata: {
            dogtype: 'Poodle'
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
          metadata: { dogtype: 'Labrador' },
          success: true
        },
        {
          id: 'myPoodle',
          metadata: { dogtype: 'Poodle' },
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

  test('altering the schema validates it against the existing archive', async () => {
    const fixture = await setup();
    const root = await fixture.service.getRootCollection(fixture.archive);

    requireSuccess(
      await fixture.service.updateCollectionSchema(fixture.archive, root.id, [
        {
          id: 'dogtype',
          label: 'Dog Type',
          required: false,
          type: SchemaPropertyType.FREE_TEXT
        }
      ])
    );

    const testAsset = requireSuccess(
      await fixture.assets.createAsset(fixture.archive, root.id, {
        metadata: {}
      })
    );

    const resultMissingValue = await fixture.service.updateCollectionSchema(
      fixture.archive,
      root.id,
      [
        {
          id: 'dogtype',
          label: 'Dog Type',
          required: true,
          type: SchemaPropertyType.FREE_TEXT
        }
      ]
    );
    expect(resultMissingValue.status).toEqual('error');

    requireSuccess(
      await fixture.assets.updateAsset(fixture.archive, testAsset.id, {
        metadata: { dogtype: 'Husky' }
      })
    );

    const resultWithValue = await fixture.service.updateCollectionSchema(
      fixture.archive,
      root.id,
      [
        {
          id: 'dogtype',
          label: 'Dog Type',
          required: true,
          type: SchemaPropertyType.FREE_TEXT
        }
      ]
    );
    expect(resultWithValue.status).toEqual('ok');
  });
});

async function setup() {
  const tmp = await getTempfiles();
  const service = new CollectionService();
  const assets = new AssetService(service);

  return {
    archive: await getTempPackage(tmp()),
    service,
    assets
  };
}
