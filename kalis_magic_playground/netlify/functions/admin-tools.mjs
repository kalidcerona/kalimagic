import { requireAdmin } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

const ALLOWED_TOOLS = new Set(['calc', 'stopwatch', 'all']);
const MAX_EMAIL_LENGTH = 254;

function clean(value) {
  return String(value ?? '').trim();
}

function shapeToolAccess(row) {
  return {
    id: row.id,
    email: row.email,
    tool: row.tool,
    note: row.note,
    lifetime: row.lifetime === true,
    createdAt: row.created_at
  };
}

async function listToolAccess(supabase) {
  const { data, error } = await supabase
    .from('tool_access')
    .select('id,email,tool,note,lifetime,created_at')
    .order('created_at', { ascending: false });
  if (error) return json(500, { error: 'db_error' });
  return json(200, { items: (data || []).map(shapeToolAccess) });
}

export async function createToolAccess(event, viewer, supabase) {
  let payload;
  try {
    payload = readJsonBody(event);
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  const email = clean(payload?.email).toLowerCase();
  const tool = clean(payload?.tool);
  const note = clean(payload?.note);
  const lifetime = payload?.lifetime ?? false;
  const emailIsValid =
    email.length >= 3 &&
    email.length <= MAX_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+$/.test(email);
  if (
    !emailIsValid ||
    !ALLOWED_TOOLS.has(tool) ||
    typeof lifetime !== 'boolean'
  ) {
    return json(400, { error: 'invalid_payload' });
  }

  const { error } = await supabase
    .from('tool_access')
    .insert({
      email,
      tool,
      note: note || null,
      lifetime,
      created_by: viewer.userId
    });
  if (error?.code === '23505') return json(409, { error: 'already_exists' });
  if (error) return json(500, { error: 'db_error' });

  return json(200, { ok: true });
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
  if (event.httpMethod === 'POST') return createToolAccess(event, viewer, supabase);
  return deleteToolAccess(event, supabase);
}
