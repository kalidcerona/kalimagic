import { STACKS } from './data.mjs';
import { range, randomPosition, escapeHTML } from './core.mjs';

// Each app boot owns its context; modules do not retain browser or practice state.
export function createStudy(ctx) {
  function renderStudy() {
    const positions = range(ctx.start, ctx.end), p = positions[ctx.studyIndex % positions.length], c = ctx.cards()[p - 1], pair = ctx.studyMode === 'pair';
    ctx.main.innerHTML = `<div class="workspace"><section class="panel">${ ctx.header('암기', '카드와 번호를 같이 봅니다.<br>한 쪽만 남기고 나머지를 떠올립니다.') }${ ctx.rangeHTML() }<label>학습 방식<select id="study-mode"><option value="pair">카드와 번호</option><option value="position">번호에서 카드</option><option value="card">카드에서 번호</option></select></label><div class="spread"><span class="pill">${ ctx.studyMode === 'card' && !ctx.flipped ? `범위 ${ positions.length }장` : `${ ctx.studyIndex + 1 } / ${ positions.length }` }</span><span class="subtle">${ STACKS[ctx.state.selected].name }</span></div><button id="flip" class="practice-card" aria-label="${ pair ? '카드와 번호' : '정답 확인 또는 숨기기' }"><span class="big">${ pair ? ctx.cardHTML(c) : ctx.flipped ? ctx.studyMode === 'position' ? ctx.cardHTML(c) : p : ctx.studyMode === 'position' ? p : ctx.cardHTML(c) }</span><span class="caption">${ pair || ctx.flipped ? `${ ctx.cardHTML(c) } = ${ p }번` : '떠올린 뒤 눌러서 확인' }</span></button>${ pair || ctx.flipped ? `<p class="association">${ escapeHTML(ctx.progress().notes[p] || '기억 탭에서 장면을 적을 수 있습니다.') }</p>` : '' }<div class="row controls"><button id="previous" type="button">이전</button><button id="next" type="button" class="primary">다음</button><button id="random-study" type="button">무작위</button></div></section>${ ctx.metrics() }</div>`;
    ctx.wireRange();
    document.querySelector('#study-mode').value = ctx.studyMode;
    document.querySelector('#study-mode').onchange = e => {
      ctx.studyMode = e.target.value;
      ctx.flipped = false;
      renderStudy();
    };
    document.querySelector('#flip').onclick = () => {
      ctx.flipped = !ctx.flipped;
      renderStudy();
    };
    document.querySelector('#next').onclick = () => {
      ctx.studyIndex = (ctx.studyIndex + 1) % positions.length;
      ctx.flipped = false;
      renderStudy();
    };
    document.querySelector('#previous').onclick = () => {
      ctx.studyIndex = (ctx.studyIndex - 1 + positions.length) % positions.length;
      ctx.flipped = false;
      renderStudy();
    };
    document.querySelector('#random-study').onclick = () => {
      ctx.studyIndex = positions.indexOf(randomPosition(positions, p));
      ctx.flipped = false;
      renderStudy();
    };
  }

  return { renderStudy };
}
