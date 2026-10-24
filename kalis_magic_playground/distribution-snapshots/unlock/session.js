import { normalizeSettings, storageIdentityForPath, createState } from './logic.js';

export const $ = (id) => document.getElementById(id);

export const session = {
  STORAGE: null,
  SETTINGS_KEY: null,
  settings: null,
  state: null,
  screen: 'settings',
  timeMinutes: 0,
  timeDigits: [],
  timeTriggeredAt: null,
  timeTriggeredWallAt: null,
  timeLastTap: null,
  emergencyLastTap: null,
  timePointer: null,
  timeSuppressUntil: 0,
  performanceTouched: false,
  pendingImages: 0,
  db: null,
  dbReady: undefined,
  originals: null,
  imageKeys: null,
};

const SETTINGS_TUTORIAL_KEY = /^\/tools\/(?:unlock|release)(?:\/|$)/.test(location.pathname)
  ? "friend-unlock-settings-entry-tutorial-v1"
  : "unlock-settings-entry-tutorial-v1";
function showSettingsEntryTutorial() {
  try { if (localStorage.getItem(SETTINGS_TUTORIAL_KEY) === "1") return; } catch (_) {}
  const tutorial = document.getElementById("settings-entry-tutorial");
  tutorial.hidden = false;
}
session.showSettingsEntryTutorial = showSettingsEntryTutorial;
document.getElementById("settings-entry-tutorial-dismiss").addEventListener("click", () => {
  document.getElementById("settings-entry-tutorial").hidden = true;
  try { localStorage.setItem(SETTINGS_TUTORIAL_KEY, "1"); } catch (_) {}
});

const STORAGE = storageIdentityForPath(location.pathname);
session.STORAGE = STORAGE;
$("settings-form").addEventListener("invalid", (event) => {
  const group = event.target.closest("details");
  if (group) group.open = true;
}, true);
const SETTINGS_KEY = STORAGE.settingsKey;
session.SETTINGS_KEY = SETTINGS_KEY;
$('performance-heading').textContent = '리와인드';
$('performance-field').hidden = true;
let saved = null;
try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch {}
if (!saved && SETTINGS_KEY !== 'unlock-settings-v1') {
  try { saved = JSON.parse(localStorage.getItem('unlock-settings-v1')); } catch {}
}
session.settings = normalizeSettings(saved && typeof saved === 'object' ? saved : {});
session.state = createState(session.settings.digits);
document.addEventListener('pointerdown', () => { if (session.screen !== 'settings') session.performanceTouched = true; }, { capture: true });
