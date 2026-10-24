import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

test('fixture: inline module findings use real html line numbers', () => {
  withTemp((tmp) => {
    writeFiles(tmp, {
      'index.html': '<!doctype html>\n<html>\n<body>\n<script type="module">\nvoid a;\n\nvoid b;\n</script>\n</body>'
    });
    const lines = scanAppDir(tmp).undeclared.map((u) => `${u.name}:${u.line}`);
    assert.deepEqual(lines, ['a:5', 'b:7']);
  });
});

test('fixture: inline line numbers hold for CR-only and CRLF html', () => {
  for (const eol of ['\r', '\r\n', String.fromCharCode(0x2028)]) {
    withTemp((tmp) => {
      const html = ['<!doctype html>', '<html>', '<script type="module">', 'void a;', '', 'void b;', '</script>'].join(eol);
      writeFiles(tmp, { 'index.html': html });
      const lines = scanAppDir(tmp).undeclared.map((u) => `${u.name}:${u.line}`);
      assert.deepEqual(lines, ['a:4', 'b:6'], JSON.stringify(eol));
    });
  }
});

// ---------- oracle: 실제 Node의 모듈 링크 결과와 스캐너 판정을 대조 ----------

// main.mjs가 entry.mjs에서 name을 import하는 앱. 링크되면 true, SyntaxError면 false
async function nodeLinks(tmp) {
  try {
    await import(pathToFileURL(path.join(tmp, 'main.mjs')).href);
    return true;
  } catch (err) {
    if (err instanceof SyntaxError) return false;
    throw err;
  }
}

const ORACLE_CASES = [
  {
    title: 'ambiguous star exports',
    entry: 'ambiguous',
    files: {
      'a.mjs': 'export const name = 1;',
      'b.mjs': 'export const name = 2;',
      'entry.mjs': 'export * from "./a.mjs";\nexport * from "./b.mjs";'
    }
  },
  {
    title: 'diamond star exports share one origin',
    entry: 'diamond',
    files: {
      'a.mjs': 'export const name = 1;',
      'm1.mjs': 'export * from "./a.mjs";',
      'm2.mjs': 'export * from "./a.mjs";',
      'entry.mjs': 'export * from "./m1.mjs";\nexport * from "./m2.mjs";'
    }
  },
  {
    title: 'cycle: name reachable through the other side of a star cycle',
    entry: 'cycle-reachable',
    files: {
      'a.mjs': 'export const x = 1;\nexport * from "./b.mjs";',
      'b.mjs': 'export const name = 1;\nexport * from "./a.mjs";',
      'entry.mjs': 'export * from "./a.mjs";'
    }
  },
  {
    title: 'cycle: both sides star-export distinct origins',
    entry: 'cycle-ambiguous',
    files: {
      'a.mjs': 'export * from "./b.mjs";\nexport * from "./c.mjs";',
      'b.mjs': 'export * from "./a.mjs";\nexport * from "./d.mjs";',
      'c.mjs': 'export const name = 1;',
      'd.mjs': 'export const name = 2;',
      'entry.mjs': 'export * from "./a.mjs";'
    }
  },
  {
    title: 'cycle: name exists nowhere',
    entry: 'cycle-missing',
    files: {
      'a.mjs': 'export * from "./b.mjs";',
      'b.mjs': 'export * from "./a.mjs";',
      'entry.mjs': 'export * from "./a.mjs";'
    }
  },
  {
    title: 'import then export of the same original is not ambiguous',
    entry: 'import-reexport',
    files: {
      'a.mjs': 'export const name = 1;',
      'b.mjs': 'import { name } from "./a.mjs";\nexport { name };',
      'entry.mjs': 'export * from "./a.mjs";\nexport * from "./b.mjs";'
    }
  },
  {
    title: 'export-from of the same original is not ambiguous',
    entry: 'export-from',
    files: {
      'a.mjs': 'export const name = 1;',
      'b.mjs': 'export { name } from "./a.mjs";',
      'entry.mjs': 'export * from "./a.mjs";\nexport * from "./b.mjs";'
    }
  },
  {
    title: 'named default function keeps its local identity',
    entry: 'default-function',
    files: {
      'a.mjs': 'export default function f() {}\nexport { f };',
      'b.mjs': 'export { default as name } from "./a.mjs";',
      'c.mjs': 'export { f as name } from "./a.mjs";',
      'entry.mjs': 'export * from "./b.mjs";\nexport * from "./c.mjs";'
    }
  },
  {
    title: 'named default class keeps its local identity',
    entry: 'default-class',
    files: {
      'a.mjs': 'export default class C {}\nexport { C };',
      'b.mjs': 'export { default as name } from "./a.mjs";',
      'c.mjs': 'export { C as name } from "./a.mjs";',
      'entry.mjs': 'export * from "./b.mjs";\nexport * from "./c.mjs";'
    }
  },
  {
    title: 'anonymous defaults from two modules are distinct',
    entry: 'default-anonymous',
    files: {
      'a.mjs': 'export default function () {}',
      'd.mjs': 'export default function () {}',
      'b.mjs': 'export { default as name } from "./a.mjs";',
      'c.mjs': 'export { default as name } from "./d.mjs";',
      'entry.mjs': 'export * from "./b.mjs";\nexport * from "./c.mjs";'
    }
  },
  {
    title: 'namespace re-export reached through two paths',
    entry: 'namespace-diamond',
    files: {
      'a.mjs': 'export const x = 1;',
      'b.mjs': 'export * as name from "./a.mjs";',
      'c.mjs': 'export * as name from "./a.mjs";',
      'entry.mjs': 'export * from "./b.mjs";\nexport * from "./c.mjs";'
    }
  },
  {
    title: 'namespace re-exports of different modules conflict',
    entry: 'namespace-conflict',
    files: {
      'a.mjs': 'export const x = 1;',
      'd.mjs': 'export const x = 2;',
      'b.mjs': 'export * as name from "./a.mjs";',
      'c.mjs': 'export * as name from "./d.mjs";',
      'entry.mjs': 'export * from "./b.mjs";\nexport * from "./c.mjs";'
    }
  },
  {
    title: 'imported namespace re-exported through two paths',
    entry: 'namespace-import-diamond',
    files: {
      'a.mjs': 'export const x = 1;',
      'b.mjs': 'import * as name from "./a.mjs";\nexport { name };',
      'c.mjs': 'export * as name from "./a.mjs";',
      'entry.mjs': 'export * from "./b.mjs";\nexport * from "./c.mjs";'
    }
  },
  {
    title: 'explicit export wins over conflicting stars',
    entry: 'explicit-wins',
    files: {
      'a.mjs': 'export const name = 1;',
      'b.mjs': 'export const name = 2;',
      'entry.mjs': 'export * from "./a.mjs";\nexport * from "./b.mjs";\nexport const name = 3;'
    }
  },
  {
    title: 're-export of an import that the source does not export',
    entry: 'bad-reexport',
    files: {
      'a.mjs': 'export const other = 1;',
      'b.mjs': 'import { name } from "./a.mjs";\nexport { name };',
      'entry.mjs': 'export * from "./b.mjs";'
    }
  }
];

for (const { title, files, entry } of ORACLE_CASES) {
  test(`oracle: scanner agrees with Node linking (${title})`, async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'module-bindings-'));
    try {
      writeFiles(tmp, {
        ...files,
        'index.html': '<script type="module" src="./main.mjs"></script>',
        'main.mjs': 'import { name } from "./entry.mjs";\nvoid name;'
      });
      const { unresolved, undeclared, parseErrors } = scanAppDir(tmp);
      assert.deepEqual(undeclared, [], entry);
      assert.deepEqual(parseErrors, [], entry);
      assert.equal(unresolved.length === 0, await nodeLinks(tmp), `${entry}: scanner vs Node`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
}

test('oracle: the cases cover both linking outcomes', async () => {
  const outcomes = new Set();
  for (const { files } of ORACLE_CASES) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'module-bindings-'));
    try {
      writeFiles(tmp, { ...files, 'main.mjs': 'import { name } from "./entry.mjs";\nvoid name;' });
      outcomes.add(await nodeLinks(tmp));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  assert.deepEqual([...outcomes].sort(), [false, true]);
});
