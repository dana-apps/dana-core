/** @jsxImportSource theme-ui */

import { Box, Button, Flex, Text } from 'theme-ui';
import { ExclamationTriangleFill } from 'react-bootstrap-icons';

import { CloseModal } from '../../common/ui.interfaces';
import { required } from '../../common/util/assert';
import { useFrontendConfig } from '../config';
import { useRPC } from '../ipc/ipc.hooks';
import { WindowDragArea } from '../ui/window';

const icons = {
  error: (
    <ExclamationTriangleFill size={48} color="var(--theme-ui-colors-error)" />
  )
};

export const ModalScreen = () => {
  const config = useFrontendConfig();
  const modalConfig = required(
    config.modalConfig,
    'Expected modalConfig to be defined'
  );
  const rpc = useRPC();

  const handleConfirm = () => {
    rpc(CloseModal, { returnId: modalConfig.returnId, action: 'confirm' });
  };

  return (
    <Flex
      sx={{ width: '100vw', height: '100vh', flexDirection: 'column', p: 5 }}
    >
      <WindowDragArea
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          flexGrow: 1
        }}
      >
        <Box sx={{ pr: 6 }}>{icons[modalConfig.icon]}</Box>

        <Text
          sx={{ flexGrow: 1 }}
          dangerouslySetInnerHTML={modalConfig.message}
        />
      </WindowDragArea>

      <WindowDragArea
        sx={{
          flexDirection: 'row',
          display: 'flex',
          justifyContent: 'flex-end'
        }}
      >
        <Button sx={{ px: 5 }} onClick={handleConfirm}>
          Ok
        </Button>
      </WindowDragArea>
    </Flex>
  );
};
