/** @jsxImportSource theme-ui */

import { FC, useMemo } from 'react';
import {
  Asset,
  GetRootCollection,
  ListAssets,
  SchemaProperty,
  SchemaPropertyType
} from '../../common/asset.interfaces';
import { never } from '../../common/util/assert';
import { useGet, useList } from '../ipc/ipc.hooks';
import { TextCell } from '../ui/components/grid-cell.component';
import { DataGrid, GridColumn } from '../ui/components/grid.component';
import { MediaDetail } from '../ui/components/media-detail.component';
import { MasterDetail } from '../ui/components/page-layouts.component';
import { SelectionContext } from '../ui/hooks/selection.hooks';

/**
 * Screen for viewing assets.
 */
export const CollectionScreen: FC = () => {
  const assets = useList(ListAssets, () => ({}), []);
  const collection = useGet(GetRootCollection);
  const selection = SelectionContext.useContainer();

  const gridColumns = useMemo(() => {
    if (collection?.status === 'ok') {
      return getGridColumns(collection.value.schema);
    }

    return [];
  }, [collection]);

  const selectedAsset = useMemo(() => {
    if (selection.selection && assets?.items) {
      return assets.items.find((x) => x.id === selection.selection);
    }
  }, [assets, selection.selection]);

  if (!assets || !collection || collection.status !== 'ok') {
    return null;
  }

  const detailView = selectedAsset ? (
    <MediaDetail asset={selectedAsset} sx={{ width: '100%', height: '100%' }} />
  ) : undefined;

  return (
    <>
      <MasterDetail
        sx={{ flex: 1, width: '100%', position: 'relative' }}
        detail={detailView}
      >
        <DataGrid
          sx={{ flex: 1, width: '100%', height: '100%' }}
          columns={gridColumns}
          data={assets}
        />
      </MasterDetail>
    </>
  );
};

const getGridColumns = (schema: SchemaProperty[]) =>
  schema.map((property): GridColumn<Asset> => {
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
