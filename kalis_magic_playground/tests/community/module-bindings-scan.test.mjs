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

test('module roots are discovered', () => {
  assert.ok(appRoots.includes('zz2'));
  assert.ok(appRoots.includes('zz15'));
  assert.ok(appRoots.some((rel) => rel.startsWith('distribution-snapshots/')));
  assert.ok(!appRoots.includes('distribution-snapshots/magicshow'));
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

function copyToTemp(rel, edit) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'module-bindings-'));
  fs.cpSync(path.join(ROOT, rel), tmp, { recursive: true });
  edit(tmp);
  return tmp;
}

function editFile(file, transform) {
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  assert.notEqual(after, before, `edit did not change ${file}`);
  fs.writeFileSync(file, after);
}

test('scanner reports labelFor when zz15 core-logic.mjs loses its import', () => {
  const tmp = copyToTemp('zz15', (dir) => {
    editFile(path.join(dir, 'core-logic.mjs'), (text) => text.replace(/^import \{ labelFor \} from .*\n/m, ''));
  });
  try {
    const { undeclared } = scanAppDir(tmp);
    assert.ok(undeclared.some((u) => u.name === 'labelFor' && u.file === 'core-logic.mjs'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('scanner reports resetTwoFingerTaps when zz2 settings.js loses it from its import', () => {
  const tmp = copyToTemp('zz2', (dir) => {
    editFile(path.join(dir, 'settings.js'), (text) => text.replace(/^import \{ resetTwoFingerTaps \} from .*\n/m, ''));
  });
  try {
    const { undeclared } = scanAppDir(tmp);
    assert.ok(undeclared.some((u) => u.name === 'resetTwoFingerTaps' && u.file === 'settings.js'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
