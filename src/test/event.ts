import EventEmitter from 'eventemitter3';
import { isEqual, noop } from 'lodash';
import { Dict } from '../common/util/types';

/**
 * Pause execution until an event fires with an expected payload.
 *
 * @param emitter Eventemitter to test
 * @param event Event to wait for
 * @param expectedPayload Expected arguments for the event (deep equality)
 */
export function waitUntilEvent<Params extends unknown[]>(
  emitter: EventEmitter<Dict>,
  event: string,
  ...expectedPayload: unknown[]
) {
  return new Promise<Params>((resolve) => {
    emitter.on(event, (...payloadVal) => {
      if (
        expectedPayload.length === 0 ||
        isEqual(expectedPayload, payloadVal)
      ) {
        resolve(payloadVal as Params);
      }
    });
  });
}

/**
 * Return a mutable array that gathers events fired on an eventemitter.
 *
 * @param emitter Eventemitter to test
 * @param event Event to gather
 * @returns A mutable array that fills with each event received.
 */
export function collectEvents<Event>(
  emitter: EventEmitter<Dict>,
  event: string
): { events: Event[]; received(): Promise<void> };

/**
 * Return a mutable array that gathers events fired on an eventemitter.
 *
 * @param emitter Eventemitter to test
 * @param event Event to gather
 * @param fn Mapping function to extract data from the event
 * @returns A mutable array that fills with the result of `fn` for each event received.
 */
export function collectEvents<Event, T>(
  emitter: EventEmitter<Dict>,
  event: string,
  fn: (event: Event) => T
): { events: T[]; received(): Promise<void> };
export function collectEvents(
  emitter: EventEmitter<Dict>,
  event: string,
  fn?: (event: unknown) => unknown
) {
  let onReceived = noop;

  const events: unknown[] = [];
  emitter.on(event, (event) => {
    events.push(fn ? fn(event) : event);
    onReceived();
  });

  const received = new Promise<void>((resolve) => {
    onReceived = resolve;
  });

  return {
    events,
    received: () =>
      Promise.race([
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Timed out waiting for event'));
          }, 5_000);
        }),
        received
      ])
  };
}
