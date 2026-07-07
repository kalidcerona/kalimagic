import { canReadPostBody } from './_lib/access-policy.mjs';
import { requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validatePostIdPayload } from './_lib/validators.mjs';

export function nextLikeMutation(existingLike) {
  return existingLike ? 'delete' : 'insert';
}

export function shouldIgnoreLikeInsertError(error) {
  return error?.code === '23505';
}

export function shapeLikeResponse(likeRows, viewer) {
  const rows = likeRows || [];
  return {
    ok: true,
    likeCount: rows.length,
    viewerLiked: rows.some((row) => row.user_id === viewer.userId)
  };
}

async function loadLikeRows(supabase, postId) {
  const { data, error } = await supabase
    .from('post_likes')
    .select('user_id')
    .eq('post_id', postId);
  if (error) throw error;
  return data || [];
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required', message: '로그인하면 추천할 수 있어요' });
  }

  let payload;
  try {
    payload = validatePostIdPayload(readJsonBody(event));
  } catch (error) {
    return json(400, { error: 'invalid_payload', message: error.message });
  }

  const supabase = getSupabaseAdmin();
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id,visibility,author_user_id,status')
    .eq('id', payload.postId)
    .maybeSingle();

  if (postError) return json(500, { error: 'db_error' });
  if (!post || post.status !== 'visible') return json(404, { error: 'not_found' });

  const canReadBody = canReadPostBody({
    visibility: post.visibility,
    authorUserId: post.author_user_id
  }, viewer);
  if (!canReadBody) return json(403, { error: 'forbidden' });

  const { data: existing, error: existingError } = await supabase
    .from('post_likes')
    .select('post_id,user_id')
    .eq('post_id', payload.postId)
    .eq('user_id', viewer.userId)
    .maybeSingle();
  if (existingError) return json(500, { error: 'db_error' });

  const mutation = nextLikeMutation(existing);
  if (mutation === 'insert') {
    const { error } = await supabase
      .from('post_likes')
      .insert({ post_id: payload.postId, user_id: viewer.userId });
    if (error && !shouldIgnoreLikeInsertError(error)) return json(500, { error: 'db_error' });
  } else {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', payload.postId)
      .eq('user_id', viewer.userId);
    if (error) return json(500, { error: 'db_error' });
  }

  try {
    const likeRows = await loadLikeRows(supabase, payload.postId);
    return json(200, shapeLikeResponse(likeRows, viewer));
  } catch {
    return json(500, { error: 'db_error' });
  }
}
