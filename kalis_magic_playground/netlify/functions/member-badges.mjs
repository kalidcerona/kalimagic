import { requireViewer } from './_lib/auth.mjs';
import {
  SELECTABLE_BADGE_CODES,
  VALID_BADGE_CODES,
  validateBadgeSelection
} from './_lib/badges.mjs';
import { isElevated } from './_lib/access-policy.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

const BADGE_CATALOG_CODES = Array.from(VALID_BADGE_CODES);
const OWNER_ONLY_CATALOG_CODES = new Set(['kali', 'hecate', 'hecate_2']);
const HIDDEN_CATALOG_CODES = new Set(['user', 'expert']);

function badgeCode(row) {
  return row?.badges?.code || row?.code || null;
}

export function shapeMemberBadges(profileRow, badgeRows, catalogRows = [], { canSeeOwnerOnly = true } = {}) {
  const ownedCodes = new Set((badgeRows || []).map(badgeCode).filter(Boolean));
  const catalogByCode = new Map((catalogRows || []).map((row) => [row.code, row]));

  return {
    userId: profileRow.user_id,
    nickname: profileRow.nickname,
    role: profileRow.role,
    preferredBadgeCode: profileRow.preferred_badge_code || null,
    badges: (badgeRows || [])
      .filter((row) => row.badges?.code)
      .filter((row) => canSeeOwnerOnly || !OWNER_ONLY_CATALOG_CODES.has(row.badges.code))
      .map((row) => ({
        code: row.badges.code,
        label: row.badges.label,
        description: row.badges.description,
        grantedAt: row.granted_at
      })),
    catalog: BADGE_CATALOG_CODES
      .filter((code) => !HIDDEN_CATALOG_CODES.has(code))
      .filter((code) => !OWNER_ONLY_CATALOG_CODES.has(code) || ownedCodes.has(code))
      .map((code) => {
        const row = catalogByCode.get(code) || {};
        return {
          code,
          label: row.label || code,
          description: row.description || '',
          owned: ownedCodes.has(code),
          selectable: SELECTABLE_BADGE_CODES.includes(code)
        };
      })
  };
}

async function loadBadgeRows(supabase, userId) {
  const { data, error } = await supabase
    .from('user_badges')
    .select('granted_at,badges(code,label,description)')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

async function loadCatalogRows(supabase) {
  const { data, error } = await supabase
    .from('badges')
    .select('code,label,description')
    .in('code', BADGE_CATALOG_CODES);
  if (error) throw error;
  return data || [];
}

async function getTargetUserId(event) {
  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return { authError: true };
  }

  const userId = event.queryStringParameters?.userId;
  if (userId) {
    if (!validateUuid(userId)) return { error: 'invalid_user_id' };
    return { userId, viewer };
  }
  return { userId: viewer.userId, viewer };
}

async function getMemberBadges(event, supabase) {
  const target = await getTargetUserId(event);
  if (target.error) return json(400, { error: target.error });
  if (target.authError) return json(401, { error: 'auth_required' });

  const userId = target.userId;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id,nickname,role,preferred_badge_code')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) return json(500, { error: 'db_error' });
  if (!profile) return json(404, { error: 'not_found' });

  try {
    const badgeRows = await loadBadgeRows(supabase, userId);
    const catalogRows = await loadCatalogRows(supabase);
    const canSeeOwnerOnly = userId === target.viewer.userId || isElevated(target.viewer);
    return json(200, shapeMemberBadges(profile, badgeRows, catalogRows, { canSeeOwnerOnly }));
  } catch {
    return json(500, { error: 'db_error' });
  }
}

async function updatePreferredBadge(event, supabase) {
  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  let payload;
  try {
    payload = readJsonBody(event);
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  let badgeRows;
  try {
    badgeRows = await loadBadgeRows(supabase, viewer.userId);
  } catch {
    return json(500, { error: 'db_error' });
  }

  const ownedCodes = badgeRows.map((row) => row.badges?.code).filter(Boolean);
  const selection = validateBadgeSelection(ownedCodes, payload.preferredBadgeCode);
  if (!selection.ok) return json(400, { error: selection.error });

  const { data: profile, error: updateError } = await supabase
    .from('profiles')
    .update({ preferred_badge_code: selection.code })
    .eq('user_id', viewer.userId)
    .select('user_id,nickname,role,preferred_badge_code')
    .maybeSingle();
  if (updateError) return json(500, { error: 'db_error' });

  try {
    const catalogRows = await loadCatalogRows(supabase);
    return json(200, shapeMemberBadges(profile || {
      user_id: viewer.userId,
      nickname: viewer.nickname,
      role: viewer.role,
      preferred_badge_code: selection.code
    }, badgeRows, catalogRows));
  } catch {
    return json(500, { error: 'db_error' });
  }
}

export async function handler(event) {
  if (!['GET', 'PATCH'].includes(event.httpMethod)) return json(405, { error: 'method_not_allowed' });

  const supabase = getSupabaseAdmin();
  if (event.httpMethod === 'GET') return getMemberBadges(event, supabase);
  return updatePreferredBadge(event, supabase);
}
