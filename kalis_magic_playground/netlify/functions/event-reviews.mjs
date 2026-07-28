import { requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { awardQuestBadges } from './_lib/quest-badges.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateEventReviewPayload } from './_lib/validators.mjs';

function reviewTitle(payload) {
  return payload.goodMoment.length > 42 ? payload.goodMoment.slice(0, 42) + '...' : payload.goodMoment;
}

function shapeReview(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    authorLabel: row.display_mode === 'nickname' ? row.profiles?.nickname || '마술인' : '익명',
    authorRole: row.display_mode === 'nickname' ? row.profiles?.role || null : null,
    youtubeVideoId: row.youtube_video_id,
    createdAt: row.created_at
  };
}

export async function handler(event) {
  if (event.httpMethod === 'GET') return listReviews(event);
  if (event.httpMethod === 'POST') return createReview(event);
  return json(405, { error: 'method_not_allowed' });
}

async function listReviews(event) {
  const eventCode = event.queryStringParameters?.eventCode || '2026-08';
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('posts')
    .select('id,title,body,display_mode,youtube_video_id,created_at,profiles(nickname,role),event_reviews!inner(event_code)')
    .eq('post_type', 'event_review')
    .eq('status', 'visible')
    .eq('visibility', 'public')
    .eq('event_reviews.event_code', eventCode)
    .order('created_at', { ascending: false })
    .limit(12);
  if (error) return json(500, { error: 'db_error' });
  return json(200, { reviews: data.map(shapeReview) });
}

async function createReview(event) {
  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  let payload;
  try {
    payload = validateEventReviewPayload(readJsonBody(event));
  } catch (error) {
    return json(400, { error: 'invalid_payload', message: error.message });
  }

  const supabase = getSupabaseAdmin();
  const body = [
    payload.goodMoment,
    payload.impressiveScene,
    payload.nextProgram,
    payload.messageToFirstTimer
  ].join('\n\n');
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      post_type: 'event_review',
      category: 'event_review',
      title: reviewTitle(payload),
      body,
      author_user_id: viewer.userId,
      display_mode: 'nickname',
      visibility: 'public',
      youtube_video_id: payload.youtubeVideoId
    })
    .select('id')
    .single();

  if (postError) return json(500, { error: 'db_error' });

  const { error: reviewError } = await supabase
    .from('event_reviews')
    .insert({
      post_id: post.id,
      event_code: payload.eventCode,
      good_moment: payload.goodMoment,
      impressive_scene: payload.impressiveScene,
      next_program: payload.nextProgram,
      message_to_first_timer: payload.messageToFirstTimer
    });
  if (reviewError) return json(500, { error: 'db_error' });

  const photoRows = payload.photoIds.map((photoId, index) => ({
    post_id: post.id,
    photo_id: photoId,
    sort_order: index
  }));
  const { error: photoError } = await supabase.from('event_review_photos').insert(photoRows);
  if (photoError) return json(500, { error: 'db_error' });

  try {
    await awardQuestBadges(supabase, viewer.userId);
  } catch (error) {
    console.error('quest_badge_award_failed', error);
  }

  return json(201, { id: post.id });
}
