/** @jsxImportSource theme-ui */

import { FC, useCallback, useMemo } from 'react';
import {
  Asset,
  AssetMetadata,
  DeleteAssets,
  GetCollection,
  ListAssets,
  SchemaProperty
} from '../../common/asset.interfaces';
import { required } from '../../common/util/assert';
import {
  iterateListCursor,
  unwrapGetResult,
  useGet,
  useList,
  useRPC
} from '../ipc/ipc.hooks';
import { DataGrid, GridColumn } from '../ui/components/grid.component';
import {
  BottomBar,
  PrimaryDetailLayout
} from '../ui/components/page-layouts.component';
import { SelectionContext } from '../ui/hooks/selection.hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { useContextMenu } from '../ui/hooks/menu.hooks';
import { IconButton } from 'theme-ui';
import { Gear, Plus } from 'react-bootstrap-icons';
import { MetadataItemCell } from '../ui/components/grid-cell.component';
import { useErrorDisplay } from '../ui/hooks/error.hooks';
import { useModal } from '../ui/hooks/window.hooks';
import { RecordInspector } from '../ui/components/inspector.component';
import { useAssets } from '../ui/hooks/asset.hooks';

/**
 * Screen for viewing the assets in a collection.
 */
export const CollectionScreen: FC = () => {
  const navigate = useNavigate();
  const selection = SelectionContext.useContainer();

  const collectionId = required(
    useParams().collectionId,
    'Expected collectionId param'
  );
  const collection = unwrapGetResult(useGet(GetCollection, collectionId));
  const assets = useList(
    ListAssets,
    () => (collection ? { collectionId: collection.id } : 'skip'),
    [collection]
  );

  const assetContextMenu = useAssetContextMenu();

  const configMenu = useContextMenu({
    on: 'click',
    options: [
      {
        id: 'editSchema',
        label: 'Edit Schema',
        action: () => {
          navigate(`/collection/${collectionId}/schema`);
        }
      }
    ]
  });

  const assetOps = useAssets(collectionId);
  const gridColumns = useMemo(() => {
    return collection ? getGridColumns(collection.schema) : [];
  }, [collection]);

  const selectedAsset = useMemo(() => {
    if (selection.current && assets) {
      return Array.from(iterateListCursor(assets)).find(
        (x) => x && x.id === selection.current
      );
    }
  }, [assets, selection]);

  const handleCommitEdits = useCallback(
    async (change: AssetMetadata) => {
      if (selectedAsset) {
        return assetOps.updateMetadata(selectedAsset, change);
      }

      return undefined;
    },
    [assetOps, selectedAsset]
  );

  if (!assets || !collection) {
    return null;
  }

  const detailView = selectedAsset ? (
    <RecordInspector
      sx={{ width: '100%', height: '100%' }}
      key={selectedAsset.id}
      collection={collection}
      asset={selectedAsset}
      onCommitEdits={handleCommitEdits}
      editMedia
    />
  ) : undefined;

  return (
    <>
      <PrimaryDetailLayout
        sx={{ flex: 1, width: '100%', position: 'relative' }}
        detail={detailView}
      >
        <DataGrid
          sx={{ flex: 1, width: '100%' }}
          columns={gridColumns}
          data={assets}
          contextMenuItems={assetContextMenu}
          onDoubleClickItem={assetOps.openDetailView}
        />

        <BottomBar
          actions={
            <>
              <IconButton onClick={assetOps.addNew} aria-label="Add">
                <Plus />
              </IconButton>
              <IconButton aria-label="Settings" {...configMenu.triggerProps}>
                <Gear />
              </IconButton>
            </>
          }
        />
      </PrimaryDetailLayout>
    </>
  );
};

/**
 * Return grid cells for each property type defined in the schema.
 *
 * @param schema The schema for this collection.
 * @returns An array of DataGrid columns for each property in the schma.
 */
const getGridColumns = (schema: SchemaProperty[]) =>
  schema.map((property): GridColumn<Asset> => {
    return {
      id: property.id,
      cell: MetadataItemCell,
      getData: (x) => x.metadata[property.id],
      label: property.label
    };
  });

const useAssetContextMenu = () => {
  const errorDisplay = useErrorDisplay();
  const rpc = useRPC();
  const modal = useModal();

  return useCallback(
    (assetIds: string[]) => [
      assetIds.length > 0 && {
        id: 'delete',
        label: 'Delete',
        action: async () => {
          const confirmed = await modal.confirm({
            title: 'Are you sure?',
            message: (
              <>
                <div style={{ paddingBottom: '0.5em' }}>
                  Are you sure you want to delete{' '}
                  {assetIds.length === 1 ? 'this record' : 'these records'}?
                </div>

                <div style={{ paddingBottom: '0.5em' }}>
                  Deleting a record is permanent. You won't be able to undo this
                  if you confirm.
                </div>
              </>
            ),
            confirmButtonLabel:
              assetIds.length > 1
                ? `Delete ${assetIds.length} records`
                : 'Delete record'
          });
          if (!confirmed) {
            return;
          }

          const res = await rpc(DeleteAssets, { assetIds });

          if (res.status === 'error') {
            if (typeof res.error === 'object') {
              errorDisplay(
                <>
                  <div sx={{ pb: 2 }}>
                    The records selected cannot be deleted right now due for the
                    following {res.error.length === 1 ? 'reason' : 'reasons'}:
                  </div>

                  <div style={{ userSelect: 'text', overflow: 'auto' }}>
                    <ul>
                      {res.error.map(
                        ({
                          assetId,
                          assetTitle,
                          collectionTitle,
                          propertyLabel,
                          propertyId
                        }) => {
                          const displayedTitle = assetTitle ? (
                            <>
                              Record <strong>{assetTitle}</strong>
                            </>
                          ) : (
                            'A record'
                          );

                          return (
                            <li key={assetId + '.' + propertyId}>
                              <div style={{ paddingBottom: '0.5em' }}>
                                {displayedTitle} in collection{' '}
                                <strong>{collectionTitle}</strong> has this
                                record as its <strong>{propertyLabel}</strong>{' '}
                                property.
                              </div>
                              <div style={{ paddingBottom: '0.5em' }}>
                                Deleting it would mean that{' '}
                                <strong>{propertyLabel}</strong> is blank, which
                                is not allowed by the schema.
                              </div>
                              <div style={{ paddingBottom: '0.5em' }}>
                                Either delete {displayedTitle} as well, or chage
                                its <strong>{propertyLabel}</strong> property to
                                something else.
                              </div>
                              (record id:{' '}
                              <code style={{ userSelect: 'all' }}>
                                {assetId}
                              </code>
                              )
                            </li>
                          );
                        }
                      )}
                    </ul>
                  </div>
                </>
              );
            } else {
              errorDisplay.unexpected(res.error);
            }

            return;
          }
        }
      }
    ],
    [errorDisplay, modal, rpc]
  );
};
