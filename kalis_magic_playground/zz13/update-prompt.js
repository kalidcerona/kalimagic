/* Shared "update available" prompt. Classic script, no imports, no CSS file.
   MagicUpdate.init({ registration | registrationPromise | swUrl (one is required), safe, checkForUpdate, timeoutMs })
     Attaches to a worker registration the page already owns (preferred, never registers twice), or registers swUrl
     with updateViaCache:'none' as a convenience. checkForUpdate:true also calls registration.update().
     Returns a Promise of { ok, registered, error? }; after a failure init() may be called again.
   MagicUpdate.offer() shows the dialog only when a replacement is waiting, safe() allows it, and the performer
     has not said "later" this launch. safe is required: without it nothing is ever shown.
   MagicUpdate.hide() closes the dialog (also cancels a pending update) without counting as "later"; call it when any safe screen closes.
   The page reloads only when the worker the performer accepted becomes navigator.serviceWorker.controller, while safe() still holds. Never because time passed. */
(function (root) {
  'use strict';
  var TEXT = '새 버전이 있어요. 지금 업데이트할까요?';
  var PENDING = '업데이트하는 중이에요…';
  var RETRY = '업데이트가 아직 끝나지 않았어요. 다시 시도할까요?';
  var registration = null, safeFn = null, timeoutMs = 10000, initPromise = null, controllerBound = false;
  var declined = false, reloaded = false, pending = null;
  var dialog = null, ui = null, previousFocus = null, inerted = [], tracked = [];

  function container() { return root.navigator && root.navigator.serviceWorker; }
  function isSafe(auto) {
    if (typeof safeFn !== 'function') return false; // safe is required: without it nothing is ever shown
    try { return safeFn() === true; } catch (e) { return false; }
  }
  function waitingWorker() {
    var sw = container();
    // A page without a controller is not controlled by any worker yet (typically the first install), so there is nothing to replace.
    return registration && registration.waiting && sw && sw.controller ? registration.waiting : null;
  }
  function maybeShow() { offer(true); }
  function watch(worker) {
    if (!worker || tracked.indexOf(worker) >= 0) return;
    tracked.push(worker);
    if (worker.addEventListener) worker.addEventListener('statechange', function () { if (worker.state === 'installed') maybeShow(); });
    if (worker.state === 'installed') maybeShow();
  }
  function attach(reg, checkForUpdate) {
    registration = reg;
    if (reg.addEventListener) reg.addEventListener('updatefound', function () { watch(reg.installing); });
    watch(reg.installing);
    maybeShow();
    if (checkForUpdate && reg.update) return Promise.resolve(reg.update()).catch(function () { /* offline: keep this launch */ });
  }
  function clearPending() {
    if (pending && pending.timer !== null) root.clearTimeout(pending.timer);
    pending = null;
  }
  function setInert(on) {
    var body = root.document.body;
    if (!on) {
      inerted.forEach(function (node) { node.removeAttribute('inert'); });
      inerted = [];
      return;
    }
    Array.prototype.slice.call(body.children || []).forEach(function (node) {
      if (node === dialog || node.tagName === 'SCRIPT' || (node.hasAttribute && node.hasAttribute('inert'))) return;
      node.setAttribute('inert', '');
      inerted.push(node);
    });
  }
  function close(restoreFocus) {
    if (!dialog) return;
    var node = dialog, doc = root.document;
    dialog = null; ui = null;
    setInert(false);
    if (node.remove) node.remove();
    doc.removeEventListener('keydown', onKey, true);
    doc.removeEventListener('focusin', onFocusIn, true);
    if (restoreFocus && previousFocus && previousFocus.focus) { try { previousFocus.focus(); } catch (e) { /* ignore */ } }
    previousFocus = null;
  }
  function enabledButtons() { return ui ? [ui.later, ui.now].filter(function (b) { return !b.disabled; }) : []; }
  function toDialog() {
    var list = enabledButtons();
    (list.length ? list[list.length - 1] : ui.card).focus();
  }
  function onKey(event) {
    if (!dialog) return;
    if (event.key === 'Escape') { event.preventDefault(); if (pending) hide(); else decline(); return; } // also keeps a modal <dialog> underneath from closing
    if (event.key !== 'Tab') return;
    var list = enabledButtons(), active = root.document.activeElement, at = list.indexOf(active);
    event.preventDefault();
    if (!list.length) { ui.card.focus(); return; }
    var last = list.length - 1;
    list[event.shiftKey ? (at <= 0 ? last : at - 1) : (at < 0 || at === last ? 0 : at + 1)].focus();
  }
  function onFocusIn(event) {
    if (!dialog || !event.target || dialog === event.target) return;
    if (dialog.contains && !dialog.contains(event.target)) toDialog();
  }
  function decline() { declined = true; clearPending(); close(true); }
  function hide() { clearPending(); close(true); }
  function render(mode) {
    ui.message.textContent = mode === 'pending' ? PENDING : mode === 'retry' ? RETRY : TEXT;
    ui.now.textContent = mode === 'retry' ? '다시 시도' : '지금 업데이트';
    ui.now.disabled = ui.later.disabled = mode === 'pending';
    toDialog();
  }
  function failPending() {
    clearPending();
    if (!dialog) return;
    if (isSafe(false) && waitingWorker()) render('retry'); else close(true);
  }
  function accept() {
    var worker = waitingWorker();
    if (!worker || !ui) { close(true); return; }
    clearPending();
    pending = { worker: worker, timer: null };
    render('pending');
    try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) { failPending(); return; }
    pending.timer = root.setTimeout(failPending, timeoutMs);
  }
  function takenOver() {
    if (!pending || reloaded) return;
    var worker = pending.worker;
    var sw = container();
    if (!sw || sw.controller !== worker) return; // only the accepted worker taking control counts
    if (!isSafe(false)) { hide(); return; }
    reloaded = true;
    clearPending();
    root.location.reload();
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
  function offer(auto) {
    if (dialog || declined || !waitingWorker() || !isSafe(auto === true)) return false;
    var doc = root.document;
    previousFocus = doc.activeElement || null;
    var overlay = doc.createElement('div');
    overlay.setAttribute('data-magic-update', '');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;height:100%;max-width:none;max-height:none;margin:0;border:0;padding:16px;overflow:visible;color:inherit;background:rgba(0,0,0,.55);';
    // A manual popover sits in the top layer, so the prompt also shows above an open modal <dialog> (QR settings).
    if (overlay.showPopover) overlay.setAttribute('popover', 'manual');
    var card = doc.createElement('div');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', TEXT);
    card.setAttribute('tabindex', '-1');
    card.style.cssText = 'box-sizing:border-box;width:min(320px,100%);padding:20px 16px 16px;border-radius:14px;background:Canvas;color:CanvasText;color-scheme:light dark;box-shadow:0 8px 32px rgba(0,0,0,.4);font:16px/1.5 system-ui,sans-serif;text-align:center;outline:none;';
    var message = doc.createElement('p');
    message.setAttribute('aria-live', 'polite');
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
    if (overlay.showPopover) { try { overlay.showPopover(); } catch (e) { /* stays a fixed overlay */ } }
    ui = { card: card, message: message, later: later, now: now };
    setInert(true);
    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('focusin', onFocusIn, true);
    render('ask');
    return true;
  }
  function init(options) {
    options = options || {};
    var sw = container();
    if (initPromise) return initPromise;
    if (!sw || (root.location && root.location.protocol === 'file:')) return Promise.resolve({ ok: false, registered: false, error: 'unsupported' });
    safeFn = options.safe;
    if (typeof options.timeoutMs === 'number') timeoutMs = options.timeoutMs;
    if (!controllerBound && sw.addEventListener) { controllerBound = true; sw.addEventListener('controllerchange', takenOver); }
    if (!options.registration && !options.registrationPromise && !options.swUrl) return Promise.resolve({ ok: false, registered: false, error: 'no registration source' }); // never registers by default
    var source;
    try {
      source = options.registration ? Promise.resolve(options.registration)
        : options.registrationPromise ? Promise.resolve(options.registrationPromise)
        : sw.register(options.swUrl, { updateViaCache: 'none' });
    } catch (e) { source = Promise.reject(e); }
    initPromise = Promise.resolve(source).then(function (reg) {
      if (!reg) throw new Error('no registration');
      var checked = attach(reg, options.checkForUpdate === true);
      return Promise.resolve(checked).then(function () { return { ok: true, registered: true }; });
    }).catch(function (error) {
      initPromise = null; // a later init() may retry
      return { ok: false, registered: false, error: String(error && error.message || error) };
    });
    return initPromise;
  }
  root.MagicUpdate = { init: init, offer: function () { return offer(false); }, hide: hide };
})(typeof window !== 'undefined' ? window : globalThis);
