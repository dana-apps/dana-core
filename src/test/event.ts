import EventEmitter from 'eventemitter3';
import { isEqual } from 'lodash';
import { Dict } from '../common/util/types';

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

export function collectEvents<Event>(
  emitter: EventEmitter<Dict>,
  event: string
): Event[];
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
