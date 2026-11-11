import {raster} from './core.mjs';

export function setupRendering(ctx) {
const {$}=ctx;
function notice(message){$('notice').textContent=message;}
function shownEdits(q){if(!ctx.preview)return q.edits;const nextEdits=new Set(q.edits),cell=ctx.preview.y*q.size+ctx.preview.x;if(nextEdits.has(cell))nextEdits.delete(cell);else nextEdits.add(cell);return nextEdits;}
function render(){ctx.viewEpoch++;const epoch=ctx.viewEpoch;const q=ctx.state.current;$('empty').hidden=!!q;$('empty').textContent=ctx.state.config.target?'생성을 눌러 주세요.':'설정을 완료해 주세요.';$('qr').hidden=!q;$('png').disabled=!q;$('generate').disabled=ctx.state.frozen||!ctx.state.config.target;$('freeze').disabled=!q;$('freeze').textContent=ctx.state.frozen?'고정됨':'고정';$('freeze').setAttribute('aria-pressed',String(ctx.state.frozen));$('undo').disabled=!ctx.preview&&!q?.history.length;$('clean').disabled=!q||(!ctx.preview&&!q.edits.size);if(q&&epoch===ctx.viewEpoch){const r=raster(q,16,shownEdits(q));$('qr').width=r.width;$('qr').height=r.height;$('qr').getContext('2d').putImageData(new ImageData(r.data,r.width,r.height),0,0);}}
function dropPreview(){const had=!!ctx.preview;ctx.preview=null;ctx.armedSuppress=null;return had;}

Object.assign(ctx,{notice,shownEdits,render,dropPreview});
}
