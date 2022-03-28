/** @jsxImportSource theme-ui */

import { FC } from 'react';
import { useParams } from 'react-router-dom';
import {
  ImportPhase,
  IngestedAsset,
  ListIngestAssets
} from '../../common/ingest.interfaces';
import { required } from '../../common/util/assert';
import { useList } from '../ipc/ipc.hooks';
import { LoadingCell } from '../ui/components/atoms.component';
import {
  DataGrid,
  GridColumn,
  TextCell
} from '../ui/components/grid.component';

const GRID_COLUMNS: GridColumn<IngestedAsset>[] = [
  {
    id: 'progress',
    getData: (x): { error?: string; progress?: number } => {
      if (x.phase === ImportPhase.ERROR) {
        return { error: ImportPhase.ERROR };
      }
      if (x.phase === ImportPhase.COMPLETED) {
        return { progress: 1 };
      }

      return { progress: -1 };
    },
    render: (x) => (
      <div
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <LoadingCell {...x} />
      </div>
    ),
    width: 36
  },
  {
    id: 'id',
    getData: (x) => x.id,
    render: TextCell,
    label: 'Id'
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
