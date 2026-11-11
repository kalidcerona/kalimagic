import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { MIRROR_PAIRS } from '../../scripts/build-public.mjs';
import { createScreenShared } from '../../zz12/screen-shared.mjs';
import { freshState, newSession } from '../../zz12/core.mjs';

const root = new URL('../../zz12/', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');

test('memdeck startup module graph is fully cached and registered for mirroring', () => {
  const shell = new Set([...read('sw.js').matchAll(/"\.\/([^"\n]+)"/g)].map(match => match[1]));
  const mirrors = new Set(MIRROR_PAIRS.filter(([, target]) => target.startsWith('zz12/')).map(([, target]) => target.slice(5)));
  const visited = new Set();
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    assert.ok(shell.has(file), `${file} must be available offline`);
    assert.ok(mirrors.has(file), `${file} must have a source mirror`);
    const ast = parse(read(file), { ecmaVersion: 'latest', sourceType: 'module' });
    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration' && node.source.value.startsWith('./')) visit(node.source.value.slice(2));
    }
  }
  visit('app.mjs');
  for (const feature of ['study', 'quiz', 'rank', 'table', 'records', 'settings', 'storage', 'memory', 'memory-model', 'memory-training']) {
    assert.ok(visited.has(`${feature}.mjs`), `${feature} must be connected to startup`);
  }
});

test('memdeck feature instances archive only their own current state after replacement', () => {
  const first = { state: freshState() };
  const second = { state: freshState() };
  const a = createScreenShared(first);
  const b = createScreenShared(second);
  const previous = first.state;
  first.state = freshState();
  first.state.session = newSession('redford', [1], 'position');
  first.state.session.results.push({ correct: true, ms: 1234 });
  a.archiveActiveSession();
  assert.equal(first.state.session, null);
  assert.equal(first.state.progress.redford.history[0].ms, 1234);
  assert.equal(previous.progress.redford.history.length, 0);
  assert.equal(second.state.progress.redford.history.length, 0);
  b.archiveActiveSession();
  assert.equal(first.state.progress.redford.history.length, 1);
});
