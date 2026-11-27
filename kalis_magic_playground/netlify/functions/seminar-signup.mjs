import { json } from './_lib/http.mjs';
import { getOffer, configured, getEvent } from './_lib/seminar-events.mjs';
import { submitSignup, SignupError } from './_lib/seminar-signups.mjs';
import { createSheetsStore } from './_lib/seminar-sheets.mjs';

export function createHandler(deps = {}) {
  return async request => {
    if (request.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' }, { Allow: 'POST' });
    const headers = Object.fromEntries(Object.entries(request.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    let origin;
    try { origin = new URL(request.rawUrl).origin; } catch { return json(403, { error: 'invalid_origin' }); }
    if (headers.origin !== origin || !/^application\/json(?:\s*;|$)/i.test(headers['content-type'] || '')) return json(403, { error: 'invalid_origin' });
    if (request.isBase64Encoded || Buffer.byteLength(request.body || '', 'utf8') > 8192) return json(413, { error: 'body_too_large' });
    let body;
    try { body = JSON.parse(request.body || ''); } catch { return json(400, { error: 'invalid_json' }); }
    const now = deps.now ? deps.now() : new Date();
    const settings = deps.config || getEvent(body?.eventId);
    if (!settings) return json(404, {error:'unknown_event'});
    function closedResponse() {
      if (settings.id !== 'cupsnballs') return json(403, {error:'signup_closed'});
      const availabilityState = now >= Date.parse(settings.closesAt) ? 'ended' : 'unavailable';
      return json(403, {error:'signup_closed', availabilityState});
    }
    // Even injected stores cannot turn an incompletely configured deployment into an open sale.
    if (!configured(settings)) return closedResponse();
    try {
      const ip = request.requestContext?.identity?.sourceIp || headers['x-nf-client-connection-ip'];
      const result = await submitSignup(body, { offer:(deps.getOffer || getOffer)(now,settings),config:settings,store:deps.store || createSheetsStore(settings),secret:settings.hmacSecret,ip,now });
      return json(200, { receipt: result.receipt });
    } catch (error) {
      if (error instanceof SignupError && error.message === 'signup_closed') return closedResponse();
      if (error instanceof SignupError) return json(error.status, { error: error.message, ...error.details }, error.status === 429 ? { 'Retry-After': String(error.details.retryAfter || 600) } : {});
      return json(503, { error: 'service_unavailable' });
    }
  };
}
export const handler = createHandler();
