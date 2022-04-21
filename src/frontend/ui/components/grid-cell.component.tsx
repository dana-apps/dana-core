/** @jsxImportSource theme-ui */

import {
  GetAsset,
  GetCollection,
  GetRootAssetsCollection,
  GetRootDatabaseCollection,
  SchemaPropertyType
} from '../../../common/asset.interfaces';
import { assert } from '../../../common/util/assert';
import { SKIP_FETCH, unwrapGetResult, useGet } from '../../ipc/ipc.hooks';
import { ProgressIndicator, ProgressValue } from './atoms.component';
import { DataGridCell } from './grid.component';

/** Datagrid cell for free text */
export const TextCell: DataGridCell<string> = ({ value }) => <>{value}</>;

TextCell.width = (data, fontSize) =>
  Math.max(100, Math.min(600, data ? data.length * fontSize * 0.4 : 300));

/** Datagrid cell for indicating progress */
export const ProgressCell: DataGridCell<ProgressValue> = ({ value }) => (
  <div sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <ProgressIndicator value={value} />
  </div>
);

ProgressCell.width = 36;

/** Datagrid cell for database references */
export const ReferenceCell: DataGridCell<string> = ({ value, property }) => {
  const asset = unwrapGetResult(useGet(GetAsset, value));
  const collection = unwrapGetResult(useGet(GetRootAssetsCollection));
  const propertyValue = collection?.schema.find((x) => x.id === property);

  const dbId =
    propertyValue?.type == SchemaPropertyType.CONTROLLED_DATABASE
      ? propertyValue.databaseId
      : undefined;
  const dbSchema = unwrapGetResult(useGet(GetCollection, dbId ?? SKIP_FETCH));

  if (!dbSchema || !asset) {
    return null;
  }

  const titleProp = dbSchema.schema[0]?.id;

  return <>{asset.metadata[titleProp]}</>;
};

ReferenceCell.width = (data, fontSize) =>
  Math.max(100, Math.min(600, data ? data.length * fontSize * 0.4 : 300));
