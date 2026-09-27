// Request fullscreen only during a trusted action, after app click handlers.
(function () {
  'use strict';
  if (window.MagicFullscreen) return;
  let pending = false;
  const root = document.documentElement;
  const requestFullscreen = root.requestFullscreen || root.webkitRequestFullscreen;
  const excluded = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-fullscreen-skip], [data-install-card], [data-install-button], #install-nudge';

  function request(event) {
    if (!event || !event.isTrusted || pending || document.hidden
      || location.hash === '#selftest' || event.target?.closest?.(excluded)
      || document.activeElement?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      || document.fullscreenElement || document.webkitFullscreenElement
      || typeof requestFullscreen !== 'function'
      || navigator.userActivation?.isActive === false) return;
    pending = true;
    try {
      // A rejected request remains eligible on the next trusted action.
      Promise.resolve(requestFullscreen.call(root, { navigationUI: 'hide' }))
        .catch(() => {}).finally(() => { pending = false; });
    } catch (_) { pending = false; }
  }

  window.MagicFullscreen = Object.freeze({ request });
  window.addEventListener('click', request, { passive: true });
  window.addEventListener('keydown', (event) => {
    // Native controls generate a trusted click after keyboard activation.
    if (event.target?.closest?.('button, a, [role="button"]')) return;
    if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) request(event);
  }, { passive: true });

  function explainSupport() {
    for (const note of document.querySelectorAll('[data-fullscreen-note]')) {
      note.hidden = typeof requestFullscreen === 'function';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', explainSupport, { once: true });
  else explainSupport();
})();
