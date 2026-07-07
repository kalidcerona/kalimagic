import { requireAdmin } from './_lib/auth.mjs';
import { json } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';

function shapePost(row) {
  return {
    id: row.id,
    kind: 'post',
    category: row.category,
    postType: row.post_type,
    title: row.title,
    status: row.status,
    visibility: row.visibility,
    youtubeVideoId: row.youtube_video_id,
    authorLabel: row.profiles?.nickname || '마술인',
    createdAt: row.created_at
  };
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  try {
    await requireAdmin(event);
  } catch {
    return json(403, { error: 'admin_required' });
  }

  const filter = event.queryStringParameters?.filter || 'all';
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('posts')
    .select('id,post_type,category,title,status,visibility,youtube_video_id,created_at,profiles(nickname),questions(answer_status,magazine_candidate)')
    .order('created_at', { ascending: false })
    .limit(80);

  if (filter === 'questions' || filter === 'waiting') query = query.eq('post_type', 'question');
  if (filter === 'event_reviews') query = query.eq('post_type', 'event_review');
  if (filter === 'private') query = query.neq('visibility', 'public');
  if (filter === 'hidden') query = query.eq('status', 'hidden');
  if (filter === 'deleted') query = query.eq('status', 'deleted');
  if (!['hidden', 'deleted'].includes(filter)) query = query.neq('status', 'deleted');

  const { data, error } = await query;
  if (error) return json(500, { error: 'db_error' });
  let items = data;
  if (filter === 'waiting') {
    items = items.filter((row) => row.questions?.answer_status === 'waiting');
  }
  if (filter === 'magazine_candidates') {
    items = items.filter((row) => row.questions?.magazine_candidate);
  }
  return json(200, { items: items.map(shapePost) });
}
