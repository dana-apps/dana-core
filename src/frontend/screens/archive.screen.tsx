/** @jsxImportSource theme-ui */

import { FC, useCallback } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { FolderPlus, ListColumns, Plus } from 'react-bootstrap-icons';
import { Box, Flex, IconButton, Text } from 'theme-ui';

import {
  IngestPhase,
  IngestSession,
  ListIngestSession,
  StartIngest
} from '../../common/ingest.interfaces';
import { Resource } from '../../common/resource';
import { Result } from '../../common/util/error';
import { unwrapGetResult, useGet, useListAll, useRPC } from '../ipc/ipc.hooks';
import {
  ProgressIndicator,
  ToolbarButton
} from '../ui/components/atoms.component';
import {
  NavListItem,
  NavListSection,
  ArchiveWindowLayout
} from '../ui/components/page-layouts.component';
import { WindowDragArea, WindowInset } from '../ui/window';
import { useContextMenu } from '../ui/hooks/menu.hooks';
import {
  CreateCollection,
  defaultSchemaProperty,
  GetRootAssetsCollection,
  GetRootDatabaseCollection,
  GetSubcollections
} from '../../common/asset.interfaces';
import { useErrorDisplay } from '../ui/hooks/error.hooks';

/**
 * The wrapper component for an archive window. Shows the screen's top-level navigation and renders the active route.
 */
export const ArchiveScreen: FC<{ title?: string }> = ({ title }) => {
  const imports = useListAll(ListIngestSession, () => ({}), []);
  const acceptImport = useStartImport();
  const assetRoot = unwrapGetResult(useGet(GetRootAssetsCollection));
  const databaseRoot = unwrapGetResult(useGet(GetRootDatabaseCollection));
  const databases = useListAll(
    GetSubcollections,
    () => (databaseRoot ? { parent: databaseRoot.id } : 'skip'),
    [databaseRoot]
  );
  const createMenu = useCreateMenu();

  if (!assetRoot) {
    return null;
  }

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
                    status={<IngestSessionStatusIndicator session={session} />}
                  />
                ))}
              </NavListSection>
            ))}

            {/* Assets */}
            <NavListSection title="Collections">
              <NavListItem
                title="Main Collection"
                path={`/collection/${assetRoot.id}`}
              />
            </NavListSection>

            {/* Databases */}
            {renderIfPresent(databases, (databases) => (
              <NavListSection title="Controlled Databases">
                {databases.map((db) => (
                  <NavListItem
                    key={db.id}
                    title={db.title}
                    path={`/collection/${db.id}`}
                  />
                ))}
              </NavListSection>
            ))}
          </Box>
        </>
      }
      sidebarButtons={
        <>
          <IconButton {...createMenu.triggerProps}>
            <Plus size={32} />
          </IconButton>
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

            <div sx={{ flex: 1 }}>
              <WindowInset
                sx={{
                  bg: 'gray1'
                }}
                platforms={['windows', 'linuxish']}
              />
              <WindowDragArea
                sx={{
                  px: 6,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-end',
                  p: 2,
                  flex: 1,
                  '> *': {
                    pr: 4
                  }
                }}
              >
                <Link to="/schema" sx={{ textDecoration: 'none' }}>
                  <ToolbarButton icon={ListColumns} label="Schema" />
                </Link>
                <ToolbarButton
                  icon={FolderPlus}
                  label="Import Assets"
                  onClick={acceptImport}
                />
              </WindowDragArea>
            </div>
          </WindowDragArea>

          <Outlet />
        </Flex>
      }
    />
  );
};

const IngestSessionStatusIndicator: FC<{ session: IngestSession }> = ({
  session
}) => {
  if (session.phase === IngestPhase.COMPLETED) {
    return <ProgressIndicator value={session.valid ? 1 : 'warning'} />;
  }
  if (session.phase === IngestPhase.ERROR) {
    return <ProgressIndicator value="error" />;
  }
  if (!session.totalFiles) {
    return <ProgressIndicator value={-1} />;
  }

  return <ProgressIndicator value={session.filesRead / session.totalFiles} />;
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

function useCreateMenu() {
  const rpc = useRPC();
  const error = useErrorDisplay();
  const root = useGet(GetRootDatabaseCollection);
  const navigate = useNavigate();

  const createControlledDatabase = async () => {
    if (!root || root.status !== 'ok') {
      return;
    }

    const res = await rpc(CreateCollection, {
      parent: root.value.id,
      schema: [{ ...defaultSchemaProperty(0), label: 'Title' }],
      title: 'New Database'
    });
    if (res.status !== 'ok') {
      return error.unexpected(res.error);
    }

    navigate(`/collection/${res.value.id}`);
  };

  return useContextMenu({
    on: 'click',
    options: [
      {
        id: 'newControlledDatabase',
        label: 'New Controlled Database',
        action: createControlledDatabase
      }
    ]
  });
}
