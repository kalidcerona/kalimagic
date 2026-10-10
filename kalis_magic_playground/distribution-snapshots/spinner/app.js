import { angleAtPoint, mod, landingRotation, randomInt, chooseOutcome } from './logic.js';

const stage = document.querySelector('.stage');
const wrap = document.getElementById('wheel-wrap');
const arrow = document.getElementById('spinner-arrow');
const settings = document.getElementById('settings');
const guide = document.getElementById('guide');
const spinStatus = document.getElementById('spin-status');
const key = 'friend-spinner-state-v2';
let state = { targetAngle: null, forceSpin: 4, spins: 0, previousAngle: null, rotation: 0 };
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && Number.isInteger(saved.forceSpin) && saved.forceSpin >= 1 && saved.forceSpin <= 8 &&
      Number.isInteger(saved.spins) && saved.spins >= 0 &&
      (saved.targetAngle === null || (Number.isFinite(saved.targetAngle) && saved.targetAngle >= 0 && saved.targetAngle < 360)) &&
      (saved.previousAngle === null || (Number.isFinite(saved.previousAngle) && saved.previousAngle >= 0 && saved.previousAngle < 360))) state = saved;
  else {
    const previous = JSON.parse(localStorage.getItem('friend-spinner-state-v1'));
    if (previous && Number.isInteger(previous.forceSpin) && previous.forceSpin >= 1 && previous.forceSpin <= 8) {
      state.forceSpin = previous.forceSpin;
    }
  }
} catch { /* Storage may be unavailable in a private browser. */ }
// Keep the spin setting and arrow position, but require a new secret direction on every launch.
state.targetAngle = null;
state.spins = 0;
state.previousAngle = null;
let rotation = Number.isFinite(state.rotation) ? state.rotation : 0;
let drag = null;
let busy = false;
let settingsOrigins = null;
let settingsGestureBlocked = false;
let installPrompt = null;
let installRevision = 0;
let statusTimer = null;
const pendingSpins = [];
// Each new app session starts with a fresh target touch, even if the last run was saved.
let needsFirstTouchTarget = true;

arrow.style.transform = `rotate(${rotation}deg)`;
save();

function save() { try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Keep this performance in memory. */ } }
function refreshSettings() {
  document.getElementById('target-value').textContent = state.targetAngle === null ? '선택 전' : '위치 지정됨';
  document.getElementById('spin-value').textContent = `${state.spins}회`;
  document.getElementById('force-spin').value = String(state.forceSpin);
}
let wakeLock = null;
let wakeLockPending = false;

function performanceWakeWanted() {
  return settings.hidden;
}

async function acquireWakeLock() {
  if (
    !performanceWakeWanted() ||
    !("wakeLock" in navigator) ||
    document.visibilityState !== "visible" ||
    wakeLock !== null ||
    wakeLockPending
  ) {
    return;
  }

  wakeLockPending = true;
  try {
    const lock = await navigator.wakeLock.request("screen");

    if (!performanceWakeWanted() || document.visibilityState !== "visible") {
      await lock.release();
      return;
    }

    wakeLock = lock;
    lock.addEventListener("release", () => {
      if (wakeLock === lock) wakeLock = null;
      if (document.visibilityState === "visible") acquireWakeLock();
    }, { once: true });
  } catch {
    wakeLock = null;
  } finally {
    wakeLockPending = false;
  }
}

async function releaseWakeLock() {
  const lock = wakeLock;
  wakeLock = null;
  if (lock === null) return;

  try {
    await lock.release();
  } catch {
    // Wake Lock API is optional; release failures need no UI.
  }
}

function syncPerformanceWakeLock() {
  if (performanceWakeWanted()) acquireWakeLock();
  else releaseWakeLock();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") acquireWakeLock();
  else releaseWakeLock();
});

function showSettings() {
  if (busy || !guide.hidden) return;
  refreshSettings();
  settings.hidden = false;
  drag = null;
  syncPerformanceWakeLock();
}
function closeSettings() {
  settings.hidden = true;
  syncPerformanceWakeLock();
}
function angleAt(event) {
  const box = wrap.getBoundingClientRect();
  return angleAtPoint(event.clientX, event.clientY, box.left + box.width / 2, box.top + box.height / 2);
}
function signedDifference(a, b) { return mod(a - b + 180) - 180; }
function showStatus(message, duration = 0) {
  clearTimeout(statusTimer);
  spinStatus.textContent = message;
  if (duration) statusTimer = setTimeout(() => { if (!busy) spinStatus.textContent = ''; }, duration);
}
function syncTargetCue() {
  const acknowledged = state.targetAngle !== null;
  const cue = acknowledged ? 'acknowledged' : 'idle';
  stage.classList.toggle('target-cue-acknowledged', acknowledged);
  stage.dataset.targetCue = cue;
  for (const id of ['target-corner-left', 'target-corner-right']) {
    const corner = document.getElementById(id);
    corner.classList.toggle('is-acknowledged', acknowledged);
    corner.dataset.targetCue = cue;
  }
  wrap.classList.toggle('target-cue-acknowledged', acknowledged);
  wrap.dataset.targetCue = cue;
}

// Table appearance has its own storage and never changes the performance state.
const tableThemeKey = 'friend-spinner-table-theme-v1';
const tableThemeSelect = document.getElementById('table-theme');
function normalizeTableTheme(value) { return value === 'burgundy' ? 'burgundy' : 'emerald'; }
function applyTableTheme(value) {
  const theme = normalizeTableTheme(value);
  stage.dataset.tableTheme = theme;
  tableThemeSelect.value = theme;
  return theme;
}
let savedTableTheme = null;
try { savedTableTheme = localStorage.getItem(tableThemeKey); } catch { /* Use the default table without storage. */ }
applyTableTheme(savedTableTheme);
tableThemeSelect.addEventListener('change', event => {
  const theme = applyTableTheme(event.target.value);
  try { localStorage.setItem(tableThemeKey, theme); } catch { /* Keep the selected table for this session. */ }
});

// Screen design is separate from table color and never changes the performance state.
const screenDesignKey = 'friend-spinner-screen-design-v1';
const screenDesignSelect = document.getElementById('screen-design');
const instrumentHeader = document.querySelector('.instrument-header');
const stageBottom = document.querySelector('.stage-bottom');
const casinoArrow = './casino-assets/arrow.svg';
const hybridArrow = './hybrid-assets/arrow.svg';
function normalizeScreenDesign(value) { return value === 'hybrid' ? 'hybrid' : 'casino'; }
function applyScreenDesign(value) {
  const design = normalizeScreenDesign(value);
  if (design === 'hybrid') instrumentHeader.appendChild(spinStatus);
  else stageBottom.appendChild(spinStatus);
  stage.dataset.screenDesign = design;
  screenDesignSelect.value = design;
  const nextArrow = design === 'hybrid' ? hybridArrow : casinoArrow;
  if (arrow.getAttribute('src') !== nextArrow) arrow.src = nextArrow;
  return design;
}
let savedScreenDesign = null;
try { savedScreenDesign = localStorage.getItem(screenDesignKey); } catch { /* Use the casino screen without storage. */ }
applyScreenDesign(savedScreenDesign);
screenDesignSelect.addEventListener('change', event => {
  const design = applyScreenDesign(event.target.value);
  try { localStorage.setItem(screenDesignKey, design); } catch { /* Keep the selected screen for this session. */ }
});

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

stage.addEventListener('pointerdown', event => {
  if (!event.target.closest('#wheel-wrap') || !settings.hidden || !guide.hidden || event.isPrimary === false) return;
  const angle = angleAt(event);
  drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, startAngle: angle,
    lastAngle: angle, amount: 0, started: performance.now(), selecting: needsFirstTouchTarget || state.targetAngle === null };
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const angle = angleAt(event);
  const delta = signedDifference(angle, drag.lastAngle);
  drag.amount += delta;
  drag.lastAngle = angle;
  if (!busy && !drag.selecting && Math.abs(drag.amount) > 2) {
    rotation += delta;
    arrow.style.transform = `rotate(${rotation}deg)`;
  }
});
stage.addEventListener('pointerup', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const gesture = drag;
  drag = null;
  if (gesture.selecting) {
    state.targetAngle = gesture.startAngle;
    state.spins = 0;
    state.previousAngle = null;
    needsFirstTouchTarget = false;
    save();
    syncTargetCue();
    navigator.vibrate?.(12);
    return;
  }
  const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
  const travel = Math.abs(gesture.amount);
  requestSpin(travel >= 8 ? (gesture.amount < 0 ? -1 : 1) : 1,
    Math.max(travel, distance), performance.now() - gesture.started);
});
stage.addEventListener('pointercancel', () => {
  drag = null;
  if (!busy) {
    rotation = state.rotation;
    arrow.style.transform = `rotate(${rotation}deg)`;
  }
});

function requestSpin(direction, travel, elapsed) {
  if (busy) {
    if (pendingSpins.length < 8) pendingSpins.push({ direction, travel, elapsed });
    return;
  }
  spin(direction, travel, elapsed);
}

function spin(direction, travel, elapsed) {
  busy = true;
  const outcome = chooseOutcome(state.spins + 1, state.forceSpin, state.targetAngle, state.previousAngle);
  const strength = Math.min(1, travel / 240 + (travel / Math.max(250, elapsed)) / 2);
  const turns = 2 + Math.floor(strength) + randomInt(2);
  const end = landingRotation(rotation, outcome, direction, turns);
  const from = rotation;
  showStatus('회전 중…');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animation = arrow.animate([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${end}deg)` }], {
    duration: reduced ? 50 : 1100,
    easing: 'cubic-bezier(.12,.7,.13,1)', fill: 'forwards'
  });
  animation.onfinish = () => {
    rotation = end;
    arrow.style.transform = `rotate(${rotation}deg)`;
    animation.cancel();
    state.spins++;
    state.previousAngle = outcome;
    state.rotation = mod(rotation);
    save();
    busy = false;
    showStatus('', 0);
    const next = pendingSpins.shift();
    if (next) spin(next.direction, next.travel, next.elapsed);
  };
}

function settingsContacts(list) {
  return Array.from(list || [], (touch) => ({ id: touch.identifier, x: touch.clientX, y: touch.clientY }));
}
// Origins are the positions at the moment the pair forms, in viewport coordinates.
function settingsPairReady(origins, contacts) {
  return origins.every((origin) => {
    const end = contacts.find((point) => point.id === origin.id);
    if (!end) return false;
    const dx = end.x - origin.x;
    const dy = end.y - origin.y;
    return dy >= 96 && dy > Math.abs(dx) * 1.5;
  });
}
document.addEventListener('touchstart', event => {
  if (event.touches.length > 2) {
    settingsOrigins = null;
    settingsGestureBlocked = true;
    return;
  }
  if (event.touches.length === 2 && !settingsGestureBlocked && settings.hidden && guide.hidden) {
    settingsOrigins = settingsContacts(event.touches);
    drag = null;
    if (!busy) {
      rotation = state.rotation;
      arrow.style.transform = `rotate(${rotation}deg)`;
    }
    return;
  }
  settingsOrigins = null;
}, { passive: true });
document.addEventListener('touchmove', event => {
  if (settingsGestureBlocked || !settingsOrigins || event.touches.length !== 2) return;
  if (!settingsPairReady(settingsOrigins, settingsContacts(event.touches))) return;
  event.preventDefault();
  settingsOrigins = null;
  settingsGestureBlocked = true;
  showSettings();
}, { passive: false });
document.addEventListener('touchend', event => {
  if (event.touches.length < 2) settingsOrigins = null;
  if (event.touches.length === 0) settingsGestureBlocked = false;
}, { passive: true });
document.addEventListener('touchcancel', () => {
  settingsOrigins = null;
  settingsGestureBlocked = false;
}, { passive: true });

document.getElementById('settings-close').addEventListener('click', closeSettings);
document.getElementById('start-performance').addEventListener('click', () => {
  pendingSpins.length = 0;
  state.targetAngle = null;
  state.spins = 0;
  state.previousAngle = null;
  needsFirstTouchTarget = true;
  save();
  refreshSettings();
  syncTargetCue();
  closeSettings();
});
document.getElementById('force-spin').addEventListener('change', event => { state.forceSpin = Number(event.target.value); state.spins = 0; state.previousAngle = null; pendingSpins.length = 0; save(); refreshSettings(); });
document.getElementById('clear-target').addEventListener('click', () => {
  state.targetAngle = null;
  state.spins = 0;
  state.previousAngle = null;
  pendingSpins.length = 0;
  needsFirstTouchTarget = true;
  save();
  refreshSettings();
  syncTargetCue();
  closeSettings();
});
document.getElementById('guide-close').addEventListener('click', () => {
  guide.hidden = true;
  try { localStorage.setItem('friend-spinner-guide-seen-v2', '1'); } catch { /* Ignore storage failures. */ }
});
try { guide.hidden = localStorage.getItem('friend-spinner-guide-seen-v2') === '1'; } catch { guide.hidden = false; }
syncPerformanceWakeLock();
refreshSettings();
syncTargetCue();

window.addEventListener('beforeinstallprompt', event => { if (standaloneDisplay()) return; event.preventDefault(); installRevision += 1; installPrompt = event; syncInstallGroup(); });
document.getElementById('install-app').addEventListener('click', async () => {
  const help = document.getElementById('install-help');
  if (standaloneDisplay()) return syncInstallGroup();
  if (installPrompt) {
    const revision = installRevision;
    const prompt = installPrompt; installPrompt = null;
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
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // A replacement shell may claim this page. Reloading would clear the live wheel, open settings, and custom preview edits.
  try {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(() => {});
  } catch { /* Registration failure stays on this performance. */ }
}
