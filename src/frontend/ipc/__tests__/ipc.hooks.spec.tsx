/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable react-hooks/rules-of-hooks */

import { FC } from 'react';
import { z } from 'zod';
import { act, renderHook } from '@testing-library/react-hooks';
import { takeRightWhile, times } from 'lodash';

import { RpcInterface } from '../../../common/ipc.interfaces';
import { IpcContext, ListCursor, useGet, useList } from '../ipc.hooks';
import { MockIpc } from '../mock-ipc';
import { ChangeEvent, Resource, ResourceList } from '../../../common/resource';

const ExampleResource = RpcInterface({
  id: 'example-resource',
  request: z.object({
    id: z.string()
  }),
  response: z.object({
    id: z.string(),
    label: z.string()
  })
});

const ExampleQuery = RpcInterface({
  id: 'example-query',
  request: z.object({}),
  response: ResourceList(
    z.object({
      id: z.string()
    })
  )
});

describe('useGet', () => {
  test('returns requested resource asynchronously, then updates when resource changes', async () => {
    const ipc = new MockIpc();
    ipc.handleGet(ExampleResource, { id: '1', label: 'Hello' });

    const hook = ipcHookFixture({
      ipc,
      hookFn: () => useGet(ExampleResource, '1')
    });

    // Loading state
    expect(hook.result.current).toBeUndefined();

    // Initial value
    await hook.waitForNextUpdate();
    expect(hook.result.current).toEqual({
      status: 'ok',
      value: {
        id: '1',
        label: 'Hello'
      }
    });

    // After update
    ipc.handleGet(ExampleResource, { id: '1', label: 'Goodbye' });
    ipc.emit(ChangeEvent, {
      type: ExampleResource.id,
      ids: ['1']
    });

    await hook.waitForNextUpdate();
    expect(hook.result.current).toEqual({
      status: 'ok',
      value: {
        id: '1',
        label: 'Goodbye'
      }
    });
  });

  test('presents errors to user', async () => {
    const ipc = new MockIpc();
    ipc.handle({
      type: ExampleResource,
      result: async () => ({
        status: 'error',
        error: 'oh no'
      })
    });

    const hook = ipcHookFixture({
      ipc,
      hookFn: () => useGet(ExampleResource, '1')
    });

    await hook.waitForNextUpdate();
    expect(hook.result.current).toEqual({
      status: 'error',
      error: 'oh no'
    });
  });
});

describe('useList', () => {
  test('returns requested query asynchronously, pages through the query, and re-fetches when resource changes', async () => {
    const ipc = new MockIpc();
    const data = [
      { id: '1' },
      { id: '2' },
      { id: '3' },
      { id: '4' },
      { id: '5' },
      { id: '6' },
      { id: '7' },
      { id: '8' }
    ];

    ipc.handle({
      type: ExampleQuery,
      result: async (_1, _2, { limit, offset } = { limit: 2, offset: 0 }) => {
        return {
          status: 'ok',
          value: {
            items: data.slice(offset, limit + offset),
            total: data.length,
            range: { limit, offset }
          }
        };
      }
    });

    const hook = ipcHookFixture({
      ipc,
      hookFn: () =>
        useList(ExampleQuery, () => ({}), [], { pageSize: 2, initialFetch: 2 })
    });

    // Loading state
    expect(hook.result.current).toBeUndefined();

    // Initial value
    await hook.waitForNextUpdate();
    expect(hook.result.current).toBeDefined();
    expect(getItems(hook.result.current)).toEqual(data.slice(0, 2));

    // Subsequent pages
    act(() => {
      hook.result.current?.fetchMore(1, 4);
    });
    await hook.waitForNextUpdate();
    expect(getItems(hook.result.current)).toEqual(data.slice(0, 4));

    // Fetch beyond end of data
    act(() => {
      hook.result.current?.fetchMore(3, 10);
    });
    await hook.waitForNextUpdate();
    expect(getItems(hook.result.current)).toEqual(data.flat());

    // Refetch on data invalidation
    hook.result.current?.setVisibleRange(2, 4);
    data[2] = { id: '3a' };
    data[3] = { id: '4a' };

    act(() => ipc.emit(ChangeEvent, { type: ExampleQuery.id, ids: [] }));
    await hook.waitForNextUpdate();

    expect(hook.result.current).toBeDefined();

    // This is currently over-fetching. The test has been made deliberately too lax in order to keep the main branch
    // green.
    //
    // Tracking issue: https://github.com/commonknowledge/dana-core/issues/34
    expect(getItems(hook.result.current)).toEqual(
      expect.arrayContaining([{ id: '3a' }, { id: '4a' }])
    );
  });

  test('presents errors to user', async () => {
    const ipc = new MockIpc();
    ipc.handle({
      type: ExampleQuery,
      result: async () => {
        return {
          status: 'error',
          error: 'oh no'
        };
      }
    });

    const hook = ipcHookFixture({
      ipc,
      hookFn: () => useList(ExampleQuery, () => ({}), [])
    });

    await hook.waitForNextUpdate();

    expect(hook.result.current?.error).toEqual('oh no');
  });
});

function ipcHookFixture<T>(opts: {
  ipc: MockIpc;
  hookFn: () => T;
  documentId?: string;
}) {
  const wrapper: FC = ({ children }) => (
    <IpcContext.Provider value={{ documentId: opts.documentId, ipc: opts.ipc }}>
      {children}
    </IpcContext.Provider>
  );

  return renderHook(opts.hookFn, { wrapper });
}

function getItems<T extends Resource>(cursor?: ListCursor<T>) {
  if (!cursor) {
    return;
  }

  const data = times(cursor.totalCount, cursor.get);
  const lastFetchedIndex =
    cursor.totalCount -
    takeRightWhile(data, (_, i) => !cursor.isLoaded(i)).length;
  return data.slice(0, lastFetchedIndex);
}
