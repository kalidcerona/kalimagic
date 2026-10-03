import assert from 'node:assert/strict';
import test from 'node:test';
import { STACKS } from '../../zz12/data.mjs';
import { freshState, freshProgress, loadState, replaceStack, applyRecall, duePositions, buildReviewQueue } from '../../zz12/core.mjs';
import { freshMnemonics, starterNumberImage, starterCardImage, starterScene, STARTER_PALACE, buildImageQueue, buildPairQueue, buildPalaceQueue, buildDirectQueue, classifyRecall, enqueueRetry, schedulesRecall, sameText, groupPositions, validateMnemonics, NUMBER_PEGS } from '../../zz12/mnemonic.mjs';

const now = 1_700_000_000_000;
const day = 86400000;

function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

test('version 1 and version 2 backups still load, and new fields round-trip', () => {
  const version1 = {
    version: 1,
    selected: 'mnemonica',
    stacks: { redford: [...STACKS.redford.cards], mnemonica: [...STACKS.mnemonica.cards] },
    progress: {
      redford: { stats: { '2': { attempts: 1, correct: 1, wrong: 0, slow: 0, totalMs: 50 } }, history: [{ at: 10, mode: 'position', total: 1, correct: 1, ms: 50 }] },
      mnemonica: { stats: {}, history: [] },
    },
  };
  const loadedV1 = loadState(JSON.stringify(version1));
  assert.equal(loadedV1.version, 2);
  assert.equal(loadedV1.selected, 'mnemonica');
  assert.equal(loadedV1.progress.redford.stats['2'].correct, 1);
  assert.deepEqual(loadedV1.progress.redford.notes, {});
  assert.deepEqual(loadedV1.progress.redford.mnemonics, freshMnemonics());
  assert.deepEqual(loadedV1.progress.redford.recall, {});

  const legacy = freshState();
  delete legacy.progress.redford.mnemonics;
  delete legacy.progress.redford.recall;
  delete legacy.progress.mnemonica.mnemonics;
  delete legacy.progress.mnemonica.recall;
  legacy.progress.redford.notes['7'] = '별자리';
  legacy.progress.redford.review['7'] = { step: 2, due: 1800000000000 };
  legacy.progress.redford.rankStats.A = { attempts: 1, correct: 1, totalMs: 20 };
  const legacyLoaded = loadState(JSON.stringify(legacy));
  assert.equal(legacyLoaded.progress.redford.notes['7'], '별자리');
  assert.equal(legacyLoaded.progress.redford.review['7'].step, 2);
  assert.equal(legacyLoaded.progress.redford.rankStats.A.correct, 1);
  assert.deepEqual(legacyLoaded.progress.redford.mnemonics, freshMnemonics());

  const state = freshState();
  state.session = { stack: 'redford', mode: 'card', queue: [{ position: 2, direction: 'card' }], index: 0, answered: false, results: [] };
  state.progress.redford.mnemonics = {
    images: { '4': { numberImage: '돛단배', cardImage: '왕비 붉은 심장', scene: '배가 왕비를 태운다' } },
    palace: { title: '학교', loci: [{ name: '정문', position: 4 }] },
    stories: [{ start: 1, end: 3, text: '짧은 이야기' }],
  };
  state.progress.redford.recall['4'] = { directCorrect: 1, directWrong: 0, hinted: 2, revealed: 0 };
  state.progress.mnemonica.notes['3'] = '창가';
  const raw = JSON.stringify(state);
  const round = loadState(raw);
  assert.deepEqual(round.progress.redford.mnemonics, state.progress.redford.mnemonics);
  assert.deepEqual(round.progress.redford.recall['4'], state.progress.redford.recall['4']);
  assert.equal(round.progress.mnemonica.notes['3'], '창가');
  assert.equal(round.session.queue[0].position, 2);
  assert.deepEqual(loadState(JSON.stringify(freshState())).progress.redford.mnemonics, freshMnemonics());
});

test('malformed mnemonic payloads fail closed without changing the original bytes', () => {
  const state = freshState();
  state.progress.redford.notes['1'] = 'keep';
  state.progress.redford.mnemonics.images['99'] = { numberImage: 'x', cardImage: '', scene: '' };
  const raw = JSON.stringify(state);
  assert.throws(() => loadState(raw), /숫자 이미지/);
  assert.equal(JSON.parse(raw).progress.redford.notes['1'], 'keep');

  const recall = freshState();
  recall.progress.mnemonica.recall['3'] = { directCorrect: -1, directWrong: 0, hinted: 0, revealed: 0 };
  assert.throws(() => loadState(JSON.stringify(recall)), /회상 기록/);

  assert.throws(() => validateMnemonics({ images: {}, palace: { title: '집', loci: [{ name: '문', position: 1 }, { name: '창', position: 1 }] }, stories: [] }), /궁전/);
  assert.throws(() => validateMnemonics({ images: {}, palace: null, stories: [{ start: 1, end: 9, text: '길다' }] }), /이야기/);
  assert.throws(() => validateMnemonics({ images: { '1': { numberImage: '가'.repeat(121), cardImage: '', scene: '' } }, palace: null, stories: [] }), /길이/);
  assert.throws(() => groupPositions(1, 9), /8장/);
  assert.equal(groupPositions(1, 8).length, 8);
});

test('mnemonic edits stay on the selected stack and order replacement clears only that stack', () => {
  const state = freshState();
  state.progress.redford.notes['2'] = '호수';
  state.progress.redford.mnemonics.images['2'] = { numberImage: '백조', cardImage: '삽', scene: '호수' };
  state.progress.redford.recall['2'] = { directCorrect: 1, directWrong: 0, hinted: 0, revealed: 0 };
  state.progress.mnemonica.notes['3'] = '창가';
  state.progress.mnemonica.mnemonics.stories.push({ start: 1, end: 2, text: '다른 스택' });
  state.progress.mnemonica.history.push({ at: 11, mode: 'mixed', total: 2, correct: 1, ms: 10 });
  const replaced = replaceStack(state, 'redford', [...STACKS.redford.cards]);
  assert.deepEqual(replaced.progress.redford.mnemonics, freshMnemonics());
  assert.deepEqual(replaced.progress.redford.notes, {});
  assert.deepEqual(replaced.progress.redford.recall, {});
  assert.deepEqual(replaced.progress.redford.history, []);
  assert.equal(replaced.progress.mnemonica.notes['3'], '창가');
  assert.equal(replaced.progress.mnemonica.mnemonics.stories[0].text, '다른 스택');
  assert.equal(replaced.progress.mnemonica.history[0].correct, 1);
  assert.equal(replaced.stacks.mnemonica[0], STACKS.mnemonica.cards[0]);
});

test('direct recall, hints, reveals, and learning passes do not share one counter', () => {
  const progress = freshProgress();
  progress.stats['3'] = { attempts: 2, correct: 1, wrong: 1, slow: 0, totalMs: 10 };
  const hinted = applyRecall(progress, 3, 'hinted', 20, now, true);
  assert.equal(hinted.stats['3'].attempts, 2);
  assert.equal(hinted.stats['3'].correct, 1);
  assert.equal(hinted.recall['3'].hinted, 1);
  assert.equal(hinted.review['3'].step, 0);
  assert.equal(hinted.review['3'].due, now + day);
  assert.equal(progress.stats['3'].attempts, 2);

  const revealed = applyRecall(freshProgress(), 4, 'revealed', 20, now, true);
  assert.equal(revealed.stats['4'], undefined);
  assert.equal(revealed.recall['4'].revealed, 1);
  assert.equal(revealed.review['4'].step, 0);

  const learning = applyRecall(freshProgress(), 5, 'hinted', 20, now, false);
  assert.equal(learning.review['5'], undefined);
  assert.equal(learning.stats['5'], undefined);
  assert.equal(learning.recall['5'].hinted, 1);

  const correct = applyRecall(freshProgress(), 6, 'direct-correct', 4000, now);
  assert.equal(correct.stats['6'].attempts, 1);
  assert.equal(correct.stats['6'].correct, 1);
  assert.equal(correct.stats['6'].wrong, 0);
  assert.equal(correct.recall['6'].directCorrect, 1);
  assert.equal(correct.review['6'].step, 1);
  assert.equal(correct.review['6'].due, now + day);

  const wrong = applyRecall(freshProgress(), 8, 'direct-wrong', 100, now);
  assert.equal(wrong.stats['8'].wrong, 1);
  assert.equal(wrong.stats['8'].correct, 0);
  assert.deepEqual(duePositions(wrong, now), []);
  assert.deepEqual(duePositions(wrong, now + day), [8]);
  const queue = buildReviewQueue(wrong, now + day, () => 0.1);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].position, 8);
  assert.equal(queue[0].stage, 'direct');
  assert.throws(() => buildReviewQueue(freshProgress(), now), /복습할 카드가 없습니다/);

  const early = freshProgress();
  early.review['9'] = { step: 2, due: now + 100000 };
  const kept = applyRecall(early, 9, 'direct-correct', 10, now);
  assert.equal(kept.review['9'].step, 2);
  assert.equal(kept.stats['9'].correct, 1);
});

test('training queues are deterministic, bounded, and distinct from assisted passes', () => {
  assert.equal(NUMBER_PEGS.length, 53);
  assert.equal(starterNumberImage(1), '촛불');
  assert.equal(starterNumberImage(52), '성문');
  assert.match(starterCardImage('10H'), /열 점/);
  assert.match(starterCardImage('10H'), /붉은 심장/);
  assert.match(starterScene(1, 'QH'), /촛불/);
  assert.equal(STARTER_PALACE.loci.length, 5);

  const steady = () => 0.99;
  const images = buildImageQueue([1, 2], steady);
  assert.deepEqual(images.map(item => item.stage), ['scene', 'cue', 'direct', 'scene', 'cue', 'direct']);
  assert.deepEqual(images.map(item => item.position), [1, 1, 1, 2, 2, 2]);
  assert.deepEqual(images.map(item => item.direction), ['position', 'card', 'card', 'position', 'card', 'card']);
  assert.deepEqual(buildImageQueue([1, 2], steady), images);
  assert.equal(buildPairQueue([4], steady)[0].stage, 'pair');
  assert.equal(buildDirectQueue([4], steady)[0].stage, 'direct');
  assert.throws(() => buildPairQueue([], steady), /비어 있습니다/);

  const first = buildPalaceQueue(STARTER_PALACE.loci, mulberry32(3));
  const second = buildPalaceQueue(STARTER_PALACE.loci, mulberry32(3));
  assert.deepEqual(first, second);
  assert.equal(first.length, 5);
  assert.ok(first.every(item => ['position', 'card', 'locus'].includes(item.direction) && item.stage === 'direct'));
  assert.throws(() => buildPalaceQueue([], steady), /장소가 없습니다/);

  assert.equal(classifyRecall({ stage: 'scene', concealed: true, usedHint: false, revealed: false, correct: true }), 'hinted');
  assert.equal(classifyRecall({ stage: 'pair', concealed: false, usedHint: false, revealed: false, correct: true }), 'hinted');
  assert.equal(classifyRecall({ stage: 'pair', concealed: true, usedHint: false, revealed: false, correct: true }), 'direct-correct');
  assert.equal(classifyRecall({ stage: 'direct', concealed: true, usedHint: true, revealed: false, correct: true }), 'hinted');
  assert.equal(classifyRecall({ stage: 'direct', concealed: true, usedHint: false, revealed: false, correct: false }), 'direct-wrong');
  assert.equal(classifyRecall({ stage: 'direct', concealed: true, usedHint: false, revealed: true, correct: true }), 'revealed');
  assert.equal(schedulesRecall('scene'), false);
  assert.equal(schedulesRecall('direct'), true);
  assert.equal(sameText(' 현관문 ', '현관문'), true);

  let queue = [{ position: 1, stage: 'direct', retried: false }];
  queue = enqueueRetry(queue, 0, 'direct-wrong');
  assert.equal(queue.length, 2);
  assert.equal(queue[1].retried, true);
  assert.equal(queue[1].stage, 'direct');
  assert.equal(enqueueRetry(queue, 1, 'hinted').length, 2);
  assert.equal(enqueueRetry([{ position: 1, stage: 'scene', retried: false }], 0, 'hinted').length, 1);
  assert.equal(enqueueRetry([{ position: 1, stage: 'direct', retried: false }], 0, 'direct-correct').length, 1);
});
