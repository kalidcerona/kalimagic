import { createSynth } from './audio.mjs';
import { listen } from './gestures.mjs';
import { press } from './dome.mjs';
import { vibrate } from './vibration.mjs';
import { setupSettings } from './settings.mjs';
import { setupWakeLock } from './wake-lock.js';
import { setupUpdates } from './install-update.mjs';

const synth = createSynth();
const settings = setupSettings(synth.ring);
const stage = document.querySelector('#stage');
const dome = stage.querySelector('.dome');
function perform(action) {
  if (action === 'settings') {
    synth.cancelPending();
    settings.open();
  } else {
    synth.ring(settings.sound());
    vibrate();
    press(dome);
  }
}
listen(stage, perform);
stage.onclick = event => { if (event.detail === 0) perform('ring'); };
stage.oncontextmenu = event => event.preventDefault();
stage.onkeydown = event => {
  if (event.key === 'ArrowDown' && event.altKey) {
    event.preventDefault();
    perform('settings');
  }
  if (event.repeat) event.preventDefault();
};
document.addEventListener('visibilitychange', () => { if (document.hidden) synth.cancelPending(); });
setupWakeLock(() => {}).keepAwake();
setupUpdates(document.querySelector('#update'));
