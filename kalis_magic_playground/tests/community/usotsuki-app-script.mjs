import { existsSync, readFileSync } from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { inlineLocalPreview, readSiblingFrom } from './local-preview-inline.mjs';

// USOTSUKI (personal zz7 and the friend snapshot) runs detector.js as an ES module entry with local
// feature modules. Source-reading tests read the entry and those modules as one script, in module
// evaluation order. logic.js and the recorder-*.js files stay separate shared files.
export const USOTSUKI_IMPORT = /^(?:(?:import|export)\s+\{[^}]*\}\s+from|import)\s+"\.\/([\w-]+\.js)";(?: \/\/ local-preview-hook)?\n/gm;
const SHARED = new Set(['local-preview.js', 'logic.js', 'recorder-trace.js', 'recorder-theme.js', 'recorder-engine.js']);
export const USOTSUKI_FEATURE_MODULES = new Set(['controller.js', 'controller-state.js', 'controller-themes.js', 'controller-audio.js', 'controller-storage.js', 'controller-hold.js', 'controller-haptic.js', 'controller-screens.js', 'controller-attempts.js', 'controller-gestures.js', 'controller-display-theme.js', 'dom.js', 'storage.js', 'heartbeat.js',
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
  return usotsukiAppModules(dir).map((file) => inlineLocalPreview(readFileSync(path.join(dir, file), 'utf8'), readSiblingFrom(dir))
    .replace(USOTSUKI_IMPORT, '')
    .replace(/^export\s+\{[^}]*\};\n/m, '')).join('\n');
}

// The same files with their import headers and export footers kept, for byte comparisons.
export function usotsukiAppSource(dir) {
  return usotsukiAppModules(dir).map((file) => readFileSync(path.join(dir, file), 'utf8')).join('\n');
}

// Runtime tests import `detector.js?<tag>` once per fixture to boot a fresh app against a fresh fake DOM.
// Before the split, that query re-evaluated the whole app. Carry the entry's query to its local feature
// modules so each fixture still gets a fresh app. Shared files (logic.js, recorder-*.js) stay cached,
// exactly as before.
register('./usotsuki-resolve-hooks.mjs', import.meta.url);
