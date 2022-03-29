/** @jsxImportSource theme-ui */

import { FC } from 'react';
import { useParams } from 'react-router-dom';
import {
  IngestPhase,
  IngestedAsset,
  ListIngestAssets
} from '../../common/ingest.interfaces';
import { required } from '../../common/util/assert';
import { useList } from '../ipc/ipc.hooks';
import { ProgressValue } from '../ui/components/atoms.component';
import { ProgressCell, TextCell } from '../ui/components/grid-cell.component';
import { DataGrid, GridColumn } from '../ui/components/grid.component';

/**
 * Screen for managing, editing and accepting a bulk import.
 */
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

/**
 * Placeholder column definitions for the imported assets data grid.
 */
const GRID_COLUMNS: GridColumn<IngestedAsset>[] = [
  {
    id: 'progress',
    getData: (x): ProgressValue => {
      if (x.phase === IngestPhase.ERROR) {
        return 'error';
      }
      if (x.phase === IngestPhase.COMPLETED) {
        return 1;
      }

      return undefined;
    },
    cell: ProgressCell,
    width: 36
  },
  {
    id: 'id',
    getData: (x) => x.id,
    cell: TextCell,
    label: 'Id'
  }
];
