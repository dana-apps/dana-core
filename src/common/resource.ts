import z from 'zod';
import { EventInterface, EventType } from './ipc';

/** An object with in id */
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

  /** Pagination token for the current page of results */
  page: string;

  /** Pagination token for the next page of results (or undefined if the last page) */
  next?: string;

  /** Pagination token for the previous page of results (or undefined if the first page) */
  prev?: string;
}
export const ResourceList = <T>(type: z.ZodSchema<T>) =>
  z.object({
    total: z.number(),
    items: z.array(type),

    page: z.string(),
    next: z.optional(z.string()),
    prev: z.optional(z.string())
  });
