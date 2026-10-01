import {DEFAULTS,settings,next,reset,restore,save,serialize,raster,toggle,undo,hit} from './core.mjs';
const $=id=>document.getElementById(id), key=location.pathname.toLowerCase().startsWith('/tools/arosaegida')?'magic-qr-session-v1-arosaegida':'magic-qr-session-v1';let state={config:{...DEFAULTS},counter:0,frozen:false,current:null};let storageIssue=false;try{const raw=localStorage.getItem(key);if(raw){try{state=restore(raw);}catch{const saved=JSON.parse(raw);state=restore(JSON.stringify({...saved,current:null}));}}}catch{storageIssue=true;}
if(!state.config.target)state.config=settings(DEFAULTS);reset(state);
// Ephemeral rejected-cell inversion. It is not an edit, history entry, or backup field.
let preview=null,armedSuppress=null,undoPointer=null,viewEpoch=0;
function persist(){let ok=false;try{ok=save(localStorage,key,state);}catch{}if(!ok){storageIssue=true;notice('이 기기에 저장할 수 없습니다. 설정에서 백업하세요.');}}
function notice(message){$('notice').textContent=message;}
function shownEdits(q){if(!preview)return q.edits;const nextEdits=new Set(q.edits),cell=preview.y*q.size+preview.x;if(nextEdits.has(cell))nextEdits.delete(cell);else nextEdits.add(cell);return nextEdits;}
function render(){viewEpoch++;const epoch=viewEpoch;const q=state.current;$('empty').hidden=!!q;$('empty').textContent=state.config.target?'생성을 눌러 주세요.':'설정을 완료해 주세요.';$('qr').hidden=!q;$('png').disabled=!q;$('generate').disabled=state.frozen||!state.config.target;$('freeze').disabled=!q;$('freeze').textContent=state.frozen?'고정됨':'고정';$('freeze').setAttribute('aria-pressed',String(state.frozen));$('undo').disabled=!preview&&!q?.history.length;$('clean').disabled=!q||(!preview&&!q.edits.size);if(q&&epoch===viewEpoch){const r=raster(q,16,shownEdits(q));$('qr').width=r.width;$('qr').height=r.height;$('qr').getContext('2d').putImageData(new ImageData(r.data,r.width,r.height),0,0);}}
function dropPreview(){const had=!!preview;preview=null;armedSuppress=null;return had;}
function showDot(value){const label=`${value}%`;$('dotvalue').textContent=label;$('dot').setAttribute('aria-valuetext',label);}
function syncDot(){const value=String(state.config.dot);$('dot').value=value;showDot(value);}
function extraRow(ordinal='',target=''){const row=document.createElement('div');row.className='extrarow';const ordinalLabel=document.createElement('label');ordinalLabel.textContent='순서';const ordinalInput=document.createElement('input');ordinalInput.className='extra-ordinal';ordinalInput.type='number';ordinalInput.min='1';ordinalInput.max='1000000';ordinalInput.step='1';ordinalInput.value=ordinal===''||ordinal===undefined||ordinal===null?'':String(ordinal);ordinalInput.setAttribute('aria-label','순서');ordinalInput.autocomplete='off';ordinalLabel.appendChild(ordinalInput);const targetLabel=document.createElement('label');targetLabel.textContent='사이트';const targetInput=document.createElement('input');targetInput.className='extra-target';targetInput.type='url';targetInput.placeholder='https://';targetInput.value=target||'';targetInput.setAttribute('aria-label','사이트');targetInput.autocomplete='off';targetInput.spellcheck=false;targetLabel.appendChild(targetInput);const remove=document.createElement('button');remove.type='button';remove.className='extra-delete';remove.textContent='삭제';remove.onclick=()=>row.remove();row.appendChild(ordinalLabel);row.appendChild(targetLabel);row.appendChild(remove);return row;}
function renderExtras(list){const box=$('extras');while(box.firstChild)box.removeChild(box.firstChild);for(const item of list||[])box.appendChild(extraRow(item.ordinal,item.target));}
function readExtras(){return [...$('extras').querySelectorAll('.extrarow')].map(row=>({ordinal:row.querySelector('.extra-ordinal').value,target:row.querySelector('.extra-target').value}));}
function open(){if(dropPreview())render();renderInstall();$('target').value=state.config.target;$('ordinal').value=state.config.ordinal;renderExtras(state.config.extraTargets||[]);$('decoys').value=state.config.decoys.join('\n');syncDot();$('session').textContent=`현재 생성 횟수: ${state.counter}${state.frozen?' · 고정 중':''}`;$('error').textContent=storageIssue?'기기 저장을 사용할 수 없거나 저장 내용이 올바르지 않습니다. 백업을 권장합니다.':'';if(!$('settings').open)$('settings').showModal();}
$('close').onclick=()=>$('settings').close();
$('dot').oninput=()=>showDot($('dot').value);
$('add-extra').onclick=()=>$('extras').appendChild(extraRow());
$('form').onsubmit=e=>{e.preventDefault();try{const config=settings({target:$('target').value,ordinal:$('ordinal').value,decoys:$('decoys').value,dot:$('dot').value,extraTargets:readExtras()});dropPreview();undoPointer=null;state.config=config;reset(state);persist();render();$('settings').close();}catch(err){$('error').textContent=err.message;}};
$('generate').onclick=()=>{dropPreview();undoPointer=null;try{if(next(state)){persist();notice('');}render();}catch(err){notice('생성할 수 없습니다. 설정을 확인하세요.');render();console.error(err);}};
$('freeze').onclick=()=>{state.frozen=true;persist();render();};
$('undo').onclick=()=>{if(preview){dropPreview();render();return;}if(undoPointer!=null){undoPointer=null;return;}if(state.current){undo(state.current);persist();render();}};
$('clean').onclick=()=>{if(!state.current)return;dropPreview();undoPointer=null;state.current.edits.clear();state.current.history=[];persist();render();};
const pointers=new Map();let gesture=null,blocked=false;
document.addEventListener('pointerdown',e=>{if(preview){const cell=preview;preview=null;if(e.target===$('undo')){undoPointer=e.pointerId;armedSuppress=null;}else{undoPointer=null;armedSuppress={x:cell.x,y:cell.y,pointerId:e.pointerId};}render();}else if(e.target!==$('undo'))undoPointer=null;if($('settings').open)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,target:e.target});if(pointers.size===1)blocked=false;if(pointers.size===2){blocked=true;gesture={ids:[...pointers.keys()],start:[...pointers.values()].map(p=>({x:p.x,y:p.y}))};}});
document.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(p){p.x=e.clientX;p.y=e.clientY;if(Math.hypot(p.x-p.startX,p.y-p.startY)>8)p.drag=true;}if(gesture&&!$('settings').open){const pair=gesture.ids.map(id=>pointers.get(id));if(pair.every(Boolean)&&pair.every((p,i)=>p.y-gesture.start[i].y>65&&Math.abs(p.x-gesture.start[i].x)<90)){open();gesture=null;}}});
document.addEventListener('pointerup',e=>{const p=pointers.get(e.pointerId);const suppress=armedSuppress&&armedSuppress.pointerId===e.pointerId?armedSuppress:null;if(suppress)armedSuppress=null;if(undoPointer===e.pointerId){const keep=e.target===$('undo')&&p&&!p.drag;if(!keep)undoPointer=null;else{const id=e.pointerId;setTimeout(()=>{if(undoPointer===id)undoPointer=null;},0);}}if(p&&p.target===$('qr')&&!p.drag&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<=8&&!blocked&&!$('settings').open&&state.current){const cell=hit($('qr').getBoundingClientRect(),state.current.size,e.clientX,e.clientY);if(cell&&!(suppress&&suppress.x===cell.x&&suppress.y===cell.y)){const result=toggle(state.current,cell.x,cell.y);if(result.ok){preview=null;persist();notice('');render();}else if(result.reason==='protected'){notice('이 점은 QR 인식 표식입니다.\n지우면 카메라가 읽지 못할 수 있어요.');}else if(result.reason==='decode'||result.reason==='budget'){preview={x:cell.x,y:cell.y};notice('');render();}}}pointers.delete(e.pointerId);if(!pointers.size){gesture=null;blocked=false;}});
document.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);blocked=true;gesture=null;if(armedSuppress?.pointerId===e.pointerId)armedSuppress=null;if(undoPointer===e.pointerId)undoPointer=null;});
window.addEventListener('blur',()=>{pointers.clear();gesture=null;blocked=false;undoPointer=null;if(dropPreview())render();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){undoPointer=null;if(dropPreview())render();}});
function download(blob,name){const link=document.createElement('a'),href=URL.createObjectURL(blob);link.href=href;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
function exportPng(){dropPreview();undoPointer=null;render();const q=state.current,epoch=viewEpoch;if(!q)return;$('qr').toBlob(blob=>{if(!blob||viewEpoch!==epoch||preview||state.current!==q)return;download(blob,'QR.png');});}
$('png').onclick=exportPng;
$('backup').onclick=()=>download(new Blob([serialize(state)],{type:'application/json'}),'QR-backup.json');
$('import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('백업 파일이 너무 큽니다.');const text=await file.text();state=restore(text);dropPreview();undoPointer=null;persist();render();open();}catch{dropPreview();undoPointer=null;render();$('error').textContent='올바른 QR 백업 파일이 아닙니다.';}finally{e.target.value='';}};
let deferredPrompt=null,installSignal='none';
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
function installStatus(){const parts=[];if(standaloneDisplay())parts.push('단독 창입니다. 홈 화면 바로가기일 수도, 설치된 앱일 수도 있습니다.');else parts.push('브라우저 탭입니다.'+String.fromCharCode(10)+'설치 여부는 여기서 확인할 수 없습니다.');if(installSignal==='appinstalled')parts.push('이번 페이지에서 설치 완료 신호를 받았습니다.');else if(installSignal==='accepted')parts.push('설치 동의 응답입니다. 설치 완료를 뜻하지는 않습니다.');else if(installSignal==='error')parts.push('설치 창을 열지 못했습니다. 브라우저 메뉴에서 다시 시도하세요.');else if(installSignal==='dismissed')parts.push('설치 창을 닫았습니다. 설치 완료가 아닙니다.');parts.push('앱 이름: 아로새기다'+String.fromCharCode(10)+'이전 이름: QR'+String.fromCharCode(10)+'홈 화면·브라우저 앱 목록에서'+String.fromCharCode(10)+'아이콘을 확인하세요.'+String.fromCharCode(10)+'iPhone·iPad는 앱 보관함도 확인하세요.'+String.fromCharCode(10)+'이 페이지에서는 설치된 앱을 제거하거나 고칠 수 없습니다.');return parts.join(String.fromCharCode(10));}
function renderInstall(){const status=$('install-status'),button=$('install'),manual=$('install-manual');if(!status||!button||!manual)return;const ready=promptReady(deferredPrompt)&&!standaloneDisplay()&&installSignal!=='appinstalled';status.textContent=installStatus();manual.textContent=installManual();button.hidden=!ready;button.disabled=!ready;const android=/Android/i.test(String(navigator.userAgent||''));const box=$('install-android'),recovery=$('install-android-recovery');if(box)box.hidden=!android;if(recovery)recovery.textContent=android?androidRecovery():'';}
function watchDisplay(){try{if(typeof window.matchMedia!=='function')return;for(const query of ['(display-mode: standalone)','(display-mode: window-controls-overlay)']){const media=window.matchMedia(query);if(typeof media.addEventListener==='function')media.addEventListener('change',renderInstall);}}catch{}}
window.addEventListener('beforeinstallprompt',event=>{if(!promptReady(event)||standaloneDisplay()||installSignal==='appinstalled')return;if(typeof event.preventDefault==='function')event.preventDefault();deferredPrompt=event;renderInstall();});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;installSignal='appinstalled';renderInstall();});
$('install').onclick=async()=>{const event=deferredPrompt;if(!promptReady(event))return;deferredPrompt=null;renderInstall();try{await event.prompt();const choice=await event.userChoice;if(installSignal!=='appinstalled')installSignal=choice&&choice.outcome==='accepted'?'accepted':'dismissed';}catch{if(installSignal!=='appinstalled')installSignal='error';}renderInstall();};
watchDisplay();
syncDot();
persist();render();renderInstall();if(storageIssue)notice('기기 저장을 사용할 수 없거나 저장 내용이 올바르지 않습니다. 설정에서 백업을 확인하세요.');if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
