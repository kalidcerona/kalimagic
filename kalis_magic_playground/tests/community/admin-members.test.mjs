import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  changeMemberRole,
  escapeIlikePattern,
  shapeMember,
  validateRoleChange
} from '../../netlify/functions/admin-members.mjs';

function makeRoleChangeSupabase({ target, updatedRows }) {
  const queries = [];
  const insertedEvents = [];
  return {
    queries,
    insertedEvents,
    from(table) {
      if (table === 'moderation_events') {
        return {
          insert(payload) {
            insertedEvents.push(payload);
            return { error: null };
          }
        };
      }

      const state = {
        table,
        operation: 'select',
        calls: []
      };
      queries.push(state);
      return {
        select(columns) {
          state.calls.push(['select', columns]);
          return this;
        },
        update(payload) {
          state.operation = 'update';
          state.calls.push(['update', payload]);
          return this;
        },
        eq(column, value) {
          state.calls.push(['eq', column, value]);
          return this;
        },
        neq(column, value) {
          state.calls.push(['neq', column, value]);
          return this;
        },
        maybeSingle() {
          return { data: target, error: null };
        },
        then(resolve, reject) {
          const data = state.operation === 'update' ? updatedRows : target;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        }
      };
    }
  };
}

function callsInclude(query, expected) {
  return query.calls.some((call) => JSON.stringify(call) === JSON.stringify(expected));
}

test('validateRoleChange accepts expert and member role changes', () => {
  assert.deepEqual(validateRoleChange({
    targetRole: 'expert',
    targetCurrentRole: 'member',
    viewerUserId: 'admin-1',
    targetUserId: 'member-1'
  }), { ok: true, role: 'expert' });

  assert.deepEqual(validateRoleChange({
    targetRole: 'member',
    targetCurrentRole: 'expert',
    viewerUserId: 'admin-1',
    targetUserId: 'member-1'
  }), { ok: true, role: 'member' });
});

test('validateRoleChange rejects roles outside expert and member', () => {
  assert.deepEqual(validateRoleChange({
    targetRole: 'admin',
    targetCurrentRole: 'member',
    viewerUserId: 'admin-1',
    targetUserId: 'member-1'
  }), { ok: false, error: 'invalid_role' });

  assert.deepEqual(validateRoleChange({
    targetRole: '',
    targetCurrentRole: 'member',
    viewerUserId: 'admin-1',
    targetUserId: 'member-1'
  }), { ok: false, error: 'invalid_role' });
});

test('validateRoleChange rejects admin and kali targets', () => {
  assert.deepEqual(validateRoleChange({
    targetRole: 'member',
    targetCurrentRole: 'admin',
    viewerUserId: 'admin-1',
    targetUserId: 'admin-2'
  }), { ok: false, error: 'cannot_change_admin' });

  assert.deepEqual(validateRoleChange({
    targetRole: 'expert',
    targetCurrentRole: 'kali',
    viewerUserId: 'admin-1',
    targetUserId: 'kali-1'
  }), { ok: false, error: 'cannot_change_admin' });
});

test('validateRoleChange rejects changing self', () => {
  assert.deepEqual(validateRoleChange({
    targetRole: 'member',
    targetCurrentRole: 'expert',
    viewerUserId: 'admin-1',
    targetUserId: 'admin-1'
  }), { ok: false, error: 'cannot_change_self' });
});

test('shapeMember maps profile columns', () => {
  assert.deepEqual(shapeMember({
    user_id: 'member-1',
    nickname: '마술인07',
    role: 'expert',
    created_at: '2026-07-08T00:00:00.000Z'
  }), {
    userId: 'member-1',
    nickname: '마술인07',
    role: 'expert',
    createdAt: '2026-07-08T00:00:00.000Z'
  });
});

test('escapeIlikePattern escapes wildcard and escape characters', () => {
  assert.equal(escapeIlikePattern('100%_ready\\now'), '100\\%\\_ready\\\\now');
});

test('admin members handler requires admin, searches nickname with ilike, and records moderation events', () => {
  const source = readFileSync(new URL('../../netlify/functions/admin-members.mjs', import.meta.url), 'utf8');
  assert.match(source, /requireAdmin/);
  assert.match(source, /json\(403,\s*\{\s*error:\s*'admin_required'\s*\}\s*\)/);
  assert.match(source, /\.ilike\('nickname', `?%/);
  assert.match(source, /\.from\('moderation_events'\)\.insert/);
  assert.match(source, /target_table:\s*'profiles'/);
  assert.match(source, /action:\s*'change_member_role'/);
});

test('changeMemberRole returns role_change_conflict when guarded update changes no rows', async () => {
  const viewer = { userId: '11111111-1111-4111-8111-111111111111', role: 'admin' };
  const target = {
    user_id: '22222222-2222-4222-8222-222222222222',
    role: 'member'
  };
  const supabase = makeRoleChangeSupabase({ target, updatedRows: [] });

  const response = await changeMemberRole({
    body: JSON.stringify({ userId: target.user_id, role: 'expert' })
  }, viewer, supabase);

  assert.equal(response.statusCode, 409);
  assert.deepEqual(JSON.parse(response.body), { error: 'role_change_conflict' });
  assert.equal(supabase.insertedEvents.length, 0);

  const updateQuery = supabase.queries.find((query) => query.operation === 'update');
  assert.equal(callsInclude(updateQuery, ['neq', 'role', 'admin']), true);
  assert.equal(callsInclude(updateQuery, ['neq', 'role', 'kali']), true);
  assert.equal(callsInclude(updateQuery, ['neq', 'user_id', viewer.userId]), true);
  assert.equal(callsInclude(updateQuery, ['select', 'user_id,role']), true);
});
