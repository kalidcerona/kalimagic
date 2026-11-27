import { quote } from './pricing.mjs';
import { getCupsFormConfig } from './event-config.mjs';
const $ = (id) => document.getElementById(id);
const form = $('signup');
const money = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
let offer, noticeVersions, currentQuote, busy = false, pendingPrice = false, attempt, copyText = '';
let policy = getCupsFormConfig();
const closedState = () => offer?.availabilityState || (offer?.nextBoundary === null ? 'ended' : 'unavailable');
const closedButton = () => ({scheduled:'접수 준비 중',ended:'접수 마감',unavailable:'접수 대기'})[closedState()] || '접수 대기';
const selection = () => offer?.open && offer.available.includes('admission') ? ['admission'] : [];
function update() {
  $('unresolved-attempt').hidden = !attempt?.unresolved;
  $('check-original').disabled = busy;
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
  $('submit').disabled = !offer.open || busy || pendingPrice;
  $('submit').textContent = !offer.open ? closedButton() : busy ? '접수 확인 중' : '컵앤볼 신청하기';
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
  document.querySelector('main > .notice h2').textContent = offer.open ? '컵앤볼 신청 접수' : ({scheduled:'컵앤볼 신청 준비 중',ended:'컵앤볼 신청 마감',unavailable:'컵앤볼 신청 대기'})[closedState()];
  if (offer.promotionNotice) $('promotion-notice').textContent = offer.promotionNotice;
  if (offer.privacyNotice) $('privacy').textContent = offer.privacyNotice;
  if (offer.photoNotice) $('photo-notice').textContent = offer.photoNotice;
  if (offer.contact && !/\[|미정/.test(offer.contact)) $('operator-contact').textContent = `문의: ${offer.contact}`;
  $('availability').textContent = offer.open ? '지금 신청할 수 있어.\n참가권이랑 금액을 확인해줘.' : ({scheduled:'아직 접수 준비 중이야.\n신청이 열릴 때까지 입금은 기다려줘.',ended:'신청 기간이 끝났어.\n새로 신청하거나 입금하지 말아줘.',unavailable:'지금은 신청을 받지 않아.\n접수가 열릴 때까지 입금은 기다려줘.'})[closedState()];
  if (offer.test && offer.open) $('availability').textContent = '테스트 접수야. 입금하지 말아줘.';
  update();
  return changedNotices;
}
async function loadOffer() {
  $('retry').disabled = true;
  try {
    const response = await fetch('/api/seminars/offer?eventId=cupsnballs',{cache:'no-store'});
    if (!response.ok) throw new Error('offer');
    const data = await response.json(); return renderOffer(data.offer || data);
  } catch { offer = null; $('submit').disabled = true; $('availability').textContent = '가격을 불러오지 못했어.\n아직 접수 전이야.\n연결을 확인하고\n‘가격 다시 확인’을 눌러줘.'; }
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
form.addEventListener('change', () => {
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
});
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
  if (errors.length) return showErrors(errors);
  $('errors').hidden = true;
  const payload = {eventId:offer.eventId,selection:selection(),name,birthDate,gender,discovery,reason,...otherAnswers,contactType:'phone',contact,payerName:$('same-payer').checked?'':clean($('payer').value),ageConfirmed:$('age-confirmed').checked,promotionConsent:policy.photoConsentMode === 'split' ? $('promotion-consent').checked : $('photo-consent').checked,photoConsent:true,photoConsentVersion:offer.photoConsentVersion,consent:true,consentVersion:offer.consentVersion,quote:{version:currentQuote.version,tier:currentQuote.tier,total:currentQuote.total},website:$('website').value};
  // Match the server's normalization, without persisting personal data.
  payload.selection.sort();
  if (payload.payerName === payload.name) payload.payerName = '';
  const fingerprint = JSON.stringify(payload);
  if (attempt?.unresolved && attempt.fingerprint !== fingerprint) {
    showErrors([['check-original', '지난 신청 결과부터 확인해줘.\n바꾼 내용은 아직 제출되지 않았어.']]);
    return;
  }
  if (!attempt || attempt.fingerprint !== fingerprint) {
    attempt = {fingerprint, key:crypto.randomUUID(), payload, unresolved:false};
  }
  await sendAttempt(attempt);
});
async function sendAttempt(original) {
  if (busy) return;
  original.unresolved = true;
  busy = true;
  $('errors').hidden = true;
  update();
  const payload = {...original.payload, idempotencyKey:original.key};
  try {
    const response = await fetch('/api/seminars/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
    const data = await response.json();
    if (response.status === 409 && data.error === 'price_changed') {
      original.unresolved = false;
      renderOffer(data.offer); pendingPrice = true; attempt = null; $('price-change').hidden = false; $('accept-price').focus(); return;
    }
    if (response.status === 409 && ['consent_changed', 'option_unavailable'].includes(data.error)) {
      original.unresolved = false;
      const changedNotices = data.offer ? renderOffer(data.offer) : await loadOffer();
      const consentChanged = data.error === 'consent_changed';
      showErrors([[consentChanged ? (changedNotices?.[0] || 'consent') : 'retry', consentChanged
        ? '안내가 바뀌었어.\n새 촬영·개인정보 안내를 읽고\n다시 확인해줘.'
        : '참가권 판매 조건이 바뀌었어.\n아직 접수 전이야.\n가격을 다시 확인해줘.']]);
      return;
    }
    if (response.status === 409 && data.error === 'sold_out') {
      original.unresolved = false;
      offer.open = false;
      showResult('sold-out', '마감 안내로 건너뛰기');
      return;
    }
    if (!response.ok) {
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
    showReceipt(data.receipt, original.payload);
    original.unresolved = false;
  } catch { showErrors([['submit','연결이 끊겨 접수됐는지\n아직 모르겠어.\n적은 내용 그대로 다시 신청해줘.\n같은 신청은 한 번만 접수돼.']]); }
  finally { busy = false; update(); }
}
$('check-original').addEventListener('click', () => {
  if (attempt?.unresolved) sendAttempt(attempt);
});
function showResult(sectionId, linkText) {
  $('signup-banner').hidden = true;
  form.hidden = true;
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
function showReceipt(receipt, submitted) {
  const paid = receipt.status === 'paid';
  const payment = receipt.payment || {};
  const due = new Date(receipt.paymentDueAt || payment.deadline || '');
  const deadline = Number.isNaN(due.getTime()) ? '[입금 기한 미정]' : `${new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(due)} (KST)`;
  const rows = [['접수번호',receipt.id],['선택 내역',receipt.items.map((item)=>`${item.label} ${money(item.price)}`).join(', ')],[paid ? '입금 확인 금액' : '입금할 금액',money(receipt.total)],['은행',payment.bank || '[은행 미정]'],['계좌번호',payment.account || '[계좌번호 미정]'],['예금주',payment.holder || '[예금주 미정]'],['입금자명',receipt.payerName || submitted.payerName || submitted.name],['입금 기한',deadline],['문의',payment.contact || '[운영자 연락처 미정]']];
  const test = !payment.bank || !payment.account || !payment.holder || payment.test || /\[|미정|테스트/.test(`${payment.bank} ${payment.account} ${payment.holder}`);
  $('test-warning').hidden = !test;
  $('test-warning').textContent = test ? '테스트 접수야. 입금하지 말아줘.' : '';
  $('payment-message').textContent = test ? '아래에서 신청 내역을 확인해줘.' : paid
    ? '입금 확인했어. 형이 연락할게.' : '아래 계좌로 24시간 안에 입금해줘.';
  $('receipt').replaceChildren();
  for (const [label,value] of rows) { const dt=document.createElement('dt'),dd=document.createElement('dd'); dt.textContent=label; dd.textContent=value; $('receipt').append(dt,dd); }
  copyText = [test ? $('test-warning').textContent : $('payment-message').textContent,...rows.map(([key,value])=>`${key}: ${value}`)].join('\n');
  showResult('success', '신청 결과로 건너뛰기');
}
$('copy').addEventListener('click',async()=>{try { await navigator.clipboard.writeText(copyText); $('copy-status').textContent='입금 안내를 복사했어.'; } catch { $('copy-status').textContent='복사가 안 됐어.\n화면에서 입금 안내를\n직접 선택해서 복사해줘.'; }});
$('accept-price').addEventListener('click',()=>{pendingPrice=false; $('price-change').hidden=true; update(); $('submit').focus();});
$('retry').addEventListener('click',loadOffer);
loadOffer();
