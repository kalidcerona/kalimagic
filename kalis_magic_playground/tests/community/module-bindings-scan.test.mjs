import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanAppDir } from '../../scripts/scan-module-bindings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SNAPSHOTS = path.join(ROOT, 'distribution-snapshots');

// index.html에 <script type="module">이 있는 앱 폴더를 찾음
// (루트 바로 아래 폴더 + distribution-snapshots 아래 폴더, magicshow 제외)
function usesModuleScripts(dir) {
  const html = path.join(dir, 'index.html');
  if (!fs.existsSync(html)) return false;
  return /<script\b[^>]*type\s*=\s*["']module["']/i.test(fs.readFileSync(html, 'utf8'));
}

function childDirs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.'))
    .map((entry) => path.join(dir, entry.name));
}

function discoverAppRoots() {
  const candidates = [
    ...childDirs(ROOT),
    ...childDirs(SNAPSHOTS).filter((dir) => path.basename(dir) !== 'magicshow')
  ];
  return candidates
    .filter(usesModuleScripts)
    .map((dir) => path.relative(ROOT, dir))
    .sort();
}

const appRoots = discoverAppRoots();

// 앱이 빠지거나 새로 생기면 여기를 같이 갱신해야 함 (조용히 검사에서 빠지는 것 방지)
const EXPECTED_APP_ROOTS = [
  'KanameCue',
  'distribution-snapshots/aletheia',
  'distribution-snapshots/choice',
  'distribution-snapshots/gwayubulgeup',
  'distribution-snapshots/kairos',
  'distribution-snapshots/pimax',
  'distribution-snapshots/qr',
  'distribution-snapshots/spinner',
  'distribution-snapshots/tobira',
  'distribution-snapshots/unlock',
  'distribution-snapshots/usotsuki',
  'zz1', 'zz10', 'zz11', 'zz12', 'zz13', 'zz14', 'zz15',
  'zz2', 'zz4', 'zz5', 'zz6', 'zz7', 'zz8'
];

test('discovered module roots equal the expected list', () => {
  assert.deepEqual(appRoots, EXPECTED_APP_ROOTS);
});

for (const rel of appRoots) {
  test(`no undeclared or unresolved bindings in ${rel}`, () => {
    const { undeclared, unresolved, parseErrors } = scanAppDir(path.join(ROOT, rel));
    assert.deepEqual(undeclared, []);
    assert.deepEqual(unresolved, []);
    assert.deepEqual(parseErrors, []);
  });
}

// ---------- self-check: 스캐너가 이 버그 유형을 여전히 잡는지 ----------

// 임시 폴더를 만들어 fn에 넘기고, 실패해도 항상 지움
function withTemp(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'module-bindings-'));
  try {
    return fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function copyApp(rel, tmp, edit) {
  fs.cpSync(path.join(ROOT, rel), tmp, { recursive: true });
  edit(tmp);
}

function writeFiles(tmp, files) {
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(tmp, name), content);
  }
}

const MAIN_HTML = '<script type="module" src="./main.js"></script>';

function editFile(file, transform) {
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  assert.notEqual(after, before, `edit did not change ${file}`);
  fs.writeFileSync(file, after);
}

test('scanner reports labelFor when zz15 core-logic.mjs loses its import', () => {
  withTemp((tmp) => {
    copyApp('zz15', tmp, (dir) => {
      editFile(path.join(dir, 'core-logic.mjs'), (text) => text.replace(/^import \{ labelFor \} from .*\n/m, ''));
    });
    const { undeclared } = scanAppDir(tmp);
    assert.ok(undeclared.some((u) => u.name === 'labelFor' && u.file === 'core-logic.mjs'));
  });
});

test('scanner reports resetTwoFingerTaps when zz2 settings.js loses it from its import', () => {
  withTemp((tmp) => {
    copyApp('zz2', tmp, (dir) => {
      editFile(path.join(dir, 'settings.js'), (text) => text.replace(/^import \{ resetTwoFingerTaps \} from .*\n/m, ''));
    });
    const { undeclared } = scanAppDir(tmp);
    assert.ok(undeclared.some((u) => u.name === 'resetTwoFingerTaps' && u.file === 'settings.js'));
  });
});

// ---------- fixtures: 스캐너 논리 회귀 방지 ----------

test('fixture: inline module script bodies are scanned', () => {
  withTemp((tmp) => {
    writeFiles(tmp, {
      'index.html': '<script type="module">import { nope } from "./dep.js"; notDeclared();</script>',
      'dep.js': 'export const other = 1;'
    });
    const { undeclared, unresolved } = scanAppDir(tmp);
    assert.ok(undeclared.some((u) => u.name === 'notDeclared'));
    assert.ok(unresolved.some((u) => u.name === 'nope'));
  });
});

test('fixture: scope edge cases are reported', () => {
  withTemp((tmp) => {
    writeFiles(tmp, {
      'index.html': MAIN_HTML,
      'main.js': [
        'export function f(x = missing) { var missing = 1; return x; }',
        'export const g = () => arguments;',
        'export class A { static { var leaked = 1; } }',
        'void leaked;'
      ].join('\n')
    });
    const names = scanAppDir(tmp).undeclared.map((u) => u.name);
    assert.ok(names.includes('missing'));
    assert.ok(names.includes('arguments'));
    assert.ok(names.includes('leaked'));
  });
});

test('fixture: valid scopes are not reported', () => {
  withTemp((tmp) => {
    writeFiles(tmp, {
      'index.html': MAIN_HTML,
      'main.js': [
        'export function f() { return () => arguments.length; }',
        'export class A { static { var inner = 1; void inner; } }'
      ].join('\n')
    });
    assert.deepEqual(scanAppDir(tmp).undeclared, []);
  });
});

test('fixture: anonymous default exports, labels and export * as ns are accepted', () => {
  withTemp((tmp) => {
    writeFiles(tmp, {
      'index.html': MAIN_HTML,
      'main.js': [
        'import fn from "./fn.js";',
        'import Cls from "./cls.js";',
        'export * as ns from "./fn.js";',
        'outer: for (;;) { for (;;) { continue outer; } }',
        'inner: for (;;) { break inner; }',
        'void fn; void Cls;'
      ].join('\n'),
      'fn.js': 'export default function () {}',
      'cls.js': 'export default class {}'
    });
    assert.deepEqual(scanAppDir(tmp), { undeclared: [], unresolved: [], parseErrors: [] });
  });
});

test('fixture: missing export-star and dynamic import targets are unresolved', () => {
  withTemp((tmp) => {
    writeFiles(tmp, {
      'index.html': MAIN_HTML,
      'main.js': 'export * from "./nope.js";\nimport("./gone.js");'
    });
    const sources = scanAppDir(tmp).unresolved.map((u) => u.source);
    assert.ok(sources.includes('./nope.js'));
    assert.ok(sources.includes('./gone.js'));
  });
});

test('fixture: ambiguous star re-exports are unresolved, shared origins are not', () => {
  withTemp((tmp) => {
    writeFiles(tmp, {
      'index.html': MAIN_HTML,
      'main.js': 'import { dup } from "./ambiguous.js";\nimport { one } from "./diamond.js";\nvoid dup; void one;',
      'a.js': 'export const dup = 1; export const one = 1;',
      'b.js': 'export const dup = 2;',
      'ambiguous.js': 'export * from "./a.js";\nexport * from "./b.js";',
      'm1.js': 'export * from "./a.js";',
      'm2.js': 'export * from "./a.js";',
      'diamond.js': 'export * from "./m1.js";\nexport * from "./m2.js";'
    });
    const { unresolved } = scanAppDir(tmp);
    assert.deepEqual(unresolved.map((u) => `${u.name}:${u.source}`), ['dup:./ambiguous.js']);
  });
});
