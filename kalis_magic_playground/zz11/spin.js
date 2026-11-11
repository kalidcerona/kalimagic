import { angleAtPoint, mod, landingRotation, randomInt, chooseOutcome } from './logic.js';
import { installSettingsGesture } from './settings-gesture.js';

export function installSpin() {

  const stage = document.querySelector('.stage');
  const wrap = document.getElementById('wheel-wrap');
  const arrow = document.getElementById('spinner-arrow');
  const settings = document.getElementById('settings');
  const guide = document.getElementById('guide');
  const spinStatus = document.getElementById('spin-status');
  const key = 'zz11-spinner-state-v2';
  let state = { targetAngle: null, forceSpin: 4, spins: 0, previousAngle: null, rotation: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && Number.isInteger(saved.forceSpin) && saved.forceSpin >= 1 && saved.forceSpin <= 8 &&
        Number.isInteger(saved.spins) && saved.spins >= 0 &&
        (saved.targetAngle === null || (Number.isFinite(saved.targetAngle) && saved.targetAngle >= 0 && saved.targetAngle < 360)) &&
        (saved.previousAngle === null || (Number.isFinite(saved.previousAngle) && saved.previousAngle >= 0 && saved.previousAngle < 360))) state = saved;
    else {
      const previous = JSON.parse(localStorage.getItem('zz11-spinner-state-v1'));
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
  // Ask once, after this page loads, for the browser to keep stored data. No prompt and no UI.
  function askToKeepStoredData() {
    try {
      if (typeof navigator === "undefined" || !navigator.storage || typeof navigator.storage.persist !== "function") return;
      Promise.resolve(navigator.storage.persist()).catch(() => {});
    } catch {
      // A refusal is ignored. Nothing is shown.
    }
  }
  askToKeepStoredData();

  function showSettings() {
    if (busy || !guide.hidden) return;
    refreshSettings();
    settings.hidden = false;
    drag = null;
    window.MagicUpdate?.offer(); // settings is off-stage; never offered from the wheel
  }
  function closeSettings() {
    settings.hidden = true;
    window.MagicUpdate?.hide();
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
    window.MagicUpdate?.hide();
    try { localStorage.setItem('zz11-guide-seen-v2', '1'); } catch { /* Ignore storage failures. */ }
  });
  try { guide.hidden = localStorage.getItem('zz11-guide-seen-v2') === '1'; } catch { guide.hidden = false; }
  refreshSettings();
  syncTargetCue();

  installSettingsGesture({ settings, guide, showSettings, cancelDrag() {
    drag = null;
    if (!busy) {
      rotation = state.rotation;
      arrow.style.transform = `rotate(${rotation}deg)`;
    }
  } });
  return { stage, arrow, spinStatus, settings, showSettings };
}
