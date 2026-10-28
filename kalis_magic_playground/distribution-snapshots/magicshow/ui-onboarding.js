'use strict';
  function tutorialSignal(id) {
    if (C.tutorialAction(state,id)) { save(); renderCoach(); }
    if (typeof firstUseHint === 'function') { if (id === 'learn') knownHint(id); else firstUseHint(id); } // learn: the player just did it
  }
  // s5c (review P2-2): tutorial hints at first use. The school tutorial (the first stage) keeps today's coach for 꾹 누르기 and 의심 줄이기
  // (hold, doubt). Every other hint of D.onboarding.tutorial shows once, as one toast line with its own text, the first time the player meets
  // its thing after the tutorial. Shown hints go into the save's onboarding.facts (the tutorial's own list of met items: no new save field).
  // A save that already reached venue 2 counts them all as met (no burst for old saves). One hint at a time, queued, and never while a story
  // scene, dialogue, panel, cutscene or reward moment is up; the toast channel itself also waits behind dialogue.
  const FIRST_USE_HINTS=['badge','heckle','learn','buyAll','goal','win'], HINT_GAP_MS=6000;
  // s5t (owner 10-25): the toasts carry the speaker name 세로나 and her own texts (D.onboarding.seronaHints; goal keeps the tutorial body), and
  // two triggers are new: skill (the first skill that becomes ready, with its name) and finale (the first finale). onboarding.facts accepts only
  // the eight tutorial ids (save validator), so these two are kept for the session and derived from the save at load: a save that already has
  // a skill unlocked or a finale played (features.progress.finales) counts them as seen. No new save field and no storage.
  // buyAll is no longer a toast: the first failed show opens a 세로나 dialogue (seronaFail, the story dialogue box with 다음), once per save.
  const SESSION_HINTS=['skill','finale'], ALL_HINTS=FIRST_USE_HINTS.concat(SESSION_HINTS), sessionHintsSeen=new Set();
  let hintQueue=[], hintNextAt=0, noticesQuietSince=0, hintSkillName='';
  function hintsLive(){return state.u15.tutorial.done&&!state.u15.tutorial.active&&!chainMark()&&state.onboarding.intro&&state.onboarding.step>=4;}
  function hintSeen(id){return SESSION_HINTS.includes(id)?sessionHintsSeen.has(id):state.onboarding.facts.includes(id);}
  function rememberHint(id){if(SESSION_HINTS.includes(id))sessionHintsSeen.add(id);else if(!state.onboarding.facts.includes(id))state.onboarding.facts.push(id);}
  function forgetHint(id){if(SESSION_HINTS.includes(id))sessionHintsSeen.delete(id);else state.onboarding.facts=state.onboarding.facts.filter(x=>x!==id);}
  function markPassedHints(){
    sessionHintsSeen.clear();seronaFail.pending=false;seronaFail.index=-1;
    if(D.skills.some(k=>C.skillUnlocked(state,k.id)))sessionHintsSeen.add('skill');
    if((state.features.progress.finales||0)>0)sessionHintsSeen.add('finale');
    // s5t-2: buyAll (the first-fail dialogue) counts as passed only when the save has already failed a real show: state.fails (the tutorial
    // lesson failure never adds to it, and the tutorial ends by restoring its baseline) or a later dimension (fails resets on rebirth).
    const failedBefore=state.fails>0||state.dimension>1;
    if(state.u15.tutorial.done&&(state.vMax>=2||state.trophies.family))for(const id of FIRST_USE_HINTS)if(!hintSeen(id)&&(id!=='buyAll'||failedBefore))state.onboarding.facts.push(id);
    // s5t-2: buyAll is written when the dialogue ends; a save that failed but has no buyAll (a reload during the dialogue, or a fail whose
    // dialogue never opened) plays it again from its first line once the player is on stage.
    if(state.u15.tutorial.done&&state.fails>0&&!hintSeen('buyAll'))seronaFail.pending=true;
    hintQueue=hintQueue.filter(id=>!hintSeen(id)); // the first render can queue before the load is marked
  }
  function knownHint(id){if(!ALL_HINTS.includes(id)||!hintsLive())return;hintQueue=hintQueue.filter(x=>x!==id);if(!hintSeen(id)){rememberHint(id);save();}}
  function firstUseHint(id,arg){
    if(id==='buyAll'){if(hintsLive()&&!hintSeen(id))seronaFail.pending=true;return;}
    if(!ALL_HINTS.includes(id)||!hintsLive()||hintSeen(id)||hintQueue.includes(id))return;if(id==='skill')hintSkillName=arg||'';hintQueue.push(id);
  }
  function hintText(id){const H=D.onboarding.seronaHints||{};if(id==='skill')return hintSkillName&&H.skill?H.skill.replace('{skill}',hintSkillName):'';return H[id]||(D.onboarding.tutorial.find(h=>h.id===id)||{}).body||'';}
  function hintBlocked(){return state.mode!=='fight'||!!state.u15.scene||state.u15.queue.length>0||!$('storyDialog').hidden||!!menu||!$('panel').hidden||!!state.batchD.twist.scene||presentation.busy||!!wonMoment||!!stageRewardHost||state.features.climax.left>0||!$('introStory').hidden||!$('sceneCard').hidden||!$('offlineCard').hidden||!$('leaveConfirm').hidden||document.hidden||portrait();}
  function tickHints(){
    if(presentation.busy)noticesQuietSince=clock; // notices come in bursts (case, achievement, growth): a hint waits for 1.5 s of quiet
    if(!hintQueue.length||clock<hintNextAt||clock-noticesQuietSince<1500||hintBlocked())return;
    const id=hintQueue.shift(),text=hintText(id);
    if(!text||hintSeen(id)||!hintsLive())return;
    rememberHint(id);save();
    showHint(id,text);hintNextAt=clock+HINT_GAP_MS;
  }
  // The hint uses the toast channel and look (one line, the speaker name first), stays 3.6 s, and gives way to any other notice
  // (Presentation.Queue.push); a hint cut within its first 1.5 s goes back to the front of the hint queue and is not counted as seen.
  function showHint(id,text){
    presentation.push({merge:'hint:'+id,minimum:3600,hint:id,start:item=>{
      const el=element('div','','toast hint-toast'),who=(D.onboarding.seronaHints||{}).speaker;if(who)el.append(element('strong',who,'hint-speaker'),' ');el.append(text);pxIcons(el);$('toasts').append(el);const expiry=setTimeout(()=>el.remove(),4200);
      item.end=()=>{clearTimeout(expiry);el.remove();if(item.cut&&item.age<1500){forgetHint(id);if(!hintQueue.includes(id))hintQueue.unshift(id);hintNextAt=clock+HINT_GAP_MS;}};
    }});
  }
  // s5t: the first failed show (after the tutorial): when the player is back on stage, 세로나 says two lines in the story dialogue box (다음,
  // 건너뛰기). The fight waits behind it (paused). Remembered as buyAll in onboarding.facts when it ends (s5t-2: not when it opens, so a reload
  // on its first line plays it again from the first line; see markPassedHints).
  function seronaFailDialog(blocked){
    const lines=(D.onboarding.seronaHints||{}).firstFail||[];
    if(seronaFail.index<0){
      if(!seronaFail.pending||blocked||state.mode!=='fight'||state.u15.scene||state.u15.queue.length||!hintsLive()||state.batchD.twist.scene||wonMoment||presentation.busy||state.features.climax.left>0||!$('introStory').hidden)return false;
      seronaFail.pending=false;if(hintSeen('buyAll')||!lines.length)return false;
      seronaFail.index=0;
    }
    const close=()=>{seronaFail.index=-1;rememberHint('buyAll');save();};
    renderDialog(lines,Math.min(seronaFail.index,lines.length-1),'tutorial:seronaFail',()=>{if(seronaFail.index+1<lines.length)seronaFail.index++;else close();},close);
    return true;
  }
  function updateLearningBadge() {
    if (updateLearningBadge.at && clock-updateLearningBadge.at<250) return;
    updateLearningBadge.at=clock;
    const count=C.affordableNodes(state).length;
    const unseen = D.tree.some(n => !n.shopOnly && n.id !== 'autoLearn' && C.nodeInfo(state, n.id).revealed && !treeView.revealed.has(n.id));
    $('bookButton').classList.toggle('is-new', unseen);
    $('bookButton').dataset.affordable=String(count);
    if(count>0&&typeof firstUseHint==='function')firstUseHint('learn'); // s5c: the first 비법 the player can afford
    $('bookButton').setAttribute('aria-label',`비법 · 지금 배울 수 있는 비법 ${count}개${unseen ? ' · 새 비법 있음' : ''}`);
  }
  // 12-117: the new-game intro. A new game (onboarding.intro false, tutorial not started) first plays D.onboarding.intro as dialogue lines (speaker,
  // portrait, text, 다음, 건너뛰기) under one illustration per beat, then flows into the school opening exactly as before. Existing saves have
  // onboarding.intro true and never see it; 처음 안내 (tutorial replay) keeps going straight to the tutorial. onboarding.panel = the beat index (the v23
  // save validator allows 0-4, so at most five beats); the line inside the beat is session only, and a reload resumes at the beat's first line.
  // The beat's file is shown only when data marks it ready (no request for a file that is not there, so no 404 on a new-game boot); else the fallback.
  // If a ready file still fails to load, the fallback replaces it once per session.
  const introMissingArt = new Set();
  let introLine = 0, introLineBeat = -1;
  function introLines() { return D.onboarding.intro.flatMap(beat => beat.lines.map(line => ({ line, art: beat.art }))); }
  function introPortrait(speaker) {
    if (speaker === '칼리') return { path: kaliArtPath(), sheet: true };
    return { path: (D.onboarding.introPortraits || {})[speaker] || '', sheet: false };
  }
  function startIntro(replay = true) {
    if(!replay && !state.u15.tutorial.done && (state.onboarding.intro || state.u15.tutorial.active || chainMark())){
      $('introStory').hidden=true;
      if(state.u15.tutorial.active){C.resumeTutorial(state);renderU15();save();return;}
      if(!chainMark()){setChain('girl-intro',0);state.onboarding.step=0;state.onboarding.facts=[];}
      state.onboarding.intro=true;render();save();return;
    }

    if (replay) { state.onboarding={intro:false,panel:0,step:0,facts:[]}; introLineBeat=-1; closePanel(); }
    const beats=D.onboarding.intro, beat=Math.max(0,Math.min(state.onboarding.panel,beats.length-1));
    if(introLineBeat!==beat||introLine>=beats[beat].lines.length){introLine=0;introLineBeat=beat;}
    release(); $('phoneMore').hidden=true; $('moreButton').setAttribute('aria-expanded','false');
    const host=$('introStory'); host.hidden=false; host.replaceChildren(); host.classList.add('intro-dialog');
    const lines=introLines(), index=beats.slice(0,beat).reduce((n,b)=>n+b.lines.length,0)+introLine, item=lines[index], artDef=D.onboarding.introArt[item.art]||{};
    const fig=element('div','','twist-art intro-art'), img=document.createElement('img'); img.alt=''; img.setAttribute('draggable','false');
    const show=src=>{ img.dataset.src=src; img.style.visibility='hidden'; img.onload=()=>{ img.style.visibility=''; }; img.src=assetUrl(src); };
    img.onerror=()=>{ if(img.dataset.src===artDef.file) introMissingArt.add(artDef.file); if(artDef.fallback&&img.dataset.src!==artDef.fallback) show(artDef.fallback); };
    show(artDef.ready&&artDef.file&&!introMissingArt.has(artDef.file)?artDef.file:artDef.fallback);
    fig.append(img);
    const box=element('div','','twist-line intro-box'), face=introPortrait(item.line.speaker), art=element('span','','twist-portrait'+(face.sheet?' is-sheet':''));
    if(face.path) art.style.backgroundImage=`url('${assetUrl(face.path)}')`;
    const copy=element('div','','twist-copy'); copy.append(element('strong',item.line.speaker),element('p',item.line.text));
    const advance=()=> {
      if (introLine<beats[beat].lines.length-1) { introLine++; save(); startIntro(false); }
      else if (state.onboarding.panel<beats.length-1) { state.onboarding.panel++; save(); startIntro(false); }
      else finish();
    };
    const finish=()=> {
      host.hidden=true; host.classList.remove('intro-dialog'); previous=0; introLine=0; introLineBeat=-1;
      if(!state.u15.tutorial.done){ if(!chainMark()){setChain('girl-intro',0);state.onboarding.step=0;state.onboarding.facts=[];} state.onboarding.intro=true; render(); save(); return; } // the school opening, as before
      state.onboarding.intro=true; save(); renderCoach();
    };
    // v4 U51b 6: every line, the last one too, has the same 다음 (the last 다음 starts the game); one step per press (shared gate)
    const step=()=>{if(lineStep())advance();};
    const next=action(`${index+1} / ${lines.length} · 다음`,step);
    next.classList.add('intro-next','twist-next');
    const skip=action(D.onboarding.skip,finish); skip.classList.add('intro-skip');
    box.append(art,copy,next);
    host.append(fig,skip,box); // v4 U51 2: DOM (Tab) order = visual order (건너뛰기 top right, then 다음 bottom right)
    host.onclick=e=>{ if (!e.target.closest('button')) step(); };
    save();
  }
  function spokenTutorialLine(chain, upgrade, mark) {
    const pack = D.storyV15.tutorial.schoolChain;
    if (chain && mark && mark.step.endsWith('-fight')) return mark.step.startsWith('teacher') ? pack.teacherDuring[0] : pack.girlDuring[0];
    if (upgrade&&newTutorialLesson())return D.storyReview.tutorialLesson.buy[0];
    if (upgrade) return menu === 'book' ? (pack.upgrade[1] || pack.upgrade[0]) : pack.upgrade[0];
    const tut = state.u15.tutorial;
    if (tut.active && tut.phase === 'fight' && !tut.won) {
      if(newTutorialLesson()){const before=D.storyReview.tutorialLesson.before;return state.u15.bios.includes('lesson:bought')?D.storyReview.tutorialLesson.retry[0]:before[before.length-1];} // v6 script: the coach line is the last 세로나 line before the fight (「막히는 순간도 연습이에요」)
      const coaching = D.storyV15.tutorial.coaching;
      return coaching[Math.min(coaching.length - 1, Math.floor(state.fightMs / 18000))] || coaching[0];
    }
    return null;
  }
  function renderCoach() {
    const host=$('tutorialCoach'), t=state.onboarding;
    const mark=chainMark();
    const chain=mark&&!state.u15.tutorial.active&&!state.u15.tutorial.done;
    if(chain&&!mark.step.endsWith('-fight')&&mark.step!=='upgrade-play'){host.hidden=true;host.dataset.step='';host.dataset.dock='';setTutorialTargets([]);return;}
    const upgrade=chain&&mark.step==='upgrade-play';
    const upgradeNode=upgrade?document.querySelector(`.constellation-node[data-node-id="${chainNodeId}"]`):null;
    const upgradeBuy=upgrade&&menu==='book'?document.querySelector('#panel .tree-buy'):null;
    const upgradeTarget=upgrade?(menu==='book'?(upgradeBuy||upgradeNode):$('bookButton')):null;
    // v4 U47 3: steps 4 to 7 pointed at the top 비법 button, the learn-all button and the goal strip (all gone or not tappable); only the four fight steps and the tutorial glove step are coached now.
    const ids=['#board .cell:not(.locked)','#board .cell:not(.locked)','#doubtFill','#statMental','','','',''];
    if(state.u15.tutorial.active)ids[4]='#item-auto-glove';
    const targets=menu==='book' ? ['','','','','.tree-buy','','',''] : ids;
    const eligible=!state.u15.scene && (!state.u15.tutorial.active || state.u15.tutorial.phase==='fight' && !state.u15.tutorial.won) && t.intro && t.step<(state.u15.tutorial.active?5:4) && !document.hidden && !portrait() && (!menu || menu==='book');
    const needSkip=(chain&&mark.step.endsWith('-fight'))||(state.u15.tutorial.active&&state.u15.tutorial.phase==='fight'&&!state.u15.tutorial.won);
    const node=upgradeTarget||(eligible && targets[t.step] ? document.querySelector(targets[t.step]) : null)||(needSkip?document.querySelector('#board .cell:not(.locked)'):null);
    host.hidden=!node;
    if (upgrade && menu === 'book') setTutorialTargets([upgradeNode, upgradeBuy].filter(Boolean));
    else setTutorialTargets(node?[node]:[]);
    if (host.hidden) { host.dataset.dock = ''; return; }
    const pack=D.storyV15.tutorial.schoolChain;
    const spoken=spokenTutorialLine(chain, upgrade, mark);
    const key=spoken?`${spoken.speaker}:${spoken.text}:${menu||''}`:(upgrade?(menu==='book'?'upgrade-book':'upgrade-dock'):(chain&&mark.step.endsWith('-fight')?'chain-fight':String(t.step)));
    if (host.dataset.step!==key) {
      host.dataset.step=key; host.replaceChildren();
      const copy=D.onboarding.tutorial[t.step]||D.onboarding.tutorial[0];
      const speaker=spoken?spoken.speaker:'세로나';
      const face=speaker==='세로나'?'assets/serona.png':(speakerPortrait(speaker)||'assets/serona.png');
      const helper=element('img','','coach-helper');helper.src=face;helper.alt=speaker;helper.onerror=()=>{helper.hidden=true;};
      let coachText=copy.body, coachTitle=`${(t.step||0)+1} / 8 · ${copy.title}`;
      if(spoken){coachText=spoken.text;coachTitle=spoken.speaker;}
      else if(upgrade){coachText=menu==='book'?pack.upgrade[1].text:pack.upgrade[0].text;coachTitle=menu==='book'?(pack.upgrade[1].speaker||'세로나'):(pack.upgrade[0].speaker||'세로나');}
      else if(chain&&mark.step.endsWith('-fight')){const line=mark.step.startsWith('teacher')?pack.teacherDuring[0]:pack.girlDuring[0];coachText=(line&&line.text)||copy.body;coachTitle=(line&&line.speaker)||'세로나';}
      else if(state.u15.tutorial.active){const line=D.storyV15.tutorial.coaching[Math.min(D.storyV15.tutorial.coaching.length-1,Math.floor(state.fightMs/18000))]||D.storyV15.tutorial.coaching[0];coachText=line.text;coachTitle=line.speaker;}
      host.append(helper,element('strong',coachTitle),element('p',coachText));
      const abortTutorial=state.u15.tutorial.active||!!chainMark();
      const skip=action(abortTutorial?'건너뛰기':'안내 닫기',()=>{if(abortTutorial)endSchoolTutorial();else t.step=8; save(); renderCoach();}); host.append(skip);
    }
    const audience=$('audienceCard'),r=audience.getBoundingClientRect(),stage=$('stage').getBoundingClientRect();
    host.dataset.compact=String(phone&&r.width<330);
    host.style.width=`${phone?Math.min(250,Math.max(r.width*.42-16,!portraitLayout()&&r.width>=330?200:0)):340}px`; // fixP 5: landscape keeps room for the name plate beside the wider 건너뛰기
    const portraitFight=portraitLayout()&&(upgrade||(chain&&mark.step.endsWith('-fight'))||(state.u15.tutorial.active&&state.u15.tutorial.phase==='fight'&&!state.u15.tutorial.won));
    if(portraitLayout()&&menu==='book'&&upgrade){
      host.dataset.dock='';host.style.right='auto';host.style.left='8px';host.style.top='64px';host.style.bottom='auto';host.style.width=`${Math.min(240,Math.max(160,layoutWidth-96))}px`;return;
    }
    if(portraitFight&&menu!=='book'){
      host.dataset.dock='bottom';host.style.left='0px';host.style.right='0px';host.style.top='auto';host.style.bottom='0px';host.style.width=`${layoutWidth}px`;return;
    }
    host.dataset.dock='';host.style.right='';
    if(menu==='book'){host.style.left='8px';host.style.top='auto';host.style.bottom='8px';return;}
    if(upgrade){host.style.left='8px';host.style.top='auto';host.style.bottom='64px';return;}
    const protectedRects=[node,$('magicianMini'),$('audience'),$('stageStats'),$('statsButton'),document.querySelector('.doubt'),$('audienceLine')].filter(el=>el&&!el.hidden&&getComputedStyle(el).visibility!=='hidden').map(el=>el.getBoundingClientRect());
    const w=host.getBoundingClientRect().width,h=host.getBoundingClientRect().height;
    const candidates=[{x:r.left+8,y:r.top+32,edge:'top'},{x:r.left+8,y:r.top+8,edge:'top'},{x:r.right-w-8,y:r.top+8,edge:'top'},{x:r.right-w-8,y:r.bottom-h-8,edge:'bottom'},{x:r.left+8,y:r.bottom-h-8,edge:'bottom'}];
    const overlap=p=>protectedRects.reduce((n,z)=>n+Math.max(0,Math.min(p.x+w,z.right)-Math.max(p.x,z.left))*Math.max(0,Math.min(p.y+h,z.bottom)-Math.max(p.y,z.top)),0);
    candidates.sort((a,b)=>overlap(a)-overlap(b));let best=candidates[0];
    if(phone&&overlap(best)>0){
      // Beside Kali at the bottom edge, keep the same 44px dismissal target.
      const kali=$('magicianMini').getBoundingClientRect(),available=r.right-kali.right-16;
      if(available>=120){host.style.width=`${Math.min(250,available)}px`;const rh=host.getBoundingClientRect().height,rw=host.getBoundingClientRect().width;const beside={x:r.right-rw-8,y:r.bottom-rh-8,edge:'bottom'};const hits=protectedRects.some(z=>beside.x<z.right&&beside.x+rw>z.left&&beside.y<z.bottom&&beside.y+rh>z.top);if(!hits)best=beside;}
    }
    host.dataset.edge=best.edge;host.style.left=`${(best.x-stage.left)/scale}px`;host.style.top=`${(best.y-stage.top)/scale}px`;host.style.bottom='auto';

  }

  function areaRangePreview(){
    const lv=state.tree.area||0,table=C.CONST.areas,now=table[lv],next=table[Math.min(lv+1,table.length-1)];
    const host=element('div','','area-range-preview');
    const copy=`지금 ${now[0]}×${now[1]}`+(lv<table.length-1?` → 다음 ${next[0]}×${next[1]}`:' · 완성');
    host.append(element('strong',copy));
    const makeGrid=(size,label,kind)=>{
      const grid=element('div','','area-range-grid');grid.setAttribute('role','img');grid.setAttribute('aria-label',label);
      for(let row=0;row<5;row++)for(let col=0;col<5;col++)grid.append(element('span','',col<size[0]&&row<size[1]?kind:''));
      return grid;
    };
    host.append(makeGrid(now,`지금 ${now[0]}×${now[1]}`,'range-current'),makeGrid(next,`다음 ${next[0]}×${next[1]}`,'range-added'),element('small','노랑: 지금 · 청록: 다음'),element('small','최대 5×5'));
    return host;
  }
  const treeView = { x: 0, y: 0, zoom: 1, selected: 'root', sheet: false, centerPending: false, lastTap: null, revealed: new Set(), ready: false };
  // s4e2 G: the learned node pops and the paid currency in the 비법서 wallet counts down over 300 ms.
  function learnedMoment(id, currency, from) {
    const node = $('panelBody')?.querySelector(`.constellation-node[data-node-id="${id}"]`) || $('panel')?.querySelector(`.constellation-node[data-node-id="${id}"]`);
    if (node && !reduced) { node.classList.remove('learn-pop'); void node.offsetWidth; node.classList.add('learn-pop'); setTimeout(() => node.classList.remove('learn-pop'), 260); }
    const slot = { coins: 0, keys: 1, starlight: 2 }[currency], to = state[currency];
    const value = $('panel')?.querySelectorAll('.tree-wallet')[0]?.querySelectorAll('span:not(.wallet-sep):not(.wallet-name)')[slot * 2 + 1];
    if (!value || reduced || !(from > to)) return;
    const start = performance.now(), show = n => currency === 'coins' ? rounded(n) : Math.round(n);
    value.textContent = String(show(from));
    const step = now => {
      if (!value.isConnected) return;
      const k = Math.min(1, (now - start) / 300);
      value.textContent = String(show(from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
