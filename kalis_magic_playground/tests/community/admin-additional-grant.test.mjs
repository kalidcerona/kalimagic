import test from 'node:test';
import assert from 'node:assert/strict';
import { postToolAccess } from '../../netlify/functions/admin-tools.mjs';

const viewer = { userId: '00000000-0000-4000-8000-000000000001' };

function result(response) {
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

function database(initial) {
  const rows = { tool_access: initial.tool_access || [], friend_app_access: initial.friend_app_access || [] };
  return { rows, from(table) {
    const filters = [];
    const query = {
      select() { return this; },
      ilike(key, value) { filters.push([key, value.toLowerCase()]); return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      limit() { return this; },
      async maybeSingle() {
        const row = rows[table].find((candidate) => filters.every(([key, value]) => String(candidate[key] || '').toLowerCase() === String(value).toLowerCase()));
        return { data: row || null, error: null };
      },
      update(patch) { this.patch = patch; return this; },
      async insert(patch) { rows[table].push({ id: String(rows[table].length + 1), ...patch }); return { error: null }; },
      then(resolve) {
        const row = rows[table].find((candidate) => filters.every(([key, value]) => String(candidate[key] || '').toLowerCase() === String(value).toLowerCase()));
        if (row) Object.assign(row, this.patch);
        return Promise.resolve({ error: null }).then(resolve);
      }
    };
    return query;
  } };
}

test('adding calculator to an approved stopwatch account expands the existing legacy row', async () => {
  const db = database({ tool_access: [{ id: 'legacy-1', email: 'friend@example.com', tool: 'stopwatch', status: 'approved', lifetime: true, note: 'existing note' }] });
  const response = result(await postToolAccess({ body: JSON.stringify({ action: 'addToPerson', email: 'friend@example.com', tool: 'calc', lifetime: false }) }, viewer, db));
  assert.equal(response.status, 200);
  assert.equal(db.rows.tool_access.length, 1);
  assert.equal(db.rows.tool_access[0].tool, 'all');
  assert.equal(db.rows.tool_access[0].lifetime, true);
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
