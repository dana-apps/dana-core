import { FC } from 'react';
import { Select } from 'theme-ui';
import {
  GetRootDatabaseCollection,
  GetRootAssetsCollection,
  GetSubcollections
} from '../../../common/asset.interfaces';
import { unwrapGetResult, useGet, useListAll } from '../../ipc/ipc.hooks';

interface CollectionChooserProps {
  value?: string;
  onChange: (id: string) => void;
}

export const CollectionChooser: FC<CollectionChooserProps> = ({
  value,
  onChange,
  ...props
}) => {
  const assets = unwrapGetResult(useGet(GetRootAssetsCollection));
  const databaseRoot = unwrapGetResult(useGet(GetRootDatabaseCollection));

  if (!databaseRoot || !assets) {
    return null;
  }

  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      {...props}
    >
      <option value={assets.id}>{assets.title}</option>
      <CollectionGroup collectionId={databaseRoot.id} label="Databases" />
    </Select>
  );
};

const CollectionGroup: FC<{ collectionId: string; label: string }> = ({
  collectionId,
  label
}) => {
  const children = unwrapGetResult(
    useListAll(GetSubcollections, () => ({ parent: collectionId }), [
      collectionId
    ])
  );

  if (!children) {
    return null;
  }

  return (
    <optgroup label={label}>
      {children.map((child) => (
        <option value={child.id} key={child.id}>
          {child.title}
        </option>
      ))}
    </optgroup>
  );
};
