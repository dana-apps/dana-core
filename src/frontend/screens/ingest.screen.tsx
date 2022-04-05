/** @jsxImportSource theme-ui */

import { FC, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'theme-ui';
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
import { iterateListCursor, useGet, useList, useRPC } from '../ipc/ipc.hooks';
import { ProgressValue } from '../ui/components/atoms.component';
import { ProgressCell, TextCell } from '../ui/components/grid-cell.component';
import { DataGrid, GridColumn } from '../ui/components/grid.component';
import { MediaDetail } from '../ui/components/media-detail.component';
import { PrimaryDetailLayout } from '../ui/components/page-layouts.component';
import { SelectionContext } from '../ui/hooks/selection.hooks';
import { BottomBar } from '../ui/components/page-layouts.component';

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
  const selection = SelectionContext.useContainer();
  const selectedAsset = useMemo(() => {
    if (selection.current && assets) {
      return Array.from(iterateListCursor(assets)).find(
        (x) => x && x.id === selection.current
      );
    }
  }, [assets, selection]);

  const gridColumns = useMemo(() => {
    if (collection?.status === 'ok') {
      return getGridColumns(collection.value.schema);
    }

    return [];
  }, [collection]);

  if (!assets || !session) {
    return null;
  }

  const detailView = selectedAsset ? (
    <MediaDetail asset={selectedAsset} sx={{ width: '100%', height: '100%' }} />
  ) : undefined;

  const allowComplete =
    session.status === 'ok' &&
    session.value.valid &&
    session.value.phase === IngestPhase.COMPLETED;

  return (
    <>
      <PrimaryDetailLayout
        sx={{ flex: 1, width: '100%', position: 'relative' }}
        detail={detailView}
      >
        <DataGrid
          sx={{ flex: 1, width: '100%', height: '100%' }}
          columns={gridColumns}
          data={assets}
        />
      </PrimaryDetailLayout>

      <BottomBar
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
 *
 * @param sessionId The import session to commit
 * @returns An event handler that commits the import.
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
 * Cancel the import and navigate to another screen.
 *
 * @param sessionId The import session to cancel.
 * @returns An event handler that cancels the import.
 */
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

/**
 * Return grid cells for each property type defined in the schema, along with import-specific columns.
 *
 * @param schema The schema for this collection.
 * @returns An array of DataGrid columns for each property in the schma.
 */
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
        if (x.phase === IngestPhase.PROCESS_FILES) {
          return -1;
        }
        if (x.phase === IngestPhase.COMPLETED) {
          return 1;
        }

        return undefined;
      },
      cell: ProgressCell
    },
    ...metadataColumns
  ];
};
