import { STACKS, RANKS, SUITS } from './data.mjs';
import { range, newSession, grade, record, weakPositions, scheduleReview } from './core.mjs';

// Each app boot owns its context; modules do not retain browser or practice state.
export function createQuiz(ctx) {
  function renderQuiz() {
    const session = ctx.state.session;
    if (session && session.mode !== 'rank' && session.stack === ctx.state.selected) {
      renderQuestion();
      return;
    }
    ctx.main.innerHTML = `<div class="workspace"><section class="panel">${ ctx.header('기억을 꺼내는 연습', '순서대로 외운 카드를 무작위 질문으로 다시 만나보세요.') }${ ctx.rangeHTML() }<div class="controls"><label>질문 방식<select id="mode" aria-label="질문 방식"><option value="position">번호 → 카드</option><option value="card">카드 → 번호</option><option value="mixed">두 방향 섞기</option></select></label><label class="check"><input id="weak-only" type="checkbox" ${ ctx.weakOnly ? 'checked' : '' }>약점 카드만</label></div><div class="practice-card"><span class="big">♣</span><span class="caption">${ ctx.end - ctx.start + 1 }장의 기억을 확인해 볼까요?</span></div><button id="begin" class="primary" style="width:100%;margin-top:18px">연습 시작</button><p class="hint">한 세션에서는 같은 카드가<br>중복 출제되지 않습니다.<br>오답과 5초 넘게 걸린 카드는<br>약점으로 모읍니다.</p></section>${ ctx.metrics() }</div>`;
    ctx.wireRange();
    document.querySelector('#mode').value = ctx.mode;
    document.querySelector('#mode').onchange = e => ctx.mode = e.target.value;
    document.querySelector('#weak-only').onchange = e => ctx.weakOnly = e.target.checked;
    document.querySelector('#begin').onclick = () => {
      try {
        let positions = range(ctx.start, ctx.end);
        if (ctx.weakOnly) {
          const weak = weakPositions(ctx.progress().stats);
          positions = positions.filter(p => weak.includes(p));
        }
        ctx.archiveActiveSession();
        ctx.state.session = newSession(ctx.state.selected, positions, ctx.mode);
        ctx.questionStart = performance.now();
        ctx.save();
        renderQuiz();
      } catch (e) {
        ctx.message(e.message);
      }
    };
  }

  function renderQuestion() {
    const s = ctx.state.session, q = s.queue[s.index], c = ctx.cards()[q.position - 1], result = s.results[s.index];
    ctx.main.innerHTML = `<div class="workspace"><section class="panel"><div class="spread"><div>${ ctx.header('퀴즈', q.direction === 'position' ? '이 번호의 카드를 떠올려 주세요.' : '이 카드의 번호를 떠올려 주세요.') }</div><button id="finish" aria-label="퀴즈 종료">종료</button></div><div class="spread"><span class="pill">${ s.index + 1 } / ${ s.queue.length }</span><span class="subtle">${ STACKS[ctx.state.selected].name }</span></div><div class="bar"><span style="width:${ s.index / s.queue.length * 100 }%"></span></div><div class="practice-card"><span class="big">${ q.direction === 'position' ? q.position : ctx.cardHTML(c) }</span><span class="caption">${ q.direction === 'position' ? '번째 카드' : '몇 번째일까요?' }</span></div><form id="answer-form"><div class="quiz-answer">${ q.direction === 'position' ? `<label>숫자·그림<select id="rank" aria-label="숫자·그림" ${ s.answered ? 'disabled' : '' }>${ RANKS.map(r => `<option>${ r }</option>`).join('') }</select></label><label>무늬<select id="suit" aria-label="무늬" ${ s.answered ? 'disabled' : '' }>${ Object.entries(SUITS).map(([v, l]) => `<option value="${ v }">${ l }</option>`).join('') }</select></label>` : `<label>번호<input id="number" inputmode="numeric" type="number" min="1" max="52" required autocomplete="off" ${ s.answered ? 'disabled' : '' }></label>` }</div>${ s.answered ? `<div class="feedback ${ result.correct ? '' : 'error' }" role="status">${ result.correct ? '정답입니다' : '다시 기억해 두세요' } · ${ ctx.cardHTML(c) } = ${ q.position }번<br><small>${ (result.ms / 1000).toFixed(1) }초</small></div><button id="next-question" type="button" class="primary" style="width:100%;margin-top:16px">${ s.index + 1 === s.queue.length ? '결과 보기' : '다음 질문 →' }</button>` : `<button type="submit" class="primary" style="width:100%">정답 확인</button>` }</form><p class="hint">입력란에서 Enter로 정답을 확인합니다. 새로고침해도 현재 질문이 유지됩니다.</p></section>${ ctx.metrics() }</div>`;
    document.querySelector('#finish').onclick = () => finishQuiz();
    const form = document.querySelector('#answer-form');
    form.onsubmit = e => {
      e.preventDefault();
      if (s.answered || ctx.submitting)
        return;
      let answer;
      if (q.direction === 'position')
        answer = document.querySelector('#rank').value + document.querySelector('#suit').value;
      else {
        answer = Number(document.querySelector('#number').value);
        if (!Number.isInteger(answer) || answer < 1 || answer > 52) {
          ctx.message('1-52 사이의 번호를 입력하세요.');
          return;
        }
      }
      ctx.submitting = true;
      const ms = Math.max(0, Math.round(performance.now() - ctx.questionStart)), correct = grade(ctx.cards(), q, answer);
      ctx.state.progress[ctx.state.selected] = scheduleReview(record(ctx.progress(), q.position, correct, ms), q.position, correct);
      s.results.push({
        correct: correct,
        ms: ms
      });
      s.answered = true;
      ctx.save();
      ctx.submitting = false;
      ctx.message('');
      renderQuestion();
    };
    if (s.answered)
      document.querySelector('#next-question').onclick = () => {
        if (s.index + 1 === s.queue.length) {
          finishQuiz();
          return;
        }
        s.index++;
        s.answered = false;
        ctx.questionStart = performance.now();
        ctx.save();
        ctx.message('');
        renderQuestion();
      };
  }

  function finishQuiz() {
    const s = ctx.state.session;
    if (!s)
      return;
    const total = s.results.length, correct = s.results.filter(r => r.correct).length, ms = s.results.reduce((a, r) => a + r.ms, 0);
    if (s.mode === 'rank') {
      ctx.finishRank();
      return;
    }
    if (total)
      ctx.state.progress[s.stack].history.unshift({
        at: Date.now(),
        mode: s.mode,
        total: total,
        correct: correct,
        ms: ms
      });
    ctx.state.progress[s.stack].history = ctx.state.progress[s.stack].history.slice(0, 100);
    ctx.state.session = null;
    ctx.save();
    ctx.tab = 'records';
    ctx.render();
    ctx.message(total ? `이번 연습: ${ total }장 중 ${ correct }장 정답 · 평균 ${ (ms / total / 1000).toFixed(1) }초` : '연습을 종료했습니다.');
  }

  return { renderQuiz, renderQuestion, finishQuiz };
}
