import { IpcMain, WebContents } from 'electron';
import {
  ResponseType,
  RpcInterface,
  EventInterface,
  RequestType
} from '../../common/ipc';
import { Result } from '../../common/util/error';

export class ElectronRouter {
  private windows: Array<{ archiveId?: string; window: WebContents }> = [];
  constructor(private ipc: IpcMain) {}

  bindRpc<Rpc extends RpcInterface<unknown, unknown, unknown>>(
    descriptor: Rpc,
    handler: (request: RequestType<Rpc>) => Promise<Result<ResponseType<Rpc>>>
  ) {
    this.ipc.handle(descriptor.id, async (_, request: Request) =>
      handler(request)
    );
  }

  emit<Event>(
    descriptor: EventInterface<Event>,
    event: Event,
    targetArchiveId?: string
  ) {
    for (const { archiveId, window } of this.windows) {
      if (!targetArchiveId || archiveId === targetArchiveId) {
        window.send(descriptor.id, event);
      }
    }
  }

  addWindow(window: WebContents, archiveId?: string) {
    this.windows.push({ window, archiveId });
  }

  removeWindow(window: WebContents) {
    const index = this.windows.findIndex((x) => x.window === window);

    if (index >= 0) {
      this.windows.splice(index, 1);
    }
  }
}
