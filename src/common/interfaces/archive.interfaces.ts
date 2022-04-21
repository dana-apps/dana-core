import z from 'zod';
import { RequestType, RpcInterface } from '../ipc.interfaces';

/**
 * Represent the errors that can occur while opening an archive and should be presented to the user.
 */
export enum ArchiveOpeningError {
  CANCELLED = 'CANCELLED',
  DATABASE_INCONSISTENCY = 'DATABASE_INCONSISTENCY',
  IO_ERROR = 'IO_ERROR'
}

/**
 * Opens an archive directory. The user will be prompted for the location of the archive.
 */
export const OpenArchive = RpcInterface({
  id: 'create-archive',
  request: z.object({ create: z.boolean().optional() }),
  response: z.object({}),
  error: z.nativeEnum(ArchiveOpeningError)
});
export type CreateArchiveRequest = RequestType<typeof OpenArchive>;
