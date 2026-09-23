import test from 'node:test';
import assert from 'node:assert/strict';
import * as adminTools from '../../netlify/functions/admin-tools.mjs';

const approved = {
  id: '00000000-0000-4000-8000-000000000001',
  user_id: '00000000-0000-4000-8000-000000000002',
  email: 'legacy@example.com',
  tool: 'calc',
  status: 'approved',
  lifetime: false,
  created_at: '2026-09-20T00:00:00Z'
};
const pending = {
  ...approved,
  id: '00000000-0000-4000-8000-000000000003',
  email: 'friend@example.com',
  tool: 'unlock',
  status: 'pending'
};

function response(result) {
  return result && typeof result === 'object' && 'statusCode' in result
    ? { statusCode: result.statusCode, body: JSON.parse(result.body) }
    : result;
}

function listDatabase(legacyResult, friendResult) {
  return {
    from(table) {
      const value = table === 'tool_access' ? legacyResult : friendResult;
      return {
        select() {
          if (value instanceof Error) throw value;
          return Promise.resolve(value);
        }
      };
    }
  };
}

test('the app list combines both available tables and reports complete availability', async () => {
  const result = response(await adminTools.listToolAccess(listDatabase(
    { data: [approved], error: null },
    { data: [pending], error: null }
  )));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.availability, { legacy: true, friendApps: true });
  assert.deepEqual(result.body.warnings, []);
  assert.deepEqual(result.body.approved.map((row) => row.tool), ['calc']);
  assert.deepEqual(result.body.pending.map((row) => row.tool), ['unlock']);
});

test('a missing friend app table preserves legacy grants and signals incomplete data', async () => {
  const result = response(await adminTools.listToolAccess(listDatabase(
    { data: [approved], error: null },
    { data: null, error: { code: 'PGRST205', message: 'private database details' } }
  )));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.availability, { legacy: true, friendApps: false });
  assert.deepEqual(result.body.warnings, [{ code: 'friend_apps_unavailable' }]);
  assert.deepEqual(result.body.approved.map((row) => row.tool), ['calc']);
  assert.deepEqual(result.body.pending, []);
  assert.equal(JSON.stringify(result.body).includes('private database details'), false);
});

test('a thrown legacy lookup preserves friend app grants and signals incomplete data', async () => {
  const result = response(await adminTools.listToolAccess(listDatabase(
    new Error('private database details'),
    { data: [pending], error: null }
  )));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.availability, { legacy: false, friendApps: true });
  assert.deepEqual(result.body.warnings, [{ code: 'legacy_apps_unavailable' }]);
  assert.deepEqual(result.body.pending.map((row) => row.tool), ['unlock']);
  assert.equal(JSON.stringify(result.body).includes('private database details'), false);
});

test('a thrown friend app lookup preserves legacy grants', async () => {
  const result = response(await adminTools.listToolAccess(listDatabase(
    { data: [approved], error: null },
    new Error('private database details')
  )));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.availability, { legacy: true, friendApps: false });
  assert.deepEqual(result.body.approved.map((row) => row.tool), ['calc']);
});

test('both failed lookups return a server error rather than an empty success', async () => {
  const result = response(await adminTools.listToolAccess(listDatabase(
    { data: null, error: { code: 'db_error' } },
    new Error('private database details')
  )));
  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.body, { error: 'db_error' });
});

test('the admin route rejects a request without authentication before querying access', async () => {
  const result = response(await adminTools.handler({ httpMethod: 'GET', headers: {} }));
  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.body, { error: 'admin_required' });
});

const missingFriendTable = { code: 'PGRST205', message: 'private database details' };
const viewer = { userId: '00000000-0000-4000-8000-000000000004' };

test('adding a friend app grant reports the unapplied migration without exposing database details', async () => {
  const supabase = {
    from(table) {
      assert.equal(table, 'friend_app_access');
      return { insert: async () => ({ error: missingFriendTable }) };
    }
  };
  const result = response(await adminTools.postToolAccess({ body: JSON.stringify({
    action: 'add', email: 'friend@example.com', tool: 'unlock'
  }) }, viewer, supabase));
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.error, 'friend_apps_unavailable');
  assert.match(result.body.message, /친구 앱/);
  assert.equal(JSON.stringify(result.body).includes('private database details'), false);
});

test('a different friend app write failure remains a generic server error', async () => {
  const supabase = {
    from() { return { insert: async () => ({ error: { code: '42501' } }) }; }
  };
  const result = response(await adminTools.postToolAccess({ body: JSON.stringify({
    action: 'add', email: 'friend@example.com', tool: 'unlock'
  }) }, viewer, supabase));
  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.body, { error: 'db_error' });
});

test('a thrown missing-table error while adding a friend app grant is reported as unavailable', async () => {
  const supabase = {
    from() { throw Object.assign(new Error('private database details'), { code: '42P01' }); }
  };
  const result = response(await adminTools.postToolAccess({ body: JSON.stringify({
    action: 'add', email: 'friend@example.com', tool: 'unlock'
  }) }, viewer, supabase));
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.error, 'friend_apps_unavailable');
});

test('approving a friend app request reports a missing table', async () => {
  const supabase = {
    from(table) {
      assert.equal(table, 'friend_app_access');
      return {
        update() { return this; },
        eq() { return this; },
        select: async () => ({ data: null, error: missingFriendTable })
      };
    }
  };
  const result = response(await adminTools.postToolAccess({ body: JSON.stringify({
    action: 'approve', id: approved.id, tool: 'unlock'
  }) }, viewer, supabase));
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.error, 'friend_apps_unavailable');
});

test('granting a friend app to a member stops after a failed access lookup', async () => {
  const tables = [];
  const supabase = {
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'friend@example.com' } }, error: null }) } },
    from(table) {
      tables.push(table);
      if (table === 'profiles') {
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }) };
      }
      assert.equal(table, 'friend_app_access');
      return { select() { return this; }, eq() { return this; }, limit() { return this; }, maybeSingle: async () => ({ data: null, error: missingFriendTable }) };
    }
  };
  const result = response(await adminTools.postToolAccess({ body: JSON.stringify({
    action: 'grantByUser', userId: approved.user_id, tool: 'unlock'
  }) }, viewer, supabase));
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.error, 'friend_apps_unavailable');
  assert.deepEqual(tables, ['profiles', 'friend_app_access']);
});

test('revoking a friend app reports a missing table', async () => {
  const supabase = {
    from(table) {
      assert.equal(table, 'friend_app_access');
      return { delete() { return this; }, eq() { return this; }, select: async () => ({ data: null, error: missingFriendTable }) };
    }
  };
  const result = response(await adminTools.deleteToolAccess({ queryStringParameters: {
    id: approved.id, tool: 'unlock'
  } }, supabase));
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.error, 'friend_apps_unavailable');
});

test('unknown deletion tool is rejected before it can target legacy access', async () => {
  const result = response(await adminTools.deleteToolAccess({ queryStringParameters: {
    id: approved.id, tool: 'unknown'
  } }, { from() { throw new Error('must not query a table'); } }));
  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.body, { error: 'invalid_payload' });
});

test('deleting without a tool keeps the legacy member-management path', async () => {
  const supabase = {
    from(table) {
      assert.equal(table, 'tool_access');
      return { delete() { return this; }, eq() { return this; }, select: async () => ({ data: [{ id: approved.id }], error: null }) };
    }
  };
  const result = response(await adminTools.deleteToolAccess({ queryStringParameters: {
    id: approved.id
  } }, supabase));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { ok: true });
});

test('a missing access row returns 404 for both legacy and friend app revocation', async () => {
  for (const [tool, expectedTable] of [['calc', 'tool_access'], ['unlock', 'friend_app_access']]) {
    const supabase = {
      from(table) {
        assert.equal(table, expectedTable);
        return { delete() { return this; }, eq() { return this; }, select: async () => ({ data: [], error: null }) };
      }
    };
    const result = response(await adminTools.deleteToolAccess({ queryStringParameters: {
      id: approved.id, tool
    } }, supabase));
    assert.equal(result.statusCode, 404, tool);
    assert.deepEqual(result.body, { error: 'not_found' }, tool);
  }
});
