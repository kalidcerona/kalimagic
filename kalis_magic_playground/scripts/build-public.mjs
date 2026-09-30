import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  'zz13'
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

export const CHOICE_FILES = [
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
export const NEW_APP_FILES = CHOICE_FILES;
export const USOTSUKI_FILES = NEW_APP_FILES.filter((file) => file !== 'app.js').concat('detector.js', 'detector-panel-grok.svg');
export const ASRAI_FILES = [
  'brand-logo.jpg', 'brand-logo.png', 'contacts.js', 'icon-192.png',
  'icon-512.png', 'icon.svg', 'index.html', 'install-ui.js',
  'logic.js', 'manifest.webmanifest', 'style.css', 'sw.js'
];
export const ALTER_FILES = [
  'app.js', 'brand-logo.jpg', 'brand-logo.png', 'calibration.js', 'camera-geometry.js', 'icon-192.png',
  'icon-512.png', 'index.html', 'install-ui.js', 'logic.js',
  'manifest.webmanifest', 'performance.js', 'style.css', 'sw.js', 'vision.js'
];
export const SPINNER_FILES = [
  'casino-salon.jpg',
  'app.js', 'icon-192.png', 'icon-512.png', 'index.html',
  'logic.js', 'manifest.webmanifest', 'style.css', 'sw.js'
];
export const MEMDECK_FILES = [
  'index.html', 'style.css', 'app.mjs', 'core.mjs', 'data.mjs',
  'manifest.webmanifest', 'sw.js', 'icon.svg', 'icon-192.png', 'icon-512.png'
];
export const QR_FILES = [
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
  ...SETTINGS_UI_FILES.map((file) => [`../../magic-calculator-v2/${file}`, `tools/calc/${file}`]),
  ['../../magic-calculator-v2/index.html', 'zz3/index.html'],
  ['../../magic-calculator-v2/sw.js', 'zz3/sw.js'],
  ['../../magic-calculator-v2/performance-link.js', 'zz3/performance-link.js'],
  ['../../magic-calculator-v2/icon-192.png', 'zz3/icon-192.png'],
  ['../../magic-calculator-v2/icon-512.png', 'zz3/icon-512.png'],
  ['../../magic-calculator-v2/icon.svg', 'zz3/icon.svg'],
  ['../../magic-calculator-v2/manifest.webmanifest', 'zz3/manifest.webmanifest'],
  ['../../magic-calculator-v2/brand-logo.jpg', 'zz3/brand-logo.jpg'],
  ...['index.html', 'sw.js', 'performance-link.js', 'icon-192.png', 'icon-512.png', 'icon.svg', 'manifest.webmanifest', 'brand-logo.jpg']
    .map((file) => [`../../magic-calculator-v2/${file}`, `tools/calc/${file}`]),
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
  ...[
    ['magic-stopwatch-uni', 'zz1'],
    ['magic-unlock', 'zz2'],
    ['magic-calculator-v2', 'zz3'],
    ['magic-calculator-v2', 'tools/calc'],
    ['magic-choice', 'zz4'],
    ['magic-aletheia', 'zz5'],
    ['magic-tobira', 'zz6'],
    ['magic-usotsuki', 'zz7']
  ].map(([source, route]) => [`../../${source}/brand-logo.png`, `${route}/brand-logo.png`])
];

export const DISTRIBUTION_APPS = [
  { source: 'tools/calc', target: 'hitsuzen', tool: 'calc' },
  { source: 'distribution-snapshots/unlock', target: 'release', tool: 'unlock' },
  { source: 'distribution-snapshots/aletheia', target: 'aletheia', tool: 'aletheia' },
  { source: 'distribution-snapshots/usotsuki', target: 'usotsuki', tool: 'usotsuki' },
  { source: 'distribution-snapshots/tobira', target: 'tobira', tool: 'tobira' },
  { source: 'distribution-snapshots/spinner', target: 'tyche', tool: 'spinner' },
  { source: 'distribution-snapshots/kairos', target: 'kairos', tool: 'stopwatch-uni' },
  { source: 'distribution-snapshots/kairos', target: 'kairos-classic', tool: 'stopwatch' },
  { source: 'zz13', target: 'arosaegida', tool: 'arosaegida' }
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
      filter: (entry) => shouldCopy(path.relative(source, entry))
    });
    const indexPath = path.join(target, 'index.html');
    const html = await readFile(indexPath, 'utf8');
    // Key isolation follows the shared route, not the zz1 personal tree.
    const isolateKairosStorage = app.target === 'kairos' || app.target === 'kairos-classic';
    const isolatedHtml = isolateKairosStorage ? html.replaceAll('stopwatch_', `friend-${app.target}_`).replaceAll('stopwatch2_', `friend-${app.target}-legacy_`).replaceAll('stopwatch-settings-entry-tutorial-', `friend-${app.target}-settings-entry-tutorial-`) : html;
    await writeFile(indexPath, isolatedHtml.replace(/<body\b/, '<body data-magic-customize="off"').replace('<head>', `<head>\n${accessGuard(app.tool, app.target)}`));
    if (isolateKairosStorage) {
      const logicPath = path.join(target, 'logic.js');
      const logic = await readFile(logicPath, 'utf8');
      await writeFile(logicPath, logic.replaceAll('stopwatch_', `friend-${app.target}_`).replaceAll('stopwatch2_', `friend-${app.target}-legacy_`));
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
      return shouldCopy(path.relative(ROOT, source)) &&
        !['tools/stopwatch', 'tools/stopwatch-uni', 'tools/calc'].some((route) => publicPath === route || publicPath.startsWith(route + '/'));
    }
  });
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
    if (!sourceContents.equals(mirrorContents)) {
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
        throw new Error(`Fullscreen is disabled: ${route}/${entry.name}`);
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
