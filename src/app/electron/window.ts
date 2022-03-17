import { BrowserWindow } from "electron";

import { FRONTEND_SOURCE_URL, SHOW_DEVTOOLS } from "./config";
import { getResourcePath } from "./resources";

interface CreateFrontendWindow {
  /** Title of the window */
  title: string;
}

/** Show a new frontend window */
export function createFrontendWindow({ title }: CreateFrontendWindow) {
  const frontendWindow = new BrowserWindow({
    title,
    width: 800,
    height: 600,

    webPreferences: {
      additionalArguments: [],
      webSecurity: false,
      preload: getResourcePath("preload/browser-preload.js"),
    },
  });

  frontendWindow.loadURL(FRONTEND_SOURCE_URL);

  if (!SHOW_DEVTOOLS) {
    frontendWindow.removeMenu();
  }

  return frontendWindow;
}
