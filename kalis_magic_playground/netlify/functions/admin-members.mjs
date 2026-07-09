import { requireAdmin } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

const WRITABLE_ROLES = new Set(['expert', 'god', 'member']);
const PROTECTED_ROLES = new Set(['admin', 'kali']);

function clean(value) {
  return String(value ?? '').trim();
}

export function escapeIlikePattern(value) {
  return String(value ?? '').replace(/[\\%_]/g, '\\$&');
}

export function validateRoleChange({ targetRole, targetCurrentRole, viewerUserId, targetUserId }) {
  const role = clean(targetRole);
  if (!WRITABLE_ROLES.has(role)) return { ok: false, error: 'invalid_role' };
  if (PROTECTED_ROLES.has(targetCurrentRole)) return { ok: false, error: 'cannot_change_admin' };
  if (viewerUserId === targetUserId) return { ok: false, error: 'cannot_change_self' };
  return { ok: true, role };
}

export function shapeMember(row) {
  return {
    userId: row.user_id,
    nickname: row.nickname,
    role: row.role,
    createdAt: row.created_at
  };
}

async function listMembers(event, supabase) {
  const q = clean(event.queryStringParameters?.q);
  let query = supabase
    .from('profiles')
    .select('user_id,nickname,role,created_at');

  if (q) {
    query = query.ilike('nickname', `%${escapeIlikePattern(q)}%`);
  } else {
    query = query.order('created_at', { ascending: false }).limit(30);
  }

  const { data, error } = await query;
  if (error) return json(500, { error: 'db_error' });
  return json(200, { members: (data || []).map(shapeMember) });
}

export async function changeMemberRole(event, viewer, supabase) {
  let payload;
  try {
    payload = readJsonBody(event);
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  const targetUserId = clean(payload.userId);
  if (!validateUuid(targetUserId)) return json(400, { error: 'invalid_payload' });

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('user_id,role')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (targetError) return json(500, { error: 'db_error' });
  if (!target) return json(404, { error: 'not_found' });

  const decision = validateRoleChange({
    targetRole: payload.role,
    targetCurrentRole: target.role,
    viewerUserId: viewer.userId,
    targetUserId: target.user_id
  });
  if (!decision.ok) return json(400, { error: decision.error });

  const { data: updatedRows, error: updateError } = await supabase
    .from('profiles')
    .update({ role: decision.role })
    .eq('user_id', target.user_id)
    .neq('role', 'admin')
    .neq('role', 'kali')
    .neq('user_id', viewer.userId)
    .select('user_id,role');
  if (updateError) return json(500, { error: 'db_error' });
  const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
  if (!updated) return json(409, { error: 'role_change_conflict' });

  await supabase.from('moderation_events').insert({
    actor_user_id: viewer.userId,
    target_table: 'profiles',
    target_id: target.user_id,
    action: 'change_member_role',
    reason: null,
    before_status: target.role,
    after_status: decision.role
  });

  return json(200, { ok: true, userId: updated.user_id, role: updated.role });
}

export async function handler(event) {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return json(405, { error: 'method_not_allowed' });
  }

  let viewer;
  try {
    viewer = await requireAdmin(event);
  } catch {
    return json(403, { error: 'admin_required' });
  }

  const supabase = getSupabaseAdmin();
  if (event.httpMethod === 'GET') return listMembers(event, supabase);
  return changeMemberRole(event, viewer, supabase);
}
