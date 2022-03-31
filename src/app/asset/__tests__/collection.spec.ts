import { SchemaPropertyType } from '../../../common/asset.interfaces';
import { getTempfiles, getTempPackage } from '../../../test/tempfile';
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
          success: true
        },
        {
          id: 'myPoodle',
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
          metadata: { dogtype: 'Labrador' }
        },
        {
          id: 'myPoodle',
          metadata: { dogtype: 'Poodle' }
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
          success: true
        },
        {
          id: 'myPoodle',
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
});

async function setup() {
  const tmp = await getTempfiles();

  return {
    archive: await getTempPackage(tmp()),
    service: new CollectionService()
  };
}
