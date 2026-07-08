import { requireAdmin } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { awardQuestBadge } from './_lib/quest-badges.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

function clean(value) {
  return String(value ?? '').trim();
}

export async function grantManualQuestBadge(event, viewer, supabase) {
  let payload;
  try {
    payload = readJsonBody(event);
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  const targetUserId = clean(payload.userId);
  const badgeCode = clean(payload.badgeCode);
  if (!validateUuid(targetUserId) || !badgeCode) return json(400, { error: 'invalid_payload' });

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (targetError) return json(500, { error: 'db_error' });
  if (!target) return json(404, { error: 'not_found' });

  const { data: badge, error: badgeError } = await supabase
    .from('quest_badges')
    .select('code,manual_only')
    .eq('code', badgeCode)
    .maybeSingle();
  if (badgeError) return json(500, { error: 'db_error' });
  if (!badge || badge.manual_only !== true) return json(400, { error: 'invalid_badge' });

  try {
    await awardQuestBadge(supabase, target.user_id, badge.code, {
      awardedReason: 'manual_admin_grant',
      awardedBy: viewer.userId
    });
  } catch {
    return json(500, { error: 'db_error' });
  }

  return json(200, {
    ok: true,
    userId: target.user_id,
    badgeCode: badge.code
  });
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  let viewer;
  try {
    viewer = await requireAdmin(event);
  } catch {
    return json(403, { error: 'admin_required' });
  }

  const supabase = getSupabaseAdmin();
  return grantManualQuestBadge(event, viewer, supabase);
}
