import { canReadPostBody } from './_lib/access-policy.mjs';
import { requireViewer } from './_lib/auth.mjs';
import { fetchBadgeMap } from './_lib/badges.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateCommentPayload } from './_lib/validators.mjs';

async function optionalViewer(event) {
  try {
    return await requireViewer(event);
  } catch {
    return null;
  }
}

function shapeComment(row, badgeMap = {}) {
  const authorVisible = row.display_mode === 'nickname';
  const authorId = authorVisible ? row.author_user_id || null : null;
  return {
    id: row.id,
    parentCommentId: row.parent_comment_id,
    body: row.body,
    authorId,
    authorLabel: authorVisible ? row.profiles?.nickname || '마술인' : '익명',
    authorRole: authorVisible ? row.profiles?.role || null : null,
    authorBadges: authorId ? badgeMap[authorId] || [] : [],
    createdAt: row.created_at
  };
}

async function readablePost(supabase, postId, viewer) {
  const { data: post, error } = await supabase
    .from('posts')
    .select('id,visibility,author_user_id,status')
    .eq('id', postId)
    .maybeSingle();
  if (error) throw error;
  if (!post || post.status !== 'visible') return null;
  return canReadPostBody({ visibility: post.visibility, authorUserId: post.author_user_id }, viewer) ? post : null;
}

export async function handler(event) {
  if (event.httpMethod === 'GET') return listComments(event);
  if (event.httpMethod === 'POST') return createComment(event);
  return json(405, { error: 'method_not_allowed' });
}

async function listComments(event) {
  const postId = event.queryStringParameters?.postId;
  if (!postId) return json(400, { error: 'post_id_required' });
  const viewer = await optionalViewer(event);
  const supabase = getSupabaseAdmin();
  const post = await readablePost(supabase, postId, viewer);
  if (!post) return json(403, { error: 'forbidden' });

  const { data, error } = await supabase
    .from('comments')
    .select('id,parent_comment_id,body,display_mode,created_at,author_user_id,profiles(nickname,role)')
    .eq('post_id', postId)
    .eq('status', 'visible')
    .order('created_at', { ascending: true });
  if (error) return json(500, { error: 'db_error' });

  const authorIds = data
    .filter((row) => row.display_mode === 'nickname')
    .map((row) => row.author_user_id);

  let badgeMap = {};
  try {
    badgeMap = await fetchBadgeMap(supabase, authorIds);
  } catch {
    return json(500, { error: 'db_error' });
  }

  return json(200, { comments: data.map((row) => shapeComment(row, badgeMap)) });
}

async function createComment(event) {
  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  let payload;
  try {
    payload = validateCommentPayload(readJsonBody(event));
  } catch (error) {
    return json(400, { error: 'invalid_payload', message: error.message });
  }

  const supabase = getSupabaseAdmin();
  const post = await readablePost(supabase, payload.postId, viewer);
  if (!post) return json(403, { error: 'forbidden' });

  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: payload.postId,
      parent_comment_id: payload.parentCommentId,
      author_user_id: viewer.userId,
      display_mode: payload.displayMode,
      body: payload.body
    })
    .select('id')
    .single();
  if (error) return json(500, { error: 'db_error' });
  return json(201, { id: data.id });
}
