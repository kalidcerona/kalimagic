import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
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
  'zz3'
];

export const PRIVATE_PATTERNS = [
  /^MAGIC-PLAYGROUND-PRD\.md$/,
  /^MAGIC-PLAYGROUND-IMPLEMENTATION-PLAN\.md$/,
  /^COMMUNITY-MVP-DESIGN\.md$/,
  /^netlify\/functions\//,
  /^supabase\//,
  /^tests\//,
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
  ['../../magic-stopwatch/index.html', 'tools/stopwatch/index.html']
];

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
  await verifyMirrors();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildPublic();
}
