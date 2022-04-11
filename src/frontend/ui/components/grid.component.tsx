/** @jsxImportSource theme-ui */

import { FC, KeyboardEvent, useCallback, useMemo, useRef } from 'react';
import AutoSizer, { Size } from 'react-virtualized-auto-sizer';
import Loader from 'react-window-infinite-loader';
import {
  GridChildComponentProps,
  VariableSizeGrid as Grid
} from 'react-window';
import { Box, BoxProps, useThemeUI } from 'theme-ui';

import { Resource } from '../../../common/resource';
import { iterateListCursor, ListCursor } from '../../ipc/ipc.hooks';
import { compact, last, meanBy } from 'lodash';
import { useEventEmitter } from '../hooks/state.hooks';
import { SelectionContext } from '../hooks/selection.hooks';
import { PageRange } from '../../../common/ipc.interfaces';
import { take } from 'streaming-iterables';

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
  const selection = SelectionContext.useContainer();

  const fontSize = Number(theme.fontSizes?.[fontSizeParam]) ?? 13;
  const padding = Number(theme.space?.[2]) ?? 3;
  const rowHeight = 2 * padding + fontSize;

  const dataVal = useMemo(
    (): CellData<T> => ({ cursor: data, columns }),
    [data, columns]
  );

  // Calculate widths for each of the columns based on an initial sample of the data
  const columnWidths = useMemo(() => {
    if (!data) {
      return;
    }

    const dataSample = compact(Array.from(take(25, iterateListCursor(data))));

    return columns.map((col) => {
      const { width } = col.cell;
      if (typeof width === 'undefined') {
        return 100;
      }

      if (typeof width === 'function') {
        return meanBy(dataSample, (x) => width(col.getData(x), fontSize));
      }

      return width;
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data, columns, fontSize]);

  const headerRef = useRef<HTMLDivElement | null>(null);
  const loaderRef = useRef<Loader | null>(null);
  const innerListRef = useRef<HTMLElement | null>();
  const outerListRef = useRef<HTMLElement | null>();
  const viewSize = useRef<Size>();
  const visibleRange = useRef<PageRange>({ offset: 0, limit: 0 });
  const gridRef = useRef<Grid | null>(null);

  useEventEmitter(data.events, 'change', () => {
    loaderRef.current?.resetloadMoreItemsCache(true);
  });

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<unknown>) => {
      const findIndex = () =>
        Array.from(iterateListCursor(data)).findIndex(
          (x) => x && x.id === selection.current
        );

      if (event.key == 'ArrowUp') {
        const index = findIndex() - 1;
        const next = data.get(index);

        if (next) {
          selection.setSelection(next.id);

          gridRef.current?.scrollToItem({
            rowIndex: index - 1
          });
        }
      } else if (event.key === 'ArrowDown') {
        const index = findIndex() + 1;
        const next = data.get(index);

        if (next) {
          selection.setSelection(next.id);

          gridRef.current?.scrollToItem({
            rowIndex: index + 1
          });
        }
      } else if (event.key === 'PageUp') {
        gridRef.current?.scrollToItem({
          rowIndex: visibleRange.current.offset - visibleRange.current.limit,
          align: 'start'
        });
      } else if (event.key === 'PageDown') {
        gridRef.current?.scrollToItem({
          rowIndex: visibleRange.current.offset + visibleRange.current.limit,
          align: 'start'
        });
      } else if (event.key === 'Home') {
        gridRef.current?.scrollToItem({
          rowIndex: 0,
          align: 'start'
        });
      } else if (event.key === 'End') {
        gridRef.current?.scrollToItem({
          rowIndex: data.totalCount - 1,
          align: 'end'
        });
      }
    },
    [data, selection]
  );

  return (
    <Box
      sx={{ fontSize: 0, position: 'relative', minHeight: 0, outline: 'none' }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <AutoSizer
        onResize={(size) => {
          viewSize.current = size;
        }}
      >
        {({ height, width }) => {
          if (!columnWidths) {
            return null;
          }

          const columnOffsets = columnWidths.reduce(
            (prev: number[], x) => [...prev, (last(prev) ?? 0) + x],
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
                  width,
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
                      width: columnWidths[i],
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
                isItemLoaded={data.isLoaded}
                loadMoreItems={data.fetchMore}
                itemCount={data.totalCount}
              >
                {({ onItemsRendered, ref }) => (
                  <div sx={{ position: 'absolute', top: rowHeight }}>
                    <Grid<CellData<T>>
                      ref={(grid) => {
                        ref(grid);
                        gridRef.current = grid;
                      }}
                      height={height - rowHeight}
                      columnWidth={(i) => columnWidths[i]}
                      onScroll={({ scrollLeft }) => {
                        if (headerRef.current) {
                          headerRef.current.style.transform = `translateX(-${scrollLeft}px)`;
                        }
                      }}
                      rowCount={data.totalCount}
                      columnCount={columns.length}
                      rowHeight={() => rowHeight}
                      itemData={dataVal}
                      outerRef={outerListRef}
                      innerRef={innerListRef}
                      onItemsRendered={(props) => {
                        data.setVisibleRange(
                          props.overscanRowStartIndex,
                          props.overscanRowStopIndex
                        );

                        visibleRange.current = {
                          offset: props.visibleRowStartIndex,
                          limit:
                            props.visibleRowStopIndex -
                            props.visibleRowStartIndex
                        };

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
}

/** Presentation component for a datagrid */
export type DataGridCell<Val = unknown> = FC<{ value: Val }> & {
  /**
   * Explicit size for the cell in pixels. If not provided, will be auto-sized by the view.
   *
   * Provieding a function will cause the size to be estimated based on a sample of the grid data.
   **/
  width?: number | ((val: Val | undefined, fontSize: number) => number);
};

/**
 * Internal. Extract cell data from context and render using the cell component.
 */
function CellWrapper<T extends Resource>({
  data: { cursor, columns },
  style,
  columnIndex,
  rowIndex
}: GridChildComponentProps<CellData<T>>) {
  const { current: selection, setSelection } = SelectionContext.useContainer();
  const colData = cursor.get(rowIndex);
  const column = columns[columnIndex];
  const plainBg = rowIndex % 2 === 0 ? 'background' : 'foreground';
  const selected = selection && selection === colData?.id;

  const sx = {
    bg: selected ? 'primary' : plainBg,
    color: selected ? 'primaryContrast' : undefined,
    overflow: 'hidden',
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
    <div sx={sx} style={style} onClick={() => setSelection(colData.id)}>
      <column.cell value={column.getData(colData)} />
    </div>
  );
}

/** Data and context for grid cells */
interface CellData<T extends Resource> {
  cursor: ListCursor<T>;
  columns: GridColumn<T>[];
}
