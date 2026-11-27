import { json } from './_lib/http.mjs';
import { getOffer, configured, getEvent } from './_lib/seminar-events.mjs';
import { submitSignup, SignupError } from './_lib/seminar-signups.mjs';
import { createSheetsStore } from './_lib/seminar-sheets.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { TERMS_VERSION, PRIVACY_VERSION } from '../../member-policy-config.mjs';

async function verifiedMember(headers, body, deps) {
  if (body?.signupMode !== 'member') {
    if (Object.hasOwn(headers,'authorization')) throw new SignupError('invalid_input');
    return null;
  }
  if (body.linkageConsent !== true) throw new SignupError('invalid_input');
  if (!headers.authorization) throw new SignupError('auth_required',401);
  const credentials = /^Bearer ([A-Za-z0-9._~+/=-]+)$/i.exec(headers.authorization);
  if (!credentials) throw new SignupError('auth_invalid',401);
  const client = deps.supabase || getSupabaseAdmin();
  const {data, error} = await client.auth.getUser(credentials[1]);
  if (error) {
    if ([400,401,403,404].includes(error.status)) throw new SignupError('auth_invalid',401);
    throw new SignupError('service_unavailable',503);
  }
  const id = data?.user?.id;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id || '') || data.user.is_anonymous) throw new SignupError('auth_invalid',401);
  try {
    const {data:profile,error:profileError} = await client.from('profiles')
      .select('terms_version,privacy_version,agreed_at').eq('user_id',id).maybeSingle();
    if (profileError) return {id, agreementUnavailable:true};
    return {id, agreed:profile?.terms_version === TERMS_VERSION && profile?.privacy_version === PRIVACY_VERSION && Number.isFinite(Date.parse(profile?.agreed_at))};
  } catch {
    // The authenticated owner can still replay an accepted signup during a profile outage.
    return {id, agreementUnavailable:true};
  }
}

export function createHandler(deps = {}) {
  let resumeAlertsAt = 0;
  async function alertSignup(receipt, eventName, member, count) {
    if (!deps.webhook || Date.now() < resumeAlertsAt) return;
    try {
      const time = new Date(Date.parse(receipt.createdAt) + 9 * 3600000).toISOString().slice(0,19).replace('T',' ');
      const fields = [eventName, time + ' KST'];
      if (receipt.displayReceiptNumber) fields.push('접수번호 ' + receipt.displayReceiptNumber);
      fields.push(member ? '회원' : '비회원', '누적 ' + count + '건');
      const response = await (deps.send || fetch)(deps.webhook, {
        method:'POST', redirect:'error', headers:{'content-type':'application/json'},
        body:JSON.stringify({content:fields.join(' · '), flags:4, allowed_mentions:{parse:[]}}),
        signal:AbortSignal.timeout(3000)
      });
      if (response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0') {
        const seconds = Number(response.headers.get('retry-after') || response.headers.get('x-ratelimit-reset-after'));
        resumeAlertsAt = Math.max(resumeAlertsAt, Date.now() + (seconds > 0 ? seconds : 1) * 1000);
      }
    } catch { /* A webhook failure cannot change a stored signup. */ }
  }
  return async (request, context) => {
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
    // Only the roster can confirm whether an earlier submission was accepted.
    if (!configured(settings)) return json(503, {error:'service_unavailable'});
    try {
      const ip = request.requestContext?.identity?.sourceIp || headers['x-nf-client-connection-ip'];
      const member = await verifiedMember(headers,body,deps);
      const result = await submitSignup(body, { member, offer:(deps.getOffer || getOffer)(now,settings),config:settings,store:deps.store || createSheetsStore(settings),secret:settings.hmacSecret,ip,now });
      if (Number.isSafeInteger(result.newRowCount) && result.newRowCount > 0) {
        context?.waitUntil(alertSignup(result.receipt, settings.name, member, result.newRowCount));
      }
      return json(200, { receipt: result.receipt });
    } catch (error) {
      if (error instanceof SignupError && error.message === 'signup_closed') return closedResponse();
      if (error instanceof SignupError) return json(error.status, { error: error.message, ...error.details }, error.status === 429 ? { 'Retry-After': String(error.details.retryAfter || 600) } : {});
      return json(503, { error: 'service_unavailable' });
    }
  };
}
const handleSignup = createHandler({webhook:process.env.DISCORD_SIGNUP_WEBHOOK_URL || process.env.DISCORD_CONTACT_WEBHOOK_URL});

export default async function signup(request, context) {
  const headers = Object.fromEntries(request.headers);
  headers['x-nf-client-connection-ip'] = context.ip;
  const result = await handleSignup({
    rawUrl:request.url, httpMethod:request.method, headers,
    body:request.method === 'POST' ? await request.text() : ''
  }, context);
  return new Response(result.body, {status:result.statusCode, headers:result.headers});
}
