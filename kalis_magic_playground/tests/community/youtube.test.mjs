// tests/community/youtube.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildYouTubeEmbedUrl,
  buildYouTubeThumbnailUrl,
  buildYouTubeWatchUrl,
  extractYouTubeId,
  isValidYouTubeId,
  normalizeYouTube,
} from '../../playground-youtube.mjs';

const ID = 'dQw4w9WgXcQ';

test('validates YouTube video id', () => {
  assert.equal(isValidYouTubeId(ID), true);
  assert.equal(isValidYouTubeId('too-short'), false);
  assert.equal(isValidYouTubeId('not valid id'), false);
});

test('extracts id from watch URL', () => {
  assert.equal(extractYouTubeId(`https://www.youtube.com/watch?v=${ID}`), ID);
});

test('extracts id from watch URL with extra params', () => {
  assert.equal(extractYouTubeId(`https://www.youtube.com/watch?v=${ID}&t=30s`), ID);
});

test('extracts id from youtu.be URL', () => {
  assert.equal(extractYouTubeId(`https://youtu.be/${ID}`), ID);
});

test('extracts id from youtu.be URL with query', () => {
  assert.equal(extractYouTubeId(`https://youtu.be/${ID}?si=abc`), ID);
});

test('extracts id from shorts URL', () => {
  assert.equal(extractYouTubeId(`https://www.youtube.com/shorts/${ID}`), ID);
});

test('extracts id from embed URL', () => {
  assert.equal(extractYouTubeId(`https://www.youtube.com/embed/${ID}`), ID);
});

test('extracts id from youtube-nocookie embed URL', () => {
  assert.equal(extractYouTubeId(`https://www.youtube-nocookie.com/embed/${ID}`), ID);
});

test('extracts id from live URL', () => {
  assert.equal(extractYouTubeId(`https://www.youtube.com/live/${ID}`), ID);
});

test('accepts raw video id', () => {
  assert.equal(extractYouTubeId(ID), ID);
});

test('rejects non-YouTube URL', () => {
  assert.equal(extractYouTubeId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
});

test('rejects fake YouTube hostname', () => {
  assert.equal(extractYouTubeId(`https://youtube.com.evil.test/watch?v=${ID}`), null);
});

test('rejects malformed input', () => {
  assert.equal(extractYouTubeId('그냥 문자열'), null);
  assert.equal(extractYouTubeId(''), null);
  assert.equal(extractYouTubeId(null), null);
});

test('builds canonical URLs', () => {
  assert.equal(buildYouTubeWatchUrl(ID), `https://www.youtube.com/watch?v=${ID}`);
  assert.equal(buildYouTubeEmbedUrl(ID), `https://www.youtube-nocookie.com/embed/${ID}`);
  assert.equal(buildYouTubeThumbnailUrl(ID), `https://img.youtube.com/vi/${ID}/hqdefault.jpg`);
});

test('normalizes YouTube URL', () => {
  const result = normalizeYouTube(`https://www.youtube.com/watch?v=${ID}`);
  assert.deepEqual(result, {
    ok: true,
    videoId: ID,
    watchUrl: `https://www.youtube.com/watch?v=${ID}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
    embedUrlAutoplay: `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0`,
    thumbnailUrl: `https://img.youtube.com/vi/${ID}/hqdefault.jpg`,
    error: null,
  });
});

test('normalizes invalid YouTube URL', () => {
  const result = normalizeYouTube('https://example.com/video');
  assert.deepEqual(result, {
    ok: false,
    videoId: null,
    watchUrl: null,
    embedUrl: null,
    embedUrlAutoplay: null,
    thumbnailUrl: null,
    error: 'INVALID_YOUTUBE_URL',
  });
});
