/** @jsxImportSource theme-ui */

import faker from '@faker-js/faker';
import { noop, times } from 'lodash';
import { useMemo, useState } from 'react';
import { Box } from 'theme-ui';

import { Resource } from '../../../../common/resource';
import { ListCursor } from '../../../ipc/ipc.hooks';
import { Window } from '../../window';
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
      stateKey: '1',
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
        render: (data: string) => <Box>{data}</Box>
      },
      {
        id: 'favouriteDog',
        label: 'Dog',
        getData: (x: GridDatum) => x.favouriteDog,
        render: (data: string) => <Box>{data}</Box>
      }
    ],
    []
  );

  return (
    <Window>
      <DataGrid sx={{ height: '100%' }} data={data} columns={columns} />
    </Window>
  );
};
