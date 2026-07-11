import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  SELECTABLE_BADGE_CODES,
  VALID_BADGE_CODES,
  fetchBadgeMap,
  resolvePostAuthorBadges,
  validateBadgeChange,
  validateBadgeSelection
} from '../../netlify/functions/_lib/badges.mjs';
import { changeMemberBadge } from '../../netlify/functions/admin-badges.mjs';
import { shapeMemberBadges } from '../../netlify/functions/member-badges.mjs';

test('VALID_BADGE_CODES has the 11 badge codes', () => {
  assert.deepEqual(
    Array.from(VALID_BADGE_CODES).sort(),
    [
      'expert',
      'expert_10000',
      'expert_3000',
      'expert_50000',
      'hecate',
      'hecate_2',
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

test('badge selection is limited to owned selectable badges', () => {
  assert.deepEqual(SELECTABLE_BADGE_CODES, ['user', 'expert', 'hecate', 'hecate_2']);
  assert.deepEqual(validateBadgeSelection(['user'], null), { ok: true, code: null });
  assert.deepEqual(validateBadgeSelection(['user'], ''), { ok: true, code: null });
  assert.deepEqual(validateBadgeSelection(['user', 'expert'], 'expert'), { ok: true, code: 'expert' });
  assert.deepEqual(validateBadgeSelection(['user'], 'expert'), { ok: false, error: 'badge_not_owned' });
  assert.deepEqual(validateBadgeSelection(['hecate'], 'hecate'), { ok: true, code: 'hecate' });
  assert.deepEqual(validateBadgeSelection([], 'hecate'), { ok: false, error: 'badge_not_owned' });
  assert.deepEqual(validateBadgeSelection(['kali'], 'kali'), { ok: false, error: 'badge_not_selectable' });
});

test('Hecate badge changes are valid for admin grant controls', () => {
  assert.equal(VALID_BADGE_CODES.has('hecate'), true);
  assert.equal(VALID_BADGE_CODES.has('hecate_2'), true);
  assert.deepEqual(
    validateBadgeChange({ badgeCode: 'hecate', action: 'grant' }),
    { ok: true, badgeCode: 'hecate', action: 'grant' }
  );
});

test('Hecate badge image assets exist at the client image paths', () => {
  for (const code of ['hecate', 'hecate_2']) {
    assert.equal(
      existsSync(new URL(`../../assets/playground/badges/${code}.webp`, import.meta.url)),
      true,
      `${code}.webp should exist`
    );
  }
});

test('post author badge selection prefers post code, then profile default, then live badge map', () => {
  const badgeMap = { 'author-1': ['user', 'expert'] };

  assert.deepEqual(resolvePostAuthorBadges({
    author_badge_code: 'expert',
    profiles: { preferred_badge_code: 'user' }
  }, badgeMap, 'author-1'), ['expert']);

  assert.deepEqual(resolvePostAuthorBadges({
    author_badge_code: null,
    profiles: { preferred_badge_code: 'user' }
  }, badgeMap, 'author-1'), ['user']);

  assert.deepEqual(resolvePostAuthorBadges({
    author_badge_code: null,
    profiles: { preferred_badge_code: null }
  }, badgeMap, 'author-1'), ['user', 'expert']);
});

test('public author badges never include kali from post, profile, or fallback sources', () => {
  const badgeMap = { 'author-1': ['kali', 'user', 'expert'] };

  assert.deepEqual(resolvePostAuthorBadges({
    author_badge_code: 'kali',
    profiles: { preferred_badge_code: 'user' }
  }, badgeMap, 'author-1'), []);

  assert.deepEqual(resolvePostAuthorBadges({
    author_badge_code: null,
    profiles: { preferred_badge_code: 'kali' }
  }, badgeMap, 'author-1'), []);

  assert.deepEqual(resolvePostAuthorBadges({
    author_badge_code: null,
    profiles: { preferred_badge_code: null }
  }, badgeMap, 'author-1'), ['user', 'expert']);
});

test('public author badges include Hecate badges while still hiding kali', () => {
  const badgeMap = { 'author-1': ['kali', 'hecate', 'hecate_2'] };

  assert.deepEqual(resolvePostAuthorBadges({
    author_badge_code: 'hecate',
    profiles: { preferred_badge_code: 'kali' }
  }, badgeMap, 'author-1'), ['hecate']);

  assert.deepEqual(resolvePostAuthorBadges({
    author_badge_code: null,
    profiles: { preferred_badge_code: 'hecate_2' }
  }, badgeMap, 'author-1'), ['hecate_2']);

  assert.deepEqual(resolvePostAuthorBadges({
    author_badge_code: null,
    profiles: { preferred_badge_code: null }
  }, badgeMap, 'author-1'), ['hecate', 'hecate_2']);
});

test('fetchBadgeMap excludes kali from public author badge maps while keeping other codes', async () => {
  const calls = [];
  const rows = [
    { user_id: 'author-1', badges: { code: 'kali' } },
    { user_id: 'author-1', badges: { code: 'user' } },
    { user_id: 'author-2', badges: { code: 'expert' } },
    { user_id: 'author-2', badges: { code: '' } }
  ];
  const supabase = {
    from(table) {
      assert.equal(table, 'user_badges');
      return {
        select(columns) {
          assert.equal(columns, 'user_id,badges(code)');
          return this;
        },
        in(column, ids) {
          calls.push([column, ids]);
          return { data: rows, error: null };
        }
      };
    }
  };

  const map = await fetchBadgeMap(supabase, ['author-1', 'author-1', 'author-2', null]);

  assert.deepEqual(calls, [['user_id', ['author-1', 'author-2']]]);
  assert.deepEqual(map, {
    'author-1': ['user'],
    'author-2': ['expert']
  });
});

test('shapeMemberBadges hides role and unowned owner-only catalog badges', () => {
  const profile = {
    user_id: '11111111-1111-4111-8111-111111111111',
    nickname: '마술인07',
    role: 'member',
    preferred_badge_code: 'user'
  };
  const badgeRows = [{
    granted_at: '2026-07-08T00:00:00.000Z',
    badges: { code: 'user', label: '브론즈 깃털', description: '첫 질문, 배움의 시작' }
  }];
  const catalogRows = [
    { code: 'user', label: '브론즈 깃털', description: '첫 질문, 배움의 시작' },
    { code: 'expert', label: '브론즈 촛불', description: '질문에 답을 비춰주는 첫 안내자' },
    { code: 'kali', label: '칼리의 루비 문장', description: '칼리형' }
  ];

  const shaped = shapeMemberBadges(profile, badgeRows, catalogRows);
  assert.equal(shaped.preferredBadgeCode, 'user');
  assert.deepEqual(shaped.badges.map((badge) => badge.code), ['user']);
  assert.deepEqual(
    shaped.catalog.filter((badge) => badge.code === 'user' || badge.code === 'expert' || badge.code === 'kali'),
    []
  );
  assert.equal(shaped.catalog.some((badge) => ['kali', 'hecate', 'hecate_2'].includes(badge.code)), false);
});

test('shapeMemberBadges preserves a hidden expert preferred badge', () => {
  const shaped = shapeMemberBadges({
    user_id: '11111111-1111-4111-8111-111111111111',
    nickname: '안내자',
    role: 'expert',
    preferred_badge_code: 'expert'
  }, [{
    granted_at: '2026-07-11T00:00:00.000Z',
    badges: { code: 'expert', label: '브론즈 촛불', description: '첫 답변' }
  }], [{ code: 'expert', label: '브론즈 촛불', description: '첫 답변' }]);

  assert.equal(shaped.preferredBadgeCode, 'expert');
  assert.deepEqual(shaped.badges.map((badge) => badge.code), ['expert']);
  assert.equal(shaped.catalog.some((badge) => badge.code === 'expert'), false);
});

test('shapeMemberBadges keeps kali and hecate catalog entries for their owners', () => {
  const ownedCodes = ['kali', 'hecate', 'hecate_2'];
  const badgeRows = ownedCodes.map((code) => ({
    granted_at: '2026-07-11T00:00:00.000Z',
    badges: { code, label: code, description: `${code} badge` }
  }));
  const shaped = shapeMemberBadges({
    user_id: '11111111-1111-4111-8111-111111111111',
    nickname: '소유자',
    role: 'member',
    preferred_badge_code: 'hecate'
  }, badgeRows, ownedCodes.map((code) => ({ code, label: code, description: `${code} badge` })));

  assert.deepEqual(
    shaped.catalog.filter((badge) => ownedCodes.includes(badge.code)).map((badge) => [badge.code, badge.owned]),
    [['hecate', true], ['hecate_2', true], ['kali', true]]
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
