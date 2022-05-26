import { string, z } from 'zod';
import {
  ErrorType,
  EventInterface,
  RequestType,
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

export const ShowFilePickerModal = RpcInterface({
  id: 'window/show-file-picker',
  request: z.object({
    title: z.string(),
    message: z.string(),
    confirmButtonLabel: z.string().optional(),
    filters: z
      .object({ extensions: z.string().array(), name: z.string() })
      .array()
      .optional()
  }),
  response: z.string().array().optional()
});

export const ReturnModalValue = RpcInterface({
  id: 'window/return-model-value',
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

export enum WindowSize {
  SMALL = 'small',
  NARROW = 'narrow',
  REGULAR = 'regular',
  DIALOG = 'dialog'
}

export const CreateWindow = RpcInterface({
  id: 'window/create',
  request: z.object({
    title: z.string(),
    path: z.string(),
    size: z.nativeEnum(WindowSize).optional()
  }),
  response: z.unknown()
});

export type CreateWindowOpts = RequestType<typeof CreateWindow>;
