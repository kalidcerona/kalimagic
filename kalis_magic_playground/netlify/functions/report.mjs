import { requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody, requireMethod } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateReportPayload } from './_lib/validators.mjs';

export async function handler(event) {
  try {
    requireMethod(event, ['POST']);
  } catch {
    return json(405, { error: 'method_not_allowed' });
  }

  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  let payload;
  try {
    payload = validateReportPayload(readJsonBody(event));
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('post_reports').insert({
      target_type: payload.targetType,
      target_id: payload.targetId,
      reporter_user_id: viewer.userId,
      reason: payload.reason
    });

    if (error?.code === '23505') return json(200, { ok: true, already: true });
    if (error) throw error;
    return json(201, { ok: true });
  } catch {
    return json(500, { error: 'db_error' });
  }
}
