const card = document.querySelector('[data-install-card]');
const button = card?.querySelector('[data-install-button]');
const guidance = card?.querySelector('[data-install-guidance]');
let installEvent = null;

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
    event.preventDefault();
    installEvent = event;
    button.hidden = false;
    guidance.textContent = '버튼을 눌러 이 앱을 설치하세요.';
  });

  button.addEventListener('click', async () => {
    if (installEvent) {
      const promptEvent = installEvent;
      installEvent = null;
      await promptEvent.prompt();
      await promptEvent.userChoice;
      return;
    }
    describeManualInstall();
  });

  window.addEventListener('appinstalled', hideCard);
}
