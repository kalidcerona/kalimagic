function contactHref(nav) {
  var code = 'eshVqDvk7WKk0zDKtiC9UTa.T6Q-', ua = nav.userAgent || '';
  if (/Android/i.test(ua)) return 'intent://viewer?#Intent;scheme=kakaotalkqrcode%3A%2F%2F' + code + ';action=android.intent.action.SEND;category=android.intent.category.BROWSABLE;package=com.kakao.talk;end;';
  if (/iPhone|iPad|iPod/i.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'kakaotalkqrcode://' + code;
  return 'https://qr.kakao.com/talk/' + code;
}
import {DEFAULTS,settings,next,reset,restore,save,serialize,raster,toggle,undo,hit} from './core.mjs';
const $=id=>document.getElementById(id), key=location.pathname.toLowerCase().startsWith('/tools/arosaegida')?'magic-qr-session-v1-arosaegida':'magic-qr-session-v1', preservedKey=key+'-preserved-raw';
const NOTE_UNREADABLE='저장된 내용을 읽지 못했습니다.\n원본을 읽고 보관할 수 있을 때까지 저장과 복원을 멈췄습니다.';
const NOTE_INVALID='저장된 내용을 확인하지 못했습니다.\n원본은 그대로 두었고 자동 저장은 멈췄습니다.\n설정 백업으로 그 원본을 받을 수 있습니다.\n저장하고 시작이나 백업 복원은 원본을 바꿉니다.';
const NOTE_KEPT_FILE='이전 저장 내용은 바꾸었습니다.\n읽을 수 있던 원본은 이 기기에 따로 남겨 두었고 백업 파일 다운로드도 요청했습니다.';
const NOTE_KEPT_DEVICE='이전 저장 내용은 바꾸었습니다.\n읽을 수 있던 원본은 이 기기에 따로 남겨 두었습니다.';
const NOTE_STASH_FAILED='원본을 따로 남기지 못해 저장소는 바꾸지 않았습니다.\n설정 백업으로 원본을 받은 뒤 다시 시도하세요.';
const NOTE_BACKUP_ORIGINAL='읽지 못한 저장 원본의 백업 다운로드를 요청했습니다.';
const NOTE_BACKUP_REFUSED='원본을 읽지 못해 기본 설정을 백업으로 내려받지 않습니다.';
function freshState(){return {config:{...DEFAULTS,decoys:[...DEFAULTS.decoys],extraTargets:[...(DEFAULTS.extraTargets||[])]},counter:0,frozen:false,current:null};}
let state=freshState();let storageIssue=false,writesHeld=false,preservedRaw=null,storageNote='',retainedDownload=false;
// Missing data may become defaults. A failed read, parse, schema, or config keeps the exact raw value and blocks automatic writes.
function acceptLoaded(nextState){state=nextState;reset(state);}
function holdUnreadable(text){preservedRaw=text;writesHeld=true;storageIssue=true;storageNote=text==null?NOTE_UNREADABLE:NOTE_INVALID;acceptLoaded(freshState());}
function loadStored(){let raw;try{raw=localStorage.getItem(key);}catch{holdUnreadable(null);return;}if(raw==null){acceptLoaded(state);return;}const text=typeof raw==='string'?raw:String(raw);try{acceptLoaded(restore(text));return;}catch{}try{const saved=JSON.parse(text);acceptLoaded(restore(JSON.stringify({...saved,current:null})));return;}catch{}holdUnreadable(text);}
function readableRaw(){if(typeof preservedRaw==='string')return preservedRaw;try{const again=localStorage.getItem(key);if(typeof again==='string')return again;}catch{}return null;}
function stashRaw(raw){try{localStorage.setItem(preservedKey,raw);return localStorage.getItem(preservedKey)===raw;}catch{return false;}}
function prepareExplicitWrite(){if(!writesHeld)return 'ready';const raw=readableRaw();if(raw==null){storageNote=NOTE_UNREADABLE;$('error').textContent=storageNote;notice(storageNote);return 'blocked';}preservedRaw=raw;if(!stashRaw(raw)){storageNote=NOTE_STASH_FAILED;$('error').textContent=NOTE_STASH_FAILED;notice(NOTE_STASH_FAILED);return 'blocked';}retainedDownload=false;try{download(new Blob([raw],{type:'application/json'}),'QR-original.json');retainedDownload=true;}catch{}return 'kept';}
function replacementNote(kind){if(kind==='kept')return retainedDownload?NOTE_KEPT_FILE:NOTE_KEPT_DEVICE;return '';}
// Ephemeral rejected-cell inversion. It is not an edit, history entry, or backup field.
let preview=null,armedSuppress=null,undoPointer=null,viewEpoch=0;
function persist(explicit=false){if(writesHeld&&!explicit)return false;let ok=false;try{ok=save(localStorage,key,state);}catch{}if(!ok){storageIssue=true;storageNote='이 기기에 저장할 수 없습니다.\n설정에서 백업하세요.';notice(storageNote);return false;}if(explicit){writesHeld=false;preservedRaw=null;}storageIssue=false;storageNote='';return true;}
function notice(message){$('notice').textContent=message;}
function shownEdits(q){if(!preview)return q.edits;const nextEdits=new Set(q.edits),cell=preview.y*q.size+preview.x;if(nextEdits.has(cell))nextEdits.delete(cell);else nextEdits.add(cell);return nextEdits;}
function render(){viewEpoch++;const epoch=viewEpoch;const q=state.current;$('empty').hidden=!!q;$('empty').textContent=state.config.target?'생성을 눌러 주세요.':'설정을 완료해 주세요.';$('qr').hidden=!q;$('png').disabled=!q;$('generate').disabled=state.frozen||!state.config.target;$('freeze').disabled=!q;$('freeze').textContent=state.frozen?'고정됨':'고정';$('freeze').setAttribute('aria-pressed',String(state.frozen));$('undo').disabled=!preview&&!q?.history.length;$('clean').disabled=!q||(!preview&&!q.edits.size);if(q&&epoch===viewEpoch){const r=raster(q,16,shownEdits(q));$('qr').width=r.width;$('qr').height=r.height;$('qr').getContext('2d').putImageData(new ImageData(r.data,r.width,r.height),0,0);}}
function dropPreview(){const had=!!preview;preview=null;armedSuppress=null;return had;}
function showDot(value){const label=`${value}%`;$('dotvalue').textContent=label;$('dot').setAttribute('aria-valuetext',label);}
function syncDot(){const value=String(state.config.dot);$('dot').value=value;showDot(value);}
function extraRow(ordinal='',target=''){const row=document.createElement('div');row.className='extrarow';const ordinalLabel=document.createElement('label');ordinalLabel.textContent='순서';const ordinalInput=document.createElement('input');ordinalInput.className='extra-ordinal';ordinalInput.type='number';ordinalInput.min='1';ordinalInput.max='1000000';ordinalInput.step='1';ordinalInput.value=ordinal===''||ordinal===undefined||ordinal===null?'':String(ordinal);ordinalInput.setAttribute('aria-label','순서');ordinalInput.autocomplete='off';ordinalLabel.appendChild(ordinalInput);const targetLabel=document.createElement('label');targetLabel.textContent='사이트';const targetInput=document.createElement('input');targetInput.className='extra-target';targetInput.type='url';targetInput.placeholder='https://';targetInput.value=target||'';targetInput.setAttribute('aria-label','사이트');targetInput.autocomplete='off';targetInput.spellcheck=false;targetLabel.appendChild(targetInput);const remove=document.createElement('button');remove.type='button';remove.className='extra-delete';remove.textContent='삭제';remove.onclick=()=>row.remove();row.appendChild(ordinalLabel);row.appendChild(targetLabel);row.appendChild(remove);return row;}
function renderExtras(list){const box=$('extras');while(box.firstChild)box.removeChild(box.firstChild);for(const item of list||[])box.appendChild(extraRow(item.ordinal,item.target));}
function readExtras(){return [...$('extras').querySelectorAll('.extrarow')].map(row=>({ordinal:row.querySelector('.extra-ordinal').value,target:row.querySelector('.extra-target').value}));}
function open(){if(dropPreview())render();renderInstall();$('target').value=state.config.target;$('ordinal').value=state.config.ordinal;renderExtras(state.config.extraTargets||[]);$('decoys').value=state.config.decoys.join('\n');syncDot();$('session').textContent=`현재 생성 횟수: ${state.counter}${state.frozen?' · 고정 중':''}`;$('error').textContent=storageNote;if(!$('settings').open)$('settings').showModal();}
$('close').onclick=()=>$('settings').close();
$('dot').oninput=()=>showDot($('dot').value);
$('add-extra').onclick=()=>$('extras').appendChild(extraRow());
$('form').onsubmit=e=>{e.preventDefault();try{const config=settings({target:$('target').value,ordinal:$('ordinal').value,decoys:$('decoys').value,dot:$('dot').value,extraTargets:readExtras()});const replaced=prepareExplicitWrite();if(replaced==='blocked')return;dropPreview();undoPointer=null;state.config=config;reset(state);const saved=persist(true);render();if(!saved){$('error').textContent=storageNote;return;}$('settings').close();const note=replacementNote(replaced);if(note)notice(note);}catch(err){$('error').textContent=err.message;}};
$('generate').onclick=()=>{dropPreview();undoPointer=null;try{if(next(state)){if(persist())notice('');}render();}catch(err){notice('생성할 수 없습니다. 설정을 확인하세요.');render();console.error(err);}};
$('freeze').onclick=()=>{state.frozen=true;persist();render();};
$('undo').onclick=()=>{if(preview){dropPreview();render();return;}if(undoPointer!=null){undoPointer=null;return;}if(state.current){undo(state.current);persist();render();}};
$('clean').onclick=()=>{if(!state.current)return;dropPreview();undoPointer=null;state.current.edits.clear();state.current.history=[];persist();render();};
const pointers=new Map();let gesture=null,blocked=false;
document.addEventListener('pointerdown',e=>{if(preview){const cell=preview;preview=null;if(e.target===$('undo')){undoPointer=e.pointerId;armedSuppress=null;}else{undoPointer=null;armedSuppress={x:cell.x,y:cell.y,pointerId:e.pointerId};}render();}else if(e.target!==$('undo'))undoPointer=null;if($('settings').open)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,target:e.target});if(pointers.size===1)blocked=false;if(pointers.size===2){blocked=true;gesture={ids:[...pointers.keys()],start:[...pointers.values()].map(p=>({x:p.x,y:p.y}))};}});
document.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(p){p.x=e.clientX;p.y=e.clientY;if(Math.hypot(p.x-p.startX,p.y-p.startY)>8)p.drag=true;}if(gesture&&!$('settings').open){const pair=gesture.ids.map(id=>pointers.get(id));if(pair.every(Boolean)&&pair.every((p,i)=>p.y-gesture.start[i].y>65&&Math.abs(p.x-gesture.start[i].x)<90)){open();gesture=null;}}});
document.addEventListener('pointerup',e=>{const p=pointers.get(e.pointerId);const suppress=armedSuppress&&armedSuppress.pointerId===e.pointerId?armedSuppress:null;if(suppress)armedSuppress=null;if(undoPointer===e.pointerId){const keep=e.target===$('undo')&&p&&!p.drag;if(!keep)undoPointer=null;else{const id=e.pointerId;setTimeout(()=>{if(undoPointer===id)undoPointer=null;},0);}}if(p&&p.target===$('qr')&&!p.drag&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<=8&&!blocked&&!$('settings').open&&state.current){const cell=hit($('qr').getBoundingClientRect(),state.current.size,e.clientX,e.clientY);if(cell&&!(suppress&&suppress.x===cell.x&&suppress.y===cell.y)){const result=toggle(state.current,cell.x,cell.y);if(result.ok){preview=null;if(persist())notice('');render();}else if(result.reason==='protected'){notice('이 점은 QR 인식 표식입니다.\n지우면 카메라가 읽지 못할 수 있어요.');}else if(result.reason==='decode'||result.reason==='budget'){preview={x:cell.x,y:cell.y};notice('');render();}}}pointers.delete(e.pointerId);if(!pointers.size){gesture=null;blocked=false;}});
document.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);blocked=true;gesture=null;if(armedSuppress?.pointerId===e.pointerId)armedSuppress=null;if(undoPointer===e.pointerId)undoPointer=null;});
window.addEventListener('blur',()=>{pointers.clear();gesture=null;blocked=false;undoPointer=null;if(dropPreview())render();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){undoPointer=null;if(dropPreview())render();}});
function download(blob,name){const link=document.createElement('a'),href=URL.createObjectURL(blob);link.href=href;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
function exportPng(){dropPreview();undoPointer=null;render();const q=state.current,epoch=viewEpoch;if(!q)return;$('qr').toBlob(blob=>{if(!blob||viewEpoch!==epoch||preview||state.current!==q)return;download(blob,'QR.png');});}
$('png').onclick=exportPng;
$('backup').onclick=()=>{if(writesHeld){if(typeof preservedRaw!=='string'){notice(NOTE_BACKUP_REFUSED);return;}download(new Blob([preservedRaw],{type:'application/json'}),'QR-backup.json');notice(NOTE_BACKUP_ORIGINAL);return;}download(new Blob([serialize(state)],{type:'application/json'}),'QR-backup.json');};
$('import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('백업 파일이 너무 큽니다.');const text=await file.text();const restored=restore(text);const replaced=prepareExplicitWrite();if(replaced==='blocked')return;state=restored;dropPreview();undoPointer=null;const saved=persist(true);render();open();if(!saved)return;const note=replacementNote(replaced);if(note){$('error').textContent='백업을 복원했습니다.\n'+note;notice('백업을 복원했습니다.\n'+note);}}catch{dropPreview();undoPointer=null;render();$('error').textContent='올바른 QR 백업 파일이 아닙니다.';}finally{e.target.value='';}};
let deferredPrompt=null,installSignal='none',installRevision=0;
function standaloneDisplay(){let mode=false;try{if(typeof window.matchMedia==='function')mode=window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: window-controls-overlay)').matches;}catch{}return mode||navigator.standalone===true;}
function installManual(){const ua=String(navigator.userAgent||''),platform=String(navigator.platform||''),touch=Number(navigator.maxTouchPoints)||0,ios=/iPad|iPhone|iPod/.test(ua)||(platform==='MacIntel'&&touch>1),android=/Android/i.test(ua);if(ios)return `Safari에서 공유 → 홈 화면에 추가를 누르세요.
‘웹 앱으로 열기’가 보이면 켜세요.
홈 화면의 아로새기다 아이콘으로 여세요.
App Store 앱과 다른 웹 앱이며, 앱 보관함 표시는 OS마다 다릅니다.`;if(android)return `Chrome 메뉴에서 ‘설치’는 설치 흐름입니다.
‘바로가기 만들기’와 ‘홈 화면에 추가’는 바로가기일 수 있습니다.
앱 서랍은 여기서 확인할 수 없습니다.
인앱 브라우저는 기본 브라우저로 여세요.`;return `설치 창이 없으면 브라우저 메뉴에서 ‘앱 설치’를 확인하세요.
‘홈 화면에 추가’는 바로가기일 수 있습니다.
이 페이지는 시스템 앱 목록을 확인하지 않습니다.`;}
function androidRecovery(){return `Chrome에서 ‘이미 설치됨’이나 ‘앱을 열 수 없음’이 나오면 휴대전화에서 확인하세요.
이 페이지는 설치 상태를 읽거나 자동 복구할 수 없습니다.
설정 → 애플리케이션에서 ‘아로새기다’ 또는 이전 이름 ‘QR’을 찾으세요.
사용 안 함일 때만 사용으로 바꾸세요. 앱 서랍 검색은 설치 확인이 아닙니다.
열리지 않으면 먼저 설정 백업을 받으세요.
확인된 이 웹 앱만 제거한 뒤 이 페이지에서 다시 설치할 수 있습니다.
Chrome 기록이나 앱 데이터를 모두 지우지 마세요.
해결되지 않으면 Chrome을 업데이트하고 기기를 다시 시작하세요.
임시 바로가기는 QR 기능을 쓸 수 있지만 앱 설치와 다릅니다.`;}
function promptReady(event){return !!event&&event.isTrusted!==false&&typeof event.prompt==='function'&&!!event.userChoice&&typeof event.userChoice.then==='function';}
function installStatus(){const parts=[];if(standaloneDisplay())parts.push('단독 창입니다. 홈 화면 바로가기일 수도, 설치된 앱일 수도 있습니다.');else parts.push('브라우저 탭입니다.'+String.fromCharCode(10)+'설치 여부는 여기서 확인할 수 없습니다.');if(installSignal==='appinstalled')parts.push('설치 요청을 받았습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.');else if(installSignal==='accepted')parts.push('설치 요청을 보냈습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.');else if(installSignal==='error')parts.push('설치 창을 열지 못했습니다. 브라우저 메뉴에서 다시 시도하세요.');else if(installSignal==='dismissed')parts.push('설치 창을 닫았습니다. 설치 완료가 아닙니다.');parts.push('앱 이름: 아로새기다'+String.fromCharCode(10)+'이전 이름: QR'+String.fromCharCode(10)+'홈 화면·브라우저 앱 목록에서'+String.fromCharCode(10)+'아이콘을 확인하세요.'+String.fromCharCode(10)+'iPhone·iPad는 앱 보관함도 확인하세요.'+String.fromCharCode(10)+'이 페이지에서는 설치된 앱을 제거하거나 고칠 수 없습니다.');return parts.join(String.fromCharCode(10));}
function renderInstall(){const status=$('install-status'),button=$('install'),manual=$('install-manual');if(!status||!button||!manual)return;const ready=promptReady(deferredPrompt)&&!standaloneDisplay();status.textContent=installStatus();manual.textContent=installManual();button.hidden=!ready;button.disabled=!ready;const android=/Android/i.test(String(navigator.userAgent||''));const box=$('install-android'),recovery=$('install-android-recovery');if(box)box.hidden=!android;if(recovery)recovery.textContent=android?androidRecovery():'';}
function watchDisplay(){try{if(typeof window.matchMedia!=='function')return;for(const query of ['(display-mode: standalone)','(display-mode: window-controls-overlay)']){const media=window.matchMedia(query);if(typeof media.addEventListener==='function')media.addEventListener('change',renderInstall);}}catch{}}
window.addEventListener('beforeinstallprompt',event=>{if(!promptReady(event)||standaloneDisplay())return;if(typeof event.preventDefault==='function')event.preventDefault();installRevision+=1;installSignal='none';deferredPrompt=event;renderInstall();});
window.addEventListener('appinstalled',()=>{installRevision+=1;deferredPrompt=null;installSignal='appinstalled';renderInstall();});
$('install').onclick=async()=>{const event=deferredPrompt;if(!promptReady(event)||standaloneDisplay())return;const revision=installRevision;deferredPrompt=null;renderInstall();try{await event.prompt();const choice=await event.userChoice;if(revision===installRevision)installSignal=choice&&choice.outcome==='accepted'?'accepted':'dismissed';}catch{if(revision===installRevision)installSignal='error';}renderInstall();};
watchDisplay();
function copyContactId(button){
  const text='KaliDCerona';
  const finish=ok=>{button.textContent=ok?'복사됨':'ID 복사';if(ok)setTimeout(()=>{if(button.textContent==='복사됨')button.textContent='ID 복사';},1500);};
  const fallback=()=>{try{const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.left='-999px';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();return ok;}catch{return false;}};
  const clip=navigator.clipboard;
  if(clip&&typeof clip.writeText==='function'){clip.writeText(text).then(()=>finish(true),()=>finish(fallback()));return;}
  finish(fallback());
}
const contactLink=$('contact-open');if(contactLink)contactLink.href=contactHref(navigator);
$('contact-copy').onclick=()=>copyContactId($('contact-copy'));
loadStored();
syncDot();
persist();render();renderInstall();if(storageNote)notice(storageNote);if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
