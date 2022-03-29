import * as crypto from 'crypto';

/**
 * Return a promise that resolves when a stream ends or errors
 *
 * @param stream Stream to wait for end of
 * @returns A promise that resolves when `stream` ends or errors
 */
export function streamEnded(
  stream: NodeJS.ReadableStream | NodeJS.WritableStream
) {
  return new Promise((resolve, reject) => {
    stream.on('close', resolve);
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

/**
 * Return a sha256 hash (in url-safe base64 encoding) of a binary stream.
 *
 * @param stream Binary stream to hash
 * @returns Hash digest of `stream`
 */
export const hashStream = async (stream: NodeJS.ReadableStream) => {
  const hasher = crypto.createHash('sha256');
  stream.pipe(hasher);

  await streamEnded(stream);
  return hasher.digest().toString('base64url');
};
