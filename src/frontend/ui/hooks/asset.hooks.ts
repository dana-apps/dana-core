import { mapValues } from 'lodash';
import { useMemo } from 'react';
import {
  Asset,
  AssetMetadata,
  SingleValidationError,
  UpdateAssetMetadata
} from '../../../common/asset.interfaces';
import { WindowSize } from '../../../common/ui.interfaces';
import { useRPC } from '../../ipc/ipc.hooks';
import { useErrorDisplay } from './error.hooks';
import { useWindows } from './window.hooks';

export function useAssets(collectionId: string) {
  const errors = useErrorDisplay();
  const rpc = useRPC();
  const windows = useWindows();

  return useMemo(
    () => ({
      updateMetadata: async (
        asset: Asset,
        edits: AssetMetadata
      ): Promise<undefined | SingleValidationError> => {
        const metadata = { ...asset.metadata, ...edits };
        const res = await rpc(UpdateAssetMetadata, {
          assetId: asset.id,
          payload: mapValues(metadata, (item) => item.rawValue)
        });

        if (res.status === 'error') {
          if (typeof res.error === 'object') {
            return res.error;
          } else {
            errors.unexpected(res);
          }
        }
      },
      addNew: () => {
        windows.open({
          path: `/create-asset?collectionId=${collectionId}`,
          title: 'New Asset',
          size: WindowSize.NARROW
        });
      }
    }),
    [collectionId, errors, rpc, windows]
  );
}
