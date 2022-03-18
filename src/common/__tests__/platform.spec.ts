import path from 'path';
import { getFileUrl } from '../platform';

describe('getFileUrl', () => {
  test('creates file urls from windows path', () => {
    expect(getFileUrl('C:\\foo\\bar', path.win32)).toBe('file:///C:/foo/bar');
  });

  test('creates file urls from posix path', () => {
    expect(getFileUrl('/foo/bar', path.posix)).toBe('file:///foo/bar');
  });
});
