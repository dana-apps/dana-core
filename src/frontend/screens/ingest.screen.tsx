/** @jsxImportSource theme-ui */

import { FC, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Flex } from 'theme-ui';
import {
  IngestPhase,
  IngestedAsset,
  ListIngestAssets,
  CommitIngestSession
} from '../../common/ingest.interfaces';
import { required } from '../../common/util/assert';
import { useList, useRPC } from '../ipc/ipc.hooks';
import { ProgressValue } from '../ui/components/atoms.component';
import { ProgressCell, TextCell } from '../ui/components/grid-cell.component';
import { DataGrid, GridColumn } from '../ui/components/grid.component';

/**
 * Screen for managing, editing and accepting a bulk import.
 */
export const ArchiveIngestScreen: FC = () => {
  const sessionId = required(useParams().sessionId, 'Expected sessionId param');
  const data = useList(ListIngestAssets, () => ({ sessionId }), [sessionId]);
  const completeImport = useCompleteImport(sessionId);

  if (!data) {
    return null;
  }

  return (
    <>
      <DataGrid
        sx={{ flex: 1, width: '100%' }}
        columns={GRID_COLUMNS}
        data={data}
      />

      <Flex
        sx={{
          padding: 4,
          bg: 'gray1',
          borderTop: 'primary',
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'baseline'
        }}
      >
        <Button onClick={completeImport}>Complete Import</Button>
      </Flex>
    </>
  );
};

/**
 * Commit the import and navigate to the main collection.
 */
function useCompleteImport(sessionId: string) {
  const rpc = useRPC();
  const navigate = useNavigate();

  return useCallback(async () => {
    const result = await rpc(CommitIngestSession, { sessionId });
    if (result.status !== 'ok') {
      // TODO: Show error message
      return;
    }

    navigate(`/collection`);

    return;
  }, [navigate, rpc, sessionId]);
}

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
