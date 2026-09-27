const installControls = [
  ["setup-install-control", "setup-install-app", "setup-install-help"],
  ["install-control", "install-app", "install-help"],
].map(([controlId, buttonId, helpId]) => ({
  control: document.getElementById(controlId),
  button: document.getElementById(buttonId),
  help: document.getElementById(helpId),
}));
let installPrompt = null;
let installedInTab = false;

function isInstalled() {
  return installedInTab || window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function refreshInstallControl() {
  installControls.forEach(({ control }) => { control.hidden = isInstalled(); });
}

function showInstallHelp(message) {
  installControls.forEach(({ help }) => {
    help.textContent = message;
    help.hidden = false;
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  refreshInstallControl();
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installedInTab = true;
  refreshInstallControl();
});
window.matchMedia("(display-mode: standalone)").addEventListener?.("change", refreshInstallControl);

async function requestInstall() {
  if (isInstalled()) return refreshInstallControl();
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === "accepted") {
        showInstallHelp("설치가 진행 중입니다. 완료되면 앱 아이콘으로 ALTER를 열어 주세요.");
        return;
      }
    } catch {
      // Fall through to the browser's manual installation path.
    }
  }
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  showInstallHelp(ios
    ? "iPhone·iPad: Safari에서 이 주소를 열고 공유 버튼 → ‘홈 화면에 추가’를 선택하세요. 설치 후 홈 화면 아이콘으로 실행하세요."
    : "브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요. 설치 메뉴가 없으면 HTTPS 주소에서 다시 열어 주세요.");
}

installControls.forEach(({ button }) => button.addEventListener("click", requestInstall));

refreshInstallControl();
