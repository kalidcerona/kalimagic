(function () {
  const endpoint = '/api/contact';
  const form = document.querySelector('#contact-form');
  const status = document.querySelector('#contact-status');
  const recovery = document.querySelector('#contact-recovery');
  const retry = document.querySelector('#contact-retry');
  const resend = document.querySelector('#contact-resend');
  const draftKey = 'contact-draft-v1';
  const attemptKey = 'contact-attempt-v2';
  const closed = '지금은 신규 문의 접수가 닫혀 있습니다. 이전 문의 결과는 아래에서 확인할 수 있습니다. 개인정보 보호책임자 연락처로도 문의하실 수 있습니다.';
  let submission, attempt, open = false;
  function render() {
    form.hidden = !open;
    form.querySelector('[type="submit"]').disabled = Boolean(submission || attempt);
    recovery.hidden = !attempt;
    retry.disabled = Boolean(submission);
    resend.hidden = !attempt?.unknown || !open;
    resend.disabled = Boolean(submission);
  }
  function saveAttempt() {
    sessionStorage.setItem(attemptKey, JSON.stringify(attempt));
    if (sessionStorage.getItem(attemptKey) !== JSON.stringify(attempt)) throw Error('storage');
  }
  function clearAttempt() {
    attempt = null;
    try { sessionStorage.removeItem(attemptKey); } catch {}
  }
  function accepted() {
    clearAttempt();
    try { sessionStorage.removeItem(draftKey); } catch {}
    form.reset();
    status.textContent = '문의를 접수했습니다. 운영자가 확인하겠습니다.';
  }
  window.addEventListener('member-account-switch', () => {
    if (submission) {
      submission.abort();
      status.textContent = attempt ? '계정 확인이 중단되었습니다. 이전 문의는 원래 계정으로 결과를 확인해 주십시오.' : '문의 전송을 취소했습니다. 아직 전송하지 않았습니다.';
    }
  });
  async function start() {
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey));
      if (draft) { form.elements.message.value = draft.message || ''; form.elements.reply.value = draft.reply || ''; }
      const saved = JSON.parse(sessionStorage.getItem(attemptKey));
      if (saved && /^[0-9a-f-]{36}$/i.test(saved.key) && typeof saved.identity === 'string' && typeof saved.fields?.message === 'string' && typeof saved.fields?.reply === 'string') {
        attempt = saved;
        attempt.unknown = false;
      }
    } catch { /* An unavailable draft does not initiate a new submission. */ }
    try {
      const response = await fetch(endpoint);
      open = response.ok && (await response.json()).open === true;
    } catch { open = false; }
    status.textContent = attempt ? '이전 문의의 접수 결과를 먼저 확인해 주십시오. 같은 요청의 키가 복원되었습니다.' : open ? '' : closed;
    render();
  }
  async function send(action, fields) {
    if (submission || (action === 'submit' && !open)) return;
    const controller = new AbortController();
    submission = controller;
    status.textContent = action === 'status' ? '이전 문의의 접수 결과를 확인하고 있습니다.' : '문의 내용을 보내고 있습니다.';
    render();
    try {
      const session = await window.MagicAuth.getSession();
      if (controller.signal.aborted) return;
      const identity = session ? 'member:' + session.user.id : 'guest';
      if (attempt && attempt.identity !== identity) {
        status.textContent = '이전 문의를 보낸 계정과 현재 계정이 다릅니다. 원래 계정으로 로그인하거나 비회원 문의라면 로그아웃한 뒤 확인해 주십시오.';
        return;
      }
      if (!attempt) {
        attempt = {key:crypto.randomUUID(),fields:{...fields},identity,unknown:false};
        try { saveAttempt(); } catch {
          clearAttempt();
          status.textContent = '브라우저의 임시 저장을 사용할 수 없어 전송하지 않았습니다. 저장을 허용하거나 개인정보 보호책임자 연락처로 문의해 주십시오.';
          return;
        }
      }
      if (action === 'submit') { attempt.unknown = false; saveAttempt(); }
      const headers = session ? {Authorization:'Bearer ' + session.access_token} : {};
      const response = await fetch(endpoint, {signal:controller.signal,method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({...attempt.fields,idempotencyKey:attempt.key,action})});
      const result = await response.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (response.ok && (result.sent === true || result.state === 'accepted')) accepted();
      else if (response.ok && result.state === 'unknown' && action === 'status') {
        attempt.unknown = true;
        saveAttempt();
        status.textContent = open ? '접수 기록을 찾지 못했습니다. 원래 내용으로 다시 보내려면 같은 문의 다시 보내기를 선택해 주십시오. 최초 키를 그대로 사용합니다.' : '접수 기록을 찾지 못했습니다. 신규 접수는 닫혀 있습니다. 문의 기록은 유지되며 나중에 다시 확인할 수 있습니다.';
      } else if (response.status === 400 && action === 'submit') {
        clearAttempt();
        const field = result.field === 'reply' ? 'reply' : 'message';
        status.textContent = result.error === 'links' ? '본문과 연락처의 링크는 합계 3개까지 입력할 수 있습니다.' : field === 'reply' ? '답장 연락처를 150자 이내로 입력해 주십시오.' : '문의 내용을 1자 이상 1,400자 이내로 입력해 주십시오.';
        form.elements[field].focus();
      } else if (response.status === 401 || response.status === 409) {
        status.textContent = '원래 문의의 계정과 내용을 확인하지 못했습니다. 기존 요청은 유지했습니다. 원래 계정으로 다시 확인해 주십시오.';
      } else if (response.status === 429) {
        status.textContent = '요청이 많습니다. 잠시 후 이전 문의 결과 확인을 눌러 주십시오. 기존 요청은 유지했습니다.';
      } else {
        status.textContent = '접수 결과를 확인하지 못했습니다. 기존 요청은 유지했습니다. 이전 문의 결과 확인을 눌러 주십시오.';
        if (result.error === 'closed') open = false;
      }
    } catch {
      if (!controller.signal.aborted) status.textContent = '접수 결과를 확인하지 못했습니다. 기존 요청은 유지했습니다. 이전 문의 결과 확인을 눌러 주십시오.';
    } finally { submission = null; render(); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (attempt || submission) return;
    const fields = Object.fromEntries(new FormData(form));
    fields.message = fields.message.trim(); fields.reply = fields.reply.trim();
    if (!fields.message) { status.textContent = '문의 내용을 입력해 주십시오.'; form.elements.message.focus(); return; }
    try { sessionStorage.setItem(draftKey,JSON.stringify({message:fields.message,reply:fields.reply})); } catch {}
    await send('submit',fields);
  });
  retry.addEventListener('click', () => { if (attempt) send('status'); });
  resend.addEventListener('click', () => { if (attempt?.unknown && open) send('submit'); });
  start();
})();
