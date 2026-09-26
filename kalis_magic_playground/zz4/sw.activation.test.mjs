import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { it } from 'node:test';

it('install identity and shell assets belong to Choice', async () => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('./manifest.webmanifest', import.meta.url), 'utf8'));
  const sw = await readFile(new URL('./sw.js', import.meta.url), 'utf8');
  const install = await readFile(new URL('./install-prompt.js', import.meta.url), 'utf8');

  assert.equal(manifest.id, './choice');
  assert.equal(manifest.name, '너의 선택은?');
  assert.equal(manifest.short_name, '너의 선택은?');
  assert.equal(manifest.start_url, './');
  assert.match(html, /manifest\.webmanifest\?v=choice-2/);
  assert.match(html, /apple-mobile-web-app-title" content="너의 선택은\?"/);
  assert.match(html, /apple-touch-icon" href="\.\/icon-192\.png\?install=choice-v2/);
  assert.match(html, /data-install-card/);
  assert.match(sw, /icon-192\.png/);
  assert.match(sw, /icon-512\.png/);
  assert.match(sw, /install-prompt\.js/);
  assert.match(install, /beforeinstallprompt/);
  assert.match(install, /promptEvent\.prompt\(\)/);
  assert.match(install, /Safari의 공유 버튼/);
  assert.match(install, /Chrome의 공유 버튼/);
});

it('activation deletes only stale magic-choice shell caches', async () => {
  const source = await readFile(new URL('./sw.js', import.meta.url), 'utf8');
  const handlers = new Map();
  const cacheNames = [
    'magic-choice-shell-v2',
    'magic-choice-shell-v3',
    'magic-choice-shell-v4',
    'magic-choice-shell-v5',
    'stopwatch2-cache-v1',
    'another-app-shell-v9',
    'offline-notes-v1'
  ];
  const deleted = [];
  let claimed = false;
  const context = {
    self: {
      addEventListener(type, handler) { handlers.set(type, handler); },
      clients: { async claim() { claimed = true; } }
    },
    caches: {
      async keys() { return [...cacheNames]; },
      async delete(name) { deleted.push(name); return true; }
    }
  };

  vm.runInNewContext(source, context, { filename: 'sw.js' });
  let activation;
  handlers.get('activate')({ waitUntil(promise) { activation = promise; } });
  await activation;

  assert.deepEqual(deleted.sort(), ['magic-choice-shell-v2', 'magic-choice-shell-v3', 'magic-choice-shell-v4', 'stopwatch2-cache-v1']);
  assert.equal(claimed, true);
});
