import { requireAdmin } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

const ALLOWED_TOOLS = new Set(['calc', 'stopwatch', 'all']);
const MAX_EMAIL_LENGTH = 254;
const COLUMNS = 'id,user_id,email,display_name,nickname,tool,lifetime,note,status,requested_at,created_at';

function clean(value) {
  return String(value ?? '').trim();
}

export function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function escapeIlikePattern(value) {
  return String(value ?? '').replace(/[\\%_]/g, '\\$&');
}

async function mergeDuplicateEmailAndRetry(supabase, existingId, email, patch) {
  let duplicateResult;
  try {
    duplicateResult = await supabase
      .from('tool_access')
      .select('id')
      .ilike('email', escapeIlikePattern(email))
      .neq('id', existingId)
      .limit(1)
      .maybeSingle();
  } catch {
    return false;
  }
  const duplicate = duplicateResult.data;
  if (duplicateResult.error || !duplicate) return false;

  let deleteResult;
  try {
    deleteResult = await supabase
      .from('tool_access')
      .delete()
      .eq('id', duplicate.id);
  } catch {
    return false;
  }
  if (deleteResult.error) return false;

  try {
    const retryResult = await supabase
      .from('tool_access')
      .update(patch)
      .eq('id', existingId);
    return !retryResult.error;
  } catch {
    return false;
  }
}

export function isValidEmail(email) {
  return email.length >= 3 &&
    email.length <= MAX_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+$/.test(email);
}

export function isValidTool(tool) {
  return ALLOWED_TOOLS.has(tool);
}

function shapeToolAccess(row) {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    email: row.email,
    displayName: row.display_name ?? null,
    nickname: row.nickname ?? null,
    tool: row.tool ?? null,
    lifetime: row.lifetime === true,
    note: row.note ?? null,
    status: row.status,
    requestedAt: row.requested_at ?? null,
    createdAt: row.created_at
  };
}

async function listToolAccess(supabase) {
  const { data, error } = await supabase
    .from('tool_access')
    .select(COLUMNS);
  if (error) return json(500, { error: 'db_error' });

  const rows = (data || []).map(shapeToolAccess);
  const pending = rows
    .filter((row) => row.status !== 'approved')
    .sort((a, b) => String(a.requestedAt || '').localeCompare(String(b.requestedAt || '')));
  const approved = rows
    .filter((row) => row.status === 'approved')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return json(200, { pending, approved });
}

async function approveToolAccess(payload, viewer, supabase) {
  const id = clean(payload?.id);
  const tool = clean(payload?.tool);
  const note = clean(payload?.note);
  const lifetime = payload?.lifetime ?? false;
  if (!validateUuid(id) || !isValidTool(tool) || typeof lifetime !== 'boolean') {
    return json(400, { error: 'invalid_payload' });
  }

  const { data, error } = await supabase
    .from('tool_access')
    .update({
      status: 'approved',
      tool,
      lifetime,
      note: note || null,
      approved_at: new Date().toISOString(),
      approved_by: viewer.userId
    })
    .eq('id', id)
    .select('id');
  if (error) return json(500, { error: 'db_error' });
  if (!data || data.length === 0) return json(404, { error: 'not_found' });

  return json(200, { ok: true });
}

async function grantToolAccessByUser(payload, viewer, supabase) {
  const userId = clean(payload?.userId);
  const tool = clean(payload?.tool);
  const note = clean(payload?.note);
  const lifetime = payload?.lifetime ?? false;
  if (!validateUuid(userId) || !isValidTool(tool) || typeof lifetime !== 'boolean') {
    return json(400, { error: 'invalid_payload' });
  }

  let authResult;
  try {
    authResult = await supabase.auth.admin.getUserById(userId);
  } catch {
    return json(404, { error: 'user_not_found' });
  }
  const authUser = authResult?.data?.user;
  if (authResult?.error || !authUser?.email) {
    return json(404, { error: 'user_not_found' });
  }
  const email = normalizeEmail(authUser.email);

  let nickname = null;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('user_id', userId)
      .maybeSingle();
    nickname = clean(profile?.nickname) || null;
  } catch {
    // 닉네임은 관리자 목록 표시용이므로 조회 실패를 무시한다.
  }

  const { data: userAccess, error: userAccessError } = await supabase
    .from('tool_access')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (userAccessError) return json(500, { error: 'db_error' });

  let existing = userAccess;
  if (!existing) {
    const { data: emailAccess, error: emailAccessError } = await supabase
      .from('tool_access')
      .select('id')
      .ilike('email', escapeIlikePattern(email))
      .limit(1)
      .maybeSingle();
    if (emailAccessError) return json(500, { error: 'db_error' });
    existing = emailAccess;
  }

  const approvedAt = new Date().toISOString();
  if (existing) {
    const patch = {
      status: 'approved',
      tool,
      lifetime,
      note: note || null,
      user_id: userId,
      email,
      approved_at: approvedAt,
      approved_by: viewer.userId
    };
    if (nickname) patch.nickname = nickname;

    const { error } = await supabase
      .from('tool_access')
      .update(patch)
      .eq('id', existing.id);
    if (error?.code === '23505') {
      const merged = await mergeDuplicateEmailAndRetry(
        supabase,
        existing.id,
        email,
        patch
      );
      if (!merged) return json(409, { error: 'duplicate_row' });
    } else if (error) {
      return json(500, { error: 'db_error' });
    }
    return json(200, { ok: true });
  }

  const { error } = await supabase
    .from('tool_access')
    .insert({
      user_id: userId,
      email,
      nickname,
      status: 'approved',
      tool,
      lifetime,
      note: note || null,
      approved_at: approvedAt,
      approved_by: viewer.userId,
      created_by: viewer.userId
    });
  if (error) return json(500, { error: 'db_error' });

  return json(200, { ok: true });
}

async function addToolAccess(payload, viewer, supabase) {
  const email = normalizeEmail(payload?.email);
  const tool = clean(payload?.tool);
  const note = clean(payload?.note);
  const lifetime = payload?.lifetime ?? false;
  if (!isValidEmail(email) || !isValidTool(tool) || typeof lifetime !== 'boolean') {
    return json(400, { error: 'invalid_payload' });
  }

  const { error } = await supabase
    .from('tool_access')
    .insert({
      email,
      tool,
      note: note || null,
      lifetime,
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: viewer.userId,
      created_by: viewer.userId
    });
  if (error?.code === '23505') return json(409, { error: 'already_exists' });
  if (error) return json(500, { error: 'db_error' });

  return json(200, { ok: true });
}

export async function postToolAccess(event, viewer, supabase) {
  let payload;
  try {
    payload = readJsonBody(event);
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  const action = clean(payload?.action);
  if (action === 'approve') return approveToolAccess(payload, viewer, supabase);
  if (action === 'add') return addToolAccess(payload, viewer, supabase);
  if (action === 'grantByUser') return grantToolAccessByUser(payload, viewer, supabase);
  return json(400, { error: 'invalid_payload' });
}

export async function deleteToolAccess(event, supabase) {
  const id = clean(event.queryStringParameters?.id);
  if (!validateUuid(id)) return json(400, { error: 'invalid_payload' });

  const { error } = await supabase
    .from('tool_access')
    .delete()
    .eq('id', id);
  if (error) return json(500, { error: 'db_error' });

  return json(200, { ok: true });
}

export async function handler(event) {
  if (!['GET', 'POST', 'DELETE'].includes(event.httpMethod)) {
    return json(405, { error: 'method_not_allowed' });
  }

  let viewer;
  try {
    viewer = await requireAdmin(event);
  } catch {
    return json(403, { error: 'admin_required' });
  }

  const supabase = getSupabaseAdmin();
  if (event.httpMethod === 'GET') return listToolAccess(supabase);
  if (event.httpMethod === 'POST') return postToolAccess(event, viewer, supabase);
  return deleteToolAccess(event, supabase);
}
