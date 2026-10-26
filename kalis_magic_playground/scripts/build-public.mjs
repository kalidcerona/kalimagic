import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGACY_SHARED_WORKERS, TRUSTED_START_SESSION_KEY, legacyWorkerSpecByTarget } from './legacy-shared-contract.mjs';
import { legacyBridgeSource } from './legacy-sw-bridge.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

export const PUBLIC_FILES = [
  'about.html',
  'archive.css',
  'badges.js',
  'collapsible.js',
  'content.js',
  'editor.js',
  'favicon.svg',
  'index.html',
  'intro.html',
  'lesson.html',
  'lightbox.js',
  'mmbs.html',
  'modal.js',
  'nav.js',
  'pg-util.js',
  'invite-client.js',
  'playground.html',
  'mypage.html',
  'write.html',
  'post.html',
  'admin.html',
  'admin-community.html',
  'admin-session.js',
  'admin-app-model.js',
  'admin-apps.css',
  'reviews.html',
  'reveal.js',
  'robots.txt',
  'script.js',
  'sitemap.xml',
  'style.css',
  'track.js',
  'video.html',
  'works.html',
  'auth.js',
  'admin.js',
  'admin-tools.js',
  'mypage.js',
  'nickname-onboarding.js',
  'playground-api.js',
  'playground-list.js',
  'playground-compose.js',
  'playground-detail.js',
  'playground.js',
  'write.js',
  'post.js',
  'reviews-community.js',
];

export const PUBLIC_DIRS = [
  'assets',
  'imigi3',
  'planb',
  'planb-busking',
  'planb-november',
  'planb-sleeving',
  'tools',
  'zz1',
  'zz2',
  'zz3',
  'zz4',
  'zz5',
  'zz6',
  'zz7',
  'zz8',
  'zz10',
  'zz11',
  'zz12',
  'zz13',
  'zz14',
  'zz15',
  'TabataTimer',
  'KanameCue'
];

// Publish only the offline shell and worker for this personal app.
export const TABATA_FILES = ['data.js', 'install-ui.js', 'icon-maskable-192.png', 'icon-maskable-512.png', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'sw.js', 'brand-logo.png', 'icon.svg', 'icon-192.png', 'icon-512.png'];

// KANAME Cue web app: the same explicit-shell rule as TabataTimer.
export const KANAME_FILES = ['index.html', 'style.css', 'app.mjs', 'prefs.mjs', 'clock.mjs', 'ui.mjs', 'show.mjs', 'playback.mjs', 'settings.mjs', 'wake.mjs', 'engine.mjs', 'engine-model.mjs', 'engine-output.mjs', 'engine-timing.mjs', 'engine-keys.mjs', 'engine-cues.mjs', 'audio.mjs', 'store.mjs', 'install-ui.js', 'manifest.webmanifest', 'sw.js', 'brand-logo.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png'];

// URAMICHI web app (zz15): explicit shell, including the vendored QR decoder and its licence.
export const URAMICHI_FILES = ['index.html', 'style.css', 'app.mjs', 'dom.mjs', 'presets.mjs', 'detect.mjs', 'chrome.mjs', 'scan.mjs', 'camera.mjs', 'core.mjs', 'core-model.mjs', 'core-url.mjs', 'core-encode.mjs', 'core-scan.mjs', 'core-gate.mjs', 'core-card.mjs', 'core-resolve.mjs', 'core-logic.mjs', 'core-json.mjs', 'picker.mjs', 'install-ui.js', 'manifest.webmanifest', 'sw.js', 'brand-logo.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'vendor/jsQR.js', 'vendor/LICENSE-jsqr.txt'];

export const PRIVATE_PATTERNS = [
  /(?:^|\/)fullscreen\.js$/,
  /^MAGIC-PLAYGROUND-PRD\.md$/,
  /^MAGIC-PLAYGROUND-IMPLEMENTATION-PLAN\.md$/,
  /^COMMUNITY-MVP-DESIGN\.md$/,
  /^netlify\/functions\//,
  /^supabase\//,
  /^tests\//,
  /^distribution-snapshots\//,
  /^zz7\/app\.js$/,
  /^zz8\/app\.js$/,
  /^archive\//,
  /^docs\//,
  /^node_modules\//,
  /^\.env/,
  /^package-lock\.json$/,
  /(?:^|\/)[^/]*\.test\.mjs$/,
  /(?:^|\/)[^/]*\.test\.js$/
];

export const SHARED_UNLOCK_FILES = [
  'brand-logo.jpg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'icon.svg',
  'index.html',
  'style.css',
  'app.js',
  'session.js',
  'pin.js',
  'gestures.js',
  'images.js',
  'rewind.js',
  'settings.js',
  'install-prompt.js',
  'logic.js',
  'manifest.webmanifest',
  'sw.js',
  'time-machine.js',
  'performance-link.js'
];

export const NEW_APP_FILES = [
  'app.js',
  'brand-logo.jpg',
  'icon-192.png',
  'icon-512.png',
  'icon.svg',
  'index.html',
  'install-prompt.js',
  'logic.js',
  'manifest.webmanifest',
  'style.css',
  'sw.js'
];
// The choice app also ships its home screen artwork (manifest plus icons) and nothing else shares it.
export const CHOICE_HOME_FILES = [
  'home-manifest.js',
  'builtin-lists.js',
  'home-icons/a1.svg',
  'home-icons/a2.svg',
  'home-icons/a3.svg',
  'home-icons/a4.svg',
  'home-icons/a5.svg',
  'home-icons/a6.svg',
  'home-icons/a7.svg',
  'home-icons/a8.svg',
  'home-icons/a9.svg',
  'home-icons/b1.svg',
  'home-icons/b2.svg',
  'home-icons/b3.svg',
  'home-icons/b4.svg',
  'home-icons/b5.svg',
  'home-icons/b6.svg',
  'home-icons/b7.svg',
  'home-icons/b8.svg',
  'home-icons/b9.svg',
  'home-icons/f1.svg',
  'home-icons/f2.svg',
  'home-icons/f3.svg',
  'home-icons/f4.svg',
  'home-icons/f5.svg',
  'home-icons/f6.svg',
  'home-icons/f7.svg',
  'home-icons/own-aletheia.png',
  'home-icons/own-alter.png',
  'home-icons/own-asrai.png',
  'home-icons/own-memdeck.png',
  'home-icons/own-release.png',
  'home-icons/own-stopwatch.png',
  'home-icons/own-tobira.png',
  'home-icons/own-usotsuki.png',
  'home-icons/y1.svg',
  'home-icons/y10.svg',
  'home-icons/y11.svg',
  'home-icons/y2.svg',
  'home-icons/y3.svg',
  'home-icons/y4.svg',
  'home-icons/y5.svg',
  'home-icons/y7.svg',
  'home-icons/y9.svg',
  'home-icons/z1.svg',
  'home-icons/z10.svg',
  'home-icons/z11.svg',
  'home-icons/z12.svg',
  'home-icons/z13.svg',
  'home-icons/z14.svg',
  'home-icons/z2.svg',
  'home-icons/z4.svg',
  'home-icons/z5.svg',
  'home-icons/z6.svg',
  'home-icons/z8.svg',
  'home-icons/zb.svg',
  'home-icons/zg.svg'
];
// CHOICE style.css is split into feature pieces linked in this order after style.css.
export const CHOICE_STYLE_FILES = ['style-fake-home.css', 'style-guide-notes.css', 'style-settings.css'];
export const CHOICE_FILES = [...NEW_APP_FILES, ...CHOICE_STYLE_FILES, ...CHOICE_HOME_FILES];
// CHOICE app.js and logic.js load these feature modules (personal zz4 and the friend snapshot).
export const CHOICE_MODULE_FILES = [
  'module-start.js', 'gesture-guide.js', 'dom.js', 'editor.js', 'options.js', 'precheck.js', 'views.js',
  'wizard.js', 'extras.js', 'backup.js', 'user-icons.js', 'wallpaper.js', 'previews.js', 'input-guide.js',
  'performance.js', 'fake-home-surface.js', 'performance-start.js', 'performance-gestures.js',
  'artwork-warmup.js', 'views-home.js', 'wizard-view.js', 'detail-view.js',
  'fake-notes.js', 'wake-lock.js', 'controller.js', 'logic-core.js', 'logic-presets.js',
  'logic-performance.js', 'logic-extras.js', 'logic-storage.js', 'logic-fake-home.js', 'logic-notes.js',
  'logic-backup.js', 'logic-user-icons.js', 'logic-wizard.js'
];
export const CHOICE_DISTRIBUTION_FILES = [...CHOICE_FILES, ...CHOICE_MODULE_FILES, 'brand-logo.png', 'fullscreen.js', 'settings-ui.js', 'settings-ui.css'];

export function shouldCopyChoice(relativePath) {
  return relativePath === '' || relativePath === 'home-icons' || CHOICE_DISTRIBUTION_FILES.includes(relativePath.split(path.sep).join('/'));
}
// USOTSUKI style.css is split into feature pieces linked in this order after style.css.
export const USOTSUKI_STYLE_FILES = ['style-settings.css', 'style-holdem.css', 'style-recorder.css'];
export const USOTSUKI_FILES = NEW_APP_FILES.filter((file) => file !== 'app.js').concat(USOTSUKI_STYLE_FILES, 'first-run-guide.js', 'detector.js', 'detector-panel-grok.svg', 'holdem-assets/felt-grain.svg', 'holdem-assets/leather-grain.svg', 'holdem-assets/table-rail.svg', 'recorder-assets/recorder-shell-blank.webp', 'recorder-theme.js', 'recorder-engine.js', 'recorder-trace.js', 'recorder-a.html', 'recorder-d.html', 'controller.js', 'controller-state.js', 'controller-themes.js', 'controller-audio.js', 'controller-storage.js', 'controller-hold.js', 'controller-haptic.js', 'controller-screens.js', 'controller-attempts.js', 'controller-gestures.js', 'controller-display-theme.js', 'dom.js', 'storage.js', 'heartbeat.js', 'vibration.js', 'wake-lock.js', 'preferences.js', 'stage.js', 'bindings.js');
export const ASRAI_FILES = [
  'brand-logo.jpg', 'brand-logo.png', 'contacts.js', 'contacts-gestures.js',
  'contacts-list.js', 'contacts-screen.js', 'contacts-settings.js',
  'contacts-state.js', 'contacts-storage.js', 'icon-192.png',
  'icon-512.png', 'icon.svg', 'index.html', 'install-ui.js',
  'logic.js', 'logic-clicks.js', 'logic-library.js', 'logic-limits.js',
  'logic-search.js', 'logic-zones.js', 'manifest.webmanifest', 'style.css', 'sw.js'
];
export const ALTER_FILES = [
  'app.js', 'appearance.js', 'brand-logo.jpg', 'brand-logo.png', 'calibration.js', 'camera-geometry.js', 'camera-stream.js', 'icon-192.png',
  'icon-512.png', 'index.html', 'install-ui.js', 'logic.js',
  'manifest.webmanifest', 'performance.js', 'style.css', 'sw.js', 'vision.js',
  'vision-detect.js', 'vision-geometry.js', 'vision-grip.js', 'vision-homography.js', 'vision-paper.js',
  'vision-quad.js', 'vision-sampling.js',
  'dom.js', 'state.js', 'status.js', 'wake-lock.js', 'settings-store.js', 'card-view.js', 'overlay.js',
  'tracking-reset.js', 'settings-panel.js', 'frame.js', 'camera.js'
];
// TYCHE spinner style.css is split into feature pieces linked in this order after style.css.
export const SPINNER_STYLE_FILES = ['style-casino.css', 'style-hybrid.css'];
export const SPINNER_FILES = [
  'hybrid-assets/arrow.svg',
  'hybrid-assets/wheel-emerald.svg',
  'hybrid-assets/wheel-burgundy.svg',
  'casino-assets/felt-emerald.svg',
  'casino-assets/felt-burgundy.svg',
  'casino-assets/wheel-emerald.svg',
  'casino-assets/wheel-burgundy.svg',
  'casino-assets/arrow.svg',
  'casino-assets/wood-grain.svg',
  'casino-assets/field-marks.svg',
  'casino-salon.jpg',
  'app.js', 'icon-192.png', 'icon-512.png', 'index.html',
  'logic.js', 'manifest.webmanifest', 'style.css', ...SPINNER_STYLE_FILES, 'sw.js'
];
export const MEMDECK_FILES = [
  'first-run-guide.js',
  'index.html', 'style.css', 'app.mjs', 'core.mjs', 'data.mjs', 'mnemonic.mjs',
  'brand-logo.png', 'manifest.webmanifest', 'sw.js', 'icon.svg', 'icon-192.png', 'icon-512.png'
];
// KAIROS (pimax) style.css is split into feature pieces linked in this order after style.css.
export const PIMAX_STYLE_FILES = ['style-practice.css', 'style-quiz-shapes.css', 'style-checker-install.css'];
export const PIMAX_FILES = ["index.html", "app.mjs", "state.mjs", "session.mjs", "practice.mjs", "glyphs.mjs", "learn.mjs", "settings.mjs", "install.mjs", "events.mjs", "core.mjs", "core-stack.mjs", "core-windows.mjs", "core-grading.mjs", "core-explain.mjs", "core-questions.mjs", "core-storage.mjs", "core-stats.mjs", "style.css", ...PIMAX_STYLE_FILES, "sw.js", "brand-logo.png", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

export function shouldCopyPimax(relativePath) {
  return relativePath === '' || PIMAX_FILES.includes(relativePath);
}

export const QR_FILES = [
  'first-run-guide.js',
  'index.html', 'style.css', 'app.mjs', 'core.mjs', 'manifest.webmanifest', 'sw.js', 'brand-logo.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'vendor/qrcodegen.js', 'vendor/jsQR.js',
  'vendor/LICENSE-nayuki.txt', 'vendor/LICENSE-jsqr.txt'
];
export const ALETHEIA_COURT_FILES = ['S-J', 'S-Q', 'S-K', 'D-J', 'D-Q', 'D-K',
  'C-J', 'C-Q', 'C-K', 'H-J', 'H-Q', 'H-K']
  .map((code) => `court-cards/${code}.webp`);

// TOBIRA style.css is split into feature pieces linked in this order after style.css.
export const TOBIRA_STYLE_FILES = ['style-stage.css', 'style-overlays.css'];
// ALETHEIA style.css is split into feature pieces linked in this order after style.css.
export const ALETHEIA_STYLE_FILES = ['style-cells.css', 'style-forms.css', 'style-guide.css'];
export const SETTINGS_UI_FILES = ['settings-ui.js', 'settings-ui.css'];

export const MIRROR_PAIRS = [
  ...SETTINGS_UI_FILES.map((file) => [`../../magic-stopwatch-uni/${file}`, `zz1/${file}`]),
  ...SETTINGS_UI_FILES.map((file) => [`../../magic-unlock/${file}`, `zz2/${file}`]),
  ...SETTINGS_UI_FILES.map((file) => [`../../magic-calculator-v2/${file}`, `zz3/${file}`]),
  ...SETTINGS_UI_FILES.map((file) => [`../../magic-choice/${file}`, `zz4/${file}`]),
  ...SETTINGS_UI_FILES.map((file) => [`../../magic-aletheia/${file}`, `zz5/${file}`]),
  ...SETTINGS_UI_FILES.map((file) => [`../../magic-tobira/${file}`, `zz6/${file}`]),
  ...SETTINGS_UI_FILES.map((file) => [`../../magic-usotsuki/${file}`, `zz7/${file}`]),
  ...SETTINGS_UI_FILES.map((file) => [`../../magic-asrai/${file}`, `zz8/${file}`]),
  ...SETTINGS_UI_FILES.map((file) => [`../../magic-alter/${file}`, `zz10/${file}`]),
  ...SETTINGS_UI_FILES.map((file) => [`../../magic-spinner/${file}`, `zz11/${file}`]),
  // The localhost-only preview hook module of each personal app (friend builds drop it).
  ['../../magic-stopwatch-uni/local-preview.js', 'zz1/local-preview.js'],
  ['../../magic-choice/local-preview.js', 'zz4/local-preview.js'],
  ['../../magic-aletheia/local-preview.js', 'zz5/local-preview.js'],
  ['../../magic-tobira/local-preview.js', 'zz6/local-preview.js'],
  ['../../magic-usotsuki/local-preview.js', 'zz7/local-preview.js'],
  ['../../magic-asrai/local-preview.js', 'zz8/local-preview.js'],
  ['../../magic-alter/local-preview.js', 'zz10/local-preview.js'],
  ['../../magic-spinner/local-preview.js', 'zz11/local-preview.js'],
  ['../../magic-memdeck/local-preview.mjs', 'zz12/local-preview.mjs'],
  ['../../magic-qr/local-preview.mjs', 'zz13/local-preview.mjs'],
  ['../../magic-calculator-v2/index.html', 'zz3/index.html'],
  ['../../magic-calculator-v2/sw.js', 'zz3/sw.js'],
  ['../../magic-calculator-v2/performance-link.js', 'zz3/performance-link.js'],
  ['../../magic-calculator-v2/style.css', 'zz3/style.css'],
  ['../../magic-calculator-v2/settings-swipe.js', 'zz3/settings-swipe.js'],
  ['../../magic-calculator-v2/selftest.js', 'zz3/selftest.js'],
  ['../../magic-calculator-v2/cards.js', 'zz3/cards.js'],
  ['../../magic-calculator-v2/decimal.js', 'zz3/decimal.js'],
  ['../../magic-calculator-v2/expression.js', 'zz3/expression.js'],
  ['../../magic-calculator-v2/tricks.js', 'zz3/tricks.js'],
  ['../../magic-calculator-v2/ui-helpers.js', 'zz3/ui-helpers.js'],
  ['../../magic-calculator-v2/settings-tutorial.js', 'zz3/settings-tutorial.js'],
  ['../../magic-calculator-v2/app.js', 'zz3/app.js'],
  ['../../magic-calculator-v2/wake-lock.js', 'zz3/wake-lock.js'],
  ['../../magic-calculator-v2/boot.js', 'zz3/boot.js'],
  ['../../magic-calculator-v2/install-nudge.css', 'zz3/install-nudge.css'],
  ['../../magic-calculator-v2/install-nudge.js', 'zz3/install-nudge.js'],
  ['../../magic-calculator-v2/icon-192.png', 'zz3/icon-192.png'],
  ['../../magic-calculator-v2/icon-512.png', 'zz3/icon-512.png'],
  ['../../magic-calculator-v2/icon.svg', 'zz3/icon.svg'],
  ['../../magic-calculator-v2/manifest.webmanifest', 'zz3/manifest.webmanifest'],
  ['../../magic-calculator-v2/brand-logo.jpg', 'zz3/brand-logo.jpg'],
  ['../../magic-stopwatch-uni/index.html', 'zz1/index.html'],
  ['../../magic-stopwatch-uni/sw.js', 'zz1/sw.js'],
  ['../../magic-stopwatch-uni/logic.js', 'zz1/logic.js'],
  ['../../magic-stopwatch-uni/style.css', 'zz1/style.css'],
  ['../../magic-stopwatch-uni/app.js', 'zz1/app.js'],
  ['../../magic-stopwatch-uni/settings-swipe.js', 'zz1/settings-swipe.js'],
  ['../../magic-stopwatch-uni/selftest.js', 'zz1/selftest.js'],
  ['../../magic-stopwatch-uni/settings-tutorial.js', 'zz1/settings-tutorial.js'],
  ['../../magic-stopwatch-uni/wake-lock.js', 'zz1/wake-lock.js'],
  ['../../magic-stopwatch-uni/install-nudge.js', 'zz1/install-nudge.js'],
  ['../../magic-stopwatch-uni/sw-register.js', 'zz1/sw-register.js'],
  ['../../magic-stopwatch-uni/brand-logo.jpg', 'zz1/brand-logo.jpg'],
  ['../../magic-stopwatch-uni/icon-192.png', 'zz1/icon-192.png'],
  ['../../magic-stopwatch-uni/icon-512.png', 'zz1/icon-512.png'],
  ['../../magic-stopwatch-uni/icon.svg', 'zz1/icon.svg'],
  ['../../magic-stopwatch-uni/manifest.webmanifest', 'zz1/manifest.webmanifest'],
  ...SHARED_UNLOCK_FILES.map((file) => [`../../magic-unlock/${file}`, `zz2/${file}`]),
  ...CHOICE_FILES.map((file) => [`../../magic-choice/${file}`, `zz4/${file}`]),
  ['../../magic-choice/module-start.js', 'zz4/module-start.js'],
  ['../../magic-choice/gesture-guide.js', 'zz4/gesture-guide.js'],
  ['../../magic-choice/dom.js', 'zz4/dom.js'],
  ['../../magic-choice/editor.js', 'zz4/editor.js'],
  ['../../magic-choice/options.js', 'zz4/options.js'],
  ['../../magic-choice/precheck.js', 'zz4/precheck.js'],
  ['../../magic-choice/views.js', 'zz4/views.js'],
  ['../../magic-choice/wizard.js', 'zz4/wizard.js'],
  ['../../magic-choice/extras.js', 'zz4/extras.js'],
  ['../../magic-choice/backup.js', 'zz4/backup.js'],
  ['../../magic-choice/user-icons.js', 'zz4/user-icons.js'],
  ['../../magic-choice/wallpaper.js', 'zz4/wallpaper.js'],
  ['../../magic-choice/previews.js', 'zz4/previews.js'],
  ['../../magic-choice/input-guide.js', 'zz4/input-guide.js'],
  ['../../magic-choice/performance.js', 'zz4/performance.js'],
  ['../../magic-choice/fake-home-surface.js', 'zz4/fake-home-surface.js'],
  ['../../magic-choice/performance-start.js', 'zz4/performance-start.js'],
  ['../../magic-choice/performance-gestures.js', 'zz4/performance-gestures.js'],
  ['../../magic-choice/artwork-warmup.js', 'zz4/artwork-warmup.js'],
  ['../../magic-choice/views-home.js', 'zz4/views-home.js'],
  ['../../magic-choice/wizard-view.js', 'zz4/wizard-view.js'],
  ['../../magic-choice/detail-view.js', 'zz4/detail-view.js'],
  ['../../magic-choice/fake-notes.js', 'zz4/fake-notes.js'],
  ['../../magic-choice/wake-lock.js', 'zz4/wake-lock.js'],
  ['../../magic-choice/controller.js', 'zz4/controller.js'],
  ['../../magic-choice/logic-core.js', 'zz4/logic-core.js'],
  ['../../magic-choice/logic-presets.js', 'zz4/logic-presets.js'],
  ['../../magic-choice/logic-performance.js', 'zz4/logic-performance.js'],
  ['../../magic-choice/logic-extras.js', 'zz4/logic-extras.js'],
  ['../../magic-choice/logic-storage.js', 'zz4/logic-storage.js'],
  ['../../magic-choice/logic-fake-home.js', 'zz4/logic-fake-home.js'],
  ['../../magic-choice/logic-notes.js', 'zz4/logic-notes.js'],
  ['../../magic-choice/logic-backup.js', 'zz4/logic-backup.js'],
  ['../../magic-choice/logic-user-icons.js', 'zz4/logic-user-icons.js'],
  ['../../magic-choice/logic-wizard.js', 'zz4/logic-wizard.js'],
  ...NEW_APP_FILES.map((file) => [`../../magic-aletheia/${file}`, `zz5/${file}`]),
  ...ALETHEIA_STYLE_FILES.map((file) => [`../../magic-aletheia/${file}`, `zz5/${file}`]),
  ['../../magic-aletheia/deck-loader.js', 'zz5/deck-loader.js'],
  ['../../magic-aletheia/controller.js', 'zz5/controller.js'],
  ['../../magic-aletheia/controller-state.js', 'zz5/controller-state.js'],
  ['../../magic-aletheia/storage-commit.js', 'zz5/storage-commit.js'],
  ['../../magic-aletheia/preset-form.js', 'zz5/preset-form.js'],
  ['../../magic-aletheia/stored-recovery.js', 'zz5/stored-recovery.js'],
  ['../../magic-aletheia/performance-run.js', 'zz5/performance-run.js'],
  ['../../magic-aletheia/custom-slot-save.js', 'zz5/custom-slot-save.js'],
  ['../../magic-aletheia/logic-limits.js', 'zz5/logic-limits.js'],
  ['../../magic-aletheia/logic-photo-sets.js', 'zz5/logic-photo-sets.js'],
  ['../../magic-aletheia/logic-presets.js', 'zz5/logic-presets.js'],
  ['../../magic-aletheia/logic-geometry.js', 'zz5/logic-geometry.js'],
  ['../../magic-aletheia/logic-gestures.js', 'zz5/logic-gestures.js'],
  ['../../magic-aletheia/logic-cells.js', 'zz5/logic-cells.js'],
  ['../../magic-aletheia/gesture-guide.js', 'zz5/gesture-guide.js'],
  ['../../magic-aletheia/dom.js', 'zz5/dom.js'],
  ['../../magic-aletheia/status.js', 'zz5/status.js'],
  ['../../magic-aletheia/images.js', 'zz5/images.js'],
  ['../../magic-aletheia/image-db.js', 'zz5/image-db.js'],
  ['../../magic-aletheia/presets.js', 'zz5/presets.js'],
  ['../../magic-aletheia/photo-sets.js', 'zz5/photo-sets.js'],
  ['../../magic-aletheia/court-cards.js', 'zz5/court-cards.js'],
  ['../../magic-aletheia/card-select.js', 'zz5/card-select.js'],
  ['../../magic-aletheia/preferences.js', 'zz5/preferences.js'],
  ['../../magic-aletheia/cell-guide.js', 'zz5/cell-guide.js'],
  ['../../magic-aletheia/veil.js', 'zz5/veil.js'],
  ['../../magic-aletheia/pointer.js', 'zz5/pointer.js'],
  ['../../magic-aletheia/wake-lock.js', 'zz5/wake-lock.js'],
  ...ALETHEIA_COURT_FILES.map((file) => [`../../magic-aletheia/${file}`, `zz5/${file}`]),
  ...NEW_APP_FILES.map((file) => [`../../magic-tobira/${file}`, `zz6/${file}`]),
  ...TOBIRA_STYLE_FILES.map((file) => [`../../magic-tobira/${file}`, `zz6/${file}`]),
  ['../../magic-tobira/dom.js', 'zz6/dom.js'],
  ['../../magic-tobira/gesture-guide.js', 'zz6/gesture-guide.js'],
  ['../../magic-tobira/audio.js', 'zz6/audio.js'],
  ['../../magic-tobira/state-store.js', 'zz6/state-store.js'],
  ['../../magic-tobira/images.js', 'zz6/images.js'],
  ['../../magic-tobira/presets.js', 'zz6/presets.js'],
  ['../../magic-tobira/coin-paint.js', 'zz6/coin-paint.js'],
  ['../../magic-tobira/performance.js', 'zz6/performance.js'],
  ['../../magic-tobira/perf-state.js', 'zz6/perf-state.js'],
  ['../../magic-tobira/motion-prefs.js', 'zz6/motion-prefs.js'],
  ['../../magic-tobira/crack-session.js', 'zz6/crack-session.js'],
  ['../../magic-tobira/sensor-effects.js', 'zz6/sensor-effects.js'],
  ['../../magic-tobira/pointer-gestures.js', 'zz6/pointer-gestures.js'],
  ['../../magic-tobira/mode-switch.js', 'zz6/mode-switch.js'],
  ['../../magic-tobira/wake-lock.js', 'zz6/wake-lock.js'],
  ['../../magic-tobira/sensor-motion.js', 'zz6/sensor-motion.js'],
  ['../../magic-tobira/COIN_CREDITS.md', 'zz6/COIN_CREDITS.md'],
  ['../../magic-tobira/CARD_CREDITS.md', 'zz6/CARD_CREDITS.md'],
  ['../../magic-tobira/card-rider-red.jpg', 'zz6/card-rider-red.jpg'],
  ['../../magic-tobira/card-rider-blue.jpg', 'zz6/card-rider-blue.jpg'],
  ['../../magic-tobira/coin-kennedy.webp', 'zz6/coin-kennedy.webp'],
  ['../../magic-tobira/coin-500won.webp', 'zz6/coin-500won.webp'],
  ['../../magic-tobira/coin-kennedy.svg', 'zz6/coin-kennedy.svg'],
  ['../../magic-tobira/coin-500won.svg', 'zz6/coin-500won.svg'],
  ...USOTSUKI_FILES.map((file) => [`../../magic-usotsuki/${file}`, `zz7/${file}`]),
  ['../../magic-usotsuki/detector-panel.jpg', 'zz7/detector-panel.jpg'],
  ...ASRAI_FILES.map((file) => [`../../magic-asrai/${file}`, `zz8/${file}`]),
  ...ALTER_FILES.map((file) => [`../../magic-alter/${file}`, `zz10/${file}`]),
  ...SPINNER_FILES.map((file) => [`../../magic-spinner/${file}`, `zz11/${file}`]),
  ...MEMDECK_FILES.map((file) => [`../../magic-memdeck/${file}`, `zz12/${file}`]),
  ...QR_FILES.map((file) => [`../../magic-qr/${file}`, `zz13/${file}`]),
  ...PIMAX_FILES.map((file) => [`../../magic-pimax/${file}`, `zz14/${file}`]),
  ...[
    ['magic-stopwatch-uni', 'zz1'],
    ['magic-unlock', 'zz2'],
    ['magic-calculator-v2', 'zz3'],
    ['magic-choice', 'zz4'],
    ['magic-aletheia', 'zz5'],
    ['magic-tobira', 'zz6'],
    ['magic-usotsuki', 'zz7']
  ].map(([source, route]) => [`../../${source}/brand-logo.png`, `${route}/brand-logo.png`])
];

// Shared HITSUZEN and AROSAEGIDA copy pinned snapshots. tools/calc stays a legacy redirect, not a published tree.
const LEGACY_MIGRATION_TARGETS = new Set(['kairos', 'kairos-classic', 'hitsuzen']);
const INIT_APP_HOOK = 'else initApp();';

export function isolateKairosStorageKeys(source, target) {
  return source
    .replaceAll('stopwatch_', `friend-${target}_`)
    .replaceAll('stopwatch2_', `friend-${target}-legacy_`)
    .replaceAll('stopwatch-settings-entry-tutorial-', `friend-${target}-settings-entry-tutorial-`);
}

export function isExcludedLegacyTree(publicPath) {
  return ['tools/stopwatch', 'tools/stopwatch-uni', 'tools/calc'].some((route) =>
    publicPath === route || publicPath.startsWith(`${route}/`));
}

function migrationStartup(target) {
  const spec = legacyWorkerSpecByTarget(target);
  // A late import must never mutate preferences after the fallback app starts.
  return `else {
    let trustedLegacyStart = false;
    try { trustedLegacyStart = sessionStorage.getItem(${JSON.stringify(TRUSTED_START_SESSION_KEY)}) === ${JSON.stringify(spec.tool)}; } catch (error) {}
    if (trustedLegacyStart) {
      let migrationActive = true;
      let migrationTimer;
      try {
        await Promise.race([
          import("./legacy-storage-migration.mjs").then((mod) => {
            if (migrationActive) mod.migrateTrustedLegacyStorage({ target: ${JSON.stringify(target)}, storage: localStorage, session: sessionStorage, pathname: location.pathname, search: location.search });
          }),
          new Promise((resolve) => { migrationTimer = setTimeout(() => { migrationActive = false; resolve(); }, 1500); })
        ]);
      } catch (error) {}
      finally { migrationActive = false; clearTimeout(migrationTimer); }
    }
    initApp();
  }`;
}

export function injectLegacyMigration(html, target) {
  if (!LEGACY_MIGRATION_TARGETS.has(target)) return html;
  if (target === 'hitsuzen') {
    const tag = `<script type="module">import { migrateTrustedLegacyStorage } from "./legacy-storage-migration.mjs"; try { migrateTrustedLegacyStorage({ target: "hitsuzen", storage: localStorage, session: sessionStorage, pathname: location.pathname, search: location.search }); } catch (error) {}</script>`;
    if (!html.includes('<head>')) throw new Error('missing head for HITSUZEN legacy migration');
    return html.replace('<head>', `<head>\n${tag}`);
  }
  if (html.split(INIT_APP_HOOK).length !== 2) throw new Error(`missing legacy migration hook for ${target}`);
  return html.replace(INIT_APP_HOOK, migrationStartup(target));
}

export function transformDistributionDocument(html, app) {
  // Magicshow is a public beta; the sync script owns its document additions.
  if (app.target === 'magicshow') return html;
  const isolate = app.target === 'kairos' || app.target === 'kairos-classic';
  let next = isolate ? isolateKairosStorageKeys(html, app.target) : html;
  // RELEASE friends get the same editor as the personal build. Other friend apps stay fixed.
  if (app.target !== 'release') next = next.replace(/<body\b/, '<body data-magic-customize="off"');
  next = next.replace('<head>', `<head>\n${accessGuard(app.tool, app.target)}`);
  // KAIROS keeps its startup hook in app.js once the inline script is split out; transformKairosScript injects it there.
  if (isolate && !next.includes(INIT_APP_HOOK)) return next;
  return injectLegacyMigration(next, app.target);
}

// Files that used to be inline in the KAIROS snapshot index.html. They get the same per-target key isolation.
export const KAIROS_SPLIT_FILES = ['app.js', 'settings-swipe.js', 'selftest.js', 'settings-tutorial.js', 'wake-lock.js', 'install-nudge.js', 'sw-register.js', 'style.css'];

export function transformKairosScript(source, target, file) {
  const isolated = isolateKairosStorageKeys(source, target);
  return file === 'app.js' ? injectLegacyMigration(isolated, target) : isolated;
}

export async function publishLegacyBridgeFiles(distRoot) {
  for (const spec of LEGACY_SHARED_WORKERS) {
    const destination = path.join(distRoot, spec.bridgeFile);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, legacyBridgeSource(spec));
  }
}

export async function publishLegacyMigrationModules(appDirectory) {
  await mkdir(appDirectory, { recursive: true });
  const directory = path.dirname(fileURLToPath(import.meta.url));
  await cp(path.join(directory, 'legacy-shared-contract.mjs'), path.join(appDirectory, 'legacy-shared-contract.mjs'));
  await cp(path.join(directory, 'legacy-storage-migration.mjs'), path.join(appDirectory, 'legacy-storage-migration.mjs'));
}

// Dist copies only. Snapshot source workers stay unchanged; the published worker precaches the injected modules.
const LEGACY_SHELL_MODULES = ['./legacy-shared-contract.mjs', './legacy-storage-migration.mjs'];

// A changed precache must install into a new cache. Keep -distribution last so family filters still match.
function withLegacyCacheSuffix(source) {
  const patterns = [
    /const CACHE_NAME = CACHE_PREFIX \+ '([^']*)'/,
    /CACHE=PREFIX\+'([^']*)'/
  ];
  let found = null;
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (match && (!found || match.index < found.index)) found = match;
  }
  if (!found) throw new Error('distribution worker is missing a cache name');
  const literal = found[1];
  const distribution = '-distribution';
  const marker = '-legacy-1';
  const hasDistribution = literal.endsWith(distribution);
  const stem = hasDistribution ? literal.slice(0, -distribution.length) : literal;
  if (stem.endsWith(marker)) return source;
  const nextLiteral = `${stem}${marker}${hasDistribution ? distribution : ''}`;
  const nextAssignment = found[0].replace(literal, nextLiteral);
  return source.replace(found[0], nextAssignment);
}

export function injectLegacyShellModules(source) {
  const match = source.match(/const SHELL = \[([\s\S]*?)\];/);
  if (!match) throw new Error('distribution worker is missing a SHELL array');
  let body = match[1];
  let shellChanged = false;
  for (const file of LEGACY_SHELL_MODULES) {
    const literal = JSON.stringify(file);
    if (body.includes(literal)) continue;
    shellChanged = true;
    body = body.replace(/\s*$/, '');
    if (!body.endsWith(',')) body += ',';
    body += `\n  ${literal}`;
  }
  const withShell = shellChanged ? source.replace(match[0], `const SHELL = [${body}\n];`) : source;
  return withLegacyCacheSuffix(withShell);
}
export function shouldCopyMagicshow(relativePath) {
  const file = relativePath.split(path.sep).join('/');
  return file === '' || file === 'assets' || file === 'assets/ui' || file === 'assets/kit' || file === 'fonts' || file === 'fonts/OFL.md' ||
    ['install-prompt.js', 'install-prompt.css', 'index.html', 'style.css', 'portrait.css', 'data.js', 'core.js', 'audio.js', 'ui.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png', 'og-image.png', 'sw.js', 'update.html'].includes(file) ||
    /^assets\/(?:(?:ui|kit)\/)?[A-Za-z0-9_-]+\.(?:png|webp)$/.test(file) || /^fonts\/[A-Za-z0-9_-]+\.woff2$/.test(file);
}

export const DISTRIBUTION_APPS = [
  { source: 'distribution-snapshots/gwayubulgeup', target: 'gwayubulgeup', tool: 'gwayubulgeup' },
  { source: 'distribution-snapshots/magicshow', target: 'magicshow', tool: 'magicshow' },
  { source: 'distribution-snapshots/choice', target: 'choice', tool: 'choice' },
  { source: 'distribution-snapshots/pimax', target: 'pimax', tool: 'pimax' },
  { source: 'distribution-snapshots/calculator', target: 'hitsuzen', tool: 'calc' },
  { source: 'distribution-snapshots/unlock', target: 'release', tool: 'unlock' },
  { source: 'distribution-snapshots/aletheia', target: 'aletheia', tool: 'aletheia' },
  { source: 'distribution-snapshots/usotsuki', target: 'usotsuki', tool: 'usotsuki' },
  { source: 'distribution-snapshots/tobira', target: 'tobira', tool: 'tobira' },
  { source: 'distribution-snapshots/spinner', target: 'tyche', tool: 'spinner' },
  { source: 'distribution-snapshots/kairos', target: 'kairos', tool: 'stopwatch-uni' },
  { source: 'distribution-snapshots/kairos', target: 'kairos-classic', tool: 'stopwatch' },
  { source: 'distribution-snapshots/qr', target: 'arosaegida', tool: 'arosaegida' }
];

export function accessGuard(tool, target) {
  // target is not part of the storage key. The open pathname keeps kairos and kairos-classic apart.
  return `  <script id="friend-apps-check">
    if (location.protocol === 'https:' && location.pathname.startsWith('/tools/')) {
      const loginUrl = '/tools/login/?to=' + encodeURIComponent(location.pathname + location.search);
      const segments = location.pathname.split('/');
      const scope = '/tools/' + segments[2] + '/';
      const storageKey = 'friend-apps-ok:${tool}:' + scope;
      const dayMs = 24 * 60 * 60 * 1000;
      const graceMs = 90 * dayMs;
      const reveal = () => { document.documentElement.style.visibility = ''; };
      const redirect = () => { location.replace(loginUrl); };
      const freshStamp = (raw) => {
        if (raw == null || raw === '') return false;
        const stamp = Number(raw);
        if (!Number.isFinite(stamp)) return false;
        const now = Date.now();
        return (now - stamp) <= graceMs && (stamp - now) <= dayMs;
      };
      // A recently verified phone opens at once and the check runs in the background.
      // A failed read counts as no stamp: stay hidden and let the check decide.
      let launchStamp = null;
      try { launchStamp = localStorage.getItem(storageKey); }
      catch (error) {}
      const verified = freshStamp(launchStamp);
      if (verified) reveal();
      else document.documentElement.style.visibility = 'hidden';
      const allowOffline = () => {
        if (verified) return;
        let raw;
        try { raw = localStorage.getItem(storageKey); }
        catch (error) { redirect(); return; }
        if (freshStamp(raw)) reveal();
        else redirect();
      };
      const revoke = () => {
        try { localStorage.removeItem(storageKey); }
        catch (error) {}
        // Revocation is rare and deliberate. Never bounce a running show to login:
        // with a fresh stamp the key is dropped now and the next launch goes to login.
        if (!verified) redirect();
      };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      fetch('/tools/_check?tool=${tool}', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        .then((response) => {
          if (response.type === 'opaque' || response.status === 0 || response.status >= 500) { clearTimeout(timeoutId); allowOffline(); return; }
          if (response.status === 401 || response.status === 403) { clearTimeout(timeoutId); revoke(); return; }
          return response.json().then((result) => {
            clearTimeout(timeoutId);
            if (response.ok && result && result.ok === true) {
              try { localStorage.setItem(storageKey, String(Date.now())); }
              catch (error) {}
              reveal();
              return;
            }
            if (result && result.ok === false && response.status >= 200 && response.status < 500) { revoke(); return; }
            allowOffline();
          }, () => { clearTimeout(timeoutId); allowOffline(); });
        })
        .catch(() => { clearTimeout(timeoutId); allowOffline(); });
    }
  </script>`;
}

async function buildDistributionApps() {
  for (const app of DISTRIBUTION_APPS) {
    const source = path.join(ROOT, app.source);
    const target = path.join(DIST, 'tools', app.target);
    await cp(source, target, {
      recursive: true,
      filter: (entry) => app.target === 'magicshow'
        ? shouldCopyMagicshow(path.relative(source, entry))
        : app.target === 'pimax'
        ? shouldCopyPimax(path.relative(source, entry))
        : app.target === 'choice'
          ? shouldCopyChoice(path.relative(source, entry))
          : shouldCopy(path.relative(source, entry))
    });
    const indexPath = path.join(target, 'index.html');
    const html = await readFile(indexPath, 'utf8');
    // Key isolation follows the shared route, not the zz1 personal tree.
    // Raw stopwatch_ values are copied later by the injected migration module.
    await writeFile(indexPath, transformDistributionDocument(html, app));
    if (app.target === 'kairos' || app.target === 'kairos-classic') {
      const logicPath = path.join(target, 'logic.js');
      const logic = await readFile(logicPath, 'utf8');
      await writeFile(logicPath, isolateKairosStorageKeys(logic, app.target));
      for (const file of KAIROS_SPLIT_FILES) {
        const splitPath = path.join(target, file);
        await writeFile(splitPath, transformKairosScript(await readFile(splitPath, 'utf8'), app.target, file));
      }
    }
    if (LEGACY_MIGRATION_TARGETS.has(app.target)) {
      await publishLegacyMigrationModules(target);
      const swPath = path.join(target, 'sw.js');
      await writeFile(swPath, injectLegacyShellModules(await readFile(swPath, 'utf8')));
    }
    const manifestPath = path.join(target, 'manifest.webmanifest');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (app.target !== 'magicshow') Object.assign(manifest, { id: `/tools/${app.target}/`, start_url: './', scope: './' });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
}

// Run explicitly after the personal version is approved for shared distribution.
// RELEASE is one of the friend builds: the sibling checkout (the zz2 byte mirror) minus owner-only parts plus its friend config.
// It ships SHARED_UNLOCK_FILES plus settings-ui.js/.css: 23 files, where the old command copied only the 21 listed ones and dropped the
// two settings-ui files that index.html references.
// See scripts/friend-builds.mjs for the other apps ("node scripts/friend-builds.mjs generate all --write").
export async function promoteSharedUnlock({ source = path.resolve(ROOT, '../../magic-unlock'), snapshot = path.join(ROOT, 'distribution-snapshots', 'unlock') } = {}) {
  for (const file of SHARED_UNLOCK_FILES) {
    if (!(await exists(path.relative(ROOT, path.join(source, file))))) {
      throw new Error(`Cannot promote missing unlock file: ${file}`);
    }
  }
  const { writeFriendBuild } = await import('./friend-builds.mjs');
  await writeFriendBuild('release', { sourceDir: source, targetDir: snapshot });
}

async function exists(relativePath) {
  try {
    await stat(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(relativePath) {
  if (!(await exists(relativePath))) {
    console.warn(`Skipping missing public item: ${relativePath}`);
    return;
  }
  await cp(path.join(ROOT, relativePath), path.join(DIST, relativePath), {
    recursive: true,
    filter: (source) => {
      const publicPath = path.relative(ROOT, source).split(path.sep).join('/');
      if (relativePath === 'TabataTimer') {
        const file = path.relative(path.join(ROOT, 'TabataTimer'), source);
        return file === '' || TABATA_FILES.includes(file);
      }
      if (relativePath === 'KanameCue') {
        const file = path.relative(path.join(ROOT, 'KanameCue'), source);
        return file === '' || KANAME_FILES.includes(file);
      }
      if (relativePath === 'zz15') {
        const file = path.relative(path.join(ROOT, 'zz15'), source).split(path.sep).join('/');
        return file === '' || URAMICHI_FILES.includes(file) || URAMICHI_FILES.some((entry) => entry.startsWith(file + '/'));
      }
      if (relativePath === 'zz14') return shouldCopyPimax(path.relative(path.join(ROOT, 'zz14'), source));
      return shouldCopy(path.relative(ROOT, source)) && !isExcludedLegacyTree(publicPath);
    }
  });
  if (relativePath === 'zz14') {
    const appPath = path.join(DIST, 'zz14', 'app.mjs');
    await writeFile(appPath, preparePimaxRuntime(await readFile(appPath, 'utf8')));
  }
}

// Pi Max production ends at boot; trailing development controls stay in the source mirror.
export function preparePimaxRuntime(source) {
  const end = 'if (typeof document !== "undefined") boot();\n';
  const offset = source.indexOf(end);
  if (offset < 0 || source.indexOf(end, offset + end.length) !== -1) {
    throw new Error('Pi Max runtime must have exactly one boot boundary');
  }
  return source.slice(0, offset + end.length);
}

function shouldCopy(relativePath) {
  if (!relativePath) return true;
  if (relativePath.split(path.sep).some((part) => part.startsWith('.'))) return false;
  const normalized = relativePath.split(path.sep).join('/');
  return !PRIVATE_PATTERNS.some((pattern) => pattern.test(normalized));
}

// Sibling checkouts exist locally and are absent on Netlify. Skip only when every one is missing on CI.
export async function verifyMirrors({ root = ROOT, pairs = MIRROR_PAIRS, env = process.env, warn = console.warn } = {}) {
  const missing = [];
  for (const [source] of pairs) {
    try {
      await stat(path.join(root, source));
    } catch {
      missing.push(source);
    }
  }
  const onCi = env.NETLIFY === 'true' || Boolean(env.CI);
  if (missing.length === pairs.length && pairs.length > 0 && onCi) {
    warn(`WARNING: mirror check skipped on CI: ${missing.length} sibling sources absent`);
    return;
  }
  if (missing.length) throw new Error(`mirror sources missing: ${missing.join(', ')}`);
  for (const [source, mirror] of pairs) {
    const [sourceContents, mirrorContents] = await Promise.all([
      readFile(path.join(root, source)),
      readFile(path.join(root, mirror))
    ]);
    // A clean Pi Max commit may coexist with the source's appended development controls.
    const matches = mirror === 'zz14/app.mjs'
      ? preparePimaxRuntime(sourceContents.toString()) === preparePimaxRuntime(mirrorContents.toString())
      : sourceContents.equals(mirrorContents);
    if (!matches) {
      throw new Error(`mirror drift: ${source} ↔ ${mirror}`);
    }
  }
}

// Enforce the current display policy on the final artifact, including gated copies.
export async function verifyAppDisplayPolicy(directory = DIST, routes = [
  ...PUBLIC_DIRS.filter((entry) => /^zz\d+$/.test(entry) || entry === 'TabataTimer' || entry === 'KanameCue'),
  ...DISTRIBUTION_APPS.map((app) => `tools/${app.target}`)
]) {
  for (const route of routes) {
    const appDirectory = path.join(directory, route);
    const manifest = JSON.parse(await readFile(path.join(appDirectory, 'manifest.webmanifest'), 'utf8'));
    const expectedDisplay = route === 'tools/magicshow' ? 'fullscreen' : 'standalone';
    if (manifest.display !== expectedDisplay || (route !== 'tools/magicshow' && (manifest.display_override || []).includes('fullscreen'))) {
      throw new Error(`App display policy: ${route} must remain ${expectedDisplay}`);
    }
    const html = await readFile(path.join(appDirectory, 'index.html'), 'utf8');
    const disabled = /<body\b[^>]*\bdata-magic-customize=["']off["']/.test(html);
    const customizeOff = route.startsWith('tools/') && route !== 'tools/release';
    if (disabled !== customizeOff) {
      throw new Error(`App customization policy: ${route}`);
    }
    for (const entry of await readdir(appDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(?:html|js|mjs)$/.test(entry.name)) continue;
      const content = await readFile(path.join(appDirectory, entry.name), 'utf8');
      if (/\b(?:requestFullscreen|webkitRequestFullscreen|webkitRequestFullScreen|mozRequestFullScreen|msRequestFullscreen)\b/.test(content)) {
        const rewindException = (route === 'zz2' || route === 'tools/release')
          && (entry.name === 'index.html' || entry.name === 'pin.js') && content.includes('function enterRewindFullscreen()');
        if (!rewindException) throw new Error(`Fullscreen is disabled: ${route}/${entry.name}`);
      }
    }
  }
}

export async function buildPublic() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  for (const file of PUBLIC_FILES) await copyIfExists(file);
  for (const dir of PUBLIC_DIRS) await copyIfExists(dir);
  await buildDistributionApps();
  // Bridge files are explicit. The legacy trees above stay excluded.
  await publishLegacyBridgeFiles(DIST);
  await verifyMirrors();
  await verifyAppDisplayPolicy();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 3 && process.argv[2] === '--promote-unlock') {
    await promoteSharedUnlock();
  } else if (process.argv.length === 2) {
    await buildPublic();
  } else {
    throw new Error('Usage: node scripts/build-public.mjs [--promote-unlock]');
  }
}
