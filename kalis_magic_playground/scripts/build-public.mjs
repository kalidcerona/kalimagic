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
  'zz14'
];

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
  /^package-lock\.json$/
];

export const SHARED_UNLOCK_FILES = [
  'brand-logo.jpg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'icon.svg',
  'index.html',
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
export const CHOICE_FILES = [...NEW_APP_FILES, ...CHOICE_HOME_FILES];
export const USOTSUKI_FILES = NEW_APP_FILES.filter((file) => file !== 'app.js').concat('first-run-guide.js', 'detector.js', 'detector-panel-grok.svg', 'holdem-assets/felt-grain.svg', 'holdem-assets/leather-grain.svg', 'holdem-assets/table-rail.svg', 'recorder-assets/recorder-shell-blank.webp', 'recorder-theme.js', 'recorder-engine.js', 'recorder-trace.js', 'recorder-a.html', 'recorder-d.html');
export const ASRAI_FILES = [
  'brand-logo.jpg', 'brand-logo.png', 'contacts.js', 'icon-192.png',
  'icon-512.png', 'icon.svg', 'index.html', 'install-ui.js',
  'logic.js', 'manifest.webmanifest', 'style.css', 'sw.js'
];
export const ALTER_FILES = [
  'app.js', 'appearance.js', 'brand-logo.jpg', 'brand-logo.png', 'calibration.js', 'camera-geometry.js', 'icon-192.png',
  'icon-512.png', 'index.html', 'install-ui.js', 'logic.js',
  'manifest.webmanifest', 'performance.js', 'style.css', 'sw.js', 'vision.js'
];
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
  'logic.js', 'manifest.webmanifest', 'style.css', 'sw.js'
];
export const MEMDECK_FILES = [
  'first-run-guide.js',
  'index.html', 'style.css', 'app.mjs', 'core.mjs', 'data.mjs', 'mnemonic.mjs',
  'manifest.webmanifest', 'sw.js', 'icon.svg', 'icon-192.png', 'icon-512.png'
];
export const PIMAX_FILES = ["index.html", "app.mjs", "core.mjs", "style.css", "sw.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

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
  .map((code) => `court-cards/${code}.png`);

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
  ['../../magic-calculator-v2/index.html', 'zz3/index.html'],
  ['../../magic-calculator-v2/sw.js', 'zz3/sw.js'],
  ['../../magic-calculator-v2/performance-link.js', 'zz3/performance-link.js'],
  ['../../magic-calculator-v2/icon-192.png', 'zz3/icon-192.png'],
  ['../../magic-calculator-v2/icon-512.png', 'zz3/icon-512.png'],
  ['../../magic-calculator-v2/icon.svg', 'zz3/icon.svg'],
  ['../../magic-calculator-v2/manifest.webmanifest', 'zz3/manifest.webmanifest'],
  ['../../magic-calculator-v2/brand-logo.jpg', 'zz3/brand-logo.jpg'],
  ['../../magic-stopwatch-uni/index.html', 'zz1/index.html'],
  ['../../magic-stopwatch-uni/sw.js', 'zz1/sw.js'],
  ['../../magic-stopwatch-uni/logic.js', 'zz1/logic.js'],
  ['../../magic-stopwatch-uni/brand-logo.jpg', 'zz1/brand-logo.jpg'],
  ['../../magic-stopwatch-uni/icon-192.png', 'zz1/icon-192.png'],
  ['../../magic-stopwatch-uni/icon-512.png', 'zz1/icon-512.png'],
  ['../../magic-stopwatch-uni/icon.svg', 'zz1/icon.svg'],
  ['../../magic-stopwatch-uni/manifest.webmanifest', 'zz1/manifest.webmanifest'],
  ...SHARED_UNLOCK_FILES.map((file) => [`../../magic-unlock/${file}`, `zz2/${file}`]),
  ...CHOICE_FILES.map((file) => [`../../magic-choice/${file}`, `zz4/${file}`]),
  ...NEW_APP_FILES.map((file) => [`../../magic-aletheia/${file}`, `zz5/${file}`]),
  ['../../magic-aletheia/deck-loader.js', 'zz5/deck-loader.js'],
  ...ALETHEIA_COURT_FILES.map((file) => [`../../magic-aletheia/${file}`, `zz5/${file}`]),
  ...NEW_APP_FILES.map((file) => [`../../magic-tobira/${file}`, `zz6/${file}`]),
  ['../../magic-tobira/sensor-motion.js', 'zz6/sensor-motion.js'],
  ['../../magic-tobira/COIN_CREDITS.md', 'zz6/COIN_CREDITS.md'],
  ['../../magic-tobira/CARD_CREDITS.md', 'zz6/CARD_CREDITS.md'],
  ['../../magic-tobira/card-rider-red.jpg', 'zz6/card-rider-red.jpg'],
  ['../../magic-tobira/card-rider-blue.jpg', 'zz6/card-rider-blue.jpg'],
  ['../../magic-tobira/coin-kennedy.png', 'zz6/coin-kennedy.png'],
  ['../../magic-tobira/coin-500won.png', 'zz6/coin-500won.png'],
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
  const isolate = app.target === 'kairos' || app.target === 'kairos-classic';
  let next = isolate ? isolateKairosStorageKeys(html, app.target) : html;
  next = next
    .replace(/<body\b/, '<body data-magic-customize="off"')
    .replace('<head>', `<head>\n${accessGuard(app.tool, app.target)}`);
  return injectLegacyMigration(next, app.target);
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
export const DISTRIBUTION_APPS = [
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

function accessGuard(tool, target) {
  return `  <script id="friend-apps-check">
    if (location.protocol === 'https:' && location.pathname.startsWith('/tools/')) {
      document.documentElement.style.visibility = 'hidden';
      const loginUrl = '/tools/login/?to=' + encodeURIComponent(location.pathname + location.search);
      fetch('/tools/_check?tool=${tool}', { credentials: 'same-origin', cache: 'no-store' })
        .then((response) => response.json())
        .then((result) => {
          if (!result.ok) { location.replace(loginUrl); return; }
          document.documentElement.style.visibility = '';
        })
        .catch(() => { location.replace(loginUrl); });
    }
  </script>`;
}

async function buildDistributionApps() {
  for (const app of DISTRIBUTION_APPS) {
    const source = path.join(ROOT, app.source);
    const target = path.join(DIST, 'tools', app.target);
    await cp(source, target, {
      recursive: true,
      filter: (entry) => app.target === 'pimax'
        ? shouldCopyPimax(path.relative(source, entry))
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
    }
    if (LEGACY_MIGRATION_TARGETS.has(app.target)) {
      await publishLegacyMigrationModules(target);
    }
    const manifestPath = path.join(target, 'manifest.webmanifest');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    Object.assign(manifest, { id: `/tools/${app.target}/`, start_url: './', scope: './' });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
}

// Run explicitly after the personal version is approved for shared distribution.
export async function promoteSharedUnlock() {
  const source = path.resolve(ROOT, '../../magic-unlock');
  const snapshot = path.join(ROOT, 'distribution-snapshots', 'unlock');
  for (const file of SHARED_UNLOCK_FILES) {
    if (!(await exists(path.relative(ROOT, path.join(source, file))))) {
      throw new Error(`Cannot promote missing unlock file: ${file}`);
    }
  }
  await rm(snapshot, { recursive: true, force: true });
  await mkdir(snapshot, { recursive: true });
  for (const file of SHARED_UNLOCK_FILES) {
    await cp(path.join(source, file), path.join(snapshot, file));
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

async function verifyMirrors() {
  for (const [source, mirror] of MIRROR_PAIRS) {
    if (!(await exists(source))) {
      console.log(`mirror check skipped: ${source} not found`);
      continue;
    }
    const [sourceContents, mirrorContents] = await Promise.all([
      readFile(path.join(ROOT, source)),
      readFile(path.join(ROOT, mirror))
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
  ...PUBLIC_DIRS.filter((entry) => /^zz\d+$/.test(entry)),
  ...DISTRIBUTION_APPS.map((app) => `tools/${app.target}`)
]) {
  for (const route of routes) {
    const appDirectory = path.join(directory, route);
    const manifest = JSON.parse(await readFile(path.join(appDirectory, 'manifest.webmanifest'), 'utf8'));
    if (manifest.display !== 'standalone' || (manifest.display_override || []).includes('fullscreen')) {
      throw new Error(`App display policy: ${route} must remain standalone`);
    }
    const html = await readFile(path.join(appDirectory, 'index.html'), 'utf8');
    const disabled = /<body\b[^>]*\bdata-magic-customize=["']off["']/.test(html);
    if (disabled !== route.startsWith('tools/')) {
      throw new Error(`App customization policy: ${route}`);
    }
    for (const entry of await readdir(appDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(?:html|js|mjs)$/.test(entry.name)) continue;
      const content = await readFile(path.join(appDirectory, entry.name), 'utf8');
      if (/\b(?:requestFullscreen|webkitRequestFullscreen|webkitRequestFullScreen|mozRequestFullScreen|msRequestFullscreen)\b/.test(content)) {
        const rewindException = (route === 'zz2' || route === 'tools/release')
          && entry.name === 'index.html' && content.includes('function enterRewindFullscreen()');
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
