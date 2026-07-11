import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMagazinePublishPayload } from '../../netlify/functions/_lib/validators.mjs';

test('validateMagazinePublishPayload accepts and trims a publish payload', () => {
  assert.deepEqual(validateMagazinePublishPayload({
    sourcePostId: '11111111-1111-4111-8111-111111111111',
    title: '  익명 질문을 위한 매거진  ',
    body: '  원문을 비식별화해 다시 구성한 충분히 긴 본문입니다.  '
  }), {
    sourcePostId: '11111111-1111-4111-8111-111111111111',
    title: '익명 질문을 위한 매거진',
    body: '원문을 비식별화해 다시 구성한 충분히 긴 본문입니다.'
  });
});

test('validateMagazinePublishPayload allows an omitted source post id', () => {
  assert.deepEqual(validateMagazinePublishPayload({
    title: '독립 매거진 글',
    body: '특정 원본 질문 없이 작성한 충분히 긴 매거진 본문입니다.'
  }), {
    sourcePostId: null,
    title: '독립 매거진 글',
    body: '특정 원본 질문 없이 작성한 충분히 긴 매거진 본문입니다.'
  });
});

test('validateMagazinePublishPayload rejects malformed ids and boundary violations', () => {
  assert.throws(() => validateMagazinePublishPayload({
    sourcePostId: 'not-a-uuid',
    title: '유효한 제목',
    body: '열 글자보다 충분히 긴 매거진 본문입니다.'
  }), /invalid source post id/);

  assert.throws(() => validateMagazinePublishPayload({
    title: '두자',
    body: '열 글자보다 충분히 긴 매거진 본문입니다.'
  }), /제목은 3자 이상 120자 이하/);

  assert.throws(() => validateMagazinePublishPayload({
    title: '유효한 제목',
    body: '아홉글자미만'
  }), /내용은 10자 이상 5000자 이하/);

  assert.throws(() => validateMagazinePublishPayload(null), /invalid magazine publish payload/);
});
