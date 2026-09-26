import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const APPS = [
  { route: 'zz4', name: '너의 선택은?', id: './choice' },
  { route: 'zz5', name: 'ALETHEIA', id: './aletheia' },
  { route: 'zz6', name: 'TOBIRA', id: './tobira' },
  { route: 'zz7', name: 'USOTSUKI', id: './usotsuki' },
];

function pngSize(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

for (const { route, name, id } of APPS) {
  test(`${route} installs under its own product identity`, async () => {
    const root = new URL(`../../${route}/`, import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));
    const html = await readFile(new URL('index.html', root), 'utf8');
    const worker = await readFile(new URL('sw.js', root), 'utf8');

    assert.equal(manifest.name, name);
    assert.equal(manifest.short_name, name);
    assert.equal(manifest.id, id);
    assert.equal(manifest.scope, './');
    assert.ok(['./', './index.html'].includes(manifest.start_url));
    assert.match(html, new RegExp(`<meta name="apple-mobile-web-app-title" content="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    assert.match(html, /rel="apple-touch-icon"[^>]*icon-192\.png/);
    assert.match(html, /rel="manifest"[^>]*manifest\.webmanifest\?/);
    assert.match(html, /src="\.?\/?install-prompt\.js"/);

    for (const size of [192, 512]) {
      const file = `icon-${size}.png`;
      assert.deepEqual(pngSize(await readFile(new URL(file, root))), [size, size]);
      assert.ok(manifest.icons.some((icon) => icon.src.includes(file) && icon.sizes === `${size}x${size}` && icon.type === 'image/png'));
      assert.ok(worker.includes(file), `${route} must precache ${file}`);
    }
    assert.ok(worker.includes('install-prompt.js'), `${route} must precache the install UI`);
  });
}

test('public app identities remain distinct and private app routes stay excluded', async () => {
  assert.equal(new Set(APPS.map(({ route, id }) => new URL(id, `https://example.test/${route}/`).href)).size, APPS.length);
  const { PUBLIC_DIRS } = await import('../../scripts/build-public.mjs');
  assert.equal(PUBLIC_DIRS.includes('zz8'), false);
  assert.equal(PUBLIC_DIRS.includes('zz9'), false);
});
