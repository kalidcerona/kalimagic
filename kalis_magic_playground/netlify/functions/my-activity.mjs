import { requireViewer } from './_lib/auth.mjs';
import { canReadPostBody } from './_lib/access-policy.mjs';
import { json } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';

const TABS = new Set(['posts', 'received', 'given']);

function countByPostId(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    counts.set(row.post_id, (counts.get(row.post_id) || 0) + 1);
  }
  return counts;
}

function sortActivityItems(items) {
  return items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export function parseTab(value) {
  const tab = String(value ?? '').trim() || 'posts';
  if (!TABS.has(tab)) throw new Error('invalid_tab');
  return tab;
}

export function shapeMyPost(row, commentCounts = new Map()) {
  return {
    id: row.id,
    postType: row.post_type,
    category: row.category,
    title: row.title,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at,
    commentCount: commentCounts.get(row.id) || 0
  };
}

export function shapeActivityItem(row, type) {
  const post = row.posts || {};
  return {
    type,
    postId: row.post_id || row.question_post_id || post.id,
    postTitle: row.post_title || post.title || '',
    body: String(row.body || '').trim().slice(0, 200),
    createdAt: row.created_at
  };
}

function canReadActivityPost(row, viewer) {
  const post = row.posts || {};
  return canReadPostBody({
    visibility: post.visibility,
    authorUserId: post.author_user_id
  }, viewer);
}

async function loadCommentCounts(supabase, postIds) {
  if (postIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('comments')
    .select('post_id')
    .eq('status', 'visible')
    .in('post_id', postIds);
  if (error) throw error;
  return countByPostId(data);
}

async function listMyPosts(supabase, viewer) {
  const { data, error } = await supabase
    .from('posts')
    .select('id,post_type,category,title,visibility,status,created_at')
    .eq('author_user_id', viewer.userId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  const rows = data || [];
  const commentCounts = await loadCommentCounts(supabase, rows.map((row) => row.id));
  return rows.map((row) => shapeMyPost(row, commentCounts));
}

export async function listReceivedActivity(supabase, viewer) {
  const { data: answers, error: answersError } = await supabase
    .from('answers')
    .select('id,question_post_id,body,created_at,posts!inner(id,title,author_user_id,post_type)')
    .eq('status', 'visible')
    .eq('posts.author_user_id', viewer.userId)
    .eq('posts.post_type', 'question')
    .neq('author_user_id', viewer.userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (answersError) throw answersError;

  const { data: comments, error: commentsError } = await supabase
    .from('comments')
    .select('id,post_id,body,created_at,posts!inner(id,title,author_user_id)')
    .eq('status', 'visible')
    .eq('posts.author_user_id', viewer.userId)
    .neq('author_user_id', viewer.userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (commentsError) throw commentsError;

  return sortActivityItems([
    ...(answers || []).map((row) => shapeActivityItem(row, 'answer')),
    ...(comments || []).map((row) => shapeActivityItem(row, 'comment'))
  ]);
}

export async function listGivenActivity(supabase, viewer) {
  const { data: comments, error: commentsError } = await supabase
    .from('comments')
    .select('id,post_id,body,created_at,posts!inner(id,title,status,visibility,author_user_id)')
    .eq('author_user_id', viewer.userId)
    .eq('status', 'visible')
    .eq('posts.status', 'visible')
    .neq('posts.author_user_id', viewer.userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (commentsError) throw commentsError;

  const { data: answers, error: answersError } = await supabase
    .from('answers')
    .select('id,question_post_id,body,created_at,posts!inner(id,title,status,visibility,author_user_id)')
    .eq('author_user_id', viewer.userId)
    .eq('status', 'visible')
    .eq('posts.status', 'visible')
    .neq('posts.author_user_id', viewer.userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (answersError) throw answersError;

  return sortActivityItems([
    ...(comments || []).filter((row) => canReadActivityPost(row, viewer)).map((row) => shapeActivityItem(row, 'comment')),
    ...(answers || []).filter((row) => canReadActivityPost(row, viewer)).map((row) => shapeActivityItem(row, 'answer'))
  ]);
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });

  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  let tab;
  try {
    tab = parseTab(event.queryStringParameters?.tab);
  } catch {
    return json(400, { error: 'invalid_tab' });
  }

  const supabase = getSupabaseAdmin();
  try {
    const items = tab === 'posts'
      ? await listMyPosts(supabase, viewer)
      : tab === 'received'
        ? await listReceivedActivity(supabase, viewer)
        : await listGivenActivity(supabase, viewer);
    return json(200, { tab, items });
  } catch {
    return json(500, { error: 'db_error' });
  }
}
