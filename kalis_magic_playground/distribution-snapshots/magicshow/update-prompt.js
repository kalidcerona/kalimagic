// Self-contained magicshow adapter, aligned with the magic-app prompt text and modal host.
(() => {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  let registration = null, dismissed = false, applying = false, reloaded = false;
  let lastCheck = Date.now(), panel = null, focusBefore = null;
  const rest = () => document.visibilityState === 'visible' && window.MagicShowUI?.isRestScreen?.() === true;
  function hide() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    if (focusBefore?.isConnected) focusBefore.focus();
  }
  function reloadOnce() {
    if (!applying || reloaded) return;
    reloaded = true;
    location.reload();
  }
  function check() {
    if (dismissed || applying || !registration?.waiting || !rest()) { hide(); return; }
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'magicUpdatePrompt';
      panel.hidden = true;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', 'magicUpdateText');
      panel.innerHTML = '<div class="magic-update-box"><p id="magicUpdateText">새 버전이 있어요. 지금 업데이트할까요?</p><p data-save-error role="status" hidden>다른 창에서 저장 중이에요. 잠시 후 다시 눌러 주세요.</p><div class="magic-update-actions"><button type="button" data-update>지금 업데이트</button><button type="button" data-later>나중에</button></div></div>';
      (document.querySelector('dialog:modal') || document.body).append(panel);
      panel.querySelector('[data-later]').addEventListener('click', () => { dismissed = true; hide(); });
      panel.querySelector('[data-update]').addEventListener('click', () => {
        if (!rest() || !registration.waiting || applying) { check(); return; }
        const saveError = panel.querySelector('[data-save-error]');
        saveError.hidden = true;
        try { if (window.MagicShowUI.save() === false) { saveError.hidden = false; return; } } catch (error) { console.warn('Magicshow update save failed:', error); return; }
        applying = true;
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(reloadOnce, 5000);
        hide();
      });
      panel.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismissed = true; hide(); }
        if (event.key === 'Tab') {
          event.preventDefault();
          const buttons = [...panel.querySelectorAll('button')];
          buttons[(buttons.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
        }
      });
    }
    const host = document.querySelector('dialog:modal') || document.body;
    if (panel.parentNode !== host) host.append(panel);
    if (panel.hidden) {
      focusBefore = document.activeElement;
      panel.hidden = false;
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
  window.addEventListener('load', () => {
    sw.register('./sw.js').then(r => {
      registration = r;
      warm(r.active); warm(r.waiting);
      r.addEventListener('updatefound', () => {
        const worker = r.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') { warm(r.waiting); check(); }
        });
      });
      check();
    }).catch(error => console.warn('Magicshow worker registration failed:', error));
  });
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
