import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');

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

test('playground list module has six tabs, prefix filters, table rendering, paging, and free lock copy', () => {
  const source = read('playground-list.js');

  assert.match(source, /PLAYGROUND_TABS/);
  assert.match(source, /전체/);
  assert.match(source, /질문함/);
  assert.match(source, /도구 리뷰/);
  assert.match(source, /모임 후기/);
  assert.match(source, /매거진/);
  assert.match(source, /자유 기록🔒/);
  assert.match(source, /reviewKind: 'tool'/);
  assert.match(source, /reviewKind: 'meeting'/);
  assert.match(source, /PREFIX_FILTERS/);
  assert.match(source, /pg-table/);
  assert.match(source, /hasMore/);
  assert.match(source, /자유 기록은 준비 중입니다\. 질문함과 리뷰가 자리 잡은 뒤 열립니다\./);
});

test('playground compose module includes verbatim guide copy and never submits free or event_review post types', () => {
  const source = read('playground-compose.js');
  const requiredCopy = [
    '어떤 기록을 남길지 먼저 골라주면 됨. 질문, 모임 후기, 도구 리뷰, 자유 기록 중에서 가장 가까운 곳에 남기면 사람들이 더 잘 찾아볼 수 있음.',
    '먼저 게시판을 선택하면 제목 예시가 나타남',
    '남기고 싶은 이야기에 가장 가까운 게시판을 선택하면, 그 글에 맞는 안내가 열림',
    '오늘의 연습, 문득 든 생각, 마술하면서 생긴 작은 이야기를 편하게 남기는 공간임.',
    '작은 기록도 쌓이면 누군가에게 길잡이가 됨.',
    '마술을 배우다 막히는 순간이 있으면 질문을 남기는 공간임. 먼저 지나간 사람이 답을 알고 있을 수 있음.',
    '처음 묻는 질문도 좋음. 누군가에게는 같은 고민을 해결하는 첫 기록이 될 수 있음.',
    '모임에서 느낀 분위기와 기억에 남은 순간을 남기는 공간임. 그날의 기록이 다음 모임을 더 좋게 만듦.',
    '모임 후기는 처음 오는 사람에게 가장 큰 안내서가 됨.',
    '직접 써본 도구와 강의 경험을 남기는 공간임. 좋은 점과 활용 장면을 남기면 다음 사람이 선택하기 쉬워짐.',
    '내가 써본 경험이 누군가에게는 시행착오를 줄여주는 길잡이가 됨.',
    '마술 놀이터에 쌓인 좋은 질문과 답변, 후기와 리뷰를 골라 오래 볼 수 있게 모아두는 공간임.',
    '매거진은 흘러가는 게시판에서 오래 남길 만한 기록을 건져 올리는 공간임.'
  ];

  for (const copy of requiredCopy) {
    assert.equal(source.includes(copy), true, `missing copy: ${copy}`);
  }

  assert.match(source, /question: 'question'/);
  assert.match(source, /tool: 'review_comment'/);
  assert.match(source, /magazine: 'magazine'/);
  assert.doesNotMatch(source, /postType: 'free'/);
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

test('playground bootstrap only wires modules together', () => {
  const source = read('playground.js');

  assert.match(source, /initPlaygroundList/);
  assert.match(source, /initPlaygroundCompose/);
  assert.match(source, /initPlaygroundDetail/);
  assert.doesNotMatch(source, /async function loadQuestions/);
  assert.doesNotMatch(source, /addEventListener\('submit'/);
});
