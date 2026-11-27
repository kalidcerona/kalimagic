(function () {
  var config = window.MAGIC_PLAYGROUND_CONFIG || {};
  var supabaseClient = null;
  var policyReady = import('/member-policy-config.mjs');
  var policyLinks = '<a href="/privacy.html">개인정보 처리방침</a> · <a href="/terms.html">이용약관</a>';
  var noticeHtml = '<span class="signup-notice"><strong>구글 계정으로 칼리매직 시작하기</strong>' +
    '<span>처음 로그인하면 회원 계정이 만들어집니다. 이메일과 계정 식별자로 로그인하고, 사이트에서는 닉네임을 사용합니다.</span>' +
    '<span>도구 이용을 신청하면 구글 이름이 운영자에게 보일 수 있습니다. 가입 전에 안내와 약관을 확인해 주십시오.</span>' +
    '<span>' + policyLinks + '</span></span>';
  var notices = new Map();
  var agreements = new Map();
  var syncing = new Map();
  var agreementRetryMs = 60000;
  function validTime(value) {
    if (typeof value !== 'string') return false;
    var time = Date.parse(value);
    return Number.isFinite(time) && time <= Date.now() && new Date(time).toISOString() === value;
  }
  function validAgreement(record, version, userId) {
    return record && typeof record === 'object' && !Array.isArray(record) &&
      record.version === version && record.ageConfirmed === true && validTime(record.agreedAt) &&
      (!userId || (record.userId === userId && validTime(record.confirmedAt) && Date.parse(record.confirmedAt) >= Date.parse(record.agreedAt)));
  }
  function agreementKey(version, userId) { return 'member-notice:' + version + ':' + userId; }
  function rememberAgreement(key, record) {
    agreements.set(key, record);
    try { localStorage.setItem(key, JSON.stringify(record)); } catch (error) {}
  }
  function readAgreement(version, userId) {
    var key = agreementKey(version, userId), record = agreements.get(key);
    if (!record) { try { record = JSON.parse(localStorage.getItem(key)); } catch (error) {} }
    if (!validAgreement(record, version, userId)) return null;
    agreements.set(key, record);
    return record;
  }
  async function syncAgreement(session, force) {
    var policy = await policyReady;
    var userId = session.user.id, key = agreementKey(policy.PRIVACY_VERSION, userId);
    var record = readAgreement(policy.PRIVACY_VERSION, userId);
    if (!record) return false;
    if (syncing.has(key)) return syncing.get(key);
    if (!force && record.serverRecorded === true) return true;
    var last = record.syncAttemptAt;
    if (!force && Number.isSafeInteger(last) && last <= Date.now() && Date.now() - last < agreementRetryMs) return;
    var work = (async function () {
      var current = (await ensureClient().auth.getSession()).data.session;
      if (!current || current.user.id !== userId || !current.access_token) return;
      record.syncAttemptAt = Date.now();
      rememberAgreement(key, record);
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 8000);
      try {
        var response = await fetch('/.netlify/functions/member-agreement', {
          method:'POST', headers:{Authorization:'Bearer ' + current.access_token,'content-type':'application/json'},
          signal:controller.signal, body:JSON.stringify({version:record.version,agreedAt:record.agreedAt,ageConfirmed:true})
        });
        var result = await response.json();
        var recorded = response.ok && result.recorded === true;
        record.serverRecorded = recorded;
        rememberAgreement(key,record);
        return recorded;
      } catch (error) { /* Local consent remains usable; a later session check retries after the throttle. */ }
      finally { clearTimeout(timeout); }
    })();
    syncing.set(key, work);
    try { return await work; } finally { syncing.delete(key); }
  }
  var loginPending;
  var pendingAgreement;
  var pendingKey = 'member-agreement-pending';
  function readPending(version) {
    try { pendingAgreement = pendingAgreement || JSON.parse(sessionStorage.getItem(pendingKey)); } catch (error) {}
    if (!validAgreement(pendingAgreement, version) || Date.now() - Date.parse(pendingAgreement.agreedAt) > 3600000) return null;
    return pendingAgreement;
  }
  function clearPending() {
    pendingAgreement = null;
    try { sessionStorage.removeItem(pendingKey); } catch (error) {}
  }
  function consentDialog(version) {
    return new Promise(function (resolve) {
      var dialog = document.createElement('dialog');
      dialog.id = 'signup-consent-dialog';
      dialog.className = 'signup-dialog';
      dialog.setAttribute('aria-labelledby', 'signup-consent-title');
      dialog.innerHTML = '<h2 id="signup-consent-title">가입 전에 확인해 주십시오</h2>' + noticeHtml +
        '<p>아래 가입 버튼을 누르면 이용약관에 동의합니다. 개인정보 처리방침은 정보의 이용과 보관 방법을 안내합니다.</p>' +
        '<p id="signup-age-help">만 14세 미만은 보호자가 <a href="/contact.html">문의 페이지</a>로 연락하여 동의 절차를 완료할 때까지 가입할 수 없습니다.</p>' +
        '<form method="dialog"><label class="signup-age"><input id="signup-age" name="age" type="checkbox" required autofocus aria-describedby="signup-age-help"> 만 14세 이상입니다</label>' +
        '<button id="signup-accept" value="accept">확인했고 구글로 가입합니다</button><button id="signup-decline" value="decline" formnovalidate>가입하지 않습니다</button></form>';
      document.body.appendChild(dialog);
      dialog.addEventListener('close', function () {
        var accepted = dialog.returnValue === 'accept' && dialog.querySelector('#signup-age').checked;
        dialog.remove();
        if (!accepted) { clearPending(); resolve(null); return; }
        var record = {version:version, agreedAt:new Date().toISOString(), ageConfirmed:true};
        resolve(record);
      }, {once:true});
      dialog.showModal();
    });
  }
  async function confirmAccount(user) {
    var policy = await policyReady;
    var key = agreementKey(policy.PRIVACY_VERSION,user.id);
    if (readAgreement(policy.PRIVACY_VERSION,user.id)) { clearPending(); return true; }
    if (notices.has(key)) return notices.get(key);
    var confirmation = (async function () {
      var agreement = readPending(policy.PRIVACY_VERSION) || await consentDialog(policy.PRIVACY_VERSION);
      if (!agreement) { window.dispatchEvent(new Event('member-account-switch')); return false; }
      return new Promise(function (resolve) {
        var dialog = document.createElement('dialog');
        dialog.id = 'signup-account-dialog';
        dialog.className = 'signup-dialog';
        dialog.setAttribute('aria-labelledby', 'signup-dialog-title');
        dialog.innerHTML = '<h2 id="signup-dialog-title">사용할 계정을 확인해 주십시오</h2>' +
          '<p>로그인한 계정: <strong data-account></strong></p>' +
          '<p>활동 전에 <a href="/mypage.html">마이페이지에서 닉네임</a>을 확인해 주십시오. 익명 글에도 작성자 식별자는 저장됩니다.</p>' +
          '<p>정보 이용과 서비스 기준: ' + policyLinks + '</p><form method="dialog"><button autofocus value="continue">확인하고 계속하기</button>' +
          '<button value="switch">다른 계정 사용하기</button><button value="cancel">취소하기</button></form>';
        dialog.querySelector('[data-account]').textContent = user.email || '';
        document.body.appendChild(dialog);
        dialog.addEventListener('close', async function () {
          var action = dialog.returnValue;
          dialog.remove();
          clearPending();
          if (action === 'continue') {
            var current;
            try { current = (await ensureClient().auth.getSession()).data.session; } catch (error) {}
            if (!current || current.user.id !== user.id) {
              notices.delete(key);
              window.dispatchEvent(new Event('member-account-switch'));
              resolve(false);
              return;
            }
            rememberAgreement(key,{...agreement,userId:user.id,confirmedAt:new Date().toISOString()});
            resolve(true);
          } else {
            notices.delete(key);
            window.dispatchEvent(new Event('member-account-switch'));
            resolve(false);
            if (action === 'switch') await logout();
          }
        }, {once:true});
        dialog.showModal();
      });
    })();
    notices.set(key, confirmation);
    confirmation.then(function (accepted) { if (!accepted) notices.delete(key); }, function () { notices.delete(key); });
    return confirmation;
  }
  function ensureClient() {
    if (supabaseClient) return supabaseClient;
    if (!window.supabase || !config.supabaseUrl || !config.supabasePublishableKey) return null;
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
    return supabaseClient;
  }
  async function getSession(options) {
    var client = ensureClient();
    if (!client && options?.seminar) throw new Error('로그인 서비스를 불러오지 못했습니다.');
    if (!client) return null;
    var result = await client.auth.getSession();
    if (options?.seminar && result.error) throw result.error;
    var session = result.data.session;
    if (!session) return null;
    if (!await confirmAccount(session.user)) {
      if (options?.seminar) throw new Error('계정 확인을 취소했습니다.');
      return null;
    }
    var current = (await client.auth.getSession()).data.session;
    if (!current || current.user.id !== session.user.id) {
      clearPending();
      window.dispatchEvent(new Event('member-account-switch'));
      if (options?.seminar) throw new Error('사용 중인 계정이 변경되었습니다.');
      return null;
    }
    if (!options?.seminar) syncAgreement(current).catch(function () {});
    return current;
  }
  function seminarUrl(eventId) {
    if (eventId === 'cupsnballs') return 'https://kalimagic.netlify.app/seminar-signup/cupsnballs.html';
    if (eventId === 'daebeongae') return 'https://kalimagic.netlify.app/seminar-signup/';
    throw new Error('행사 주소를 확인해 주십시오.');
  }
  async function confirmSeminarAgreement(session) {
    if (!session?.user?.id || !await syncAgreement(session, true)) return false;
    var current = (await ensureClient().auth.getSession()).data.session;
    return current?.user.id === session.user.id;
  }
  async function login(eventId) {
    var redirectTo = eventId === undefined ? window.location.href : seminarUrl(eventId);
    if (loginPending) return loginPending;
    loginPending = (async function () {
      var client = ensureClient();
      if (!client) throw new Error('로그인 설정을 확인하지 못했습니다. 잠시 후 다시 시도해 주십시오.');
      var policy = await policyReady;
      var agreement = await consentDialog(policy.PRIVACY_VERSION);
      if (!agreement) return false;
      pendingAgreement = agreement;
      try { sessionStorage.setItem(pendingKey, JSON.stringify(agreement)); } catch (error) {}
      try {
        var result = await client.auth.signInWithOAuth({provider:'google', options:{redirectTo:redirectTo}});
        if (result.error) throw result.error;
        return true;
      } catch (error) { clearPending(); throw error; }
    })();
    try { return await loginPending; } finally { loginPending = null; }
  }
  async function logout() {
    clearPending();
    notices.clear();
    window.dispatchEvent(new Event('member-account-switch'));
    var client = ensureClient();
    if (!client) return;
    await client.auth.signOut();
    window.location.reload();
  }
  async function authHeader() {
    var session = await getSession();
    return session ? {Authorization:'Bearer ' + session.access_token} : {};
  }
  window.MagicAuth = {noticeHtml:noticeHtml, seminarUrl:seminarUrl, confirmSeminarAgreement:confirmSeminarAgreement, getSession:getSession, login:login, logout:logout, authHeader:authHeader};
})();
