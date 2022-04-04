import {
  GetRootCollection,
  ListAssets,
  UpdateCollectionSchema
} from '../../common/asset.interfaces';
import { ChangeEvent } from '../../common/resource';
import { ok } from '../../common/util/error';
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

  router.bindArchiveRpc(
    ListAssets,
    async (archive, request, paginationToken) => {
      return ok(await assetService.listAssets(archive, paginationToken));
    }
  );

  router.bindArchiveRpc(GetRootCollection, async (archive) =>
    ok(await collectionService.getRootCollection(archive))
  );

  router.bindArchiveRpc(UpdateCollectionSchema, async (archive, req) => {
    return collectionService.updateCollectionSchema(
      archive,
      req.collectionId,
      req.value
    );
  });

  assetService.on('change', ({ created }) => {
    router.emit(ChangeEvent, { type: ListAssets.id, ids: [...created] });
  });

  return {
    assetService,
    collectionService
  };
}
