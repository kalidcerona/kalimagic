import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

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

test('every tools route or friend snapshot that calls getUserMedia is granted the camera for its path', () => {
  const folders = [];
  for (const base of ['tools', 'distribution-snapshots']) {
    const dir = path.join(root, base);
    for (const name of readdirSync(dir)) {
      if (statSync(path.join(dir, name)).isDirectory() && sources(path.join(dir, name)).some(usesCamera)) folders.push(`${base}/${name}`);
    }
  }
  for (const folder of folders) {
    const route = folder.startsWith('tools/') ? `/${folder}` : `/tools/${folder.split('/')[1]}`;
    assert.equal(allowsCamera(route), true, `netlify.toml needs a camera=(self) header for ${route}`);
    assert.equal(allowsCamera(`${route}/*`), true, `netlify.toml needs a camera=(self) header for ${route}/*`);
  }
});
