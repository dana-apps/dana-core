import { FC, useCallback } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { ListIngestSession, StartIngest } from '../../common/ingest.interfaces';
import { Resource } from '../../common/resource';
import { Result } from '../../common/util/error';
import { useListAll, useRPC } from '../ipc/ipc.hooks';
import { Dropzone } from '../ui/components/dropzone.component';
import {
  ListItem,
  ListSection,
  ScreenLayout
} from '../ui/components/page-layouts.component';
import { WindowInset } from '../ui/window';

export const ArchiveScreen: FC = () => {
  const imports = useListAll(ListIngestSession, () => ({}), []);
  const acceptUpload = useAcceptUpload();

  return (
    <ScreenLayout
      sidebar={
        <>
          <WindowInset />

          {/* Import Sessions */}
          {renderIfPresent(imports, (imports) => (
            <ListSection label="Imports">
              {imports.map((session) => (
                <Link key={session.id} to={`/ingest/${session.id}`}>
                  {({ active }: { active: boolean }) => (
                    <ListItem label={session.basePath} active={active} />
                  )}
                </Link>
              ))}
            </ListSection>
          ))}
        </>
      }
      main={
        <>
          <WindowInset />

          <Dropzone
            onAcceptFiles={acceptUpload}
            dropzoneOptions={{ maxFiles: 1 }}
          >
            <Outlet />
          </Dropzone>
        </>
      }
    />
  );
};

function useAcceptUpload() {
  const navigate = useNavigate();
  const rpc = useRPC();

  const handleDrop = useCallback(
    async ([droppedFile]: FileSystemEntry[]) => {
      const session = await rpc(StartIngest, {
        basePath: droppedFile.fullPath
      });

      if (session.status === 'ok') {
        navigate(`/ingest/${session.value.id}`);
      }
    },
    [navigate, rpc]
  );
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
