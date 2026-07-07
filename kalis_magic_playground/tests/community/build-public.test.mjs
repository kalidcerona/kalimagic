import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, PUBLIC_DIRS, PRIVATE_PATTERNS, buildPublic } from '../../scripts/build-public.mjs';

test('public build allowlist includes visible site pages', () => {
  assert.ok(PUBLIC_FILES.includes('index.html'));
  assert.ok(PUBLIC_FILES.includes('reviews.html'));
  assert.ok(PUBLIC_FILES.includes('admin.js'));
  assert.ok(PUBLIC_FILES.includes('style.css'));
  assert.ok(PUBLIC_FILES.includes('nav.js'));
  assert.ok(PUBLIC_FILES.includes('reveal.js'));
  assert.ok(PUBLIC_FILES.includes('playground-api.js'));
  assert.ok(PUBLIC_FILES.includes('playground-list.js'));
  assert.ok(PUBLIC_FILES.includes('playground-compose.js'));
  assert.ok(PUBLIC_FILES.includes('playground-detail.js'));
  assert.ok(PUBLIC_FILES.includes('playground-youtube.mjs'));
  assert.ok(PUBLIC_FILES.includes('playground-youtube-lite.mjs'));
  assert.ok(PUBLIC_DIRS.includes('assets'));
});

test('public build explicitly excludes local planning and source folders', () => {
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('MAGIC-PLAYGROUND-PRD.md')));
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('COMMUNITY-MVP-DESIGN.md')));
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('netlify/functions/posts.mjs')));
  assert.equal(PUBLIC_DIRS.includes('netlify'), false);
  assert.equal(PUBLIC_DIRS.includes('supabase'), false);
});

test('public build does not copy dotfiles from public directories', async () => {
  await buildPublic();
  await assert.rejects(
    stat(new URL('../../dist/kalimeeting/.DS_Store', import.meta.url)),
    /ENOENT/
  );
});

async function listHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
  }));
  return files.flat();
}

function localAssetPath(htmlFile, value, distDir) {
  if (!value) return null;
  const withoutFragment = value.split('#')[0];
  const cleanValue = withoutFragment.split('?')[0];
  if (!cleanValue || cleanValue.startsWith('#')) return null;
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(cleanValue)) return null;
  if (/^(?:mailto|tel|data|javascript):/i.test(cleanValue)) return null;
  const decoded = decodeURIComponent(cleanValue);
  if (decoded.startsWith('/')) return path.join(distDir, decoded);
  return path.resolve(path.dirname(htmlFile), decoded);
}

test('public build includes every local src and href referenced by dist html', async () => {
  await buildPublic();
  const distDir = fileURLToPath(new URL('../../dist', import.meta.url));
  const htmlFiles = await listHtmlFiles(distDir);
  const missing = [];

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, 'utf8');
    for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
      const assetPath = localAssetPath(htmlFile, match[1], distDir);
      if (!assetPath) continue;
      if (!assetPath.startsWith(distDir + path.sep)) {
        missing.push(`${path.relative(distDir, htmlFile)} -> ${match[1]}`);
        continue;
      }
      try {
        await stat(assetPath);
      } catch {
        missing.push(`${path.relative(distDir, htmlFile)} -> ${match[1]}`);
      }
    }
  }

  assert.deepEqual(missing.sort(), []);
});
