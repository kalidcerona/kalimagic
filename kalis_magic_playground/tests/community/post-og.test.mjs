import test from 'node:test';
import assert from 'node:assert/strict';
import * as postMeta from '../../netlify/functions/_lib/post-meta.mjs';

const { buildPostMeta, DESCRIPTION_LIMIT } = postMeta;

const canonicalUrl = 'https://kalimagic.netlify.app/p/11111111-1111-4111-8111-111111111111';

test('post meta escapes titles in title and meta attributes', () => {
  const meta = buildPostMeta({
    title: '\"><script>alert(1)</script>',
    body: '안전한 본문'
  }, canonicalUrl);

  assert.match(meta.html, /<title>&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt; \| 칼리형<\/title>/);
  assert.match(meta.html, /<meta property="og:title" content="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;">/);
  assert.doesNotMatch(meta.html, /<script>alert\(1\)<\/script>/);
});

test('post meta strips markup and truncates descriptions to the configured limit', () => {
  const meta = buildPostMeta({
    title: '설명 테스트',
    body: '<p>첫 <strong>설명</strong> &amp; 안전</p> **강조** ' + '가'.repeat(100)
  }, canonicalUrl);

  assert.equal(meta.description.startsWith('첫 설명 & 안전 강조'), true);
  assert.equal(Array.from(meta.description).length, DESCRIPTION_LIMIT);
  assert.equal(meta.description.endsWith('…'), true);
  assert.doesNotMatch(meta.description, /<[^>]+>|\*\*/);
});

test('post meta keeps encoded entities inert inside attributes', () => {
  const meta = buildPostMeta({
    title: '&quot; autofocus onfocus=alert(1) x=&quot;',
    body: '&lt;img src=x onerror=alert(1)&gt;본문'
  }, canonicalUrl);

  assert.match(meta.html, /content="&amp;quot; autofocus onfocus=alert\(1\) x=&amp;quot;"/);
  assert.doesNotMatch(meta.html, /content="&quot; autofocus/);
  assert.doesNotMatch(meta.html, /<img src=x/);
});

test('post meta replaces only the marked shell metadata block', () => {
  const shell = '<head>before<!-- POST_META_START -->old<!-- POST_META_END -->after</head>';

  assert.equal(typeof postMeta.injectPostMeta, 'function');
  assert.equal(
    postMeta.injectPostMeta(shell, '<title>새 제목</title>'),
    '<head>before<!-- POST_META_START -->\n  <title>새 제목</title>\n  <!-- POST_META_END -->after</head>'
  );
});
