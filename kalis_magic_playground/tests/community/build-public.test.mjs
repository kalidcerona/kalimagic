import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { PUBLIC_FILES, PUBLIC_DIRS, PRIVATE_PATTERNS, buildPublic } from '../../scripts/build-public.mjs';

test('public build allowlist includes visible site pages', () => {
  assert.ok(PUBLIC_FILES.includes('index.html'));
  assert.ok(PUBLIC_FILES.includes('reviews.html'));
  assert.ok(PUBLIC_FILES.includes('admin.js'));
  assert.ok(PUBLIC_FILES.includes('style.css'));
  assert.ok(PUBLIC_FILES.includes('nav.js'));
  assert.ok(PUBLIC_FILES.includes('playground-youtube.mjs'));
  assert.ok(PUBLIC_FILES.includes('playground-youtube-lite.mjs'));
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
