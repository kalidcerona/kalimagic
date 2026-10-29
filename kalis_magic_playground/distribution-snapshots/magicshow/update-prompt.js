// Self-contained magicshow adapter, aligned with the magic-app prompt text and modal host.
(() => {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  let registration = null, dismissed = false, applying = false, reloaded = false;
  let lastCheck = Date.now(), panel = null, focusBefore = null;
  let accepted = null, activationStarted = false, titleInert = null;
  const watched = new WeakSet(), progressByWorker = new WeakMap();
  let failed = false;
  const title = () => document.getElementById('titleScreen');
  const onTitle = () => !!title() && !title().hidden;
  const candidate = () => registration?.waiting ||
    (sw.controller && onTitle() && registration?.installing?.state === 'installing' ? registration.installing : null);
  const rest = () => document.visibilityState === 'visible' && window.MagicShowUI?.isRestScreen?.() === true;
  function hide() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    if (titleInert) { titleInert.node.inert = titleInert.value; titleInert = null; }
    if (focusBefore?.isConnected) focusBefore.focus();
  }
  function reloadOnce() {
    if (!activationStarted || reloaded) return;
    reloaded = true;
    location.reload();
  }
  function dismiss() {
    if (activationStarted) return;
    dismissed = true;
    applying = false;
    accepted = null;
    hide();
  }
  function renderProgress() {
    const progress = progressByWorker.get(accepted);
    const percent = progress ? Math.floor(progress.done / progress.total * 100) : 0;
    const reopening = percent === 100 || activationStarted;
    panel.querySelector('#magicUpdateText').hidden = true;
    panel.querySelector('[data-update]').hidden = true;
    panel.querySelector('[data-later]').hidden = reopening;
    if (reopening) panel.querySelector('.magic-update-box').focus();
    panel.querySelector('[data-download]').hidden = false;
    panel.querySelector('[data-download]').textContent = reopening ? '다시 여는 중이에요' : `업데이트를 받는 중이에요 ${percent}%`;
    const bar = panel.querySelector('[data-progress]');
    bar.hidden = !!registration?.waiting || activationStarted;
    bar.setAttribute('aria-valuenow', String(percent));
    panel.querySelector('[data-progress-fill]').style.width = `${percent}%`;
    panel.querySelector('[data-download-help]').hidden = bar.hidden;
  }
  function showFailure(worker) {
    if (!panel || panel.hidden || activationStarted || dismissed || (accepted && accepted !== worker)) return;
    failed = true;
    applying = false;
    accepted = null;
    for (const selector of ['#magicUpdateText', '[data-download]', '[data-progress]', '[data-download-help]', '[data-save-error]', '[data-update]', '[data-later]']) panel.querySelector(selector).hidden = true;
    panel.querySelector('[data-install-error]').hidden = false;
    panel.querySelector('[data-continue]').hidden = false;
    panel.querySelector('[data-continue]').focus();
  }
  function applyWaiting() {
    if (!applying || activationStarted || registration?.waiting !== accepted) return;
    activationStarted = true;
    renderProgress();
    accepted.postMessage({ type: 'SKIP_WAITING' });
    // The fallback starts only after installation, never during a slow download.
    setTimeout(reloadOnce, 5000);
  }
  function check() {
    if (failed) return;
    if (applying) { applyWaiting(); return; }
    if (dismissed || navigator.onLine === false || !candidate() || !rest()) { hide(); return; }
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'magicUpdatePrompt';
      panel.hidden = true;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', 'magicUpdateText');
      panel.innerHTML = '<div class="magic-update-box" tabindex="-1"><p id="magicUpdateText">새 버전이 있어요. 지금 업데이트할까요?</p><p data-download role="status" hidden></p><div data-progress role="progressbar" aria-label="업데이트 다운로드" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><div data-progress-fill></div></div><p data-download-help hidden>잠시만 기다려 주세요. 창을 닫지 마세요.</p><p data-install-error role="status" hidden>업데이트를 받지 못했어요. 다음에 다시 시도할게요.</p><p data-save-error role="status" hidden>다른 창에서 저장 중이에요. 잠시 후 다시 눌러 주세요.</p><div class="magic-update-actions"><button type="button" data-update>지금 업데이트</button><button type="button" data-later>나중에</button><button type="button" data-continue hidden>계속하기</button></div></div>';
      (document.querySelector('dialog:modal') || document.body).append(panel);
      panel.querySelector('[data-continue]').addEventListener('click', dismiss);
      panel.querySelector('[data-later]').addEventListener('click', dismiss);
      panel.querySelector('[data-update]').addEventListener('click', () => {
        const worker = candidate();
        if (!rest() || !worker || applying) { check(); return; }
        const saveError = panel.querySelector('[data-save-error]');
        saveError.hidden = true;
        // The title owns no running session and deliberately disables save(). Preserve its stored saves.
        try { if (!onTitle() && window.MagicShowUI.save() === false) { saveError.hidden = false; return; } }
        catch (error) { saveError.hidden = false; console.warn('Magicshow update save failed:', error); return; }
        applying = true;
        accepted = worker;
        renderProgress();
        worker.postMessage({ type: 'GET_UPDATE_PROGRESS' });
        panel.querySelector('[data-update]').disabled = true;
        if (!panel.querySelector('[data-later]').hidden) panel.querySelector('[data-later]').focus();
        applyWaiting();
      });
      // Window capture runs before the title's document capture trap.
      window.addEventListener('keydown', event => {
        if (panel.hidden) return;
        event.stopImmediatePropagation();
        if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
        if (event.key === 'Tab') {
          event.preventDefault();
          const buttons = [...panel.querySelectorAll('button')].filter(button => !button.disabled && !button.hidden);
          if (!buttons.length) { panel.querySelector('.magic-update-box').focus(); return; }
          buttons[(buttons.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
        }
      }, true);
    }
    const host = document.querySelector('dialog:modal') || document.body;
    if (panel.parentNode !== host) host.append(panel);
    if (panel.hidden) {
      focusBefore = document.activeElement;
      panel.hidden = false;
      if (onTitle()) { const node = title(); titleInert = { node, value: node.inert }; node.inert = true; }
      panel.querySelector('[data-update]').focus();
    }
  }
  // Save has already succeeded for this explicit reload; suppress the game's separate leave confirmation.
  window.addEventListener('beforeunload', event => { if (applying) event.stopImmediatePropagation(); }, true);
  sw.addEventListener('controllerchange', () => {
    warm(sw.controller);
    reloadOnce();
  });
  const warm = worker => worker?.postMessage({ type: 'PRECACHE_ART' });
  sw.addEventListener('message', event => {
    const data = event.data, worker = event.source;
    if (!worker || data?.type !== 'MAGICSHOW_UPDATE_PROGRESS' || !Number.isInteger(data.done) || !Number.isInteger(data.total) || data.total <= 0 || data.done < 0 || data.done > data.total) return;
    progressByWorker.set(worker, data);
    if (worker !== registration?.installing && worker !== accepted) return;
    if (data.failed) showFailure(worker);
    else if (applying && accepted === worker) renderProgress();
  });
  function watch(worker) {
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    worker.postMessage({ type: 'GET_UPDATE_PROGRESS' });
    worker.addEventListener('statechange', () => {
      if (worker.state === 'redundant') showFailure(worker);
      if (worker.state === 'installed') warm(registration.waiting);
      check();
    });
  }
  // This deferred script runs as soon as the DOM is parsed, without waiting for images or window.load.
  sw.register('./sw.js').then(r => {
    registration = r;
    r.addEventListener('updatefound', () => { watch(r.installing); check(); });
    watch(r.installing);
    warm(r.active); warm(r.waiting);
    check();
    lastCheck = Date.now();
    r.update().catch(() => {});
  }).catch(error => console.warn('Magicshow worker registration failed:', error));
  // Re-evaluate after UI mutations before paint, plus a low-frequency fallback for state-only transitions.
  new MutationObserver(check).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  setInterval(check, 1000);
  document.addEventListener('visibilitychange', () => {
    check();
    if (document.visibilityState !== 'visible' || !registration || Date.now() - lastCheck < 600000) return;
    lastCheck = Date.now();
    registration.update().catch(() => {});
  });
})();
