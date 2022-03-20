import { z } from 'zod';

export const Asset = z.object({
  id: z.string()
});
export type Asset = z.TypeOf<typeof Asset>;
