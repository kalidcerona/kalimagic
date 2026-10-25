import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The localhost-only preview hook of every personal app lives in its own local-preview.js(mjs). A friend build removes
// that file and the lines marked `local-preview-hook` (one import, one call, plus any import that only the hook used).
const MARK = '// local-preview-hook';
const apps = [
  ['zz1', 'js', 'app.js'], ['zz4', 'js', 'app.js'], ['zz5', 'js', 'app.js'], ['zz6', 'js', 'app.js'],
  ['zz7', 'js', 'detector.js'], ['zz8', 'js', 'contacts.js'], ['zz10', 'js', 'app.js'], ['zz11', 'js', 'app.js'],
  ['zz12', 'mjs', 'app.mjs'], ['zz13', 'mjs', 'app.mjs'], ['zz14', 'mjs', 'app.mjs'],
];
// zz14 runs only up to its boot line in production; its hook line sits after it, so its service worker never lists the module.
const SW_LISTS_MODULE = (zz) => zz !== 'zz14';
const REFERENCE = /local-preview|magic-local-settings|localSettingsReady/;
const root = (zz) => fileURLToPath(new URL(`../../${zz}/`, import.meta.url));

function textFiles(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return textFiles(path.join(dir, entry.name), name);
    return /\.(m?js|html|css|webmanifest)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [name] : [];
  });
}

for (const [zz, ext, entry] of apps) {
  test(`${zz}: the preview hook is local-preview.${ext} plus marked lines only`, () => {
    const dir = root(zz);
    const moduleName = `local-preview.${ext}`;
    assert.ok(existsSync(path.join(dir, moduleName)), `${zz} has ${moduleName}`);
    const moduleSource = readFileSync(path.join(dir, moduleName), 'utf8');
    for (const needle of ['magic-local-settings', 'localSettingsReady', "'local-preview'"]) assert.ok(moduleSource.includes(needle), needle);

    const appFiles = textFiles(dir).filter((file) => file !== moduleName && file !== 'sw.js');
    let calls = 0;
    let imports = 0;
    for (const file of appFiles) {
      const lines = readFileSync(path.join(dir, file), 'utf8').split('\n');
      const marked = lines.filter((line) => line.includes(MARK));
      const rest = lines.filter((line) => !line.includes(MARK)).join('\n');
      assert.doesNotMatch(rest, REFERENCE, `${zz}/${file} has no hook reference outside marked lines`);
      for (const line of marked) {
        assert.equal(file, entry, `${zz}: marked lines live in the entry module`);
        if (line.startsWith('installLocalPreview(')) {
          calls += 1;
        } else if (line === `import { installLocalPreview } from './${moduleName}'; ${MARK}`) {
          imports += 1;
        } else {
          // Self-contained: an import whose names nothing else in the file uses.
          const names = line.match(/^import \{([^}]+)\} from /)?.[1].split(',').map((name) => name.trim());
          assert.ok(names, `${zz}: a marked non-call line is an import`);
          for (const name of names) assert.equal(rest.split(new RegExp(`\\b${name}\\b`)).length, 1, `${zz}: ${name} is used only by the hook`);
        }
      }
    }
    assert.equal(calls, 1, `${zz} has exactly one hook call line`);
    assert.equal(imports, 1, `${zz} has exactly one installLocalPreview import line`);

    const sw = readFileSync(path.join(dir, 'sw.js'), 'utf8').split('\n');
    const swRefs = sw.filter((line) => line.includes(`./${moduleName}`));
    if (SW_LISTS_MODULE(zz)) {
      assert.equal(swRefs.length, 1, `${zz} service worker lists the module`);
      assert.ok(swRefs[0].includes(MARK), 'the shell entry is marked so a friend build drops it');
      assert.match(sw.join('\n'), /local-preview-module-1/, 'cache name bumped');
    } else {
      assert.equal(swRefs.length, 0);
    }
    // Everything else in the service worker is free of the hook apart from the historical cache-name token.
    assert.doesNotMatch(sw.filter((line) => !line.includes(MARK) && !/CACHE/.test(line)).join('\n'), REFERENCE);
  });

  test(`${zz}: the hook stays inert away from localhost and listens on localhost with ?local-preview=1`, async () => {
    const { installLocalPreview } = await import(pathToFileURL(path.join(root(zz), `local-preview.${ext}`)).href);
    const saved = Object.fromEntries(['location', 'window', 'document'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const set = (key, value) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    try {
      for (const [hostname, search, expected] of [['example.test', '?local-preview=1', false], ['localhost', '', false], ['localhost', '?local-preview=1', true], ['[::1]', '?local-preview=1', true]]) {
        const listeners = {};
        const html = { dataset: {} };
        set('location', { hostname, search });
        set('window', { addEventListener: (type, fn) => { listeners[type] = fn; } });
        set('document', { documentElement: html });
        let opened = 0;
        installLocalPreview(() => { opened += 1; });
        assert.equal(Boolean(listeners['magic-local-settings']), expected, `${hostname}${search}`);
        assert.equal(html.dataset.localSettingsReady, expected ? 'true' : undefined);
        if (expected) { listeners['magic-local-settings']({}); assert.equal(opened, 1); }
      }
    } finally {
      for (const [key, descriptor] of Object.entries(saved)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
      }
    }
  });
}
