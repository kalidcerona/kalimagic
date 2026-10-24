import { verdictForAttempt } from "./logic.js";
import { createContinuousTrace } from "./recorder-trace.js";
import {
  performanceScreen, detectorButton, testIndicator, verdict, signalMode, settingsScreen, truthInput,
  vibrationInput, pointOnButton, settingsVisible,
} from "./dom.js";
import { buildHeartbeat, heartbeatValue } from "./heartbeat.js";
import { clearVibrationRecheck, stopVibration } from "./vibration.js";
import { syncPerformanceWakeLock } from "./wake-lock.js";
import {
  recorderThemes, appState, hold, activeScanDurationMs, settled, holdPointerId, pointers,
  updateAttemptProgress, stopScanningSound,
} from "./controller.js";

const READY_FEEDBACK_MS = 600;
const READY_HAPTIC_MS = { medium: 18, high: 28, max: 38 };

const STAGE_CLASSES = ["is-testing", "is-lie", "is-true", "is-cancelled"];

let readyTimer = 0;

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
  clearVibrationRecheck();
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
  syncPerformanceWakeLock();
}

export {
  stopLiveTrace, startLiveTrace, centerWoodText, stopWoodPaper, setLiveContact, presentInk,
  presentStatuses, setStage, showReadyFeedback, showSettings,
};
