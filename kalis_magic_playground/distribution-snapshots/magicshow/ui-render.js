'use strict';
  function syncFlags() {
    const stage = $('stage'), card = $('audienceCard'), skills = $('activeSkills'), coach = $('tutorialCoach');
    const story = !$('storyDialog').hidden, coachShown = !coach.hidden, statsx = !!card.querySelector('.stats.phone-expanded');
    stage.classList.toggle('f-story', story);
    if (story) { const h = $('storyDialog').offsetHeight + 'px'; if (stage.style.getPropertyValue('--story-h') !== h) stage.style.setProperty('--story-h', h); } // s4d: the tablet rail starts below the dialog
    stage.classList.toggle('f-coach', coachShown);
    stage.classList.toggle('f-coachc', coachShown && coach.dataset.compact === 'true');
    stage.classList.toggle('f-more', !$('phoneMore').hidden);
    stage.classList.toggle('f-panel', !$('panel').hidden);
    stage.classList.toggle('f-statsx', statsx);
    stage.classList.toggle('f-toast', !!$('toasts').querySelector('.toast'));
    stage.classList.toggle('f-banner', !$('banner').hidden);
    card.classList.toggle('f-story', story);
    card.classList.toggle('f-statsx', statsx);
    // U54c: share the cheap input key with the tail and overlap checks, including late font/image loads.
    fitStageAudience();
    const lineEl = $('audienceLine'), patEl = $('patternLabel'), both = phone && !lineEl.hidden && !!patEl.textContent;
    card.classList.toggle('has-audience-line',!lineEl.hidden);
    const tailKey = JSON.stringify([fitStageAudience.inputKey,lineEl.textContent,lineEl.hidden]);
    if (tailKey !== syncFlags.tailKey) { syncFlags.tailKey = tailKey; if (!lineEl.hidden) card.style.setProperty('--line-h', lineEl.offsetHeight + 'px'); }
    const lineKey = tailKey;
    if (lineKey !== syncFlags.lineKey) {
      syncFlags.lineKey = lineKey; card.classList.remove('f-line-over');
      if (both) { const a = lineEl.getBoundingClientRect(), b = patEl.getBoundingClientRect(); if (a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right) card.classList.add('f-line-over'); }
    }
    if (skills) {
      let other = false;
      for (const child of skills.children) if (child.classList.contains('active-skill') && !child.classList.contains('gem-shop-quick') && !child.hidden) { other = true; break; }
      skills.classList.toggle('f-solo', !other && !!skills.querySelector(':scope > .gem-shop-quick'));
    }
    syncCaseArrange();
  }
  function invalidateStageAudience() {
    fitStageAudience.revision = (fitStageAudience.revision || 0) + 1;
  }
  // U54d: compare the cheap class/resize signature before refreshing cached geometry.
  function fitStageAudience() {
    const card=$('audienceCard'),host=$('audience'),line=$('audienceLine'),stage=$('stage');
    const ref=host.dataset.reference, metrics=STAGE_AUDIENCE_METRICS[ref];
    if (!metrics) return;
    const key=[document.body.className,stage.className,card.className,stage.style.width,stage.style.height,
      fitStageAudience.revision,ref,host.dataset.storyScale,$('patternLabel').textContent,$('phaseIndicator').textContent,line.textContent,line.hidden];
    if(fitStageAudience.key && key.every((v,i)=>v===fitStageAudience.key[i]))return;
    fitStageAudience.inputKey=fitStageAudience.key=key;
    const cs=getComputedStyle(card),cw=card.clientWidth,ch=card.clientHeight;
    const vertical=portraitLayout(),sb=parseFloat(cs.getPropertyValue('--SB'))||0;
    const lineHeight=line.hidden?(phone?72:124):(line.offsetHeight||20);
    let bubble=vertical?42:phone?(cw<340?112:100):50+lineHeight+12,toastFloor=4;
    const foot=phone?(vertical?Math.round(ch*.19):Math.max(sb+8,ch*.2)):sb+20;
    const desk=!vertical?document.querySelector('#mockupDressing .mockup-desk'):null;
    const deskTop=desk?desk.getBoundingClientRect().top-card.getBoundingClientRect().top:ch;
    const width=phone?cw*.5-12:Math.min(390,cw*.5-20);
    // Reserve bubble space above the desk-adjusted head, even with a hidden bubble.
    if(phone && !vertical){
      const pat=$('patternLabel'),phase=$('phaseIndicator');
      const tight=document.body.classList.contains('compact-notice');
      const narrow=tight&&cw<280;
      const phaseTop=tight?(narrow?86:54):Math.max(86,pat.offsetTop+pat.offsetHeight+2);
      card.style.setProperty('--phase-top',phaseTop+'px');
      const toastTop=tight?0:Math.max(96,phaseTop+phase.offsetHeight+2);
      stage.style.setProperty('--toast-top',toastTop+'px');
      if(tight){
        card.style.setProperty('--compact-phase-left',(narrow?12:110)+'px');
        card.style.setProperty('--compact-phase-width',(narrow?82:Math.max(44,cw*.5-114))+'px');
        const origin=stage.getBoundingClientRect(),heading=$('phoneVenue').querySelector('.venue-heading'),wallet=$('phoneWallet').getBoundingClientRect();
        // hotel stage (10-26): a long venue name (호텔 마술 대회) narrowed the notice lane beside it until a notice took three lines and covered the
        // doubt plate (U50 4 at 678x416 and 812x325). The name keeps every letter; its font steps down to 9 px (then tighter letters) until the lane holds a two-line notice.
        const name=$('venueName');name.style.fontSize='';name.style.lineHeight='';name.style.letterSpacing='';
        let venue=heading.getBoundingClientRect();
        for(const [px,ls] of [[11,''],[10,''],[9,''],[9,'-.6px']]){if(wallet.left-Math.max(origin.left+90,venue.right+10)-10>=88)break;name.style.fontSize=px+'px';name.style.lineHeight='14px';name.style.letterSpacing=ls;venue=heading.getBoundingClientRect();}
        const left=Math.max(90,venue.right-origin.left+10);
        stage.style.setProperty('--compact-toast-left',left+'px');
        stage.style.setProperty('--compact-toast-width',Math.max(1,wallet.left-origin.left-left-10)+'px');
      }
      // Reserve a fixed notice budget at this viewport, even after a live toast disappears.
      // This keeps routine sprites on the same baseline and at the same size throughout the cut-in.
      const budget=element('div','액트 50! 피날레 +10 · 동전 +1.2만 · 레벨 12! 멘탈 회복','toast');
      budget.style.cssText='position:absolute;visibility:hidden;pointer-events:none';
      budget.setAttribute('aria-hidden','true');$('toasts').append(budget);
      const toastHeight=Math.max(34,budget.offsetHeight);budget.remove();
      // Phone notices occupy the left column; tablet notices cross the bubble column.
      toastFloor=tight||!document.body.classList.contains('tablet')?4:toastTop+toastHeight+6;
      if(toastFloor>4)bubble=Math.max(bubble,toastFloor+lineHeight+18);
      // 12-115: the rail layout narrowed the stage by a few px, so a long line can wrap taller than the fixed reserve; reserve its real height
      // so the figure is scaled under it instead of touching it (U50 6, 678x416). Short and hidden lines stay inside the old reserve.
      else bubble=Math.max(bubble,toastFloor+lineHeight+18);
      const actorBottom=parseFloat(getComputedStyle($('magicianMini')).bottom)||sb;
      const floor=tight?Math.max(104,pat.offsetTop+pat.offsetHeight+18,phase.offsetTop+phase.offsetHeight+18):Math.max(142,toastTop+toastHeight+18);
      card.style.setProperty('--left-floor',(floor+Math.max(0,actorBottom-sb))+'px');
    }
    const available=Math.max(1,Math.min(ch-foot-bubble,desk?(deskTop-bubble-8)/.9:ch));
    const [,baseH,envelopeW,envelopeH]=metrics,kali=$('magicianMini');
    const kaliSize=Math.min(kali.clientWidth,kali.clientHeight);
    const storyScale=Math.min(1.3,Number(host.dataset.storyScale)||1);
    const zoom=Math.max(.001,Math.min(kaliSize*(vertical?.92:.85)*storyScale/baseH,width/envelopeW,available/envelopeH));
    const height=envelopeH*zoom,artWidth=envelopeW*zoom;
    card.style.setProperty('--aud-fit-h',height+'px');card.style.setProperty('--aud-fit-w',artWidth+'px');
    // Keep the upper body above the shared desk, including tall scenes with small sprites.
    const audienceFoot=desk?Math.max(foot,ch-deskTop-height*.1+8):foot;
    card.style.setProperty('--aud-foot',audienceFoot+'px');
    card.style.setProperty('--bubble-top',Math.max(toastFloor,ch-audienceFoot-height-lineHeight-18)+'px');

  }
  // v4 U46 C3: the stage grows with the player. Three dressing tiers (lights, curtain trims, a prop shelf; img27 overlays) on the audience card:
  // tier 1 from venue 3, tier 2 from venue 7, tier 3 from venue 10 (and in every later dimension). Presentation only; the tier is derived, not saved,
  // so a reload shows the current tier quietly and only a tier reached during play gets the short "무대가 화려해졌어요!" moment.
  const DRESS_FROM = ['school', 'festival', 'vegas'].map(slug => C.venueNumber(slug)); let dressTier = -1; // hotel stage: was [3, 7, 10] by number
  function dressingTier(s) { if (s.dimension > 1) return 3; return DRESS_FROM.filter(v => s.vMax >= v).length; }
  function stageDressing() {
    const tier = dressingTier(state); if (tier === dressTier) return;
    let host = $('stageDressing');
    if (!host) { host = element('div', '', 'stage-dressing'); host.id = 'stageDressing'; host.setAttribute('aria-hidden', 'true');
      for (const part of ['lights', 'trim', 'trim right', 'shelf']) { const img = element('img', '', 'dress-' + part); img.alt = ''; img.draggable = false; host.append(img); }
      $('room').after(host); }
    host.dataset.tier = String(tier); host.hidden = tier === 0;
    if (tier) for (const img of host.querySelectorAll('img')) img.src = `assets/ui/dress-t${tier}-${img.className.split(' ')[0].slice(6)}.webp`;
    const reached = dressTier >= 0 && tier > dressTier; dressTier = tier;
    // the moment is a label inside the dressing layer (not a banner or toast), so it never holds the U39 lanes or the presentation queue
    if (reached) { host.querySelector('.dress-note')?.remove(); const note = element('div', '무대가 화려해졌어요!', 'dress-note'); host.append(note); setTimeout(() => note.remove(), 2200);
      host.classList.remove('dress-new'); void host.offsetWidth; host.classList.add('dress-new'); }
  }
  function respawnStageOf(cell) {
    const tau = Math.max(1, state._tau || 350);
    const frac = Math.max(0, Math.min(1, cell.spawn / tau));
    if (frac > 2 / 3) return 'wood';
    if (frac > 1 / 3) return 'paper';
    return 'case';
  }
  const RESPAWN_ART = { wood: 'assets/respawn-1-wood.webp', paper: 'assets/respawn-2-paper.webp' };
  function paintRespawn(dom, cell, stageName) {
    if (!dom.respawn) return;
    // The case sprite itself is the last third. Wood and paper are a single image in the same box;
    // the cream/wood CSS block is only the asset-failed fallback (sprite() sets that class).
    if (cell.hp > 0 || !stageName || stageName === 'case') {
      dom.respawn.hidden = true;
      dom.respawnStage = '';
      if (dom.el.dataset.respawn) delete dom.el.dataset.respawn;
      return;
    }
    if (dom.respawnStage && dom.respawnStage !== stageName && dom.puff && !reduced) {
      dom.puff.classList.remove('on');
      void dom.puff.offsetWidth;
      dom.puff.classList.add('on');
    }
    dom.respawnStage = stageName;
    dom.el.dataset.respawn = stageName;
    dom.respawn.hidden = false;
    dom.respawn.classList.remove('respawn-wood', 'respawn-paper', 'respawn-case');
    dom.respawn.classList.add('respawn-' + stageName);
    const path = RESPAWN_ART[stageName];
    if (path && dom.respawn.dataset.asset !== path) sprite(dom.respawn, path);
  }
  function render() {
    if (caseArrange && (state.mode !== 'fight' || menu || lineOpen() || wonMoment)) setCaseArrange(false);
    renderBoardPad();
    if (moreReturn && $('panel').hidden && $('phoneMore').hidden) moreReturn = false; // v4 U48 M: the show was reached another way (stage travel, a scene)
    $('stage').classList.toggle('decorations-paused',paused());
    $('equipButton').hidden=!C.equipSlots(state); $('equipButton').classList.toggle('is-new',!!C.equipSlots(state)&&!state.guidance.seen.includes('equipButton'));
    renderU19();renderU14(); renderIdle(); renderU15();
    if ($('gemShopQuick')) $('gemShopQuick').disabled = lineOpen();
    buildBoard(); if(menu!=='boo')audience(); nextBanner(); renderFeatures(); renderMagic(); renderGuidance(); renderColleagues(); stageDressing();
    if (practiceOn && (menu || state.mode !== 'fight' || state.u18.map)) setPractice(false);
    const home=C.bossProfile(state)==='homecoming';
    const boss = C.bossProfile(state)==='mirror';
    $('audienceCard').classList.toggle('final-boss', boss);
    $('audienceCard').classList.toggle('boss-mirror', boss && state.phase2);
    $('phaseIndicator').hidden = !boss && !home;
    $('phaseIndicator').textContent = state.phase2 ? `최종 공연 · 마지막 질문 · 확신 ${state.features.climax.confidence}%` : '최종 공연 · 의심의 거울';
    if (boss) $('patternLabel').textContent = state.phase2 ? '액트 10마다 확신 +10% · 피날레 최대 ×2' : '15초마다 거울 케이스 2개 · 도우미와 연쇄로 열어요';
    {
      const el = $('starlightLabel'), text = `비둘기 ${state.starlight}`;
      $('mockupDoves').textContent = C.formatNumber(state.starlight);
      if (el && el.dataset.pxText !== text) {
        el.dataset.pxText = text; el.replaceChildren();
        const img = document.createElement('img');
        img.className = 'cur-icon'; img.src = 'assets/cur-dove.webp'; img.alt = ''; img.width = 18; img.height = 18;
        el.append(img, document.createTextNode(' ' + text));
      }
    }
    if(home&&!wonMoment) {
      $('phaseIndicator').textContent=['','1막 · 준비한 한 수','2막 · 함께 만든 공연','3막 · 마지막 인사'][state.review.act];
      queueAudienceLine(C.venueBySlug('lecturenote').headliner['act'+state.review.act+'Line'],'homecoming:'+state.review.act);
      $('patternLabel').textContent=['','별표 케이스를 열면 다음 질문을 쉬어요','직접 개봉과 도우미를 연결해요 · 도우미 없이 두 칸도 좋아요','개봉을 이어 마지막 피날레를 완성해요'][state.review.act];
      // v4 U38: the announced last heckle: its size is printed so the player can compare it with 멘탈 + 자신감 (and 야유 막기 can cancel it).
      if(C.threatInfo(state).last)$('patternLabel').textContent=`마지막 야유 · 한 번에 ${C.formatNumber(C.CONST.finalHeckle)}`;
    }
    if(C.bossProfile(state)==='future'&&!wonMoment){const u=state.u19;$('phaseIndicator').hidden=false;$('phaseIndicator').textContent=['','1막 · 거울 쇼타임','2막 · 완벽한 루틴','3막 · 마지막 한 장'][u.phase];$('patternLabel').textContent=u.telegraph>0?['','쇼타임을 쓰면 내 방어도 올라가. 끝난 뒤 노려 봐.','빛나는 케이스를 2초마다 눌러 액트를 이어 줘.','이게 진짜 미래의 나야. 20초 동안 빛나는 칸만!'][u.phase]:u.phase===1?'쇼타임 중 거울 방어 상승':u.phase===2?'빛나는 칸을 계속 눌러요':u.window>0?`빛나는 최강 케이스만 · ${Math.ceil(u.window/1000)}초`:'마지막 한 장을 이어 가요';}
    if(state.u18.challenge){const c=state.u18.challenge;$('patternLabel').textContent=c.kind==='trueFan'?'찐팬 도전 · '+C.trueFanRule(c.slug).label:'다시 만난 관객';}
    $('mapButton').disabled=!state.u18.map&&!C.travelAllowed(state);
    // Recompute outside audience()'s face cache: travel and theater phases can reuse a face.
    $('stageNumber').textContent = encounterNumber();
    $('mapButton').hidden = state.u15.tutorial.active || !state.u15.tutorial.done || !!state.u15.scene
      || !!state.batchD.twist.scene || state.features.climax.left > 0 || !!wonMoment
      || ['boo','fail','ending','rebirth','bossPhase','headliner','dealer'].includes(menu)
      || !$('introStory').hidden || !$('sceneCard').hidden || $('stage').dataset.cutscene === '1';
    $('rebirthButton').hidden = !state.seenEnding || state.homecomingCleared&&!state.u19.cleared;
    pxText($('rebirthButton'),phone ? (state.homecomingCleared ? '✨ 환생' : '✨ 이어서') : (state.homecomingCleared?'다음 차원의 공연':'이어지는 공연'));
    if (state.pattern === 'heal' && state.mode === 'fight') $('audienceCard').classList.toggle('healing', state.patternHealMs > C.CONST.patternHealEvery - 600);
    else $('audienceCard').classList.remove('healing');
    const dv = typeof shownDoubt === 'function' ? shownDoubt() : { hp: state.audHp, max: state.audHpMax }; // s5b: the theater phases show their own bar (see doubtText)
    numText($('doubtNumber'), fitDoubtPlate.short ? rounded(dv.hp) : (typeof doubtText==='function'?doubtText():`${rounded(state.audHp)}/${rounded(state.audHpMax)}`), true); // v4 U53 2: only the current doubt on the narrowest plates
    $('doubtFill').style.width = `${Math.round(dv.hp / dv.max * 500) / 5}%`;
    {
      // v4 U38: heckle strength per second, doubt regrowth per second (only when there is any) and the player's own matching numbers.
      const th=C.threatInfo(state),heckleText=th.last?`마지막 한 번 ${rounded(th.hit)}`:`한 번에 ${rounded(th.hit)}`,everyText=th.last?'':`${+th.every.toFixed(1)}초마다`,regenText=th.regen>0?`회복 ${rounded(th.regen)}/초`:'';
      const attackText=portraitLayout()?(th.last?`마지막 ${rounded(th.hit)}`:rounded(th.hit)):heckleText;
      if($('attackNumber').textContent!==attackText)$('attackNumber').textContent=attackText;
      if($('doubtRegen').textContent!==regenText)$('doubtRegen').textContent=regenText;
      fitDoubtPlate(`${$('doubtTitle').textContent}|${regenText.length}|${(typeof doubtText==='function'?doubtText():`${rounded(state.audHp)}/${rounded(state.audHpMax)}`).length}|${innerWidth}x${innerHeight}|${phone}`);
      const mine=C.attackRate(state),mineText=mine==null?'0/초':`${rounded(mine)}/초`;
      if($('stat-rate').textContent!==mineText)$('stat-rate').textContent=mineText;
      const rateText=mine==null?'0':rounded(mine); // s5f (owner): the strip shows 연출 without "/초"
      if($('statRateNum').textContent!==rateText)$('statRateNum').textContent=rateText;
      if($('stat-heckle').textContent!==heckleText)$('stat-heckle').textContent=heckleText;
      if($('stat-heckle-every')&&$('stat-heckle-every').textContent!==everyText)$('stat-heckle-every').textContent=everyText; // v4 U47 1: the interval is the small second line
      const challengeText=`+${Math.round(C.challengeBonus(state)*100)}%`;if($('stat-challenge')&&$('stat-challenge').textContent!==challengeText)$('stat-challenge').textContent=challengeText; // v4 U46 C1
    }
    $('countdown').textContent = `${Math.max(0, state.heckleMs / 1000).toFixed(1)}초`;
    {
      const card = $('audienceCard'), on = state.mode === 'fight' && state.heckleMs <= C.CONST.telegraphMs;
      if (state.mode !== 'fight') heckleWarn = false;
      const warn = on && heckleWarn;
      if (on !== card.classList.contains('telegraph')) card.classList.toggle('telegraph', on);
      if (warn !== card.classList.contains('heckle-warn')) { card.classList.toggle('heckle-warn', warn); if (warn) placeHeckleBang(); }
      card.classList.toggle('mental-low', state.mode === 'fight' && !state.resolved && state.mentalMax > 0 && state.mental / state.mentalMax < .3);
    }
    const meter=$('heckleMeter'),progress=Math.max(0,Math.min(100,(1-state.heckleMs/Math.max(400,state.interval*1000))*100));
    const heckleFill=$('heckleFill');
    if(heckleFill){heckleFill.style.width=progress+'%';heckleFill.style.setProperty('--meter',progress+'%');}
    // s4d (owner 10-24): the 야유 plate fills yellow toward the next heckle (the same timer and interval as core tickHeckle), full when it fires.
    {const level=(state.mode==='fight'&&!state.resolved?progress:0).toFixed(1),plate=$('attackNumber')?.parentElement;if(meter&&meter.style.getPropertyValue('--heckle')!==level){meter.style.setProperty('--heckle',level);plate?.style.setProperty('--heckle',level);}}
    if(meter){meter.setAttribute('aria-valuenow',String(Math.round(progress)));meter.classList.toggle('imminent',state.mode==='fight'&&!state.resolved&&state.heckleMs<=600);}
    syncMotionLoops();
    numText($('stat-power'), rounded(C.wandDamage(state)));
    numText($('stat-damage'), rounded(C.CONST.itemDamage * state._V));
    numText($('stat-guard'), rounded(C.CONST.itemShield * state._U));
    numText($('stat-heal'), rounded(C.CONST.itemHeal * state._U));
    numText($('bestCombo'), state.maxCombo, true);
    actCountUp(state.combo);
    const finaleNeed = Math.max(1, C.nodeEffects(state).finaleNeed);
    { // s5f: one stats strip in every layout: 멘탈, 자신감 and 피날레 rows (label, bar, value), then 액트 and 연출 on the right.
      const mentalMax = Math.max(1, state.mentalMax || 1), clamp = v => Math.max(0, Math.min(1, v));
      const finale = clamp(state.finisher / finaleNeed), mental = clamp(state.mental / mentalMax);
      stripRow('statMental', mental, rounded(state.mental));
      stripRow('statShield', clamp(state.shield / mentalMax), rounded(state.shield));
      stripRow('statFinale', finale, `${rounded(state.finisher)}/${finaleNeed}`);
      const mentalBar = $('statMental').querySelector('.ms-bar'), mentalNow = String(Math.round(mental * 100)), mentalText = `멘탈 ${rounded(state.mental)} / ${rounded(state.mentalMax)}`;
      if (mentalBar.getAttribute('aria-valuenow') !== mentalNow) mentalBar.setAttribute('aria-valuenow', mentalNow);
      if (mentalBar.getAttribute('aria-valuetext') !== mentalText) mentalBar.setAttribute('aria-valuetext', mentalText);
      const finaleBar = $('statFinale').querySelector('.ms-bar'), finaleNow = String(Math.round(finale * 100));
      if (finaleBar.getAttribute('aria-valuenow') !== finaleNow) finaleBar.setAttribute('aria-valuenow', finaleNow);
      // s4e2 E: 85% or more glows slowly, so an automatic finale is announced before it fires
      const near = state.mode === 'fight' && !state.resolved && state.finisher / finaleNeed >= .85;
      if ($('statFinale').classList.contains('finale-near') !== near) $('statFinale').classList.toggle('finale-near', near);
    }
    numText($('levelNumber'), state.level);
    if (phone) {
      const values = [state.level, C.wandDamage(state) * C.CONST.tapPower,
        C.nodeEffects(state).critRate * 100, state.u14.visitor.incomeRate];
      ['phoneLevel','phoneTap','phoneCrit','phoneIncome'].forEach((id, i) => {
        const el = $(id), value = Math.max(0, values[i] || 0);
        const shown = i === 2 ? String(Math.round(value * 10) / 10) : C.formatNumber(value);
        if (i && el.__fightValue !== undefined && value > el.__fightValue) {
          el.classList.remove('fight-stat-up');
          void el.offsetWidth;
          el.classList.add('fight-stat-up');
        }
        el.__fightValue = value;
        numText(el, shown);
      });
    }
    const xpNeed = C.xpNeed(state);
    numText($('xpNumber'), `${rounded(state.xp)}/${C.formatNumber(xpNeed)}`, true);
    $('xpFill').style.width = `${Math.min(100, state.xp / xpNeed * 100)}%`;
    for (const id of ['coins','gems','keys']) numText($(id), rounded(state[id]), true);
    // One tutorial case: shrink the board into the space above the docked dialogue so that case sits in the middle of the visible board.
    {
      const mark = chainMark();
      const fightLine = (!!mark && !state.u15.tutorial.done && !state.u15.tutorial.active && mark.step.endsWith('-fight'))
        || (state.u15.tutorial.active && state.u15.tutorial.phase === 'fight' && !state.u15.tutorial.won);
      const solo = portraitLayout() && state.board.length === 1 && (!$('storyDialog').hidden || fightLine);
      if (document.body.classList.contains('portrait-solo') !== solo) { document.body.classList.toggle('portrait-solo', solo); wandOffset = null; }
    }
    centerActiveGrid();
    for (let i = 0; i < cells.length; i++) {
      const cell = state.board[i], dom = cells[i];
      dom.el.classList.toggle('arrange-selected', caseArrange && arrangeFrom === i);
      const pos=C.cellPosition(state,i);dom.el.style.gridColumn=pos.col+1;dom.el.style.gridRow=pos.row+1;
      dom.el.dataset.center=pos.row>=1&&pos.row<=3&&pos.col>=1&&pos.col<=3?'1':'';
      const interference=state.batchD.interference;
      const blocked=interference.left>0&&interference.cell===i;
      dom.el.classList.toggle('batch-d-lock',blocked&&interference.kind==='lock');
      dom.el.classList.toggle('batch-d-hide',blocked&&interference.kind==='hide');
      dom.el.dataset.interference=blocked?(interference.kind==='lock'?'🔒 잠시 잠김':'🙈 내용 가림'):'';
      const locked = !cell, next = i === state.board.length;
      dom.el.classList.toggle('locked', locked);
      dom.el.classList.toggle('next-slot', next);
      dom.el.tabIndex = next ? 0 : -1;
      dom.el.setAttribute('role', next ? 'button' : 'img');
      dom.el.setAttribute('aria-label', next ? slotCondition() : locked ? '잠긴 자리' : `카드 케이스 ${i + 1}`);
      if (locked) { dom.lv.textContent = ''; delete dom.lv.dataset.pips; if (dom.respawn) dom.respawn.hidden = true; delete dom.el.dataset.respawn; continue; }
      const pct = cell.hpMax ? Math.min(100, Math.max(0, Math.round((1 - cell.hp / cell.hpMax) * 100))) : 0;
      // v4 U48 M2: no LV text on the board; the case colour is the level band and 1 to 4 small dots the place inside it (the level stays in the aria-label).
      if (dom.lv.textContent) dom.lv.textContent = '';
      const pips = String(C.casePips(cell)); if (dom.lv.dataset.pips !== pips) dom.lv.dataset.pips = pips;
      dom.el.setAttribute('aria-label', `카드 케이스 ${i + 1} · 레벨 ${cell.lv || 1}`);
      const chest = dom.el.querySelector('.chest');
      dom.el.classList.toggle('golden', !!cell.golden);
      dom.el.classList.toggle('golden-broken', !!cell.goldenBroken && cell.hp <= 0);
      const skin=state.u18.equipped.cases;
      const forming = cell.hp <= 0;
      const stageName = forming ? respawnStageOf(cell) : '';
      const intact = forming && stageName === 'case';
      const path = boardCasePath(cell,skin,forming,intact);
      dom.el.classList.toggle('case-customized',!!skin);dom.el.dataset.tier=C.caseTier(cell);
      let fallback=chest.querySelector('.sprite-fallback');if(!fallback){fallback=element('span','','sprite-fallback');chest.append(fallback);}fallback.textContent=skin?D.cosmetics.cases.find(x=>x.id===skin).emoji:'📦';
      if (chest.dataset.asset !== path) sprite(chest, path);
      numText(dom.num, pct, true);
      // U36: the fill bar follows the percentage at most every 100 ms (the number above is throttled the same way).
      if (dom.fillPct !== pct && (dom.fillAt === undefined || performance.now() - dom.fillAt >= NUM_MS || pct === 0)) { dom.fillPct = pct; dom.fillAt = performance.now(); dom.fill.style.height = `${pct}%`; dom.fill.style.setProperty('--fill', pct / 100); }
      dom.el.classList.toggle('empty', cell.hp <= 0);
      if (dom.opening !== (pct > 0)) { dom.opening = pct > 0; dom.el.classList.toggle('case-opening', dom.opening); } // v4 U46 A1: the idle bob stops while a case is being opened
      paintRespawn(dom, cell, stageName);
      if (cell.hp <= 0) dom.timer.textContent = `${(cell.spawn / 1000).toFixed(1)}`;
      dom.el.classList.toggle('sealed', cell.sealed);
      dom.el.classList.toggle('mirrored', state.features.climax.mirrored.includes(i));
      dom.el.classList.toggle('review-warning',state.review.target===i&&state.review.elapsed<2000);
      dom.el.classList.toggle('review-active',state.review.target===i&&state.review.elapsed>=2000);
    }
    const a = C.wandArea(state);
    $('areaLabel').textContent = `지팡이 범위 ${a.cols} × ${a.rows}`;
    if ($('rangeShape')) { $('rangeShape').textContent = '▦'; $('rangeShape').setAttribute('aria-label', `${a.cols}열 ${a.rows}행`); }
    $('hint').textContent = caseArrange ? '케이스 정리 · 드래그하거나 두 칸을 눌러 바꾸세요' : menu ? '공연 일시정지' : `${state.wins ? '케이스' : '카드 케이스'}를 탭하면 더 강하게 · 꾹 누르면 초당 ${C.wandRate(state).toFixed(1)}회`;
    updateWand(); modeHooks(); flushHeadlinerEntrance(); renderBatchD(); updateAudienceLine(); syncFlags();
  }
