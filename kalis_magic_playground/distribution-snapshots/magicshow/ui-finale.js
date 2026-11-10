'use strict';
  // s5d: a close win at the future table (멘탈 under CLOSE_WIN of max at the winning hit) should read as close. Existing effects only (no new
  // art, no new lines): the 멘탈 gauge rings gold twice (an inset ring: the row never grows past its frame, no bright filter, U23) with a burst, the audience card shakes like a finale impact, a second big applause follows
  // the clear sequence's own at 700 ms, and a longer haptic. body[data-close-win] marks the 2.5 s moment (tests and screenshots read it).
  const CLOSE_WIN = .25;
  function closeWinMoment() {
    document.body.dataset.closeWin = '1'; clearTimeout(closeWinMoment.t); closeWinMoment.t = setTimeout(() => { delete document.body.dataset.closeWin; }, 2500);
    haptic([40, 60, 40, 60, 90]); sceneLight(.08);
    clearTimeout(closeWinMoment.a); closeWinMoment.a = setTimeout(() => { closeWinMoment.a = 0; if (!document.hidden) sound('applause', { big: true }); }, 700); // s5t-2: kept, so it can be cleared
    if (reduced) return;
    const gauge = $('statMental'), r = gauge ? rectOf(gauge) : null, st = rectOf($('stage'));
    if (r && r.width) { gauge.animate([{ boxShadow: 'inset 0 0 0 0 rgba(255,230,92,0)' }, { boxShadow: 'inset 0 0 0 3px rgba(255,230,92,.95)' }, { boxShadow: 'inset 0 0 0 0 rgba(255,230,92,0)' }], { duration: 420, iterations: 2 }); burst((r.left + r.width / 2 - st.left) / scale, (r.top + r.height / 2 - st.top) / scale, '#ffe65c'); }
    animate($('audienceCard'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)', offset: .2 }, { transform: 'translateX(5px)', offset: .5 }, { transform: 'translateX(-3px)', offset: .75 }, { transform: 'translateX(0)' }], 300);
  }
  // s5t-2: ends the close-win moment early (its 2.5 s mark and the pending 700 ms applause) when the show is torn down: a restart after a
  // failure, a rebirth, or the page going to the background.
  function stopCloseWin() {
    clearTimeout(closeWinMoment.t); clearTimeout(closeWinMoment.a); closeWinMoment.t = closeWinMoment.a = 0; delete document.body.dataset.closeWin;
  }
  function haptic(pattern) {
    if(state.u14.haptics && !document.hidden && typeof navigator.vibrate==='function') {
      try { navigator.vibrate(pattern); } catch(error) { /* Optional phone hardware. */ }
    }
  }
  // Round 8 presentation. Combat numbers stay in core; these only show a hit, a telegraph, or a finale.
  function mountRound8() {
    const card = $('audienceCard');
    if (!$('heckleBang')) {
      const bang = element('span', '!', 'heckle-bang'); bang.id = 'heckleBang'; bang.setAttribute('aria-hidden', 'true'); card.append(bang);
    }
    if (!$('mentalEdge')) {
      const edge = element('div', '', 'mental-edge'); edge.id = 'mentalEdge'; edge.setAttribute('aria-hidden', 'true'); card.append(edge);
    }
    if (!$('finaleFx')) {
      const fx = element('div', '', 'finale-fx'); fx.id = 'finaleFx'; fx.hidden = true; fx.setAttribute('aria-hidden', 'true');
      const cut = element('div', '', 'finale-cut');
      cut.append(element('div', '', 'finale-kali'), element('span', '피날레!', 'finale-word'));
      fx.append(element('div', '', 'finale-dark'), element('div', '', 'finale-spot'), cut, element('div', '', 'finale-flash'), element('span', '', 'headliner-plate'));
      card.append(fx);
    }
    // s4e2 E: the finale number sits beside the overlay (not inside it), so it can stay up after the 1200 ms overlay ends.
    if (!$('finaleNum')) { const n = element('span', '', 'finale-num'); n.id = 'finaleNum'; n.setAttribute('aria-hidden', 'true'); card.append(n); }
  }
  // s5f: one stats strip row: the bar fill (--p, 0..1) and the value, written only on change.
  function stripRow(id, p, text) {
    const row = $(id); if (!row) return;
    const v = p.toFixed(3);
    if (row.style.getPropertyValue('--p') !== v) row.style.setProperty('--p', v);
    const n = row.querySelector('.ms-num');
    if (n.textContent !== String(text)) n.textContent = text;
  }
  // s5f (owner): 액트 counts up. A rise rolls the shown number to the new one in 300 ms (ease-out) and pops it once (1.12x, brighter,
  // .ms-pop 240 ms; a new pop starts only after the last one ended, so a fast combo pulses instead of staying big). A drop (a new audience,
  // a broken act) is written at once. Five digits and more ("10,000" to "99,999", then "12.3만") use the smaller .ms-long size.
  // Reduced motion: no roll, no pop.
  const actShow = { value: null, from: 0, to: 0, t0: 0, raf: 0, popAt: -1e9 };
  function actWrite(value) {
    const el = $('statActNum'); if (!el) return;
    const text = C.formatNumber(Math.round(value));
    if (el.textContent !== text) el.textContent = text;
    const long = Math.round(value) >= 10000;
    if (el.classList.contains('ms-long') !== long) el.classList.toggle('ms-long', long);
  }
  function actDisplayTier(value) {
    const tier = value >= 500 ? 4 : value >= 300 ? 3 : value >= 200 ? 2 : value >= 150 ? 1 : 0;
    return { tier, sparkles: [0, 3, 5, 8, 12][tier], line: ['', '공연이 풍성해졌어요', '무대가 더 화려해졌어요', '객석에 감탄이 가득해요', '별빛처럼 빛나는 공연이에요'][tier] };
  }
  // Cache geometry between layout changes; combat renders do not scan layout.
  const actLineObstacles = '#stageStats,#stageStats *,#showBand,#activeSkills,#phoneBar,.topbar,#phoneTop,#audienceLine,#audienceTail,.audience-name,.audience-nameplate,#audienceName,.hud,.xp-row,#phoneFightStats,#patternLabel,#phaseIndicator,#futureTelegraph,#heckleMeter,.doubt,.doubt-plate,#goalStrip,.board-footer,[class*="badge"],button,.is-new,.new-unlock,#featureHud,#hint,#crowdLabel,#helperControls,.caption,[role="button"],input,select,a[href],[role="meter"],[role="progressbar"]';
  // Only blocking surfaces belong here; finale/fever/banner/routine effects keep the caption visible.
  const actLineOverlays = '#phoneMore,#storyDialog,#sceneCard,#introStory,#offlineCard,#leaveConfirm,#curtainCall,#titleScreen,#panel,#practicePrompt,#practiceVeil,#tutorialCoach,dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]';
  const actLineLayout = { dirty:true, membersDirty:true, overlaysDirty:true, key:'', nodes:[], overlays:[], observed:new Set(), affected:new Set(), scans:0 };
  function actLineVisible(e) {
    if(e.hidden||e.closest('[hidden]'))return false;
    const c=getComputedStyle(e);
    return c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity)!==0;
  }
  function watchActLineLayout() {
    if(typeof MutationObserver!=='function')return;
    if(actLineLayout.watching)return;
    actLineLayout.watching=true;
    const invalidate=(members=false,overlays=false)=>{
      actLineLayout.dirty=true;if(members===true)actLineLayout.membersDirty=true;
      if(overlays===true)actLineLayout.overlaysDirty=true;
      requestActTierLine($('statAct'));
    };
    window.addEventListener('resize',invalidate);window.addEventListener('orientationchange',invalidate);
    window.visualViewport?.addEventListener('resize',invalidate);
    window.visualViewport?.addEventListener('scroll',invalidate);
    document.fonts?.ready.then(invalidate);
    const resize=typeof ResizeObserver==='function'?new ResizeObserver(invalidate):null;
    actLineLayout.resize=resize;
    // Ignore numeric glyph churn, meter CSS variables and animation-only classes.
    const geometryStyle=text=>String(text||'').split(';').filter(s=>/^\s*(display|visibility|position|left|top|right|bottom|width|height|padding|margin|gap|font|transform)\s*:/i.test(s)).join(';');
    const layoutClass=text=>String(text||'').split(/\s+/).filter(s=>!['ms-pop','telegraph','heckle-warn','imminent','pulse','active'].includes(s)).sort().join(' ');
    const relevant=e=>actLineLayout.affected.has(e)||e.matches(actLineObstacles+','+actLineOverlays);
    new MutationObserver(records=>{
      for(const r of records){
        const e=r.target;
        if(e.nodeType!==1||e.closest('.act-tier-line,.act-tier-stars,.bitmap'))continue;
        if(r.type==='childList'){
          const changed=[...r.addedNodes,...r.removedNodes].filter(n=>n.nodeType===1&&!n.matches('.act-tier-line,.act-tier-stars'));
          if(changed.some(n=>n.matches(actLineObstacles+','+actLineOverlays)||n.querySelector(actLineObstacles+','+actLineOverlays)))invalidate(true,changed.some(n=>n.matches(actLineOverlays)||n.querySelector(actLineOverlays)));
          continue;
        }
        if(['open','role','aria-modal'].includes(r.attributeName)){
          const oldRole=r.attributeName==='role'&&['button','meter','progressbar','dialog','alertdialog'].includes(r.oldValue);
          if(relevant(e)||oldRole||r.attributeName==='open'&&e.tagName==='DIALOG'||r.attributeName==='aria-modal'&&r.oldValue==='true')invalidate(true,e.matches(actLineOverlays)||actLineLayout.overlays.includes(e));
          continue;
        }
        if(r.attributeName==='hidden'){if(e.hidden!==(r.oldValue!==null)&&relevant(e))invalidate();continue;}
        if(r.attributeName==='class'&&layoutClass(e.getAttribute('class'))===layoutClass(r.oldValue))continue;
        if(r.attributeName==='style'&&geometryStyle(e.getAttribute('style'))===geometryStyle(r.oldValue))continue;
        if(relevant(e)||actLineLayout.nodes.includes(e)||actLineLayout.overlays.includes(e)||['BODY','HTML'].includes(e.tagName)||['frame','viewport','stage','audienceCard','boardCard'].includes(e.id))invalidate(r.attributeName==='class'&&e.matches(actLineObstacles)!==actLineLayout.nodes.includes(e));
      }
    }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:['hidden','class','style','open','role','aria-modal']});
  }
  // Hiding cannot wait for a frame; this check never reads obstacle geometry.
  function hideBlockedActTierLine(host) {
    if(actLineLayout.overlaysDirty){
      actLineLayout.overlaysDirty=false;
      actLineLayout.overlays=[...document.querySelectorAll(actLineOverlays)];
    }
    const blocked=host.dataset.actTier==='0'||blockingSheetOpen()||paused()||actLineLayout.overlays.some(actLineVisible);
    if(blocked){
      const line=$('actTierLine')||host.querySelector('.act-tier-line');
      if(line)line.hidden=true;
      actLineLayout.key='';
    }
    return blocked;
  }
  // Reuse a safe position immediately; refine placement once before paint.
  function requestActTierLine(host) {
    if(!host)return;
    watchActLineLayout();
    if(!hideBlockedActTierLine(host)){
      const line=$('actTierLine')||host.querySelector('.act-tier-line');
      if(line?.hidden&&line.dataset.placement==='clear'&&line.style.left&&line.style.top)line.hidden=false;
    }
    if(actLineLayout.pending)return;
    actLineLayout.pending=true;
    requestAnimationFrame(()=>{actLineLayout.pending=false;placeActTierLine(host);});
  }
  function placeActTierLine(host) {
    const line=$('actTierLine')||host.querySelector('.act-tier-line');
    if(!line||!host.getBoundingClientRect)return;
    watchActLineLayout();
    if(line.parentElement!==document.body){line.id='actTierLine';document.body.append(line);actLineLayout.dirty=true;actLineLayout.membersDirty=true;}
    // Refresh membership only when the DOM/layout changes, never every frame.
    if(actLineLayout.membersDirty){
      actLineLayout.membersDirty=false;
      actLineLayout.nodes=[...document.querySelectorAll(actLineObstacles)];
      actLineLayout.affected.clear();
      for(const node of [...actLineLayout.nodes,...actLineLayout.overlays])
        for(let e=node;e;e=e.parentElement)actLineLayout.affected.add(e);
      const next=new Set(actLineLayout.nodes);
      for(const e of actLineLayout.observed)if(!next.has(e)){actLineLayout.resize?.unobserve(e);actLineLayout.observed.delete(e);}
      for(const e of next)if(!actLineLayout.observed.has(e)){actLineLayout.resize?.observe(e);actLineLayout.observed.add(e);}
    }
    if(hideBlockedActTierLine(host))return;
    const key=host.dataset.actTier+':'+line.textContent;
    if(!actLineLayout.dirty&&actLineLayout.key===key)return;
    actLineLayout.dirty=false;actLineLayout.key=key;actLineLayout.scans++;
    line.dataset.layoutScans=String(actLineLayout.scans);
    line.hidden=false;
    const rect=e=>e.getBoundingClientRect(),origin=rect(host);
    const obstacles=[];
    for(const e of actLineLayout.nodes.filter(actLineVisible)){
      const r=rect(e);if(!r.width||!r.height)continue;obstacles.push(r);
      // NEW markers can paint outside the button's own border box.
      if(e.matches('.is-new,.new-unlock')){
        const c=getComputedStyle(e,'::after');
        if(c.display!=='none'&&c.content!=='none'){
          const sx=r.width/(e.offsetWidth||r.width),sy=r.height/(e.offsetHeight||r.height);
          const w=(parseFloat(c.width)||40)*sx,h=(parseFloat(c.height)||20)*sy;
          const left=r.right-(parseFloat(c.right)||0)*sx-w,top=r.top+(parseFloat(c.top)||0)*sy;
          obstacles.push({left:Math.min(r.left,left),right:Math.max(r.right,left+w),top:Math.min(r.top,top),bottom:Math.max(r.bottom,top+h)});
        }
      }
    }
    const gap=3,stats=rect($('stageStats'));
    // Try narrower two-line forms if a full-width caption has no free rectangle.
    for(const maxWidth of [160,120,96,80]){
      line.style.maxWidth=maxWidth+'px';
      const box=rect(line),w=box.width,h=box.height;
      if(h>24)continue;
      const xs=[Math.max(gap,Math.min(innerWidth-w-gap,origin.right-w)),gap,innerWidth-w-gap];
      const ys=[stats.bottom+gap,stats.top-h-gap,origin.bottom+gap,origin.top-h-gap,gap,innerHeight-h-gap];
      for(const o of obstacles){xs.push(o.right+gap,o.left-w-gap);ys.push(o.bottom+gap,o.top-h-gap);}
      for(const y of ys)for(const x of xs){
        if(x<gap||y<gap||x+w>innerWidth-gap||y+h>innerHeight-gap)continue;
        if(obstacles.some(o=>x<o.right+1&&x+w>o.left-1&&y<o.bottom+1&&y+h>o.top-1))continue;
        line.style.left=x+'px';line.style.top=y+'px';line.dataset.placement='clear';return;
      }
    }
    line.dataset.placement='unresolved';
  }
  function renderActTier(value) {
    const number = $('statActNum'), host = number?.parentElement; if (!host) return;
    const info = actDisplayTier(value);
    host.dataset.actReduced = String(reduced);
    if (host.dataset.actTier === String(info.tier)) { requestActTierLine(host); return; }
    host.dataset.actTier = String(info.tier);
    let stars = host.querySelector('.act-tier-stars'), line = $('actTierLine')||host.querySelector('.act-tier-line');
    if (!stars) {
      stars = element('span', '', 'act-tier-stars'); stars.setAttribute('aria-hidden', 'true');
      line = element('small', '', 'act-tier-line'); line.hidden = true; host.append(stars, line);
    }
    stars.replaceChildren();
    const points = [[0,0],[50,100],[100,0],[25,50],[75,50],[0,100],[50,0],[100,100],[15,20],[85,80],[35,80],[65,20]];
    for (let i = 0; i < info.sparkles; i++) {
      const star = element('i', '', 'act-tier-star');
      star.style.left = points[i][0] + '%'; star.style.top = points[i][1] + '%'; star.style.animationDelay = (i * .1) + 's'; stars.append(star);
    }
    line.textContent = info.line; if (!info.tier) line.hidden = true;
    requestActTierLine(host);
    if (reduced) {
      number.classList.remove('ms-pop');
      number.animate?.([{opacity:.5}, {opacity:1}], {duration:200});
    }
  }
  function actCountUp(to) {
    const el = $('statActNum'); if (!el) return;
    to = Math.max(0, Math.round(to || 0));
    renderActTier(to);
    if (actShow.to === to && actShow.value !== null) return;
    if (actShow.value === null || reduced || to < actShow.to || document.hidden) {
      cancelAnimationFrame(actShow.raf); actShow.raf = 0; actShow.value = actShow.to = actShow.from = to; actWrite(to); return;
    }
    const now = performance.now();
    actShow.from = actShow.value; actShow.to = to; actShow.t0 = now;
    if (now - actShow.popAt >= 240) { actShow.popAt = now; el.classList.remove('ms-pop'); void el.offsetWidth; el.classList.add('ms-pop'); }
    if (!actShow.raf) {
      const step = t => {
        const k = 1 - Math.pow(1 - Math.min(1, Math.max(0, (t - actShow.t0) / 300)), 3);
        actShow.value = actShow.from + (actShow.to - actShow.from) * k; actWrite(actShow.value);
        actShow.raf = k < 1 ? requestAnimationFrame(step) : 0;
        if (!actShow.raf) actShow.value = actShow.to;
      };
      actShow.raf = requestAnimationFrame(step);
    }
  }
  function popChip(anchor, text, kind, ms) {
    const card = $('audienceCard'); if (!card || !anchor) return;
    const hurt = kind === 'hurt';
    const host = kind === 'block' ? anchor.querySelector('.ms-bar') : hurt ? anchor : card;
    if (!host) return;
    card.querySelectorAll('.bar-chip.' + kind).forEach(el => el.remove());
    if (host !== card) host.querySelectorAll('.bar-chip.' + kind).forEach(el => el.remove());
    const chip = element('span', text, 'bar-chip ' + kind); chip.setAttribute('aria-hidden', 'true');
    if (!hurt && kind !== 'block') {
      const r = anchor.getBoundingClientRect(), c = card.getBoundingClientRect(), sc = scale || 1;
      const above = kind === 'block';
      chip.style.left = ((above ? r.left : r.right) - c.left) / sc + 'px';
      chip.style.top = ((above ? r.top : r.top + r.height * .55) - c.top) / sc + 'px';
    }
    host.append(chip);
    setTimeout(() => chip.remove(), ms);
  }
  function trailMeter(id, ms) {
    const el = $(id); if (!el || reduced) return;
    el.style.setProperty('--ghost', el.style.getPropertyValue('--p') || '1');
    el.classList.remove('meter-hit'); void el.offsetWidth; el.classList.add('meter-hit');
    clearTimeout(el._ghost); el._ghost = setTimeout(() => el.classList.remove('meter-hit'), ms);
  }
  // Same trailing chunk as trailMeter, on the doubt bar (its width, not --meter). 360 ms sits in the 300-400 ms window.
  // s4e2 E: hold > 0 keeps the removed chunk lit (no fade) until the finale cards land, then it trails off as usual. Hits during the hold keep it.
  function trailDoubt(hold = 0) {
    const bar = document.querySelector('#audienceCard .doubt') || document.querySelector('.doubt');
    const fill = $('doubtFill');
    if (!bar || !fill || reduced) return;
    if (bar.classList.contains('ghost-hold') && !hold) return;
    if (!bar.querySelector('.doubt-ghost')) {
      const ghost = element('span', '', 'doubt-ghost'); ghost.setAttribute('aria-hidden', 'true'); bar.prepend(ghost);
    }
    if (!bar.classList.contains('ghost-hold')) bar.style.setProperty('--ghost', fill.style.width || '100%');
    clearTimeout(bar._ghost);
    const trail = () => {
      bar.classList.remove('ghost-hold', 'meter-hit'); void bar.offsetWidth; bar.classList.add('meter-hit');
      bar._ghost = setTimeout(() => bar.classList.remove('meter-hit'), 360);
    };
    if (hold) { bar.classList.remove('meter-hit'); bar.classList.add('ghost-hold'); bar._ghost = setTimeout(trail, hold); }
    else trail();
  }
  function shakeMental() {
    const el = $('statMental'); if (!el || reduced) return;
    el.classList.remove('bar-shake'); void el.offsetWidth; el.classList.add('bar-shake');
    clearTimeout(el._shake); el._shake = setTimeout(() => el.classList.remove('bar-shake'), 120);
  }
  function kaliFlinch() {
    const host = $('magicianMini'); if (!host) return;
    host.classList.add('reacting', 'flinch'); host.dataset.face = 'event';
    sprite(host, kaliReact('sad'));
    kaliUntil = clock + 180;
    clearTimeout(host._flinch); host._flinch = setTimeout(() => host.classList.remove('flinch'), 180);
  }
  // s4e2 G: a level-up answers where it happens: LV UP over Kali (the case level-up text), 멘탈 refill glow and a short rising tone.
  function levelUpMoment() {
    const p = stagePoint($('magicianMini'), .5, .08);
    if (p) float('LV UP!', p.x, p.y, '#fff18a', 32);
    const m = $('statMental');
    if (m && !reduced) { m.classList.remove('meter-refill'); void m.offsetWidth; m.classList.add('meter-refill'); clearTimeout(m._refill); m._refill = setTimeout(() => m.classList.remove('meter-refill'), 600); }
    sound('levelUp');
  }
  function placeHeckleBang() {
    const bang = $('heckleBang'), aud = $('audience'), card = $('audienceCard');
    if (!bang || !aud || !card) return;
    const a = aud.getBoundingClientRect(), c = card.getBoundingClientRect(), sc = scale || 1;
    if (a.width < 2) return;
    bang.style.left = (a.left + a.width * .5 - c.left) / sc + 'px';
    bang.style.top = (a.top + a.height * .08 - c.top) / sc + 'px';
  }
  let finaleFullAt = -1e9;
  function stagePoint(el, ax, ay) {
    const r = el.getBoundingClientRect(), s = $('stage').getBoundingClientRect(), sc = scale || 1;
    if (r.width < 2 || r.height < 2) return null;
    return { x: (r.left + r.width * ax - s.left) / sc, y: (r.top + r.height * ay - s.top) / sc };
  }
  function spawnFinaleBurst(life) {
    const from = stagePoint($('magicianMini'), .62, .42) || stagePoint($('audienceCard'), .22, .72);
    const to = stagePoint($('audience'), .48, .32) || stagePoint($('audienceCard'), .7, .4);
    if (!from || !to) return;
    const n = 16 + (Math.floor(performance.now() / 50) % 9);
    const dx0 = to.x - from.x, dy0 = to.y - from.y, len = Math.hypot(dx0, dy0) || 1, px = -dy0 / len, py = dx0 / len;
    for (let i = 0; i < n && particles.length < caps.particles; i++) {
      const spread = (i - (n - 1) / 2) * 9;
      particles.push({ x: from.x, y: from.y, dx: dx0 * .9 + px * spread, dy: dy0 * .8 + py * spread, start: clock, life: life || 400, color: i % 2 ? '#E8BF68' : '#F4EFE2', size: 8, shape: i % 2 ? 'card' : 'coin', finale: true, sheetLead: i % 4 < 2 });
    }
  }
  // s4e2 E: in the full finale the number waits for the cards (FINALE_LAND ms); core damage is already applied at 0 ms, only the display waits.
  const FINALE_LAND = 1000;
  let finalePending = null;
  function showFinaleNumber(dmg) {
    const fx = $('finaleFx'); if (!fx) return;
    if (fx.classList.contains('finale-full') && fx._impact) { finalePending = dmg; return; }
    paintFinaleNumber(dmg, fx.classList.contains('finale-short'));
  }
  function paintFinaleNumber(dmg, short) {
    const n = $('finaleNum'), aud = $('audience'), card = $('audienceCard'); if (!n || !aud || !card) return;
    const a = aud.getBoundingClientRect(), c = card.getBoundingClientRect(), sc = scale || 1;
    n.textContent = C.formatNumber(dmg); n.classList.toggle('short', !!short);
    // s4j: above the head (it drifts up as it fades), so the face stays readable; kept inside the top of the audience card. When the audience
    // line sits right above the head (landscape), the number goes in the gap between them, or beside the head at hair height if the gap is too small.
    if (a.width > 2) {
      const half = (n.offsetHeight || 36) / 2 * sc, halfW = (n.offsetWidth || 48) / 2 * sc, line = $('audienceLine');
      let x = a.left + a.width * .5, y = Math.max(c.top + half + 4 * sc, a.top - half - 8 * sc);
      const l = line && !line.hidden && line.offsetHeight ? line.getBoundingClientRect() : null;
      if (l && l.bottom > y - half && l.top < y + half && l.left < x + halfW && l.right > x - halfW) {
        if (a.top - l.bottom >= half * 2) y = (a.top + l.bottom) / 2;
        else { x = c.right - a.right >= halfW * 2 + 20 * sc ? a.right + halfW + 4 * sc : Math.max(c.left + halfW + 8 * sc, a.left - halfW - 4 * sc); y = a.top + half; }
      }
      n.style.left = (x - c.left) / sc + 'px'; n.style.top = (y - c.top) / sc + 'px';
    }
    n.classList.remove('on'); void n.offsetWidth; n.classList.add('on');
    clearTimeout(n._off); n._off = setTimeout(() => n.classList.remove('on'), short ? 400 : 700);
  }
  // The cards reach the audience: number, audience pop, a short white flash and the stage shake, in that one moment.
  function finaleImpact() {
    const fx = $('finaleFx'); if (!fx) return;
    haptic(40);
    if (finalePending !== null) { paintFinaleNumber(finalePending, false); finalePending = null; }
    audSurprisedUntil = clock + 600;
    if (reduced) return;
    const aud = $('audience');
    // s4j: the pop grows from the top edge (down and out), so the figure never reaches up into the audience line (test-u50 13).
    if (aud && state.mode === 'fight' && !wonMoment) animate(aud, [{ transform: 'scale(1)', transformOrigin: '50% 0' }, { transform: 'scale(1.1)', transformOrigin: '50% 0', offset: .35 }, { transform: 'scale(1)', transformOrigin: '50% 0' }], 200);
    animate($('audienceCard'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)', offset: .2 }, { transform: 'translateX(4px)', offset: .5 }, { transform: 'translateX(-3px)', offset: .75 }, { transform: 'translateX(0)' }], 250);
    const flash = fx.querySelector('.finale-flash');
    if (flash && !fx.hidden) {
      const anim = flash.animate([{ opacity: 0.35 }, { opacity: 0 }], { duration: 60, easing: 'linear', fill: 'forwards' });
      clearTimeout(fx._flash); fx._flash = setTimeout(() => { anim.cancel(); flash.style.opacity = '0'; }, 60);
    }
  }
  // Full sequence at most once every 12s. Finales in between are a short glint. Game time is not paused.
  function playFinale() {
    mountRound8();
    const fx = $('finaleFx'), now = performance.now(), full = now - finaleFullAt >= 12000;
    if (full) finaleFullAt = now;
    clearTimeout(fx._end); clearTimeout(fx._burst); clearTimeout(fx._flash); clearTimeout(fx._glint);
    if (fx._impact) { clearTimeout(fx._impact); fx._impact = 0; if (typeof finaleImpact === 'function') finaleImpact(); } // an earlier full finale lands now
    const kali = $('magicianMini'), cutin = fx.querySelector('.finale-kali');
    if (kali && cutin) {
      const size = Math.min(kali.clientWidth,kali.clientHeight);
      cutin.style.width = size + 'px'; cutin.style.height = size + 'px';
      const track = fx.querySelector('.finale-cut');
      if (track) { track.style.height = (size + 6) + 'px'; track.style.top = '50%'; track.style.marginTop = -(size + 6) / 2 + 'px'; }
      cutin.style.backgroundImage = `url('${assetUrl(kaliArtPath())}')`;
      cutin.classList.toggle('future-suit',state.u18.equipped.kali === 'future');
    }
    const flash = fx.querySelector('.finale-flash');
    if (flash) { flash.getAnimations().forEach(a => a.cancel()); flash.style.opacity = '0'; }
    if (kali) kali.classList.remove('finale-glint');
    fx.hidden = false;
    fx.classList.remove('finale-on', 'finale-full', 'finale-short', 'finale-reduced', 'finale-intro');
    void fx.offsetWidth;
    const mode = !full ? 'finale-short' : (reduced ? 'finale-reduced' : 'finale-full');
    fx.classList.add('finale-on', mode);
    const endFinale = () => {
      fx.hidden = true;
      fx.classList.remove('finale-on', 'finale-full', 'finale-short', 'finale-reduced', 'finale-intro');
      if (kali) kali.classList.remove('finale-glint');
      if (flash) { flash.getAnimations().forEach(a => a.cancel()); flash.style.opacity = '0'; }
    };
    if (mode === 'finale-full') {
      // s4e2 E: cause before effect. Cut-in 400-576 ms, the cards leave Kali at 600 ms and land at 1000 ms (finaleImpact: number, pop, flash, shake).
      fx._burst = setTimeout(() => { if (!fx.hidden && fx.classList.contains('finale-full')) spawnFinaleBurst(400); }, 600);
      fx._impact = setTimeout(() => { fx._impact = 0; if (typeof finaleImpact === 'function') finaleImpact(); }, 1000);
      fx._end = setTimeout(endFinale, 1200);
    } else if (mode === 'finale-reduced') {
      haptic(40);
      fx._end = setTimeout(endFinale, 400);
    } else {
      haptic(40);
      if (!reduced) {
        animate($('audienceCard'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-2px)', offset: .35 }, { transform: 'translateX(2px)', offset: .7 }, { transform: 'translateX(0)' }], 200);
        if (kali) {
          kali.classList.add('finale-glint');
          fx._glint = setTimeout(() => kali.classList.remove('finale-glint'), 400);
        }
      }
      fx._end = setTimeout(endFinale, 400);
    }
  }
  // Latched at the 600 ms warning, before core spends the boss's last heckle.
  let heckleWarn = false;
  function upcomingHeckleBig() {
    const max = Math.max(1, state.mentalMax || 1);
    const th = C.threatInfo(state);
    const hit = th.hit || 0;
    const shield = Math.max(0, state.shield || 0);
    const absorbed = Math.min(shield, hit);
    const after = state.mental - Math.max(0, hit - absorbed);
    const breaks = shield > 0 && hit + 1e-6 >= shield;
    return !!(th.last || hit / max >= .1 || breaks || after / max < .3);
  }
  function heckleLandsBig(e) {
    const max = Math.max(1, state.mentalMax || 1);
    const breaks = e.shieldDmg > 0 && state.shield <= 1e-4;
    return !!(heckleWarn || e.dmg / max >= .1 || breaks || state.mental / max < .3);
  }
  function playHeadlinerEntrance(name) {
    mountRound8();
    const fx = $('finaleFx');
    if (!fx || fx.classList.contains('finale-full') || fx.classList.contains('finale-short') || fx.classList.contains('finale-reduced')) return;
    const plate = fx.querySelector('.headliner-plate');
    if (plate) plate.replaceChildren(element('span', '오늘의 헤드라이너', 'nobr'), ' ', element('span', '· ' + name, 'nobr')); // fixP 6: same text; a wrap falls before 「·」, never after it
    clearTimeout(fx._end);
    fx.hidden = false;
    fx.classList.remove('finale-on', 'finale-full', 'finale-short', 'finale-reduced', 'finale-intro');
    void fx.offsetWidth;
    fx.classList.add('finale-on', 'finale-intro');
    sound('drumroll');
    fx._end = setTimeout(() => {
      if (fx.classList.contains('finale-full') || fx.classList.contains('finale-short') || fx.classList.contains('finale-reduced')) return;
      fx.hidden = true;
      fx.classList.remove('finale-on', 'finale-intro');
    }, 900);
  }
  function flushHeadlinerEntrance() {
    if (!headlinerCue || headlinerCue.played) return;
    if (lineOpen() || !$('panel').hidden || menu === 'headliner') return;
    if (presentation.active?.winner || presentation.items.some(item => item.stageTransition)) return; // s4e2 F: not between a clear and its curtain call
    headlinerCue.played = true;
    playHeadlinerEntrance(headlinerCue.name);
  }
