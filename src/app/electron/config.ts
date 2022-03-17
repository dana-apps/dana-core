import isDev from "electron-is-dev";
import path from "path";

/** Relative location of frontend bundle */
const FRONTEND_BUILD_DIR = `../../frontend`;
const DEFAULT_FRONTEND_SOURCE_URL = isDev
  ? "http://localhost:3000/frontend/index.html"
  : `file://${path.join(__dirname, FRONTEND_BUILD_DIR, "index.html")}`;

/** Enable developer tools */
export const SHOW_DEVTOOLS = process.env.SHOW_DEVTOOLS || isDev ? false : true;

/** Override frontend source URL */
export const FRONTEND_SOURCE_URL =
  process.env.FRONTEND_SOURCE_URL ?? DEFAULT_FRONTEND_SOURCE_URL;
