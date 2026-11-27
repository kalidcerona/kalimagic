import { cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ZZ_IMPORT_FILES = [
  'apply.mjs',
  'apply-merge.mjs',
  'apply-store.mjs',
  'apply-validate.mjs',
  'data.mjs',
  'data-zip.mjs',
  'ui.mjs',
  'ui-bootstrap.mjs',
];
export function zzImportFiles(target) {
  return target === 'hitsuzen' ? [...ZZ_IMPORT_FILES, 'legacy-start.mjs'] : ZZ_IMPORT_FILES;
}
export const ZZ_IMPORT_TARGETS = [
  'kairos',
  'kairos-classic',
  'release',
  'hitsuzen',
  'choice',
  'aletheia',
  'tobira',
  'usotsuki',
  'asrai',
  'alter',
  'tyche',
  'memdeck',
  'arosaegida',
  'pimax',
  'uramichi',
];
export function injectZzImport(html, target) {
  if (!ZZ_IMPORT_TARGETS.includes(target)) return html;
  if (html.includes('data-zz-bootstrap')) throw new Error('Duplicate ZZ import bootstrap');
  // Keep access enforcement synchronous; defer every app read until journal recovery finishes.
  // This repair listener is the only app DOM-ready listener without a readyState guard.
  html = html.replace(
    "document.addEventListener('DOMContentLoaded', function () {\n        watchModuleScript();",
    "(document.readyState === 'loading' ? callback => document.addEventListener('DOMContentLoaded', callback, {once:true}) : callback => callback())(function () {\n        watchModuleScript();",
  );
  const gated = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (tag, attrs, body) => {
    if (/id=["']friend-apps-check["']/.test(attrs)) return tag;
    const type = /\btype=["']([^"']*)["']/.exec(attrs)?.[1] || '';
    if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) return tag;
    if (type === 'module' && !/\bsrc=/.test(attrs)) {
      if (target !== 'hitsuzen' || !body.includes('migrateTrustedLegacyStorage')) {
        throw new Error(`Unregistered inline module in ${target}`);
      }
      attrs += ' src="./zz-import/legacy-start.mjs"';
      body = '';
    }
    return `<script type="application/x-zz-deferred" data-zz-type="${type}"${
      attrs.replace(/\s*type=["'][^"']*["']/, '')
    }>${body}</script>`;
  });
  return gated.replace(
    '</body>',
    `<script type="module" data-zz-bootstrap="${target}" src="./zz-import/ui-bootstrap.mjs"></script></body>`,
  );
}
export async function publishZzImport(directory, target) {
  if (!ZZ_IMPORT_TARGETS.includes(target)) return;
  const source = path.join(root, 'zz-import');
  await cp(source, path.join(directory, 'zz-import'), {
    recursive: true,
    filter: (entry) => entry === source || zzImportFiles(target).includes(path.basename(entry)),
  });
  if (target === 'tyche') {
    const app = path.join(directory, 'app.js');
    await writeFile(app, transformZzImportRuntime(await readFile(app, 'utf8'), target, 'app.js'));
  }
  const sw = path.join(directory, 'sw.js');
  await writeFile(sw, transformZzImportWorker(await readFile(sw, 'utf8'), target));
}
export function transformZzImportWorker(text, target) {
  const files = zzImportFiles(target);
  if ((text.match(/const SHELL = \[/g) || []).length !== 1) {
    throw new Error(`Missing explicit SW shell for ${target}`);
  }
  text = text.replace(
    /const SHELL = \[/,
    `const SHELL = [\n${files.map((file) => `  './zz-import/${file}',`).join('\n')}`,
  );
  const cache = /(const CACHE_NAME = CACHE_PREFIX \+ '|CACHE=PREFIX\+')([^']*)'/;
  if (!cache.test(text)) throw new Error(`Missing cache identity for ${target}`);
  text = text.replace(
    cache,
    (_, prefix, version) =>
      `${prefix}${version.replace(/-distribution$/, '')}-zz-import-1${
        version.endsWith('-distribution') ? '-distribution' : ''
      }'`,
  );
  text +=
    `\n// Query all windows, including clients still running a previous shell.\nself.addEventListener('message', event => {\n  if (event.data?.type !== 'zz-import-clients-v1' || !event.ports[0]) return;\n  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients => {\n    event.ports[0].postMessage({clients:clients.filter(client=>client.id!==event.source?.id).map(client=>client.url)});\n  }));\n});\n`;
  return text;
}

export function transformZzImportRuntime(source, target, file) {
  if (target !== 'tyche' || file !== 'app.js') return source;
  const replacements = [
    [
      'state.targetAngle = null;\nstate.spins = 0;\nstate.previousAngle = null;',
      'if (!globalThis.zzImportResume?.tyche) {\n  state.targetAngle = null;\n  state.spins = 0;\n  state.previousAngle = null;\n}',
    ],
    [
      'let needsFirstTouchTarget = true;',
      'let needsFirstTouchTarget = !(globalThis.zzImportResume?.tyche && state.targetAngle !== null);',
    ],
    [
      '      state.forceSpin = previous.forceSpin;',
      `      state.forceSpin = previous.forceSpin;
      if (globalThis.zzImportResume?.tyche && Number.isInteger(previous.spins) && previous.spins >= 0 &&
          (previous.targetAngle === null || (Number.isFinite(previous.targetAngle) && previous.targetAngle >= 0 && previous.targetAngle < 360)) &&
          (previous.previousAngle === null || (Number.isFinite(previous.previousAngle) && previous.previousAngle >= 0 && previous.previousAngle < 360))) {
        state = { ...state, ...previous };
      }`,
    ],
  ];
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw new Error('TYCHE import-resume startup boundary changed');
    source = source.replace(before, after);
  }
  return source;
}
