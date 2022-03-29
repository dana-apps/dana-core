import { AssetService } from './asset.service';

/**
 * Starts the asset-related application services and binds them to the frontend.
 *
 * @returns Service instances for managing assets.
 */
export function initAssets() {
  const assetService = new AssetService();

  return {
    assetService
  };
}
