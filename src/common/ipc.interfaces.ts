import z from 'zod';
import { Result } from './util/error';

/**
 * Frontend interface for IPC bindings.
 *
 * Abstraction layer allows the frontend to not care whether it's the renderer process of an electron appp or a web
 * view into a remotely hosted archive instance.
 **/
export interface FrontendIpc {
  /**
   * Make an RPC call, returning its result.
   *
   * Nonfatal errors should be returned using the error object.
   * Fatal errors may be thrown, so should be handled in some minimal way.
   **/
  invoke<Req, Res, Err>(
    /** The RPC endpoint to call */
    descriptor: RpcInterface<Req, Res, Err>,

    /** Request passed to the endpoint */
    req: Req,

    /** If this originates from an archive window, identify the archive it relates to */
    sourceArchiveId?: string,

    /** Relevant for a paginated queries only – identify the page of results to fetch. */
    paginationToken?: string
  ): Promise<Result<Res, Err>>;

  /**
   * Subscribe to a pubsub event. Returns an unsubscribe function.
   */
  listen<Event>(
    /** Identify the event to subscribe to */
    descriptor: EventInterface<Event>,

    /** Event handler implementation */
    handler: (x: Event) => void | Promise<void>
  ): () => void;
}

/**
 * Represent a backend RPC service called by the frontend.
 **/
export interface RpcInterface<
  Request = unknown,
  Response = unknown,
  Error = unknown
> {
  /** Unique identifier for the rpc call */
  id: string;

  /** Schema definition for a request */
  request: z.Schema<Request>;

  /** Schema definition for a response */
  response: z.Schema<Response>;

  /** Schema definition for expected (ie. nonfatal) errors */
  error?: z.Schema<Error>;
}

/** Convenience function for defining a typed RpcInterface */
export const RpcInterface = <Request, Response, Error = never>(
  rpc: RpcInterface<Request, Response, Error>
) => rpc;

/** Represent a pubsub event */
export interface EventInterface<Event> {
  /** Unique identifier for the event */
  id: string;

  /** Schema definition for an event payload */
  type: z.Schema<Event>;
}

/** Convenience function for defining a typed pubsub event */
export const EventInterface = <Event>(event: EventInterface<Event>) => event;

/** Extract the request type of an RPC interface */
export type RequestType<T extends RpcInterface<unknown, unknown, unknown>> =
  z.TypeOf<T['request']>;

/** Extract the response type from an RPC interface */
export type ResponseType<T extends RpcInterface<unknown, unknown, unknown>> =
  z.TypeOf<T['response']>;

/** Extract the possible errors of an RPC interface */
export type ErrorType<T extends RpcInterface<unknown, unknown, unknown>> =
  z.TypeOf<NonNullable<T['error']>>;

/** Extract the event payload from a pubsub event interface */
export type EventType<T extends EventInterface<unknown>> = z.TypeOf<
  NonNullable<T['type']>
>;
