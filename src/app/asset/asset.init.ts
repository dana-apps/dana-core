import { AssetService } from './asset.service';

export function initAssets() {
  const assetService = new AssetService();

  return {
    assetService
  };
}
