import z from 'zod';
import { EventInterface, EventType } from './ipc';

export type Resource = { id: string };

export type ChangeEvent = EventType<typeof ChangeEvent>;
export const ChangeEvent = EventInterface({
  id: 'change',
  type: z.object({
    type: z.string(),
    ids: z.array(z.string())
  })
});

export interface ResourceList<T> {
  total: number;
  values: T[];
  next?: string;
  prev?: string;
}
export const ResourceList = <T>(type: z.ZodSchema<T>) =>
  z.object({
    total: z.number(),
    page: z.array(type),
    next: z.optional(z.string()),
    prev: z.optional(z.string())
  });
