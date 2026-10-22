// Keep native install prompts tied to a user gesture; use the house manual steps otherwise.
(() => {
  const sheet = document.getElementById('installSheet');
  const help = document.getElementById('installHelp');
  const entry = document.getElementById('openInstall');
  const mode = window.matchMedia('(display-mode: standalone)');
  let deferred = null, installed = false, revision = 0;
  const standalone = () => installed || mode.matches || navigator.standalone === true;
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const remember = () => { try { localStorage.setItem('kc.install.dismissed','1'); } catch {} };
  function steps() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    help.textContent = ios
      ? 'Safari에서 이 주소를 열고 공유 → 홈 화면에 추가를 눌러 주세요. 웹 앱으로 열기가 보이면 켜 주세요.'
      : 'Chrome 메뉴에서 앱 설치를 선택해 주세요. 설치 후 홈 화면의 아이콘으로 실행해 주세요.';
  }
  function refresh() {
    entry.hidden = standalone();
    if (standalone() && sheet.open) sheet.close();
  }
  function show() {
    if (standalone()) return refresh();
    steps();
    if (!sheet.open) sheet.showModal();
  }
  window.addEventListener('beforeinstallprompt', event => {
    if (standalone() || typeof event.prompt !== 'function') return;
    event.preventDefault(); deferred = event; revision++;
  });
  window.addEventListener('appinstalled', () => {
    installed = true; deferred = null; revision++; remember(); refresh();
  });
  mode.addEventListener?.('change', refresh);
  document.getElementById('installApp').addEventListener('click', async () => {
    if (standalone()) return refresh();
    const prompt = deferred, current = revision;
    deferred = null;
    if (prompt) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (current !== revision || standalone()) return;
        if (choice?.outcome === 'accepted') {
          remember(); sheet.close(); return;
        }
      } catch {}
    }
    steps();
  });
  document.getElementById('installLater').addEventListener('click', () => { remember(); sheet.close(); });
  sheet.addEventListener('cancel', remember);
  entry.addEventListener('click', () => {
    document.getElementById('settings').close(); show();
  });
  refresh();
  if (!standalone() && !read('kc.install.dismissed') && !read('kc.install.seen')) {
    try { localStorage.setItem('kc.install.seen','1'); } catch {}
    show();
  }
})();
