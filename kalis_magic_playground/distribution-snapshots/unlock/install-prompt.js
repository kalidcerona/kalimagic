export function installStorageKey(pathname) {
  return (/^\/tools\/(?:unlock|release)\//).test(pathname) ? 'unlock-install-shared-v1' : 'unlock-install-personal-v1';
}

export function shouldOfferInstall({ userAgent, standalone, dismissed }) {
  return !standalone && !dismissed && /Android|iPhone|iPad|iPod/i.test(userAgent);
}

export function installInstructions(userAgent) {
  if (/Android/i.test(userAgent)) return 'Chrome 메뉴 ⋮ → 홈 화면에 추가 또는 앱 설치를 선택하세요.';
  if (/iPhone|iPad|iPod/i.test(userAgent) && /CriOS/i.test(userAgent)) return 'Chrome 공유(□↑) → 홈 화면에 추가를 선택하세요.';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'Safari 공유(□↑) → 홈 화면에 추가를 선택하세요.';
  return '브라우저 메뉴에서 홈 화면에 추가를 선택하세요.';
}

function setupInstallPrompt() {
  const offer = document.getElementById('install-offer');
  if (!offer) return;
  const userAgent = navigator.userAgent || '';
  const key = installStorageKey(location.pathname);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let dismissed = false;
  try { dismissed = localStorage.getItem(key) === '1'; } catch {}
  if (!shouldOfferInstall({ userAgent, standalone, dismissed })) return;

  const action = document.getElementById('install-action');
  const later = document.getElementById('install-later');
  const instructions = document.getElementById('install-instructions');
  let deferredPrompt = null;
  let installRevision = 0;
  offer.hidden = false;

  const finish = () => {
    installRevision += 1;
    offer.hidden = true;
    deferredPrompt = null;
    try { localStorage.setItem(key, '1'); } catch {}
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    if (offer.hidden) return;
    event.preventDefault();
    installRevision += 1;
    deferredPrompt = event;
    action.textContent = '설치';
  });
  window.addEventListener('appinstalled', () => {
    installRevision += 1;
    deferredPrompt = null;
    if (offer.hidden) return;
    action.textContent = '설치 방법';
    instructions.textContent = '설치 요청을 받았습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.';
    instructions.hidden = false;
  });
  later.addEventListener('click', finish);
  action.addEventListener('click', async () => {
    if (!deferredPrompt) {
      instructions.textContent = installInstructions(userAgent);
      instructions.hidden = false;
      return;
    }
    if (offer.hidden) return;
    const revision = installRevision;
    const prompt = deferredPrompt;
    deferredPrompt = null;
    try {
      const choice = await prompt.prompt();
      const outcome = prompt.userChoice ? await prompt.userChoice : choice;
      if (revision !== installRevision || offer.hidden) return;
      if (outcome?.outcome === 'accepted') {
        if (offer.hidden) return;
        action.textContent = '설치 방법';
        instructions.textContent = '설치 요청을 보냈습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.';
        instructions.hidden = false;
      }
      else {
        action.textContent = '설치 방법';
        instructions.textContent = installInstructions(userAgent);
        instructions.hidden = false;
      }
    } catch {
      if (revision !== installRevision || offer.hidden) return;
      action.textContent = '설치 방법';
      instructions.textContent = installInstructions(userAgent);
      instructions.hidden = false;
    }
  });
}

if (typeof document !== 'undefined') setupInstallPrompt();
