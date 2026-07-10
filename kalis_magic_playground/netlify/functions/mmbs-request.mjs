import { requireAdmin, requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

const REQUEST_COLUMNS = 'mmbs_request_status,mmbs_requested_at';

export function shapeRequestState(row) {
  return {
    status: row?.mmbs_request_status || null,
    requestedAt: row?.mmbs_requested_at || null
  };
}

export function shapePendingRequest(row) {
  return {
    userId: row.user_id,
    nickname: row.nickname,
    requestedAt: row.mmbs_requested_at
  };
}

async function loadRequestState(supabase, userId) {
  return supabase
    .from('profiles')
    .select(REQUEST_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
}

export async function getRequestState(supabase, viewer) {
  const { data, error } = await loadRequestState(supabase, viewer.userId);
  if (error) return json(500, { error: 'db_error' });
  return json(200, shapeRequestState(data));
}

export async function requestMmbsAccess(supabase, viewer, requestedAt = new Date().toISOString()) {
  const { data: current, error: currentError } = await loadRequestState(supabase, viewer.userId);
  if (currentError) return json(500, { error: 'db_error' });

  if (current?.mmbs_request_status === 'requested' || current?.mmbs_request_status === 'done') {
    return json(200, shapeRequestState(current));
  }

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({
      mmbs_request_status: 'requested',
      mmbs_requested_at: requestedAt
    })
    .eq('user_id', viewer.userId)
    .is('mmbs_request_status', null)
    .select(REQUEST_COLUMNS)
    .maybeSingle();
  if (updateError) return json(500, { error: 'db_error' });
  if (updated) return json(200, shapeRequestState(updated));

  const { data: concurrent, error: concurrentError } = await loadRequestState(supabase, viewer.userId);
  if (concurrentError || !concurrent) return json(500, { error: 'db_error' });
  return json(200, shapeRequestState(concurrent));
}

export async function listPendingRequests(supabase) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,nickname,mmbs_requested_at')
    .eq('mmbs_request_status', 'requested')
    .order('mmbs_requested_at', { ascending: true });
  if (error) return json(500, { error: 'db_error' });
  return json(200, { requests: (data || []).map(shapePendingRequest) });
}

export async function completeRequest(event, supabase) {
  let payload;
  try {
    payload = readJsonBody(event);
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  const userId = String(payload.userId || '').trim();
  if (!validateUuid(userId)) return json(400, { error: 'invalid_payload' });

  const { data, error } = await supabase
    .from('profiles')
    .update({ mmbs_request_status: 'done' })
    .eq('user_id', userId)
    .eq('mmbs_request_status', 'requested')
    .select(`user_id,nickname,${REQUEST_COLUMNS}`)
    .maybeSingle();
  if (error) return json(500, { error: 'db_error' });
  if (!data) return json(409, { error: 'request_status_conflict' });

  return json(200, {
    ok: true,
    request: {
      ...shapePendingRequest(data),
      ...shapeRequestState(data)
    }
  });
}

export async function handler(event) {
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) {
    return json(405, { error: 'method_not_allowed' });
  }

  const isAdminRequest = event.httpMethod === 'PATCH' ||
    (event.httpMethod === 'GET' && event.queryStringParameters?.filter === 'mmbs_requests');

  let viewer;
  try {
    viewer = isAdminRequest ? await requireAdmin(event) : await requireViewer(event);
  } catch {
    return isAdminRequest
      ? json(403, { error: 'admin_required' })
      : json(401, { error: 'auth_required' });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (event.httpMethod === 'PATCH') return await completeRequest(event, supabase);
    if (isAdminRequest) return await listPendingRequests(supabase);
    if (event.httpMethod === 'POST') return await requestMmbsAccess(supabase, viewer);
    return await getRequestState(supabase, viewer);
  } catch {
    return json(500, { error: 'db_error' });
  }
}
