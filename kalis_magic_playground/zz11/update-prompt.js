/* Shared "update available" prompt. Classic script, no imports, no CSS file.
   Window.MagicUpdate.init({ swUrl, safe }) registers the worker and tracks a waiting replacement.
   MagicUpdate.offer() shows the dialog only when a replacement is waiting and the performer has not said "later" this launch.
   safe() (optional, default never) lets init() show it by itself, only while it returns true.
   MagicUpdate.hide() closes the dialog without counting as "later". The page never reloads unless the performer taps update. */
(function (root) {
  'use strict';
  var TEXT = '새 버전이 있어요. 지금 업데이트할까요?';
  var registration = null, safeFn = null, started = false;
  var declined = false, wantReload = false, reloaded = false;
  var dialog = null, previousFocus = null;

  function container() { return root.navigator && root.navigator.serviceWorker; }
  function waitingWorker() {
    var sw = container();
    // Without a controller this is the first install: nothing to replace.
    return registration && registration.waiting && sw && sw.controller ? registration.waiting : null;
  }
  function maybeShow() {
    var ok = false;
    try { ok = typeof safeFn === 'function' && safeFn() === true; } catch (e) { ok = false; }
    if (ok) offer();
  }
  function track(reg) {
    if (reg.addEventListener) reg.addEventListener('updatefound', function () {
      var worker = reg.installing;
      if (worker) worker.addEventListener('statechange', function () { if (worker.state === 'installed') maybeShow(); });
    });
  }
  function close(restoreFocus) {
    if (!dialog) return;
    var node = dialog;
    dialog = null;
    if (node.remove) node.remove();
    root.document.removeEventListener('keydown', onKey, true);
    if (restoreFocus && previousFocus && previousFocus.focus) { try { previousFocus.focus(); } catch (e) { /* ignore */ } }
    previousFocus = null;
  }
  function onKey(event) { if (event.key === 'Escape') decline(); }
  function decline() { declined = true; close(true); }
  function accept() {
    var worker = waitingWorker();
    if (!worker) { close(true); return; }
    wantReload = true;
    close(false);
    worker.postMessage({ type: 'SKIP_WAITING' });
  }
  function button(label, primary, onClick) {
    var el = root.document.createElement('button');
    el.type = 'button';
    el.textContent = label;
    el.style.cssText = 'flex:1 1 0;min-height:48px;min-width:44px;padding:0 12px;border-radius:10px;font:600 16px/1.2 system-ui,sans-serif;cursor:pointer;' +
      (primary ? 'border:0;background:#2563eb;color:#fff;' : 'border:1px solid GrayText;background:transparent;color:CanvasText;');
    el.addEventListener('click', onClick);
    return el;
  }
  function offer() {
    if (dialog || declined || !waitingWorker()) return false;
    var doc = root.document;
    previousFocus = doc.activeElement || null;
    var overlay = doc.createElement('div');
    overlay.setAttribute('data-magic-update', '');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55);';
    var card = doc.createElement('div');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', TEXT);
    card.style.cssText = 'box-sizing:border-box;width:min(320px,100%);padding:20px 16px 16px;border-radius:14px;background:Canvas;color:CanvasText;color-scheme:light dark;box-shadow:0 8px 32px rgba(0,0,0,.4);font:16px/1.5 system-ui,sans-serif;text-align:center;';
    var message = doc.createElement('p');
    message.textContent = TEXT;
    message.style.cssText = 'margin:0 0 16px;word-break:keep-all;';
    var row = doc.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;';
    var later = button('나중에', false, decline);
    var now = button('지금 업데이트', true, accept);
    row.appendChild(later);
    row.appendChild(now);
    card.appendChild(message);
    card.appendChild(row);
    overlay.appendChild(card);
    (doc.body || doc.documentElement).appendChild(overlay);
    dialog = overlay;
    doc.addEventListener('keydown', onKey, true);
    if (now.focus) now.focus();
    return true;
  }
  function init(options) {
    var sw = container();
    options = options || {};
    if (started || !sw || (root.location && root.location.protocol === 'file:')) return;
    started = true;
    safeFn = options.safe;
    if (sw.addEventListener) sw.addEventListener('controllerchange', function () {
      if (!wantReload || reloaded) return;
      reloaded = true;
      root.location.reload();
    });
    try {
      Promise.resolve(sw.register(options.swUrl || './sw.js', { updateViaCache: 'none' })).then(function (reg) {
        registration = reg;
        track(reg);
        maybeShow();
        return reg.update && reg.update();
      }).catch(function () { /* Registration failure leaves this launch as it is. */ });
    } catch (e) { /* ignore */ }
  }
  root.MagicUpdate = { init: init, offer: offer, hide: function () { close(true); } };
})(typeof window !== 'undefined' ? window : globalThis);
