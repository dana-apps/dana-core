import { mapValues } from 'lodash';
import { useMemo } from 'react';
import {
  Asset,
  AssetMetadata,
  SingleValidationError,
  UpdateAssetMetadata
} from '../../../common/asset.interfaces';
import { useRPC } from '../../ipc/ipc.hooks';
import { useErrorDisplay } from './error.hooks';

export function useAssets(_collectionId: string) {
  const errors = useErrorDisplay();
  const rpc = useRPC();

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
      createNewAsset: () => {
        // TODO
      }
    }),
    [errors, rpc]
  );
}
