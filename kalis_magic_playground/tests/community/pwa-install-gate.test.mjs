import assert from 'node:assert/strict';
import test from 'node:test';
import toolsGate, { classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';

test('WebAPK icon fetches without credentials can reach both declared RELEASE maskable PNGs', async () => {
  for (const size of [192, 512]) {
    const path = `/tools/release/icon-maskable-${size}.png`;
    assert.deepEqual(classifyPath(path), { mode: 'public' });
    let nextCalls = 0;
    const response = await toolsGate(new Request(`https://example.test${path}?install=1`, {
      credentials: 'omit',
    }), { next: async () => {
      nextCalls += 1;
      return new Response('png fixture', { headers: { 'Content-Type': 'image/png' } });
    } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(nextCalls, 1);
  }
});

test('the RELEASE icon exception never opens app source or similar asset paths', async () => {
  for (const path of [
    '/tools/release/', '/tools/release/index.html', '/tools/release/sw.js',
    '/tools/release/logic.js', '/tools/release/install-prompt.js',
    '/tools/release/icon-maskable-1024.png', '/tools/release/icon-maskable-192.png.js',
    '/tools/release/nested/icon-maskable-192.png',
    '/tools/hitsuzen/icon-maskable-192.png', '/tools/release-extra/icon-maskable-512.png',
  ]) {
    assert.equal(classifyPath(path).mode, 'gated', path);
    let nextCalls = 0;
    const response = await toolsGate(new Request(`https://example.test${path}`), {
      next: async () => { nextCalls += 1; return new Response('protected'); },
    });
    assert.equal(response.status, 302, path);
    assert.equal(new URL(response.headers.get('location')).pathname, '/tools/login/');
    assert.equal(nextCalls, 0, path);
  }
  assert.deepEqual(classifyPath('/tools/release/../icon-maskable-192.png'), { mode: 'block' });
});
