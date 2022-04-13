/** @jsxImportSource theme-ui */

import { useCallback } from 'react';
import { FC } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Button, Flex } from 'theme-ui';
import { OpenArchive } from '../common/interfaces/archive.interfaces';

import { useRPC } from './ipc/ipc.hooks';
import { ArchiveScreen } from './screens/archive.screen';
import { CollectionScreen } from './screens/collection.screen';
import { ArchiveIngestScreen } from './screens/ingest.screen';
import { SchemaScreen } from './screens/schema.screen';
import { InvalidateOnPageChange } from './ui/components/util.component';
import { WindowInset } from './ui/window';

/**
 * Root component for a window representing an archive
 */
export const ArchiveWindow: FC<{ title?: string }> = ({ title }) => (
  <Routes>
    <Route path="/" element={<ArchiveScreen title={title} />}>
      <Route index element={<></>} />
      <Route
        path="ingest/:sessionId"
        element={
          <InvalidateOnPageChange>
            <ArchiveIngestScreen />
          </InvalidateOnPageChange>
        }
      />
      <Route
        path="collection/:collectionId"
        element={
          <InvalidateOnPageChange>
            <CollectionScreen />
          </InvalidateOnPageChange>
        }
      />
      <Route
        path="schema"
        element={
          <InvalidateOnPageChange>
            <SchemaScreen />
          </InvalidateOnPageChange>
        }
      />
    </Route>
  </Routes>
);

/**
 * Root component for a window shown on first launch
 */
export const NewArchiveWindow: FC = () => {
  const rpc = useRPC();
  const newArchive = useCallback(async () => {
    const res = await rpc(OpenArchive, {});

    if (res.status === 'ok') {
      window.close();
    }
  }, [rpc]);

  return (
    <>
      <WindowInset />
      <Flex
        sx={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}
      >
        <Button variant="primaryTransparent" onClick={newArchive}>
          New Archive
        </Button>
      </Flex>
    </>
  );
};
