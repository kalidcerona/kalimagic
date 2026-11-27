const requireViewer = async event => (await import('./_lib/auth.mjs')).requireViewer(event);
import {createHmac} from 'node:crypto';
import {createSheetsStore,validSheetsUrl} from './_lib/seminar-sheets.mjs';
import { json } from './_lib/http.mjs';

const windowMs = 60000;
export function createContactHandler({ webhook, send = fetch, viewer = requireViewer, now = Date.now, store, settings = {} }) {
  const storageReady = Boolean(store && validSheetsUrl(settings.sheetsUrl) && typeof settings.signingSecret === 'string' && settings.signingSecret.length >= 32 && typeof settings.hmacSecret === 'string' && settings.hmacSecret.length >= 32 && settings.signingSecret !== settings.hmacSecret);
  const ready = Boolean(webhook && storageReady);
  const hash = (purpose,value) => createHmac('sha256',settings.hmacSecret).update(purpose+'\0'+value).digest('hex');
  const attempts = new Map();
  function limited(ip) {
    const time = now();
    for (const [key, entry] of attempts) {
      if (entry.until <= time) attempts.delete(key);
    }
    let entry = attempts.get(ip);
    if (!entry) {
      if (attempts.size >= 4096) return true;
      entry = { count: 0, until: time + windowMs };
      attempts.set(ip, entry);
    }
    return ++entry.count > 3;
  }

  return async function contact(event) {
    if (event.httpMethod === 'GET') {
      if (!ready) return json(200,{open:false});
      try {const result=await store.submit({action:'inquiry_readiness',eventId:'contact'});return json(200,{open:result?.ok === true && result.ready === true});} catch {return json(200,{open:false});}
    }
    if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
    if (!event.body || event.body.length > 12000) return json(400, { error: 'length' });
    let input;
    try { input = JSON.parse(event.body); } catch { return json(400, { error: 'invalid' }); }
    if (!input || typeof input !== 'object') return json(400, { error: 'invalid' });
    const lookup = input.action === 'status';
    if (input.action && !['status','submit'].includes(input.action)) return json(400,{error:'invalid'});
    if (!(lookup ? storageReady : ready)) return json(503,{error:'closed'});
    if (input.website) return json(200, { sent: false });
    const { message, reply = '', idempotencyKey } = input;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey || '')) return json(400,{error:'invalid'});
    if (typeof message !== 'string' || !message.trim() || message.length > 1400)
      return json(400, { error: 'length', field: 'message' });
    if (typeof reply !== 'string' || reply.length > 150)
      return json(400, { error: 'length', field: 'reply' });
    const urlPattern = /(?:[a-z][a-z0-9+.-]*:\/\/[^\s<>]+|(?<![@\w.-])(?:[\w-]+\.)+[a-z]{2,}(?:\/[^\s<>]*)?)/gi;
    const messageLinks = (message.match(urlPattern) || []).length;
    const replyLinks = (reply.match(urlPattern) || []).length;
    if (messageLinks + replyLinks > 3)
      return json(400, { error: 'links', field: messageLinks > 3 ? 'message' : 'reply' });
    if (limited(event.headers['x-nf-client-connection-ip'] || 'unknown')) return json(429, { error: 'limited' });
    let author = '비회원', identity = 'guest';
    if (event.headers.authorization || event.headers.Authorization) {
      try {
        const member = await viewer(event);
        author = member.nickname + ' (' + member.userId + ')';
        identity = 'member:' + member.userId;
      } catch { return json(401, { error: 'auth' }); }
    }
    const record={message:message.trim(),reply:reply.trim(),author};
    const time=new Date(now()).toISOString();
    const fingerprint=hash('inquiry',JSON.stringify({message:record.message,reply:record.reply,identity}));
    let saved;
    if (lookup) {
      try {
        const found = await store.submit({action:'inquiry_status',eventId:'contact',idempotencyKey:idempotencyKey.toLowerCase(),fingerprint});
        if (found?.ok === true && found.state === 'unknown') return json(200,{state:'unknown'});
        if (found?.ok === true && /^[0-9a-f-]{36}$/i.test(found.id || '') && Number.isFinite(Date.parse(found.receivedAt))) return json(200,{state:'accepted',id:found.id});
        return json(found?.error === 'idempotency_conflict' ? 409 : 503,{error:found?.error === 'idempotency_conflict' ? 'conflict' : 'storage'});
      } catch { return json(503,{error:'storage'}); }
    }
    try { saved=await store.submit({action:'inquiry_submit',eventId:'contact',idempotencyKey:idempotencyKey.toLowerCase(),fingerprint,receivedAt:time,ipHash:hash('ip',event.headers['x-nf-client-connection-ip'] || 'unknown'),record}); }
    catch {return json(503,{error:'storage'});}
    if (saved?.ok !== true || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved.id || '') || !Number.isFinite(Date.parse(saved.receivedAt))) return json(saved?.error === 'rate_limited' ? 429 : saved?.error === 'idempotency_conflict' ? 409 : 503,{error:saved?.error === 'rate_limited' ? 'limited' : saved?.error === 'idempotency_conflict' ? 'conflict' : 'storage'});
    let alerted=false;
    if (saved.notify === true) {
      try {
        const destination=new URL(webhook);destination.searchParams.set('wait','true');
        const response=await send(destination.href,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content:'새 문의가 접수되었습니다 · '+new Date(saved.receivedAt).toISOString(),flags:4,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(8000)});
        if(response.ok){const created=await response.json();alerted=typeof created?.id === 'string' && /^\d{1,20}$/.test(created.id);}
      } catch { /* The durable inquiry remains accepted even if the alert is uncertain. */ }
      try {await store.submit({action:'inquiry_alert',eventId:'contact',idempotencyKey:idempotencyKey.toLowerCase(),fingerprint,alerted});} catch { /* An unconfirmed alert remains visible to the operator. */ }
    }
    return json(200,{sent:true,id:saved.id});
  };
}

const settings={sheetsUrl:process.env.CONTACT_SHEETS_WEBAPP_URL,signingSecret:process.env.CONTACT_SHEETS_SIGNING_SECRET,hmacSecret:process.env.CONTACT_HMAC_SECRET};
const handleContact = createContactHandler({webhook:process.env.DISCORD_CONTACT_WEBHOOK_URL,settings,store:createSheetsStore(settings)});

export const config = {
  path: '/api/contact',
  rateLimit: { windowLimit: 3, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};

export default async function contact(request, context) {
  const headers = Object.fromEntries(request.headers);
  headers['x-nf-client-connection-ip'] = context.ip;
  const result = await handleContact({
    httpMethod: request.method, headers, body: request.method === 'POST' ? await request.text() : ''
  });
  return new Response(result.body, { status: result.statusCode, headers: result.headers });
}
