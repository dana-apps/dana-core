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

    expect(createEvents).toEqual([
      expect.objectContaining({
        created: [asset.id]
      })
    ]);

    expect(await fixture.service.listAssets(fixture.archive)).toEqual(
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

    expect(updateEvents).toEqual([
      expect.objectContaining({
        updated: [asset.id]
      })
    ]);

    expect(await fixture.service.listAssets(fixture.archive)).toEqual(
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
});

async function setup() {
  const tmp = await getTempfiles();
  const archive = await getTempPackage(tmp());

  const collectionService = new CollectionService();
  const mediaService = new MediaFileService();
  const service = new AssetService(collectionService, mediaService);
  const rootCollection = await collectionService.getRootCollection(archive);
  await collectionService.updateCollectionSchema(
    archive,
    rootCollection.id,
    SCHEMA
  );

  return {
    archive,
    collectionService,
    rootCollection,
    mediaService,
    service
  };
}
