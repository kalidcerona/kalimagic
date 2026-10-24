import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Loads the real zz15 core modules as separate ES modules (no concatenation, no shared scope) and
// drives the same call path picker.mjs uses: C.resolve(...) then C.armResolved(...). A name that one
// module uses but never imports (it only exists as a re-export in core.mjs) throws ReferenceError here.
// URAMICHI_ROOT lets a mutation check point the same test at a scratch copy.
const root = process.env.URAMICHI_ROOT ? pathToFileURL(`${process.env.URAMICHI_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz15/', import.meta.url);
const C = await import(new URL('core.mjs', root));

const fixed = C.category('c1', '목록', 'NONE', [C.entry('e1', '첫째', ' https://example.test/a ')]);
const number = C.category('c2', '번호', 'NUMBER', [C.entry('n7', '일곱', 'https://example.test/7', '7'), C.entry('any', '그 밖', 'https://example.test/?n={number}')]);

test('picker path arms a valid fixed preset and records it as recent', () => {
  const r = C.resolve(fixed, fixed.entries[0], null);
  assert.equal(r.ok, true);
  const [armed, recent] = C.armResolved(fixed, r, null, 'ALWAYS');
  assert.deepEqual(armed, C.armed('c1', 'e1', '첫째', 'https://example.test/a', 'ALWAYS'));
  assert.deepEqual(recent, C.recent('c1', 'e1', '첫째', 'https://example.test/a', 'NONE'));
});

test('picker path puts the typed value into the label for template entries and turns SEQUENCE into ONCE', () => {
  const r = C.resolve(number, null, '42');
  assert.equal(r.ok, true);
  const [armed, recent] = C.armResolved(number, r, '42', 'SEQUENCE');
  assert.equal(armed.label, '그 밖 (42)');
  assert.equal(armed.url, 'https://example.test/?n=42');
  assert.equal(armed.mode, 'ONCE');
  assert.equal(recent.label, '그 밖 (42)');
  assert.equal(recent.kind, 'NUMBER');
});

test('the armed result feeds the rest of the logic without a missing binding', () => {
  const [armed, recent] = C.armResolved(fixed, C.resolve(fixed, fixed.entries[0], null), null, 'ONCE');
  assert.equal(C.target(armed, [fixed]), 'https://example.test/a');
  assert.equal(C.afterOpen(armed, [fixed]), null);
  assert.deepEqual(C.pushRecent([], recent), [recent]);
});

test('every relative import in a zz15 module resolves to an exported name', async () => {
  const dir = new URL('./', root);
  const names = readdirSync(dir).filter((f) => f.startsWith('core') && f.endsWith('.mjs'));
  for (const file of names) {
    const src = readFileSync(new URL(file, dir), 'utf8');
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(\.\/[^']+)'/g)) {
      const mod = await import(new URL(m[2], dir));
      for (const part of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
        const name = part.split(/\s+as\s+/)[0];
        assert.ok(name in mod, `${file} imports ${name} from ${m[2]}, which does not export it`);
      }
    }
  }
});
