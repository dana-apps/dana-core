/** @jsxImportSource theme-ui */

import { FC, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { FolderPlus } from 'react-bootstrap-icons';
import { Box, Flex, Text } from 'theme-ui';

import { ListIngestSession, StartIngest } from '../../common/ingest.interfaces';
import { Resource } from '../../common/resource';
import { Result } from '../../common/util/error';
import { useListAll, useRPC } from '../ipc/ipc.hooks';
import { ToolbarButton } from '../ui/components/atoms.component';
import {
  NavListItem,
  NavListSection,
  ArchiveWindowLayout
} from '../ui/components/page-layouts.component';
import { WindowDragArea, WindowInset } from '../ui/window';

/**
 * The wrapper component for an archive window. Shows the screen's top-level navigation and renders the active route.
 */
export const ArchiveScreen: FC<{ title?: string }> = ({ title }) => {
  const imports = useListAll(ListIngestSession, () => ({}), []);
  const acceptImport = useStartImport();

  return (
    <ArchiveWindowLayout
      sidebar={
        <>
          <Box sx={{ bg: 'gray1', height: '100%' }}>
            <WindowInset />

            {/* Import Sessions */}
            {renderIfPresent(imports, (imports) => (
              <NavListSection title="Imports">
                {imports.map((session) => (
                  <NavListItem
                    key={session.id}
                    title={session.title}
                    path={`/ingest/${session.id}`}
                  />
                ))}
              </NavListSection>
            ))}

            <NavListSection title="Collections">
              <NavListItem title="Main Collection" path="/collection" />
            </NavListSection>
          </Box>
        </>
      }
      main={
        <Flex sx={{ height: '100%', flexDirection: 'column' }}>
          <WindowDragArea
            sx={{
              bg: 'gray1',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              px: 5
            }}
          >
            <Text sx={{ fontWeight: 600 }}>{title}</Text>

            <WindowDragArea
              sx={{
                px: 6,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'flex-end',
                p: 2,
                flex: 1
              }}
            >
              <ToolbarButton
                icon={FolderPlus}
                label="Import Assets"
                onClick={acceptImport}
              />
            </WindowDragArea>
          </WindowDragArea>

          <Outlet />
        </Flex>
      }
    />
  );
};

/**
 * Return a callback that starts a new import section and navigates to it if starts successfuly.
 *
 * TODO: Show an error if it fails.
 */
function useStartImport() {
  const navigate = useNavigate();
  const rpc = useRPC();

  const startImport = useCallback(async () => {
    const session = await rpc(StartIngest, {});

    if (session.status === 'ok') {
      navigate(`/ingest/${session.value.id}`);
    }
  }, [navigate, rpc]);

  return startImport;
}

/**
 * Helper for the navlist's sections, which we want to hide if their query returns an empty result.
 *
 * @param queryResult Result returned by the query.
 * @param fn Render function called with the result items if the query succeeds and is non-empty
 * @returns Rendered output
 */
function renderIfPresent<T extends Resource[], Return>(
  queryResult: Result<T> | undefined,
  fn: (x: T) => Return
) {
  if (!queryResult) {
    return null;
  }

  if (queryResult.status === 'error') {
    return null;
  }

  if (queryResult.value.length === 0) {
    return null;
  }

  return fn(queryResult.value);
}
