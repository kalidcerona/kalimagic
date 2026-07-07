import { canReadAnswer, canReadAuthor, canReadPostBody } from './_lib/access-policy.mjs';
import { requireViewer } from './_lib/auth.mjs';
import { json } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';

async function optionalViewer(event) {
  try {
    return await requireViewer(event);
  } catch {
    return null;
  }
}

function shapePost(row, viewer) {
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
    createdAt: row.created_at,
    canReadBody
  };
}

function shapeAnswer(question, row, viewer) {
  if (!canReadAnswer(question, { visibility: row.visibility }, viewer)) return null;
  return {
    id: row.id,
    body: row.body,
    visibility: row.visibility,
    isPinned: row.is_pinned,
    authorLabel: row.profiles?.nickname || '답변자',
    youtubeVideoId: row.youtube_video_id,
    createdAt: row.created_at
  };
}

function shapeComment(row) {
  return {
    id: row.id,
    parentCommentId: row.parent_comment_id,
    body: row.body,
    authorLabel: row.display_mode === 'nickname' ? row.profiles?.nickname || '마술인' : '익명',
    createdAt: row.created_at
  };
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  const id = event.queryStringParameters?.id;
  if (!id) return json(400, { error: 'id_required' });

  const viewer = await optionalViewer(event);
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from('posts')
    .select('id,post_type,category,title,body,youtube_video_id,author_user_id,display_mode,visibility,status,created_at,profiles(nickname)')
    .eq('id', id)
    .maybeSingle();

  if (error) return json(500, { error: 'db_error' });
  if (!row || (row.status !== 'visible' && !['admin', 'kali'].includes(viewer?.role))) {
    return json(404, { error: 'not_found' });
  }

  const post = shapePost(row, viewer);
  const question = { visibility: row.visibility, authorUserId: row.author_user_id };
  if (!post.canReadBody) return json(200, { post, answers: [], comments: [] });

  const { data: answers, error: answersError } = await supabase
    .from('answers')
    .select('id,body,visibility,is_pinned,youtube_video_id,created_at,profiles(nickname)')
    .eq('question_post_id', row.id)
    .eq('status', 'visible')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: true });
  if (answersError) return json(500, { error: 'db_error' });

  const { data: comments, error: commentsError } = await supabase
    .from('comments')
    .select('id,parent_comment_id,body,display_mode,created_at,profiles(nickname)')
    .eq('post_id', row.id)
    .eq('status', 'visible')
    .order('created_at', { ascending: true });
  if (commentsError) return json(500, { error: 'db_error' });

  return json(200, {
    post,
    answers: answers.map((answer) => shapeAnswer(question, answer, viewer)).filter(Boolean),
    comments: comments.map(shapeComment)
  });
}
