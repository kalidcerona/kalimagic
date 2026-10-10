import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import vm from 'node:vm';
import { PIMAX_FILES, PUBLIC_DIRS, MIRROR_PAIRS, DISTRIBUTION_APPS, shouldCopyPimax, preparePimaxRuntime, transformDistributionDocument } from '../../scripts/build-public.mjs';
import gate, { classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
import { gateCookieName, signGateCookie } from '../../netlify/functions/_lib/tool-gate.mjs';
import { allowOnCheckError, selectGate } from '../../netlify/functions/tool-check.mjs';
import { accessTableForTool, isValidTool } from '../../netlify/functions/admin-tools.mjs';
const read = (route, file) => readFile(new URL(`../../${route}/${file}`, import.meta.url));
const personal = 'zz14';
const shared = 'distribution-snapshots/pimax';

test('Pi Max has explicit runtime allowlists and source mirror checks', () => {
  assert.equal(PIMAX_FILES.length, 9);
  assert.ok(PUBLIC_DIRS.includes(personal));
  assert.deepEqual(DISTRIBUTION_APPS.find(a => a.target === 'pimax'), { source: shared, target: 'pimax', tool: 'pimax' });
  for (const file of PIMAX_FILES) {
    assert.equal(shouldCopyPimax(file), true);
    assert.ok(MIRROR_PAIRS.some(([s, m]) => s === `../../magic-pimax/${file}` && m === `zz14/${file}`));
  }
  assert.equal(shouldCopyPimax(''), true);
  for (const file of ['README.md', 'core.test.mjs', 'source-spec.md', 'Projects', 'Projects/index.html', 'docs', 'docs/index.html', 'package.json', 'private.pdf', 'icons/secret.png']) {
    assert.equal(shouldCopyPimax(file), false, file);
  }
});

test('Pi Max production boundary preserves runtime and drops appended development controls', () => {
  const runtime = 'const state = {};\nif (typeof document !== "undefined") boot();\n';
  assert.equal(preparePimaxRuntime(runtime), runtime);
  assert.equal(preparePimaxRuntime(runtime + 'window.addEventListener("dev-settings", () => {});\n'), runtime);
  assert.throws(() => preparePimaxRuntime('boot();'), /exactly one boot boundary/);
  assert.throws(() => preparePimaxRuntime(runtime + runtime), /exactly one boot boundary/);
});

test('Pi Max pinned snapshot excludes development controls and isolates three storage keys and cache name', async () => {
  assert.deepEqual((await readdir(new URL(`../../${shared}/`, import.meta.url))).sort(), [...PIMAX_FILES].sort());
  for (const file of PIMAX_FILES) {
    const p = await read(personal, file);
    const d = await read(shared, file);
    if (file === 'app.mjs') {
      assert.equal((d.toString().match(/pimax\.distribution\./g) || []).length, 3);
      const normalized = d.toString().replaceAll('pimax.distribution.settings', 'pimax-practice-settings').replaceAll('pimax.distribution.stats', 'pimax-practice-stats').replaceAll('pimax.distribution.session', 'pimax-practice-session');
      assert.equal(normalized, preparePimaxRuntime(p.toString()));
    } else if (file === 'sw.js') {
      assert.equal(d.toString().replace('v20261005-7-coherent-1-compat-1-distribution', 'v20261005-7-coherent-1-compat-1'), p.toString());
    } else assert.deepEqual(d, p, file);
  }
});

test('Pi Max entry and code path variants retain the specific gate, with exact metadata exceptions', () => {
  for (const path of ['/tools/pimax', '/tools/pimax/', '/TOOLS/PIMAX/', '/tools//pimax//index.html', '/tools/pimax/index', '/tools/pimax/index.html', '/tools/pimax/sw.js', '/tools/pimax/app.mjs', '/tools/pimax/core.mjs', '/tools/pimax/icon.svg', '/tools/pimax/nested/icon-192.png', '/tools/pimax/index/manifest.webmanifest']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'pimax' }, path);
  }
  for (const path of ['/tools/pimax/../index', '/tools/pimax/%2e%2e/index']) assert.deepEqual(classifyPath(path), { mode: 'block' });
  for (const file of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png']) assert.deepEqual(classifyPath(`/tools/pimax/${file}`), { mode: 'public' });
  assert.equal(allowOnCheckError('pimax'), false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'pimax').valid, false);
  assert.equal(selectGate([{ valid: true, tool: 'usotsuki' }], 'pimax').valid, false);
  assert.equal(gateCookieName('pimax'), 'kali_pimax_gate');
  assert.equal(accessTableForTool('pimax'), 'friend_app_access');
  assert.equal(isValidTool('pimax'), true);
});

test('Pi Max edge gate denies missing, wrong, revoked and unavailable grants', async () => {
  const previousFetch = globalThis.fetch;
  const previousNetlify = globalThis.Netlify;
  const secret = 'pimax-test-secret';
  globalThis.Netlify = { env: { get: () => secret } };
  let calls = 0;
  const context = { next: async () => { calls++; return new Response('runtime'); } };
  try {
    const token = await signGateCookie('friend@example.com', 'pimax', secret);
    const wrong = await signGateCookie('friend@example.com', 'all', secret);
    const request = (path, cookie = '') => new Request(`https://example.com${path}`, { headers: { cookie } });
    for (const path of ['/tools/pimax', '/TOOLS/PIMAX/', '/tools//pimax//index', '/tools/pimax/index.html', '/tools/pimax/app.mjs']) {
      assert.equal((await gate(request(path), context)).status, 302);
      assert.equal((await gate(request(path, `kali_pimax_gate=${wrong}`), context)).status, 302);
    }
    const approvedRequest = request('/tools/pimax/app.mjs', `kali_pimax_gate=${token}`);
    for (const behavior of ['revoked', 'error', 'approved']) {
      globalThis.fetch = async (url, options) => {
        assert.equal(new URL(url).searchParams.get('tool'), 'pimax');
        assert.equal(options.cache, 'no-store');
        if (behavior === 'error') throw new Error('offline');
        return new Response(JSON.stringify({ ok: behavior === 'approved' }));
      };
      assert.equal((await gate(approvedRequest, context)).status, behavior === 'approved' ? 200 : 302);
    }
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
  }
});

test('Pi Max login return allowlist selects its own tool and rejects unsafe variants', async () => {
  const window = {};
  vm.runInNewContext((await read('tools/login', 'gate-util.js')).toString(), { window });
  assert.equal(window.ToolGateUtil.safeTo('/tools/pimax/index.html'), '/tools/pimax/index.html');
  assert.equal(window.ToolGateUtil.toolFromPath('/tools/pimax/'), 'pimax');
  for (const path of ['/tools/pimax', '/TOOLS/PIMAX/', '/tools/pimax/../index', '/tools//pimax/', '/tools/pimax/%2e%2e/index']) {
    assert.equal(window.ToolGateUtil.safeTo(path), '/tools/hitsuzen/');
  }
});

test('Pi Max service workers delete only their own cache family and never intercept access checks or sibling scopes', async () => {
  for (const route of [personal, shared]) {
    const listeners = {};
    const deleted = [];
    const scope = `https://example.com/${route === personal ? 'zz14' : 'tools/pimax'}/`;
    const keys = ['pimax-practice-old', 'pimax-practice-old-distribution', 'other-app'];
    vm.runInNewContext((await read(route, 'sw.js')).toString(), {
      URL, Response,
      self: { location: { origin: 'https://example.com' }, registration: { scope }, clients: { claim() {} }, addEventListener(n, f) { listeners[n] = f; } },
      caches: { keys: async () => keys, delete: async k => deleted.push(k) }
    });
    let done;
    listeners.activate({ waitUntil(p) { done = p; } });
    await done;
    assert.deepEqual(deleted, [route === personal ? keys[0] : keys[1]]);
    for (const path of ['/tools/_check?tool=pimax', route === personal ? '/tools/pimax/' : '/zz14/', '/tools/pimax-other/']) {
      let intercepted = false;
      listeners.fetch({ request: { method: 'GET', url: `https://example.com${path}` }, respondWith() { intercepted = true; } });
      assert.equal(intercepted, false, path);
    }
  }
});

test('Pi Max distribution HTML injects a live access check while personal HTML stays public', async () => {
  const html = (await read(personal, 'index.html')).toString();
  assert.equal(html.includes('friend-apps-check'), false);
  const transformed = transformDistributionDocument(html, { target: 'pimax', tool: 'pimax' });
  assert.match(transformed, /fetch\('\/tools\/_check\?tool=pimax'/);
  assert.match(transformed, /cache: 'no-store'/);
  assert.match(transformed, /data-magic-customize="off"/);
});

// Full-suite build tests own dist generation. This check runs explicitly after the isolated build.
test('Pi Max built trees contain only runtime files with valid HTML, module, manifest and SW references', { skip: process.env.PIMAX_VERIFY_DIST !== '1' }, async () => {
  for (const route of ['dist/zz14', 'dist/tools/pimax']) {
    assert.deepEqual((await readdir(new URL(`../../${route}/`, import.meta.url))).sort(), [...PIMAX_FILES].sort());
    const html = (await read(route, 'index.html')).toString();
    assert.equal(html.includes('friend-apps-check'), route.includes('/tools/'));
    const manifest = JSON.parse((await read(route, 'manifest.webmanifest')).toString());
    assert.equal(manifest.scope, './');
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.display, 'standalone');
    if (route.includes('/tools/')) assert.equal(manifest.id, '/tools/pimax/');
    const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]);
    for (const icon of manifest.icons) refs.push(icon.src);
    for (const file of ['app.mjs', 'core.mjs']) {
      refs.push(...[...(await read(route, file)).toString().matchAll(/(?:from\s*|import\s*)["'](\.\/[^"']+)["']/g)].map(m => m[1]));
    }
    const sw = (await read(route, 'sw.js')).toString();
    refs.push(...[...sw.matchAll(/"(\.\/[^"\n]*)"/g)].map(m => m[1]));
    for (const ref of refs) {
      const url = new URL(ref, new URL(`../../${route}/`, import.meta.url));
      assert.ok((await stat(url)).isFile() || ref === './', `${route}/${ref}`);
    }
    for (const file of PIMAX_FILES.filter(f => !['index.html', 'manifest.webmanifest'].includes(f))) {
      const expected = await read(route.includes('/tools/') ? shared : personal, file);
      if (file === 'app.mjs') assert.equal((await read(route, file)).toString(), preparePimaxRuntime(expected.toString()));
      else assert.deepEqual(await read(route, file), expected);
    }
  }
});
