import { readFileSync } from 'node:fs';
import { inlineLocalPreview, readSiblingFrom } from './local-preview-inline.mjs';

// Pi Max runs as ES modules. vm tests run app.mjs and its local feature modules as one classic script,
// in module evaluation order, with the core.mjs names read from globalThis.__core.
export const PIMAX_APP_IMPORT = /^import\s+\{([\s\S]*?)\}\s+from "\.\/([\w-]+\.mjs)";\n/gm;

export function pimaxAppModules(dir) {
  const order = [];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(new URL(file, dir), 'utf8');
    for (const [, , from] of source.matchAll(PIMAX_APP_IMPORT)) if (from !== 'core.mjs') visit(from);
    order.push(file);
  };
  visit('app.mjs');
  return order;
}

export function pimaxAppScript(dir) {
  const coreNames = new Set();
  const bodies = pimaxAppModules(dir).map((file) => inlineLocalPreview(readFileSync(new URL(file, dir), 'utf8'), readSiblingFrom(dir))
    .replace(PIMAX_APP_IMPORT, (_, names, from) => {
      if (from === 'core.mjs') for (const name of names.split(',').map((item) => item.trim()).filter(Boolean)) coreNames.add(name);
      return '';
    })
    .replace(/^export\s+\{[\s\S]*?\};\n/m, ''));
  return `const {${[...coreNames].join(', ')}} = globalThis.__core;\n${bodies.join('\n')}`;
}
