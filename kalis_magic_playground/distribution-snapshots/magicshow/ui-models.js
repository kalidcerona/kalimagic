/* Batch D presentation decisions are pure and shared with fast tests. */
globalThis.BatchDView = {
 panel(b) {
  if (!b) return '';
  if (['intro','failure','gift','counter','cutscene','complete'].includes(b.twist.scene)) return 'twist:'+b.twist.scene;
  if (b.encore.phase==='choice') return 'encore';
  if (b.rebirthOffer && b.encore.phase!=='round') return 'rebirth';
  return '';
 },
 visibleRoute(b, id, currentClear=true) { return !!b && currentClear && (id==='young-kali' ? b.ifRoute : id==='mirror-stage' && b.mirrorUnlocked); },
 replayKeys(b) {
  if (!b) return [];
  const keys=[];
  if(b.twist.failures || b.twist.complete)keys.push('twist');
  if(b.twist.complete)keys.push('oilWater');
  if(b.youngCleared)keys.push('young');
  if(b.mirrorCleared)keys.push('mirror');
  return keys;
 }
};

/* Pure U5 presentation models shared by runtime and tests. */
globalThis.U5 = (() => {
  const effects = {
    power: ['🪄', '마술 실력', 'stat-power'], damage: ['🃏', '연출', 'stat-damage'],
    shield: ['🛡️', '자신감', 'stat-guard'], heal: ['🍗', '멘탈 회복', 'stat-heal'],
    coins: ['🪙', '동전', 'coins'], xpBurst: ['⭐', '경험치', 'xpNumber'],
    finisher: ['🔥', '피날레', 'statFinale'], boxFill: ['📦', '케이스', 'board']
  };
  function effectBadge(e) {
    const [icon, label, stat] = effects[e.effect] || effects.damage;
    const value = e.effect === 'boxFill' ? `${Math.round(e.value * 100)}%` : (globalThis.Core ? Core.formatNumber(Math.max(0, Math.round(e.value || 0))) : String(Math.max(0,Math.round(e.value||0))));
    return { ...e, icon, label, stat, text: `${icon} +${value}`,
      nameLabel: ['hero', 'legend', 'myth'].includes(e.rarity) || e.item === 'lecture' ? e.name : '' };
  }
  function badgeStack(items) {
    const rare = items.find(e => ['hero', 'legend', 'myth'].includes(e.rarity) || e.item === 'lecture');
    const chosen = rare || items[0];
    if (!chosen) return { badges: [], overflow: '' };
    const value = items.filter(e => e.effect === chosen.effect).reduce((n, e) => n + (e.value || 0), 0);
    return { badges: [effectBadge({ ...chosen, value })], overflow: '' };
  }
  function capBadges(current, incoming) {
    const slots = new Map(current.map(b => [b.cell, b]));
    for (const b of incoming) {
      const old = slots.get(b.cell);
      slots.set(b.cell, old && old.effect === b.effect && b.start - old.start < 400
        ? { ...b, ...effectBadge({ ...b, value: old.value + b.value }), start: old.start } : b);
    }
    return [...slots.values()].slice(-25);
  }
  const badgeWidth = cellWidth => Math.max(0, cellWidth - 8);
  function encounter(venues, state) {
    return { venueSlug: venues[state.venue - 1].slug, audId: state.audId,
      encounterId: `${state.dimension}:${state.wins}:${state.fails}:${state.audId}` };
  }
  const bannerMatches = (b, c) => ['venueSlug', 'audId', 'encounterId'].every(k => b[k] === c[k]);
  function phase2Line(venues, audId, venue) {
    const v = venues[venue - 1];
    const a = venues.flatMap(v => [...v.audiences, v.headliner]).find(a => a.id === audId);
    return a?.phase2Line || v?.headliner.phase2Line || '마지막 공연을 시작하자.';
  }
  // Canvas coordinates: reserve labels, currencies and the top menu.
  const noDrawZones = [{ x: 660, y: 266, w: 130, h: 21 },
    ...[336,406,476,546].map(y => ({ x: 660, y, w: 130, h: 21 })),
    { x: 870, y: 55, w: 610, h: 62 }, { x: 820, y: 0, w: 780, h: 40 }];
  const clearOfZones = r => !noDrawZones.some(z => r.x < z.x + z.w && r.x + r.w > z.x && r.y < z.y + z.h && r.y + r.h > z.y);
  function selectHeckle(character, fallback, previous, random = Math.random) {
    const pool = character && character.heckles && character.heckles.length ? character.heckles : fallback;
    let valid = (pool || []).filter(line => typeof line === 'string' && line.trim());
    if(!valid.length)valid=(fallback||[]).filter(line=>typeof line==='string'&&line.trim());
    const choices = valid.filter(line => line !== previous);
    const list = choices.length ? choices : valid;
    return list[Math.min(list.length - 1, Math.floor(random() * list.length))] || '';
  }
  const happyPortraitPath = path => path.replace(/\.png$/, '-happy.png');
  return { effectBadge, badgeStack, capBadges, selectHeckle, happyPortraitPath, badgeWidth, encounter, bannerMatches, phase2Line, noDrawZones, clearOfZones };
})();
/* U10: one board transform for CSS geometry, input and effects. */
globalThis.PhoneLayout = (() => {
  function measure(width, height, safe = {}, coarse = false, grow = false) {
    const left = safe.left || 0, right = safe.right || 0, top = safe.top || 0, bottom = safe.bottom || 0;
    const w = width - left - right, h = height - top - bottom;
    // U43: the live game (grow) keeps the phone layout below 1000 px wide: a 72 px tablet board (395 px) overflows the 44 percent column
    // on near-square folds and 890x626 screens (measured at 841x617 and 823x707).
    const tablet = coarse && Math.min(width,height) > 500 && Math.max(width,height) <= 1400 && (!grow || Math.max(width,height) >= 1000);
    const phone = tablet || Math.min(width, height) <= 500 || (coarse && Math.min(width / 1600, height / 900) < .6);
    const content = tablet ? Math.min(w,1400) : w; // s4d: up to 1400 so a 12.9 in iPad (1366) has no empty side bands (was 1280)
    // Portrait prototype: a phone held upright (shortest side under 600 CSS px) stacks the battle.
    // Landscape measure() above this return is unchanged; unit tests call landscape sizes only.
    // 12-115: up to 739 so an opened Galaxy Fold (673x841) plays upright too.
    // s4d (owner 10-24): tablets held upright (touch screens up to 1400 css px tall) play too. They keep the phone portrait layout, laid out
    // 600 css px wide and scaled up (zoom, applied by fit() as the stage scale), so the screen keeps the phone composition without empty space.
    if (height > width && (Math.min(width, height) < 740 || (coarse && Math.max(width, height) <= 1400))) {
      const zoom = Math.min(width, height) >= 740 ? Math.max(1, content / 600) : 1, pw = content / zoom, ph = h / zoom;
      // Mockup A: full-width board, one action row, and the remaining height belongs to the stage.
      // s4c: the buttons are one row (skills, 비법 over 연습 모드, 실크 상점, 도감 over 메뉴: two 44 px tools stacked = 90 px), the stats strip is thicker.
      const compact = ph < 700;
      const venue = compact ? 38 : 54, rowGap = compact ? 2 : 4, hp = compact ? 22 : 36, stats = compact ? 46 : 56;
      const finale = 0, skills = compact ? 94 : 100, bottom = 4;
      const topBar = venue + rowGap + hp;
      const below = rowGap + stats + finale + rowGap;
      const pad = 2, gap = 2, boardP = pw - 8;
      const boardH = Math.max(252, Math.min(boardP, Math.round(ph * .38)));
      const boardTop = ph - bottom - boardH - skills;
      const stageH = Math.max(0, boardTop - topBar - below);
      return { phone: true, tablet: false, width: pw, height: ph, zoom, board: boardP, audience: Math.max(0, pw - 12),
        portrait: { top: topBar, stageH, stats, finale, skills, boardTop, boardH, pad, gap, venue, rowGap, hp, compact } };
    }
    // U32: tablet cells are 72-96px (whole numbers) so the board fits the 44% column on narrower tablets.
    let cell = tablet ? Math.max(72, Math.min(96, Math.floor((content * .44 - 24) * 112 / 608))) : 48;
    // U43: the live game (grow=true) lets a phone board take the free height (top bar 44 + 14 margin) while the audience keeps
    // at least half of the width; whole-pixel cells, never below 48. Unit tests call measure() without grow and keep 48.
    if (grow && phone && !tablet) cell = Math.max(content < 600 || h < 319 ? 44 : 48, Math.floor(Math.min(h - 58, content * (h >= 500 ? .58 : .5) - 66) * 112 / 608));
    const board = cell * 608 / 112;
    // U30c: the skill column needs about 66px between the audience card and the board, so narrow phones (667 wide)
    // give the audience card a little less than 56% of the width.
    // 12-115: the live phone landscape (grow) gives the stage all the width left of the skill rail (58 px rail, 4 px seam to the board, 6 px seams
    // and margins), so no empty band opens between the stage and the rail. Unit tests (no grow) and tablets keep the old split.
    const audience = grow && phone && !tablet ? content - board - 80 : Math.min(content * .56, content - board - (tablet ? 84 : 66)) - 12;
    return { phone, tablet, width: content, height: h, board, audience };
  }
  function transform(rect, size = 608) {
    return {
      toBoard: (x, y) => ({ x: (x - rect.left) * size / rect.width, y: (y - rect.top) * size / rect.height }),
      toScreen: (x, y) => ({ x: rect.left + x * rect.width / size, y: rect.top + y * rect.height / size }),
      cell: (col, row, k) => ({ left: rect.left + (k.boardInset + col * (k.cellSize + k.cellGap)) * rect.width / size,
        top: rect.top + (k.boardInset + row * (k.cellSize + k.cellGap)) * rect.height / size,
        width: k.cellSize * rect.width / size, height: k.cellSize * rect.height / size })
    };
  }
  function inspect(doc, width, height) {
    const visible=el=>{for(let n=el;n&&n.nodeType===1;n=n.parentElement){const css=doc.defaultView.getComputedStyle(n);if(css.display==='none'||css.visibility==='hidden'||Number(css.opacity)===0||n.hidden)return false;}return el.getClientRects().length>0;};
    let textNodes=0,buttons=0,samples=0;
    const covered=[],outside=[],selector='button,[role="button"],#panel,#phoneMore,#storyDialog,#tutorialCoach,.stats,#offlineCard,#easyTooltip,#banner,#toasts,.stage-reward,#curtainCall';
    function sample(el,r,label){
      // Scrolled or panned content is checked only inside its actual clipping ancestors.
      let left=r.left,right=r.right,top=r.top,bottom=r.bottom;
      for(let n=el.parentElement;n&&n.nodeType===1;n=n.parentElement){
        const css=doc.defaultView.getComputedStyle(n);
        if(!/^(hidden|clip|auto|scroll)$/.test(css.overflowX)&&!/^(hidden|clip|auto|scroll)$/.test(css.overflowY))continue;
        const clip=n.getBoundingClientRect();
        if(/^(hidden|clip|auto|scroll)$/.test(css.overflowX)){left=Math.max(left,clip.left);right=Math.min(right,clip.right);}
        if(/^(hidden|clip|auto|scroll)$/.test(css.overflowY)){top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);}
      }
      r={left,right,top,bottom,width:right-left,height:bottom-top};
      if(r.width<1||r.height<1)return;
      if(r.left<-.5||r.right>width+.5||r.top<-.5||r.bottom>height+.5)outside.push(label);
      for(const [x,y] of [[r.left+.5,r.top+.5],[r.right-.5,r.top+.5],[r.left+.5,r.bottom-.5],[r.right-.5,r.bottom-.5],[(r.left+r.right)/2,(r.top+r.bottom)/2]]){
        samples++;const hit=doc.elementFromPoint(x,y),cover=hit&&hit.closest(selector);
        if(cover&&cover!==el&&!cover.contains(el)&&!el.contains(cover)&&visible(cover))covered.push({label,cover:cover.id||cover.className,x,y});
      }
    }
    const walker=doc.createTreeWalker(doc.body,4);let node;
    while((node=walker.nextNode()))if(node.textContent.trim()&&visible(node.parentElement)){
      textNodes++;const range=doc.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())sample(node.parentElement,r,node.textContent.trim());
    }
    for(const button of doc.querySelectorAll('button,[role="button"]'))if(visible(button)){buttons++;sample(button,button.getBoundingClientRect(),button.id||button.textContent);}
    const aud=doc.querySelector('#audience'),play=doc.querySelector('#audienceCard'),cells=[...doc.querySelectorAll('#board .cell')];
    const audienceRatio=aud.getBoundingClientRect().height/play.getBoundingClientRect().height;
    const minCell=Math.min(...cells.map(el=>Math.min(el.getBoundingClientRect().width,el.getBoundingClientRect().height)));
    return {textNodes,buttons,samples,covered,outside,audienceRatio,minCell,horizontalOverflow:doc.documentElement.scrollWidth>width};
  }
  return { measure, transform, inspect };
})();
/* U11 guidance is read-only: purchases remain explicit Core actions. */
globalThis.Guidance = (() => {
  function target(state, D, C) {
    return D.tree.filter(n => {
      const i = C.nodeInfo(state, n.id);
      return i.revealed && !i.level && i.currency === 'coins' && i.cost !== null &&
        (!i.blockedReason || i.blockedReason.endsWith(' 부족'));
    }).sort((a,b) => C.nodeInfo(state,a.id).cost - C.nodeInfo(state,b.id).cost)[0] || null;
  }
  function goal(state, D, C) {
    const live = state.board.filter(c => c.hp > 0 && !c.sealed);
    const next = live.sort((a,b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
    const progress = next ? Math.max(0, Math.min(99, Math.floor(100 * (1-next.hp/next.hpMax)))) : 0;
    const node = target(state,D,C), info = node && C.nodeInfo(state,node.id);
    const remaining = info && info.cost !== null ? Math.max(0, Math.ceil(info.cost - state[info.currency])) : 0;
    const costText = !node ? '' : info.cost === null ? '완성' : info.purchasable ? '배울 수 있어요!' : remaining ? `${{coins:'동전',gems:'실크',keys:'책',starlight:'비둘기'}[info.currency]} ${C.formatNumber(remaining)} 더` : info.blockedReason;
    // v4 U38: with nothing left to learn the strip says so (friendly, no node to point at); otherwise it keeps pointing at the notebook.
    const done = !node && C.allLearned(state);
    const nodeText = node ? node.name : done ? '모든 비법을 익혔어요' : '동전을 모아 두세요';
    const learn = node ? `${nodeText} · ${costText}` : nodeText;
    return { node, done, progress, nodeText, costText, caseText: `개봉 ${progress}%`, targetText: learn, text: `다음 목표 · 개봉 ${progress}% · ${learn}` };
  }
  // U31b: the cause line is a soft guess plus a soft suggestion. cause = how this run really ended:
  // 'mental' (mental ran out with little doubt left) or 'damage' (mental ran out while much doubt was left).
  // v4 U48 B (owner: no explicit "learn this" on failure): the panel only says what went wrong, in neutral words. It never names a 비법,
  // never suggests one and has no learn button of its own (the venue's 칼리 product row in showFailure stays, by the owner's correction);
  // the player picks in the notebook ("비법 노트로"). node is always null, so the notebook shows no 추천 tag either.
  function failure(state,D,C,cause='mental') {
    if (cause === 'gate') return { line: '이 관객은 준비가 조금 더 필요해 보여요.', node: null, hint: '' };
    // v4 U38 'lastHeckle': the final boss's announced last heckle was bigger than 멘탈 and 자신감 together (the hint is about the 야유 막기 skill, not a 비법).
    if (cause === 'lastHeckle') return { line: '마지막 야유가 한 번에 너무 컸나 봐요. 멘탈이나 스킬을 다시 살펴볼까요?', node: null, hint: C.failureHint(state, 'lastHeckle') };
    const stall = cause === 'stall', damage = cause === 'damage' || stall;
    const line = stall ? '관객의 의심이 다시 차오르는 게 더 빨랐나 봐요.' : damage ? '의심을 깎을 힘이 조금 모자랐나 봐요.' : '야유를 버틸 멘탈이 부족했나 봐요.';
    return { line, node: null, hint: '' };
  }
  function firstEffects(state,list) {
    const D = globalThis.GAME_DATA || globalThis.D; // v4 U48 D3: the node names below come from the data
    const hits =list.filter(e => (e.type === 'boxHit' || e.type === 'boxBreak') && e.source === 'manual');
    return [
      // v4 U48 D3: a named 비법 is always the real node's display name ("범위 비법" and "연쇄 비법" were not node names).
      ['range', state.tree.area > 0 && new Set(hits.map(e=>e.cell)).size > 1, `'${D.tree.find(n=>n.id==='area').name}' 비법 덕분에 여러 케이스를 함께 두드렸어요!`],
      ['helper', list.some(e=>e.type==='worker' && e.phase==='work' || ['dove','rabbit','magicHit','magicCoins'].includes(e.type)), '도우미 덕분에 칼리와 함께 마술을 하고 있어요!'],
      ['chain', list.some(e=>e.type==='chain'), `'${D.tree.find(n=>n.id===(state.tree.chain8?'chain8':'chain4')).name}' 비법 덕분에 옆 케이스까지 타격이 이어졌어요!`],
      ['case', list.some(e=>e.type==='caseLevelUp'), '개봉으로 케이스가 성장했어요! 다음 소품이 더 강해져요.']
    ].filter(([id,worked]) => worked && !state.guidance.seen.includes(id));
  }
  return {target,goal,failure,firstEffects};
})();
/* U25: one readable presentation lane, driven by visible frame time. */
globalThis.Presentation = (() => {
  class Queue {
    constructor(){this.items=[];this.active=null;this.gap=0;this.serial=0;}
    push(item){
      // s5c: a first-use hint (item.hint) gives way at once to any other notice; its own end() decides whether it shows again later
      if(!item.hint&&this.active&&this.active.hint&&this.active.age<this.active.minimum){this.active.cut=true;this.active.minimum=this.active.age;}
      const old=item.merge&&this.items.find(x=>x.merge===item.merge);
      if(old){old.count=(old.count||1)+1;old.extra='외 '+(old.count-1)+'건';return old;}
      const next={...item,minimum:item.minimum??1200,age:0,serial:this.serial++};this.items.push(next);return next;
    }
    tick(dt,blocked=false){
      if(blocked)return;
      if(this.active){this.active.age+=dt;if(this.active.age>=this.active.minimum&&!this.active.hold){const gap=this.active.gapAfter??300;this.active.end?.();this.active=null;this.gap=gap;}return;}
      if(this.gap>0){this.gap=Math.max(0,this.gap-dt);if(this.gap>0)return;}
      this.items.sort((a,b)=>Number(!!b.stageTransition)-Number(!!a.stageTransition)||(b.priority||0)-(a.priority||0)||a.serial-b.serial);
      if(this.items.length){this.active=this.items.shift();this.active.start?.(this.active);}
    }
    finish(){if(this.active&&this.active.age>=this.active.minimum)this.active.hold=false;}
    get busy(){return !!this.active||this.items.length>0||this.gap>0;}
    clear(){this.active?.end?.();this.active=null;this.items=[];this.gap=0;}
  }
  // v4 U45: monte faces by slot. Before the shuffle the queen is at plan.start and the two black cards are J (lower slot)
  // and K. Each face then rides its card through every swap (a face belongs to the card, never to where the queen ends);
  // on a losing round the trick exchanges the queen with the card in the slot she was really kept in (plan.queen).
  // Face-down cards all show monte-back, so the J/K split is only ever seen face up, after the pick.
  const monteFaces=(plan,settled)=>{
    let k=0;const f=[0,1,2].map(i=>i===plan.start?'monte-queen':k++?'monte-king':'monte-jack');
    if(!settled)return f;
    for(const [a,b] of plan.swaps)[f[a],f[b]]=[f[b],f[a]];
    const q=f.indexOf('monte-queen');if(q!==plan.queen)[f[q],f[plan.queen]]=[f[plan.queen],f[q]];
    return f;
  };
  return {Queue,monteFaces};
})();
