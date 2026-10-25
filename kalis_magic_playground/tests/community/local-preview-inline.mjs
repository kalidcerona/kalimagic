import { readFileSync } from 'node:fs';

// Personal apps wire the localhost-only hook with marked lines: an import of local-preview.js(mjs) and one call.
// Tests that run an app's modules as one classic script put that module's code back inline at the call line,
// so the hook still runs at the same point.
const CALL = /^installLocalPreview\((.*)\); \/\/ local-preview-hook$/m;
const IMPORT = /^import \{ installLocalPreview \} from '\.\/(local-preview\.m?js)'; \/\/ local-preview-hook\n/m;

export function inlineLocalPreview(source, readSibling) {
  const file = source.match(IMPORT)?.[1];
  if (!file) return source;
  // Marked imports only bring in names the hook uses; the concatenated script already shares one scope.
  const hook = readSibling(file).replace(/^export function /m, 'function ');
  return source.replace(/^import .*\/\/ local-preview-hook\n/gm, '').replace(CALL, (_, body) => `{\n${hook}installLocalPreview(${body});\n}`);
}

export const readSiblingFrom = (dir) => (file) => readFileSync(new URL(file, dir instanceof URL ? dir : `file://${dir.replace(/\/?$/, '/')}`), 'utf8');
