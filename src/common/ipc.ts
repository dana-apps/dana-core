import z from 'zod';
import { Result } from './util/error';

/** Represent an rpc call */
export interface RpcInterface<Request, Response, Error = never> {
  request: z.Schema<Request>;
  response: z.Schema<Response>;
  error?: z.Schema<Error>;
  id: string;
}
export const RpcInterface = <Request, Response, Error = never>(
  rpc: RpcInterface<Request, Response, Error>
) => rpc;

/** Represent a pubsub event */
export interface EventInterface<Event> {
  type: z.Schema<Event>;
  id: string;
}
export const EventInterface = <Event>(event: EventInterface<Event>) => event;

/** Frontend interface for IPC bindings */
export interface FrontendIpc {
  invoke<Req, Res, Err>(
    descriptor: RpcInterface<Req, Res, Err>,
    req: Req,
    sourceArchiveId?: string,
    paginationToken?: string
  ): Promise<IpcInvokeResult<Res, Err>>;

  listen<Event>(
    descriptor: EventInterface<Event>,
    handler: (x: Event) => void | Promise<void>
  ): () => void;
}

/** If an RPC call doesn't raise nonfatal errors, don't make the user check for it */
export type IpcInvokeResult<T, Error> = Error extends never
  ? { status: 'ok'; value: T }
  : Result<T, Error>;

export type RequestType<T extends RpcInterface<unknown, unknown, unknown>> =
  z.TypeOf<T['request']>;
export type ResponseType<T extends RpcInterface<unknown, unknown, unknown>> =
  z.TypeOf<T['response']>;
export type ErrorType<T extends RpcInterface<unknown, unknown, unknown>> =
  z.TypeOf<NonNullable<T['error']>>;
export type EventType<T extends EventInterface<unknown>> = z.TypeOf<
  NonNullable<T['type']>
>;
