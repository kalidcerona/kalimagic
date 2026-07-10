import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function assertInOrder(source, snippets, message) {
  const indexes = snippets.map((snippet) => source.indexOf(snippet));
  assert.equal(indexes.every((index) => index >= 0), true, `${message}: missing snippet`);
  assert.deepEqual(indexes, indexes.slice().sort((a, b) => a - b), message);
}

test('playground front modules exist and html loads them in dependency order', () => {
  const files = [
    'playground-api.js',
    'playground-list.js',
    'playground-compose.js',
    'playground-detail.js'
  ];

  for (const file of files) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} should exist`);
  }

  const html = read('playground.html');
  const order = [
    'auth.js',
    'playground-api.js',
    'playground-list.js',
    'playground-compose.js',
    'playground-detail.js',
    'playground.js'
  ].map((script) => html.indexOf(`src="${script}"`));

  assert.deepEqual(
    order,
    order.slice().sort((a, b) => a - b),
    'script order should be auth, api, list, compose, detail, bootstrap'
  );
  assert.equal(order.every((index) => index > -1), true);
});

test('playground api module wraps the v2 endpoints with auth headers', () => {
  const source = read('playground-api.js');

  assert.match(source, /function fetchJson/);
  assert.match(source, /Authorization/);
  assert.match(source, /Bearer/);
  assert.match(source, /\/\.netlify\/functions\/posts\?/);
  assert.match(source, /\/\.netlify\/functions\/post-detail\?id=/);
  assert.match(source, /\/\.netlify\/functions\/post-likes/);
  assert.match(source, /method: 'DELETE'/);
  assert.match(source, /createPost/);
});

test('playground list module has seven tabs, table rendering, paging, and free board copy', () => {
  const source = read('playground-list.js');

  assert.match(source, /PLAYGROUND_TABS/);
  assertInOrder(source, [
    "{ id: 'all', label: '전체 기록', category: 'all', reviewKind: null }",
    "{ id: 'free', label: '자유게시판', category: 'free', reviewKind: null }",
    "{ id: 'routine', label: '마술 보관소', category: 'routine', reviewKind: null }",
    "{ id: 'question', label: '질문함', category: 'question', reviewKind: null }",
    "{ id: 'review_tool', label: '도구 기록', category: 'review', reviewKind: 'tool' }",
    "{ id: 'review_meeting', label: '모임 기록', category: 'review', reviewKind: 'meeting' }",
    "{ id: 'magazine', label: '보관된 기록', category: 'magazine', reviewKind: null }"
  ], 'playground tabs should follow the requested board order');
  assert.match(source, /전체/);
  assert.match(source, /질문함/);
  assert.match(source, /마술 보관소/);
  assert.match(source, /도구 기록/);
  assert.match(source, /모임 기록/);
  assert.match(source, /매거진/);
  assert.match(source, /자유게시판/);
  assert.match(source, /reviewKind: 'tool'/);
  assert.match(source, /reviewKind: 'meeting'/);
  assert.match(source, /pg-table/);
  assert.match(source, /hasMore/);
  assert.match(source, /자유로운 마술 이야기를 기다리고 있습니다\./);
  assert.match(source, /배운 마술 루틴과 기술을 보관할 첫 기록을 기다리고 있습니다\./);
});

test('playground html fallback tabs put 전체 기록 first', () => {
  const html = read('playground.html');

  assertInOrder(html, [
    '<button type="button" data-category="all" class="is-active">전체 기록</button>',
    '<button type="button" data-category="free">자유게시판</button>',
    '<button type="button" data-category="routine">마술 보관소</button>',
    '<button type="button" data-category="question">질문함</button>',
    '<button type="button" data-category="review">도구 기록</button>',
    '<button type="button" data-category="event_review">모임 기록</button>',
    '<button type="button" data-category="magazine">보관된 기록</button>'
  ], 'static fallback tabs should follow the requested board order');
});

test('playground list module catches list load failures and renders a friendly error', () => {
  const source = read('playground-list.js');

  assert.match(source, /error:\s*false/);
  assert.match(source, /state\.error\s*=\s*true/);
  assert.match(source, /catch\s*(?:\([^)]*\)\s*)?\{/);
  assert.match(source, /pg-error/);
  assert.match(source, /기록을 불러오지 못했습니다\. 잠시 후 다시 시도해주세요\./);
});

test('playground compose module includes verbatim guide copy and keeps event reviews on the dedicated api', () => {
  const source = read('playground-compose.js');
  const requiredCopy = [
    '어떤 기록을 남길지 먼저 골라주면 됨. 자유게시판, 마술 보관소, 질문함, 도구 기록, 모임 기록, 보관된 기록 중에서 가장 가까운 곳에 남기면 사람들이 더 잘 찾아볼 수 있음.',
    '먼저 게시판을 선택하면 제목 예시가 나타남',
    '남기고 싶은 이야기에 가장 가까운 게시판을 선택하면, 그 글에 맞는 안내가 열림',
    '자유 주제로 마술 문화와 연습, 공연, 사람들 이야기를 편하게 남기는 공간임.',
    '자유로운 이야기도 쌓이면 누군가에게 길잡이가 됨.',
    '내가 배운 마술 루틴과 기술을 제목과 내용으로 정리해두는 공간임.',
    '개인 연습 기록도 쌓이면 나중에 다시 꺼내 볼 수 있는 보관소가 됨.',
    '마술을 배우다 막히는 순간이 있으면 질문을 남기는 공간임. 먼저 지나간 사람이 답을 알고 있을 수 있음.',
    '처음 묻는 질문도 좋음. 누군가에게는 같은 고민을 해결하는 첫 기록이 될 수 있음.',
    '모임에서 느낀 분위기와 기억에 남은 순간을 남기는 공간임. 그날의 기록이 다음 모임을 더 좋게 만듦.',
    '모임 후기는 처음 오는 사람에게 가장 큰 안내서가 됨.',
    '직접 써본 도구와 강의 경험을 남기는 공간임. 좋은 점과 활용 장면을 남기면 다음 사람이 선택하기 쉬워짐.',
    '내가 써본 경험이 누군가에게는 시행착오를 줄여주는 길잡이가 됨.',
    '마술문화 기록소에 쌓인 좋은 질문과 답변, 후기와 리뷰를 골라 오래 볼 수 있게 모아두는 공간임.',
    '매거진은 흘러가는 게시판에서 오래 남길 만한 기록을 건져 올리는 공간임.'
  ];

  for (const copy of requiredCopy) {
    assert.equal(source.includes(copy), true, `missing copy: ${copy}`);
  }

  assertInOrder(source, [
    "['all', '게시판 선택']",
    "['free', '자유게시판']",
    "['routine', '마술 보관소']",
    "['question', '질문함']",
    "['tool', '도구 기록']",
    "['meeting', '모임 기록']",
    "['magazine', '보관된 기록']"
  ], 'compose dropdown should follow the requested writable board order');
  assert.match(source, /question: 'question'/);
  assert.match(source, /tool: 'review_comment'/);
  assert.match(source, /free: 'free'/);
  assert.match(source, /routine: 'routine'/);
  assert.match(source, /magazine: 'magazine'/);
  assert.doesNotMatch(source, /postType: 'event_review'/);
});

test('playground detail module renders counts, like toggle, owner delete, and hidden private counts', () => {
  const source = read('playground-detail.js');

  assert.match(source, /togglePostLike/);
  assert.match(source, /deletePost/);
  assert.match(source, /viewerLiked/);
  assert.match(source, /canDelete/);
  assert.match(source, /답변이 달린 질문은 삭제할 수 없어요/);
  assert.match(source, /return '-'/);
});

test('playground bootstrap wires list, auth slot, and write links', () => {
  const source = read('playground.js');

  assert.match(source, /initPlaygroundList/);
  assert.match(source, /data-auth-slot/);
  assert.match(source, /data-write-link/);
  assert.match(source, /data-mobile-write/);
  assert.match(source, /admin-inbox/);
  assert.doesNotMatch(source, /initPlaygroundCompose/);
  assert.doesNotMatch(source, /initPlaygroundDetail/);
  assert.doesNotMatch(source, /async function loadQuestions/);
  assert.doesNotMatch(source, /addEventListener\('submit'/);
});
