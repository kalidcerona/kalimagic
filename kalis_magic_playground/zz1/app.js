import { installSettingsSwipe } from "./settings-swipe.js";
    import { LANDSCAPE_CONTROL_IS_IMMEDIATE, applyPresetGroupSwipe, applyPresetSlot, applyPresetSwipe, clampElapsed, colonClassFor, composeCs, digitFromPoint, elapsedAtAction, formatCs, formatTimeInput, isLeftmostScreenFifth, landscapePresetHoldApplies, loadNamedPresets, loadPresetSlots, migrateV2Storage, nativeStopwatchRender, nextSwipeAccumulator, nextTrickState, normalizeNamedPreset, normalizePresetSlot, normalizeSequence, normalizeTrickState, parseSequence, parseStopwatchText, parseTimeInput, portraitPresetEntryFromCs, presetRenderModel, presetGroupIndexFromPoint, presetIndexFromX, presetSwipePxPerStep, presetSwipeSteps, pushPendingDigit, recognizesModeToggle, resolveSequenceStop, resolveStoppedCs, resolveStopOutcome, saveNamedPresets, savePortraitGroupPreset, savePresetSlots, storedMode, toAppPoint, transitionAlarmPreset } from "./logic.js";
import { runSelfTests } from "./selftest.js";
import { showSettingsEntryTutorial } from "./settings-tutorial.js";
import { wakeLock, acquireWakeLock } from "./wake-lock.js";
import { installLocalPreview } from './local-preview.js'; // local-preview-hook
    const $ = id => document.getElementById(id);
    const shell=$("shell"), portraitApp=$("portrait-app"), landscapeFrame=$("landscape-frame"), landscapeApp=$("landscape-app");
    const pTime=$("p-time-display"),pNumeric=$("p-numeric-display"),pMinutes=$("p-minutes"),pCustom=$("p-custom-display"),pColon=$("p-colon"),pControl=$("p-control"),pLap=$("p-lap"),pLapArea=$("p-lap-area"),pLapRows=$("p-lap-rows"),pDigitGuide=$("p-digit-guide"),pDigitGuideOn=$("p-digit-guide-enabled"),pWorld=portraitApp.querySelector(".tab-world"),pAlarm=portraitApp.querySelector("#p-tabs .tab:nth-child(2)"),pTimer=portraitApp.querySelector("#p-tabs .tab:nth-child(4)"),pDigits=[...pTime.querySelectorAll("[data-p-digit]")],pGroups=[...pTime.querySelectorAll("[data-p-group]")];
    const lTime=$("l-time-display"),lMinutesPrefix=$("l-minutes-prefix"),lDecimal=$("l-decimal-separator"),lSeconds=$("l-seconds"),lCs=$("l-centiseconds"),lCustom=$("l-custom-display"),lColon=$("l-colon"),lControl=$("l-control"),lControlLabel=$("l-control-label"),lHitZones=$("l-main-hit-zones"),lDigits=[...lTime.querySelectorAll("[data-l-digit]")];
    const pMinuteDigits=[...pMinutes.querySelectorAll("[data-p-minute]")],lMinuteDigits=[...lMinutesPrefix.querySelectorAll("[data-l-minute]")];
    const presetHint=$("preset-hint");
    const settings=$("settings"),settingsClose=$("settings-close"),modePortrait=$("mode-portrait"),modeLandscape=$("mode-landscape"),slotKindText=$("slot-kind-text"),slotKindSeq=$("slot-kind-seq"),trick2Text=$("trick2-text"),sequenceInput=$("sequence-input"),sequenceSlots=$("sequence-slots"),sequenceStatus=$("sequence-status"),presetEditor=$("preset-editor"),presetName=$("preset-name"),presetForceAfter=$("preset-force-after"),sequenceChips=$("sequence-chips"),quickSettings=$("quick-settings"),quickValue=$("quick-value"),quickStatus=$("quick-status");
    const PRESET_KEY="stopwatch_preset_cs",PRESET_AT_KEY="stopwatch_preset_at",TEXT_KEY="stopwatch_custom_text",TEXT_AT_KEY="stopwatch_text_at",MODE_KEY="stopwatch_ui_mode",SEQUENCE_KEY="stopwatch_seq",SEQUENCE_SLOTS_KEY="stopwatch_seq_slots",TRICK3_KEY="stopwatch_trick3",DIGIT_GUIDE_KEY="stopwatch_portrait_digit_guide_v1";
    const HOLD_MS=1000,PAIR_MS=120,TRIPLE_MS=800;
    let uiMode="portrait",state="idle",trickState="off",trick3Enabled=false,sequence=[],presetSlotValues=[0,1,2].map(index=>normalizeNamedPreset(null,index)),slotSaveKind="seq",sequenceStopCount=0,sequenceForceAfter=2,sequenceDraft=[],editingSlotIndex=null,customText="",presetCs=null,presetAt=0,textAt=0,presetEntry="0000",presetMode=false,presetKind=null,presetGesture=null;
    let pendingDigits=[],reservedTens=null,stopDigit=null,startedAt=0,elapsedBase=0,frameId=0,lapCount=0,lastLapElapsed=0,hold=null,tap=null,alarmTap=null,suppressClick=false,hintTimer=0,stoppedOutcome=null;
    let pressed=false,resizeObserver=null,digitGuideToken=0,digitGuideHold=0,digitGuideFade=0,digitGuideShown=false;
    const activePointers=new Map(),pairedPointers=new Set(),pendingLandscapeActions=new Map();let pairCandidate=null,twoFingerTaps=[];
    function paintDigitNodes(nodes,text){const value=String(text??"");nodes.forEach((node,index)=>{node.textContent=value[index]||"0";});}
    function renderNative(model){if(uiMode==="portrait"){pCustom.hidden=true;pNumeric.hidden=false;paintDigitNodes(pMinuteDigits,model.portraitDigits.slice(0,2));pDigits.forEach((s,i)=>s.textContent=model.portraitDigits[i+2]);return;}const hasMinutes=model.showLandscapeMinutes;lMinutesPrefix.hidden=!hasMinutes;paintDigitNodes(lMinuteDigits,hasMinutes?model.landscapeMinutes:"00");lTime.classList.toggle("with-minutes",hasMinutes);lCustom.hidden=true;lSeconds.hidden=false;lColon.hidden=hasMinutes;lDecimal.hidden=!hasMinutes;lCs.hidden=false;lDigits.forEach((s,i)=>s.textContent=model.landscapeDigits[i]);}
    function renderCs(totalCs){renderNative(nativeStopwatchRender(totalCs));}
    function renderPortraitPresetEntry(entry){pCustom.hidden=true;pNumeric.hidden=false;paintDigitNodes(pMinuteDigits,entry.slice(0,2));pDigits.forEach((s,i)=>s.textContent=entry[i+2]);}
    function renderCustomText(text){const model=presetRenderModel(text);if(model.kind==="digits"){renderNative(model);return;}if(uiMode==="portrait"){pNumeric.hidden=true;pCustom.hidden=false;pCustom.textContent=model.text;return;}lMinutesPrefix.hidden=true;lDecimal.hidden=true;lTime.classList.remove("with-minutes");lSeconds.hidden=true;lColon.hidden=true;lCs.hidden=true;lCustom.hidden=false;lCustom.textContent=model.text;}
    function gradient(base,down){const top=`color-mix(in srgb, ${base} 82%, #ffffff)`,value=`linear-gradient(180deg, ${top} 0%, ${base} 100%)`;return down?`linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.12)), ${value}`:value;}
    function renderState(){pControl.textContent=state==="running"?"중단":"시작";pControl.classList.toggle("running",state==="running");pLap.textContent=state==="stopped"&&elapsedBase>0?"재설정":"랩";pLap.disabled=state!=="running"&&elapsedBase===0;pColon.className=`colon ${colonClassFor(trickState)}`;lColon.className=`colon ${colonClassFor(trickState)}`;let label="START",bg=gradient("#4c6ef5",pressed);if(state==="running"){label="STOP";bg=gradient("#e03131",pressed);}else if(state==="stopped"){label="RESET";const base="linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.12))";bg=pressed?`linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.12)),${base}`:base;}lControlLabel.textContent=label;lControl.setAttribute("aria-label",label);lControl.style.background=bg;lControl.style.transform=pressed?"scale(.96)":"none";}
    function elapsedNow(){return clampElapsed(elapsedBase+(state==="running"?performance.now()-startedAt:0));}
    function stopTimer(event,atLimit=false){elapsedBase=atLimit?59990:event&&Number.isFinite(event.actionNow)?elapsedAtAction(elapsedBase,startedAt,event.actionNow):elapsedNow();cancelAnimationFrame(frameId);frameId=0;state="stopped";if(uiMode==="landscape"&&event&&trickState==="digit")stopDigit=digitFromLandscapeEvent(event);const outcome=resolveStopOutcome({trickState,presetCs,customText,elapsed:elapsedBase,reservedTens,stopDigit,presetAt,textAt,stopCount:sequenceStopCount,sequence,sequenceForceAfter});sequenceStopCount=outcome.nextStopCount;stoppedOutcome=outcome;if(outcome.kind==="text")renderCustomText(outcome.text);else renderCs(outcome.cs);pendingDigits=[];reservedTens=stopDigit=null;pWorld.classList.remove("feedback");renderState();}
    function tick(){if(state!=="running")return;const elapsed=elapsedNow();if(elapsed>=59990){stopTimer(null,true);return;}renderCs(Math.floor(elapsed/10));frameId=requestAnimationFrame(tick);}
    function startTimer(event){if(elapsedBase>=59990)return;stoppedOutcome=null;if(uiMode==="landscape"){elapsedBase=0;lastLapElapsed=0;if(trickState==="digit"&&event)reservedTens=digitFromLandscapeEvent(event);}startedAt=event&&Number.isFinite(event.actionNow)?event.actionNow:performance.now();state="running";renderCs(Math.floor(elapsedBase/10));renderState();tick();}
    function resetTimer(preserveSequence=false){cancelAnimationFrame(frameId);frameId=0;state="idle";elapsedBase=0;stoppedOutcome=null;if(!preserveSequence)sequenceStopCount=0;pendingDigits=[];reservedTens=stopDigit=null;lapCount=lastLapElapsed=0;pLapRows.replaceChildren();pWorld.classList.remove("feedback");renderCs(0);renderState();}
    function addLap(){const elapsed=elapsedNow(),split=formatCs(Math.floor((elapsed-lastLapElapsed)/10));lastLapElapsed=elapsed;const row=document.createElement("div"),label=document.createElement("span"),value=document.createElement("span");row.className="lap-row";label.textContent=`랩 ${++lapCount}`;value.textContent=`00:${split.sec}.${split.cs}`;row.append(label,value);pLapRows.prepend(row);}
    function updateModeButtons(){modePortrait.setAttribute("aria-pressed",String(uiMode==="portrait"));modeLandscape.setAttribute("aria-pressed",String(uiMode==="landscape"));}
    function hidePortraitDigitGuide(){digitGuideToken++;clearTimeout(digitGuideHold);clearTimeout(digitGuideFade);digitGuideHold=digitGuideFade=0;pDigitGuide.classList.remove("is-fading");pDigitGuide.hidden=true;pDigitGuide.setAttribute("aria-hidden","true");}
    function showPortraitDigitGuide(){if(digitGuideShown||!pDigitGuideOn.checked||uiMode!=="portrait"||trickState!=="off"||presetMode||!settings.hidden||!quickSettings.hidden)return;digitGuideShown=true;hidePortraitDigitGuide();const token=digitGuideToken;pDigitGuide.hidden=false;pDigitGuide.setAttribute("aria-hidden","false");digitGuideHold=setTimeout(()=>{if(token!==digitGuideToken)return;pDigitGuide.classList.add("is-fading");digitGuideFade=setTimeout(()=>{if(token!==digitGuideToken)return;hidePortraitDigitGuide();},450);},800);}
    function setMode(mode,persist=true){uiMode=mode==="landscape"?"landscape":"portrait";shell.dataset.uiMode=uiMode;portraitApp.hidden=uiMode!=="portrait";landscapeFrame.hidden=uiMode!=="landscape";updateModeButtons();if(persist)try{localStorage.setItem(MODE_KEY,uiMode);}catch(_){}renderState();if(state==="stopped"&&stoppedOutcome){if(stoppedOutcome.kind==="text")renderCustomText(stoppedOutcome.text);else renderCs(stoppedOutcome.cs);}else renderCs(Math.floor(elapsedNow()/10));requestAnimationFrame(updateLandscapeHitZones);if(uiMode==="landscape")hidePortraitDigitGuide();}
    function toggleMode(){exitPresetMode(false);clearHold();setMode(uiMode==="portrait"?"landscape":"portrait");}
    function isPrimaryPointer(e){return e.isPrimary!==false&&(e.button===undefined||e.button===0);}
    function clearHold(){if(hold)clearTimeout(hold.timer);hold=null;}
    function beginHold(e,action,delay=HOLD_MS){if(!isPrimaryPointer(e)||presetMode||hold||!settings.hidden||!quickSettings.hidden)return;e.preventDefault();hold={pointerId:e.pointerId,x:e.clientX,y:e.clientY,timer:setTimeout(()=>{const done=hold;hold=null;action(done);},delay)};}
    function showHint(text){clearTimeout(hintTimer);presetHint.textContent=text;presetHint.hidden=false;hintTimer=setTimeout(()=>presetHint.hidden=true,2000);}
    function storePresetCs(value){presetCs=value>0?Math.min(5999,value):null;presetAt=presetCs===null?0:Date.now();try{if(presetCs===null){localStorage.removeItem(PRESET_KEY);localStorage.removeItem(PRESET_AT_KEY);}else{localStorage.setItem(PRESET_KEY,String(presetCs));localStorage.setItem(PRESET_AT_KEY,String(presetAt));}}catch(_){}}
    function storeCustomText(value){customText=String(value??"").trim();textAt=customText?Date.now():0;try{if(customText){localStorage.setItem(TEXT_KEY,customText);localStorage.setItem(TEXT_AT_KEY,String(textAt));}else{localStorage.removeItem(TEXT_KEY);localStorage.removeItem(TEXT_AT_KEY);}}catch(_){}return customText;}
    function loadStorage(){migrateV2Storage(localStorage);uiMode=storedMode(localStorage);try{customText=localStorage.getItem(TEXT_KEY)||"";textAt=Number(localStorage.getItem(TEXT_AT_KEY))||0;const raw=localStorage.getItem(PRESET_KEY),value=raw!==null&&/^\d{1,6}$/.test(raw)?Number(raw):NaN;presetCs=Number.isInteger(value)&&value>=0&&value<=603999?value:null;presetAt=Number(localStorage.getItem(PRESET_AT_KEY))||0;sequence=parseSequence(localStorage.getItem(SEQUENCE_KEY)||"");presetSlotValues=loadNamedPresets(localStorage);trick3Enabled=localStorage.getItem(TRICK3_KEY)==="1";trickState=normalizeTrickState(trickState,trick3Enabled);}catch(_){customText="";presetCs=null;sequence=[];presetSlotValues=[0,1,2].map(index=>normalizeNamedPreset(null,index));trick3Enabled=false;trickState="off";}}
    function updateSequenceStatus(){const active=normalizeSequence(sequence);sequenceStatus.textContent=`현재 사용: ${trickState==="seq"?`프리셋 모드 · 숫자 순서 (${active||"비어 있음"})`:trickState==="text"?"프리셋 모드 · 문구 숫자":trickState==="digit"?"숫자 모드":"일반 스톱워치"}`;}
    function renderSequenceSlots(){
      sequenceSlots.replaceChildren();
      presetSlotValues.forEach((slot,index)=>{
        const row=document.createElement("div"),label=document.createElement("span"),title=document.createElement("strong"),summary=document.createElement("small"),actions=document.createElement("div"),apply=document.createElement("button"),edit=document.createElement("button"),empty=!slot.value;
        row.className=`sequence-slot${empty?" empty":""}`;row.dataset.slot=String(index);label.className="sequence-slot-value";
        title.textContent=slot.name;summary.textContent=empty?"비어 있음":slot.kind==="seq"?`숫자 순서 · ${slot.value} · ${slot.forceAfter}번 정지 뒤`:`문구 숫자 · ${slot.value}`;
        label.append(title,summary);actions.className="sequence-slot-actions";
        apply.className="sequence-slot-apply";apply.type="button";apply.textContent="적용";apply.disabled=empty;apply.setAttribute("aria-label",`${slot.name} 적용`);
        edit.className="sequence-slot-edit";edit.type="button";edit.textContent="편집";edit.setAttribute("aria-label",`${slot.name} 편집`);
        actions.append(apply,edit);row.append(label,actions);sequenceSlots.append(row);
      });
    }
    function renderSequenceDraft(){
      sequenceChips.replaceChildren(...sequenceDraft.map((value,index)=>{
        const chip=document.createElement("button");chip.type="button";chip.dataset.index=String(index);
        chip.textContent=`${String(value).padStart(2,"0")} ×`;chip.setAttribute("aria-label",`${index+1}번째 값 삭제`);return chip;
      }));
    }
    function setSlotSaveKind(kind){
      slotSaveKind=kind==="text"?"text":"seq";
      slotKindText.setAttribute("aria-pressed",String(slotSaveKind==="text"));slotKindSeq.setAttribute("aria-pressed",String(slotSaveKind==="seq"));
      $("preset-text-fields").hidden=slotSaveKind!=="text";$("preset-sequence-fields").hidden=slotSaveKind!=="seq";
    }
    function editPreset(index){
      if(!Number.isInteger(index)||index<0||index>=presetSlotValues.length)return;
      const slot=presetSlotValues[index];editingSlotIndex=index;presetName.value=slot.value?slot.name:"";
      trick2Text.value=slot.kind==="text"?slot.value:"";sequenceDraft=slot.kind==="seq"?parseSequence(slot.value):[];
      sequenceInput.value="";presetForceAfter.value=String(slot.forceAfter);setSlotSaveKind(slot.kind);
      $("preset-editor-title").textContent=`${index+1}번 프리셋 ${slot.value?"편집":"만들기"}`;
      renderSequenceDraft();presetEditor.hidden=false;presetEditor.scrollIntoView({block:"nearest"});
    }
    function savePresetEditor(){
      if(editingSlotIndex===null)return;
      const pending=sequenceInput.value.trim();
      if(slotSaveKind==="seq"&&pending){
        if(!/^\d{1,2}$/.test(pending)||sequenceDraft.length>=8){sequenceStatus.textContent="00-99 숫자를 최대 8개까지 추가할 수 있습니다.";return;}
        sequenceDraft.push(Number(pending));sequenceInput.value="";
      }
      const value=slotSaveKind==="seq"?normalizeSequence(sequenceDraft):trick2Text.value.trim();
      if(!value){sequenceStatus.textContent="표시할 값을 먼저 입력하세요.";return;}
      const slot=normalizeNamedPreset({name:presetName.value,kind:slotSaveKind,value,forceAfter:Number(presetForceAfter.value)},editingSlotIndex);
      presetSlotValues[editingSlotIndex]=slot;
      try{presetSlotValues=saveNamedPresets(localStorage,presetSlotValues);}catch(_){sequenceStatus.textContent="저장 공간을 확인하세요. 이번 실행에서만 사용할 수 있습니다.";}
      presetEditor.hidden=true;renderSequenceSlots();sequenceStatus.textContent=`${slot.name} 저장됨 · 적용 버튼을 누르면 사용합니다.`;
    }
    function openSettings(section="general"){
      if(state==="running"||presetMode||!settings.hidden||!quickSettings.hidden)return;
      $("settings-entry-tutorial").hidden=true;
      settings.classList.toggle("preset-focus",section==="presets");$("settings-title").textContent=section==="presets"?"프리셋":"설정";
      presetEditor.hidden=true;editingSlotIndex=null;updateModeButtons();renderSequenceSlots();updateSequenceStatus();settings.hidden=false;settings.scrollTop=0;
    }
    function closeSettings(){cancelPendingInteractions();settings.hidden=true;trick2Text.blur();sequenceInput.blur();presetName.blur();hidePortraitDigitGuide();}
    function applyPresetSlotToDom(slot){
      const applied=applyPresetSlot(slot,{customText,sequence,trick3Enabled});
      if(applied){customText=applied.customText;sequence=applied.sequence;trickState=applied.trickState;trick3Enabled=applied.trick3Enabled;sequenceStopCount=0;sequenceForceAfter=slot.forceAfter??2;textAt=customText?Date.now():0;
        try{if(customText){localStorage.setItem(TEXT_KEY,customText);localStorage.setItem(TEXT_AT_KEY,String(textAt));}else{localStorage.removeItem(TEXT_KEY);localStorage.removeItem(TEXT_AT_KEY);}localStorage.setItem(SEQUENCE_KEY,normalizeSequence(sequence));localStorage.setItem(TRICK3_KEY,trick3Enabled?"1":"0");}catch(_){}
        updateSequenceStatus();renderState();
      }
      closeSettings();
    }
    function openQuickSettings(){
      if(uiMode!=="portrait"||state==="running"||presetMode||!settings.hidden)return;
      quickValue.value="";quickStatus.textContent="";quickSettings.hidden=false;
    }
    function closeQuickSettings(){quickSettings.hidden=true;quickValue.blur();}
    function applyQuickValue(){
      const value=quickValue.value.trim();if(!value){quickStatus.textContent="표시할 값을 입력하세요.";return;}
      storeCustomText(value);trickState="text";trick3Enabled=false;sequenceStopCount=0;
      try{localStorage.setItem(TRICK3_KEY,"0");}catch(_){}
      updateSequenceStatus();renderState();closeQuickSettings();
    }
    function pTrackRect(){const first=pDigits[0].getBoundingClientRect(),last=pDigits[3].getBoundingClientRect();return{left:first.left,width:last.right-first.left};}
    function selectPortraitDigit(index){pDigits.forEach((s,i)=>s.classList.toggle("selected",i===index));}
    function enterPortraitPreset(pointerId,x,y){if(state==="running"||presetMode)return;resetTimer();presetEntry=portraitPresetEntryFromCs(presetCs??0).slice(2);presetMode=true;presetKind="portrait-digit";portraitApp.classList.add("preset-mode");renderCs(Number(presetEntry));const track=pTrackRect(),index=presetIndexFromX(x,track.left,track.width);selectPortraitDigit(index);presetGesture={kind:"portrait-digit",pointerId,index,x,y,entry:presetEntry,moved:false};try{portraitApp.setPointerCapture(pointerId);}catch(_){}suppressClick=true;showHint("위아래로 밀어 숫자를 바꾸세요");}
    function isRotatedLayout(){return matchMedia("(orientation: portrait)").matches;}
    function appSize(){const r=isRotatedLayout();return{width:r?innerHeight:innerWidth,height:r?innerWidth:innerHeight};}
    function appRect(el){const rect=el.getBoundingClientRect(),rotated=isRotatedLayout(),origin=toAppPoint(rotated?rect.right:rect.left,rect.top,innerWidth,innerHeight,rotated);return{left:origin.x,top:origin.y,width:rotated?rect.height:rect.width,height:rotated?rect.width:rect.height};}
    function digitFromLandscapeEvent(e){const rect=appRect(lControl),p=toAppPoint(e.clientX,e.clientY,innerWidth,innerHeight,isRotatedLayout());return digitFromPoint(p.x-rect.left,p.y-rect.top,rect.width,rect.height);}
    function enterLandscapePreset(){if(state==="running"||presetMode)return;resetTimer();presetEntry=portraitPresetEntryFromCs(presetCs??0).slice(2);presetMode=true;presetKind="landscape-group";landscapeApp.classList.add("preset-mode");setLandscapeGroup(null);renderCs(Number(presetEntry));showHint("위아래로 밀어 두 자리씩 맞추고, 빈 곳을 탭하면 저장");}
    function enterAlarmPreset(){const next=transitionAlarmPreset({uiMode,timerState:state,presetMode,presetKind,editorOpen:false,storedUiMode:uiMode},"enter");if(!next.presetMode||next.presetKind!=="portrait-group")return;resetTimer();presetEntry=portraitPresetEntryFromCs(presetCs??0);presetMode=true;presetKind="portrait-group";portraitApp.classList.add("preset-mode","portrait-group-preset-mode");setPortraitGroup(null);renderPortraitPresetEntry(presetEntry);showHint("위아래로 밀어 두 자리씩 맞추고, 빈 곳을 탭하면 저장");}
    function setPortraitGroup(group){pGroups.forEach((el,i)=>el.classList.toggle("preset-active",i===group));}
    function setLandscapeGroup(group){lSeconds.classList.toggle("preset-active",group===0);lCs.classList.toggle("preset-active",group===1);lDigits.forEach((s,i)=>s.classList.toggle("preset-active",(i<2?0:1)===group));}
    function exitPresetMode(save){if(!presetMode)return;if(save){if(presetKind==="portrait-group"){try{const saved=savePortraitGroupPreset(localStorage,presetEntry);if(saved){presetCs=saved.presetCs;presetAt=saved.presetAt;}}catch(_){}}else storePresetCs(Number(presetEntry));}presetMode=false;presetKind=null;presetGesture=null;portraitApp.classList.remove("preset-mode","portrait-group-preset-mode");landscapeApp.classList.remove("preset-mode");selectPortraitDigit(null);setPortraitGroup(null);setLandscapeGroup(null);presetHint.hidden=true;clearTimeout(hintTimer);renderCs(0);}
    function handlePresetDown(e){
      if(!presetMode||!isPrimaryPointer(e))return;
      if(presetKind==="portrait-group"&&e.target.closest("#p-control")){exitPresetMode(false);return;}
      e.preventDefault();e.stopImmediatePropagation();
      if(presetKind==="portrait-group"){
        if(e.target.closest("#p-tabs .tab:nth-child(2)")){presetGesture={kind:"portrait-group-cancel",pointerId:e.pointerId,x:e.clientX,y:e.clientY,moved:false};}
        else if(e.target.closest("#p-buttons,#p-tabs")){presetGesture={kind:"blocked",pointerId:e.pointerId,x:e.clientX,y:e.clientY,moved:false};}
        else{const rect=pNumeric.getBoundingClientRect(),group=presetGroupIndexFromPoint(e.clientX,e.clientY,rect,3);setPortraitGroup(group);presetGesture={kind:"portrait-group",pointerId:e.pointerId,groupIndex:group,start:{x:e.clientX,y:e.clientY},lastY:e.clientY,lastT:e.timeStamp||performance.now(),acc:0,moved:false,saveOnTap:group===null&&!e.target.closest("#p-time-display,#p-tabs,#p-buttons,#install-nudge")};}
      }else if(presetKind==="portrait-digit"){
        const track=pTrackRect(),index=presetIndexFromX(e.clientX,track.left,track.width);selectPortraitDigit(index);presetGesture={kind:"portrait-digit",pointerId:e.pointerId,index,x:e.clientX,y:e.clientY,entry:presetEntry,moved:false};
      }else{
        const point=toAppPoint(e.clientX,e.clientY,innerWidth,innerHeight,isRotatedLayout()),group=presetGroupIndexFromPoint(point.x,point.y,appRect(lTime));setLandscapeGroup(group);presetGesture={kind:"landscape-group",pointerId:e.pointerId,groupIndex:group,start:point,lastY:point.y,lastT:e.timeStamp||performance.now(),acc:0,moved:false,saveOnTap:group===null};
      }
      try{(uiMode==="portrait"?portraitApp:landscapeApp).setPointerCapture(e.pointerId);}catch(_){}
    }
    function handlePointerMove(e){if(hold&&hold.pointerId===e.pointerId&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>10)clearHold();if(tap&&tap.pointerId===e.pointerId&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>10)tap=null;if(alarmTap&&alarmTap.pointerId===e.pointerId&&Math.hypot(e.clientX-alarmTap.x,e.clientY-alarmTap.y)>10)alarmTap=null;const p=activePointers.get(e.pointerId);if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>15)p.moved=true;const g=presetGesture;if(!g||g.pointerId!==e.pointerId)return;e.preventDefault();if(g.kind==="portrait-digit"){if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>10)g.moved=true;if(g.index!==null){presetEntry=applyPresetSwipe(g.entry,g.index,Math.trunc((g.y-e.clientY)/28));renderCs(Number(presetEntry));}}else if(g.kind==="portrait-group"||g.kind==="landscape-group"){const point=g.kind==="portrait-group"?{x:e.clientX,y:e.clientY}:toAppPoint(e.clientX,e.clientY,innerWidth,innerHeight,isRotatedLayout());if(Math.hypot(point.x-g.start.x,point.y-g.start.y)>10)g.moved=true;if(g.groupIndex===null)return;const now=e.timeStamp||performance.now(),delta=g.lastY-point.y,dt=now-g.lastT,velocity=dt>0?Math.abs(delta)/dt:0;g.acc+=delta;g.lastY=point.y;g.lastT=now;const steps=presetSwipeSteps(g.acc,velocity);g.acc=nextSwipeAccumulator(g.acc,steps,presetSwipePxPerStep(velocity),20);if(steps){presetEntry=applyPresetGroupSwipe(presetEntry,g.groupIndex,steps);if(g.kind==="portrait-group")renderPortraitPresetEntry(presetEntry);else renderCs(Number(presetEntry));}}else if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>10)g.moved=true;}
    function handlePresetEnd(e){const g=presetGesture;if(!g||g.pointerId!==e.pointerId)return;if(e.type==="pointerup")handlePointerMove(e);presetGesture=null;const target=g.kind==="landscape-group"?landscapeApp:portraitApp;try{if(target.hasPointerCapture(e.pointerId))target.releasePointerCapture(e.pointerId);}catch(_){}if(e.type==="pointerup"&&!g.moved){if(g.kind==="portrait-group-cancel")exitPresetMode(false);else if((g.kind==="portrait-group"||g.kind==="landscape-group")&&g.saveOnTap)exitPresetMode(true);}setTimeout(()=>suppressClick=false,0);}
    function updateLandscapeHitZones(){if(uiMode!=="landscape")return;const t=appRect(lTime),c=appRect(lControl),bottom=Math.min(t.top+t.height,c.top-4,appSize().height);lHitZones.style.height=`${Math.max(0,bottom)}px`;}
    function pointerSnapshot(e){return{pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY,isPrimary:true,button:0,actionNow:performance.now(),preventDefault(){}};}
    function deferLandscapeAction(e,fn){if(pairedPointers.has(e.pointerId))return;const snapshot=pointerSnapshot(e);const timer=setTimeout(()=>{pendingLandscapeActions.delete(e.pointerId);if(!pairedPointers.has(e.pointerId)){fn(snapshot);if(!activePointers.has(e.pointerId))releasePress();}},PAIR_MS+5);pendingLandscapeActions.set(e.pointerId,timer);}
    function deferLandscapeHold(e,action){if(pairedPointers.has(e.pointerId))return;const snapshot=pointerSnapshot(e);const timer=setTimeout(()=>{pendingLandscapeActions.delete(e.pointerId);if(!pairedPointers.has(e.pointerId)&&activePointers.has(e.pointerId))beginHold(snapshot,action,HOLD_MS-PAIR_MS);},PAIR_MS+5);pendingLandscapeActions.set(e.pointerId,timer);}
    function cancelDeferred(id){const timer=pendingLandscapeActions.get(id);if(timer)clearTimeout(timer);pendingLandscapeActions.delete(id);}
    // A canceled pointer pair will not reach its normal end handler; release its click guard here.
    function cancelPendingInteractions(){clearHold();tap=null;alarmTap=null;suppressClick=false;pendingLandscapeActions.forEach(clearTimeout);pendingLandscapeActions.clear();activePointers.clear();pairedPointers.clear();pairCandidate=null;twoFingerTaps=[];pressed=false;renderState();}
    function onGlobalPointerDown(e){if(!$("settings-entry-tutorial").hidden||presetMode||!settings.hidden||!quickSettings.hidden)return;activePointers.set(e.pointerId,{time:e.timeStamp||performance.now(),x:e.clientX,y:e.clientY,moved:false});if(activePointers.size===2){alarmTap=null;const points=[...activePointers.entries()],gap=Math.abs(points[1][1].time-points[0][1].time);if(gap<=PAIR_MS){pairCandidate={ids:points.map(x=>x[0]),gap,time:Math.max(points[0][1].time,points[1][1].time),released:new Set(),valid:true};pairCandidate.ids.forEach(id=>{pairedPointers.add(id);cancelDeferred(id);});clearHold();tap=null;suppressClick=true;pressed=false;renderState();e.preventDefault();e.stopImmediatePropagation();}}else if(activePointers.size>2&&pairCandidate)pairCandidate.valid=false;}
    function onGlobalPointerEnd(e){const info=activePointers.get(e.pointerId);activePointers.delete(e.pointerId);if(pairCandidate&&pairCandidate.ids.includes(e.pointerId)){if(e.type!=="pointerup"||(info&&info.moved))pairCandidate.valid=false;pairCandidate.released.add(e.pointerId);if(pairCandidate.released.size===2){if(pairCandidate.valid){twoFingerTaps.push({fingers:2,time:pairCandidate.time,gap:pairCandidate.gap});twoFingerTaps=twoFingerTaps.filter(t=>pairCandidate.time-t.time<=TRIPLE_MS);if(recognizesModeToggle(twoFingerTaps)){twoFingerTaps=[];toggleMode();}}pairCandidate.ids.forEach(id=>pairedPointers.delete(id));pairCandidate=null;setTimeout(()=>suppressClick=false,0);}}}
    function landscapeControl(e){if(presetMode||!isPrimaryPointer(e))return;pressed=true;renderState();if(state==="idle")startTimer(e);else if(state==="running")stopTimer(e);else resetTimer(true);}
    function releasePress(){if(!pressed)return;pressed=false;renderState();}
    function cycleTrick(){if(presetMode||!settings.hidden||!quickSettings.hidden)return;const previous=trickState;trickState=nextTrickState(trickState,trick3Enabled);if(previous==="seq"&&trickState!=="seq")sequenceStopCount=0;pendingDigits=[];reservedTens=stopDigit=null;pWorld.classList.remove("feedback");renderState();hidePortraitDigitGuide();}

installLocalPreview(() => { document.getElementById("settings-entry-tutorial-dismiss")?.click(); openSettings(); }); // local-preview-hook
    function initApp(){installSettingsSwipe(openSettings,cancelPendingInteractions,()=>$("settings-entry-tutorial").hidden&&!presetMode&&state!=="running"&&settings.hidden&&quickSettings.hidden,()=>{clearHold();tap=null;alarmTap=null;});loadStorage();try{pDigitGuideOn.checked=localStorage.getItem(DIGIT_GUIDE_KEY)==="1";}catch(_){pDigitGuideOn.checked=false;}setMode(uiMode);showPortraitDigitGuide();
      document.addEventListener("pointerdown",onGlobalPointerDown,{capture:true,passive:false});window.addEventListener("pointermove",handlePointerMove,{passive:false});window.addEventListener("pointerup",e=>{onGlobalPointerEnd(e);handlePresetEnd(e);if(hold&&hold.pointerId===e.pointerId)clearHold();releasePress();});window.addEventListener("pointercancel",e=>{onGlobalPointerEnd(e);handlePresetEnd(e);if(hold&&hold.pointerId===e.pointerId)clearHold();releasePress();});
      document.addEventListener("pointerdown",handlePresetDown,{capture:true,passive:false});
      pControl.addEventListener("click",()=>{if(suppressClick)return;if(presetMode){if(presetKind!=="portrait-group")return;exitPresetMode(false);}if(state==="running")stopTimer();else startTimer();});pLap.addEventListener("click",()=>{if(presetMode||suppressClick)return;if(state==="running")addLap();else resetTimer();});pTime.addEventListener("click",()=>{if(!suppressClick)cycleTrick();});
      pAlarm.addEventListener("pointerdown",e=>{if(uiMode!=="portrait"||state==="running"||presetMode||!isPrimaryPointer(e)||activePointers.size!==1)return;alarmTap={pointerId:e.pointerId,x:e.clientX,y:e.clientY};});pAlarm.addEventListener("pointerup",e=>{const candidate=alarmTap;alarmTap=null;if(!candidate||candidate.pointerId!==e.pointerId||pairedPointers.has(e.pointerId)||Math.hypot(e.clientX-candidate.x,e.clientY-candidate.y)>10)return;openQuickSettings();});pAlarm.addEventListener("pointercancel",()=>alarmTap=null);
      pTimer.addEventListener("click",()=>openSettings("presets"));

      pLapArea.addEventListener("pointerdown",e=>{if(presetMode||trickState!=="digit"||!isPrimaryPointer(e)||pairedPointers.has(e.pointerId))return;tap={pointerId:e.pointerId,x:e.clientX,y:e.clientY};});window.addEventListener("pointerup",e=>{if(tap&&tap.pointerId===e.pointerId&&!presetMode&&!suppressClick&&trickState==="digit"&&!pairedPointers.has(e.pointerId)){const r=pLapArea.getBoundingClientRect();if(Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<=10&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){const d=digitFromPoint(e.clientX-r.left,e.clientY-r.top,r.width,r.height);pendingDigits=pushPendingDigit(pendingDigits,d);const complete=pendingDigits.length===2;reservedTens=complete?pendingDigits[0]:null;stopDigit=complete?pendingDigits[1]:null;pWorld.classList.toggle("feedback",complete);}}tap=null;});
      pNumeric.addEventListener("pointerdown",e=>{const track=pTrackRect();if(state!=="running"&&presetIndexFromX(e.clientX,track.left,track.width)!==null)beginHold(e,d=>enterPortraitPreset(d.pointerId,d.x,d.y));});
      lControl.addEventListener("pointerdown",landscapeControl);
      $("l-trick-zone").addEventListener("pointerdown",e=>deferLandscapeAction(e,cycleTrick));
      $("l-settings-zone").addEventListener("pointerdown",e=>{if(uiMode!=="landscape"||state==="running"||presetMode||!isPrimaryPointer(e)||!settings.hidden||!quickSettings.hidden)return;beginHold(e,()=>{if(uiMode==="landscape"&&state!=="running"&&!presetMode&&settings.hidden&&quickSettings.hidden)openSettings();});});
      document.addEventListener("pointerdown",e=>{if(uiMode!=="landscape"||presetMode||state==="running"||!isPrimaryPointer(e)||e.target.closest("#l-control,#l-trick-zone,#l-settings-zone,#settings,#settings-entry-tutorial,#install-nudge"))return;const p=toAppPoint(e.clientX,e.clientY,innerWidth,innerHeight,isRotatedLayout());if(landscapePresetHoldApplies(e.target,p.x,appSize().width))deferLandscapeHold(e,enterLandscapePreset);},{passive:true});
      settingsClose.addEventListener("click",closeSettings);modePortrait.addEventListener("click",()=>setMode("portrait"));modeLandscape.addEventListener("click",()=>setMode("landscape"));pDigitGuideOn.addEventListener("change",()=>{try{localStorage.setItem(DIGIT_GUIDE_KEY,pDigitGuideOn.checked?"1":"0");}catch(_){}if(!pDigitGuideOn.checked)hidePortraitDigitGuide();});
      slotKindText.addEventListener("click",()=>setSlotSaveKind("text"));slotKindSeq.addEventListener("click",()=>setSlotSaveKind("seq"));
      $("preset-save").addEventListener("click",savePresetEditor);
      $("sequence-add").addEventListener("click",()=>{const raw=sequenceInput.value.trim();if(!/^\d{1,2}$/.test(raw)||sequenceDraft.length>=8){sequenceStatus.textContent="00-99 숫자를 최대 8개까지 추가할 수 있습니다.";return;}sequenceDraft.push(Number(raw));sequenceInput.value="";renderSequenceDraft();sequenceInput.focus();});
      sequenceInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("sequence-add").click();}else if(e.key==="Escape")closeSettings();});
      trick2Text.addEventListener("keydown",e=>{if(e.key==="Escape")closeSettings();});
      sequenceChips.addEventListener("click",e=>{const chip=e.target.closest("button[data-index]");if(!chip)return;sequenceDraft.splice(Number(chip.dataset.index),1);renderSequenceDraft();});
      sequenceSlots.addEventListener("click",e=>{const row=e.target.closest(".sequence-slot");if(!row)return;const index=Number(row.dataset.slot);if(e.target.closest(".sequence-slot-edit"))editPreset(index);else if(e.target.closest(".sequence-slot-apply"))applyPresetSlotToDom(presetSlotValues[index]);});
      $("quick-close").addEventListener("click",closeQuickSettings);$("quick-apply").addEventListener("click",applyQuickValue);
      quickValue.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();applyQuickValue();}else if(e.key==="Escape")closeQuickSettings();});
      window.addEventListener("resize",updateLandscapeHitZones);document.addEventListener("magic-appearance-change",updateLandscapeHitZones);window.addEventListener("blur",cancelPendingInteractions);if(typeof ResizeObserver==="function"){resizeObserver=new ResizeObserver(updateLandscapeHitZones);resizeObserver.observe(lControl);resizeObserver.observe(lTime);resizeObserver.observe(landscapeApp);}document.addEventListener("contextmenu",e=>e.preventDefault());document.addEventListener("pointerdown",()=>{if(!wakeLock)acquireWakeLock();});document.addEventListener("visibilitychange",()=>{if(document.hidden){clearHold();tap=null;}else acquireWakeLock();});renderState();showSettingsEntryTutorial();acquireWakeLock();}
    if(location.hash==="#selftest"){$("shell").hidden=true;$("selftest").hidden=false;runSelfTests();}else initApp();

export { $, MODE_KEY, appRect, appSize, closeSettings, customText, enterAlarmPreset, exitPresetMode, hold, isRotatedLayout, lControl, landscapeApp, openSettings, pAlarm, pControl, pLap, pLapArea, pTime, pTimer, portraitApp, presetAt, presetCs, presetKind, presetMode, reservedTens, sequence, sequenceSlots, sequenceStopCount, setMode, settings, settingsClose, shell, state, stopDigit, tap, textAt, trick3Enabled, trickState, uiMode, updateLandscapeHitZones };
