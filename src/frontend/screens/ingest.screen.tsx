/** @jsxImportSource theme-ui */

import { FC, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Flex } from 'theme-ui';
import {
  GetRootCollection,
  SchemaProperty,
  SchemaPropertyType
} from '../../common/asset.interfaces';
import {
  IngestPhase,
  IngestedAsset,
  ListIngestAssets,
  CommitIngestSession,
  GetIngestSession,
  CancelIngestSession
} from '../../common/ingest.interfaces';
import { never, required } from '../../common/util/assert';
import { useGet, useList, useRPC } from '../ipc/ipc.hooks';
import { ProgressValue } from '../ui/components/atoms.component';
import { ProgressCell, TextCell } from '../ui/components/grid-cell.component';
import { DataGrid, GridColumn } from '../ui/components/grid.component';
import { StatusBar } from '../ui/components/page-layouts.component';

/**
 * Screen for managing, editing and accepting a bulk import.
 */
export const ArchiveIngestScreen: FC = () => {
  const sessionId = required(useParams().sessionId, 'Expected sessionId param');
  const assets = useList(ListIngestAssets, () => ({ sessionId }), [sessionId]);
  const session = useGet(GetIngestSession, sessionId);
  const collection = useGet(GetRootCollection);
  const completeImport = useCompleteImport(sessionId);
  const cancelImport = useCancelImport(sessionId);

  const gridColumns = useMemo(() => {
    if (collection?.status === 'ok') {
      return getGridColumns(collection.value.schema);
    }

    return [];
  }, [collection]);

  if (!assets || !session) {
    return null;
  }

  const allowComplete =
    session.status === 'ok' &&
    session.value.valid &&
    session.value.phase === IngestPhase.COMPLETED;

  return (
    <>
      <DataGrid
        sx={{ flex: 1, width: '100%' }}
        columns={gridColumns}
        data={assets}
      />

      <StatusBar
        actions={
          <>
            <Button variant="primaryTransparent" onClick={cancelImport}>
              Cancel Import
            </Button>
            <Button disabled={!allowComplete} onClick={completeImport}>
              Complete Import
            </Button>
          </>
        }
      />
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

function useCancelImport(sessionId: string) {
  const rpc = useRPC();
  const navigate = useNavigate();

  return useCallback(async () => {
    const result = await rpc(CancelIngestSession, { sessionId });
    if (result.status !== 'ok') {
      // TODO: Show error message
      return;
    }

    navigate(`/`);

    return;
  }, [navigate, rpc, sessionId]);
}

const getGridColumns = (schema: SchemaProperty[]) => {
  const metadataColumns = schema.map((property): GridColumn<IngestedAsset> => {
    if (property.type === SchemaPropertyType.FREE_TEXT) {
      return {
        id: property.id,
        cell: TextCell,
        getData: (x) => x.metadata[property.id],
        label: property.label
      };
    }

    return never(property.type);
  });

  return [
    {
      id: '$progress',
      getData: (x: IngestedAsset): ProgressValue => {
        if (x.phase === IngestPhase.ERROR) {
          return 'error';
        }
        if (x.validationErrors) {
          return 'warning';
        }
        if (x.phase === IngestPhase.READ_FILES) {
          return -1;
        }
        if (x.phase === IngestPhase.COMPLETED) {
          return 1;
        }

        return undefined;
      },
      cell: ProgressCell,
      width: 36
    },
    ...metadataColumns
  ];
};
