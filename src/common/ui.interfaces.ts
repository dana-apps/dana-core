import { z } from 'zod';
import {
  ErrorType,
  EventInterface,
  ResponseType,
  RpcInterface
} from './ipc.interfaces';
import { Result } from './util/error';

export const MaximizationState = z.enum(['maximized', 'minimized', 'normal']);
export type MaximizationState = z.TypeOf<typeof MaximizationState>;

export const MinimizeWindow = RpcInterface({
  id: 'window/minimize',
  request: z.object({}),
  response: z.object({})
});
export const ToggleMaximizeWindow = RpcInterface({
  id: 'window/maximize',
  request: z.object({}),
  response: z.object({})
});
export const GetMaximizationState = RpcInterface({
  id: 'window/getstate',
  request: z.object({}),
  response: MaximizationState
});
export const MaximizationStateChanged = EventInterface({
  id: 'window:maximization-state-changed',
  type: MaximizationState
});

export const ShowModal = RpcInterface({
  id: 'window/show-modal',
  request: z.object({
    type: z.string(),
    title: z.string(),
    icon: z.string(),
    message: z.string(),
    confirmButtonLabel: z.string().optional(),
    cancelButtonLabel: z.string().optional()
  }),
  response: z.object({
    action: z.enum(['confirm', 'cancel'])
  })
});

export const CloseModal = RpcInterface({
  id: 'window/close-modal',
  request: z.object({
    returnId: z.string(),
    action: z.enum(['confirm', 'cancel'])
  }),
  response: z.object({})
});

export const ShowContextMenu = RpcInterface({
  id: 'window/show-context-menu',
  request: z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    menuItems: z.array(
      z.object({
        id: z.string(),
        label: z.string()
      })
    )
  }),
  response: z.object({
    action: z.string()
  }),
  error: z.enum(['cancelled'])
});
export type ShowContextMenuResponse = ResponseType<typeof ShowContextMenu>;
export type ShowContextMenuError = ErrorType<typeof ShowContextMenu>;
export type ShowContextMenuResult = Result<
  ShowContextMenuResponse,
  ShowContextMenuError
>;
