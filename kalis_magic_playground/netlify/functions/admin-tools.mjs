import { requireAdmin } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

const ALLOWED_TOOLS = new Set(['calc', 'stopwatch', 'all']);
const MAX_EMAIL_LENGTH = 254;
const COLUMNS = 'id,email,display_name,nickname,tool,lifetime,note,status,requested_at,created_at';

function clean(value) {
  return String(value ?? '').trim();
}

export function normalizeEmail(value) {
  return clean(value).toLowerCase();
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
