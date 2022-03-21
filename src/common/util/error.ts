export type Result<T, Err = string> = OkResult<T> | ErrorResult<Err>;

export type OkResult<T = undefined> = { status: 'ok'; value: T };
export type ErrorResult<Err> = { status: 'error'; error: Err };

export function ok(): OkResult<undefined>;
export function ok<T>(value: T): OkResult<T>;
export function ok(value?: unknown): OkResult<unknown> {
  return { status: 'ok', value };
}

export function error<Err>(error: Err): ErrorResult<Err> {
  return { status: 'error', error };
}
