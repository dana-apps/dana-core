/// <reference types="vite/client" />

declare module 'zip-stream' {
  import { Readable } from 'stream';
  export default class ZipStream extends Readable {
    entry(
      source: Buffer | Readable,
      data: { name: string },
      callback: (err: unknown) => void
    ): this;

    finalize(): void;
  }
}
