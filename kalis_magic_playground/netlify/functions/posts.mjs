import { canReadAuthor, canReadPostBody } from './_lib/access-policy.mjs';
import { requireViewer } from './_lib/auth.mjs';
import { fetchBadgeMap } from './_lib/badges.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateListQuery, validatePostIdPayload, validatePostPayload } from './_lib/validators.mjs';

async function optionalViewer(event) {
  try {
    return await requireViewer(event);
  } catch {
    return null;
  }
}

export function hasPrivilegedRole(viewer) {
  return ['admin', 'kali'].includes(viewer?.role);
}

export function boardCategoryForCategory(category) {
  if (category === 'review' || category === 'event_review') return 'review';
  return category;
}

export function prefixForCategory(category) {
  if (category === 'question') return '질문';
  if (category === 'review') return '도구';
  if (category === 'event_review') return '모임';
  if (category === 'magazine') return '매거진';
  return '기록';
}

function countByPostId(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    counts.set(row.post_id, (counts.get(row.post_id) || 0) + 1);
  }
  return counts;
}

export function shapePostListRow(row, viewer, state = {}) {
  const policyPost = { visibility: row.visibility, authorUserId: row.author_user_id };
  const canReadBody = canReadPostBody(policyPost, viewer);
  const canReadName = canReadAuthor(policyPost, viewer);
  const commentCounts = state.commentCounts || new Map();
  const likeCounts = state.likeCounts || new Map();
  const viewerLikedPostIds = state.viewerLikedPostIds || new Set();
  const badgeMap = state.badgeMap || {};
  const authorVisible = canReadName && row.display_mode === 'nickname';
  const authorId = authorVisible ? row.author_user_id : null;

  return {
    id: row.id,
    postType: row.post_type,
    category: row.category,
    boardCategory: boardCategoryForCategory(row.category),
    prefix: prefixForCategory(row.category),
    title: row.title,
    bodyPreview: canReadBody ? String(row.body || '').replace(/\s+/g, ' ').trim().slice(0, 140) : null,
    commentCount: commentCounts.get(row.id) || 0,
    youtubeVideoId: canReadBody ? row.youtube_video_id : null,
    authorId,
    authorLabel: authorVisible ? row.profiles?.nickname || '마술인' : '익명',
    authorRole: authorVisible ? row.profiles?.role || null : null,
    authorBadges: authorId ? badgeMap[authorId] || [] : [],
    displayMode: row.display_mode,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at,
    viewCount: canReadBody ? row.view_count || 0 : null,
    likeCount: canReadBody ? likeCounts.get(row.id) || 0 : null,
    viewerLiked: canReadBody ? viewerLikedPostIds.has(row.id) : false,
    isNotice: Boolean(row.is_notice),
    canReadBody,
    bodyLocked: !canReadBody
  };
}

export function applyListFilters(query, params) {
  if (params.category === 'all') return query;
  if (params.category === 'question') return query.eq('category', 'question');
  if (params.category === 'review' && params.reviewKind === 'tool') return query.eq('category', 'review');
  if (params.category === 'review' && params.reviewKind === 'meeting') return query.eq('category', 'event_review');
  if (params.category === 'review') return query.in('category', ['review', 'event_review']);
  if (params.category === 'free') return query.eq('post_type', 'free');
  if (params.category === 'magazine') {
    return query.or('category.eq.magazine,and(category.eq.question,questions.magazine_candidate.eq.true)');
  }
  return query.neq('category', 'free');
}

async function loadListState(supabase, postIds, viewer, authorUserIds) {
  if (postIds.length === 0) {
    return {
      commentCounts: new Map(),
      likeCounts: new Map(),
      viewerLikedPostIds: new Set(),
      badgeMap: {}
    };
  }

  const { data: comments, error: commentsError } = await supabase
    .from('comments')
    .select('post_id')
    .eq('status', 'visible')
    .in('post_id', postIds);
  if (commentsError) throw commentsError;

  const { data: likes, error: likesError } = await supabase
    .from('post_likes')
    .select('post_id')
    .in('post_id', postIds);
  if (likesError) throw likesError;

  let viewerLikes = [];
  if (viewer) {
    const { data, error } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', viewer.userId)
      .in('post_id', postIds);
    if (error) throw error;
    viewerLikes = data || [];
  }

  const badgeMap = await fetchBadgeMap(supabase, authorUserIds);

  return {
    commentCounts: countByPostId(comments),
    likeCounts: countByPostId(likes),
    viewerLikedPostIds: new Set(viewerLikes.map((row) => row.post_id)),
    badgeMap
  };
}

async function listPosts(event) {
  let params;
  try {
    params = validateListQuery(event.queryStringParameters || {});
  } catch (error) {
    return json(400, { error: 'invalid_query', message: error.message });
  }

  const viewer = await optionalViewer(event);
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('posts')
    .select('id,post_type,category,title,body,youtube_video_id,author_user_id,display_mode,visibility,status,created_at,view_count,is_notice,profiles(nickname,role),questions(magazine_candidate)')
    .eq('status', 'visible')
    .order('is_notice', { ascending: false })
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit);

  query = applyListFilters(query, params);

  const { data, error } = await query;
  if (error) return json(500, { error: 'db_error' });

  const rows = data || [];
  const pageRows = rows.slice(0, params.limit);
  const hasMore = rows.length > params.limit;
  const postIds = pageRows.map((row) => row.id);

  const authorUserIds = pageRows.map((row) => row.author_user_id);

  let state;
  try {
    state = await loadListState(supabase, postIds, viewer, authorUserIds);
  } catch {
    return json(500, { error: 'db_error' });
  }

  return json(200, {
    posts: pageRows.map((row) => shapePostListRow(row, viewer, state)),
    limit: params.limit,
    offset: params.offset,
    hasMore
  });
}

export async function handler(event) {
  if (event.httpMethod === 'POST') return createPost(event);
  if (event.httpMethod === 'DELETE') return deletePost(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  return listPosts(event);
}

export function deleteDecision(post, viewer, visibleAnswerCount) {
  if (!post || post.status !== 'visible') {
    return { ok: false, status: 404, body: { error: 'not_found' } };
  }
  if (post.author_user_id !== viewer.userId) {
    return { ok: false, status: 403, body: { error: 'forbidden' } };
  }
  if (post.post_type === 'question' && visibleAnswerCount > 0) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'answered_question',
        message: '답변이 달린 질문은 삭제할 수 없어요'
      }
    };
  }
  return { ok: true, status: 200, body: { ok: true, status: 'deleted' } };
}

async function countVisibleAnswers(supabase, post) {
  if (!post || post.post_type !== 'question') return 0;
  const { data, error } = await supabase
    .from('answers')
    .select('id')
    .eq('question_post_id', post.id)
    .eq('status', 'visible')
    .limit(1);
  if (error) throw error;
  return (data || []).length;
}

async function deletePost(event) {
  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
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
    .select('id,post_type,author_user_id,status')
    .eq('id', payload.postId)
    .maybeSingle();
  if (postError) return json(500, { error: 'db_error' });

  let visibleAnswerCount = 0;
  try {
    visibleAnswerCount = await countVisibleAnswers(supabase, post);
  } catch {
    return json(500, { error: 'db_error' });
  }

  const decision = deleteDecision(post, viewer, visibleAnswerCount);
  if (!decision.ok) return json(decision.status, decision.body);

  const { error: updateError } = await supabase
    .from('posts')
    .update({ status: 'deleted' })
    .eq('id', payload.postId);
  if (updateError) return json(500, { error: 'db_error' });

  return json(decision.status, decision.body);
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

  if (payload.postType === 'magazine' && !hasPrivilegedRole(viewer)) {
    return json(403, { error: 'forbidden', message: '매거진 글쓰기는 관리자만 사용할 수 있어요' });
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
