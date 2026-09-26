import { requireAdmin } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';
import { FRIEND_APP_TOOLS, findFriendAccess } from './_lib/friend-app-access.mjs';

const ALLOWED_TOOLS = new Set(['calc', 'stopwatch', 'all', ...FRIEND_APP_TOOLS]);
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

export function accessTableForTool(tool) {
  return FRIEND_APP_TOOLS.has(tool) ? 'friend_app_access' : 'tool_access';
}

function mutationDbError(error, tool) {
  if (FRIEND_APP_TOOLS.has(tool) && ['42P01', 'PGRST205'].includes(error?.code)) {
    return json(503, {
      error: 'friend_apps_unavailable',
      message: '친구 앱 권한 저장소가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.'
    });
  }
  return json(500, { error: 'db_error' });
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

async function readAccessTable(supabase, table) {
  try {
    const { data, error } = await supabase.from(table).select(COLUMNS);
    return error ? { available: false, rows: [] } : { available: true, rows: data || [] };
  } catch {
    return { available: false, rows: [] };
  }
}

export async function listToolAccess(supabase) {
  const [legacy, friendApps] = await Promise.all([
    readAccessTable(supabase, 'tool_access'),
    readAccessTable(supabase, 'friend_app_access')
  ]);
  if (!legacy.available && !friendApps.available) return json(500, { error: 'db_error' });

  const rows = [...legacy.rows, ...friendApps.rows].map(shapeToolAccess);
  const pending = rows
    .filter((row) => row.status !== 'approved')
    .sort((a, b) => String(a.requestedAt || '').localeCompare(String(b.requestedAt || '')));
  const approved = rows
    .filter((row) => row.status === 'approved')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  const warnings = [];
  if (!legacy.available) warnings.push({ code: 'legacy_apps_unavailable' });
  if (!friendApps.available) warnings.push({ code: 'friend_apps_unavailable' });
  return json(200, {
    pending,
    approved,
    availability: { legacy: legacy.available, friendApps: friendApps.available },
    warnings
  });
}

async function approveToolAccess(payload, viewer, supabase) {
  const id = clean(payload?.id);
  const tool = clean(payload?.tool);
  const note = clean(payload?.note);
  const lifetime = payload?.lifetime ?? false;
  if (!validateUuid(id) || !isValidTool(tool) || typeof lifetime !== 'boolean') {
    return json(400, { error: 'invalid_payload' });
  }

  let result;
  try {
    let query = supabase
      .from(accessTableForTool(tool))
      .update({
        status: 'approved',
        tool,
        lifetime,
        note: note || null,
        approved_at: new Date().toISOString(),
        approved_by: viewer.userId
      })
      .eq('id', id);
    if (FRIEND_APP_TOOLS.has(tool)) query = query.eq('tool', tool);
    result = await query.select('id');
  } catch (error) {
    return mutationDbError(error, tool);
  }
  const { data, error } = result;
  if (error) return mutationDbError(error, tool);
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

  if (FRIEND_APP_TOOLS.has(tool)) {
    try {
      const { data: existing, error: lookupError } = await findFriendAccess(supabase, userId, email, tool);
      if (lookupError) return mutationDbError(lookupError, tool);
      const patch = {
        user_id: userId, email, tool, nickname,
        status: 'approved', lifetime, note: note || null,
        approved_at: new Date().toISOString(), approved_by: viewer.userId
      };
      const result = existing
        ? await supabase.from('friend_app_access').update(patch).eq('id', existing.id)
        : await supabase.from('friend_app_access').insert({ ...patch, created_by: viewer.userId });
      if (result.error?.code === '23505') return json(409, { error: 'already_exists' });
      if (result.error) return mutationDbError(result.error, tool);
      return json(200, { ok: true });
    } catch (error) {
      return mutationDbError(error, tool);
    }
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
    .from(accessTableForTool(tool))
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

  let result;
  try {
    result = await supabase
      .from(accessTableForTool(tool))
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
  } catch (error) {
    return mutationDbError(error, tool);
  }
  const { error } = result;
  if (error?.code === '23505') return json(409, { error: 'already_exists' });
  if (error) return mutationDbError(error, tool);

  return json(200, { ok: true });
}

async function addAccessToPerson(payload, viewer, supabase) {
  const email = normalizeEmail(payload?.email);
  const tool = clean(payload?.tool);
  const lifetime = payload?.lifetime ?? false;
  if (!isValidEmail(email) || !isValidTool(tool) || tool === 'all' || typeof lifetime !== 'boolean') {
    return json(400, { error: 'invalid_payload' });
  }

  const table = accessTableForTool(tool);
  let lookup;
  try {
    let query = supabase.from(table).select('id,email,tool,status,lifetime').ilike('email', escapeIlikePattern(email));
    if (FRIEND_APP_TOOLS.has(tool)) query = query.eq('tool', tool);
    lookup = await query.limit(1).maybeSingle();
  } catch (error) {
    return mutationDbError(error, tool);
  }
  if (lookup.error) return mutationDbError(lookup.error, tool);

  const existing = lookup.data;
  if (existing?.status === 'approved' &&
      (existing.tool === 'all' || existing.tool === tool)) {
    return json(409, { error: 'already_exists' });
  }

  const nextTool = table === 'tool_access' && existing?.status === 'approved'
    ? 'all' : tool;
  const patch = {
    tool: nextTool,
    status: 'approved',
    lifetime: Boolean(existing?.lifetime || lifetime),
    approved_at: new Date().toISOString(),
    approved_by: viewer.userId
  };
  let result;
  try {
    result = existing
      ? await supabase.from(table).update(patch).eq('id', existing.id).select('id')
      : await supabase.from(table).insert({ ...patch, email, created_by: viewer.userId });
  } catch (error) {
    return mutationDbError(error, tool);
  }
  if (result.error?.code === '23505') return json(409, { error: 'already_exists' });
  if (result.error) return mutationDbError(result.error, tool);
  if (existing && Array.isArray(result.data) && result.data.length === 0) {
    return json(404, { error: 'not_found' });
  }
  return json(200, { ok: true });
}

async function grantOneBulkTool(supabase, viewer, email, tool, lifetime, note) {
  const table = accessTableForTool(tool);
  try {
    let query = supabase.from(table)
      .select('id,email,tool,status,lifetime')
      .ilike('email', escapeIlikePattern(email));
    if (FRIEND_APP_TOOLS.has(tool)) query = query.eq('tool', tool);
    const lookup = await query;
    if (lookup.error) return { tool, outcome: 'failed', error: 'db_error' };
    const rows = lookup.data || [];
    const approved = rows.find((row) => row.status === 'approved' &&
      (row.tool === tool || (row.tool === 'all' && !FRIEND_APP_TOOLS.has(tool))));
    if (approved) return { tool, outcome: 'alreadyGranted' };
    const existing = rows.find((row) => row.status === 'approved') || rows[0];
    const patch = {
      status: 'approved',
      tool: table === 'tool_access' && existing?.status === 'approved' ? 'all' : tool,
      lifetime: Boolean(existing?.lifetime || lifetime),
      approved_at: new Date().toISOString(),
      approved_by: viewer.userId
    };
    if (note) patch.note = note;
    let result;
    if (existing) {
      let update = supabase.from(table).update(patch).eq('id', existing.id);
      if (table === 'tool_access') {
        update = update.eq('status', existing.status);
        if (existing.tool) update = update.eq('tool', existing.tool);
      }
      result = await update.select('id');
    } else {
      result = await supabase.from(table).insert({ ...patch, email, created_by: viewer.userId }).select('id');
    }
    if (result.error?.code === '23505') {
      // A concurrent grant can win the race. The next request verifies current state.
      return { tool, outcome: 'failed', error: 'concurrent_change' };
    }
    if (result.error || !result.data?.length) return { tool, outcome: 'failed', error: 'db_error' };
    return { tool, outcome: 'granted' };
  } catch {
    return { tool, outcome: 'failed', error: 'db_error' };
  }
}

async function grantLegacyPair(supabase, viewer, email, lifetime, note) {
  const tools = ['calc', 'stopwatch'];
  try {
    const lookup = await supabase.from('tool_access')
      .select('id,email,tool,status,lifetime')
      .ilike('email', escapeIlikePattern(email));
    if (lookup.error) return tools.map((tool) => ({ tool, outcome: 'failed', error: 'db_error' }));
    const rows = lookup.data || [];
    const owned = new Set();
    for (const row of rows) {
      if (row.status !== 'approved') continue;
      if (row.tool === 'all') tools.forEach((tool) => owned.add(tool));
      else if (tools.includes(row.tool)) owned.add(row.tool);
    }
    const missing = tools.filter((tool) => !owned.has(tool));
    if (!missing.length) return tools.map((tool) => ({ tool, outcome: 'alreadyGranted' }));
    const existing = rows.find((row) => row.status === 'approved') || rows[0];
    const patch = {
      status: 'approved', tool: 'all', lifetime: Boolean(existing?.lifetime || lifetime),
      approved_at: new Date().toISOString(), approved_by: viewer.userId
    };
    if (note) patch.note = note;
    let result;
    if (existing) {
      let update = supabase.from('tool_access').update(patch)
        .eq('id', existing.id).eq('status', existing.status);
      if (existing.tool) update = update.eq('tool', existing.tool);
      result = await update.select('id');
    } else {
      result = await supabase.from('tool_access').insert({ ...patch, email, created_by: viewer.userId }).select('id');
    }
    const failed = Boolean(result.error || !result.data?.length);
    return tools.map((tool) => owned.has(tool)
      ? { tool, outcome: 'alreadyGranted' }
      : failed ? { tool, outcome: 'failed', error: 'db_error' } : { tool, outcome: 'granted' });
  } catch {
    return tools.map((tool) => ({ tool, outcome: 'failed', error: 'db_error' }));
  }
}

async function grantBulkAccess(payload, viewer, supabase) {
  const email = normalizeEmail(payload?.email);
  const tools = payload?.tools;
  const lifetime = payload?.lifetime ?? false;
  const note = clean(payload?.note);
  if (!isValidEmail(email) || !Array.isArray(tools) || tools.length < 1 ||
      tools.length > FRIEND_APP_TOOLS.size + 2 ||
      tools.some((tool) => typeof tool !== 'string' || tool === 'all' || !isValidTool(tool)) ||
      new Set(tools).size !== tools.length || typeof lifetime !== 'boolean' || note.length > 1000) {
    return json(400, { error: 'invalid_payload' });
  }
  const results = [];
  let legacyPair = null;
  if (tools.includes('calc') && tools.includes('stopwatch')) {
    legacyPair = await grantLegacyPair(supabase, viewer, email, lifetime, note);
  }
  for (const tool of tools) {
    results.push(legacyPair && (tool === 'calc' || tool === 'stopwatch')
      ? legacyPair.find((entry) => entry.tool === tool)
      : await grantOneBulkTool(supabase, viewer, email, tool, lifetime, note));
  }
  return json(200, { results });
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
  if (action === 'addToPerson') return addAccessToPerson(payload, viewer, supabase);
  if (action === 'grantByUser') return grantToolAccessByUser(payload, viewer, supabase);
  if (action === 'grantBulk') return grantBulkAccess(payload, viewer, supabase);
  return json(400, { error: 'invalid_payload' });
}

export async function deleteToolAccess(event, supabase) {
  const id = clean(event.queryStringParameters?.id);
  if (!validateUuid(id)) return json(400, { error: 'invalid_payload' });
  const tool = clean(event.queryStringParameters?.tool);
  if (tool && !isValidTool(tool)) return json(400, { error: 'invalid_payload' });

  let result;
  try {
    let query = supabase
      .from(accessTableForTool(tool))
      .delete()
      .eq('id', id);
    if (FRIEND_APP_TOOLS.has(tool)) query = query.eq('tool', tool);
    result = await query.select('id');
  } catch (error) {
    return mutationDbError(error, tool);
  }
  const { data, error } = result;
  if (error) return mutationDbError(error, tool);
  if (!data || data.length === 0) return json(404, { error: 'not_found' });

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
