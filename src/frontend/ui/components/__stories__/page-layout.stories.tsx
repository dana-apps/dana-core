import faker from '@faker-js/faker';
import { times } from 'lodash';
import { Plus } from 'react-bootstrap-icons';
import { MemoryRouter } from 'react-router-dom';
import { Box, IconButton } from 'theme-ui';
import { Window } from '../../window';

import {
  NavListItem,
  NavListSection,
  ArchiveWindowLayout
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
