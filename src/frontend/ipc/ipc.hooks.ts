import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  EventInterface,
  FrontendIpc,
  IpcInvokeResult,
  RpcInterface
} from '../../common/ipc';
import { ChangeEvent, Resource, ResourceList } from '../../common/resource';
import { required } from '../../common/util/assert';
import { ok, Result } from '../../common/util/error';

export const IpcContext = createContext<IpcContext | undefined>(undefined);

export interface IpcContext {
  documentId?: string;
  ipc: FrontendIpc;
}

/** Return the current ipc context */
export function useIpc() {
  return required(useContext(IpcContext), 'useIpc: No IpcContext found');
}

/** Return the id of the archive associated with the current window (if the current window represents an archive) */
export function useArchiveId() {
  const ctx = useIpc();

  return required(
    ctx.documentId,
    'useArchiveId: no documentId in current context'
  );
}

/** Listen for events over ipc */
export function useEvent<T>(event: EventInterface<T>, cb: (x: T) => void) {
  const ctx = useIpc();

  // Bind the callback to a ref so that we don't need to re-fire the effect when it changes.
  const cbRef = useRef(cb);
  cbRef.current = cb;

  useEffect(() => {
    const handler = (event: T) => cbRef.current(event);
    return ctx.ipc.listen(event, handler);
  }, [event, ctx]);
}

/** Return a dispatch function for making rpc calls */
export function useRPC() {
  const ctx = useIpc();

  return <Req, Res, Err>(
    descriptor: RpcInterface<Req, Res, Err>,
    req: Req,
    paginationToken?: string
  ) => {
    return ctx.ipc.invoke(descriptor, req, ctx.documentId, paginationToken);
  };
}

/** Fetch a single object over rpc and re-fetch whenever it changes */
export function useGet<T extends Resource, Err>(
  resource: RpcInterface<Resource, T>,
  id: string
): IpcInvokeResult<T, Err> | undefined;
export function useGet<T, Err>(
  resource: RpcInterface<Resource, T>,
  id: string,
  initial: T
): IpcInvokeResult<T, Err>;
export function useGet<T, Err>(
  resource: RpcInterface<Resource, T>,
  id: string,
  initial?: T
) {
  const rpc = useRPC();
  const [current, setCurrent] = useState(() => {
    if (!initial) {
      return undefined;
    }

    return ok(initial);
  });
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    rpc(resource, { id }).then((res) => {
      setCurrent(res);
    });
  }, [id, resource, rpc]);

  useEvent(ChangeEvent, ({ type, ids }) => {
    if (type === resource.id && ids.includes(id)) {
      rpc(resource, { id }).then((res) => {
        setCurrent(res);
      });
    }
  });

  return current as IpcInvokeResult<T, Err> | undefined;
}

/** Query a list over rpc and re-fetch when a change event affecting its type happens */
export function useList<T extends Resource, Q, Err>(
  resource: RpcInterface<Q, ResourceList<T>>,
  query: () => Q,
  deps: unknown[],
  initialPage?: string
): UseListResult<T, Err> | undefined {
  const [page, setPage] = useState(initialPage);
  const rpc = useRPC();
  const [current, setCurrent] =
    useState<IpcInvokeResult<ResourceList<T>, Err>>();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const q = useMemo(query, deps);

  useEffect(() => {
    rpc(resource, q).then((res) => {
      setCurrent(res);
    });
  }, [q, resource, rpc]);

  useEvent(ChangeEvent, ({ type }) => {
    if (type === resource.id) {
      rpc(resource, q, page).then((res) => {
        setCurrent(res);
      });
    }
  });

  if (current?.status !== 'ok') {
    return undefined;
  }

  return {
    status: 'ok',
    value: {
      ...current.value,
      setPage
    }
  };
}

export type UseListResult<T, Err> = Result<
  ResourceList<T> & {
    setPage: (page: string) => void;
  },
  Err
>;
