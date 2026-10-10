const card = document.querySelector('[data-install-card]');
const button = card?.querySelector('[data-install-button]');
const guidance = card?.querySelector('[data-install-guidance]');
let installEvent = null;
let installRevision = 0;

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function hideCard() {
  if (card) card.hidden = true;
}

function describeManualInstall() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const chromeIos = /CriOS/i.test(ua);
  const safariIos = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

  if (safariIos) {
    guidance.textContent = 'Safari의 공유 버튼을 누른 다음 “홈 화면에 추가”를 선택하세요.';
  } else if (chromeIos) {
    guidance.textContent = 'Chrome의 공유 버튼을 누른 다음 “홈 화면에 추가”를 선택하세요.';
  } else {
    guidance.textContent = 'Chrome 메뉴(⋮)에서 “앱 설치” 또는 “홈 화면에 추가”를 선택하세요.';
  }
}

if (card && button && guidance) {
  if (isInstalled()) hideCard();
  else describeManualInstall();

  window.addEventListener('beforeinstallprompt', (event) => {
    if (isInstalled()) return;
    event.preventDefault();
    installRevision += 1;
    installEvent = event;
    button.hidden = false;
    guidance.textContent = '버튼을 눌러 이 앱을 설치하세요.';
  });

  button.addEventListener('click', async () => {
    if (installEvent) {
      const revision = installRevision;
      const promptEvent = installEvent;
      installEvent = null;
      button.hidden = true;
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (revision !== installRevision || card.hidden) return;
        if (choice?.outcome === 'accepted') {
          guidance.textContent = '설치 요청을 보냈습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.';
        } else describeManualInstall();
      } catch {
        if (revision !== installRevision || card.hidden) return;
        describeManualInstall();
      }
      return;
    }
    describeManualInstall();
  });

  window.addEventListener('appinstalled', () => {
    installRevision += 1;
    installEvent = null;
    if (isInstalled()) return hideCard();
    button.hidden = true;
    guidance.textContent = '설치 요청을 받았습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.';
  });
}
