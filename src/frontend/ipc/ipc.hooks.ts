import EventEmitter from 'eventemitter3';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  EventInterface,
  FrontendIpc,
  RpcInterface
} from '../../common/ipc.interfaces';
import { ChangeEvent, Resource, ResourceList } from '../../common/resource';
import { required } from '../../common/util/assert';
import { ok, Result } from '../../common/util/error';
import { Scheduler } from '../../common/util/scheduler';

export const IpcContext = createContext<IpcContext | undefined>(undefined);

export interface IpcContext {
  documentId?: string;
  ipc: FrontendIpc;
}

/**
 * Return the current ipc context
 **/
function useIpc() {
  return required(useContext(IpcContext), 'useIpc: No IpcContext found');
}

/**
 * Return the id of the archive associated with the current window (throws if the current window does not represent
 * an archive)
 **/
export function useArchiveId() {
  const ctx = useIpc();

  return required(
    ctx.documentId,
    'useArchiveId: no documentId in current context'
  );
}

/**
 * Subscribe to a pubsub event over ipc.
 *
 * @param event Event to subscribe to
 * @param cb Event handler function
 */
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

/**
 * Return a dispatch function for making rpc calls
 *
 * @returns Dispatch function for rpc calls
 */
export function useRPC() {
  const ctx = useIpc();

  return useCallback(
    <Req, Res, Err>(
      descriptor: RpcInterface<Req, Res, Err>,
      req: Req,
      paginationToken?: string
    ) => {
      return ctx.ipc.invoke(descriptor, req, ctx.documentId, paginationToken);
    },
    [ctx.ipc, ctx.documentId]
  );
}

/**
 * Fetch a single object by type and id and re-fetch whenever a change event affecting it is received.
 *
 * @param resource RPC method to fetch the resource from – the returned value must be an object with an id.
 * @param id Id of the object to fetch
 * @returns Result object containing the latest value of the resource, or undefined if it the call has not yet resolved.
 */
export function useGet<T extends Resource, Err>(
  resource: RpcInterface<Resource, T, Err>,
  id: string
): Result<T, Err> | undefined;
/**
 * Fetch a singleton object by type and re-fetch whenever a change event affecting it is received.
 *
 * @param resource RPC method to fetch the resource from – the returned value must be an object with an id.
 * @returns Result object containing the latest value of the resource, or undefined if it the call has not yet resolved.
 */
export function useGet<T extends Resource, Err>(
  resource: RpcInterface<undefined, T, Err>
): Result<T, Err> | undefined;
export function useGet<T extends Resource, Err>(
  resource: RpcInterface<Resource | undefined, T, Err>,
  id?: string
): Result<T, Err> | undefined {
  const rpc = useRPC();

  // Latest value of the resource
  const [current, setCurrent] = useState<Result<T, Err>>();

  // Fetch the initial resource value
  useEffect(() => {
    rpc(resource, id ? { id } : undefined).then((res) => {
      setCurrent(res);
    });
  }, [id, resource, rpc]);

  // Listen for change events and re-fetch on change
  useEvent(ChangeEvent, ({ type, ids }) => {
    if (type === resource.id && (!id || ids.includes(id))) {
      rpc(resource, id ? { id } : undefined).then((res) => {
        setCurrent(res);
      });
    }
  });

  return current as Result<T, Err> | undefined;
}

/**
 * Query a list over rpc and re-fetch when a change event affecting its type happens
 *
 * @param resource RPC call for performing the query.
 * @param query Function returning parameters to the query.
 * @param deps Dependencies array for `query`.
 * @returns `ListResult` containing the current list value.
 */
export function useList<T extends Resource, Q, Err>(
  resource: RpcInterface<Q, ResourceList<T>, Err>,
  query: () => Q,
  deps: unknown[]
): ListCursor<T, Err> | undefined {
  type DataState = Omit<ListCursor<T, Err>, 'fetchMore' | 'active' | 'events'>;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const q = useMemo(query, deps);
  const rpc = useRPC();

  // If the query fails, return the error to the caller
  const [state, setState] = useState<DataState>();

  const [active, setActive] = useState(false);

  const scheduler = useMemo(() => new Scheduler(), []);
  const events = useMemo(() => new EventEmitter<ListCursorEvents>(), []);

  const paginationToken = useRef<{ next?: string }>();
  const firstLoad = useRef(true);

  // Triggered on first load, data change and when the query changes
  const refetchAll = useCallback(
    () =>
      scheduler.run(async () => {
        if (!firstLoad.current) {
          events.emit('change');
        }

        firstLoad.current = false;
        setActive(true);

        try {
          const data = await rpc(resource, q);
          if (data.status === 'error') {
            return setState({
              items: [],
              error: data.error,
              totalCount: 0
            });
          }

          paginationToken.current = data.value;

          setState({
            items: data.value.items,
            totalCount: data.value.total
          });
        } finally {
          setActive(false);
        }
      }),
    [events, q, resource, rpc, scheduler]
  );

  // Refetch all when the query changes or on first load
  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  // Invalidate and refetch when the backend emits a change event
  useEvent(ChangeEvent, async ({ type }) => {
    // Easiest invalidation strategy is to do it whenever the referenced resource changes.
    //
    // This means pushing the responsibility for firing a change event onto the backend if there are queries
    // that may be invalidated by edits to other types of objects in the database.
    if (type === resource.id) {
      refetchAll();
      events.emit('change');
    }
  });

  return useMemo(
    () =>
      state && {
        ...state,
        events,
        active,
        reset: refetchAll,
        fetchMore: (start, end) =>
          scheduler.run(async () => {
            setActive(true);
            const addedItems: T[] = [];

            while (
              addedItems.length < end - start &&
              !(paginationToken.current && !paginationToken.current.next)
            ) {
              const res = await rpc(resource, q, paginationToken.current?.next);
              if (res.status === 'error') {
                return setState(
                  (prev) =>
                    prev && {
                      ...prev,
                      error: res.error
                    }
                );
              }

              addedItems.push(...res.value.items);
              paginationToken.current = res.value;
            }

            setState(
              (prev) =>
                prev && {
                  ...prev,
                  items: [...(prev?.items ?? []), ...addedItems]
                }
            );

            setActive(false);
          })
      },
    [active, q, refetchAll, resource, rpc, events, scheduler, state]
  );
}

export function useListAll<T extends Resource, Q, Err>(
  resource: RpcInterface<Q, ResourceList<T>, Err>,
  query: () => Q,
  deps: unknown[]
): Result<T[]> | undefined {
  const rpc = useRPC();
  const { ipc } = useIpc();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const q = useMemo(query, deps);
  const [data, setData] = useState<Result<T[]>>();

  useEffect(() => {
    const fetchAll = async () => {
      const items: T[] = [];

      let page;
      do {
        const res: Result<ResourceList<T>> = await rpc(resource, q, page);
        if (res.status !== 'ok') {
          return res;
        }

        items.push(...res.value.items);
        page = res.value.next;
      } while (page);

      return ok(items);
    };

    fetchAll().then(setData);

    return ipc.listen(ChangeEvent, (event) => {
      if (event.type === resource.id) {
        fetchAll().then(setData);
      }
    });
  }, [ipc, q, resource, rpc]);

  return data;
}

/**
 * Represents a paginated list query suitable for display in a virtualized list view.
 **/
export interface ListCursor<T extends Resource = Resource, Err = unknown> {
  /** Error that ocurred while making the query */
  error?: Err;

  /** The total number of values represented by the query */
  totalCount: number;

  /** Events relating to the query */
  events: EventEmitter<ListCursorEvents>;

  /** All items fetched so far */
  items: T[];

  /** Extend the cursor's range over the query */
  fetchMore: (start: number, end: number) => Promise<void>;

  /** True if data is currently being fetched */
  active: boolean;
}

interface ListCursorEvents {
  /** Emitted when the query is invalidated and any downstream cache should be cleared. */
  change: [];
}
