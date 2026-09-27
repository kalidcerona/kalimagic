import test from 'node:test';
import assert from 'node:assert/strict';
import { handler, postToolAccess } from '../../netlify/functions/admin-tools.mjs';

const viewer = { userId: '00000000-0000-4000-8000-000000000001' };
const email = 'member@example.com';

function fakeDb(initial = {}, failedTool = '') {
  const rows = { tool_access: [...(initial.tool_access || [])], friend_app_access: [...(initial.friend_app_access || [])] };
  let reads = 0;
  let writes = 0;
  return { rows, get reads() { return reads; }, get writes() { return writes; }, from(table) {
    const filters = [];
    const query = {
      select() { return this; },
      ilike(key, value) { filters.push([key, value.toLowerCase()]); return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      update(patch) { this.patch = patch; this.mode = 'update'; return this; },
      insert(patch) { this.patch = patch; this.mode = 'insert'; return this; },
      then(resolve) {
        reads += this.mode ? 0 : 1;
        writes += this.mode ? 1 : 0;
        const matches = rows[table].filter((row) => filters.every(([key, value]) => String(row[key] || '').toLowerCase() === String(value).toLowerCase()));
        if (this.mode && this.patch.tool === failedTool) return Promise.resolve({ data: null, error: { code: 'db_error' } }).then(resolve);
        if (this.mode === 'update') matches.forEach((row) => Object.assign(row, this.patch));
        if (this.mode === 'insert') rows[table].push({ id: `new-${rows[table].length}`, ...this.patch });
        return Promise.resolve({ data: this.mode === 'insert' ? [rows[table].at(-1)] : matches, error: null }).then(resolve);
      }
    };
    return query;
  } };
}

async function grant(db, tools, extra = {}) {
  const response = await postToolAccess({ body: JSON.stringify({ action: 'grantBulk', email, tools, ...extra }) }, viewer, db);
  return { status: response.statusCode, body: JSON.parse(response.body), headers: response.headers };
}

async function grantMembers(db, mode, members) {
  const response = await postToolAccess({ body: JSON.stringify({ action: 'grantMembers', mode, members }) }, viewer, db);
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

test('selected pending accounts grant only their requested apps and report per-account results', async () => {
  const db = fakeDb({
    tool_access: [
      { id: 'a', email: 'a@example.com', tool: 'calc', status: 'pending' },
      { id: 'b', email: 'b@example.com', tool: 'stopwatch', status: 'pending' }
    ]
  });
  const result = await grantMembers(db, 'pending', [
    { email: 'a@example.com', tools: ['calc', 'unlock'] },
    { email: 'b@example.com', tools: ['stopwatch'] }
  ]);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.results.map((member) => member.results.map((item) => item.outcome)),
    [['granted', 'failed'], ['granted']]);
  assert.equal(db.rows.friend_app_access.length, 0);
  assert.equal(db.rows.tool_access.every((row) => row.status === 'approved'), true);
});

test('approved account batch cannot create a new account and does not overwrite existing access', async () => {
  const db = fakeDb({ tool_access: [{ id: 'a', email: 'a@example.com', tool: 'calc', status: 'approved', lifetime: true, note: 'keep' }] });
  const result = await grantMembers(db, 'approved', [
    { email: 'a@example.com', tools: ['calc', 'unlock'] },
    { email: 'missing@example.com', tools: ['unlock'] }
  ]);
  assert.deepEqual(result.body.results.map((member) => member.results.map((item) => item.outcome)),
    [['alreadyGranted', 'granted'], ['failed']]);
  assert.equal(db.rows.tool_access[0].lifetime, true);
  assert.equal(db.rows.tool_access[0].note, 'keep');
  assert.equal(db.rows.friend_app_access.length, 1);
});

test('member batch rejects duplicate email, invalid app and more than 25 accounts before database access', async () => {
  const db = fakeDb();
  const cases = [
    [{ email: 'a@example.com', tools: ['calc'] }, { email: 'A@example.com', tools: ['unlock'] }],
    [{ email: 'a@example.com', tools: ['all'] }],
    Array.from({ length: 26 }, (_, index) => ({ email: `member${index}@example.com`, tools: ['calc'] }))
  ];
  for (const members of cases) assert.equal((await grantMembers(db, 'pending', members)).status, 400);
  assert.equal(db.reads, 0);
});

test('a pending legacy all request cannot be reduced to one app by either bulk path', async () => {
  const db = fakeDb({ tool_access: [{ id: 'both', email, tool: 'all', status: 'pending', note: 'request both' }] });
  const single = await grant(db, ['calc']);
  assert.deepEqual(single.body.results, [{ tool: 'calc', outcome: 'failed', error: 'partial_legacy_request' }]);
  const memberBatch = await grantMembers(db, 'pending', [{ email, tools: ['stopwatch'] }]);
  assert.deepEqual(memberBatch.body.results[0].results, [{ tool: 'stopwatch', outcome: 'failed', error: 'partial_legacy_request' }]);
  assert.equal(db.writes, 0);
  assert.equal(db.rows.tool_access[0].tool, 'all');
  assert.equal(db.rows.tool_access[0].status, 'pending');
  const both = await grantMembers(db, 'pending', [{ email, tools: ['calc', 'stopwatch'] }]);
  assert.deepEqual(both.body.results[0].results.map((item) => item.outcome), ['granted', 'granted']);
  assert.equal(db.rows.tool_access[0].tool, 'all');
  assert.equal(db.rows.tool_access[0].status, 'approved');
});

test('bulk grant preserves legacy all, lifetime and note, and is idempotent', async () => {
  const db = fakeDb({ tool_access: [{ id: 'old', email, tool: 'calc', status: 'approved', lifetime: true, note: 'keep' }] });
  const first = await grant(db, ['calc', 'stopwatch', 'unlock'], { lifetime: false });
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.results.map((item) => item.outcome), ['alreadyGranted', 'granted', 'granted']);
  assert.equal(db.rows.tool_access[0].tool, 'all');
  assert.equal(db.rows.tool_access[0].lifetime, true);
  assert.equal(db.rows.tool_access[0].note, 'keep');
  assert.equal(db.rows.friend_app_access.length, 1);
  const retry = await grant(db, ['stopwatch', 'unlock']);
  assert.deepEqual(retry.body.results.map((item) => item.outcome), ['alreadyGranted', 'alreadyGranted']);
  assert.equal(db.rows.friend_app_access.length, 1);
  assert.equal(first.headers['cache-control'], 'no-store');
});

test('two legacy apps on one pending row are approved with one write and retain both entitlements', async () => {
  const db = fakeDb({ tool_access: [{ id: 'pending-1', email, tool: 'calc', status: 'pending', lifetime: true, note: 'request note' }] });
  const response = await grant(db, ['calc', 'stopwatch']);
  assert.deepEqual(response.body.results.map((item) => item.outcome), ['granted', 'granted']);
  assert.equal(db.writes, 1);
  assert.equal(db.rows.tool_access[0].tool, 'all');
  assert.equal(db.rows.tool_access[0].status, 'approved');
  assert.equal(db.rows.tool_access[0].lifetime, true);
  assert.equal(db.rows.tool_access[0].note, 'request note');
});

test('reversed bulk selection and friend request approve all requested apps', async () => {
  const db = fakeDb({
    tool_access: [{ id: 'pending-legacy', email, tool: 'stopwatch', status: 'pending', lifetime: false }],
    friend_app_access: [{ id: 'pending-friend', email, tool: 'unlock', status: 'pending', lifetime: true }]
  });
  const response = await grant(db, ['unlock', 'stopwatch', 'calc']);
  assert.deepEqual(response.body.results.map((item) => item.tool), ['unlock', 'stopwatch', 'calc']);
  assert.deepEqual(response.body.results.map((item) => item.outcome), ['granted', 'granted', 'granted']);
  assert.equal(db.rows.tool_access[0].tool, 'all');
  assert.equal(db.rows.friend_app_access[0].status, 'approved');
  assert.equal(db.rows.friend_app_access[0].lifetime, true);
  assert.equal(db.writes, 2);
});

test('bulk grant returns per-app failures without discarding successful apps', async () => {
  const db = fakeDb({}, 'unlock');
  const response = await grant(db, ['calc', 'unlock']);
  assert.deepEqual(response.body.results.map((item) => item.outcome), ['granted', 'failed']);
  assert.equal(db.rows.tool_access.length, 1);
  assert.equal(db.rows.friend_app_access.length, 0);
});

test('bulk grant rejects unknown, all, duplicate and oversized app lists', async () => {
  const db = fakeDb();
  for (const tools of [['all'], ['unknown'], ['calc', 'calc'], [], ['calc', 'stopwatch', 'unlock', 'stopwatch-uni', 'aletheia', 'usotsuki', 'calc']]) {
    assert.equal((await grant(db, tools)).status, 400);
  }
  assert.equal(db.reads, 0);
});

test('anonymous admin endpoint returns no member data and no-store', async () => {
  for (const method of ['GET', 'POST', 'DELETE']) {
    const response = await handler({ httpMethod: method, headers: {}, body: '{}' });
    assert.equal(response.statusCode, 403);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(JSON.parse(response.body), { error: 'admin_required' });
  }
});

test('authenticated member cannot read admin grants', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SECRET_KEY;
  const calls = [];
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-service-key';
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000002', email }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.includes('/rest/v1/profiles')) return new Response(JSON.stringify({ user_id: '00000000-0000-4000-8000-000000000002', nickname: 'member', role: 'member' }), { status: 200, headers: { 'content-type': 'application/json' } });
    throw new Error('admin data must not be requested');
  };
  try {
    const response = await handler({ httpMethod: 'GET', headers: { authorization: 'Bearer member-token' } });
    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), { error: 'admin_required' });
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(calls.some((url) => url.includes('tool_access')), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = originalKey;
  }
});
