import { requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import {
  awardQuestBadge as defaultAwardQuestBadge,
  awardQuestBadges as defaultAwardQuestBadges
} from './_lib/quest-badges.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

export function shouldIgnoreHelpfulVoteInsertError(error) {
  return error?.code === '23505';
}

function answerIdPayload(event) {
  const payload = readJsonBody(event);
  const answerId = String(payload.answerId ?? '').trim();
  if (!validateUuid(answerId)) throw new Error('invalid_answer_id');
  return { answerId };
}

function nestedQuestion(answer) {
  const question = answer?.posts;
  return Array.isArray(question) ? question[0] : question;
}

function isVisibleAnswer(answer) {
  const question = nestedQuestion(answer);
  return Boolean(answer && question && question.status === 'visible');
}

function isOlderThanDays(value, days, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return now.getTime() - date.getTime() >= days * 24 * 60 * 60 * 1000;
}

async function loadAnswer(supabase, answerId) {
  const { data, error } = await supabase
    .from('answers')
    .select('id,author_user_id,created_at,posts!inner(id,author_user_id,created_at,status)')
    .eq('id', answerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function awardAfterHelpfulVote(supabase, answer, viewer, hooks) {
  const awardQuestBadges = hooks.awardQuestBadges || defaultAwardQuestBadges;
  const awardQuestBadge = hooks.awardQuestBadge || defaultAwardQuestBadge;
  const question = nestedQuestion(answer);

  try {
    await awardQuestBadges(supabase, answer.author_user_id);
  } catch (error) {
    console.error('quest_badge_award_failed', error);
  }

  try {
    if (viewer.userId === question.author_user_id) {
      await awardQuestBadge(supabase, answer.author_user_id, 'secret_quiet_applause', {
        awardedReason: 'question_author_helpful_vote'
      });
    }
    const now = hooks.now ? new Date(hooks.now()) : new Date();
    if (isOlderThanDays(answer.created_at, 30, now) || isOlderThanDays(question.created_at, 30, now)) {
      await awardQuestBadge(supabase, answer.author_user_id, 'secret_old_shelf', {
        awardedReason: 'old_answer_helpful_vote'
      });
    }
  } catch (error) {
    console.error('quest_secret_badge_award_failed', error);
  }
}

async function markHelpful(event, viewer, supabase, hooks) {
  let payload;
  try {
    payload = answerIdPayload(event);
  } catch (error) {
    return json(400, { error: 'invalid_payload', message: error.message });
  }

  let answer;
  try {
    answer = await loadAnswer(supabase, payload.answerId);
  } catch {
    return json(500, { error: 'db_error' });
  }

  if (!isVisibleAnswer(answer)) return json(404, { error: 'not_found' });
  if (viewer.userId === answer.author_user_id) {
    return json(403, { error: 'self_vote_forbidden' });
  }

  const { error } = await supabase
    .from('answer_helpful_votes')
    .insert({ answer_id: payload.answerId, user_id: viewer.userId });

  if (error && shouldIgnoreHelpfulVoteInsertError(error)) {
    return json(200, { ok: true, helpful: true, inserted: false });
  }
  if (error) return json(500, { error: 'db_error' });

  await awardAfterHelpfulVote(supabase, answer, viewer, hooks);
  return json(200, { ok: true, helpful: true, inserted: true });
}

async function unmarkHelpful(event, viewer, supabase) {
  let payload;
  try {
    payload = answerIdPayload(event);
  } catch (error) {
    return json(400, { error: 'invalid_payload', message: error.message });
  }

  const { error } = await supabase
    .from('answer_helpful_votes')
    .delete()
    .eq('answer_id', payload.answerId)
    .eq('user_id', viewer.userId);
  if (error) return json(500, { error: 'db_error' });
  return json(200, { ok: true, helpful: false });
}

export async function changeAnswerHelpful(event, viewer, supabase, hooks = {}) {
  if (event.httpMethod === 'POST') return markHelpful(event, viewer, supabase, hooks);
  if (event.httpMethod === 'DELETE') return unmarkHelpful(event, viewer, supabase);
  return json(405, { error: 'method_not_allowed' });
}

export async function handler(event) {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
    return json(405, { error: 'method_not_allowed' });
  }

  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  const supabase = getSupabaseAdmin();
  return changeAnswerHelpful(event, viewer, supabase);
}
