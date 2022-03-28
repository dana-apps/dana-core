/** @jsxImportSource theme-ui */

import { FC } from 'react';
import { useParams } from 'react-router-dom';
import {
  IngestedAsset,
  ListIngestAssets
} from '../../common/ingest.interfaces';
import { required } from '../../common/util/assert';
import { useList } from '../ipc/ipc.hooks';
import {
  DataGrid,
  GridColumn,
  TextCell
} from '../ui/components/grid.component';

const GRID_COLUMNS: GridColumn<IngestedAsset>[] = [
  {
    id: 'title',
    getData: (x) => x.metadata.title,
    render: TextCell,
    label: 'Tilte'
  }
];

export const ArchiveIngestScreen: FC = () => {
  const sessionId = required(useParams().sessionId, 'Expected sessionId param');
  const data = useList(ListIngestAssets, () => ({ sessionId }), [sessionId]);
  if (!data) {
    return null;
  }

  return (
    <DataGrid
      sx={{ height: '100%', width: '100%' }}
      columns={GRID_COLUMNS}
      data={data}
    />
  );
};
