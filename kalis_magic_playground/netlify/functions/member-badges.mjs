import { json } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

export function shapeMemberBadges(profileRow, badgeRows) {
  return {
    userId: profileRow.user_id,
    nickname: profileRow.nickname,
    role: profileRow.role,
    badges: (badgeRows || []).map((row) => ({
      code: row.badges.code,
      label: row.badges.label,
      description: row.badges.description,
      grantedAt: row.granted_at
    }))
  };
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });

  const userId = event.queryStringParameters?.userId;
  if (!validateUuid(userId)) return json(400, { error: 'invalid_user_id' });

  const supabase = getSupabaseAdmin();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id,nickname,role')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) return json(500, { error: 'db_error' });
  if (!profile) return json(404, { error: 'not_found' });

  const { data: badgeRows, error: badgesError } = await supabase
    .from('user_badges')
    .select('granted_at,badges(code,label,description)')
    .eq('user_id', userId);
  if (badgesError) return json(500, { error: 'db_error' });

  return json(200, shapeMemberBadges(profile, badgeRows));
}
