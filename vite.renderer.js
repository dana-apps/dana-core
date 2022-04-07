/* eslint-env node */

import { chrome } from './.electron-vendors.cache.json';
import { join, resolve } from 'path';
import react from '@vitejs/plugin-react';

const SRC_ROOT = resolve('src');

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  plugins: [react()],
  root: SRC_ROOT,
  base: '',

  server: {
    fs: {
      strict: true
    }
  },

  build: {
    sourcemap: true,
    target: `chrome${chrome}`,
    outDir: join(SRC_ROOT, '..', 'build', 'renderer'),

    assetsDir: '.',
    rollupOptions: {
      input: join(SRC_ROOT, 'desktop.html')
    },
    emptyOutDir: true,
    brotliSize: false
  },
  test: {
    environment: 'happy-dom'
  }
};

export default config;
