import { createEntry } from './entry.mjs';
import { quote } from './pricing.mjs';
import { cupsDefinition, getCupsFormConfig } from './event-config.mjs';
const $ = (id) => document.getElementById(id);
const form = $('signup');
const money = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
const receiptKey = `seminar-receipt:${cupsDefinition.id}:${cupsDefinition.startsAt}`;
const receiptVersion = 1;
const receiptExpiry = Date.parse(cupsDefinition.endsAt);
let offer, noticeVersions, currentQuote, busy = false, pendingPrice = false, attempt, copyText = '';
let displayedReceipt, receiptWithoutStorage;
let policy = getCupsFormConfig();
const closedState = () => offer?.availabilityState || (offer?.nextBoundary === null ? 'ended' : 'unavailable');
const closedButton = () => ({scheduled:'접수 준비 중',ended:'접수 마감',unavailable:'접수 대기'})[closedState()] || '접수 대기';
const selection = () => offer?.open && offer.available.includes('admission') ? ['admission'] : [];
const entry = createEntry('cupsnballs', () => busy || Boolean(attempt?.unresolved));
function update() {
  entry.lock();
  $('unresolved-attempt').hidden = busy || !attempt?.unresolved;
  $('check-original').disabled = busy;
  const submit = $('submit');
  const progress = busy ? '신청 중...' : '';
  submit.disabled = !offer?.open || busy || pendingPrice;
  submit.textContent = progress || (offer?.open ? '컵앤볼 신청하기' : offer ? closedButton() : '접수 대기');
  submit.setAttribute('aria-busy', String(busy));
  if ($('submit-status').textContent !== progress) $('submit-status').textContent = progress;
  $('test-offer-warning').hidden = !(offer?.test && offer.open);
  if (!offer) return;
  try { currentQuote = quote(offer, selection()); } catch { currentQuote = null; }
  $('items').replaceChildren();
  for (const item of currentQuote?.items || []) {
    const row = document.createElement('li');
    row.textContent = item.label;
    $('items').append(row);
  }
  const total = currentQuote ? money(currentQuote.total) : '확인 중';
  if ($('total').textContent !== total) $('total').textContent = total;
}
function applyPolicy(next) {
  policy = {...getCupsFormConfig(), ...next.formConfig};
  $('age-section').hidden = !policy.minimumAge;
  $('age-confirmed').disabled = !policy.minimumAge;
  $('age-confirmed').required = Boolean(policy.minimumAge);
  $('age-label').textContent = `만 ${policy.minimumAge}세 이상입니다. (필수)`;
  for (const [section, required, controls] of [['birth-section',policy.requireBirthDate,[$('birth-date')]], ['gender-section',policy.requireGender,[...form.querySelectorAll('[name="gender"]')]]]) {
    $(section).hidden = !required;
    for (const control of controls) { control.disabled = !required; control.required = Boolean(required); if (!required) { control.value = control.type === 'date' ? '' : control.value; control.checked = false; } }
    $(section).querySelector('small').textContent = required ? '필수' : '선택';
  }
  for (const key of ['discovery', 'reason']) {
    const required = policy[key === 'discovery' ? 'requireDiscovery' : 'requireReason'];
    for (const input of form.querySelectorAll(`[name="${key}"]`)) input.required = required;
    $(`${key}-skip`).closest('.option').hidden = required;
    $(`${key}-skip`).disabled = required;
    if (required) $(`${key}-skip`).checked = false;
    $(`${key}-other`).closest('section').querySelector('small').textContent = required ? '필수' : '선택';
  }
  const split = policy.photoConsentMode === 'split';
  $('promotion-section').hidden = !split;
  $('promotion-consent').required = false;
  $('promotion-consent').disabled = !split || !next.open;
  if (!split) $('promotion-consent').checked = false;
  $('promotion-notice').textContent = '본인 얼굴이 나온 사진·영상을 행사 홍보에 활용하는 데 동의할 수 있습니다. 동의하지 않아도 신청할 수 있습니다.';
  $('seller-notice').textContent = policy.sellerNotice;
  $('photo-prompt').textContent = split ? '현장 촬영 안내를 확인하십시오.' : '현장 촬영과 사진·영상의\n행사 홍보 활용에 동의하십니까?';
  document.querySelector('label[for="photo-consent"]').textContent = split ? '현장 촬영 안내를 확인했습니다.' : '네';
}
function showPriceLoadError() {
  $('signup-banner').hidden = false;
  $('availability-title').textContent = '컵앤볼 신청 안내';
  $('availability').textContent = '가격을 불러오지 못했어.\n아직 접수 전이야.\n연결을 확인하고\n‘가격 다시 확인’을 눌러줘.';
  $('retry').hidden = false;
}
function renderOffer(next) {
  const changedNotices = [];
  const noticeText = (value) => value.trim().replace(/\s+/gu, ' ');
  if (noticeVersions) {
    for (const [control, version, text, notice] of [
      ['consent', 'consentVersion', 'privacyNotice', 'privacy'],
      ['photo-consent', 'photoConsentVersion', 'photoNotice', 'photo-notice'],
      ['promotion-consent', 'photoConsentVersion', 'promotionNotice', 'promotion-notice'],
    ]) {
      if (noticeVersions[version] !== next[version] || (typeof next[text] === 'string' && noticeText(next[text]) !== noticeText($(notice).textContent))) {
        $(control).checked = false;
        changedNotices.push(control);
      }
    }
  }
  if (offer && JSON.stringify(offer.formConfig) !== JSON.stringify(next.formConfig)) {
    for (const id of ['age-confirmed','consent','photo-consent','promotion-consent']) $(id).checked = false;
    changedNotices.push('consent');
  }
  $('consent').disabled = !next.open;
  $('photo-consent').disabled = !next.open;
  noticeVersions = {consentVersion:next.consentVersion, photoConsentVersion:next.photoConsentVersion};
  offer = next;
  applyPolicy(next);
  if (offer.promotionNotice) $('promotion-notice').textContent = offer.promotionNotice;
  if (offer.privacyNotice) $('privacy').textContent = offer.privacyNotice;
  if (offer.photoNotice) $('photo-notice').textContent = offer.photoNotice;
  if (offer.contact && !/\[|미정/.test(offer.contact)) $('operator-contact').textContent = `문의: ${offer.contact}`;
  $('retry').hidden = true;
  $('signup-banner').hidden = offer.open;
  if (!offer.open) {
    $('availability-title').textContent = ({scheduled:'컵앤볼 신청 준비 중',ended:'컵앤볼 신청 마감',unavailable:'컵앤볼 신청 대기'})[closedState()];
    $('availability').textContent = ({scheduled:'아직 접수 준비 중이야.\n신청이 열릴 때까지 입금은 기다려줘.',ended:'신청 기간이 끝났어.\n새로 신청하거나 입금하지 말아줘.',unavailable:'지금은 신청을 받지 않아.\n접수가 열릴 때까지 입금은 기다려줘.'})[closedState()];
  }
  update();
  if (offer.open && !currentQuote) showPriceLoadError();
  entry.render(offer.open && !currentQuote ? null : next);
  return changedNotices;
}
async function loadOffer() {
  $('retry').disabled = true;
  try {
    const response = await fetch('/api/seminars/offer?eventId=cupsnballs',{cache:'no-store'});
    if (!response.ok) throw new Error('offer');
    const data = await response.json();
    if ($('success').hidden) return renderOffer(data.offer || data);
  } catch {
    offer = null; entry.render(null);
    showPriceLoadError();
    update();
  }
  finally { $('retry').disabled = false; }
}
function clearError(control) {
  control.setAttribute('aria-invalid', 'false');
  const ids = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== 'errors');
  if (ids.length) control.setAttribute('aria-describedby', ids.join(' '));
  else control.removeAttribute('aria-describedby');
}
function showErrors(errors) {
  form.querySelectorAll('[aria-invalid="true"]').forEach(clearError);
  $('errors').replaceChildren();
  $('errors').hidden = false;
  for (const [id, message] of errors) {
    const control = $(id);
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.textContent = message;
    link.addEventListener('click', (event) => { event.preventDefault(); control.focus(); });
    $('errors').append(link);
    control.setAttribute('aria-invalid', 'true');
    const ids = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    ids.add('errors');
    control.setAttribute('aria-describedby', [...ids].join(' '));
  }
  ($(errors[0][0]).disabled ? $('errors') : $(errors[0][0])).focus();
}
form.addEventListener('input', (event) => {
  const control = event.target;
  if (control.getAttribute('aria-invalid') !== 'true') return;
  clearError(control);
  const errors = $('errors');
  for (const link of errors.querySelectorAll('a')) {
    if (link.hash === '#' + control.id) link.remove();
  }
  if (!errors.textContent) errors.hidden = true;
});
function syncConditionalFields() {
  for (const key of ['discovery', 'reason']) {
    const other = $(`${key}-other`).checked;
    $(`${key}-other-field`).hidden = !other;
    $(`${key}-other-text`).disabled = !other;
    $(`${key}-other-text`).required = other;
    if (!other) { $(`${key}-other-text`).value = ''; clearError($(`${key}-other-text`)); }
  }
  $('payer-field').hidden = $('same-payer').checked;
  $('payer').disabled = $('same-payer').checked; $('payer').required = !$('same-payer').checked;
  update();
}
form.addEventListener('change', syncConditionalFields);
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (form.hidden || busy || !offer?.open || pendingPrice) return;
  const errors = [];
  const clean = (value) => value.trim();
  const hasControls = (value) => /[\u0000-\u001f\u007f]/u.test(value);
  const validText = (value, max) => [...value].length >= 1 && [...value].length <= max && !hasControls(value);
  const name = clean($('name').value);
  if (hasControls($('name').value) || !validText(name, 50)) errors.push(['name','이름을 1-50자로 적어줘.']);
  const birthDate = !policy.requireBirthDate ? '' : $('birth-date').value;
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date = new Date(`${birthDate}T00:00:00Z`);
  if ((policy.requireBirthDate || birthDate) && (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== birthDate || birthDate > today || birthDate.slice(0,4) === '0000')) errors.push(['birth-date','생년월일을\n오늘까지의 실제 날짜로 적어줘.']);
  if (policy.minimumAge && birthDate && !Number.isNaN(date.getTime())) {
    const cutoff = `${Number(today.slice(0,4)) - policy.minimumAge}${today.slice(4)}`;
    if (birthDate > cutoff) errors.push(['birth-date',`만 ${policy.minimumAge}세 미만은\n보호자 문의 후 동의 절차를\n완료해야 합니다.`]);
  }
  const chosen = (key) => form.querySelector(`input[name="${key}"]:checked`)?.value;
  const gender = !policy.requireGender ? '' : (chosen('gender') || '');
  if (policy.requireGender && !gender) errors.push(['gender-male','성별을 골라줘.']);
  const contact = $('contact').value.trim().replace(/[ -]/g,'');
  if ([...$('contact').value].length > 24 || hasControls($('contact').value) || !/^01[016789]\d{7,8}$/.test(contact)) errors.push(['contact','올바른 국내 휴대전화 번호를 적어줘.']);
  const discovery = chosen('discovery') || '', reason = chosen('reason') || '';
  const otherAnswers = {};
  for (const [key, value, first] of [['discovery',discovery,'instagram'],['reason',reason,'content']]) {
    if (!value && (policy[key === 'discovery' ? 'requireDiscovery' : 'requireReason'])) errors.push([`${key}-${first}`, key === 'discovery' ? '이 수업을 처음 알게 된\n경로를 골라줘.' : '컵앤볼 수업의 신청 이유를 골라줘.']);
    if (value === 'other') {
      otherAnswers[`${key}Other`] = clean($(`${key}-other-text`).value).replace(/\s+/gu, ' ');
      if (hasControls($(`${key}-other-text`).value) || !validText(otherAnswers[`${key}Other`],100)) errors.push([`${key}-other-text`,'기타 답변을 1-100자로 적어줘.']);
    }
  }
  if (!currentQuote) errors.push(['retry','참가권 가격을 다시 확인해줘.']);
  if (policy.minimumAge && !$('age-confirmed').checked) errors.push(['age-confirmed','연령 안내를 확인해줘.']);
  if (!$('same-payer').checked && (hasControls($('payer').value) || !validText(clean($('payer').value),50))) errors.push(['payer','입금자명을 1-50자로 적어줘.']);
  if (!$('photo-consent').checked) errors.push(['photo-consent','촬영 안내를 읽고 확인해줘.']);
  if (!$('consent').checked) errors.push(['consent','개인정보 안내를 읽고 동의해줘.']);
  if (entry.needsConsent) errors.push(['linkage-consent','회원 식별자 보관에 동의하거나 비회원으로 계속해 주세요.']);
  if (errors.length) return showErrors(errors);
  $('errors').hidden = true;
  const payload = {...entry.fields,eventId:offer.eventId,selection:selection(),name,birthDate,gender,discovery,reason,...otherAnswers,contactType:'phone',contact,payerName:$('same-payer').checked?'':clean($('payer').value),ageConfirmed:$('age-confirmed').checked,promotionConsent:policy.photoConsentMode === 'split' ? $('promotion-consent').checked : $('photo-consent').checked,photoConsent:true,photoConsentVersion:offer.photoConsentVersion,consent:true,consentVersion:offer.consentVersion,quote:{version:currentQuote.version,tier:currentQuote.tier,total:currentQuote.total},website:$('website').value};
  // Match the server's normalization before binding the retry key.
  payload.selection.sort();
  if (payload.payerName === payload.name) payload.payerName = '';
  const fingerprint = JSON.stringify(payload);
  if (attempt?.unresolved && attempt.fingerprint !== fingerprint) {
    showErrors([['check-original', '지난 신청 결과부터 확인해줘.\n바꾼 내용은 아직 제출되지 않았어.']]);
    return;
  }
  if (!attempt || attempt.fingerprint !== fingerprint) {
    attempt = {account:entry.account, fingerprint, key:crypto.randomUUID(), payload, unresolved:false};
  }
  await sendAttempt(attempt);
});
async function sendAttempt(original) {
  if (busy) return;
  const wasUnresolved = original.unresolved;
  busy = true;
  $('recovery-check').disabled = $('recovery-login').disabled = true;
  $('errors').hidden = true;
  update();
  const payload = {...original.payload, idempotencyKey:original.key};
  try {
    let headers;
    try {
      headers = await entry.headers(original.account, original.renewAgreement);
      original.renewAgreement = false;
    }
    catch (error) {
      original.unresolved = wasUnresolved;
      if (!wasUnresolved && error.message !== 'agreement_required') {
        attempt = null;
        entry.authFailed(original.payload);
        return;
      }
      if (wasUnresolved) {
        original.unresolved = true;
        entry.showRecovery('원래 계정으로 로그인한 뒤 신청 결과를 다시 확인해 주세요.');
        return;
      }
      showErrors([['submit',error.message === 'agreement_required'
        ? '약관 동의를 확인하지 못했습니다. 다시 신청하여 동의를 확인해 주세요.'
        : '원래 신청 계정으로 다시 로그인한 뒤 접수 결과를 확인해 주세요.']]);
      return;
    }
    try { entry.remember(original); }
    catch {
      original.unresolved = wasUnresolved;
      if (entry.recovering) { entry.showRecovery('복구 정보를 보관할 수 없습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.'); return; }
      showErrors([['submit','이 탭에 복구 정보를 보관할 수 없습니다. 브라우저 저장 공간을 허용한 뒤 다시 신청해 주세요.']]);
      return;
    }
    original.unresolved = true;
    const response = await fetch('/api/seminars/signup',{method:'POST',headers,body:JSON.stringify(payload),cache:'no-store'});
    const data = await response.json();
    if (entry.keepUnknown(original,response,data.error,wasUnresolved)) return;
    const authError = original.account && (response.status === 401 || data.error === 'agreement_required');
    if (entry.recovering && !response.ok && (authError || response.status >= 500)) {
      original.renewAgreement = data.error === 'agreement_required';
      entry.remember(original);
      entry.showRecovery(authError ? '원래 계정과 약관을 확인한 뒤 다시 시도해 주세요.' : '접수 결과를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.');
      return;
    }
    if (entry.recovering && !response.ok) {
      if (!offer) await loadOffer();
      entry.resumeForm(original);
      if (offer) entry.render(offer);
    }
    if (response.status === 409 && data.error === 'price_changed') {
      original.unresolved = false;
      renderOffer(data.offer); pendingPrice = true; attempt = null; $('price-change').hidden = false; $('accept-price').focus(); return;
    }
    if (response.status === 409 && ['consent_changed', 'option_unavailable'].includes(data.error)) {
      original.unresolved = false;
      const changedNotices = data.offer ? renderOffer(data.offer) : await loadOffer();
      const consentChanged = data.error === 'consent_changed';
      showErrors([[consentChanged ? (changedNotices?.[0] || 'consent') : 'submit', consentChanged
        ? '안내가 바뀌었어.\n새 촬영·개인정보 안내를 읽고\n다시 확인해줘.'
        : '참가권 판매 조건이 바뀌었어.\n아직 접수 전이야.\n바뀐 신청 안내를 확인해줘.']]);
      return;
    }
    if (response.status === 409 && data.error === 'sold_out') {
      original.unresolved = false;
      if (offer) offer.open = false;
      showResult('sold-out', '마감 안내로 건너뛰기');
      return;
    }
    if (!response.ok) {
      if (authError) {
        if (response.status === 401) {
          if (!wasUnresolved) {
            original.unresolved = false;
            attempt = null;
            entry.authFailed(original.payload);
            return;
          }
          entry.showRecovery('로그인이 만료되었습니다. 원래 구글 계정으로 다시 로그인해 주세요.');
          return;
        }
        original.unresolved = wasUnresolved;
        original.renewAgreement = data.error === 'agreement_required';
        showErrors([['submit', original.renewAgreement ? '약관 확인이 필요합니다. 다시 신청하면 회원 동의를 확인합니다.' : '회원 계정을 확인한 뒤 다시 신청해 주세요.']]);
        return;
      }
      if ([400, 403, 429].includes(response.status)) original.unresolved = false;
      if (data.error === 'signup_closed') {
        const availabilityState = data.availabilityState === 'ended' ? 'ended' : 'unavailable';
        renderOffer({...offer, open:false, availabilityState});
        $('errors').textContent = closedButton() + ' 상태야.\n이번 신청은 저장되지 않았어.';
        $('errors').hidden = false;
        $('errors').focus();
        return;
      }
      const message = response.status === 429 ? `지금 신청이 몰리고 있어.\n이번 신청은 저장되지 않았어.\n${data.retryAfter || 600}초 뒤에 다시 신청해줘.` : response.status === 503 ? '아직 접수 결과를 확인하지 못했어.\n잠시 후 다시 신청하면\n지난 결과를 확인할 수 있어.' : '접수를 확인하지 못했어.\n적은 내용을 보고 다시 신청해줘.';
      showErrors([['submit',message]]); return;
    }
    const receipt = receiptSnapshot(data.receipt);
    if (!receipt) throw new Error('receipt');
    saveReceipt(receipt);
    showReceipt(receipt);
    original.unresolved = false;
    attempt = null;
  } catch { if (entry.recovering) entry.showRecovery('연결이 끊겼습니다. 원래 신청 결과를 다시 확인해 주세요.');
    else showErrors([['submit','연결이 끊겨 접수됐는지\n아직 모르겠어.\n적은 내용 그대로 다시 신청해줘.\n같은 신청은 한 번만 접수돼.']]); }
  finally {
    if (!original.unresolved) {
      entry.forget();
      entry.finishRecovery();
    }
    busy = false;
    $('recovery-check').disabled = $('recovery-login').disabled = false;
    update();
  }
}
$('recovery-check').onclick = () => { if (attempt?.unresolved) sendAttempt(attempt); };
$('check-original').addEventListener('click', () => {
  if (attempt?.unresolved) sendAttempt(attempt);
});
function showResult(sectionId, linkText) {
  $('signup-banner').hidden = true;
  form.hidden = true;
  $('entry-choice').hidden = true;
  $(sectionId).hidden = false;
  const heading = $(sectionId + '-title');
  const skip = document.querySelector('.skip');
  skip.hash = heading.id;
  skip.textContent = linkText;
  if (sectionId === 'success') {
    $('signup-header').hidden = true;
    heading.focus({preventScroll:true});
    window.scrollTo(0, 0);
  } else {
    heading.focus();
  }
}
function receiptSnapshot(receipt) {
  if (receipt?.eventId !== cupsDefinition.id || !['pending','paid'].includes(receipt.status)) return null;
  const {displayReceiptNumber, id, payerName, total, items} = receipt;
  if (typeof receipt.createdAt !== 'string' || typeof receipt.paymentDueAt !== 'string' ||
      !receipt.payment || typeof receipt.payment !== 'object' || Array.isArray(receipt.payment)) return null;
  const created = Date.parse(receipt.createdAt);
  const due = Date.parse(receipt.paymentDueAt);
  if (!Number.isFinite(created) || due - created !== 86400000) return null;
  if (Object.hasOwn(receipt, 'displayReceiptNumber')) {
    const minute = new Date(created + 9*60*60*1000).toISOString().slice(0,16).replace(/\D/g, '');
    if (typeof displayReceiptNumber !== 'string' || displayReceiptNumber.length !== 14 ||
        !/^\d{12}(?:0[1-9]|[1-9]\d)$/.test(displayReceiptNumber) || displayReceiptNumber.slice(0,12) !== minute) return null;
  } else if (typeof id !== 'string' || id.length !== 36 ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null;

  const validText = (value, max) => typeof value === 'string' &&
    value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
  if (!validText(payerName, 100) || !payerName.trim() || [...payerName].length > 50 ||
      !Number.isSafeInteger(total) || total <= 0 || !Array.isArray(items) || items.length !== 1) return null;
  const [item] = items;
  if (!item || !validText(item.label, 80) || !item.label.trim() || item.price !== total) return null;
  const payment = {};
  for (const key of ['bank','account','holder','contact']) {
    const value = receipt.payment?.[key] ?? '';
    if (!validText(value, 300)) return null;
    payment[key] = value;
  }
  const test = receipt.test === true || receipt.payment?.test === true ||
    !payment.bank || !payment.account || !payment.holder ||
    /\[|미정|테스트/.test(`${payment.bank} ${payment.account} ${payment.holder}`);
  return {
    eventId:receipt.eventId, ...(displayReceiptNumber ? {displayReceiptNumber} : {id}),
    status:receipt.status, createdAt:new Date(created).toISOString(), paymentDueAt:new Date(due).toISOString(),
    items:[{label:item.label,price:item.price}], total, payerName, payment, test
  };
}
function clearStoredReceipt() {
  receiptWithoutStorage = null;
  try { sessionStorage.removeItem(receiptKey); } catch { /* Storage may be blocked. */ }
}
function saveReceipt(receipt) {
  clearStoredReceipt();
  if (Date.now() >= receiptExpiry) return;
  try {
    sessionStorage.setItem(receiptKey, JSON.stringify({version:receiptVersion, receipt}));
  } catch {
    // Keep the current document usable even if storage is blocked or full.
    receiptWithoutStorage = receipt;
  }
}
// Stored v1 records must match the snapshot writer, including empty payment
// strings on test receipts. Server compatibility defaults apply only on intake.
function matchesSnapshot(value, snapshot) {
  if (value === snapshot) return true;
  if (!value || !snapshot || typeof value !== 'object' || typeof snapshot !== 'object' ||
      Array.isArray(value) !== Array.isArray(snapshot)) return false;
  const keys = Object.keys(snapshot);
  return Object.keys(value).length === keys.length && keys.every(key =>
    Object.hasOwn(value, key) && matchesSnapshot(value[key], snapshot[key]));
}
function readReceipt() {
  if (Date.now() < receiptExpiry) {
    if (receiptWithoutStorage) return receiptWithoutStorage;
    try {
      const stored = sessionStorage.getItem(receiptKey);
      if (stored === null) return null;
      const saved = JSON.parse(stored);
      const receipt = saved?.version === receiptVersion && receiptSnapshot(saved.receipt);
      if (receipt && matchesSnapshot(saved, {version:receiptVersion, receipt})) return receipt;
    } catch { /* Storage may be unavailable, or the record may be invalid. */ }
  }
  clearStoredReceipt();
  return null;
}
function showReceipt(receipt, restored = false) {
  displayedReceipt = receipt;
  const paid = receipt.status === 'paid';
  const {payment, test} = receipt;
  const due = new Date(receipt.paymentDueAt);
  const deadline = `${new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(due)} (KST)`;
  const number = receipt.displayReceiptNumber || receipt.id;
  const amountLabel = paid ? '입금 확인 금액' : '입금할 금액';
  const amount = money(receipt.total);
  const selectionText = receipt.items.map(item => `${item.label} ${money(item.price)}`).join(', ');
  const rows = [
    ['선택 내역',selectionText], ['은행',payment.bank || '[은행 미정]',true],
    ['계좌번호',payment.account || '[계좌번호 미정]'], ['예금주',payment.holder || '[예금주 미정]'],
    ['입금자명',receipt.payerName], ['입금 기한',deadline,true], ['문의',payment.contact || '[운영자 연락처 미정]']
  ];
  const warning = '테스트 접수야. 입금하지 말아줘.';
  const pastDue = Date.now() >= due.getTime();
  const expiredNotice = '안내된 입금 기한은 지났어.';
  let message = '아래 계좌로 24시간 안에 입금해줘.';
  if (test) message = '아래에서 신청 내역을 확인해줘.';
  else if (paid) message = restored ? '접수 당시 입금 확인 상태였어.' : '입금 확인했어. 형이 연락할게.';
  else if (pastDue) message = '입금 기한이 지났어.\n입금 전에 형에게 문의해줘.';

  $('display-receipt-number').textContent = number;
  $('payment-amount-label').textContent = amountLabel;
  $('payment-amount').textContent = amount;
  $('test-warning').hidden = !test;
  $('test-warning').textContent = test ? warning : '';
  $('payment-message').textContent = message;
  $('restored-notice').hidden = !restored;
  $('restored-notice').textContent = restored
    ? ['접수 당시 안내야.', ...(pastDue && (paid || test) ? [expiredNotice] : [])].join('\n') : '';
  $('receipt').replaceChildren();
  for (const [label,value,ruled] of rows) {
    const row = document.createElement('div');
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    if (ruled) row.className = 'ruled';
    row.append(dt,dd);
    $('receipt').append(row);
  }
  const copyRows = [['접수번호',number], rows[0], [amountLabel,amount], ...rows.slice(1)];
  copyText = [
    test ? warning : message,
    ...(pastDue && (paid || test) ? [expiredNotice] : []),
    ...copyRows.map(([key,value]) => `${key}: ${value}`)
  ].join('\n');
  $('copy-status').textContent = '';
  showResult('success', '신청 결과로 건너뛰기');
}
function showForm() {
  $('success').hidden = true;
  $('signup-header').hidden = false;
  form.hidden = true;
  const skip = document.querySelector('.skip');
  skip.hash = form.id;
  skip.textContent = '신청서로 건너뛰기';
}
function startNewSignup() {
  entry.reset();
  clearStoredReceipt();
  displayedReceipt = null;
  copyText = '';
  $('receipt').replaceChildren();
  for (const id of ['display-receipt-number','payment-amount','copy-status']) $(id).textContent = '';
  offer = noticeVersions = currentQuote = attempt = null;
  pendingPrice = false;
  $('price-change').hidden = true;
  $('errors').hidden = true;
  $('errors').replaceChildren();
  form.querySelectorAll('[aria-invalid="true"]').forEach(clearError);
  form.reset();
  form.querySelectorAll('details[open]').forEach(details => { details.open = false; });
  syncConditionalFields();
  for (const id of ['consent','photo-consent','promotion-consent','submit']) $(id).disabled = true;
  $('submit').textContent = '접수 준비 중';
  $('items').replaceChildren();
  $('total').textContent = '확인 중';
  showForm();
  $('name').focus();
  loadOffer();
}
$('copy').addEventListener('click',async()=>{try { await navigator.clipboard.writeText(copyText); $('copy-status').textContent='입금 안내를 복사했어.'; } catch { $('copy-status').textContent='복사가 안 됐어.\n화면에서 입금 안내를\n직접 선택해서 복사해줘.'; }});
$('new-signup').addEventListener('click', startNewSignup);
$('accept-price').addEventListener('click',()=>{pendingPrice=false; $('price-change').hidden=true; update(); $('submit').focus();});
$('retry').addEventListener('click',loadOffer);
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  const saved = readReceipt();
  if (saved) showReceipt(saved, true);
  else if (displayedReceipt) startNewSignup();
});
const saved = readReceipt();
if (saved) { entry.cleanCallback(); entry.forget(); showReceipt(saved, true); }
else {
  showForm();
  attempt = entry.restore();
  loadOffer();
}
