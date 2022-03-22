/** Result type for representing nonfatal errors */
export type Result<T = unknown, Err = unknown> = OkResult<T> | ErrorResult<Err>;

/** Returned when an operation succeeds */
export type OkResult<T = undefined> = { status: 'ok'; value: T };

/** Returned when an operation fails */
export type ErrorResult<Err> = { status: 'error'; error: Err };

/** Convenience for creating an OkResult */
export function ok(): OkResult<undefined>;
export function ok<T>(value: T): OkResult<T>;
export function ok(value?: unknown): OkResult<unknown> {
  return { status: 'ok', value };
}

/** Convenience for creating an ErrorResult */
export function error<Err>(error: Err): ErrorResult<Err> {
  return { status: 'error', error };
}
