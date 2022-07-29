import { mapValues } from 'lodash';
import { useMemo } from 'react';
import {
  AccessControl,
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
        edits: {
          metadata?: AssetMetadata;
          accessControl?: AccessControl;
          redactedProperties?: string[];
        }
      ): Promise<undefined | SingleValidationError> => {
        const metadata = edits.metadata && {
          ...asset.metadata,
          ...edits.metadata
        };
        const res = await rpc(UpdateAssetMetadata, {
          assetId: asset.id,
          accessControl: edits.accessControl,
          payload: mapValues(metadata, (item) => item.rawValue),
          redactedProperties: edits.redactedProperties
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
      },
      openDetailView: (asset: Asset) => {
        windows.open({
          path: `/asset-detail?collectionId=${collectionId}&assetId=${asset.id}`,
          title: asset.title
        });
      }
    }),
    [collectionId, errors, rpc, windows]
  );
}
