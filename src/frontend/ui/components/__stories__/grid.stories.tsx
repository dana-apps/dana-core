/** @jsxImportSource theme-ui */

import faker from '@faker-js/faker';
import { EventEmitter } from 'eventemitter3';
import { noop, times } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

import { RpcInterface } from '../../../../common/ipc.interfaces';
import {
  ChangeEvent,
  Resource,
  ResourceList
} from '../../../../common/resource';
import { IpcContext, ListCursor, useList } from '../../../ipc/ipc.hooks';
import { MockIpc } from '../../../ipc/mock-ipc';
import { SelectionContext } from '../../hooks/selection.hooks';
import { Window } from '../../window';
import { TextCell } from '../grid-cell.component';
import { DataGrid, GridColumn } from '../grid.component';

export default {
  title: 'Components/Grid'
};

interface GridDatum extends Resource {
  name: string;
  favouriteDog: string;
}

export const ExampleDataGrid = () => {
  const [state, setState] = useState<GridDatum[]>([]);
  const data: ListCursor<GridDatum> = useMemo(
    () => ({
      active: false,
      items: state,
      events: new EventEmitter(),
      totalCount: 1000,
      setVisibleRange: noop,
      get: (i) => state[i],
      isLoaded: (i) => i < state.length,
      reset: () => Promise.resolve(),
      fetchMore: async (start, end) => {
        setState((state) => {
          faker.seed(start);

          const newItems = times(end - start, () => ({
            id: faker.datatype.uuid(),
            name: faker.name.firstName(),
            favouriteDog: faker.animal.dog()
          }));

          return [...state, ...newItems];
        });
      }
    }),
    [state]
  );

  const columns: GridColumn<GridDatum>[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Name',
        getData: (x: GridDatum) => x.name,
        cell: TextCell
      },
      {
        id: 'favouriteDog',
        label: 'Dog',
        getData: (x: GridDatum) => x.favouriteDog,
        cell: TextCell
      }
    ],
    []
  );

  return (
    <SelectionContext.Provider>
      <Window>
        <DataGrid sx={{ height: '100%' }} data={data} columns={columns} />
      </Window>
    </SelectionContext.Provider>
  );
};

const TestUpdate = RpcInterface({
  id: 'test-list',
  request: z.object({}),
  response: ResourceList(
    z.object({
      id: z.string(),
      favouriteDog: z.string(),
      name: z.string()
    })
  )
});

export const InFlightUpdates = () => {
  const dataCache = useRef<GridDatum[]>([]);
  const extend = () => {
    times(50, () => {
      dataCache.current.push({
        id: faker.datatype.uuid(),
        favouriteDog: faker.animal.dog(),
        name: faker.name.firstName()
      });
    });
  };

  const ipc = useMemo(() => {
    faker.seed();
    extend();

    const ipc = new MockIpc();
    ipc.handle({
      type: TestUpdate,
      result: async (_, _id, range = { offset: 0, limit: 25 }) => {
        return {
          status: 'ok',
          value: {
            items: dataCache.current.slice(
              range.offset,
              range.offset + range.limit
            ),
            range,
            total: dataCache.current.length
          }
        };
      }
    });

    return { ipc };
  }, []);

  useEffect(() => {
    const doIt = (): void => {
      extend();
      ipc.ipc.emit(ChangeEvent, { type: TestUpdate.id, ids: [] });
      timeout = setTimeout(doIt, 5000);
    };

    let timeout = setTimeout(doIt, 5000);
    return () => clearTimeout(timeout);
  }, [ipc]);

  const StoryImpl = useCallback(function StoryImpl() {
    const data = useList(TestUpdate, () => ({}), []);

    const columns: GridColumn<GridDatum>[] = useMemo(
      () => [
        {
          id: 'name',
          label: 'Name',
          getData: (x: GridDatum) => x.name,
          cell: TextCell
        },
        {
          id: 'favouriteDog',
          label: 'Dog',
          getData: (x: GridDatum) => x.favouriteDog,
          cell: TextCell
        }
      ],
      []
    );

    if (!data) {
      return <></>;
    }

    return (
      <SelectionContext.Provider>
        <Window>
          <DataGrid sx={{ height: '100%' }} data={data} columns={columns} />
        </Window>
      </SelectionContext.Provider>
    );
  }, []);

  return (
    <IpcContext.Provider value={ipc}>
      <StoryImpl />
    </IpcContext.Provider>
  );
};
