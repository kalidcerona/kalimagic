/* Choice-only one-shot notice. The local update controller arms it immediately before reload. */
(function (root) {
  'use strict';
  var KEY = 'choice-updated-notice';
  var TEXT = '방금 업데이트됐어요. 한 번 테스트해 보고 공연하세요';
  function readOnce() {
    try {
      if (root.sessionStorage.getItem(KEY) !== '1') return false;
      root.sessionStorage.removeItem(KEY);
      return true;
    } catch (e) { return false; }
  }
  function show() {
    if (!readOnce()) return;
    var doc = root.document;
    var note = doc.createElement('p');
    note.textContent = TEXT;
    note.setAttribute('role', 'status');
    note.setAttribute('data-choice-update-notice', '');
    note.style.cssText = 'position:fixed;left:50%;bottom:max(16px, env(safe-area-inset-bottom));transform:translateX(-50%);z-index:20;margin:0;max-width:min(280px, calc(100% - 32px));padding:6px 10px;border-radius:8px;background:rgba(40,28,24,.72);color:#f4efe9;font:400 12px/1.4 system-ui,sans-serif;text-align:center;pointer-events:none;opacity:1;transition:opacity .4s ease;';
    (doc.body || doc.documentElement).appendChild(note);
    var reduce = false;
    try { reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
    root.setTimeout(function () {
      if (!note.parentNode) return;
      if (reduce) { note.remove(); return; }
      note.style.opacity = '0';
      root.setTimeout(function () { if (note.remove) note.remove(); }, 400);
    }, 3000);
  }
  if (docReady(root.document)) show();
  else root.document.addEventListener('DOMContentLoaded', show);
  function docReady(doc) { return doc.readyState !== 'loading'; }
})(typeof window !== 'undefined' ? window : globalThis);
