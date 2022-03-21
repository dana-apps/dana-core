import z from 'zod';
import { RequestType, RpcInterface } from '../ipc';

export enum CreateArchiveError {
  CANCELLED = 'CANCELLED'
}

export type CreateArchiveRequest = RequestType<typeof CreateArchive>;
export const CreateArchive = RpcInterface({
  id: 'create-archive',
  request: z.undefined(),
  response: z.undefined(),
  error: z.nativeEnum(CreateArchiveError)
});
