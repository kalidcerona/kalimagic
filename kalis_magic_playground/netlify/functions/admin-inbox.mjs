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

const REPORT_PAGE_SIZE = 1000;

export function aggregateReports(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.target_type}:${row.target_id}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        targetType: row.target_type,
        targetId: row.target_id,
        reportCount: 1,
        latestReportedAt: row.created_at
      });
      continue;
    }
    current.reportCount += 1;
    if (row.created_at > current.latestReportedAt) current.latestReportedAt = row.created_at;
  }
  return Array.from(groups.values()).sort((left, right) =>
    right.latestReportedAt.localeCompare(left.latestReportedAt) || right.reportCount - left.reportCount
  );
}

async function loadAllReports(supabase) {
  const rows = [];
  for (let offset = 0; ; offset += REPORT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('post_reports')
      .select('target_type,target_id,created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + REPORT_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < REPORT_PAGE_SIZE) return rows;
  }
}

async function loadTargets(supabase, groups) {
  const postIds = groups.filter((group) => group.targetType === 'post').map((group) => group.targetId);
  const commentIds = groups.filter((group) => group.targetType === 'comment').map((group) => group.targetId);
  let posts = [];
  let comments = [];

  if (postIds.length) {
    const { data, error } = await supabase
      .from('posts')
      .select('id,title,status,author_user_id,profiles(nickname)')
      .in('id', postIds);
    if (error) throw error;
    posts = data || [];
  }

  if (commentIds.length) {
    const { data, error } = await supabase
      .from('comments')
      .select('id,post_id,body,status,author_user_id,profiles(nickname),posts(id,title,status,profiles(nickname))')
      .in('id', commentIds);
    if (error) throw error;
    comments = data || [];
  }

  return {
    posts: new Map(posts.map((row) => [row.id, row])),
    comments: new Map(comments.map((row) => [row.id, row]))
  };
}

export function shapeReport(group, targets) {
  const isPost = group.targetType === 'post';
  const target = isPost ? targets.posts.get(group.targetId) : targets.comments.get(group.targetId);
  const post = isPost ? target : target?.posts;
  return {
    id: group.targetId,
    kind: 'report',
    targetType: group.targetType,
    targetId: group.targetId,
    postId: isPost ? group.targetId : target?.post_id || null,
    title: post?.title || (isPost ? '삭제된 게시글' : '삭제된 댓글의 게시글'),
    authorLabel: target?.profiles?.nickname || '알 수 없음',
    status: target?.status || 'deleted',
    commentBody: isPost ? null : target?.body || null,
    reportCount: group.reportCount,
    latestReportedAt: group.latestReportedAt,
    createdAt: group.latestReportedAt
  };
}

async function listReports(supabase) {
  const groups = aggregateReports(await loadAllReports(supabase));
  const targets = await loadTargets(supabase, groups);
  return groups.map((group) => shapeReport(group, targets));
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
  if (filter === 'reports') {
    try {
      return json(200, { items: await listReports(supabase) });
    } catch {
      return json(500, { error: 'db_error' });
    }
  }

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
