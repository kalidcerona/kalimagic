import { requireAdmin } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateModerationPayload } from './_lib/validators.mjs';

function nextStatus(action) {
  if (action === 'hide') return 'hidden';
  if (action === 'restore') return 'visible';
  if (action === 'delete') return 'deleted';
  return null;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  let viewer;
  try {
    viewer = await requireAdmin(event);
  } catch {
    return json(403, { error: 'admin_required' });
  }

  let payload;
  try {
    payload = validateModerationPayload(readJsonBody(event));
  } catch (error) {
    return json(400, { error: 'invalid_payload', message: error.message });
  }

  const supabase = getSupabaseAdmin();
  const { data: before, error: beforeError } = await supabase
    .from('posts')
    .select('id,status,visibility')
    .eq('id', payload.postId)
    .maybeSingle();
  if (beforeError) return json(500, { error: 'db_error' });
  if (!before) return json(404, { error: 'not_found' });

  const status = nextStatus(payload.action);
  if (status) {
    const { error } = await supabase.from('posts').update({ status }).eq('id', payload.postId);
    if (error) return json(500, { error: 'db_error' });
  }

  if (payload.action === 'mark_magazine_candidate') {
    const { error } = await supabase.from('questions').update({ magazine_candidate: true }).eq('post_id', payload.postId);
    if (error) return json(500, { error: 'db_error' });
  }

  if (payload.action === 'change_visibility') {
    const { error } = await supabase.from('posts').update({ visibility: payload.visibility }).eq('id', payload.postId);
    if (error) return json(500, { error: 'db_error' });
  }

  await supabase.from('moderation_events').insert({
    actor_user_id: viewer.userId,
    target_table: 'posts',
    target_id: payload.postId,
    action: payload.action,
    reason: payload.reason,
    before_status: before.status,
    after_status: status || before.status
  });

  return json(200, { ok: true });
}
