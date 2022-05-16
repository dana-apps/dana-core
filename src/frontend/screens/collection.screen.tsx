/** @jsxImportSource theme-ui */

import { FC, useCallback, useMemo, useState } from 'react';
import {
  Asset,
  GetCollection,
  ListAssets,
  SchemaProperty
} from '../../common/asset.interfaces';
import { required } from '../../common/util/assert';
import {
  iterateListCursor,
  ListCursor,
  unwrapGetResult,
  useGet,
  useList
} from '../ipc/ipc.hooks';
import { DataGrid, GridColumn } from '../ui/components/grid.component';
import { AssetDetail } from '../ui/components/asset-detail.component';
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

/**
 * Screen for viewing the assets in a collection.
 */
export const CollectionScreen: FC = () => {
  const collectionId = required(
    useParams().collectionId,
    'Expected collectionId param'
  );
  const navigate = useNavigate();
  const collection = unwrapGetResult(useGet(GetCollection, collectionId));
  const fetchedAssets = useList(
    ListAssets,
    () => (collection ? { collectionId: collection.id } : 'skip'),
    [collection]
  );
  const selection = SelectionContext.useContainer();
  const [pendingAsset, setPendingAsset] = useState<Asset>();

  const assets = useMemo((): ListCursor<Asset> | undefined => {
    if (!fetchedAssets) {
      return;
    }

    if (!pendingAsset) {
      return fetchedAssets;
    }

    return {
      ...fetchedAssets,
      totalCount: fetchedAssets.totalCount + 1,
      get: (i) => (i === 0 ? pendingAsset : fetchedAssets.get(i - 1)),
      isLoaded: (i) => (i === 0 ? true : fetchedAssets.isLoaded(i - 1)),
      fetchMore: (start, end) =>
        fetchedAssets.fetchMore(Math.max(start - 1, 0), end - 1),
      setVisibleRange: (start, end) =>
        fetchedAssets.setVisibleRange(Math.max(start - 1, 0), end - 1)
    };
  }, [fetchedAssets, pendingAsset]);

  const newAsset = useCallback(() => {
    setPendingAsset({
      id: '$pending',
      title: '[New Item]',
      media: [],
      metadata: {}
    });
    selection.setSelection('$pending');
  }, [selection]);

  const onCancelCreateAsset = () => {
    setPendingAsset(undefined);
    selection.setSelection(undefined);
  };

  const onCreateAsset = (asset: Asset) => {
    setPendingAsset(undefined);
    selection.setSelection(asset.id);
  };

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

  if (!assets || !collection) {
    return null;
  }

  const detailView = selectedAsset ? (
    <AssetDetail
      sx={{ width: '100%', height: '100%' }}
      key={selectedAsset.id}
      collection={collection}
      asset={selectedAsset}
      action={selectedAsset.id === '$pending' ? 'create' : 'update'}
      onCancelCreate={onCancelCreateAsset}
      onCreate={onCreateAsset}
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
        />

        <BottomBar
          actions={
            <>
              <IconButton onClick={newAsset} aria-label="Add">
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
