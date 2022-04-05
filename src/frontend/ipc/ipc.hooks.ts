import EventEmitter from 'eventemitter3';
import produce, { castDraft } from 'immer';
import { chunk, times } from 'lodash';
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
  PageRange,
  RpcInterface
} from '../../common/ipc.interfaces';
import { ChangeEvent, Resource, ResourceList } from '../../common/resource';
import { required } from '../../common/util/assert';
import { error, ok, Result } from '../../common/util/error';
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
      range?: PageRange
    ) => {
      return ctx.ipc.invoke(descriptor, req, ctx.documentId, range);
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
  deps: unknown[],
  { pageSize, initialFetch } = { pageSize: 50, initialFetch: 150 }
): ListCursor<T, Err> | undefined {
  // Internal state. Equal to what we return without the derived properties and helpers.
  type DataState = { total: number; pages: (T[] | undefined)[]; error?: Err };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const q = useMemo(query, deps);
  const rpc = useRPC();

  // If the query fails, return the error to the caller
  const [state, setState] = useState<DataState>();

  // Track whether the query is active or not
  const [active, setActive] = useState(false);

  // Track the current visible range so we know what to refetch
  const visibleRange = useRef<PageRange>({
    offset: 0,
    limit: initialFetch
  });

  // Serialize all asynchronous updates
  const scheduler = useMemo(() => new Scheduler(), []);

  // Notify subscribers when the query is invalidated so they can clear any downstream caches
  const events = useMemo(() => new EventEmitter<ListCursorEvents>(), []);

  // Is this the data load?
  const firstLoad = useRef(true);

  // Fetch a specified range of data and insert it into the page cache.
  const fetchRange = useCallback(
    async ({ offset, limit }: PageRange, opts: { clearCache: boolean }) => {
      const startPage = Math.floor(offset / pageSize);
      const endPage = Math.ceil((offset + limit) / pageSize);

      const data = await rpc(resource, q, {
        offset: startPage * pageSize,
        limit: (endPage - startPage) * pageSize
      });

      if (data.status === 'error') {
        return setState({
          pages: [],
          error: data.error,
          total: 0
        });
      }

      setState((prev = { pages: [], total: 0 }) =>
        produce(prev, (draft) => {
          if (opts.clearCache) {
            draft.pages.splice(0, draft.pages.length);
          }

          let pageIndex = startPage;
          draft.total = data.value.total;

          for (const page of chunk(data.value.items, pageSize)) {
            draft.pages[pageIndex] = castDraft(page);
            pageIndex += 1;
          }
        })
      );
    },
    [pageSize, q, resource, rpc]
  );

  // Triggered on first load, data change and when the query changes
  const refetchAll = useCallback(
    () =>
      scheduler.run(async () => {
        setActive(true);

        try {
          await fetchRange(visibleRange.current, { clearCache: true });
        } finally {
          if (!firstLoad.current) {
            firstLoad.current = false;
            events.emit('change');
          }

          setActive(false);
        }
      }),
    [events, fetchRange, scheduler]
  );

  // Refetch all when an invalidating parameter changes or on first load
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
    }
  });

  return useMemo(
    (): ListCursor<T, Err> | undefined =>
      state && {
        events,
        error: state.error,
        totalCount: state.total,
        get: (i: number) => {
          const page = state.pages[Math.floor(i / pageSize)];
          return page?.[i % pageSize];
        },
        isLoaded: (i: number) => {
          const page = state.pages[Math.floor(i / pageSize)];
          return page !== undefined;
        },
        active,
        setVisibleRange: (start, end) => {
          scheduler.run(async () => {
            visibleRange.current = {
              offset: start,
              limit: Math.max(0, end - start)
            };
          });
        },
        reset: refetchAll,
        fetchMore: (start, end) =>
          scheduler.run(async () => {
            setActive(true);

            try {
              const range = { offset: start, limit: Math.max(end - start, 0) };
              await fetchRange(range, { clearCache: false });
            } finally {
              setActive(false);
            }
          })
      },
    [state, events, active, refetchAll, pageSize, scheduler, fetchRange]
  );
}

export function useListAll<T extends Resource, Q, Err>(
  resource: RpcInterface<Q, ResourceList<T>, Err>,
  query: () => Q,
  deps: unknown[]
): Result<T[]> | undefined {
  const result = useList(resource, query, deps, {
    initialFetch: 10000,
    pageSize: 10000
  });
  return useMemo(() => {
    if (!result) {
      return;
    }

    if (result.error) {
      return error(result.error);
    }

    if (result.totalCount >= 10000) {
      throw Error('useListAll(): too many results returned');
    }

    return ok(times(result.totalCount, result.get) as T[]);
  }, [result]);
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
  get: (i: number) => T | undefined;

  /** All items fetched so far */
  isLoaded: (i: number) => boolean;

  /** Extend the cursor's range over the query */
  fetchMore: (start: number, end: number) => Promise<void>;

  /** Refetch the query, preserving any scroll positions */
  reset: () => Promise<void>;

  /** Notify the list observer the range that needs to be refetched when the query is invalidated */
  setVisibleRange: (start: number, end: number) => void;

  /** True if data is currently being fetched */
  active: boolean;
}

interface ListCursorEvents {
  /** Emitted when the query is invalidated and any downstream cache should be cleared. */
  change: [];
}

/**
 * Convert a ListCursor into an Iterable for (for...of) iteration.
 *
 * @param cursor ListCursor to iterate over.
 */
export function* iterateListCursor<T extends Resource>(cursor: ListCursor<T>) {
  for (let i = 0; i < cursor.totalCount; ++i) {
    yield cursor.get(i);
  }
}
