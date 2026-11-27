import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const APPS = [
  { route: 'distribution-snapshots/choice', name: '너의 선택은?', id: './' },
  { route: 'distribution-snapshots/aletheia', name: 'ALETHEIA', id: './' },
  { route: 'distribution-snapshots/tobira', name: 'TOBIRA', id: './' },
  { route: 'distribution-snapshots/usotsuki', name: 'USOTSUKI', id: './' },
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

test('all 20 app manifests resolve to stable distinct identities and usable PNG icons', async () => {
  const { DISTRIBUTION_APPS } = await import('../../scripts/build-public.mjs');
  const apps = DISTRIBUTION_APPS.map((app) => ({ source: app.source, route: `tools/${app.target}` }));
  const identities = [];
  for (const { source, route } of apps) {
    const root = new URL(`../../${source}/`, import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));
    if (route !== 'tools/planbcafe') Object.assign(manifest, { id: `/${route}/`, start_url: './', scope: './' });
    const manifestUrl = new URL(`https://example.test/${route}/manifest.webmanifest`);
    const start = new URL(manifest.start_url, manifestUrl);
    const scope = new URL(manifest.scope, manifestUrl);
    // The id base is the start URL's origin, not the manifest directory.
    const id = new URL(manifest.id || start.href, start.origin);
    id.hash = '';
    identities.push(id.href);
    const expectedId = `/${route}/`;
    assert.equal(id.pathname, expectedId, route);
    assert.equal(start.origin, scope.origin);
    assert.ok(start.pathname.startsWith(scope.pathname), `${route} launch URL stays in scope`);
    assert.equal(manifest.display, ['tools/magicshow', 'tools/planbcafe'].includes(route) ? 'fullscreen' : 'standalone');
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
  assert.equal(apps.length, 20);
  assert.equal(new Set(identities).size, 20);
});
