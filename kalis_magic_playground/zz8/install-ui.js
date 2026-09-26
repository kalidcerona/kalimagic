// Install affordance is visible only in settings and only in a browser tab.
const installControl = document.getElementById("install-control");
const installButton = document.getElementById("install-app");
const installHelp = document.getElementById("install-help");
let installPrompt = null;

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function refreshInstallControl() {
  installControl.hidden = isInstalled();
}

function showInstallHelp(message) {
  installHelp.textContent = message;
  installHelp.hidden = false;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  refreshInstallControl();
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installControl.hidden = true;
});
window.matchMedia("(display-mode: standalone)").addEventListener?.("change", refreshInstallControl);

installButton.addEventListener("click", async () => {
  if (isInstalled()) return refreshInstallControl();
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === "accepted") return;
    } catch {
      // Fall through to the browser's manual installation path.
    }
  }
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  showInstallHelp(ios
    ? "iPhone·iPad에서는 Safari 또는 Chrome의 공유 버튼 → 홈 화면에 추가를 누르세요."
    : "브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하세요. HTTPS 또는 localhost 주소가 필요합니다.");
});

refreshInstallControl();
