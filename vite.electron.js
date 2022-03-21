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
    sourcemap: 'inline',
    target: `node${node}`,
    outDir: join('build', 'electron'),
    minify: process.env.MODE !== 'development',
    lib: {
      entry: join(SRC_ROOT, 'app', 'entry', 'main.ts'),
      formats: ['cjs']
    },
    rollupOptions: {
      external: [
        'electron',
        'electron-devtools-installer',
        ...builtinModules.flatMap((p) => [p, `node:${p}`]),
        ...Object.keys(dependencies)
      ],
      output: {
        entryFileNames: '[name].cjs'
      }
    },
    emptyOutDir: true,
    brotliSize: false
  }
};

export default config;
