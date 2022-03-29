import EventEmitter from 'eventemitter3';
import { useEffect, useRef } from 'react';

/**
 * Listens to an eventemitter and tears down the subscription on unmount.
 *
 * @param ee Eventemitter to listen to
 * @param event Event to subscribe to
 * @param fn Handler function
 */
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
