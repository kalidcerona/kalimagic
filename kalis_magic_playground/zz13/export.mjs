import {reset,restore,sessionConsistent,serialize} from './core.mjs';

export function setupExport(ctx) {
const {$}=ctx;
function download(blob,name){const link=document.createElement('a'),href=URL.createObjectURL(blob);link.href=href;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
function exportPng(){ctx.dropPreview();ctx.undoPointer=null;ctx.render();const q=ctx.state.current,epoch=ctx.viewEpoch;if(!q)return;$('qr').toBlob(blob=>{if(!blob||ctx.viewEpoch!==epoch||ctx.preview||ctx.state.current!==q)return;download(blob,'QR.png');});}
$('png').onclick=exportPng;
$('backup').onclick=()=>{if(ctx.writesHeld){if(typeof ctx.preservedRaw!=='string'){ctx.notice(ctx.NOTE_BACKUP_REFUSED);return;}download(new Blob([ctx.preservedRaw],{type:'application/json'}),'QR-backup.json');ctx.notice(ctx.NOTE_BACKUP_ORIGINAL);return;}download(new Blob([serialize(ctx.state)],{type:'application/json'}),'QR-backup.json');};
$('import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('백업 파일이 너무 큽니다.');const text=await file.text();const restored=restore(text);if(!sessionConsistent(restored))reset(restored);const replaced=ctx.prepareExplicitWrite();if(replaced==='blocked')return;ctx.state=restored;ctx.dropPreview();ctx.undoPointer=null;const saved=ctx.persist(true);ctx.render();ctx.open();if(!saved)return;const note=ctx.replacementNote(replaced);if(note){$('error').textContent='백업을 복원했습니다.\n'+note;ctx.notice('백업을 복원했습니다.\n'+note);}}catch{ctx.dropPreview();ctx.undoPointer=null;ctx.render();$('error').textContent='올바른 QR 백업 파일이 아닙니다.';}finally{e.target.value='';}};

Object.assign(ctx,{download,exportPng});
}
