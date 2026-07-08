import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VALID_BADGE_CODES, validateBadgeChange } from '../../netlify/functions/_lib/badges.mjs';
import { changeMemberBadge } from '../../netlify/functions/admin-badges.mjs';

test('VALID_BADGE_CODES has the 9 badge codes', () => {
  assert.deepEqual(
    Array.from(VALID_BADGE_CODES).sort(),
    [
      'expert',
      'expert_10000',
      'expert_3000',
      'expert_50000',
      'kali',
      'supporter_10000',
      'supporter_3000',
      'supporter_50000',
      'user'
    ]
  );
});

test('validateBadgeChange accepts grant and revoke for every valid code', () => {
  for (const badgeCode of VALID_BADGE_CODES) {
    assert.deepEqual(
      validateBadgeChange({ badgeCode, action: 'grant' }),
      { ok: true, badgeCode, action: 'grant' }
    );
    assert.deepEqual(
      validateBadgeChange({ badgeCode, action: 'revoke' }),
      { ok: true, badgeCode, action: 'revoke' }
    );
  }
});

test('validateBadgeChange rejects unknown badge codes', () => {
  assert.deepEqual(
    validateBadgeChange({ badgeCode: 'not_a_badge', action: 'grant' }),
    { ok: false, error: 'invalid_badge' }
  );
  assert.deepEqual(
    validateBadgeChange({ badgeCode: '', action: 'grant' }),
    { ok: false, error: 'invalid_badge' }
  );
});

test('validateBadgeChange rejects invalid actions', () => {
  assert.deepEqual(
    validateBadgeChange({ badgeCode: 'user', action: 'toggle' }),
    { ok: false, error: 'invalid_action' }
  );
  assert.deepEqual(
    validateBadgeChange({ badgeCode: 'user', action: '' }),
    { ok: false, error: 'invalid_action' }
  );
});

function makeAdminBadgeSupabase({ target, badge, badgeRowsAfter }) {
  const calls = { upserts: [], deletes: [] };
  return {
    calls,
    from(table) {
      if (table === 'profiles') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle() { return { data: target, error: null }; }
        };
      }
      if (table === 'badges') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle() { return { data: badge, error: null }; }
        };
      }
      if (table === 'user_badges') {
        return {
          upsert(payload) {
            calls.upserts.push(payload);
            return { error: null };
          },
          delete() { return this; },
          eq(column, value) {
            calls.deletes.push([column, value]);
            return this;
          },
          select() { return this; },
          then(resolve) {
            return Promise.resolve({ data: badgeRowsAfter, error: null }).then(resolve);
          }
        };
      }
      throw new Error(`unexpected table ${table}`);
    }
  };
}

test('changeMemberBadge returns invalid_payload for a malformed badge change request', async () => {
  const viewer = { userId: 'admin-1', role: 'admin' };
  const supabase = makeAdminBadgeSupabase({ target: null, badge: null, badgeRowsAfter: [] });

  const response = await changeMemberBadge({
    body: JSON.stringify({ userId: 'not-a-uuid', badgeCode: 'user', action: 'grant' })
  }, viewer, supabase);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), { error: 'invalid_payload' });
});

test('changeMemberBadge returns invalid_badge for an unknown badge code', async () => {
  const viewer = { userId: 'admin-1', role: 'admin' };
  const supabase = makeAdminBadgeSupabase({ target: null, badge: null, badgeRowsAfter: [] });

  const response = await changeMemberBadge({
    body: JSON.stringify({
      userId: '22222222-2222-4222-8222-222222222222',
      badgeCode: 'not_a_badge',
      action: 'grant'
    })
  }, viewer, supabase);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), { error: 'invalid_badge' });
});

test('changeMemberBadge returns not_found when the target member does not exist', async () => {
  const viewer = { userId: 'admin-1', role: 'admin' };
  const supabase = makeAdminBadgeSupabase({ target: null, badge: { id: 'badge-1', code: 'user' }, badgeRowsAfter: [] });

  const response = await changeMemberBadge({
    body: JSON.stringify({
      userId: '22222222-2222-4222-8222-222222222222',
      badgeCode: 'user',
      action: 'grant'
    })
  }, viewer, supabase);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(JSON.parse(response.body), { error: 'not_found' });
});

test('changeMemberBadge grants a badge via upsert and returns the updated badge codes', async () => {
  const viewer = { userId: '11111111-1111-4111-8111-111111111111', role: 'admin' };
  const target = { user_id: '22222222-2222-4222-8222-222222222222' };
  const badge = { id: 'badge-expert', code: 'expert' };
  const supabase = makeAdminBadgeSupabase({
    target,
    badge,
    badgeRowsAfter: [{ badges: { code: 'user' } }, { badges: { code: 'expert' } }]
  });

  const response = await changeMemberBadge({
    body: JSON.stringify({ userId: target.user_id, badgeCode: 'expert', action: 'grant' })
  }, viewer, supabase);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    userId: target.user_id,
    badges: ['user', 'expert']
  });
  assert.equal(supabase.calls.upserts.length, 1);
  assert.equal(supabase.calls.upserts[0].badge_id, badge.id);
  assert.equal(supabase.calls.upserts[0].granted_by, viewer.userId);
});

test('changeMemberBadge revokes a badge via delete and returns the remaining badge codes', async () => {
  const viewer = { userId: '11111111-1111-4111-8111-111111111111', role: 'admin' };
  const target = { user_id: '22222222-2222-4222-8222-222222222222' };
  const badge = { id: 'badge-expert', code: 'expert' };
  const supabase = makeAdminBadgeSupabase({
    target,
    badge,
    badgeRowsAfter: [{ badges: { code: 'user' } }]
  });

  const response = await changeMemberBadge({
    body: JSON.stringify({ userId: target.user_id, badgeCode: 'expert', action: 'revoke' })
  }, viewer, supabase);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    userId: target.user_id,
    badges: ['user']
  });
  assert.ok(supabase.calls.deletes.some((call) => call[0] === 'badge_id' && call[1] === badge.id));
});

test('admin-badges handler requires admin', () => {
  const source = readFileSync(new URL('../../netlify/functions/admin-badges.mjs', import.meta.url), 'utf8');
  assert.match(source, /requireAdmin/);
  assert.match(source, /json\(403,\s*\{\s*error:\s*'admin_required'\s*\}\s*\)/);
});
