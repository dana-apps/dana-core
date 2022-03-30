/** @jsxImportSource theme-ui */

import { FC, useCallback, useMemo, useRef } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import Loader from 'react-window-infinite-loader';
import {
  GridChildComponentProps,
  VariableSizeGrid as Grid
} from 'react-window';
import { Box, BoxProps, useThemeUI } from 'theme-ui';

import { Resource } from '../../../common/resource';
import { ListCursor } from '../../ipc/ipc.hooks';
import { last, sumBy } from 'lodash';
import { useEventEmitter } from '../hooks/state.hooks';

export interface DataGridProps<T extends Resource> extends BoxProps {
  /** Data to present */
  data: ListCursor<T>;

  /** Specification of the grid columns */
  columns: GridColumn<T>[];

  /** Font size used to size grid rows and set their inner font size */
  fontSize?: number;
}

/**
 * Spreadsheet-style virtualized datagrid component.
 *
 * Suitable for displaying 1000s of rows.
 */
export function DataGrid<T extends Resource>({
  data,
  columns,
  fontSize: fontSizeParam = 1,
  ...props
}: DataGridProps<T>) {
  const { theme } = useThemeUI();

  const fontSize = Number(theme.fontSizes?.[fontSizeParam]) ?? 13;
  const padding = Number(theme.space?.[2]) ?? 3;
  const rowHeight = 2 * padding + fontSize;

  const isItemLoaded = useCallback(
    (index: number) => index < data.items.length - 1,
    [data]
  );

  const dataVal = useMemo(
    (): CellData<T> => ({ rows: data.items, columns }),
    [data, columns]
  );

  const headerRef = useRef<HTMLDivElement | null>(null);
  const loaderRef = useRef<Loader | null>(null);

  useEventEmitter(data.events, 'change', () => {
    loaderRef.current?.resetloadMoreItemsCache();
  });

  return (
    <Box sx={{ fontSize: 0, position: 'relative', minHeight: 0 }} {...props}>
      <AutoSizer>
        {({ height, width }) => {
          const availableWidth = width - sumBy(columns, (c) => c.width ?? 0);
          const flexColumns = columns.filter(
            (c) => typeof c.width === 'undefined'
          );
          const defaultWidth = Math.max(
            200,
            Math.floor(availableWidth / flexColumns.length)
          );
          const columnOffsets = columns.reduce(
            (prev: number[], x) => [
              ...prev,
              (last(prev) ?? 0) + (x.width ?? defaultWidth)
            ],
            []
          );

          return (
            <>
              <div
                ref={headerRef}
                sx={{
                  position: 'absolute',
                  willChange: 'transform',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: rowHeight,
                  borderBottom: '1px solid var(--theme-ui-colors-border)',
                  zIndex: 2,
                  fontWeight: 700
                }}
              >
                {columns.map((col, i) => (
                  <div
                    key={col.id}
                    sx={{
                      width: col.width ?? defaultWidth,
                      position: 'absolute',
                      borderRight: '1px solid var(--theme-ui-colors-border)',
                      left: columnOffsets[i - 1] ?? 0,
                      textAlign: 'center',
                      top: rowHeight / 2,
                      transform: 'translateY(-50%)'
                    }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>

              <Loader
                ref={loaderRef}
                isItemLoaded={isItemLoaded}
                loadMoreItems={data.fetchMore}
                itemCount={data.totalCount}
              >
                {({ onItemsRendered, ref }) => (
                  <div sx={{ position: 'absolute', top: rowHeight }}>
                    <Grid<CellData<T>>
                      ref={ref}
                      height={height - rowHeight}
                      columnWidth={(i) => columns[i].width ?? defaultWidth}
                      onScroll={({ scrollLeft }) => {
                        if (headerRef.current) {
                          headerRef.current.style.transform = `translateX(-${scrollLeft}px)`;
                        }
                      }}
                      rowCount={data.totalCount}
                      columnCount={columns.length}
                      rowHeight={() => rowHeight}
                      itemData={dataVal}
                      onItemsRendered={(props) => {
                        onItemsRendered({
                          overscanStartIndex: props.overscanRowStartIndex,
                          overscanStopIndex: props.overscanRowStopIndex,
                          visibleStartIndex: props.visibleRowStartIndex,
                          visibleStopIndex: props.visibleRowStopIndex
                        });
                      }}
                      width={width}
                    >
                      {CellWrapper}
                    </Grid>
                  </div>
                )}
              </Loader>
            </>
          );
        }}
      </AutoSizer>
    </Box>
  );
}

/**
 * Specify data access and presentation for a grid row.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GridColumn<T extends Resource = Resource, Val = any> {
  /** Unique id of the column */
  id: string;

  /** Title of the column. If not given, the column will have no title */
  label?: string;

  /** Title of the column. If not given, the column will have no title */
  getData: (x: T) => Val;

  /** Presentation component for the cell */
  cell: DataGridCell<Val>;

  /** Explicit size for the cell in pixels. If not provided, will be auto-sized by the view */
  width?: number;
}

/** Presentation component for a datagrid */
export type DataGridCell<Val = unknown> = FC<{ value: Val }>;

/**
 * Internal. Extract cell data from context and render using the cell component.
 */
function CellWrapper<T extends Resource>({
  data: { rows, columns },
  style,
  columnIndex,
  rowIndex
}: GridChildComponentProps<CellData<T>>) {
  const colData = rows[rowIndex];
  const column = columns[columnIndex];
  const sx = {
    bg: rowIndex % 2 === 0 ? 'background' : 'foreground',
    py: 1,
    px: 2,
    height: '100%',
    '&:not:first-of-type': {
      borderLeft: '1px solid var(--theme-ui-colors-border)'
    }
  };

  if (!colData) {
    return <div sx={sx} style={style} />;
  }

  return (
    <div sx={sx} style={style}>
      <column.cell value={column.getData(colData)} />
    </div>
  );
}

/** Data and context for grid cells */
interface CellData<T extends Resource> {
  rows: T[];
  columns: GridColumn<T>[];
}
