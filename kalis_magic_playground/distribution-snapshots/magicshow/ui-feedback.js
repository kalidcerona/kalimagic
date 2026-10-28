'use strict';
  function setPractice(on) {
    practiceOn = !!on;
    practiceHold = practiceOn ? { id: 'practice', x: C.CONST.boardSize / 2, y: C.CONST.boardSize / 2, left: 0 } : null;
    document.body.classList.toggle('practice-on', practiceOn);
    const veil = $('practiceVeil');
    if (veil) veil.hidden = true;
    practiceIdleAt = performance.now();
    const button = $('practiceButton');
    if (button) button.setAttribute('aria-pressed', practiceOn ? 'true' : 'false');
    if (practiceOn) requestPracticeWake(); else releasePracticeWake();
  }
  function requestPracticeWake() {
    try {
      if (practiceWake || wakePending || document.hidden || !navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') return;
      wakePending = true;
      navigator.wakeLock.request('screen').then(lock => {
        wakePending = false;
        lock.addEventListener('release', () => { if (practiceWake === lock) practiceWake = null; });
        if (!practiceOn) { lock.release().catch(() => {}); return; }
        practiceWake = lock;
      }).catch(() => { wakePending = false; practiceWake = null; });
    } catch (e) { wakePending = false; practiceWake = null; }
  }
  function releasePracticeWake() {
    const lock = practiceWake;
    practiceWake = null;
    if (!lock) return;
    try { const done = lock.release(); if (done && done.catch) done.catch(() => {}); } catch (e) {}
  }
  const PRACTICE_COPY = "칼리가 자동으로 연습을 합니다.\n연습을 하면서 돈도 벌어오는 기특한 칼리!\n잠시 다른 일을 하고 오셔도 좋습니다.";
  function openPracticePrompt() {
    if (practiceOn) { setPractice(false); return; }
    const host = $('practicePrompt');
    if (!host) return;
    $('practicePromptText').textContent = PRACTICE_COPY;
    host.hidden = false;
  }
  function closePracticePrompt() { const host = $('practicePrompt'); if (host) host.hidden = true; }
  function boardTransform() {
    const board=$('board'),first=board.querySelector('.cell'),k=C.CONST;
    if(!first)return PhoneLayout.transform(rectOf(board),k.boardSize);
    const r=first.getBoundingClientRect(),pos=C.cellPosition(state,0),sx=r.width/k.cellSize,sy=r.height/k.cellSize;
    return PhoneLayout.transform({left:r.left-(k.boardInset+pos.col*(k.cellSize+k.cellGap))*sx,top:r.top-(k.boardInset+pos.row*(k.cellSize+k.cellGap))*sy,width:k.boardSize*sx,height:k.boardSize*sy},k.boardSize);
  }
  function centerActiveGrid(){
    const board=$('board'),active=cells.slice(0,state.board.length);
    if(!active.length)return;
    const rects=active.map(d=>({x:d.el.offsetLeft,y:d.el.offsetTop,w:d.el.offsetWidth,h:d.el.offsetHeight}));
    const left=Math.min(...rects.map(r=>r.x)),right=Math.max(...rects.map(r=>r.x+r.w));
    const top=Math.min(...rects.map(r=>r.y)),bottom=Math.max(...rects.map(r=>r.y+r.h));
    const dx=(board.clientWidth-left-right)/2,dy=(board.clientHeight-top-bottom)/2;
    if (board.style.getPropertyValue('--grid-shift-x') !== dx+'px' || board.style.getPropertyValue('--grid-shift-y') !== dy+'px') wandOffset = null;
    board.style.setProperty('--grid-shift-x',dx+'px');board.style.setProperty('--grid-shift-y',dy+'px');
  }
  // Portrait gaps are tighter than the 608-space grid, so a finger maps to the case cell under it.
  function portraitBoardPoint(clientX, clientY) {
    const board = $('board');
    if (!board || !board.getBoundingClientRect) return null;
    const br = board.getBoundingClientRect();
    if (clientX < br.left || clientX > br.right || clientY < br.top || clientY > br.bottom) return null;
    const k = C.CONST, pitch = k.cellSize + k.cellGap;
    let best = -1, bestD = Infinity;
    const nodes = board.children;
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (!el.classList || !el.classList.contains('cell') || el.classList.contains('locked')) continue;
      const r = el.getBoundingClientRect();
      const inside = clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      const d = inside ? -1 : (clientX - cx) * (clientX - cx) + (clientY - cy) * (clientY - cy);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return null;
    const pos = C.cellPosition(state, best);
    return { x: k.boardInset + pos.col * pitch + k.cellSize / 2, y: k.boardInset + pos.row * pitch + k.cellSize / 2 };
  }
  function boardPoint(x, y) {
    const p = boardTransform().toScreen(x, y), r = rectOf($('stage'));
    return { x: (p.x - r.left) / scale, y: (p.y - r.top) / scale };
  }
  const toastQueue = [], visibleToasts = [];
  let lastToastKind = '';
  function toast(text,kind='') {
    return presentation.push({merge:'toast:'+kind+':'+text,skillNotice:kind==='skill',priority:kind==='skill'?80:0,minimum:1200,start:item=>{
      const el=pxIcons(element('div',text+(item.extra?' · '+item.extra:''),'toast'));$('toasts').append(el);const expiry=setTimeout(()=>el.remove(),3500);item.end=()=>{clearTimeout(expiry);el.remove();};
    }});
  }
  function milestonePop(text,p){presentation.push({merge:'milestone:'+text,minimum:1200,start:item=>{const el=pxIcons(element('div',text+(item.extra?' · '+item.extra:''),'toast'));$('toasts').append(el);float('×2!',p.x,p.y,'#ffe65c',22);const expiry=setTimeout(()=>el.remove(),3500);item.end=()=>{clearTimeout(expiry);el.remove();};}});}
  function nextToasts(dt=0){
    // Ordinary notices wait behind queued dialogue; genuine clear/reward notices still finish first.
    if(state.u15.queue.length&&!presentation.active&&!skillNoticePending()){
      if(!presentation.items.some(item=>item.stageTransition))return;
    }
    presentation.tick(dt,blockingSheetOpen()||!!state.u15.scene||!$('leaveConfirm').hidden||document.hidden||portrait()||!$('offlineCard').hidden||state.features.climax.left>0);
  }
  function winLine() {
    // Curtain call names the final pre-boss sequence, never a generic victory.
    return randomLine(D.pools.win.filter(line => !line.includes('커튼콜')));
  }
  function save() {
    if (restoring || newerSave || !saveStore) return false;
    try {
      // Core's expired timers can be slightly negative at real frame boundaries.
      // Its validator expects nonnegative saved timers. Normalize only the save
      // snapshot, leaving the live simulation and every other field untouched.
      const source = chainFighting && chainBackup ? C.deserialize(chainBackup) : null;
      if(source)source.features.achievements=[...new Set([...source.features.achievements,...state.features.achievements])];
      const saved = source || state;
      if (!source && !document.hidden) C.markAway(state,Date.now());
      const snapshot = Object.assign({}, saved, {
        comboMs: Math.max(0, saved.comboMs),
        sealMs: Math.max(0, saved.sealMs),
        transMs: Math.max(0, saved.transMs)
      });
      snapshot.idle=saved.idle;
      const result = saveStore.write(C.serialize(snapshot));
      if (result.newer) { newerSave = true; showSaveNotice(); }
      if (result.backedUp) toast('저장을 불러오지 못해 백업해 두었어요');
      return result.saved;
    }
    catch (error) {
      if (!saveWarning) { toast('저장할 수 없어요. 이번 공연은 계속돼요'); saveWarning = true; }
      return false;
    }
  }
  let bannerTimer, stageRewardTimer, stageRewardHost = null;
  const bannerQueue = [], unlockBannerQueue = [];
  let bannerActive = null;
  function bannerContext() {
    const c = U5.encounter(D.venues, state);
    return state.mode === 'transition' && wonMoment && (wonMoment.pending||presentation.active?.winner||clock < wonMoment.until) ? wonMoment.context : c;
  }
  function dismissBanner() {
    clearTimeout(bannerTimer); $('banner').hidden = true; $('banner').classList?.remove?.('win-banner'); bannerActive = null;
  }
  function banner(text,sub='',big=false,permanent=false,context=bannerContext(),stageTransition=false){
    presentation.push({stageTransition,merge:'banner:'+text,minimum:2000,priority:big?10:0,start:item=>{
      bannerActive={text,sub,big,permanent,...context};$('banner').replaceChildren(document.createTextNode(text));
      if(sub||item.extra)$('banner').append(element('small',[sub,item.extra].filter(Boolean).join(' · ')));
      $('banner').classList.toggle('big',big);$('banner').hidden=false;if(!reduced)animate($('banner'),[{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)',offset:.2},{opacity:1,offset:.8},{opacity:0,transform:'translateY(-4px)'}],2000);const expiry=setTimeout(dismissBanner,4000);item.end=()=>{clearTimeout(expiry);dismissBanner();};
    }});
  }
  function nextBanner(){ /* All notices share presentation.tick. */ }
  // s4e2 F: notes = achievements and set completions raised by the same clearing hit, shown as one line on this card (not as separate toasts).
  function showStageReward(reward,gems=0,notes=null){
    presentation.push({stageTransition:true,minimum:2000,priority:20,start:item=>{
      sound('milestone');
      const r=D.stageRewards[reward-1],host=element('button','','stage-reward');stageRewardHost=host;host.type='button';
      host.setAttribute('aria-label',r.effect+' · 눌러서 계속');const art=element('img');art.src='assets/reward-'+r.id+'.png';art.alt='';
      host.append(art,element('h2',r.effect),element('p',r.quote));if(gems)host.append(element('p',`실크 +${gems}`));if(notes&&notes.length)host.append(pxIcons(element('p','함께 달성 · '+notes.join(', '),'reward-notes')));$('stage').append(host);
      item.end=()=>{host.remove();stageRewardHost=null;previous=0;};host.addEventListener('click',()=>presentation.finish());release();
    }});
  }
  // Presentation-only damage tiers; no combat values or timers are altered.
  const hitTiers = [
    {name:'작은 감탄',size:11,color:'#f4e5bf'},
    {name:'빛나는 손끝',size:14,color:'#eac568'},
    {name:'무대의 마술사',size:17,color:'#eea06c'},
    {name:'경이로운 순간',size:20,color:'#e6a0c9'},
    {name:'전설의 한 수',size:22,color:'#fff4cb'}
  ];
  function hitTier(damage, maxDoubt) {
    const ratio = maxDoubt > 0 && Number.isFinite(damage) ? Math.max(0,damage) / maxDoubt : 0;
    return ratio < .005 ? 0 : ratio < .02 ? 1 : ratio < .05 ? 2 : ratio < .12 ? 3 : 4;
  }
  const reachedTiers = new Set();
  const UI_KEY='magicShowBuster.v3.presentation';
  let uiSave={bestTier:-1,memories:{}};
  try{const raw=JSON.parse(localStorage.getItem(UI_KEY)||'null');if(raw&&Number.isInteger(raw.bestTier)&&raw.bestTier>=-1&&raw.bestTier<=4&&raw.memories&&typeof raw.memories==='object')uiSave=raw;}catch(error){ /* Keep presentation defaults. */ }
  function savePresentation(){try{localStorage.setItem(UI_KEY,JSON.stringify(uiSave));}catch(error){ /* Combat saves remain independent. */ }}
  let sceneLightHost, lightUntil = 0, lightStrength = 0;
  function sceneLight(strength = .04) {
    if (!sceneLightHost) { sceneLightHost=element('div');sceneLightHost.id='sceneLight';sceneLightHost.setAttribute('aria-hidden','true');$('stage').append(sceneLightHost); }
    const opacity=Math.min(state.features.encoreLeft>0?.015:.08,strength);
    if(clock<lightUntil && opacity<=lightStrength)return;
    lightStrength=opacity;lightUntil=clock+240;
    if (reduced) {
      sceneLightHost.style.opacity=String(opacity);
      const until=lightUntil;setTimeout(()=>{if(lightUntil===until)sceneLightHost.style.opacity='0';},240);
    } else animate(sceneLightHost,[{opacity:0},{opacity,offset:.4},{opacity:0}],240);
  }
  function particleSource(e) {
    const id=e.itemId||'';
    if(/ring/.test(id))return 'ring';
    if(/sponge/.test(id))return 'sponge';
    if(/dove/.test(id))return 'dove';
    return ['card','coin','silk'].includes(e.item)?e.item:'sponge';
  }
  function hitParticles(x,y,source,color,tier=0) {
    if(reduced)return;
    const nearby=particles.filter(p=>p.start===clock&&Math.abs(p.x-x)<2&&Math.abs(p.y-y)<2).length;
    const count=Math.max(0,Math.min(3-nearby,2+tier));
    for(let i=0;i<count && particles.length<caps.particles;i++)particles.push({x,y,dx:(i-(count-1)/2)*6,dy:-12-i%3*4,start:clock,life:280,color,size:3+i%2,shape:source,sheetLead:i===0});
  }
  // U31 colleague magicians: placeholder sprite, name tags and a trick every few seconds.
  const colleagueTricks = ['🃏', '🪄', '🎩', '🕊️', '✨', '🪙'], colleagueShapes = ['card', 'ring', 'silk', 'dove', 'cheer', 'coin'], colleagueTimers = [];
  function renderColleagues() {
    const host = $('colleagues'), n = state.u15.tutorial.active ? 0 : C.colleagueCount(state);
    if (host.dataset.n !== String(n)) {
      host.dataset.n = String(n); host.style.setProperty('--n', String(n)); host.replaceChildren();
      for (let i = 0; i < n; i++) {
        const one = element('div', '', 'colleague'); one.style.setProperty('--i', String(i)); one.dataset.index = String(i);
        const idle = assetImage('assets/colleague-idle.png').cloneNode(), perform = assetImage('assets/colleague-perform.png').cloneNode();
        idle.className = 'colleague-idle'; perform.className = 'colleague-perform'; idle.alt = perform.alt = '';
        one.append(idle, perform, element('span', '', 'colleague-trick'), element('span', D.colleagueNames[i % D.colleagueNames.length], 'colleague-name'));
        host.append(one);
      }
    }
    host.hidden = !n;
    const status = $('colleagueStatus'), names = Array.from({ length: n }, (_, i) => D.colleagueNames[i % D.colleagueNames.length]);
    if (status) status.textContent = n ? `동료 마술사 ${n}명: ${names.join(', ')}` : '';
  }
  function colleagueTrick(e) {
    const one = $('colleagues').children[e.index]; if (!one) return;
    one.classList.add('performing'); pxText(one.querySelector('.colleague-trick'), colleagueTricks[(e.index + state.fails + state.wins) % colleagueTricks.length]);
    clearTimeout(colleagueTimers[e.index]); colleagueTimers[e.index] = setTimeout(() => one.classList.remove('performing'), 700);
  }
  // Only a real (not blocked) colleague hit shows particles and a damage number.
  function colleagueHitFx(e) {
    const r = rectOf($('audience')), stage = rectOf($('stage'));
    hitParticles((r.left + r.width / 2 - stage.left) / scale, (r.top + r.height * .65 - stage.top) / scale, colleagueShapes[(e.index + state.wins) % colleagueShapes.length], '#8be9d0', 0);
    if (e.applied > 0) float(`+${C.formatNumber(e.applied)}`, (r.left + r.width / 2 - stage.left) / scale + (e.index - 2.5) * 16, (r.top + r.height * .5 - stage.top) / scale, '#8be9d0', 12, 0, 0);
  }
  function hitFeedback(e,source='card',maxDoubt=state.audHpMax) {
    const tier=hitTier(e.dmg,maxDoubt),model=hitTiers[tier];
    const r=rectOf($('audience')),stage=rectOf($('stage'));
    const x=(r.left+r.width/2-stage.left)/scale,y=(r.top+r.height*.65-stage.top)/scale;
    float(e.dmg ? C.formatNumber(e.dmg) : '빗나감',x,y,model.color,model.size,tier,e.dmg);
    if(e.dmg>0) {
      hitParticles(x,y,source,model.color,tier);sceneLight(tier===4?.08:.03);
      if(tier>uiSave.bestTier){reachedTiers.add(tier);uiSave.bestTier=tier;savePresentation();banner(`새 경지: ${model.name}`,'',false,true);}
    }
  }
  let motionLoopKey=null;
  function syncMotionLoops() {
    const key=motionLoopKey, stopped=paused(), step=state.onboarding.step, phase=state.u15.tutorial.phase;
    let changed=!key||key.reduced!==reduced||key.stopped!==stopped||key.mode!==state.mode||key.step!==step||key.phase!==phase||key.ready.length!==D.skills.length;
    const skillReadiness=key?key.ready:[];
    for(let i=0;i<D.skills.length;i++){
      const id=D.skills[i].id, value=C.skillUnlocked(state,id)&&state.skills.cooldowns[id]<=0;
      if(skillReadiness[i]!==value){skillReadiness[i]=value;changed=true;}
    }
    if(!changed)return;
    skillReadiness.length=D.skills.length;
    motionLoopKey={reduced,stopped,mode:state.mode,step,phase,ready:skillReadiness};
    const previousLoops=[...document.querySelectorAll('[data-motion-loop]')];
    if(reduced||paused()||state.mode!=='fight'){previousLoops.forEach(el=>el.removeAttribute('data-motion-loop'));return;}
    const visible=el=>!el.hidden&&!el.closest('[hidden]');
    const tutorial=[...document.querySelectorAll('.guide-highlight,.tutorial-target')].find(visible);
    const ready=[...document.querySelectorAll('.active-skill.ready,.cell.next-slot')].find(visible);
    previousLoops.filter(el=>el!==tutorial&&el!==ready).forEach(el=>el.removeAttribute('data-motion-loop'));
    if(tutorial)tutorial.dataset.motionLoop='true';
    if(ready)ready.dataset.motionLoop='true';
  }
  function animate(el, frames, duration, preserveDuration=false) {
    if (!el || reduced) return;
    const old = animations.get(el);
    if (old) old.cancel();
    const ms=duration;
    animations.set(el, el.animate(frames, { duration:ms, easing: 'cubic-bezier(.2,.8,.2,1)' }));
  }
  function float(text, x, y, color = '#f4e5bf', size = 14, tier = 0, amount = 0) {
    if (phone && (x === 426 || x === 676)) { const r=rectOf($('audience')),stage=rectOf($('stage'));x=(r.left+r.width/2-stage.left)/scale;y=(r.top+r.height*.65-stage.top)/scale; }
    if(numbers.length>=caps.numbers){
      let n=null;if(amount>0)for(let i=numbers.length-1;i>=0;i--)if(numbers[i].amount>0){n=numbers[i];break;}
      if(n){n.amount+=amount;n.text=`+${C.formatNumber(n.amount)}`;n.critical=false;if(tier>(n.tier||0))Object.assign(n,{tier,size:Math.min(22,size),color,x,y});return n;}
      numbers.shift();
    }
    const n={text,amount,x:x+(numbers.length%2?12:-12),y:y-Math.floor(numbers.length/2)*12,color,size:Math.min(22,size),tier,start:clock,life:500};
    numbers.push(n);return n;
  }
  function statFloat(effect, value) {
    const model = U5.effectBadge({ effect, value });
    const collapsed = typeof phone !== 'undefined' && phone && !$('statsButton').classList.contains('expanded') && ['power','damage','shield','heal'].includes(effect);
    const el = $(collapsed ? 'statsButton' : model.stat);
    animate(el,[{boxShadow:'0 0 0 3px #E8BF68'},{boxShadow:'none'}],150);
    // Currency arrivals pulse their value without drawing over the reserved HUD.
    if (effect === 'coins') return;
    const r = el && rectOf(el), stage = rectOf($('stage'));
    if (!r) return;
    const x = (r.left - stage.left) / scale + (collapsed ? r.width + 22 : -26), y = (r.top + r.height / 2 - stage.top) / scale;
    if(numbers.length<caps.numbers)numbers.push({text:model.text.slice(model.text.indexOf('+')),x,y,color:'#a8e8ff',size:11,start:clock,life:500,fixed:true});
  }
  // v4 U46 A2: the break moment. A case break throws 24 star and square pixels (4 under reduced motion) inside the U36 particle cap.
  // s4e2 F: the presentation slow (hit stop) left the case break; it now marks only the stage-clear hit (hitStop, 120 ms at 0.15x).
  // The effect clock and the running animations slow down; game time (stepCombat dt) is untouched.
  const BREAK_SLOW = { ms: 120, rate: .15 }; let slowUntil = 0, slowAnims = [];
  function breakMoment(x, y, color) {
    const n = reduced ? 4 : 24;
    for (let i = 0; i < n && particles.length < caps.particles; i++) {
      const angle = i * Math.PI * 2 / n + (i % 2) * .13, speed = 60 + (i * 37) % 60;
      particles.push({ x, y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed - 18, start: clock, life: 420 + (i % 4) * 40, color: ['#F2E6C8', '#E8BF68', color][i % 3], size: 2 + i % 2, square: i % 2 === 0 });
    }
  }
  function hitStop() {
    if (reduced) return;
    slowUntil = performance.now() + BREAK_SLOW.ms;
    slowAnims = document.getAnimations().filter(a => a.playState === 'running'); for (const a of slowAnims) a.playbackRate = BREAK_SLOW.rate;
  }
  function presentationRate(now) {
    if (!slowUntil) return 1;
    if (now < slowUntil) return BREAK_SLOW.rate;
    for (const a of slowAnims) a.playbackRate = 1; slowAnims = []; slowUntil = 0; return 1;
  }
  function burst(x, y, color) {
    if (reduced) return;
    for (let i = 0; i < 3 && particles.length < caps.particles; i++) {
      if(particles.filter(p=>p.start===clock&&Math.abs(p.x-x)<2&&Math.abs(p.y-y)<2).length>=8)break;
      const angle = i * Math.PI * 2 / 8;
      particles.push({ x, y, dx: Math.cos(angle) * (40 + i % 3 * 15), dy: Math.sin(angle) * (42 + i % 4 * 13), start: clock, life: 280, line: i < 4, color, size: 3 + i % 3 });
    }
  }
  function target(effect) {
    if (phone) {
      const id = effect === 'gems' ? 'gems' : U5.effectBadge({ effect }).stat;
      const el = ['stat-power','stat-damage','stat-guard','stat-heal'].includes(id) && !$('statsButton').classList.contains('expanded') ? $('statsButton') : $(id);
      const r = rectOf(el), stage = rectOf($('stage'));
      return { x: (r.left + r.width / 2 - stage.left) / scale, y: (r.top + r.height / 2 - stage.top) / scale }; // s4i: an upright tablet zooms the stage
    }
    if (effect === 'gems' || effect === 'coins') { const r = rectOf($(effect)), stage = rectOf($('stage')); if (r.width) return { x: (r.left + r.width / 2 - stage.left) / scale, y: (r.top + r.height / 2 - stage.top) / scale }; } // s4i: the counter itself (coin is first in the wallet)
    if (effect === 'gems') return { x: 958, y: 90 };
    if (effect === 'coins') return { x: 1230, y: 90 };
    if (effect === 'shield') return { x: 686, y: 438 };
    if (effect === 'power') return { x: 686, y: 298 };
    if (effect === 'heal') return { x: 686, y: 508 };
    if (effect === 'xpBurst') return { x: 500, y: 808 };
    if (effect === 'finisher') { const r = rectOf($('statFinale')), stage = rectOf($('stage')); if (r.width) return { x: (r.left + r.width / 2 - stage.left) / scale, y: (r.top + r.height / 2 - stage.top) / scale }; } // s5f: the 피날레 row of the stats strip
    if (effect === 'boxFill') return { x: 1174, y: 490 };
    return { x: 686, y: 368 };
  }
  function fly(x, y, dest, emoji, label = '', color = '#ffe35b', delay = 0, image = null) {
    if (phone && (x > layoutWidth || y > layoutHeight)) {
      const origin = x >= 870 ? (y < 160 ? target('coins') : boardPoint(x - 870, y - 160)) : target('damage');
      x = origin.x; y = origin.y;
    }
    if (reduced || flights.length >= Math.min(caps.icons, 8)) return;
    if (!image && PX_ICONS[String(emoji).replace(/️/g, '')] && !PX_UI_UNSHIPPED.has(PX_ICONS[String(emoji).replace(/️/g, '')])) image = assetImage(`assets/ui/ic-${PX_ICONS[String(emoji).replace(/️/g, '')]}.webp`); // v4 U46 A5: pixel icon instead of a canvas emoji
    const up = !!(dest && dest.portrait);
    flights.push({ x, y, tx: dest.x, ty: dest.y, emoji, label, color, image, start: clock + delay, life: 220, arc: up ? 'up' : '', pop: up ? dest.pop : null });
  }
  // Portrait case opens rise from the case into the stage. Damage hits the audience; a self buff lands on Kali.
  function portraitDropTarget(effect) {
    const stage = rectOf($('stage'));
    const self = effect === 'shield' || effect === 'heal' || effect === 'power';
    const el = self ? $('magicianMini') : $('audience');
    const r = rectOf(el);
    if (!r || r.width < 2) return Object.assign(target(effect), { portrait: true, pop: $('audience') });
    return { x: (r.left + r.width / 2 - stage.left) / scale, y: (r.top + r.height * (self ? 0.4 : 0.32) - stage.top) / scale, portrait: true, pop: el };
  }
  function landPop(el) {
    if (!el || reduced) return;
    el.classList.remove('land-pop'); void el.offsetWidth; el.classList.add('land-pop');
  }
  function coinStream(x, y, count, delay = 0) {
    for (let i = 0; i < Math.min(count, 8); i++) fly(x + i * 5, y, target('coins'), '🪙', '', '#ffe35b', delay + i * 28);
  }
  // v4 U39: the clear moment. It fills the existing 2500 ms win item (nothing is lengthened): flash, stamp, applause, coins to the counter,
  // two bows and a slide out, all on transform and opacity through Web Animations. Reduced motion keeps opacity only and no particles.
  function audiencePoint(fx, fy) {
    const r = rectOf($('audience')), s = rectOf($('stage'));
    return { x: (r.left + r.width * fx - s.left) / scale, y: (r.top + r.height * fy - s.top) / scale, w: r.width / scale };
  }
  // s4e2 F: one sequence in the same 2500 ms. 0 ms the hit (flash; the hit stop runs at the win event), 150 ms the stamp and the audience pop with
  // applause (onCheer swaps in the happy face), 1500-2300 ms the coins and silk fly to the wallet, and the curtain call follows at 2500 ms.
  function clearMoment(headliner, coins, gems = 0, onCheer = null) {
    const MS = 2500, CHEER = 150, PAY = 1500, card = $('audienceCard'), aud = $('audience');
    const stamp = element('div', headliner ? '기립박수!' : '감탄!', 'win-stamp'); stamp.id = 'winStamp'; stamp.setAttribute('aria-hidden', 'true');
    const flash = element('div', '', 'win-flash'); flash.setAttribute('aria-hidden', 'true');
    card.append(flash, stamp);
    const anims = [];
    const run = (el, frames, opts) => { const a = el.animate(frames, { fill: 'both', easing: 'linear', ...opts }); anims.push(a); return a; };
    const at = ms => ms / MS;
    const fade = [{ opacity: 0, offset: 0 }, { opacity: 0, offset: at(CHEER) }, { opacity: 1, offset: at(CHEER + 120) }, { opacity: 1, offset: at(1800) }, { opacity: 0, offset: at(2100) }, { opacity: 0, offset: 1 }];
    if (reduced) {
      run(stamp, fade, { duration: MS });
    } else {
      run(flash, [{ opacity: 0, offset: 0 }, { opacity: .55, offset: .2 }, { opacity: 0, offset: 1 }], { duration: 120 });
      // U54d: pop down/left from the reserved bubble edge on tablets and narrow stages.
      const rot = document.body.classList.contains('tablet') || document.body.classList.contains('phone-narrow') ? '' : 'rotate(-8deg)';
      run(stamp, [{ opacity: 0, transform: rot + ' scale(2)', offset: 0 }, { opacity: 0, transform: rot + ' scale(2)', offset: at(CHEER) }, { opacity: 1, transform: rot + ' scale(2)', offset: at(CHEER + 1), easing: 'cubic-bezier(.2,.8,.2,1)' }, { opacity: 1, transform: rot + ' scale(1)', offset: at(CHEER + 220) },
        { opacity: 1, transform: rot + ' scale(1)', offset: at(1800) }, { opacity: 0, transform: rot + ' scale(1)', offset: at(2100) }, { opacity: 0, transform: rot + ' scale(1)', offset: 1 }], { duration: MS });
      const pose = (s, r, y, o, extra) => ({ transform: `scale(${s}) rotate(${r}deg) translateY(${y}px)`, offset: at(o), ...extra });
      const bow = (a, b) => [pose(1, 0, 0, a), pose(1, 4, 6, (a + b) / 2), pose(1, 0, 0, b)];
      const out = run(aud, [pose(1, 0, 0, 0), pose(1, 0, 0, CHEER), pose(1.12, 0, 0, CHEER + 40, { easing: 'ease-out' }), pose(1, 0, 0, CHEER + 300), ...bow(900, 1150), ...bow(1250, 1500),
        pose(1, 0, 0, 2150, { opacity: 1 }), { transform: 'scale(1) rotate(0deg) translateY(12px)', opacity: 0, offset: 1 }], { duration: MS });
      animations.set(aud, out); audience.winExit = out;
      setTimeout(() => { if (audience.winExit === out) { out.cancel(); audience.winExit = null; } }, MS + 700);
      // Applause: confetti and hearts fall over the audience for 1.2 s (twice as many for a headliner), inside the particle cap.
      const top = audiencePoint(.5, 0), n = headliner ? 24 : 12, colors = ['#ffe65c', '#ff8fb3', '#8fe3ff', '#b6ff9a'];
      for (let i = 0; i < n && particles.length < caps.particles; i++) {
        const spread = (i / Math.max(1, n - 1) - .5) * Math.max(80, top.w * 1.1);
        particles.push({ x: top.x + spread, y: top.y - 8, dx: (i % 2 ? 14 : -14), dy: 70 + (i % 4) * 18, start: clock + (i % 6) * 190, life: 1200 - (i % 6) * 60, color: colors[i % 4], size: 5 + i % 3,
          shape: i % 4 === 3 ? 'cheer' : undefined, sheetLead: i % 4 === 3 });
      }
    }
    const cheer = setTimeout(() => { if (onCheer) onCheer(); sound('applause', { big: headliner }); }, CHEER);
    // Rewards leave the audience at 1500 ms (after the bows) and the coin counter pulses as they land.
    // From the face top edge, so the coins do not cross the banner below.
    const mid = audiencePoint(.5, .14); clearMoment.origin = mid;
    if (gems) fly(mid.x, mid.y, target('gems'), '🧣', '', '#ffe35b', PAY + 260); // first, so the eight coins cannot fill the flight cap before it
    coinStream(mid.x, mid.y, coins, PAY);
    const pulse = setTimeout(() => { const el = $('coins')?.closest('.currency') || $('coins'); if (!reduced && el) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 220 }); }, PAY + 240 + Math.min(coins, 8) * 28);
    return { stop() { clearTimeout(cheer); clearTimeout(pulse); anims.forEach(a => { if (a !== audience.winExit) a.cancel(); }); stamp.remove(); flash.remove(); } };
  }
  function cellCenter(i) {
    const p = C.cellPosition(state, i), k = C.CONST;
    const pitch = k.cellSize + k.cellGap;
    return boardPoint(k.boardInset + p.col * pitch + k.cellSize / 2, k.boardInset + p.row * pitch + k.cellSize / 2);
  }

