import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationPath = new URL('../../supabase/migrations/20260708_nickname_unique.sql', import.meta.url);

function dedupedNickname(nickname, rn, userId) {
  const suffix = `-${rn}-${userId.slice(0, 4)}`;
  return `${nickname.slice(0, 24 - suffix.length)}${suffix}`;
}

test('nickname unique migration keeps dedupe suffix inside the 24 character limit', () => {
  const renamed = dedupedNickname('가'.repeat(24), 12, 'abcd-1234');

  assert.equal(renamed, `${'가'.repeat(16)}-12-abcd`);
  assert.equal(renamed.length, 24);

  const sql = readFileSync(migrationPath, 'utf8');
  assert.match(
    sql,
    /left\(\s*ranked_profiles\.nickname,\s*24\s*-\s*char_length\('-' \|\| ranked_profiles\.rn::text \|\| '-' \|\| left\(ranked_profiles\.user_id::text,\s*4\)\)\s*\)/
  );
  assert.match(
    sql,
    /\|\| '-' \|\| ranked_profiles\.rn::text \|\| '-' \|\| left\(ranked_profiles\.user_id::text,\s*4\)/
  );
  assert.doesNotMatch(sql, /left\(ranked_profiles\.nickname,\s*20\)/);
});
