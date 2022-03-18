export const assert = (x: boolean, msg: string, ...args: any[]): asserts x => {
  if (!x) {
    throw Error(msg + args.map(String).join(' '));
  }
};

export const required = <T>(
  x: T | undefined,
  msg: string,
  ...args: unknown[]
): T => {
  if (!x) {
    throw Error(msg + args.map(String).join(' '));
  }
  return x;
};
