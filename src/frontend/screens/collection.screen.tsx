/** @jsxImportSource theme-ui */

import { FC, useMemo } from 'react';
import {
  Asset,
  GetCollection,
  ListAssets,
  SchemaProperty,
  SchemaPropertyType
} from '../../common/asset.interfaces';
import { never, required } from '../../common/util/assert';
import {
  iterateListCursor,
  unwrapGetResult,
  useGet,
  useList
} from '../ipc/ipc.hooks';
import { ReferenceCell, TextCell } from '../ui/components/grid-cell.component';
import { DataGrid, GridColumn } from '../ui/components/grid.component';
import { AssetDetail } from '../ui/components/asset-detail.component';
import { PrimaryDetailLayout } from '../ui/components/page-layouts.component';
import { SelectionContext } from '../ui/hooks/selection.hooks';
import { useParams } from 'react-router-dom';

/**
 * Screen for viewing the assets in a collection.
 */
export const CollectionScreen: FC = () => {
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
  const selection = SelectionContext.useContainer();

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
      asset={selectedAsset}
      schema={collection.schema}
    />
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
    if (property.type === SchemaPropertyType.CONTROLLED_DATABASE) {
      return {
        id: property.id,
        cell: ReferenceCell,
        getData: (x) => x.metadata[property.id],
        label: property.label
      };
    }

    return never(property);
  });
