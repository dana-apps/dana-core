import {
  cloneElement,
  FC,
  ReactElement,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useDrag, useDragDropManager, useDrop } from 'react-dnd';
import { Result } from '../../../common/util/error';
import { Scheduler } from '../../../common/util/scheduler';
import { Dict } from '../../../common/util/types';

interface DraggableProps {
  children?: ReactElement;
  type: string;
  id: string;
}

export interface DragItem {
  id: string;
}

export const Draggable: FC<DraggableProps> = ({ children, type, id }) => {
  const [collected, drag, dragPreview] = useDrag<DragItem>(() => ({
    type,
    item: { id }
  }));

  if (!children) {
    return null;
  }

  return cloneElement(children, { ref: drag });
};

interface DropTargetProps {
  children?: ReactElement;
  types: Record<string, DropSpec>;
}

export interface DropTargetChildProps {
  dropAccepted?: boolean;
}

export interface DropSpec {
  validateDrop?: (id: string) => Promise<boolean>;
  accept: (id: string) => Promise<Result>;
}

export const DropTarget: FC<DropTargetProps> = ({ children, types }) => {
  const dnd = useDragDropManager();
  const [accepted, setAccepted] = useState<Dict<boolean>>({});
  const scheduler = useMemo(() => new Scheduler(), []);

  useEffect(() => {
    const monitor = dnd.getMonitor();

    return monitor.subscribeToStateChange(() => {
      if (!monitor.isDragging()) {
        setAccepted({});
      }
    });
  }, [dnd]);

  const [state, drop] = useDrop(
    () => ({
      accept: Object.keys(types),

      drop: async (item: DragItem, monitor) => {
        const type = monitor.getItemType();
        const spec = type && types[String(type)];
        if (!spec) {
          return;
        }

        scheduler.run(async () => {
          if (accepted[item.id] === false) {
            return;
          }

          const shouldAccept = spec.validateDrop
            ? await spec.validateDrop(item.id)
            : true;

          if (shouldAccept) {
            await spec.accept(item.id);
          }
        });
      },

      hover: (item, monitor) => {
        if (item.id in accepted) {
          return;
        }

        const type = monitor.getItemType();
        const spec = type && types[String(type)];
        if (!spec) {
          return;
        }

        scheduler.run(async () => {
          const ok = spec.validateDrop
            ? await spec.validateDrop(item.id)
            : true;
          setAccepted((prev) => ({ ...prev, [item.id]: ok }));
        });
      },

      collect: (monitor) => {
        const item = monitor.getItem();
        return {
          id: item ? item.id : undefined,
          active: !!item && monitor.isOver()
        };
      }
    }),
    [accepted]
  );

  const ok = state.active && state.id && accepted[state.id];

  if (!children) {
    return null;
  }

  return cloneElement(children, { ref: drop, dropAccepted: !!ok });
};
