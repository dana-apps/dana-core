import { posix } from 'path';

export type DiscoveredModules = Record<string, Record<string, unknown>>;

export function discoverModuleExports<T>(
  modules: DiscoveredModules,
  fn: (x: unknown) => boolean
) {
  const res: { module: string; exports: T[] }[] = [];

  for (const [moduleName, moduleExports] of Object.entries(modules)) {
    const exports: T[] = [];

    for (const exported of Object.values(moduleExports)) {
      if (fn(exported)) {
        exports.push(exported as T);
      }
    }

    res.push({
      module: posix.basename(moduleName, posix.extname(moduleName)),
      exports
    });
  }

  return res;
}
