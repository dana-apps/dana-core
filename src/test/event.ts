import EventEmitter from 'eventemitter3';
import { isEqual } from 'lodash';
import { Dict } from '../common/util/types';

/**
 * Pause execution until an event fires with an expected payload.
 *
 * @param emitter Eventemitter to test
 * @param event Event to wait for
 * @param payload Expected arguments for the event (deep equality)
 */
export function waitUntilEvent(
  emitter: EventEmitter<Dict>,
  event: string,
  ...payload: unknown[]
) {
  return new Promise<unknown[]>((resolve) => {
    emitter.on(event, (...payloadVal) => {
      if (isEqual(payload, payloadVal)) {
        resolve(payloadVal);
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
): Event[];

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
): T[];
export function collectEvents(
  emitter: EventEmitter<Dict>,
  event: string,
  fn?: (event: unknown) => unknown
) {
  const events: unknown[] = [];
  emitter.on(event, (event) => events.push(fn ? fn(event) : event));

  return events;
}
