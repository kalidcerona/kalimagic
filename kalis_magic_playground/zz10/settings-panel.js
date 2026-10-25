import { updateAlterState } from "./logic.js";
import { createObservationTracker } from "./performance.js";
import { $, overlay, settings, gestureGuide } from "./dom.js";
import { machine, stream, setMachine, setTracker, setLastSampleAt } from "./state.js";
import { closeGestureGuide } from "./settings-store.js";
import { updateStateNote } from "./card-view.js";
import { resetAppearance } from "./tracking-reset.js";
import { syncPerformanceWakeLock } from "./wake-lock.js";

function openSettings() {
  if (!settings.hidden) return;
  if (!gestureGuide.hidden) closeGestureGuide();
  if (stream) {
    setMachine(updateAlterState(machine, { type: "interrupt", t: performance.now() }));
    setTracker(createObservationTracker());
    resetAppearance();
    overlay.hidden = true;
  }
  settings.classList.toggle("is-running", Boolean(stream));
  updateStateNote();
  settings.hidden = false;
  $("close-settings").focus();
  syncPerformanceWakeLock();
}

function closeSettings() {
  settings.hidden = true;
  setLastSampleAt(0);
  setTracker(createObservationTracker());
  resetAppearance();
  syncPerformanceWakeLock();
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

export { openSettings, closeSettings, settingsContacts, settingsPairReady };
