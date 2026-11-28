import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('write and detail pages serve the scriptless notice', () => {
  for (const page of ['write.html', 'post.html']) {
    assert.equal(read(page), read('playground.html'));
    assert.doesNotMatch(read(page), /<script|data-post-detail|data-write-compose/);
  }
});

test('list rows navigate to the OG post route and include body preview', () => {
  const source = read('playground-list.js');
  assert.match(source, /href="\/p\//);
  assert.match(source, /bodyPreview/);
  assert.doesNotMatch(source, /playground:select-post/);
});

test('post bootstrap reads ids from the OG post route', () => {
  const source = read('post.js');

  assert.match(source, /POST_ROUTE_PREFIX = '\/p\/'/);
  assert.match(source, /location\.pathname/);
  assert.match(source, /URLSearchParams/);
});

test('posts API exposes bodyPreview additively', () => {
  const source = read('netlify/functions/posts.mjs');
  assert.match(source, /bodyPreview/);
});

test('compose passes created result to onCreated', () => {
  const source = read('playground-compose.js');
  assert.match(source, /onCreated\((?!\))/);
});

test('playground bootstrap guards missing mounts and has login ui', () => {
  const source = read('playground.js');
  assert.match(source, /data-auth-slot/);
  assert.match(source, /admin-inbox/);
  assert.doesNotMatch(source, /addEventListener\('submit'/);
});

test('build whitelist ships new pages', () => {
  const source = read('scripts/build-public.mjs');
  for (const f of ['write.html', 'post.html', 'write.js', 'post.js']) {
    assert.equal(source.includes(f), true, `missing ${f}`);
  }
});
