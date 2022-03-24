import faker from '@faker-js/faker';
import { times } from 'lodash';
import { Plus } from 'react-bootstrap-icons';
import { Box, IconButton } from 'theme-ui';
import { Window } from '../../window';

import { ListItem, ListSection, ScreenLayout } from '../page-layouts.component';

export default {
  title: 'Components/Page Layout'
};

export const ScreenWithSidebar = () => {
  faker.seed(1);

  return (
    <Window>
      <ScreenLayout
        sidebar={
          <>
            {times(6, (i) => (
              <ListSection key={i} label={faker.word.adjective()}>
                {times(5, (j) => (
                  <ListItem
                    key={j}
                    label={faker.word.noun()}
                    active={i === 1 && j === 2}
                  />
                ))}
              </ListSection>
            ))}
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
