/** @jsxImportSource theme-ui */

import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GetAsset, GetCollection } from '../../common/asset.interfaces';
import { required } from '../../common/util/assert';
import { useGet } from '../ipc/ipc.hooks';
import { AssetDetail } from '../ui/components/asset-detail.component';
import {
  MetadataInspectorData,
  RecordInspector
} from '../ui/components/inspector.component';
import { PrimaryDetailLayout } from '../ui/components/page-layouts.component';
import { useAssets } from '../ui/hooks/asset.hooks';
import { useErrorDisplay } from '../ui/hooks/error.hooks';
import { WindowTitle } from '../ui/window';

export const AssetDetailScreen = () => {
  const [params] = useSearchParams();

  const assetId = required(params.get('assetId'), 'Missing asset id');

  const collectionId = required(
    params.get('collectionId'),
    'Missing collection id'
  );

  const errors = useErrorDisplay();
  const assetOps = useAssets(collectionId);

  const collection = errors.guard(useGet(GetCollection, collectionId));
  const asset = errors.guard(useGet(GetAsset, assetId));

  const handleEdit = useCallback(
    async (edits: MetadataInspectorData) => {
      if (asset) {
        return assetOps.updateMetadata(asset, edits);
      }
    },
    [asset, assetOps]
  );

  if (!collection || !asset) {
    return null;
  }

  const inspector = (
    <>
      <RecordInspector
        sx={{ width: '100%', height: '100%' }}
        collection={collection}
        asset={asset}
        onCommitEdits={handleEdit}
        editMedia
      />
    </>
  );

  return (
    <>
      <WindowTitle />
      <PrimaryDetailLayout
        sx={{ width: '100vw', height: '100vh' }}
        detail={inspector}
      >
        <AssetDetail sx={{ borderTop: 'light' }} asset={asset} />
      </PrimaryDetailLayout>
    </>
  );
};
