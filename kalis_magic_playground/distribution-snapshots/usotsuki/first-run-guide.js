(function (root) {
  'use strict';

  function normalizePath(pathname) {
    return String(pathname || '/').replace(/\/index\.html$/i, '').replace(/\/+$/, '') || '/';
  }

  function appGuide(doc) {
    var app = doc.body && doc.body.dataset ? doc.body.dataset.magicApp : '';
    var title = String(doc.title || '').trim();
    if (app === 'usotsuki') {
      return {
        app: 'usotsuki',
        title: '설정 여는 방법',
        text: '손가락 두 개를 대고\n아래로 쓸어내리세요.\n설정 화면이 열립니다.'
      };
    }
    if (title.indexOf('멤덱 연습실') !== -1) {
      return {
        app: 'memdeck',
        title: '설정 여는 방법',
        text: '화면 위 메뉴에서\n설정을 누르세요.'
      };
    }
    if (app === 'arosaegida' || title.indexOf('QR 코드 랜덤 생성기') !== -1) {
      return {
        app: 'arosaegida',
        title: '설정 여는 방법',
        text: '손가락 두 개를 대고\n아래로 쓸어내리세요.\n설정 화면이 열립니다.'
      };
    }
    return null;
  }

  function installStyles(doc) {
    if (doc.getElementById('first-run-guide-styles')) return;
    var style = doc.createElement('style');
    style.id = 'first-run-guide-styles';
    style.textContent = [
      '.first-run-guide{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;box-sizing:border-box;padding:max(20px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));background:rgba(8,10,14,.88);color:#fff;font-family:system-ui,-apple-system,sans-serif;text-align:center;overscroll-behavior:contain;touch-action:manipulation}',
      '.first-run-guide[hidden]{display:none!important}',
      '.first-run-guide__card{width:min(100%,360px);max-height:calc(100dvh - 40px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow:auto;box-sizing:border-box;padding:24px 22px;border:1px solid rgba(255,255,255,.2);border-radius:20px;background:#1a1b20;box-shadow:0 18px 54px rgba(0,0,0,.45)}',
      '.first-run-guide__mark{position:relative;display:flex;justify-content:center;gap:8px;width:72px;height:72px;box-sizing:border-box;margin:0 auto 16px;padding-top:10px}',
      '.first-run-guide__finger{display:block;width:14px;height:27px;border:2px solid currentColor;border-radius:999px;animation:first-run-guide-swipe 1.7s ease-in-out infinite}',
      '.first-run-guide__finger:nth-child(2){animation-delay:.08s}',
      '.first-run-guide__arrow{position:absolute;bottom:6px;width:2px;height:20px;border-radius:2px;background:currentColor;animation:first-run-guide-swipe 1.7s ease-in-out infinite}',
      '.first-run-guide__arrow:after{position:absolute;bottom:0;left:-4px;width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;content:"";transform:rotate(45deg)}',
      '@keyframes first-run-guide-swipe{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}',
      '.first-run-guide__card h2{margin:0 0 12px;font-size:1.35rem;line-height:1.25}',
      '.first-run-guide__card p{margin:0 0 22px;font-size:1rem;line-height:1.6;white-space:pre-line;word-break:keep-all;overflow-wrap:anywhere}',
      '.first-run-guide__card button{min-width:120px;min-height:48px;padding:10px 18px;border:0;border-radius:12px;background:#fff;color:#17181c;font-family:inherit;font-size:1rem;font-weight:700;line-height:1.2;cursor:pointer;touch-action:manipulation}',
      '.first-run-guide__card button:focus-visible{outline:3px solid #f3c66d;outline-offset:3px}',
      '@media(max-width:320px){.first-run-guide{padding-left:12px;padding-right:12px}.first-run-guide__card{padding:20px 16px}}',
      '@media(prefers-reduced-motion:reduce){.first-run-guide__finger,.first-run-guide__arrow{animation:none}}'
    ].join('\n');
    doc.head.appendChild(style);
  }

  function showGuide(doc, config, pathname) {
    var key = 'first-settings-guide:v1:' + config.app + ':' + normalizePath(pathname);
    try { if (root.localStorage.getItem(key) === '1') return; } catch (_) {}
    installStyles(doc);

    var previousFocus = doc.activeElement;
    var overlay = doc.createElement('div');
    overlay.className = 'first-run-guide';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'first-run-guide-title');
    overlay.setAttribute('aria-describedby', 'first-run-guide-text');
    var card = doc.createElement('section');
    card.className = 'first-run-guide__card';
    var mark = doc.createElement('div');
    mark.className = 'first-run-guide__mark';
    mark.setAttribute('aria-hidden', 'true');
    if (config.app === 'memdeck') {
      mark.textContent = '≡';
      mark.style.alignItems = 'center';
      mark.style.fontSize = '30px';
    } else {
      for (var fingerIndex = 0; fingerIndex < 2; fingerIndex += 1) {
        var finger = doc.createElement('span');
        finger.className = 'first-run-guide__finger';
        mark.appendChild(finger);
      }
      var arrow = doc.createElement('span');
      arrow.className = 'first-run-guide__arrow';
      mark.appendChild(arrow);
    }
    var heading = doc.createElement('h2');
    heading.id = 'first-run-guide-title';
    heading.textContent = config.title;
    var paragraph = doc.createElement('p');
    paragraph.id = 'first-run-guide-text';
    paragraph.textContent = config.text;
    var dismiss = doc.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = '알겠어요';
    card.appendChild(mark);
    card.appendChild(heading);
    card.appendChild(paragraph);
    card.appendChild(dismiss);
    overlay.appendChild(card);
    doc.body.appendChild(overlay);

    function close() {
      overlay.remove();
      try { root.localStorage.setItem(key, '1'); } catch (_) {}
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    }
    dismiss.addEventListener('click', close, { once: true });
    ['pointerdown', 'touchstart', 'click', 'wheel'].forEach(function (type) {
      overlay.addEventListener(type, function (event) { event.stopPropagation(); }, { passive: type !== 'touchstart' });
    });
    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      event.preventDefault();
      dismiss.focus();
    });
    dismiss.focus();
  }

  function start() {
    var doc = root.document;
    if (!doc || !doc.body) return;
    var config = appGuide(doc);
    if (!config) return;
    if (config.app === 'memdeck') {
      var studyTab = doc.querySelector('[data-tab="study"]');
      if (!studyTab || !studyTab.classList.contains('active')) return;
    }
    if (config.app === 'arosaegida') {
      var settings = doc.getElementById('settings');
      if (!settings || settings.open) return;
    }
    showGuide(doc, config, root.location && root.location.pathname);
  }

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
})(typeof window === 'undefined' ? globalThis : window);
