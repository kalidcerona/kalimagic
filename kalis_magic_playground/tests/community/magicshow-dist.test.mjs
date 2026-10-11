import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
import { DISTRIBUTION_APPS, shouldCopyMagicshow, transformDistributionDocument, verifyAppDisplayPolicy } from '../../scripts/build-public.mjs';
import gate, { classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
import { FRIEND_APP_TOOLS } from '../../netlify/functions/_lib/friend-app-access.mjs';
import { gateCookieName, signGateCookie, verifyGateCookie } from '../../netlify/functions/_lib/tool-gate.mjs';
import { allowOnCheckError, selectGate } from '../../netlify/functions/tool-check.mjs';
import { accessTableForTool, isValidTool } from '../../netlify/functions/admin-tools.mjs';
const root = new URL('../../', import.meta.url);
const read = file => readFile(new URL(file, root));
const shared = 'distribution-snapshots/magicshow';
async function filesUnder(route) {
  const files = [];
  for (const entry of await readdir(new URL(`${route}/`, root), { withFileTypes: true })) {
    assert.equal(entry.isSymbolicLink(), false, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(`${route}/${entry.name}`)).map(file => `${entry.name}/${file}`));
    else files.push(entry.name);
  }
  return files.sort();
}

test('Magicshow snapshot contains only allowed runtime files and exact deployment precache', async () => {
  const files = await filesUnder(shared);
  const base = ['index.html', 'style.css', 'data.js', 'core.js', 'audio.js', 'ui.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'sw.js'];
  assert.deepEqual(files.filter(file => !file.startsWith('assets/')), base.sort());
  assert.ok(files.some(file => file.startsWith('assets/')));
  for (const file of files) {
    assert.equal(shouldCopyMagicshow(file), true, file);
    assert.deepEqual(classifyPath(`/tools/magicshow/${file}`), ['manifest.webmanifest', 'icon-192.png', 'icon-512.png'].includes(file) ? { mode: 'public' } : { mode: 'gated', tool: 'magicshow' }, file);
  }
  for (const file of ['.env', '.gen/icon.png', 'README.md', 'PLAN.md', 'test-core.mjs', 'sim.mjs', 'tools/x.js', 'assets/.private.png', 'assets/logo.bak.png', 'assets/nested/private.png']) assert.equal(shouldCopyMagicshow(file), false, file);
  assert.deepEqual(DISTRIBUTION_APPS.find(app => app.tool === 'magicshow'), { source: shared, target: 'magicshow', tool: 'magicshow' });
  const sw = (await read(`${shared}/sw.js`)).toString();
  const precache = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
  assert.deepEqual(precache.map(file => file.replace(/^\.\//, '')).sort(), files);
  assert.equal(new Set(precache).size, files.length);
  assert.match(sw, /CACHE_PREFIX = 'magicshow-dist-'/);
  assert.match(sw, /CACHE_NAME = CACHE_PREFIX \+ '[a-f0-9]{16}-coherent-1-distribution'/);
  assert.ok(!precache.some(file => file.includes('/tools/_check')));
});

test('Magicshow manifest and HTML preserve the landscape fullscreen beta identity and shared gate', async () => {
  const manifest = JSON.parse(await read(`${shared}/manifest.webmanifest`));
  assert.equal(manifest.name, '칼리 마술 성장기 (베타)');
  assert.equal(manifest.short_name, '칼리마술');
  for (const field of ['id', 'start_url', 'scope']) assert.equal(manifest[field], '/tools/magicshow/');
  assert.equal(manifest.display, 'fullscreen');
  assert.equal(manifest.orientation, 'landscape');
  assert.equal(manifest.theme_color, '#151020');
  assert.equal(manifest.background_color, '#151020');
  for (const size of [192, 512]) {
    assert.ok(manifest.icons.some(icon => icon.src === `icon-${size}.png` && icon.sizes === `${size}x${size}` && icon.type === 'image/png'));
    const png = await read(`${shared}/icon-${size}.png`);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const html = (await read(`${shared}/index.html`)).toString();
  for (const value of ['rel="manifest"', 'rel="apple-touch-icon"', 'apple-mobile-web-app-capable', 'theme-color', "register('./sw.js')", 'data-magic-customize="off"', 'id="friend-apps-check"', "fetch('/tools/_check?tool=magicshow'"]) assert.ok(html.includes(value), value);
  assert.equal(transformDistributionDocument(html, { target: 'magicshow', tool: 'magicshow' }), html);
});

test('Magicshow entry variants gate runtime and expose only exact installation metadata', () => {
  for (const path of ['/tools/magicshow', '/tools/magicshow/', '/tools/MAGICSHOW/', '/TOOLS/MAGICSHOW/', '/tools//magicshow//index.html', '/tools/magicshow/index', '/tools/magicshow/index.html', '/tools/magicshow/ui.js', '/tools/magicshow/sw.js', '/tools/magicshow/icon.svg', '/tools/magicshow/nested/icon-192.png', '/tools/magicshow/index/manifest.webmanifest']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'magicshow' }, path);
  }
  for (const path of ['/tools/magicshow/../index', '/tools/magicshow/%2e%2e/index', '/tools/magicshow/%2e/index', '/tools/magicshow/./index']) assert.deepEqual(classifyPath(path), { mode: 'block' });
  for (const file of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png']) assert.deepEqual(classifyPath(`/tools/magicshow/${file}`), { mode: 'public' });
  assert.equal(allowOnCheckError('magicshow'), false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'magicshow').valid, false);
  assert.equal(gateCookieName('magicshow'), 'kali_magicshow_gate');
  assert.equal(accessTableForTool('magicshow'), 'friend_app_access');
  assert.equal(isValidTool('magicshow'), true);
  assert.ok(FRIEND_APP_TOOLS.has('magicshow'));
});

test('Magicshow edge gate checks live grants and rejects missing, wrong, revoked and unavailable access', async () => {
  const previousFetch = globalThis.fetch;
  const previousNetlify = globalThis.Netlify;
  const secret = 'magicshow-test-secret';
  globalThis.Netlify = { env: { get: () => secret } };
  let calls = 0;
  const context = { next: async () => { calls++; return new Response('runtime'); } };
  try {
    const token = await signGateCookie('friend@example.com', 'magicshow', secret);
    assert.equal((await verifyGateCookie(token, secret)).tool, 'magicshow');
    const wrong = await signGateCookie('friend@example.com', 'all', secret);
    const request = (path, cookie = '') => new Request(`https://example.com${path}`, { headers: { cookie } });
    for (const path of ['/tools/magicshow', '/tools/MAGICSHOW/', '/tools/magicshow/index']) {
      const denied = await gate(request(path), context);
      assert.equal(denied.status, 302);
      assert.ok(new URL(denied.headers.get('location')).searchParams.get('to').startsWith('/tools/magicshow/'));
      assert.equal((await gate(request(path, `kali_magicshow_gate=${wrong}`), context)).status, 302);
    }
    for (const behavior of ['revoked', 'error', 'approved']) {
      globalThis.fetch = async (url, options) => {
        assert.equal(new URL(url).searchParams.get('tool'), 'magicshow');
        assert.equal(options.cache, 'no-store');
        if (behavior === 'error') throw new Error('offline');
        return new Response(JSON.stringify({ ok: behavior === 'approved' }));
      };
      assert.equal((await gate(request('/tools/magicshow/ui.js', `kali_magicshow_gate=${token}`), context)).status, behavior === 'approved' ? 200 : 302);
    }
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
  }
});

test('Magicshow login, hosting, migration and admin grant are registered', async () => {
  const window = {};
  vm.runInNewContext((await read('tools/login/gate-util.js')).toString(), { window });
  assert.equal(window.ToolGateUtil.safeTo('/tools/magicshow/index.html'), '/tools/magicshow/index.html');
  assert.equal(window.ToolGateUtil.toolFromPath('/tools/magicshow/'), 'magicshow');
  assert.ok((await read('tools/login/login.js')).toString().includes("magicshow: '칼리 마술 성장기 (베타)'"));
  const context = {};
  vm.runInNewContext((await read('admin-app-model.js')).toString(), context);
  const html = (await read('admin.html')).toString();
  for (const [tool, name] of [['magicshow', '칼리 마술 성장기 (베타)']]) {
    assert.ok(context.AdminAppModel.APP_CATALOG.some(app => app.id === tool && app.path === `/tools/${tool}/`));
    assert.equal(context.AdminAppModel.toolLabel(tool), name);
    assert.ok(html.includes(`data-app-card="${tool}"`));
    assert.ok(html.includes(`data-copy-link="/tools/${tool}/"`));
  }
  assert.match((await read('netlify.toml')).toString(), /for = "\/tools\/magicshow\/manifest\.webmanifest"\s*\[headers.values\]\s*Content-Type = "application\/manifest\+json"/);
  const sql = (await read('supabase/migrations/20261011_friend_apps_magicshow.sql')).toString();
  assert.match(sql, /begin;[\s\S]*drop constraint if exists friend_app_access_tool_check;[\s\S]*add constraint friend_app_access_tool_check[\s\S]*commit;/);
  assert.deepEqual([...sql.matchAll(/'([^']+)'/g)].map(match => match[1]), [...FRIEND_APP_TOOLS]);
  assert.doesNotMatch(sql, /row level security|create policy|drop policy/i);
});

test('Magicshow built files equal the pinned snapshot and all local references exist', { skip: process.env.MAGICSHOW_VERIFY_DIST !== '1' }, async () => {
  assert.deepEqual(await filesUnder('dist/tools/magicshow'), await filesUnder(shared));
  for (const file of await filesUnder(shared)) assert.deepEqual(await read(`dist/tools/magicshow/${file}`), await read(`${shared}/${file}`), file);
  const html = (await read('dist/tools/magicshow/index.html')).toString();
  for (const [, file] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) await read(`dist/tools/magicshow/${file}`);
  await verifyAppDisplayPolicy(new URL('../../dist/', import.meta.url).pathname, ['tools/magicshow']);
});
