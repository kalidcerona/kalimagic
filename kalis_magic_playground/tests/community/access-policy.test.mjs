import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAnswerQuestion,
  canReadAnswer,
  canPublishAnswer,
  canReadAuthor,
  canReadPostBody,
  isElevated,
  isExpertOrHigher
} from '../../netlify/functions/_lib/access-policy.mjs';

const author = { userId: 'u1', role: 'member' };
const other = { userId: 'u2', role: 'member' };
const kali = { userId: 'u3', role: 'kali' };
const admin = { userId: 'u5', role: 'admin' };
const expert = { userId: 'u4', role: 'expert' };
const god = { userId: 'u6', role: 'god' };

test('public post body is readable by anonymous visitors', () => {
  assert.equal(canReadPostBody({ visibility: 'public', authorUserId: 'u1' }, null), true);
});

test('kali_only post body is readable only by author or kali/admin', () => {
  const post = { visibility: 'kali_only', authorUserId: 'u1' };
  assert.equal(canReadPostBody(post, null), false);
  assert.equal(canReadPostBody(post, other), false);
  assert.equal(canReadPostBody(post, author), true);
  assert.equal(canReadPostBody(post, kali), true);
  assert.equal(canReadPostBody(post, admin), true);
});

test('expert_only post body is readable by author, expert, kali, or admin', () => {
  const post = { visibility: 'expert_only', authorUserId: 'u1' };
  assert.equal(canReadPostBody(post, other), false);
  assert.equal(canReadPostBody(post, author), true);
  assert.equal(canReadPostBody(post, expert), true);
  assert.equal(canReadPostBody(post, kali), true);
  assert.equal(canReadPostBody(post, admin), true);
});

test('god role is expert-or-higher without elevated kali access', () => {
  assert.equal(isExpertOrHigher(god), true);
  assert.equal(isElevated(god), false);
  assert.equal(canReadPostBody({ visibility: 'expert_only', authorUserId: 'u1' }, god), true);
  assert.equal(canReadPostBody({ visibility: 'kali_only', authorUserId: 'u1' }, god), false);
});

test('private post author is hidden from unauthorized readers', () => {
  const post = { visibility: 'kali_only', authorUserId: 'u1' };
  assert.equal(canReadAuthor(post, other), false);
  assert.equal(canReadAuthor(post, author), true);
});

test('answer cannot be more public than the question', () => {
  assert.equal(canPublishAnswer({ visibility: 'kali_only' }, 'public'), false);
  assert.equal(canPublishAnswer({ visibility: 'expert_only' }, 'public'), false);
  assert.equal(canPublishAnswer({ visibility: 'public' }, 'public'), true);
  assert.equal(canPublishAnswer({ visibility: 'kali_only' }, 'author_only'), true);
});

test('answer permissions follow the question visibility and viewer role matrix', () => {
  const viewers = {
    member: other,
    expert,
    god,
    kali,
    admin
  };
  const expected = {
    member: { public: true, expert_only: false, kali_only: false },
    expert: { public: true, expert_only: true, kali_only: false },
    god: { public: true, expert_only: true, kali_only: true },
    kali: { public: true, expert_only: true, kali_only: true },
    admin: { public: true, expert_only: true, kali_only: true }
  };

  for (const [role, viewer] of Object.entries(viewers)) {
    for (const [visibility, allowed] of Object.entries(expected[role])) {
      assert.equal(canAnswerQuestion({ visibility }, viewer), allowed, `${role} answering ${visibility}`);
    }
  }
});

test('only god, kali, and admin can answer author-only questions', () => {
  const viewers = {
    member: other,
    expert,
    god,
    kali,
    admin
  };
  const expected = {
    member: false,
    expert: false,
    god: true,
    kali: true,
    admin: true
  };

  for (const [role, viewer] of Object.entries(viewers)) {
    assert.equal(canAnswerQuestion({ visibility: 'author_only' }, viewer), expected[role], `${role} answering author_only`);
  }
});

test('answer permissions fail closed for missing or unsupported visibility', () => {
  const viewers = {
    member: other,
    expert,
    god,
    kali,
    admin
  };

  for (const [role, viewer] of Object.entries(viewers)) {
    for (const visibility of [null, undefined, 'foo']) {
      assert.equal(canAnswerQuestion({ visibility }, viewer), false, `${role} answering ${String(visibility)}`);
    }
  }
});

test('anonymous viewers cannot answer questions at any supported visibility', () => {
  for (const viewer of [null, undefined]) {
    for (const visibility of ['public', 'expert_only', 'kali_only', 'author_only']) {
      assert.equal(canAnswerQuestion({ visibility }, viewer), false, `anonymous answering ${visibility}`);
    }
  }
});

test('author only answers are readable by question author and elevated roles', () => {
  const question = { visibility: 'kali_only', authorUserId: 'u1' };
  const answer = { visibility: 'author_only' };
  assert.equal(canReadAnswer(question, answer, other), false);
  assert.equal(canReadAnswer(question, answer, author), true);
  assert.equal(canReadAnswer(question, answer, kali), true);
  assert.equal(canReadAnswer(question, answer, admin), true);
});
