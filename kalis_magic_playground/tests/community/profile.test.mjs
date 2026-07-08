import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  escapeIlikePattern,
  shapeProfile,
  validateNickname
} from '../../netlify/functions/profile.mjs';

test('validateNickname trims values and accepts 2 to 24 chars', () => {
  assert.deepEqual(validateNickname(' ab '), { ok: true, nickname: 'ab' });
  assert.deepEqual(validateNickname('가'.repeat(24)), { ok: true, nickname: '가'.repeat(24) });
});

test('validateNickname rejects 1 char and 25 chars after trim', () => {
  assert.deepEqual(validateNickname(' a '), { ok: false, error: 'invalid_nickname' });
  assert.deepEqual(validateNickname('가'.repeat(25)), { ok: false, error: 'invalid_nickname' });
});

test('shapeProfile maps nickname set state', () => {
  assert.deepEqual(shapeProfile({
    nickname: '마술인07',
    role: 'member',
    nickname_set: true
  }), {
    nickname: '마술인07',
    role: 'member',
    nicknameSet: true
  });
});

test('escapeIlikePattern escapes wildcard and escape characters', () => {
  assert.equal(escapeIlikePattern('50%_off\\sale'), '50\\%\\_off\\\\sale');
});

test('profile handler requires viewer, detects duplicate nicknames, and updates nickname_set', () => {
  const source = readFileSync(new URL('../../netlify/functions/profile.mjs', import.meta.url), 'utf8');
  assert.match(source, /requireViewer/);
  assert.match(source, /json\(401,\s*\{\s*error:\s*'auth_required'\s*\}\s*\)/);
  assert.match(source, /json\(409,\s*\{\s*error:\s*'nickname_taken'\s*\}\s*\)/);
  assert.match(source, /nickname_set:\s*true/);
  assert.match(source, /\.neq\('user_id', viewer\.userId\)/);
  assert.match(source, /error\.code === '23505'/);
});

test('auth profile creation initializes nickname_set false', () => {
  const source = readFileSync(new URL('../../netlify/functions/_lib/auth.mjs', import.meta.url), 'utf8');
  assert.match(source, /nickname_set:\s*false/);
});
