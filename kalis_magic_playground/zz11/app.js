import { SEGMENTS, STEP, mod, segmentAtPoint, landingRotation, randomInt, chooseOutcome } from './logic.js';

const wheel = document.getElementById('wheel');
const wrap = document.getElementById('wheel-wrap');
const settings = document.getElementById('settings');
const guide = document.getElementById('guide');
const spinStatus = document.getElementById('spin-status');
const key = 'zz11-spinner-state-v1';
let state = { target: null, forceSpin: 4, spins: 0, previous: null, rotation: 0 };
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && Number.isInteger(saved.forceSpin) && saved.forceSpin >= 1 && saved.forceSpin <= 8 &&
      Number.isInteger(saved.spins) && saved.spins >= 0 &&
      (saved.target === null || (Number.isInteger(saved.target) && saved.target >= 0 && saved.target < SEGMENTS)) &&
      (saved.previous === null || (Number.isInteger(saved.previous) && saved.previous >= 0 && saved.previous < SEGMENTS))) state = saved;
} catch { /* Storage may be unavailable in a private browser. */ }
let rotation = Number.isFinite(state.rotation) ? state.rotation : 0;
let drag = null;
let busy = false;
let twoFingerStart = null;
let installPrompt = null;

for (let index = 0; index < SEGMENTS; index++) {
  const label = document.createElement('span');
  label.className = 'sector-label';
  label.textContent = String(index + 1);
  label.style.left = `${50 + Math.sin(index * STEP * Math.PI / 180) * 33}%`;
  label.style.top = `${50 - Math.cos(index * STEP * Math.PI / 180) * 33}%`;
  wheel.append(label);
}
wheel.style.transform = `rotate(${rotation}deg)`;

function save() { try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Keep this performance in memory. */ } }
function refreshSettings() {
  document.getElementById('target-value').textContent = state.target === null ? '선택 전' : `${state.target + 1}번`;
  document.getElementById('spin-value').textContent = `${state.spins}회`;
  document.getElementById('force-spin').value = String(state.forceSpin);
}
function showSettings() { if (busy || !guide.hidden) return; refreshSettings(); settings.hidden = false; drag = null; }
function closeSettings() { settings.hidden = true; }
function angleAt(event) { const box = wrap.getBoundingClientRect(); return Math.atan2(event.clientX - box.left - box.width / 2, box.top + box.height / 2 - event.clientY) * 180 / Math.PI; }
function signedDifference(a, b) { return mod(a - b + 180) - 180; }

wheel.addEventListener('pointerdown', event => {
  if (!settings.hidden || !guide.hidden || busy || !event.isPrimary) return;
  const box = wrap.getBoundingClientRect();
  const dx = event.clientX - box.left - box.width / 2;
  const dy = event.clientY - box.top - box.height / 2;
  const radius = Math.hypot(dx, dy) / box.width;
  if (radius < .12 || radius > .49) return;
  drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, startAngle: angleAt(event), lastAngle: angleAt(event), amount: 0, started: performance.now(), lastTime: performance.now() };
  wheel.setPointerCapture(event.pointerId);
});
wheel.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id || busy) return;
  const angle = angleAt(event);
  const delta = signedDifference(angle, drag.lastAngle);
  drag.amount += delta;
  drag.lastAngle = angle;
  drag.lastTime = performance.now();
  if (state.target !== null && Math.abs(drag.amount) > 2) {
    rotation += delta;
    wheel.style.transform = `rotate(${rotation}deg)`;
  }
});
wheel.addEventListener('pointerup', event => {
  if (!drag || event.pointerId !== drag.id || busy) return;
  const gesture = drag;
  drag = null;
  const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
  if (distance < 14 && Math.abs(gesture.amount) < 8) {
    if (state.target === null) {
      const box = wrap.getBoundingClientRect();
      state.target = segmentAtPoint(event.clientX, event.clientY, box.left + box.width / 2, box.top + box.height / 2, rotation);
      save();
      navigator.vibrate?.(12);
    }
    return;
  }
  if (state.target === null || Math.abs(gesture.amount) < 8) return;
  spin(gesture.amount < 0 ? -1 : 1, Math.abs(gesture.amount), performance.now() - gesture.started);
});
wheel.addEventListener('pointercancel', () => { drag = null; });

function spin(direction, travel, elapsed) {
  busy = true;
  const outcome = chooseOutcome(state.spins + 1, state.forceSpin, state.target, state.previous);
  const strength = Math.min(1, travel / 240 + (travel / Math.max(250, elapsed)) / 2);
  const turns = 3 + Math.floor(strength * 3) + randomInt(2);
  const jitter = (randomInt(1401) / 100 - 7);
  const end = landingRotation(rotation, outcome, direction, turns, jitter);
  const from = rotation;
  spinStatus.textContent = '회전 중…';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animation = wheel.animate([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${end}deg)` }], {
    duration: reduced ? 50 : 2700 + turns * 260 + randomInt(351),
    easing: 'cubic-bezier(.12,.7,.13,1)', fill: 'forwards'
  });
  animation.onfinish = () => {
    rotation = end;
    wheel.style.transform = `rotate(${rotation}deg)`;
    animation.cancel();
    state.spins++;
    state.previous = outcome;
    state.rotation = mod(rotation);
    save();
    spinStatus.textContent = '';
    busy = false;
  };
}

document.addEventListener('touchstart', event => {
  if (event.touches.length === 2 && settings.hidden && guide.hidden) {
    twoFingerStart = (event.touches[0].clientY + event.touches[1].clientY) / 2;
    drag = null;
  }
}, { passive: true });
document.addEventListener('touchmove', event => {
  if (twoFingerStart === null || event.touches.length !== 2) return;
  const current = (event.touches[0].clientY + event.touches[1].clientY) / 2;
  if (current - twoFingerStart > 65) {
    event.preventDefault();
    twoFingerStart = null;
    showSettings();
  }
}, { passive: false });
document.addEventListener('touchend', event => { if (event.touches.length < 2) twoFingerStart = null; }, { passive: true });

document.getElementById('settings-close').addEventListener('click', closeSettings);
document.getElementById('force-spin').addEventListener('change', event => { state.forceSpin = Number(event.target.value); save(); });
document.getElementById('reset-run').addEventListener('click', () => { state.spins = 0; state.previous = null; save(); refreshSettings(); });
document.getElementById('clear-target').addEventListener('click', () => { state.target = null; state.spins = 0; state.previous = null; save(); refreshSettings(); closeSettings(); });
document.getElementById('guide-close').addEventListener('click', () => { guide.hidden = true; try { localStorage.setItem('zz11-guide-seen', '1'); } catch { /* Ignore storage failures. */ } });
try { guide.hidden = localStorage.getItem('zz11-guide-seen') === '1'; } catch { guide.hidden = false; }
refreshSettings();

window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
document.getElementById('install-app').addEventListener('click', async () => {
  const help = document.getElementById('install-help');
  if (installPrompt) {
    const prompt = installPrompt; installPrompt = null;
    try { await prompt.prompt(); if ((await prompt.userChoice)?.outcome === 'accepted') { help.textContent = '설치가 진행 중입니다.'; help.hidden = false; return; } } catch { /* Use manual instructions. */ }
  }
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  help.textContent = ios ? 'Safari에서 공유 → 홈 화면에 추가를 선택하세요.' : '브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하세요.';
  help.hidden = false;
});
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
