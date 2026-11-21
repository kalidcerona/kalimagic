import {setupWakeLock} from './wake-lock.js';
import {setupUpdates} from './install-update.mjs';
import {listen} from './gestures.mjs';
import {createRound} from './round.mjs';
import {createReels} from './reels.mjs';
import {setCapsule} from './capsule.mjs';
import {drawCard} from './card-face.mjs';
import {preferences} from './storage.mjs';
import {settings} from './settings.mjs';
import {createAudio} from './audio.mjs';
import {vibrate} from './vibration.mjs';
import {portraitGuard} from './orientation.mjs';
const el = id => document.getElementById(id);
const stage = el('stage'), dialog = document.querySelector('dialog');
const prefs = preferences();
const audio = createAudio(() => prefs.sound);
let last, frame = null;
const moving = new Set(['spinning','jackpot','rolling','opening']);
function schedule() {
  if (frame === null && !blocked() && moving.has(stage.dataset.phase)) {
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }
}
const landscape = portraitGuard(sync);
const blocked = () => landscape() || dialog.open || document.hidden;
const round = createRound({
  targetRound: () => prefs.round, blocked, box: id => el(id).getBoundingClientRect(), audio,
  render(phase) {
    stage.dataset.phase = phase;
    el('machine').hidden = phase === 'dark';
    el('spin').setAttribute('aria-disabled', String(phase !== 'ready'));
    schedule();
  },
  reels:createReels([...document.querySelectorAll('#reels i')]),
  capsule: state => setCapsule(el('capsule'),state),
  reveal: card => {
    if (card) {
      const capsule = el('capsule').getBoundingClientRect();
      stage.style.setProperty('--lift', (capsule.top + capsule.height/2 - stage.getBoundingClientRect().height/2) + 'px');
    }
    drawCard(el('result'),card);
  },
  vibrate: () => vibrate(prefs.vibration)
});
const openSettings = settings(dialog,prefs,round.reset,sync,round.progress);
const clearPointers = listen(stage,round.candidate,openSettings);
function tick(t) {
  if (blocked()) { frame = null; return; }
  round.advance(Math.max(0,t-last));
  last = t;
  frame = moving.has(stage.dataset.phase) ? requestAnimationFrame(tick) : null;
}
function sync() {
  clearPointers();
  cancelAnimationFrame(frame);
  frame = null;
  stage.classList.toggle('paused',blocked());
  if (blocked()) audio.stop();
  else {
    if (stage.dataset.phase === 'spinning') audio.play('motor');
    schedule();
  }
}
window.addEventListener('blur',clearPointers);
document.addEventListener('visibilitychange',sync);
setupWakeLock(() => {}).keepAwake();
setupUpdates(el('update'));
sync();
