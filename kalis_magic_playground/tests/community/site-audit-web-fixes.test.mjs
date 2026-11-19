import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as policy from '../../netlify/functions/_lib/access-policy.mjs';
import { json } from '../../netlify/functions/_lib/http.mjs';
import { validateUuid } from '../../netlify/functions/_lib/validators.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const detailSource = read('playground-detail.js');
const apiSource = read('netlify/functions/post-detail.mjs');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const dataFor = (id) => ({ post: { id, title: `Post ${id}`, body: id, visibility: 'public' }, answers: [], comments: [] });

function detailHarness(session = async () => ({ user: { id: 'viewer' } })) {
  const listeners = {}, requests = [], writes = [];
  const root = { innerHTML: '', addEventListener: (type, fn) => { listeners[type] = fn; }, querySelector: () => null };
  const api = {
    getPostDetail(id) { const request = { id, ...deferred() }; requests.push(request); return request.promise; },
    async fetchJson(url, options) { writes.push({ url, body: JSON.parse(options.body) }); }
  };
  const window = {
    PgUtil: { escapeHtml: (s) => String(s ?? ''), formatDate: () => '' },
    MagicAuth: { getSession: session }, location: { origin: 'https://example.test' }
  };
  vm.runInNewContext(detailSource, {
    window, navigator: {}, document: { addEventListener() {} }, console: { error() {} },
    FormData: class { get(name) { return { body: 'test', displayMode: 'nickname', visibility: 'public' }[name]; } }
  });
  const detail = window.KalisPlaygroundDetail.initPlaygroundDetail({ api, root });
  function submit(kind) {
    const form = { dataset: {}, querySelector: () => ({ textContent: '' }) };
    return listeners.submit({ preventDefault() {}, target: { closest: (selector) => selector === `[data-${kind}-form]` ? form : null } });
  }
  return { detail, root, requests, writes, submit, api };
}

test('out-of-order detail responses keep rendered and submitted post IDs coherent', async () => {
  const h = detailHarness();
  const a = h.detail.loadPost('A'), b = h.detail.loadPost('B');
  h.requests[1].resolve(dataFor('B')); await b;
  h.requests[0].resolve(dataFor('A')); await a;
  assert.match(h.root.innerHTML, /Post B/);
  assert.doesNotMatch(h.root.innerHTML, /Post A/);
  const submission = h.submit('comment');
  await new Promise(setImmediate);
  assert.equal(h.writes[0].body.postId, 'B');
  h.requests[2].resolve(dataFor('B')); await submission;
  const answer = h.submit('answer'); await new Promise(setImmediate);
  assert.equal(h.writes[1].body.questionPostId, 'B');
  h.requests[3].resolve(dataFor('B')); await answer;
});

test('stale success, error and session completion cannot reopen a cleared detail', async () => {
  for (const fail of [false, true]) {
    const h = detailHarness();
    const pending = h.detail.loadPost('A'); h.detail.clear();
    if (fail) h.requests[0].reject(new Error('old failure'));
    else h.requests[0].resolve(dataFor('A'));
    await pending;
    assert.match(h.root.innerHTML, /pg-detail-placeholder/);
  }
  const session = deferred();
  const h = detailHarness(() => session.promise);
  const pending = h.detail.loadPost('A'); h.requests[0].resolve(dataFor('A'));
  await Promise.resolve(); h.detail.clear(); session.resolve(null); await pending;
  assert.match(h.root.innerHTML, /pg-detail-placeholder/);
});

test('stale errors cannot replace a reopened post and failed current loads cannot submit', async () => {
  const h = detailHarness();
  const a = h.detail.loadPost('A'); h.detail.clear();
  const b = h.detail.loadPost('B'); h.requests[1].resolve(dataFor('B')); await b;
  h.requests[0].reject(new Error('late error')); await a;
  assert.match(h.root.innerHTML, /Post B/);
  const c = h.detail.loadPost('C');
  await h.submit('comment'); assert.equal(h.writes.length, 0);
  h.requests[2].reject(new Error('current error')); await c;
  assert.match(h.root.innerHTML, /pg-error/);
  await h.submit('answer'); await h.submit('comment');
  assert.equal(h.writes.length, 0);
});

test('submission completion does not reload after navigation or close', async () => {
  for (const kind of ['comment', 'answer']) {
    for (const close of [false, true]) {
      const h = detailHarness(), saved = deferred();
      const a = h.detail.loadPost('A'); h.requests[0].resolve(dataFor('A')); await a;
      h.api.fetchJson = () => saved.promise;
      const submission = h.submit(kind);
      if (close) h.detail.clear();
      else { const b = h.detail.loadPost('B'); h.requests[1].resolve(dataFor('B')); await b; }
      const before = h.requests.length; saved.resolve({}); await new Promise(setImmediate);
      assert.equal(h.requests.length, before);
      await submission;
      assert.match(h.root.innerHTML, close ? /pg-detail-placeholder/ : /Post B/);
    }
  }
});

function detailApi(viewer, visibility, { postType = 'question', status = 'visible' } = {}) {
  const calls = [];
  const row = {
    id: '11111111-1111-4111-8111-111111111111', post_type: postType, status, visibility,
    author_user_id: 'author', display_mode: 'nickname', body: 'private body',
    youtube_video_id: 'abcDEF123_4', profiles: { nickname: 'author' }
  };
  const db = { from(table) {
    calls.push(table);
    const query = {
      select() { return this; }, eq() { return this; }, order() { return this; }, update() { return this; },
      maybeSingle: async () => ({ data: row, error: null }),
      then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); }
    };
    return query;
  } };
  const context = {
    ...policy, json, validateUuid, requireViewer: async () => viewer,
    getSupabaseAdmin: () => db, fetchBadgeMap: async () => ({}), resolvePostAuthorBadges: () => []
  };
  // Evaluate the production handler with infrastructure imports replaced by local fakes.
  vm.runInNewContext(apiSource.replace(/^import .*;\n/gm, '').replace(/export /g, '') + '\nthis.handler = handler;', context);
  return { calls, response: () => context.handler({ httpMethod: 'GET', queryStringParameters: { id: row.id } }) };
}

test('detail API answer permission matrix matches submission policy while retaining private redaction', async () => {
  const expectations = {
    public: [false, true, true, true, true, true],
    expert_only: [false, false, true, true, true, true],
    kali_only: [false, false, false, true, true, true],
    author_only: [false, false, false, true, true, true]
  };
  const roles = [null, 'member', 'expert', 'god', 'admin', 'kali'];
  for (const [visibility, expected] of Object.entries(expectations)) {
    for (const [i, role] of roles.entries()) {
      const viewer = role ? { userId: 'viewer', role } : null;
      const api = detailApi(viewer, visibility), response = await api.response();
      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.viewerCanAnswer, expected[i], `${role}/${visibility}`);
      if (!policy.canReadPostBody({ visibility, authorUserId: 'author' }, viewer)) {
        assert.equal(body.post.body, ''); assert.equal(body.post.youtubeVideoId, null);
        assert.equal(body.post.bodyLocked, true);
        assert.deepEqual(body.answers, []); assert.deepEqual(body.comments, []);
        assert.ok(!api.calls.includes('answers') && !api.calls.includes('comments'));
      }
    }
  }
});

test('detail API and rendered answer forms require visible questions as the answers handler does', async () => {
  const types = ['question', 'event_review', 'review_comment', 'free', 'routine', 'magazine'];
  for (const postType of types) {
    for (const status of ['visible', 'hidden', 'deleted']) {
      for (const role of [null, 'member', 'expert', 'god', 'admin', 'kali']) {
        const viewer = role ? { userId: 'viewer', role } : null;
        const response = await detailApi(viewer, 'public', { postType, status }).response();
        const elevated = role === 'admin' || role === 'kali';
        const label = `${role}/${postType}/${status}`;
        // Existing detail read eligibility remains narrower for non-elevated viewers.
        assert.equal(response.statusCode, status === 'visible' || elevated ? 200 : 404, label);
        if (response.statusCode !== 200) continue;
        const body = JSON.parse(response.body);
        const eligible = Boolean(viewer && postType === 'question' && status === 'visible');
        assert.equal(body.viewerCanAnswer, eligible, label);
        const h = detailHarness(async () => viewer ? { user: { id: viewer.userId } } : null);
        const loading = h.detail.loadPost(body.post.id);
        h.requests[0].resolve(body); await loading;
        assert.equal(h.root.innerHTML.includes('data-answer-form'), eligible, label);
      }
    }
  }
});

test('mobile pages expose a main shell with one h1 and sequential heading levels', () => {
  for (const page of ['index.html', 'lesson.html']) {
    const source = read(page);
    const mobile = source.split('<div class="kx-mobile">')[1].split('<!-- /.kx-mobile -->')[0];
    assert.match(mobile, /^\s*<main class="kx-shell">/);
    assert.match(mobile, /<\/main>\s*<\/div>$/);
    const headings = [...mobile.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    assert.equal(headings[0], 1); assert.equal(headings.filter((h) => h === 1).length, 1);
    for (let i = 1; i < headings.length; i++) assert.ok(headings[i] <= headings[i - 1] + 1, `${page}: ${headings}`);
  }
});

test('actual visitor builder replaces mobile fallback with h3 cards and keeps desktop h4 cards', () => {
  const mobile = { innerHTML: '<h3>fallback</h3>' }, desktop = { innerHTML: '' };
  const context = vm.createContext({ document: { querySelector(selector) {
    if (selector === '[data-slot="visitor-mobile"]') return mobile;
    if (selector === '[data-slot="visitor-desktop"]') return desktop;
    return null;
  } } });
  vm.runInContext(read('content.js'), context);
  const cards = vm.runInContext('CONTENT.visitorCards', context);
  const mobileHeadings = [...mobile.innerHTML.matchAll(/<h([1-6])\b[^>]*>(.*?)<\/h\1>/g)];
  const desktopHeadings = [...desktop.innerHTML.matchAll(/<h([1-6])\b[^>]*>(.*?)<\/h\1>/g)];
  assert.equal(mobileHeadings.length, cards.length);
  assert.equal(desktopHeadings.length, cards.length);
  assert.doesNotMatch(mobile.innerHTML, /fallback/);
  for (const [i, card] of cards.entries()) {
    assert.equal(mobileHeadings[i][1], '3');
    assert.equal(desktopHeadings[i][1], '4');
    assert.equal(mobileHeadings[i][2], card.title);
    assert.equal(desktopHeadings[i][2], card.title);
    assert.match(mobileHeadings[i][0], /style="font-size:17px; font-weight:800; color:#F4E7DA; margin:0 0 8px; line-height:1.4;"/);
    assert.ok(mobile.innerHTML.includes(`href="${card.href}"`));
    assert.ok(mobile.innerHTML.includes(`data-track="${card.track}"`));
  }
});

test('home step 2 uses a brand background meeting small-text contrast', () => {
  const badge = read('index.html').match(/<div class="kx-flip" style="([^"]+)">2<\/div>/)[1];
  const token = badge.match(/background:var\((--[\w-]+)\)/)[1];
  const background = read('style.css').match(new RegExp(`${token}:\\s*(#[a-fA-F0-9]{6})`))[1];
  const foreground = badge.match(/color:(#[a-fA-F0-9]{6})/)[1];
  function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map((c) => parseInt(c, 16) / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  const values = [luminance(background), luminance(foreground)].sort((a, b) => b - a);
  const ratio = (values[0] + 0.05) / (values[1] + 0.05);
  assert.ok(ratio >= 4.5, `contrast ${ratio.toFixed(4)}:1`);
});
