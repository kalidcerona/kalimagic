import { canReadAnswer, canReadAuthor, canReadPostBody } from './_lib/access-policy.mjs';
import { requireViewer } from './_lib/auth.mjs';
import { json } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

async function optionalViewer(event) {
  try {
    return await requireViewer(event);
  } catch {
    return null;
  }
}

function canViewerAnswer(viewer) {
  return ['admin', 'kali'].includes(viewer?.role);
}

function canSeeHiddenPost(viewer) {
  return ['admin', 'kali'].includes(viewer?.role);
}

export function shouldIncrementView(row, viewer) {
  if (!row || row.status !== 'visible') return false;
  return canReadPostBody({ visibility: row.visibility, authorUserId: row.author_user_id }, viewer);
}

export function shapePost(row, viewer, state = {}) {
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
    authorRole: canReadName && row.display_mode === 'nickname' ? row.profiles?.role || null : null,
    displayMode: row.display_mode,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at,
    viewCount: canReadBody ? state.viewCount ?? row.view_count ?? 0 : null,
    likeCount: canReadBody ? state.likeCount ?? 0 : null,
    viewerLiked: canReadBody ? Boolean(state.viewerLiked) : false,
    isNotice: Boolean(row.is_notice),
    canReadBody,
    canDelete: Boolean(viewer?.userId && viewer.userId === row.author_user_id && row.status === 'visible')
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
    authorRole: row.profiles?.role || null,
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
    authorRole: row.display_mode === 'nickname' ? row.profiles?.role || null : null,
    createdAt: row.created_at
  };
}

async function loadLikeState(supabase, postId, viewer) {
  const { data: likes, error: likesError } = await supabase
    .from('post_likes')
    .select('user_id')
    .eq('post_id', postId);
  if (likesError) throw likesError;

  const likeRows = likes || [];
  return {
    likeCount: likeRows.length,
    viewerLiked: viewer ? likeRows.some((row) => row.user_id === viewer.userId) : false
  };
}

async function incrementViewCount(supabase, row) {
  const nextViewCount = (row.view_count || 0) + 1;
  const { error } = await supabase
    .from('posts')
    .update({ view_count: nextViewCount })
    .eq('id', row.id);
  if (error) throw error;
  return nextViewCount;
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  const id = event.queryStringParameters?.id;
  if (!validateUuid(id)) return json(400, { error: 'invalid_id' });

  const viewer = await optionalViewer(event);
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from('posts')
    .select('id,post_type,category,title,body,youtube_video_id,author_user_id,display_mode,visibility,status,created_at,view_count,is_notice,profiles(nickname,role)')
    .eq('id', id)
    .maybeSingle();

  if (error) return json(500, { error: 'db_error' });
  if (!row || (row.status !== 'visible' && !canSeeHiddenPost(viewer))) {
    return json(404, { error: 'not_found' });
  }

  let state = { viewCount: row.view_count || 0, likeCount: 0, viewerLiked: false };
  const canReadBody = canReadPostBody({ visibility: row.visibility, authorUserId: row.author_user_id }, viewer);

  if (shouldIncrementView(row, viewer)) {
    try {
      state.viewCount = await incrementViewCount(supabase, row);
    } catch {
      return json(500, { error: 'db_error' });
    }
  }

  if (canReadBody) {
    try {
      state = { ...state, ...await loadLikeState(supabase, row.id, viewer) };
    } catch {
      return json(500, { error: 'db_error' });
    }
  }

  const post = shapePost(row, viewer, state);
  const question = { visibility: row.visibility, authorUserId: row.author_user_id };
  if (!post.canReadBody) {
    return json(200, { post, answers: [], comments: [], viewerCanAnswer: canViewerAnswer(viewer) });
  }

  const { data: answers, error: answersError } = await supabase
    .from('answers')
    .select('id,body,visibility,is_pinned,youtube_video_id,created_at,profiles(nickname,role)')
    .eq('question_post_id', row.id)
    .eq('status', 'visible')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: true });
  if (answersError) return json(500, { error: 'db_error' });

  const { data: comments, error: commentsError } = await supabase
    .from('comments')
    .select('id,parent_comment_id,body,display_mode,created_at,profiles(nickname,role)')
    .eq('post_id', row.id)
    .eq('status', 'visible')
    .order('created_at', { ascending: true });
  if (commentsError) return json(500, { error: 'db_error' });

  return json(200, {
    post,
    answers: answers.map((answer) => shapeAnswer(question, answer, viewer)).filter(Boolean),
    comments: comments.map(shapeComment),
    viewerCanAnswer: canViewerAnswer(viewer)
  });
}
