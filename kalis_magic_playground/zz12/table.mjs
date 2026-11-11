import { STACKS } from './data.mjs';
import { range, weakPositions } from './core.mjs';

// Each app boot owns its context; modules do not retain browser or practice state.
export function createTable(ctx) {
  function renderTable() {
    const weak = weakPositions(ctx.progress().stats);
    ctx.main.innerHTML = `<section class="panel">${ ctx.header('스택 한눈에 보기', `${ STACKS[ctx.state.selected].name } · ${ STACKS[ctx.state.selected].author } / 금색 테두리는 약점 카드입니다.`) }${ ctx.rangeHTML() }<div class="stack-grid">${ range(ctx.start, ctx.end).map(p => `<div class="stack-cell ${ weak.includes(p) ? 'weak' : '' }"><span>${ String(p).padStart(2, '0') }</span><strong>${ ctx.cardHTML(ctx.cards()[p - 1]) }</strong></div>`).join('') }</div></section>`;
    ctx.wireRange();
  }

  return { renderTable };
}
