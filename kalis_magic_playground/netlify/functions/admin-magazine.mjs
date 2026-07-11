import { requireAdmin } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateMagazinePublishPayload } from './_lib/validators.mjs';

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
    payload = validateMagazinePublishPayload(readJsonBody(event));
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        post_type: 'magazine',
        category: 'magazine',
        title: payload.title,
        body: payload.body,
        author_user_id: viewer.userId,
        display_mode: 'anonymous',
        visibility: 'public',
        status: 'visible'
      })
      .select('id')
      .single();

    if (error || !post?.id) return json(500, { error: 'db_error' });
    return json(201, { ok: true, postId: post.id });
  } catch {
    return json(500, { error: 'db_error' });
  }
}
