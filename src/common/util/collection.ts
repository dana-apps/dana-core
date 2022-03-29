/**
 * Map subclass that adds and returns a default value for missing keys.
 */
export class DefaultMap<Key, Val> extends Map<Key, Val> {
  constructor(private defaultFn: (key: Key) => Val) {
    super();
  }

  get(key: Key) {
    let val = super.get(key);
    if (typeof val === 'undefined') {
      val = this.defaultFn(key);
      this.set(key, val);
    }
    return val;
  }
}

/**
 * Typesafe tuple helper
 *
 * @param args Contents of the tuple
 */
export function tuple<T extends string[]>(...args: T): T;
export function tuple<T extends unknown[]>(...args: T): T;
export function tuple<T extends unknown[]>(...args: T): T {
  return args;
}
