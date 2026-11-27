import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { accessDatabase } from './legacy-access-fixture.mjs';
import { postToolAccess, deleteToolAccess, listToolAccess } from '../../netlify/functions/admin-tools.mjs';
import { legacyAccessForTool, mutateLegacyAccess } from '../../netlify/functions/_lib/legacy-app-access.mjs';
import { decideAccess } from '../../netlify/functions/tool-access.mjs';

const id = '00000000-0000-4000-8000-000000000001';
const viewer = { userId: '00000000-0000-4000-8000-000000000002' };
const email = 'member@example.test';
const base = { id, email, tool: 'all', status: 'approved', lifetime: false };
const post = (db, payload) => postToolAccess({ body: JSON.stringify(payload) }, viewer, db);

test('legacy all listing expands into two independently addressable rows', async () => {
  const db = accessDatabase({ tool_access: [base] });
  const body = JSON.parse((await listToolAccess(db)).body);
  assert.deepEqual(body.approved.map((row) => [row.id, row.tool, row.lifetime]), [[id, 'calc', false], [id, 'stopwatch', false]]);
});

test('explicit lifetime conversion changes only selected app; repeat and ordinary grant preserve duration', async () => {
  const db = accessDatabase({ tool_access: [base] });
  assert.equal((await post(db, { action: 'lifetime', id, tool: 'calc' })).statusCode, 200);
  assert.equal(legacyAccessForTool(db.rows.tool_access[0], 'calc').lifetime, true);
  assert.equal(legacyAccessForTool(db.rows.tool_access[0], 'stopwatch').lifetime, false);
  assert.equal((await post(db, { action: 'lifetime', id, tool: 'calc' })).statusCode, 200);
  assert.equal(db.writes, 1);
  await post(db, { action: 'grantBulk', email, tools: ['calc', 'stopwatch'], lifetime: true });
  assert.equal(legacyAccessForTool(db.rows.tool_access[0], 'stopwatch').lifetime, false);
  await post(db, { action: 'approve', id, tool: 'calc', lifetime: false });
  assert.equal(legacyAccessForTool(db.rows.tool_access[0], 'calc').lifetime, true);
  assert.equal(db.writes, 1);
});

test('revoking either member of legacy all preserves sibling status and duration', async () => {
  for (const tool of ['calc', 'stopwatch']) {
    const db = accessDatabase({ tool_access: [{ ...base, lifetime: true }] });
    const response = await deleteToolAccess({ queryStringParameters: { id, tool } }, db);
    assert.equal(response.statusCode, 200);
    const sibling = tool === 'calc' ? 'stopwatch' : 'calc';
    assert.equal(decideAccess(db.rows.tool_access[0], tool), 'deny');
    assert.equal(decideAccess(db.rows.tool_access[0], sibling), 'allow');
    assert.equal(legacyAccessForTool(db.rows.tool_access[0], sibling).lifetime, true);
    assert.equal((await deleteToolAccess({ queryStringParameters: { id, tool } }, db)).statusCode, 404);
    assert.equal(db.rows.tool_access.length, 1);
  }
});

test('approve one app keeps the other half of an old pending all request pending', async () => {
  const db = accessDatabase({ tool_access: [{ ...base, status: 'pending' }] });
  await post(db, { action: 'approve', id, tool: 'stopwatch', lifetime: true });
  const body = JSON.parse((await listToolAccess(db)).body);
  assert.deepEqual(body.pending.map((row) => row.tool), ['calc']);
  assert.deepEqual(body.approved.map((row) => row.tool), ['stopwatch']);
  assert.equal(decideAccess(db.rows.tool_access[0], 'calc'), 'pending');
  assert.equal(decideAccess(db.rows.tool_access[0], 'stopwatch'), 'allow');
});

test('concurrent conversions and grants retry snapshots without losing sibling state', async () => {
  const db = accessDatabase({ tool_access: [{ ...base, tool: 'calc' }] });
  let waiting;
  let arrived = 0;
  const barrier = new Promise((resolve) => { waiting = resolve; });
  db.beforeMutation = async () => {
    arrived += 1;
    if (arrived === 2) waiting();
    if (arrived <= 2) await barrier;
  };
  const responses = await Promise.all([
    post(db, { action: 'lifetime', id, tool: 'calc' }),
    post(db, { action: 'grantBulk', email, tools: ['stopwatch'], lifetime: false })
  ]);
  assert.ok(responses.every((response) => response.statusCode === 200));
  assert.equal(legacyAccessForTool(db.rows.tool_access[0], 'calc').lifetime, true);
  assert.equal(legacyAccessForTool(db.rows.tool_access[0], 'stopwatch').lifetime, false);
  assert.equal(db.writes, 3);
});

test('concurrent initial grants retry unique email conflict and preserve both apps', async () => {
  const db = accessDatabase();
  await Promise.all(['calc', 'stopwatch'].map((tool) => mutateLegacyAccess(db, { email, tool, action: 'grant', lifetime: tool === 'calc' })));
  assert.equal(db.rows.tool_access.length, 1);
  assert.equal(legacyAccessForTool(db.rows.tool_access[0], 'calc').lifetime, true);
  assert.equal(legacyAccessForTool(db.rows.tool_access[0], 'stopwatch').lifetime, false);
});

test('requests record the exact app and requesting a sibling preserves existing lifetime', async () => {
  const db = accessDatabase();
  await mutateLegacyAccess(db, { email, tool: 'calc', action: 'request', userId: viewer.userId });
  assert.equal(db.rows.tool_access[0].tool, 'calc');
  assert.equal(decideAccess(db.rows.tool_access[0], 'calc'), 'pending');
  await mutateLegacyAccess(db, { email, tool: 'calc', action: 'approve', lifetime: true });
  await mutateLegacyAccess(db, { email, tool: 'stopwatch', action: 'request', userId: viewer.userId });
  assert.equal(decideAccess(db.rows.tool_access[0], 'stopwatch'), 'pending');
  assert.equal(legacyAccessForTool(db.rows.tool_access[0], 'calc').lifetime, true);
  const writes = db.writes;
  await mutateLegacyAccess(db, { email, tool: 'stopwatch', action: 'request' });
  assert.equal(db.writes, writes);
});

test('unapplied additive migration fails legacy mutation closed', async () => {
  const db = accessDatabase({ tool_access: [base] });
  db.beforeMutation = (query) => { query.then = undefined; throw Object.assign(new Error('missing column'), { code: '42703' }); };
  // A real PostgREST missing-column response is returned, rather than thrown.
  const originalFrom = db.from;
  db.from = (table) => {
    const query = originalFrom(table);
    query.update = () => ({ eq() { return this; }, is() { return this; }, select: async () => ({ error: { code: '42703' } }) });
    return query;
  };
  const response = await post(db, { action: 'lifetime', id, tool: 'calc' });
  assert.equal(response.statusCode, 503);
  assert.equal(JSON.parse(response.body).error, 'legacy_apps_migration_required');
  assert.equal(db.rows.tool_access[0].per_app_access, null);
});

test('friend lifetime conversion requires an approved matching app', async () => {
  const db = accessDatabase({ friend_app_access: [{ ...base, tool: 'unlock' }] });
  assert.equal((await post(db, { action: 'lifetime', id, tool: 'unlock' })).statusCode, 200);
  assert.equal(db.rows.friend_app_access[0].lifetime, true);
  assert.equal((await post(db, { action: 'lifetime', id, tool: 'choice' })).statusCode, 404);
});

test('migration is additive and preserves legacy rows and indexes', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261127_tool_access_per_app.sql', import.meta.url), 'utf8');
  assert.match(sql, /add column if not exists per_app_access jsonb/);
  assert.doesNotMatch(sql, /\b(drop|delete|update)\b/i);
});

test('already approved friend app is not converted or downgraded by repeated approval', async () => {
  const db = accessDatabase({ friend_app_access: [{ ...base, tool: 'unlock', lifetime: true }] });
  assert.equal((await post(db, { action: 'approve', id, tool: 'unlock', lifetime: false })).statusCode, 200);
  assert.equal(db.rows.friend_app_access[0].lifetime, true);
});

test('cookie checks honor selected app in an old all cookie without clearing its sibling', async () => {
  const { handler } = await import('../../netlify/functions/tool-check.mjs');
  const { signGateCookie } = await import('../../netlify/functions/_lib/tool-gate.mjs');
  const originalFetch = globalThis.fetch;
  const names = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'TOOL_GATE_SECRET'];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  Object.assign(process.env, { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'synthetic', TOOL_GATE_SECRET: 'synthetic-secret' });
  const row = { ...base, tool: 'stopwatch', per_app_access: { stopwatch: { status: 'approved', lifetime: true } } };
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/rest/v1/tool_access');
    assert.equal(url.searchParams.get('email'), `ilike.${email}`);
    return new Response(JSON.stringify(row), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const cookie = await signGateCookie(email, 'all', 'synthetic-secret');
    const check = (tool) => handler({ httpMethod: 'GET', queryStringParameters: { tool }, headers: { cookie: `kali_tool_gate=${cookie}` } });
    const revoked = await check('calc');
    assert.deepEqual(JSON.parse(revoked.body), { ok: false, reason: 'revoked' });
    assert.equal(revoked.headers['Set-Cookie'], undefined);
    assert.deepEqual(JSON.parse((await check('stopwatch')).body), { ok: true });
    for (const tool of ['calc', 'stopwatch']) {
      const individual = await signGateCookie(email, tool, 'synthetic-secret');
      const response = await handler({ httpMethod: 'GET', queryStringParameters: { tool }, headers: { cookie: `kali_tool_gate=${individual}` } });
      assert.equal(JSON.parse(response.body).ok, tool === 'stopwatch');
      if (tool === 'calc') assert.match(response.headers['Set-Cookie'], /Max-Age=0/);
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) { if (original[name] === undefined) delete process.env[name]; else process.env[name] = original[name]; }
  }
});

test('email matching preserves escaped case-insensitive legacy lookup', async () => {
  let pattern;
  const db = { from() { return { select() { return this; }, ilike(key, value) { assert.equal(key, 'email'); pattern = value; return this; }, limit() { return this; }, maybeSingle: async () => ({ data: { ...base, email: 'Name_%@Example.Test' }, error: null }) }; } };
  const result = await mutateLegacyAccess(db, { email: 'name_%@example.test', tool: 'calc', action: 'grant' });
  assert.equal(result.outcome, 'alreadyGranted');
  assert.equal(pattern, 'name\\_\\%@example.test');
});

test('new legacy cookies coexist with distinct durations and edge accepts historic shared cookies', async () => {
  const { gateCookieName, signGateCookie } = await import('../../netlify/functions/_lib/tool-gate.mjs');
  const { default: toolsGate } = await import('../../netlify/edge-functions/tools-gate.mjs');
  const prior = globalThis.Netlify;
  globalThis.Netlify = { env: { get: () => 'synthetic-secret' } };
  try {
    assert.notEqual(gateCookieName('calc'), gateCookieName('stopwatch'));
    const calc = await signGateCookie(email, 'calc', 'synthetic-secret', Date.now(), 'life');
    const stopwatch = await signGateCookie(email, 'stopwatch', 'synthetic-secret', Date.now(), 'std');
    const all = await signGateCookie(email, 'all', 'synthetic-secret');
    const context = { next: async () => new Response('app') };
    const check = async (path, cookie) => toolsGate(new Request(`https://example.test/tools/${path}/`, { headers: { cookie } }), context);
    const both = `${gateCookieName('calc')}=${calc}; ${gateCookieName('stopwatch')}=${stopwatch}`;
    for (const path of ['hitsuzen', 'kairos-classic']) {
      assert.equal(await (await check(path, both)).text(), 'app');
      assert.equal(await (await check(path, `kali_tool_gate=${all}`)).text(), 'app');
    }
    assert.equal(await (await check('hitsuzen', `kali_tool_gate=${calc}`)).text(), 'app');
    assert.equal(await (await check('kairos-classic', `kali_tool_gate=${stopwatch}`)).text(), 'app');
    assert.equal((await check('kairos-classic', `${gateCookieName('calc')}=${calc}`)).status, 302);
  } finally {
    globalThis.Netlify = prior;
  }
});
