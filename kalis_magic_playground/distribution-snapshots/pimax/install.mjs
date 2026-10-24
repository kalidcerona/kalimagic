import {
  main,
  chunks,
} from "./state.mjs";
import {
  deferredPrompt,
  installed,
  installHelp,
  showInstallSheet,
  closeInstallSheet,
  moveFocusToInstallSheet,
} from "./app.mjs";

export {
  standaloneDisplay,
  promptReady,
  installPanel,
  installSheetOpen,
  installSheetHtml,
  pageConcealed,
  installSheetElement,
  disarmPageReveal,
  armPageReveal,
  syncInstallLayer,
  onKeyDown,
};

function standaloneDisplay() {
  let mode = false;
  try {
    if (typeof window.matchMedia === "function") mode = window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: window-controls-overlay)").matches;
  } catch {}
  return mode || (typeof navigator !== "undefined" && navigator.standalone === true);
}
function promptReady(event) {
  return !!event && event.isTrusted !== false && typeof event.prompt === "function" && !!event.userChoice && typeof event.userChoice.then === "function";
}
function installLines() {
  const nav = typeof navigator === "undefined" ? {} : navigator;
  const ua = String(nav.userAgent || ""), touch = Number(nav.maxTouchPoints) || 0;
  const ios = /iPad|iPhone|iPod/.test(ua) || (String(nav.platform || "") === "MacIntel" && touch > 1);
  if (ios) {
    if (/CriOS|FxiOS|EdgiOS/.test(ua)) return ["지금 브라우저에서는 설치 창이 안 열릴 수 있어요.", "Safari로 이 주소를 연 뒤 공유, 홈 화면에 추가를 눌러 주세요."];
    return ["Safari 아래의 공유 버튼을 누르고", "홈 화면에 추가를 눌러 주세요.", "‘웹 앱으로 열기’가 보이면 켜 주세요."];
  }
  if (/Android/i.test(ua)) return ["앱 설치 버튼이 없으면 Chrome 메뉴에서", "‘앱 설치’를 눌러 주세요.", "‘홈 화면에 추가’는 바로가기일 수 있어요."];
  return ["설치 창이 없으면 브라우저 메뉴에서", "‘앱 설치’를 확인해 주세요."];
}

let installLayerOpen = false;
let installReturnFocus = null;
let pageRevealWatch = null;

const installInertNodes = new Set();
function installPanel() {
  if (installed || standaloneDisplay()) return "";
  return `<section class="panel install-card" data-install-card>
        <h3>홈 화면에 설치</h3>
        ${chunks(["홈 화면에 설치하면 공연 중에도 바로 열 수 있어요."])}
        ${chunks(installLines())}${installHelp ? chunks(["브라우저 메뉴를 열어 위 순서대로 설치해 주세요."]) : ""}
        <div class="install-actions">
          <button type="button" data-action="install" class="primary"${promptReady(deferredPrompt) ? "" : ` aria-expanded="${installHelp}"`}>${promptReady(deferredPrompt) ? "앱 설치" : (installHelp ? "설치 방법 접기" : "설치 방법 보기")}</button>
        </div>
      </section>
      `;
}
function installSheetOpen() {
  return showInstallSheet && !installed && !standaloneDisplay();
}
function installSheetHtml() {
  if (!installSheetOpen()) return "";
  const ready = promptReady(deferredPrompt);
  const steps = ready ? "" : `<div id="install-sheet-steps">${chunks(installLines())}</div>`;
  const primary = ready ? `<button type="button" class="primary" data-action="install">앱 설치</button>` : "";
  return `<div class="install-sheet" data-install-sheet>
      <div class="install-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="install-sheet-title"${ready ? "" : ` aria-describedby="install-sheet-steps"`}>
        <h2 id="install-sheet-title">홈 화면에 설치</h2>
        ${chunks(["홈 화면에 설치하면 공연 중에도 바로 열 수 있어요."])}
        ${steps}
        <div class="install-actions">
          ${primary}
          <button type="button" class="${ready ? "" : "primary"}" data-action="install-later">나중에</button>
        </div>
      </div>
    </div>`;
}

// The distribution access guard sets documentElement.style.visibility = "hidden"
// until /tools/_check reveals the page. A focus call made while hidden does not stick.
function pageConcealed() {
  if (typeof document === "undefined") return false;
  let root = null;
  try { root = document.documentElement; } catch { return false; }
  if (!root || !root.style) return false;
  let visibility = "";
  try { visibility = root.style.visibility; } catch { return false; }
  return String(visibility || "").toLowerCase() === "hidden";
}

function installSheetElement() {
  const root = main();
  if (!root || typeof root.querySelector !== "function") return null;
  return root.querySelector("[data-install-sheet]");
}

function clearInstallInert() {
  for (const el of installInertNodes) {
    try {
      el.inert = false;
      if (typeof el.removeAttribute === "function") el.removeAttribute("data-install-inert");
    } catch { /* detached nodes can ignore cleanup */ }
  }
  installInertNodes.clear();
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return;
  let extras = [];
  try { extras = Array.from(document.querySelectorAll("[data-install-inert]")); } catch { extras = []; }
  for (const el of extras) {
    try {
      el.inert = false;
      if (typeof el.removeAttribute === "function") el.removeAttribute("data-install-inert");
    } catch { /* detached nodes can ignore cleanup */ }
  }
}

function markInstallInert(el) {
  if (!el) return;
  installInertNodes.add(el);
  try { el.inert = true; } catch { /* inert is best-effort where the property is unsupported */ }
  if (typeof el.setAttribute === "function") el.setAttribute("data-install-inert", "");
}

// The sheet lives inside #app, so the app root itself cannot be inert.
function markBackgroundInert(sheet) {
  let node = sheet;
  const body = typeof document !== "undefined" ? document.body : null;
  while (node && node.parentElement) {
    const parent = node.parentElement;
    const children = parent.children;
    if (children && typeof children.length === "number") {
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i];
        if (child !== node) markInstallInert(child);
      }
    }
    if (!body || parent === body) break;
    node = parent;
  }
}

function rememberInstallReturn(sheet) {
  if (installLayerOpen) return;
  const active = typeof document !== "undefined" ? document.activeElement : null;
  if (!active || active === document.body || active === document.documentElement) {
    installReturnFocus = null;
    return;
  }
  if (sheet && typeof sheet.contains === "function" && sheet.contains(active)) {
    installReturnFocus = null;
    return;
  }
  installReturnFocus = active;
}

function restoreInstallFocus() {
  const saved = installReturnFocus;
  installReturnFocus = null;
  let target = saved && saved.isConnected !== false ? saved : null;
  if ((!target || typeof target.focus !== "function") && typeof document !== "undefined" && typeof document.querySelector === "function") {
    target = document.querySelector("#nav button[aria-current='page']") || document.querySelector("#app button");
  }
  if (target && typeof target.focus === "function") {
    try { target.focus(); } catch { /* restoring focus is optional */ }
  }
}

function disarmPageReveal() {
  if (!pageRevealWatch) return;
  const stop = pageRevealWatch;
  pageRevealWatch = null;
  try { stop(); } catch { /* the watcher may already have disconnected */ }
}

function armPageReveal() {
  if (pageRevealWatch || typeof document === "undefined") return;
  const root = document.documentElement;
  if (!root) return;
  let observer = null;
  let timer = null;
  const stop = () => {
    if (observer) {
      try { observer.disconnect(); } catch { /* already disconnected */ }
      observer = null;
    }
    if (timer != null && typeof clearInterval === "function") {
      clearInterval(timer);
      timer = null;
    }
    if (pageRevealWatch === stop) pageRevealWatch = null;
  };
  const retry = () => {
    if (!installSheetOpen()) {
      stop();
      return;
    }
    if (pageConcealed()) return;
    stop();
    moveFocusToInstallSheet();
  };
  pageRevealWatch = stop;
  let watching = false;
  try {
    if (typeof MutationObserver === "function") {
      observer = new MutationObserver(retry);
      observer.observe(root, { attributes: true, attributeFilter: ["style"] });
      watching = true;
    }
  } catch {
    observer = null;
    watching = false;
  }
  if (!watching && typeof setInterval === "function") timer = setInterval(retry, 50);
}

function syncInstallLayer() {
  const sheet = installSheetOpen() ? installSheetElement() : null;
  if (!sheet) {
    clearInstallInert();
    disarmPageReveal();
    if (installLayerOpen && !pageConcealed()) restoreInstallFocus();
    else installReturnFocus = null;
    installLayerOpen = false;
    return;
  }
  rememberInstallReturn(sheet);
  clearInstallInert();
  markBackgroundInert(sheet);
  installLayerOpen = true;
  moveFocusToInstallSheet();
}

function sheetFocusable(sheet) {
  if (!sheet || typeof sheet.querySelectorAll !== "function") return [];
  let nodes = [];
  try {
    nodes = Array.from(sheet.querySelectorAll("button, a[href], input, select, textarea, [tabindex]"));
  } catch {
    return [];
  }
  return nodes.filter((el) => {
    if (!el || el.disabled) return false;
    if (typeof el.getAttribute === "function" && el.getAttribute("tabindex") === "-1") return false;
    if (typeof el.getAttribute === "function" && el.getAttribute("type") === "hidden") return false;
    return true;
  });
}

function trapInstallTab(event) {
  const sheet = installSheetElement();
  if (!sheet) return;
  const focusable = sheetFocusable(sheet);
  if (!focusable.length) {
    if (typeof event.preventDefault === "function") event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = typeof document !== "undefined" ? document.activeElement : null;
  const inside = !!(active && typeof sheet.contains === "function" && sheet.contains(active));
  const backward = !!event.shiftKey;
  if (!inside || (backward && active === first) || (!backward && active === last)) {
    if (typeof event.preventDefault === "function") event.preventDefault();
    const target = backward ? last : first;
    if (typeof target.focus === "function") {
      try { target.focus(); } catch { /* keep the key from leaving the sheet */ }
    }
  }
}

function onKeyDown(event) {
  if (!event || !installSheetOpen()) return;
  if (event.key !== "Escape" && event.key !== "Tab") return;
  if (event.installKeyHandled) return;
  event.installKeyHandled = true;
  if (event.key === "Escape") {
    if (typeof event.preventDefault === "function") event.preventDefault();
    closeInstallSheet();
    return;
  }
  trapInstallTab(event);
}
