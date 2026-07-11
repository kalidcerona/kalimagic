import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEW_ACCOUNT_WINDOW_MS,
  classifyExistingRedemption,
  isNewAccountEligible,
  isSelfInvite,
  isValidInviteCode
} from '../../netlify/functions/_lib/invites.mjs';
import { countInviteRedemptions } from '../../netlify/functions/_lib/quest-badges.mjs';

test('invite code validation accepts only the 12-character base64url alphabet', () => {
  assert.equal(isValidInviteCode('Abcdef_12-XY'), true);
  assert.equal(isValidInviteCode('short'), false);
  assert.equal(isValidInviteCode('Abcdef+12/XY'), false);
  assert.equal(isValidInviteCode('Abcdef_12-XYZ'), false);
  assert.equal(isValidInviteCode(null), false);
});

test('new account eligibility includes the one-hour boundary and rejects older accounts', () => {
  const now = new Date('2026-07-13T12:00:00.000Z');
  const atBoundary = new Date(now.getTime() - NEW_ACCOUNT_WINDOW_MS).toISOString();
  const justTooOld = new Date(now.getTime() - NEW_ACCOUNT_WINDOW_MS - 1).toISOString();

  assert.equal(isNewAccountEligible(atBoundary, now), true);
  assert.equal(isNewAccountEligible(justTooOld, now), false);
  assert.equal(isNewAccountEligible('invalid-date', now), false);
});

test('self-invite detection rejects matching inviter and new-user ids', () => {
  assert.equal(isSelfInvite('user-1', 'user-1'), true);
  assert.equal(isSelfInvite('user-1', 'user-2'), false);
});

test('redemption conflict classification separates idempotent and other-invite branches', () => {
  assert.equal(classifyExistingRedemption({ invite_code: 'Abcdef_12-XY' }, 'Abcdef_12-XY'), 'same_invite');
  assert.equal(classifyExistingRedemption({ invite_code: 'OtherCode_12' }, 'Abcdef_12-XY'), 'other_invite');
  assert.equal(classifyExistingRedemption(null, 'Abcdef_12-XY'), 'missing');
});

test('quest invite progress sums joined redemption rows for the inviter', () => {
  assert.equal(countInviteRedemptions([
    { code: 'Abcdef_12-XY', invite_redemptions: [{ new_user_id: 'user-2' }, { new_user_id: 'user-3' }] }
  ]), 2);
  assert.equal(countInviteRedemptions([]), 0);
});
