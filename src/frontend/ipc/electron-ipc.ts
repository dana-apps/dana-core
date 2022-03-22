import type { IpcRenderer } from 'electron';
import { EventInterface, FrontendIpc, RpcInterface } from '../../common/ipc';
import { Result } from '../../common/util/error';

/**
 * Electron frontend RPC bindings
 */
export class ElectronRendererIpc implements FrontendIpc {
  constructor(private ipc: IpcRenderer) {}

  invoke<Req, Res, Err>(
    descriptor: RpcInterface<Req, Res, never>,
    req: Req,
    sourceArchiveId?: string,
    paginationToken?: string
  ): Promise<Result<Res, Err>> {
    return this.ipc.invoke(
      descriptor.id,
      req,
      sourceArchiveId,
      paginationToken
    );
  }

  listen<Event>(
    descriptor: EventInterface<Event>,
    handler: (x: Event) => void | Promise<void>
  ): () => void {
    const ipcHandler = async (_: unknown, payload: Event) => {
      await handler(payload);
    };

    this.ipc.on(descriptor.id, ipcHandler);

    return () => {
      this.ipc.off(descriptor.id, ipcHandler);
    };
  }
}
