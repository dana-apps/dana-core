import { ReactElement, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModalIcon } from '../../../common/frontend-config';
import { ShowModal } from '../../../common/ui.interfaces';
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
        const message =
          typeof opts.message === 'string'
            ? opts.message
            : renderToStaticMarkup(opts.message);
        const res = await rpc(ShowModal, { ...opts, message });
        if (res.status === 'error') {
          throw res.error;
        }
      }
    }),
    [rpc]
  );
}
