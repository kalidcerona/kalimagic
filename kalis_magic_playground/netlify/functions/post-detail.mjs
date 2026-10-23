import { canReadAnswer, canReadAuthor, canReadPostBody } from './_lib/access-policy.mjs';
import { requireViewer } from './_lib/auth.mjs';
import { fetchBadgeMap, resolvePostAuthorBadges } from './_lib/badges.mjs';
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
  const badgeMap = state.badgeMap || {};
  const authorVisible = canReadName && row.display_mode === 'nickname';
  const authorId = viewer && authorVisible ? row.author_user_id : null;
  const badgeLookupId = authorVisible ? row.author_user_id : null;
  return {
    id: row.id,
    postType: row.post_type,
    category: row.category,
    title: row.title,
    body: canReadBody ? row.body : '',
    bodyLocked: !canReadBody,
    youtubeVideoId: canReadBody ? row.youtube_video_id : null,
    authorId,
    authorLabel: authorVisible ? row.profiles?.nickname || '마술인' : '익명',
    authorRole: authorVisible ? row.profiles?.role || null : null,
    authorBadges: badgeLookupId ? resolvePostAuthorBadges(row, badgeMap, badgeLookupId) : [],
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

function shapeAnswer(question, row, viewer, badgeMap = {}, state = {}) {
  if (!canReadAnswer(question, { visibility: row.visibility }, viewer)) return null;
  const authorId = viewer && row.author_user_id ? row.author_user_id : null;
  const badgeLookupId = row.author_user_id || null;
  const viewerHelpfulAnswerIds = state.viewerHelpfulAnswerIds || new Set();
  return {
    id: row.id,
    body: row.body,
    visibility: row.visibility,
    isPinned: false,
    authorId,
    authorLabel: row.profiles?.nickname || '답변자',
    authorRole: row.profiles?.role || null,
    authorBadges: badgeLookupId ? badgeMap[badgeLookupId] || [] : [],
    youtubeVideoId: row.youtube_video_id,
    createdAt: row.created_at,
    viewerHelpful: viewerHelpfulAnswerIds.has(row.id),
    canMarkHelpful: !viewer || viewer.userId !== row.author_user_id
  };
}

function shapeComment(row, viewer, badgeMap = {}) {
  const authorVisible = row.display_mode === 'nickname';
  const authorId = viewer && authorVisible ? row.author_user_id || null : null;
  const badgeLookupId = authorVisible ? row.author_user_id || null : null;
  return {
    id: row.id,
    parentCommentId: row.parent_comment_id,
    body: row.body,
    authorId,
    authorLabel: authorVisible ? row.profiles?.nickname || '마술인' : '익명',
    authorRole: authorVisible ? row.profiles?.role || null : null,
    authorBadges: badgeLookupId ? badgeMap[badgeLookupId] || [] : [],
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

async function loadAnswerHelpfulState(supabase, answerIds, viewer) {
  if (!viewer || answerIds.length === 0) return { viewerHelpfulAnswerIds: new Set() };
  const { data, error } = await supabase
    .from('answer_helpful_votes')
    .select('answer_id')
    .eq('user_id', viewer.userId)
    .in('answer_id', answerIds);
  if (error) throw error;
  return {
    viewerHelpfulAnswerIds: new Set((data || []).map((row) => row.answer_id))
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
    .select('id,post_type,category,title,body,youtube_video_id,author_user_id,author_badge_code,display_mode,visibility,status,created_at,view_count,is_notice,profiles(nickname,role,preferred_badge_code)')
    .eq('id', id)
    .maybeSingle();

  if (error) return json(500, { error: 'db_error' });
  if (!row || (row.status !== 'visible' && !canSeeHiddenPost(viewer))) {
    return json(404, { error: 'not_found' });
  }

  let state = { viewCount: row.view_count || 0, likeCount: 0, viewerLiked: false };
  const canReadBody = canReadPostBody({ visibility: row.visibility, authorUserId: row.author_user_id }, viewer);
  const canReadName = canReadAuthor({ visibility: row.visibility, authorUserId: row.author_user_id }, viewer);
  const postAuthorId = canReadName && row.display_mode === 'nickname' ? row.author_user_id : null;

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

  const question = { visibility: row.visibility, authorUserId: row.author_user_id };

  if (!canReadBody) {
    let badgeMap = {};
    try {
      badgeMap = await fetchBadgeMap(supabase, postAuthorId ? [postAuthorId] : []);
    } catch {
      return json(500, { error: 'db_error' });
    }
    const post = shapePost(row, viewer, { ...state, badgeMap });
    return json(200, { post, answers: [], comments: [], viewerCanAnswer: canViewerAnswer(viewer) });
  }

  const { data: answers, error: answersError } = await supabase
    .from('answers')
    .select('id,body,visibility,youtube_video_id,created_at,author_user_id,profiles(nickname,role)')
    .eq('question_post_id', row.id)
    .eq('status', 'visible')
    .order('created_at', { ascending: true });
  if (answersError) return json(500, { error: 'db_error' });

  const { data: comments, error: commentsError } = await supabase
    .from('comments')
    .select('id,parent_comment_id,body,display_mode,created_at,author_user_id,profiles(nickname,role)')
    .eq('post_id', row.id)
    .eq('status', 'visible')
    .order('created_at', { ascending: true });
  if (commentsError) return json(500, { error: 'db_error' });

  const authorIds = [
    postAuthorId,
    ...(answers || []).map((answer) => answer.author_user_id),
    ...(comments || [])
      .filter((comment) => comment.display_mode === 'nickname')
      .map((comment) => comment.author_user_id)
  ];

  let badgeMap = {};
  let helpfulState = { viewerHelpfulAnswerIds: new Set() };
  try {
    badgeMap = await fetchBadgeMap(supabase, authorIds);
    helpfulState = await loadAnswerHelpfulState(supabase, (answers || []).map((answer) => answer.id), viewer);
  } catch {
    return json(500, { error: 'db_error' });
  }

  const post = shapePost(row, viewer, { ...state, badgeMap });

  return json(200, {
    post,
    answers: answers.map((answer) => shapeAnswer(question, answer, viewer, badgeMap, helpfulState)).filter(Boolean),
    comments: comments.map((comment) => shapeComment(comment, viewer, badgeMap)),
    viewerCanAnswer: canViewerAnswer(viewer)
  });
}
