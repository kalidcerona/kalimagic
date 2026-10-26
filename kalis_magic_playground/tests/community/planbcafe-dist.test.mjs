import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DISTRIBUTION_APPS, shouldCopyPlanbcafe, transformDistributionDocument, verifyAppDisplayPolicy } from '../../scripts/build-public.mjs';
import toolsGate, { classifyPath, PLANBCAFE_PUBLIC_BETA } from '../../netlify/edge-functions/tools-gate.mjs';
import { FRIEND_APP_TOOLS } from '../../netlify/functions/_lib/friend-app-access.mjs';
import { isValidTool } from '../../netlify/functions/admin-tools.mjs';

const root = new URL('../../', import.meta.url);
const snapshot = new URL('distribution-snapshots/planbcafe/', root);
const files = ['game.data', 'game.js', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/maskable-512.png', 'index.html', 'love.js', 'love.wasm', 'manifest.webmanifest', 'sw.js'].sort();
const repositoryFiles = [...files, '.gitattributes'].sort();
async function filesUnder(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await filesUnder(new URL(`${entry.name}/`, directory), `${name}/`));
    else result.push(name);
  }
  return result.sort();
}

const publicPaths = ['/tools/planbcafe', '/tools/planbcafe/', '/tools/PLANBCAFE/',
  '/TOOLS/PLANBCAFE/index.html', ...files.map(file => `/tools/planbcafe/${file}`)];
const blockedPaths = ['/tools/planbcafe/../calc/', '/tools/planbcafe/%2e%2e/calc/',
  '/tools/PLANBCAFE/%2E%2E/calc/index.html', '/tools/planbcafe/%2e/index.html',
  '/tools/planbcafe/./index.html', '/tools/planbcafe/%2e./calc/',
  '/tools/planbcafe/..%2fcalc/', '/tools/planbcafe/%2findex.html',
  '/tools//planbcafe/', '/tools/planbcafe//index.html', '//tools/planbcafe/',
  '/tools/planbcafe/icons//icon-192.png', '/tools/planbcafe/%', '/tools/planbcafe/%2F../calc/'];

test('PLAN B cafe publishes exactly its frozen game files with an explicit copy allowlist', async () => {
  assert.deepEqual(DISTRIBUTION_APPS.find(app => app.tool === 'planbcafe'), {
    source: 'distribution-snapshots/planbcafe', target: 'planbcafe', tool: 'planbcafe'
  });
  assert.deepEqual(await filesUnder(snapshot), repositoryFiles);
  for (const file of ['', 'icons', ...files]) assert.equal(shouldCopyPlanbcafe(file), true, file);
  for (const file of ['README.md', '.env', 'icons/private.png', 'icons/nested', 'icons/icon-192.png.bak',
    'game.data.map', 'game.js.map', 'private.wasm', 'test.js', '.gitattributes', '../index.html']) {
    assert.equal(shouldCopyPlanbcafe(file), false, file);
  }
  const temp = await mkdtemp(path.join(os.tmpdir(), 'planbcafe-copy-'));
  try {
    const source = path.join(temp, 'source');
    const target = path.join(temp, 'target');
    await cp(snapshot, source, { recursive: true });
    await writeFile(path.join(source, 'private.wasm'), 'excluded');
    await writeFile(path.join(source, 'icons/private.png'), 'excluded');
    await cp(source, target, { recursive: true, filter: entry => shouldCopyPlanbcafe(path.relative(source, entry)) });
    assert.deepEqual(await filesUnder(new URL(`file://${target}/`)), files);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('PLAN B cafe keeps its original HTML, manifest and game display policy', async () => {
  const html = await readFile(new URL('index.html', snapshot), 'utf8');
  assert.equal(transformDistributionDocument(html, { target: 'planbcafe', tool: 'planbcafe' }), html);
  assert.doesNotMatch(html, /friend-apps-check|\/tools\/_check/);
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', snapshot), 'utf8'));
  for (const field of ['id', 'start_url', 'scope']) assert.equal(manifest[field], './');
  assert.equal(manifest.display, 'fullscreen');
  assert.deepEqual(manifest.display_override, ['fullscreen', 'standalone']);
  assert.equal(manifest.orientation, 'landscape');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'planbcafe-policy-'));
  try {
    await cp(snapshot, path.join(temp, 'tools/planbcafe'), { recursive: true });
    await verifyAppDisplayPolicy(temp, ['tools/planbcafe']);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('PLAN B cafe public beta is route bounded and rejects traversal and duplicate separators', async () => {
  assert.equal(PLANBCAFE_PUBLIC_BETA, true);
  let calls = 0;
  const context = { next: async () => { calls++; return new Response('game'); } };
  for (const pathname of publicPaths) {
    assert.deepEqual(classifyPath(pathname), { mode: 'public' }, pathname);
    const response = await toolsGate({ url: `https://example.test${pathname}`, headers: new Headers() }, context);
    assert.equal(response.status, 200, pathname);
    assert.equal(response.headers.has('set-cookie'), false);
  }
  assert.equal(calls, publicPaths.length);
  for (const pathname of blockedPaths) {
    assert.deepEqual(classifyPath(pathname), { mode: 'block' }, pathname);
    // Preserve the raw URL: Request/URL constructors normalize dot segments before the gate sees them.
    const response = await toolsGate({ url: `https://example.test${pathname}`, headers: new Headers() }, context);
    assert.equal(response.status, 302, pathname);
    assert.equal(new URL(response.headers.get('location')).pathname, '/tools/login/');
  }
  assert.equal(calls, publicPaths.length, 'blocked paths must never serve static files');
  for (const pathname of ['/tools/planbcafe-other/', '/tools/planbcafee/', '/tools/calc/']) {
    assert.deepEqual(classifyPath(pathname), { mode: 'gated', tool: 'calc' });
  }
  assert.equal(FRIEND_APP_TOOLS.has('planbcafe'), false);
  assert.equal(isValidTool('planbcafe'), false);
});

test('PLAN B cafe gets explicit WASM and manifest MIME headers', async () => {
  const config = await readFile(new URL('netlify.toml', root), 'utf8');
  for (const [route, type] of [['*.wasm', 'application/wasm'], ['manifest.webmanifest', 'application/manifest+json']]) {
    assert.ok(config.includes(`for = "/tools/planbcafe/${route}"\n  [headers.values]\n    Content-Type = "${type}"`));
  }
});

test('PLAN B cafe built output equals every snapshot byte', { skip: process.env.PLANBCAFE_VERIFY_DIST !== '1' }, async () => {
  const output = new URL('dist/tools/planbcafe/', root);
  assert.deepEqual(await filesUnder(output), files);
  for (const file of files) assert.deepEqual(await readFile(new URL(file, output)), await readFile(new URL(file, snapshot)), file);
  await verifyAppDisplayPolicy(new URL('dist/', root).pathname, ['tools/planbcafe']);
});
