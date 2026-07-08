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

export const SELECTABLE_BADGE_CODES = ['user', 'expert'];

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

export function validateBadgeSelection(ownedCodes, code) {
  if (code === null || code === undefined) return { ok: true, code: null };

  const selected = clean(code);
  if (!selected) return { ok: true, code: null };

  const owned = new Set((ownedCodes || []).map((ownedCode) => clean(ownedCode)).filter(Boolean));
  if (!SELECTABLE_BADGE_CODES.includes(selected)) {
    return { ok: false, error: 'badge_not_selectable' };
  }
  if (!owned.has(selected)) {
    return { ok: false, error: 'badge_not_owned' };
  }
  return { ok: true, code: selected };
}

export function resolvePostAuthorBadges(row, badgeMap = {}, authorId = null) {
  const fallbackBadges = authorId ? badgeMap[authorId] || [] : [];
  if (row?.author_badge_code) return [row.author_badge_code];
  if (row?.profiles?.preferred_badge_code) return [row.profiles.preferred_badge_code];
  return fallbackBadges;
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

export async function fetchOwnedBadgeCodes(supabase, userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('user_badges')
    .select('badges(code)')
    .eq('user_id', userId);
  if (error) throw error;

  return (data || []).map((row) => row.badges?.code).filter(Boolean);
}
