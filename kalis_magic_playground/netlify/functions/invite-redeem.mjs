import { requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody, requireMethod } from './_lib/http.mjs';
import {
  classifyExistingRedemption,
  isNewAccountEligible,
  isSelfInvite,
  isValidInviteCode,
  normalizeInviteCode
} from './_lib/invites.mjs';
import { awardQuestBadges as defaultAwardQuestBadges } from './_lib/quest-badges.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';

async function findInvite(supabase, code) {
  const { data, error } = await supabase
    .from('invites')
    .select('code,inviter_user_id')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findRedemption(supabase, userId) {
  const { data, error } = await supabase
    .from('invite_redemptions')
    .select('invite_code')
    .eq('new_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadAuthUser(supabase, userId) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) throw error;
  if (!data?.user?.created_at) throw new Error('auth_user_missing');
  return data.user;
}

export async function redeemInvite(event, viewer, supabase, hooks = {}) {
  let payload;
  try {
    payload = readJsonBody(event);
  } catch {
    return json(400, { error: 'invalid_code' });
  }

  const code = normalizeInviteCode(payload.code);
  if (!isValidInviteCode(code)) return json(400, { error: 'invalid_code' });

  let invite;
  try {
    invite = await findInvite(supabase, code);
  } catch {
    return json(500, { error: 'db_error' });
  }
  if (!invite) return json(400, { error: 'invalid_code' });
  if (isSelfInvite(invite.inviter_user_id, viewer.userId)) {
    return json(403, { error: 'self_invite_forbidden' });
  }

  let authUser;
  try {
    authUser = await loadAuthUser(supabase, viewer.userId);
  } catch {
    return json(500, { error: 'db_error' });
  }
  const now = hooks.now ? hooks.now() : Date.now();
  if (!isNewAccountEligible(authUser.created_at, now)) {
    return json(403, { error: 'new_account_required' });
  }

  const { error } = await supabase
    .from('invite_redemptions')
    .insert({ new_user_id: viewer.userId, invite_code: code });

  if (error?.code === '23505') {
    let existing;
    try {
      existing = await findRedemption(supabase, viewer.userId);
    } catch {
      return json(500, { error: 'db_error' });
    }
    const conflict = classifyExistingRedemption(existing, code);
    if (conflict === 'same_invite') {
      return json(200, { redeemed: true, alreadyRedeemed: true });
    }
    if (conflict === 'other_invite') {
      return json(409, { error: 'already_redeemed_other_invite' });
    }
    return json(500, { error: 'db_error' });
  }
  if (error) return json(500, { error: 'db_error' });

  const awardQuestBadges = hooks.awardQuestBadges || defaultAwardQuestBadges;
  try {
    await awardQuestBadges(supabase, invite.inviter_user_id);
  } catch (awardError) {
    console.error('invite_quest_badge_award_failed', awardError);
  }

  return json(200, { redeemed: true, alreadyRedeemed: false });
}

export async function handler(event) {
  try {
    requireMethod(event, ['POST']);
  } catch {
    return json(405, { error: 'method_not_allowed' });
  }

  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  const supabase = getSupabaseAdmin();
  return redeemInvite(event, viewer, supabase);
}
