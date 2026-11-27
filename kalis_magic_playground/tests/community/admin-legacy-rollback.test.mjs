import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyProjection, legacyAccessForTool, mutateLegacyAccess } from '../../netlify/functions/_lib/legacy-app-access.mjs';
import { accessDatabase } from './legacy-access-fixture.mjs';

// Frozen from 5556cab773407b34d1183839984ba4981d3b3327:
// netlify/functions/tool-access.mjs decideAccess/issueGateCookie and
// netlify/functions/tool-check.mjs handler. Verified against git show once;
// tests must also work in exported/shallow source checkouts without that commit.
function oldDecide(row, tool) {
  if (!row) return 'create';
  if (row.status !== 'approved') return 'pending';
  return row.tool === tool || row.tool === 'all' ? 'allow' : 'deny';
}
function oldAllowed(row, gate) {
  return row?.status === 'approved' && (row.tool === gate.tool || row.tool === 'all');
}
function oldKind(access) {
  return access.lifetime === true ? 'life' : 'std';
}
const id = '00000000-0000-4000-8000-000000000001';
const email = 'synthetic@example.test';

test('actual 5556cab readers cannot approve a pending sibling after a split approval', async () => {
  for (const approvedTool of ['calc', 'stopwatch']) {
    const pendingTool = approvedTool === 'calc' ? 'stopwatch' : 'calc';
    const db = accessDatabase({ tool_access: [{ id, email, tool: 'all', status: 'pending', lifetime: false }] });
    await mutateLegacyAccess(db, { id, tool: approvedTool, action: 'approve', lifetime: true });
    const row = db.rows.tool_access[0];
    assert.deepEqual([row.tool, row.status, row.lifetime], [approvedTool, 'approved', true]);
    assert.equal(legacyAccessForTool(row, pendingTool).status, 'pending');
    assert.equal(oldDecide(row, pendingTool), 'deny');
    assert.equal(oldAllowed(row, { tool: pendingTool }), false);
    assert.equal(oldDecide(row, approvedTool), 'allow');
    assert.equal(oldAllowed(row, { tool: approvedTool }), true);
    assert.equal(oldKind(row), 'life');
  }
});

test('projection never widens approval or lifetime across all two-app state combinations', () => {
  const options = [null, { status: 'pending', lifetime: false }, { status: 'pending', lifetime: true },
    { status: 'approved', lifetime: false }, { status: 'approved', lifetime: true }];
  let cases = 0;
  for (const calc of options) for (const stopwatch of options) {
    const grants = Object.fromEntries([['calc', calc], ['stopwatch', stopwatch]].filter(([, grant]) => grant));
    const projected = legacyProjection(grants);
    for (const tool of ['calc', 'stopwatch']) {
      const allowed = oldAllowed(projected, { tool });
      assert.equal(allowed, grants[tool]?.status === 'approved');
      if (allowed && oldKind(projected) === 'life') assert.equal(grants[tool].lifetime, true);
    }
    const approved = Object.entries(grants).filter(([, grant]) => grant.status === 'approved');
    if (approved.length === 1) assert.equal(projected.lifetime, approved[0][1].lifetime);
    cases += 1;
  }
  assert.equal(cases, 25);
});

test('mixed lifetimes remain exact in JSON and conservative for 5556cab', async () => {
  const db = accessDatabase({ tool_access: [{ id, email, tool: 'all', status: 'approved', lifetime: false }] });
  await mutateLegacyAccess(db, { id, tool: 'calc', action: 'lifetime' });
  const row = db.rows.tool_access[0];
  assert.equal(legacyAccessForTool(row, 'calc').lifetime, true);
  assert.equal(legacyAccessForTool(row, 'stopwatch').lifetime, false);
  assert.equal(oldKind(row), 'std');
  assert.equal(oldDecide(row, 'calc'), 'allow');
  assert.equal(oldDecide(row, 'stopwatch'), 'allow');
});

test('forward SQL validates and counts before ADD; rollback guards before touching rows', () => {
  const migration = readFileSync(new URL('../../supabase/migrations/20261127_tool_access_per_app.sql', import.meta.url), 'utf8');
  const rollback = readFileSync(new URL('../../supabase/rollback/20261127_tool_access_per_app.sql', import.meta.url), 'utf8');
  assert.ok(migration.indexOf('tool_access before DDL') < migration.indexOf('alter table'));
  assert.ok(migration.indexOf('column_info.atttypid') < migration.indexOf('alter table'));
  assert.match(migration, /atthasdef/);
  assert.match(migration, /attnotnull/);
  assert.match(migration, /mismatched rows=%, sample IDs=%/);
  assert.match(migration, /limit 20/);
  assert.match(rollback, /count\(distinct app.value->'status'\) = 1/);
  assert.match(rollback, /count\(distinct app.value->'lifetime'\) = 1/);
  assert.match(rollback, /count\(\*\) = 2 from jsonb_each\(app.value\)/);
  assert.ok(rollback.indexOf('Non-lossless rollback') < rollback.indexOf('update public.tool_access'));
  assert.match(rollback, /get diagnostics changed_count = row_count/);
  assert.doesNotMatch(rollback, /drop\s+column/i);
});
