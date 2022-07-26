/** @jsxImportSource theme-ui */

import { FC } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Plus } from 'react-bootstrap-icons';
import { Box, Flex, IconButton } from 'theme-ui';

import {
  ExportCollection,
  IngestPhase,
  IngestSession,
  ListIngestSession,
  StartIngest
} from '../../common/ingest.interfaces';
import { Resource } from '../../common/resource';
import { Result } from '../../common/util/error';
import { unwrapGetResult, useGet, useListAll, useRPC } from '../ipc/ipc.hooks';
import { ProgressIndicator } from '../ui/components/atoms.component';
import {
  NavListItem,
  NavListSection,
  ArchiveWindowLayout
} from '../ui/components/page-layouts.component';
import { WindowInset, WindowTitle } from '../ui/window';
import { useContextMenu } from '../ui/hooks/menu.hooks';
import {
  CreateCollection,
  defaultSchemaProperty,
  GetRootAssetsCollection,
  GetRootDatabaseCollection,
  UpdateCollection
} from '../../common/asset.interfaces';
import { useErrorDisplay } from '../ui/hooks/error.hooks';
import { CollectionBrowser } from '../ui/components/collection-browser.component';

/**
 * The wrapper component for an archive window. Shows the screen's top-level navigation and renders the active route.
 */
export const ArchiveScreen: FC<{ title?: string }> = () => {
  const imports = useListAll(ListIngestSession, () => ({}), []);
  const rpc = useRPC();
  const navigate = useNavigate();

  const assetRoot = unwrapGetResult(useGet(GetRootAssetsCollection));
  const databaseRoot = unwrapGetResult(useGet(GetRootDatabaseCollection));

  const createMenu = useCreateMenu();
  const renameCollection = async (id: string, title: string) => {
    await rpc(UpdateCollection, { id, title });
  };

  const startImport = async (targetCollectionId: string) => {
    const session = await rpc(StartIngest, { targetCollectionId });

    if (session.status === 'ok') {
      navigate(`/ingest/${session.value.id}`);
    }
  };

  const startExport = async (collectionId: string) => {
    await rpc(ExportCollection, { collectionId });
  };

  if (!assetRoot || !databaseRoot) {
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
              <CollectionBrowser
                parentId={assetRoot.id}
                itemProps={(collection) => ({
                  onRename: (title) => renameCollection(collection.id, title),
                  contextMenuItems: [
                    {
                      action: () => startImport(assetRoot.id),
                      id: 'start-import',
                      label: 'Import assets'
                    },
                    {
                      action: () => startExport(assetRoot.id),
                      id: 'start-export',
                      label: 'Export assets'
                    }
                  ]
                })}
              />
            </NavListSection>

            {/* Databases */}
            <NavListSection title="Databases">
              <CollectionBrowser
                parentId={databaseRoot.id}
                itemProps={(collection) => ({
                  onRename: (title) => renameCollection(collection.id, title),
                  contextMenuItems: [
                    {
                      action: () => startImport(collection.id),
                      id: 'start-import',
                      label: 'Import database records'
                    },
                    {
                      action: () => startExport(collection.id),
                      id: 'start-export',
                      label: 'Export database'
                    }
                  ]
                })}
              />
            </NavListSection>
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
          <WindowTitle showVersion />

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
  const rootDb = unwrapGetResult(useGet(GetRootDatabaseCollection));
  const rootAssets = unwrapGetResult(useGet(GetRootAssetsCollection));
  const navigate = useNavigate();

  const collectionCreator = (parentId: string, title: string) => async () => {
    const res = await rpc(CreateCollection, {
      parent: parentId,
      schema: [{ ...defaultSchemaProperty(0), label: 'Title' }],
      title
    });

    if (res.status !== 'ok') {
      return error.unexpected(res.error);
    }

    navigate(`/collection/${res.value.id}`);
  };

  return useContextMenu({
    on: 'click',
    options: [
      rootDb && {
        id: 'newControlledDatabase',
        label: 'New Controlled Database',
        action: collectionCreator(rootDb.id, 'New Database')
      },
      rootAssets && {
        id: 'newAssetCollection',
        label: 'New Asset Collection',
        action: collectionCreator(rootAssets.id, 'New Collection')
      }
    ]
  });
}
