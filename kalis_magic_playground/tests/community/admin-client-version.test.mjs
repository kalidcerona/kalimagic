import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { accessDatabase } from './legacy-access-fixture.mjs';
import { adaptLegacyAdminEvent, listToolAccess, postToolAccess, deleteToolAccess } from '../../netlify/functions/admin-tools.mjs';

const modelContext = vm.createContext({});
vm.runInContext(readFileSync(new URL('../../admin-app-model.js', import.meta.url), 'utf8'), modelContext);
const model = modelContext.AdminAppModel;

const id = '00000000-0000-4000-8000-000000000001';
const viewer = { userId: '00000000-0000-4000-8000-000000000002' };
const row = { id, email: 'synthetic@example.test', tool: 'all', status: 'pending', lifetime: false };
// Exact applyLocalPermissionRow excerpt from 5556cab admin-tools.js.
// Kept inline so exported source and shallow checkouts do not need Git history.
const updater = `  function applyLocalPermissionRow(change, control) {
    if (!state.data || !change || !change.item) return false;
    if (change.action === 'approve') {
      var current = state.data.pending.find(function (row) { return row.id === change.item.id; });
      if (!current) return false;
      state.data.pending = state.data.pending.filter(function (row) { return row.id !== change.item.id; });
      state.data.approved = state.data.approved.concat([Object.assign({}, current, {
        tool: change.tool,
        lifetime: Boolean(change.lifetime),
        note: change.note || '',
        status: 'approved'
      })]);
    } else if (change.action === 'reject') {
      var pendingBefore = state.data.pending.length;
      state.data.pending = state.data.pending.filter(function (row) { return row.id !== change.item.id; });
      if (state.data.pending.length === pendingBefore) return false;
    } else if (change.action === 'revoke') {
      var approvedBefore = state.data.approved.length;
      state.data.approved = state.data.approved.filter(function (row) { return row.id !== change.item.id; });
      if (state.data.approved.length === approvedBefore) return false;
    } else return false;
    // Drop an in-flight list GET so it cannot paint over the row just updated locally.
    permissionRefreshEpoch += 1;
    replaceAccessCard(change.item.email, control);
    return true;
  }

`;
const listing = async (db, version = 1) => JSON.parse((await listToolAccess(db, version)).body);
async function mutation(db, action, item, tool = item.tool) {
  const event = action === 'approve'
    ? { httpMethod: 'POST', body: JSON.stringify({ action, id: item.id, tool, lifetime: true }) }
    : { httpMethod: 'DELETE', queryStringParameters: { id: item.id, tool } };
  const adapted = await adaptLegacyAdminEvent(event, db);
  return adapted.error || (action === 'approve' ? postToolAccess(adapted.event, viewer, db) : deleteToolAccess(adapted.event, db));
}
function oldClient(data) {
  const context = vm.createContext({ state: { data }, permissionRefreshEpoch: 0, replaceAccessCard() {} });
  vm.runInContext(updater, context);
  return context;
}
const tuples = (data) => ['pending', 'approved'].map((key) => data[key].map(({ id, tool, lifetime }) => [id, tool, lifetime]));

test('5556cab updater excerpt preserves sibling after single approval, rejection and revoke', async () => {
  for (const action of ['approve', 'reject', 'revoke']) {
    for (const tool of ['calc', 'stopwatch']) {
      const db = accessDatabase({ tool_access: [{ ...row, status: action === 'revoke' ? 'approved' : 'pending' }] });
      const data = await listing(db);
      const item = data[action === 'revoke' ? 'approved' : 'pending'].find((entry) => entry.tool === tool);
      assert.equal(model.isPendingActionAvailable(item, tool, { legacy: true, friendApps: true }), true);
      const client = oldClient(data);
      assert.equal((await mutation(db, action, item)).statusCode, 200);
      assert.equal(client.applyLocalPermissionRow({ action, item, tool, lifetime: true }), true);
      assert.deepEqual(JSON.parse(JSON.stringify(tuples(client.state.data))), tuples(await listing(db)));
      const sibling = (await listing(db))[action === 'revoke' ? 'approved' : 'pending'][0];
      assert.notEqual(sibling.tool, tool);
      assert.equal(sibling.id, `${id}:${sibling.tool}`);
    }
  }
});

test('old scoped IDs cannot cross app boundaries or silently approve both apps', async () => {
  for (const tool of ['all', 'stopwatch', 'unlock']) {
    const db = accessDatabase({ tool_access: [row] });
    const item = (await listing(db)).pending.find((entry) => entry.tool === 'calc');
    for (const action of ['approve', 'reject']) assert.equal((await mutation(db, action, item, tool)).statusCode, 409);
    assert.equal(db.writes, 0);
  }
});

test('already-open raw-ID pair requires refresh; unambiguous raw app remains compatible', async () => {
  const db = accessDatabase({ tool_access: [row] });
  assert.equal((await mutation(db, 'approve', row, 'calc')).statusCode, 409);
  assert.equal((await mutation(db, 'reject', row)).statusCode, 409);
  assert.equal(db.writes, 0);
  const single = accessDatabase({ tool_access: [{ ...row, tool: 'calc' }] });
  assert.equal((await mutation(single, 'approve', { ...row, tool: 'calc' })).statusCode, 200);
});

test('v2 keeps raw IDs and permits explicit alternate-app selection', async () => {
  const db = accessDatabase({ tool_access: [row] });
  const before = await listing(db, 2);
  assert.deepEqual(before.pending.map((entry) => entry.id), [id, id]);
  const event = { httpMethod: 'POST', queryStringParameters: { v: '2' }, body: JSON.stringify({ action: 'approve', id, tool: 'stopwatch' }) };
  assert.equal((await postToolAccess((await adaptLegacyAdminEvent(event, db)).event, viewer, db)).statusCode, 200);
  assert.deepEqual((await listing(db, 2)).pending.map((entry) => entry.tool), ['calc']);
  const old = await listing(db);
  assert.equal(old.pending[0].id, `${id}:calc`);
  assert.equal(old.approved[0].id, `${id}:stopwatch`);
});

test('scoped delete infers only its own app; friend IDs and authorization boundary remain unchanged', async () => {
  const db = accessDatabase({ tool_access: [row], friend_app_access: [{ ...row, tool: 'unlock' }] });
  const adapted = await adaptLegacyAdminEvent({ httpMethod: 'DELETE', queryStringParameters: { id: `${id}:calc` } }, db);
  assert.equal((await deleteToolAccess(adapted.event, db)).statusCode, 200);
  assert.deepEqual((await listing(db)).pending.filter((entry) => entry.tool !== 'unlock').map((entry) => entry.tool), ['stopwatch']);
  assert.equal((await listing(db)).pending.find((entry) => entry.tool === 'unlock').id, id);
  const { handler } = await import('../../netlify/functions/admin-tools.mjs');
  assert.equal((await handler({ httpMethod: 'DELETE', headers: {}, queryStringParameters: { id: `${id}:stopwatch` } })).statusCode, 403);
});

test('historic unassigned request stays raw and accepts selection or deletion', async () => {
  for (const tool of ['calc', 'stopwatch', 'all']) {
    const db = accessDatabase({ tool_access: [{ ...row, tool: null }] });
    const item = (await listing(db)).pending[0];
    assert.equal(item.id, id);
    assert.equal(model.isPendingActionAvailable(item, tool, { legacy: true, friendApps: true }), true);
    assert.equal((await mutation(db, 'approve', item, tool)).statusCode, 200);
    assert.deepEqual((await listing(db)).approved.map((entry) => entry.tool), tool === 'all' ? ['calc', 'stopwatch'] : [tool]);
  }
  const db = accessDatabase({ tool_access: [{ ...row, tool: null }] });
  assert.equal((await mutation(db, 'reject', { ...row, tool: '' })).statusCode, 200);
  assert.equal(db.rows.tool_access.length, 0);
});

test('unknown API versions fail closed for reads and writes', async () => {
  for (const httpMethod of ['GET', 'POST', 'DELETE']) {
    const db = accessDatabase({ tool_access: [row] });
    const result = await adaptLegacyAdminEvent({ httpMethod, queryStringParameters: { v: '3' } }, db);
    assert.equal(result.error.statusCode, 400);
    assert.equal(db.reads, 0);
    assert.equal(db.writes, 0);
  }
});


test('a delayed unassigned-request deletion preserves an intervening approval', async () => {
  const db = accessDatabase({ tool_access: [{ ...row, tool: null }] });
  const { event } = await adaptLegacyAdminEvent({ httpMethod: 'DELETE', queryStringParameters: { id } }, db);
  Object.assign(db.rows.tool_access[0], { tool: 'calc', status: 'approved' });
  assert.equal((await deleteToolAccess(event, db)).statusCode, 404);
  assert.equal(db.rows.tool_access[0].tool, 'calc');
});
