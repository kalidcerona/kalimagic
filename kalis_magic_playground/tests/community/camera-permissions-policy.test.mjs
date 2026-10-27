import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { DISTRIBUTION_APPS } from '../../scripts/build-public.mjs';

// netlify.toml blocks the camera everywhere and re-allows it per path. An app that calls getUserMedia
// without a grant would ship with a dead camera, so this test finds every such app and checks the grant.
const root = new URL('../../', import.meta.url).pathname;
const toml = readFileSync(path.join(root, 'netlify.toml'), 'utf8');

const grants = new Map();
for (const block of toml.split('[[headers]]').slice(1)) {
  const target = /for\s*=\s*"([^"]+)"/.exec(block)?.[1];
  const policy = /Permissions-Policy\s*=\s*"([^"]+)"/.exec(block)?.[1];
  if (target && policy) grants.set(target, policy);
}
const allowsCamera = (target) => /camera=\(self\)/.test(grants.get(target) || '');

function sources(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sources(full));
    else if (/\.(?:js|mjs|html)$/.test(entry) && !/\.test\.mjs$/.test(entry)) found.push(full);
  }
  return found;
}

// Vendored game engines mention the API without being camera apps.
const VENDORED = new Set(['distribution-snapshots/planbcafe/love.js']);
const usesCamera = (file) => !VENDORED.has(path.relative(root, file)) && /getUserMedia/.test(readFileSync(file, 'utf8'));

test('the camera is blocked by default', () => {
  assert.match(grants.get('/*') || '', /camera=\(\)/);
});

test('every personal zz app that calls getUserMedia is granted the camera for its path', () => {
  const apps = readdirSync(root).filter((name) => /^zz\d+$/.test(name) && sources(path.join(root, name)).some(usesCamera));
  assert.ok(apps.includes('zz10') && apps.includes('zz15'), 'the scan finds the known camera apps');
  for (const app of apps) {
    assert.equal(allowsCamera(`/${app}`), true, `netlify.toml needs a camera=(self) header for /${app}`);
    assert.equal(allowsCamera(`/${app}/*`), true, `netlify.toml needs a camera=(self) header for /${app}/*`);
  }
});

test('every friend snapshot that calls getUserMedia is granted the camera on each route it is published to', () => {
  const folders = readdirSync(path.join(root, 'distribution-snapshots'))
    .filter((name) => statSync(path.join(root, 'distribution-snapshots', name)).isDirectory())
    .filter((name) => sources(path.join(root, 'distribution-snapshots', name)).some(usesCamera));
  // Routes come from the build itself, so a renamed target (calculator -> hitsuzen, qr -> arosaegida) is still covered.
  for (const folder of folders) {
    const routes = DISTRIBUTION_APPS.filter((app) => app.source === `distribution-snapshots/${folder}`).map((app) => `/tools/${app.target}`);
    assert.ok(routes.length > 0, `distribution-snapshots/${folder} calls getUserMedia but DISTRIBUTION_APPS does not publish it`);
    for (const route of routes) {
      assert.equal(allowsCamera(route), true, `netlify.toml needs a camera=(self) header for ${route}`);
      assert.equal(allowsCamera(`${route}/*`), true, `netlify.toml needs a camera=(self) header for ${route}/*`);
    }
  }
});

test('every hand-written tools folder that calls getUserMedia is granted the camera for its path', () => {
  for (const name of readdirSync(path.join(root, 'tools'))) {
    const dir = path.join(root, 'tools', name);
    if (!statSync(dir).isDirectory() || !sources(dir).some(usesCamera)) continue;
    assert.equal(allowsCamera(`/tools/${name}`), true, `netlify.toml needs a camera=(self) header for /tools/${name}`);
    assert.equal(allowsCamera(`/tools/${name}/*`), true, `netlify.toml needs a camera=(self) header for /tools/${name}/*`);
  }
});

test('the route mapping follows DISTRIBUTION_APPS, including sources published to several targets', () => {
  const kairos = DISTRIBUTION_APPS.filter((app) => app.source === 'distribution-snapshots/kairos').map((app) => app.target).sort();
  assert.deepEqual(kairos, ['kairos', 'kairos-classic']);
  assert.ok(DISTRIBUTION_APPS.some((app) => app.source === 'distribution-snapshots/calculator' && app.target === 'hitsuzen'));
});
