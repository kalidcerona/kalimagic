import { requireAdmin } from './_lib/auth.mjs';
import { validateBadgeChange } from './_lib/badges.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

export async function changeMemberBadge(event, viewer, supabase) {
  let payload;
  try {
    payload = readJsonBody(event);
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  const targetUserId = String(payload.userId ?? '').trim();
  if (!validateUuid(targetUserId)) return json(400, { error: 'invalid_payload' });

  const decision = validateBadgeChange({ badgeCode: payload.badgeCode, action: payload.action });
  if (!decision.ok) return json(400, { error: decision.error });

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (targetError) return json(500, { error: 'db_error' });
  if (!target) return json(404, { error: 'not_found' });

  const { data: badge, error: badgeError } = await supabase
    .from('badges')
    .select('id,code')
    .eq('code', decision.badgeCode)
    .maybeSingle();
  if (badgeError) return json(500, { error: 'db_error' });
  if (!badge) return json(400, { error: 'invalid_badge' });

  if (decision.action === 'grant') {
    const { error: upsertError } = await supabase
      .from('user_badges')
      .upsert({
        user_id: target.user_id,
        badge_id: badge.id,
        granted_by: viewer.userId
      }, { onConflict: 'user_id,badge_id' });
    if (upsertError) return json(500, { error: 'db_error' });
  } else {
    const { error: deleteError } = await supabase
      .from('user_badges')
      .delete()
      .eq('user_id', target.user_id)
      .eq('badge_id', badge.id);
    if (deleteError) return json(500, { error: 'db_error' });
  }

  const { data: badgeRows, error: listError } = await supabase
    .from('user_badges')
    .select('badges(code)')
    .eq('user_id', target.user_id);
  if (listError) return json(500, { error: 'db_error' });

  return json(200, {
    userId: target.user_id,
    badges: (badgeRows || []).map((row) => row.badges.code)
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
  return changeMemberBadge(event, viewer, supabase);
}
