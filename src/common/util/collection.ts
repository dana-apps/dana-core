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
