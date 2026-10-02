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
  let installRevision = 0;
  panel.hidden = false;

  const showInstructions = () => {
    instructions.textContent = installInstructions(userAgent, platform, maxTouchPoints);
    instructions.hidden = false;
    action.hidden = true;
  };
  const showPending = () => {
    installRevision += 1;
    deferredPrompt = null;
    if (panel.hidden) return;
    action.hidden = true;
    instructions.textContent = "설치 요청을 받았습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.";
    instructions.hidden = false;
  };

  showInstructions();
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installRevision += 1;
    deferredPrompt = event;
    action.hidden = false;
    instructions.hidden = true;
  });
  window.addEventListener("appinstalled", showPending);
  action.addEventListener("click", async () => {
    if (!deferredPrompt) {
      showInstructions();
      return;
    }
    const revision = installRevision;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (revision !== installRevision || panel.hidden) return;
      if (choice?.outcome === "accepted") {
        if (panel.hidden) return;
        action.hidden = true;
        instructions.textContent = "설치 요청을 보냈습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.";
        instructions.hidden = false;
      }
      else showInstructions();
    } catch {
      if (revision !== installRevision || panel.hidden) return;
      showInstructions();
    }
  });
}

if (typeof document !== "undefined") setupInstallPrompt();
