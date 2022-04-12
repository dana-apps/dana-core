import {
  SchemaProperty,
  SchemaPropertyType
} from '../../../common/asset.interfaces';
import { requireSuccess } from '../../../test/result';
import { getTempfiles, getTempPackage } from '../../../test/tempfile';
import { MediaFileService } from '../../media/media-file.service';
import { AssetService } from '../asset.service';
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
  test('Creating and updating asset metadata replaces its metadata only with properties defined in the schema', async () => {
    const fixture = await setup();

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

    await fixture.service.updateAsset(fixture.archive, asset.id, {
      metadata: {
        requiredProperty: 'Replace'
      }
    });

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
