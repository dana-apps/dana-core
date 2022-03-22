import { posix } from 'path';

export type ModuleGlobEager = Record<string, Record<string, unknown>>;

/**
 * Given the result of vite's `import.meta.globEager`, filter all exported objects according to a predicate.
 *
 * @param modules Object of keys to modules similar to vite's `import.meta.globEager`
 * @param predicate Test
 * @returns Descriptor object for all modules with at least one matching export, containing an id for the module and
 *  the matching exports
 */
export function discoverModuleExports<T>(
  modules: ModuleGlobEager,
  predicate: (x: unknown) => boolean
) {
  const res: { module: string; exports: T[] }[] = [];

  for (const [moduleName, moduleExports] of Object.entries(modules)) {
    const exports: T[] = [];

    for (const exported of Object.values(moduleExports)) {
      if (predicate(exported)) {
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
