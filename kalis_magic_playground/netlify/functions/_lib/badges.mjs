export const VALID_BADGE_CODES = new Set([
  'user',
  'supporter_3000',
  'supporter_10000',
  'supporter_50000',
  'expert',
  'expert_3000',
  'expert_10000',
  'expert_50000',
  'kali'
]);

const VALID_ACTIONS = new Set(['grant', 'revoke']);

function clean(value) {
  return String(value ?? '').trim();
}

export function validateBadgeChange({ badgeCode, action }) {
  const code = clean(badgeCode);
  const act = clean(action);
  if (!VALID_ACTIONS.has(act)) return { ok: false, error: 'invalid_action' };
  if (!VALID_BADGE_CODES.has(code)) return { ok: false, error: 'invalid_badge' };
  return { ok: true, badgeCode: code, action: act };
}

export async function fetchBadgeMap(supabase, userIds) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from('user_badges')
    .select('user_id,badges(code)')
    .in('user_id', ids);
  if (error) throw error;

  const map = {};
  for (const row of data || []) {
    const code = row.badges?.code;
    if (!code) continue;
    if (!map[row.user_id]) map[row.user_id] = [];
    map[row.user_id].push(code);
  }
  return map;
}
