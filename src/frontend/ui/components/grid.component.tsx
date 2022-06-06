/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsxImportSource theme-ui */

import {
  createContext,
  FC,
  forwardRef,
  HTMLAttributes,
  KeyboardEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { take } from 'streaming-iterables';
import produce from 'immer';
import AutoSizer from 'react-virtualized-auto-sizer';
import Loader from 'react-window-infinite-loader';
import { ListChildComponentProps, FixedSizeList } from 'react-window';
import { Box, BoxProps, ThemeUIStyleObject, useThemeUI } from 'theme-ui';

import { Resource } from '../../../common/resource';
import { iterateListCursor, ListCursor } from '../../ipc/ipc.hooks';
import { compact, last, max, noop, sum } from 'lodash';
import { useEventEmitter } from '../hooks/state.hooks';
import { SelectionContext } from '../hooks/selection.hooks';
import { PageRange } from '../../../common/ipc.interfaces';
import { guessTextWidth } from './grid-cell.component';
import { ContextMenuChoice, useContextMenu } from '../hooks/menu.hooks';

export interface DataGridProps<T extends Resource> extends BoxProps {
  /** Data to present */
  data: ListCursor<T>;

  /** Specification of the grid columns */
  columns: GridColumn<T, any>[];

  /** Font size used to size grid rows and set their inner font size */
  fontSize?: number;

  /** If provided, menu items to display in the context menu */
  contextMenuItems?: (targets: string[]) => ContextMenuChoice[];

  /** If provided, menu items to display in the context menu */
  onDoubleClickItem?: (item: T) => void;
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
  contextMenuItems,
  onDoubleClickItem,
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

  const [columnSizes, setColumnSizes] = useState<number[]>();

  // Calculate widths for each of the columns based on an initial sample of the data
  useEffect(() => {
    if (!data) {
      return;
    }

    setColumnSizes((prev) => {
      if (prev) {
        return prev;
      }

      const dataSample = compact(Array.from(take(25, iterateListCursor(data))));

      return columns.map((col) => {
        const { width } = col.cell;
        if (typeof width === 'undefined') {
          return 100;
        }

        if (typeof width === 'function') {
          return (
            max([
              guessTextWidth(col.label, fontSize),
              ...dataSample.map((x) => width(col.getData(x), fontSize))
            ]) ?? 100
          );
        }

        return width;
      });
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data, columns, fontSize]);

  const columnOffsets = useMemo(
    () =>
      columnSizes?.reduce((prev, x) => [...prev, (last(prev) ?? 0) + x], [0]),
    [columnSizes]
  );

  const loaderRef = useRef<Loader | null>(null);
  const innerListRef = useRef<HTMLElement | null>();
  const outerListRef = useRef<HTMLElement | null>();
  const visibleRange = useRef<PageRange>({ offset: 0, limit: 0 });
  const listref = useRef<FixedSizeList | null>(null);

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

          listref.current?.scrollToItem(index - 1);
        }
      } else if (event.key === 'ArrowDown') {
        const index = findIndex() + 1;
        const next = data.get(index);

        if (next) {
          selection.setSelection(next.id);

          listref.current?.scrollToItem(index + 1);
        }
      } else if (event.key === 'PageUp') {
        listref.current?.scrollToItem(
          visibleRange.current.offset - visibleRange.current.limit,
          'start'
        );
      } else if (event.key === 'PageDown') {
        listref.current?.scrollToItem(
          visibleRange.current.offset + visibleRange.current.limit,
          'start'
        );
      } else if (event.key === 'Home') {
        listref.current?.scrollToItem(0, 'start');
      } else if (event.key === 'End') {
        listref.current?.scrollToItem(data.totalCount - 1, 'end');
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
      <AutoSizer>
        {({ height, width }) => {
          if (!columnSizes) {
            return null;
          }

          return (
            <Loader
              ref={loaderRef}
              isItemLoaded={data.isLoaded}
              loadMoreItems={data.fetchMore}
              itemCount={data.totalCount}
            >
              {({ onItemsRendered, ref }) => (
                <GridContext.Provider
                  value={{
                    width,
                    columns: columns as GridColumn<Resource>[],
                    onDoubleClickItem,
                    contextMenuItems,
                    rowHeight,
                    columnOffsets,
                    columnSizes,
                    onResize: (i, val) => {
                      setColumnSizes(
                        produce((draft) => {
                          if (draft) {
                            draft[i] = val;
                          }
                        })
                      );
                    }
                  }}
                >
                  <FixedSizeList<CellData<T>>
                    ref={(grid) => {
                      ref(grid);
                      listref.current = grid;
                    }}
                    width={width}
                    height={height}
                    itemCount={data.totalCount}
                    itemSize={rowHeight}
                    itemData={dataVal}
                    outerRef={outerListRef}
                    innerRef={innerListRef}
                    innerElementType={GridWrapper}
                    onItemsRendered={(props) => {
                      data.setVisibleRange(
                        props.overscanStartIndex,
                        props.overscanStopIndex
                      );

                      visibleRange.current = {
                        offset: props.visibleStartIndex,
                        limit: props.visibleStopIndex - props.visibleStartIndex
                      };

                      onItemsRendered({
                        overscanStartIndex: props.overscanStartIndex,
                        overscanStopIndex: props.overscanStopIndex,
                        visibleStartIndex: props.visibleStartIndex,
                        visibleStopIndex: props.visibleStopIndex
                      });
                    }}
                  >
                    {Row}
                  </FixedSizeList>
                </GridContext.Provider>
              )}
            </Loader>
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
export interface GridColumn<T = unknown, Val = any> {
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
export type DataGridCell<Val = unknown> = FC<{
  value?: Val;
  property: string;
}> & {
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
function Row<T extends Resource>({
  data: { cursor, columns },
  style,
  index
}: ListChildComponentProps<CellData<T>>) {
  const { current: selection, setSelection } = SelectionContext.useContainer();
  const { columnSizes, width, contextMenuItems, onDoubleClickItem } =
    useContext(GridContext);
  const colData = cursor.get(index);
  const plainBg = index % 2 === 1 ? 'background' : 'foreground';
  const selected = selection && selection === colData?.id;

  const contextMenu = useContextMenu({
    options: contextMenuItems && colData ? contextMenuItems([colData.id]) : []
  });

  const sx: ThemeUIStyleObject = {
    variant: contextMenu.visible && !selected ? 'listItems.active' : undefined,
    display: 'flex',
    flexDirection: 'row',
    bg: selected ? 'primary' : plainBg,
    color: selected ? 'primaryContrast' : undefined,
    position: 'relative'
  };

  if (!colData || !columnSizes) {
    return <div sx={sx} style={style} />;
  }

  return (
    <div
      sx={sx}
      style={{ ...style, minWidth: width }}
      onClick={() => setSelection(colData.id)}
      onDoubleClick={onDoubleClickItem && (() => onDoubleClickItem(colData))}
      {...contextMenu.triggerProps}
    >
      {columns.map((column, i) => (
        <div
          key={column.id}
          sx={{
            overflow: 'hidden',
            py: 1,
            px: 2,
            height: '100%',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            '&:not:first-of-type': {
              borderLeft: '1px solid var(--theme-ui-colors-border)'
            }
          }}
          style={{ width: columnSizes.length === 1 ? width : columnSizes[i] }}
        >
          <column.cell value={column.getData(colData)} property={column.id} />
        </div>
      ))}
    </div>
  );
}

/** Data and context for grid cells */
interface CellData<T extends Resource> {
  cursor: ListCursor<T>;
  columns: GridColumn<T>[];
}

const GridWrapper = forwardRef<HTMLDivElement, HTMLAttributes<unknown>>(
  function GridWrapper({ children, style, ...props }, ref) {
    const { columns, columnSizes, columnOffsets, rowHeight, onResize } =
      useContext(GridContext);

    const dragWidth = useRef(0);

    return (
      (columnSizes && columnOffsets && (
        <>
          <div
            sx={{
              top: 0,
              width: '100%',
              height: rowHeight,
              position: 'sticky',
              zIndex: 2,
              fontWeight: 700,
              bg: 'background'
            }}
          >
            {columns.map((col, i) => (
              <div
                key={col.id}
                sx={{
                  position: 'absolute',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  top: '0',
                  height: rowHeight,
                  width: columns.length === 1 ? '100%' : columnSizes[i],
                  left: columnOffsets[i],
                  borderRight:
                    columns.length === 1
                      ? 'none'
                      : '1px solid var(--theme-ui-colors-border)',
                  borderBottom: '1px solid var(--theme-ui-colors-border)',
                  textAlign: 'center'
                }}
              >
                <div
                  sx={{
                    position: 'relative',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                >
                  {col.label}
                </div>

                <div
                  sx={{
                    right: 0,
                    top: 0,
                    height: '100%',
                    width: 3,
                    zIndex: 10,
                    position: 'absolute',
                    cursor: 'ew-resize',
                    pointerEvents: 'all'
                  }}
                  draggable
                  onMouseDown={(e) => {
                    dragWidth.current =
                      (e.currentTarget.parentElement?.clientWidth ?? 0) -
                      e.clientX;
                  }}
                  onDrag={(e) => {
                    const newSize = dragWidth.current + e.clientX;

                    // Why does the final dragend report a clientwidth of 0?
                    if (e.clientX > 0 && newSize >= 36) {
                      onResize(i, newSize);
                    }
                  }}
                ></div>
              </div>
            ))}
          </div>

          <div
            ref={ref}
            style={{
              ...style,
              width: sum(columnSizes),
              position: 'relative'
            }}
            {...props}
          >
            {children}
          </div>
        </>
      )) ||
      null
    );
  }
);

const GridContext = createContext<{
  onDoubleClickItem?: (item: any) => void;
  columns: GridColumn<Resource>[];
  onResize: (index: number, size: number) => void;
  contextMenuItems?: (targets: string[]) => ContextMenuChoice[];
  columnSizes?: number[];
  width: number;
  columnOffsets?: number[];
  rowHeight: number;
}>({
  onResize: noop,
  columns: [],
  width: 0,
  rowHeight: 0
});
