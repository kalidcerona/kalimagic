const $ = id => document.getElementById(id);
const routes = {cupsnballs:'/seminar-signup/cupsnballs.html', daebeongae:'/seminar-signup/'};
let authLoading;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement('script'), {src, onload:resolve, onerror:reject});
    document.head.append(script);
  });
}

async function auth() {
  if (window.MagicAuth) return window.MagicAuth;
  if (!authLoading) authLoading = (async () => {
    window.MAGIC_PLAYGROUND_CONFIG = {
      supabaseUrl:'https://wjyvssvoavzuaaxlvobo.supabase.co',
      supabasePublishableKey:'sb_publishable_FZwzcGFQ06F65Butggp6rQ_fv3zZfkq'
    };
    if (!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    await loadScript('/auth.js');
    return window.MagicAuth;
  })().catch(error => { authLoading = null; throw error; });
  return authLoading;
}

export function createEntry(eventId, isLocked) {
  const pendingKey = 'seminar-pending-member:' + eventId;
  const marker = 'seminar-member-return:' + eventId;
  const href = new URL(routes[eventId], 'https://kalimagic.netlify.app').href;
  let mode, account, generation = 0, first = true, notice, version;
  let focusChoice = false;
  let guestOnBack = history.state?.seminarGuest === eventId;
  let recovering = false, draft;
  const draftKey = 'seminar-login-draft:' + eventId;
  const hasCallback = [location.search,location.hash].some(part =>
    [...new URLSearchParams(part.slice(1)).keys()].some(key =>
      ['code','access_token','refresh_token','id_token','error','error_code','error_description','token_type','expires_in','provider_token','provider_refresh_token'].includes(key)));
  let since;
  try {
    since = Number(sessionStorage.getItem(marker));
    draft = JSON.parse(sessionStorage.getItem(draftKey));
  } catch {}
  let returning = since > 0 && since <= Date.now() && Date.now()-since < 3600000;
  const cleanCallback = () => { if (hasCallback) history.replaceState(history.state, '', routes[eventId]); };
  if (!returning) cleanCallback();
  function showRecovery(message) {
    recovering = true;
    $('entry-choice').hidden = $('signup').hidden = true;
    $('member-recovery').hidden = false;
    $('recovery-status').textContent = message;
    document.querySelector('.skip').hash = 'recovery-title';
  }
  $('recovery-login').onclick = async () => {
    if (/kakaotalk|instagram/i.test(navigator.userAgent)) {
      $('recovery-status').textContent = '앱 안에서는 구글 로그인을 진행할 수 없습니다. 신청한 브라우저의 원래 탭에서 확인하거나 운영자에게 문의해 주세요.';
      return;
    }
    $('recovery-login').disabled = true;
    try {
      const api = await auth();
      sessionStorage.setItem(marker, String(Date.now()));
      if (!await api.login(eventId)) throw new Error('cancelled');
    } catch { $('recovery-status').textContent = '로그인을 마치지 못했습니다. 원래 계정으로 다시 시도해 주세요.'; }
    finally { $('recovery-login').disabled = false; }
  };
  const clearMarker = () => { try { sessionStorage.removeItem(marker); } catch {} };
  function choose(next, session, focus = true) {
    generation++;
    clearMarker();
    mode = next;
    guestOnBack = next === 'guest';
    history.replaceState({...history.state, seminarGuest:guestOnBack ? eventId : null}, '');
    account = session?.user.id;
    $('entry-member').disabled = false;
    $('entry-choice').hidden = true;
    $('entry-mode').hidden = mode !== 'guest';
    $('entry-linkage').hidden = mode !== 'member';
    $('entry-linkage').querySelector('details').open = false;
    $('linkage-consent').checked = false;
    $('signup').hidden = false;
    document.querySelector('.skip').hash = 'signup';
    const phone = session?.user.phone?.replace(/^\+82/, '0');
    if (!$('contact').value && session?.user.phone_confirmed_at && /^01[016789]\d{7,8}$/.test(phone)) $('contact').value = phone;
    if (draft) {
      fillDraft(draft);
      draft = null;
      try { sessionStorage.removeItem(draftKey); } catch {}
    }
    if (focus) $('name').focus();
  }
  function handoff() {
    const android = /android/i.test(navigator.userAgent);
    $('entry-handoff').hidden = false;
    $('handoff-chrome').hidden = !android;
    $('handoff-chrome').href = 'intent://' + href.slice(8) + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(href) + ';end';
    $('handoff-url').value = href;
    $('handoff-instructions').textContent = android ? '앱 메뉴에서 외부 브라우저로 열거나 링크를 복사해 Chrome 주소창에 붙여넣으세요.' : '앱 메뉴에서 외부 브라우저로 열거나 링크를 복사해 Safari 등 브라우저 주소창에 붙여넣으세요.';
    $('handoff-title').focus();
  }
  async function member(returning) {
    if (/kakaotalk|instagram/i.test(navigator.userAgent)) { if (returning) cleanCallback(); handoff(); return; }
    const run = ++generation;
    $('entry-member').disabled = true;
    $('entry-status').textContent = '계정을 확인하고 있습니다.';
    try {
      const api = await auth();
      if (run !== generation) return;
      const callbackError = returning && [location.search,location.hash].some(part => new URLSearchParams(part.slice(1)).has('error'));
      let session;
      try { session = await api.getSession({seminar:true}); }
      finally { if (returning) history.replaceState(history.state, '', routes[eventId]); }
      if (callbackError) throw new Error('cancelled');
      if (run !== generation) return;
      if (!session && !returning) {
        sessionStorage.setItem(marker, String(Date.now()));
        if (await api.login(eventId)) return;
      } else if (session && await api.confirmSeminarAgreement(session)) {
        if (run === generation) choose('member', session);
        return;
      }
      throw new Error('confirmation');
    } catch {
      if (run !== generation) return;
      clearMarker();
      $('entry-status').textContent = '로그인을 마치지 못했습니다. 다시 로그인하거나 비회원으로 신청해 주세요.';
      $('entry-help').hidden = false;
    } finally { if (returning) cleanCallback(); if (run === generation) $('entry-member').disabled = false; }
  }
  $('entry-member').onclick = () => member(false);
  $('entry-help').onclick = handoff;
  $('entry-guest').onclick = () => choose('guest');
  $('entry-switch').onclick = () => { if (!isLocked()) choose('guest'); };
  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      $('handoff-status').textContent = '신청서 링크를 복사했습니다.';
    } catch {
      $('handoff-url').hidden = false;
      $('handoff-url').focus();
      $('handoff-url').select();
      $('handoff-status').textContent = '선택된 주소를 직접 복사해 주세요.';
    }
  }
  if ('CommandEvent' in window) $('handoff-url').addEventListener('command', copy);
  else $('handoff-copy').onclick = copy;
  function fillDraft(data) {
    for (const [id,value] of Object.entries({name:data.name,'birth-date':data.birthDate,contact:data.contact,payer:data.payerName,
      'reason-other-text':data.reasonOther,'discovery-other-text':data.discoveryOther})) $(id).value = value || '';
    for (const name of ['gender','discovery','reason']) {
      for (const input of document.getElementsByName(name)) input.checked = input.value === data[name];
    }
    $('same-payer').checked = !data.payerName;
    $('age-confirmed').checked = data.ageConfirmed;
    if ($('bundle')) {
      $('bundle').checked = data.selection.includes('bundle');
      $('single').checked = !$('bundle').checked;
      $('open').checked = data.selection.includes('open');
      $('open-no').checked = !$('open').checked;
      for (const input of document.querySelectorAll('#singles input')) input.checked = data.selection.includes(input.value);
    }
    $('signup').dispatchEvent(new Event('change'));
    // Reopened drafts require review against the offer currently displayed.
    for (const id of ['consent','photo-consent','promotion-consent','linkage-consent']) if ($(id)) $(id).checked = false;
  }
  return {
    cleanCallback,
    authFailed(payload) {
      draft = payload;
      try { sessionStorage.setItem(draftKey, JSON.stringify(payload)); } catch {}
      mode = account = undefined;
      $('entry-mode').hidden = $('signup').hidden = true;
      $('entry-choice').hidden = false;
      $('entry-status').textContent = '로그인을 확인하지 못했습니다. 다시 로그인하거나 작성한 내용으로 비회원 신청을 계속해 주세요.';
      document.querySelector('.skip').hash = 'entry-title';
      $('entry-title').focus();
    },
    showRecovery,
    keepUnknown(original, response, code, wasUnresolved) {
      if (!wasUnresolved || response.ok) return false;
      const answered = ['agreement_required','signup_closed','member_unavailable','consent_changed','option_unavailable','price_changed','sold_out','rate_limited'];
      if (answered.includes(code)) return false;
      if (!recovering && response.status >= 500) return false;
      showRecovery(code === 'idempotency_conflict' ? '보관한 신청 내용이 원래 접수와 일치하지 않습니다. 운영자에게 문의해 주세요.' :
        '원래 신청 결과를 아직 확인하지 못했습니다. 다시 확인해 주세요.');
      return true;
    },
    get recovering() { return recovering; },
    remember(original) {
      const {account, key, payload, renewAgreement} = original;
      try {
        sessionStorage.setItem(pendingKey, JSON.stringify({account, key, payload, renewAgreement:renewAgreement === true}));
        $('memory-recovery-hint').hidden = true;
      } catch (error) {
        if (account) throw error;
        // The form retains the original guest attempt until it gets a definitive answer.
        $('memory-recovery-hint').hidden = false;
      }
    },
    restore() {
      let stored;
      try { stored = sessionStorage.getItem(pendingKey); } catch { return; }
      if (!stored) return;
      try {
        const saved = JSON.parse(stored);
        const member = saved.payload?.signupMode === 'member' && saved.payload.linkageConsent === true &&
          typeof saved.account === 'string' && !!saved.account;
        const guest = saved.payload?.signupMode === undefined && saved.account === undefined;
        if (saved.payload?.eventId !== eventId || !(member || guest) || typeof saved.key !== 'string' || !saved.key) throw new Error('invalid');
        if (guest) {
          $('recovery-title').textContent = '원래 비회원 신청 확인';
          $('recovery-login').hidden = true;
        }
        if (returning && member) auth().then(api => api.getSession({seminar:true})).catch(() => {}).finally(cleanCallback);
        else cleanCallback();
        returning = false;
        clearMarker();
        showRecovery('');
        return {...saved, fingerprint:JSON.stringify(saved.payload), unresolved:true};
      } catch {
        cleanCallback();
        showRecovery('보관한 신청 정보를 읽지 못했습니다. 새 신청 전에 운영자에게 문의해 주세요.');
        $('recovery-check').disabled = $('recovery-login').disabled = true;
      }
    },
    forget() {
      try { sessionStorage.removeItem(pendingKey); } catch {}
    },
    finishRecovery() {
      recovering = false;
      $('member-recovery').hidden = true;
      $('recovery-title').textContent = '원래 회원 신청 확인';
      $('recovery-login').hidden = false;
    },
    resumeForm(original) {
      this.finishRecovery();
      choose(original.account ? 'member' : 'guest', original.account ? {user:{id:original.account}} : null, false);
      fillDraft(original.payload);
    },
    render(offer) {
      if (recovering) { $('signup').hidden = $('entry-choice').hidden = true; return; }
      if (version !== offer?.consentVersion || notice !== offer?.linkageNotice) $('linkage-consent').checked = false;
      version = offer?.consentVersion;
      notice = offer?.linkageNotice;
      $('entry-notice').textContent = $('linkage-notice').textContent = notice || '';
      if (!offer?.open || !offer.memberLinkageEnabled) {
        cleanCallback(); returning = false; clearMarker();
        $('entry-choice').hidden = true;
        if (draft && !mode) choose('guest', null, false);
        $('entry-mode').hidden = true;
        $('signup').hidden = false;
        generation++;
        $('entry-member').disabled = false;
        return;
      }
      if (mode) { $('entry-mode').hidden = mode !== 'guest'; return; }
      if (guestOnBack && !returning) { choose('guest', null, false); return; }
      $('signup').hidden = true;
      $('entry-choice').hidden = false;
      document.querySelector('.skip').hash = 'entry-title';
      if (focusChoice) { $('entry-title').focus(); focusChoice = false; }
      if (first) {
        first = false;
        clearMarker();
        if (returning) { returning = false; member(true); }
      }
    },
    reset() {
      returning = guestOnBack = false; focusChoice = true;
      history.replaceState({...history.state, seminarGuest:null}, '');
      generation++; first = true; mode = account = undefined; clearMarker();
      $('entry-status').textContent = $('handoff-status').textContent = '';
      for (const id of ['entry-mode','entry-handoff','entry-help','handoff-url','entry-choice']) $(id).hidden = true;
    },
    lock() { $('entry-switch').disabled = $('linkage-consent').disabled = isLocked(); },
    get account() { return account; },
    get needsConsent() { return mode === 'member' && !$('linkage-consent').checked; },
    get fields() { return mode === 'member' ? {signupMode:'member', linkageConsent:true} : {}; },
    async headers(expected, renewAgreement) {
      const headers = {'Content-Type':'application/json'};
      if (!expected) return headers;
      const api = await auth();
      const session = await api.getSession({seminar:true});
      if (recovering && (location.search || location.hash)) history.replaceState(history.state, '', routes[eventId]);
      if (!session?.access_token) throw new Error('signed_out');
      if (session.user.id !== expected) throw new Error('account_changed');
      if (renewAgreement && !await api.confirmSeminarAgreement(session)) throw new Error('agreement_required');
      headers.Authorization = 'Bearer ' + session.access_token;
      return headers;
    }
  };
}
