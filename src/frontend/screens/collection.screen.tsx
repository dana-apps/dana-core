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
import { iterateListCursor, useGet, useList } from '../ipc/ipc.hooks';
import { TextCell } from '../ui/components/grid-cell.component';
import { DataGrid, GridColumn } from '../ui/components/grid.component';
import { MediaDetail } from '../ui/components/media-detail.component';
import { PrimaryDetailLayout } from '../ui/components/page-layouts.component';
import { SelectionContext } from '../ui/hooks/selection.hooks';

/**
 * Screen for viewing the assets in a collection.
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
    if (selection.current && assets) {
      return Array.from(iterateListCursor(assets)).find(
        (x) => x && x.id === selection.current
      );
    }
  }, [assets, selection]);

  if (!assets || !collection || collection.status !== 'ok') {
    return null;
  }

  const detailView = selectedAsset ? (
    <MediaDetail asset={selectedAsset} sx={{ width: '100%', height: '100%' }} />
  ) : undefined;

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
