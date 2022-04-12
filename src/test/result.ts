import { z } from 'zod';
import { assert } from '../common/util/assert';
import { Result } from '../common/util/error';

export function requireSuccess<T>(x: Result<T>) {
  assert(x.status === 'ok', 'Expected operation to succeed. Got result:', x);

  return x.value;
}

export function requireFailure<T>(x: Result<unknown, T>) {
  assert(x.status === 'error', 'Expected operation to fail. Got result:', x);

  return x.error;
}

export function requireFailureType<T>(schema: z.Schema<T>, x: Result<unknown>) {
  const error = requireFailure(x);
  return schema.parse(error);
}
