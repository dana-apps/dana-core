import path from 'path';
import {
  SchemaProperty,
  SchemaPropertyType,
  defaultSchemaProperty,
  AccessControl
} from '../../../common/asset.interfaces';
import { requireSuccess } from '../../../test/result';
import { getTempfiles, getTempPackage } from '../../../test/tempfile';
import { AssetService } from '../../asset/asset.service';
import { CollectionService } from '../../asset/collection.service';
import { MediaFileService } from '../../media/media-file.service';
import { SyncClient, SyncTransport } from '../sync-client.service';
import { SyncServer } from '../sync-server.service';

describe('Sync to cms', () => {
  test('Syncs an archive to the cms', async () => {
    const fixture = await setup();

    const mediaA = requireSuccess(
      await fixture.client.mediaService.putFile(fixture.client.archive, MEDIA_A)
    );
    const mediaB = requireSuccess(
      await fixture.client.mediaService.putFile(fixture.client.archive, MEDIA_B)
    );

    await fixture.client.assets.createAsset(
      fixture.client.archive,
      fixture.client.rootCollection.id,
      {
        metadata: { requiredProperty: ['1'] },
        media: [mediaA],
        accessControl: AccessControl.PUBLIC
      }
    );
    await fixture.client.assets.createAsset(
      fixture.client.archive,
      fixture.client.rootCollection.id,
      {
        metadata: { requiredProperty: ['2'] },
        media: [mediaB],
        accessControl: AccessControl.PUBLIC
      }
    );

    await fixture.sync();
  });
});

const MEDIA_A = path.resolve(__dirname, './media/a.png');
const MEDIA_B = path.resolve(__dirname, './media/b.jpg');

const SCHEMA: SchemaProperty[] = [
  {
    ...defaultSchemaProperty(),
    id: 'optionalProperty',
    label: 'Optional Property',
    type: SchemaPropertyType.FREE_TEXT,
    repeated: false,
    required: false
  },
  {
    ...defaultSchemaProperty(),
    id: 'requiredProperty',
    label: 'Some Property',
    type: SchemaPropertyType.FREE_TEXT,
    repeated: false,
    required: true
  },
  {
    ...defaultSchemaProperty(),
    id: 'repeatedProperty',
    label: 'Some Property',
    type: SchemaPropertyType.FREE_TEXT,
    repeated: true,
    required: false
  }
];

async function setup() {
  const client = await setupInstance(SCHEMA);
  const server = await setupInstance();
  const syncServer = new SyncServer(server.mediaService);

  const transport: SyncTransport = {
    acceptAssets: (_, id, req) =>
      syncServer.acceptAssets(server.archive, id, req),
    acceptMedia: (_, id, req, { stream }) =>
      syncServer.acceptMedia(server.archive, id, req, stream),
    beginSync: (_, req) => syncServer.beginSync(server.archive, req),
    commit: (_, id) => syncServer.commit(server.archive, id)
  };

  const syncClient = new SyncClient(
    transport,
    client.collectionService,
    client.mediaService
  );

  return {
    client,
    server,
    sync: () => syncClient.sync(client.archive)
  };
}

async function setupInstance(schema?: SchemaProperty[]) {
  const tmp = await getTempfiles();
  const archive = await getTempPackage(tmp());

  const collectionService = new CollectionService();
  const mediaService = new MediaFileService();
  const assets = new AssetService(collectionService, mediaService);
  const rootCollection = await collectionService.getRootAssetCollection(
    archive
  );
  const rootDbCollection = await collectionService.getRootDatabaseCollection(
    archive
  );

  if (schema) {
    await collectionService.updateCollectionSchema(
      archive,
      rootCollection.id,
      schema
    );
  }

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
            ...defaultSchemaProperty(),
            id: 'title',
            type: SchemaPropertyType.FREE_TEXT,
            label: 'Title',
            required: true,
            repeated: false
          }
        ]
      });
    },
    archive,
    collectionService,
    rootCollection,
    mediaService,
    assets
  };
}
