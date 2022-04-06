import faker from '@faker-js/faker';
import { times } from 'lodash';
import { useState } from 'react';
import { Plus } from 'react-bootstrap-icons';
import { MemoryRouter } from 'react-router-dom';
import { Box, Button, Grid, IconButton } from 'theme-ui';
import { Window } from '../../window';

import {
  NavListItem,
  NavListSection,
  ArchiveWindowLayout,
  PrimaryDetailLayout
} from '../page-layouts.component';

export default {
  title: 'Components/Page Layout'
};

export const ScreenWithSidebar = () => {
  faker.seed(1);

  return (
    <Window>
      <ArchiveWindowLayout
        sidebar={
          <>
            <MemoryRouter initialEntries={['/2.1']}>
              {times(6, (i) => (
                <NavListSection key={i} title={faker.word.adjective()}>
                  {times(5, (j) => (
                    <NavListItem
                      key={j}
                      title={faker.word.noun()}
                      path={`/${i}.${j}`}
                    />
                  ))}
                </NavListSection>
              ))}
            </MemoryRouter>
          </>
        }
        sidebarButtons={
          <IconButton>
            <Plus size={32} />
          </IconButton>
        }
        main={<Box sx={{ p: 3 }}>Hello</Box>}
      />
    </Window>
  );
};

export const PrimaryDetail = () => {
  faker.seed(1);
  const [state, setState] = useState<string>();
  const animals = times(10, faker.animal.dog);

  const detailView = state && <Box>{state}</Box>;

  return (
    <Window>
      <PrimaryDetailLayout detail={detailView}>
        <Grid>
          {animals.map((key, i) => (
            <Button onClick={() => setState(key)} key={i}>
              {faker.animal.dog()}
            </Button>
          ))}
        </Grid>
      </PrimaryDetailLayout>
    </Window>
  );
};
