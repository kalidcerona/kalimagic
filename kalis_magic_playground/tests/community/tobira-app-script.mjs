import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Personal TOBIRA runs as ES modules. vm tests run app.js and its local feature modules as one classic script,
// in module evaluation order. logic.js and sensor-motion.js names are supplied by the test sandbox.
export const TOBIRA_IMPORT = /^import\s+\{[\s\S]*?\}\s+from '\.\/([\w-]+\.js)';\n/gm;
const SHARED = new Set(['logic.js', 'sensor-motion.js']);

export function tobiraAppModules(dir) {
  const order = [];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(path.join(dir, file), 'utf8');
    for (const [, from] of source.matchAll(TOBIRA_IMPORT)) {
      if (!SHARED.has(from) && existsSync(path.join(dir, from))) visit(from);
    }
    order.push(file);
  };
  visit('app.js');
  return order;
}

export function tobiraAppScript(dir) {
  return tobiraAppModules(dir).map((file) => readFileSync(path.join(dir, file), 'utf8')
    .replace(TOBIRA_IMPORT, '')
    .replace(/^export\s+\{[\s\S]*?\};\n/m, '')).join('\n');
}
