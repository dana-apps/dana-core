/** @jsxImportSource theme-ui */

import { ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import Loader from 'react-window-infinite-loader';
import { GridChildComponentProps, FixedSizeGrid as Grid } from 'react-window';
import { Box, BoxProps, useThemeUI } from 'theme-ui';

import { Resource } from '../../../common/resource';
import { ListCursor } from '../../ipc/ipc.hooks';

export interface DataGridProps<T extends Resource> extends BoxProps {
  data: ListCursor<T>;
  columns: GridColumn<T>[];
  fontSize?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GridColumn<T extends Resource = Resource, Val = any> {
  id: string;
  label: string;
  getData: (x: T) => Val;
  render: (x: Val) => ReactElement;
}

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

  useEffect(() => {
    if (loaderRef.current) {
      loaderRef.current.resetloadMoreItemsCache(true);
    }
  }, [data.stateKey]);

  return (
    <Box sx={{ fontSize: 0 }} {...props}>
      <AutoSizer>
        {({ height, width }) => {
          const columnWidth = Math.max(200, Math.floor(width / columns.length));

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
                    key={col.label}
                    sx={{
                      width: columnWidth,
                      position: 'absolute',
                      borderRight: '1px solid var(--theme-ui-colors-border)',
                      left: columnWidth * i,
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
                      columnWidth={columnWidth}
                      onScroll={({ scrollLeft }) => {
                        if (headerRef.current) {
                          headerRef.current.style.transform = `translateX(-${scrollLeft}px)`;
                        }
                      }}
                      rowCount={data.totalCount}
                      columnCount={columns.length}
                      rowHeight={rowHeight}
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
                      {Cell}
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

interface CellData<T extends Resource> {
  rows: T[];
  columns: GridColumn<T>[];
}

function Cell<T extends Resource>({
  data: { rows, columns },
  style,
  columnIndex,
  rowIndex
}: GridChildComponentProps<CellData<T>>) {
  const colData = rows[rowIndex];
  const column = columns[columnIndex];
  const sx = {
    bg: rowIndex % 2 === 0 ? 'background' : 'foreground',
    borderLeft: '1px solid var(--theme-ui-colors-border)',
    py: 1,
    px: 2,
    height: '100%'
  };

  if (!colData) {
    return <div sx={sx} style={style} />;
  }

  return (
    <div sx={sx} style={style}>
      {column.render(column.getData(colData))}
    </div>
  );
}
