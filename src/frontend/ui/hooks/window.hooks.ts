import { ReactElement, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModalIcon } from '../../../common/frontend-config';
import {
  CreateWindow,
  CreateWindowOpts,
  ShowModal
} from '../../../common/ui.interfaces';
import { useRPC } from '../../ipc/ipc.hooks';

export function useModal() {
  const rpc = useRPC();

  return useMemo(
    () => ({
      alert: async (opts: {
        message: string | ReactElement;
        title: string;
        icon: ModalIcon;
      }) => {
        const res = await rpc(ShowModal, {
          ...opts,
          type: 'alert',
          message: convertMessage(opts.message)
        });
        if (res.status === 'error') {
          throw res.error;
        }
      },
      confirm: async (opts: {
        message: string | ReactElement;
        title: string;
        icon?: ModalIcon;
        confirmButtonLabel?: string;
        cancelButtonLabel?: string;
      }) => {
        const res = await rpc(ShowModal, {
          icon: 'question',
          type: 'confirm',
          ...opts,
          message: convertMessage(opts.message)
        });
        if (res.status === 'error') {
          throw res.error;
        }

        return res.value.action === 'cancel' ? false : true;
      }
    }),
    [rpc]
  );
}

export function useWindows() {
  const rpc = useRPC();

  return useMemo(
    () => ({
      open: async (opts: CreateWindowOpts) => {
        return rpc(CreateWindow, opts);
      },

      close: () => window.close()
    }),
    [rpc]
  );
}

const convertMessage = (message: string | ReactElement) =>
  typeof message === 'string' ? message : renderToStaticMarkup(message);
