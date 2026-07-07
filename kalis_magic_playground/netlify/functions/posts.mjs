import { canReadAuthor, canReadPostBody } from './_lib/access-policy.mjs';
import { requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validatePostPayload } from './_lib/validators.mjs';

async function optionalViewer(event) {
  try {
    return await requireViewer(event);
  } catch {
    return null;
  }
}

function publicShape(row, viewer) {
  const policyPost = { visibility: row.visibility, authorUserId: row.author_user_id };
  const canReadBody = canReadPostBody(policyPost, viewer);
  const canReadName = canReadAuthor(policyPost, viewer);
  return {
    id: row.id,
    postType: row.post_type,
    category: row.category,
    title: row.title,
    body: canReadBody ? row.body : '',
    bodyLocked: !canReadBody,
    youtubeVideoId: canReadBody ? row.youtube_video_id : null,
    authorLabel: canReadName && row.display_mode === 'nickname' ? row.profiles?.nickname || '마술인' : '익명',
    displayMode: row.display_mode,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at
  };
}

export async function handler(event) {
  if (event.httpMethod === 'POST') return createPost(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  const category = event.queryStringParameters?.category || 'all';
  const viewer = await optionalViewer(event);
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('posts')
    .select('id,post_type,category,title,body,youtube_video_id,author_user_id,display_mode,visibility,status,created_at,profiles(nickname)')
    .eq('status', 'visible')
    .order('created_at', { ascending: false })
    .limit(50);
  if (category !== 'all') query = query.eq('category', category);
  const { data, error } = await query;
  if (error) return json(500, { error: 'db_error' });
  return json(200, { posts: data.map((row) => publicShape(row, viewer)) });
}

async function createPost(event) {
  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  let payload;
  try {
    payload = validatePostPayload(readJsonBody(event));
  } catch (error) {
    return json(400, { error: 'invalid_payload', message: error.message });
  }

  const supabase = getSupabaseAdmin();
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      post_type: payload.postType,
      category: payload.category,
      title: payload.title,
      body: payload.body,
      author_user_id: viewer.userId,
      display_mode: payload.displayMode,
      visibility: payload.visibility,
      youtube_video_id: payload.youtubeVideoId
    })
    .select('id')
    .single();

  if (postError) return json(500, { error: 'db_error' });

  if (payload.postType === 'question') {
    const { error: questionError } = await supabase
      .from('questions')
      .insert({ post_id: post.id });
    if (questionError) return json(500, { error: 'db_error' });
  }

  return json(201, { id: post.id });
}
