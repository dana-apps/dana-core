/** @jsxImportSource theme-ui */

import { FC, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Upload } from 'react-bootstrap-icons';
import { Box, Flex, Text } from 'theme-ui';

import { ListIngestSession, StartIngest } from '../../common/ingest.interfaces';
import { Resource } from '../../common/resource';
import { Result } from '../../common/util/error';
import { useListAll, useRPC } from '../ipc/ipc.hooks';
import { ToolbarButton } from '../ui/components/atoms.component';
import { Dropzone } from '../ui/components/dropzone.component';
import {
  ListItem,
  ListSection,
  ScreenLayout
} from '../ui/components/page-layouts.component';
import { WindowInset } from '../ui/window';

export const ArchiveScreen: FC<{ title?: string }> = ({ title }) => {
  const imports = useListAll(ListIngestSession, () => ({}), []);
  const acceptUpload = useAcceptUpload();

  return (
    <ScreenLayout
      sidebar={
        <>
          <Box sx={{ bg: 'gray1', height: '100%' }}>
            <WindowInset />

            {/* Import Sessions */}
            {renderIfPresent(imports, (imports) => (
              <ListSection label="Imports">
                {imports.map((session) => (
                  <NavLink
                    key={session.id}
                    className="link-reset"
                    to={`/ingest/${session.id}`}
                  >
                    {({ isActive }) => (
                      <ListItem label={session.title} active={isActive} />
                    )}
                  </NavLink>
                ))}
              </ListSection>
            ))}
          </Box>
        </>
      }
      main={
        <>
          <WindowInset
            sx={{
              bg: 'gray1',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              px: 5
            }}
          >
            <Text sx={{ fontWeight: 600 }}>{title}</Text>

            <Flex
              sx={{
                px: 5,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'flex-end',
                p: 2,
                flex: 1
              }}
            >
              <ToolbarButton
                sx={{ color: 'primaryContrast' }}
                icon={Upload}
                label="Upload Files"
                onClick={acceptUpload}
              />
            </Flex>
          </WindowInset>

          <Outlet />
        </>
      }
    />
  );
};

function useAcceptUpload() {
  const navigate = useNavigate();
  const rpc = useRPC();

  const handleDrop = useCallback(async () => {
    const session = await rpc(StartIngest, {});

    if (session.status === 'ok') {
      navigate(`/ingest/${session.value.id}`);
    }
  }, [navigate, rpc]);

  return handleDrop;
}

function renderIfPresent<T extends Resource[], Return>(
  resource: Result<T> | undefined,
  fn: (x: T) => Return
) {
  if (!resource) {
    return null;
  }

  if (resource.status === 'error') {
    return null;
  }

  if (resource.value.length === 0) {
    return null;
  }

  return fn(resource.value);
}
