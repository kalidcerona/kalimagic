import { accessDatabase as database } from './legacy-access-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { postToolAccess } from '../../netlify/functions/admin-tools.mjs';

const viewer = { userId: '00000000-0000-4000-8000-000000000001' };

function result(response) {
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

test('adding calculator to an approved stopwatch account expands the existing legacy row', async () => {
  const db = database({ tool_access: [{ id: 'legacy-1', email: 'friend@example.com', tool: 'stopwatch', status: 'approved', lifetime: true, note: 'existing note' }] });
  const response = result(await postToolAccess({ body: JSON.stringify({ action: 'addToPerson', email: 'friend@example.com', tool: 'calc', lifetime: false }) }, viewer, db));
  assert.equal(response.status, 200);
  assert.equal(db.rows.tool_access.length, 1);
  assert.equal(db.rows.tool_access[0].tool, 'all');
  assert.equal(db.rows.tool_access[0].per_app_access.stopwatch.lifetime, true);
  assert.equal(db.rows.tool_access[0].per_app_access.calc.lifetime, false);
  assert.equal(db.rows.tool_access[0].note, 'existing note');
});

test('adding an unowned friend app creates its own approved row', async () => {
  const db = database({ tool_access: [{ id: 'legacy-1', email: 'friend@example.com', tool: 'all', status: 'approved' }] });
  const response = result(await postToolAccess({ body: JSON.stringify({ action: 'addToPerson', email: 'friend@example.com', tool: 'unlock', lifetime: true }) }, viewer, db));
  assert.equal(response.status, 200);
  assert.equal(db.rows.friend_app_access.length, 1);
  assert.equal(db.rows.friend_app_access[0].tool, 'unlock');
  assert.equal(db.rows.friend_app_access[0].status, 'approved');
});

test('adding an already owned app is rejected without changing the row', async () => {
  const db = database({ tool_access: [{ id: 'legacy-1', email: 'friend@example.com', tool: 'all', status: 'approved', lifetime: true }] });
  const response = result(await postToolAccess({ body: JSON.stringify({ action: 'addToPerson', email: 'friend@example.com', tool: 'calc' }) }, viewer, db));
  assert.equal(response.status, 409);
  assert.equal(db.rows.tool_access[0].tool, 'all');
});
