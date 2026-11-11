import { STACKS } from './data.mjs';
import { weakPositions, totals } from './core.mjs';

// Each app boot owns its context; modules do not retain browser or practice state.
export function createRecords(ctx) {
  function renderRecords() {
    const t = totals(ctx.progress().stats), weak = weakPositions(ctx.progress().stats);
    ctx.main.innerHTML = `${ ctx.header('쌓여 가는 기억', `${ STACKS[ctx.state.selected].name }의 연습 기록입니다.`) }<div class="stats-grid"><div class="panel"><strong>${ t.attempts }</strong><span class="subtle">응답한 질문</span></div><div class="panel"><strong>${ t.attempts ? Math.round(t.correct / t.attempts * 100) : 0 }%</strong><span class="subtle">전체 정답률</span></div><div class="panel"><strong>${ weak.length }</strong><span class="subtle">약점 카드</span></div></div><section class="panel">${ ctx.header('약점 카드', '오답 경험 또는 5초 초과 정답이 있는 카드입니다. 누적 기록 기준으로 표시됩니다.') }<div class="stack-grid">${ weak.map(p => `<div class="stack-cell weak"><span>${ p }번</span><strong>${ ctx.cardHTML(ctx.cards()[p - 1]) }</strong></div>`).join('') || '<p class="subtle">아직 약점 카드가 없습니다. 첫 퀴즈를 시작해 보세요.</p>' }</div>${ weak.length ? '<button id="weak-practice" class="primary" style="margin-top:18px">약점만 연습하기</button>' : '' }</section><section class="panel" style="margin-top:20px"><h3>최근 연습</h3><div class="table-wrap"><table><thead><tr><th>날짜</th><th>방식</th><th>정답</th><th>평균</th></tr></thead><tbody>${ ctx.progress().history.map(h => `<tr><td>${ new Date(h.at).toLocaleString('ko-KR') }</td><td>${ {
      position: '번호 → 카드',
      card: '카드 → 번호',
      mixed: '혼합'
    }[h.mode] }</td><td>${ h.correct } / ${ h.total }</td><td>${ (h.ms / h.total / 1000).toFixed(1) }초</td></tr>`).join('') || '<tr><td colspan="4">연습을 마치면 여기에 기록됩니다.</td></tr>' }</tbody></table></div></section>`;
    ctx.main.insertAdjacentHTML('beforeend', `<section class="panel" style="margin-top:20px"><h3>포카드 별도 기록</h3><p class="hint">한 장 질문 정답률에 합산하지 않습니다.</p><div class="table-wrap"><table><thead><tr><th>숫자·그림</th><th>시도</th><th>네 장 모두 정답</th></tr></thead><tbody>${ Object.entries(ctx.progress().rankStats).map(([rank, r]) => `<tr><td>${ rank }</td><td>${ r.attempts }</td><td>${ r.correct }</td></tr>`).join('') || '<tr><td colspan="3">아직 포카드 기록이 없습니다.</td></tr>' }</tbody></table></div><h3>최근 포카드 세션</h3><div class="table-wrap"><table><thead><tr><th>날짜</th><th>네 장 모두 정답</th><th>평균</th></tr></thead><tbody>${ ctx.progress().rankHistory.map(h => `<tr><td>${ new Date(h.at).toLocaleString('ko-KR') }</td><td>${ h.correct } / ${ h.total }</td><td>${ (h.ms / h.total / 1000).toFixed(1) }초</td></tr>`).join('') || '<tr><td colspan="3">완료한 포카드 세션이 없습니다.</td></tr>' }</tbody></table></div></section>`);
    const b = document.querySelector('#weak-practice');
    if (b)
      b.onclick = () => {
        ctx.tab = 'quiz';
        ctx.weakOnly = true;
        ctx.start = 1;
        ctx.end = 52;
        ctx.render();
      };
  }

  return { renderRecords };
}
