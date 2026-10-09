import {
  HOLD_THRESHOLD_MS,
  normalizeHoldThresholdMs,
  beginHold,
  createHold,
  loadFromRaw,
  mayOverwritePrimary,
  preparePerformance,
  releaseHold,
  resetAttempts,
  serializeState,
  trySetTruthAttempt,
  updateHold,
  verdictForAttempt,
} from "./logic.js";

const STATE_KEY = "usotsuki.detector.v1";
const SCAN_DURATION_KEY = "usotsuki.detector.scan-duration.v1";
const SOUND_KEY = "usotsuki.detector.sound.v1";
const VIBRATION_KEY = "usotsuki.detector.vibration.v1";
const SWIPE_DOWN_PX = 96;
const READY_FEEDBACK_MS = 600;
const READY_HAPTIC_MS = { medium: 18, high: 28, max: 38 };
const STAGE_CLASSES = ["is-testing", "is-lie", "is-true", "is-cancelled"];

// Entropy supplies the drawing; the approved lie reaction begins only at 75%.
function buildHeartbeat({durationMs, seed, verdict = "TRUE"}) {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const smooth = x => x * x * (3 - 2 * x);
  const points = [[0, 62]], beats = [];
  let beat = 180, variation = 0, untilLong = 2, previousHeightVariation = 0;
  while (beat < durationMs * 1.5) {
    // Keep complete impulses clear of the shared 75% decision boundary.
    if (beat > durationMs * .75 - 100 && beat < durationMs * .75 + 60) beat = durationMs * .75 + 60;
    const progress = Math.min(1, beat / durationMs);
    const rise = progress < .5 ? smooth(progress / .5) : 1 - smooth((progress - .5) / .5);
    variation = variation * .5 + (random() - .5) * .03;
    const impulsePeriod = 22500 / (62 + 34 * rise) * (1 + variation);
    // Medium-medium-long-medium, with seeded group lengths and no repeated loop.
    const longGap = untilLong-- === 0;
    if (longGap) untilLong = 2 + Math.floor(random() * 3);
    const period = impulsePeriod * (longGap ? 2.18 : 1.65) * (1 + (random() - .5) * .08);
    const width = impulsePeriod * (1 + (random() - .5) * .06);
    // Compensate the 16ms pen response and denser impulses; render stays within the roll.
    let heightVariation = (random() - .5) * .24;
    if (Math.abs(heightVariation - previousHeightVariation) < .04) heightVariation = previousHeightVariation > 0 ? -.08 - random() * .04 : .08 + random() * .04;
    previousHeightVariation = heightVariation;
    const heightPx = (18 + 22 * rise) * (1 + heightVariation);
    const height = heightPx * 124 / 162.4 * 8.8;
    beats.push({at: beat, period, width, height, heightPx, rise});
    // One narrow engraved impulse; all inter-beat segments are straight.
    points.push([beat, 62], [beat + width * .025, 108.8], [beat + width * .06, 62 - height], [beat + width * .095, 124.4], [beat + width * .13, 62]);
    beat += period;
  }
  points.push([durationMs, 62]);
  const raw = points.filter(([t]) => t <= durationMs);
  const boundary = heartbeatValue({points: raw}, durationMs * .75);
  const transformed = raw.filter(([t]) => t < durationMs * .75);
  transformed.push([durationMs * .75, boundary]);
  if (verdict === "LIE") {
    const boundaryMs = durationMs * .75;
    // Compress complete normal impulses, including the next scheduled beat.
    // Height changes only the R tip; there is no separate recovery hump.
    const latePoints = points.slice(0, -1).filter(([t]) => t > boundaryMs);
    for (const [t, y] of latePoints) {
      const at = boundaryMs + (t - boundaryMs) * .72;
      transformed.push([at, y < 50 ? 62 + (y - 62) * 1.65 : y]);
    }
    if (!transformed.some(([t,y]) => t > boundaryMs && t <= durationMs && y < 50)) {
      // Very short tests still receive one complete, narrow normal-shaped beat.
      while (transformed.length && transformed[transformed.length-1][0] > boundaryMs) transformed.pop();
      const period = Math.min(beats[0].period * .72, durationMs * 1.2);
      const at = boundaryMs + durationMs * .025;
      const height = beats[0].height * 1.65;
      transformed.push([boundaryMs+2,62],[at,62],[at+period*.025,108.8],[at+period*.06,62-height],
        [at+period*.095,124.4],[at+period*.13,62]);
    }
    transformed.sort((a,b) => a[0] - b[0]);
    const end = heartbeatValue({points: transformed}, durationMs);
    while (transformed.length && transformed[transformed.length-1][0] > durationMs) transformed.pop();
    transformed.push([durationMs,end]);
  } else {
    transformed.push(...raw.filter(([t]) => t > durationMs * .75));
  }
  transformed.sort((a,b) => a[0] - b[0]);
  // The rise envelope and compressed impulse widths both attenuate late R peaks.
  // Calibrate input R tips against the same fixed-step pen response, before drawing.
  // No output clamp: the early waveform, pen state and monotone path stay intact.
  const boundaryMs = durationMs * .75;
  if (!transformed.some(([t,y]) => t > boundaryMs && t < durationMs && y < 50)) {
    const period = Math.min(beats[0].period, durationMs * .7);
    const at = boundaryMs + durationMs * .025;
    while (transformed.length && transformed[transformed.length-1][0] > boundaryMs) transformed.pop();
    transformed.push([boundaryMs+2,62],[at,62],[at+period*.025,108.8],[at+period*.06,62-beats[0].height],
      [at+period*.095,124.4],[at+period*.13,62],[durationMs,62]);
  }
  const allTips = transformed.map(([t,y],i) => y < 50 && t < durationMs ? i : -1).filter(i => i >= 0);
  const tips = allTips.filter(i => transformed[i][0] > boundaryMs);
  const original = tips.map(i => transformed[i][1]);
  const response = () => {
    let position = 62, velocity = 0, cursor = 1, region = 0;
    const heights = allTips.map(() => 0), times = allTips.map(() => 0), samples = [[0,0]];
    const omega = 1 / 16, decay = Math.exp(-omega * 2);
    for (let t = 2; t <= durationMs; t += 2) {
      while (cursor < transformed.length - 1 && transformed[cursor][0] < t) cursor++;
      const [a,b] = transformed[cursor-1], [at,y] = transformed[cursor];
      const u = Math.max(0, Math.min(1, (t-a)/(at-a || 1)));
      const target = b + (y-b)*u*u*(3-2*u);
      const delta = position-target, c = velocity+omega*delta;
      position = target+(delta+c*2)*decay;
      velocity = (velocity-omega*c*2)*decay;
      samples.push([t,62-position]);
      while (region < allTips.length-1 && t > (transformed[allTips[region]][0]+transformed[allTips[region+1]][0])/2) region++;
      if (62-position > heights[region]) { heights[region] = 62-position; times[region] = t; }
    }
    const early = samples.filter(([t,h],i) => t >= durationMs * 16 / 344 && t <= boundaryMs && i > 0 && i < samples.length-1 && h > 2 && h > samples[i-1][1] && h >= samples[i+1][1]).map(([,h]) => h);
    return {heights,times,early,samples};
  };
  // Calibrate the average of rendered R peaks, rather than the largest peak.
  // Early tips are untouched. Late tip gains preserve widths and timing.
  const unit = response();
  const early = unit.early;
  const average = early.reduce((a,b) => a+b,0) / early.length;
  const earlyMax = Math.max(...early);
  const weights = tips.map((i,k) => 1 + .12 * Math.sin((seed >>> 0) * .017 + k * 2.4));
  const meanWeight = weights.reduce((a,b) => a+b,0) / weights.length;
  const targetMean = average * (verdict === "LIE" ? 1.5 : 1);
  // When feasible, every late lie R clears the tallest early R. This is input
  // calibration, never a rendered clamp or a compression against paper edges.
  const spread = verdict === "LIE" ? Math.max(0, Math.min(1, (targetMean-earlyMax-.25)/(targetMean*.24))) : 1;
  const targets = weights.map(w => targetMean * (1 + (w/meanWeight-1)*spread));
  const gains = tips.map(() => 1);
  const setGains = () => tips.forEach((i,k) => { transformed[i][1] = 62+(original[k]-62)*gains[k]; });
  tips.forEach(i => { transformed[i][1] = 62; });
  const zero = response();
  setGains();
  tips.forEach((tip,k) => {
    const region = allTips.indexOf(tip);
    const left = region ? (transformed[allTips[region-1]][0]+transformed[tip][0])/2 : 0;
    const right = region < allTips.length-1 ? (transformed[tip][0]+transformed[allTips[region+1]][0])/2 : durationMs;
    let gain = Infinity;
    unit.samples.forEach(([t,h],j) => {
      const base = zero.samples[j][1], contribution = h-base;
      if (t >= transformed[tip][0] && t > left && t <= right && contribution > 1e-9) gain = Math.min(gain,(targets[k]-base)/contribution);
    });
    gains[k] = gain;
  });
  setGains();
  return {durationMs, seed, beats: beats.filter(b => b.at < durationMs), points: transformed};
}
function heartbeatValue(model, elapsedMs) {
  const end = Math.max(0, elapsedMs);
  for (let i = 1; i < model.points.length; i++) {
    const [t,y] = model.points[i], [a,b] = model.points[i-1];
    if (end <= t) { const u = Math.max(0, Math.min(1, (end-a)/(t-a || 1))); return b + (y-b)*u*u*(3-2*u); }
  }
  return model.points[model.points.length-1][1];
}
function heartbeatPath(model, elapsedMs) {
  let path = '';
  for(let t=0; t<=elapsedMs; t+=4) path += `${t ? 'L' : 'M'}${(8+344*t/model.durationMs).toFixed(2)} ${heartbeatValue(model,t).toFixed(2)}`;
  return path;
}



import { createContinuousTrace } from "./recorder-trace.js";

import { createRecorderThemeController } from "./recorder-theme.js";

const performanceScreen = document.querySelector("#performance-screen");
const detectorButton = document.querySelector("#detector-button");
const testIndicator = document.querySelector("#test-indicator");
const verdict = document.querySelector("#verdict");
const signalMode = document.querySelector(".signal-mode");
const settingsScreen = document.querySelector("#settings-screen");
const truthInput = document.querySelector("#truth-attempt");
const soundInput = document.querySelector("#sound-enabled");
const vibrationInput = document.querySelector("#vibration-level");
const vibrationHelp = document.querySelector("#vibration-help");
const vibrationCapability = document.querySelector("#vibration-capability");
const vibrationSummary = document.querySelector("#vibration-settings-summary");
const scanDurationInput = document.querySelector("#scan-duration");
const scanDurationHelp = document.querySelector("#scan-duration-help");
const holdDurationHelp = document.querySelector("#hold-duration-help");
const signalTimeMid = document.querySelector("#signal-time-mid");
const signalTimeEnd = document.querySelector("#signal-time-end");
const resetButton = document.querySelector("#reset-attempts");
const startButton = document.querySelector("#start-performance");
const settingsStatus = document.querySelector("#settings-status");
const attemptProgress = document.querySelector("#attempt-progress");

const recorderThemes = createRecorderThemeController(performanceScreen, () => ({
  sound: soundEnabled(), duration: activeScanDurationMs,
  startedAt: hold.startedAt, holding: !settled && hold.phase === "holding",
  verdict: verdictForAttempt(appState.attemptCount + 1, appState.settings.truthAttempts),
  attempt: appState.attemptCount,
}));

let appState = loadFromRaw(null).state;
let storageLocked = false;
let hold = createHold();
let holdTimer = 0;
let scanDurationMs = HOLD_THRESHOLD_MS;
let activeScanDurationMs = HOLD_THRESHOLD_MS;
let settled = true;
let activePointerId = null;
let holdPointerId = null;
let readyPointerId = null;
let primerPointerId = null;
let gestureConsumed = false;
let audioContext = null;
let audioResumePromise = null;
let soundRequestId = 0;
let scanOscillator = null;
let scanGain = null;
let readyTimer = 0;
let readyFeedbackShown = false;

/** @type {Map<number, {x: number, y: number, startX: number, startY: number, startedOnButton: boolean}>} */
const pointers = new Map();

function storageGet(key) {
  try {
    return { ok: true, value: window.localStorage.getItem(key) };
  } catch {
    return { ok: false, value: null };
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}


function canPersistState() {
  return mayOverwritePrimary({
    preserveStoredRaw: storageLocked,
    backupSaved: false,
    acknowledged: false,
  });
}

function persistState() {
  if (!canPersistState()) return false;
  return storageSet(STATE_KEY, serializeState(appState));
}

function setStatus(message) {
  settingsStatus.textContent = message;
}

function updateAttemptProgress() {
  attemptProgress.textContent = `완료한 시도 ${appState.attemptCount}회. 공연을 시작하면 0이 됩니다.`;
}

function soundEnabled() {
  return soundInput.checked;
}

function loadSoundPreference(raw) {
  if (raw === "0" || raw === "off" || raw === "false") soundInput.checked = false;
  if (raw === "1" || raw === "on" || raw === "true") soundInput.checked = true;
}

function persistSoundPreference() {
  storageSet(SOUND_KEY, soundInput.checked ? "1" : "0");
}

function paintScanDuration(ms) {
  const seconds = ms / 1000;
  if (scanDurationHelp) scanDurationHelp.textContent = `버튼을 ${seconds}초 누르면 판정합니다. 0.5–10초, 0.5초 단위입니다.`;
  if (holdDurationHelp) holdDurationHelp.textContent = `접촉 버튼을 ${seconds}초 누르고 있으면 판정합니다.`;
  if (signalTimeMid) signalTimeMid.textContent = `${seconds / 2}s`;
  if (signalTimeEnd) signalTimeEnd.textContent = `${seconds}s`;
  detectorButton.setAttribute("aria-label", `검사를 시작하려면 ${seconds}초간 누르기`);
}

// A finished number can be applied immediately. Blank and partial text must not
// replace the stored preference or the field the performer is still editing.
function finishedScanDurationMs(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(trimmed)) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return null;
  return normalizeHoldThresholdMs(numeric * 1000);
}

function setScanDuration(raw) {
  const numeric = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
  scanDurationMs = normalizeHoldThresholdMs(numeric * 1000);
  const seconds = scanDurationMs / 1000;
  if (scanDurationInput) scanDurationInput.value = String(seconds);
  paintScanDuration(scanDurationMs);
}

function persistScanDuration() {
  return storageSet(SCAN_DURATION_KEY, String(scanDurationMs / 1000));
}

// Safari can leave a focused number unchanged on `change` until after the
// start control runs. Apply a finished value without rewriting partial text.
function syncLiveScanDuration() {
  if (!scanDurationInput) return false;
  const ms = finishedScanDurationMs(scanDurationInput.value);
  if (ms == null) return false;
  scanDurationMs = ms;
  // A hold already captured activeScanDurationMs. Do not move its scale mid-scan.
  if (settled) paintScanDuration(ms);
  return persistScanDuration();
}

function onScanDurationInput() {
  syncLiveScanDuration();
}

function onScanDurationChange() {
  setScanDuration(scanDurationInput.value);
  if (!persistScanDuration()) {
    setStatus("검사 시간은 적용했지만 이 브라우저에 저장하지 못했습니다.");
  }
}

function loadVibrationPreference(raw) {
  if (raw === "low") vibrationInput.value = "medium";
  else if (["off", "medium", "high", "max"].includes(raw)) vibrationInput.value = raw;
}

function continuousVibrationAvailable() {
  return typeof navigator.vibrate === "function";
}

// Settings only. Safari has no continuous vibration API; do not invent a pulse
// or turn sound on. The stored intensity stays for a browser that can use it.
function applyVibrationCapability() {
  const available = continuousVibrationAvailable();
  const settings = document.querySelector("#vibration-settings");
  if (settings) {
    settings.hidden = !available;
    settings.style.display = available ? "" : "none";
  }
  if (vibrationCapability) {
    vibrationCapability.setAttribute("data-vibration-capability", available ? "available" : "unsupported");
    vibrationCapability.hidden = available;
    vibrationCapability.textContent = available
      ? ""
      : "이 브라우저는 연속 진동을 지원하지 않습니다. 스위치용 짧은 시스템 햅틱은 검사 진동을 대신하지 못합니다. 저장한 세기는 유지되며, 소리와 검사 화면은 그대로 동작합니다.";
  }
  if (vibrationHelp) vibrationHelp.hidden = !available;
  if (vibrationInput) {
    vibrationInput.disabled = !available;
    if (!available) vibrationInput.setAttribute("aria-disabled", "true");
  }
  if (vibrationSummary && !available) {
    vibrationSummary.textContent = "준비와 검사 진동 (이 브라우저에서는 사용할 수 없음)";
  }
}

function stopVibration() {
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate(0);
  } catch { /* Haptics are optional. */ }
}

function startVibration(durationMs) {
  if (typeof navigator.vibrate !== "function" || vibrationInput.value === "off") return;
  try {
    const pulse = { medium: [100, 100], high: [150, 50] }[vibrationInput.value];
    if (vibrationInput.value === "max") navigator.vibrate(durationMs);
    else if (pulse) {
      const pattern = [];
      let remaining = durationMs;
      while (remaining > 0) {
        const segment = Math.min(pulse[pattern.length % 2], remaining);
        pattern.push(segment);
        remaining -= segment;
      }
      navigator.vibrate(pattern);
    }
  } catch { /* Visual scanning still works without haptics. */ }
}

function bootStorage() {
  const stored = storageGet(STATE_KEY);
  const sound = storageGet(SOUND_KEY);
  const vibration = storageGet(VIBRATION_KEY);
  setScanDuration(storageGet(SCAN_DURATION_KEY).value);
  if (sound.ok) loadSoundPreference(sound.value);
  if (vibration.ok) loadVibrationPreference(vibration.value);
  applyVibrationCapability();
  if (!stored.ok) {
    appState = loadFromRaw(null).state;
    storageLocked = true;
    setStatus("브라우저 저장소를 사용할 수 없습니다. 이번 공연 값만 유지됩니다.");
    return;
  }
  const loaded = loadFromRaw(stored.value);
  appState = loaded.state;
  storageLocked = loaded.preserveStoredRaw === true;
  truthInput.value = appState.settings.truthAttempts.join(",");
  updateAttemptProgress();
  if (storageLocked) {
    setStatus("저장된 기록을 읽지 못했습니다. 기존 값은 덮어쓰지 않습니다.");
  }
}

function clearHoldTimer() {
  if (holdTimer) {
    window.clearTimeout(holdTimer);
    holdTimer = 0;
  }
}

let traceMode = "off";
let traceFrame = 0;
let woodHeartbeat = null;
const woodTrace = createContinuousTrace({position: 62, retain: 472, responseMs: 16, integrationMs: 2, smooth: true});
let woodRunEnd = 0;
function traceNode() { return document.querySelector(".wood-trace"); }
function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}
function validWoodContact() {
  const contact = pointers.get(holdPointerId);
  return performanceScreen.dataset.displayTheme === "recorder" && !document.hidden &&
    !performanceScreen.hidden && !settingsVisible() && !settled && hold.phase === "holding" &&
    !!contact && pointOnButton(contact.x, contact.y, null);
}
function renderWoodTrace(elapsed, freeze = false) {
  woodRunEnd = Math.max(0, Math.min(activeScanDurationMs, elapsed));
  const point = woodTrace.advance(elapsed, freeze);
  traceNode()?.setAttribute("d", woodTrace.path(p => [328 + p.distance - point.distance, p.position]));
  document.querySelector(".wood-paper-motion")?.setAttribute("transform", `translate(${-point.distance % 24} 0)`);
  performanceScreen.dataset.woodDistance = String(point.distance);
}
function stopLiveTrace() {
  traceMode = "off";
  if (traceFrame) window.cancelAnimationFrame(traceFrame);
  traceFrame = 0;
}
function onTraceFrame(timeMs) {
  traceFrame = 0;
  if (traceMode !== "run" || !validWoodContact()) { stopLiveTrace(); return; }
  renderWoodTrace(timeMs - hold.startedAt);
  traceFrame = window.requestAnimationFrame(onTraceFrame);
}
function startLiveTrace() {
  if (!validWoodContact() || traceMode === "run") return;
  // Run seed comes from entropy alone, never the verdict or attempt schedule.
  const seed = Math.floor(Math.random() * 4294967296) >>> 0;
  const oldModel = woodHeartbeat, oldEnd = woodRunEnd;
  woodHeartbeat = buildHeartbeat({durationMs: activeScanDurationMs, seed,
    verdict: verdictForAttempt(appState.attemptCount + 1, appState.settings.truthAttempts)});
  const carryEnd = oldModel?.points.find(([t,y]) => t > oldEnd && Math.abs(y-62)<.01)?.[0] ?? oldEnd;
  const carry = Math.max(0, carryEnd-oldEnd);
  woodTrace.begin({duration: activeScanDurationMs, travel: 344,
    target: t => t < carry ? heartbeatValue(oldModel, oldEnd+t) : heartbeatValue(woodHeartbeat, t)});
  woodRunEnd = 0;
  performanceScreen.dataset.woodSeed = String(seed);
  traceMode = "run";
  renderWoodTrace(0);
  traceFrame = window.requestAnimationFrame(onTraceFrame);
}

let paperTimers = [];
let paperFrame = 0, paperStarted = 0;
let paperFinal = "검사 대기 중";
function printGlyphs(text) {
  return `<svg class="wood-print-line${text.length < 3 ? ' wood-verdict-line' : ''}" width="100%" height="100%"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" opacity=".9">${text}</text></svg>`;
}
function centerWoodText() {
  const strip = document.querySelector(".wood-paper-strip");
  const box = strip?.getBoundingClientRect();
  if (!box || box.width <= 0 || box.height <= 0 || !strip.querySelectorAll) return;
  for (const svg of strip.querySelectorAll(".wood-print-line")) {
    const text = svg.querySelector("text");
    if (!text?.getBBox) continue;
    text.removeAttribute("transform");
    const b = text.getBBox();
    if (b.width <= 0 || b.height <= 0) continue;
    const scale = Math.min(1, box.width * .84 / Math.max(1,b.width), box.height * .74 / Math.max(1,b.height));
    text.setAttribute("transform", `translate(${box.width/2-scale*(b.x+b.width/2)} ${box.height/2-scale*(b.y+b.height/2)}) scale(${scale})`);
  }
}
function onWoodPaperFrame(now) {
  paperFrame = 0;
  const strip = document.querySelector(".wood-paper-strip");
  const u = Math.max(0, Math.min(1, (now-paperStarted)/220));
  const eased = u*u*(3-2*u);
  if (strip) strip.style.transform = `translateY(${-80*eased}%)`;
  if (u < 1) paperFrame = window.requestAnimationFrame(onWoodPaperFrame);
  else stopWoodPaper();
}
function stopWoodPaper(preserve = false) {
  if (paperFrame) window.cancelAnimationFrame(paperFrame);
  paperFrame = 0;
  paperTimers.forEach(id => window.clearTimeout(id)); paperTimers = [];
  const strip = document.querySelector(".wood-paper-strip");
  if (!strip) return;
  // Cancellation freezes the visible transport; never swap SVGs or reset its offset.
  if (preserve) return;
  strip.classList.remove("is-feeding");
  strip.style.transform = "";
  strip.innerHTML = printGlyphs(paperFinal);
  centerWoodText();
}
function presentWoodPaper(text, feed = false) {
  if (text === paperFinal && !paperFrame && document.querySelector(".wood-paper-strip")?.innerHTML?.includes("<svg")) { centerWoodText(); return; }
  const previous = paperFinal;
  stopWoodPaper();
  const strip = document.querySelector(".wood-paper-strip");
  if (!strip) return;
  paperFinal = text;
  if (!feed || previous === text || prefersReducedMotion()) { stopWoodPaper(); return; }
  strip.innerHTML = printGlyphs(previous) + printGlyphs(text).replace('class="wood-print-line', 'class="wood-next-line wood-print-line');
  centerWoodText(); strip.getBoundingClientRect(); strip.classList.add("is-feeding");
  paperStarted = performance.now();
  paperFrame = window.requestAnimationFrame(onWoodPaperFrame);
}
window.addEventListener("resize", centerWoodText);
window.addEventListener("orientationchange", centerWoodText);
document.fonts?.ready?.then(centerWoodText);
document.fonts?.addEventListener?.("loadingdone", centerWoodText);
// Hidden themes/settings can have zero layout bounds; observe the visible paper.
const woodPaperObserver = typeof ResizeObserver === "function" ? new ResizeObserver(centerWoodText) : null;
const woodPaperStrip = document.querySelector(".wood-paper-strip");
if (woodPaperStrip) woodPaperObserver?.observe(woodPaperStrip);
function setLiveContact(active) {
  recorderThemes.setPressed(active);
  for (const node of [performanceScreen, detectorButton]) {
    if (active) node.classList.add("is-live");
    else node.classList.remove("is-live");
  }
  if (active) startLiveTrace();
  else {
    if (traceMode === "run") {
      woodRunEnd = Math.min(activeScanDurationMs, Math.max(0, performance.now()-hold.startedAt));
      renderWoodTrace(woodRunEnd, true);
    }
    stopLiveTrace();
  }
}

// Decorative only. Text is already in the DOM; this must not wait on the scan clock.
function presentInk(node) {
  if (!node) return;
  if (node === testIndicator && performanceScreen.dataset.displayTheme === "recorder") node.textContent = "";
  node.classList.remove("is-inked");
  if (performanceScreen.dataset.displayTheme !== "recorder" || node.textContent === "") return;
  if (typeof node.getClientRects === "function") node.getClientRects();
  node.classList.add("is-inked");
}

function presentStatuses() {
  presentInk(testIndicator);
  presentInk(verdict);
}

function setStage(mode, preservePaper = false) {
  if (performanceScreen.dataset.displayTheme === "recorder") {
    if (mode === "TRUE" || mode === "LIE") { woodRunEnd = activeScanDurationMs; renderWoodTrace(woodRunEnd, true); stopLiveTrace(); presentWoodPaper(mode === "TRUE" ? "진실" : "거짓", true); }
    else if (!preservePaper && (mode === "testing" || mode === "idle")) presentWoodPaper("검사 대기 중");
  }
  if (signalMode) signalMode.textContent = mode === "testing" ? "측정 중" : mode === "cancelled" ? "취소" : mode === "TRUE" || mode === "LIE" ? "완료" : "대기";
  if (readyTimer) {
    window.clearTimeout(readyTimer);
    readyTimer = 0;
  }
  for (const node of [document.body, performanceScreen, detectorButton, verdict]) {
    node.classList.remove(...STAGE_CLASSES);
  }
  detectorButton.setAttribute("aria-busy", mode === "testing" ? "true" : "false");
  if (mode === "testing") {
    performanceScreen.classList.add("is-testing");
    detectorButton.classList.add("is-testing");
    document.body.classList.add("is-testing");
    testIndicator.textContent = "검사 중";
    verdict.textContent = "";
    presentStatuses();
    return;
  }
  if (mode === "cancelled") {
    performanceScreen.classList.add("is-cancelled");
    detectorButton.classList.add("is-cancelled");
    verdict.classList.add("is-cancelled");
    testIndicator.textContent = "취소됨";
    verdict.textContent = "";
    presentStatuses();
    return;
  }
  if (mode === "LIE" || mode === "TRUE") {
    const tone = mode === "TRUE" ? "is-true" : "is-lie";
    performanceScreen.classList.add(tone);
    detectorButton.classList.add(tone);
    verdict.classList.add(tone);
    document.body.classList.add(tone);
    testIndicator.textContent = "";
    verdict.textContent = mode === "TRUE" ? "진실" : "거짓";
    presentStatuses();
    return;
  }
  testIndicator.textContent = "검사 대기 중";
  verdict.textContent = "";
  presentStatuses();
}

function showReadyFeedback() {
  testIndicator.textContent = "준비완료";
  presentInk(testIndicator);
  const pulseMs = READY_HAPTIC_MS[vibrationInput.value];
  if (pulseMs && typeof navigator.vibrate === "function") {
    try { navigator.vibrate(pulseMs); } catch { /* Visual feedback remains available. */ }
  }
  readyTimer = window.setTimeout(() => {
    readyTimer = 0;
    if (testIndicator.textContent === "준비완료") {
      testIndicator.textContent = "검사 대기 중";
      presentInk(testIndicator);
    }
  }, READY_FEEDBACK_MS);
}

function pointOnButton(x, y, target) {
  if (performanceScreen.dataset.displayTheme !== "recorder" && target instanceof Element && target.closest("#detector-button")) return true;
  const rect = detectorButton.getBoundingClientRect();
  // The approved contact surfaces are rectangular, so blank table space is not a hit.
  if (rect.width <= 0 || rect.height <= 0) return false;
  return x >= rect.left && x <= rect.left + rect.width &&
    y >= rect.top && y <= rect.top + rect.height;
}

function settingsVisible() {
  return !settingsScreen.hidden;
}

function showSettings() {
  stopWoodPaper();
  recorderThemes.suspend();
  stopScanningSound();
  stopVibration();
  if (readyTimer) {
    window.clearTimeout(readyTimer);
    readyTimer = 0;
  }
  settingsScreen.hidden = false;
  performanceScreen.hidden = true;
  detectorButton.disabled = true;
  document.body.classList.remove("is-testing");
  performanceScreen.classList.remove("is-testing");
  detectorButton.classList.remove("is-testing");
  setLiveContact(false);
  detectorButton.setAttribute("aria-busy", "false");
  truthInput.value = appState.settings.truthAttempts.join(",");
  updateAttemptProgress();
}

function needsHapticPreparation() {
  return typeof navigator.vibrate === "function" && vibrationInput.value !== "off" &&
    navigator.userActivation?.hasBeenActive === false;
}

function refreshHapticPreparation() {
  if (performanceScreen.hidden || settingsVisible() || holdPointerId != null) return;
  const preparing = needsHapticPreparation();
  if (preparing) performanceScreen.classList.add("is-preparing");
  else performanceScreen.classList.remove("is-preparing");
  if (preparing) {
    testIndicator.textContent = "한 번 터치해 준비";
    presentInk(testIndicator);
  } else if (testIndicator.textContent === "한 번 터치해 준비") {
    setStage("idle");
  }
}

function showPerformance() {
  gestureConsumed = false;
  readyFeedbackShown = false;
  pointers.clear();
  settingsScreen.hidden = true;
  performanceScreen.hidden = false;
  centerWoodText();
  resumeRecorderTheme();
  detectorButton.disabled = false;
  primerPointerId = null;
  refreshHapticPreparation();
}

function ensureAudio() {
  if (!soundEnabled()) return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioCtx();
    audioResumePromise = null;
  }
  const ctx = audioContext;
  if (ctx.state !== "running") {
    // Retry from each real gesture, including WebKit's interrupted state.
    audioResumePromise = Promise.resolve(ctx.resume()).catch(() => {});
  }
  return ctx;
}

function withReadyAudio(play) {
  try {
    const ctx = ensureAudio();
    if (!ctx) return;
    const requestId = soundRequestId;
    const playIfCurrent = () => {
      if (requestId !== soundRequestId || ctx !== audioContext ||
          ctx.state !== "running" || !soundEnabled() || document.hidden) return;
      try { play(ctx); } catch { /* Visual feedback remains available. */ }
    };
    if (ctx.state === "running") playIfCurrent();
    else audioResumePromise?.then(playIfCurrent);
  } catch {
    /* Audio support or permission may be unavailable. */
  }
}

function playTone(ctx, destination, frequency, startAt, duration, type, peak) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}

function playVerdictSound(result) {
  if (recorderThemes.active()) return;
  if (!soundEnabled()) return;
  withReadyAudio((ctx) => {
    // Let the scan tone's short release ramp finish before the verdict cue.
    const start = ctx.currentTime + 0.06;
    const master = ctx.createGain();
    master.gain.setValueAtTime(1, start);
    master.connect(ctx.destination);
    if (result === "LIE") {
      // The two peaks sum to 0.76, leaving headroom at the output.
      playTone(ctx, master, 196, start, 0.34, "square", 0.52);
      playTone(ctx, master, 277, start, 0.34, "square", 0.24);
      window.setTimeout(() => master.disconnect(), 500);
      return;
    }
    if (result === "TRUE") {
      // ding-dong-dang: three separated notes, not a chord.
      const notes = [784, 659.25, 1046.5];
      notes.forEach((frequency, index) => {
        playTone(ctx, master, frequency, start + index * 0.2, 0.18, "sine", 0.68);
      });
      window.setTimeout(() => master.disconnect(), 800);
    }
  });
}

function stopScanningSound() {
  // Also cancel callbacks waiting for resume, even before a node exists.
  soundRequestId += 1;
  if (!scanOscillator) return;
  const oscillator = scanOscillator;
  const gain = scanGain;
  scanOscillator = null;
  scanGain = null;
  try {
    const now = audioContext?.currentTime ?? 0;
    gain?.gain.cancelScheduledValues(now);
    if (gain) {
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    }
    oscillator.stop(now + 0.045);
  } catch {
    try { oscillator.stop(); } catch { /* Oscillator may already have stopped. */ }
  }
}

function startScanningSound() {
  stopScanningSound();
  if (recorderThemes.active()) return;
  if (!soundEnabled()) return;
  withReadyAudio((ctx) => {
    if (settled || hold.phase !== "holding" || activePointerId == null) return;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(148, now);
    oscillator.frequency.linearRampToValueAtTime(226, now + activeScanDurationMs / 1000 * 0.925);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.17, now + 0.08);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    scanOscillator = oscillator;
    scanGain = gain;
    oscillator.start(now);
  });
}

function applyRelease(nowMs, x, y) {
  if (settled) return;
  settled = true;
  clearHoldTimer();
  stopScanningSound();
  stopVibration();
  const result = releaseHold(appState, hold, nowMs, x, y, activeScanDurationMs);
  hold = result.hold;
  appState = result.state;
  // Wood ink freezes at the verdict; other skins retain their lifecycle.
  if (performanceScreen.dataset.displayTheme === "recorder" || !(result.counted && holdPointerId != null)) setLiveContact(false);
  recorderThemes.finish(result.counted, result.verdict, result.counted ? nowMs : performance.now());
  if (result.counted) {
    updateAttemptProgress();
    const saved = persistState();
    setStage(result.verdict === "TRUE" ? "TRUE" : "LIE");
    playVerdictSound(result.verdict);
    if (storageLocked) {
      setStatus("시도는 반영했습니다. 읽을 수 없는 저장값은 덮어쓰지 않습니다.");
    } else if (!saved) {
      setStatus("시도 횟수를 이 브라우저에 저장하지 못했습니다.");
    }
    return;
  }
  if (result.outcome === "cancelled") {
    stopWoodPaper(true);
    // Return to idle without replaying ink or replacing the paper.
    setStage(performanceScreen.dataset.displayTheme === "recorder" ? "idle" : "cancelled", true);
  }
}

function armThresholdTimer() {
  clearHoldTimer();
  holdTimer = window.setTimeout(() => {
    holdTimer = 0;
    if (settled || hold.phase !== "holding" || activePointerId == null) return;
    const now = performance.now();
    if (now - hold.startedAt < activeScanDurationMs) {
      armThresholdTimer();
      return;
    }
    applyRelease(now, hold.originX, hold.originY);
  }, Math.max(0, activeScanDurationMs - (performance.now() - hold.startedAt)));
}

function startHold(event) {
  const begun = beginHold(createHold(), performance.now(), event.clientX, event.clientY);
  if (!begun.accepted) return;
  hold = begun.hold;
  syncLiveScanDuration();
  activeScanDurationMs = scanDurationMs;
  settled = false;
  activePointerId = event.pointerId;
  holdPointerId = event.pointerId;
  setLiveContact(true);
  setStage("testing");
  recorderThemes.begin();
  startScanningSound();
  startVibration(activeScanDurationMs);
  armThresholdTimer();
}

function cancelUnsettledHold() {
  if (settled || hold.phase === "idle") {
    activePointerId = null;
    return;
  }
  const startedAt = hold.startedAt;
  applyRelease(startedAt, Number.NaN, Number.NaN);
  activePointerId = null;
}

function openSettings() {
  if (performanceScreen.hidden) return;
  if (!settled && hold.phase !== "idle") cancelUnsettledHold();
  pointers.clear();
  activePointerId = null;
  holdPointerId = null;
  readyPointerId = null;
  primerPointerId = null;
  setLiveContact(false);
  gestureConsumed = false;
  clearHoldTimer();
  showSettings();
}

function forgetPointer(pointerId) {
  pointers.delete(pointerId);
  if (pointerId === activePointerId) activePointerId = null;
  if (pointers.size < 2) gestureConsumed = false;
}

function maybeOpenFromSwipe() {
  if (gestureConsumed || settingsVisible() || pointers.size !== 2) return;
  const contacts = [...pointers.values()];
  if (contacts.some((contact) => contact.startedOnButton)) return;
  const bothOutside = contacts.every((contact) => !pointOnButton(contact.x, contact.y, null));
  if (!bothOutside) return;
  const bothDown = contacts.every((contact) => {
    const dx = contact.x - contact.startX;
    const dy = contact.y - contact.startY;
    return dy >= SWIPE_DOWN_PX && dy > Math.abs(dx);
  });
  if (!bothDown) return;
  gestureConsumed = true;
  openSettings();
}

function onPointerDown(event) {
  if (performanceScreen.hidden || settingsVisible()) return;
  if (event.cancelable) event.preventDefault();
  const onButton = pointOnButton(event.clientX, event.clientY, event.target);
  pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    startedOnButton: onButton,
  });
  try {
    performanceScreen.setPointerCapture(event.pointerId);
  } catch {
    /* Capture can fail if the pointer already ended. */
  }
  unlockFromGesture();
  // Loading blocks only the contact pad; outside pointers still open settings.
  if (onButton && performanceScreen.dataset.recorderLoading === "true") return;
  // Touch activation occurs at lift, not down. Preparation never counts an attempt.
  if (needsHapticPreparation()) {
    if (onButton && pointers.size === 1) { primerPointerId = event.pointerId; recorderThemes.setPressed(true); }
    refreshHapticPreparation();
    return;
  }
  refreshHapticPreparation();
  if (!onButton && !readyFeedbackShown && holdPointerId == null) {
    readyFeedbackShown = true;
    readyPointerId = event.pointerId;
    showReadyFeedback();
  }
  if (pointers.size > 1) {
    if (!settled && hold.phase !== "idle") cancelUnsettledHold();
    return;
  }
  if (onButton && activePointerId == null) startHold(event);
}

function onPointerMove(event) {
  const contact = pointers.get(event.pointerId);
  if (!contact || performanceScreen.hidden) return;
  contact.x = event.clientX;
  contact.y = event.clientY;
  if (performanceScreen.dataset.displayTheme === "recorder" && event.pointerId === holdPointerId && !pointOnButton(contact.x, contact.y, null)) {
    if (!settled) cancelUnsettledHold();
    setLiveContact(false);
    holdPointerId = null;
  }
  if (event.pointerId === activePointerId && !settled && hold.phase === "holding") {
    const updated = updateHold(hold, event.clientX, event.clientY);
    hold = updated.hold;
    if (updated.cancelled) applyRelease(performance.now(), event.clientX, event.clientY);
  }
  maybeOpenFromSwipe();
}

function onPointerUp(event) {
  if (event.pointerId === primerPointerId) {
    primerPointerId = null;
    recorderThemes.setPressed(false);
    stopVibration();
    forgetPointer(event.pointerId);
    refreshHapticPreparation();
    return;
  }
  const contact = pointers.get(event.pointerId);
  if (!contact) return;
  contact.x = event.clientX;
  contact.y = event.clientY;
  const endsHold = event.pointerId === holdPointerId || event.pointerId === activePointerId;
  const endsReady = event.pointerId === readyPointerId;
  if (event.pointerId === activePointerId && !settled) {
    applyRelease(performance.now(), event.clientX, event.clientY);
  }
  if (endsHold || endsReady) {
    stopVibration();
    if (endsReady) readyPointerId = null;
    setLiveContact(false);
    if (event.pointerId === holdPointerId) holdPointerId = null;
  }
  maybeOpenFromSwipe();
  forgetPointer(event.pointerId);
}

function onPointerCancel(event) {
  if (event.pointerId === primerPointerId) { primerPointerId = null; recorderThemes.setPressed(false); }
  const endsHold = event.pointerId === holdPointerId || event.pointerId === activePointerId;
  const endsReady = event.pointerId === readyPointerId;
  if (endsHold && !settled && hold.phase !== "idle") cancelUnsettledHold();
  if (endsHold || endsReady) stopVibration();
  if (endsHold) { setLiveContact(false); holdPointerId = null; activePointerId = null; }
  if (endsReady) readyPointerId = null;
  forgetPointer(event.pointerId);
}

function onLostPointerCapture(event) {
  // A missing pointerup is a cancelled contact, never an extra attempt.
  onPointerCancel(event);
}

function unlockFromGesture() {
  if (document.hidden || settingsVisible()) return;
  recorderThemes.setSoundEnabled(soundEnabled());
  recorderThemes.unlock();
  if (recorderThemes.active() || !soundEnabled() || document.hidden) return;
  try {
    const ctx = ensureAudio();
    if (!ctx) return;
    // Start a silent source inside the gesture to unlock iOS audio output.
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    source.connect(ctx.destination);
    source.onended = () => source.disconnect();
    source.start(0);
  } catch {
    /* A later gesture can retry without affecting the performance. */
  }
}

function commitTruthAttempt() {
  const next = trySetTruthAttempt(appState, truthInput.value);
  if (!next.ok) {
    truthInput.value = appState.settings.truthAttempts.join(",");
    setStatus("진실 회차는 1부터 20 사이의 서로 다른 정수를 쉼표로 구분해 입력하세요. 예: 2,4");
    return false;
  }
  appState = next.state;
  updateAttemptProgress();
  truthInput.value = appState.settings.truthAttempts.join(",");
  const saved = persistState();
  if (storageLocked) {
    setStatus("설정은 적용했습니다. 읽을 수 없는 저장값은 덮어쓰지 않습니다.");
  } else if (!saved) {
    setStatus("설정을 이 브라우저에 저장하지 못했습니다.");
  } else {
    setStatus("");
  }
  return true;
}

function onResetAttempts() {
  appState = resetAttempts(appState);
  updateAttemptProgress();
  setStage("idle");
  const saved = persistState();
  if (storageLocked) {
    setStatus("시도 횟수는 초기화했습니다. 읽을 수 없는 저장값은 덮어쓰지 않습니다.");
  } else if (!saved) {
    setStatus("시도 횟수는 초기화했지만 저장하지 못했습니다.");
  } else {
    setStatus("시도 횟수를 초기화했습니다.");
  }
}

function onStartPerformance() {
  syncLiveScanDuration();
  const next = preparePerformance(appState, truthInput.value);
  if (!next.ok) {
    setStatus("진실 회차는 1부터 20 사이의 서로 다른 정수를 쉼표로 구분해 입력하세요. 예: 4,7");
    truthInput.focus();
    return;
  }
  appState = next.state;
  truthInput.value = appState.settings.truthAttempts.join(",");
  updateAttemptProgress();
  setStage("idle");
  if (!persistState()) setStatus("이번 공연의 시도 횟수를 이 브라우저에 저장하지 못했습니다.");
  else setStatus("");
  unlockFromGesture();
  showPerformance();
  startButton.blur();
}

function onSoundChange() {
  recorderThemes.setSoundEnabled(soundEnabled());
  persistSoundPreference();
  if (soundInput.checked) unlockFromGesture();
  else stopScanningSound();
}

function onVibrationChange() {
  storageSet(VIBRATION_KEY, vibrationInput.value);
}

function resumeRecorderTheme() {
  if (!document.hidden && !performanceScreen.hidden && !settingsVisible()) recorderThemes.resume();
}

function onVisibilityChange() {
  if (!document.hidden) { resumeRecorderTheme(); return; }
  stopWoodPaper(!settled && hold.phase !== "idle");
  recorderThemes.suspend();
  if (!settled && hold.phase !== "idle") cancelUnsettledHold();
  stopScanningSound();
  stopVibration();
  setLiveContact(false);
  pointers.clear();
  activePointerId = null;
  holdPointerId = null;
  readyPointerId = null;
  primerPointerId = null;
  // Discard contexts that iOS can leave frozen after backgrounding.
  const ctx = audioContext;
  audioContext = null;
  audioResumePromise = null;
  try { ctx?.close().catch(() => {}); } catch { /* Already closed. */ }
}

function onWindowBlur() {
  stopWoodPaper(!settled && hold.phase !== "idle");
  recorderThemes.suspend();
  if (!settled && hold.phase !== "idle") cancelUnsettledHold();
  clearHoldTimer();
  stopScanningSound();
  stopVibration();
  setLiveContact(false);
  pointers.clear();
  activePointerId = null;
  holdPointerId = null;
  readyPointerId = null;
  primerPointerId = null;
}

function bind() {
  // Dismissing the first-run guide also arms this document through a trusted click.
  document.addEventListener("click", refreshHapticPreparation);
  performanceScreen.addEventListener("touchend", refreshHapticPreparation, { passive: true });
  performanceScreen.addEventListener("touchstart", unlockFromGesture, { passive: true });
  performanceScreen.addEventListener("touchend", unlockFromGesture, { passive: true });
  performanceScreen.addEventListener("click", unlockFromGesture);
  performanceScreen.addEventListener("pointerdown", onPointerDown, { passive: false });
  performanceScreen.addEventListener("pointermove", onPointerMove);
  performanceScreen.addEventListener("pointerup", onPointerUp);
  performanceScreen.addEventListener("pointercancel", onPointerCancel);
  performanceScreen.addEventListener("lostpointercapture", onLostPointerCapture);
  performanceScreen.addEventListener("contextmenu", (event) => event.preventDefault());
  truthInput.addEventListener("change", commitTruthAttempt);
  resetButton.addEventListener("click", onResetAttempts);
  startButton.addEventListener("click", onStartPerformance);
  soundInput.addEventListener("change", onSoundChange);
  vibrationInput.addEventListener("change", onVibrationChange);
  scanDurationInput?.addEventListener("input", onScanDurationInput);
  scanDurationInput?.addEventListener("blur", onScanDurationInput);
  scanDurationInput?.addEventListener("change", onScanDurationChange);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", onWindowBlur);
  const invalidateWoodContact = () => { if (performanceScreen.dataset.displayTheme === "recorder") onWindowBlur(); };
  window.addEventListener("resize", invalidateWoodContact);
  window.addEventListener("orientationchange", invalidateWoodContact);
  window.addEventListener("focus", resumeRecorderTheme);
}

// Display appearance is independent of the detector's performance state.
const DISPLAY_THEME_KEY = "usotsuki.detector.theme.v1";
const displayThemeSelect = document.querySelector("#display-theme");
function normalizeDisplayTheme(value) { return ["green", "wine", "recorder", "recorder-a", "recorder-d"].includes(value) ? value : "green"; }
function applyDisplayTheme(value) {
  const theme = normalizeDisplayTheme(value);
  if (performanceScreen.dataset.displayTheme !== theme) {
    stopScanningSound();
    const previousAudio = audioContext;
    audioContext = null;
    audioResumePromise = null;
    try { previousAudio?.close().catch(() => {}); } catch { /* Already closed. */ }
  }
  recorderThemes.switchTheme(theme);
  performanceScreen.dataset.displayTheme = theme;
  if (theme !== "recorder") stopWoodPaper();
  displayThemeSelect.value = theme;
  if (theme !== "recorder") stopLiveTrace();
  else if (holdPointerId != null && performanceScreen.classList.contains("is-live")) startLiveTrace();
  return theme;
}
applyDisplayTheme(storageGet(DISPLAY_THEME_KEY).value);
displayThemeSelect.addEventListener("change", (event) => {
  const theme = applyDisplayTheme(event.target.value);
  storageSet(DISPLAY_THEME_KEY, theme);
  presentStatuses();
});

bootStorage();
appState = resetAttempts(appState);
updateAttemptProgress();
// Loading preserves the original stored bytes; saves happen only after user actions.
setStage("idle");
showPerformance();
bind();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
