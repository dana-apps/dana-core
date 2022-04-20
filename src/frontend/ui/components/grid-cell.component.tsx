/** @jsxImportSource theme-ui */

import { GetAsset } from '../../../common/asset.interfaces';
import { SKIP_FETCH, unwrapGetResult, useGet } from '../../ipc/ipc.hooks';
import { ProgressIndicator, ProgressValue } from './atoms.component';
import { DataGridCell } from './grid.component';

/** Datagrid cell for free text */
export const TextCell: DataGridCell<string> = ({ value }) => (
  <>{value?.rawValue.join('; ')}</>
);

TextCell.width = (data, fontSize) =>
  Math.max(100, Math.min(600, data ? data.length * fontSize * 0.4 : 300));

/** Datagrid cell for indicating progress */
export const ProgressCell: DataGridCell<ProgressValue> = ({ value }) => {
  const percentVal = value?.rawValue[0];

  return (
    <div
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <ProgressIndicator value={percentVal} />
    </div>
  );
};

ProgressCell.width = 36;

/** Datagrid cell for database references */
export const ReferenceCell: DataGridCell<string> = ({ value }) => {
  const idReference = value?.rawValue[0];
  const asset = unwrapGetResult(useGet(GetAsset, idReference ?? SKIP_FETCH));

  if (!asset) {
    return null;
  }

  return <>{asset.title}</>;
};

ReferenceCell.width = (data, fontSize) =>
  Math.max(100, Math.min(600, data ? data.length * fontSize * 0.4 : 300));
