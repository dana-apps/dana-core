/**
 * Typesafe assert helper
 *
 * @param condition Condition to test
 * @param msg Error message if condition fails
 * @param args Appended to the error message
 */
export function assert(
  condition: unknown,
  msg: string,
  ...args: unknown[]
): asserts condition {
  if (!condition) {
    throw Error(msg + args.map(String).join(' '));
  }
}

/**
 * Typesafe non-null / non-undefined assertion
 *
 * @param value Value to assert for non-null
 * @param msg Error message if condition fails
 * @param args Appended to the error message
 * @returns `value`, typed as non-null
 */
export function required<T>(
  value: T | undefined,
  msg: string,
  ...args: unknown[]
): T {
  if (!value) {
    throw Error(msg + args.map(String).join(' '));
  }
  return value;
}

/**
 * Utility for detecting missing if-else clauses. This will fail typecheck unless all possible values for `neverVal`
 * are exhausted in if-else clauses.
 *
 * @param neverVal A value to check for failure.
 * @param args Additional context for error message
 */
export function never(neverVal: never, ...args: string[]): never {
  assert(false, 'Unexpected value', neverVal, ...args);
}
