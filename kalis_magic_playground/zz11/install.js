export function installAppPrompt() {
  let installPrompt = null;
  let installRevision = 0;
  function standaloneDisplay() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function syncInstallGroup() {
    const group = document.getElementById('install-app-group');
    const hide = standaloneDisplay();
    group.hidden = hide;
    group.classList.toggle('is-installed', hide);
    group.dataset.installState = hide ? 'hidden' : 'browser';
    document.documentElement.classList.toggle('spinner-standalone', hide);
  }

  window.addEventListener('beforeinstallprompt', event => { if (standaloneDisplay()) return; event.preventDefault(); installRevision += 1; installPrompt = event; syncInstallGroup(); });
  document.getElementById('install-app').addEventListener('click', async () => {
    const help = document.getElementById('install-help');
    if (standaloneDisplay()) return syncInstallGroup();
    if (installPrompt && window.__magicInstallPrompt === null) installPrompt = null; // settings-ui.js sets the shared slot to null once its button used the event; an absent settings-ui leaves it undefined
    if (installPrompt) {
      const revision = installRevision;
      const prompt = installPrompt; installPrompt = null;
      if (window.__magicInstallPrompt === prompt) window.__magicInstallPrompt = null; // the settings button shares this one-shot event
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (revision !== installRevision || standaloneDisplay()) return;
        if (choice?.outcome === 'accepted') { help.textContent = '설치 요청을 보냈습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.'; help.hidden = false; return; }
      } catch { if (revision !== installRevision || standaloneDisplay()) return; /* Use manual instructions. */ }
    }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    help.textContent = ios ? 'Safari에서 공유 → 홈 화면에 추가를 선택하세요.' : '브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하세요.';
    help.hidden = false;
  });
  syncInstallGroup();
  window.addEventListener('appinstalled', () => {
    installRevision += 1;
    installPrompt = null;
    syncInstallGroup();
    if (!standaloneDisplay()) {
      const help = document.getElementById('install-help');
      help.textContent = '설치 요청을 받았습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.';
      help.hidden = false;
    }
  });
  const standaloneMedia = window.matchMedia('(display-mode: standalone)');
  const onStandaloneChange = () => syncInstallGroup();
  if (typeof standaloneMedia.addEventListener === 'function') standaloneMedia.addEventListener('change', onStandaloneChange);
  else standaloneMedia.addListener(onStandaloneChange);
}
