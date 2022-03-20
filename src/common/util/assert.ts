export function assert(x: boolean, msg: string, ...args: unknown[]): asserts x {
  if (!x) {
    throw Error(msg + args.map(String).join(' '));
  }
}

export function required<T>(
  x: T | undefined,
  msg: string,
  ...args: unknown[]
): T {
  if (!x) {
    throw Error(msg + args.map(String).join(' '));
  }
  return x;
}
