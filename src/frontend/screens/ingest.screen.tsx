/** @jsxImportSource theme-ui */

import { FC, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Flex, Text } from 'theme-ui';
import {
  Asset,
  GetCollection,
  SchemaProperty
} from '../../common/asset.interfaces';
import {
  IngestPhase,
  IngestedAsset,
  ListIngestAssets,
  CommitIngestSession,
  GetIngestSession,
  CancelIngestSession,
  UpdateIngestedMetadata
} from '../../common/ingest.interfaces';
import { required } from '../../common/util/assert';
import {
  iterateListCursor,
  SKIP_FETCH,
  unwrapGetResult,
  useGet,
  useList,
  useRPC
} from '../ipc/ipc.hooks';
import { ProgressValue } from '../ui/components/atoms.component';
import {
  MetadataItemCell,
  ProgressCell
} from '../ui/components/grid-cell.component';
import { DataGrid, GridColumn } from '../ui/components/grid.component';
import { PrimaryDetailLayout } from '../ui/components/page-layouts.component';
import { SelectionContext } from '../ui/hooks/selection.hooks';
import { BottomBar } from '../ui/components/page-layouts.component';
import {
  MetadataInspectorData,
  RecordInspector
} from '../ui/components/inspector.component';
import { useErrorDisplay } from '../ui/hooks/error.hooks';
import { mapValues } from 'lodash';

/**
 * Screen for managing, editing and accepting a bulk import.
 */
export const ArchiveIngestScreen: FC = () => {
  const rpc = useRPC();
  const errors = useErrorDisplay();

  const sessionId = required(useParams().sessionId, 'Expected sessionId param');
  const assets = useList(ListIngestAssets, () => ({ sessionId }), [sessionId]);
  const session = unwrapGetResult(useGet(GetIngestSession, sessionId));
  const collection = unwrapGetResult(
    useGet(GetCollection, session?.targetCollectionId ?? SKIP_FETCH)
  );
  const completeImport = useCompleteImport(sessionId, collection?.id);
  const cancelImport = useCancelImport(sessionId);
  const selection = SelectionContext.useContainer();
  const selectedAsset = useMemo(() => {
    if (selection.current && assets) {
      return Array.from(iterateListCursor(assets)).find(
        (x) => x && x.id === selection.current
      );
    }
  }, [assets, selection]);

  /** Update the metadata for an imported asset */
  const updateIngestedAsset = useCallback(
    async (change: MetadataInspectorData): Promise<undefined> => {
      if (!sessionId || !selectedAsset?.id) {
        return;
      }

      const metadata = { ...selectedAsset.metadata, ...change.metadata };

      const res = await rpc(UpdateIngestedMetadata, {
        assetId: selectedAsset.id,
        metadata: mapValues(metadata, (md) => md.rawValue),
        accessControl: change.accessControl ?? selectedAsset.accessControl,
        sessionId
      });

      errors.guard(res);
    },
    [errors, rpc, selectedAsset, sessionId]
  );

  const gridColumns = useMemo(() => {
    if (collection) {
      return getGridColumns(collection.schema);
    }

    return [];
  }, [collection]);

  if (!assets || !session || !collection) {
    return null;
  }
  1;

  const detailView =
    selectedAsset && collection ? (
      <RecordInspector
        hideRecordId
        sx={{ width: '100%', height: '100%' }}
        asset={selectedAsset}
        collection={collection}
        errors={selectedAsset.validationErrors ?? undefined}
        onCommitEdits={updateIngestedAsset}
      />
    ) : undefined;

  const allowComplete =
    session.valid && session.phase === IngestPhase.COMPLETED;

  return (
    <>
      <PrimaryDetailLayout
        sx={{ flex: 1, width: '100%', position: 'relative' }}
        detail={detailView}
      >
        <Flex sx={{ py: 5, px: 4, bg: 'gray1', flexDirection: 'column' }}>
          <Text sx={{ fontSize: 1 }}>
            Importing from <strong>{session.title}</strong> into{' '}
            <strong>{collection.title}</strong>
          </Text>
        </Flex>
        <DataGrid
          sx={{ flex: 1, width: '100%', borderTop: 'light' }}
          columns={gridColumns}
          data={assets}
        />

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
      </PrimaryDetailLayout>
    </>
  );
};

/**
 * Commit the import and navigate to the main collection.
 *
 * @param sessionId The import session to commit
 * @returns An event handler that commits the import.
 */
function useCompleteImport(
  sessionId: string,
  collectionId: string | undefined
) {
  const rpc = useRPC();
  const navigate = useNavigate();

  return useCallback(async () => {
    const result = await rpc(CommitIngestSession, { sessionId });
    if (result.status !== 'ok') {
      // TODO: Show error message
      return;
    }

    navigate(`/collection/${collectionId}`);

    return;
  }, [collectionId, navigate, rpc, sessionId]);
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
  const metadataColumns = schema.map((property): GridColumn<Asset> => {
    return {
      id: property.id,
      cell: MetadataItemCell,
      getData: (x) => x.metadata[property.id],
      label: property.label
    };
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
