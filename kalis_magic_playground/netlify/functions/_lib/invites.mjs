export const INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]{12}$/;
export const NEW_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;

export function normalizeInviteCode(value) {
  return String(value ?? '').trim();
}

export function isValidInviteCode(value) {
  return INVITE_CODE_PATTERN.test(normalizeInviteCode(value));
}

export function isSelfInvite(inviterUserId, newUserId) {
  return Boolean(inviterUserId && newUserId && inviterUserId === newUserId);
}

export function isNewAccountEligible(createdAt, now = Date.now()) {
  const createdTime = new Date(createdAt).getTime();
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(createdTime) || !Number.isFinite(nowTime)) return false;
  return nowTime - createdTime <= NEW_ACCOUNT_WINDOW_MS;
}

export function classifyExistingRedemption(redemption, inviteCode) {
  if (!redemption) return 'missing';
  return redemption.invite_code === inviteCode ? 'same_invite' : 'other_invite';
}
