/** @jsxImportSource theme-ui */

import { Box, Button, Flex, Text } from 'theme-ui';
import {
  ExclamationTriangleFill,
  QuestionCircleFill
} from 'react-bootstrap-icons';

import { ReturnModalValue } from '../../common/ui.interfaces';
import { required } from '../../common/util/assert';
import { useFrontendConfig } from '../config';
import { useRPC } from '../ipc/ipc.hooks';
import { WindowDragArea } from '../ui/window';

const icons = {
  error: (
    <ExclamationTriangleFill size={48} color="var(--theme-ui-colors-error)" />
  ),
  question: (
    <QuestionCircleFill size={48} color="var(--theme-ui-colors-primary)" />
  )
};

export const ModalScreen = () => {
  const config = useFrontendConfig();
  const modalConfig = required(
    config.modalConfig,
    'Expected modalConfig to be defined'
  );
  const rpc = useRPC();

  const handleConfirm = async () => {
    await rpc(ReturnModalValue, {
      returnId: modalConfig.returnId,
      action: 'confirm'
    });
    window.close();
  };

  const handleCancel = async () => {
    await rpc(ReturnModalValue, {
      returnId: modalConfig.returnId,
      action: 'cancel'
    });
    window.close();
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
        {modalConfig.type === 'confirm' && (
          <Button sx={{ px: 5, mr: 4 }} onClick={handleCancel}>
            {modalConfig.cancelButtonLabel ?? 'Cancel'}
          </Button>
        )}

        <Button sx={{ px: 5 }} onClick={handleConfirm}>
          {modalConfig.confirmButtonLabel ?? 'Ok'}
        </Button>
      </WindowDragArea>
    </Flex>
  );
};
