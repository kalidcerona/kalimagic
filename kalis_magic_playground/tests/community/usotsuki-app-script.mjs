import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';

// USOTSUKI (personal zz7 and the friend snapshot) runs detector.js as an ES module entry with local
// feature modules. Source-reading tests read the entry and those modules as one script, in module
// evaluation order. logic.js and the recorder-*.js files stay separate shared files.
export const USOTSUKI_IMPORT = /^import\s+\{[\s\S]*?\}\s+from "\.\/([\w-]+\.js)";\n/gm;
const SHARED = new Set(['logic.js', 'recorder-trace.js', 'recorder-theme.js', 'recorder-engine.js']);
export const USOTSUKI_FEATURE_MODULES = new Set(['controller.js', 'dom.js', 'storage.js', 'heartbeat.js',
  'vibration.js', 'wake-lock.js', 'preferences.js', 'stage.js', 'bindings.js']);

export function usotsukiAppModules(dir) {
  const order = [];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(path.join(dir, file), 'utf8');
    for (const [, from] of source.matchAll(USOTSUKI_IMPORT)) {
      if (!SHARED.has(from) && existsSync(path.join(dir, from))) visit(from);
    }
    order.push(file);
  };
  visit('detector.js');
  return order;
}

export function usotsukiAppScript(dir) {
  return usotsukiAppModules(dir).map((file) => readFileSync(path.join(dir, file), 'utf8')
    .replace(USOTSUKI_IMPORT, '')
    .replace(/^export\s+\{[\s\S]*?\};\n/m, '')).join('\n');
}

// The same files with their import headers and export footers kept, for byte comparisons.
export function usotsukiAppSource(dir) {
  return usotsukiAppModules(dir).map((file) => readFileSync(path.join(dir, file), 'utf8')).join('\n');
}

// Runtime tests import `detector.js?<tag>` once per fixture to boot a fresh app against a fresh fake DOM.
// Before the split, that query re-evaluated the whole app. Carry the entry's query to its local feature
// modules so each fixture still gets a fresh app. Shared files (logic.js, recorder-*.js) stay cached,
// exactly as before.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    const parent = context.parentURL ? new URL(context.parentURL) : null;
    if (!parent || !parent.search || parent.protocol !== 'file:' || !specifier.startsWith('./')) return result;
    const url = new URL(result.url);
    if (url.protocol !== 'file:' || url.search || !USOTSUKI_FEATURE_MODULES.has(path.basename(url.pathname))) return result;
    if (path.dirname(url.pathname) !== path.dirname(parent.pathname)) return result;
    if (!existsSync(new URL('./detector.js', url))) return result;
    if (!USOTSUKI_FEATURE_MODULES.has(path.basename(parent.pathname)) && path.basename(parent.pathname) !== 'detector.js') return result;
    url.search = parent.search;
    return { ...result, url: url.href };
  },
});
