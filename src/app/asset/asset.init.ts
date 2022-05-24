import {
  GetRootAssetsCollection,
  GetRootDatabaseCollection,
  GetSubcollections,
  ListAssets,
  GetCollection,
  UpdateAssetMetadata,
  UpdateCollectionSchema,
  CreateCollection,
  UpdateCollection,
  CreateAsset,
  GetAsset,
  SearchAsset,
  DeleteAssets
} from '../../common/asset.interfaces';
import { ChangeEvent } from '../../common/resource';
import { ok, okIfExists } from '../../common/util/error';
import { ElectronRouter } from '../electron/router';
import { MediaFileService } from '../media/media-file.service';
import { AssetService } from './asset.service';
import { CollectionService } from './collection.service';

/**
 * Starts the asset-related application services and binds them to the frontend.
 *
 * @returns Service instances for managing assets.
 */
export function initAssets(router: ElectronRouter, media: MediaFileService) {
  const collectionService = new CollectionService();
  const assetService = new AssetService(collectionService, media);

  router.bindArchiveRpc(CreateAsset, (archive, { collection, ...props }) => {
    return assetService.createAsset(archive, collection, props);
  });

  router.bindArchiveRpc(ListAssets, async (archive, request, range) => {
    return ok(
      await assetService.listAssets(archive, request.collectionId, range)
    );
  });

  router.bindArchiveRpc(GetAsset, async (archive, request) => {
    return okIfExists(await assetService.get(archive, request.id));
  });

  router.bindArchiveRpc(SearchAsset, async (archive, request, range) => {
    return await assetService.searchAssets(
      archive,
      request.collection,
      { query: request.query },
      range
    );
  });

  router.bindArchiveRpc(
    UpdateAssetMetadata,
    (archive, { assetId, payload }) => {
      return assetService.updateAsset(archive, assetId, { metadata: payload });
    }
  );

  router.bindArchiveRpc(DeleteAssets, (archive, { assetIds }) => {
    return assetService.deleteAssets(archive, assetIds);
  });

  router.bindArchiveRpc(
    CreateCollection,
    async (archive, { parent, ...props }) =>
      ok(await collectionService.createCollection(archive, parent, props))
  );

  router.bindArchiveRpc(UpdateCollection, (archive, { id, ...props }) =>
    collectionService.updateCollection(archive, id, props)
  );

  router.bindArchiveRpc(GetRootAssetsCollection, async (archive) =>
    ok(await collectionService.getRootAssetCollection(archive))
  );

  router.bindArchiveRpc(GetRootDatabaseCollection, async (archive) =>
    ok(await collectionService.getRootDatabaseCollection(archive))
  );

  router.bindArchiveRpc(GetSubcollections, async (archive, request, range) =>
    ok(
      await collectionService.listSubcollections(archive, request.parent, range)
    )
  );

  router.bindArchiveRpc(GetCollection, async (archive, request) =>
    okIfExists(await collectionService.getCollection(archive, request.id))
  );

  router.bindArchiveRpc(UpdateCollectionSchema, async (archive, req) => {
    return collectionService.updateCollectionSchema(
      archive,
      req.collectionId,
      req.value
    );
  });

  assetService.on('change', ({ updated }) => {
    router.emit(ChangeEvent, {
      type: ListAssets.id,
      ids: []
    });

    router.emit(ChangeEvent, {
      type: GetAsset.id,
      ids: updated
    });
  });

  collectionService.on('change', ({ created, updated, deleted }) => {
    if (updated) {
      router.emit(ChangeEvent, { type: ListAssets.id, ids: [...updated] });
      router.emit(ChangeEvent, { type: GetCollection.id, ids: [...updated] });
      router.emit(ChangeEvent, {
        type: GetRootAssetsCollection.id,
        ids: [...updated]
      });
      router.emit(ChangeEvent, {
        type: GetRootDatabaseCollection.id,
        ids: [...updated]
      });
      router.emit(ChangeEvent, {
        type: GetSubcollections.id,
        ids: [...updated]
      });
    }

    if (created || deleted) {
      router.emit(ChangeEvent, {
        type: GetSubcollections.id,
        ids: [...(created ?? []), ...(deleted ?? [])]
      });
    }
  });

  return {
    assetService,
    collectionService
  };
}
