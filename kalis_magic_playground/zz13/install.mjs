
export function setupInstall(ctx) {
const {$}=ctx;
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

Object.assign(ctx,{standaloneDisplay,installManual,androidRecovery,promptReady,installStatus,renderInstall,watchDisplay});
}
