import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { inlineLocalPreview, readSiblingFrom } from './local-preview-inline.mjs';

// Personal ALETHEIA runs as ES modules. Source-reading tests read app.js and its local feature modules
// as one script, in module evaluation order. logic.js and deck-loader.js stay separate shared files.
export const ALETHEIA_IMPORT = /^import\s+\{[\s\S]*?\}\s+from '\.\/([\w-]+\.js)';(?: \/\/ local-preview-hook)?\n/gm;
const SHARED = new Set(['local-preview.js', 'logic.js', 'deck-loader.js']);

export function aletheiaAppModules(dir) {
  const order = [];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(path.join(dir, file), 'utf8');
    for (const [, from] of source.matchAll(ALETHEIA_IMPORT)) {
      if (!SHARED.has(from) && existsSync(path.join(dir, from))) visit(from);
    }
    order.push(file);
  };
  visit('app.js');
  return order;
}

export function aletheiaAppScript(dir) {
  return aletheiaAppModules(dir).map((file) => inlineLocalPreview(readFileSync(path.join(dir, file), 'utf8'), readSiblingFrom(dir))
    .replace(ALETHEIA_IMPORT, '')
    .replace(/^export\s+\{[^}]*\}\s+from\s+'[^']+';\n/gm, '')
    .replace(/^import\s+'[^']+';\n/gm, '')
    .replace(/^export\s+(?=(?:async\s+)?function\b|let\b|const\b)/gm, '')
    .replace(/^export\s+\{[\s\S]*?\};\n/m, '')).join('\n');
}
