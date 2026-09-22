import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
import { decideAccess } from '../../netlify/functions/tool-access.mjs';
import { isValidTool } from '../../netlify/functions/admin-tools.mjs';
import { signGateCookie, verifyGateCookie } from '../../netlify/functions/_lib/tool-gate.mjs';
import { clearGateCookie, selectGate, allowOnCheckError } from '../../netlify/functions/tool-check.mjs';

test('unlock and integrated stopwatch routes require the dedicated Google grant', () => {
  for (const path of ['/zz5/', '/zz5/logic.js', '/zz6/', '/zz6/logic.js']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'friend-apps' });
  }
  assert.deepEqual(classifyPath('/zz5/sw.js'), { mode: 'public' });
  assert.deepEqual(classifyPath('/zz6/sw.js'), { mode: 'public' });
  assert.deepEqual(classifyPath('/zz5evil/'), { mode: 'block' });
  assert.equal(decideAccess({ status: 'approved', tool: 'friend-apps' }, 'friend-apps'), 'allow');
  assert.equal(decideAccess({ status: 'approved', tool: 'all' }, 'friend-apps'), 'allow');
  assert.equal(decideAccess({ status: 'approved', tool: 'calc' }, 'friend-apps'), 'deny');
  assert.equal(isValidTool('friend-apps'), true);
});

test('an installed app checks the network before serving a cached screen', async () => {
  for (const app of ['zz5', 'zz6']) {
    const source = readFileSync(new URL(`../../${app}/sw.js`, import.meta.url), 'utf8');
    const listeners = {};
    const networkResponse = { source: 'network' };
    const cachedResponse = { source: 'cache' };
    const context = vm.createContext({
      URL,
      self: {
        registration: { scope: `https://example.com/${app}/` },
        location: { origin: 'https://example.com' },
        addEventListener(name, callback) { listeners[name] = callback; }
      },
      caches: {
        open: async () => ({ match: async () => cachedResponse }),
        match: async () => cachedResponse
      },
      fetch: async () => networkResponse
    });
    vm.runInContext(source, context);
    let result;
    listeners.fetch({
      request: { method: 'GET', url: `https://example.com/${app}/`, mode: 'navigate' },
      respondWith(promise) { result = promise; }
    });
    assert.equal((await result).source, 'network', `${app} must observe revoked online access`);
  }
});

test('the dedicated grant can be signed and verified without granting legacy tools', async () => {
  const now = 1_800_000_000_000;
  const cookie = await signGateCookie('friend@example.com', 'friend-apps', 'test-secret', now);
  const gate = await verifyGateCookie(cookie, 'test-secret', now);
  assert.equal(gate.valid, true);
  assert.equal(gate.tool, 'friend-apps');
  assert.equal(gate.tool === 'calc' || gate.tool === 'all', false);
  assert.match(clearGateCookie('friend-apps'), /Path=\//);
  assert.doesNotMatch(clearGateCookie('friend-apps'), /Path=\/tools/);
  assert.match(clearGateCookie('calc'), /Path=\/tools/);
  assert.equal(allowOnCheckError('friend-apps'), false);
  assert.equal(allowOnCheckError('calc'), true);
  assert.deepEqual(selectGate([{ valid: true, tool: 'calc' }, { valid: true, tool: 'friend-apps' }], 'friend-apps'), { valid: true, tool: 'friend-apps' });
  assert.equal(selectGate([{ valid: true, tool: 'calc' }], 'friend-apps').valid, false);
});

test('login return paths stay on the two friend apps', () => {
  const source = readFileSync(new URL('../../tools/login/gate-util.js', import.meta.url), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source, context);
  assert.equal(context.ToolGateUtil.safeTo('/zz5/'), '/zz5/');
  assert.equal(context.ToolGateUtil.safeTo('/zz6/?from=invite'), '/zz6/?from=invite');
  assert.equal(context.ToolGateUtil.toolFromPath('/zz5/'), 'friend-apps');
  assert.equal(context.ToolGateUtil.toolFromPath('/zz6/'), 'friend-apps');
  assert.equal(context.ToolGateUtil.safeTo('/zz5/../admin.html'), '/tools/calc/');
});

test('each app checks its Google grant before showing an online cached screen', async () => {
  for (const app of ['zz5', 'zz6']) {
    const html = readFileSync(new URL(`../../${app}/index.html`, import.meta.url), 'utf8');
    const script = html.match(/<script id="friend-apps-check">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script, `${app} requires an early access check`);
    let redirectedTo = null;
    const context = vm.createContext({
      location: {
        protocol: 'https:', pathname: `/${app}/`, search: '', hash: '',
        replace(value) { redirectedTo = value; }
      },
      document: { documentElement: { style: { visibility: '' } } },
      fetch: async () => ({ json: async () => ({ ok: false }) })
    });
    vm.runInContext(script, context);
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(redirectedTo || '', /\/tools\/login\/\?to=/);
  }
});
