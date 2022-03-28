import EventEmitter from 'eventemitter3';
import { useEffect, useRef } from 'react';

export function useOnChanged<T>(
  val: T,
  fn: (current: T, prev: T) => void,
  deps: unknown[]
) {
  const prev = useRef(val);
  useEffect(() => {
    if (prev.current && val !== prev.current) {
      fn(val, prev.current);
      prev.current = val;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val, ...deps]);
}

export function useEventEmitter<T extends unknown[], Key extends string>(
  ee: EventEmitter<{ [P in Key]: T }>,
  event: Key,
  fn: (...args: T) => void
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const genericEmitter: EventEmitter<any> = ee;
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const handle = (...args: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fnRef.current(...(args as any));
    };

    genericEmitter.on(event, handle);
    return () => {
      genericEmitter.off(event, handle);
    };
  }, [genericEmitter, event]);
}
