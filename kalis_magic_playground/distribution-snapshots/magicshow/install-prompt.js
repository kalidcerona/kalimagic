// Based on Choice's deferred install event and revision guard; no game state is changed.
(() => {
  const KEY = 'magicshow.install.last-offer';
  const RETRY_MS = 3 * 24 * 60 * 60 * 1000;
  const ua = navigator.userAgent;
  const ipad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const ios = ipad || /iPhone|iPod/i.test(ua);
  const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line\//i.test(ua);
  const safari = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  const android = /Android/i.test(ua);
  const media = ['fullscreen', 'standalone'].map(mode => window.matchMedia(`(display-mode: ${mode})`));
  let installEvent = null, revision = 0, installedSignal = false, previousFocus = null;
  const installed = () => installedSignal || navigator.standalone === true || media.some(item => item.matches);
  const canInstall = () => inApp || safari || (android && /Chrome|SamsungBrowser/i.test(ua)) || !!installEvent;
  const overlay = document.createElement('div');
  overlay.id = 'magicshow-install-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="magicshow-install-title" class="magicshow-install-card">
    <button type="button" data-close aria-label="닫기" class="magicshow-install-close">×</button>
    <h2 id="magicshow-install-title">홈 화면에 설치하기</h2>
    <p>홈 화면에 추가하면 앱처럼 가로 전체 화면으로 즐길 수 있어요.</p>
    <div data-guide></div>
    <p data-status aria-live="polite"></p>
    <div class="magicshow-install-actions"><button type="button" data-install>설치</button><button type="button" data-copy hidden>링크 복사</button><button type="button" data-later>나중에</button></div>
  </section><div data-arrow class="magicshow-install-arrow" hidden aria-hidden="true"></div>`;
  document.body.appendChild(overlay);
  const find = selector => overlay.querySelector(selector);
  const action = find('[data-install]'), guide = find('[data-guide]'), status = find('[data-status]');
  const copy = find('[data-copy]'), arrow = find('[data-arrow]');
  function remember() { try { localStorage.setItem(KEY, String(Date.now())); } catch {} }
  function due() {
    try {
      const value = localStorage.getItem(KEY);
      const last = Number(value);
      return value === null || !Number.isFinite(last) || Date.now() - last >= RETRY_MS;
    } catch { return true; }
  }
  function describe() {
    arrow.hidden = true;
    copy.hidden = !inApp;
    action.hidden = false;
    action.textContent = inApp ? '브라우저로 열기' : '설치';
    if (inApp) {
      guide.textContent = ios ? 'Safari로 이 링크를 열어 주세요. 링크를 복사한 뒤 Safari 주소창에 붙여 넣으면 돼요.'
        : /KAKAOTALK/i.test(ua) ? '브라우저로 열기를 누르면 Chrome으로 연결해요. 열리지 않으면 ⋮ → 다른 브라우저로 열기를 선택해 주세요.'
        : '⋮ → 다른 브라우저로 열기를 선택해 주세요. 링크를 복사해 Chrome에 붙여 넣어도 돼요.';
    } else if (safari) {
      guide.innerHTML = '<ol class="magicshow-install-steps"><li><b>□↑</b><span>Safari 공유 버튼</span></li><li><b>＋</b><span>홈 화면에 추가</span></li><li><b>추가</b><span>오른쪽 위 추가</span></li></ol>';
      arrow.className = `magicshow-install-arrow ${ipad ? 'is-ipad' : 'is-iphone'}`;
      arrow.textContent = ipad ? '↑ □↑ 공유' : '□↑ 공유 ↓';
      arrow.hidden = overlay.hidden;
    } else if (installEvent) {
      guide.textContent = '설치를 누르면 브라우저의 설치 창이 열려요.';
    } else {
      guide.textContent = /SamsungBrowser/i.test(ua) ? '삼성 인터넷 메뉴(☰) → 현재 페이지 추가 → 홈 화면을 선택해 주세요.'
        : ios ? 'Safari로 열고 공유(□↑) → 홈 화면에 추가 → 추가를 선택해 주세요.'
        : 'Chrome 메뉴(⋮) → 앱 설치 또는 홈 화면에 추가를 선택해 주세요.';
    }
  }
  function refresh() {
    if (installed()) { overlay.hidden = true; arrow.hidden = true; }
    else describe();
  }
  function open(automatic = false) {
    if (installed()) return;
    previousFocus = document.activeElement;
    overlay.hidden = false;
    status.textContent = '';
    describe();
    if (automatic) remember();
    find('[data-close]').focus();
  }
  function close() {
    remember();
    overlay.hidden = true;
    arrow.hidden = true;
    previousFocus?.focus();
  }
  document.addEventListener('click', event => {
    if (installed() || !event.target?.closest?.('#installButton')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  }, true);
  find('[data-close]').addEventListener('click', close);
  find('[data-later]').addEventListener('click', close);
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const buttons = [...overlay.querySelectorAll('button')].filter(button => !button.hidden);
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); status.textContent = '링크를 복사했어요. 브라우저 주소창에 붙여 넣어 주세요.'; }
    catch { status.textContent = '주소창의 링크를 길게 눌러 복사해 주세요.'; }
  });
  action.addEventListener('click', async () => {
    if (installed()) return refresh();
    if (inApp) {
      if (android && /KAKAOTALK/i.test(ua)) {
        const url = new URL(location.href);
        if (url.protocol === 'https:' || url.protocol === 'http:') {
          location.href = `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
        }
      } else status.textContent = ios ? '링크를 복사한 뒤 Safari에서 열어 주세요.' : '⋮ → 다른 브라우저로 열기를 선택해 주세요.';
      return;
    }
    if (!installEvent) return describe();
    const event = installEvent, current = revision;
    installEvent = null;
    action.disabled = true;
    try {
      // Called synchronously from the tap, before any await, to retain user activation.
      await event.prompt();
      const choice = await event.userChoice;
      if (current !== revision || installed() || overlay.hidden) return;
      if (choice?.outcome === 'accepted') status.textContent = '설치 요청을 보냈어요. 홈 화면의 앱 아이콘을 확인해 주세요.';
      else { remember(); describe(); }
    } catch {
      if (current === revision && !installed() && !overlay.hidden) describe();
    } finally { action.disabled = false; }
  });
  window.addEventListener('beforeinstallprompt', event => {
    if (installed() || inApp) return;
    event.preventDefault();
    revision++;
    installEvent = event;
    refresh();
  });
  window.addEventListener('appinstalled', () => {
    revision++;
    installEvent = null;
    installedSignal = true;
    refresh();
  });
  for (const query of media) {
    if (query.addEventListener) query.addEventListener('change', refresh);
    else query.addListener?.(refresh);
  }
  refresh();
  if (due()) open(true);
})();
