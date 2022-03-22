/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable react-hooks/rules-of-hooks */

import { FC } from 'react';
import { z } from 'zod';
import { renderHook } from '@testing-library/react-hooks';

import { RpcInterface } from '../../../common/ipc';
import { IpcContext, useGet, useList } from '../ipc.hooks';
import { MockIpc } from '../mock-ipc';
import { ChangeEvent, ResourceList } from '../../../common/resource';
import { required } from '../../../common/util/assert';

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
    const pages = [
      [{ id: '1' }, { id: '2' }],
      [{ id: '3' }, { id: '4' }],
      [{ id: '5' }, { id: '6' }]
    ];

    ipc.handle({
      type: ExampleQuery,
      result: async (_1, _2, page) => {
        const pageIndex = page ? Number(page) : 0;
        return {
          status: 'ok',
          value: {
            items: pages[pageIndex],
            total: 6,
            page: String(pageIndex),
            next:
              pageIndex >= pages.length - 1 ? undefined : String(pageIndex + 1),
            prev: pageIndex === 0 ? undefined : String(pageIndex - 1)
          }
        };
      }
    });

    const hook = ipcHookFixture({
      ipc,
      hookFn: () => useList(ExampleQuery, () => ({}), [])
    });

    // Loading state
    expect(hook.result.current.getPage()).toBeUndefined();

    // Initial value
    await hook.waitForNextUpdate();
    const initialPage = hook.result.current.getPage();
    expect(initialPage).toEqual({
      items: pages[0],
      page: '0',
      prev: undefined,
      next: '1'
    });
    expect(hook.result.current.totalCount).toEqual(6);

    // Subsequent pages
    const nextPageCursor = initialPage!.next!;
    expect(hook.result.current.getPage(nextPageCursor)).toBeUndefined();

    await hook.waitForNextUpdate();
    expect(hook.result.current.getPage(nextPageCursor)).toEqual({
      items: pages[1],
      page: '1',
      prev: '0',
      next: '2'
    });

    // Remote data changes
    hook.result.current.setCurrentPage(nextPageCursor);
    pages[1] = [{ id: '3a' }, { id: '4a' }];
    ipc.emit(ChangeEvent, { type: ExampleQuery.id, ids: [] });

    // Refetch of current page is immediately available
    await hook.waitForNextUpdate();
    expect(hook.result.current.getPage(nextPageCursor)).toEqual({
      items: pages[1],
      page: '1',
      prev: '0',
      next: '2'
    });
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

    hook.result.current.getPage();
    await hook.waitForNextUpdate();

    expect(hook.result.current.error).toEqual('oh no');
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
