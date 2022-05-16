/** @jsxImportSource theme-ui */

import { AssetMetadataItem } from '../../../common/asset.interfaces';
import { ProgressIndicator, ProgressValue } from './atoms.component';
import { DataGridCell } from './grid.component';

/** Datagrid cell for free text */
export const TextCell: DataGridCell<string> = ({ value }) => (
  <>{presentationValue(value)}</>
);

TextCell.width = (data, fontSize) =>
  Math.max(
    100,
    Math.min(600, data ? presentationValue(data).length * fontSize * 0.4 : 300)
  );

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
  return <>{presentationValue(value)}</>;
};

ReferenceCell.width = (data, fontSize) =>
  Math.max(
    100,
    Math.min(600, data ? presentationValue(data).length * fontSize * 0.4 : 300)
  );

const presentationValue = (val?: AssetMetadataItem<unknown>) => {
  if (!val || val.presentationValue.length === 0) {
    return '-';
  }

  return val.presentationValue.map((x) => x.label).join('; ');
};
