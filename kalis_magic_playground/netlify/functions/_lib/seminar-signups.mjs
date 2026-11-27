import { createHmac } from 'node:crypto';
import { isolatedTestMode } from './seminar-events.mjs';
import { quote } from '../../../seminar-signup/pricing.mjs';

export class SignupError extends Error {
  constructor(code, status = 400, details = {}) { super(code); this.status = status; this.details = details; }
}
const fail = () => { throw new SignupError('invalid_input'); };
const clean = (value, max, normalizeWhitespace = false) => {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) fail();
  const result = normalizeWhitespace ? value.trim().replace(/\s+/gu, ' ') : value.trim();
  if (!result || [...result].length > max) fail();
  return result;
};
export function validateSignup(body, eventId, now = new Date(), policy = null) {
  const keys = ['signupMode', 'linkageConsent', 'eventId', 'selection', 'name', 'contactType', 'contact', 'payerName', 'consent', 'consentVersion', 'idempotencyKey', 'quote', 'website', 'birthDate', 'gender', 'discovery', 'discoveryOther', 'reason', 'reasonOther', 'photoConsent', 'photoConsentVersion', ...(policy ? ['ageConfirmed','promotionConsent'] : ['ageConfirmed'])];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !keys.includes(k))) fail();
  if (Object.hasOwn(body, 'signupMode') && !['member','guest'].includes(body.signupMode)) fail();
  if (body.signupMode === 'member' ? body.linkageConsent !== true : Object.hasOwn(body,'linkageConsent')) fail();
  if (body.eventId !== eventId || body.consent !== true || body.photoConsent !== true || (body.website !== undefined && body.website !== '')) fail();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.idempotencyKey || '')) fail();
  const name = clean(body.name, 50);
  if (typeof body.contact !== 'string' || [...body.contact].length > 24) fail();
  let contact = clean(body.contact, 24);
  if (body.contactType !== 'phone') fail();
  contact = contact.replace(/[ -]/g, '');
  if (!/^01[016789]\d{7,8}$/.test(contact)) fail();
  if (policy?.minimumAge && body.ageConfirmed !== true) fail();
  if (policy && body.promotionConsent !== undefined && typeof body.promotionConsent !== 'boolean') fail();
  if (policy && !policy.splitPhotoConsent && body.promotionConsent !== true) fail();
  const legacyAgeRequired = eventId === 'daebeongae' && !(body.consentVersion === '2026-11-27-v1' && body.photoConsentVersion === '2026-11-27-v1');
  if (legacyAgeRequired && body.ageConfirmed !== true) fail();
  const birthDate = policy && !policy.requireBirthDate ? '' : (body.birthDate || '');
  const birth = typeof birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? new Date(birthDate + 'T00:00:00Z') : null;
  const today = new Date(new Date(now).getTime() + 9*60*60*1000).toISOString().slice(0,10);
  if (!(policy && !policy.requireBirthDate && !birthDate) && (!birth || !Number.isFinite(birth.getTime()) || birth.toISOString().slice(0,10) !== birthDate || birthDate < '0001-01-01' || birthDate > today)) fail();
  if (birthDate && (policy?.minimumAge || legacyAgeRequired)) {
    const cutoffYear = Number(today.slice(0, 4)) - (policy?.minimumAge || 14);
    if (birthDate > cutoffYear + today.slice(4)) fail();
  }
  const gender = policy && !policy.requireGender ? '' : (body.gender || '');
  if (!(policy && !policy.requireGender && !gender) && !['male','female'].includes(gender)) fail();
  const answer = (key, ids) => {
    if (policy && !policy[key === 'discovery' ? 'requireDiscovery' : 'requireReason'] && !body[key]) { if (body[key+'Other']) fail(); return ''; }
    if (!ids.includes(body[key])) fail();
    const other = body[key + 'Other'];
    if (body[key] === 'other') return clean(other, 100, true);
    if (other !== undefined && other !== '') fail();
    return '';
  };
  const discoveryOther = answer('discovery', ['instagram','youtube','referral','other']);
  const reasonOther = answer('reason', ['content','reviews','trust','other']);
  if (!Array.isArray(body.selection) || body.selection.length < 1 || body.selection.length > 5 || body.selection.some(x => typeof x !== 'string') || new Set(body.selection).size !== body.selection.length) fail();
  if (!body.quote || typeof body.quote !== 'object' || Array.isArray(body.quote) || Object.keys(body.quote).some(k => !['version', 'tier', 'total'].includes(k)) || !Number.isSafeInteger(body.quote.total) || typeof body.quote.version !== 'string' || typeof body.quote.tier !== 'string') fail();
  if (body.payerName !== undefined && typeof body.payerName !== 'string') fail();
  const payer = body.payerName ? clean(body.payerName, 50) : null;
  return { ...(!policy && Object.hasOwn(body,'ageConfirmed') ? {ageConfirmed:body.ageConfirmed === true} : {}), ...(policy ? {ageConfirmed:body.ageConfirmed === true,promotionConsent:body.promotionConsent === true} : {}), birthDate, gender, discovery:body.discovery || '', discoveryOther, reason:body.reason || '', reasonOther, consent:true, photoConsent:true, photoConsentVersion:clean(body.photoConsentVersion,100), eventId, selection: [...body.selection].sort(), name, contactType: body.contactType, contact, payerName: payer === name ? null : payer, consentVersion: clean(body.consentVersion, 100), idempotencyKey: body.idempotencyKey.toLowerCase(), quote: { version: body.quote.version, tier: body.quote.tier, total: body.quote.total } };
}
export function digest(secret, purpose, value) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new SignupError('service_unavailable', 503);
  return createHmac('sha256', secret).update(`${purpose}\0${value}`).digest('hex');
}
function safeReceipt(row, config) {
  if (!row || typeof row !== 'object' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id || '') || row.eventId !== config.id || !['pending','paid'].includes(row.status) || !Array.isArray(row.items) || !row.items.length || row.items.length > 5 || !Number.isSafeInteger(row.total) || row.total <= 0 || typeof row.payerName !== 'string' || !row.payerName.trim() || [...row.payerName].length > 50 || /[\u0000-\u001f\u007f]/.test(row.payerName)) throw new SignupError('service_unavailable',503);
  const ids = new Set();
  const items = row.items.map(item => {
    if (!item || !(config.id === 'cupsnballs' ? ['admission'] : ['bundle','special','lecture','show','meeting','open']).includes(item.id) || ids.has(item.id) || typeof item.label !== 'string' || item.label.length > 80 || /[\u0000-\u001f\u007f]/.test(item.label) || !Number.isSafeInteger(item.price) || item.price <= 0 || item.quantity !== 1) throw new SignupError('service_unavailable',503);
    ids.add(item.id);
    return {id:item.id,label:item.label,price:item.price,quantity:1};
  });
  const created = Date.parse(row.createdAt); const due = Date.parse(row.paymentDueAt);
  if (!Number.isFinite(created) || due-created !== 24*60*60*1000 || items.reduce((sum,item)=>sum+item.price,0) !== row.total) throw new SignupError('service_unavailable',503);
  const display = {};
  if (config.id === 'cupsnballs' && Object.hasOwn(row, 'displayReceiptNumber')) {
    const number = row.displayReceiptNumber;
    const minute = new Date(created + 9*60*60*1000).toISOString().slice(0,16).replace(/\D/g, '');
    if (typeof number !== 'string' || number.length !== 14 || !/^\d{12}(?:0[1-9]|[1-9]\d)$/.test(number) || number.slice(0,12) !== minute) {
      throw new SignupError('service_unavailable',503);
    }
    display.displayReceiptNumber = number;
  }
  return {test:isolatedTestMode(config),id:row.id,eventId:row.eventId,...display,items,total:row.total,status:row.status,createdAt:new Date(created).toISOString(),payerName:row.payerName,paymentDueAt:new Date(due).toISOString(),payment:{test:isolatedTestMode(config),bank:config.bank,account:config.account,holder:config.holder,contact:config.contact,deadline:new Date(due).toISOString()}};
}
export async function submitSignup(body, { offer, config, store, secret, ip, member = null, now = new Date() }) {
  // Historical notices may replay an existing request after policy switches.
  // New requests carrying an old notice are still atomically rejected below.
  const oldNotice = config.policy && body?.consentVersion !== offer.consentVersion;
  const validationPolicy = oldNotice ? {...config.policy,minimumAge:0,requireBirthDate:Boolean(body?.birthDate),requireGender:Boolean(body?.gender),requireDiscovery:false,requireReason:false,splitPhotoConsent:true} : config.policy;
  const input = validateSignup(body, offer.eventId, now, validationPolicy);
  if ((body.signupMode === 'member') !== Boolean(member)) throw new SignupError('auth_required',401);
  const fingerprint = digest(secret, 'request', JSON.stringify(member ? {input,memberId:member.id,linkageConsent:true} : input));
  if (!ip) throw new SignupError('service_unavailable',503);
  let priced;
  try { priced = quote(offer, input.selection); } catch { fail(); }
  let rejection = null;
  if (input.consentVersion !== offer.consentVersion || input.photoConsentVersion !== offer.photoConsentVersion) rejection = {error:'consent_changed'};
  else if (!offer.open) rejection = {error:'signup_closed'};
  else if (member && !offer.memberLinkageEnabled) rejection = {error:'member_unavailable'};
  else if (member?.agreementUnavailable) rejection = {error:'service_unavailable'};
  else if (member && !member.agreed) rejection = {error:'agreement_required'};
  else if (input.selection.some(id => !offer.available.includes(id))) rejection = {error:'option_unavailable'};
  else if (input.quote.version !== priced.version || input.quote.tier !== priced.tier || input.quote.total !== priced.total) rejection = {error:'price_changed',quote:priced,offer};
  // One signed operation lets the sheet check existing keys before any new-request rejection.
  const payload = {action:'submit',eventId:input.eventId,idempotencyKey:input.idempotencyKey,fingerprint,receivedAt:now.toISOString(),eligible:!rejection,rejection,
    record:{signupMode:member ? 'member' : 'guest', ...(member ? {memberId:member.id,linkageConsent:true,linkageConsentVersion:input.consentVersion,linkageConsentedAt:now.toISOString()} : {}),...(!config.policy && Object.hasOwn(input,'ageConfirmed') ? {ageConfirmed:input.ageConfirmed} : {}),...(config.policy ? {ageConfirmed:input.ageConfirmed,promotionConsent:input.promotionConsent} : {}),birthDate:input.birthDate,gender:input.gender,discovery:input.discovery,discoveryOther:input.discoveryOther,reason:input.reason,reasonOther:input.reasonOther,consent:true,photoConsent:true,photoConsentVersion:input.photoConsentVersion,photoConsentedAt:now.toISOString(),name:input.name,contactType:input.contactType,contact:input.contact,payerName:input.payerName,items:priced.items,total:priced.total,version:priced.version,tier:priced.tier,consentVersion:input.consentVersion,consentedAt:now.toISOString(),paymentDueAt:new Date(now.getTime()+24*60*60*1000).toISOString()},
    ipHash:digest(secret,'ip',ip),contactHash:digest(secret,'contact',`${input.eventId}:${input.contactType}:${input.contact}`),capacity:config.capacity,paymentDueHours:config.paymentDueHours};
  let result;
  try { result = await store.submit(payload); } catch { throw new SignupError('service_unavailable',503); }
  if (result?.ok === true) return {receipt:safeReceipt(result.receipt,config),newRowCount:result.newRowCount};
  const statuses = {service_unavailable:503,agreement_required:403,member_unavailable:403,signup_closed:403,consent_changed:409,option_unavailable:409,price_changed:409,idempotency_conflict:409,sold_out:409,rate_limited:429};
  const status = result?.ok === false && statuses[result.error];
  if (!status) throw new SignupError('service_unavailable',503);
  const details = {};
  if (result.error === 'price_changed') {
    if (rejection?.error !== 'price_changed') throw new SignupError('service_unavailable',503);
    // Return our trusted quote, never reflect arbitrary script response fields.
    details.quote = priced; details.offer = offer;
  }
  if (status === 429) details.retryAfter = Number.isSafeInteger(result.retryAfter) && result.retryAfter > 0 && result.retryAfter <= 3600 ? result.retryAfter : 600;
  throw new SignupError(result.error,status,details);
}
