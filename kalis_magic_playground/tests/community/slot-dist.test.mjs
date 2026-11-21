import { readFileSync } from 'node:fs';
import { FRIEND_APP_TOOLS } from '../../netlify/functions/_lib/friend-app-access.mjs';
import { accessTableForTool, isValidTool } from '../../netlify/functions/admin-tools.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import toolsGate, { SLOT_PUBLIC_BETA, classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
import { gateCookieName, signGateCookie } from '../../netlify/functions/_lib/tool-gate.mjs';

test('Slot follows its beta switch and exposes its installation files', () => {
  const expected = SLOT_PUBLIC_BETA ? { mode: 'public' } : { mode: 'gated', tool: 'slot' };
  for (const path of ['/tools/slot', '/tools/SLOT/', '/tools/slot/index.html',
    '/tools/slot/app.mjs', '/tools/slot/sw.js', '/tools/slot/extra/icon-192.png']) {
    assert.deepEqual(classifyPath(path), expected, path);
  }
  for (const file of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png']) {
    assert.deepEqual(classifyPath('/tools/slot/' + file), { mode: 'public' });
  }
  assert.equal(gateCookieName('slot'), 'kali_slot_gate');
  assert.notEqual(classifyPath('/tools/slot-extra/').tool, 'slot');
});

test('Slot uses the individual friend grant table and its current migration', () => {
  assert.equal(isValidTool('slot'), true);
  assert.equal(accessTableForTool('slot'), 'friend_app_access');
  const sql = readFileSync(new URL('../../supabase/migrations/20261121_friend_apps_slot.sql', import.meta.url), 'utf8');
  assert.deepEqual([...sql.matchAll(/'([^']+)'/g)].map(match => match[1]), [...FRIEND_APP_TOOLS]);
});

test('Slot checks its own grant only while approval is required', async (t) => {
  const secret = 'slot-test-secret';
  const beforeFetch = globalThis.fetch;
  const before = globalThis.Netlify;
  globalThis.Netlify = { env: { get: () => secret } };
  t.after(() => {
    globalThis.fetch = beforeFetch;
    if (before === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = before;
  });
  let approved = true;
  const check = t.mock.fn(async (url) => {
    assert.equal(new URL(url).searchParams.get('tool'), 'slot');
    return Response.json({ ok: approved });
  });
  globalThis.fetch = check;
  const context = { next: () => new Response('slot') };
  const launch = (cookie) => toolsGate(new Request('https://example.test/tools/slot/', {
    headers: { cookie }
  }), context);
  const deniedStatus = SLOT_PUBLIC_BETA ? 200 : 302;
  assert.equal((await launch('')).status, deniedStatus);
  for (const tool of ['all', 'bell']) {
    const token = await signGateCookie('friend@example.com', tool, secret);
    assert.equal((await launch(gateCookieName(tool) + '=' + token)).status, deniedStatus);
  }
  assert.equal(check.mock.callCount(), 0);
  const cookie = 'kali_slot_gate=' + await signGateCookie('friend@example.com', 'slot', secret);
  assert.equal((await launch(cookie)).status, 200);
  approved = false;
  assert.equal((await launch(cookie)).status, deniedStatus);
  assert.equal(check.mock.callCount(), SLOT_PUBLIC_BETA ? 0 : 2);
});
