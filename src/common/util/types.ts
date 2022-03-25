export type UnwrapPromise<T> = T extends Promise<unknown>
  ? Parameters<NonNullable<Parameters<T['then']>[0]>>[0]
  : T;

export type Dict<T = unknown, Key extends string = string> = Record<Key, T>;
