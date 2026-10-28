'use strict';
  // v4 U51 3 (owner: "스테이지 시작 안 눌러도 자동으로 다음 스테이지로"): at a new stage (Core idle.waiting, reached after a clear) the show starts by
  // itself once every line, banner and layer is gone, after a short pause (AUTO_START_MS of wall time with nothing open) so the marquee's new venue
  // name can be read. It calls the same C.startStage the old 무대 시작 button called, so the started stage is the same. Anything open (a panel, the
  // menu, the save-slot view, the stage map, the leave question, a dialog, the scene card, the intro, the offline card, a visible banner, the win moment,
  // the tutorial, a hidden page or portrait) holds it, and the pause starts again after it closes. Queued notifications do not count as open layers. renderU15 calls this every frame;
  // a gap between calls (any frame where it was not reached) also restarts the pause.
  const AUTO_START_MS=1000;
  function autoStartStage(){
    const now=performance.now(),last=autoStartStage.last||0;autoStartStage.last=now;
    const held=!state.idle.waiting||state.mode!=='transition'||!!state.u15.scene||state.u15.queue.length>0||state.u15.tutorial.active||schoolChainPaused()||blockingSheetOpen()||!!state.u18.map||!!wonMoment||state.features.climax.left>0||document.hidden||portrait()
      ||!$('storyDialog').hidden||!!stageRewardHost||!$('leaveConfirm').hidden||!$('sceneCard').hidden||!$('introStory').hidden||!$('offlineCard').hidden||!$('banner').hidden||!state.onboarding.intro;
    // v4 U51c: a slow frame is not a restart (at 5 fps calls come 200 ms apart and the old 150 ms rule restarted the pause forever); only a gap
    // over 1.5 s (the waiting stage was not rendered, e.g. a hidden page) restarts it. Every frame while waiting reaches this call (see renderU15).
    if(held||now-last>1500||!autoStartStage.since){autoStartStage.since=held?0:now;return false;}
    if(now-autoStartStage.since<AUTO_START_MS)return false;
    autoStartStage.since=0;if(!C.startStage(state))return false;save();return true;
  }
  let batchDPanelKey='',batchDReplayFinish=null,batchDCutsceneTimer=null,batchDFrameTimer=null,twistRoomImg=null;
  function batchDLeavePanel(){
    clearTimeout(batchDCutsceneTimer);batchDCutsceneTimer=null;clearTimeout(batchDFrameTimer);batchDFrameTimer=null;twistCutscene(false);
    batchDPanelKey='';menu='';$('panel').hidden=true;previous=0;lastAudience='';moreReturn=false;
  }
  function runBatchDAction(kind){
    const curtain=kind==='twist-next'&&state.batchD.twist.scene==='complete'&&state.batchD.twist.complete; // s5t
    if(!C.batchDAction(state,kind))return false;
    batchDLeavePanel();if(curtain)twistCurtainCall();save();render();return true;
  }
  // s5t: the twist clear (counter-finish) has no win event, so the meetup trophy notice and its curtain call used to be skipped and the
  // complete panel waited behind the 공연 뒤 lines. Now: oil and water, the complete panel, then the trophy notice and the curtain call (as a
  // normal headliner clear opens them), then the 공연 뒤 lines and the encore choice.
  function twistCurtainCall(){
    const v=D.venues[state.venue-1];if(!v)return;
    toast(`🏆 ${v.trophy} 획득!`, 'trophy');presentation.push({stageTransition:true,minimum:0,hold:true,priority:60,start:item=>{if(!openCurtainCall(v.slug))item.hold=false;else item.end=()=>{};}});
  }
  function resolveBatchDPanel(){
    const key=batchDPanelKey;
    if(key==='encore')runBatchDAction('leave');
    else if(key==='rebirth')runBatchDAction('continue');
    else if(key==='twist:counter')runBatchDAction('counter');
    else if(key==='twist:cutscene')runBatchDAction('counter-finish');
    else runBatchDAction('twist-next');
  }
  function finishBatchDReplay(){
    const finish=batchDReplayFinish;batchDReplayFinish=null;
    batchDLeavePanel();if(finish)finish();else storyList();
  }
  function showBatchDLines(title,lines,finish){
    let index=0;
    const draw=()=>{
      openPanel('batchDReplay',title);$('closePanel').textContent='건너뛰기';
      batchDReplayFinish=finish||(()=>storyList());
      const line=lines[index];
      const scene=element('div','','batch-d-scene');
      scene.append(element('strong',line.speaker),element('p',line.text));
      scene.append(action(index+1<lines.length?'다음':'이야기 마치기',()=>{if(++index<lines.length)draw();else finishBatchDReplay();}));
      $('panelBody').append(scene);
    };
    if(lines.length)draw();else if(finish)finish();
  }
  // 12-116: the 반전 무대 plays as normal dialogue lines (speaker, portrait, text, 다음) in the dialogue box place of 12-119, while the stage area shows
  // one large illustration per beat (portrait: from under the header to the button rows; landscape: over the stage). The panel stays the state owner
  // (menu 'batchD' / 'batchDReplay', 건너뛰기 in the header); only its look changes (data-cutscene). 김정명 appears on screen when he gives 트레이스.
  function twistCutscene(on){
    for(const id of ['panel','stage']){const d=$(id).dataset;if(on)d.cutscene='1';else delete d.cutscene;}
  }
  function twistPortrait(speaker){
    if(speaker==='칼리')return {path:typeof kaliArtPath==='function'?kaliArtPath():'assets/kali-outfit-1.png',sheet:true};
    return {path:(D.batchD.twist.art.portraits||{})[speaker]||'',sheet:false};
  }
  // beats: [{line:{speaker,text}, image, mentor, note, heading}]; last: {label, run}. Lines step with 다음; the last line shows the scene's own action.
  function twistLines(scene,beats,last){
    let index=0;twistCutscene(true);
    const draw=()=>{
      scene.replaceChildren();
      const beat=beats[index]||{line:{speaker:'',text:''}},line=beat.line;
      if(beat.image){
        const fig=element('div','','twist-art'),img=document.createElement('img');img.src=assetUrl(beat.image);img.alt='';img.setAttribute('draggable','false');fig.append(img);
        if(beat.mentor){const m=document.createElement('img');m.src=assetUrl(beat.mentor);m.alt='김정명';m.className='twist-mentor';fig.append(m);}
        scene.append(fig);
      }
      const box=element('div','','twist-line'),face=twistPortrait(line.speaker),art=element('span','','twist-portrait'+(face.sheet?' is-sheet':'')+(line.speaker?'':' is-empty'));
      if(face.path)art.style.backgroundImage=`url('${assetUrl(face.path)}')`;else if(line.speaker)art.textContent='👤';
      const copy=element('div','','twist-copy');if(beat.heading)copy.append(element('h2',beat.heading));if(line.speaker)copy.append(element('strong',line.speaker));copy.append(element('p',line.text));if(beat.note)copy.append(element('p',beat.note,'twist-note'));
      const lastLine=index+1>=beats.length,next=lastLine?action(last.label,last.run):action('다음',()=>{index++;draw();});next.className='twist-next';
      box.append(art,copy,next);scene.append(box);next.focus?.();
    };
    draw();
    return {go:i=>{if(i>index&&i<beats.length&&scene.isConnected!==false){index=i;draw();}}}; // timers only move forward (다음 may already be ahead)
  }
  function twistArt(kind){const a=D.batchD.twist.art;return kind==='gift'?a.gift:kind==='counter'?a.counter:kind==='complete'?a.complete:kind==='hidden'||kind==='failure'?a.hidden:'';} // s5c: a clue (failure) scene shows the hidden trick
  // The hidden final trick runs during the fight (time keeps running), so its illustration fills the room behind the characters, not a panel.
  function twistRoomArt(path){
    if(!path){if(twistRoomImg)twistRoomImg.hidden=true;return;}
    if(!twistRoomImg){twistRoomImg=document.createElement('img');twistRoomImg.className='twist-room-art';twistRoomImg.alt='';$('room').append(twistRoomImg);}
    if(twistRoomImg.dataset.src!==path){twistRoomImg.src=assetUrl(path);twistRoomImg.dataset.src=path;}
    twistRoomImg.hidden=false;
  }
  function startBatchDSide(side){
    if(state.u18.map)C.returnToStage(state);
    batchDLeavePanel();
    const def=D.batchD.stages[side],script=D.storyReview.ifRoute[def.script];
    if(!C.batchDAction(state,side)){toast('갈림길의 공연을 먼저 마쳐 주세요');return;}
    save();showBatchDLines(def.name,[...script.opening,...script.beforeHeadliner],()=>{previous=0;render();});
  }
  function replayBatchD(key){
    const t=D.storyReview.twist;
    if(key==='oilWater'){
      openPanel('batchDReplay','오일 앤 워터');batchDReplayFinish=()=>storyList();
      $('closePanel').textContent='건너뛰기';drawOilWater(finishBatchDReplay);return;
    }
    if(key==='twist'){
      openPanel('batchDReplay','반전 무대');batchDReplayFinish=()=>storyList();$('closePanel').textContent='건너뛰기';
      const beat=(kind,lines)=>lines.map(line=>({line,image:twistArt(kind),mentor:kind==='gift'?D.batchD.twist.art.mentor:''}));
      const beats=[...beat('intro',t.intro),...beat('hidden',t.hidden),...beat('failure',t.failures.flat()),...beat('gift',t.gift),...beat('counter',t.counter),...beat('complete',t.complete)];
      const scene=element('div','','batch-d-scene twist-scene');$('panelBody').append(scene);
      twistLines(scene,beats,{label:'이야기 마치기',run:finishBatchDReplay});return;
    }
    const script=D.storyReview.ifRoute[D.batchD.stages[key].script],lines=['opening','beforeHeadliner','afterClear'].flatMap(k=>script[k]||[]); // v6 script: fightLines (bubble text) are not story lines
    showBatchDLines(D.batchD.stages[key].name,lines);
  }
  function drawOilWater(finish){
    let finished=false;const done=()=>{if(finished)return;finished=true;clearTimeout(batchDCutsceneTimer);clearTimeout(batchDFrameTimer);finish();};
    const ow=D.storyReview.twist.oilWater,frames=D.batchD.twist.art.oilWater,ms=reduced?150:D.batchD.twist.cutsceneMs;
    const scene=element('div','','batch-d-scene twist-scene');scene.setAttribute('aria-label','오일 앤 워터 · 섞어도 다시 나뉘는 빨강과 검정');$('panelBody').append(scene);
    // 12-116: three illustrated frames (mixed, separating, separated), about 1.4 s each; 다음 moves on at once; the last frame ends the show.
    const caption={speaker:'',text:'오일 앤 워터 · 섞어도 다시 나뉘는 빨강과 검정'};
    const view=twistLines(scene,[{line:caption,image:frames[0]},{line:ow[0],image:frames[1]},{line:ow[1],image:frames[2],heading:'관객 대만족!'},...ow.slice(2).map(line=>({line,image:frames[2]}))],{label:'공연 마치기',run:done}); // s5t: 마술삼일's closing line after 관객 대만족
    clearTimeout(batchDCutsceneTimer);clearTimeout(batchDFrameTimer);
    batchDFrameTimer=setTimeout(()=>view.go(1),reduced?75:Math.round(ms/2));
    batchDCutsceneTimer=setTimeout(()=>{view.go(2);sound('milestone');},ms);
  }
  function renderBatchD(){
    const b=state.batchD,t=b.twist,side=D.batchD.stages[b.side];
    if(side){
      $('venueName').textContent=side.name;$('doubtTitle').dataset.audience=side.character;
      $('doubtTitle').textContent=portraitLayout()?'의심':side.character+'의 의심';$('audience').setAttribute('aria-label',side.character);
      stageAudienceFace($('audience'),side.portrait,audienceDoubtStage());
      const script=D.storyReview.ifRoute[side.script],lines=script.fightLines&&script.fightLines.length?script.fightLines:script.beforeHeadliner.filter(l=>l.speaker===side.character).map(l=>l.text); // v6 script (Q22): the IF opponent's own fight lines
      const index=Math.floor(state.fightMs/7000)%lines.length;
      queueAudienceLine(lines[index],'if:'+b.side+':'+Math.floor(state.fightMs/7000));updateAudienceLine();
      $('patternLabel').textContent='IF 공연 · 한 사람씩 마음을 건네요';
    }
    twistRoomArt(t.scene==='hidden'?D.batchD.twist.art.hidden:'');
    if(t.scene==='hidden'){
      $('hint').textContent='🃏 '+D.storyReview.twist.hidden[0].text.replace(/[.!?]+$/,'')+' · '+Math.ceil(t.left/1000)+'초'; // s5t: the hidden line itself (was a copy of the old line)
      queueAudienceLine(D.storyReview.twist.hidden[0].text,'twist:hidden');updateAudienceLine();
    }else if(b.interference.left>0)$('hint').textContent=(b.interference.kind==='lock'?'🔒 잠깐 잠긴 케이스':'🙈 잠깐 가린 케이스')+' · '+Math.ceil(b.interference.left/1000)+'초';
    else if(b.encore.phase==='round')$('hint').textContent='앙코르 · '+Math.ceil(b.encore.left/1000)+'초 · 추가 보상 도전';
    const key=BatchDView.panel(b);
    const done=key==='twist:complete'; // s5t: the complete panel comes right after the oil and water (before the restored win moment, curtain call and 공연 뒤 lines)
    if(!key||menu||state.u15.scene||state.u15.queue.length&&!done||presentation.busy||wonMoment&&!done||!$('offlineCard').hidden||!$('sceneCard').hidden||!$('leaveConfirm').hidden||!state.onboarding.intro)return;
    batchDPanelKey=key;openPanel('batchD',key==='encore'?'한 번 더 보여 줄까요?':key==='rebirth'?'멀티버스의 갈림길':'반전 무대');
    $('closePanel').textContent=key==='encore'?'인사하고 내려가기':key==='rebirth'?'나중에 정하기':'장면 건너뛰기';
    const body=$('panelBody'),scene=element('div','','batch-d-scene');body.append(scene);
    if(key==='encore'){
      scene.append(element('p','한 번만 더 도전해요. 성공하면 동전 보너스, 실패하면 멘탈이 조금 줄어요. 기본 보상은 유지돼요.'),action('앙코르',()=>runBatchDAction('encore')),action('인사하고 내려가기',()=>runBatchDAction('leave')));
    }else if(key==='rebirth'){
      const tagged=state.dimension>1,fork=D.progressFork;
      scene.append(action(fork.mainChoice+(tagged?' · 일반 엔딩':''),()=>runBatchDAction('continue')),action(fork.ifChoice+(tagged?' · 히든 엔딩':''),()=>{C.batchDAction(state,'continue');startBatchDSide('young');}));
    }else if(key==='twist:cutscene')drawOilWater(()=>runBatchDAction('counter-finish'));
    else{
      const kind=key.split(':')[1],copy=D.storyReview.twist;
      const lines=kind==='failure'?copy.failures[Math.max(0,t.failures-1)]:copy[kind];
      // s5c (review P2-3): each planned loss is a short clue scene: the hidden-trick art and its silk reward; 다음 goes straight back into the
      // fight (the third clue opens the gift sequence). The failure lines are the live data lines. s5t (owner 10-25): no 단서 n/3 label.
      const clueSilk=D.batchD.twist.clueSilk||0, clue='';
      const note=kind==='failure'?[clueSilk?'실크 +'+clueSilk:'',t.trace?'':'강화와 동전은 그대로예요'].filter(Boolean).join(' · '):kind==='gift'?'비법 트레이스 무료 습득 · 멘탈 회복':'';
      const beats=(lines||[]).map((line,i,all)=>({line,image:twistArt(kind),mentor:kind==='gift'?D.batchD.twist.art.mentor:'',heading:i===0?clue:'',note:i===all.length-1?note:''}));
      scene.className+=' twist-scene'+(kind==='failure'?' twist-clue':'');
      twistLines(scene,beats,{label:kind==='counter'?'반격 피날레':'다음',run:()=>runBatchDAction(kind==='counter'?'counter':'twist-next')});
    }
    body.querySelector('button')?.focus();
  }
  function storyList(){
    openPanel('stories','이야기');
    const seen=state.u15.seen;
    const replayNames={twist:'반전 무대 · 서울 매니아의 마술',oilWater:'반격 피날레 · 오일 앤 워터',young:'어린 칼리의 마술 자랑',mirror:'거울 속 무대'};
    for(const key of BatchDView.replayKeys(state.batchD))$('panelBody').append(action(replayNames[key],()=>replayBatchD(key)));
    if(!seen.length)$('panelBody').append(element('p','한 번 본 이야기가 여기에 모여요.'));
    for(const key of seen){const [dimension,slug,kind]=key.split(':'),v=C.venueBySlug(slug);const labels={opening:'첫 인사',beforeHeadliner:'마지막 관객',afterClear:'공연 뒤'};
      $('panelBody').append(action(`차원 ${dimension} · ${v.name} · ${labels[kind]}`,()=>{moreReturn=false;closePanel();C.startScene(state,{dimension:Number(dimension),slug,kind});save();render();}));}
  }
  $('storyButton').addEventListener('click',storyList);sprite($('storyIcon'),'assets/icon-story.png');
