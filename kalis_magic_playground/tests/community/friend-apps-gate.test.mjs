import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
import { decideAccess, requestFriendApp } from '../../netlify/functions/tool-access.mjs';
import { isValidTool, accessTableForTool, postToolAccess, deleteToolAccess } from '../../netlify/functions/admin-tools.mjs';
import { signGateCookie, verifyGateCookie, gateCookieName } from '../../netlify/functions/_lib/tool-gate.mjs';
import { clearGateCookie, allowOnCheckError, selectGate } from '../../netlify/functions/tool-check.mjs';
import { friendAccessDecision, findFriendAccess } from '../../netlify/functions/_lib/friend-app-access.mjs';

test('unlock and integrated stopwatch routes require separate Google grants', () => {
  for (const path of ['/zz5/', '/zz5/logic.js']) assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'unlock' });
  for (const path of ['/zz6/', '/zz6/logic.js']) assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'stopwatch-uni' });
  assert.deepEqual(classifyPath('/zz5/sw.js'), { mode: 'public' });
  assert.deepEqual(classifyPath('/zz6/sw.js'), { mode: 'public' });
  assert.deepEqual(classifyPath('/zz5evil/'), { mode: 'block' });
  assert.equal(decideAccess({ status: 'approved', tool: 'unlock' }, 'unlock'), 'allow');
  assert.equal(decideAccess({ status: 'approved', tool: 'unlock' }, 'stopwatch-uni'), 'deny');
  assert.equal(isValidTool('unlock'), true);
  assert.equal(isValidTool('stopwatch-uni'), true);
  assert.equal(isValidTool('friend-apps'), false);
  assert.equal(accessTableForTool('unlock'), 'friend_app_access');
  assert.equal(accessTableForTool('stopwatch-uni'), 'friend_app_access');
  assert.equal(accessTableForTool('calc'), 'tool_access');
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

test('the stopwatch worker never caches the Google approval check', () => {
  const source = readFileSync(new URL('../../zz6/sw.js', import.meta.url), 'utf8');
  const listeners = {};
  vm.runInNewContext(source, {
    URL,
    caches: { match: async () => null },
    fetch: async () => ({ ok: false }),
    self: {
      registration: { scope: 'https://example.com/zz6/' },
      location: { origin: 'https://example.com' },
      addEventListener(name, callback) { listeners[name] = callback; }
    }
  });
  let intercepted = false;
  listeners.fetch({
    request: { method: 'GET', url: 'https://example.com/tools/_check?tool=stopwatch-uni', mode: 'cors' },
    respondWith() { intercepted = true; }
  });
  assert.equal(intercepted, false);
});

test('each app has its own signed cookie and can be revoked separately', async () => {
  const now = 1_800_000_000_000;
  const cookie = await signGateCookie('friend@example.com', 'unlock', 'test-secret', now);
  const gate = await verifyGateCookie(cookie, 'test-secret', now);
  assert.equal(gate.valid, true);
  assert.equal(gate.tool, 'unlock');
  assert.equal(gate.tool === 'calc' || gate.tool === 'all', false);
  assert.equal(gateCookieName('unlock'), 'kali_unlock_gate');
  assert.equal(gateCookieName('stopwatch-uni'), 'kali_stopwatch_uni_gate');
  assert.notEqual(gateCookieName('unlock'), gateCookieName('stopwatch-uni'));
  assert.match(clearGateCookie('unlock'), /kali_unlock_gate=.*Path=\//);
  assert.doesNotMatch(clearGateCookie('unlock'), /Path=\/tools/);
  assert.match(clearGateCookie('calc'), /Path=\/tools/);
  assert.equal(allowOnCheckError('unlock'), false);
  assert.equal(allowOnCheckError('stopwatch-uni'), false);
  assert.equal(allowOnCheckError('calc'), true);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'unlock').valid, false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'stopwatch-uni').valid, false);
});

test('login return paths stay on the two friend apps', () => {
  const source = readFileSync(new URL('../../tools/login/gate-util.js', import.meta.url), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source, context);
  assert.equal(context.ToolGateUtil.safeTo('/zz5/'), '/zz5/');
  assert.equal(context.ToolGateUtil.safeTo('/zz6/?from=invite'), '/zz6/?from=invite');
  assert.equal(context.ToolGateUtil.toolFromPath('/zz5/'), 'unlock');
  assert.equal(context.ToolGateUtil.toolFromPath('/zz6/'), 'stopwatch-uni');
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
    assert.match(html, new RegExp(`/tools/_check\\?tool=${app === 'zz5' ? 'unlock' : 'stopwatch-uni'}`));
  }
});

test('friend app migration stores one approval per email and app', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20260923_friend_apps_access.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.friend_app_access/i);
  assert.match(sql, /unique index if not exists friend_app_access_email_tool_idx/i);
  assert.match(sql, /row level security/i);
});

test('each friend app request is looked up by its own tool', async () => {
  const filters = [];
  const supabase = { from(table) {
    assert.equal(table, 'friend_app_access');
    return {
      select() { return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      limit() { return this; },
      maybeSingle: async () => ({ data: null, error: null }),
      ilike(key, value) { filters.push([key, value]); return this; }
    };
  } };
  const result = await findFriendAccess(supabase, 'user-1', 'friend@example.com', 'unlock');
  assert.equal(result.data, null);
  assert.equal(filters.filter(([key, value]) => key === 'tool' && value === 'unlock').length, 2);
  assert.equal(friendAccessDecision(null), 'create');
  assert.equal(friendAccessDecision({ status: 'pending' }), 'pending');
  assert.equal(friendAccessDecision({ status: 'approved' }), 'allow');
});

test('one Google account can request both apps and receive only the approved app', async () => {
  const rows = [];
  const supabase = { from(table) {
    assert.equal(table, 'friend_app_access');
    const filters = [];
    return {
      select() { return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      ilike(key, value) { filters.push([key, value]); return this; },
      limit() { return this; },
      async maybeSingle() {
        return { data: rows.find((row) => filters.every(([key, value]) => row[key] === value)) || null, error: null };
      },
      async insert(row) { rows.push({ id: String(rows.length + 1), ...row }); return { error: null }; }
    };
  } };
  const viewer = { userId: 'user-1' };
  const identity = { email: 'friend@example.com', displayName: 'Friend', nickname: null };
  assert.equal((await requestFriendApp(supabase, viewer, identity, 'unlock', 'secret')).statusCode, 403);
  assert.equal((await requestFriendApp(supabase, viewer, identity, 'stopwatch-uni', 'secret')).statusCode, 403);
  assert.deepEqual(rows.map((row) => row.tool), ['unlock', 'stopwatch-uni']);
  rows[0].status = 'approved';
  const unlock = await requestFriendApp(supabase, viewer, identity, 'unlock', 'secret');
  assert.equal(unlock.statusCode, 200);
  assert.match(unlock.headers['Set-Cookie'], /^kali_unlock_gate=/);
  assert.equal((await requestFriendApp(supabase, viewer, identity, 'stopwatch-uni', 'secret')).statusCode, 403);
});

test('admin approval and revocation target only the selected app table', async () => {
  const tables = [];
  const supabase = { from(table) {
    tables.push(table);
    return {
      update() { return this; },
      delete() { return this; },
      eq() { return this; },
      async select() { return { data: [{ id: 'a' }], error: null }; }
    };
  } };
  const id = '00000000-0000-4000-8000-000000000001';
  const response = await postToolAccess({ body: JSON.stringify({ action: 'approve', id, tool: 'unlock' }) }, { userId: 'admin-1' }, supabase);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(tables, ['friend_app_access']);
  tables.length = 0;
  await deleteToolAccess({ queryStringParameters: { id, tool: 'stopwatch-uni' } }, supabase);
  assert.deepEqual(tables, ['friend_app_access']);
});

test('admin direct email grants are stored per app', async () => {
  const tables = [];
  const supabase = { from(table) {
    tables.push(table);
    return { async insert() { return { error: null }; } };
  } };
  const response = await postToolAccess({ body: JSON.stringify({
    action: 'add', email: 'friend@example.com', tool: 'unlock'
  }) }, { userId: 'admin-1' }, supabase);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(tables, ['friend_app_access']);
});
