/** @jsxImportSource theme-ui */

import { ProgressIndicator, ProgressValue } from './atoms.component';
import { DataGridCell } from './grid.component';

/** Datagrid cell for free text */
export const TextCell: DataGridCell<string> = ({ value }) => <>{value}</>;

TextCell.width = (data, fontSize) =>
  Math.max(100, Math.min(600, data ? data.length * (fontSize * 0.5) : 0));

/** Datagrid cell for indicating progress */
export const ProgressCell: DataGridCell<ProgressValue> = ({ value }) => (
  <div sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <ProgressIndicator value={value} />
  </div>
);

ProgressCell.width = 36;
