import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { inlineLocalPreview, readSiblingFrom } from './local-preview-inline.mjs';

// CHOICE (personal zz4 and the friend snapshot) runs app.js as an ES module entry with local feature
// modules, and logic.js is a facade over logic-*.js. Source-reading tests read the entry or the facade
// and their modules as one script, in module evaluation order, without the generated import headers
// and export footers. home-manifest.js and builtin-lists.js stay separate shared files.
export const CHOICE_IMPORT = /^import\s+(?:\{[\s\S]*?\}\s+from\s+)?'\.\/([\w-]+\.js)';(?: \/\/ local-preview-hook)?\n/gm;
const CHOICE_EXPORT = /^export\s+\{[\s\S]*?\}(?:\s+from\s+'\.\/[\w-]+\.js')?;\n/gm;
const APP_SHARED = new Set(['local-preview.js', 'logic.js', 'home-manifest.js', 'builtin-lists.js']);
const LOGIC_SHARED = new Set(['builtin-lists.js']);

function modules(dir, entry, shared) {
  const order = [];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(path.join(dir, file), 'utf8');
    for (const [, from] of source.matchAll(CHOICE_IMPORT)) {
      if (!shared.has(from) && existsSync(path.join(dir, from))) visit(from);
    }
    order.push(file);
  };
  visit(entry);
  return order;
}

export function choiceModuleScript(dir, file) {
  return inlineLocalPreview(readFileSync(path.join(dir, file), 'utf8'), readSiblingFrom(dir)).replace(CHOICE_IMPORT, '').replace(CHOICE_EXPORT, '');
}

export function choiceAppModules(dir) {
  return modules(dir, 'app.js', APP_SHARED);
}

export function choiceAppScript(dir) {
  return choiceAppModules(dir).map((file) => choiceModuleScript(dir, file)).join('\n');
}

export function choiceLogicModules(dir) {
  return modules(dir, 'logic.js', LOGIC_SHARED);
}

export function choiceLogicScript(dir) {
  return choiceLogicModules(dir).map((file) => choiceModuleScript(dir, file)).join('\n');
}
