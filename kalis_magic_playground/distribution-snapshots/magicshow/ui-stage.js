'use strict';
  function squash(i) {
    if (!cells[i]) return;
    // U36: a late-game case is hit 20 times a second; restarting the 140 ms squash more often than every 110 ms only adds animation work.
    if (cells[i].squashAt !== undefined && clock - cells[i].squashAt < 110) return;
    cells[i].squashAt = clock;
    animate(cells[i].box, [{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], 140);
  }
  function slotCondition() {
    const cost = C.nodeCost(state, 'board');
    const options = [];
    if (cost !== null) options.push(`비법서 케이스 자리 구매 · 동전 ${C.formatNumber(cost)}`);
    if (state.vMax < D.venues.length) options.push('새 무대에 처음 도착');
    return options.join(' 또는 ');
  }
  let slotHintTimer;
  function showSlotCondition() {
    // Direct input feedback must not wait behind queued rewards or story notices.
    let hint = $('toasts').querySelector('.slot-condition');
    if (!hint) { hint = element('div', '', 'toast slot-condition'); hint.setAttribute('role', 'status'); $('toasts').prepend(hint); }
    hint.textContent = slotCondition();
    clearTimeout(slotHintTimer);
    slotHintTimer = setTimeout(() => hint.remove(), 1200);
  }
  function buildBoard() {
    if (lastLayout === 'fixed') return;
    lastLayout = 'fixed'; cells.length = 0; $('board').replaceChildren();
    for (let i = 0; i < C.CONST.boardMax; i++) {
      const p = C.cellPosition(state, i);
      const el = document.createElement('div'); el.className = 'cell working';
      el.style.gridColumn = p.col + 1; el.style.gridRow = p.row + 1; el.style.setProperty('--bob', `${-((i * 7) % 25) * 0.11}s`); // v4 U46 A1: per-cell idle bob phase
      el.innerHTML = '<div class="box"><div class="lv"></div><div class="box-fill"></div><div class="chest"></div><div class="respawn-stage" hidden></div><div class="respawn-puff" aria-hidden="true"></div><div class="box-number"><span class="bitmap"></span><span class="percent-symbol">%</span></div><span class="spawn-timer"></span></div>';
      el.addEventListener('click', () => { if (i === state.board.length) showSlotCondition(); });
      el.addEventListener('keydown', e => {
        if (i === state.board.length && ['Enter', ' '].includes(e.key)) { e.preventDefault(); showSlotCondition(); }
      });
      $('board').append(el);
      cells.push({ el, box: el.querySelector('.box'), fill: el.querySelector('.box-fill'),
        num: el.querySelector('.bitmap'), lv: el.querySelector('.lv'), timer: el.querySelector('.spawn-timer'),
        respawn: el.querySelector('.respawn-stage'), puff: el.querySelector('.respawn-puff'), respawnStage: '' });
    }
  }
  // Portrait only: Kali's table art follows the venue.
  function syncKaliTable() {
    const table = $('kaliTable'), v = D.venues[state.venue - 1];
    if (!table || !v || !portraitLayout()) return;
    const street = v.slug === 'party' || v.slug === 'school' || v.slug === 'cafe' || v.slug === 'festival' || v.slug === 'moon';
    const kind = v.slug === 'family' ? 'home' : street ? 'street' : 'stage';
    const src = 'assets/kit/kali-table-skirt.webp';
    if (table.dataset.kind !== kind) { table.dataset.kind = kind; table.src = src; }
    const desk = document.querySelector('#mockupDressing .mockup-desk');
    if (desk) desk.src = `assets/kit/judge-desk${['audition','broadcast'].includes(v.slug) ? '-tv' : ''}.webp`;
  }
  function encounterNumber() {
    const v=D.venues[state.venue-1], j=Math.min(state.j,v.audiences.length+1);
    // Benched legacy roster entries are skipped by the fight rotation.
    const step=v.audiences.slice(0,j-1).filter(a=>!a.bench).length+1;
    return `${state.venue}-${step}`;
  }
  function audience() {
    if(state.mode==='transition'&&state.resolved&&state.idle.next&&!audience.restored){const v=D.venues[state.venue-1],a=C.audienceAt(v,state.j);audience.restored=true;wonMoment={v,a,context:U5.encounter(D.venues,state),until:clock+state.transMs};stageAudienceFace($('audience'),stageAudienceAsset(v,a),6);$('audienceLine').textContent=a.winLine;$('audienceLine').hidden=false;}
    if (wonMoment && (wonMoment.pending||presentation.active?.winner||clock < wonMoment.until)) return;
    wonMoment = null;
    const v = D.venues[state.venue - 1];
    const side = D.batchD.stages[state.batchD.side];
    const faced = chainFace();
    const theaterSlot = !faced && !state.u15.tutorial.active && !!C.theaterPhase && C.theaterPhase(state) > 0, shownPhase = theaterSlot && typeof theaterShownPhase === 'function' ? theaterShownPhase() : 0; // s5b
    const a = faced ? {name:faced.name,emoji:faced.emoji,role:faced.role,flavor:'',bio:''} : state.u15.tutorial.active ? {name:'NDD',emoji:'🙎',flavor:D.storyV15.tutorial.bio,bio:D.storyV15.tutorial.bio} : typeof fightAudience === 'function' ? fightAudience(v, state.j) : v.audiences[state.j - 1] || v.headliner;
    const key = `${state.dimension}:${state.wins}:${state.fails}:${state.batchD.side ? state.batchD.side + ':' : ''}${state.u15.tutorial.active?'tutorial':state.audId}${state.pattern==='futureMirror'&&state.u19.phase===3?':true':''}${faced?':'+faced.name:''}${schoolBackdropOn()?':school':''}${shownPhase===1?':phase1':''}`;
    if (key !== lastAudience) {
      const grows = shownPhase === 2 && /:phase1$/.test(lastAudience) && lastAudience.slice(0, -7) === key; // s5b: 앞줄 관객 → 밍기리 in the same fight
      lastAudience = key; pendingIntro = null; resetAudienceLines();
      if(v.slug==='theater')assetImage('assets/story/subway-memory.webp');
      $('room').dataset.venue = v.slug;
      sprite($('room'), venueAsset(v));
      $('viewport').style.setProperty('--venue-art', `url(${JSON.stringify(assetUrl(venueAsset(v)))})`); // v4 U50: the scene also fills the safe-area and letterbox bands (U50b: quoted with JSON.stringify, so a quote or backslash in a path cannot break the CSS)
      $('room').style.setProperty('--venue-bg1', v.palette.bg1);
      $('room').style.setProperty('--venue-bg2', v.palette.bg2);
      $('room').style.setProperty('--venue-accent', v.palette.accent);
      for (const [k, c] of [['--venue-bg1', v.palette.bg1], ['--venue-bg2', v.palette.bg2], ['--venue-accent', v.palette.accent]]) $('stage').style.setProperty(k, c); // v4 U54: the board half and the panel frames use the venue palette
      $('venueName').textContent = v.name;
      if (typeof syncKaliTable === 'function') syncKaliTable();
      $('doubtTitle').dataset.audience = a.name;
      $('doubtTitle').dataset.kind = ['supporter','helper'].includes(a.role) ? '기대치' : '의심';
      $('doubtTitle').textContent = portraitLayout() ? $('doubtTitle').dataset.kind : `${a.name}의 ${$('doubtTitle').dataset.kind}`;
      portraitCopy();
      $('audience').classList.remove('asset-ready','asset-pending','asset-failed');
      $('audience').replaceChildren(element('span', a.emoji, 'sprite-fallback'));
      const base = side ? side.portrait : faced ? faced.portrait : state.u15.tutorial.active ? 'assets/aud-tutorial-ndd.png' : audienceAsset(v,a);
      $('audience').dataset.reference = base; delete $('audience').dataset.faceBase;
      stageAudienceFace($('audience'),base,state.u15.tutorial.active&&state.u15.tutorial.won?6:audienceDoubtStage());
      $('audience').setAttribute('aria-label', side ? side.character : a.name);
      { const nextA = C.audienceAt(v, state.j + 1); if (nextA && nextA !== a) { const p = audienceAsset(v, nextA); for (const q of [p, p.replace(/\.png$/, '-happy.png')]) assetImage(q); } } // v4 U49 3: warm the next audience's pictures
      animate($('audience'),[{opacity:0},{opacity:1}],350); // U54b: fade in place; every frame stays inside the fitted stage space.
      $('audience').classList.toggle('headliner', a === v.headliner || theaterSlot);
      const headlinerNow = (a === v.headliner || theaterSlot) && !side;
      $('stage').classList.toggle('headliner-fight', headlinerNow);
      headlinerCue = headlinerNow && shownPhase !== 1 ? { name: a.name, key, played: false } : null;
      $('audience').style.setProperty('--story-scale',String(a.storyScale||1));
      $('audience').dataset.storyScale=String(a.storyScale||1);
      queueAudienceLine(a.encounterLine || a.heckles?.[0] || a.preLine || a.bio || a.flavor || a.winLine,key,false,true);
      const shownPattern = shownPhase === 1 ? 'none' : state.pattern; // s5b: the theater phase 1 has no sealBox
      $('audienceCard').dataset.pattern = shownPattern;
      $('patternLabel').textContent = shownPattern === 'invisible' ? '보이지 않는 의심' : shownPattern === 'none' ? '' : D.ui.patterns[shownPattern];
      if (grows && typeof mingiriGrowth === 'function') mingiriGrowth();
      if (a === v.headliner && !D.storyV15.venues[v.slug]) pendingIntro = a;
      $('picture').textContent = ['moon','sun','galaxy','multiverse'].includes(v.slug) ? '🌌' : ['vegas','broadway'].includes(v.slug) ? '🎰' : '🖼️';
      $('plant').textContent = ['moon','sun','galaxy','multiverse'].includes(v.slug) ? '🛰️' : '🪴';
      $('crowd').replaceChildren();
      const emojis = Array.from(new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(v.crowdEmoji || a.emoji), s => s.segment);
      const n = Math.min(40, v.crowd);
      for (let i = 0; i < n; i++) {
        const sprite = document.createElement('span'); sprite.textContent = emojis[i % emojis.length];
        sprite.style.left = `${(i % 10) * 42 + (Math.floor(i / 10) % 2) * 10}px`;
        sprite.style.top = `${Math.floor(i / 10) * 61 + 8}px`;
        $('crowd').append(sprite);
      }
      sprite($('crowd'), v.crowdAsset ? `assets/${v.crowdAsset}` : '');
      $('crowdLabel').textContent = `관객 ${v.crowd}명`;
      const dimension = D.dimensions[state.dimension - 1];
      $('dimensionLabel').textContent = `차원 ${state.dimension} · ${dimension ? dimension.name : '새로운 앵콜'}`;
      $('stage').style.setProperty('--dimension-hue', `${dimension ? dimension.hue : (state.dimension * 47) % 360}deg`);
      if (schoolBackdropOn()) applySchoolRoom(); else $('room').dataset.chainSchool = '';
    }
    if (audience.winExit) { audience.winExit.cancel(); audience.winExit = null; } // the slide-out held the old audience hidden; the entrance above (if any) already runs
    // fixP 5: the school chain's during-fight line is spoken only in the coach box (renderCoach, with the speaker's face); the audience bubble used to repeat it.
  }
  let headlinerCue = null;
  let kaliUntil = 0, kaliMoodState = 'normal', audMoodState = 'doubt', audSurprisedUntil = 0, audHeckleMood = '', audTestMood = ''; // v4 U50d: audTestMood only set by MagicShowUI.audienceMood (tests)
  // v4 U37 faces. Kali and the audience faces are re-evaluated from the state every frame (C.kaliMood, C.audienceMood), so nothing latches.
  // Event faces (big hit, finisher, bow) run until kaliUntil / audSurprisedUntil and then the state face returns by itself.
  function kaliFaceTick() {
    const host = $('magicianMini');
    if (menu === 'boo' || clock < kaliUntil) return;
    kaliMoodState = state.u15.tutorial.active ? 'normal' : C.kaliMood(state, kaliMoodState);
    if (host.dataset.face === kaliMoodState && host.dataset.frame === '0') return;
    host.dataset.frame = '0'; host.dataset.face = kaliMoodState;
    if (kaliMoodState === 'flustered') { host.classList.add('reacting'); sprite(host, kaliReact('surprised')); }
    else {
      host.classList.remove('reacting');
      if (!host.classList.contains('performance-ready')) sprite(host, 'assets/magician-idle.png');
    }
  }
  function audienceFaceTick() {
    if (audTestMood || menu === 'boo' || wonMoment || finalePending !== null) return; // v4 U50d: audTestMood = a face held by the test hook; s4e2 E: the face changes when the finale lands
    const tutorialBase = tutorialStageBase();
    const mark = tutorialBase && !state.u15.tutorial.active ? chainMark() : null;
    const tutorialFight = !!tutorialBase && ((state.u15.tutorial.active && state.u15.tutorial.phase === 'fight' && !state.u15.tutorial.won) || (!!mark && mark.step.endsWith('-fight')));
    if (!tutorialFight && (state.u15.tutorial.active || chainFace())) return; // lines and clear beats keep the portrait audience() already set
    const v = D.venues[state.venue - 1], a = v && (typeof fightAudience === 'function' ? fightAudience(v, state.j) : C.audienceAt(v, state.j)), host = $('audience');
    if (!a || !host.dataset.asset) return;
    const phaseOneWon = !!C.theaterPhase && C.theaterPhase(state) === 2 && a !== v.headliner; // s5b: 앞줄 관객 smiles through its win beat and the subway memory
    const side = D.batchD.stages[state.batchD.side];
    // s5a (owner 10-21): in the cafe talk after the clear, from the line after 세로나's hat line, 카드1412 stands on the stage with the hood down.
    const sc = state.u15.scene, unhooded = !side && a === v.headliner && v.slug === 'cafe' && !!sc && sc.slug === 'cafe' && sc.kind === 'afterClear' && sc.line >= 1;
    stageAudienceFace(host,unhooded ? 'assets/headliner-card1412-talk.png' : side ? side.portrait : tutorialBase || audienceAsset(v,a),unhooded || phaseOneWon ? 6 : audienceDoubtStage());
  }
  function kaliPose(frame,ms) {
    if ($('magicianMini').classList.contains('routine-art')) return; // v4 U49 1: the routine art holds Kali's spot (no card-fan frame, no hop) until the cut-in ends
    kaliUntil = clock + ms;
    $('magicianMini').classList.remove('reacting'); $('magicianMini').dataset.face = 'event';
    $('magicianMini').dataset.frame = String(frame);
    if (!$('magicianMini').classList.contains('performance-ready')) sprite($('magicianMini'),`assets/magician-${frame === 2 ? 'bow' : 'perform'}.png`);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      animate($('magicianMini'), [{transform:'translateY(0)'},{transform:'translateY(-8px)'},{transform:'translateY(0)'}], 220);
  }
  function renderGuidance() {
    const goal = Guidance.goal(state,D,C);
    const strip = $('goalStrip');
    const previous = renderGuidance.previous, compact = typeof phone!=='undefined'&&phone;
    const changed = !previous || previous.strip !== strip || previous.compact !== compact || !strip.children.length ||
      previous.goal.caseText !== goal.caseText || previous.goal.nodeText !== goal.nodeText ||
      previous.goal.costText !== goal.costText || previous.goal.text !== goal.text ||
      previous.goal.node?.id !== goal.node?.id || previous.goal.done !== goal.done;
    if (changed) {
      if (!strip.children.length) {
        const target = element('span','','goal-target');
        target.append(element('span','','goal-node'),element('span','','goal-cost'));
        strip.append(element('span','다음 목표','goal-title'),element('span','','goal-case'),target);
      }
      for (const [name,text] of [['case',goal.caseText],['node',goal.nodeText],['cost',goal.costText]]) {
        const label = strip.querySelector(`.goal-${name}`);
        const compact=typeof phone!=='undefined'&&phone;
        const shown=compact&&name==='cost'&&text.length>14?'동전을 모아요':text;
        if (label.textContent !== shown) label.textContent = shown;
      }
      strip.setAttribute('aria-label',goal.text); strip.title = goal.text;
      $('goalStrip').dataset.nodeId = goal.node?.id || '';
      strip.dataset.hasNode = goal.node ? '1' : '';
      strip.dataset.done = goal.done ? '1' : '';
      renderGuidance.previous = {strip,compact,goal};
    }
    if (goal.node && typeof firstUseHint === 'function' && strip.offsetParent !== null) firstUseHint('goal'); // s5c: only where the strip is shown (not phone portrait)
    kaliFaceTick(); audienceFaceTick();
  }
  function focusNode(id) {
    const node = D.tree.find(n=>n.id===id); if (!node) return;
    treeView.selected = id; treeView.sheet = true; treeView.centerPending = true;
    treeView.x = -node.x * 140 * treeView.zoom;
    treeView.y = -node.y * 140 * treeView.zoom;
    tree(true);
  }
  const rateSamples=[];
  let rateClock=0, rateAudience='';
  function sampleRates(dt,list,coins,mentalLoss,audienceId=state.audId) {
    if(rateAudience!==audienceId){rateSamples.length=0;rateClock=0;rateAudience=audienceId;}
    rateClock+=dt;
    rateSamples.push({at:rateClock,dt,damage:list.filter(e=>e.type==='audHit').reduce((n,e)=>n+(e.applied ?? e.dmg),0),coins:Math.max(0,coins),mentalLoss:mentalLoss});
    while(rateSamples.length && rateSamples[0].at<=rateClock-3000)rateSamples.shift();
  }
  function renderIdle() {
    if(rateAudience && rateAudience!==state.audId){rateSamples.length=0;rateClock=0;rateAudience=state.audId;}
    while(state.idle.milestones.length){const id=state.idle.milestones.shift(),p=cellCenter(0);milestonePop(`${D.tree.find(n=>n.id===id).name} ×2!`,p);sound('milestone');}
    const unlocked=C.practiceUnlocked(state);
    $('autoIndicator').hidden=!unlocked||boardHolds.length>0||state.mode!=='fight'||paused()||state.features.climax.left>0;
    D.skills.forEach(k=>{
      const el=$('skill-'+k.id), left=state.skills.cooldowns[k.id], ready=left<=0;
      const available=C.skillUnlocked(state,k.id);
      el.hidden=!available&&!portraitLayout();el.disabled=!available||!ready||paused()||state.mode!=='fight';
      const face=portraitLayout()?{cardrain:['카드 비','icon-card-rain'],showtime:['마술 모자','icon-magic-hat'],cheer:['비둘기','icon-dove-summon']}[k.id]:[k.name,{cardrain:'icon-card-rain',showtime:'icon-showtime',cheer:'icon-cheer'}[k.id]];
      el.querySelector(':scope > span:not(.skill-art)').textContent=face[0];
      const art=el.querySelector('.skill-art');if(art.dataset.skillFace!==face[1]){sprite(art,'assets/kit/'+face[1]+'.webp');art.dataset.skillFace=face[1];}
      if(available&&ready&&state.mode==='fight'&&typeof firstUseHint==='function')firstUseHint('skill',k.name); // s5t: the first skill that becomes ready (display name)
      el.classList.toggle('ready',ready);el.classList.toggle('skill-locked',!available&&portraitLayout());el.classList.toggle('in-use',k.id==='showtime'&&state.skills.showtimeLeft>0);el.style.setProperty('--cooldown',`${Math.round(left/C.skillCooldown(state,k.id)*360)}deg`);
      el.querySelector('small').textContent=!available && portraitLayout() ? '무대 해금' : ready ? (k.id==='showtime' && state.skills.showtimeLeft>0 ? `${Math.ceil(state.skills.showtimeLeft/1000)}초` : '') : `${Math.ceil(left/1000)}초`;
    });
    const seconds=rateSamples.reduce((n,e)=>n+e.dt,0)/1000;
    const damage=seconds?rateSamples.reduce((n,e)=>n+e.damage,0)/seconds:0, coins=seconds?rateSamples.reduce((n,e)=>n+e.coins,0)/seconds:0;
    const eta=damage>0?(typeof shownDoubt==='function'?shownDoubt().hp:state.audHp)/damage:Infinity; // s5b: the theater phase's own bar
    const mentalRate=seconds?Math.max(0,rateSamples.reduce((n,e)=>n+e.mentalLoss,0)/seconds):0;
    const survival=mentalRate>0?(state.mental+state.shield)/mentalRate:Infinity;
    $('perSecond').textContent=`초당 의심 −${C.formatNumber(damage)} · ${eta>survival?'버티기 힘들어요':Number.isFinite(eta)?`이 관객까지 약 ${C.formatNumber(Math.ceil(eta))}초`:'의심을 낮춰 보세요'}`;
    $('coinSecond').textContent=`초당 동전 +${C.formatNumber(coins)}`;
  }
  function stepCombat(dt,input) {
    if (typeof caseArrange !== 'undefined' && caseArrange) return [];
    const coins=state.features.progress.coinsEarned,health=state.mental+state.shield,aud=state.audId;
    const fight=state.mode==='fight' && state.features.climax.left<=0;
    const maxDoubt=state.audHpMax;
    const list=C.step(state,dt,input);
    list.filter(e=>e.type==='audHit').forEach(e=>e.presentationMaxDoubt=maxDoubt);
    if(fight)sampleRates(dt,list,state.features.progress.coinsEarned-coins,health-state.mental-state.shield,aud);
    events(list);return list;
  }
  function activateSkill(id) { if(caseArrange || paused())return;const coins=state.features.progress.coinsEarned,health=state.mental+state.shield,aud=state.audId;const maxDoubt=state.audHpMax;const list=C.useSkill(state,id);list.filter(e=>e.type==='audHit').forEach(e=>e.presentationMaxDoubt=maxDoubt);if(list.length){if(typeof knownHint==='function')knownHint('skill'); /* s5t: pressed before the hint showed */sampleRates(0,list,state.features.progress.coinsEarned-coins,health-state.mental-state.shield,aud);events(list);sound('skill');kaliPose(2,500);save();render();} }
  function receiveOffline(now) {
    syncDaily();
    const away=now-state.idle.wallMs, gain=C.collectOffline(state,now);
    if(gain.awayMs)C.setAwayTotal(state,away);
    return gain;
  }
  function showOffline() {
    const r=state.idle.reward, card=$('offlineCard');
    if(!r||r.doubled){card.hidden=true;return;}
    card.hidden=false;clearDecorations();
    const total=Number.isFinite(r.totalAwayMs) && r.totalAwayMs>=r.awayMs ? r.totalAwayMs : r.awayMs;
    const minutes=Math.floor(total/60000), duration=minutes>=60 ? `${C.formatNumber(Math.floor(minutes/60))}시간 ${minutes%60}분` : `${minutes}분`;
    const cap=total>r.awayMs ? ` · 보상 상한 ${Math.floor(r.awayMs/3600000)}시간` : '';
    $('offlineSummary').textContent=`${duration}${cap} · 동전 +${C.formatNumber(r.coins)} · 케이스 총 ${r.levels}레벨 상승`;
  }
  function initIdleControls() {
  D.skills.forEach(k=>{
    const button=document.createElement('button');button.id='skill-'+k.id;button.className='active-skill';button.hidden=true;
    button.innerHTML=`<span class="skill-art">${k.emoji}</span><span>${k.name}</span><small></small>`; // s4d: icon and name only; the effect is in the 도감 and the 비법 tree
    easyTooltip(button,k.desc);
    sprite(button.querySelector('.skill-art'),'assets/kit/'+({cardrain:'icon-card-rain',showtime:'icon-showtime',cheer:'icon-cheer'}[k.id])+'.webp');button.addEventListener('click',()=>activateSkill(k.id));$('activeSkills').append(button);
  });
  // v4 U48 A: one press uses one 칼리 덱 (120 s auto practice); the button shows how many are owned, then the time left (brick time included).
  const glove=action('',()=>{if(!paused()&&C.useGlove(state)){tutorialSignal('learn');save();render();}});glove.id='item-auto-glove';glove.className='active-skill';
  glove.innerHTML='<span class="skill-art">🃏</span><span>칼리 덱</span><small></small>';
  sprite(glove.querySelector('.skill-art'),'assets/'+D.glove.icon);easyTooltip(glove,D.glove.desc);$('activeSkills').append(glove);
  easyTooltip($('eventVisitor'),D.easyExtras.events);
  sprite($('offlineArt'),'assets/kali-past-sleep.png');
  $('offlineClose').addEventListener('click',()=>{$('offlineCard').hidden=true;});
  let offlineDoubling=false;
  $('offlineDouble').addEventListener('click',()=>{
    if(offlineDoubling||!state.idle.reward||state.idle.reward.doubled)return;
    const reward=state.idle.reward;
    offlineDoubling=true;$('offlineDouble').disabled=true;$('offlineCard').classList.add('performing');
    $('offlineDouble').textContent='공연 중 · 3초';sound('skill');kaliPose(2,3000);
    setTimeout(()=>{if(state.idle.reward===reward)C.doubleOffline(state);offlineDoubling=false;$('offlineCard').classList.remove('performing');$('offlineDouble').disabled=false;$('offlineDouble').textContent='2배 받기';save();showOffline();render();},3000);
  });

  }

  function boardCasePath(cell,skin,forming,intact) {
    // Keep the approved upright tin in every skin/tier; the overlays carry progression.
    return cell.hp < cell.hpMax && !intact ? 'assets/case-open.png' : 'assets/case-closed.png';
  }

  function localDate(now=new Date()) { return `${String(now.getFullYear()).padStart(4,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; }
  function syncDaily() { const date=localDate();if(state.u14.daily.date!==date)C.setDailyDate(state,date); }
  let outfitPath='', outfitGeneration=0, collectionShown=state.u14.collection;
  function renderOutfit() {
    const path=kaliArtPath();
    if(outfitPath===path)return;outfitPath=path;const generation=++outfitGeneration,host=$('magicianMini');
    host.dataset.outfit=String(state.u14.outfit);host.classList.remove('performance-ready');
    const image=assetImage(path),art=nextArt(host);wrapGlyph(host);
    const ready=()=>{if(generation!==outfitGeneration)return;if(host._artGen===art)host.classList.remove('asset-pending');if(image.naturalWidth===768 && image.naturalHeight===256){host.style.backgroundImage=`url('${assetUrl(path)}')`;host.classList.add('performance-ready');}else{host.style.backgroundImage='none';sprite(host,'assets/magician-idle.png');}};
    if(image.complete)ready();else {host.classList.add('asset-pending');image.addEventListener('load',ready,{once:true});image.addEventListener('error',ready,{once:true});}
  }
  function renderU14() {
    syncDaily();renderOutfit();
    if(state.u14.collection&&!collectionShown){banner('칼리 컬렉션 세트 완성!','연출 +10%');sound('milestone');}collectionShown=state.u14.collection;
    const v=state.u14.visitor,host=$('eventVisitor');
    // v4 U49 4: a character line (venue intro / stage line in the transition, a heckle line, the win line, the boo line) no longer hides the pickup. Core already
    // stops its 8 s while it is blocked (visitorBlocked) and while the game is paused for a dialog, so it simply stays where it is; a tap made while it is blocked
    // is kept and caught the moment the line is over. It is still hidden behind panels, the map, the curtain call, the review and the ending.
    const blocked=C.visitorBlocked(state);
    host.hidden=v.left<=0||document.hidden||(!!menu&&menu!=='boo')||!!state.u18.map||state.mode==='ending'||state.features.climax.left>0||state.review.target>=0;
    if(visitorTap&&(v.left<=0||v.serial+1!==visitorTap))visitorTap=0; // visitorTap = serial + 1 of the tapped pickup (0 = none)
    if(visitorTap&&!blocked&&!paused()&&!lineOpen()){visitorTap=0;events(C.catchVisitor(state));}
    if(!host.hidden){
      if(host.dataset.kind!==v.kind){host.dataset.kind=v.kind;host.replaceChildren();host.append(element('span',v.kind==='rabbit'?'🐇':'✍️','sprite-glyph'));const img=element('img'),gen=nextArt(host);img.src=`assets/event-${v.kind==='rabbit'?'golden-rabbit':'fan-sign'}.png`;img.alt='';img.onload=()=>{if(host._artGen!==gen)return;host.classList.remove('asset-pending');host.classList.add('visitor-art');};img.onerror=()=>{if(host._artGen!==gen)return;host.classList.remove('visitor-art');failedArt(host);};host.classList.remove('visitor-art','asset-failed');host.classList.add('asset-pending');host.append(img);}
      host.style.left=`${6+(1-v.left/8000)*76}%`;host.setAttribute('aria-label',v.kind==='rabbit'?'황금 토끼 잡기':'사인 요청 팬 잡기');
    }
    const d=state.u14.daily,r=d.records[d.date]||{claimed:[],progress:{}},selected=C.dailySelection(d.date),remaining=selected.filter(id=>!r.claimed.includes(id)).length;
    if(missionsShown!==remaining){missionsShown=remaining;$('missionsButton').textContent='오늘의 공연';$('missionsButton').dataset.badge=remaining?String(remaining):'✓';$('missionsButton').setAttribute('aria-label',`오늘의 공연 · ${remaining}개 남음`);}
    $('hapticsButton').textContent=state.u14.haptics?'진동 켜짐':'진동 꺼짐';$('hapticsButton').setAttribute('aria-pressed',String(state.u14.haptics));
    if(menu==='missions' && dailyPanelSignature!==JSON.stringify(r))drawMissions();
  }
  let dailyPanelSignature='',missionsShown=-1,visitorTap=0;
  function artFallback(path,emoji,className='') {
    const host=element('span',emoji,className),img=element('img'),gen=nextArt(host);wrapGlyph(host);host.classList.add('asset-pending');img.src=path;img.alt='';img.onload=()=>{if(host._artGen!==gen)return;host.classList.remove('asset-pending');host.classList.add('art-loaded');};img.onerror=()=>{if(host._artGen!==gen)return;host.classList.remove('art-loaded');failedArt(host);};host.append(img);return host;
  }
  function drawMissions() {
    syncDaily();const d=state.u14.daily,r=d.records[d.date]||{claimed:[],progress:{},bonus:false,streakReward:0},streak=d.latest&&C.dateOrdinal(d.date)-C.dateOrdinal(d.latest)>1?0:d.streak;openPanel('missions','오늘의 공연');dailyPanelSignature=JSON.stringify(r);
    const intro=element('div','','mission-heading');intro.append(artFallback('assets/icon-mission.png','🎯','u14-art'),element('p',`${d.date} · 연속 공연 ${streak}일`));$('panelBody').append(intro);
    const cycle=element('div','','streak-cycle');D.streakGems.forEach((g,i)=>{const day=element('span',`${i+1}일 · 🧣 ${g}`);day.classList.toggle('current',streak>0&&(streak-1)%7===i);cycle.append(day);});$('panelBody').append(cycle);
    for(const id of C.dailySelection(d.date)){
      const m=D.missions.find(m=>m.id===id),done=r.claimed.includes(id),progress=Math.min(m.target,r.progress[id]||0),card=element('article','','daily-mission');
      card.classList.toggle('completed',done);card.append(element('strong',m.name),element('p',`${C.formatNumber(progress)} / ${m.target} · 🧣 ${m.gems}${done?' · 보상 받음':''}`));const meter=element('progress');meter.max=m.target;meter.value=progress;meter.setAttribute('aria-label',m.name);card.append(meter);$('panelBody').append(card);
    }
    $('panelBody').append(element('p',r.bonus?'세 공연 완료 · 보너스 책 +1 받음':'세 공연을 모두 마치면 책 +1'),element('p',r.streakReward?`오늘 연속 공연 실크 +${r.streakReward} 받음`:'오늘 첫 미션을 마치면 연속 공연 실크를 받아요'));
  }
  let routineUntil=0;
  function showRoutine(id){
    if(menu||state.u15.scene||state.u15.queue.length||state.u15.tutorial.active||state.telegraphed||state.heckleMs<=C.CONST.telegraphMs||state.features.climax.left>0||C.bossProfile(state)==='future'&&state.u19.telegraph>0)return false;
    if(presentation.items.some(x=>x.routine===id)||presentation.active?.routine===id)return true;
    presentation.push({routine:id,minimum:1600,priority:5,start:item=>{paintRoutine(id);item.end=endRoutine;}});return true;
  }
  // v4 U49 1: the routine art plays in Kali's own spot (#magicianMini) instead of a square panel. The strip (512x256, two 256 frames in the same
  // frame format as kali-performance) replaces the card-fan pose for the 1.6 s cut-in; a reaction face (.reacting / .disappointed) wins over it.
  // #routineCutin stays in the page only as the invisible "a cut-in is playing" marker the triggers and tools read.
  function paintRoutine(id){
    const r=D.routines.find(r=>r.id===id);if(!r)return false;
    const skin=state.u18.equipped.kali,outfit=!!(skin&&skinReactionArt.has(skin)&&outfitRoutineArt.has(id));
    const host=$('magicianMini'),marker=$('routineCutin');
    // v5 4f: a shipped outfit strip replaces the default load; any other equipped item still skips below.
    const strip=outfit?{path:`assets/routine-${id}-${skin}.png`,image:assetImage(`assets/routine-${id}-${skin}.png`)}:(()=>{const path=`assets/routine-${id}.png`,image=assetImage(path);return {path,image};})();
    const path=strip.path,image=strip.image;
    // v5 4b: the routine strips are drawn in the default T-shirt, so an equipped outfit keeps its own performance sheet (owner: perform in the outfit).
    const play=()=>{if(marker.hidden||marker.dataset.routine!==id||!image.naturalWidth||(state.u18.equipped.kali&&!outfit))return;host.style.setProperty('--routine-art',`url('${assetUrl(path)}')`);host.classList.remove('routine-art');void host.offsetWidth;host.classList.add('routine-art');};
    marker.dataset.routine=id;marker.hidden=false;routineUntil=clock+1600;
    if(image.complete)play();else image.addEventListener('load',play,{once:true});
    return true;
  }
  function endRoutine(){const marker=$('routineCutin');marker.hidden=true;delete marker.dataset.routine;$('magicianMini').classList.remove('routine-art');}
  function renderU19(){
    const future=C.bossProfile(state)==='future',u=state.u19;
    const warning=$('futureTelegraph');warning.hidden=!future||u.telegraph<=0;warning.textContent=u.phase===1?'네 쇼타임을 따라 할게.\n끝난 뒤에 나를 노려 봐.':['','','완벽한 루틴\n빛나는 칸을 계속 눌러 줘.','이게 진짜 미래의 나야.\n20초 동안 빛나는 칸만!'][u.phase];
    // fixP 2: on phones the rule plate, the act plate and 칼리's telegraph box stack in one column; each one starts under the one above it.
    if(phone&&future){const pat=$('patternLabel'),act=$('phaseIndicator'),base=(act.offsetParent||$('audienceCard')).getBoundingClientRect().top,shown=e=>!e.hidden&&e.offsetParent&&getComputedStyle(e).visibility!=='hidden'&&!!e.textContent.trim(),under=e=>e.getBoundingClientRect().bottom-base;
      if(portraitLayout()&&shown(pat)&&shown(act))$('audienceCard').style.setProperty('--portrait-phase-top',Math.ceil(under(pat)+2)+'px');
      warning.style.top=warning.hidden?'':Math.ceil(Math.max(0,...[pat,act].filter(shown).map(under))+4)+'px';
      // landscape: the notice lane starts under the box while it is up; fitStageAudience puts the lane back once it closes.
      if(!portraitLayout()&&!warning.hidden){$('stage').style.setProperty('--toast-top',Math.ceil(under(warning)+4)+'px');renderU19.lane=true;}
      else if(renderU19.lane){renderU19.lane=false;invalidateStageAudience();}}
    else warning.style.top='';
    $('magicianMini').classList.toggle('future-suit',state.u18.equipped.kali==='future');
    if((menu||state.u15.scene)&&!$('routineCutin').hidden)endRoutine();
    if(u.pending.length&&$('routineCutin').hidden&&showRoutine(u.pending[0]))u.pending.shift();
    document.querySelectorAll('#board .cell').forEach((el,i)=>el.classList.toggle('future-target',future&&u.phase>=2&&i===u.target&&(u.phase===2||u.window>0)));
  }
  // U36: state flags that style.css used to read through :has() selectors on #stage, #audienceCard and #activeSkills (see the U36 note in style.css).
  // v4 U53 2 (owner: "관객의 이름이 제대로 나오지 않아"): the audience name on the doubt plate is never cut. The plate is measured only when its texts'
  // lengths or the viewport change: if title, regen and number do not fit on one line, the regen ("회복 N/초", also in 능력치) is left out; if the
  // title and the number still do not fit (narrow phones), the title takes two lines in the 9 px pixel font inside the same 22 px plate.
  function doubtText(){const dv=shownDoubt();return `${rounded(dv.hp)}/${rounded(dv.max)}`;}
  function fitDoubtPlate(key){
    if(portraitLayout()){
      const plate=document.querySelector('.doubt-plate');if(!plate)return;
      fitDoubtPlate.key=key;fitDoubtPlate.short=false;
      plate.classList.remove('plate-noregen','plate-2l');
      numText($('doubtNumber'),(typeof doubtText==='function'?doubtText():`${rounded(state.audHp)}/${rounded(state.audHpMax)}`),true);return;
    }
    if(fitDoubtPlate.key===key)return;fitDoubtPlate.key=key;
    const plate=document.querySelector('.doubt-plate');if(!plate)return;
    plate.classList.remove('plate-noregen','plate-2l');fitDoubtPlate.short=false;numText($('doubtNumber'),(typeof doubtText==='function'?doubtText():`${rounded(state.audHp)}/${rounded(state.audHpMax)}`),true);
    const title=$('doubtTitle'),over=()=>plate.scrollWidth>plate.clientWidth||title.scrollWidth>title.clientWidth||plate.scrollHeight>plate.clientHeight+1;
    if(over())plate.classList.add('plate-noregen');
    if(over())plate.classList.add('plate-2l');
    // the narrowest plates (678 x 416 with 62 px insets: 120 px): the number shows the current doubt only (the full meter beside it shows the share)
    if(over()){fitDoubtPlate.short=true;numText($('doubtNumber'),rounded(state.audHp),true);}
  }
