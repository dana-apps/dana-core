/** @jsxImportSource theme-ui */

import { FC, useCallback } from 'react';
import { Button } from 'theme-ui';
import { BootstrapArchive } from '../../common/ingest.interfaces';
import { OpenArchive } from '../../common/interfaces/archive.interfaces';
import { useRPC } from '../ipc/ipc.hooks';
import { WindowDragArea } from '../ui/window';

/**
 * Root component for a window shown on first launch
 */
export const InitialScreen: FC = () => {
  const rpc = useRPC();
  const openDanapack = useCallback(async () => {
    const res = await rpc(BootstrapArchive, {});

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

  const buttonStyling = {
    background: '#001FCD',
    border: '1px solid #001FCD',
    width: '100%',
    height: '36px',
    fontStyle: 'normal',
    fontWeight: 700,
    fontSize: '12px',
    lineHeight: '16px'
  };

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
      <span sx={{ flex: 1 }} />

      <Button
        variant="secondaryTransparent"
        onClick={newArchive}
        sx={{ ...buttonStyling, marginBottom: '20px' }}
      >
        Create empty archive
      </Button>

      <Button
        variant="secondaryTransparent"
        onClick={openDanapack}
        sx={{
          ...buttonStyling,
          backgroundColor: 'white',
          color: '#001FCD'
        }}
      >
        Create archive from Danapack
      </Button>

      <span sx={{ flex: 1 }} />
    </WindowDragArea>
  );
};
