import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import vm from 'node:vm';
import { CHOICE_FILES, CHOICE_DISTRIBUTION_FILES, DISTRIBUTION_APPS, shouldCopyChoice } from '../../scripts/build-public.mjs';
import gate, { classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
import { FRIEND_APP_TOOLS } from '../../netlify/functions/_lib/friend-app-access.mjs';
import { gateCookieName, signGateCookie, verifyGateCookie } from '../../netlify/functions/_lib/tool-gate.mjs';
import { allowOnCheckError, selectGate } from '../../netlify/functions/tool-check.mjs';
import { accessTableForTool, isValidTool } from '../../netlify/functions/admin-tools.mjs';

const root = new URL('../../', import.meta.url);
const read = file => readFile(new URL(file, root));
const shared = 'distribution-snapshots/choice';
async function filesUnder(route) {
  const files = [];
  for (const entry of await readdir(new URL(`${route}/`, root), { withFileTypes: true })) {
    if (entry.isDirectory()) files.push(...(await filesUnder(`${route}/${entry.name}`)).map(file => `${entry.name}/${file}`));
    else files.push(entry.name);
  }
  return files.sort();
}

// Normalize only the approved per-file differences; every other runtime byte must match.
function normalize(file, bytes) {
  if (!['app.js', 'logic.js', 'sw.js', 'index.html', 'manifest.webmanifest'].includes(file)) return bytes;
  let source = bytes.toString();
  if (file === 'app.js' || file === 'logic.js') source = source.replaceAll('magic-choice-dist.', 'magic-choice.');
  if (file === 'app.js' || file === 'sw.js' || file === 'index.html') source = source.replaceAll('choice-dist-shell-', 'choice-shell-');
  if (file === 'sw.js') source = source.replace('ready-1-nostatus-1-distribution\';', 'ready-1-nostatus-1\';');
  if (file === 'manifest.webmanifest') source = source.replace('"id": "./"', '"id": "./choice"');
  return Buffer.from(source);
}

test('Choice snapshot preserves every personal runtime byte except explicit distribution differences', async () => {
  const personalFiles = (await filesUnder('zz4')).filter(file => !/\.test\./.test(file));
  assert.deepEqual(await filesUnder(shared), personalFiles);
  assert.deepEqual([...CHOICE_DISTRIBUTION_FILES].sort(), personalFiles);
  for (const file of personalFiles) {
    const snapshot = await read(`${shared}/${file}`);
    assert.deepEqual(normalize(file, snapshot), await read(`zz4/${file}`), file);
    assert.equal(snapshot.includes(Buffer.from('magic-choice.')), false, file);
    assert.equal(shouldCopyChoice(file), true, file);
  }
  for (const file of CHOICE_FILES) assert.ok(personalFiles.includes(file));
  for (const file of ['app.test.js', 'logic.test.mjs', 'other.test.css', 'README.md', 'home-icons/private.png']) assert.equal(shouldCopyChoice(file), false);
  assert.equal(shouldCopyChoice('home-icons'), true);
  assert.deepEqual(DISTRIBUTION_APPS.find(app => app.tool === 'choice'), { source: shared, target: 'choice', tool: 'choice' });
  const manifest = JSON.parse(await read(`${shared}/manifest.webmanifest`));
  assert.equal(manifest.id, './');
  assert.equal(manifest.name, '너의 선택은?');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const file of ['app.js', 'index.html', 'sw.js']) assert.match((await read(`${shared}/${file}`)).toString(), /choice-dist-shell-/);
  assert.match((await read(`${shared}/sw.js`)).toString(), /CACHE_NAME = CACHE_PREFIX \+ '[^']+-distribution'/);
});

test('Choice entry variants gate runtime and expose only exact installation metadata', () => {
  for (const path of ['/tools/choice', '/tools/choice/', '/tools/CHOICE/', '/TOOLS/CHOICE/', '/tools//choice//index.html', '/tools/choice/index', '/tools/choice/index.html', '/tools/choice/app.js', '/tools/choice/sw.js', '/tools/choice/icon.svg', '/tools/choice/nested/icon-192.png', '/tools/choice/index/manifest.webmanifest']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'choice' }, path);
  }
  for (const path of ['/tools/choice/../index', '/tools/choice/%2e%2e/index']) assert.deepEqual(classifyPath(path), { mode: 'block' });
  for (const file of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png']) assert.deepEqual(classifyPath(`/tools/choice/${file}`), { mode: 'public' });
  assert.equal(allowOnCheckError('choice'), false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'choice').valid, false);
  assert.equal(gateCookieName('choice'), 'kali_choice_gate');
  assert.equal(accessTableForTool('choice'), 'friend_app_access');
  assert.equal(isValidTool('choice'), true);
  assert.ok(FRIEND_APP_TOOLS.has('choice'));
});

test('Choice edge gate checks live grants and rejects missing, wrong, revoked and unavailable access', async () => {
  const previousFetch = globalThis.fetch;
  const previousNetlify = globalThis.Netlify;
  const secret = 'choice-test-secret';
  globalThis.Netlify = { env: { get: () => secret } };
  let calls = 0;
  const context = { next: async () => { calls++; return new Response('runtime'); } };
  try {
    const token = await signGateCookie('friend@example.com', 'choice', secret);
    assert.equal((await verifyGateCookie(token, secret)).tool, 'choice');
    const wrong = await signGateCookie('friend@example.com', 'all', secret);
    const request = (path, cookie = '') => new Request(`https://example.com${path}`, { headers: { cookie } });
    for (const path of ['/tools/choice', '/tools/CHOICE/', '/tools/choice/index']) {
      const denied = await gate(request(path), context);
      assert.equal(denied.status, 302);
      assert.ok(new URL(denied.headers.get('location')).searchParams.get('to').startsWith('/tools/choice/'));
      assert.equal((await gate(request(path, `kali_choice_gate=${wrong}`), context)).status, 302);
    }
    for (const behavior of ['revoked', 'error', 'approved']) {
      globalThis.fetch = async (url, options) => {
        assert.equal(new URL(url).searchParams.get('tool'), 'choice');
        assert.equal(options.cache, 'no-store');
        if (behavior === 'error') throw new Error('offline');
        return new Response(JSON.stringify({ ok: behavior === 'approved' }));
      };
      assert.equal((await gate(request('/tools/choice/app.js', `kali_choice_gate=${token}`), context)).status, behavior === 'approved' ? 200 : 302);
    }
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
  }
});

test('Choice login, hosting, migration and both new admin grants are registered', async () => {
  const window = {};
  vm.runInNewContext((await read('tools/login/gate-util.js')).toString(), { window });
  assert.equal(window.ToolGateUtil.safeTo('/tools/choice/index.html'), '/tools/choice/index.html');
  assert.equal(window.ToolGateUtil.toolFromPath('/tools/choice/'), 'choice');
  assert.match((await read('tools/login/login.js')).toString(), /choice: '너의 선택은\?'/);
  const context = {};
  vm.runInNewContext((await read('admin-app-model.js')).toString(), context);
  const html = (await read('admin.html')).toString();
  for (const [tool, name] of [['choice', '너의 선택은?'], ['pimax', 'Pi Max 연습실']]) {
    assert.ok(context.AdminAppModel.APP_CATALOG.some(app => app.id === tool && app.path === `/tools/${tool}/`));
    assert.equal(context.AdminAppModel.toolLabel(tool), name);
    assert.ok(html.includes(`data-app-card="${tool}"`));
    assert.ok(html.includes(`data-copy-link="/tools/${tool}/"`));
  }
  assert.match((await read('netlify.toml')).toString(), /for = "\/tools\/choice\/manifest\.webmanifest"\s*\[headers.values\]\s*Content-Type = "application\/manifest\+json"/);
  const sql = (await read('supabase/migrations/20261010_friend_apps_choice.sql')).toString();
  assert.match(sql, /begin;[\s\S]*drop constraint if exists friend_app_access_tool_check;[\s\S]*add constraint friend_app_access_tool_check[\s\S]*commit;/);
  assert.deepEqual([...sql.matchAll(/'([^']+)'/g)].map(match => match[1]), [...FRIEND_APP_TOOLS]);
  assert.doesNotMatch(sql, /row level security|create policy|drop policy/i);
});

// Build tests generate dist in the full suite; run this explicitly after npm run build.
test('Choice built distribution injects its access check and publishes every shell asset without tests', { skip: process.env.CHOICE_VERIFY_DIST !== '1' }, async () => {
  const route = 'dist/tools/choice';
  assert.deepEqual(await filesUnder(route), await filesUnder(shared));
  const html = (await read(`${route}/index.html`)).toString();
  assert.match(html, /id="friend-apps-check"/);
  assert.match(html, /fetch\('\/tools\/_check\?tool=choice'/);
  const manifest = JSON.parse(await read(`${route}/manifest.webmanifest`));
  assert.equal(manifest.id, '/tools/choice/');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  const sw = (await read(`${route}/sw.js`)).toString();
  const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/)[1];
  for (const [, file] of shell.matchAll(/"(\.\/[^"\n]*)"/g)) assert.ok((await stat(new URL(`${route}/${file}`, root))).isFile(), file);
  assert.equal((await filesUnder('dist')).some(file => /\.test\./.test(file)), false);
});
