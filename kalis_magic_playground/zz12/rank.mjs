import { RANKS, SUITS } from './data.mjs';
import { rankPositions, newRankSession, answerRank } from './core.mjs';

// Each app boot owns its context; modules do not retain browser or practice state.
export function createRank(ctx) {
  function renderRank() {
    const s = ctx.state.session;
    if (!s || s.mode !== 'rank' || s.stack !== ctx.state.selected) {
      ctx.main.innerHTML = `<section class="panel">${ ctx.header('포카드 위치 연습', '같은 숫자·그림 네 장의 위치를 무늬별로 떠올립니다.') }<label>숫자·그림<select id="choose-rank"><option value="">13종 무작위 세션</option>${ RANKS.map(r => `<option>${ r }</option>`).join('') }</select></label><button id="begin-rank" class="primary">포카드 연습 시작</button><p class="hint">포카드 기록은 한 장 퀴즈와 별도로 저장됩니다.</p></section>`;
      document.querySelector('#begin-rank').onclick = () => {
        ctx.archiveActiveSession();
        ctx.state.session = newRankSession(ctx.state.selected, document.querySelector('#choose-rank').value || null);
        ctx.questionStart = performance.now();
        ctx.save();
        ctx.message('');
        renderRank();
      };
      return;
    }
    const rank = s.queue[s.index], result = s.results[s.index], expected = rankPositions(ctx.cards(), rank);
    ctx.main.innerHTML = `<section class="panel"><div class="spread">${ ctx.header('포카드 위치 연습', `<span class="rank-progress">${ s.index + 1 } / ${ s.queue.length }</span>`) }<button id="finish-rank">종료</button></div><div class="practice-card"><span class="big">${ rank }</span><span class="caption">네 무늬의 번호를 입력하세요.</span></div><form id="rank-form"><div class="quiz-answer">${ Object.entries(SUITS).map(([suit, symbol]) => `<label>${ rank }${ symbol } 번호<input name="${ suit }" aria-label="${ rank }${ symbol } 번호" inputmode="numeric" type="number" min="1" max="52" required ${ s.answered ? 'disabled' : '' }></label>`).join('') }</div>${ s.answered ? `<div class="feedback ${ result.correct ? '' : 'error' }" role="status">${ result.correct ? '네 장 모두 정답입니다' : '틀린 위치를 다시 연결해 보세요' }${ Object.keys(SUITS).map(suit => `<p>${ result.suits[suit] ? '✓ 정답' : '✗ 오답' } · ${ ctx.cardHTML(rank + suit) } = ${ expected[suit] }번</p>`).join('') }<small>${ (result.ms / 1000).toFixed(1) }초</small></div><button id="next-question" type="button" class="primary">${ s.index + 1 === s.queue.length ? '결과 보기' : '다음 질문 →' }</button>` : '<button type="submit" class="primary">네 장 정답 확인</button>' }</form></section>`;
    document.querySelector('#finish-rank').onclick = finishRank;
    document.querySelector('#rank-form').onsubmit = e => {
      e.preventDefault();
      if (s.answered || ctx.submitting)
        return;
      try {
        const answers = Object.fromEntries(Object.keys(SUITS).map(k => [
          k,
          e.target.elements[k].value
        ]));
        ctx.state = answerRank(ctx.state, answers, Math.max(0, Math.round(performance.now() - ctx.questionStart)));
        ctx.save();
        ctx.message('');
        renderRank();
      } catch (error) {
        ctx.message(error.message);
      }
    };
    if (s.answered)
      document.querySelector('#next-question').onclick = () => {
        if (s.index + 1 === s.queue.length) {
          finishRank();
          return;
        }
        s.index++;
        s.answered = false;
        ctx.questionStart = performance.now();
        ctx.save();
        ctx.message('');
        renderRank();
      };
  }

  function finishRank() {
    const s = ctx.state.session;
    if (!s || s.mode !== 'rank')
      return;
    const total = s.results.length, correct = s.results.filter(r => r.correct).length, ms = s.results.reduce((a, r) => a + r.ms, 0);
    if (total) {
      ctx.state.progress[s.stack].rankHistory.unshift({
        at: Date.now(),
        total: total,
        correct: correct,
        ms: ms
      });
      ctx.state.progress[s.stack].rankHistory = ctx.state.progress[s.stack].rankHistory.slice(0, 100);
    }
    ctx.state.session = null;
    ctx.save();
    ctx.tab = 'records';
    ctx.render();
    ctx.message(`포카드 연습: ${ total }종 중 ${ correct }종 네 장 모두 정답`);
  }

  return { renderRank, finishRank };
}
