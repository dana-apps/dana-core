import { FC } from 'react';
import {
  Collection,
  GetSubcollections
} from '../../../common/asset.interfaces';
import { unwrapGetResult, useListAll } from '../../ipc/ipc.hooks';
import { NavListItem, NavListItemProps } from './page-layouts.component';

interface CollectionBrowserProps {
  parentId: string;
  itemProps?: (item: Collection) => Partial<NavListItemProps>;
}

export const CollectionBrowser: FC<CollectionBrowserProps> = ({
  parentId,
  itemProps
}) => {
  const assetCollections = unwrapGetResult(
    useListAll(GetSubcollections, () => ({ parent: parentId }), [parentId])
  );

  if (!assetCollections) {
    return null;
  }

  return (
    <>
      {assetCollections.map((collection) => (
        <NavListItem
          key={collection.id}
          title={collection.title}
          path={`/collection/${collection.id}`}
          {...itemProps?.(collection)}
        />
      ))}
    </>
  );
};
