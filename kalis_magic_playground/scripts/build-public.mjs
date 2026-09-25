import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
  'zz6'
];

export const PRIVATE_PATTERNS = [
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
  /^package-lock\.json$/
];

export const MIRROR_PAIRS = [
  ['../../magic-calculator-v2/index.html', 'zz2/index.html'],
  ['../../magic-calculator-v2/sw.js', 'zz2/sw.js'],
  ['../../magic-calculator-v2/index.html', 'tools/calc/index.html'],
  ['../../magic-stopwatch/index.html', 'zz3/index.html'],
  ['../../magic-stopwatch/sw.js', 'zz3/sw.js'],
  ['../../magic-stopwatch/index.html', 'tools/stopwatch/index.html'],
  ['../../magic-stopwatch-v2/index.html', 'zz4/index.html'],
  ['../../magic-stopwatch-v2/sw.js', 'zz4/sw.js'],
  ['../../magic-unlock/index.html', 'zz5/index.html'],
  ['../../magic-unlock/logic.js', 'zz5/logic.js'],
  ['../../magic-unlock/time-machine.js', 'zz5/time-machine.js'],
  ['../../magic-unlock/install-prompt.js', 'zz5/install-prompt.js'],
  ['../../magic-unlock/sw.js', 'zz5/sw.js'],
  ['../../magic-stopwatch-uni/index.html', 'zz6/index.html'],
  ['../../magic-stopwatch-uni/sw.js', 'zz6/sw.js'],
  ['../../magic-stopwatch-uni/logic.js', 'zz6/logic.js']
];

export const DISTRIBUTION_APPS = [
  { source: 'distribution-snapshots/unlock', target: 'unlock', tool: 'unlock' },
  { source: 'zz6', target: 'stopwatch-uni', tool: 'stopwatch-uni' }
];

export const SHARED_UNLOCK_FILES = [
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
  'time-machine.js'
];

function accessGuard(tool, target) {
  return `  <script id="friend-apps-check">
    if (location.protocol === 'https:' && location.pathname.startsWith('/tools/${target}/')) {
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
    await writeFile(indexPath, html.replace('<head>', `<head>\n${accessGuard(app.tool, app.target)}`));
  }
}

// Run explicitly after the personal version is approved for shared distribution.
export async function promoteSharedUnlock() {
  const source = path.join(ROOT, 'zz5');
  const snapshot = path.join(ROOT, 'distribution-snapshots', 'unlock');
  for (const file of SHARED_UNLOCK_FILES) {
    if (!(await exists(path.join('zz5', file)))) {
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
    filter: (source) => shouldCopy(path.relative(ROOT, source))
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

export async function buildPublic() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  for (const file of PUBLIC_FILES) await copyIfExists(file);
  for (const dir of PUBLIC_DIRS) await copyIfExists(dir);
  await buildDistributionApps();
  await verifyMirrors();
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
