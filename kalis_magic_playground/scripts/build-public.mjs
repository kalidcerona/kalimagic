import { cp, mkdir, rm, stat } from 'node:fs/promises';
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
  'kalimeeting',
  'planb',
  'tools'
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

export async function buildPublic() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  for (const file of PUBLIC_FILES) await copyIfExists(file);
  for (const dir of PUBLIC_DIRS) await copyIfExists(dir);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildPublic();
}
