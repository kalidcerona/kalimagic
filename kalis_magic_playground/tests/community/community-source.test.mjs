import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('public post APIs include readable YouTube ids only when the body is readable', () => {
  const posts = source('netlify/functions/posts.mjs');
  const detail = source('netlify/functions/post-detail.mjs');
  assert.match(posts, /select\('[^']*youtube_video_id/);
  assert.match(posts, /youtubeVideoId:\s*canReadBody\s*\?\s*row\.youtube_video_id\s*:\s*null/);
  assert.match(detail, /select\('[^']*youtube_video_id/);
  assert.match(detail, /youtubeVideoId:\s*canReadBody\s*\?\s*row\.youtube_video_id\s*:\s*null/);
});

test('admin inbox API includes question YouTube ids for moderation rendering', () => {
  const inbox = source('netlify/functions/admin-inbox.mjs');
  assert.match(inbox, /select\('[^']*youtube_video_id/);
  assert.match(inbox, /youtubeVideoId:\s*row\.youtube_video_id/);
});

test('playground renders lite YouTube embeds for questions and answers', () => {
  const playground = source('playground.js');
  assert.match(playground, /function createYouTubeLiteEmbed/);
  assert.match(playground, /img\.youtube\.com\/vi\//);
  assert.match(playground, /youtube-nocookie\.com\/embed\//);
  assert.match(playground, /post\.youtubeVideoId/);
  assert.match(playground, /answer\.youtubeVideoId/);
});

test('admin inbox can write answers and render question YouTube embeds', () => {
  const admin = source('admin.js');
  assert.match(admin, /답변 작성/);
  assert.match(admin, /\/\.netlify\/functions\/answers/);
  assert.match(admin, /questionPostId/);
  assert.match(admin, /youtubeUrl/);
  assert.match(admin, /item\.youtubeVideoId/);
  assert.match(admin, /function createYouTubeLiteEmbed/);
});

test('post detail exposes viewer answer permission in every readable response', () => {
  const detail = source('netlify/functions/post-detail.mjs');
  assert.match(detail, /function canViewerAnswer\(viewer\)/);
  assert.match(detail, /viewerCanAnswer:\s*canViewerAnswer\(viewer\)/);
  assert.equal((detail.match(/viewerCanAnswer:\s*canViewerAnswer\(viewer\)/g) || []).length, 2);
});

test('playground detail can write answers only when post detail allows it', () => {
  const playground = source('playground.js');
  assert.match(playground, /data\.viewerCanAnswer/);
  assert.match(playground, /function answerForm\(post\)/);
  assert.match(playground, /답변 작성/);
  assert.match(playground, /\/\.netlify\/functions\/answers/);
  assert.match(playground, /questionPostId:\s*post\.id/);
  assert.match(playground, /visibility:\s*formData\.get\('visibility'\)/);
  assert.match(playground, /youtubeUrl:\s*formData\.get\('youtubeUrl'\)/);
  assert.match(playground, /await loadDetail\(state\.selectedPostId\)/);
});
