import { json, readJsonBody, requireMethod } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateEventBatch } from './_lib/validators.mjs';

const MAX_BODY_BYTES = 32 * 1024;

function bodyByteLength(body) {
  return new TextEncoder().encode(String(body || '')).byteLength;
}

export async function insertTrackedEvents(supabase, events) {
  for (const event of events) {
    const { error } = await supabase.from('events').insert({
      id: event.eventId,
      session_id: event.sessionId,
      user_id: null,
      event_type: event.eventType,
      event_name: event.eventName,
      page: event.page,
      meta: event.meta,
      occurred_at: event.occurredAt
    });
    if (error && error.code !== '23505') throw error;
  }
}

export async function handler(event) {
  try {
    requireMethod(event, ['POST']);
  } catch {
    return json(405, { error: 'method_not_allowed' });
  }

  if (bodyByteLength(event.body) > MAX_BODY_BYTES) {
    return json(400, { error: 'invalid_payload' });
  }

  let events;
  try {
    events = validateEventBatch(readJsonBody(event));
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  try {
    const supabase = getSupabaseAdmin();
    await insertTrackedEvents(supabase, events);
    return json(202, { accepted: events.length });
  } catch {
    return json(500, { error: 'db_error' });
  }
}
