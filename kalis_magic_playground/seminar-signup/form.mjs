import { createEntry } from './entry.mjs';
import { quote } from './pricing.mjs';
const $ = (id) => document.getElementById(id);
const form = $('signup');
const money = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
let offer, noticeVersions, currentQuote, busy = false, pendingPrice = false, attempt, copyText = '';
const labels = { special:'특별 렉쳐', lecture:'렉쳐', show:'공연', meeting:'본모임' };
const selection = () => [ ...($('bundle').checked ? ['bundle'] : [...document.querySelectorAll('#singles input:checked')].map((input) => input.value)), ...($('open').checked ? ['open'] : []) ];
const entry = createEntry('daebeongae', () => busy || Boolean(attempt?.unresolved));
function update() {
  entry.lock();
  $('unresolved-attempt').hidden = !attempt?.unresolved;
  $('check-original').disabled = busy;
  if (!offer) return;
  const single = $('single').checked;
  for (const input of document.querySelectorAll('#singles input')) {
    input.disabled = !single || (offer.open && !offer.available.includes(input.value));
    if (offer.open && !offer.available.includes(input.value)) input.checked = false;
    if (!single) input.checked = false;
  }
  try { currentQuote = quote(offer, selection()); } catch { currentQuote = null; }
  $('items').replaceChildren();
  for (const item of currentQuote?.items || []) {
    const row = document.createElement('li');
    const name = document.createElement('span'); name.textContent = item.label;
    const price = document.createElement('strong'); price.className = 'money'; price.textContent = money(item.price);
    row.append(name, price); $('items').append(row);
  }
  $('total').textContent = currentQuote ? money(currentQuote.total) : '이용권을 선택하십시오';
  $('selection-total').textContent = $('total').textContent;
  $('quote-status').textContent = currentQuote ? `입금할 금액 ${money(currentQuote.total)}` : '이용권을 선택하십시오';
  const cheaper = single && (!offer.open || offer.available.includes('bundle')) && currentQuote && currentQuote.total - ($('open').checked ? offer.prices.open : 0) > offer.prices.bundle;
  $('saving').hidden = !cheaper;
  $('saving').textContent = `통합권 ${money(offer.prices.bundle)}이 더 저렴합니다. 원하시면 통합권을 선택하십시오.`;
  $('submit').disabled = !offer.open || busy || pendingPrice;
  $('submit').textContent = !offer.open ? '접수 준비 중' : busy ? '접수 확인 중' : '신청하기';
}
function renderOffer(next) {
  const changedNotices = [];
  const noticeText = (value) => value.trim().replace(/\s+/gu, ' ');
  if (noticeVersions) {
    for (const [control, version, text, notice] of [
      ['consent', 'consentVersion', 'privacyNotice', 'privacy'],
      ['photo-consent', 'photoConsentVersion', 'photoNotice', 'photo-notice'],
    ]) {
      if (noticeVersions[version] !== next[version] || (typeof next[text] === 'string' && noticeText(next[text]) !== noticeText($(notice).textContent))) {
        $(control).checked = false;
        changedNotices.push(control);
      }
    }
  }
  $('consent').disabled = !next.open;
  $('photo-consent').disabled = !next.open;
  noticeVersions = {consentVersion:next.consentVersion, photoConsentVersion:next.photoConsentVersion};
  offer = next;
  $('bundle-label').textContent = offer.bundleLabel || '통합권';
  $('bundle-price').textContent = money(offer.prices.bundle);
  $('open-price').textContent = money(offer.prices.open);
  $('bundle').disabled = offer.open && !offer.available.includes('bundle');
  $('open').disabled = offer.open && !offer.available.includes('open');
  if ($('bundle').disabled) { $('bundle').checked = false; $('single').checked = true; }
  if ($('open').disabled) $('open').checked = false;
  const checked = selection(); $('singles').replaceChildren();
  for (const [id,label] of Object.entries(labels)) {
    const row = document.createElement('div'); row.className = 'option';
    const input = document.createElement('input'); Object.assign(input,{id:`ticket-${id}`,name:'selection',type:'checkbox',value:id,checked:checked.includes(id)});
    const text = document.createElement('label'); text.htmlFor = input.id;
    const name = document.createElement('span'); name.textContent = label + (offer.available.includes(id) ? '' : ' · 판매 보류');
    const price = document.createElement('strong'); price.className = 'money'; price.textContent = money(offer.prices[id]);
    text.append(name,price); row.append(input,text); $('singles').append(row);
  }
  document.querySelector('main > .notice h2').textContent = offer.open ? '대번개 신청 접수' : '12월 15일 오전 10시 신청 오픈';
  if (offer.privacyNotice) $('privacy').textContent = offer.privacyNotice;
  if (offer.photoNotice) $('photo-notice').textContent = offer.photoNotice;
  if (offer.contact) for (const id of ['operator-contact', 'photo-contact']) $(id).textContent = `문의: ${offer.contact}`;
  $('availability').textContent = offer.open ? '신청을 받고 있습니다. 선택 내역과 금액을 확인하십시오.' : '접수를 준비하고 있습니다. 아직 신청하거나 송금하지 마십시오.';
  if (offer.test && offer.open) $('availability').textContent = '테스트 접수입니다. 송금하지 마십시오.';
  update();
  entry.render(next);
  return changedNotices;
}
async function loadOffer() {
  $('retry').disabled = true;
  try {
    const response = await fetch('/api/seminars/offer?eventId=daebeongae',{cache:'no-store'});
    if (!response.ok) throw new Error('offer');
    const data = await response.json();
    if ($('success').hidden && $('sold-out').hidden) return renderOffer(data.offer || data);
  } catch { offer = null; entry.render(null); $('submit').disabled = true; $('availability').textContent = '가격을 불러오지 못했습니다. 아직 접수되지 않았습니다. 연결 상태를 확인한 후 가격 다시 확인을 누르십시오.'; }
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
  if (event.target.getAttribute('aria-invalid') === 'true') clearError(event.target);
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
  if (hasControls($('name').value) || !validText(name, 50)) errors.push(['name','이름을 1-50자로 입력하십시오.']);
  const birthDate = $('birth-date').value;
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date = new Date(`${birthDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== birthDate || birthDate > today || birthDate.slice(0,4) === '0000') errors.push(['birth-date','생년월일을 오늘까지의 실제 날짜로 입력하십시오.']);
  if (!Number.isNaN(date.getTime()) && birthDate > `${Number(today.slice(0,4))-14}${today.slice(4)}`) errors.push(['birth-date','만 14세 미만은 보호자 문의 후 동의 절차를 완료해야 합니다.']);
  if (!$('age-confirmed').checked) errors.push(['age-confirmed','만 14세 이상인지 확인하십시오.']);
  const chosen = (key) => form.querySelector(`input[name="${key}"]:checked`)?.value;
  const gender = chosen('gender');
  if (!gender) errors.push(['gender-male','성별을 선택하십시오.']);
  const contact = $('contact').value.trim().replace(/[ -]/g,'');
  if ([...$('contact').value].length > 24 || hasControls($('contact').value) || !/^01[016789]\d{7,8}$/.test(contact)) errors.push(['contact','올바른 국내 휴대전화 번호를 입력하십시오.']);
  const discovery = chosen('discovery'), reason = chosen('reason');
  const otherAnswers = {};
  for (const [key, value, first] of [['discovery',discovery,'instagram'],['reason',reason,'content']]) {
    if (!value) errors.push([`${key}-${first}`, key === 'discovery' ? '운영자를 처음 알게 된 경로를 선택하십시오.' : '신청 이유를 선택하십시오.']);
    if (value === 'other') {
      otherAnswers[`${key}Other`] = clean($(`${key}-other-text`).value).replace(/\s+/gu, ' ');
      if (hasControls($(`${key}-other-text`).value) || !validText(otherAnswers[`${key}Other`],100)) errors.push([`${key}-other-text`,'기타 답변을 1-100자로 입력하십시오.']);
    }
  }
  if (!currentQuote) errors.push(['single','이용권을 한 종류 이상 선택하십시오.']);
  if (!chosen('openSession')) errors.push(['open-no','오픈 세션 참여 여부를 선택하십시오.']);
  if (!$('same-payer').checked && (hasControls($('payer').value) || !validText(clean($('payer').value),50))) errors.push(['payer','입금자명을 1-50자로 입력하십시오.']);
  if (!$('photo-consent').checked) errors.push(['photo-consent','촬영 안내를 읽고 확인하십시오.']);
  if (!$('consent').checked) errors.push(['consent','개인정보 안내를 읽고 동의하십시오.']);
  if (entry.needsConsent) errors.push(['linkage-consent','회원 식별자 보관에 동의하거나 비회원으로 계속해 주세요.']);
  if (errors.length) return showErrors(errors);
  $('errors').hidden = true;
  const payload = {...entry.fields,ageConfirmed:$('age-confirmed').checked,eventId:offer.eventId,selection:selection(),name,birthDate,gender,discovery,reason,...otherAnswers,contactType:'phone',contact,payerName:$('same-payer').checked?'':clean($('payer').value),photoConsent:true,photoConsentVersion:offer.photoConsentVersion,consent:true,consentVersion:offer.consentVersion,quote:{version:currentQuote.version,tier:currentQuote.tier,total:currentQuote.total},website:$('website').value};
  // Match the server's normalization before binding the retry key.
  payload.selection.sort();
  if (payload.payerName === payload.name) payload.payerName = '';
  const fingerprint = JSON.stringify(payload);
  if (attempt?.unresolved && attempt.fingerprint !== fingerprint) {
    showErrors([['check-original', '이전 신청 결과를 먼저 확인하십시오. 변경한 내용은 아직 제출되지 않았습니다.']]);
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
      showErrors([[consentChanged ? (changedNotices?.[0] || 'consent') : 'single', consentChanged
        ? '안내가 변경되었습니다. 새 촬영·개인정보 안내를 읽고 다시 확인하십시오.'
        : '선택한 이용권의 판매 조건이 변경되었습니다. 아직 접수되지 않았습니다. 새 내역을 확인하고 다시 선택하십시오.']]);
      return;
    }
    if (response.status === 409 && data.error === 'sold_out') {
      original.unresolved = false;
      if (offer) offer.open = false;
      $('signup-banner').hidden = true;
      form.hidden = true;
      $('sold-out').hidden = false;
      $('sold-out-title').focus();
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
      const message = response.status === 429 ? `신청 요청이 많습니다. 이번 요청은 저장되지 않았습니다. ${data.retryAfter || 600}초 후 다시 시도하십시오.` : response.status === 503 ? '접수 결과를 아직 확인하지 못했습니다. 잠시 후 다시 신청하면 기존 요청의 접수 결과를 확인합니다.' : data.error === 'signup_closed' ? '현재 접수할 수 없습니다. 이번 신청은 저장되지 않았습니다. 행사 안내를 확인하십시오.' : '접수를 확인하지 못했습니다. 입력 내용을 확인하고 다시 신청하십시오.';
      if (data.error === 'signup_closed') {
        if (offer) offer.open = false;
        $('availability').textContent = '현재 신청 접수가 종료되었습니다.';
        $('submit').disabled = true;
      }
      showErrors([['submit',message]]); return;
    }
    showReceipt(data.receipt);
    original.unresolved = false;
  } catch { if (entry.recovering) entry.showRecovery('연결이 끊겼습니다. 원래 신청 결과를 다시 확인해 주세요.');
    else showErrors([['submit','연결이 끊겨 접수 여부를 확인하지 못했습니다. 입력 내용을 유지하고 다시 신청하십시오. 같은 요청은 중복 접수되지 않습니다.']]); }
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
function showReceipt(receipt) {
  $('signup-banner').hidden = true;
  form.hidden = true; $('success').hidden = false;
  const paid = receipt.status === 'paid';
  $('success-title').textContent = '칼리 대번개 신청 완료';
  const payment = receipt.payment || {};
  const due = new Date(receipt.paymentDueAt || payment.deadline || '');
  const deadline = Number.isNaN(due.getTime()) ? '[입금 기한 미정]' : `${new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(due)} (KST)`;
  const rows = [['접수번호',receipt.id],['선택 내역',receipt.items.map((item)=>`${item.label} ${money(item.price)}`).join(', ')],[paid ? '입금 확인 금액' : '입금할 금액',money(receipt.total)],['은행',payment.bank || '[은행 미정]'],['계좌번호',payment.account || '[계좌번호 미정]'],['예금주',payment.holder || '[예금주 미정]'],['입금자명',receipt.payerName || $('name').value.trim()],['입금 기한',deadline],['문의',payment.contact || '[운영자 연락처 미정]']];
  const test = !payment.bank || !payment.account || !payment.holder || payment.test || /\[|미정|테스트/.test(`${payment.bank} ${payment.account} ${payment.holder}`);
  $('test-warning').textContent = test ? '테스트 접수 · 송금하지 마십시오' : paid ? '입금을 확인했습니다. 운영자가 연락드리겠습니다.' : '입금 확인 후 운영자가 연락드리겠습니다.';
  $('receipt').replaceChildren();
  for (const [label,value] of rows) { const dt=document.createElement('dt'),dd=document.createElement('dd'); dt.textContent=label; dd.textContent=value; $('receipt').append(dt,dd); }
  copyText = [$('test-warning').textContent,...rows.map(([key,value])=>`${key}: ${value}`)].join('\n');
  $('success-title').focus();
}
$('copy').addEventListener('click',async()=>{try { await navigator.clipboard.writeText(copyText); $('copy-status').textContent='입금 안내를 복사했습니다.'; } catch { $('copy-status').textContent='복사하지 못했습니다. 화면의 입금 안내를 직접 선택하여 복사하십시오.'; }});
$('accept-price').addEventListener('click',()=>{pendingPrice=false; $('price-change').hidden=true; update(); $('submit').focus();});
$('retry').addEventListener('click',loadOffer);
attempt = entry.restore();
loadOffer();
