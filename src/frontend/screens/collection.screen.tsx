/** @jsxImportSource theme-ui */

import { FC } from 'react';
import { Asset, ListAssets } from '../../common/asset.interfaces';
import { useList } from '../ipc/ipc.hooks';
import { TextCell } from '../ui/components/grid-cell.component';
import { DataGrid, GridColumn } from '../ui/components/grid.component';

/**
 * Screen for viewing assets.
 */
export const CollectionScreen: FC = () => {
  const data = useList(ListAssets, () => ({}), []);

  if (!data) {
    return null;
  }

  return (
    <DataGrid
      sx={{ flex: 1, width: '100%' }}
      columns={GRID_COLUMNS}
      data={data}
    />
  );
};

/**
 * Placeholder column definitions for the imported assets data grid.
 */
const GRID_COLUMNS: GridColumn<Asset>[] = [
  {
    id: 'id',
    getData: (x) => x.id,
    cell: TextCell,
    label: 'Id'
  }
];
