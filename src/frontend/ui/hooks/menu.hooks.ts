import { compact, uniqueId } from 'lodash';
import {
  MouseEventHandler,
  useCallback,
  useMemo,
  useRef,
  useState
} from 'react';
import { ShowContextMenu } from '../../../common/ui.interfaces';
import { useRPC } from '../../ipc/ipc.hooks';

export interface ContextMenuItem {
  id: string;
  label: string;
  action: () => void;
}

export type ContextMenuChoice = ContextMenuItem | '-' | false | undefined;

interface ContextMenuOpts {
  /** Menu options */
  options: ContextMenuChoice[];

  /** Event to bind to on the trigger elemeent */
  on?: 'click' | 'context';
}

/**
 * Hook for displying a context menu.
 *
 * This currently works in electron environments and no-ops in others.
 */
export function useContextMenu({ options, on = 'context' }: ContextMenuOpts) {
  const menuId = useMemo(() => uniqueId('menu'), []);
  const rpc = useRPC();
  const [visible, setVisible] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleContextMenu = useCallback<MouseEventHandler<HTMLElement>>(
    async (event) => {
      const options = compact(optionsRef.current);
      if (options.length === 0) {
        return;
      }

      event.preventDefault();
      setVisible(true);

      const res = await rpc(ShowContextMenu, {
        id: menuId,
        x: event.clientX,
        y: event.clientY,
        menuItems: options.map((opt) =>
          opt === '-'
            ? { id: '-', label: '-' }
            : { id: opt.id, label: opt.label }
        )
      });

      setVisible(false);

      if (res.status === 'error') {
        return;
      }

      const opt = options.find(
        (opt) => typeof opt !== 'string' && opt.id === res.value.action
      );

      if (typeof opt === 'object') {
        opt.action();
      }
    },
    [menuId, rpc]
  );

  return {
    visible,
    triggerProps: {
      [on === 'context' ? 'onContextMenu' : 'onClick']: handleContextMenu
    }
  };
}
