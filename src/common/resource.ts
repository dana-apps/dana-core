import z from 'zod';
import { EventInterface, EventType, PageRange } from './ipc.interfaces';

/** An object with an ID */
export type Resource = { id: string };

/** Conventional event for indicating that one or more resources of a type has changed */
export type ChangeEvent = EventType<typeof ChangeEvent>;
export const ChangeEvent = EventInterface({
  id: 'change',
  type: z.object({
    /** Type of the resource that has changed */
    type: z.string(),

    /** IDs of the changed resources */
    ids: z.array(z.string())
  })
});

/** Conventional return type for a paginated query */
export interface ResourceList<T> {
  /** Total number of objects in the full query */
  total: number;

  /** Values in the current page */
  items: T[];

  /** Location of the current page in the total set of results */
  range: PageRange;
}
export const ResourceList = <T>(type: z.ZodSchema<T>) =>
  z.object({
    total: z.number(),
    items: z.array(type),
    range: z.object({
      limit: z.number(),
      offset: z.number()
    })
  });
