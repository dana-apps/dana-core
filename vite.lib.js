import { node } from './.electron-vendors.cache.json';
import { join, resolve } from 'path';
import { builtinModules } from 'module';
import { dependencies } from './package.json';

const SRC_ROOT = resolve('src');

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  build: {
    target: `node${node}`,
    outDir: join('lib'),
    minify: false,
    lib: {
      entry: join(SRC_ROOT, 'app', 'entry', 'lib.ts'),
      formats: ['cjs']
    },
    rollupOptions: {
      external: [
        ...builtinModules.flatMap((p) => [p, `node:${p}`]),
        ...Object.keys(dependencies)
      ],
      output: {
        entryFileNames: '[name].js'
      }
    },
    emptyOutDir: true,
    brotliSize: false
  }
};

export default config;
