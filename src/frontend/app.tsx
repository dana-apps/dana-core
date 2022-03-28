/** @jsxImportSource theme-ui */

import { useCallback } from 'react';
import { FC } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Box, Button, Flex, Text } from 'theme-ui';
import { CreateArchive } from '../common/interfaces/archive.interfaces';

import { useRPC } from './ipc/ipc.hooks';
import { ArchiveScreen } from './screens/archive.screen';
import { ArchiveIngestScreen } from './screens/ingest.screen';
import { WindowInset } from './ui/window';

export const ArchiveWindow: FC = () => (
  <Routes>
    <Route path="/" element={<ArchiveScreen />}>
      <Route index element={<></>} />
      <Route path="ingest/:sessionId" element={<ArchiveIngestScreen />} />
    </Route>
  </Routes>
);

export const NewArchiveWindow: FC = () => {
  const rpc = useRPC();
  const newArchive = useCallback(async () => {
    const res = await rpc(CreateArchive, {});

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
