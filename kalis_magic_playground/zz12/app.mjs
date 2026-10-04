function contactHref(nav) {
  var code = 'eshVqDvk7WKk0zDKtiC9UTa.T6Q-', ua = nav.userAgent || '';
  if (/Android/i.test(ua)) return 'intent://viewer?#Intent;scheme=kakaotalkqrcode%3A%2F%2F' + code + ';action=android.intent.action.SEND;category=android.intent.category.BROWSABLE;package=com.kakao.talk;end;';
  if (/iPhone|iPad|iPod/i.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'kakaotalkqrcode://' + code;
  return 'https://qr.kakao.com/talk/' + code;
}
import {STACKS,RANKS,SUITS,label,red} from './data.mjs';
import {freshState,loadState,validateState,validateCards,range,randomPosition,newSession,grade,record,weakPositions,totals,duePositions,scheduleReview,rankPositions,newRankSession,answerRank,replaceStack,escapeHTML,applyRecall,buildReviewQueue} from './core.mjs';
import {STARTER_PALACE,LIMITS,starterNumberImage,starterCardImage,starterScene,starterStory,sameText,classifyRecall,enqueueRetry,schedulesRecall,buildPairQueue,buildDirectQueue,buildImageQueue,buildPalaceQueue,validateMnemonics,groupPositions} from './mnemonic.mjs';
const KEY='magic-memdeck-v1',PRESERVED_KEY=KEY+'-preserved-raw';let state=freshState(),storageWarning='',persistenceError=false,writeBlocked=false,originalRaw=null,recoveryReady=false;
// Missing data may be saved. A failed read or invalid payload keeps the original bytes until a validated backup is imported.
try{
  const saved=localStorage.getItem(KEY);
  if(saved!=null){
    originalRaw=saved;
    try{state=loadState(saved);originalRaw=null;}catch{writeBlocked=true;storageWarning='저장된 기록 형식이 올바르지 않습니다. 원본은 그대로 두었습니다. 이 화면의 기본 연습은 복구된 원본이 아닙니다. 연습은 이 화면에만 남고 기기에 덮어쓰지 않습니다. 검증된 백업을 가져올 때만 기록을 바꿉니다.';}
  }
}catch{writeBlocked=true;originalRaw=null;storageWarning='저장된 기록을 읽지 못했습니다. 원본은 그대로 두었습니다. 이 화면의 기본 연습은 복구된 원본이 아닙니다. 연습은 이 화면에만 남고 기기에 덮어쓰지 않습니다. 검증된 백업을 가져올 때만 기록을 바꿉니다.';}
let tab=state.session?(state.session.mode==='rank'?'rank':'quiz'):'study',start=1,end=52,studyIndex=0,flipped=false,mode='mixed',weakOnly=false,questionStart=performance.now(),submitting=false;let studyMode='pair';
let trainMode='pair',train=null,memoryStart=1,memoryEnd=5,imagePos=1,palaceDraft=null,storyDraft=null;const imageDrafts=new Map();
const main=document.querySelector('#main'),notice=document.querySelector('#notice'),stackSelect=document.querySelector('#stack');
const cards=()=>state.stacks[state.selected];const progress=()=>state.progress[state.selected];
function message(text){if(writeBlocked){notice.textContent=`${storageWarning}${text?` ${text}`:''}`;return;}notice.textContent=(persistenceError?'기기에 저장되지 않았습니다. 현재 연습은 이 화면에서 계속할 수 있지만, 닫기 전에 백업을 내려받으세요. ':'')+text;}
function persist(candidate,{recovery=false}={}){if(writeBlocked&&(!recovery||!recoveryReady)){persistenceError=true;message('');return false;}let serialized;try{serialized=JSON.stringify(candidate);}catch{persistenceError=true;message('');return false;}try{localStorage.setItem(KEY,serialized);}catch{persistenceError=true;message('');return false;}persistenceError=false;if(recovery){writeBlocked=false;originalRaw=null;recoveryReady=false;storageWarning='';}return true;}
function save(){return persist(state);}
function prepareRecovery(){if(!writeBlocked){download('memdeck-before-import.json',state);return;}recoveryReady=false;if(originalRaw==null){try{const raw=localStorage.getItem(KEY);if(typeof raw==='string')originalRaw=raw;}catch{}if(originalRaw==null)throw new Error('원본을 읽고 보관할 수 없어 저장소를 바꾸지 않았습니다.');}try{localStorage.setItem(PRESERVED_KEY,originalRaw);if(localStorage.getItem(PRESERVED_KEY)!==originalRaw)throw new Error('verify');}catch{throw new Error('원본을 기기에 따로 보관하지 못해 저장소를 바꾸지 않았습니다.');}recoveryReady=true;try{downloadText('memdeck-original-raw.json',originalRaw);}catch{/* The verified device copy protects recovery even when download is unavailable. */}}

function cardHTML(c){return `<span class="${red(c)?'red':''}">${label(c)}</span>`;}
function header(title,subtitle){return `<h2>${title}</h2><p class="subtle">${subtitle}</p>`;}
function metrics(){const t=totals(progress().stats);return `<aside class="panel"><h3>오늘도 한 장씩</h3><div class="metric"><strong>${t.attempts?Math.round(t.correct/t.attempts*100):0}%</strong><span>전체 정답률</span></div><div class="metric"><strong>${t.attempts?((t.ms/t.attempts)/1000).toFixed(1):'—'}<small> 초</small></strong><span>평균 응답 시간</span></div><div class="metric"><strong>${weakPositions(progress().stats).length}<small> 장</small></strong><span>오답 또는 5초 초과 카드</span></div><div class="metric"><strong>${duePositions(progress()).length}<small> 장</small></strong><span>오늘 복습 · 기억 탭</span></div><p class="hint">${STACKS[state.selected].name}의 기록입니다. 스택을 바꾸면 기록도 따로 이어집니다.</p></aside>`;}
function rangeHTML(){return `<div class="controls range" aria-label="학습 범위">${[13,26,52].map(n=>`<button data-range="${n}" class="${start===1&&end===n?'selected':''}">1-${n}장</button>`).join('')}<label>시작<input id="start" type="number" min="1" max="52" value="${start}"></label><label>끝<input id="end" type="number" min="1" max="52" value="${end}"></label><button id="apply-range">적용</button></div>`;}
function wireRange(){document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{start=1;end=Number(b.dataset.range);studyIndex=0;flipped=false;render();});document.querySelector('#apply-range').onclick=()=>{try{const a=Number(document.querySelector('#start').value),b=Number(document.querySelector('#end').value);range(a,b);start=a;end=b;studyIndex=0;flipped=false;render();}catch(e){message(e.message);}};}
function render(){stackSelect.value=state.selected;const art=document.querySelector('.art-card');if(art){art.innerHTML='♣<em>♠</em><small>MEM</small>';art.style.color='var(--ink)';}document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});message(writeBlocked?'':storageWarning);if(!writeBlocked)storageWarning='';main.removeAttribute('data-product-settings');main.removeAttribute('data-settings-root');if(tab==='rank')renderRank();if(tab==='memory')renderMemory();if(tab==='study')renderStudy();if(tab==='quiz')renderQuiz();if(tab==='table')renderTable();if(tab==='records')renderRecords();if(tab==='settings')renderSettings();}
function renderStudy(){const positions=range(start,end),p=positions[studyIndex%positions.length],c=cards()[p-1],pair=studyMode==='pair';main.innerHTML=`<div class="workspace"><section class="panel">${header('암기','카드와 번호를 같이 봅니다.<br>한 쪽만 남기고 나머지를 떠올립니다.')}${rangeHTML()}<label>학습 방식<select id="study-mode"><option value="pair">카드와 번호</option><option value="position">번호에서 카드</option><option value="card">카드에서 번호</option></select></label><div class="spread"><span class="pill">${studyMode==='card'&&!flipped?`범위 ${positions.length}장`:`${studyIndex+1} / ${positions.length}`}</span><span class="subtle">${STACKS[state.selected].name}</span></div><button id="flip" class="practice-card" aria-label="${pair?'카드와 번호':'정답 확인 또는 숨기기'}"><span class="big">${pair?cardHTML(c):flipped?(studyMode==='position'?cardHTML(c):p):(studyMode==='position'?p:cardHTML(c))}</span><span class="caption">${pair||flipped?`${cardHTML(c)} = ${p}번`:'떠올린 뒤 눌러서 확인'}</span></button>${pair||flipped?`<p class="association">${escapeHTML(progress().notes[p]||'기억 탭에서 장면을 적을 수 있습니다.')}</p>`:''}<div class="row controls"><button id="previous" type="button">이전</button><button id="next" type="button" class="primary">다음</button><button id="random-study" type="button">무작위</button></div></section>${metrics()}</div>`;wireRange();document.querySelector('#study-mode').value=studyMode;document.querySelector('#study-mode').onchange=e=>{studyMode=e.target.value;flipped=false;renderStudy();};document.querySelector('#flip').onclick=()=>{flipped=!flipped;renderStudy();};document.querySelector('#next').onclick=()=>{studyIndex=(studyIndex+1)%positions.length;flipped=false;renderStudy();};document.querySelector('#previous').onclick=()=>{studyIndex=(studyIndex-1+positions.length)%positions.length;flipped=false;renderStudy();};document.querySelector('#random-study').onclick=()=>{studyIndex=positions.indexOf(randomPosition(positions,p));flipped=false;renderStudy();};}
function renderQuiz(){const session=state.session;if(session&&session.mode!=='rank'&&session.stack===state.selected){renderQuestion();return;}main.innerHTML=`<div class="workspace"><section class="panel">${header('기억을 꺼내는 연습','순서대로 외운 카드를 무작위 질문으로 다시 만나보세요.')}${rangeHTML()}<div class="controls"><label>질문 방식<select id="mode" aria-label="질문 방식"><option value="position">번호 → 카드</option><option value="card">카드 → 번호</option><option value="mixed">두 방향 섞기</option></select></label><label class="check"><input id="weak-only" type="checkbox" ${weakOnly?'checked':''}>약점 카드만</label></div><div class="practice-card"><span class="big">♣</span><span class="caption">${end-start+1}장의 기억을 확인해 볼까요?</span></div><button id="begin" class="primary" style="width:100%;margin-top:18px">연습 시작</button><p class="hint">한 세션에서는 같은 카드가<br>중복 출제되지 않습니다.<br>오답과 5초 넘게 걸린 카드는<br>약점으로 모읍니다.</p></section>${metrics()}</div>`;wireRange();document.querySelector('#mode').value=mode;document.querySelector('#mode').onchange=e=>mode=e.target.value;document.querySelector('#weak-only').onchange=e=>weakOnly=e.target.checked;document.querySelector('#begin').onclick=()=>{try{let positions=range(start,end);if(weakOnly){const weak=weakPositions(progress().stats);positions=positions.filter(p=>weak.includes(p));}archiveActiveSession();state.session=newSession(state.selected,positions,mode);questionStart=performance.now();save();renderQuiz();}catch(e){message(e.message);}};}
function renderQuestion(){const s=state.session,q=s.queue[s.index],c=cards()[q.position-1],result=s.results[s.index];main.innerHTML=`<div class="workspace"><section class="panel"><div class="spread"><div>${header('퀴즈',q.direction==='position'?'이 번호의 카드를 떠올려 주세요.':'이 카드의 번호를 떠올려 주세요.')}</div><button id="finish" aria-label="퀴즈 종료">종료</button></div><div class="spread"><span class="pill">${s.index+1} / ${s.queue.length}</span><span class="subtle">${STACKS[state.selected].name}</span></div><div class="bar"><span style="width:${s.index/s.queue.length*100}%"></span></div><div class="practice-card"><span class="big">${q.direction==='position'?q.position:cardHTML(c)}</span><span class="caption">${q.direction==='position'?'번째 카드':'몇 번째일까요?'}</span></div><form id="answer-form"><div class="quiz-answer">${q.direction==='position'?`<label>숫자·그림<select id="rank" aria-label="숫자·그림" ${s.answered?'disabled':''}>${RANKS.map(r=>`<option>${r}</option>`).join('')}</select></label><label>무늬<select id="suit" aria-label="무늬" ${s.answered?'disabled':''}>${Object.entries(SUITS).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>`:`<label>번호<input id="number" inputmode="numeric" type="number" min="1" max="52" required autocomplete="off" ${s.answered?'disabled':''}></label>`}</div>${s.answered?`<div class="feedback ${result.correct?'':'error'}" role="status">${result.correct?'정답입니다':'다시 기억해 두세요'} · ${cardHTML(c)} = ${q.position}번<br><small>${(result.ms/1000).toFixed(1)}초</small></div><button id="next-question" type="button" class="primary" style="width:100%;margin-top:16px">${s.index+1===s.queue.length?'결과 보기':'다음 질문 →'}</button>`:`<button type="submit" class="primary" style="width:100%">정답 확인</button>`}</form><p class="hint">입력란에서 Enter로 정답을 확인합니다. 새로고침해도 현재 질문이 유지됩니다.</p></section>${metrics()}</div>`;document.querySelector('#finish').onclick=()=>finishQuiz();const form=document.querySelector('#answer-form');form.onsubmit=e=>{e.preventDefault();if(s.answered||submitting)return;let answer;if(q.direction==='position')answer=document.querySelector('#rank').value+document.querySelector('#suit').value;else{answer=Number(document.querySelector('#number').value);if(!Number.isInteger(answer)||answer<1||answer>52){message('1-52 사이의 번호를 입력하세요.');return;}}submitting=true;const ms=Math.max(0,Math.round(performance.now()-questionStart)),correct=grade(cards(),q,answer);state.progress[state.selected]=scheduleReview(record(progress(),q.position,correct,ms),q.position,correct);s.results.push({correct,ms});s.answered=true;save();submitting=false;message('');renderQuestion();};if(s.answered)document.querySelector('#next-question').onclick=()=>{if(s.index+1===s.queue.length){finishQuiz();return;}s.index++;s.answered=false;questionStart=performance.now();save();message('');renderQuestion();};}
function finishQuiz(){const s=state.session;if(!s)return;const total=s.results.length,correct=s.results.filter(r=>r.correct).length,ms=s.results.reduce((a,r)=>a+r.ms,0);if(s.mode==='rank'){finishRank();return;}if(total)state.progress[s.stack].history.unshift({at:Date.now(),mode:s.mode,total,correct,ms});state.progress[s.stack].history=state.progress[s.stack].history.slice(0,100);state.session=null;save();tab='records';render();message(total?`이번 연습: ${total}장 중 ${correct}장 정답 · 평균 ${(ms/total/1000).toFixed(1)}초`:'연습을 종료했습니다.');}
function renderTable(){const weak=weakPositions(progress().stats);main.innerHTML=`<section class="panel">${header('스택 한눈에 보기',`${STACKS[state.selected].name} · ${STACKS[state.selected].author} / 금색 테두리는 약점 카드입니다.`)}${rangeHTML()}<div class="stack-grid">${range(start,end).map(p=>`<div class="stack-cell ${weak.includes(p)?'weak':''}"><span>${String(p).padStart(2,'0')}</span><strong>${cardHTML(cards()[p-1])}</strong></div>`).join('')}</div></section>`;wireRange();}
function renderRecords(){const t=totals(progress().stats),weak=weakPositions(progress().stats);main.innerHTML=`${header('쌓여 가는 기억',`${STACKS[state.selected].name}의 연습 기록입니다.`)}<div class="stats-grid"><div class="panel"><strong>${t.attempts}</strong><span class="subtle">응답한 질문</span></div><div class="panel"><strong>${t.attempts?Math.round(t.correct/t.attempts*100):0}%</strong><span class="subtle">전체 정답률</span></div><div class="panel"><strong>${weak.length}</strong><span class="subtle">약점 카드</span></div></div><section class="panel">${header('약점 카드','오답 경험 또는 5초 초과 정답이 있는 카드입니다. 누적 기록 기준으로 표시됩니다.')}<div class="stack-grid">${weak.map(p=>`<div class="stack-cell weak"><span>${p}번</span><strong>${cardHTML(cards()[p-1])}</strong></div>`).join('')||'<p class="subtle">아직 약점 카드가 없습니다. 첫 퀴즈를 시작해 보세요.</p>'}</div>${weak.length?'<button id="weak-practice" class="primary" style="margin-top:18px">약점만 연습하기</button>':''}</section><section class="panel" style="margin-top:20px"><h3>최근 연습</h3><div class="table-wrap"><table><thead><tr><th>날짜</th><th>방식</th><th>정답</th><th>평균</th></tr></thead><tbody>${progress().history.map(h=>`<tr><td>${new Date(h.at).toLocaleString('ko-KR')}</td><td>${{position:'번호 → 카드',card:'카드 → 번호',mixed:'혼합'}[h.mode]}</td><td>${h.correct} / ${h.total}</td><td>${(h.ms/h.total/1000).toFixed(1)}초</td></tr>`).join('')||'<tr><td colspan="4">연습을 마치면 여기에 기록됩니다.</td></tr>'}</tbody></table></div></section>`;main.insertAdjacentHTML('beforeend',`<section class="panel" style="margin-top:20px"><h3>포카드 별도 기록</h3><p class="hint">한 장 질문 정답률에 합산하지 않습니다.</p><div class="table-wrap"><table><thead><tr><th>숫자·그림</th><th>시도</th><th>네 장 모두 정답</th></tr></thead><tbody>${Object.entries(progress().rankStats).map(([rank,r])=>`<tr><td>${rank}</td><td>${r.attempts}</td><td>${r.correct}</td></tr>`).join('')||'<tr><td colspan="3">아직 포카드 기록이 없습니다.</td></tr>'}</tbody></table></div><h3>최근 포카드 세션</h3><div class="table-wrap"><table><thead><tr><th>날짜</th><th>네 장 모두 정답</th><th>평균</th></tr></thead><tbody>${progress().rankHistory.map(h=>`<tr><td>${new Date(h.at).toLocaleString('ko-KR')}</td><td>${h.correct} / ${h.total}</td><td>${(h.ms/h.total/1000).toFixed(1)}초</td></tr>`).join('')||'<tr><td colspan="3">완료한 포카드 세션이 없습니다.</td></tr>'}</tbody></table></div></section>`);const b=document.querySelector('#weak-practice');if(b)b.onclick=()=>{tab='quiz';weakOnly=true;start=1;end=52;render();};}
function downloadText(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function download(name,data){downloadText(name,JSON.stringify(data,null,2));}
function renderSettings(){main.setAttribute('data-product-settings','');main.setAttribute('data-settings-root','');main.innerHTML=`<div class="settings-groups"><section class="panel"><h3>기록 옮기기</h3><p class="subtle">${writeBlocked?'두 스택의 순서와 학습 기록,<br>포카드·기억법·복습 일정을 담습니다.<br>검증된 백업만 저장소의 원본을 바꿉니다.<br>이 화면의 기본 연습은 복구된 원본이 아닙니다.':'두 스택의 순서와 학습 기록,<br>포카드·기억법·복습 일정을 담습니다.<br>가져오면 현재 기록을 바꿉니다.<br>진행 중 퀴즈는 이어지지 않습니다.'}</p><button id="export" class="primary">백업 내려받기</button><label class="file-label">백업 가져오기<input id="import" type="file" accept=".json,application/json"></label><p class="hint">${writeBlocked?(originalRaw!=null?'저장된 원본은 바꾸지 않습니다. 검증된 백업을 가져오기 전에 기기에 원본을 보관하고 다운로드도 요청합니다. 이 화면의 기본 연습은 복구된 원본이 아닙니다.':'저장된 원본을 읽지 못했습니다. 검증된 백업을 가져오기 전에는 저장소를 바꾸지 않습니다. 이 화면의 기본 연습은 복구된 원본이 아닙니다.'):'잘못된 파일은 적용하지 않습니다.<br>적용 전에 현재 기록의<br>안전 백업 다운로드를 요청합니다.'}</p></section><section class="panel"><h3>카드 순서 가져오기</h3><p class="subtle">지금 스택의 순서만 바꿉니다.<br>가진 자료와 비교하세요.<br>순서를 바꾸면 이 스택의<br>학습·포카드·기억법 기록이 초기화됩니다.<br>장면·궁전·이야기·복습도 처음부터입니다.</p><textarea id="stack-json" aria-label="52장 카드 순서 JSON" placeholder='["QH", "2S", ... 52장]'></textarea><div class="controls"><button id="stack-export">현재 순서 받기</button><button id="stack-import">순서 적용</button></div><p class="hint">A·2-10·J·Q·K와 S♠ H♥ D♦ C♣. 중복 없는 52장 JSON입니다.</p></section><section class="panel"><h3>홈 화면에서 연습하기</h3><p class="subtle">브라우저 메뉴를 여세요.<br>‘홈 화면에 추가’ 또는<br>‘앱 설치’를 고르세요.</p><p class="hint">한 번 온라인으로 열면 이후 오프라인에서도 됩니다.<br>저장 공간을 지우면 기록도 사라지니 백업을 두세요.</p></section><section class="panel"><h3>순서의 출처</h3><p class="subtle">두 스택의 순서는 공개 자료끼리<br>서로 대조했습니다.<br>저자의 책을 직접 확인하지는 않았습니다.</p><p class="hint"><a href="https://mem-deck.com/stacks/redford/" target="_blank" rel="noopener">Redford · Mem Deck</a><br><a href="https://help.electricks.info/docs/peeksmith-app/card-stacks" target="_blank" rel="noopener">교차 확인 · Electricks</a><br><a href="https://mnemonica.app/blog/mnemonica-stack-order" target="_blank" rel="noopener">Mnemonica · Sinfonika</a></p></section></div><div class="magic-settings-footer"><h2 class="magic-contact-heading">의견 보내기</h2><p class="magic-contact-note"><span>수정할 점이나 버그,</span><span>새로운 아이디어가 있다면</span><span>카카오톡으로 알려주세요.</span></p><div class="magic-contact-actions"><a class="magic-contact-link" href="${contactHref(navigator)}">카카오톡 문의</a><button type="button" class="magic-contact-copy" id="contact-copy">ID 복사</button></div><details class="magic-contact-help"><summary>연결이 안 될 때</summary><p><span>카카오톡이 열리지 않으면</span><span>ID를 복사해 주세요.</span><span>카카오톡 친구 추가에서</span><span>ID 검색을 선택한 뒤</span><span>복사한 ID로 찾아 주세요.</span></p><p class="magic-contact-id">ID: KaliDCerona</p></details></div>`;document.querySelector('#contact-copy').onclick=()=>{const button=document.querySelector('#contact-copy');const text='KaliDCerona';const finish=ok=>{button.textContent=ok?'복사됨':'ID 복사';if(ok)setTimeout(()=>{if(button.isConnected&&button.textContent==='복사됨')button.textContent='ID 복사';},1500);};const fallback=()=>{try{const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.left='-999px';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();return ok;}catch{return false;}};const clip=navigator.clipboard;if(clip&&typeof clip.writeText==='function')clip.writeText(text).then(()=>finish(true),()=>finish(fallback()));else finish(fallback());};document.querySelector('#export').onclick=()=>{if(writeBlocked){if(originalRaw!=null){downloadText('memdeck-original-raw.json',originalRaw);message('저장소 원본 그대로의 다운로드를 요청했습니다. 이 화면의 기본 연습은 복구된 원본이 아닙니다.');}else message('저장된 원본을 읽지 못해 원본 파일을 만들 수 없습니다. 이 화면의 기본 연습은 복구된 원본이 아닙니다.');return;}download('memdeck-backup.json',state);};document.querySelector('#stack-export').onclick=()=>{if(writeBlocked){message('저장소 원본을 보호 중이라 이 화면의 순서를 원본처럼 내려받지 않습니다.');return;}download(`${state.selected}-order.json`,cards());};document.querySelector('#import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('백업 파일은 2MB 이하만 지원합니다.');const next=validateState(JSON.parse(await file.text()));prepareRecovery();if(!persist(next,{recovery:true}))throw new Error('브라우저 저장 공간에 쓰지 못해 백업을 적용하지 않았습니다.');state=next;questionStart=performance.now();render();message('백업을 가져왔습니다. 두 스택의 기록을 확인하세요.');}catch(error){message(`가져오기 실패: ${error.message} 기존 기록은 유지됩니다.`);}};document.querySelector('#stack-import').onclick=()=>{try{const next=validateCards(JSON.parse(document.querySelector('#stack-json').value));if(writeBlocked){message('저장소 원본을 보호 중이라 순서를 적용하지 않았습니다. 기존 순서와 기록은 유지됩니다.');return;}download('memdeck-before-order-change.json',state);const candidate=replaceStack(state,state.selected,next);if(!persist(candidate))throw new Error('브라우저 저장 공간에 쓰지 못해 순서를 적용하지 않았습니다.');state=candidate;render();message('카드 순서를 적용하고 이 스택의 기록을 새로 시작했습니다.');}catch(error){message(`순서 적용 실패: ${error.message} 기존 순서와 기록은 유지됩니다.`);}};}
function archiveActiveSession(){const s=state.session;if(!s)return;const total=s.results.length;if(total){const correct=s.results.filter(r=>r.correct).length,ms=s.results.reduce((a,r)=>a+r.ms,0),p=state.progress[s.stack];if(s.mode==='rank'){p.rankHistory.unshift({at:Date.now(),total,correct,ms});p.rankHistory=p.rankHistory.slice(0,100);}else{p.history.unshift({at:Date.now(),mode:s.mode,total,correct,ms});p.history=p.history.slice(0,100);}}state.session=null;}
function renderRank(){
  const s=state.session;
  if(!s||s.mode!=='rank'||s.stack!==state.selected){main.innerHTML=`<section class="panel">${header('포카드 위치 연습','같은 숫자·그림 네 장의 위치를 무늬별로 떠올립니다.')}<label>숫자·그림<select id="choose-rank"><option value="">13종 무작위 세션</option>${RANKS.map(r=>`<option>${r}</option>`).join('')}</select></label><button id="begin-rank" class="primary">포카드 연습 시작</button><p class="hint">포카드 기록은 한 장 퀴즈와 별도로 저장됩니다.</p></section>`;document.querySelector('#begin-rank').onclick=()=>{archiveActiveSession();state.session=newRankSession(state.selected,document.querySelector('#choose-rank').value||null);questionStart=performance.now();save();message('');renderRank();};return;}
  const rank=s.queue[s.index],result=s.results[s.index],expected=rankPositions(cards(),rank);
  main.innerHTML=`<section class="panel"><div class="spread">${header('포카드 위치 연습',`<span class="rank-progress">${s.index+1} / ${s.queue.length}</span>`)}<button id="finish-rank">종료</button></div><div class="practice-card"><span class="big">${rank}</span><span class="caption">네 무늬의 번호를 입력하세요.</span></div><form id="rank-form"><div class="quiz-answer">${Object.entries(SUITS).map(([suit,symbol])=>`<label>${rank}${symbol} 번호<input name="${suit}" aria-label="${rank}${symbol} 번호" inputmode="numeric" type="number" min="1" max="52" required ${s.answered?'disabled':''}></label>`).join('')}</div>${s.answered?`<div class="feedback ${result.correct?'':'error'}" role="status">${result.correct?'네 장 모두 정답입니다':'틀린 위치를 다시 연결해 보세요'}${Object.keys(SUITS).map(suit=>`<p>${result.suits[suit]?'✓ 정답':'✗ 오답'} · ${cardHTML(rank+suit)} = ${expected[suit]}번</p>`).join('')}<small>${(result.ms/1000).toFixed(1)}초</small></div><button id="next-question" type="button" class="primary">${s.index+1===s.queue.length?'결과 보기':'다음 질문 →'}</button>`:'<button type="submit" class="primary">네 장 정답 확인</button>'}</form></section>`;
  document.querySelector('#finish-rank').onclick=finishRank;
  document.querySelector('#rank-form').onsubmit=e=>{e.preventDefault();if(s.answered||submitting)return;try{const answers=Object.fromEntries(Object.keys(SUITS).map(k=>[k,e.target.elements[k].value]));state=answerRank(state,answers,Math.max(0,Math.round(performance.now()-questionStart)));save();message('');renderRank();}catch(error){message(error.message);}};
  if(s.answered)document.querySelector('#next-question').onclick=()=>{if(s.index+1===s.queue.length){finishRank();return;}s.index++;s.answered=false;questionStart=performance.now();save();message('');renderRank();};
}
function finishRank(){const s=state.session;if(!s||s.mode!=='rank')return;const total=s.results.length,correct=s.results.filter(r=>r.correct).length,ms=s.results.reduce((a,r)=>a+r.ms,0);if(total){state.progress[s.stack].rankHistory.unshift({at:Date.now(),total,correct,ms});state.progress[s.stack].rankHistory=state.progress[s.stack].rankHistory.slice(0,100);}state.session=null;save();tab='records';render();message(`포카드 연습: ${total}종 중 ${correct}종 네 장 모두 정답`);}
function commitMemory(candidate){
  let clean;
  try{clean=validateState(candidate);clean.session=candidate.session??null;}catch(error){message(error.message);return false;}
  if(writeBlocked){state=clean;return true;}
  if(!persist(clean)) return false;
  state=clean;
  return true;
}
function pack(){return progress().mnemonics||{images:{},palace:null,stories:[]};}
function imageFields(position){
  if(imageDrafts.has(position)) return imageDrafts.get(position);
  const image=pack().images[String(position)]||{};
  return {numberImage:image.numberImage||'',cardImage:image.cardImage||'',scene:image.scene||progress().notes[position]||''};
}
function sceneText(position){const image=pack().images[String(position)]||{};return image.scene||progress().notes[position]||starterScene(position,cards()[position-1]);}
function numberImageFor(position){const image=pack().images[String(position)]||{};return image.numberImage||starterNumberImage(position);}
function cardImageFor(position){const image=pack().images[String(position)]||{};return image.cardImage||starterCardImage(cards()[position-1]);}
function savedNote(text){message(writeBlocked?'이 화면에만 반영했습니다. 원본 기록은 바꾸지 않았습니다.':text);}
function memoryRangeValues(){const a=Number(document.querySelector('#mem-start').value),b=Number(document.querySelector('#mem-end').value);range(a,b);return [a,b];}
function memRangeHTML(){return `<div class="controls range"><label>시작<input id="mem-start" type="number" min="1" max="52" value="${memoryStart}"></label><label>끝<input id="mem-end" type="number" min="1" max="52" value="${memoryEnd}"></label><button type="button" id="mem-apply">적용</button></div>`;}
function stageName(stage){return {scene:'장면',cue:'단서',direct:'직접',pair:'짝'}[stage]||'연습';}
function storyTextFor(start,end){
  if(storyDraft&&storyDraft.start===start&&storyDraft.end===end) return storyDraft.text;
  const saved=pack().stories.find(story=>story.start===start&&story.end===end);
  if(saved) return saved.text;
  return starterStory(cards(),start,end);
}
function palaceModel(){
  if(palaceDraft) return palaceDraft;
  const saved=pack().palace;
  if(saved) return {title:saved.title,loci:saved.loci.map(locus=>({...locus})),example:false};
  return {title:STARTER_PALACE.title,loci:STARTER_PALACE.loci.map(locus=>({...locus})),example:true};
}
function readPalaceRaw(){
  const names=[...document.querySelectorAll('.locus-name')];
  const positions=[...document.querySelectorAll('.locus-pos')];
  return {title:document.querySelector('#palace-title').value,loci:names.map((input,index)=>({name:input.value,position:Number(positions[index].value)})),example:false};
}
function outcomeText(outcome,correct,item){
  const name=label(cards()[item.position-1]);
  const fact=item.direction==='locus'?`${name}의 장소는 ${item.locus}`:`${name}는 ${item.position}번`;
  if(outcome==='direct-correct') return `직접 맞췄습니다. ${fact}. 복습 간격에 반영합니다.`;
  if(outcome==='direct-wrong') return `직접 오답입니다. ${fact}. 복습으로 돌아갑니다.`;
  if(outcome==='revealed') return `답을 열었습니다. ${fact}. 맞춘 기록에 넣지 않습니다.`;
  return `${correct?'답은 맞습니다.':'답은 틀렸습니다.'} ${fact}. 단서가 있어 맞춘 기록에 넣지 않습니다.`;
}
function promptBlock(item){
  const card=cards()[item.position-1];
  if(train.answered) return `<span class="big">${cardHTML(card)}</span><span class="caption">${item.position}번${item.locus?` · ${escapeHTML(item.locus)}`:''}</span>`;
  if(item.stage==='pair'&&!train.concealed) return `<span class="big">${cardHTML(card)}</span><span class="caption">${item.position}번과 같이 보기</span>`;
  if(item.locus&&item.direction==='locus') return `<span class="big">${cardHTML(card)}</span><span class="caption">이 카드의 장소</span>`;
  if(item.locus) return `<span class="locus-title">${escapeHTML(item.locus)}</span><span class="caption">${item.direction==='position'?'이 장소의 카드':'이 장소의 번호'}</span>`;
  if(item.direction==='card') return `<span class="big">${cardHTML(card)}</span><span class="caption">몇 번일까요?</span>`;
  return `<span class="big">${item.position}</span><span class="caption">번째 카드</span>`;
}
function cueBlock(item){
  if(item.stage==='scene'&&!train.concealed&&!train.answered) return `<p class="association">${escapeHTML(sceneText(item.position))}</p>`;
  if(!train.usedHint||train.answered) return '';
  if(train.mode==='story') return `<p class="association">${escapeHTML(train.story||'이야기가 비어 있습니다.')}</p>`;
  if(train.mode==='palace'&&item.direction==='position') return `<p class="association">${escapeHTML(numberImageFor(item.position))}</p>`;
  if(train.mode==='palace'&&item.direction==='card') return `<p class="association">${escapeHTML(cardImageFor(item.position))}</p>`;
  return `<p class="association">${escapeHTML(numberImageFor(item.position))}<br>${escapeHTML(cardImageFor(item.position))}</p>`;
}
function answerControls(item){
  if(train.answered){
    const wrong=train.lastOutcome==='direct-wrong'||(train.lastOutcome==='hinted'&&train.lastCorrect===false);
    return `<div class="feedback ${wrong?'error':''}" role="status">${escapeHTML(outcomeText(train.lastOutcome,train.lastCorrect,item))}</div><div class="train-actions"><button type="button" id="next-drill" class="primary">다음</button></div>`;
  }
  const fields=item.direction==='locus'
    ?`<label>장소<input id="locus-answer" autocomplete="off" maxlength="${LIMITS.locus}"></label>`
    :item.direction==='position'
      ?`<label>숫자·그림<select id="rank" aria-label="숫자·그림">${RANKS.map(rank=>`<option>${rank}</option>`).join('')}</select></label><label>무늬<select id="suit" aria-label="무늬">${Object.entries(SUITS).map(([value,symbol])=>`<option value="${value}">${symbol}</option>`).join('')}</select></label>`
      :`<label>번호<input id="number" inputmode="numeric" type="number" min="1" max="52" required autocomplete="off"></label>`;
  return `<form id="answer-form"><div class="quiz-answer">${fields}</div><div class="train-actions"><button type="button" id="conceal">숨기기</button><button type="button" id="cue">단서</button><button type="submit" class="primary" id="check-answer">확인</button><button type="button" id="reveal-answer">답 보기</button></div></form>`;
}
function readAnswer(item){
  if(item.direction==='locus') return document.querySelector('#locus-answer').value;
  if(item.direction==='position') return document.querySelector('#rank').value+document.querySelector('#suit').value;
  const value=Number(document.querySelector('#number').value);
  return Number.isInteger(value)&&value>=1&&value<=52?value:null;
}
function finishAttempt(revealed){
  if(!train||train.phase!=='quiz'||train.answered||train.lock) return;
  const item=train.queue[train.index];
  let correct=false;
  if(!revealed){
    const answer=readAnswer(item);
    if(answer==null){message('1-52 사이의 번호를 입력하세요.');return;}
    correct=item.direction==='locus'?sameText(answer,item.locus):grade(cards(),{position:item.position,direction:item.direction},answer);
  }
  const outcome=classifyRecall({stage:item.stage,concealed:train.concealed,usedHint:train.usedHint,revealed,correct});
  const candidate=structuredClone(state);
  try{candidate.progress[state.selected]=applyRecall(progress(),item.position,outcome,Math.max(0,Math.round(performance.now()-questionStart)),Date.now(),schedulesRecall(item.stage));}
  catch(error){message(error.message);return;}
  train.lock=true;
  if(!commitMemory(candidate)){train.lock=false;return;}
  train.answered=true;train.lastCorrect=correct;train.lastOutcome=outcome;train.results.push({outcome,correct});
  train.queue=enqueueRetry(train.queue,train.index,outcome);train.lock=false;
  renderMemory();
  message(outcomeText(outcome,correct,item));
}
function nextDrill(){
  if(!train?.answered) return;
  if(train.index+1>=train.queue.length){finishTrain();return;}
  train.index++;train.answered=false;train.usedHint=false;train.concealed=train.queue[train.index].stage==='direct'||train.queue[train.index].stage==='cue';
  questionStart=performance.now();renderMemory();
}
function finishTrain(){
  const results=train?.results||[];
  const count=name=>results.filter(item=>item.outcome===name).length;
  train=null;renderMemory();
  message(results.length?`직접 맞춤 ${count('direct-correct')} · 직접 오답 ${count('direct-wrong')} · 단서 ${count('hinted')} · 답 보기 ${count('revealed')}`:'연습을 마쳤습니다.');
}
function openTrain(mode,queue,story=''){
  const first=queue[0];
  train={mode,phase:'quiz',queue,index:0,answered:false,concealed:first.stage==='direct'||first.stage==='cue',usedHint:false,results:[],lock:false,story,loci:[]};
  questionStart=performance.now();renderMemory();
}
function beginRanged(mode){
  try{
    const [start,end]=memoryRangeValues();
    const limit=mode==='story'?LIMITS.group:13;
    if(end-start+1>limit) throw new Error(mode==='story'?'이야기는 한 번에 8장까지입니다.':'한 번에 13장까지입니다. 긴 범위는 퀴즈를 쓰세요.');
    memoryStart=start;memoryEnd=end;
    const positions=range(start,end);
    if(mode==='pair'){openTrain(mode,buildPairQueue(positions));return;}
    if(mode==='image'){openTrain(mode,buildImageQueue(positions));return;}
    const text=document.querySelector('#story-text').value;
    groupPositions(start,end);
    if(text.length>LIMITS.story) throw new Error('이야기가 너무 깁니다.');
    storyDraft={start,end,text};
    openTrain(mode,buildDirectQueue(positions),text);
  }catch(error){message(error.message);}
}
function beginReview(){
  try{openTrain('review',buildReviewQueue(progress()));}
  catch(error){message(error.message);}
}
function usablePalace(raw){
  const loci=raw.loci.map(locus=>({name:locus.name.trim(),position:locus.position})).filter(locus=>locus.name);
  if(!loci.length&&raw.loci.length) throw new Error('장소 이름을 입력하세요.');
  const title=(raw.title||'').trim()||STARTER_PALACE.title;
  const chosen=loci.length?loci:STARTER_PALACE.loci.map(locus=>({...locus}));
  validateMnemonics({images:{},palace:{title,loci:chosen},stories:[]});
  return chosen;
}
function beginPalace(phase){
  try{
    const loci=train?.phase==='walk'&&phase==='quiz'?train.loci.map(locus=>({...locus})):usablePalace(readPalaceRaw());
    if(phase==='walk'){train={mode:'palace',phase:'walk',loci,index:0,concealed:false,results:[],queue:[],lock:false,answered:false,story:'',usedHint:false};renderMemory();return;}
    train={mode:'palace',phase:'quiz',queue:buildPalaceQueue(loci),index:0,answered:false,concealed:true,usedHint:false,results:[],lock:false,story:'',loci};
    questionStart=performance.now();renderMemory();
  }catch(error){message(error.message);}
}
function saveImage(){
  const fields={numberImage:document.querySelector('#num-image').value,cardImage:document.querySelector('#card-image').value,scene:document.querySelector('#scene-text').value};
  imageDrafts.set(imagePos,fields);
  const candidate=structuredClone(state);
  const mnemonic=candidate.progress[state.selected].mnemonics;
  mnemonic.images[String(imagePos)]=fields;
  candidate.progress[state.selected].notes[String(imagePos)]=fields.scene;
  if(!commitMemory(candidate)) return;
  imageDrafts.delete(imagePos);
  savedNote(`${imagePos}번 장면을 저장했습니다.`);
}
function savePalace(){
  const raw=readPalaceRaw();
  const loci=raw.loci.map(locus=>({name:locus.name.trim(),position:locus.position})).filter(locus=>locus.name);
  const candidate=structuredClone(state);
  candidate.progress[state.selected].mnemonics.palace={title:raw.title.trim(),loci};
  if(!commitMemory(candidate)) return;
  palaceDraft=null;renderMemory();savedNote('궁전을 이 스택에 저장했습니다.');
}
function saveStory(){
  try{
    const [start,end]=memoryRangeValues();
    const text=document.querySelector('#story-text').value;
    groupPositions(start,end);
    memoryStart=start;memoryEnd=end;storyDraft={start,end,text};
    const candidate=structuredClone(state);
    const stories=candidate.progress[state.selected].mnemonics.stories.filter(story=>!(story.start===start&&story.end===end));
    stories.push({start,end,text});
    candidate.progress[state.selected].mnemonics.stories=stories;
    if(!commitMemory(candidate)) return;
    storyDraft=null;renderMemory();savedNote('이야기를 이 스택에 저장했습니다.');
  }catch(error){message(error.message);}
}
function deleteStory(){
  const candidate=structuredClone(state);
  candidate.progress[state.selected].mnemonics.stories=candidate.progress[state.selected].mnemonics.stories.filter(story=>!(story.start===memoryStart&&story.end===memoryEnd));
  if(!commitMemory(candidate)) return;
  storyDraft=null;renderMemory();savedNote('이 범위의 이야기를 지웠습니다.');
}
function pairSetup(){return `<section class="panel"><p class="subtle">카드와 번호를 같이 봅니다.<br>한 쪽을 숨긴 뒤 확인하세요.</p>${memRangeHTML()}<div class="train-actions"><button type="button" id="start-pair" class="primary">시작</button></div><details><summary>안내</summary><p class="subtle">숨긴 뒤 맞춘 것만 직접 회상입니다.<br>단서와 답 보기는 정답률에 넣지 않습니다.</p></details></section>`;}
function imageSetup(){
  const positions=range(memoryStart,memoryEnd);
  if(!positions.includes(imagePos)) imagePos=positions[0];
  const fields=imageFields(imagePos),card=cards()[imagePos-1];
  return `<section class="panel"><p class="subtle">번호 그림, 카드 그림, 장면을 이 자리에 저장합니다.<br>연습은 장면, 단서, 직접 순서로 묻습니다.</p>${memRangeHTML()}<div class="practice-card compact"><span class="big">${cardHTML(card)}</span><span class="caption">${imagePos}번</span></div><label>위치<select id="image-pos">${positions.map(position=>`<option value="${position}">${position}번 ${label(cards()[position-1])}</option>`).join('')}</select></label><label>번호 그림<input id="num-image" maxlength="${LIMITS.image}" placeholder="${escapeHTML(starterNumberImage(imagePos))}" value="${escapeHTML(fields.numberImage)}"></label><label>카드 그림<input id="card-image" maxlength="${LIMITS.image}" placeholder="${escapeHTML(starterCardImage(card))}" value="${escapeHTML(fields.cardImage)}"></label><label>연결 장면<textarea id="scene-text" maxlength="${LIMITS.scene}" placeholder="${escapeHTML(starterScene(imagePos,card))}">${escapeHTML(fields.scene)}</textarea></label><div class="train-actions"><button type="button" id="save-image" class="primary">저장</button><button type="button" id="start-image">시작</button></div><details><summary>안내</summary><p class="subtle">비어 있으면 기본 그림이 연습에 쓰입니다.<br>저장한 내용은 이 스택의 이 번호에만 남습니다.<br>순서를 바꾸면 이 스택의 장면은 지워집니다.</p></details></section>`;
}
function palaceSetup(){
  const model=palaceModel();
  return `<section class="panel"><p class="subtle">익숙한 장소에 그 번호의 카드를 둡니다.<br>예시 다섯 곳으로 바로 걸을 수 있습니다.</p><label>궁전 이름<input id="palace-title" maxlength="${LIMITS.title}" value="${escapeHTML(model.title)}"></label>${model.example?'<p class="hint">지금 보이는 장소는 예시입니다.<br>저장 전에도 연습할 수 있습니다.</p>':''}<div class="locus-list">${model.loci.map((locus,index)=>`<div class="locus-row"><input class="locus-name" aria-label="장소 ${index+1}" maxlength="${LIMITS.locus}" value="${escapeHTML(locus.name)}"><input class="locus-pos" aria-label="번호 ${index+1}" type="number" min="1" max="52" value="${locus.position}"><button type="button" class="locus-del" data-del="${index}">삭제</button></div>`).join('')}</div><div class="train-actions"><button type="button" id="add-locus">장소 추가</button><button type="button" id="palace-example">예시</button><button type="button" id="save-palace" class="primary">저장</button></div><div class="train-actions"><button type="button" id="start-walk">걷기</button><button type="button" id="start-palace" class="primary">문제</button></div><details><summary>안내</summary><p class="subtle">문제는 장소, 번호, 카드를 섞어 묻습니다.<br>순서대로 걷지 않아도 답할 수 있습니다.<br>장소 이름은 글자를 비교해 채점합니다.</p></details></section>`;
}
function storySetup(){
  let text='',note='';
  try{text=storyTextFor(memoryStart,memoryEnd);}catch(error){note=error.message;}
  let line='';
  try{line=range(memoryStart,memoryEnd).map(position=>`<span>${position} ${cardHTML(cards()[position-1])}</span>`).join('');}catch{line='';}
  const saved=pack().stories.map((story,index)=>`<button type="button" data-story="${index}">${story.start}-${story.end}</button>`).join('');
  const hasSaved=pack().stories.some(story=>story.start===memoryStart&&story.end===memoryEnd);
  return `<section class="panel"><p class="subtle">이 범위의 실제 순서로 짧은 이야기를 만듭니다.<br>익힌 뒤 카드와 번호를 따로 묻습니다.</p>${memRangeHTML()}<div class="order-line">${line}</div>${note?`<p class="hint">${escapeHTML(note)}</p>`:''}<label>이야기<textarea id="story-text" maxlength="${LIMITS.story}">${escapeHTML(text)}</textarea></label><div class="train-actions"><button type="button" id="save-story" class="primary">저장</button><button type="button" id="story-example">예시</button><button type="button" id="start-story">시작</button>${hasSaved?'<button type="button" id="delete-story">삭제</button>':''}</div>${saved?`<div class="saved-stories">${saved}</div>`:''}<details><summary>안내</summary><p class="subtle">이야기는 이 스택에만 저장됩니다.<br>한 묶음은 8장까지입니다.<br>단서를 보면 맞춘 기록에 넣지 않습니다.</p></details></section>`;
}
function reviewSetup(){
  const due=duePositions(progress());
  const recall=Object.values(progress().recall||{}).reduce((sum,item)=>({direct:sum.direct+item.directCorrect,hinted:sum.hinted+item.hinted,revealed:sum.revealed+item.revealed,wrong:sum.wrong+item.directWrong}),{direct:0,hinted:0,revealed:0,wrong:0});
  return `<section class="panel"><p class="subtle">간격은 1·3·7·14·30일입니다.<br>오답과 단서는 1일로 돌아갑니다.</p><p class="hint">오늘 복습 ${due.length}장.<br>직접 ${recall.direct} · 오답 ${recall.wrong} · 단서 ${recall.hinted} · 답 보기 ${recall.revealed}</p><div class="train-actions"><button type="button" id="start-review" class="primary" ${due.length?'':'disabled'}>시작</button></div><details><summary>안내</summary><p class="subtle">기한 전 정답은 간격을 올리지 않습니다.<br>답을 연 경우는 맞춘 기록에 넣지 않습니다.<br>가장 빠른 방법이라고 보장하지 않습니다.</p></details></section>`;
}
function walkView(){
  const locus=train.loci[train.index],card=cards()[locus.position-1];
  return `<section class="panel"><div class="spread"><span class="pill">${train.index+1} / ${train.loci.length}</span><button type="button" id="end-drill">종료</button></div><div class="practice-card"><span class="locus-title">${escapeHTML(locus.name)}</span><span class="caption">${train.concealed?'카드와 번호를 가렸습니다':`${locus.position}번`}</span></div>${train.concealed?'':`<p class="association">${cardHTML(card)} = ${locus.position}번<br>${escapeHTML(sceneText(locus.position))}</p>`}<div class="train-actions"><button type="button" id="walk-prev">이전</button><button type="button" id="conceal">숨기기</button><button type="button" id="walk-next" class="primary">다음</button><button type="button" id="start-palace">문제</button></div></section>`;
}
function trainView(){
  if(train.phase==='walk') return walkView();
  const item=train.queue[train.index];
  return `<section class="panel"><div class="spread"><span class="pill">${train.index+1} / ${train.queue.length} · ${stageName(item.stage)}</span><button type="button" id="end-drill">종료</button></div><div class="practice-card">${promptBlock(item)}</div>${cueBlock(item)}${answerControls(item)}<p class="hint">직접 회상만 정답률에 들어갑니다.</p></section>`;
}
function renderMemory(){
  message('');
  const modes=[['pair','1 짝맞추기'],['image','2 숫자그림'],['palace','3 궁전'],['story','4 이야기'],['review','5 복습']];
  const body=train&&train.mode===trainMode?trainView():trainMode==='image'?imageSetup():trainMode==='palace'?palaceSetup():trainMode==='story'?storySetup():trainMode==='review'?reviewSetup():pairSetup();
  main.innerHTML=`<div class="learn">${header('기억 훈련','고른 스택의 실제 순서로 연습합니다.')}<div class="mode-switch">${modes.map(([id,name])=>`<button type="button" data-train="${id}" class="${trainMode===id?'selected':''}" aria-pressed="${trainMode===id}">${name}</button>`).join('')}</div>${body}</div>`;
  document.querySelectorAll('[data-train]').forEach(button=>button.onclick=()=>{const next=button.dataset.train;if(train&&train.mode!==next) train=null;trainMode=next;renderMemory();});
  const apply=document.querySelector('#mem-apply');
  if(apply) apply.onclick=()=>{try{const [start,end]=memoryRangeValues();if(trainMode==='story'&&end-start+1>LIMITS.group) throw new Error('이야기는 한 번에 8장까지입니다.');if(trainMode!=='story'&&end-start+1>13) throw new Error('한 번에 13장까지입니다. 긴 범위는 퀴즈를 쓰세요.');memoryStart=start;memoryEnd=end;if(imagePos<memoryStart||imagePos>memoryEnd) imagePos=memoryStart;storyDraft=null;renderMemory();}catch(error){message(error.message);}};
  const imageSelect=document.querySelector('#image-pos');
  if(imageSelect){imageSelect.value=String(imagePos);imageSelect.onchange=()=>{imageDrafts.set(imagePos,{numberImage:document.querySelector('#num-image').value,cardImage:document.querySelector('#card-image').value,scene:document.querySelector('#scene-text').value});imagePos=Number(imageSelect.value);renderMemory();};}
  const saveImageButton=document.querySelector('#save-image'); if(saveImageButton) saveImageButton.onclick=saveImage;
  const startPair=document.querySelector('#start-pair'); if(startPair) startPair.onclick=()=>beginRanged('pair');
  const startImage=document.querySelector('#start-image'); if(startImage) startImage.onclick=()=>beginRanged('image');
  const startStory=document.querySelector('#start-story'); if(startStory) startStory.onclick=()=>beginRanged('story');
  const startReview=document.querySelector('#start-review'); if(startReview) startReview.onclick=beginReview;
  const saveStoryButton=document.querySelector('#save-story'); if(saveStoryButton) saveStoryButton.onclick=saveStory;
  const deleteStoryButton=document.querySelector('#delete-story'); if(deleteStoryButton) deleteStoryButton.onclick=deleteStory;
  const storyExample=document.querySelector('#story-example'); if(storyExample) storyExample.onclick=()=>{try{const [start,end]=memoryRangeValues();memoryStart=start;memoryEnd=end;storyDraft={start,end,text:starterStory(cards(),start,end)};renderMemory();}catch(error){message(error.message);}};
  document.querySelectorAll('[data-story]').forEach(button=>button.onclick=()=>{const story=pack().stories[Number(button.dataset.story)];if(!story) return;memoryStart=story.start;memoryEnd=story.end;storyDraft={start:story.start,end:story.end,text:story.text};renderMemory();});
  const addLocus=document.querySelector('#add-locus'); if(addLocus) addLocus.onclick=()=>{const draft=readPalaceRaw();if(draft.loci.length>=LIMITS.loci){message('장소는 52개까지입니다.');return;}const used=new Set(draft.loci.map(locus=>locus.position));let position=1;while(used.has(position)&&position<=52) position++;draft.loci.push({name:'',position:Math.min(position,52)});palaceDraft=draft;renderMemory();};
  const palaceExample=document.querySelector('#palace-example'); if(palaceExample) palaceExample.onclick=()=>{palaceDraft={title:STARTER_PALACE.title,loci:STARTER_PALACE.loci.map(locus=>({...locus})),example:true};renderMemory();};
  const savePalaceButton=document.querySelector('#save-palace'); if(savePalaceButton) savePalaceButton.onclick=savePalace;
  document.querySelectorAll('.locus-del').forEach(button=>button.onclick=()=>{const draft=readPalaceRaw();draft.loci.splice(Number(button.dataset.del),1);palaceDraft=draft;renderMemory();});
  const startWalk=document.querySelector('#start-walk'); if(startWalk) startWalk.onclick=()=>beginPalace('walk');
  const startPalace=document.querySelector('#start-palace'); if(startPalace) startPalace.onclick=()=>beginPalace('quiz');
  const endDrill=document.querySelector('#end-drill'); if(endDrill) endDrill.onclick=finishTrain;
  const conceal=document.querySelector('#conceal'); if(conceal) conceal.onclick=()=>{train.concealed=!train.concealed;renderMemory();};
  const cue=document.querySelector('#cue'); if(cue) cue.onclick=()=>{train.usedHint=true;renderMemory();};
  const reveal=document.querySelector('#reveal-answer'); if(reveal) reveal.onclick=()=>finishAttempt(true);
  const form=document.querySelector('#answer-form'); if(form) form.onsubmit=event=>{event.preventDefault();finishAttempt(false);};
  const next=document.querySelector('#next-drill'); if(next) next.onclick=nextDrill;
  const walkPrev=document.querySelector('#walk-prev'); if(walkPrev) walkPrev.onclick=()=>{train.index=(train.index-1+train.loci.length)%train.loci.length;train.concealed=false;renderMemory();};
  const walkNext=document.querySelector('#walk-next'); if(walkNext) walkNext.onclick=()=>{train.index=(train.index+1)%train.loci.length;train.concealed=false;renderMemory();};
}
stackSelect.onchange=e=>{archiveActiveSession();state.selected=e.target.value;state.session=null;studyIndex=0;flipped=false;train=null;imageDrafts.clear();palaceDraft=null;storyDraft=null;save();render();};document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;if(['quiz','rank'].includes(tab)&&state.session&&!state.session.answered)questionStart=performance.now();if(tab==='memory'&&train?.phase==='quiz'&&!train.answered)questionStart=performance.now();render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)questionStart=performance.now();});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();
