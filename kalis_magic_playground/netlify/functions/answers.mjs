import { canPublishAnswer } from './_lib/access-policy.mjs';
import { requireAdmin } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { awardQuestBadge, awardQuestBadges } from './_lib/quest-badges.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateAnswerPayload } from './_lib/validators.mjs';

function charLength(value) {
  return Array.from(String(value || '')).length;
}

function currentSeoulHour(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const hour = parts.find((part) => part.type === 'hour')?.value;
  return Number(hour);
}

async function hasExistingAnswer(supabase, questionPostId) {
  const { data, error } = await supabase
    .from('answers')
    .select('id')
    .eq('question_post_id', questionPostId)
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  let viewer;
  try {
    viewer = await requireAdmin(event);
  } catch {
    return json(403, { error: 'admin_required' });
  }

  let payload;
  try {
    payload = validateAnswerPayload(readJsonBody(event));
  } catch (error) {
    return json(400, { error: 'invalid_payload', message: error.message });
  }

  const supabase = getSupabaseAdmin();
  const { data: question, error: questionError } = await supabase
    .from('posts')
    .select('id,visibility,post_type,status')
    .eq('id', payload.questionPostId)
    .maybeSingle();

  if (questionError) return json(500, { error: 'db_error' });
  if (!question || question.post_type !== 'question' || question.status !== 'visible') {
    return json(404, { error: 'question_not_found' });
  }
  if (!canPublishAnswer(question, payload.visibility)) {
    return json(400, { error: 'answer_visibility_too_public' });
  }

  let isFirstAnswer = false;
  try {
    isFirstAnswer = !(await hasExistingAnswer(supabase, payload.questionPostId));
  } catch (error) {
    console.error('quest_secret_precheck_failed', error);
  }

  const { data: answer, error: answerError } = await supabase
    .from('answers')
    .insert({
      question_post_id: payload.questionPostId,
      author_user_id: viewer.userId,
      body: payload.body,
      visibility: payload.visibility,
      youtube_video_id: payload.youtubeVideoId
    })
    .select('id')
    .single();

  if (answerError) return json(500, { error: 'db_error' });

  const { error: updateError } = await supabase
    .from('questions')
    .update({ answer_status: 'answered' })
    .eq('post_id', payload.questionPostId);
  if (updateError) return json(500, { error: 'db_error' });

  try {
    await awardQuestBadges(supabase, viewer.userId);
  } catch (error) {
    console.error('quest_badge_award_failed', error);
  }

  try {
    if (isFirstAnswer) {
      await awardQuestBadge(supabase, viewer.userId, 'secret_unanswered_compass', {
        awardedReason: 'first_answer_to_question'
      });
    }
    const hour = currentSeoulHour();
    if (charLength(payload.body) >= 200 && hour >= 0 && hour < 5) {
      await awardQuestBadge(supabase, viewer.userId, 'secret_night_scribe', {
        awardedReason: 'night_answer'
      });
    }
  } catch (error) {
    console.error('quest_secret_badge_award_failed', error);
  }

  return json(201, { id: answer.id });
}
