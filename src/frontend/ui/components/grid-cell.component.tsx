/** @jsxImportSource theme-ui */

import { AssetMetadataItem } from '../../../common/asset.interfaces';
import { ProgressIndicator, ProgressValue } from './atoms.component';
import { DataGridCell } from './grid.component';

/** Datagrid cell for raw strings */
export const StringCell: DataGridCell<string> = ({ value }) => <>{value}</>;

StringCell.width = (value, fontSize) => guessTextWidth(value, fontSize);

/** For any schema property, render its semicolon-delimited presentation value */
export const MetadataItemCell: DataGridCell<AssetMetadataItem> = ({
  value
}) => <>{presentationValue(value)}</>;

MetadataItemCell.width = (data, fontSize) =>
  guessTextWidth(presentationValue(data), fontSize);

/** Datagrid cell for indicating progress */
export const ProgressCell: DataGridCell<ProgressValue> = ({ value }) => {
  return (
    <div
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <ProgressIndicator value={value} />
    </div>
  );
};

ProgressCell.width = 36;

const presentationValue = (val?: AssetMetadataItem) => {
  if (!val || val.presentationValue.length === 0) {
    return '-';
  }

  return val.presentationValue.map((x) => x.label).join('; ');
};

export const guessTextWidth = (text: string | undefined, fontSize: number) => {
  return Math.max(36, Math.min(600, text ? text.length * fontSize * 0.8 : 500));
};
