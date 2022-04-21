/** @jsxImportSource theme-ui */

import { FC, useCallback } from 'react';
import { Flex, Button, Heading } from 'theme-ui';
import { OpenArchive } from '../../common/interfaces/archive.interfaces';
import { useRPC } from '../ipc/ipc.hooks';
import { WindowDragArea, WindowInset } from '../ui/window';

/**
 * Root component for a window shown on first launch
 */
export const InitialScreen: FC = () => {
  const rpc = useRPC();
  const openArchive = useCallback(async () => {
    const res = await rpc(OpenArchive, {});

    if (res.status === 'ok') {
      window.close();
    }
  }, [rpc]);

  const newArchive = useCallback(async () => {
    const res = await rpc(OpenArchive, { create: true });

    if (res.status === 'ok') {
      window.close();
    }
  }, [rpc]);

  return (
    <WindowDragArea
      sx={{
        display: 'flex',
        flex: 1,
        p: 6,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        bg: 'primary',
        color: 'primaryContrast'
      }}
    >
      {/* <WindowInset /> */}
      <Heading>Dana Core</Heading>

      <span sx={{ flex: 1 }} />

      <Button variant="secondaryTransparent" onClick={newArchive}>
        New Archive
      </Button>

      <Button variant="secondaryTransparent" onClick={openArchive}>
        Open existing Archive
      </Button>

      <span sx={{ flex: 1 }} />
    </WindowDragArea>
  );
};
