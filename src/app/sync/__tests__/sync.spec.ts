import { mapValues, sortBy } from 'lodash';
import path from 'path';
import {
  SchemaProperty,
  SchemaPropertyType,
  defaultSchemaProperty,
  AccessControl,
  Collection,
  getRawAssetMetadata
} from '../../../common/asset.interfaces';
import { requireSuccess } from '../../../test/result';
import { getTempfiles, getTempPackage } from '../../../test/tempfile';
import { AssetService } from '../../asset/asset.service';
import { CollectionService } from '../../asset/collection.service';
import { someMetadata } from '../../asset/test-utils';
import { required } from '../../entry/lib';
import { MediaFile } from '../../media/media-file.entity';
import { MediaFileService } from '../../media/media-file.service';
import { SyncClient, SyncTransport } from '../sync-client.service';
import { SyncServer } from '../sync-server.service';

describe('Sync to cms', () => {
  test('Populates an empty remote archive', async () => {
    const { client, server, sync } = await setup();

    const assetA = await client.addAsset({ mediaFiles: [MEDIA_A] });
    const assetB = await client.addAsset({ mediaFiles: [MEDIA_B] });

    await sync();

    const serverAssets = await server.assets.listAssets(
      server.archive,
      server.rootCollection.id
    );

    expect(sortBy(serverAssets.items, 'id')).toEqual(
      sortBy([assetA, assetB], 'id')
    );
  });

  test('Propagates delta changes after initial sync', async () => {
    const { client, server, sync } = await setup();

    const assetA = await client.addAsset({ mediaFiles: [MEDIA_A] });
    const assetB = await client.addAsset({ mediaFiles: [MEDIA_B] });

    await sync();

    const assetANew = requireSuccess(
      await client.assets.updateAsset(client.archive, assetA.id, {
        metadata: getRawAssetMetadata(assetA.metadata)
      })
    );

    await client.assets.deleteAssets(client.archive, [assetB.id]);

    const assetC = await client.addAsset({ mediaFiles: [MEDIA_B] });

    await sync();

    const serverAssets = await server.assets.listAssets(
      server.archive,
      server.rootCollection.id
    );

    expect(sortBy(serverAssets.items, 'id')).toEqual(
      sortBy([assetANew, assetC], 'id')
    );
  });

  test('Respects access control settings when syncing to cms', async () => {
    const { client, server, sync } = await setup();

    const publicAsset = await client.addAsset({
      mediaFiles: [MEDIA_A],
      accessControl: AccessControl.PUBLIC
    });
    await client.addAsset({
      mediaFiles: [MEDIA_B],
      accessControl: AccessControl.RESTRICTED
    });
    const metadataOnlyAsset = await client.addAsset({
      mediaFiles: [MEDIA_B],
      accessControl: AccessControl.METADATA_ONLY
    });

    await sync();

    const serverAssets = await server.assets.listAssets(
      server.archive,
      server.rootCollection.id
    );

    expect(sortBy(serverAssets.items, 'id')).toEqual(
      sortBy([publicAsset, { ...metadataOnlyAsset, media: [] }], 'id')
    );
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
  const syncServer = new SyncServer(server.assets, server.mediaService);

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
  const archive = await getTempPackage(tmp(), {
    getCmsSyncConfig: async () => ({ auth: 'dummy', url: 'http://mycms.com' })
  });

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
    async addAsset(
      opts: {
        accessControl?: AccessControl;
        metadata?: Record<string, unknown[]>;
        mediaFiles?: string[];
        collection?: Collection;
      } = {}
    ) {
      const media: MediaFile[] = [];

      for (const m of opts.mediaFiles ?? []) {
        const mediaRes = requireSuccess(await mediaService.putFile(archive, m));
        media?.push(mediaRes);
      }

      const colllection = required(
        await collectionService.getCollection(
          archive,
          (opts.collection ?? rootCollection).id
        ),
        'Collection does not exist'
      );

      const metadata = {
        ...mapValues(someMetadata(colllection.schema), (x) => x.rawValue),
        ...opts.metadata
      };

      return requireSuccess(
        await assets.createAsset(archive, colllection.id, {
          accessControl: opts.accessControl ?? AccessControl.PUBLIC,
          redactedProperties: [],
          metadata,
          media
        })
      );
    },
    archive,
    collectionService,
    rootCollection,
    mediaService,
    assets
  };
}
