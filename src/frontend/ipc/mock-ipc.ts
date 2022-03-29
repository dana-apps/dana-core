import { EventEmitter } from 'eventemitter3';
import { isEqual } from 'lodash';
import {
  EventInterface,
  FrontendIpc,
  RpcInterface
} from '../../common/ipc.interfaces';
import { Resource } from '../../common/resource';
import { required } from '../../common/util/assert';
import { Result } from '../../common/util/error';

interface MockedIpcMethod<Req = unknown, Res = unknown, Err = unknown> {
  type: RpcInterface<Req, Res, Err>;
  params?: Req;
  result: MockedResult<Req, Res, Err>;
}

type MockedResult<Req, Res, Err> = (
  req: Req,
  sourceArchiveId?: string,
  paginationToken?: string
) => Promise<Result<Res, Err>>;

/**
 * Mock instance of FrontendIpc for tests.
 */
export class MockIpc implements FrontendIpc {
  private events = new EventEmitter();
  private rpcCalls: MockedIpcMethod[] = [];

  invoke<Req, Res, Err>(
    descriptor: RpcInterface<Req, Res, Err>,
    req: Req,
    sourceArchiveId?: string,
    paginationToken?: string
  ): Promise<Result<Res, Err>> {
    const matchingCall = required(
      this.rpcCalls.find(
        (x) =>
          (x.type.id === descriptor.id && !x.params) || isEqual(x.params, req)
      ),
      'Unrecognized rpc method:',
      descriptor.id
    ) as MockedIpcMethod<Req, Res, Err>;

    return matchingCall.result(
      req,
      sourceArchiveId,
      paginationToken
    ) as Promise<Result<Res, Err>>;
  }

  listen<Event>(
    descriptor: EventInterface<Event>,
    handler: (x: Event) => void | Promise<void>
  ): () => void {
    this.events.on(descriptor.id, handler);

    return () => {
      this.events.off(descriptor.id, handler);
    };
  }

  emit<Event>(descriptor: EventInterface<Event>, value: Event) {
    this.events.emit(descriptor.id, value);
  }

  handle<Req, Res, Err>(mock: MockedIpcMethod<Req, Res, Err>) {
    this.rpcCalls.unshift(mock as MockedIpcMethod);
  }

  handleGet<Res extends Resource, Err>(
    type: RpcInterface<Resource, Res, Err>,
    result: Res
  ) {
    this.handle({
      type,
      params: { id: result.id },
      result: async () => ({
        status: 'ok',
        value: result
      })
    });
  }
}
