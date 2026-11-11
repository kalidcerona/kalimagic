import { RANKS, SUITS, label } from './data.mjs';
import { range, duePositions, escapeHTML } from './core.mjs';
import { STARTER_PALACE, LIMITS, starterNumberImage, starterCardImage, starterScene, starterStory } from './mnemonic.mjs';

// Each app boot owns its context; modules do not retain browser or practice state.
export function createMemory(ctx) {
  function outcomeText(outcome, correct, item) {
    const name = label(ctx.cards()[item.position - 1]);
    const fact = item.direction === 'locus' ? `${ name }의 장소는 ${ item.locus }` : `${ name }는 ${ item.position }번`;
    if (outcome === 'direct-correct')
      return `직접 맞췄습니다. ${ fact }. 복습 간격에 반영합니다.`;
    if (outcome === 'direct-wrong')
      return `직접 오답입니다. ${ fact }. 복습으로 돌아갑니다.`;
    if (outcome === 'revealed')
      return `답을 열었습니다. ${ fact }. 맞춘 기록에 넣지 않습니다.`;
    return `${ correct ? '답은 맞습니다.' : '답은 틀렸습니다.' } ${ fact }. 단서가 있어 맞춘 기록에 넣지 않습니다.`;
  }

  function promptBlock(item) {
    const card = ctx.cards()[item.position - 1];
    if (ctx.train.answered)
      return `<span class="big">${ ctx.cardHTML(card) }</span><span class="caption">${ item.position }번${ item.locus ? ` · ${ escapeHTML(item.locus) }` : '' }</span>`;
    if (item.stage === 'pair' && !ctx.train.concealed)
      return `<span class="big">${ ctx.cardHTML(card) }</span><span class="caption">${ item.position }번과 같이 보기</span>`;
    if (item.locus && item.direction === 'locus')
      return `<span class="big">${ ctx.cardHTML(card) }</span><span class="caption">이 카드의 장소</span>`;
    if (item.locus)
      return `<span class="locus-title">${ escapeHTML(item.locus) }</span><span class="caption">${ item.direction === 'position' ? '이 장소의 카드' : '이 장소의 번호' }</span>`;
    if (item.direction === 'card')
      return `<span class="big">${ ctx.cardHTML(card) }</span><span class="caption">몇 번일까요?</span>`;
    return `<span class="big">${ item.position }</span><span class="caption">번째 카드</span>`;
  }

  function cueBlock(item) {
    if (item.stage === 'scene' && !ctx.train.concealed && !ctx.train.answered)
      return `<p class="association">${ escapeHTML(ctx.sceneText(item.position)) }</p>`;
    if (!ctx.train.usedHint || ctx.train.answered)
      return '';
    if (ctx.train.mode === 'story')
      return `<p class="association">${ escapeHTML(ctx.train.story || '이야기가 비어 있습니다.') }</p>`;
    if (ctx.train.mode === 'palace' && item.direction === 'position')
      return `<p class="association">${ escapeHTML(ctx.numberImageFor(item.position)) }</p>`;
    if (ctx.train.mode === 'palace' && item.direction === 'card')
      return `<p class="association">${ escapeHTML(ctx.cardImageFor(item.position)) }</p>`;
    return `<p class="association">${ escapeHTML(ctx.numberImageFor(item.position)) }<br>${ escapeHTML(ctx.cardImageFor(item.position)) }</p>`;
  }

  function answerControls(item) {
    if (ctx.train.answered) {
      const wrong = ctx.train.lastOutcome === 'direct-wrong' || ctx.train.lastOutcome === 'hinted' && ctx.train.lastCorrect === false;
      return `<div class="feedback ${ wrong ? 'error' : '' }" role="status">${ escapeHTML(outcomeText(ctx.train.lastOutcome, ctx.train.lastCorrect, item)) }</div><div class="train-actions"><button type="button" id="next-drill" class="primary">다음</button></div>`;
    }
    const fields = item.direction === 'locus' ? `<label>장소<input id="locus-answer" autocomplete="off" maxlength="${ LIMITS.locus }"></label>` : item.direction === 'position' ? `<label>숫자·그림<select id="rank" aria-label="숫자·그림">${ RANKS.map(rank => `<option>${ rank }</option>`).join('') }</select></label><label>무늬<select id="suit" aria-label="무늬">${ Object.entries(SUITS).map(([value, symbol]) => `<option value="${ value }">${ symbol }</option>`).join('') }</select></label>` : `<label>번호<input id="number" inputmode="numeric" type="number" min="1" max="52" required autocomplete="off"></label>`;
    return `<form id="answer-form"><div class="quiz-answer">${ fields }</div><div class="train-actions"><button type="button" id="conceal">숨기기</button><button type="button" id="cue">단서</button><button type="submit" class="primary" id="check-answer">확인</button><button type="button" id="reveal-answer">답 보기</button></div></form>`;
  }

  function pairSetup() {
    return `<section class="panel"><p class="subtle">카드와 번호를 같이 봅니다.<br>한 쪽을 숨긴 뒤 확인하세요.</p>${ ctx.memRangeHTML() }<div class="train-actions"><button type="button" id="start-pair" class="primary">시작</button></div><details><summary>안내</summary><p class="subtle">숨긴 뒤 맞춘 것만 직접 회상입니다.<br>단서와 답 보기는 정답률에 넣지 않습니다.</p></details></section>`;
  }

  function imageSetup() {
    const positions = range(ctx.memoryStart, ctx.memoryEnd);
    if (!positions.includes(ctx.imagePos))
      ctx.imagePos = positions[0];
    const fields = ctx.imageFields(ctx.imagePos), card = ctx.cards()[ctx.imagePos - 1];
    return `<section class="panel"><p class="subtle">번호 그림, 카드 그림, 장면을 이 자리에 저장합니다.<br>연습은 장면, 단서, 직접 순서로 묻습니다.</p>${ ctx.memRangeHTML() }<div class="practice-card compact"><span class="big">${ ctx.cardHTML(card) }</span><span class="caption">${ ctx.imagePos }번</span></div><label>위치<select id="image-pos">${ positions.map(position => `<option value="${ position }">${ position }번 ${ label(ctx.cards()[position - 1]) }</option>`).join('') }</select></label><label>번호 그림<input id="num-image" maxlength="${ LIMITS.image }" placeholder="${ escapeHTML(starterNumberImage(ctx.imagePos)) }" value="${ escapeHTML(fields.numberImage) }"></label><label>카드 그림<input id="card-image" maxlength="${ LIMITS.image }" placeholder="${ escapeHTML(starterCardImage(card)) }" value="${ escapeHTML(fields.cardImage) }"></label><label>연결 장면<textarea id="scene-text" maxlength="${ LIMITS.scene }" placeholder="${ escapeHTML(starterScene(ctx.imagePos, card)) }">${ escapeHTML(fields.scene) }</textarea></label><div class="train-actions"><button type="button" id="save-image" class="primary">저장</button><button type="button" id="start-image">시작</button></div><details><summary>안내</summary><p class="subtle">비어 있으면 기본 그림이 연습에 쓰입니다.<br>저장한 내용은 이 스택의 이 번호에만 남습니다.<br>순서를 바꾸면 이 스택의 장면은 지워집니다.</p></details></section>`;
  }

  function palaceSetup() {
    const model = ctx.palaceModel();
    return `<section class="panel"><p class="subtle">익숙한 장소에 그 번호의 카드를 둡니다.<br>예시 다섯 곳으로 바로 걸을 수 있습니다.</p><label>궁전 이름<input id="palace-title" maxlength="${ LIMITS.title }" value="${ escapeHTML(model.title) }"></label>${ model.example ? '<p class="hint">지금 보이는 장소는 예시입니다.<br>저장 전에도 연습할 수 있습니다.</p>' : '' }<div class="locus-list">${ model.loci.map((locus, index) => `<div class="locus-row"><input class="locus-name" aria-label="장소 ${ index + 1 }" maxlength="${ LIMITS.locus }" value="${ escapeHTML(locus.name) }"><input class="locus-pos" aria-label="번호 ${ index + 1 }" type="number" min="1" max="52" value="${ locus.position }"><button type="button" class="locus-del" data-del="${ index }">삭제</button></div>`).join('') }</div><div class="train-actions"><button type="button" id="add-locus">장소 추가</button><button type="button" id="palace-example">예시</button><button type="button" id="save-palace" class="primary">저장</button></div><div class="train-actions"><button type="button" id="start-walk">걷기</button><button type="button" id="start-palace" class="primary">문제</button></div><details><summary>안내</summary><p class="subtle">문제는 장소, 번호, 카드를 섞어 묻습니다.<br>순서대로 걷지 않아도 답할 수 있습니다.<br>장소 이름은 글자를 비교해 채점합니다.</p></details></section>`;
  }

  function storySetup() {
    let text = '', note = '';
    try {
      text = ctx.storyTextFor(ctx.memoryStart, ctx.memoryEnd);
    } catch (error) {
      note = error.message;
    }
    let line = '';
    try {
      line = range(ctx.memoryStart, ctx.memoryEnd).map(position => `<span>${ position } ${ ctx.cardHTML(ctx.cards()[position - 1]) }</span>`).join('');
    } catch {
      line = '';
    }
    const saved = ctx.pack().stories.map((story, index) => `<button type="button" data-story="${ index }">${ story.start }-${ story.end }</button>`).join('');
    const hasSaved = ctx.pack().stories.some(story => story.start === ctx.memoryStart && story.end === ctx.memoryEnd);
    return `<section class="panel"><p class="subtle">이 범위의 실제 순서로 짧은 이야기를 만듭니다.<br>익힌 뒤 카드와 번호를 따로 묻습니다.</p>${ ctx.memRangeHTML() }<div class="order-line">${ line }</div>${ note ? `<p class="hint">${ escapeHTML(note) }</p>` : '' }<label>이야기<textarea id="story-text" maxlength="${ LIMITS.story }">${ escapeHTML(text) }</textarea></label><div class="train-actions"><button type="button" id="save-story" class="primary">저장</button><button type="button" id="story-example">예시</button><button type="button" id="start-story">시작</button>${ hasSaved ? '<button type="button" id="delete-story">삭제</button>' : '' }</div>${ saved ? `<div class="saved-stories">${ saved }</div>` : '' }<details><summary>안내</summary><p class="subtle">이야기는 이 스택에만 저장됩니다.<br>한 묶음은 8장까지입니다.<br>단서를 보면 맞춘 기록에 넣지 않습니다.</p></details></section>`;
  }

  function reviewSetup() {
    const due = duePositions(ctx.progress());
    const recall = Object.values(ctx.progress().recall || {}).reduce((sum, item) => ({
      direct: sum.direct + item.directCorrect,
      hinted: sum.hinted + item.hinted,
      revealed: sum.revealed + item.revealed,
      wrong: sum.wrong + item.directWrong
    }), {
      direct: 0,
      hinted: 0,
      revealed: 0,
      wrong: 0
    });
    return `<section class="panel"><p class="subtle">간격은 1·3·7·14·30일입니다.<br>오답과 단서는 1일로 돌아갑니다.</p><p class="hint">오늘 복습 ${ due.length }장.<br>직접 ${ recall.direct } · 오답 ${ recall.wrong } · 단서 ${ recall.hinted } · 답 보기 ${ recall.revealed }</p><div class="train-actions"><button type="button" id="start-review" class="primary" ${ due.length ? '' : 'disabled' }>시작</button></div><details><summary>안내</summary><p class="subtle">기한 전 정답은 간격을 올리지 않습니다.<br>답을 연 경우는 맞춘 기록에 넣지 않습니다.<br>가장 빠른 방법이라고 보장하지 않습니다.</p></details></section>`;
  }

  function walkView() {
    const locus = ctx.train.loci[ctx.train.index], card = ctx.cards()[locus.position - 1];
    return `<section class="panel"><div class="spread"><span class="pill">${ ctx.train.index + 1 } / ${ ctx.train.loci.length }</span><button type="button" id="end-drill">종료</button></div><div class="practice-card"><span class="locus-title">${ escapeHTML(locus.name) }</span><span class="caption">${ ctx.train.concealed ? '카드와 번호를 가렸습니다' : `${ locus.position }번` }</span></div>${ ctx.train.concealed ? '' : `<p class="association">${ ctx.cardHTML(card) } = ${ locus.position }번<br>${ escapeHTML(ctx.sceneText(locus.position)) }</p>` }<div class="train-actions"><button type="button" id="walk-prev">이전</button><button type="button" id="conceal">숨기기</button><button type="button" id="walk-next" class="primary">다음</button><button type="button" id="start-palace">문제</button></div></section>`;
  }

  function trainView() {
    if (ctx.train.phase === 'walk')
      return walkView();
    const item = ctx.train.queue[ctx.train.index];
    return `<section class="panel"><div class="spread"><span class="pill">${ ctx.train.index + 1 } / ${ ctx.train.queue.length } · ${ ctx.stageName(item.stage) }</span><button type="button" id="end-drill">종료</button></div><div class="practice-card">${ promptBlock(item) }</div>${ cueBlock(item) }${ answerControls(item) }<p class="hint">직접 회상만 정답률에 들어갑니다.</p></section>`;
  }

  function renderMemory() {
    ctx.message('');
    const modes = [
      [
        'pair',
        '1 짝맞추기'
      ],
      [
        'image',
        '2 숫자그림'
      ],
      [
        'palace',
        '3 궁전'
      ],
      [
        'story',
        '4 이야기'
      ],
      [
        'review',
        '5 복습'
      ]
    ];
    const body = ctx.train && ctx.train.mode === ctx.trainMode ? trainView() : ctx.trainMode === 'image' ? imageSetup() : ctx.trainMode === 'palace' ? palaceSetup() : ctx.trainMode === 'story' ? storySetup() : ctx.trainMode === 'review' ? reviewSetup() : pairSetup();
    ctx.main.innerHTML = `<div class="learn">${ ctx.header('기억 훈련', '고른 스택의 실제 순서로 연습합니다.') }<div class="mode-switch">${ modes.map(([id, name]) => `<button type="button" data-train="${ id }" class="${ ctx.trainMode === id ? 'selected' : '' }" aria-pressed="${ ctx.trainMode === id }">${ name }</button>`).join('') }</div>${ body }</div>`;
    document.querySelectorAll('[data-train]').forEach(button => button.onclick = () => {
      const next = button.dataset.train;
      if (ctx.train && ctx.train.mode !== next)
        ctx.train = null;
      ctx.trainMode = next;
      renderMemory();
    });
    const apply = document.querySelector('#mem-apply');
    if (apply)
      apply.onclick = () => {
        try {
          const [start, end] = ctx.memoryRangeValues();
          if (ctx.trainMode === 'story' && end - start + 1 > LIMITS.group)
            throw new Error('이야기는 한 번에 8장까지입니다.');
          if (ctx.trainMode !== 'story' && end - start + 1 > 13)
            throw new Error('한 번에 13장까지입니다. 긴 범위는 퀴즈를 쓰세요.');
          ctx.memoryStart = start;
          ctx.memoryEnd = end;
          if (ctx.imagePos < ctx.memoryStart || ctx.imagePos > ctx.memoryEnd)
            ctx.imagePos = ctx.memoryStart;
          ctx.storyDraft = null;
          renderMemory();
        } catch (error) {
          ctx.message(error.message);
        }
      };
    const imageSelect = document.querySelector('#image-pos');
    if (imageSelect) {
      imageSelect.value = String(ctx.imagePos);
      imageSelect.onchange = () => {
        ctx.imageDrafts.set(ctx.imagePos, {
          numberImage: document.querySelector('#num-image').value,
          cardImage: document.querySelector('#card-image').value,
          scene: document.querySelector('#scene-text').value
        });
        ctx.imagePos = Number(imageSelect.value);
        renderMemory();
      };
    }
    const saveImageButton = document.querySelector('#save-image');
    if (saveImageButton)
      saveImageButton.onclick = ctx.saveImage;
    const startPair = document.querySelector('#start-pair');
    if (startPair)
      startPair.onclick = () => ctx.beginRanged('pair');
    const startImage = document.querySelector('#start-image');
    if (startImage)
      startImage.onclick = () => ctx.beginRanged('image');
    const startStory = document.querySelector('#start-story');
    if (startStory)
      startStory.onclick = () => ctx.beginRanged('story');
    const startReview = document.querySelector('#start-review');
    if (startReview)
      startReview.onclick = ctx.beginReview;
    const saveStoryButton = document.querySelector('#save-story');
    if (saveStoryButton)
      saveStoryButton.onclick = ctx.saveStory;
    const deleteStoryButton = document.querySelector('#delete-story');
    if (deleteStoryButton)
      deleteStoryButton.onclick = ctx.deleteStory;
    const storyExample = document.querySelector('#story-example');
    if (storyExample)
      storyExample.onclick = () => {
        try {
          const [start, end] = ctx.memoryRangeValues();
          ctx.memoryStart = start;
          ctx.memoryEnd = end;
          ctx.storyDraft = {
            start: start,
            end: end,
            text: starterStory(ctx.cards(), start, end)
          };
          renderMemory();
        } catch (error) {
          ctx.message(error.message);
        }
      };
    document.querySelectorAll('[data-story]').forEach(button => button.onclick = () => {
      const story = ctx.pack().stories[Number(button.dataset.story)];
      if (!story)
        return;
      ctx.memoryStart = story.start;
      ctx.memoryEnd = story.end;
      ctx.storyDraft = {
        start: story.start,
        end: story.end,
        text: story.text
      };
      renderMemory();
    });
    const addLocus = document.querySelector('#add-locus');
    if (addLocus)
      addLocus.onclick = () => {
        const draft = ctx.readPalaceRaw();
        if (draft.loci.length >= LIMITS.loci) {
          ctx.message('장소는 52개까지입니다.');
          return;
        }
        const used = new Set(draft.loci.map(locus => locus.position));
        let position = 1;
        while (used.has(position) && position <= 52)
          position++;
        draft.loci.push({
          name: '',
          position: Math.min(position, 52)
        });
        ctx.palaceDraft = draft;
        renderMemory();
      };
    const palaceExample = document.querySelector('#palace-example');
    if (palaceExample)
      palaceExample.onclick = () => {
        ctx.palaceDraft = {
          title: STARTER_PALACE.title,
          loci: STARTER_PALACE.loci.map(locus => ({ ...locus })),
          example: true
        };
        renderMemory();
      };
    const savePalaceButton = document.querySelector('#save-palace');
    if (savePalaceButton)
      savePalaceButton.onclick = ctx.savePalace;
    document.querySelectorAll('.locus-del').forEach(button => button.onclick = () => {
      const draft = ctx.readPalaceRaw();
      draft.loci.splice(Number(button.dataset.del), 1);
      ctx.palaceDraft = draft;
      renderMemory();
    });
    const startWalk = document.querySelector('#start-walk');
    if (startWalk)
      startWalk.onclick = () => ctx.beginPalace('walk');
    const startPalace = document.querySelector('#start-palace');
    if (startPalace)
      startPalace.onclick = () => ctx.beginPalace('quiz');
    const endDrill = document.querySelector('#end-drill');
    if (endDrill)
      endDrill.onclick = ctx.finishTrain;
    const conceal = document.querySelector('#conceal');
    if (conceal)
      conceal.onclick = () => {
        ctx.train.concealed = !ctx.train.concealed;
        renderMemory();
      };
    const cue = document.querySelector('#cue');
    if (cue)
      cue.onclick = () => {
        ctx.train.usedHint = true;
        renderMemory();
      };
    const reveal = document.querySelector('#reveal-answer');
    if (reveal)
      reveal.onclick = () => ctx.finishAttempt(true);
    const form = document.querySelector('#answer-form');
    if (form)
      form.onsubmit = event => {
        event.preventDefault();
        ctx.finishAttempt(false);
      };
    const next = document.querySelector('#next-drill');
    if (next)
      next.onclick = ctx.nextDrill;
    const walkPrev = document.querySelector('#walk-prev');
    if (walkPrev)
      walkPrev.onclick = () => {
        ctx.train.index = (ctx.train.index - 1 + ctx.train.loci.length) % ctx.train.loci.length;
        ctx.train.concealed = false;
        renderMemory();
      };
    const walkNext = document.querySelector('#walk-next');
    if (walkNext)
      walkNext.onclick = () => {
        ctx.train.index = (ctx.train.index + 1) % ctx.train.loci.length;
        ctx.train.concealed = false;
        renderMemory();
      };
  }

  return { outcomeText, promptBlock, cueBlock, answerControls, pairSetup, imageSetup, palaceSetup, storySetup, reviewSetup, walkView, trainView, renderMemory };
}
