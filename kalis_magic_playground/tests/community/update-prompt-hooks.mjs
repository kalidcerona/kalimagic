// The exact update-prompt hook lines that personal apps carry and the pinned friend snapshots do not yet.
// Parity tests call stripUpdatePrompt(app, file, text) on the personal text before comparing it with a snapshot.
// Each entry is [text in the personal file, text in the pinned snapshot, expected count]. Nothing else is stripped.
// Retire an app's entries when its snapshot is regenerated.
const SW = [
  ["-update-prompt-1';", "';", 1],
  ['  "./update-prompt.js",\n', '', 1],
  ['// The page asks for this only after the performer taps "update now" (update-prompt.js).\nself.addEventListener(\'message\', (event) => {\n  if (event.data && event.data.type === \'SKIP_WAITING\') self.skipWaiting();\n});\n', '', 1],
];
const DEFER_TAG = '  <script src="./update-prompt.js" defer></script>\n';
const OFFER = '  window.MagicUpdate?.offer(); // settings is off-stage\n';
const HIDE = '  window.MagicUpdate?.hide();\n';
const REG6 = [
  `    const registration = navigator.serviceWorker.register('./sw.js', { scope: './' });
    registration.catch(() => {
      // file:// and locked-down browsers have no offline shell. The page still runs.
    });
    window.MagicUpdate?.init({ registrationPromise: registration, safe: () => state.mode === 'settings' });`,
  `    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      // file:// and locked-down browsers have no offline shell. The page still runs.
    });`, 1];

export const UPDATE_PROMPT_HOOKS = {
  'zz1/sw.js': SW,
  'zz1/index.html': [[DEFER_TAG, '', 1]],
  'zz1/app.js': [
    ['      window.MagicUpdate?.offer(); // settings is off-stage\n', '', 1],
    ['window.MagicUpdate?.hide();', '', 1],
    ['window.MagicUpdate?.init({registrationPromise:navigator.serviceWorker?.ready,safe:()=>!settings.hidden&&state!=="running"&&!presetMode});', '', 1],
  ],
  'zz2/sw.js': SW,
  'zz2/index.html': [[DEFER_TAG, '', 1]],
  'zz2/rewind.js': [["      // Update prompt: asked only on the settings screen, hidden on every other screen.\n      if (next === 'settings') globalThis.MagicUpdate?.offer(); else globalThis.MagicUpdate?.hide();\n", '', 1]],
  'zz2/settings.js': [["        globalThis.MagicUpdate?.init({ registration, safe: () => session.screen === 'settings' });\n", '', 1]],
  'zz3/sw.js': SW,
  'zz3/index.html': [['  <script src="./update-prompt.js"></script>\n', '', 1]],
  'zz3/app.js': [
    ['        window.MagicUpdate?.offer(); // settings is off-stage\n', '', 1],
    ['          window.MagicUpdate?.hide();\n', '', 1],
    ['      window.MagicUpdate?.init({ registrationPromise: navigator.serviceWorker?.ready, safe: () => dateSettings.classList.contains("open") });\n', '', 1],
  ],
  'zz5/sw.js': SW,
  'zz5/index.html': [[DEFER_TAG, '', 1]],
  'zz5/performance-run.js': [[OFFER, '', 1], [HIDE, '', 1]],
  'zz5/controller.js': [[
    `  const registration = navigator.serviceWorker.register('./sw.js', { scope: './' });
  registration.catch(() => {
    // Registration needs http(s). The page still runs without a worker.
  });
  window.MagicUpdate?.init({ registrationPromise: registration, safe: () => view === 'settings' && !settings.hidden });`,
    `  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
    // Registration needs http(s). The page still runs without a worker.
  });`, 1]],
  'zz6/sw.js': SW,
  'zz6/index.html': [[DEFER_TAG, '', 1]],
  'zz6/mode-switch.js': [[OFFER, '', 1], [HIDE, '', 1]],
  'zz6/app.js': [REG6],
  'zz7/sw.js': SW,
  'zz7/index.html': [['    <script src="update-prompt.js" defer></script>\n', '', 1]],
  'zz7/controller-screens.js': [[OFFER, '', 1], [HIDE, '', 1]],
  'zz7/detector.js': [
    ['\nimport { settingsVisible } from "./dom.js";', '', 1],
    [`  const registration = navigator.serviceWorker.register("./sw.js");
  registration.catch(() => {});
  window.MagicUpdate?.init({ registrationPromise: registration, safe: () => settingsVisible() });`,
      '  navigator.serviceWorker.register("./sw.js").catch(() => {});', 1]],
  'zz8/sw.js': SW,
  'zz8/index.html': [['  <script src="update-prompt.js" defer></script>\n', '', 1]],
  'zz8/contacts-screen.js': [['  // Update prompt: asked only on the settings screen, hidden on every other screen.\n  if (screen === "settings") window.MagicUpdate?.offer(); else window.MagicUpdate?.hide();\n', '', 1]],
  'zz8/contacts.js': [
    ['  startButton,\n  settingsScreen,\n} from', '  startButton,\n} from', 1],
    [`    const registration = navigator.serviceWorker.register("./sw.js");
    registration.catch(() => {
      // Registration can fail offline or when workers are blocked. The page still runs.
    });
    window.MagicUpdate?.init({ registrationPromise: registration, safe: () => !settingsScreen.hidden });`,
      `    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Registration can fail offline or when workers are blocked. The page still runs.
    });`, 1]],
  'zz10/sw.js': SW,
  'zz10/index.html': [[DEFER_TAG, '', 1]],
  'zz10/settings-panel.js': [[OFFER, '', 1], [HIDE, '', 1]],
  'zz10/camera.js': [
    ['  settings.hidden = true;\n  window.MagicUpdate?.hide();\n', '  settings.hidden = true;\n', 1],
    ['    settings.hidden = true;\n    window.MagicUpdate?.hide();\n', '    settings.hidden = true;\n', 1]],
  'zz10/app.js': [[`  const registration = navigator.serviceWorker.register("./sw.js");
  registration.catch(() => {});
  window.MagicUpdate?.init({ registrationPromise: registration, safe: () => !settings.hidden });`,
    '  navigator.serviceWorker.register("./sw.js").catch(() => {});', 1]],
};

export function stripUpdatePrompt(app, file, text) {
  const hooks = UPDATE_PROMPT_HOOKS[`${app}/${file}`];
  if (!hooks) return text;
  let out = text;
  for (const [from, to, count] of hooks) {
    const found = out.split(from).length - 1;
    if (found !== count) throw new Error(`update-prompt hook ${JSON.stringify(from.slice(0, 50))} found ${found}x in ${app}/${file}, expected ${count}x`);
    out = out.replaceAll(from, to);
  }
  if (/MagicUpdate|update-prompt/.test(out)) throw new Error(`unapproved update-prompt text left in ${app}/${file}`);
  return out;
}

// Files a personal app has that its pinned snapshot lacks until regeneration.
export const UPDATE_PROMPT_ONLY_FILE = 'update-prompt.js';
export const UPDATE_PROMPT_APPS = ['zz1', 'zz2', 'zz3', 'zz5', 'zz6', 'zz7', 'zz8', 'zz10', 'zz11'];
