import { uniqueId } from 'lodash';
import { MouseEventHandler, useCallback, useMemo, useRef } from 'react';
import { ShowContextMenu } from '../../../common/ui.interfaces';
import { useRPC } from '../../ipc/ipc.hooks';

interface ContextMenuItem {
  id: string;
  label: string;
  action: () => void;
}

type ContextMenuChoice = ContextMenuItem | '-';

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

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleContextMenu = useCallback<MouseEventHandler<HTMLElement>>(
    async (event) => {
      const options = optionsRef.current;
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();

      const res = await rpc(ShowContextMenu, {
        id: menuId,
        x: bounds.x,
        y: bounds.bottom,
        menuItems: options.map((opt) =>
          opt === '-'
            ? { id: '-', label: '-' }
            : { id: opt.id, label: opt.label }
        )
      });

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
    triggerProps: {
      [on === 'context' ? 'onContextMenu' : 'onClick']: handleContextMenu
    }
  };
}
