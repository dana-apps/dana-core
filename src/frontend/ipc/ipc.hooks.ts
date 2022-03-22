import { omit } from 'lodash';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { EventInterface, FrontendIpc, RpcInterface } from '../../common/ipc';
import { ChangeEvent, Resource, ResourceList } from '../../common/resource';
import { required } from '../../common/util/assert';
import { Result } from '../../common/util/error';

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
  resource: RpcInterface<Resource, T>,
  id: string
): Result<T, Err> | undefined {
  const rpc = useRPC();

  // Latest value of the resource
  const [current, setCurrent] = useState<Result<T, Err>>();

  // Fetch the initial resource value
  useEffect(() => {
    rpc(resource, { id }).then((res) => {
      setCurrent(res);
    });
  }, [id, resource, rpc]);

  // Listen for change events and re-fetch on change
  useEvent(ChangeEvent, ({ type, ids }) => {
    if (type === resource.id && ids.includes(id)) {
      rpc(resource, { id }).then((res) => {
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
): ListCursor<T, Err> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const q = useMemo(query, deps);
  const rpc = useRPC();

  // Track page results
  // TODO: use an LRU cache for this maybe?
  const [data, setData] = useState<Record<string | symbol, ListCursorPage<T>>>(
    {}
  );

  // If the query fails, return the error to the caller
  const [error, setError] = useState<Err>();

  // Track the total count
  const [totalCount, setTotalCount] = useState<number>();

  // Track the current visible page so we know what to re-fetch when the query invalidates
  const currentPage = useRef<string>();

  const fetchPage = useCallback(
    async (page?: string) => {
      const res = await rpc(resource, q, page);
      if (res.status === 'error') {
        setError(res.error);
        return;
      }

      setTotalCount(res.value.total);

      return omit(res.value, 'total');
    },
    [q, resource, rpc]
  );

  // Invalidate and refetch on change
  useEvent(ChangeEvent, ({ type }) => {
    // Easiest invalidation strategy is to do it whenever the referenced resource changes.
    //
    // This means pushing the responsibility for firing a change event onto the backend if there are queries that
    // that may be invalidated by edits to other types of objects in the database.
    if (type !== resource.id) {
      return;
    }

    fetchPage(currentPage.current).then((pageValue) => {
      if (pageValue) {
        setData({
          [currentPage.current ?? DEFAULT_PAGE]: pageValue,
          [pageValue.page]: pageValue
        });
      }
    });
  });

  return useMemo(
    () => ({
      totalCount,
      error,
      setCurrentPage: (page) => {
        currentPage.current = page;
      },
      getPage: (page) => {
        const hit = data[page ?? DEFAULT_PAGE];
        if (hit) {
          return hit;
        }

        fetchPage(page).then((pageValue) => {
          if (pageValue) {
            setData((current) => ({
              ...current,
              [pageValue.page]: pageValue,
              [page ?? DEFAULT_PAGE]: pageValue
            }));
          }
        });
      }
    }),
    [totalCount, error, data, fetchPage]
  );
}

/** Represents an ongoing list query */
export interface ListCursor<T = unknown, Err = unknown> {
  /** Nonfatal error for the current query */
  error?: Err;

  /** Total count of the list */
  totalCount?: number;

  /** Set the pages that need to be refetched first when the query is invalidated */
  setCurrentPage: (page: string) => void;

  /** Return the current result for the specified page, fetching it if needed */
  getPage: (page?: string) => ListCursorPage<T> | undefined;
}

type ListCursorPage<T = unknown> = Omit<ResourceList<T>, 'total'>;

const DEFAULT_PAGE = Symbol('DEFAULT_PAGE');
