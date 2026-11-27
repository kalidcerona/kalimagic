import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformDistributionDocument } from '../../scripts/build-public.mjs';
import vm from 'node:vm';
import toolsGate, { BELL_PUBLIC_BETA, SLOT_PUBLIC_BETA, classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
import { decideAccess, requestFriendApp } from '../../netlify/functions/tool-access.mjs';
import { isValidTool, accessTableForTool, postToolAccess, deleteToolAccess } from '../../netlify/functions/admin-tools.mjs';
import { signGateCookie, verifyGateCookie, gateCookieName } from '../../netlify/functions/_lib/tool-gate.mjs';
import { clearGateCookie, allowOnCheckError, selectGate } from '../../netlify/functions/tool-check.mjs';
import { FRIEND_APP_TOOLS, friendAccessDecision, findFriendAccess } from '../../netlify/functions/_lib/friend-app-access.mjs';

test('logged-out Bell and Slot requests follow independent switches and reject invalid paths', async () => {
  const context = { next: () => new Response('app') };
  const launch = (pathname) => toolsGate({ url: `https://example.com${pathname}`, headers: new Headers() }, context);
  for (const [tool, asset, isPublic] of [
    ['bell', 'audio.mjs', BELL_PUBLIC_BETA],
    ['slot', 'app.mjs', SLOT_PUBLIC_BETA],
    ['memdeck', 'app.mjs', false],
    ['pimax', 'app.mjs', false],
    ['aletheia', 'app.js', false]
  ]) {
    const root = `/tools/${tool}/`;
    for (const pathname of [root, root + asset]) {
      const response = await launch(pathname);
      assert.equal(response.status, isPublic ? 200 : 302, pathname);
      if (!isPublic) {
        const redirect = new URL(response.headers.get('location'));
        assert.equal(redirect.pathname, '/tools/login/');
        assert.equal(redirect.searchParams.get('to'), pathname);
      }
    }
  }
  for (const [tool, isPublic] of [['bell', BELL_PUBLIC_BETA], ['slot', SLOT_PUBLIC_BETA]]) {
    const indexPath = `/tools//${tool}/index.html`;
    assert.deepEqual(classifyPath(indexPath), isPublic ? { mode: 'block' } : { mode: 'gated', tool });
    assert.equal((await launch(indexPath)).status, 302);
    for (const pathname of [`/tools/${tool}/%2e/index.html`, `/tools/${tool}/../index.html`]) {
      assert.deepEqual(classifyPath(pathname), { mode: 'block' });
      assert.equal((await launch(pathname)).status, 302);
    }
  }
});

test('double-slash install manifests follow each app’s configured beta mode', async () => {
  const gateUrl = new URL('../../netlify/edge-functions/tools-gate.mjs', import.meta.url);
  const source = readFileSync(gateUrl, 'utf8')
    .replace(/from '([.][^']+)'/g, (_, path) => `from '${new URL(path, gateUrl).href}'`);
  for (const bellPublic of [false, true]) {
    const slotPublic = !bellPublic;
    const configured = source
      .replace(/(const BELL_PUBLIC_BETA = )(true|false)/, `$1${bellPublic}`)
      .replace(/(const SLOT_PUBLIC_BETA = )(true|false)/, `$1${slotPublic}`);
    const gate = await import(`data:text/javascript,${encodeURIComponent(configured)}`);
    for (const [tool, isPublic] of [['bell', bellPublic], ['slot', slotPublic]]) {
      const path = `/tools/${tool}//manifest.webmanifest`;
      const response = await gate.default(new Request(`https://example.com${path}`), {
        next: () => new Response('manifest')
      });
      assert.equal(response.status, isPublic ? 302 : 200, path);
      if (isPublic) {
        assert.equal(new URL(response.headers.get('location')).searchParams.get('to'), '/tools/hitsuzen/');
      }
    }
  }
});

test('only canonical personal routes stay public while distribution routes retain separate grants', () => {
  for (const path of ['/zz1/', '/zz1/logic.js', '/zz2/', '/zz3/', '/zz3/sw.js', '/zz4/', '/zz4/app.js', '/zz5/', '/zz5/app.js', '/zz6/', '/zz6/app.js', '/zz7/', '/zz7/detector.js']) {
    assert.deepEqual(classifyPath(path), { mode: 'block' });
  }
  for (const path of ['/tools/stopwatch/', '/tools/stopwatch/logic.js']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'stopwatch' });
  }
  for (const path of ['/tools/unlock/', '/tools/unlock/logic.js']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'unlock' });
  }
  for (const path of ['/tools/stopwatch-uni/', '/tools/stopwatch-uni/logic.js']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'stopwatch-uni' });
  }
  for (const tool of ['aletheia', 'usotsuki']) {
    for (const path of [`/tools/${tool}`, `/tools/${tool}/`, `/tools/${tool}/logic.js`]) {
      assert.deepEqual(classifyPath(path), { mode: 'gated', tool });
    }
  }
  for (const path of ['/zz1evil/', '/zz8/', '/zz9/', '/zz9/photo.js', '/zz10/', '/%7azz1%2f..%2fzz2/']) {
    assert.deepEqual(classifyPath(path), { mode: 'block' });
  }
  assert.equal(decideAccess({ status: 'approved', tool: 'unlock' }, 'unlock'), 'allow');
  assert.equal(decideAccess({ status: 'approved', tool: 'unlock' }, 'stopwatch-uni'), 'deny');
  assert.equal(isValidTool('unlock'), true);
  assert.equal(isValidTool('stopwatch-uni'), true);
  assert.equal(isValidTool('aletheia'), true);
  assert.equal(isValidTool('usotsuki'), true);
  assert.equal(isValidTool('friend-apps'), false);
  assert.equal(accessTableForTool('unlock'), 'friend_app_access');
  assert.equal(accessTableForTool('stopwatch-uni'), 'friend_app_access');
  assert.equal(accessTableForTool('aletheia'), 'friend_app_access');
  assert.equal(accessTableForTool('usotsuki'), 'friend_app_access');
  assert.equal(accessTableForTool('calc'), 'tool_access');
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
  assert.equal(gateCookieName('aletheia'), 'kali_aletheia_gate');
  assert.equal(gateCookieName('usotsuki'), 'kali_usotsuki_gate');
  assert.notEqual(gateCookieName('unlock'), gateCookieName('stopwatch-uni'));
  assert.match(clearGateCookie('unlock'), /kali_unlock_gate=.*Path=\/tools/);
  assert.match(clearGateCookie('calc'), /Path=\/tools/);
  assert.equal(allowOnCheckError('unlock'), false);
  assert.equal(allowOnCheckError('stopwatch-uni'), false);
  assert.equal(allowOnCheckError('aletheia'), false);
  assert.equal(allowOnCheckError('usotsuki'), false);
  assert.equal(allowOnCheckError('calc'), true);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'unlock').valid, false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'stopwatch-uni').valid, false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'aletheia').valid, false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'usotsuki').valid, false);
  for (const tool of ['aletheia', 'usotsuki']) {
    const token = await signGateCookie('friend@example.com', tool, 'test-secret', now);
    const checked = await verifyGateCookie(token, 'test-secret', now);
    assert.equal(checked.valid, true);
    assert.equal(checked.tool, tool);
  }
});

test('new distribution assets require an active database grant after cookie verification', async () => {
  const priorFetch = globalThis.fetch;
  const priorNetlify = globalThis.Netlify;
  const secret = 'test-secret';
  globalThis.Netlify = { env: { get: () => secret } };
  let active = false;
  let nextCalls = 0;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(new URL(url).pathname, '/.netlify/functions/tool-check');
      assert.equal(new URL(url).searchParams.get('tool'), 'aletheia');
      assert.match(options.headers.cookie, /kali_aletheia_gate=/);
      return new Response(JSON.stringify({ ok: active }), { headers: { 'content-type': 'application/json' } });
    };
    const token = await signGateCookie('friend@example.com', 'aletheia', secret);
    const request = new Request('https://example.com/tools/aletheia/app.js', {
      headers: { cookie: `kali_aletheia_gate=${token}` }
    });
    const context = { next: async () => { nextCalls += 1; return new Response('app code'); } };
    const revoked = await toolsGate(request, context);
    assert.equal(revoked.status, 302);
    assert.equal(nextCalls, 0);
    active = true;
    const approved = await toolsGate(request, context);
    assert.equal(approved.status, 200);
    assert.equal(nextCalls, 1);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = priorNetlify;
  }
});

test('login return paths stay on the two distribution apps', () => {
  const source = readFileSync(new URL('../../tools/login/gate-util.js', import.meta.url), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source, context);
  assert.equal(context.ToolGateUtil.safeTo('/tools/unlock/'), '/tools/unlock/');
  assert.equal(context.ToolGateUtil.safeTo('/tools/stopwatch-uni/?from=invite'), '/tools/stopwatch-uni/?from=invite');
  assert.equal(context.ToolGateUtil.safeTo('/tools/aletheia/?from=invite'), '/tools/aletheia/?from=invite');
  assert.equal(context.ToolGateUtil.safeTo('/tools/usotsuki/?from=invite'), '/tools/usotsuki/?from=invite');
  assert.equal(context.ToolGateUtil.safeTo('/tools/stopwatch/?from=legacy'), '/tools/stopwatch/?from=legacy');
  assert.equal(context.ToolGateUtil.toolFromPath('/tools/unlock/'), 'unlock');
  assert.equal(context.ToolGateUtil.toolFromPath('/tools/stopwatch-uni/'), 'stopwatch-uni');
  assert.equal(context.ToolGateUtil.toolFromPath('/tools/aletheia/'), 'aletheia');
  assert.equal(context.ToolGateUtil.toolFromPath('/tools/usotsuki/'), 'usotsuki');
  assert.equal(context.ToolGateUtil.toolFromPath('/tools/stopwatch/'), 'stopwatch');
  assert.equal(context.ToolGateUtil.safeTo('/zz2/'), '/tools/hitsuzen/');
  assert.equal(context.ToolGateUtil.safeTo('/zz2/../admin.html'), '/tools/hitsuzen/');
});

test('friend app migration stores one approval per email and app', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20260923_friend_apps_access.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.friend_app_access/i);
  assert.match(sql, /unique index if not exists friend_app_access_email_tool_idx/i);
  assert.match(sql, /row level security/i);
  const extension = readFileSync(new URL('../../supabase/migrations/20260926_friend_apps_aletheia_usotsuki.sql', import.meta.url), 'utf8');
  assert.match(extension, /check \(tool in \('unlock', 'stopwatch-uni', 'aletheia', 'usotsuki'\)\)/i);
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

test('one Google account can request each friend app and receive only approved apps', async () => {
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
  assert.equal((await requestFriendApp(supabase, viewer, identity, 'aletheia', 'secret')).statusCode, 403);
  assert.equal((await requestFriendApp(supabase, viewer, identity, 'usotsuki', 'secret')).statusCode, 403);
  assert.equal((await requestFriendApp(supabase, viewer, identity, 'arosaegida', 'secret')).statusCode, 403);
  assert.deepEqual(rows.map((row) => row.tool), ['unlock', 'stopwatch-uni', 'aletheia', 'usotsuki', 'arosaegida']);
  assert.equal((await requestFriendApp(supabase, viewer, identity, 'bell', 'secret')).statusCode, 403);
  const bellRow = rows.find(row => row.tool === 'bell');
  assert.equal(bellRow.status, 'pending');
  bellRow.status = 'approved';
  const bell = await requestFriendApp(supabase, viewer, identity, 'bell', 'secret');
  assert.equal(bell.statusCode, 200);
  assert.match(bell.headers['Set-Cookie'], /^kali_bell_gate=/);
  assert.equal((await requestFriendApp(supabase, viewer, identity, 'slot', 'secret')).statusCode, 403);
  const slotRow = rows.find(row => row.tool === 'slot');
  assert.equal(slotRow.status, 'pending');
  slotRow.status = 'approved';
  const slot = await requestFriendApp(supabase, viewer, identity, 'slot', 'secret');
  assert.equal(slot.statusCode, 200);
  assert.match(slot.headers['Set-Cookie'], /^kali_slot_gate=/);
  slotRow.status = 'pending';
  assert.equal((await requestFriendApp(supabase, viewer, identity, 'slot', 'secret')).statusCode, 403);
  rows[0].status = 'approved';
  const unlock = await requestFriendApp(supabase, viewer, identity, 'unlock', 'secret');
  assert.equal(unlock.statusCode, 200);
  assert.match(unlock.headers['Set-Cookie'], /^kali_unlock_gate=/);
  assert.equal((await requestFriendApp(supabase, viewer, identity, 'stopwatch-uni', 'secret')).statusCode, 403);
  rows[2].status = 'approved';
  const aletheia = await requestFriendApp(supabase, viewer, identity, 'aletheia', 'secret');
  assert.equal(aletheia.statusCode, 200);
  assert.match(aletheia.headers['Set-Cookie'], /^kali_aletheia_gate=/);
  assert.equal((await requestFriendApp(supabase, viewer, identity, 'usotsuki', 'secret')).statusCode, 403);
  rows[4].status = 'approved';
  const ar = await requestFriendApp(supabase, viewer, identity, 'arosaegida', 'secret');
  assert.equal(ar.statusCode, 200);
  assert.match(ar.headers['Set-Cookie'], /^kali_arosaegida_gate=/);
  assert.equal((await requestFriendApp(supabase, viewer, identity, 'usotsuki', 'secret')).statusCode, 403);
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
  const deleted = await deleteToolAccess({ queryStringParameters: { id, tool: 'stopwatch-uni' } }, supabase);
  assert.equal(deleted.statusCode, 200);
  assert.deepEqual(tables, ['friend_app_access']);
});

for (const tool of ['aletheia', 'bell', 'slot']) {
  test(tool + ' admin operations target only the selected row and tool', async () => {
    const id = '00000000-0000-4000-8000-000000000002';
    const row = { id, tool, status: 'pending' };
    const supabase = { from(table) {
      assert.equal(table, 'friend_app_access');
      const filters = [];
      let operation;
      let patch;
      return {
        update(value) { operation = 'update'; patch = value; return this; },
        delete() { operation = 'delete'; return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        select() { return this; },
        limit() { return this; },
        async maybeSingle() { const result = await this; return { ...result, data: result.data[0] || null }; },
        then(resolve) {
          const matches = filters.every(([key, value]) => row[key] === value);
          if (!matches) return Promise.resolve({ data: [], error: null }).then(resolve);
          if (operation === 'update') Object.assign(row, patch);
          if (operation === 'delete') row.deleted = true;
          return Promise.resolve({ data: [{ id }], error: null }).then(resolve);
        }
      };
    } };
    const viewer = { userId: 'admin-1' };
    const wrongApproval = await postToolAccess({ body: JSON.stringify({ action: 'approve', id, tool: 'usotsuki' }) }, viewer, supabase);
    assert.equal(wrongApproval.statusCode, 404);
    assert.equal(row.status, 'pending');
    assert.equal(row.tool, tool);
    const wrongDeletion = await deleteToolAccess({ queryStringParameters: { id, tool: 'usotsuki' } }, supabase);
    assert.equal(wrongDeletion.statusCode, 404);
    assert.equal(row.deleted, undefined);
    const approval = await postToolAccess({ body: JSON.stringify({ action: 'approve', id, tool }) }, viewer, supabase);
    assert.equal(approval.statusCode, 200);
    assert.equal(row.status, 'approved');
    assert.equal((await deleteToolAccess({ queryStringParameters: { id, tool } }, supabase)).statusCode, 200);
    assert.equal(row.deleted, true);
  });
}

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


test('AROSAegida paths use an isolated cookie and require an active grant without self redirects', async () => {
  for (const path of ['/tools/arosaegida', '/tools/arosaegida/', '/tools/arosaegida/core.mjs', '/tools/AROSAEGIDA/app.mjs', '/tools//arosaegida/app.mjs']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'arosaegida' });
  }
  assert.equal(isValidTool('arosaegida'), true);
  assert.equal(accessTableForTool('arosaegida'), 'friend_app_access');
  assert.equal(gateCookieName('arosaegida'), 'kali_arosaegida_gate');
  assert.equal(new Set([...FRIEND_APP_TOOLS].map(gateCookieName)).size, FRIEND_APP_TOOLS.size);
  assert.match(clearGateCookie('arosaegida'), /kali_arosaegida_gate=.*Path=\/tools/);
  assert.equal(allowOnCheckError('arosaegida'), false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'arosaegida').valid, false);
  const beforeFetch = globalThis.fetch, beforeNetlify = globalThis.Netlify;
  const secret = 'ar-gate-test';
  let active = false, nextCalls = 0, checks = 0;
  globalThis.Netlify = { env: { get: () => secret } };
  try {
    globalThis.fetch = async (url, options) => {
      checks++;
      assert.equal(new URL(url).searchParams.get('tool'), 'arosaegida');
      assert.match(options.headers.cookie, /kali_arosaegida_gate=/);
      return Response.json({ ok: active });
    };
    const context = { next: async () => { nextCalls++; return new Response('AR app'); } };
    const all = await signGateCookie('friend@example.com', 'all', secret);
    const bypass = await toolsGate(new Request('https://example.com/tools/arosaegida/', { headers: { cookie: `kali_tool_gate=${all}` } }), context);
    assert.equal(bypass.status, 302);
    assert.equal(checks, 0);
    assert.equal(nextCalls, 0);
    const token = await signGateCookie('friend@example.com', 'arosaegida', secret);
    assert.equal((await verifyGateCookie(token, secret)).tool, 'arosaegida');
    const request = new Request('https://example.com/tools/arosaegida/app.mjs?x=1', { headers: { cookie: `kali_arosaegida_gate=${token}` } });
    const revoked = await toolsGate(request, context);
    assert.equal(revoked.status, 302);
    assert.equal(new URL(revoked.headers.get('location')).searchParams.get('to'), '/tools/arosaegida/app.mjs?x=1');
    active = true;
    assert.equal((await toolsGate(request, context)).status, 200);
    assert.equal(nextCalls, 1);
    globalThis.fetch = async () => { throw new Error('grant check unavailable'); };
    assert.equal((await toolsGate(request, context)).status, 302);
    assert.equal(nextCalls, 1);
  } finally {
    globalThis.fetch = beforeFetch;
    if (beforeNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = beforeNetlify;
  }
});

test('AROSAegida migration retains all seven friend tools and the existing RLS policy', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20260930_friend_apps_arosaegida.sql', import.meta.url), 'utf8');
  const values = [...sql.matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.equal(values.length, 7);
  // This historical migration predates the Pi Max, Choice and Magicshow deployments.
  assert.deepEqual(values, [...FRIEND_APP_TOOLS].filter(tool => !['pimax', 'choice', 'magicshow', 'gwayubulgeup', 'memdeck', 'bell', 'slot', 'asrai', 'alter', 'uramichi'].includes(tool)));
  assert.match(sql, /drop constraint if exists friend_app_access_tool_check/);
  assert.match(sql, /add constraint friend_app_access_tool_check/);
  assert.doesNotMatch(sql, /row level security|create policy|drop policy/i);
  const hosting = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
  assert.match(hosting, /for = "\/tools\/arosaegida\/manifest\.webmanifest"\s*\[headers.values\]\s*Content-Type = "application\/manifest\+json"/);
});

test('distribution pages keep a 90-day offline launch and still revoke an explicit denial', () => {
  const html = transformDistributionDocument('<head></head>', { tool: 'unlock', target: 'release' });
  const guard = html.match(/<script id="friend-apps-check">[\s\S]*?<\/script>/)[0];
  assert.match(guard, /document\.documentElement\.style\.visibility = 'hidden'/);
  assert.match(guard, /friend-apps-ok:unlock:/);
  assert.match(guard, /\/tools\/' \+ segments\[2\] \+ '\/'/);
  assert.match(guard, /90 \* dayMs/);
  assert.match(guard, /result\.ok === true/);
  assert.match(guard, /result\.ok === false/);
  assert.match(guard, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(guard, /localStorage\.removeItem\(storageKey\)/);
  assert.match(guard, /response\.type === 'opaque' \|\| response\.status === 0 \|\| response\.status >= 500/);
  assert.match(guard, /setTimeout\(\(\) => controller\.abort\(\), 6000\)/);
  assert.match(guard, /catch \(error\) \{ redirect\(\); return; \}/);
  assert.doesNotMatch(guard, /\.catch\(\(\) => \{ location\.replace\(loginUrl\); \}\)/);
  assert.match(guard, /const verified = freshStamp\(launchStamp\);\s*if \(verified\) reveal\(\);\s*else document\.documentElement\.style\.visibility = 'hidden';/);
  assert.match(guard, /const allowOffline = \(\) => \{\s*if \(verified\) return;/);
  assert.match(guard, /if \(!verified\) redirect\(\);/);
  assert.doesNotMatch(guard, /catch \(error\) \{\}\s*redirect\(\);/);
});

test('ASRAI paths use an isolated cookie and require an active grant without self redirects', async () => {
  for (const path of ['/tools/asrai', '/tools/asrai/', '/tools/asrai/core.mjs', '/tools/ASRAI/app.mjs', '/tools//asrai/app.mjs']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'asrai' });
  }
  assert.equal(isValidTool('asrai'), true);
  assert.equal(accessTableForTool('asrai'), 'friend_app_access');
  assert.equal(gateCookieName('asrai'), 'kali_asrai_gate');
  assert.equal(new Set([...FRIEND_APP_TOOLS].map(gateCookieName)).size, FRIEND_APP_TOOLS.size);
  assert.match(clearGateCookie('asrai'), /kali_asrai_gate=.*Path=\/tools/);
  assert.equal(allowOnCheckError('asrai'), false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'asrai').valid, false);
  const beforeFetch = globalThis.fetch, beforeNetlify = globalThis.Netlify;
  const secret = 'ar-gate-test';
  let active = false, nextCalls = 0, checks = 0;
  globalThis.Netlify = { env: { get: () => secret } };
  try {
    globalThis.fetch = async (url, options) => {
      checks++;
      assert.equal(new URL(url).searchParams.get('tool'), 'asrai');
      assert.match(options.headers.cookie, /kali_asrai_gate=/);
      return Response.json({ ok: active });
    };
    const context = { next: async () => { nextCalls++; return new Response('AR app'); } };
    const all = await signGateCookie('friend@example.com', 'all', secret);
    const bypass = await toolsGate(new Request('https://example.com/tools/asrai/', { headers: { cookie: `kali_tool_gate=${all}` } }), context);
    assert.equal(bypass.status, 302);
    assert.equal(checks, 0);
    assert.equal(nextCalls, 0);
    const token = await signGateCookie('friend@example.com', 'asrai', secret);
    assert.equal((await verifyGateCookie(token, secret)).tool, 'asrai');
    const request = new Request('https://example.com/tools/asrai/app.mjs?x=1', { headers: { cookie: `kali_asrai_gate=${token}` } });
    const revoked = await toolsGate(request, context);
    assert.equal(revoked.status, 302);
    assert.equal(new URL(revoked.headers.get('location')).searchParams.get('to'), '/tools/asrai/app.mjs?x=1');
    active = true;
    assert.equal((await toolsGate(request, context)).status, 200);
    assert.equal(nextCalls, 1);
    globalThis.fetch = async () => { throw new Error('grant check unavailable'); };
    assert.equal((await toolsGate(request, context)).status, 302);
    assert.equal(nextCalls, 1);
  } finally {
    globalThis.fetch = beforeFetch;
    if (beforeNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = beforeNetlify;
  }
});

test('ALTER paths use an isolated cookie and require an active grant without self redirects', async () => {
  for (const path of ['/tools/alter', '/tools/alter/', '/tools/alter/core.mjs', '/tools/ALTER/app.mjs', '/tools//alter/app.mjs']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'alter' });
  }
  assert.equal(isValidTool('alter'), true);
  assert.equal(accessTableForTool('alter'), 'friend_app_access');
  assert.equal(gateCookieName('alter'), 'kali_alter_gate');
  assert.equal(new Set([...FRIEND_APP_TOOLS].map(gateCookieName)).size, FRIEND_APP_TOOLS.size);
  assert.match(clearGateCookie('alter'), /kali_alter_gate=.*Path=\/tools/);
  assert.equal(allowOnCheckError('alter'), false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'alter').valid, false);
  const beforeFetch = globalThis.fetch, beforeNetlify = globalThis.Netlify;
  const secret = 'ar-gate-test';
  let active = false, nextCalls = 0, checks = 0;
  globalThis.Netlify = { env: { get: () => secret } };
  try {
    globalThis.fetch = async (url, options) => {
      checks++;
      assert.equal(new URL(url).searchParams.get('tool'), 'alter');
      assert.match(options.headers.cookie, /kali_alter_gate=/);
      return Response.json({ ok: active });
    };
    const context = { next: async () => { nextCalls++; return new Response('AR app'); } };
    const all = await signGateCookie('friend@example.com', 'all', secret);
    const bypass = await toolsGate(new Request('https://example.com/tools/alter/', { headers: { cookie: `kali_tool_gate=${all}` } }), context);
    assert.equal(bypass.status, 302);
    assert.equal(checks, 0);
    assert.equal(nextCalls, 0);
    const token = await signGateCookie('friend@example.com', 'alter', secret);
    assert.equal((await verifyGateCookie(token, secret)).tool, 'alter');
    const request = new Request('https://example.com/tools/alter/app.mjs?x=1', { headers: { cookie: `kali_alter_gate=${token}` } });
    const revoked = await toolsGate(request, context);
    assert.equal(revoked.status, 302);
    assert.equal(new URL(revoked.headers.get('location')).searchParams.get('to'), '/tools/alter/app.mjs?x=1');
    active = true;
    assert.equal((await toolsGate(request, context)).status, 200);
    assert.equal(nextCalls, 1);
    globalThis.fetch = async () => { throw new Error('grant check unavailable'); };
    assert.equal((await toolsGate(request, context)).status, 302);
    assert.equal(nextCalls, 1);
  } finally {
    globalThis.fetch = beforeFetch;
    if (beforeNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = beforeNetlify;
  }
});

test('URAMICHI paths use an isolated cookie and require an active grant without self redirects', async () => {
  for (const path of ['/tools/uramichi', '/tools/uramichi/', '/tools/uramichi/core.mjs', '/tools/URAMICHI/app.mjs', '/tools//uramichi/app.mjs']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'uramichi' });
  }
  assert.equal(isValidTool('uramichi'), true);
  assert.equal(accessTableForTool('uramichi'), 'friend_app_access');
  assert.equal(gateCookieName('uramichi'), 'kali_uramichi_gate');
  assert.equal(new Set([...FRIEND_APP_TOOLS].map(gateCookieName)).size, FRIEND_APP_TOOLS.size);
  assert.match(clearGateCookie('uramichi'), /kali_uramichi_gate=.*Path=\/tools/);
  assert.equal(allowOnCheckError('uramichi'), false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'uramichi').valid, false);
  const beforeFetch = globalThis.fetch, beforeNetlify = globalThis.Netlify;
  const secret = 'ar-gate-test';
  let active = false, nextCalls = 0, checks = 0;
  globalThis.Netlify = { env: { get: () => secret } };
  try {
    globalThis.fetch = async (url, options) => {
      checks++;
      assert.equal(new URL(url).searchParams.get('tool'), 'uramichi');
      assert.match(options.headers.cookie, /kali_uramichi_gate=/);
      return Response.json({ ok: active });
    };
    const context = { next: async () => { nextCalls++; return new Response('AR app'); } };
    const all = await signGateCookie('friend@example.com', 'all', secret);
    const bypass = await toolsGate(new Request('https://example.com/tools/uramichi/', { headers: { cookie: `kali_tool_gate=${all}` } }), context);
    assert.equal(bypass.status, 302);
    assert.equal(checks, 0);
    assert.equal(nextCalls, 0);
    const token = await signGateCookie('friend@example.com', 'uramichi', secret);
    assert.equal((await verifyGateCookie(token, secret)).tool, 'uramichi');
    const request = new Request('https://example.com/tools/uramichi/app.mjs?x=1', { headers: { cookie: `kali_uramichi_gate=${token}` } });
    const revoked = await toolsGate(request, context);
    assert.equal(revoked.status, 302);
    assert.equal(new URL(revoked.headers.get('location')).searchParams.get('to'), '/tools/uramichi/app.mjs?x=1');
    active = true;
    assert.equal((await toolsGate(request, context)).status, 200);
    assert.equal(nextCalls, 1);
    globalThis.fetch = async () => { throw new Error('grant check unavailable'); };
    assert.equal((await toolsGate(request, context)).status, 302);
    assert.equal(nextCalls, 1);
  } finally {
    globalThis.fetch = beforeFetch;
    if (beforeNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = beforeNetlify;
  }
});

test('new public app migration adds only the three separately gated tool keys', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261127_friend_apps_asrai_alter_uramichi.sql', import.meta.url), 'utf8');
  const keyArrays = [...sql.matchAll(/(?:expected|additions) constant text\[\] := array\[([^\]]+)\]/g)];
  const keys = keyArrays.flatMap(([, values]) => [...values.matchAll(/'([^']+)'/g)].map(match => match[1]));
  assert.deepEqual(keys, [...FRIEND_APP_TOOLS]);
  const steps = [
    'begin;', 'lock table public.friend_app_access', 'pg_get_constraintdef(oid)',
    'count(*) as n from public.friend_app_access group by tool',
    'definition is distinct from', 'raise exception', 'if allowed @> additions then',
    'return;', 'if not (allowed @> expected and allowed <@ expected) then',
    'raise exception', 'unnest(allowed || additions)', 'drop constraint', 'add constraint', 'commit;',
  ];
  let cursor = 0;
  for (const step of steps) {
    const position = sql.indexOf(step, cursor);
    assert.ok(position >= cursor, step);
    cursor = position + step.length;
  }
  assert.equal(sql.match(/drop constraint/gi).length, 1);
  assert.equal(sql.match(/add constraint/gi).length, 1);
  assert.doesNotMatch(sql, /row level security|create policy|drop policy|insert into|update public/i);
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../../tools/login/gate-util.js', import.meta.url), 'utf8'), context);
  for (const tool of ['asrai', 'alter', 'uramichi']) {
    const path = `/tools/${tool}/index.html?launch=1`;
    assert.equal(context.ToolGateUtil.safeTo(path), path);
    assert.equal(context.ToolGateUtil.toolFromPath(path), tool);
  }
});

test('anonymous installation reads the advertised images and still gates app code', async () => {
  for (const tool of ['asrai', 'alter', 'uramichi']) {
    const root = new URL(`../../distribution-snapshots/${tool}/`, import.meta.url);
    const base = new URL(`https://example.com/tools/${tool}/`);
    const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
    const icons = new Set(manifest.icons.map(icon => new URL(icon.src, base).pathname));
    for (const icon of manifest.icons) {
      const bytes = readFileSync(new URL(icon.src, root));
      const response = await toolsGate(new Request(new URL(icon.src, base)), {
        next: () => new Response(bytes, { headers: { 'Content-Type': icon.type } }),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), icon.type);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    }
    for (const file of ['', 'index.html', 'sw.js', 'contacts.js', 'camera.mjs', 'nested/icon-192.png',
      'icon.svg', 'icon-maskable-192.png', 'icon-maskable-512.png', 'icon-256.png']) {
      const url = new URL(file, base);
      if (icons.has(url.pathname)) continue;
      const response = await toolsGate(new Request(url), { next: () => assert.fail(url.pathname) });
      assert.equal(response.status, 302, url.pathname);
    }
  }
});
