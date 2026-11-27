import { randomUUID } from 'node:crypto';

import { bearerToken, requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody, requireMethod } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateLeadPayload } from './_lib/validators.mjs';
import { insertTrackedEvents } from './track.mjs';

async function optionalViewerId(event) {
  const authEvent = { ...event, headers: event.headers || {} };
  if (!bearerToken(authEvent)) return null;

  try {
    const viewer = await requireViewer(authEvent);
    return viewer.userId;
  } catch {
    return null;
  }
}

export async function handleLead(event, getAdmin = getSupabaseAdmin) {
  try {
    requireMethod(event, ['POST']);
  } catch {
    return json(405, { error: 'method_not_allowed' });
  }

  let lead;
  try {
    lead = validateLeadPayload(readJsonBody(event));
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  const userId = await optionalViewerId(event);
  const now = new Date().toISOString();

  try {
    const supabase = getAdmin();
    const { data, error } = await supabase
      .from('leads')
      .insert({
        contact_type: lead.contactType,
        contact: lead.contact,
        source: lead.source,
        // The legacy NOT NULL column holds a fresh, lead-only value.
        session_id: randomUUID(),
        user_id: userId,
        consent_at: now
      })
      .select('id')
      .single();
    if (error || !data?.id) throw error || new Error('lead insert returned no id');

    try {
      await insertTrackedEvents(supabase, [{
        eventId: randomUUID(),
        sessionId: randomUUID(),
        eventType: 'lead_submit',
        eventName: 'lead_submit',
        page: '/',
        meta: {},
        occurredAt: now.slice(0, 13) + ':00:00.000Z'
      }]);
    } catch (trackingError) {
      console.error('lead_tracking_failed', trackingError);
    }

    return json(201, { ok: true, id: data.id });
  } catch {
    return json(500, { error: 'db_error' });
  }
}

export const handler = event => handleLead(event);
