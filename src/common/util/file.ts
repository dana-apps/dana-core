export function createFileFilter(label: string, exts: string[]) {
  return {
    name: `${label} (${exts.join(', ')})`,
    extensions: exts.map((ext) => ext.replace(/^\./, ''))
  };
}
