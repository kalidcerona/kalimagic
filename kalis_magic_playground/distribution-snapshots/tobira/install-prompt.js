export function shouldOfferInstall({ standalone }) {
  return !standalone;
}

export function isIOSDevice(userAgent = "", platform = "", maxTouchPoints = 0) {
  return /iPhone|iPad|iPod/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

export function installInstructions(userAgent = "", platform = "", maxTouchPoints = 0) {
  const iosDevice = isIOSDevice(userAgent, platform, maxTouchPoints);
  if (iosDevice && /CriOS/i.test(userAgent)) {
    return "Chrome 공유 버튼을 누르고 ‘홈 화면에 추가’를 선택하세요.";
  }
  if (iosDevice) {
    return "Safari 공유 버튼을 누르고 ‘홈 화면에 추가’를 선택하세요.";
  }
  if (/Android/i.test(userAgent)) {
    return "Chrome 메뉴 ⋮에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.";
  }
  if (/Chrome|Chromium/i.test(userAgent)) {
    return "주소 표시줄의 설치 아이콘 또는 Chrome 메뉴 ⋮에서 설치를 선택하세요.";
  }
  return "브라우저 메뉴에서 ‘홈 화면에 추가’ 또는 ‘설치’를 선택하세요.";
}

function setupInstallPrompt() {
  const panel = document.querySelector("#install-panel, .install-panel");
  const action = document.querySelector("#install-action, [data-install-action]");
  const instructions = document.querySelector("#install-instructions, [data-install-instructions]");
  if (!panel || !action || !instructions) return;
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (!shouldOfferInstall({ standalone })) return;

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  let deferredPrompt = null;
  panel.hidden = false;

  const showInstructions = () => {
    instructions.textContent = installInstructions(userAgent, platform, maxTouchPoints);
    instructions.hidden = false;
    action.hidden = true;
  };
  const finish = () => {
    panel.hidden = true;
    deferredPrompt = null;
  };

  showInstructions();
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    action.hidden = false;
    instructions.hidden = true;
  });
  window.addEventListener("appinstalled", finish);
  action.addEventListener("click", async () => {
    if (!deferredPrompt) {
      showInstructions();
      return;
    }
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice?.outcome === "accepted") finish();
      else showInstructions();
    } catch {
      showInstructions();
    }
  });
}

if (typeof document !== "undefined") setupInstallPrompt();
