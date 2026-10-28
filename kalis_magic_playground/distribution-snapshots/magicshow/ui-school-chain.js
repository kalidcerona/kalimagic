'use strict';
  // v4 U47 8: after the tutorial the story moves from NDD's room to the family living room; a curtain card names the place for 1.5 s (a tap skips it)
  // before the family lines start, so those lines do not read as part of the NDD scene. The show waits behind the card (paused()).
  function sceneChangeCard(name){
    const card=$('sceneCard');$('sceneCardName').textContent=name;card.hidden=false;
    const item=presentation.push({stageTransition:true,minimum:1500,hold:false,priority:90,end:()=>{card.hidden=true;}});
    card.onclick=()=>{item.minimum=0;};
  }
  function chainMark() {
    const bios = state.u15 && state.u15.bios;
    if (!Array.isArray(bios)) return null;
    const hit = bios.find(k => typeof k === 'string' && k.startsWith('tchain:'));
    if (!hit) return null;
    const parts = hit.split(':');
    return { step: parts[1] || '', line: Number(parts[2]) || 0 };
  }
  function setChain(step, line) {
    if (!state.u15.bios) state.u15.bios = [];
    state.u15.bios = state.u15.bios.filter(k => typeof k !== 'string' || !k.startsWith('tchain:'));
    if (step) state.u15.bios.push(`tchain:${step}:${line || 0}`);
  }
  function schoolChainPaused() {
    if (!state || !state.u15 || state.u15.tutorial.done || state.u15.tutorial.active) return false;
    const mark = chainMark();
    return !!mark && !mark.step.endsWith('-fight');
  }
  function schoolBackdropOn() {
    if (!state || !state.u15 || state.u15.tutorial.done) return false;
    return state.u15.tutorial.active || !!chainMark();
  }
  function chainFace() {
    const mark = chainMark();
    if (!mark || state.u15.tutorial.active || state.u15.tutorial.done) return null;
    const teacher = mark.step.startsWith('teacher') || mark.step.startsWith('upgrade');
    const happy = mark.step.endsWith('-clear') || mark.step.startsWith('upgrade');
    if (teacher) return { name: '수학 선생님', emoji: '👩‍🏫', role: 'critic', portrait: `assets/aud-s1-teacher${happy ? '-happy' : ''}.png` };
    if (mark.step.startsWith('girl')) return { name: '같은 반 여학생', emoji: '👧', role: 'supporter', portrait: `assets/aud-s1-classmate${happy ? '-happy' : ''}.png` };
    return null;
  }
  function applySchoolRoom() {
    const school = D.venues.find(v => v.slug === 'school');
    if (!school) return;
    $('room').dataset.chainSchool = '1';
    $('room').dataset.venue = 'school';
    sprite($('room'), venueAsset(school));
    $('viewport').style.setProperty('--venue-art', `url(${JSON.stringify(assetUrl(venueAsset(school)))})`);
    for (const [k, c] of [['--venue-bg1', school.palette.bg1], ['--venue-bg2', school.palette.bg2], ['--venue-accent', school.palette.accent]]) {
      $('room').style.setProperty(k, c); $('stage').style.setProperty(k, c);
    }
    $('venueName').textContent = '학교';
  }
  function setTutorialTargets(nodes) {
    const next = nodes.filter(Boolean);
    const prev = renderCoach.targets || (renderCoach.target ? [renderCoach.target] : []);
    prev.forEach(el => { if (!next.includes(el)) el.classList.remove('tutorial-target'); });
    next.forEach(el => el.classList.add('tutorial-target'));
    renderCoach.targets = next;
    renderCoach.target = next[0] || null;
  }
  function replaceState(next) {
    if (!next) return false;
    next.features.achievements=[...new Set([...next.features.achievements,...state.features.achievements])];
    next=C.deserialize(C.serialize(next));if(!next)return false;
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, next);
    return true;
  }
  function newTutorialLesson(){return !state.u15.tutorial.done&&state.u15.bios.includes('lesson:v1');}
  function chainLines(step) {
    const pack = D.storyV15.tutorial.schoolChain;
    if(step==='lesson-intro')return [...D.storyV15.tutorial.intro,...D.storyReview.tutorialLesson.before];
    return { 'girl-intro': pack.girlIntro, 'girl-clear': pack.girlClear, 'teacher-intro': pack.teacherIntro, 'upgrade-lines': pack.upgrade }[step] || null;
  }
  const CHAIN_AFTER = { 'girl-intro': 'girl-fight', 'girl-clear': 'teacher-intro', 'teacher-intro': 'teacher-fight', 'upgrade-lines': 'upgrade-play', 'girl-fight': 'girl-clear', 'teacher-fight': 'upgrade-lines' };
  // The first two fights are rehearsals restored from their baseline.
  // NDD is the third audience; its first new-player attempt ends in the core lesson event.
  function ensureChainFight(step) {
    if (chainFighting) return;
    chainBackup = C.serialize(state);
    chainFighting = true;
    const hp = step.startsWith('teacher') ? 180 : 120;
    state.audHp = state.audHpMax = hp;
    state.atk = 1; state.interval = 8; state.heckleMs = 8000; state.telegraphed = false;
    state.fightMs = 0; state.resolved = false; state.mode = 'fight';
    state.mental = Math.max(state.mental, 10);
    state.u15.queue = []; state.u15.scene = null;
    lastAudience = '';
  }
  function absorbChainWin() {
    const mark = chainMark();
    if (!mark || !mark.step.endsWith('-fight') || state.u15.tutorial.active) return false;
    const next = newTutorialLesson()&&mark.step==='teacher-fight'?'lesson-intro':CHAIN_AFTER[mark.step] || 'girl-intro';
    if (chainBackup) replaceState(C.deserialize(chainBackup));
    chainFighting = false; chainBackup = '';
    state.onboarding.intro = true;
    setChain(next, 0);
    lastAudience = ''; dialogKey = '';
    save();
    return true;
  }
  function absorbChainFail() {
    const mark = chainMark();
    if (!mark || !mark.step.endsWith('-fight') || state.u15.tutorial.active) return false;
    const step = mark.step, miss = tutorialMissLine(); // v6 script: read before the state is restored
    if (chainBackup) replaceState(C.deserialize(chainBackup));
    chainFighting = false; chainBackup = '';
    state.onboarding.intro = true;
    setChain(step, 0);
    lastAudience = '';
    toast(miss ? `${step.startsWith('teacher') ? '수학 선생님' : '같은 반 여학생'} · ${miss}` : '다시 한 번 보여 주세요');
    save();
    return true;
  }
  function endSchoolTutorial() {
    if (chainFighting && chainBackup) replaceState(C.deserialize(chainBackup));
    chainFighting = false; chainBackup = ''; chainNodeId = ''; chainNodeLevel = -1; chainFocused = false; chainBookChecked = false;
    if (state.u15.tutorial.active) C.finishTutorial(state);
    state.u15.tutorial = { done: true, active: false, won: false, baseline: null };
    state.u15.bios = (state.u15.bios || []).filter(k => typeof k !== 'string' || !k.startsWith('tchain:'));
    state.onboarding.intro = true;
    state.onboarding.step = 8;
    if (!Array.isArray(state.onboarding.facts)) state.onboarding.facts = [];
    if (menu) { menu = ''; $('panel').hidden = true; }
    $('storyDialog').hidden = true; $('introStory').hidden = true; dialogKey = ''; lastAudience = '';
    if ($('room')) $('room').dataset.chainSchool = '';
    setTutorialTargets([]);
    const coach = $('tutorialCoach');
    if (coach) { coach.hidden = true; coach.dataset.step = ''; }
    sceneChangeCard(D.venues[0].name);
    save(); render();
  }
  function beginNdd() {
    chainFighting = false; chainBackup = ''; chainNodeId = ''; chainNodeLevel = -1; chainFocused = false; chainBookChecked = false;
    if (menu) { menu = ''; $('panel').hidden = true; }
    setChain('', 0);
    dialogKey = ''; lastAudience = '';
    failure=null;
    if(newTutorialLesson()&&!state.u15.bios.includes('lesson:failed')&&!state.u15.bios.includes('lesson:attempt'))state.u15.bios.push('lesson:attempt');
    C.startTutorial(state);
    if(newTutorialLesson())state.u15.tutorial.phase='fight';
    save();
  }
  function ensureUpgradeNode() {
    if (chainNodeId) {
      const held = D.tree.find(n => n.id === chainNodeId) || null;
      if (held) {
        const info = C.nodeInfo(state, held.id);
        if (info.cost > 0 && state.coins < info.cost) state.coins = info.cost;
      }
      return held;
    }
    const afford = id => {
      const info = C.nodeInfo(state, id);
      if (!(info.cost > 0)) return false;
      if (state.coins < info.cost) state.coins = info.cost;
      return !!C.nodeInfo(state, id).purchasable;
    };
    // Use the stable node id: display names change. Only coin lessons can use the tutorial's coin grant.
    const named = D.tree.find(n => n.id === 'power');
    let node = named && afford(named.id) ? named : null;
    if (!node) {
      let list = C.affordableNodes(state);
      if (!list.length) {
        const cheap = D.tree.filter(n => {
          const info = C.nodeInfo(state, n.id);
          return info.currency === 'coins' && info.cost > 0 && info.revealed && typeof info.blockedReason === 'string' && info.blockedReason.endsWith('부족');
        }).sort((a, b) => C.nodeInfo(state, a.id).cost - C.nodeInfo(state, b.id).cost);
        if (cheap[0]) afford(cheap[0].id);
        list = C.affordableNodes(state);
      }
      node = list[0] || null;
    }
    if (!node) return null;
    chainNodeId = node.id;
    chainNodeLevel = state.tree[node.id] || 0;
    return node;
  }
  function bookButtonVisible() {
    const book = $('bookButton');
    if (!book || book.hidden) return false;
    const style = getComputedStyle(book);
    return style.display !== 'none' && style.visibility !== 'hidden' && book.getClientRects().length > 0;
  }
  function renderSchoolChain() {
    if (state.u15.tutorial.done || state.u15.tutorial.active) return false;
    const mark = chainMark();
    if (!mark) return false;
    // Leave a readable gap between the classmate scene and the next teacher scene.
    if (skillNoticePending()) { $('storyDialog').hidden = true; dialogKey = ''; return true; }
    if(mark.step==='lesson-fail'){if(menu!=='fail'&&menu!=='book'){failure=0;showFailure();}return true;}
    if (mark.step.endsWith('-fight')) {
      $('storyDialog').hidden = true; dialogKey = '';
      ensureChainFight(mark.step);
      return true;
    }
    if (mark.step === 'upgrade-play') {
      if(newTutorialLesson()&&state.u15.bios.includes('lesson:bought')){beginNdd();return false;}
      const node = ensureUpgradeNode();
      $('storyDialog').hidden = true; dialogKey = '';
      if (!node) { beginNdd(); return false; }
      if ((state.tree[node.id] || 0) > chainNodeLevel) { beginNdd(); return false; }
      if(newTutorialLesson()&&menu!=='book'){tree();chainFocused=false;}
      if (menu === 'book' && !chainFocused) { chainFocused = true; focusNode(node.id); }
      else if (menu !== 'book' && !chainBookChecked) {
        chainBookChecked = true;
        if (!bookButtonVisible()) { tree(); chainFocused = true; focusNode(node.id); }
      }
      return true;
    }
    const lines = chainLines(mark.step);
    if (!lines || !lines.length) { setChain(CHAIN_AFTER[mark.step] || 'girl-intro', 0); return true; }
    const collect = skip => queueStorySkills(lines, mark.line, skip ? lines.length : mark.line + 1, mark.step !== 'girl-clear' || !newTutorialLesson() || state.u15.bios.includes('lesson:failed') || !!state.trophies.family);
    const advance = () => {
      collect(false);
      if (mark.line + 1 < lines.length) setChain(mark.step, mark.line + 1);
      else if(mark.step==='lesson-intro')beginNdd();
      else setChain(CHAIN_AFTER[mark.step] || 'girl-intro', 0);
      save();
    };
    renderDialog(lines, mark.line, 'tutorial:' + mark.step, advance, () => { collect(true); endSchoolTutorial(); });
    return true;
  }
  function renderU15(){
    const u=state.u15,t=u.tutorial,glove=$('item-auto-glove');
    if(glove){const deck=C.hasDeck(state),left=u.gloveLeft,sec=Math.ceil(left/1000);glove.classList.toggle('glove-active',left>0);glove.classList.toggle('glove-empty',u.gloves<1&&left===0);glove.querySelector('small').className='item-count';glove.hidden=!portraitLayout()&&!deck&&u.gloves===0&&left===0;/* s5f: the portrait row keeps the 칼리 덱 tile at 0 (disabled, a tap does nothing) */glove.disabled=paused()||state.mode!=='fight'||left>0||u.gloves<1;glove.setAttribute('aria-pressed','false');glove.querySelector('small').textContent=left>0?(sec>=60?`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`:sec+'초'):u.gloves+'개';glove.setAttribute('aria-label',left>0?`칼리 덱 자동 연습 중 · 남은 시간 ${sec}초 · ${u.gloves}개 보유`:`칼리 덱 쓰기 · ${u.gloves}개 보유`);if(left>gloveRun)gloveRun=left;if(!left)gloveRun=0;glove.style.setProperty('--cooldown',Math.min(1,left/Math.max(120000,gloveRun))*360+'deg');}
    if(renderSchoolChain()){updateAudienceLine();return;}
    if(t.active){
      if(t.won&&t.phase!=='overview')t.phase='defeat';
      if(t.phase==='fight'){
        $('storyDialog').hidden=true;dialogKey='';
        if(state.fightMs>40000&&state.onboarding.step>=4&&u.gloves===0&&u.gloveLeft===0)u.gloves=1;
        const coaching=D.storyV15.tutorial.coaching.filter(l=>l.speaker!=='칼리'); // s5t (read-through bug 5): the bubble over NDD shows NDD's own lines only
        const line=coaching[Math.min(coaching.length-1,Math.floor(state.fightMs/18000))];if(line){queueAudienceLine(line.text,'coaching:'+line.text);updateAudienceLine();}
        return;
      }
      if(t.won&&$('audience').dataset.asset!=='assets/aud-tutorial-ndd-happy.png')sprite($('audience'),'assets/aud-tutorial-ndd-happy.png');
      const overview=D.storyV15.tutorial.overview;
      const lines=t.phase==='overview'?overview:D.storyV15.tutorial[t.phase==='defeat'?'defeat':'intro'];
      const finish=()=>{endSchoolTutorial();};
      renderDialog(lines,t.line||0,'tutorial:'+t.phase,()=>{if((t.line||0)+1<lines.length)t.line=(t.line||0)+1;else if(t.phase==='intro'){t.phase='fight';t.line=0;}else finish();save();},finish);return;
    }
    // Story state owns the dialogue lifetime. Notifications may wait behind it, but cannot strand it in a held queue item.
    // Finish clear notices before opening the last story lines; a queued reward/banner must not appear
    // in the readable start pause afterwards. Ordinary queued toasts do not hold the stage.
    const transitionNotice=!!presentation.active?.stageTransition||presentation.items.some(item=>item.stageTransition);
    const storyBlocked=(!u.scene&&skillNoticePending())||blockingSheetOpen()||transitionNotice||document.hidden||portrait()||!$('leaveConfirm').hidden||!$('offlineCard').hidden||!$('sceneCard').hidden||!$('banner').hidden||!!stageRewardHost;
    // s5b: the subway memory (the rest of the theater beforeHeadliner) starts at phase 2 (the fight waits behind it); its lines show after the
    // phase-1 win beat.
    if(!storyBlocked&&t.done&&C.startTheaterScene&&C.startTheaterScene(state))save();
    if(!storyBlocked&&!state.u18.anchor&&t.done&&(state.mode!=='transition'||state.idle.waiting||state.batchD.encore.phase==='choice'||state.batchD.rebirthOffer)&&!u.scene&&u.queue.length&&state.features.climax.left<=0&&state.batchD.twist.scene!=='complete')C.startScene(state); // s5t: the twist complete panel comes before the 공연 뒤 lines
    if(u.scene&&!(state._theaterBeat&&clock<state._theaterBeat.until)){const scene=u.scene,lines=D.storyV15.venues[scene.slug][scene.kind];renderDialog(lines,scene.line,'story:'+scene.dimension+':'+scene.slug+':'+scene.kind,()=>advanceSkillScene(false),()=>advanceSkillScene(true));}
    else if(typeof seronaFailDialog==='function'&&seronaFailDialog(storyBlocked||!t.done||!!state.u18.anchor)){} // s5t
    else{$('storyDialog').hidden=true;dialogKey='';}
    if(typeof storyShade==='function'){ const shade=storyShade(); if(($('stage').dataset.storyShade||'')!==shade){ if(shade)$('stage').dataset.storyShade=shade; else delete $('stage').dataset.storyShade; } } // s5b
    // v4 U51b 1: the 칼리 덱 auto path only moves the story lines on (every 2.5 s, and not under the menu, the leave question or the offline card); the
    // stage itself is started only by autoStartStage (all its guards and the 1 s pause), never directly from here.
    if(C.autoStage(state)&&(u.scene||state.idle.waiting)&&!blockingSheetOpen()&&!document.hidden&&!portrait()&&$('leaveConfirm').hidden&&$('sceneCard').hidden&&$('introStory').hidden&&$('offlineCard').hidden&&!stageRewardHost&&$('banner').hidden){
      $('autoIndicator').hidden=false;if($('autoIndicator').textContent!=='칼리 덱 자동 진행 중: 다음 무대로 이동해요')$('autoIndicator').textContent='칼리 덱 자동 진행 중: 다음 무대로 이동해요';
      const key=u.scene?u.scene.slug+':'+u.scene.kind+':'+u.scene.line:'stage:'+state.venue;
      if(renderU15.autoKey!==key){renderU15.autoKey=key;renderU15.autoAt=clock;}
      if(dialogTyping)renderU15.autoAt=clock;
      if(clock-renderU15.autoAt>=2500&&u.scene)advanceSkillScene(false);
    }else{renderU15.autoKey='';if($('autoIndicator').textContent!=='자동')$('autoIndicator').textContent='자동';}
    updateAudienceLine();
    autoStartStage(); // Check every rendered frame, including blocked frames, so closing a layer starts a fresh pause.
  }
