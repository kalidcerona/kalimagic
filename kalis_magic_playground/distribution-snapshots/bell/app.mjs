import { createSynth } from './audio.mjs';
import { listen } from './gestures.mjs';
import { createScene, press, unpress } from './dome.mjs';
import { readBackground, readCardBack } from './storage.mjs';
import { vibrate } from './vibration.mjs';
import { setupSettings } from './settings.mjs';
import { setupWakeLock } from './wake-lock.js';
import { setupUpdates } from './install-update.mjs';

let device;
const synth = createSynth(() => device = new (window.AudioContext || window.webkitAudioContext)());
const settings = setupSettings(synth.ring);
const stage = document.querySelector('#stage');
const dome = stage.querySelector('.dome');
const gesture = listen(stage, perform, { ...createScene(stage), cancelPending: synth.cancelPending });
function appearance() {
  stage.dataset.background = readBackground();
  stage.dataset.cardBack = readCardBack();
}
function interrupt() {
  gesture.reset();
  synth.cancelPending();
  unpress(dome);
}
export function resetPerformance() {
  interrupt();
  if (device && device.state !== 'closed') device.close().catch(() => {});
  gesture.resetPerformance();
}
function perform(action, onStarted) {
  if (action === 'settings') {
    interrupt();
    settings.open();
  } else if (action === 'ring') {
    synth.ring(settings.sound(), onStarted);
    vibrate();
    press(dome);
  } else if (action === 'stuck') press(dome, true);
}
appearance();
gesture.resetPerformance();
stage.onclick = event => { if (event.detail === 0) perform(gesture.activate()); };
stage.oncontextmenu = event => event.preventDefault();
stage.onkeydown = event => {
  if (event.key === 'ArrowDown' && event.altKey) {
    event.preventDefault();
    perform('settings');
  }
  if (event.repeat) event.preventDefault();
};
document.addEventListener('bell:next-performance', resetPerformance);
document.addEventListener('bell:appearance', ({ detail }) => {
  if (detail.background) stage.dataset.background = detail.background;
  if (detail.cardBack) stage.dataset.cardBack = detail.cardBack;
});
window.addEventListener('blur', interrupt);
window.addEventListener('orientationchange', interrupt);
window.screen.orientation?.addEventListener('change', interrupt);
document.addEventListener('visibilitychange', interrupt);
setupWakeLock(() => {}).keepAwake();
setupUpdates(document.querySelector('#update'));
