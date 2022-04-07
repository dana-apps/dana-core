import { z } from 'zod';
import { EventInterface, RpcInterface } from './ipc.interfaces';

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
