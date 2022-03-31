/** @jsxImportSource theme-ui */

import faker from '@faker-js/faker';
import { EventEmitter } from 'eventemitter3';
import { noop, times } from 'lodash';
import { useMemo, useState } from 'react';

import { Resource } from '../../../../common/resource';
import { ListCursor } from '../../../ipc/ipc.hooks';
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
      setCurrentPage: noop,
      fetchMore: async (start, end) => {
        setState((state) => {
          faker.seed(start);

          const newItems = times(end - start, (i) => ({
            id: String(i),
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
