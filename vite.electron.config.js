import { node } from "./.electron-vendors.cache.json";
import { join } from "path";
import { builtinModules } from "module";

const APP_ROOT = join(__dirname, "src", "app");

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  build: {
    sourcemap: "inline",
    target: `node${node}`,
    outDir: "dist/electron",
    minify: process.env.MODE !== "development",
    lib: {
      entry: join(APP_ROOT, "entry", "main.ts"),
      formats: ["cjs"],
    },
    rollupOptions: {
      external: [
        "electron",
        "electron-devtools-installer",
        ...builtinModules.flatMap((p) => [p, `node:${p}`]),
      ],
      output: {
        entryFileNames: "[name].cjs",
      },
    },
    emptyOutDir: true,
    brotliSize: false,
  },
};

export default config;
