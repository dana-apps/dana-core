import * as crypto from 'crypto';

export const streamEnded = (s: NodeJS.ReadableStream | NodeJS.WritableStream) =>
  new Promise((resolve, reject) => {
    s.on('close', resolve);
    s.on('end', resolve);
    s.on('error', reject);
  });

export const hashStream = async (s: NodeJS.ReadableStream) => {
  const hasher = crypto.createHash('sha256');
  s.pipe(hasher);

  await streamEnded(s);
  return hasher.digest().toString('base64url');
};
