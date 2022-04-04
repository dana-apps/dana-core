import { OkResult, Result } from '../common/util/error';

export function requireSuccess<T>(x: Result<T>) {
  expect(x.status).toEqual('ok');
  const okResult = x as OkResult<T>;

  return okResult.value;
}
