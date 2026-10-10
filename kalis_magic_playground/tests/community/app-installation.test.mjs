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

test('public app identities remain distinct while FALSE MEMORY stays private', async () => {
  const identities = APPS.map(({ route, id }) => new URL(id, 'https://example.test/').href);
  for (const route of ['zz8', 'zz10']) {
    const manifest = JSON.parse(await readFile(new URL(`../../${route}/manifest.webmanifest`, import.meta.url), 'utf8'));
    assert.equal(manifest.id, undefined);
    assert.equal(manifest.scope, './');
    identities.push(new URL(manifest.start_url, `https://example.test/${route}/manifest.webmanifest`).href);
  }
  assert.equal(new Set(identities).size, identities.length);
  const { PUBLIC_DIRS } = await import('../../scripts/build-public.mjs');
  assert.equal(PUBLIC_DIRS.includes('zz8'), true);
  assert.equal(PUBLIC_DIRS.includes('zz10'), true);
  assert.equal(PUBLIC_DIRS.includes('zz9'), false);
});

test('all 24 app manifests resolve to stable distinct identities and usable PNG icons', async () => {
  const { PUBLIC_DIRS, DISTRIBUTION_APPS } = await import('../../scripts/build-public.mjs');
  const expectedPersonal = {
    zz1: '/zz1/index.html', zz2: '/zz2/index.html', zz3: '/zz3/index.html',
    zz4: '/choice', zz5: '/aletheia', zz6: '/tobira', zz7: '/usotsuki',
    zz8: '/zz8/', zz10: '/zz10/index.html', zz11: '/zz11/index.html',
    zz12: '/zz12/', zz13: '/zz13/', zz14: '/zz14/',
  };
  const apps = [
    ...PUBLIC_DIRS.filter((route) => /^zz\d+$/.test(route)).map((route) => ({ source: route, route })),
    ...DISTRIBUTION_APPS.map((app) => ({ source: app.source, route: `tools/${app.target}`, shared: true })),
  ];
  const identities = [];
  for (const { source, route, shared } of apps) {
    const root = new URL(`../../${source}/`, import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));
    if (shared) Object.assign(manifest, { id: `/${route}/`, start_url: './', scope: './' });
    const manifestUrl = new URL(`https://example.test/${route}/manifest.webmanifest`);
    const start = new URL(manifest.start_url, manifestUrl);
    const scope = new URL(manifest.scope, manifestUrl);
    // The id base is the start URL's origin, not the manifest directory.
    const id = new URL(manifest.id || start.href, start.origin);
    id.hash = '';
    identities.push(id.href);
    assert.equal(id.pathname, shared ? `/${route}/` : expectedPersonal[route], route);
    assert.equal(start.origin, scope.origin);
    assert.ok(start.pathname.startsWith(scope.pathname), `${route} launch URL stays in scope`);
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.prefer_related_applications, undefined);
    for (const size of [192, 512]) {
      const icon = manifest.icons.find((entry) => entry.sizes === `${size}x${size}`
        && (entry.purpose || 'any').split(/\s+/).includes('any'));
      assert.ok(icon, `${route} needs a ${size}px general-purpose icon`);
      assert.equal(icon.type, 'image/png');
      const iconUrl = new URL(icon.src, root);
      iconUrl.search = '';
      assert.deepEqual(pngSize(await readFile(iconUrl)), [size, size], route);
    }
  }
  assert.equal(apps.length, 24);
  assert.equal(new Set(identities).size, 24);
});
