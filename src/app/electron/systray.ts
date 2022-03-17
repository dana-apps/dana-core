import { Tray } from "electron";
import { memoize } from "lodash";
import { getResourcePath } from "./resources";

export const getSystray = memoize(() => {
  const tray = new Tray(getResourcePath('tray_16x16.png'));
  return tray;
});