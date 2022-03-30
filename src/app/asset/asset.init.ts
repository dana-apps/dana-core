import { ListAssets } from '../../common/asset.interfaces';
import { ChangeEvent } from '../../common/resource';
import { ok } from '../../common/util/error';
import { ElectronRouter } from '../electron/router';
import { AssetService } from './asset.service';
import { CollectionService } from './collection.service';

/**
 * Starts the asset-related application services and binds them to the frontend.
 *
 * @returns Service instances for managing assets.
 */
export function initAssets(router: ElectronRouter) {
  const collectionService = new CollectionService();
  const assetService = new AssetService(collectionService);

  router.bindArchiveRpc(
    ListAssets,
    async (archive, request, paginationToken) => {
      return ok(await assetService.listAssets(archive, paginationToken));
    }
  );

  assetService.on('change', ({ created }) => {
    router.emit(ChangeEvent, { type: ListAssets.id, ids: [...created] });
  });

  return {
    assetService
  };
}