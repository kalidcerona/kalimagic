import { EFFECTIVE_DATE as policyEffectiveDate } from '../member-policy-config.mjs';
import { injectZzImport, publishZzImport, ZZ_IMPORT_TARGETS } from './zz-import-build.mjs';
import { writeZzRetirementWorkers } from './write-zz-retirement.mjs';
import { verifyAppRelease } from './app-release-pins.mjs';
import { readFileSync } from 'node:fs';
import { MAGICSHOW_EXTRAS, magicshowRuntimeFiles } from './magicshow-files.mjs';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGACY_SHARED_WORKERS, TRUSTED_START_SESSION_KEY, legacyWorkerSpecByTarget } from './legacy-shared-contract.mjs';
import { legacyBridgeSource } from './legacy-sw-bridge.mjs';
import { isFriendAppPublicBeta } from '../netlify/edge-functions/tools-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

export const PUBLIC_FILES = [
  'about.html',
  'privacy.html',
  'terms.html',
  'member-policy.css',
  'member-policy.js',
  'member-policy-config.mjs',
  'policy-pages.css',
  'policies/previous/privacy-2026-11-28-r1.html',
  'policies/previous/privacy-before-2026-11-30.html',
  'policies/previous/terms-before-2026-11-30.html',
  'contact.html',
  'contact.js',
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
  'seminar-signup/index.html',
  'seminar-signup/pricing.mjs',
  'seminar-signup/form.mjs',
  'seminar-signup/entry.mjs',
  'seminar-signup/event-config.mjs',
  'seminar-signup/cupsnballs.html',
  'seminar-signup/cups-form.mjs',
  'seminar-signup/styles.css',
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

export const APP_RELEASE_ROOTS = Object.freeze([
  ...['aletheia', 'calculator', 'choice', 'gwayubulgeup', 'kairos', 'memdeck', 'pimax',
    'qr', 'spinner', 'tobira', 'unlock', 'usotsuki', 'bell', 'slot', 'asrai', 'alter', 'uramichi']
    .map(name => `distribution-snapshots/${name}`)
]);

export const PUBLIC_DIRS = [
  'assets',
  'cupsnballs',
  'daebeongae',
  'eggbag',
  'imigi3',
  'tools',
  'TabataTimer',
  'KanameCue'
];

// Publish only the offline shell and worker for this personal app.
export const TABATA_FILES = ['editor.js', 'audio.js', 'wake-lock.js', 'timer-run.js', 'timer-view.js', 'data.js', 'install-ui.js', 'icon-maskable-192.png', 'icon-maskable-512.png', 'index.html', 'style.css', 'app.js', 'ready-run.js', 'manifest.webmanifest', 'sw.js', 'update-prompt.js', 'brand-logo.png', 'icon.svg', 'icon-192.png', 'icon-512.png'];

// KANAME Cue web app: the same explicit-shell rule as TabataTimer.
export const KANAME_FILES = ['index.html', 'style.css', 'app.mjs', 'prefs.mjs', 'clock.mjs', 'ui.mjs', 'show.mjs', 'playback.mjs', 'settings.mjs', 'wake.mjs', 'engine.mjs', 'engine-model.mjs', 'engine-output.mjs', 'engine-timing.mjs', 'engine-keys.mjs', 'engine-cues.mjs', 'audio.mjs', 'store.mjs', 'install-ui.js', 'update-prompt.js', 'manifest.webmanifest', 'sw.js', 'brand-logo.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png'];

export const PRIVATE_PATTERNS = [
  /(?:^|\/)fullscreen\.js$/,
  /^MAGIC-PLAYGROUND-PRD\.md$/,
  /^MAGIC-PLAYGROUND-IMPLEMENTATION-PLAN\.md$/,
  /^COMMUNITY-MVP-DESIGN\.md$/,
  /^netlify\/functions\//,
  /^supabase\//,
  /^tests\//,
  /^distribution-snapshots\//,
  /^archive\//,
  /^docs\//,
  /^node_modules\//,
  /^\.env/,
  /^package-lock\.json$/,
  /(?:^|\/)[^/]*\.test\.mjs$/,
  /(?:^|\/)[^/]*\.test\.js$/
];

export const SHARED_UNLOCK_FILES = [
  'photo-save-notice.js',
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
  'performance-link.js',
  'update-prompt.js'
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
// CHOICE app.js and logic.js load these public feature modules.
export const CHOICE_MODULE_FILES = [
  'module-start.js', 'gesture-guide.js', 'dom.js', 'editor.js', 'options.js', 'precheck.js', 'views.js',
  'wizard.js', 'extras.js', 'backup.js', 'user-icons.js', 'wallpaper.js', 'previews.js', 'input-guide.js',
  'performance.js', 'fake-home-surface.js', 'performance-start.js', 'performance-gestures.js',
  'artwork-warmup.js', 'views-home.js', 'wizard-view.js', 'detail-view.js',
  'fake-notes.js', 'wake-lock.js', 'controller.js', 'logic-core.js', 'logic-presets.js',
  'logic-performance.js', 'logic-extras.js', 'logic-storage.js', 'logic-fake-home.js', 'logic-notes.js',
  'logic-backup.js', 'logic-user-icons.js', 'logic-wizard.js'
];
export const CHOICE_DISTRIBUTION_FILES = ['photo-save-notice.js', ...CHOICE_FILES, ...CHOICE_MODULE_FILES, 'brand-logo.png', 'fullscreen.js', 'settings-ui.js', 'settings-ui.css', 'update-prompt.js', 'update-notice.js', 'choice-update-prompt.js'];

export function shouldCopyChoice(relativePath) {
  return relativePath === '' || relativePath === 'home-icons' || CHOICE_DISTRIBUTION_FILES.includes(relativePath.split(path.sep).join('/'));
}
// USOTSUKI style.css is split into feature pieces linked in this order after style.css.
export const USOTSUKI_STYLE_FILES = ['style-settings.css', 'style-holdem.css', 'style-recorder.css'];
export const USOTSUKI_FILES = NEW_APP_FILES.filter((file) => file !== 'app.js').concat(USOTSUKI_STYLE_FILES, 'first-run-guide.js', 'detector.js', 'launch-check.js', 'performance-log.js', 'detector-panel-grok.svg', 'holdem-assets/felt-grain.svg', 'holdem-assets/leather-grain.svg', 'holdem-assets/table-rail.svg', 'recorder-assets/recorder-shell-blank.webp', 'recorder-theme.js', 'recorder-engine.js', 'recorder-trace.js', 'recorder-a.html', 'recorder-d.html', 'controller.js', 'controller-state.js', 'controller-themes.js', 'controller-audio.js', 'controller-storage.js', 'controller-hold.js', 'controller-haptic.js', 'controller-screens.js', 'controller-attempts.js', 'controller-gestures.js', 'controller-display-theme.js', 'dom.js', 'storage.js', 'heartbeat.js', 'vibration.js', 'wake-lock.js', 'preferences.js', 'stage.js', 'bindings.js');
export const SPINNER_STYLE_FILES = ['style-casino.css', 'style-hybrid.css'];
export const SPINNER_FILES = ['install.js', 'settings-gesture.js', 'spin.js', 'theme.js', 'wake-lock.js',
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
  'logic.js', 'manifest.webmanifest', 'style.css', ...SPINNER_STYLE_FILES, 'sw.js', 'update-prompt.js'
];
export const MEMDECK_FILES = ['storage.mjs', 'screen-shared.mjs', 'study.mjs', 'quiz.mjs', 'table.mjs', 'records.mjs', 'settings.mjs', 'rank.mjs', 'memory-model.mjs', 'memory-training.mjs', 'memory.mjs',
  'first-run-guide.js',
  'index.html', 'style.css', 'app.mjs', 'core.mjs', 'data.mjs', 'mnemonic.mjs', 'update-prompt.js',
  'brand-logo.png', 'manifest.webmanifest', 'sw.js', 'icon.svg', 'icon-192.png', 'icon-512.png'
];
// KAIROS (pimax) style.css is split into feature pieces linked in this order after style.css.
export const PIMAX_STYLE_FILES = ['style-practice.css', 'style-quiz-shapes.css', 'style-checker-install.css'];
export const PIMAX_FILES = ["update-prompt.js", "index.html", "app.mjs", "state.mjs", "session.mjs", "practice.mjs", "glyphs.mjs", "learn.mjs", "settings.mjs", "install.mjs", "events.mjs", "core.mjs", "core-stack.mjs", "core-windows.mjs", "core-grading.mjs", "core-explain.mjs", "core-questions.mjs", "core-storage.mjs", "core-stats.mjs", "style.css", ...PIMAX_STYLE_FILES, "sw.js", "brand-logo.png", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

export function shouldCopyPimax(relativePath) {
  return relativePath === '' || PIMAX_FILES.includes(relativePath);
}

export const QR_FILES = ['storage-recovery.mjs', 'rendering.mjs', 'settings.mjs', 'gestures-editing.mjs', 'export.mjs', 'install.mjs', 'wake-lock.mjs',
  'first-run-guide.js',
  'index.html', 'style.css', 'app.mjs', 'core.mjs', 'manifest.webmanifest', 'sw.js', 'update-prompt.js', 'brand-logo.png',
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

export const MIRROR_PAIRS = Object.freeze([]);

// Shared HITSUZEN and AROSAEGIDA copy pinned snapshots. tools/calc stays a legacy redirect, not a published tree.
const LEGACY_MIGRATION_TARGETS = new Set(['kairos', 'kairos-classic', 'hitsuzen']);
const INIT_APP_HOOK = 'else initApp();';

export function isolateKairosStorageKeys(source, target) {
  // index.html, style.css and the gesture files are copied through here and have no keys.
  // replaceAll would leave a storage script unchanged if every prefix disappeared, so fail instead.
  const markers = [
    ['stopwatch_', `friend-${target}_`],
    ['stopwatch2_', `friend-${target}-legacy_`],
    ['stopwatch-settings-entry-tutorial-', `friend-${target}-settings-entry-tutorial-`]
  ];
  const present = markers.filter(([marker]) => source.includes(marker));
  if (present.length === 0 && /localStorage|sessionStorage|\.getItem\s*\(|\.setItem\s*\(/.test(source)) {
    throw new Error('missing KAIROS storage key marker');
  }
  let next = source;
  for (const [marker, replacement] of markers) {
    if (!next.includes(marker)) continue;
    next = next.replaceAll(marker, replacement);
    if (next.includes(marker) || !next.includes(replacement)) throw new Error(`missing ${marker} storage key marker`);
  }
  return next;
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
  // Public game betas own their documents and do not use the friend access guard.
  if (app.target === 'magicshow' || app.target === 'planbcafe') return html;
  const isolate = app.target === 'kairos' || app.target === 'kairos-classic';
  let next = isolate ? isolateKairosStorageKeys(html, app.target) : html;
  // RELEASE friends get the same editor as the personal build. Other friend apps stay fixed.
  if (app.target !== 'release') next = next.replace(/<body\b/, '<body data-magic-customize="off"');
  if (!isFriendAppPublicBeta(app.target)) {
    // A missing marker would ship the app without its access guard, so fail the build instead.
    if (!next.includes('<head>')) throw new Error(`missing <head> for the ${app.target} access guard`);
    next = next.replace('<head>', `<head>\n${accessGuard(app.tool, app.target)}`);
  }
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
const magicshowRuntime = magicshowRuntimeFiles(readFileSync(path.join(ROOT, 'distribution-snapshots/magicshow/index.html'), 'utf8'));
export function shouldCopyMagicshow(relativePath, runtime = magicshowRuntime) {
  const file = relativePath.split(path.sep).join('/');
  return file === '' || file === 'assets' || file === 'fonts' || file === 'fonts/OFL.md' ||
    MAGICSHOW_EXTRAS.includes(file) || runtime.includes(file) || runtime.some(name => name.startsWith(file + '/')) ||
    /^assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.(?:png|webp))?$/.test(file) || file === 'assets/ui/cheer.json' || /^fonts\/[A-Za-z0-9_-]+\.woff2$/.test(file);
}

// This game is a frozen web build; no generated or private files may leak in.
export function shouldCopyPlanbcafe(relativePath) {
  const file = relativePath.split(path.sep).join('/');
  return ['', 'icons', 'index.html', 'save_sync.js', 'game.js', 'love.js', 'love.wasm', 'game.data',
    'sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
    'icons/maskable-512.png'].includes(file);
}

export const DISTRIBUTION_APPS = [
  ...['asrai', 'alter', 'uramichi'].map(name => ({ source: `distribution-snapshots/${name}`, target: name, tool: name })),
  { source: 'distribution-snapshots/memdeck', target: 'memdeck', tool: 'memdeck' },
  { source: 'distribution-snapshots/bell', target: 'bell', tool: 'bell' },
  { source: 'distribution-snapshots/slot', target: 'slot', tool: 'slot' },
  { source: 'distribution-snapshots/gwayubulgeup', target: 'gwayubulgeup', tool: 'gwayubulgeup' },
  { source: 'distribution-snapshots/magicshow', target: 'magicshow', tool: 'magicshow' },
  { source: 'distribution-snapshots/planbcafe', target: 'planbcafe', tool: 'planbcafe' },
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
      ${ZZ_IMPORT_TARGETS.includes(target) ? `let resolveAccess;
      globalThis.zzImportAccess = new Promise(resolve => { resolveAccess = resolve; });
      const reveal = () => { document.documentElement.style.visibility = ''; resolveAccess(true); };` :
      "const reveal = () => { document.documentElement.style.visibility = ''; };"}
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

function publicBetaWorker(source, target) {
  // An installed beta worker must reach the edge on every launch, including after rollback.
  const replacements = [
    [/(const CACHE_NAME = CACHE_PREFIX \+ '[^']+)';/, "$1-public-beta';"],
    [/SHELL\.map\((?=[^\n]+new Request)/, "SHELL.filter((file) => file !== './index.html').map("],
    ['  event.respondWith((async () => {',
      `  const name = shellName(request.url);
  if (name === '' || name === 'index.html') {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }
  event.respondWith((async () => {`]
  ];
  for (const [marker, replacement] of replacements) {
    const next = source.replace(marker, replacement);
    if (next === source) throw new Error(`missing public beta worker marker for ${target}: ${marker}`);
    source = next;
  }
  return source;
}

async function buildDistributionApps() {
  for (const app of DISTRIBUTION_APPS) {
    const source = path.join(ROOT, app.source);
    const target = path.join(DIST, 'tools', app.target);
    await cp(source, target, {
      recursive: true,
      filter: (entry) => app.target === 'magicshow'
        ? shouldCopyMagicshow(path.relative(source, entry))
        : app.target === 'planbcafe'
        ? shouldCopyPlanbcafe(path.relative(source, entry))
        : app.target === 'pimax'
        ? shouldCopyPimax(path.relative(source, entry))
        : app.target === 'choice'
          ? shouldCopyChoice(path.relative(source, entry))
          : shouldCopy(path.relative(source, entry))
    });
    const indexPath = path.join(target, 'index.html');
    const html = await readFile(indexPath, 'utf8');
    // Key isolation follows the public route.
    // Raw stopwatch_ values are copied later by the injected migration module.
    await writeFile(indexPath, injectZzImport(transformDistributionDocument(html, app), app.target));
    if (isFriendAppPublicBeta(app.target)) {
      const swPath = path.join(target, 'sw.js');
      await writeFile(swPath, publicBetaWorker(await readFile(swPath, 'utf8'), app.target));
    }
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
    await publishZzImport(target, app.target);
    // Preserve the game's manifest bytes as well as its relative identity.
    if (app.target === 'planbcafe') continue;
    const manifestPath = path.join(target, 'manifest.webmanifest');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (app.target !== 'magicshow') Object.assign(manifest, { id: `/tools/${app.target}/`, start_url: './', scope: './' });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
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
      return shouldCopy(path.relative(ROOT, source)) && !isExcludedLegacyTree(publicPath);
    }
  });

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

// Public snapshots are canonical; audit them against independently selected release pins.
export async function verifyMirrors({ root = ROOT } = {}) {
  return verifyAppRelease({ root, requiredRoots: APP_RELEASE_ROOTS });
}

// Enforce the current display policy on the final artifact, including gated copies.
export async function verifyAppDisplayPolicy(directory = DIST, routes = [
  ...PUBLIC_DIRS.filter((entry) => entry === 'TabataTimer' || entry === 'KanameCue'),
  ...DISTRIBUTION_APPS.map((app) => `tools/${app.target}`)
]) {
  for (const route of routes) {
    const appDirectory = path.join(directory, route);
    const manifest = JSON.parse(await readFile(path.join(appDirectory, 'manifest.webmanifest'), 'utf8'));
    const isGame = route === 'tools/magicshow' || route === 'tools/planbcafe';
    const expectedDisplay = isGame ? 'fullscreen' : 'standalone';
    if (manifest.display !== expectedDisplay || (!isGame && (manifest.display_override || []).includes('fullscreen'))) {
      throw new Error(`App display policy: ${route} must remain ${expectedDisplay}`);
    }
    // PLAN B cafe owns its runtime; personal magic-app policies do not apply.
    if (route === 'tools/planbcafe') continue;
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
        const rewindException = (route === 'tools/release')
          && (entry.name === 'index.html' || entry.name === 'pin.js') && content.includes('function enterRewindFullscreen()');
        if (!rewindException) throw new Error(`Fullscreen is disabled: ${route}/${entry.name}`);
      }
    }
  }
}


async function publishPolicyDates() {
  const date = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  }).format(new Date(policyEffectiveDate));
  const marker = '<time data-policy-date></time>';
  for (const file of ['privacy.html', 'terms.html']) {
    const target = path.join(DIST, file);
    const template = await readFile(target, 'utf8');
    if (!template.includes(marker)) throw new Error('Missing policy date marker: ' + file);
    await writeFile(target, template.replace(marker, `<time datetime="${policyEffectiveDate}">${date}</time>`));
  }
}

export async function buildPublic() {
  await verifyAppRelease({ root: ROOT, requiredRoots: APP_RELEASE_ROOTS });
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  for (const file of PUBLIC_FILES) await copyIfExists(file);
  await publishPolicyDates();
  for (const dir of PUBLIC_DIRS) await copyIfExists(dir);
  await buildDistributionApps();
  // Bridge files are explicit. The legacy trees above stay excluded.
  await publishLegacyBridgeFiles(DIST);
  await writeZzRetirementWorkers(DIST);
  await verifyAppDisplayPolicy();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 2) {
    await buildPublic();
  } else {
    throw new Error('Usage: node scripts/build-public.mjs');
  }
}
