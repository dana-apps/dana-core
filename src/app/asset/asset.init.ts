import { ListAssets } from '../../common/asset.interfaces';
import { ChangeEvent } from '../../common/resource';
import { ok } from '../../common/util/error';
import { ElectronRouter } from '../electron/router';
import { AssetService } from './asset.service';

/**
 * Starts the asset-related application services and binds them to the frontend.
 *
 * @returns Service instances for managing assets.
 */
export function initAssets(router: ElectronRouter) {
  const assetService = new AssetService();

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
