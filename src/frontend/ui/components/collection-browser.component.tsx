import { FC } from 'react';
import {
  Collection,
  GetSubcollections,
  MoveAssets,
  ValidateMoveAssets
} from '../../../common/asset.interfaces';
import { unwrapGetResult, useListAll, useRPC } from '../../ipc/ipc.hooks';
import { DropTarget } from './dnd.component';
import { NavListItem, NavListItemProps } from './page-layouts.component';

interface CollectionBrowserProps {
  parentId: string;
  itemProps?: (item: Collection) => Partial<NavListItemProps>;
}

export const CollectionBrowser: FC<CollectionBrowserProps> = ({
  parentId,
  itemProps
}) => {
  const rpc = useRPC();
  const assetCollections = unwrapGetResult(
    useListAll(GetSubcollections, () => ({ parent: parentId }), [parentId])
  );

  if (!assetCollections) {
    return null;
  }

  return (
    <>
      {assetCollections.map((collection) => (
        <DropTarget
          key={collection.id}
          types={{
            asset: {
              accept: async (assetId) => {
                return rpc(MoveAssets, {
                  assetIds: [assetId],
                  targetCollectionId: collection.id
                });
              },
              validateDrop: async (assetId) => {
                const result = await rpc(ValidateMoveAssets, {
                  assetIds: [assetId],
                  targetCollectionId: collection.id
                });
                return result.status === 'ok';
              }
            }
          }}
        >
          <NavListItem
            title={collection.title}
            path={`/collection/${collection.id}`}
            {...itemProps?.(collection)}
          />
        </DropTarget>
      ))}
    </>
  );
};
