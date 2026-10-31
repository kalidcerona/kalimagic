'use strict';
  let bioCurrent=null,bioQueue=[],bioLineKey='',bioLastText='',bioLastTick=0,bioVisible=false,dialogKey='',installPrompt=null;
  const bioRequests=new Map();
  function resetAudienceLines() {
    bioCurrent=null;bioQueue=[];bioRequests.clear();bioLineKey='';bioLastText='';bioVisible=false;bioLastTick=clock;
  }
  function queueAudienceLine(text,key,seen=false,record=false,interrupt=false) {
    if(typeof text!=='string'||!text.trim())return;
    // Polling producers enqueue once per change. Previously seen bios still speak on a new encounter.
    const channel=/^(school|coaching|if|twist|homecoming|phase|heckle):/.exec(key)?.[1]||'encounter';
    const request=key+':'+text;
    if(bioRequests.get(channel)===request)return;
    bioRequests.set(channel,request);
    const entry={text,key,record,left:Math.max(5000,Math.min(12000,text.length*80))};
    if(interrupt){if(bioCurrent)bioQueue.unshift(bioCurrent);bioCurrent=null;bioVisible=false;bioQueue.unshift(entry);}
    else bioQueue.push(entry);
  }
  function updateAudienceLine() {
    const line=$('audienceLine'),now=clock,elapsed=Math.max(0,now-bioLastTick);bioLastTick=now;
    const winner=wonMoment&&!wonMoment.pending;
    const beat=state._theaterBeat;if(beat&&clock<beat.until){line.textContent=beat.text;line.hidden=!beat.text;bioVisible=false;return;} // s5b: the theater phase-1 win line
    const blocked=!!state.u15.scene||!$('storyDialog').hidden||blockingSheetOpen()
      ||document.hidden||portrait()||state.u18.map||!$('offlineCard').hidden||!$('sceneCard').hidden||!$('leaveConfirm').hidden||!!stageRewardHost;
    if(winner){
      line.textContent=wonMoment.a.winLine||wonMoment.v.successLine||wonMoment.a.encounterLine||'';
      line.hidden=!line.textContent||blockingSheetOpen()||!$('storyDialog').hidden;
      bioVisible=false;return;
    }
    // Only time actually visible in combat consumes the reading budget. Queued stories and toasts do not suppress speech.
    if(bioCurrent&&bioVisible&&!blocked&&state.mode==='fight')bioCurrent.left-=elapsed;
    // Keep the last line on stage until another line is ready, instead of a five-second blank.
    if(bioCurrent&&bioCurrent.left<=0&&bioQueue.length)bioCurrent=null;
    if(!bioCurrent&&bioQueue.length&&state.mode==='fight'&&!blocked){
      bioCurrent=bioQueue.shift();bioLineKey=bioCurrent.key;bioLastText=bioCurrent.text;
      const recordKey=bioCurrent.key.replace(/^(\d+):\d+:\d+:/,'$1:');
      if(bioCurrent.record&&!state.u15.bios.includes(recordKey))state.u15.bios.push(recordKey);
    }
    bioVisible=!!bioCurrent&&!blocked&&state.mode==='fight';
    if(bioCurrent&&line.textContent!==bioCurrent.text)line.textContent=bioCurrent.text;
    line.hidden=!bioVisible;
  }
  function replayAudienceLine() {
    if(bioCurrent)bioCurrent.left=Math.max(5000,bioCurrent.text.length*80);
    else if(bioLastText)bioQueue.unshift({text:bioLastText,key:bioLineKey,record:false,left:Math.max(5000,bioLastText.length*80)});
    updateAudienceLine();
  }
  function speakerPortrait(name,key=''){
    if(D.storyV15.portraits[name])return D.storyV15.portraits[name];
    // s5a (owner 10-21): 카드1412 keeps the hood on through the cafe fight; after the clear, in the talk, he takes the hood off and speaks with the
    // cap on. The cafe opening and the lines before the headliner stay hooded even when replayed later.
    if(name==='카드1412')return !state.trophies.cafe||/^story:\d+:cafe:(?:opening|beforeHeadliner)$/.test(key)?'assets/headliner-card1412.png':'assets/headliner-card1412-talk.png';
    if(name==='같은 반 여학생')return 'assets/aud-s1-classmate.png';
    if(name==='수학 선생님')return 'assets/aud-s1-teacher.png';
    if(name==='밍기리')return state.trophies.theater?'assets/aud-mingiri-dark-happy.png':'assets/aud-mingiri-dark.png';
    if(name==='어린 칼리')return 'assets/aud-young-kali.png';
    if(name==='완벽한 칼리')return 'assets/aud-perfect-kali.png';
    if(name==='수상한 샵 매니저')return 'assets/serona-hooded.png';
    if(name==='NDD')return 'assets/aud-tutorial-ndd'+(state.u15.tutorial.won?'-happy':'')+'.png';
    if(name==='칼리')return kaliArtPath();
    for(const v of D.venues){const a=C.roster(v).find(a=>a.name===name);if(a)return audienceAsset(v,a);}
    const alias={'다른 세계의 나':'a108'}[name]; // v4 U46 A8: a108 was renamed 과거의 나 in the roster; its old story line keeps the old speaker name
    if(alias)for(const v of D.venues){const a=C.roster(v).find(a=>a.id===alias);if(a)return audienceAsset(v,a);}
    return '';
  }
  function u25DialogMoodKey(key,index){const parts=key.split(':');return parts[0]==='story'?'story:'+parts.slice(2).join(':')+':'+index:parts[0]==='tutorial'?'story:tutorial:'+parts[1]+':'+index:key+':'+index;}
  // v4 U47 4: typewriter dialog. The speed is a presentation setting (uiSave.textSpeed, never the main save); reduced motion defaults to 빠르게 (the whole line at once).
  const TEXT_SPEEDS=['normal','slow','fast'],TEXT_SPEED_LABEL={fast:'빠르게',normal:'보통',slow:'느리게'},TYPE_STEP={normal:35,slow:70};
  function textSpeed(){return TEXT_SPEEDS.includes(uiSave.textSpeed)?uiSave.textSpeed:(reduced?'fast':'normal');}
  let dialogTyping=null,firstTypeLine=true;
  function typePause(ch,step){return /[.?!]/.test(ch)?step*5:ch===','?step*2:0;}
  function finishTypingNow(){if(!dialogTyping)return false;dialogTyping.finish();return true;}
  // v4 U51b 2: one press = one step. Every line window's 다음 (and the tap on its box) goes through this shared gate: a second advance within
  // LINE_STEP_MS (a double tap, a held key's repeated clicks, or the next line's new button hit by the same burst) is ignored. A tap that only
  // completes a typing line is not an advance and does not use the gate (U47 4: tap completes, the next tap goes on).
  const LINE_STEP_MS=250;let lineStepAt=-1e9;
  function lineStep(){const now=performance.now();if(now-lineStepAt<LINE_STEP_MS)return false;lineStepAt=now;return true;}
  // fixP 6: a number and its counter word stay on one line (「한 마리」 never splits into 한 / 마리); only the space turns non-breaking, the words do not change.
  function joinCounters(text){return typeof text==='string'?text.replace(/(^|[\s,.!?'"「(])(한|두|세|네|다섯|\d+) (?=(?:마리|번|개|명|장|판|권|곳|잔))/g,'$1$2\u00a0'):text;}
  function typeLine(p,text){
    text=joinCounters(text);
    if(dialogTyping){clearTimeout(dialogTyping.timer);dialogTyping=null;}
    const step=TYPE_STEP[textSpeed()];
    if(!step||!text){p.textContent=text;p.dataset.typing='false';return;}
    const done=document.createElement('span'),rest=document.createElement('span');done.className='type-done';rest.className='type-rest';rest.textContent=text;p.replaceChildren(done,rest);
    const me={i:0,timer:0,finish(){clearTimeout(me.timer);me.i=text.length;done.textContent=text;rest.textContent='';p.dataset.typing='false';if(dialogTyping===me)dialogTyping=null;renderU15.autoAt=clock;}};
    p.dataset.typing='true';
    dialogTyping=me;
    const tick=()=>{me.i++;done.textContent=text.slice(0,me.i);rest.textContent=text.slice(me.i);if(me.i>=text.length){me.finish();return;}const ch=text[me.i-1];me.timer=setTimeout(tick,ch===' '?0:step+typePause(ch,step));};
    // Start the opening line after assets/fonts settle, so loading cannot consume its reveal.
    const opening=firstTypeLine;firstTypeLine=false;
    if(opening){
      const loaded=document.readyState==='complete'?Promise.resolve():new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
      Promise.all([loaded,document.fonts.ready]).then(()=>{if(dialogTyping===me)me.timer=setTimeout(tick,250);});
    }else me.timer=setTimeout(tick,step);
  }
  // Scene progress suppresses replays. The existing bios list also receipts a
  // skill across retries, since theater part 1 deliberately leaves its scene unseen.
  function skillNoticePending() {
    return !!presentation.active?.skillNotice || presentation.items.some(item => item.skillNotice);
  }
  function queueStorySkills(lines, from, to, replay) {
    if (replay) return;
    for (const line of lines.slice(from, to)) {
      const name = D.storyV15.secretSkills[line.skillToast];
      const receipt = 'story-skill:' + state.dimension + ':' + line.skillToast;
      if (line.skillToast && name && !state.u15.bios.includes(receipt)) {
        state.u15.bios.push(receipt);
        toast('비법 획득 · ' + name, 'skill');
      }
    }
  }
  function advanceSkillScene(skip=false) {
    const scene = state.u15.scene;
    if (!scene) return;
    const lines = D.storyV15.venues[scene.slug][scene.kind];
    const key = scene.dimension + ':' + scene.slug + ':' + scene.kind;
    const replay = state.u15.seen.includes(key) || scene.dimension !== state.dimension;
    const cfg = D.theaterPhases;
    const end = !replay && scene.slug === cfg.slug && scene.kind === 'beforeHeadliner' && scene.line < cfg.sceneLine ? cfg.sceneLine : lines.length;
    queueStorySkills(lines, scene.line, skip ? end : scene.line + 1, replay);
    C.advanceScene(state, skip);
    save();
  }
  function renderDialog(lines,index,key,advance,skip,host=$('storyDialog')){
    if (caseArrange) setCaseArrange(false);
    host.hidden=false;clearDecorations();
    if(dialogKey===key+':'+index)return;dialogKey=key+':'+index;host.replaceChildren();
    const line=lines[Math.min(index,lines.length-1)],art=element('span',line.speaker==='칼리'?'🎩':'👤','story-portrait');
    if(line.speaker==='칼리'){const mood=line.mood||D.lineFaces.moods[u25DialogMoodKey(key,index)]||'serious';art.classList.toggle('future-suit',state.u18.equipped.kali==='future');if(['sad','surprised'].includes(mood))sprite(art,kaliReact(mood));else moodSprite(art,kaliArtPath(),mood);}
    else if(key.includes('lecturenote')&&line.speaker==='세로나')sprite(art,'assets/serona-reveal.png');
    else if(key.startsWith('tutorial:')&&line.speaker==='세로나')moodSprite(art,'assets/serona.png',line.mood||'serious'); // tutorial helper, not the lecturenote 세로나 sprite and not 밍기리
    else{const a=D.venues.flatMap(v=>C.roster(v)).find(a=>a.name===line.speaker);const moodKey=u25DialogMoodKey(key,index);moodSprite(art,speakerPortrait(line.speaker,key),line.mood||D.lineFaces.moods[moodKey]||D.lineFaces.faceMap.roleDefaults[a?.role]||'serious');}
    { const after=lines[index+1]; if(after){ const p=after.speaker==='칼리'?kaliArtPath():(key.startsWith('tutorial:')&&after.speaker==='세로나'?'assets/serona.png':speakerPortrait(after.speaker,key)); if(p)assetImage(p); } } // v4 U49 3: warm the next speaker's portrait
    const copy=element('div','','story-copy'),lineText=element('p','');copy.append(element('strong',line.speaker),lineText);typeLine(lineText,line.text); // v4 U47 4: typed per character; a tap completes the line, the next tap goes on
    // v4 U51 2/3: every line has the same two buttons, 건너뛰기 and 다음 (the last line's 다음 closes the lines the same way; there is no 무대 시작
    // button any more, the stage starts by itself about 1 s after the lines are over, see autoStartStage).
    const next=action('다음',()=>{if(finishTypingNow())return;if(!lineStep())return;advance();save();}),dismiss=action('건너뛰기',skip);next.className='line-next u26-primary';dismiss.className='line-skip';host.append(art,copy,dismiss,next); // v4 U50b: DOM (and Tab) order = visual order, 건너뛰기 then 다음 (다음 is the rightmost button, right thumb)
    host.onclick=e=>{if(e.target.closest('button'))return;if(finishTypingNow())return;if(!lineStep())return;advance();};
  }
