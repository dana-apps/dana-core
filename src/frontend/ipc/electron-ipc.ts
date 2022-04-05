import type { IpcRenderer } from 'electron';
import {
  EventInterface,
  FrontendIpc,
  PageRange,
  RpcInterface
} from '../../common/ipc.interfaces';
import { Result } from '../../common/util/error';

/**
 * Binds an electron frontend to apis in the main process set up using `ElectronRouter`
 */
export class ElectronRendererIpc implements FrontendIpc {
  constructor(private ipc: IpcRenderer) {}

  invoke<Req, Res, Err>(
    descriptor: RpcInterface<Req, Res, never>,
    req: Req,
    sourceArchiveId?: string,
    range?: PageRange
  ): Promise<Result<Res, Err>> {
    return this.ipc.invoke(descriptor.id, req, sourceArchiveId, range);
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
