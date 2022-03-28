import z from 'zod';
import { RequestType, RpcInterface } from '../ipc.interfaces';

export enum ArchiveOpeningError {
  CANCELLED = 'CANCELLED',
  DATABASE_INCONSISTENCY = 'DATABASE_INCONSISTENCY',
  IO_ERROR = 'IO_ERROR'
}

export type CreateArchiveRequest = RequestType<typeof CreateArchive>;

export const CreateArchive = RpcInterface({
  id: 'create-archive',
  request: z.object({}),
  response: z.object({}),
  error: z.nativeEnum(ArchiveOpeningError)
});
