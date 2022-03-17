/* eslint-env node */

import { chrome } from "./.electron-vendors.cache.json";
import { join } from "path";
import { builtinModules } from "module";
import react from "@vitejs/plugin-react";

const FRONTEND_ROOT = join(__dirname, "src", "frontend");

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  plugins: [react()],
  base: "",
  root: join(__dirname, "src"),

  server: {
    fs: {
      strict: true,
    },
  },

  build: {
    sourcemap: true,
    target: `chrome${chrome}`,
    outDir: "dist/renderer",
    assetsDir: ".",
    rollupOptions: {
      input: join(FRONTEND_ROOT, "index.html"),
      external: [...builtinModules.flatMap((p) => [p, `node:${p}`])],
    },
    emptyOutDir: true,
    brotliSize: false,
  },
  test: {
    environment: "happy-dom",
  },
};

export default config;
