import { range, grade, applyRecall, buildReviewQueue } from './core.mjs';
import { STARTER_PALACE, LIMITS, sameText, classifyRecall, enqueueRetry, schedulesRecall, buildPairQueue, buildDirectQueue, buildImageQueue, buildPalaceQueue, validateMnemonics, groupPositions } from './mnemonic.mjs';

// Each app boot owns its context; modules do not retain browser or practice state.
export function createMemoryTraining(ctx) {
  function readAnswer(item) {
    if (item.direction === 'locus')
      return document.querySelector('#locus-answer').value;
    if (item.direction === 'position')
      return document.querySelector('#rank').value + document.querySelector('#suit').value;
    const value = Number(document.querySelector('#number').value);
    return Number.isInteger(value) && value >= 1 && value <= 52 ? value : null;
  }

  function finishAttempt(revealed) {
    if (!ctx.train || ctx.train.phase !== 'quiz' || ctx.train.answered || ctx.train.lock)
      return;
    const item = ctx.train.queue[ctx.train.index];
    let correct = false;
    if (!revealed) {
      const answer = readAnswer(item);
      if (answer == null) {
        ctx.message('1-52 사이의 번호를 입력하세요.');
        return;
      }
      correct = item.direction === 'locus' ? sameText(answer, item.locus) : grade(ctx.cards(), {
        position: item.position,
        direction: item.direction
      }, answer);
    }
    const outcome = classifyRecall({
      stage: item.stage,
      concealed: ctx.train.concealed,
      usedHint: ctx.train.usedHint,
      revealed: revealed,
      correct: correct
    });
    const candidate = structuredClone(ctx.state);
    try {
      candidate.progress[ctx.state.selected] = applyRecall(ctx.progress(), item.position, outcome, Math.max(0, Math.round(performance.now() - ctx.questionStart)), Date.now(), schedulesRecall(item.stage));
    } catch (error) {
      ctx.message(error.message);
      return;
    }
    ctx.train.lock = true;
    if (!ctx.commitMemory(candidate)) {
      ctx.train.lock = false;
      return;
    }
    ctx.train.answered = true;
    ctx.train.lastCorrect = correct;
    ctx.train.lastOutcome = outcome;
    ctx.train.results.push({
      outcome: outcome,
      correct: correct
    });
    ctx.train.queue = enqueueRetry(ctx.train.queue, ctx.train.index, outcome);
    ctx.train.lock = false;
    ctx.renderMemory();
    ctx.message(ctx.outcomeText(outcome, correct, item));
  }

  function nextDrill() {
    if (!ctx.train?.answered)
      return;
    if (ctx.train.index + 1 >= ctx.train.queue.length) {
      finishTrain();
      return;
    }
    ctx.train.index++;
    ctx.train.answered = false;
    ctx.train.usedHint = false;
    ctx.train.concealed = ctx.train.queue[ctx.train.index].stage === 'direct' || ctx.train.queue[ctx.train.index].stage === 'cue';
    ctx.questionStart = performance.now();
    ctx.renderMemory();
  }

  function finishTrain() {
    const results = ctx.train?.results || [];
    const count = name => results.filter(item => item.outcome === name).length;
    ctx.train = null;
    ctx.renderMemory();
    ctx.message(results.length ? `직접 맞춤 ${ count('direct-correct') } · 직접 오답 ${ count('direct-wrong') } · 단서 ${ count('hinted') } · 답 보기 ${ count('revealed') }` : '연습을 마쳤습니다.');
  }

  function openTrain(mode, queue, story = '') {
    const first = queue[0];
    ctx.train = {
      mode: mode,
      phase: 'quiz',
      queue: queue,
      index: 0,
      answered: false,
      concealed: first.stage === 'direct' || first.stage === 'cue',
      usedHint: false,
      results: [],
      lock: false,
      story: story,
      loci: []
    };
    ctx.questionStart = performance.now();
    ctx.renderMemory();
  }

  function beginRanged(mode) {
    try {
      const [start, end] = ctx.memoryRangeValues();
      const limit = mode === 'story' ? LIMITS.group : 13;
      if (end - start + 1 > limit)
        throw new Error(mode === 'story' ? '이야기는 한 번에 8장까지입니다.' : '한 번에 13장까지입니다. 긴 범위는 퀴즈를 쓰세요.');
      ctx.memoryStart = start;
      ctx.memoryEnd = end;
      const positions = range(start, end);
      if (mode === 'pair') {
        openTrain(mode, buildPairQueue(positions));
        return;
      }
      if (mode === 'image') {
        openTrain(mode, buildImageQueue(positions));
        return;
      }
      const text = document.querySelector('#story-text').value;
      groupPositions(start, end);
      if (text.length > LIMITS.story)
        throw new Error('이야기가 너무 깁니다.');
      ctx.storyDraft = {
        start: start,
        end: end,
        text: text
      };
      openTrain(mode, buildDirectQueue(positions), text);
    } catch (error) {
      ctx.message(error.message);
    }
  }

  function beginReview() {
    try {
      openTrain('review', buildReviewQueue(ctx.progress()));
    } catch (error) {
      ctx.message(error.message);
    }
  }

  function usablePalace(raw) {
    const loci = raw.loci.map(locus => ({
      name: locus.name.trim(),
      position: locus.position
    })).filter(locus => locus.name);
    if (!loci.length && raw.loci.length)
      throw new Error('장소 이름을 입력하세요.');
    const title = (raw.title || '').trim() || STARTER_PALACE.title;
    const chosen = loci.length ? loci : STARTER_PALACE.loci.map(locus => ({ ...locus }));
    validateMnemonics({
      images: {},
      palace: {
        title: title,
        loci: chosen
      },
      stories: []
    });
    return chosen;
  }

  function beginPalace(phase) {
    try {
      const loci = ctx.train?.phase === 'walk' && phase === 'quiz' ? ctx.train.loci.map(locus => ({ ...locus })) : usablePalace(ctx.readPalaceRaw());
      if (phase === 'walk') {
        ctx.train = {
          mode: 'palace',
          phase: 'walk',
          loci: loci,
          index: 0,
          concealed: false,
          results: [],
          queue: [],
          lock: false,
          answered: false,
          story: '',
          usedHint: false
        };
        ctx.renderMemory();
        return;
      }
      ctx.train = {
        mode: 'palace',
        phase: 'quiz',
        queue: buildPalaceQueue(loci),
        index: 0,
        answered: false,
        concealed: true,
        usedHint: false,
        results: [],
        lock: false,
        story: '',
        loci: loci
      };
      ctx.questionStart = performance.now();
      ctx.renderMemory();
    } catch (error) {
      ctx.message(error.message);
    }
  }

  return { readAnswer, finishAttempt, nextDrill, finishTrain, openTrain, beginRanged, beginReview, usablePalace, beginPalace };
}
