import * as C from './core.mjs';
import { $, params, DEBUG } from './dom.mjs';
import { store } from './presets.mjs';
import { lastRaw } from './detect.mjs';

// ---------- opening a link ----------
const gate = new C.OnceGate(3000);
const opened = [];
function openUrl(url) {
  opened.push(url);
  if (DEBUG && params.get('dry') === '1') return;
  if (store.settings.sameWindow) { location.assign(url); return; }
  // A real anchor click inside the chip tap, so the browser treats it as a normal link opened in a new tab.
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.append(a);
  a.click();
  a.remove();
}

/** Chip tap (web version of MainActivity.onChipTap). */
function onChipTap() {
  if (!lastRaw) return;
  const a = store.armed;
  const act = C.scanAction(lastRaw, a, store.cats);
  // Armed with no usable target: disarm and stay silent this time. Silent no-ops never use up the gate.
  if (a && act.open === null) { store.setArmed(null); return; }
  if (!act.open || !gate.tryFire()) return;
  openUrl(act.open);
  if (a && C.sameArmed(store.armed, a)) store.setArmed(act.next);
}
$('chip').addEventListener('click', onChipTap);

export {
  onChipTap,
  opened,
};
