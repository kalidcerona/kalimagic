import { canPublishAnswer } from './_lib/access-policy.mjs';
import { requireAdmin } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateAnswerPayload } from './_lib/validators.mjs';

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

  return json(201, { id: answer.id });
}
