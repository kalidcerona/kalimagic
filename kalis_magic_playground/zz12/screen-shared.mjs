import { STACKS, label, red } from './data.mjs';
import { range, weakPositions, totals, duePositions } from './core.mjs';

// Each app boot owns its context; modules do not retain browser or practice state.
export function createScreenShared(ctx) {
  function cardHTML(c) {
    return `<span class="${ red(c) ? 'red' : '' }">${ label(c) }</span>`;
  }

  function header(title, subtitle) {
    return `<h2>${ title }</h2><p class="subtle">${ subtitle }</p>`;
  }

  function metrics() {
    const t = totals(ctx.progress().stats);
    return `<aside class="panel"><h3>오늘도 한 장씩</h3><div class="metric"><strong>${ t.attempts ? Math.round(t.correct / t.attempts * 100) : 0 }%</strong><span>전체 정답률</span></div><div class="metric"><strong>${ t.attempts ? (t.ms / t.attempts / 1000).toFixed(1) : '—' }<small> 초</small></strong><span>평균 응답 시간</span></div><div class="metric"><strong>${ weakPositions(ctx.progress().stats).length }<small> 장</small></strong><span>오답 또는 5초 초과 카드</span></div><div class="metric"><strong>${ duePositions(ctx.progress()).length }<small> 장</small></strong><span>오늘 복습 · 기억 탭</span></div><p class="hint">${ STACKS[ctx.state.selected].name }의 기록입니다. 스택을 바꾸면 기록도 따로 이어집니다.</p></aside>`;
  }

  function rangeHTML() {
    return `<div class="controls range" aria-label="학습 범위">${ [
      13,
      26,
      52
    ].map(n => `<button data-range="${ n }" class="${ ctx.start === 1 && ctx.end === n ? 'selected' : '' }">1-${ n }장</button>`).join('') }<label>시작<input id="start" type="number" min="1" max="52" value="${ ctx.start }"></label><label>끝<input id="end" type="number" min="1" max="52" value="${ ctx.end }"></label><button id="apply-range">적용</button></div>`;
  }

  function wireRange() {
    document.querySelectorAll('[data-range]').forEach(b => b.onclick = () => {
      ctx.start = 1;
      ctx.end = Number(b.dataset.range);
      ctx.studyIndex = 0;
      ctx.flipped = false;
      ctx.render();
    });
    document.querySelector('#apply-range').onclick = () => {
      try {
        const a = Number(document.querySelector('#start').value), b = Number(document.querySelector('#end').value);
        range(a, b);
        ctx.start = a;
        ctx.end = b;
        ctx.studyIndex = 0;
        ctx.flipped = false;
        ctx.render();
      } catch (e) {
        ctx.message(e.message);
      }
    };
  }

  function archiveActiveSession() {
    const s = ctx.state.session;
    if (!s)
      return;
    const total = s.results.length;
    if (total) {
      const correct = s.results.filter(r => r.correct).length, ms = s.results.reduce((a, r) => a + r.ms, 0), p = ctx.state.progress[s.stack];
      if (s.mode === 'rank') {
        p.rankHistory.unshift({
          at: Date.now(),
          total: total,
          correct: correct,
          ms: ms
        });
        p.rankHistory = p.rankHistory.slice(0, 100);
      } else {
        p.history.unshift({
          at: Date.now(),
          mode: s.mode,
          total: total,
          correct: correct,
          ms: ms
        });
        p.history = p.history.slice(0, 100);
      }
    }
    ctx.state.session = null;
  }

  return { cardHTML, header, metrics, rangeHTML, wireRange, archiveActiveSession };
}
