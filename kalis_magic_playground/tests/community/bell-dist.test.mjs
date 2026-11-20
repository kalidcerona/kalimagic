import { readFileSync } from 'node:fs';
import { FRIEND_APP_TOOLS } from '../../netlify/functions/_lib/friend-app-access.mjs';
import { accessTableForTool, isValidTool } from '../../netlify/functions/admin-tools.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
import { gateCookieName } from '../../netlify/functions/_lib/tool-gate.mjs';

test('Bell protects its shared shell and exposes its installation files', () => {
  for (const path of ['/tools/bell', '/tools/BELL/', '/tools/bell/index.html',
    '/tools/bell/audio.mjs', '/tools/bell/sw.js', '/tools/bell/extra/icon-192.png']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'bell' }, path);
  }
  for (const file of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png']) {
    assert.deepEqual(classifyPath('/tools/bell/' + file), { mode: 'public' });
  }
  assert.equal(gateCookieName('bell'), 'kali_bell_gate');
  assert.notEqual(classifyPath('/tools/bell-extra/').tool, 'bell');
});

test('Bell uses the individual friend grant table and its current migration', () => {
  assert.equal(isValidTool('bell'), true);
  assert.equal(accessTableForTool('bell'), 'friend_app_access');
  const sql = readFileSync(new URL('../../supabase/migrations/20261120_friend_apps_bell.sql', import.meta.url), 'utf8');
  assert.deepEqual([...sql.matchAll(/'([^']+)'/g)].map(match => match[1]), [...FRIEND_APP_TOOLS]);
});
