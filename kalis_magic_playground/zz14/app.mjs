import {
  MODES,
  buildSession,
  migrateWeak,
  defaultSettings,
  defaultStats,
  readSlot,
  validateSession,
  validateSettings,
  validateStats,
} from "./core.mjs";
import {
  KEYS,
  state,
  blockedSlots,
  main,
  notice,
  storageGet,
  storageSet,
  freshSeed,
  current,
  saveSettings,
  saveStats,
} from "./state.mjs";
import {
  postSession,
  weakReviewQuestions,
  reviewSession,
} from "./session.mjs";
import {
  practiceHtml,
} from "./practice.mjs";
import {
  learnHtml,
} from "./learn.mjs";
import {
  settingsHtml,
} from "./settings.mjs";
import {
  standaloneDisplay,
  promptReady,
  installSheetOpen,
  installSheetHtml,
  pageConcealed,
  installSheetElement,
  disarmPageReveal,
  armPageReveal,
  syncInstallLayer,
  onKeyDown,
} from "./install.mjs";
import {
  onSubmit,
  onInput,
  onClick,
} from "./events.mjs";

export {
  runningSince,
  persistTime,
  saveSession,
  startSession,
  startWeakReview,
  goNext,
  deferredPrompt,
  installed,
  installHelp,
  showInstallSheet,
  closeInstallSheet,
  runInstall,
  render,
  moveFocusToInstallSheet,
};

let runningSince = Date.now();
let focusAnswer = false;

function persistTime() {
  const session = state.session;
  if (!session || session.clockFrozen) return;
  const now = Date.now();
  session.accumulatedMs += Math.max(0, now - runningSince);
  runningSince = now;
}

function saveSession() {
  persistTime();
  storageSet(KEYS.session, state.session);
}

function startSession(mode, { force = false, keepTab = false } = {}) {
  if (!MODES.includes(mode)) mode = MODES[0];
  const active = state.session;
  if (!force && active && !active.finished && active.mode === mode && active.mode !== "review") {
    if (!keepTab) state.tab = "practice";
    focusAnswer = state.tab === "practice";
    render();
    return;
  }
  postSession(active);
  const session = buildSession({
    mode,
    count: state.settings.count,
    seed: freshSeed(),
    phraseDisplay: state.settings.phraseDisplay,
  });
  state.session = session;
  runningSince = Date.now();
  if (!keepTab) state.tab = "practice";
  focusAnswer = state.tab === "practice";
  saveSession();
  render();
}

function startWeakReview() {
  const questions = weakReviewQuestions();
  if (!questions.length) {
    state.notice = "약한 것이 없습니다.";
    render();
    return;
  }
  postSession(state.session);
  state.session = reviewSession(questions);
  runningSince = Date.now();
  state.tab = "practice";
  state.notice = "";
  focusAnswer = false;
  saveSession();
  render();
}

function goNext() {
  const session = state.session;
  const question = current();
  if (!session || !question) return;
  if (!question.graded) {
    if (!question.usedReveal) return;
    question.graded = "revealed";
  }
  state.notice = "";
  if (session.index < session.questions.length - 1) {
    session.index += 1;
    focusAnswer = true;
    saveSession();
    render();
    return;
  }
  postSession(session);
  session.finished = true;
  session.clockFrozen = true;
  saveSession();
  render();
}

function renderNav() {
  document.body.dataset.tab = state.tab;
  for (const button of document.querySelectorAll("#nav button")) {
    const on = button.dataset.tab === state.tab;
    button.classList.toggle("active", on);
    if (on) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  const root = main();
  if (state.tab === "settings") root.setAttribute("data-product-settings", "");
  else root.removeAttribute("data-product-settings");
}

let deferredPrompt = null;

let installed = false;
let installHelp = false;
let showInstallSheet = false;
let focusInstallSheet = false;

let pullingSheetFocus = false;

function closeInstallSheet() {
  showInstallSheet = false;
  focusInstallSheet = false;
  render();
}
function rerenderInstall() {
  render();
}
async function runInstall() {
  const event = deferredPrompt;
  if (standaloneDisplay()) return;
  if (!promptReady(event)) { installHelp = !installHelp; rerenderInstall(); return; }
  deferredPrompt = null;
  rerenderInstall();
  try {
    await event.prompt();
    await event.userChoice;
  } catch {}
  rerenderInstall();
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    if (!promptReady(event) || standaloneDisplay()) return;
    if (typeof event.preventDefault === "function") event.preventDefault();
    deferredPrompt = event;
    if (installSheetOpen()) focusInstallSheet = true;
    rerenderInstall();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    showInstallSheet = false;
    focusInstallSheet = false;
    deferredPrompt = null;
    rerenderInstall();
  });
  window.addEventListener("keydown", onKeyDown);
}

function render() {
  if (state.tab === "record") state.tab = "settings";
  const scrollY = typeof window !== "undefined" && typeof window.scrollY === "number" ? window.scrollY : null;
  renderNav();
  const root = main();
  const page = state.tab === "learn" ? learnHtml() : state.tab === "settings" ? settingsHtml() : practiceHtml();
  root.innerHTML = page + installSheetHtml();
  notice().textContent = state.notice || "";
  focusAnswer = false;
  syncInstallLayer();
  // Update prompt: asked only on the settings tab, hidden on every other tab.
  if (state.tab === "settings") globalThis.MagicUpdate?.offer(); else globalThis.MagicUpdate?.hide();
  if (scrollY != null && typeof window.scrollTo === "function" && window.scrollY !== scrollY) window.scrollTo(0, scrollY);
}

function moveFocusToInstallSheet() {
  if (!installSheetOpen()) return;
  if (pageConcealed()) {
    armPageReveal();
    return;
  }
  disarmPageReveal();
  const sheet = installSheetElement();
  if (!sheet || typeof sheet.querySelector !== "function") return;
  const active = typeof document !== "undefined" ? document.activeElement : null;
  if (!focusInstallSheet && active && typeof sheet.contains === "function" && sheet.contains(active)) return;
  focusInstallSheet = false;
  const button = sheet.querySelector("[data-action='install']") || sheet.querySelector("button");
  if (button && typeof button.focus === "function") {
    pullingSheetFocus = true;
    try { button.focus(); } catch { /* focus is optional when the view is not visible */ }
    finally { pullingSheetFocus = false; }
  }
}

function onFocusIn(event) {
  if (pullingSheetFocus || !installSheetOpen() || pageConcealed()) return;
  const sheet = installSheetElement();
  if (!sheet || typeof sheet.querySelector !== "function") return;
  const target = event && event.target;
  if (target && typeof sheet.contains === "function" && sheet.contains(target)) return;
  const button = sheet.querySelector("[data-action='install']") || sheet.querySelector("button");
  if (!button || button === target || typeof button.focus !== "function") return;
  pullingSheetFocus = true;
  try { button.focus(); } catch { /* the tab trap is the primary guard */ }
  finally { pullingSheetFocus = false; }
}

function boot() {
  const notes = [];
  const settingsRead = readSlot(storageGet(KEYS.settings), defaultSettings(), validateSettings);
  const statsRead = readSlot(storageGet(KEYS.stats), defaultStats(), validateStats);
  const sessionRead = readSlot(storageGet(KEYS.session), null, (value) => Boolean(value) && validateSession(value));
  state.settings = settingsRead.value;
  state.stats = statsRead.value;
  if (!statsRead.corrupt) { migrateWeak(state.stats); saveStats(); }
  if (settingsRead.corrupt) blockedSlots.add(KEYS.settings);
  if (statsRead.corrupt) blockedSlots.add(KEYS.stats);
  if (sessionRead.corrupt) blockedSlots.add(KEYS.session);
  if (!settingsRead.corrupt && state.settings.practiceStyle !== "tap") {
    state.settings.practiceStyle = "tap";
    saveSettings();
  }
  if (!settingsRead.corrupt && Object.prototype.hasOwnProperty.call(state.settings, "installDismissed")) {
    delete state.settings.installDismissed;
    saveSettings();
  }
  if (settingsRead.corrupt) notes.push("설정을 읽지 못해 기본값으로 시작합니다.");
  if (statsRead.corrupt) notes.push("저장된 기록을 보존하고 임시 기록으로 연습합니다.");
  if (sessionRead.corrupt) notes.push("저장된 문제를 보존하고 새 문제로 연습합니다. 이번 진행은 저장하지 않습니다.");
  if (!state.storageOk) notes.push("이 브라우저에서는 저장이 막혀 있습니다. 새로고침하면 현재 문제가 사라집니다.");
  if (sessionRead.corrupt || sessionRead.empty || !sessionRead.value || sessionRead.value.finished) {
    const previousMode = sessionRead.value && MODES.includes(sessionRead.value.mode) ? sessionRead.value.mode : MODES[0];
    const weakQuestions = !statsRead.corrupt && state.settings.mapPool === "weak" ? weakReviewQuestions() : [];
    state.session = weakQuestions.length
      ? reviewSession(weakQuestions)
      : buildSession({
        mode: previousMode,
        count: state.settings.count,
        seed: freshSeed(),
        phraseDisplay: state.settings.phraseDisplay,
      });
    runningSince = Date.now();
    saveSession();
  } else {
    state.session = sessionRead.value;
    if (!Number.isFinite(state.session.accumulatedMs)) state.session.accumulatedMs = 0;
    runningSince = Date.now();
  }
  state.tab = "practice";
  state.notice = notes.join(" ");
  focusAnswer = false;
  showInstallSheet = !standaloneDisplay();
  focusInstallSheet = showInstallSheet;
  document.body.addEventListener("click", onClick);
  document.body.addEventListener("keydown", onKeyDown);
  document.body.addEventListener("focusin", onFocusIn);
  document.body.addEventListener("submit", onSubmit);
  document.body.addEventListener("input", onInput);
  globalThis.MagicUpdate?.init({ registrationPromise: navigator.serviceWorker?.ready, safe: () => state.tab === "settings" });
  render();
}

// Keep the screen awake while this personal app is visible, including idle screens.
function keepVisibleScreenAwake() {
  if (typeof document === 'undefined' || typeof navigator === 'undefined' || !navigator.wakeLock) return;
  let lock = null, pending = false, shortLived = 0;
  const visible = () => document.visibilityState === 'visible';
  const release = () => {
    const current = lock; lock = null;
    if (current) { try { Promise.resolve(current.release()).catch(() => {}); } catch {} }
  };
  async function request() {
    if (!visible() || lock || pending) return;
    pending = true;
    try {
      const acquired = await navigator.wakeLock.request('screen');
      if (!visible()) { await acquired.release(); return; }
      lock = acquired;
      const acquiredAt = Date.now();
      acquired.addEventListener('release', () => {
        if (lock === acquired) lock = null;
        if (!visible()) return;
        // Three locks dropped within 10s means the platform will not keep one. A visible return, or one held 10s, tries again.
        if (Date.now() - acquiredAt >= 10000) shortLived = 0;
        else if (++shortLived >= 3) return;
        setTimeout(request, 1000);
      });
    } catch {} finally { pending = false; }
  }
  document.addEventListener('visibilitychange', () => { if (visible()) { shortLived = 0; request(); } else release(); });
  request();
}
keepVisibleScreenAwake();

if (typeof document !== "undefined") boot();
import { installLocalPreview } from './local-preview.mjs'; // local-preview-hook
installLocalPreview(() => { document.querySelector('#nav [data-tab="settings"]')?.click(); }); // local-preview-hook
