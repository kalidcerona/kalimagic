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
    finisher: ['🔥', '피날레', 'finisherFill'], boxFill: ['📦', '케이스', 'board']
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
    const content = tablet ? Math.min(w,1280) : w;
    // Portrait prototype: a phone held upright (shortest side under 600 CSS px) stacks the battle.
    // Landscape measure() above this return is unchanged; unit tests call landscape sizes only.
    if (height > width && Math.min(width, height) < 600) {
      // Mockup A: full-width board, one action row, and the remaining height belongs to the stage.
      const compact = h < 700;
      const venue = compact ? 38 : 54, rowGap = compact ? 2 : 4, hp = compact ? 22 : 36, stats = compact ? 40 : 48;
      const finale = 0, skills = compact ? 108 : 116, bottom = 4;
      const topBar = venue + rowGap + hp;
      const below = rowGap + stats + finale + rowGap;
      const pad = 2, gap = 2, boardP = content - 8;
      const boardH = Math.max(252, Math.min(boardP, Math.round(h * .38)));
      const boardTop = h - bottom - boardH - skills;
      const stageH = Math.max(0, boardTop - topBar - below);
      return { phone: true, tablet: false, width: content, height: h, board: boardP, audience: Math.max(0, content - 12),
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
    return { phone, tablet, width: content, height: h, board, audience: Math.min(content * .56, content - board - (tablet ? 84 : 66)) - 12 };
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
      const old=item.merge&&this.items.find(x=>x.merge===item.merge);
      if(old){old.count=(old.count||1)+1;old.extra='외 '+(old.count-1)+'건';return old;}
      const next={...item,minimum:item.minimum??1200,age:0,serial:this.serial++};this.items.push(next);return next;
    }
    tick(dt,blocked=false){
      if(blocked)return;
      if(this.active){this.active.age+=dt;if(this.active.age>=this.active.minimum&&!this.active.hold){this.active.end?.();this.active=null;this.gap=300;}return;}
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
/* DOM presentation only. All combat, progression and purchases use Core. */
(function () {
  'use strict';
  const D = window.GAME_DATA, C = window.Core;
  // U29: write-only-on-change guard. render() runs every frame and re-assigns the same text, attributes,
  // hidden flags and custom properties hundreds of times per second; skipping identical writes leaves the
  // resulting DOM unchanged but stops needless style invalidation. Each guard compares first and then delegates.
  (function installWriteGuards() {
    if (typeof Element === 'undefined' || Element.prototype.__u29) return;
    const define = (proto, name, make) => { const d = Object.getOwnPropertyDescriptor(proto, name); if (d && d.set) Object.defineProperty(proto, name, { ...d, set: make(d.set, d.get) }); };
    if (typeof Node === 'undefined' || typeof HTMLElement === 'undefined' || typeof CSSStyleDeclaration === 'undefined') return;
    define(Node.prototype, 'textContent', (set, get) => function (v) {
      if (this.nodeType === 1) {
        const text = v == null ? '' : String(v), first = this.firstChild;
        if (text === '' ? !first : first && first === this.lastChild && first.nodeType === 3 && first.data === text) return;
      }
      set.call(this, v);
    });
    define(HTMLElement.prototype, 'hidden', set => function (v) { if (this.hidden !== !!v) set.call(this, v); });
    // U35: the same guard for the other per-frame writers. classList.add/remove of a token that is already in (or absent from)
    // the list still re-writes the class attribute, which restyles the whole subtree (#audienceCard every frame at idle).
    if (typeof DOMTokenList !== 'undefined') {
      const add = DOMTokenList.prototype.add, remove = DOMTokenList.prototype.remove;
      DOMTokenList.prototype.add = function (...tokens) { if (tokens.every(t => this.contains(t))) return; return add.apply(this, tokens); };
      DOMTokenList.prototype.remove = function (...tokens) { if (!tokens.some(t => this.contains(t))) return; return remove.apply(this, tokens); };
    }
    define(Element.prototype, 'className', (set, get) => function (v) { if (typeof this.className === 'string' && this.className === String(v)) return; set.call(this, v); });
    define(HTMLElement.prototype, 'title', set => function (v) { if (this.title !== String(v)) set.call(this, v); });
    define(HTMLElement.prototype, 'tabIndex', set => function (v) { if (this.tabIndex !== Number(v)) set.call(this, v); });
    {
      // dataset.x = same value re-writes the data-x attribute (cells, goal strip, etc. every frame): one cached proxy per element.
      const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'dataset'), proxies = new WeakMap();
      if (d && d.get && typeof Proxy === 'function') Object.defineProperty(HTMLElement.prototype, 'dataset', { ...d, get() {
        let proxy = proxies.get(this);
        if (!proxy) { proxy = new Proxy(d.get.call(this), { set(target, key, value) { if (typeof key !== 'string' || target[key] !== String(value)) target[key] = value; return true; } }); proxies.set(this, proxy); }
        return proxy;
      } });
    }
    if (typeof HTMLButtonElement !== 'undefined') define(HTMLButtonElement.prototype, 'disabled', set => function (v) { if (this.disabled !== !!v) set.call(this, v); });
    const setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (!/^(src|srcset|href|xlink:href)$/i.test(name) && this.getAttribute(name) === String(value)) return;
      return setAttribute.call(this, name, value);
    };
    const setProperty = CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty = function (name, value, priority) {
      if (!priority && value != null && this.getPropertyValue(name) === String(value) && !this.getPropertyPriority(name)) return;
      return setProperty.call(this, name, value, priority);
    };
    Element.prototype.__u29 = true;
  })();
  // U35: shipped art is WebP (tools/webp-assets.py). Code and data keep the .png names; this one mapping swaps the
  // extension where a URL reaches the browser: img.src below and CSS url() written from JS (style.css names .webp directly).
  // PNG_KEEP lists art that stayed PNG because no WebP passed the quality floor (none at the moment).
  const PNG_KEEP = new Set([]);
  const assetUrl = value => {
    const text = String(value), match = /^(assets\/(?:ui\/)?[A-Za-z0-9_-]+)\.png$/.exec(text);
    return match && !PNG_KEEP.has(match[1]) ? `${match[1]}.webp` : text;
  };
  (function installWebpMapping() {
    if (typeof HTMLImageElement === 'undefined') return;
    const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (d && d.set && d.get) Object.defineProperty(HTMLImageElement.prototype, 'src', { ...d, set(value) { d.set.call(this, assetUrl(value)); } });
  })();
  const sound = (name, options) => window.Sfx && window.Sfx.play(name, options);
  // U36: layout reads (getBoundingClientRect, clientWidth) are cached for one frame. A late-game fight emits dozens of hit events per
  // frame and each one used to read the stage, board and audience rects right after DOM writes, forcing a style recalculation and layout
  // every time (about 1400 recalculations per second, 80 percent of the main thread). The loop clears the cache at the start of each frame.
  const geo = new Map();
  let wandOffset = null, geoAge = 0; // v4 U40: see updateWand; geoAge counts frames since the last geometry read (loop)
  const rectOf = el => { let r = geo.get(el); if (!r) { r = el.getBoundingClientRect(); geo.set(el, r); } return r; };
  const boardWidth = () => { let w = geo.get('board-cw'); if (w === undefined) { w = $('board').clientWidth; geo.set('board-cw', w); } return w; };
  let bestiaryTab = 'audiences', endingStep = 0, revealEnding = false;
  const assetCache = new Map();
  function assetImage(path) {
    if (!assetCache.has(path)) {
      const img = new Image(); img.addEventListener('error', () => { if (assetCache.get(path) === img) assetCache.delete(path); }, { once: true }); img.src = path; assetCache.set(path, img);
    }
    return assetCache.get(path);
  }
  // U29: low-priority idle prefetch of the next venue's images (background, crowd, headliner, audiences + happy faces).
  const prefetchQueue = [], prefetchDone = new Set(); let prefetchActive = 0, prefetchedFor = '';
  function pumpPrefetch() {
    while (prefetchActive < 4 && prefetchQueue.length) {
      const path = prefetchQueue.shift();
      if (assetCache.has(path)) continue;
      const img = new Image(); img.fetchPriority = 'low'; img.decoding = 'async'; prefetchActive++;
      const done = () => { prefetchActive--; pumpPrefetch(); };
      img.addEventListener('load', done, { once: true }); img.addEventListener('error', () => { assetCache.delete(path); prefetchDone.delete(path); done(); }, { once: true });
      assetCache.set(path, img); img.src = path;
    }
  }
  let prefetchWinSeen = false; const prefetchLoadAt = performance.now();
  function prefetchNextVenue(venueNumber) {
    const next = D.venues[venueNumber]; if (!next || prefetchedFor === next.slug) return;
    prefetchedFor = next.slug;
    const paths = [`assets/${next.venueAsset}`, next.crowdAsset && `assets/${next.crowdAsset}`];
    for (const a of [next.headliner, ...next.audiences]) {
      const base = audienceAsset(next, a); paths.push(base, base.replace(/\.png$/, '-happy.png'));
    }
    for (const path of paths) if (path && !prefetchDone.has(path)) { prefetchDone.add(path); prefetchQueue.push(path); }
    const start = () => pumpPrefetch();
    if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 4000 }); else setTimeout(start, 1500);
  }
  // Crop transparent margins once per URL; face crops share the same alpha scan.
  const opaqueSprites = new Map();
  function opaqueSprite(source, path, face = false) {
    if (!opaqueSprites.has(path)) {
      opaqueSprites.set(path,{failed:true,full:path,face:path});
      const h=source.naturalHeight,w=source.naturalWidth===h*3?h:source.naturalWidth,scan=document.createElement('canvas');
      scan.width=w;scan.height=h;
      const context=scan.getContext('2d');context.drawImage(source,0,0,w,h,0,0,w,h);
      let pixels;try{pixels=context.getImageData(0,0,w,h).data;}catch(error){opaqueSprites.set(path,{failed:true,full:path,face:path});return path;}
      let left=w,top=h,right=-1,bottom=-1;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      if(right<left){left=top=0;right=w-1;bottom=h-1;}
      const bounds={left,top,width:right-left+1,height:bottom-top+1};
      const crop=(height)=>{const c=document.createElement('canvas');c.width=bounds.width;c.height=height;c.getContext('2d').drawImage(source,left,top,bounds.width,height,0,0,bounds.width,height);return c.toDataURL();};
      const facePart=/mingiri/.test(path)?.70:figureSize(path)==='small'?.52:.36;
      const faceHeight=Math.max(1,Math.round(bounds.height*facePart));let faceLeft=right,faceRight=left;
      for(let y=top;y<top+faceHeight;y++)for(let x=left;x<=right;x++)if(pixels[(y*w+x)*4+3]>16){faceLeft=Math.min(faceLeft,x);faceRight=Math.max(faceRight,x);}
      const face=document.createElement('canvas');face.width=Math.max(1,faceRight-faceLeft+1);face.height=faceHeight;
      face.getContext('2d').drawImage(source,faceLeft,top,face.width,faceHeight,0,0,face.width,faceHeight);
      opaqueSprites.set(path,{bounds,full:crop(bounds.height),face:face.toDataURL()});
    }
    return opaqueSprites.get(path)[face?'face':'full'];
  }
  // Base alpha size and the union envelope of all installed faces. Never fit an expression independently.
  const STAGE_AUDIENCE_METRICS = {
    "assets/case-closed.png":[128,180,128,200],
    "assets/aud-a1.png":[124,196,124,196],
    "assets/aud-a10.png":[164,210,164,210],
    "assets/aud-a100.png":[138,198,140,198],
    "assets/aud-a101.png":[153,198,162,198],
    "assets/aud-a102.png":[138,198,141,198],
    "assets/aud-a106.png":[176,233,176,233],
    "assets/aud-a107.png":[137,218,139,218],
    "assets/aud-a108.png":[174,203,181,203],
    "assets/aud-a109.png":[170,212,181,212],
    "assets/aud-a11.png":[124,204,138,204],
    "assets/aud-a110.png":[172,250,176,250],
    "assets/aud-a111.png":[147,216,149,216],
    "assets/aud-a12.png":[141,222,141,222],
    "assets/aud-a13.png":[153,232,153,232],
    "assets/aud-a14.png":[102,201,106,201],
    "assets/aud-a15.png":[138,232,139,232],
    "assets/aud-a16.png":[98,219,106,220],
    "assets/aud-a17.png":[106,207,107,208],
    "assets/aud-a18.png":[112,213,112,213],
    "assets/aud-a19.png":[131,211,132,212],
    "assets/aud-a2.png":[122,204,127,204],
    "assets/aud-a20.png":[110,228,116,228],
    "assets/aud-a21.png":[110,198,110,198],
    "assets/aud-a22.png":[121,232,121,232],
    "assets/aud-a23.png":[131,232,132,232],
    "assets/aud-a24.png":[119,232,120,232],
    "assets/aud-a25.png":[102,232,102,232],
    "assets/aud-a26.png":[138,232,138,232],
    "assets/aud-a27.png":[124,232,124,232],
    "assets/aud-a28.png":[143,207,144,208],
    "assets/aud-a29.png":[138,231,139,232],
    "assets/aud-a3.png":[123,216,123,216],
    "assets/aud-a30.png":[145,231,145,232],
    "assets/aud-a31.png":[114,232,114,232],
    "assets/aud-a32.png":[111,232,112,232],
    "assets/aud-a33.png":[105,232,105,232],
    "assets/aud-a34.png":[168,232,168,232],
    "assets/aud-a35.png":[161,221,163,221],
    "assets/aud-a36.png":[167,223,168,224],
    "assets/aud-a37.png":[156,208,172,208],
    "assets/aud-a38.png":[146,220,146,220],
    "assets/aud-a39.png":[172,221,188,221],
    "assets/aud-a4.png":[143,216,144,216],
    "assets/aud-a46.png":[120,198,129,198],
    "assets/aud-a5.png":[127,222,151,222],
    "assets/aud-a50.png":[144,198,177,198],
    "assets/aud-a54.png":[120,198,156,198],
    "assets/aud-a55.png":[126,198,141,198],
    "assets/aud-a59.png":[117,198,159,198],
    "assets/aud-a6.png":[134,216,136,216],
    "assets/aud-a60.png":[114,198,129,198],
    "assets/aud-a64.png":[114,198,147,198],
    "assets/aud-a65.png":[117,198,135,198],
    "assets/aud-a66.png":[135,198,144,198],
    "assets/aud-a7.png":[131,214,132,214],
    "assets/aud-a70.png":[111,198,138,198],
    "assets/aud-a71.png":[129,198,150,198],
    "assets/aud-a72.png":[129,198,168,198],
    "assets/aud-a76.png":[114,198,159,198],
    "assets/aud-a77.png":[123,198,153,198],
    "assets/aud-a78.png":[105,198,147,198],
    "assets/aud-a79.png":[120,198,165,198],
    "assets/aud-a8.png":[133,213,133,213],
    "assets/aud-a83.png":[126,198,162,198],
    "assets/aud-a84.png":[138,198,180,198],
    "assets/aud-a85.png":[126,198,180,198],
    "assets/aud-a86.png":[126,198,171,198],
    "assets/aud-a9.png":[163,232,164,232],
    "assets/aud-a90.png":[123,198,141,198],
    "assets/aud-a91.png":[129,198,162,198],
    "assets/aud-a92.png":[120,198,135,198],
    "assets/aud-a93.png":[123,198,150,198],
    "assets/aud-a94.png":[111,198,138,198],
    "assets/aud-a98.png":[141,198,146,198],
    "assets/aud-a99.png":[139,198,140,198],
    "assets/aud-blackcat.png":[128,190,128,190],
    "assets/aud-f-brother.png":[118,170,118,170],
    "assets/aud-f-mom.png":[118,184,118,184],
    "assets/aud-f-sister.png":[194,182,194,182],
    "assets/aud-future-kali.png":[175,216,186,216],
    "assets/aud-lecturenote-hecate.png":[148,198,167,198],
    "assets/aud-lecturenote-jung.png":[123,198,149,198],
    "assets/aud-lecturenote-serona.png":[150,198,182,198],
    "assets/aud-meetup-busan.png":[128,190,128,190],
    "assets/aud-meetup-changwon.png":[128,190,128,190],
    "assets/aud-meetup-cheonan.png":[131,198,155,198],
    "assets/aud-meetup-daegu.png":[132,198,163,198],
    "assets/aud-meetup-geoje.png":[135,198,142,198],
    "assets/aud-meetup-incheon.png":[128,190,128,190],
    "assets/aud-meetup-suwon.png":[128,190,128,190],
    "assets/aud-mingiri-dark.png":[248,232,248,248],
    "assets/aud-past-kali.png":[107,171,109,172],
    "assets/aud-perfect-kali.png":[216,214,216,214],
    "assets/aud-s1-classmate.png":[134,186,134,186],
    "assets/aud-s1-teacher.png":[132,194,132,194],
    "assets/aud-tutorial-dogyeom.png":[131,198,145,198],
    "assets/aud-tutorial-mingiri.png":[145,171,145,171],
    "assets/aud-tv1.png":[184,198,190,198],
    "assets/aud-tv2.png":[126,198,141,198],
    "assets/aud-tv3.png":[231,198,247,198],
    "assets/aud-tv4.png":[176,198,234,198],
    "assets/aud-tv5.png":[188,198,188,198],
    "assets/aud-tv6.png":[204,198,209,198],
    "assets/aud-young-kali.png":[214,216,216,216],
    "assets/headliner-h1.png":[148,210,148,210],
    "assets/headliner-h10.png":[134,220,143,220],
    "assets/headliner-h11.png":[149,232,149,232],
    "assets/headliner-h12.png":[125,232,134,232],
    "assets/headliner-h13.png":[145,232,154,232],
    "assets/headliner-h2.png":[160,226,169,226],
    "assets/headliner-h3.png":[130,202,167,202],
    "assets/headliner-h4.png":[131,222,135,222],
    "assets/headliner-h5.png":[163,212,164,212],
    "assets/headliner-h6.png":[128,214,131,214],
    "assets/headliner-h7.png":[164,220,175,220],
    "assets/headliner-h8.png":[158,228,158,228],
    "assets/headliner-h9.png":[144,230,149,230],
    "assets/headliner-lecturenote-kim.png":[161,216,177,216],
    "assets/headliner-meetup-seoul.png":[128,190,128,190],
    "assets/headliner-tv.png":[134,216,173,216],
  };
  function stageSprite(source, path, reference) {
    const metrics = STAGE_AUDIENCE_METRICS[reference];
    if (!metrics) return opaqueSprite(source, path);
    opaqueSprite(source, path);
    const cached = opaqueSprites.get(path), key = 'stage:' + reference;
    if (!cached.bounds) return path;
    if (!cached[key]) {
      const [,,width,height] = metrics, b = cached.bounds, canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source,b.left,b.top,b.width,b.height,(width-b.width)/2,height-b.height,b.width,b.height);
      cached[key] = canvas.toDataURL();
    }
    return cached[key];
  }
  function audienceStagePaths(base, stage) {
    const stem = base.replace(/\.(?:png|webp)$/, '');
    return [1,2,3,4,5,6].sort((a,b)=>Math.abs(a-stage)-Math.abs(b-stage)||a-b)
      .map(n=>stem+(n===1?'':n===6?'-happy':'-s'+n)+'.png');
  }
  function stageAudienceFace(host, base, stage) {
    if (!base) return;
    host.dataset.reference = base;
    const mood = 'stage-' + stage;
    if (host.dataset.mood !== mood || host.dataset.faceBase !== base) {
      host.dataset.faceBase = base;
      moodSprite(host, base, mood, audienceStagePaths(base, stage));
    }
  }
  function audienceDoubtStage() {
    return 1 + Math.min(4, Math.floor(5 * (1 - Math.max(0, Math.min(1, state.audHp / Math.max(1, state.audHpMax)))) + 1e-9));
  }
  // v4 U46 A8: head framing inside the dialog portrait frame. The image is the whole trimmed sprite, centred, drawn at h (percent of the frame height)
  // and moved by t, so the frame shows the head (hair to chin). Rows list the sprites whose head is a bigger or smaller part of the figure.
  const PORTRAIT_FOCUS = [[/mingiri/, { h: '135%', t: '-4%' }], [/aud-a108|past-kali|kali-past/, { h: '150%', t: '-2%' }], [/headliner-|future-kali/, { h: '190%', t: '-3%' }], [/aud-a4[-.]/, { h: '190%', t: '-38%' }], [/aud-a16[-.]/, { h: '190%', t: '-45%' }]];
  function portraitFocus(path) { const row = PORTRAIT_FOCUS.find(([re]) => re.test(path)); return row ? row[1] : { h: '175%', t: '-3%' }; }
  function figureSize(path) {
    if(/mingiri|past-kali|kali-past|aud-a108(?:-|\.)/.test(path))return 'small';
    return /headliner-|future-kali/.test(path)?'large':'regular';
  }
  // U32: on tablets the audience sprite is drawn at a whole-number multiple of its pixel size (no uneven pixel columns).
  function snapAudience(image) {
    const host = $('audience'), img = image || host.querySelector(':scope > .asset-sprite');
    if (!img) return;
    if (host.dataset.reference) { img.style.height = ''; delete img.dataset.snap; return; }
    if (!document.body.classList.contains('tablet')) { img.style.height = ''; delete img.dataset.snap; return; }
    const apply = () => {
      const nat = img.naturalHeight, factor = host.dataset.figureSize === 'large' ? .95 : host.dataset.figureSize === 'small' ? Math.min(1,.72*Number(host.dataset.storyScale||1)) : .84;
      if (!nat || !host.clientHeight) return;
      let k = Math.max(1, Math.round(host.clientHeight * factor / nat));
      if (k > 1 && nat * k > host.clientHeight * 1.06) k--;
      img.style.height = `${nat * k}px`; img.dataset.snap = String(k);
    };
    if (img.complete && img.naturalHeight) apply(); else img.addEventListener('load', apply, { once: true });
  }
  // v4 U49 3: while an image is still loading the host is .asset-pending and shows nothing (style.css hides its emoji text and fallback children);
  // the emoji only shows once the image really failed (.asset-failed: error event, or complete with naturalWidth 0).
  // v4 U49b 2: every picture request on a host gets a new generation (host._artGen); a load or error callback of an older request (an earlier
  // audience with the same face, an earlier mood) is ignored, so it can neither show its picture nor end the new picture's pending state.
  // v4 U49b 3: the emoji glyph written straight into a host is wrapped in its own span (.sprite-glyph), so hiding it never depends on the text colour.
  const nextArt = host => (host._artGen = (host._artGen || 0) + 1);
  function wrapGlyph(host) { for (const n of [...host.childNodes]) if (n.nodeType === 3 && n.nodeValue.trim()) { const s = document.createElement('span'); s.className = 'sprite-glyph'; n.replaceWith(s); s.append(n); } }
  function pendingArt(host, source) { wrapGlyph(host); host.classList.remove('asset-failed'); host.classList.toggle('asset-pending', !(source.complete && source.naturalWidth)); }
  function failedArt(host) { host.classList.remove('asset-pending'); host.classList.add('asset-failed'); }
  function sprite(host, path) {
    host.querySelectorAll(':scope > .asset-sprite').forEach(img => img.remove());
    host.classList.remove('asset-ready'); host.dataset.asset = path;
    if (host.id === 'audience' && !host.dataset.reference) host.dataset.reference = path.replace(/-(?:s[2-6]|happy|serious|surprised|sad)(?=\.(?:png|webp)$)/, '');
    const source = assetImage(path), gen = nextArt(host);
    pendingArt(host, source);
    const fail = () => { if (host._artGen === gen && host.dataset.asset === path && !source.naturalWidth) failedArt(host); };
    const show = () => {
      if (host._artGen !== gen || host.dataset.asset !== path) return;
      if (!source.naturalWidth) { fail(); return; }
      host.classList.remove('asset-pending');
      host.querySelectorAll(':scope > .asset-sprite').forEach(img => img.remove());
      const image = source.cloneNode(); image.className = 'asset-sprite'; image.alt = '';
      if (/assets\/(?:aud-|headliner-)/.test(path)||host.classList.contains('story-portrait')&&/^assets\/kali-/.test(path)) {
        host.classList.add('normalized-figure');host.dataset.figureSize=figureSize(path);
        try { image.src=host.id === 'audience' ? stageSprite(source,path,host.dataset.reference || path) : opaqueSprite(source,path,host.classList.contains('dialogue-emoji')); } // v4 U46 A8: the dialog portrait frames the head of the full sprite (portraitFocus)
        catch(error) { /* Keep the source if a cross-origin canvas is unavailable. */ }
      }
      if(/^assets\/(?:box-|case-)/.test(path)){try{image.src=/assets\/case-(?:closed|open)\.png$/.test(path) ? stageSprite(source,path,'assets/case-closed.png') : opaqueSprite(source,path);}catch(error){ /* Keep fallback geometry if alpha access fails. */ }}
      if (host.classList.contains('story-portrait')) { const f = portraitFocus(path); image.style.height = f.h; image.style.top = f.t; } // v4 U46 A8: the dialog frame shows the head at its focus point
      host.append(image); host.classList.add('asset-ready');
      if (host.id === 'audience') {
        const refit = () => { if (host._artGen === gen) { invalidateStageAudience(); syncFlags(); } };
        snapAudience(image);
        if (image.complete && image.naturalWidth) refit(); else image.addEventListener('load', refit, { once: true });
      }
    };
    if (source.complete) show(); else { source.addEventListener('load', show, { once: true }); source.addEventListener('error', fail, { once: true }); }
  }
  const venueAsset = v => `assets/${v.venueAsset}`;
  const audienceAsset = (v, a) => a.portraitAsset ? `assets/${a.portraitAsset}` : a === v.headliner ? `assets/headliner-${a.id}.png` : `assets/aud-${a.id}.png`;
  // School-chain and NDD fights keep a family audience id (a1). Mood files must stay on the tutorial sprite, not that id's portrait.
  function tutorialStageBase() {
    if (!state || !state.u15 || !state.u15.tutorial || state.u15.tutorial.done) return '';
    if (state.u15.tutorial.active) return 'assets/aud-tutorial-dogyeom.png';
    const mark = chainMark();
    if (!mark) return '';
    if (mark.step.startsWith('teacher') || mark.step.startsWith('upgrade')) return 'assets/aud-s1-teacher.png';
    if (mark.step.startsWith('girl')) return 'assets/aud-s1-classmate.png';
    return '';
  }
  const stageAudienceAsset = (v, a) => tutorialStageBase() || audienceAsset(v, a);
  // Optional expressions are requested only when the current art shipment contains them.
  const shippedExpressionArt = new Set(["assets/aud-a1-serious.png", "assets/aud-a1-surprised.png", "assets/aud-a2-serious.png", "assets/aud-a2-surprised.png", "assets/aud-a3-serious.png", "assets/aud-a3-surprised.png", "assets/aud-future-kali-serious.png", "assets/aud-future-kali-surprised.png", "assets/aud-lecturenote-hecate-serious.png", "assets/aud-lecturenote-hecate-surprised.png", "assets/aud-lecturenote-jung-serious.png", "assets/aud-lecturenote-jung-surprised.png", "assets/aud-lecturenote-serona-serious.png", "assets/aud-lecturenote-serona-surprised.png", "assets/aud-past-kali-serious.png", "assets/aud-past-kali-surprised.png", "assets/aud-perfect-kali-serious.png", "assets/aud-perfect-kali-surprised.png", "assets/aud-tutorial-dogyeom-serious.png", "assets/aud-tutorial-dogyeom-surprised.png", "assets/aud-tutorial-mingiri-serious.png", "assets/aud-tutorial-mingiri-surprised.png", "assets/aud-young-kali-serious.png", "assets/aud-young-kali-surprised.png", "assets/headliner-h1-serious.png", "assets/headliner-h1-surprised.png", "assets/headliner-lecturenote-kim-serious.png", "assets/headliner-lecturenote-kim-surprised.png", "assets/kali-react-sad.png", "assets/kali-react-surprised.png"]);
  function moodSprite(host,path,mood='doubt',preferredPaths=null){
    if(!path){host.dataset.mood=mood;return;}
    const emotes={happy:'😊',serious:'💭',surprised:'❗',sad:'💧',smug:'😏'};
    // These optional serious portraits were never shipped; use the base with its mood emote.
    const baseSerious = mood === 'serious' && ['assets/serona.png','assets/aud-a19.png'].includes(path);
    const paths=preferredPaths || (baseSerious ? [] : ['happy','serious','surprised','sad'].includes(mood)?[path.replace(/\.png$/,'-'+mood+'.png')]:[path]);
    if(!preferredPaths){if(mood==='surprised')paths.push(path.replace(/\.png$/,'-happy.png'));paths.push(path);}
    if(!preferredPaths)for(let i=paths.length-1;i>=0;i--)if(/-(serious|surprised|sad)\.png$/.test(paths[i])&&!shippedExpressionArt.has(paths[i]))paths.splice(i,1);
    host.dataset.mood=mood;host.dataset.emote=emotes[mood]||'';
    if(!host.classList.contains('asset-ready')){wrapGlyph(host);host.classList.remove('asset-failed');host.classList.add('asset-pending');} // v4 U49 3: nothing (not the emoji) while the first face loads
    const gen=nextArt(host); // v4 U49b 2: a newer request (another audience with the same mood, or any sprite call) makes this chain stale
    const attempt=i=>{if(host._artGen!==gen||host.dataset.mood!==mood)return;const source=assetImage(paths[i]);
      const ready=()=>{if(host._artGen!==gen||host.dataset.mood!==mood)return;if(source.naturalWidth){sprite(host,paths[i]);host.dataset.emote=i===0&&paths[i]!==path&&mood!=='smug'&&!baseSerious?'':emotes[mood]||'';}else if(i+1<paths.length)attempt(i+1);else if(!host.classList.contains('asset-ready'))failedArt(host);};
      if(source.complete)ready();else{source.addEventListener('load',ready,{once:true});source.addEventListener('error',ready,{once:true});}
    };attempt(0);
  }
  function happySprite(host, path) {
    sprite(host, path);
    const happy = U5.happyPortraitPath(path);
    if (!happyCache.has(happy)) {
      happyCache.set(happy, new Promise(resolve => {
        const image = new Image();
        image.onload = () => { assetCache.set(happy, image); resolve(true); };
        image.onerror = () => resolve(false);
        image.src = happy;
      }));
    }
    happyCache.get(happy).then(ok => { if (ok && host.dataset.asset === path) sprite(host, happy); });
  }
  const endingText = d => {
    const item = D.dimensions[d - 1];
    const ending = item ? item.ending : D.genericEnding;
    return { title: ending.title.replaceAll('{d}', String(d)), body: ending.body.replaceAll('{d}', String(d)) };
  };
  const $ = id => document.getElementById(id);
  const KEY = 'magicShowBuster.v3';
  document.querySelectorAll('[data-game-build]').forEach(node => { node.textContent = `빌드 ${GAME_BUILD}`; });
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer:coarse)').matches;
  let phone = false, layoutWidth = 1600, layoutHeight = 900;
  let reduced = motion.matches, scale = 1, clock = 0, previous = 0;
  let menu = '', focusBeforePanel = null, lastAudience = '', lastLayout = '';
  // v4 U48 M: true while a panel opened from the menu sheet is showing; its 닫기/뒤로 then returns to the menu.
  let moreReturn = false;
  let practiceOn = false, practiceHold = null, practiceWake = null;
  let practiceIdleAt = 0, deckContinuousMs = 0, deckSaverAsked = false;
  let wakePending = false;
  let gloveRun = 0; // v4 U48 A2: the longest auto-practice time left seen in this run (a brick is 30 minutes), for the button's ring
  function showMore() { $('phoneMore').hidden = false; $('moreButton').setAttribute('aria-expanded', 'true'); autoStartStage.since=0; release(); clearDecorations(); }
  function hideMore() { $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false'); moreReturn = false; autoStartStage.since=0; }
  let dialogueTimer, dealerBusy = false, dealerMessage = '', dealerLost = false, dealerResult = '';
  let dealerPicked = new Set();
  let booTimer=null, failureAudience=null, failureVenue=null;
  let failureCause = 'mental', practiceRec = null;
  let saveWarning = false, failure = null, lastMode = '';
  let boardHolds = [];
  let caseArrange = false, arrangeFrom = null, arrangePress = null;
  const pointer = { id: null, held: false, x: -1, y: -1, inside: false };
  const particles = [], flights = [], numbers = [], cells = [];
  let heartEls = null;
  let badges = [], wonMoment = null;
  // School tutorial before the core NDD fight. The mark lives in u15.bios (tchain:step:line) so a reload can resume.
  // Fights themselves are rolled back: core still treats a tutorial win as the end of the only tutorial battle.
  let chainFighting = false, chainBackup = '', chainNodeId = '', chainNodeLevel = -1, chainFocused = false, chainBookChecked = false;
  // One lifetime owner survives button replacement and pointer capture changes.
  let tooltipOwner=null,tooltipPending=0,tooltipExpiry=0;
  const tooltipBindings=new WeakMap();
  function hideEasyTooltip(){
    clearTimeout(tooltipPending);clearTimeout(tooltipExpiry);
    tooltipPending=tooltipExpiry=0;tooltipOwner=null;$('easyTooltip').hidden=true;
  }
  for(const name of ['pointerdown','pointerup','pointercancel','scroll'])document.addEventListener(name,hideEasyTooltip,true);
  for(const name of ['resize','orientationchange','blur'])window.addEventListener(name,hideEasyTooltip);
  document.addEventListener('visibilitychange',hideEasyTooltip);
  const tooltipObserver=new MutationObserver(records=>{
    const owner=tooltipOwner;if(!owner)return;
    if(!owner.isConnected||records.some(r=>r.target===owner||owner.contains(r.target)||[...r.removedNodes].some(n=>n===owner||n.contains?.(owner))))hideEasyTooltip();
  });
  tooltipObserver.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','hidden','aria-label']});
  function easyTooltip(button,copy){
    button.title=copy;button.setAttribute('aria-description',copy);
    if(tooltipBindings.has(button)){tooltipBindings.get(button).copy=copy;return;}
    const binding={copy,long:false};tooltipBindings.set(button,binding);
    const show=(suppressClick=true)=>{
      if(!button.isConnected){hideEasyTooltip();return;}
      hideEasyTooltip();tooltipOwner=button;binding.long=suppressClick;
      const tip=$('easyTooltip');tip.textContent=binding.copy;tip.hidden=false;
      const r=button.getBoundingClientRect(),stage=$('stage').getBoundingClientRect();
      tip.style.left=Math.max(4,Math.min(layoutWidth-240,(r.left-stage.left)/scale-240))+'px';tip.style.top=Math.max(48,(r.top-stage.top)/scale)+'px';
      tooltipExpiry=setTimeout(hideEasyTooltip,3000);
    };
    button.addEventListener('pointerdown',()=>{hideEasyTooltip();binding.long=false;tooltipOwner=button;tooltipPending=setTimeout(show,400);});
    button.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')show(false);});
    for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture'])button.addEventListener(event,hideEasyTooltip);
    button.addEventListener('click',e=>{if(binding.long){e.stopImmediatePropagation();binding.long=false;}},true);
  }
  // End transient tooltips.
  const lastHeckles = new Map(), happyCache = new Map();
  const caps = { particles: coarse ? 120 : 240, icons: 24, numbers: 4 };
  const canvas = $('effects'), ctx = canvas.getContext('2d');
  const animations = new WeakMap();
  // U39: the pattern label breaks only at " · ": every part is its own inline-block, so a part moves whole to the next line (and wraps inside only if it is wider than the label).
  // Writers keep assigning textContent; an unchanged text is ignored, so the label also stops rebuilding every frame.
  (() => {
    const el = $('patternLabel'); let raw = '';
    Object.defineProperty(el, 'textContent', { configurable: true, get() { return raw; }, set(value) {
      value = String(value); if (value === raw) return; raw = value;
      const nodes = [];
      value.split(' · ').forEach((part, i) => { if (i) nodes.push(document.createTextNode(' · ')); const s = document.createElement('span'); s.className = 'pat-part'; s.textContent = part; nodes.push(s); });
      el.replaceChildren(...(value ? nodes : []));
    } });
  })();
  const patterns = ['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
  let corrupt = false, inaccessible = false, newerSave = false, restoring = false, giftEnded = false;
  let saveStore = null, loaded0 = false, repairedSave = false, recoveredSave = false, refundedCoins = 0, refundedKeys = 0;
  let state = C.newGame(Date.now() >>> 0);
  const launchQuery = new URLSearchParams(location.search);
  let seasonReset = false;
  try {
    // v4 U45: one-time test-season reset before anything reads the save (see Core.applySaveEpoch and CONST.saveEpoch).
    try { seasonReset = C.applySaveEpoch(localStorage).reset; } catch (error) { /* storage blocked: the store below reports it */ }
    saveStore = C.createSaveStore(localStorage);
    const loaded = saveStore.load();
    if (loaded.state) { state = loaded.state; C.step(state,0,{taps:[],quiet:true}); loaded0 = true; }
    corrupt = loaded.backedUp && !loaded.recovered;
    recoveredSave = !!loaded.recovered;
    // v4 U38: 'refund:<coins>' in the repair list is the paid-back endless nodes; it has its own toast, not the generic repair one.
    const repairList = loaded.repairs || [];
    refundedCoins = repairList.map(r => /^refund:(\d+)$/.exec(r)).filter(Boolean).reduce((n, m) => n + Number(m[1]), 0);
    refundedKeys = repairList.map(r => /^refundKeys:(\d+)$/.exec(r)).filter(Boolean).reduce((n, m) => n + Number(m[1]), 0);
    repairedSave = repairList.some(r => !/^refund(Keys)?:/.test(r));
    newerSave = loaded.newer;
    giftEnded = loaded.giftEnded;
  } catch (error) { inaccessible = true; }
  // ?restore=1: one-tap automatic restore of the most progressed backup, before anything can save over it.
  let restoreNoBetter = false;
  if (launchQuery.get('restore') === '1' && saveStore && !inaccessible) {
    try {
      const rank = (s) => [s.dimension|0, s.stage|0, typeof s.coins === 'number' && isFinite(s.coins) ? s.coins : 0, s.date|0];
      const better = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] > b[i]; } return false; };
      const best = saveStore.list().filter(item => item.restorable).reduce((top, item) => (!top || better(rank(item), rank(top)) ? item : top), null);
      // A missing or unreadable current save counts as lowest; the date only orders backups against each other.
      const cur = (corrupt || !loaded0) ? [-1,-1,-1] : [state.dimension|0, state.vMax|0, Number(state.coins) || 0];
      if (best && !newerSave && better(rank(best).slice(0,3), cur) && saveStore.restore(best.key, true)) {
        restoring = true;
        const url = new URL(location.href); url.searchParams.delete('restore'); url.searchParams.set('restored','1');
        location.replace(url.href);
      } else restoreNoBetter = !!best && !newerSave;
    } catch (error) { restoreNoBetter = false; }
  }

  function showSaveNotice() {
    if ($('saveVersionNotice')) return;
    const host = document.createElement('div');
    host.id = 'saveVersionNotice'; host.className = 'save-version-notice'; host.setAttribute('role','status');
    host.append(document.createTextNode('새 버전이 있어요. 페이지를 새로고침해 주세요 '));
    const link = document.createElement('a'); link.href = 'update.html'; link.textContent = '새 버전 열기'; link.className = 'save-update-button';
    host.append(link); document.body.append(host);
  }
  // Manual save slots: this block owns slot storage, confirmations and the menu hook.
  const SaveSlots = (() => {
    const key = n => {
      if (!Number.isInteger(n) || n < 1 || n > 3) throw new Error('Invalid save slot');
      return `magicShowBuster.slot.${n}`;
    };
    function read(storage, n) {
      const raw = storage.getItem(key(n));
      if (raw === null) return {empty: true, slot: null};
      try { const slot = JSON.parse(raw); return {empty: false, slot: C.validSlot(slot) ? slot : null}; }
      catch (error) { return {empty: false, slot: null}; }
    }
    function write(storage, n, current, now = Date.now()) {
      const slot = {v: 1, savedAt: now, summary: C.slotSummary(current), data: C.serialize(current)};
      if (!C.validSlot(slot)) throw new Error('Unreadable save snapshot');
      storage.setItem(key(n), JSON.stringify(slot));
      return slot;
    }
    function confirmation() {
      let pending = null;
      return {tap(token, required) {
        if (!required || pending === token) { pending = null; return true; }
        pending = token; return false;
      }, reset() { pending = null; }};
    }
    function restore(storage, store, slot) {
      if (!C.validSlot(slot) || !C.deserialize(slot.data)) return false;
      const main = storage.getItem('magicShowBuster.v3');
      if (main !== null) {
        if (C.isNewerSave(main)) return false;
        store.backup(main, null, true);
        // U37 deduplicates against rolling backups too. Ensure that duplicate is protected.
        if (!store.list().some(item => item.protectedCopy && storage.getItem(item.key) === main)) {
          const prefix = 'magicShowBuster.v3.keep.';
          let stamp = Math.max(Date.now(), ...store.list().filter(item => item.protectedCopy).map(item => item.date + 1));
          while (storage.getItem(prefix + stamp) !== null) stamp++;
          storage.setItem(prefix + stamp, main);
        }
      }
      store.backup(slot.data, null, false);
      const target = store.list().find(item => item.restorable && storage.getItem(item.key) === slot.data);
      // The existing restore code alone writes the live key; reload uses its normal load/autosave path.
      const ok = !!target && store.restore(target.key, true);
      if (ok) settleDeckGift(storage, slot);
      return ok;
    }
    // v4 U48b: a slot saved before version 20 would grant the 칼리 덱 gift again on every load. The restore above still loads the original
    // data (so the gift is given this once); the slot itself is rewritten as version 20 without the gift, so restoring it later gives nothing.
    function settleDeckGift(storage, slot) {
      try {
        const s = C.deserialize(slot.data);
        if (!s || !(s._deckGift > 0)) return;
        s.u15.gloves = Math.max(0, s.u15.gloves - s._deckGift);
        const data = C.serialize(s);
        for (let n = 1; n <= 3; n++) {
          const cur = read(storage, n).slot;
          if (cur && cur.data === slot.data && cur.savedAt === slot.savedAt) storage.setItem(key(n), JSON.stringify({v: 1, savedAt: cur.savedAt, summary: cur.summary, data}));
        }
      } catch (error) { /* the slot stays as it was */ }
    }
    function date(ms) {
      const d = new Date(ms), h = d.getHours();
      return `${d.getMonth() + 1}월 ${d.getDate()}일 ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return {read, write, confirmation, restore, date};
  })();
  function openSaveSlots() {
    release(); $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false');
    openPanel('saveslots', '저장 칸');
    const confirm = SaveSlots.confirmation(), buttons = [];
    const status = element('p', '', 'save-slots-status'); status.setAttribute('role', 'status');
    const resetLabels = () => buttons.forEach(button => { button.textContent = button.dataset.label; });
    const body = $('panelBody');
    body.append(element('p', '불러오기 전 진행은 백업에 남아요.', 'save-slots-note'));
    try {
      for (let n = 1; n <= 3; n++) {
        const item = SaveSlots.read(localStorage, n), slot = item.slot;
        const row = element('section', '', 'save-slots-row');
        row.append(element('h2', `저장 칸 ${n}`));
        if (slot) {
          row.append(element('p', `${slot.summary.venueName} · 레벨 ${slot.summary.level} · 동전 ${slot.summary.coins}`),
            element('p', `${SaveSlots.date(slot.savedAt)} · 플레이 ${slot.summary.playMinutes}분`, 'save-slots-time'));
        } else row.append(element('p', item.empty ? '비어 있음' : '읽을 수 없는 저장'));
        const controls = element('div', '', 'save-slots-actions');
        const saveButton = action('여기에 저장', () => {
          resetLabels();
          try {
            const currentRaw = localStorage.getItem(`magicShowBuster.slot.${n}`);
            if (!confirm.tap(`save:${n}:${currentRaw}`, currentRaw !== null)) {
              saveButton.textContent = '덮어쓸까요? 한 번 더 누르기'; return;
            }
            const leaving = leavePending; // openSaveSlots re-opens the panel (which clears the flag)
            SaveSlots.write(localStorage, n, state); lastSlotSaveAt = Date.now(); openSaveSlots(); toast('저장 칸에 남겼어요');
            if (leaving) { leavePending = false; closePanel(); showLeaveConfirm(true); } // v4 U47 6: back to the leave question after a slot was written
          }
          catch (error) { status.textContent = '저장할 수 없어요. 다시 눌러 주세요'; }
        }, inaccessible || newerSave || restoring);
        const loadButton = action('불러오기', () => {
          resetLabels();
          if (!confirm.tap(`load:${n}`, true)) {
            loadButton.textContent = '지금 진행이 이 저장으로 바뀌어요. 한 번 더 누르기'; return;
          }
          try {
            const latest = SaveSlots.read(localStorage, n).slot;
            if (!latest || latest.data !== slot.data || latest.savedAt !== slot.savedAt) {
              openSaveSlots(); toast('저장 칸이 바뀌었어요. 다시 골라 주세요'); return;
            }
            if (!SaveSlots.restore(localStorage, saveStore, latest)) { status.textContent = '불러올 수 없어요'; return; }
            restoring = true;
            const url = new URL(location.href); url.searchParams.delete('restore'); url.searchParams.set('restored', '1');
            location.replace(url.href);
          } catch (error) { status.textContent = '불러오기를 마치지 못했어요. 백업을 확인해 주세요'; }
        }, !slot || inaccessible || newerSave || restoring || !saveStore);
        for (const button of [saveButton, loadButton]) { button.dataset.label = button.textContent; buttons.push(button); }
        controls.append(saveButton, loadButton); row.append(controls); body.append(row);
      }
    } catch (error) { status.textContent = '저장 칸을 읽을 수 없어요'; }
    body.append(status);
  }
  // v4 U47 6: a plain "저장" entry at the top of the menu (above the 놀기 and 설정 groups); it opens the same save-slot panel. Auto-save is unchanged.
  const saveSlotsButton = action('저장', openSaveSlots);
  saveSlotsButton.id = 'saveSlotsButton'; saveSlotsButton.title = '저장 칸에 저장하거나 불러와요';
  $('menuGroupSettings').insertAdjacentElement('afterend', saveSlotsButton);
  // Keep the existing more-menu host on desktop and through phone/desktop resize.

  function openRestore() {
    openPanel('restore', '저장 백업 복원');
    try {
      const backups = saveStore.list();
      if (!backups.length) $('panelBody').append(element('p','복원할 백업이 없어요.'));
      for (const item of backups) {
        const date = item.date ? new Date(item.date).toLocaleString('ko-KR') : '날짜 확인 불가';
        const venue = item.stage ? D.venues[item.stage-1] : null;
        const stage = item.stage ? (venue && venue.name ? venue.name : `무대 ${item.stage}`) : '무대 확인 불가';
        const coins = item.coins === null ? '동전 확인 불가' : `동전 ${C.formatNumber(item.coins)}`;
        const label = `${item.key.endsWith('.auto') ? '자동 백업 · ' : ''}${date} · ${stage} · ${coins}`;
        $('panelBody').append(action(label, () => {
          openPanel('restore', '이 백업을 복원할까요?');
          $('panelBody').append(element('p',label),element('p','현재 저장도 백업한 뒤 선택한 저장으로 바꿔요.'));
          $('panelBody').append(action('복원하기', () => {
            try {
              if (!saveStore.restore(item.key,true)) { toast('이 백업은 복원할 수 없어요'); return; }
              restoring = true;
              const url = new URL(location.href); url.searchParams.delete('restore');
              location.replace(url.href);
            } catch (error) { toast('복원할 수 없어요. 기존 저장은 유지돼요'); }
          }),action('취소',openRestore));
        }, !item.restorable));
      }
    } catch (error) { $('panelBody').append(element('p','백업을 읽을 수 없어요.')); }
  }

  // U36: pixel digits are rebuilt per glyph from cached templates, and fast-changing values (combo, case percent, doubt, coins) are
  // written at most 10 times per second (the newest value is always shown; flushNums runs every frame).
  const glyphTemplates = new Map(), numPending = new Map(), NUM_MS = 100;
  function glyphFor(ch) {
    let template = glyphTemplates.get(ch);
    if (!template) {
      template = document.createElement('span');
      template.setAttribute('aria-hidden', 'true');
      if (/\d/.test(ch)) {
        template.className = 'digit';
        for (const bit of patterns[Number(ch)]) {
          const pixel = document.createElement('i');
          if (bit === '0') pixel.className = 'off';
          template.append(pixel);
        }
      } else { template.className = 'digit-separator'; template.textContent = ch; }
      glyphTemplates.set(ch, template);
    }
    return template.cloneNode(true);
  }
  function writeNum(el, text) {
    el.dataset.rendered = text;
    el.setAttribute('aria-label', text);
    const next = Array.from(text), previous = el.__glyphs;
    if (previous && previous.length === next.length && el.children.length === next.length) {
      for (let i = 0; i < next.length; i++) if (previous[i] !== next[i]) el.replaceChild(glyphFor(next[i]), el.children[i]);
    } else {
      el.replaceChildren(...next.map(glyphFor));
    }
    el.__glyphs = next; el.__numAt = performance.now();
  }
  function num(el, value, soft) {
    const text = typeof value === 'number' ? C.formatNumber(value) : String(value);
    if (el.dataset.rendered === text) { numPending.delete(el); return; }
    if (soft && el.__numAt !== undefined && performance.now() - el.__numAt < NUM_MS) { numPending.set(el, text); return; }
    numPending.delete(el);
    writeNum(el, text);
  }
  function flushNums() {
    if (!numPending.size) return;
    const now = performance.now();
    for (const [el, text] of numPending) if (now - el.__numAt >= NUM_MS) { numPending.delete(el); if (el.dataset.rendered !== text) writeNum(el, text); }
  }
  const rounded = v => C.formatNumber(Math.max(0, Math.round(v)));
  const randomLine = list => list[Math.floor(Math.random() * list.length)];
  // U36: innerWidth/innerHeight flush layout, and portrait() runs inside paused(), which a frame calls dozens of times after DOM writes.
  // Phone portrait (shortest side under 600 CSS px) plays in the portrait layout. portrait() stays the pause/rotate gate for tablets and other tall viewports.
  // Same source as PhoneLayout.measure(): fit() writes this cache from layout.portrait (visual viewport).
  const portraitLayout = () => { let v = geo.get('portraitLayout'); if (v === undefined) { v = innerHeight > innerWidth && Math.min(innerWidth, innerHeight) < 600; geo.set('portraitLayout', v); } return v; };
  const portrait = () => { let v = geo.get('portrait'); if (v === undefined) { v = innerHeight > innerWidth && !portraitLayout(); geo.set('portrait', v); } return v; };
  const presentation=new Presentation.Queue();
  // A tap during a character dialogue is retained and collected only after the dialogue ends.
  const lineOpen = () => !!state.u15.scene || !$('storyDialog').hidden; // v4 U49b 1: a character dialog is on screen (the pickup is never collected then)
  // Menu and panel sheets block every layout, including the portrait dock's full-screen sheets.
  const blockingSheetOpen = () => !!menu || !$('phoneMore').hidden || $('moreButton').getAttribute('aria-expanded')==='true' || !$('panel').hidden;
  const dialogOnlyPause = () => lineOpen() && !blockingSheetOpen() && !state.u18.map && !wonMoment?.pending && !document.hidden && !portrait() && $('offlineCard').hidden && !stageRewardHost && $('leaveConfirm').hidden && $('sceneCard').hidden;
  const paused = () => wonMoment?.pending || state.u18.map || !!state.u15.scene || (state.u15.tutorial.active && (state.u15.tutorial.phase!=='fight' || state.u15.tutorial.won)) || schoolChainPaused() || !state.onboarding.intro || document.hidden || blockingSheetOpen() || portrait() || !!stageRewardHost || !$('offlineCard').hidden || !$('leaveConfirm').hidden || !$('sceneCard').hidden;
  function fit() {
    const vv = window.visualViewport;
    const width = vv ? vv.width : innerWidth, height = vv ? vv.height : innerHeight;
    geo.clear(); wandOffset = null; geoAge = 0;
    const probe = getComputedStyle($('safeArea'));
    const safe = Object.fromEntries(['left','right','top','bottom'].map(side => [side, parseFloat(probe.getPropertyValue(`padding-${side}`)) || 0]));
    const layout = PhoneLayout.measure(width, height, safe, coarse, true);
    geo.set('portraitLayout', !!layout.portrait);
    phone = layout.phone;
    document.body.classList.toggle('phone', phone);
    document.body.classList.toggle('tablet',!!layout.tablet);
    document.body.classList.toggle('phone-tight', phone && layout.height <= 340);
    document.body.classList.toggle('compact-notice', phone && !layout.portrait && !layout.tablet && (layout.height <= 340 || layout.audience < 360));
    document.body.classList.toggle('phone-compact',phone&&!layout.tablet&&layout.height<352);
    document.body.classList.toggle('phone-narrow',phone&&!layout.tablet&&layout.audience<260);
    document.body.classList.toggle('phone-low',phone&&!layout.tablet&&layout.height<320);
    document.body.classList.toggle('phone-xshort',phone&&!layout.tablet&&layout.height<300);
    document.body.classList.toggle('phone-short',phone&&!layout.tablet&&layout.height<400);
    document.body.classList.toggle('portrait-layout', !!layout.portrait);
    document.body.classList.toggle('portrait-compact', !!layout.portrait?.compact);
    document.body.classList.toggle('portrait', portrait());
    scale = phone ? 1 : Math.min(innerWidth / 1600, innerHeight / 900);
    layoutWidth = phone ? layout.width : 1600; layoutHeight = phone ? layout.height : 900;
    const frame = $('frame'), stage = $('stage');
    frame.style.width = `${layoutWidth * scale}px`; frame.style.height = `${layoutHeight * scale}px`;
    frame.style.position = phone ? 'absolute' : 'relative';
    frame.style.left = phone ? `${safe.left + (layout.tablet ? (width-safe.left-safe.right-layout.width)/2 : 0) + (vv?.offsetLeft || 0)}px` : '';
    frame.style.top = phone ? `${safe.top + (vv?.offsetTop || 0)}px` : '';
    stage.style.width = `${layoutWidth}px`; stage.style.height = `${layoutHeight}px`;
    stage.style.transform = `scale(${scale})`;
    stage.style.setProperty('--menu-tap-height', `${45 / scale}px`);
    stage.style.setProperty('--layout-height',`${layoutHeight}px`);
    stage.style.setProperty('--stage-w',`${layoutWidth}px`); // v4 U50: the stage width for the one-scene layout (style.css U50 block)
    stage.style.setProperty('--board-size', `${layout.board}px`);
    stage.style.setProperty('--audience-width', `${layout.audience}px`);
    if (layout.portrait) {
      const p = layout.portrait;
      stage.style.setProperty('--p-top', `${p.top}px`);
      stage.style.setProperty('--p-board-h', `${p.boardH}px`);
      stage.style.setProperty('--p-venue', `${p.venue}px`);
      stage.style.setProperty('--p-row-gap', `${p.rowGap}px`);
      stage.style.setProperty('--p-hp', `${p.hp}px`);
      stage.style.setProperty('--p-stage', `${p.stageH}px`);
      stage.style.setProperty('--p-stats', `${p.stats}px`);
      stage.style.setProperty('--p-finale', `${p.finale}px`);
      stage.style.setProperty('--p-skills', `${p.skills}px`);
      stage.style.setProperty('--p-board-top', `${p.boardTop}px`);
      stage.style.setProperty('--p-pad', `${p.pad}px`);
      stage.style.setProperty('--p-gap', `${p.gap}px`);
      // One case plus the docked dialogue: the square that fits above the line, still centred.
      const soloRoom = layout.height - p.boardTop - p.skills - 108;
      stage.style.setProperty('--p-solo', `${Math.max(96, Math.min(layout.board, layout.width - 16, soloRoom))}px`);
    } else {
      for (const name of ['--p-board-h','--p-top','--p-venue','--p-row-gap','--p-hp','--p-stage','--p-stats','--p-finale','--p-skills','--p-board-top','--p-pad','--p-gap','--p-solo']) stage.style.removeProperty(name);
    }
    const dpr = phone ? Math.min(2, window.devicePixelRatio || 1) : 1;
    canvas.width = Math.round(layoutWidth * dpr); canvas.height = Math.round(layoutHeight * dpr);
    canvas.style.width = `${layoutWidth}px`; canvas.style.height = `${layoutHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    caps.particles = phone ? 48 : (coarse ? 120 : 240); caps.icons = phone ? 8 : 24;
    particles.length = 0; flights.length = 0; numbers.length = 0; badges.length = 0;
    invalidateStageAudience();
    phoneChrome(); release(); previous = 0; snapAudience();
    if (menu === 'book') tree();
  }
  // v4 U50: the doubt and 야유 bars stand upright (style.css U50); their text plates become siblings so the turned bars hold only the fill.
  for (const [sel, cls] of [['.doubt > .doubt-label', 'doubt-plate'], ['#heckleMeter > .heckle-label', 'heckle-plate']]) { const el = document.querySelector(sel); if (el) { el.classList.add(cls); $('audienceCard').append(el); } }
  const chromeHomes = new Map();
  // v4 U48 N3: 도감 stays in the top bar (nav .menu) next to 메뉴 on desktop too.
  const DESKTOP_MENU = ['caseArrangeButton','equipButton','missionsButton','mapButton','gemShopButton','customizeButton','rebirthButton','soundButton','musicButton','musicVolume','hapticsButton','textSpeedButton','retreatButton','coffeeButton','openChatButton'];
  function moveChrome(el, host) {
    if (!el) return;
    if (!chromeHomes.has(el)) chromeHomes.set(el, { parent: el.parentNode, next: el.nextSibling });
    host.append(el);
  }
  function phoneChrome() {
    const portraitNow = phone && portraitLayout();
    if (!portraitNow) leavePortraitChrome();
    if (phone) {
      moveChrome(document.querySelector('.venue-heading'), $('phoneVenue'));
      moveChrome(document.querySelector('.hud'), $('phoneWallet'));
      moveChrome($('goalStrip'),$('phoneTop'));
      moveChrome($('bookButton'),$('phoneTop'));
      moveChrome($('storyDialog'),$('stage')); // v4 U50b: out of the isolated audience card, so the widened dialog is drawn (and tapped) above the skill column
      moveChrome($('equipButton'),$('phoneMore')); // Equipment lives in the menu; the notebook stays in the top row.
      // Portrait only: row 1 is the skills, row 2 is 비법, 실크 상점, 연습 모드, 메뉴. 도감 stays on the top bar.
      if (portraitNow) placePortraitDock();
      else {
        showBookButton(true);
        moveChrome($('bestiaryButton'),$('phoneTop')); moveChrome($('wardrobeButton'),$('phoneTop')); // v4 U48 N3: 도감 sits in the top bar next to 메뉴, not in the menu
        moveChrome($('moreButton'), $('phoneTop')); $('moreButton').textContent='☰ 메뉴';
      }
      for (const id of ['storyButton','installButton','statsButton','rebirthButton','missionsButton','gemShopButton','mapButton','customizeButton','soundButton','musicButton','musicVolume','hapticsButton','textSpeedButton','retreatButton','helperControls','debug','coffeeButton','openChatButton']) moveChrome(id==='musicVolume'?$(id).parentElement:$(id), $('phoneMore'));
      if (!portraitNow && $('practiceButton')) moveChrome($('practiceButton'), $('phoneMore')); // 연습 모드 is in the menu outside portrait
      if (portraitNow) pxText($('equipButton'), '🎩 마술용품');
      else { pxText($('bookButton'), '비법'); pxText($('equipButton'), '🎩 마술용품'); /* v4 U50b: a full label, it lives in the menu now */ $('moreButton').textContent=innerWidth<=740?'☰':'☰ 메뉴'; pxText($('bestiaryButton'), innerWidth<=740?'📚':'📚 도감'); }
      $('moreButton').setAttribute('aria-label','메뉴'); $('bestiaryButton').setAttribute('aria-label','도감');
      updateSoundButton();const on=window.Sfx?.musicEnabled();$('musicButton').textContent=on?'음악 ON':'음악 OFF';
      $('closePanel').textContent = '← 뒤로';
    } else {
      for (const [el, home] of [...chromeHomes].reverse()) home.parent.insertBefore(el, home.next?.parentNode === home.parent ? home.next : null);
      updateSoundButton();const on=window.Sfx?.musicEnabled();$('musicButton').textContent=on?'배경음악 켜짐':'배경음악 꺼짐';
      chromeHomes.clear(); $('moreButton').textContent='☰ 메뉴'; pxText($('equipButton'), '🎩 마술용품'); showBookButton(true); pxText($('bookButton'), '비법'); pxText($('bestiaryButton'), '도감'); $('closePanel').textContent = '닫기';
      // v4 U46 A7: desktop keeps only 비법서 and 메뉴 at the top, like the phone; everything else lives in the menu sheet.
      for (const id of DESKTOP_MENU) moveChrome(id==='musicVolume'?$(id).parentElement:$(id), $('phoneMore'));
      moveChrome($('statsButton'), $('phoneMore'));
      if ($('practiceButton')) moveChrome($('practiceButton'), $('phoneMore'));
    }
    if ($('practiceButton')) $('practiceButton').hidden = false; // 연습 모드 is shared: every layout reaches it
    if (!portraitNow) moveChrome($('caseArrangeButton'), $('phoneMore'));
    $('caseArrangeMenuButton').hidden = true;
    placePortraitMeters(portraitNow);
    portraitCopy();
    dressSharedButtons(portraitNow);
    dressKitStats(true);
    placePortraitDecor(portraitNow);
    // v4 U48 M: fit() runs on every viewport resize or scroll (a phone's address bar, the keyboard); the open menu stays open unless the layout kind changed.
    if (phoneChrome.kind !== phone) { phoneChrome.kind = phone; $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false'); }
  }
  // Portrait only: the stage light, Kali's table, the board frame and the menu sheet's close button.
  function placePortraitDecor(on) {
    for (const id of ['stageLight', 'kaliTable', 'boardFrame']) if ($(id)) $(id).hidden = !on;
    if (on) syncKaliTable();
    let close = $('closeMore');
    if (on && !close) {
      close = action('메뉴 닫기', hideMore);
      close.id = 'closeMore';
      close.style.order = '-4'; close.style.gridColumn = '1 / -1';
    }
    if (on) { close.hidden = false; if (close.parentNode !== $('phoneMore') || close !== $('phoneMore').firstChild) $('phoneMore').prepend(close); }
    else if (close) close.remove();
  }
  // Leaving portrait: undo the dock, the skill row and the kit faces, so the landscape chrome is the backup's.
  function leavePortraitChrome() {
    const dock = $('actionDock'), skills = $('activeSkills');
    const gloveHome = chromeHomes.get($('item-auto-glove'));
    if (gloveHome && $('item-auto-glove')) skills.append($('item-auto-glove'));
    if (!dock && !$('skillRow') && !document.querySelector('.kit-btn, .top-dogam')) return;
    releaseSkillRow();
    for (const id of ['caseArrangeButton', 'bookButton', 'practiceButton', 'bestiaryButton', 'moreButton', 'gemShopQuick', 'wardrobeButton']) clearKitFace($(id));
    for (const button of skills.querySelectorAll('.active-skill')) button.classList.remove('kit-btn');
    const dogam = $('bestiaryButton');
    if (dogam) { dogam.classList.remove('top-dogam'); dogam.querySelectorAll(':scope > img.top-dogam-ico, :scope > .top-dogam-label').forEach(n => n.remove()); delete dogam.dataset.pxText; }
    if ($('gemShopQuick')) skills.prepend($('gemShopQuick')); // first in #activeSkills, as on a fresh landscape load
    if ($('bookButton')) $('bookButton').style.removeProperty('display');
    if (dock) {
      // Put every moved button back to its saved home (or the landscape skill host) before the dock goes.
      for (const el of [...dock.children]) {
        const home = chromeHomes.get(el);
        if (home && home.parent !== dock && home.parent.isConnected) home.parent.insertBefore(el, home.next?.parentNode === home.parent ? home.next : null);
        else skills.append(el);
      }
      dock.remove();
    }
  }
  // Portrait: audience HP (name, 의심 number, purple bar) is its own framed strip under the venue.
  // 액트 and 연출 are numbers under the venue name. The stats band is 멘탈, 자신감, 피날레, then the audience 야유 gauge.
  let portraitChromeOn = false;
  // Portrait moves record each node's landscape parent and next sibling the first time; leaving portrait puts them back in reverse order.
  const portraitHomes = new Map();
  function portraitMove(el, host) {
    if (!el || !host) return;
    if (!portraitHomes.has(el)) portraitHomes.set(el, { parent: el.parentNode, next: el.nextSibling, known: new Set(el.parentNode ? el.parentNode.children : []) });
    host.append(el);
  }
  function restorePortraitHomes() {
    for (const [el, home] of [...portraitHomes].reverse()) {
      if (!home.parent) continue;
      // A node that was last goes right after its last remaining old sibling, before the siblings created while it was away, as on a fresh load.
      let next = home.next?.parentNode === home.parent ? home.next : undefined;
      if (next === undefined) { const old = [...home.parent.children].filter(c => c !== el && home.known.has(c)).pop(); next = old ? old.nextSibling : home.parent.firstChild; }
      home.parent.insertBefore(el, next);
    }
    portraitHomes.clear();
  }
  function placePortraitMeters(on) {
    const doubt = document.querySelector('.doubt-plate');
    const bar = document.querySelector('.doubt');
    let host = $('portraitMeters');
    if (on) {
      if (!host) { host = element('div', '', 'portrait-meters'); host.id = 'portraitMeters'; }
      $('stage').append(host);
      let left = host.querySelector('.meter-left');
      if (!left) { left = element('div', '', 'meter-left'); host.append(left); }
      portraitMove(doubt, left);
      portraitMove(bar, host);
      placePortraitPlain(true);
      placePortraitGauges(true);
      portraitChromeOn = true;
    } else if (portraitChromeOn) {
      restorePortraitHomes();
      if (host) host.remove();
      placePortraitPlain(false);
      placePortraitGauges(false);
      portraitChromeOn = false;
    }
  }
  function placePortraitPlain(on) {
    const combo = $('combo'), rate = $('stageRate');
    let line = $('portraitPlain');
    if (on) {
      if (!line) {
        line = element('div', '', 'portrait-plain');
        line.id = 'portraitPlain';
        line.setAttribute('aria-label', '액트와 연출');
      }
      const heading = document.querySelector('.venue-heading');
      if (heading && line.parentNode !== heading) heading.append(line);
      portraitMove(combo, $('stageStats'));
      portraitMove(rate, $('stageStats'));
    } else if (line) line.remove();
  }
  function placePortraitGauges(on) {
    const card = $('audienceCard'), stats = $('stageStats');
    const finisher = document.querySelector('#audienceCard .finisher, .finisher');
    const label = document.querySelector('.finisher-label');
    const heckle = $('heckleMeter');
    const plate = document.querySelector('.heckle-plate');
    let finale = $('finaleStat');
    if (on && stats) {
      if (!finale) {
        finale = element('div', '', 'kali-gauge');
        finale.id = 'finaleStat';
        finale.setAttribute('aria-label', '피날레 자동 발동 충전');
        finale.classList.add('finale-skill');
        const icon = element('img', '', 'skill-art'); icon.src = 'assets/kit/icon-finale.webp'; icon.alt = ''; finale.append(icon);
      }
      // Attach before moving the fill so ID lookups still find the finale subtree.
      stats.append(finale);
      portraitMove(label, finale);
      let num = $('finaleNumber');
      if (!num) { num = element('span', '', 'gauge-num'); num.id = 'finaleNumber'; finale.append(num); }
      else finale.append(num);
      portraitMove(finisher, finale);
      if (heckle) {
        heckle.classList.add('audience-gauge');
        portraitMove(plate, heckle);
        portraitMove(heckle, $('portraitMeters'));
      }
      for (const id of ['mental', 'shield', 'finaleStat']) {
        const el = $(id);
        if (el === finale) stats.append(el);
        else portraitMove(el, stats);
      }
      portraitMove(finale, $('skillRow'));
    } else if (card && stats) {
      // restorePortraitHomes() already put the moved nodes back; only the portrait-made pieces go.
      if (finale && finale.parentNode) finale.remove();
      if (heckle) heckle.classList.remove('audience-gauge');
    }
  }
  function portraitCopy() {
    const on = portraitLayout();
    const title = $('doubtTitle');
    const kind = title.dataset.kind || '의심';
    const name = title.dataset.audience || '';
    const full = name ? `${name}의 ${kind}` : title.textContent;
    const next = on ? kind : full;
    if (title.dataset.audience && title.textContent !== next) title.textContent = next;
    const heckle = document.querySelector('.heckle-plate > span');
    if (heckle) { const label = on ? '야유' : '관객의 야유'; if (heckle.textContent !== label) heckle.textContent = label; }
    let nameEl = $('doubtName');
    const left = $('portraitMeters') && $('portraitMeters').querySelector('.meter-left');
    if (on && left) {
      if (!nameEl) { nameEl = element('span', '', 'doubt-name'); nameEl.id = 'doubtName'; }
      left.prepend(nameEl);
      if (nameEl.textContent !== name) nameEl.textContent = name;
      nameEl.hidden = !name;
    } else if (nameEl) nameEl.remove();
  }
  function showBookButton(on) {
    const book = $('bookButton');
    if (!book) return;
    if (on) {
      book.hidden = false;
      book.style.setProperty('display', 'inline-flex', 'important');
      book.removeAttribute('aria-hidden');
      book.removeAttribute('tabindex');
      book.textContent = '비법';
      delete book.dataset.pxText;
    } else {
      book.style.removeProperty('display');
      book.hidden = true;
      book.setAttribute('aria-hidden', 'true');
      book.tabIndex = -1;
    }
  }
  function ensureActionDock() {
    let dock = $('actionDock');
    if (!dock) {
      dock = element('div', '', 'action-dock');
      dock.id = 'actionDock';
      dock.setAttribute('role', 'group');
      dock.setAttribute('aria-label', '비법, 실크 상점, 연습 모드, 정리, 옷장, 메뉴');
      $('activeSkills').append(dock);
    }
    dock.hidden = false;
    return dock;
  }
  function ensureSkillRow() {
    let row = $('skillRow');
    if (!row) {
      row = element('div', '', 'skill-row');
      row.id = 'skillRow';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', '스킬');
    }
    const skills = $('activeSkills');
    for (const button of [...skills.querySelectorAll(':scope > .active-skill')]) {
      if (button.id === 'gemShopQuick') continue;
      row.append(button);
    }
    if (!row.originalOrder) row.originalOrder = [...row.children];
    if (row.parentNode !== skills) skills.prepend(row);
    for (const id of ['skill-cardrain', 'skill-showtime', 'skill-cheer']) if ($(id)?.parentNode === row) row.append($(id));
    row.hidden = false;
    return row;
  }
  function releaseSkillRow() {
    const row = $('skillRow');
    if (!row) return;
    const skills = $('activeSkills');
    const dock = $('actionDock');
    for (const button of [...row.children].sort((a,b) => row.originalOrder.indexOf(a) - row.originalOrder.indexOf(b))) {
      if (dock && dock.parentNode === skills) skills.insertBefore(button, dock);
      else skills.append(button);
    }
    row.remove();
  }
  function dressTopDogam() {
    const button = $('bestiaryButton');
    if (!button) return;
    clearKitFace(button);
    button.classList.add('top-dogam');
    button.setAttribute('aria-label', '도감');
    let ico = button.querySelector(':scope > img.top-dogam-ico');
    if (!ico) {
      button.replaceChildren();
      ico = document.createElement('img');
      ico.className = 'top-dogam-ico';
      ico.alt = '';
      ico.width = 20;
      ico.height = 20;
      ico.draggable = false;
      button.append(ico,element('span','도감','top-dogam-label'));
    }
    if (ico.getAttribute('src') !== 'assets/kit/icon-collection.webp') ico.src = 'assets/kit/icon-collection.webp';
    delete button.dataset.pxText;
  }
  function placePortraitDock() {
    const dock = ensureActionDock();
    ensureSkillRow();
    showBookButton(true);
    moveChrome($('bookButton'), dock);
    if ($('gemShopQuick')) moveChrome($('gemShopQuick'), dock);
    if ($('practiceButton')) { $('practiceButton').hidden = false; moveChrome($('practiceButton'), dock); }
    moveChrome($('caseArrangeButton'), dock);
    moveChrome($('wardrobeButton'), dock);
    moveChrome($('moreButton'), dock);
    delete $('moreButton').dataset.pxText;
    $('moreButton').setAttribute('aria-label', '메뉴');
    $('bookButton').setAttribute('aria-label', '비법');
    if ($('gemShopQuick')) $('gemShopQuick').setAttribute('aria-label', '실크 상점');
    if ($('practiceButton')) $('practiceButton').setAttribute('aria-label', '연습 모드');
    dressTopDogam();
    moveChrome($('bestiaryButton'), dock);
    // Row 1 is #skillRow. Row 2 is the dock, in this order.
    $('activeSkills').append(dock);
    dressPortraitButtons();
    const glove = $('item-auto-glove');
    if (glove) {
      if (!chromeHomes.has(glove)) chromeHomes.set(glove, { parent: $('activeSkills'), next: null });
      $('phoneMore').append(glove);
    }
  }
  function clearKitFace(button) {
    if (!button) return;
    button.classList.remove('kit-btn');
    for (const node of button.querySelectorAll(':scope > .kit-ico, :scope > .kit-label, :scope > small[data-kit]')) node.remove();
    // Put back the label text that dressKitButton() took out.
    if (button.dataset.kitText !== undefined) {
      if (button.dataset.kitText && ![...button.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) button.append(button.dataset.kitText);
      delete button.dataset.kitText;
    }
    delete button.dataset.pxText;
  }
  function dressKitButton(button, src, label) {
    if (!button) return;
    button.classList.add('kit-btn');
    let ico = button.querySelector(':scope > img.kit-ico');
    if (!ico) {
      ico = document.createElement('img');
      ico.className = 'kit-ico';
      ico.alt = '';
      ico.draggable = false;
      button.prepend(ico);
    }
    if (ico.getAttribute('src') !== src) ico.src = src;
    let lab = button.querySelector(':scope > .kit-label');
    if (!lab) {
      lab = document.createElement('span');
      lab.className = 'kit-label';
      const small = button.querySelector(':scope > small');
      if (small) button.insertBefore(lab, small); else button.append(lab);
    }
    if (lab.textContent !== label) lab.textContent = label;
    if (!button.querySelector(':scope > small')) { const small = document.createElement('small'); small.dataset.kit = '1'; button.append(small); }
    const text = [...button.childNodes].filter(node => node.nodeType === 3 && node.textContent.trim());
    if (button.dataset.kitText === undefined) button.dataset.kitText = text.map(node => node.textContent).join('');
    for (const node of text) node.remove();
  }
  function dressPortraitButtons() {
    dressKitButton($('bookButton'), 'assets/kit/icon-secret.webp', '비법');
    dressKitButton($('gemShopQuick'), 'assets/kit/icon-silk-shop.webp', '실크 상점');
    dressKitButton($('practiceButton'), 'assets/kit/icon-practice.webp', '연습 모드');
    dressKitButton($('caseArrangeButton'), 'assets/kit/icon-sort.webp', '정리');
    dressKitButton($('moreButton'), 'assets/kit/icon-menu.webp', '메뉴');
    dressKitButton($('bestiaryButton'), 'assets/kit/icon-collection.webp', '도감');
    dressKitButton($('wardrobeButton'), 'assets/kit/icon-wardrobe.webp', '옷장');
    // kit-btn right after active-skill, so a button dressed again after a rotation has a fresh load's class order.
    for (const button of document.querySelectorAll('#skillRow > .active-skill')) if (!button.classList.contains('kit-btn')) { const [first, ...rest] = button.classList; button.className = [first, 'kit-btn', ...rest].join(' '); }
  }
  // Overlay faces preserve each landscape button's original text metrics and hit box.
  function dressSharedButtons(portraitNow) {
    const faces=[['bookButton','icon-secret','비법'],['bestiaryButton','icon-collection','도감'],
      ['moreButton','icon-menu','메뉴'],['practiceButton','icon-practice','연습 모드'],
      ['caseArrangeButton','icon-sort','케이스 정리'],['caseArrangeMenuButton','icon-sort','케이스 정리'],
      ['gemShopButton','icon-silk-shop','실크 상점'],['wardrobeButton','icon-wardrobe','옷장']];
    for(const [id,icon,label] of faces){
      const button=$(id);if(!button)continue;
      let face=button.querySelector(':scope > .shared-kit-face');
      button.classList.toggle('shared-kit',!portraitNow);
      if(portraitNow){face?.remove();continue;}
      if(!face){
        face=element('span','','shared-kit-face');face.setAttribute('aria-hidden','true');
        const art=element('img');art.src=icon==='wardrobe'?'assets/icon-wardrobe-64.webp':icon?`assets/kit/${icon}.webp`:'assets/cur-silk.webp';art.alt='';art.draggable=false;
        face.append(art,element('span',label));button.append(face);
      }
      button.setAttribute('aria-label',label);
    }
  }
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
    presentation.push({merge:'toast:'+kind+':'+text,minimum:1200,start:item=>{
      const el=pxIcons(element('div',text+(item.extra?' · '+item.extra:''),'toast'));$('toasts').append(el);const expiry=setTimeout(()=>el.remove(),3500);item.end=()=>{clearTimeout(expiry);el.remove();};
    }});
  }
  function milestonePop(text,p){presentation.push({merge:'milestone:'+text,minimum:1200,start:item=>{const el=pxIcons(element('div',text+(item.extra?' · '+item.extra:''),'toast'));$('toasts').append(el);float('×2!',p.x,p.y,'#ffe65c',22);const expiry=setTimeout(()=>el.remove(),3500);item.end=()=>{clearTimeout(expiry);el.remove();};}});}
  function nextToasts(dt=0){
    // Ordinary notices wait behind queued dialogue; genuine clear/reward notices still finish first.
    if(state.u15.queue.length&&!presentation.active){
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
  function showStageReward(reward,gems=0){
    presentation.push({stageTransition:true,minimum:2000,priority:20,start:item=>{
      const r=D.stageRewards[reward-1],host=element('button','','stage-reward');stageRewardHost=host;host.type='button';
      host.setAttribute('aria-label',r.effect+' · 눌러서 계속');const art=element('img');art.src='assets/reward-'+r.id+'.png';art.alt='';
      host.append(art,element('h2',r.effect),element('p',r.quote));if(gems)host.append(element('p',`실크 +${gems}`));$('stage').append(host);
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
  let motionLoopKey='';
  function syncMotionLoops() {
    const key=[reduced,paused(),state.mode,state.onboarding.step,state.u15.tutorial.phase,...D.skills.map(k=>C.skillUnlocked(state,k.id)&&state.skills.cooldowns[k.id]<=0)].join(':');
    if(key===motionLoopKey)return;motionLoopKey=key;
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
  // v4 U46 A2: the break moment. A case break throws 24 star and square pixels (4 under reduced motion) inside the U36 particle cap, and at most once
  // per second starts a 150 ms presentation slow: the effect clock and the running animations go at 0.15x. Game time (stepCombat dt) is untouched.
  const BREAK_SLOW = { ms: 150, rate: .15, every: 1000 }; let slowUntil = 0, slowAt = -Infinity, slowAnims = [];
  function breakMoment(x, y, color) {
    const n = reduced ? 4 : 24;
    for (let i = 0; i < n && particles.length < caps.particles; i++) {
      const angle = i * Math.PI * 2 / n + (i % 2) * .13, speed = 60 + (i * 37) % 60;
      particles.push({ x, y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed - 18, start: clock, life: 420 + (i % 4) * 40, color: ['#F2E6C8', '#E8BF68', color][i % 3], size: 2 + i % 2, square: i % 2 === 0 });
    }
    const now = performance.now();
    if (reduced || now - slowAt < BREAK_SLOW.every) return;
    slowAt = now; slowUntil = now + BREAK_SLOW.ms;
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
      return { x: r.left + r.width / 2 - stage.left, y: r.top + r.height / 2 - stage.top };
    }
    if (effect === 'gems') return { x: 958, y: 90 };
    if (effect === 'coins') return { x: 1230, y: 90 };
    if (effect === 'shield') return { x: 686, y: 438 };
    if (effect === 'power') return { x: 686, y: 298 };
    if (effect === 'heal') return { x: 686, y: 508 };
    if (effect === 'xpBurst') return { x: 500, y: 808 };
    if (effect === 'finisher') return { x: 104, y: 590 };
    if (effect === 'boxFill') return { x: 1174, y: 490 };
    return { x: 686, y: 368 };
  }
  function fly(x, y, dest, emoji, label = '', color = '#ffe35b', delay = 0, image = null) {
    if (phone && (x > layoutWidth || y > layoutHeight)) {
      const origin = x >= 870 ? (y < 160 ? target('coins') : boardPoint(x - 870, y - 160)) : target('damage');
      x = origin.x; y = origin.y;
    }
    if (reduced || flights.length >= Math.min(caps.icons, 8)) return;
    if (!image && PX_ICONS[String(emoji).replace(/️/g, '')]) image = assetImage(`assets/ui/ic-${PX_ICONS[String(emoji).replace(/️/g, '')]}.webp`); // v4 U46 A5: pixel icon instead of a canvas emoji
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
  function clearMoment(headliner, coins) {
    const MS = 2500, card = $('audienceCard'), aud = $('audience');
    const stamp = element('div', headliner ? '기립박수!' : '감탄!', 'win-stamp'); stamp.id = 'winStamp'; stamp.setAttribute('aria-hidden', 'true');
    const flash = element('div', '', 'win-flash'); flash.setAttribute('aria-hidden', 'true');
    card.append(flash, stamp);
    const anims = [];
    const run = (el, frames, opts) => { const a = el.animate(frames, { fill: 'both', easing: 'linear', ...opts }); anims.push(a); return a; };
    const at = ms => ms / MS;
    const fade = [{ opacity: 0, offset: 0 }, { opacity: 1, offset: at(120) }, { opacity: 1, offset: at(1800) }, { opacity: 0, offset: at(2100) }, { opacity: 0, offset: 1 }];
    if (reduced) {
      run(stamp, fade, { duration: MS });
    } else {
      run(flash, [{ opacity: 0, offset: 0 }, { opacity: .55, offset: .2 }, { opacity: 0, offset: 1 }], { duration: 120 });
      // U54d: pop down/left from the reserved bubble edge on tablets and narrow stages.
      const rot = document.body.classList.contains('tablet') || document.body.classList.contains('phone-narrow') ? '' : 'rotate(-8deg)';
      run(stamp, [{ opacity: 1, transform: rot + ' scale(2)', offset: 0, easing: 'cubic-bezier(.2,.8,.2,1)' }, { opacity: 1, transform: rot + ' scale(1)', offset: at(220) },
        { opacity: 1, transform: rot + ' scale(1)', offset: at(1800) }, { opacity: 0, transform: rot + ' scale(1)', offset: at(2100) }, { opacity: 0, transform: rot + ' scale(1)', offset: 1 }], { duration: MS });
      const pose = (s, r, y, o, extra) => ({ transform: `scale(${s}) rotate(${r}deg) translateY(${y}px)`, offset: at(o), ...extra });
      const bow = (a, b) => [pose(1, 0, 0, a), pose(1, 4, 6, (a + b) / 2), pose(1, 0, 0, b)];
      const out = run(aud, [pose(1.12, 0, 0, 0, { easing: 'ease-out' }), pose(1, 0, 0, 300), ...bow(900, 1150), ...bow(1250, 1500),
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
    // Coins leave the audience centre 150 ms in; the coin counter pulses as they land.
    // From the face top edge, so the coins do not cross the banner below.
    const mid = audiencePoint(.5, .14); clearMoment.origin = mid; coinStream(mid.x, mid.y, coins, 150);
    const pulse = setTimeout(() => { const el = $('coins')?.closest('.currency') || $('coins'); if (!reduced && el) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 220 }); }, 150 + 240 + Math.min(coins, 8) * 28);
    return { stop() { clearTimeout(pulse); anims.forEach(a => { if (a !== audience.winExit) a.cancel(); }); stamp.remove(); flash.remove(); } };
  }
  function cellCenter(i) {
    const p = C.cellPosition(state, i), k = C.CONST;
    const pitch = k.cellSize + k.cellGap;
    return boardPoint(k.boardInset + p.col * pitch + k.cellSize / 2, k.boardInset + p.row * pitch + k.cellSize / 2);
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
      fx.append(element('div', '', 'finale-dark'), element('div', '', 'finale-spot'), cut, element('div', '', 'finale-flash'), element('span', '', 'finale-num'));
      card.append(fx);
    }
    for (const id of ['mental', 'shield']) {
      const host = $(id);
      if (host && !host.querySelector('.meter-bar')) {
        const bar = element('span', '', 'meter-bar'); bar.setAttribute('aria-hidden', 'true');
        bar.append(element('span', '', 'meter-ghost'), element('span', '', 'meter-fill'));
        host.append(bar);
      }
    }
    dressKitStats(true);
  }
  // The shared v2 stat band uses the same four icons and gauges in every layout.
  function dressKitStats(on) {
    const faces = [
      ['combo', 'assets/kit/icon-spark.webp'],
      ['mental', 'assets/kit/icon-brain.webp'],
      ['shield', 'assets/kit/icon-sparkle.webp'],
      ['stageRate', 'assets/kit/icon-clapper.webp']
    ];
    for (const [id, src] of faces) {
      const host = $(id);
      if (!host) continue;
      if (on && !host.querySelector('.meter-bar')) {
        const bar = element('span', '', 'meter-bar'); bar.setAttribute('aria-hidden', 'true');
        bar.append(element('span', '', 'meter-fill')); host.append(bar);
      }
      const ico = host.querySelector(':scope > img.stat-ico');
      if (!on) { if (ico) ico.remove(); continue; }
      if (!ico) {
        const img = document.createElement('img');
        img.className = 'stat-ico';
        img.alt = '';
        img.draggable = false;
        img.setAttribute('aria-hidden', 'true');
        img.src = src;
        host.prepend(img);
      } else if (ico.getAttribute('src') !== src) ico.src = src;
    }
  }
  function popChip(anchor, text, kind, ms) {
    const card = $('audienceCard'); if (!card || !anchor) return;
    card.querySelectorAll('.bar-chip.' + kind).forEach(el => el.remove());
    const chip = element('span', text, 'bar-chip ' + kind); chip.setAttribute('aria-hidden', 'true');
    const r = anchor.getBoundingClientRect(), c = card.getBoundingClientRect(), sc = scale || 1;
    const above = kind === 'block';
    chip.style.left = ((above ? r.left : r.right) - c.left) / sc + 'px';
    chip.style.top = ((above ? r.top : r.top + r.height * .55) - c.top) / sc + 'px';
    card.append(chip);
    setTimeout(() => chip.remove(), ms);
  }
  function trailMeter(id, ms) {
    const el = $(id); if (!el || reduced) return;
    el.style.setProperty('--ghost', el.style.getPropertyValue('--meter') || '100%');
    el.classList.remove('meter-hit'); void el.offsetWidth; el.classList.add('meter-hit');
    clearTimeout(el._ghost); el._ghost = setTimeout(() => el.classList.remove('meter-hit'), ms);
  }
  function shakeMental() {
    const el = $('mental'); if (!el || reduced) return;
    el.classList.remove('bar-shake'); void el.offsetWidth; el.classList.add('bar-shake');
    clearTimeout(el._shake); el._shake = setTimeout(() => el.classList.remove('bar-shake'), 120);
  }
  function kaliFlinch() {
    const host = $('magicianMini'); if (!host) return;
    host.classList.add('reacting', 'flinch'); host.dataset.face = 'event';
    sprite(host, 'assets/kali-react-sad.png');
    kaliUntil = clock + 180;
    clearTimeout(host._flinch); host._flinch = setTimeout(() => host.classList.remove('flinch'), 180);
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
      particles.push({ x: from.x, y: from.y, dx: dx0 * .9 + px * spread, dy: dy0 * .8 + py * spread, start: clock, life: life || 400, color: i % 2 ? '#E8BF68' : '#F4EFE2', size: 8, shape: i % 2 ? 'card' : 'coin', finale: true });
    }
  }
  function showFinaleNumber(dmg) {
    const fx = $('finaleFx'); if (!fx) return;
    const n = fx.querySelector('.finale-num'), aud = $('audience');
    const a = aud.getBoundingClientRect(), c = fx.getBoundingClientRect(), sc = scale || 1;
    if (a.width > 2) { n.style.left = (a.left + a.width * .5 - c.left) / sc + 'px'; n.style.top = (a.top + a.height * .4 - c.top) / sc + 'px'; }
    n.textContent = C.formatNumber(dmg);
    n.classList.remove('on'); void n.offsetWidth; n.classList.add('on');
  }
  // Full sequence at most once every 12s. Finales in between are a short glint. Game time is not paused.
  function playFinale() {
    mountRound8();
    const fx = $('finaleFx'), now = performance.now(), full = now - finaleFullAt >= 12000;
    if (full) finaleFullAt = now;
    clearTimeout(fx._end); clearTimeout(fx._burst); clearTimeout(fx._flash); clearTimeout(fx._glint);
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
    fx.classList.remove('finale-on', 'finale-full', 'finale-short', 'finale-reduced');
    void fx.offsetWidth;
    const mode = !full ? 'finale-short' : (reduced ? 'finale-reduced' : 'finale-full');
    fx.classList.add('finale-on', mode);
    const endFinale = () => {
      fx.hidden = true;
      fx.classList.remove('finale-on', 'finale-full', 'finale-short', 'finale-reduced');
      if (kali) kali.classList.remove('finale-glint');
      if (flash) { flash.getAnimations().forEach(a => a.cancel()); flash.style.opacity = '0'; }
    };
    if (mode === 'finale-full') {
      animate($('audienceCard'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)', offset: .2 }, { transform: 'translateX(4px)', offset: .5 }, { transform: 'translateX(-3px)', offset: .75 }, { transform: 'translateX(0)' }], 250);
      if (flash) {
        const anim = flash.animate([{ opacity: 0.35 }, { opacity: 0 }], { duration: 60, easing: 'linear', fill: 'forwards' });
        fx._flash = setTimeout(() => { anim.cancel(); flash.style.opacity = '0'; }, 60);
      }
      fx._burst = setTimeout(() => { if (!fx.hidden && fx.classList.contains('finale-full')) spawnFinaleBurst(400); }, 700);
      fx._end = setTimeout(endFinale, 1200);
    } else if (mode === 'finale-reduced') {
      fx._end = setTimeout(endFinale, 400);
    } else {
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
  function events(list) {
    for(const e of list.filter(e=>e.type==='batchD')){
      if(e.kind==='interference'||e.kind==='lock'||e.kind==='hide')toast(e.kind==='hide'?'🙈 케이스 내용이 잠시 가려져요':'🔒 케이스 하나가 잠시 잠겨요. 다른 케이스를 열어 주세요');
      if(e.kind==='encoreEnd')toast(e.success?'앙코르 성공! 추가 동전을 받았어요':'앙코르 종료. 기본 보상은 그대로예요');
      if(e.kind==='sideWin')showBatchDLines(D.batchD.stages[e.side].name,D.storyReview.ifRoute[D.batchD.stages[e.side].script].afterClear,()=>{if(e.side==='young')startBatchDSide('mirror');});
      if(e.kind==='sideLoss')toast('다시 준비해도 괜찮아요. 무대 지도에서 재도전해요');
      save();
    }
    for (const [id,,message] of Guidance.firstEffects(state,list)) {
      state.guidance.seen.push(id); toast(message);
      sceneLight(.04);
      save();
    }
    const recentBadges = events.recentBadges || (events.recentBadges = new Map());
    const opens = new Map();
    list.filter(e => e.type === 'boxBreak').forEach(e => {
      const key = e.openId == null ? e.cell : e.openId;
      if (!opens.has(key)) opens.set(key, []);
      opens.get(key).push(e);
    });
    for (const items of opens.values()) {
      const stack = U5.badgeStack(items), p = cellCenter(items[0].cell);
      const incoming = stack.badges.map(b => {
        const recent = recentBadges.get(b.cell);
        // Retain merge history briefly after the 350ms pill has flown away.
        if (!badges.some(old => old.cell === b.cell) && recent && recent.effect === b.effect && clock - recent.at < 400) {
          b = U5.effectBadge({ ...b, value: recent.value + b.value });
        }
        return { ...b, x: p.x, y: p.y, width: U5.badgeWidth(104), start: clock,
          image: assetImage(`assets/item-${b.itemId==='water-glass'?'chicken':b.itemId}.png`) };
      });
      badges = U5.capBadges(badges, incoming);
      for (const b of incoming) {
        const shown = badges.find(old => old.cell === b.cell);
        recentBadges.set(b.cell, { effect: b.effect, value: shown.value, at: clock });
      }
    }
    const hitMaxDoubt=state.audHpMax;
    let hitSource=list.find(e=>e.type==='skill')?.id || (list.some(e=>e.type==='dove')?'dove':'card');
    for (const e of list) {
      if(e.type==='colleague')colleagueTrick(e);
      if(e.type==='itemLand')hitSource=particleSource(e);
      if(e.type==='dove')hitSource='dove';
      if(e.type==='skill') {hitSource=e.id;const r=rectOf($('audience')),stage=rectOf($('stage'));const p={x:(r.left+r.width/2-stage.left)/scale,y:(r.top+r.height*.65-stage.top)/scale};hitParticles(p.x,p.y,e.id,'#eac568',2);if(e.id==='showtime')sceneLight(.04);}
      if (typeof tutorialSignal === 'function') {
        const signal={boxBreak:'badge',audHit:'doubt',heckle:'heckle',win:'win'}[e.type];
        if (signal) tutorialSignal(signal);
      }
      if(e.type==='tutorialLessonFail'){failure=0;failureAudience=null;failureVenue=null;clearDecorations();showFailure();save();}
      if(e.type==='caseLevelUp')haptic(15);
      if(e.type==='skill'||e.type==='visitorCatch')haptic(40);
      if(e.type==='homecomingAct'||e.type==='phase2'||(e.type==='win'&&C.isHeadliner(D.venues[e.venue-1],e.j)))haptic([30,40,30]);
      if(e.type==='outfit'){renderOutfit();banner('새 무대 의상!',['','거실 티셔츠','무대 정장','우주 망토'][e.tier]);sound('milestone');const p=target('mental');burst(p.x,p.y,'#ffe65c');$('magicianMini').classList.add('outfit-sparkle');setTimeout(()=>$('magicianMini').classList.remove('outfit-sparkle'),650);save();}
      if(e.type==='trueFanReveal'){banner('숨은 도전 발견! 열렬한 찐팬','도감에서 새로운 도전을 확인해 보세요',false,true);sound('milestone');save();}
      if(e.type==='travelResult'){save();toast(e.success?`도전 성공!${e.gems?' 실크 +'+e.gems+(state.u18.paid.length*1<=C.CHALLENGE_CAP*100?' · 마술 실력 +1%':''):''}`:'도전 종료 · 다시 도전할 수 있어요');openStageMap();}
      if(e.type==='routine')showRoutine(e.id);
      if(e.type==='futurePhase'){sound('finisher');endRoutine();if(e.phase===3)animate($('audience'),[{opacity:0},{opacity:1}],650);}
      if(e.type==='futureWin'){banner('미래의 나','다음 한 장은 네 몫이야');sound('ending');}
      if(e.type==='setBonus'){banner(e.slug==='collection'?'칼리 컬렉션 세트 완성!':'관객 세트 완성!',e.slug==='collection'?'연출 +10%':`${C.venueBySlug(e.slug).name} · 마술 실력 +3%`);sound('milestone');save();}
      if(e.type==='visitorCatch'){const r=$('eventVisitor').getBoundingClientRect(),stage=$('stage').getBoundingClientRect(),p={x:(r.left+r.width/2-stage.left)/scale,y:(r.top+r.height/2-stage.top)/scale};burst(p.x,p.y,'#ffe65c');toast(e.reward==='power'?'30초 마술 실력 ×2':e.reward==='coins'?`동전 +${C.formatNumber(e.amount)}`:'책 +1');sound('event');save();}
      if (e.type === 'stageReward') {
        sound('milestone'); showStageReward(e.reward,e.gems);
      }
      if (e.type === 'magicHit') {
        const p=cellCenter(e.cell); squash(e.cell);
        if(e.helper==='sponge')spongeImpact(e,p);
        if(e.helper==='cardthrow')impactSprite(p,'🃏','card-impact','assets/proj-card.png');
      }
      if(e.type === 'magicCoins'){const p=cellCenter(e.cell);coinStream(p.x,p.y,e.coins);}
      if(e.type === 'spotlight'){
        const beam=element('div','','spotlight-beam');beam.style.top=`${160+8+e.row*120}px`;$('stage').append(beam);setTimeout(()=>beam.remove(),600);
      }
      if(e.type === 'paperFlash'){sceneLight(.05);sound('finisher');}
      if(e.type === 'bossMirror')toast('의심의 거울 · 연쇄와 도우미가 열어 줘요');
      window.dispatchEvent(new CustomEvent('magicshow:event', { detail: e }));
      const sounds = { crit: 'crit', golden: 'golden', goldenBreak: 'golden', comboMilestone: 'milestone', encore: 'encore', boxBreak: 'box', combo: 'combo', audHit: 'hit', finisher: 'finisher', heckleTelegraph: 'heckle', fail: 'failure', win: 'coin' };
      if (sounds[e.type] && !(e.type === 'audHit' && e.blocked)) sound(sounds[e.type], { combo: e.n, auto: !pointer.held && ['boxBreak','combo','audHit'].includes(e.type) });
      if (e.type === 'heckle' && e.dmg > e.shieldDmg) sound('mental');
      if (e.type === 'itemLand' && e.effect === 'coins') sound('coin');
      if (e.type === 'finisher') { audSurprisedUntil = clock + 600; }
      if (e.type === 'crit') audSurprisedUntil = clock + 500;
      if (e.type === 'boxHit') squash(e.cell);
      if (e.type === 'boxBreak') {
        if (e.source === 'manual') kaliPose(1,400);
        squash(e.cell);
        const p = cellCenter(e.cell);
        const rarity = D.items.rarities.find(r => r.id === e.rarity);
        const color = rarity ? rarity.color : '#ffe35b';
        hitParticles(p.x,p.y,particleSource(e),color); sound('whoosh', { auto: !pointer.held });
        if (typeof breakMoment === 'function') breakMoment(p.x, p.y, color); // tests run this block in a vm without the effect helpers

        coinStream(p.x, p.y, 1);
        if (e.gem) fly(p.x, p.y, target('gems'), '🧣');
      } else if (e.type === 'unlockReveal') {
        const labels = { slot: ['새 케이스 자리!', '옆자리에서도 마술을 시작해요'], area: ['지팡이가 넓어졌어요!', '여러 케이스를 한 번에 두드려요'], dove: ['마술 비둘기 등장!', '관객에게 날아가 감탄을 더해요'], rabbit: ['마술 토끼 등장!', '주머니에서 동전을 꺼내줘요'], boxHelper: ['팬들이 일을 도와요!', '케이스를 돌아가며 두드려요'], assistant: ['마술 어시스턴트 등장!', '황금 케이스 작업도 맡겨요'], equip: ['마술용품 해금!', '소품 3개 놓기 · 같은 종류가 더 잘 나와요'] };
        banner(...(labels[e.id] || ['숨은 비법 발견!', D.tree.find(n => 'hidden:' + n.id === e.id)?.name || '새 비법을 확인하세요']), true, true); save();
      } else if (e.type === 'comboMilestone') {
        toast(`액트 ${e.threshold}! 피날레 +${e.gauge} · 동전 +${rounded(e.coins)}`);
      } else if (e.type === 'golden') {
        const p = cellCenter(e.cell); burst(p.x, p.y, '#ffe65c'); toast('황금 케이스! 희귀 이상 소품과 추가 동전');
      } else if (e.type === 'goldenBreak') {
        toast(`금빛 사례 +${C.formatNumber(e.coins)}`);
      } else if (e.type === 'achievement') {
        const info = C.achievementInfo(state, e.id);
        const pct = Math.round(((info && info.bonus) || 0) * 1000) / 10;
        toast(`🏅 ${info ? info.name : e.id} · 마술 실력 +${pct}%${e.gems?` · 실크 +${e.gems}`:''}`);
      } else if (e.type === 'encore') {
        banner('피버 타임!',`${e.duration / 1000}초 · 마술 실력 ×${(2 * (state.tree.encore ? 1 + C.nodeEffects(state).encorePower : 1)).toFixed(1)} · 자동 개봉 속도 +25%`);
      } else if (e.type === 'worker' && e.phase === 'work') {
        squash(e.cell); const host=workerActors[e.workerId];if(host)animate(host.querySelector('.asset-sprite')||host,[{transform:'translateY(0)'},{transform:'translateY(2px)'},{transform:'translateY(0)'}],140);sound('worker', { auto: true });const p=cellCenter(e.cell);float('+'+rounded(e.dmg),p.x-20,p.y,'#89d8c1',11);
      } else if (e.type === 'crit') {
        const p = cellCenter(e.cell);
        if(numbers.length>=caps.numbers)numbers.shift();float('결정타',p.x,p.y-12,'#eac568',14,2);numbers[numbers.length-1].critical=true;hitParticles(p.x,p.y,'critical','#E8BF68',2);sceneLight(.06);
      } else if (e.type === 'dove') {
        helperMotion('dove', target('damage'));
        sound('whoosh', { auto: true });
      } else if (e.type === 'rabbit') {
        fly(1174, 660, target('coins'), '🐰', '토끼', '#ffe35b');
        coinStream(1174, 660, e.coins); sound('coin');
        statFloat('coins', e.coins);
      } else if (e.type === 'flash') {
        const p = cellCenter(e.cell);
        burst(p.x, p.y, '#ffbd73');
        fly(p.x, p.y, target('damage'), '🔥', '플래시 페이퍼', '#ffbd73');
        sceneLight(.05); sound('whoosh');
      } else if (e.type === 'combo') {
        animate($('combo'), [{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], 140);
      } else if (e.type === 'audHit') {
        if (events.finaleHit && e.source !== 'colleague') { events.finaleHit = false; if (typeof showFinaleNumber === 'function') showFinaleNumber(e.dmg); }
        else if(e.source==='colleague'){if(!e.blocked)colleagueHitFx(e);}
        else hitFeedback(e,hitSource,e.presentationMaxDoubt||hitMaxDoubt);
      } else if (e.type === 'itemLand') {
        statFloat(e.effect, e.value);if(e.effect!=='damage'){const p=target(e.effect);hitParticles(p.x,p.y,hitSource,'#eac568');}
      } else if (e.type === 'finisher') {
        events.finaleHit = true; events.finaleDmg = e.dmg; if (typeof playFinale === 'function') playFinale();
      } else if (e.type === 'heckleTelegraph') {
        const v = D.venues[state.venue - 1], a = C.audienceAt(v, state.j);
        const line = U5.selectHeckle(a, venueHeckles(state.venue), lastHeckles.get(a.id));
        if(line){lastHeckles.set(a.id,line);queueAudienceLine(line,'heckle:'+state.fightMs,false,false,true);} $('heckle').textContent = line;
        audHeckleMood = D.lineFaces.moods['fight:'+a.id+':heckles:'+(a.heckles||[]).indexOf(line)]||D.lineFaces.faceMap.roleDefaults[a.role]||'doubt';
        moodSprite($('audience'),stageAudienceAsset(v,a),audHeckleMood);
      } else if (e.type === 'heckle') {
        if (e.shieldDmg > 0 && typeof popChip === 'function') { popChip($('shield'), '막음', 'block', 200); trailMeter('shield', 400); }
        if (e.dmg > e.shieldDmg && typeof popChip === 'function') {
          popChip($('mental'), '-' + C.formatNumber(e.dmg - e.shieldDmg), 'hurt', 450);
          trailMeter('mental', 450); shakeMental(); kaliFlinch();
        }
        if (state.pattern === 'stealCoins') {
          for (let i = 0; i < 5; i++) fly(1230, 90, { x: 426 + i * 25, y: 320 }, '🪙', '', '#ffbd73', i * 25);
          patternPulse('동전을 가져갔어요');
        }
        animate($('audienceCard'),[{transform:'translateX(0)'},{transform:'translateX(2px)'},{transform:'translateX(-2px)'},{transform:'translateX(0)'}],120);
      } else if (e.type === 'milestone') {
        const p=cellCenter(e.cell);milestonePop('새 경지 · 케이스 힘 ×2!',p);sound('milestone');
      } else if(e.type==='gloveDrop'){toast('🃏 칼리 덱 (자동 연습)을 얻었어요');sound('skill');

      } else if (e.type === 'autoPractice') { squash(e.cell);
      } else if (e.type === 'caseLevelUp') {
        const p = cellCenter(e.cell);
        float('LV UP!', p.x, p.y - 35, '#fff18a', e.tierChanged ? 56 : 32);
        sound(e.tierChanged ? 'caseTier' : 'caseLevel');
        if (e.tierChanged) { burst(p.x, p.y, '#fff18a'); squash(e.cell); }
      } else if (e.type === 'chain') {
        const a = cellCenter(e.from), b = cellCenter(e.to);
        // U36: at most 6 lightning lines at once (late game chains fire hundreds per second).
        if (document.querySelectorAll('.case-lightning').length < 6) {
          const line = element('div', '', 'case-lightning');
          Object.assign(line.style, {left: `${a.x}px`, top: `${a.y}px`, width: `${Math.hypot(b.x-a.x,b.y-a.y)}px`, transform: `rotate(${Math.atan2(b.y-a.y,b.x-a.x)}rad)`});
          $('stage').append(line); setTimeout(() => line.remove(), 180);
        }
      } else if (e.type === 'levelUp') {
        toast(`레벨 ${e.level}! 멘탈 회복`);
      } else if (e.type === 'win') {
        if (absorbChainWin()) break;
        prefetchWinSeen = true;
        const v = D.venues[e.venue - 1], a = C.audienceAt(v, e.j);
        const context = { ...U5.encounter(D.venues, state), venueSlug: v.slug, audId: a.id,
          encounterId: `${state.dimension}:${state.wins}:${state.fails}:${a.id}` };
        audience.restored=true;wonMoment = { v, a, context, pending:true,until:Infinity };
        presentation.push({stageTransition:true,winner:true,minimum:2500,priority:100,start:item=>{wonMoment.pending=false;wonMoment.until=clock+2500;C.holdWinTransition(state,2500);
          stageAudienceFace($('audience'),stageAudienceAsset(v,a),6);$('audienceLine').textContent=a.winLine;$('audienceLine').hidden=false;kaliPose(2,2500);
          sceneLight(.06);
          const head=C.isHeadliner(v,e.j),progress=`관객 ${e.j}/${v.audiences.length+1}`;
          bannerActive={...context};$('banner').replaceChildren(document.createTextNode(winLine()));$('banner').append(element('small',progress+' · '+(head?v.headliner.defeatLine:'동전 +'+C.formatNumber(e.coins))+(e.gems?' · 실크 +'+e.gems:'')));$('banner').classList.add('win-banner');$('banner').hidden=false;
          const moment=clearMoment(head,e.coins);
          item.end=()=>{moment.stop();dismissBanner();wonMoment=null;};
        }});
        if (e.trophy) {toast(`🏆 ${v.trophy} 획득!`, 'trophy');presentation.push({stageTransition:true,minimum:0,hold:true,priority:60,start:item=>{if(!openCurtainCall(v.slug))item.hold=false;else item.end=()=>{};}});}
        if (e.keys) toast('📕 관객 도감 완성! 책 1개');
        save();
      } else if (e.type === 'venueUnlocked') {
        if (e.name) banner(`${e.name} 도착!`, D.venues[e.venue - 1].intro, true, false, bannerContext(), true); save();
      } else if (e.type === 'fail') {
        if (absorbChainFail()) break;
        failure = e.reasonPct; failureCause = e.cause === 'damage' || e.cause === 'gate' || e.cause === 'stall' || e.cause === 'lastHeckle' ? e.cause : 'mental'; lastAudience = ''; release();
        showBoo(e); save();
      } else if (e.type === 'phase2') {
        phaseTransition();
      } else if (e.type === 'selfReconciliation') {
        openPanel('bossPhase', '나에게 보내는 박수');
        e.lines.forEach(line => $('panelBody').append(element('p',line)));
        const next=action('공연 이어가기', () => { menu=''; $('panel').hidden=true; previous=0; save(); });
        $('panelBody').append(next); next.focus();
      } else if (e.type === 'homecomingAct') {
        queueAudienceLine(e.line,'homecoming:'+e.act); patternPulse(e.line);
      } else if (['reviewApplause','jointApplause','heckleCancelled','curtainFinale'].includes(e.type)) {
        const message={reviewApplause:'좋은 한 수였어요',jointApplause:'함께 만든 박수',heckleCancelled:'질문 대신 박수',curtainFinale:'마지막 인사'}[e.type];
        patternPulse(message); toast(`👏 ${message}`); sound('milestone');
      } else if (e.type === 'ending') {
        revealEnding = state.endings.length === 1; endingStep = 0; save();
      }
    }
    if (events.finaleHit) { if (typeof showFinaleNumber === 'function') showFinaleNumber(events.finaleDmg); events.finaleHit = false; }
  }
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
  function audience() {
    if(state.mode==='transition'&&state.resolved&&state.idle.next&&!audience.restored){const v=D.venues[state.venue-1],a=C.audienceAt(v,state.j);audience.restored=true;wonMoment={v,a,context:U5.encounter(D.venues,state),until:clock+state.transMs};stageAudienceFace($('audience'),stageAudienceAsset(v,a),6);$('audienceLine').textContent=a.winLine;$('audienceLine').hidden=false;}
    if (wonMoment && (wonMoment.pending||presentation.active?.winner||clock < wonMoment.until)) return;
    wonMoment = null;
    const v = D.venues[state.venue - 1];
    const side = D.batchD.stages[state.batchD.side];
    const faced = chainFace();
    const a = faced ? {name:faced.name,emoji:faced.emoji,role:faced.role,flavor:'',bio:''} : state.u15.tutorial.active ? {name:'NDD',emoji:'🙎',flavor:D.storyV15.tutorial.bio,bio:D.storyV15.tutorial.bio} : v.audiences[state.j - 1] || v.headliner;
    const key = `${state.dimension}:${state.wins}:${state.fails}:${state.batchD.side ? state.batchD.side + ':' : ''}${state.u15.tutorial.active?'tutorial':state.audId}${state.pattern==='futureMirror'&&state.u19.phase===3?':true':''}${faced?':'+faced.name:''}${schoolBackdropOn()?':school':''}`;
    if (key !== lastAudience) {
      lastAudience = key; pendingIntro = null; resetAudienceLines();
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
      $('doubtTitle').dataset.kind = ['supporter','helper'].includes(a.role) ? '기대' : '의심';
      $('doubtTitle').textContent = portraitLayout() ? $('doubtTitle').dataset.kind : `${a.name}의 ${$('doubtTitle').dataset.kind}`;
      portraitCopy();
      $('audience').classList.remove('asset-ready','asset-pending','asset-failed');
      $('audience').replaceChildren(element('span', a.emoji, 'sprite-fallback'));
      const base = side ? side.portrait : faced ? faced.portrait : state.u15.tutorial.active ? 'assets/aud-tutorial-dogyeom.png' : audienceAsset(v,a);
      $('audience').dataset.reference = base; delete $('audience').dataset.faceBase;
      stageAudienceFace($('audience'),base,state.u15.tutorial.active&&state.u15.tutorial.won?6:audienceDoubtStage());
      $('audience').setAttribute('aria-label', side ? side.character : a.name);
      { const nextA = C.audienceAt(v, state.j + 1); if (nextA && nextA !== a) { const p = audienceAsset(v, nextA); for (const q of [p, p.replace(/\.png$/, '-happy.png')]) assetImage(q); } } // v4 U49 3: warm the next audience's pictures
      animate($('audience'),[{opacity:0},{opacity:1}],350); // U54b: fade in place; every frame stays inside the fitted stage space.
      $('audience').classList.toggle('headliner', a === v.headliner);
      $('audience').style.setProperty('--story-scale',String(a.storyScale||1));
      $('audience').dataset.storyScale=String(a.storyScale||1);
      queueAudienceLine(a.encounterLine || a.heckles?.[0] || a.preLine || a.bio || a.flavor || a.winLine,key,false,true);
      $('audienceCard').dataset.pattern = state.pattern;
      $('patternLabel').textContent = state.pattern === 'invisible' ? '보이지 않는 의심' : state.pattern === 'none' ? '' : D.ui.patterns[state.pattern];
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
      sprite($('crowd'), `assets/${v.crowdAsset}`);
      $('crowdLabel').textContent = `관객 ${v.crowd}명`;
      $('stageNumber').textContent = `${state.venue} / ${state.visited.includes('future')?D.venues.length:16}`;
      const dimension = D.dimensions[state.dimension - 1];
      $('dimensionLabel').textContent = `차원 ${state.dimension} · ${dimension ? dimension.name : '새로운 앵콜'}`;
      $('stage').style.setProperty('--dimension-hue', `${dimension ? dimension.hue : (state.dimension * 47) % 360}deg`);
      if (schoolBackdropOn()) applySchoolRoom(); else $('room').dataset.chainSchool = '';
    }
    if (audience.winExit) { audience.winExit.cancel(); audience.winExit = null; } // the slide-out held the old audience hidden; the entrance above (if any) already runs
    const during = chainDuringLine();
    if (during) queueAudienceLine(during,'school:' + during);
  }
  let kaliUntil = 0, kaliMoodState = 'normal', audMoodState = 'doubt', audSurprisedUntil = 0, audHeckleMood = '', audTestMood = ''; // v4 U50d: audTestMood only set by MagicShowUI.audienceMood (tests)
  // v4 U37 faces. Kali and the audience faces are re-evaluated from the state every frame (C.kaliMood, C.audienceMood), so nothing latches.
  // Event faces (big hit, finisher, bow) run until kaliUntil / audSurprisedUntil and then the state face returns by itself.
  function kaliFaceTick() {
    const host = $('magicianMini');
    if (menu === 'boo' || clock < kaliUntil) return;
    kaliMoodState = state.u15.tutorial.active ? 'normal' : C.kaliMood(state, kaliMoodState);
    if (host.dataset.face === kaliMoodState && host.dataset.frame === '0') return;
    host.dataset.frame = '0'; host.dataset.face = kaliMoodState;
    if (kaliMoodState === 'flustered') { host.classList.add('reacting'); sprite(host, 'assets/kali-react-surprised.png'); }
    else {
      host.classList.remove('reacting');
      if (!host.classList.contains('performance-ready')) sprite(host, 'assets/magician-idle.png');
    }
  }
  function audienceFaceTick() {
    if (audTestMood || menu === 'boo' || wonMoment) return; // v4 U50d: audTestMood = a face held by the test hook
    const tutorialBase = tutorialStageBase();
    const mark = tutorialBase && !state.u15.tutorial.active ? chainMark() : null;
    const tutorialFight = !!tutorialBase && ((state.u15.tutorial.active && state.u15.tutorial.phase === 'fight' && !state.u15.tutorial.won) || (!!mark && mark.step.endsWith('-fight')));
    if (!tutorialFight && (state.u15.tutorial.active || chainFace())) return; // lines and clear beats keep the portrait audience() already set
    const v = D.venues[state.venue - 1], a = v && C.audienceAt(v, state.j), host = $('audience');
    if (!a || !host.dataset.asset) return;
    const side = D.batchD.stages[state.batchD.side];
    stageAudienceFace(host,side ? side.portrait : tutorialBase || audienceAsset(v,a),audienceDoubtStage());
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
      el.classList.toggle('ready',ready);el.classList.toggle('in-use',k.id==='showtime'&&state.skills.showtimeLeft>0);el.style.setProperty('--cooldown',`${Math.round(left/C.skillCooldown(state,k.id)*360)}deg`);
      el.querySelector('small').textContent=!available && portraitLayout() ? '무대 해금' : ready ? (k.id==='showtime' && state.skills.showtimeLeft>0 ? `${Math.ceil(state.skills.showtimeLeft/1000)}초` : k.hint) : `${Math.ceil(left/1000)}초`;
    });
    const seconds=rateSamples.reduce((n,e)=>n+e.dt,0)/1000;
    const damage=seconds?rateSamples.reduce((n,e)=>n+e.damage,0)/seconds:0, coins=seconds?rateSamples.reduce((n,e)=>n+e.coins,0)/seconds:0;
    const eta=damage>0?state.audHp/damage:Infinity;
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
  function activateSkill(id) { if(caseArrange || paused())return;const coins=state.features.progress.coinsEarned,health=state.mental+state.shield,aud=state.audId;const maxDoubt=state.audHpMax;const list=C.useSkill(state,id);list.filter(e=>e.type==='audHit').forEach(e=>e.presentationMaxDoubt=maxDoubt);if(list.length){sampleRates(0,list,state.features.progress.coinsEarned-coins,health-state.mental-state.shield,aud);events(list);sound('skill');kaliPose(2,500);save();render();} }
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
    button.innerHTML=`<span class="skill-art">${k.emoji}</span><span>${k.name}</span><small>${k.hint}</small>`;
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
    const path=`assets/routine-${id}.png`,image=assetImage(path),host=$('magicianMini'),marker=$('routineCutin');
    const play=()=>{if(marker.hidden||marker.dataset.routine!==id||!image.naturalWidth)return;host.style.setProperty('--routine-art',`url('${assetUrl(path)}')`);host.classList.remove('routine-art');void host.offsetWidth;host.classList.add('routine-art');};
    marker.dataset.routine=id;marker.hidden=false;routineUntil=clock+1600;
    if(image.complete)play();else image.addEventListener('load',play,{once:true});
    return true;
  }
  function endRoutine(){const marker=$('routineCutin');marker.hidden=true;delete marker.dataset.routine;$('magicianMini').classList.remove('routine-art');}
  function renderU19(){
    const future=C.bossProfile(state)==='future',u=state.u19;
    const warning=$('futureTelegraph');warning.hidden=!future||u.telegraph<=0;warning.textContent=u.phase===1?'네 쇼타임을 따라 할게.\n끝난 뒤에 나를 노려 봐.':['','','완벽한 루틴\n빛나는 칸을 계속 눌러 줘.','이게 진짜 미래의 나야.\n20초 동안 빛나는 칸만!'][u.phase];
    $('magicianMini').classList.toggle('future-suit',state.u18.equipped.kali==='future');
    if((menu||state.u15.scene)&&!$('routineCutin').hidden)endRoutine();
    if(u.pending.length&&$('routineCutin').hidden&&showRoutine(u.pending[0]))u.pending.shift();
    document.querySelectorAll('#board .cell').forEach((el,i)=>el.classList.toggle('future-target',future&&u.phase>=2&&i===u.target&&(u.phase===2||u.window>0)));
  }
  // U36: state flags that style.css used to read through :has() selectors on #stage, #audienceCard and #activeSkills (see the U36 note in style.css).
  // v4 U53 2 (owner: "관객의 이름이 제대로 나오지 않아"): the audience name on the doubt plate is never cut. The plate is measured only when its texts'
  // lengths or the viewport change: if title, regen and number do not fit on one line, the regen ("회복 N/초", also in 능력치) is left out; if the
  // title and the number still do not fit (narrow phones), the title takes two lines in the 9 px pixel font inside the same 22 px plate.
  function fitDoubtPlate(key){
    if(portraitLayout()){
      const plate=document.querySelector('.doubt-plate');if(!plate)return;
      fitDoubtPlate.key=key;fitDoubtPlate.short=false;
      plate.classList.remove('plate-noregen','plate-2l');
      num($('doubtNumber'),`${rounded(state.audHp)}/${rounded(state.audHpMax)}`,true);return;
    }
    if(fitDoubtPlate.key===key)return;fitDoubtPlate.key=key;
    const plate=document.querySelector('.doubt-plate');if(!plate)return;
    plate.classList.remove('plate-noregen','plate-2l');fitDoubtPlate.short=false;num($('doubtNumber'),`${rounded(state.audHp)}/${rounded(state.audHpMax)}`,true);
    const title=$('doubtTitle'),over=()=>plate.scrollWidth>plate.clientWidth||title.scrollWidth>title.clientWidth||plate.scrollHeight>plate.clientHeight+1;
    if(over())plate.classList.add('plate-noregen');
    if(over())plate.classList.add('plate-2l');
    // the narrowest plates (678 x 416 with 62 px insets: 120 px): the number shows the current doubt only (the full meter beside it shows the share)
    if(over()){fitDoubtPlate.short=true;num($('doubtNumber'),rounded(state.audHp),true);}
  }
  function syncFlags() {
    const stage = $('stage'), card = $('audienceCard'), skills = $('activeSkills'), coach = $('tutorialCoach');
    const story = !$('storyDialog').hidden, coachShown = !coach.hidden, statsx = !!card.querySelector('.stats.phone-expanded');
    stage.classList.toggle('f-story', story);
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
        const origin=stage.getBoundingClientRect(),venue=$('phoneVenue').querySelector('.venue-heading').getBoundingClientRect(),wallet=$('phoneWallet').getBoundingClientRect();
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
  const DRESS_FROM = [3, 7, 10]; let dressTier = -1;
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
    $('rebirthButton').hidden = !state.seenEnding || state.homecomingCleared&&!state.u19.cleared;
    pxText($('rebirthButton'),phone ? (state.homecomingCleared ? '✨ 환생' : '✨ 이어서') : (state.homecomingCleared?'다음 차원의 공연':'이어지는 공연'));
    if (state.pattern === 'heal' && state.mode === 'fight') $('audienceCard').classList.toggle('healing', state.patternHealMs > C.CONST.patternHealEvery - 600);
    else $('audienceCard').classList.remove('healing');
    num($('doubtNumber'), fitDoubtPlate.short ? rounded(state.audHp) : `${rounded(state.audHp)}/${rounded(state.audHpMax)}`, true); // v4 U53 2: only the current doubt on the narrowest plates
    $('doubtFill').style.width = `${Math.round(state.audHp / state.audHpMax * 500) / 5}%`;
    {
      // v4 U38: heckle strength per second, doubt regrowth per second (only when there is any) and the player's own matching numbers.
      const th=C.threatInfo(state),heckleText=th.last?`마지막 한 번 ${rounded(th.hit)}`:`한 번에 ${rounded(th.hit)}`,everyText=th.last?'':`${+th.every.toFixed(1)}초마다`,regenText=th.regen>0?`회복 ${rounded(th.regen)}/초`:'';
      const attackText=portraitLayout()?(th.last?`마지막 ${rounded(th.hit)}`:rounded(th.hit)):heckleText;
      if($('attackNumber').textContent!==attackText)$('attackNumber').textContent=attackText;
      if($('doubtRegen').textContent!==regenText)$('doubtRegen').textContent=regenText;
      fitDoubtPlate(`${$('doubtTitle').textContent}|${regenText.length}|${(rounded(state.audHp)+'/'+rounded(state.audHpMax)).length}|${innerWidth}x${innerHeight}|${phone}`);
      const mine=C.attackRate(state),mineText=mine==null?'0/초':`${rounded(mine)}/초`;
      if($('stat-rate').textContent!==mineText)$('stat-rate').textContent=mineText;
      if($('stageRateNumber').textContent!==mineText)$('stageRateNumber').textContent=mineText;
      if($('stat-heckle').textContent!==heckleText)$('stat-heckle').textContent=heckleText;
      if($('stat-heckle-every')&&$('stat-heckle-every').textContent!==everyText)$('stat-heckle-every').textContent=everyText; // v4 U47 1: the interval is the small second line
      const challengeText=`+${Math.round(C.challengeBonus(state)*100)}%`;if($('stat-challenge')&&$('stat-challenge').textContent!==challengeText)$('stat-challenge').textContent=challengeText; // v4 U46 C1
    }
    $('countdown').textContent = `${Math.max(0, state.heckleMs / 1000).toFixed(1)}초`;
    {
      const card = $('audienceCard'), on = state.mode === 'fight' && state.heckleMs <= C.CONST.telegraphMs;
      if (on !== card.classList.contains('telegraph')) { card.classList.toggle('telegraph', on); if (on) placeHeckleBang(); }
      card.classList.toggle('mental-low', state.mode === 'fight' && !state.resolved && state.mentalMax > 0 && state.mental / state.mentalMax < .3);
    }
    const meter=$('heckleMeter'),progress=Math.max(0,Math.min(100,(1-state.heckleMs/Math.max(400,state.interval*1000))*100));
    const heckleFill=$('heckleFill');
    if(heckleFill){heckleFill.style.width=progress+'%';heckleFill.style.setProperty('--meter',progress+'%');}
    if(meter){meter.setAttribute('aria-valuenow',String(Math.round(progress)));meter.classList.toggle('imminent',state.mode==='fight'&&!state.resolved&&state.heckleMs<=600);}
    syncMotionLoops();
    num($('stat-power'), rounded(C.wandDamage(state)));
    num($('stat-damage'), rounded(C.CONST.itemDamage * state._V));
    num($('stat-guard'), rounded(C.CONST.itemShield * state._U));
    num($('stat-heal'), rounded(C.CONST.itemHeal * state._U));
    num($('bestCombo'), state.maxCombo, true);
    num($('comboNumber'), portraitLayout() ? rounded(state.combo) : state.combo, true);
    const finaleNeed = Math.max(1, C.nodeEffects(state).finaleNeed);
    const finalePercent = `${Math.min(100, state.finisher / finaleNeed * 100)}%`;
    const finisherFill = $('finisherFill');
    if (finisherFill) {
      const band = phone && portraitLayout();
      finisherFill.style.height = phone ? '100%' : finalePercent;
      finisherFill.style.width = phone ? finalePercent : '';
      // Portrait: keep the fill inside the 8px track. An absolute fill with right:0 escapes a static parent and covers the band.
      finisherFill.style.right = band ? 'auto' : '';
      finisherFill.style.bottom = band ? 'auto' : '';
      finisherFill.style.top = band ? '0' : '';
    }
    if (portraitLayout() && $('finaleNumber')) {
      const finaleText = `${rounded(state.finisher)}/${finaleNeed}`;
      if ($('finaleNumber').textContent !== finaleText) $('finaleNumber').textContent = finaleText;
    }
    if (portraitLayout() && $('finaleStat')) $('finaleStat').style.setProperty('--meter', finalePercent);
    // Every layout has a separate mental label; the meter retains the maximum in its accessible text.
    pxText($('mentalNumber'), rounded(state.mental));
    {
      const mentalMax = Math.max(1, state.mentalMax || 1);
      $('mental').style.setProperty('--meter', `${Math.max(0, Math.min(100, state.mental / mentalMax * 100))}%`);
      const mentalBar = $('mental').querySelector('.meter-bar');
      if (mentalBar) {
        mentalBar.setAttribute('aria-valuenow', String(Math.round(Math.max(0, Math.min(100, state.mental / mentalMax * 100)))));
        mentalBar.setAttribute('aria-valuetext', `멘탈 ${rounded(state.mental)} / ${rounded(state.mentalMax)}`);
      }
      $('shield').style.setProperty('--meter', `${Math.max(0, Math.min(100, state.shield / mentalMax * 100))}%`);
      const actCap = Math.max(state.maxCombo || 0, state.combo || 0, 1);
      $('combo').style.setProperty('--meter', `${state.combo > 0 ? Math.max(8, Math.min(100, state.combo / actCap * 100)) : 0}%`);
      const atk = C.attackRate(state);
      $('stageRate').style.setProperty('--meter', `${atk > 0 ? Math.max(12, Math.min(100, Math.log10(atk + 1) / 6 * 100)) : 0}%`);
    }
    (heartEls||(heartEls=[...$('hearts').querySelectorAll('.heart')])).forEach((el, i) => el.classList.toggle('empty', i >= Math.ceil(state.mental / state.mentalMax * 5)));
    num($('shieldNumber'), rounded(state.shield));
    num($('levelNumber'), state.level);
    const xpNeed = C.xpNeed(state);
    num($('xpNumber'), `${rounded(state.xp)}/${C.formatNumber(xpNeed)}`, true);
    $('xpFill').style.width = `${Math.min(100, state.xp / xpNeed * 100)}%`;
    for (const id of ['coins','gems','keys']) num($(id), rounded(state[id]), true);
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
      num(dom.num, pct, true);
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
    updateWand(); modeHooks(); renderBatchD(); updateAudienceLine(); syncFlags();
  }
  function wandRect(point = pointer) {
    const a = C.wandArea(state), k = C.CONST;
    const pitch = k.cellSize + k.cellGap;
    const width = a.cols * pitch - k.cellGap, height = a.rows * pitch - k.cellGap;
    // U36: the wand box snaps to the case grid. It used to follow the finger freely, so the drawn box could cover most of a case whose
    // center lay a few pixels outside it (a 2x1 wand then drew over two cases and hit one). The drawn box, the hit set and the idle
    // path in core (tickPractice) now all use the same whole-cell block.
    const col = Math.max(0, Math.min(5 - a.cols, Math.round((point.x - k.boardInset - width / 2) / pitch)));
    const row = Math.max(0, Math.min(5 - a.rows, Math.round((point.y - k.boardInset - height / 2) / pitch)));
    return { x: k.boardInset + col * pitch, y: k.boardInset + row * pitch, width, height, col, row, cols: a.cols, rows: a.rows };
  }
  function coveredCells(point = pointer) {
    if (point.x < 0 || point.y < 0 || point.x > C.CONST.boardSize || point.y > C.CONST.boardSize || point.inside === false) return [];
    const r = wandRect(point), l = C.boardLayout(state), found = [];
    for (let i = 0; i < l.capacity; i++) {
      const p = C.cellPosition(state, i);
      if (p.col >= r.col && p.col < r.col + r.cols && p.row >= r.row && p.row < r.row + r.rows) found.push(i);
    }
    return found;
  }
  function updateWand() {
    $('wand').classList.toggle('visible', pointer.inside && !menu && !portrait());
    if (!pointer.inside) return;
    const r = wandRect();
    let ratio = boardWidth() / C.CONST.boardSize;
    // Portrait: #board used to be centred with translateX(-50%). offsetLeft ignores that transform, so the green
    // square was drawn half a board to the right of the finger. Place the wand from the visual rect instead
    // (the same rect boardTransform uses for hits) and do not use a CSS translate on the board.
    if (portraitLayout()) {
      let base = wandOffset;
      if (!base || base.portrait !== true) {
        const board = $('board').getBoundingClientRect(), card = $('boardCard').getBoundingClientRect();
        base = wandOffset = {
          portrait: true,
          x: (board.left - card.left) / scale, y: (board.top - card.top) / scale,
          ratioX: board.width / scale / C.CONST.boardSize, ratioY: board.height / scale / C.CONST.boardSize
        };
      }
      ratio = base.ratioX;
      const wand = $('wand');
      wand.style.left = `${base.x + r.x * base.ratioX}px`; wand.style.top = `${base.y + r.y * base.ratioY}px`;
      wand.style.width = `${r.width * base.ratioX}px`; wand.style.height = `${r.height * base.ratioY}px`;
      wand.style.transform = 'none';
    } else {
    if ($('wand').style.left) { $('wand').style.left = ''; $('wand').style.top = ''; }
    $('wand').style.width = `${r.width * ratio}px`; $('wand').style.height = `${r.height * ratio}px`;
    // U36: since the skill column moved into #boardCard (U30c) the board sits 60 px right of and 27 px below the wand's own origin on phones,
    // so the drawn box was shifted by about half a case against the cells it hit. The board's offset inside the card is added here.
    // v4 U40: the offset only changes with the layout, so it is kept until fit() clears it (it used to be re-read every frame, forcing a layout after the frame's DOM writes).
    let off = wandOffset;
    if (!off || off.portrait) { const board = $('board'); off = { x: board.offsetLeft + board.clientLeft + (parseFloat(board.style?.getPropertyValue('--grid-shift-x')) || 0) - $('wand').offsetLeft, y: board.offsetTop + board.clientTop + (parseFloat(board.style?.getPropertyValue('--grid-shift-y')) || 0) - $('wand').offsetTop }; wandOffset = off; }
    $('wand').style.transform = `translate(${off.x + r.x * ratio}px,${off.y + r.y * ratio}px)`;
    }
    if(phone){
      const target=coveredCells().find(i=>i<state.board.length),icon=$('wandIcon');
      icon.hidden=target===undefined;
      if(target!==undefined){
        const k=C.CONST,pos=C.cellPosition(state,target),pitch=k.cellSize+k.cellGap;
        icon.style.left=`${(k.boardInset+pos.col*pitch-r.x+k.cellSize)*ratio-22}px`;
        icon.style.top=`${(k.boardInset+pos.row*pitch-r.y)*ratio+14}px`;
        icon.style.right='auto';
      }
    }else{$('wandIcon').hidden=false;for(const key of ['left','top','right'])$('wandIcon').style[key]='';}

  }
  function locate(e) {
    const p = boardTransform().toBoard(e.clientX, e.clientY);
    if (typeof portraitLayout === 'function' && portraitLayout()) { const hit = portraitBoardPoint(e.clientX, e.clientY); if (hit) { p.x = hit.x; p.y = hit.y; } }
    pointer.x = p.x; pointer.y = p.y;
    pointer.inside = p.x >= 0 && p.x <= C.CONST.boardSize && p.y >= 0 && p.y <= C.CONST.boardSize;
    updateWand();
  }
  // New presses share one rolling budget; hold pulses keep their per-pointer cadence.
  const tapMarks = new Map();
  const holdMarks = tapMarks;
  const pressMarks = [];
  function countTap(id, kind = 'hold') {
    const now = performance.now();
    let marks = pressMarks;
    if (kind === 'hold') {
      marks = holdMarks.get(id);
      if (!marks) { marks = []; holdMarks.set(id, marks); }
    }
    let i = 0;
    while (i < marks.length && now - marks[i] >= 1000) i++;
    if (i) marks.splice(0, i);
    if (marks.length >= 12) return false;
    marks.push(now);
    return true;
  }
  function pressCells(taps, kind) {
    const scale = kind === 'tap' ? .92 : .96;
    const ms = kind === 'tap' ? 40 : 80;
    for (const i of taps) {
      const el = cells[i] && cells[i].box;
      if (!el) continue;
      animate(el, [{ transform: `scale(${scale})` }, { transform: `scale(${scale})`, offset: .45 }, { transform: 'scale(1)' }], ms);
    }
  }
  function pulseFreePractice() {
    // TODO core auto practice
    if ((typeof caseArrange !== 'undefined' && caseArrange) || paused() || state.mode !== 'fight' || (state.u15 && state.u15.gloveLeft > 0)) return;
    const taps = [];
    for (let i = 0; i < state.board.length; i++) taps.push(i);
    if (!taps.length || !countTap('practice', 'hold')) return;
    stepCombat(.001,{taps:[],holding:true});
    if (paused() || state.mode !== 'fight') return;
    sound('tap'); stepCombat(.001,{taps,holding:true,pulse:'hold'});
    pressCells(taps, 'hold');
  }
  function pulse(point = pointer, kind = 'hold') {
    if ((typeof caseArrange !== 'undefined' && caseArrange) || paused() || state.mode !== 'fight') return;
    stepCombat(.001,{taps:[],holding:true});
    if (paused() || state.mode !== 'fight') return;
    const taps = coveredCells(point);
    if (!taps.length || !countTap(point.id, kind)) return;
    sound('tap'); stepCombat(.001,{taps,holding:true,pulse:kind});
    pressCells(taps, kind);
  }
  function syncPointer() {
    const p = boardHolds[0]; pointer.held = !!p; pointer.id = p ? p.id : null;
    if (p) { pointer.x=p.x; pointer.y=p.y; pointer.inside=p.x>=0&&p.y>=0&&p.x<=608&&p.y<=608; }
    updateWand();
  }
  function release() {
    const arranging = arrangePress; arrangePress = null;
    if (arranging && $('board').hasPointerCapture(arranging.id)) $('board').releasePointerCapture(arranging.id);
    const old = boardHolds; boardHolds = []; holdMarks.clear(); syncPointer();
    for (const p of old) if ($('board').hasPointerCapture(p.id)) $('board').releasePointerCapture(p.id);
    if (!caseArrange && old.length && !document.hidden && !menu && !portrait()) events(C.step(state,.001,{taps:[]}));
  }
  // Arrangement uses the existing saved permutation, never the combat hold path.
  function arrangeSlot(e) {
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('#board .cell');
    const index = cells.findIndex(c => c.el === hit);
    return index < 0 ? null : state.u15.positions[index];
  }
  function arrangeSelect(slot) {
    if (slot === null) return;
    const index = state.u15.positions.indexOf(slot);
    if (arrangeFrom === null) {
      if (index < state.board.length) arrangeFrom = index;
    } else {
      if (C.moveCase(state, arrangeFrom, slot)) { save(); geo.clear(); }
      arrangeFrom = null;
    }
    render();
  }
  $('board').addEventListener('click', e => { if (caseArrange) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  for (const id of ['caseArrangeButton','caseArrangeMenuButton']) $(id).addEventListener('click', () => {
    release(); arrangeFrom = null; arrangePress = null; caseArrange = !caseArrange;
    for (const id of ['caseArrangeButton','caseArrangeMenuButton']) $(id).setAttribute('aria-pressed', String(caseArrange));
    $('board').classList.toggle('arranging', caseArrange);
    hideMore(); render();
  });
  $('board').addEventListener('pointerdown', e => {
    if (paused() || state.mode !== 'fight' || (e.pointerType === 'mouse' && e.button !== 0) || boardHolds.length >= 3) return;
    if (caseArrange) {
      e.preventDefault(); arrangePress = {id:e.pointerId, slot:arrangeSlot(e)};
      $('board').setPointerCapture(e.pointerId); return;
    }
    // Let the next locked slot receive its click without board pointer capture.
    if (e.target.closest('.cell.next-slot')) return;
    e.preventDefault(); const p = boardTransform().toBoard(e.clientX,e.clientY);
    if (typeof portraitLayout === 'function' && portraitLayout()) { const hit = portraitBoardPoint(e.clientX, e.clientY); if (hit) { p.x = hit.x; p.y = hit.y; } }
    if (p.x<0||p.y<0||p.x>608||p.y>608) return;
    boardHolds = C.holdPointers(boardHolds,{type:'down',id:e.pointerId,...p});
    $('board').setPointerCapture(e.pointerId); syncPointer();
    const initial = C.advanceHolds(boardHolds,0,C.wandRate(state)); boardHolds=initial.holds;
    for (const point of initial.pulses) pulse(point, 'tap');
    tutorialSignal('hold'); render();
    window.dispatchEvent(new CustomEvent('magicshow:gesture'));
  });
  $('board').addEventListener('pointermove', e => {
    if (caseArrange) return;
    if (boardHolds.some(p=>p.id===e.pointerId)) {
      const p=boardTransform().toBoard(e.clientX,e.clientY);
      if (typeof portraitLayout === 'function' && portraitLayout()) { const hit = portraitBoardPoint(e.clientX, e.clientY); if (hit) { p.x = hit.x; p.y = hit.y; } }
      boardHolds=C.holdPointers(boardHolds,{type:'move',id:e.pointerId,...p}); syncPointer();
    } else if (e.pointerType==='mouse' && !boardHolds.length) locate(e);
  });
  $('board').addEventListener('pointerleave', () => {
    if (!pointer.held) { pointer.inside=false; updateWand(); }
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) $('board').addEventListener(name,e=> {
    if (caseArrange && arrangePress?.id === e.pointerId) {
      const press = arrangePress; arrangePress = null;
      if (name === 'pointerup' && !paused() && state.mode === 'fight') {
        const slot = arrangeSlot(e);
        if (slot !== null && slot !== press.slot) {
          const from = state.u15.positions.indexOf(press.slot);
          if (from >= 0 && from < state.board.length) { arrangeFrom = from; arrangeSelect(slot); }
        } else if (slot !== null) arrangeSelect(slot);
      }
    }
    boardHolds=C.holdPointers(boardHolds,{type:'up',id:e.pointerId}); holdMarks.delete(e.pointerId); syncPointer();
    if (!boardHolds.length && e.pointerType!=='mouse') { pointer.inside=false; updateWand(); }
  });
  window.addEventListener('blur', release);
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());

  function openPanel(kind, title) {
    if(menu==='curtain'&&kind!=='curtain'){curtainFinish=null;clearTimeout(curtainTimer);curtainScene?.remove();curtainScene=null;presentation.finish();}
    // v4 U51 1: one top layer. A panel opened while the menu sheet is open (from inside the menu or from the top bar 도감) replaces the menu: the menu
    // closes here and the panel's 닫기/뒤로 brings the menu back (the U48 M pattern), so the menu never stays drawn over (or under) a panel.
    if (!$('phoneMore').hidden) { $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false'); moreReturn = true; }
    menu = kind; previous = 0; clearDecorations();
    focusBeforePanel = document.activeElement;
    $('panel').dataset.screen = kind; delete $('panel').dataset.practice; $('panelBody').style.gridAutoRows = ''; // v4 U47 13: the stats grid sets its own row height
    $('panel').classList.remove('climax-dialogue');
    $('panel').querySelector('header').querySelectorAll('.tree-wallet,.constellation-controls,.tree-learning,.practice-go,.tree-more,.shop-balance').forEach(el=>el.remove());
    $('closePanel').textContent = '닫기'; $('closePanel').removeAttribute('aria-label'); // v4 U51 2: the curtain call relabels it 건너뛰기
    $('panelTitle').textContent = title;
    $('panelBody').replaceChildren(); $('panelBody').scrollTop = 0; $('panel').hidden = false;
    $('closePanel').hidden = kind === 'fail'; $('closePanel').disabled = false;
    // Reset the Core hold before pausing so the next gesture starts immediately.
    state.holding=false; state.tapAcc=0;
    $('closePanel').hidden = ['boo','fail','ending','rebirth','bossPhase'].includes(kind);
    $('closePanel').focus(); updateWand(); nextToasts();
  }
  function closePanel() {
    if(menu==='batchD'){resolveBatchDPanel();return;}
    if(menu==='batchDReplay'){finishBatchDReplay();return;}
    if(menu==='curtain'&&curtainFinish){curtainFinish();return;} // v4 U51 2: the header 건너뛰기 of the curtain call ends it like the old in-scene 건너뛰기
    if(menu==='curtain'){clearTimeout(curtainTimer);curtainScene?.remove();curtainScene=null;presentation.finish();}
    if (['boo','fail','ending','rebirth','bossPhase'].includes(menu) || (menu === 'dealer' && dealerBusy)) return;
    clearTimeout(dialogueTimer); leavePending = false; // v4 U47 6: closing the save-slot panel without saving cancels the leave question
    if (menu === 'dealer' && state.mode === 'dealer') {
      for (let i = 0; i < 2 && state.mode === 'dealer'; i++) C.dealerClose(state);
      save();
    }
    if(state.u18.map){C.returnToStage(state);save();}
    if (['book','dealer'].includes(menu) && failure !== null) { showFailure(); return; }
    menu = ''; $('panel').hidden = true; previous = 0;
    if (focusBeforePanel && focusBeforePanel.isConnected) focusBeforePanel.focus();
    if (moreReturn) { moreReturn = false; showMore(); } // v4 U48 M: a panel opened from the menu goes back to the menu, not to the show
    render();
  }
  function clearDecorations() {
    flights.length=0;particles.length=0;numbers.length=0;badges.length=0;
    $('stage').classList.add('decorations-paused');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    document.querySelectorAll('.projectile-impact,.helper-actor').forEach(n=>{n.hidden=true;for(const animation of n.getAnimations?.()||[])animation.cancel();});
    if($('magicLayer'))$('magicLayer').hidden=true;
  }
  function showBoo(e) {
    failureAudience=e.audId;failureVenue=e.venue;menu='boo';previous=0;release();clearDecorations();
    const v=D.venues[e.venue-1],a=C.roster(v).find(a=>a.id===e.audId);
    if(a)sprite($('audience'),tutorialStageBase()||audienceAsset(v,a));
    $('audienceCard').classList.add('boo-scene');
    $('heckle').textContent='우우! '+(a?.lines?.heckles?.[0]||a?.heckles?.[0]||'다음에는 더 잘해 봐!');
    $('heckle').classList.add('visible');$('magicianMini').classList.add('disappointed','reacting');$('magicianMini').dataset.face='boo';sprite($('magicianMini'),'assets/kali-react-sad.png');
    clearTimeout(booTimer);booTimer=setTimeout(()=>{$('audienceCard').classList.remove('boo-scene');$('heckle').classList.remove('visible');$('magicianMini').classList.remove('disappointed','reacting');$('magicianMini').dataset.face='';kaliMoodState='normal';audMoodState='doubt';sprite($('magicianMini'),'assets/magician-idle.png');menu='';showFailure();},1500);
  }
  function practiceGoLabel() {
    const name = D.venues[state.venue - 1]?.name || '', code = name ? name.charCodeAt(name.length - 1) : 0;
    if (code < 0xAC00 || code > 0xD7A3) return D.ui.practiceFallback;
    const final = (code - 0xAC00) % 28;
    return `${name}${final === 0 || final === 8 ? '로' : '으로'} 가기`;
  }
  function restartAfterFailure() {
    C.restartRun(state);state.u15.queue=[];state.u15.scene=null;state.idle.waiting=false;delete state.idle.next; failure = null; menu = ''; $('panel').hidden = true;
    previous = 0; flights.length = 0; particles.length = 0; numbers.length = 0; badges.length = 0; events.recentBadges?.clear(); wonMoment = null;
    save(); render(); $('bookButton').focus();
  }
  // v4 U44: the player taps the product row of the fail panel; this is the only place that buys from it.
  function learnFailureProduct(id) { if (C.buyNode(state, id)) { save(); sound('skill'); showFailure(); } }
  function showFailure() {
    if(newTutorialLesson()&&state.u15.bios.includes('lesson:failed')&&!state.u15.bios.includes('lesson:bought')){
      openPanel('fail','실패 연습 완료');
      for(const line of D.storyReview.tutorialLesson.fail)$('panelBody').append(element('p',line.text));
      const go=action('비법 하나 배우러 가기',()=>{setChain('upgrade-play',0);const node=ensureUpgradeNode();tree();if(node)focusNode(node.id);chainFocused=true;save();});
      $('panelBody').append(go);go.focus();return;
    }
    openPanel('fail', '공연 종료');
    const result = document.createElement('div'); result.className = 'result';
    const title = document.createElement('h2'); title.textContent = randomLine(D.pools.fail);
    const reason = document.createElement('p'); reason.textContent = D.pools.failReason.replace('{pct}', String(failure));
    const button = action(D.ui.restart, () => { tree(); });
    button.classList.add('practice-enter');
    const advice = Guidance.failure(state,D,C,failureCause);
    practiceRec = advice.node ? advice.node.id : null;
    // U32: the audience that heckled and Kali's sad face replace the lone hat icon when art exists.
    const scene = element('div', '', 'fail-scene');
    const fv = D.venues[(failureVenue || state.venue) - 1], fa = fv && C.roster(fv).find(x => x && x.id === failureAudience);
    if (fa) { const face = element('span', '', 'fail-face'); sprite(face, audienceAsset(fv, fa)); scene.append(face); }
    const sad = element('span', '', 'fail-kali'); sprite(sad, 'assets/kali-react-sad.png'); scene.append(sad);
    result.append(scene, title, reason, element('p',advice.line,'fail-cause'));
    if(advice.hint)result.append(element('p',advice.hint,'fail-hint'));
    // v4 U44: the 칼리 product of this venue is one option among the others (a quiet row, the player decides).
    const product=C.failureProduct(state);
    if(product){
      const pinfo=C.nodeInfo(state,product.id),prow=element('div','','practice-gate fail-product');
      prow.append(element('span',`${product.name} · 연출 ×${product.productMultiplier} · 동전 ${rounded(pinfo.cost)}`),action(pinfo.purchasable?'배우기':`동전 ${rounded(Math.ceil(pinfo.cost-state.coins))} 더`,()=>learnFailureProduct(product.id),!pinfo.purchasable));
      result.append(prow);
    }
    if(C.failureDealerAvailable(state))result.append(action('샵 매니저와 한 판 하고 다시 도전',()=>{if(C.openFailureDealer(state)){save();menu='';dealer();}}));
    const stageGo = action(practiceGoLabel(), restartAfterFailure); stageGo.classList.add('fail-stage');
    const row = element('div', '', 'fail-actions'); row.append(button, stageGo);
    result.append(row); $('panelBody').append(result); button.focus();
  }
  function tutorialSignal(id) {
    if (C.tutorialAction(state,id)) { save(); renderCoach(); }
  }
  function updateLearningBadge() {
    if (updateLearningBadge.at && clock-updateLearningBadge.at<250) return;
    updateLearningBadge.at=clock;
    const count=C.affordableNodes(state).length;
    const unseen = D.tree.some(n => !n.shopOnly && n.id !== 'autoLearn' && C.nodeInfo(state, n.id).revealed && !treeView.revealed.has(n.id));
    $('bookButton').classList.toggle('is-new', unseen);
    $('bookButton').dataset.affordable=String(count);
    $('bookButton').setAttribute('aria-label',`비법 · 지금 배울 수 있는 비법 ${count}개${unseen ? ' · 새 비법 있음' : ''}`);
  }
  function startIntro(replay = true) {
    if(!replay && !state.u15.tutorial.done){
      $('introStory').hidden=true;
      if(state.u15.tutorial.active){C.resumeTutorial(state);renderU15();save();return;}
      if(!chainMark()){setChain('girl-intro',0);state.onboarding.step=0;state.onboarding.facts=[];}
      state.onboarding.intro=true;render();save();return;
    }

    if (replay) { state.onboarding={intro:false,panel:0,step:0,facts:[]}; closePanel(); }
    release(); $('phoneMore').hidden=true; $('moreButton').setAttribute('aria-expanded','false');
    const host=$('introStory'); host.hidden=false; host.replaceChildren();
    const panel=D.onboarding.intro[state.onboarding.panel];
    const art={living:'venue-01-family.png',cards:'venue-01-family.png',cosmos:'venue-13-multiverse.png'}[panel.art];
    const backdrop=element('img','','intro-backdrop'); backdrop.src=`assets/${art}`; backdrop.alt='';
    const kali=element('div','','intro-kali'); kali.dataset.frame=String(state.onboarding.panel===4?2:state.onboarding.panel===2?1:0);
    const dad=element('img','','intro-dad'); dad.src='assets/aud-a1.png'; dad.alt=''; dad.hidden=panel.art!=='living';
    const advance=()=> {
      if (state.onboarding.panel<D.onboarding.intro.length-1) { state.onboarding.panel++; save(); startIntro(false); }
      else finish();
    };
    const finish=()=> { state.onboarding.intro=true; host.hidden=true; previous=0; save(); renderCoach(); };
    // v4 U51b 6: every page, the last one too, has the same 다음 (the last 다음 starts the game as 마술 시작하기 did); one step per press (shared gate)
    const step=()=>{if(lineStep())advance();};
    const next=action(`${state.onboarding.panel+1} / ${D.onboarding.intro.length} · 다음`,step);
    next.classList.add('intro-next');
    const line=element('p',panel.line,'intro-line');
    const skip=action(D.onboarding.skip,finish); skip.classList.add('intro-skip');
    host.append(backdrop,kali,dad,line,skip,next); // v4 U51 2: DOM (Tab) order = visual order (건너뛰기 top right, then 다음 bottom right)
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
      if(newTutorialLesson())return state.u15.bios.includes('lesson:bought')?D.storyReview.tutorialLesson.retry[0]:D.storyReview.tutorialLesson.before[0];
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
    const ids=['#board .cell:not(.locked)','#board .cell:not(.locked)','#doubtFill','#mental','','','',''];
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
    host.style.width=`${phone?Math.min(250,r.width*.42-16):340}px`;
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
    const protectedRects=[node,$('magicianMini'),$('audience'),$('mental'),$('statsButton'),document.querySelector('.doubt'),document.querySelector('.shield'),document.querySelector('.combo'),$('audienceLine')].filter(el=>el&&!el.hidden&&getComputedStyle(el).visibility!=='hidden').map(el=>el.getBoundingClientRect());
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
  function tree(focusMap = false) {
    const practice = typeof failure !== 'undefined' && failure !== null;
    const opening = menu !== 'book';
    if (opening) openPanel('book', practice ? D.ui.practiceTitle : D.ui.bookTitle);
    if (practice) $('panel').dataset.practice = '1'; else delete $('panel').dataset.practice;
    const body = $('panelBody'); body.replaceChildren();
    if(state.batchD.twist.trace)body.append(element('p','📖 트레이스 · 흔들리지 않는 마음: 숨겨진 마술 피해 90% 감소, 멘탈은 최소 1 남아요.','batch-d-note'));
    // v4 U47 10: no learn-all and no auto-learn button (the player picks 비법 one by one after a failure).
    const header = $('panel').querySelector('header');
    header.querySelectorAll('.tree-learning,.practice-go').forEach(el=>el.remove());
    if (practice && !(newTutorialLesson()&&!state.u15.bios.includes('lesson:bought'))) { const go = action(practiceGoLabel(), restartAfterFailure); go.classList.add('practice-go','u26-primary'); header.insertBefore(go,$('closePanel')); }
    const wallet = element('div', '', 'tree-wallet');
    [['🪙 ','동전 ',rounded(state.coins)],['📕 ','책 ',state.keys],['🕊️ ','비둘기 ',state.starlight]].forEach(([icon,name,value],i)=>{
      if(i)wallet.append(element('span','·','wallet-sep'));
      wallet.append(element('span',icon),element('span',name,'wallet-name'),element('span',String(value)));
    });
    const layout = element('div', '', 'constellation-layout');
    const map = element('div', '', 'constellation-map'); map.tabIndex = 0;
    map.setAttribute('aria-label', '별자리 지도. 방향키로 이동하고 더하기와 빼기로 확대합니다.');
    const world = element('div', '', 'constellation-world');
    const detail = element('aside', '', 'constellation-detail'); detail.setAttribute('aria-live', 'polite');
    const minTreeZoom=Math.max(.8,44/(56*(scale||1)));
    treeView.zoom=Math.max(minTreeZoom,treeView.zoom);
    const infos = new Map(D.tree.map(n => [n.id, C.nodeInfo(state, n.id)]));
    const nodeStatus=(node,info)=>{
      const maxed=info.revealed&&info.cost===null;
      const shortage=!!info.revealed&&/ 부족$/.test(info.blockedReason||'');
      const missing=Math.max(0,(info.cost||0)-(state[info.currency]||0));
      const currency={coins:'동전',keys:'책',starlight:'비둘기'}[info.currency];
      const pre=node.prereqs.find(id=>!(infos.get(id)?.level>0));
      const requirement=node.reveal==='E'&&!state.endings.length?'첫 멀티버스 완료':pre&&node.branch!=='collection'?(D.tree.find(n=>n.id===pre).short||D.tree.find(n=>n.id===pre).name)+' 배우기':info.blockedReason==='아직 발견하지 못한 비법'?(node.venueSlug?C.venueBySlug(node.venueSlug).name+' 도착':'이웃 비법 배우기'):info.blockedReason;
      const kind=maxed?'maxed':info.purchasable?'learnable':shortage?'unaffordable':'locked';
      const text=maxed?'MAX':kind==='locked'?requirement:`${currency} ${C.formatNumber(info.cost)}`;
      return {kind,text,missing,currency};
    };
    const shown = new Set(D.tree.filter(n => !n.shopOnly && n.id !== 'autoLearn' /* v4 U47 10: retired node, never drawn */ && (infos.get(n.id).revealed ||(!n.hidden && (n.reveal === 'E' || n.prereqs.some(id => infos.get(id).revealed))))).map(n => n.id));
    const centerUnlocked = () => {
      const nodes = D.tree.filter(n => shown.has(n.id) && infos.get(n.id).revealed && (!infos.get(n.id).gate || infos.get(n.id).gate.met));
      treeView.x = -(Math.min(...nodes.map(n=>n.x)) + Math.max(...nodes.map(n=>n.x))) * 70 * treeView.zoom;
      treeView.y = -(Math.min(...nodes.map(n=>n.y)) + Math.max(...nodes.map(n=>n.y))) * 70 * treeView.zoom;
    };
    if (opening) treeView.sheet = false;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('constellation-lines');
    for (const node of D.tree) {
      if (!shown.has(node.id)) continue;
      for (const id of node.prereqs) {
        if (!shown.has(id) || (!infos.get(node.id).revealed && !infos.get(id).revealed) || (node.reveal === 'E' && !infos.get(node.id).revealed)) continue;
        const pre = D.tree.find(n => n.id === id);
        if (Math.hypot(pre.x-node.x, pre.y-node.y) > 2.1) continue;
        const line = document.createElementNS(svg.namespaceURI, 'line');
        for (const [key, value] of Object.entries({ x1: pre.x * 140, y1: pre.y * 140, x2: node.x * 140, y2: node.y * 140 })) line.setAttribute(key, value);
        line.classList.toggle('owned', infos.get(node.id).level > 0); svg.append(line);
      }
    }
    world.append(svg);
    let suppressClick = false;
    const select = id => {
      const now = performance.now(), last = treeView.lastTap;
      treeView.lastTap = {id, at: now}; treeView.selected = id; treeView.sheet = true;
      if (last && last.id === id && now-last.at < 350) { focusNode(id); return; }
      tree(true);
    };
    const newly = new Set();
    for (const node of D.tree) {
      const info = infos.get(node.id);
      if (info.revealed && treeView.ready && !treeView.revealed.has(node.id)) newly.add(node.id);
      if (!shown.has(node.id)) continue;
      const unknown = !info.revealed,status=nodeStatus(node,info);
      const button = element('button', '', `constellation-node${node.branch === 'collection' ? ' collection' : ''}${unknown ? ' unknown' : ''}${info.level ? ' owned' : ''}${treeView.selected === node.id ? ' selected' : ''}${newly.has(node.id) ? ' newly-revealed' : ''}`);
      button.dataset.nodeId = node.id;button.dataset.state=status.kind;button.classList.add(status.kind);
      button.setAttribute('aria-pressed',String(treeView.selected===node.id));button.title=status.text;
      button.style.left = `${node.x * 140}px`; button.style.top = `${node.y * 140}px`;
      button.setAttribute('aria-label', unknown ? (node.reveal === 'E' ? '첫 멀티버스 공연 완료' : '미확인 비법') : `${node.name} 레벨 ${C.formatNumber(info.level)} / ${typeof info.max==='number' ? C.formatNumber(info.max) : info.max}`);
      button.setAttribute('aria-label',button.getAttribute('aria-label')+' · '+status.text+(status.kind==='unaffordable'?' · '+C.formatNumber(status.missing)+' 부족':''));
      const icon = element('span', unknown ? '❔' : node.emoji, 'constellation-icon sprite-fallback');
      const iconHost = element('span', '', 'constellation-icon-host'); iconHost.append(icon);
      sprite(iconHost, `assets/${unknown ? 'node-unknown.png' : node.icon}`);
      button.append(iconHost);
      if (practice && !unknown && node.id === practiceRec && infos.get(node.id).cost !== null) button.append(element('span', '추천', 'rec-tag'));
      if (!unknown) button.append(element('span', node.short || node.name /* v4 U45: long product names use a map label */, 'constellation-name'), element('small', `${C.formatNumber(info.level)} / ${typeof info.max==='number' ? C.formatNumber(info.max) : info.max}`, 'constellation-level'));
      const badge=status.kind==='maxed'?'MAX':status.kind==='locked'?'🔒':status.kind==='learnable'?'↑':info.level?'✓':'';
      if(badge)button.append(element('span',badge,'node-state-badge'));
      if(info.level&&status.kind!=='maxed')button.append(element('span','✓','node-learned'));
      button.append(element('span',status.text,'node-status'));
      if(status.kind==='unaffordable')button.append(element('small',status.currency+' '+C.formatNumber(status.missing)+' 부족','node-missing'));
      button.addEventListener('click', () => { if (!suppressClick) select(node.id); }); world.append(button);
    }
    treeView.revealed = new Set(D.tree.filter(n => infos.get(n.id).revealed).map(n => n.id)); treeView.ready = true;
    const selected = D.tree.find(n => n.id === treeView.selected) || D.tree[0], info = infos.get(selected.id);
    if (!info.revealed) {
      detail.append(element('h2', '미확인 비법'), element('p', selected.reveal === 'E' ? '첫 멀티버스 공연 완료' : '이웃 비법을 배워 발견하세요.'));
    } else {
      // v4 U45: one reading order. Name with the level chip, the effect (first line) and its step (second line), the next milestone,
      // then the price and, only when something blocks it, the reason. The arrival line is part of the reason now (it was shown twice).
      const maxed = info.cost === null;
      detail.append(element('h2', selected.name), element('span', `레벨 ${C.formatNumber(info.level)} / ${typeof info.max==='number' ? C.formatNumber(info.max) : info.max}`, 'tree-level'));
      if (selected.branch === 'collection') detail.append(element('small', '칼리 컬렉션', 'tree-tag'));
      detail.append(element('p', selected.desc, 'tree-effect'));
      if ((selected.partOf || selected.id) === 'area') detail.append(areaRangePreview());
      // v4 U48 N5: a routine 비법 shows its trick (frame 2 of the routine strip) at a readable size, so the player knows which trick it is.
      if (selected.routine) { const art = element('div', '', 'tree-routine-art'); art.style.backgroundImage = `url('${assetUrl(`assets/routine-${selected.routine}.png`)}')`; art.setAttribute('role', 'img'); art.setAttribute('aria-label', selected.name); detail.append(art); }
      // v4 U48 C: milestones count the total level of a split node (part II of 무대 배짱 continues at 11).
      if(selected.statMilestone){const next=C.nextMilestone(info.total,[10,25],info.totalMax);const label=selected.partOf||selected.levels?'전체 레벨':'레벨';detail.append(element('p',next ? `다음 2배: ${label} ${next} · ${next-info.total}레벨 남음` : `지금 힘 ${C.statMultiplier(state,selected.partOf||selected.id)}배`,'tree-next'),element('p', D.easyExtras.milestone, 'tree-preview'));}
      if (selected.desc.includes('L')) detail.append(element('small', 'L은 이 비법의 레벨입니다.', 'tree-note-l'));
      const currency = { coins: '🪙 동전', keys: '📕 책', starlight: '🕊️ 비둘기' }[info.currency];
      const status=nodeStatus(selected,info);
      detail.dataset.state=status.kind;
      detail.append(element('strong', maxed ? '✓ MAX · 완성했어요' : `${currency} ${C.formatNumber(info.cost)}`, 'tree-cost'));
      if(status.kind==='unaffordable')detail.append(element('p',`${status.currency} ${C.formatNumber(status.missing)} 부족`,'tree-missing'));
      if (!maxed && info.blockedReason) detail.append(element('p', info.blockedReason, 'tree-reason'));
      if (info.gate) detail.append(element('p', info.gate.text, 'tree-gate'));
      const buy = action('배우기', () => {
        if (!C.buyNode(state, selected.id)) return;
        if(newTutorialLesson()&&chainMark()?.step==='upgrade-play'&&selected.id===chainNodeId&&!state.u15.bios.includes('lesson:bought'))state.u15.bios.push('lesson:bought');
        tutorialSignal('learn'); sound('coin'); toast(`배웠어요 · ${selected.name}`); save(); tree(); render();
      }, !info.purchasable);
      buy.classList.add('tree-buy');
      detail.append(buy);
    }
    if (typeof phone !== 'undefined' && phone) {
      detail.hidden = !treeView.sheet;
      const dismiss = action('상세 닫기', () => { treeView.sheet = false; detail.hidden = true; });
      dismiss.classList.add('tree-detail-dismiss'); detail.prepend(dismiss);
    }
    const transform = () => { world.style.transform = `translate(${map.clientWidth / 2 + treeView.x}px,${map.clientHeight / 2 + treeView.y}px) scale(${treeView.zoom})`; };
    const zoom = (factor, point = { x: map.clientWidth / 2, y: map.clientHeight / 2 }) => {
      const z = Math.max(minTreeZoom, Math.min(Math.max(1.8,minTreeZoom), treeView.zoom * factor)), ratio = z / treeView.zoom;
      treeView.x = point.x - map.clientWidth / 2 - (point.x - map.clientWidth / 2 - treeView.x) * ratio;
      treeView.y = point.y - map.clientHeight / 2 - (point.y - map.clientHeight / 2 - treeView.y) * ratio;
      treeView.zoom = z; transform();
    };
    const controls = element('div', '', 'constellation-controls');
    controls.append(action('− 축소', () => zoom(1 / 1.2)), action('+ 확대', () => zoom(1.2)), action('중앙으로', () => { treeView.zoom = Math.max(1,minTreeZoom); centerUnlocked(); transform(); }));
    const local = e => { const r = map.getBoundingClientRect(); return { x: (e.clientX - r.left) * map.clientWidth / r.width, y: (e.clientY - r.top) * map.clientHeight / r.height }; };
    const pointers = new Map(); let drag = null;
    map.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const point = local(e); pointers.set(e.pointerId, point);
      drag = { point, x: treeView.x, y: treeView.y, moved: false }; suppressClick = false;
      map.setPointerCapture(e.pointerId); map.focus({ preventScroll: true });
    });
    map.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const point = local(e), previous = pointers.get(e.pointerId);
      if (pointers.size === 2) {
        const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
        const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
        if (oldDistance > 0) zoom(Math.hypot(point.x - other.x, point.y - other.y) / oldDistance, { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 });
        suppressClick = true; drag.moved = true;
      } else if (drag) {
        const dx = point.x - drag.point.x, dy = point.y - drag.point.y;
        if (Math.hypot(dx, dy) > 4) drag.moved = true;
        if (drag.moved) { treeView.x = drag.x + dx; treeView.y = drag.y + dy; suppressClick = true; transform(); }
      }
      pointers.set(e.pointerId, point);
    });
    const release = e => {
      // Pointer capture targets clicks at the viewport, so resolve a stationary node tap here.
      if (drag && !drag.moved && e.type === 'pointerup') {
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.constellation-node');
        if (target && map.contains(target)) { suppressClick = true; select(target.dataset.nodeId); }
      }
      pointers.delete(e.pointerId);
      if (pointers.size) { const point = [...pointers.values()][0]; drag = { point, x: treeView.x, y: treeView.y, moved: true }; } else drag = null;
    };
    map.addEventListener('pointerup', release); map.addEventListener('pointercancel', release);
    map.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, local(e)); }, { passive: false });
    map.addEventListener('keydown', e => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key)) e.preventDefault(); else return;
      if (e.key === '+' || e.key === '=') zoom(1.2);
      else if (e.key === '-') zoom(1 / 1.2);
      else if (e.key === 'Home') { treeView.x = 0; treeView.y = 0; transform(); }
      else { treeView.x += e.key === 'ArrowLeft' ? 70 : e.key === 'ArrowRight' ? -70 : 0; treeView.y += e.key === 'ArrowUp' ? 70 : e.key === 'ArrowDown' ? -70 : 0; transform(); }
    });
    map.append(world); layout.append(map, detail); body.append(wallet, controls, layout, element('p', '드래그·방향키로 이동 · 휠·두 손가락으로 확대 · 책은 관객 도감 완성으로 얻어요.', 'tree-note'));
    // v4 U51 4 (owner: "야유 받아넘기기 배우기 라는게 계속 뜨는데 이거 없애줘"): the practice note no longer offers the gate lesson. Core keeps the
    // mechanic untouched (a save that already studied a gate keeps it; a gate also loses a third of its pressure per failed show, v4 U41).
    if (typeof phone !== 'undefined' && phone) {
      const header = $('panel').querySelector('header');
      header.querySelectorAll('.tree-wallet,.constellation-controls,.tree-more').forEach(el=>el.remove());
      header.insertBefore(wallet,$('closePanel'));
      // U32: rarely used buttons (zoom, center; the auto-learn button went away in v4 U47) sit behind one ⋯ button so the header stays calm.
      const more = element('div','','tree-more'), pop = element('div','','tree-more-pop');
      const toggle = action('지도', () => { const open = more.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); });
      toggle.classList.add('tree-more-toggle'); toggle.setAttribute('aria-label','지도 확대와 이동'); toggle.setAttribute('aria-expanded','false');
      pop.append(controls); more.append(toggle, pop);
      header.insertBefore(more,$('closePanel'));
      $('closePanel').textContent = '뒤로';
    }
    if (treeView.centerPending) {
      // Keep the centered node in the visible map above the phone sheet.
      if (typeof phone !== 'undefined' && phone && treeView.sheet) treeView.y -= (detail.getBoundingClientRect().height + 6) / 2;
      treeView.centerPending = false;
    }
    if (opening) {
      const nodes = D.tree.filter(n => shown.has(n.id) && infos.get(n.id).revealed && (!infos.get(n.id).gate || infos.get(n.id).gate.met));
      const span = axis => (Math.max(...nodes.map(n=>n[axis])) - Math.min(...nodes.map(n=>n[axis]))) * 140;
      treeView.zoom = Math.min(1, (map.clientWidth - 20) / (span('x') + 140), (map.clientHeight - 20) / (span('y') + 140));
      treeView.zoom = Math.max(minTreeZoom, treeView.zoom);
      centerUnlocked(); treeView.y -= 30 * treeView.zoom + Math.max(0, (map.clientHeight - (span('y') + 140) * treeView.zoom) / 2 - 20);
    }
    transform();
    if (focusMap) map.focus({ preventScroll: true });
  }
  let pendingIntro = null;
  const payLines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function venueHeckles(venue) {
    const map = [
      { words: ['무중력', '달', '태양', '은하'], venues: ['moon','sun','galaxy'] },
      { words: ['리모컨', '거실'], venues: ['family'] },
      { words: ['파티', '케이크'], venues: ['party'] },
      { words: ['학교', '종이 울'], venues: ['school'] },
      { words: ['커피', '샷'], venues: ['cafe'] },
      { words: ['객석', '뒷자리', '끝자리', '맨 뒤'], venues: ['theater','festival','audition','broadcast','vegas','broadway','moon','sun','galaxy','multiverse'] }
    ];
    return D.pools.heckles.filter(line => map.every(rule => !rule.words.some(word => line.includes(word)) || rule.venues.includes(D.venues[venue-1].slug)));
  }
  function element(tag, text, className = '') {
    const el = document.createElement(tag); el.textContent = text; el.className = className; return el;
  }
  // v4 U46 A5: emoji and non-pixel symbols that show as UI icons are drawn as 16x16 pixel icons (assets/ui/ic-*.webp, img27) at integer scales.
  // 💎, 🔑 and the rabbit dealer entry keep their glyphs (owner: they become prop currencies later).
  // v4 U47 12: the heal item 'water-glass' keeps its code id; its picture is item-chicken (see the two item art paths above)
  // Alpha > 16 bounds of the second frame in assets/routine-*.webp (512 x 256).
  // Drawing a local image is allowed even when file:// forbids canvas reads/exports.
  const routineIconBounds = {
    bottles:[28,50,228,254], cards:[27,50,229,254], coins:[45,50,211,254],
    coloringbook:[28,24,200,240], cube:[24,36,220,240], cupsballs:[29,50,226,254],
    eggbag:[8,28,252,244], rings:[52,50,204,254], rope:[34,50,222,254],
    rubberband:[24,28,228,232], silk:[29,50,226,254], thumbtie:[24,32,244,252],
    wand:[16,36,216,232]
  };
  function alignRoutineIcon(icon, id) {
    const image = assetImage(`assets/routine-${id}.png`);
    const apply = () => {
      const bounds = routineIconBounds[id];
      if (!bounds || !image.naturalWidth) return;
      const [left,top,right,bottom] = bounds, width = right-left, height = bottom-top;
      const scale = Math.min(112/width,112/height);
      const canvas = document.createElement('canvas'); canvas.width=128; canvas.height=128;
      canvas.style.cssText='display:block;width:100%;height:100%;image-rendering:pixelated';
      canvas.setAttribute('aria-hidden','true');
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled=false;
      context.drawImage(image,256+left,top,width,height,(128-width*scale)/2,120-height*scale,width*scale,height*scale);
      icon.style.backgroundImage='none';
      icon.replaceChildren(canvas);
    };
    if (image.complete && image.naturalWidth) apply();
    else image.addEventListener('load',apply,{once:true});
  }
  const PX_ICONS = { '🧣': 'silk', '📕': 'magicbook', '🪙': 'coin', '🪄': 'wand', '🃏': 'card', '🛡': 'shield', '🥤': 'cup', '⚔': 'attack', '📣': 'megaphone', '⚡': 'bolt', '🎩': 'tophat', '☕': 'coffee', '📖': 'book', '📚': 'stats',
    '🔒': 'lock', '✓': 'check', '🏆': 'trophy', '🏅': 'medal', '❤': 'heart', '🕊': 'dove', '🐇': 'rabbit', '👏': 'clap', '🔴': 'sponge', '🔥': 'fire', '🔦': 'spotlight', '🔮': 'crystal', '✨': 'sparkle', '✦': 'star', '🌸': 'petal', '🪞': 'mirror', '🐰': 'rabbit' };
  const PX_KIT_ART = {coin:'currency-coin',silk:'currency-silk',magicbook:'currency-book',book:'currency-book',dove:'currency-dove',lock:'icon-lock',check:'icon-checkmark',megaphone:'icon-boo',sparkle:'icon-sparkle',star:'icon-spark'};
  const PX_RE = new RegExp(`(${Object.keys(PX_ICONS).join('|')})\\uFE0F?`, 'u');
  function pxIcon(glyph) { const img = document.createElement('img'); img.className = 'px-icon'; img.src = PX_KIT_ART[PX_ICONS[glyph]] ? `assets/kit/${PX_KIT_ART[PX_ICONS[glyph]]}.webp` : `assets/ui/ic-${PX_ICONS[glyph]}.webp`; img.alt = ''; img.draggable = false; img.dataset.glyph = glyph; return img; }
  // Replaces the known glyphs in the text nodes under root (one pass; text without a glyph is left alone).
  function pxIcons(root) {
    if (!root || !PX_RE.test(root.textContent)) return root;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
    for (let n; (n = walk.nextNode());) if (PX_RE.test(n.nodeValue) && !n.parentElement?.closest('.sprite-fallback,.art-loaded,.entry-emoji,.cosmetic-icon,.constellation-icon,.asset-ready,.dealer-card')) list.push(n);
    for (const n of list) {
      const parts = n.nodeValue.split(new RegExp(PX_RE.source, 'gu')), frag = document.createDocumentFragment();
      // split with one capture group: even indexes are text, odd indexes are the glyph (an optional FE0F is dropped by the pattern)
      parts.forEach((part, i) => { if (i % 2) frag.append(pxIcon(part)); else if (part) frag.append(part); });
      n.replaceWith(frag);
    }
    return root;
  }
  // Sets an element's text with icons, touching the DOM only when the text changed.
  function pxText(el, text) { if (!el || el.dataset.pxText === text) return; el.dataset.pxText = text; el.textContent = text; pxIcons(el); }
  function action(text, handler, disabled = false) {
    const button = element('button', text); button.disabled = disabled; button.addEventListener('click', handler); return button;
  }
  function patternPulse(text) {
    $('patternLabel').textContent = `${D.ui.patterns[state.pattern]} · ${text}`;
    animate($('patternLabel'), [{ opacity: .3 }, { opacity: 1 }], 500);
  }
  function headlinerIntro(a) {
    pendingIntro = null;
    openPanel('headliner', a.name);
    const box = element('button', '', 'headliner-dialogue');
    const portrait = element('span', '', 'dialogue-emoji');
    portrait.append(element('span', a.emoji, 'sprite-fallback'));
    sprite(portrait, audienceAsset(D.venues[state.venue - 1], a));
    box.append(portrait, element('strong', a.preLine), element('small', '누르면 바로 공연 시작'));
    box.addEventListener('click', closePanel);
    $('panelBody').append(box); box.focus();
    if (a.pattern === 'twoPhase') {
      $('panel').classList.add('climax-dialogue');
      box.querySelector('small').textContent = '마지막 관객은 나 자신이다 · 누르면 공연 시작';
    } else dialogueTimer = setTimeout(() => { if (menu === 'headliner') closePanel(); }, 1200);
  }
  // Live catalog. Names, hidden "???" text and the bonus come from C.achievementInfo / C.achievementBonus.
  const achievementLabels = D.achievements;
  function achievementPanel() {
    const defs = achievementLabels || [];
    const earnedN = defs.filter(a => state.features.achievements.includes(a.id)).length;
    const pct = Math.round(C.achievementBonus(state) * 1000) / 10;
    const list = element('div', '', 'achievement-list');
    list.append(element('p', `달성 ${earnedN} / 전체 ${defs.length} · 마술 실력 +${pct}% · 차원 환생에서 초기화`, 'achievement-head'));
    const order = ['무대', '수집', '손맛', '숨은 업적'];
    const groups = order.concat([...new Set(defs.map(a => a.group))].filter(g => !order.includes(g)));
    for (const group of groups) {
      const items = defs.filter(a => a.group === group);
      if (!items.length) continue;
      const section = element('section', '', 'achievement-group');
      section.append(element('h2', group));
      for (const a of items) {
        const info = C.achievementInfo(state, a.id);
        const row = element('div', '', `achievement-stamp${info.earned ? ' earned' : ''}${info.hidden && !info.earned ? ' secret' : ''}`);
        const medal = element('span', '', `medal sprite-host${info.earned ? ' earned' : ' pending'}`);
        medal.append(element('span', info.earned ? '🏅' : '○', 'sprite-fallback'));
        if (info.earned) medal.append(element('span', '✓', 'medal-check'));
        sprite(medal, `assets/medal-${info.earned ? 'gold' : 'silver'}.png`);
        const copy = element('span', '', 'achievement-copy');
        copy.append(element('strong', info.name), element('small', info.desc+(info.hidden&&!info.earned?'':` · 달성 시 실크 +${D.silkRewards.achievement}`)));
        row.append(medal, copy, element('small', info.earned ? '달성' : '도전 중', 'achievement-state'));
        section.append(row);
      }
      list.append(section);
    }
    $('panelBody').append(list);
  }
  function equipPanel() {
    const body = $('panelBody'), slots = C.equipSlots(state), grid = element('div', '', 'equip-grid');
    const guiding = state.features.guide === 'place';
    if(guiding) body.append(element('h2','첫 마술용품을 빈 자리에 놓아 보세요.','guide-line'));
    body.append(element('p', slots ? `소품 ${state.features.equipped.length} / ${slots} · 같은 종류가 더 잘 나와요 · 종류마다 최대 3개` : '비법서에서 마술용품를 배우세요.'));
    for (let i = 0; i < 9; i++) {
      const id = state.features.equipped[i], product = D.items.types.flatMap(t => t.ladder).find(p => p.id === id);
      const button = action(product ? `${product.emoji} ${product.name} · 해제` : i < slots ? '' : '🔒 잠긴 자리', () => { C.unequipItem(state, id); save(); bestiary(); }, !product);
      if (!product && i < slots) button.setAttribute('aria-label', '빈 자리');
      if (guiding && i===0) button.classList.add('guide-highlight');
      if (product) sprite(button, `assets/item-${id==='water-glass'?'chicken':id}.png`); if(product)easyTooltip(button,product.desc);grid.append(button);
    }
    body.append(grid, element('p', '수집한 소품 · 장착해도 기존 드롭 효과는 그대로예요.'));
    const collection = element('div', '', 'equip-collection');
    for (const id of state.features.collected) {
      const type = D.items.types.find(t => t.id !== 'lecture' && t.ladder.some(p => p.id === id));
      if (!type) continue;
      const product = type.ladder.find(p => p.id === id);
      const prop=action(`${product.emoji} ${product.name}`, () => {
        if (C.equipItem(state, id)) {
          save();
          if(guiding){const label=type.id==='card'?'트럼프 카드':product.name;toast(`${label} 종류가 더 잘 나와요`);}
          bestiary();
        } else toast('빈 자리와 종류별 3개 제한을 확인하세요.');
      }, !slots || state.features.equipped.includes(id));easyTooltip(prop,product.desc);
      if(guiding && id===state.features.collected[0]) prop.classList.add('guide-highlight');
      const entry = element('div', '', 'equip-collected-item');
      entry.append(prop, element('small', `${product.desc.split('\n')[0]} · 장착 시 같은 종류 등장 가중치 +${C.CONST.equipWeightPerItem * 100}%`, 'equip-effect'));
      collection.append(entry);
    }
    body.append(collection);
  }
  const workerActors = {};
  function workerActor(id, role) {
    if (!workerActors[id]) {
      const host = element('span', '', 'helper-actor board-worker');
      host.append(element('span', role === 'fan' ? '👏' : '🎩', 'sprite-fallback'));
      host.setAttribute('aria-hidden', 'true'); $('stage').append(host); workerActors[id] = host;
    }
    return workerActors[id];
  }
  const helperActors = {};
  function helperActor(id) {
    if (helperActors[id]) return helperActors[id];
    const host = element('span', '', `helper-actor helper-${id}`); host.append(element('span', id === 'dove' ? '🕊️' : '🐇', 'sprite-fallback'));
    $('stage').append(host); helperActors[id] = host; return host;
  }
  const impactPool = [];
  let impactLive = 0;
  function impactSprite(p,emoji,kind,asset){
    // U36: at most 8 impact sprites on screen (helpers fire many per second late in the game).
    if (impactLive >= 8) return;
    impactLive++;
    const n=impactPool.pop()||element('span','','');n.className='projectile-impact '+kind;n.hidden=false;n.textContent=asset?'':emoji;pxIcons(n);delete n.dataset.asset;n.setAttribute('aria-hidden','true');
    n.style.left=`${p.x}px`;n.style.top=`${p.y}px`;if(asset)sprite(n,asset);$('stage').append(n);setTimeout(()=>{impactLive--;n.remove();if(impactPool.length<8)impactPool.push(n);},600);
  }
  function spongeImpact(e,p){
    const b=state.features.magic.balls[e.ball];if(!b)return;
    (renderMagic.bounces||(renderMagic.bounces={}))[e.ball]=clock+480;
    const at=phone?boardPoint(b.x,b.y):{x:870+b.x,y:160+b.y};
    impactSprite(at,'🔴','sponge-impact','assets/proj-sponge.png');
  }
  function helperMotion(id, dest) {
    const host = helperActor(id), origin = id === 'dove' ? { x: 820, y: 290 } : { x: 820, y: 680 };
    sprite(host, `assets/helper-${id}-${id === 'dove' ? 'fly' : 'move'}.png`);
    animate(host, [{ transform: 'translate(0,0)' }, { transform: `translate(${dest.x - origin.x}px,${dest.y - origin.y - 28}px)`, offset: .6 }, { transform: `translate(${dest.x - origin.x}px,${dest.y - origin.y}px)`, offset: .8 }, { transform: 'translate(0,0)' }], 1750,true);
    host.dataset.busyUntil = clock + 1750;
    if(id==='dove')setTimeout(()=>impactSprite(dest,'✨','dove-impact'),1400);
    setTimeout(() => { sprite(host, `assets/helper-${id}-${id === 'dove' ? 'hit' : 'work'}.png`); }, 875);
  }
  function renderMagic() {
    let layer=$('magicLayer');
    if(!layer){layer=element('div','','magic-layer');layer.id='magicLayer';$('stage').append(layer);}
    layer.hidden=paused();
    const actors=renderMagic.actors || (renderMagic.actors={balls:[],papers:[]});
    // U36: hidden flags are written once per frame (they used to be set true for every actor and then false again, two attribute writes each).
    for(let i=state.features.magic.balls.length;i<actors.balls.length;i++)actors.balls[i].hidden=true;
    for(let i=state.features.magic.papers.length;i<actors.papers.length;i++)actors.papers[i].hidden=true;
    state.features.magic.balls.forEach((b,i)=>{const ball=actors.balls[i] || (actors.balls[i]=element('img','','sponge-projectile'));ball.hidden=!portraitLayout()&&((renderMagic.bounces||{})[i]||0)>clock;if(!ball.__art){ball.src='assets/proj-sponge.png';ball.alt='스펀지볼';ball.__art=true;}const point=typeof phone !== 'undefined' && phone ? boardPoint(b.x,b.y) : {x:870+b.x,y:160+b.y};const half=portraitLayout()?14:16;ball.style.left=`${point.x-half}px`;ball.style.top=`${point.y-half}px`;if(!ball.dataset.mounted){layer.append(ball);ball.dataset.mounted="1";}});
    state.features.magic.papers.forEach((p,i)=>{const at=cellCenter(p.cell);let button=actors.papers[i];if(!button){button=action('플래시 페이퍼',()=>{events(C.tapPaper(state,Number(button.dataset.cell)));save();render();});button.addEventListener('pointerdown',e=>e.stopPropagation());button.addEventListener('pointerup',e=>e.stopPropagation());actors.papers[i]=button;}button.hidden=false;button.dataset.cell=p.cell;button.className='paper-drop';button.style.left=`${at.x-25}px`;button.style.top=`${at.y-25}px`;if(button.dataset.asset!=='assets/drop-flashpaper.png')sprite(button,'assets/drop-flashpaper.png');if(!button.dataset.mounted){layer.append(button);button.dataset.mounted="1";}});
    let parade=$('curtainCall');
    if(state.features.climax.left>0){
      if(!parade){parade=action('',()=>{C.skipCurtainCall(state);pendingIntro=null;save();render();});parade.id='curtainCall';parade.className='curtain-call';$('stage').append(parade);}
      const paradeVenues=D.venues.filter(v=>!v.mergedInto&&!['homecoming','future'].includes(v.headliner.bossProfile));
      const index=Math.min(paradeVenues.length-1,Math.floor((30000-state.features.climax.left)/(30000/paradeVenues.length)));
      const v=paradeVenues[index],h=v.headliner;
      if(parade.dataset.headliner!==h.id){parade.dataset.headliner=h.id;parade.replaceChildren();const art=element('img');art.src=audienceAsset(v,h);art.alt=h.name;
      parade.append(element('h2','커튼콜'),art,element('strong',h.name),element('p','모든 무대의 박수가 다시 모입니다. · 탭하여 마지막 공연 시작'));}
    }else if(parade)parade.remove();
  }
  function renderFeatures() {
    let hud = $('featureHud');
    if (!hud) {
      hud = element('div', '', 'feature-hud'); hud.id = 'featureHud';
      const goal = element('small'); goal.id = 'comboGoal'; $('combo').append(goal);
      const encore = element('span'); encore.id = 'encoreStatus'; hud.append(encore);
      ($('helperControls') || $('stage')).append(hud);
    }
    const goal = C.nextComboGoal(state);
    $('comboGoal').textContent = goal ? `다음 ${goal.threshold} · 피날레 +${goal.gauge} · 동전 +${rounded(goal.coins)}` : state.tree.comboGift ? '이번 관객 액트 보상 완료' : '';
    const active = state.features.encoreLeft > 0;
    $('stage').classList.toggle('encore-active', !!active);
    const seconds = Math.ceil((active ? state.features.encoreLeft : state.features.encoreMs) / 1000);
    $('encoreStatus').textContent = active ? `피버 ${Math.ceil(state.features.encoreLeft/1000)}초` : `피버 ${Math.floor(state.u17.feverGauge)}%`;
    for (const id of ['dove', 'rabbit']) {
      const owned = state.tree[id];
      const host = helperActor(id); host.hidden = !owned;
      if (Number(host.dataset.busyUntil || 0) <= clock && host.dataset.asset !== `assets/helper-${id}-idle.png`) sprite(host, `assets/helper-${id}-idle.png`);
    }
    // U36: hide only the actors that are no longer in the list (they used to be hidden and shown again every frame).
    const liveActors = new Set(state.features.workers.actors.map(a => a.id));
    for (const id in workerActors) if (!liveActors.has(id)) workerActors[id].hidden = true;
    for (const actor of state.features.workers.actors) {
      const host = workerActor(actor.id, actor.role);
      host.hidden = false;
      const n = actor.role === 'fan' ? Number(actor.id.split('-')[1]) : 5;
      const origin = { x: 932 + n * 104, y: 826 };
      const dest = actor.cell >= 0 ? cellCenter(actor.cell) : origin;
      // Feet stay below and beside the percentage; a small sprite keeps it readable.
      const targetX = actor.phase === 'idle' ? origin.x : dest.x - 34;
      const targetY = actor.phase === 'idle' ? origin.y : dest.y + 28;
      host.style.left = `${origin.x - 20}px`; host.style.top = `${origin.y - 32}px`;
      const retarget=actor.phase==='move'&&(host.dataset.visualCell!==String(actor.cell)||host.dataset.lastPhase==='idle')||actor.phase==='idle'&&host.dataset.lastPhase&&host.dataset.lastPhase!=='idle';
      if(retarget){host.dataset.visualCell=String(actor.cell);host.dataset.visualAt=String(clock);host.dataset.fromX=host.dataset.offsetX||'0';host.dataset.fromY=host.dataset.offsetY||'0';host.dataset.visualX=String(targetX-origin.x);host.dataset.visualY=String(targetY-origin.y);}
      const progress=Math.max(0,Math.min(1,(clock-Number(host.dataset.visualAt||0))/750));
      const fromX=Number(host.dataset.fromX||0),fromY=Number(host.dataset.fromY||0);
      const x=fromX+(Number(host.dataset.visualX||0)-fromX)*progress,y=fromY+(Number(host.dataset.visualY||0)-fromY)*progress;
      host.dataset.offsetX=String(x);host.dataset.offsetY=String(y);host.style.transitionDuration='0ms';host.style.transform=`translate(${x}px,${y}px)`;
      host.classList.toggle('worker-travel',progress<1);host.dataset.action=actor.phase==='work'?'두드리는 중':'';
      if(host.dataset.arrived!=='1'&&progress===1){host.dataset.arrived='1';animate(host,[{marginTop:'0px'},{marginTop:'-3px'},{marginTop:'0px'}],180);}if(progress<1)host.dataset.arrived='0';
      host.classList.toggle('worker-work', actor.phase === 'work');
      host.classList.toggle('paused', state.features.workers[actor.role + 'Paused']);
      if (actor.phase === 'idle' && host.dataset.lastPhase && host.dataset.lastPhase !== 'idle') host.dataset.returnUntil = clock + 750;
      host.dataset.lastPhase = actor.phase;
      const phase = actor.phase === 'idle' && Number(host.dataset.returnUntil || 0) > clock ? 'move' : actor.phase;
      const path = `assets/helper-${actor.role}-${phase}.png`;
      if (host.dataset.asset !== path) sprite(host, path);
    }

  }
  function audienceBenefit(venue, a) {
    if (a !== venue.headliner) return `공략하면: 도감 완성 시 책 1개 · 연출 +${C.CONST.bestiaryDmg * 100}% · 멘탈 배율 +${C.CONST.bestiaryU * 100}%`;
    const reward = D.stageRewards.find(r => r.venueSlug === venue.slug);
    return `공략하면: 🏆 ${venue.trophy}${reward ? ' · ' + reward.effect.replace(/\n/g, ' · ') : ''}`;
  }
  function bestiary() {
    if (['boo','fail','dealer','headliner','ending','rebirth','bossPhase','curtain'].includes(menu)) return;
    openPanel('bestiary', bestiaryTab === 'equip' ? '마술용품' : D.ui.bestiaryTitle);
    panelTabs([['audiences','관객 도감'],['endings','엔딩 도감'],['achievements','업적'],['memories','추억'],['equip','마술용품']], bestiaryTab, tab => { bestiaryTab = tab; bestiary(); });
    if(bestiaryTab==='memories'){for(const v of D.venues.filter(v=>uiSave.memories[v.slug]))$('panelBody').append(action(uiSave.memories[v.slug].title,()=>openCurtainCall(v.slug,true)));return;}
    if (bestiaryTab === 'endings') { drawArchive(); return; }
    if (bestiaryTab === 'equip') { equipPanel(); return; }
    if (bestiaryTab === 'achievements') { achievementPanel(); return; }
    const outfit=element('div','','outfit-collection');outfit.append(element('strong',`칼리 의상 · ${state.u18.equipped.kali?D.cosmetics.kali.find(x=>x.id===state.u18.equipped.kali).name:['','거실 티셔츠','무대 정장','우주 망토'][state.u14.outfit]}`));const strip=element('div','','outfit-preview'+(state.u18.equipped.kali==='future'?' future-suit':''));strip.style.backgroundImage=`url('${assetUrl(kaliArtPath())}')`;strip.append(element('span','🎩','sprite-glyph'));const image=assetImage(kaliArtPath()),art=nextArt(strip);const ready=()=>{if(strip._artGen!==art)return;strip.classList.remove('asset-pending');if(image.naturalWidth===768&&image.naturalHeight===256)strip.classList.add('art-loaded');else{strip.style.backgroundImage='none';strip.classList.add('asset-failed');}};if(image.complete)ready();else {strip.classList.add('asset-pending');image.addEventListener('load',ready,{once:true});image.addEventListener('error',ready,{once:true});}outfit.append(strip);$('panelBody').append(outfit);
    const routines=element('div','','routine-collection');routines.append(element('strong','나의 마술'));const learned=new Set(state.u19.routines);for(const r of D.routines){const known=learned.has(r.id);const item=element('span','',known?'routine-item':'routine-item routine-locked');item.title=known?r.name:'???';item.setAttribute('role','img');item.setAttribute('aria-label',known?r.name:'???');const icon=element('span','','routine-icon routine-frame');icon.style.backgroundImage=`url('${assetUrl(`assets/routine-${r.id}.png`)}')`;alignRoutineIcon(icon,r.id);item.append(icon,element('small',known?r.name:'???','routine-name'));routines.append(item);}$('panelBody').append(routines);if(state.u19.cleared||state.u18.owned.kali.includes('future'))$('panelBody').append(element('p','🏅 미래의 나 · 다음 한 장을 건네받았다.'));
    const products=D.tree.filter(n=>n.branch==='collection'),owned=products.filter(n=>state.tree[n.id]>0).length,collection=element('p',`칼리 컬렉션 ${owned}/${products.length}${state.u14.collection?' · 연출 +10%':''}`);if(state.u14.collection)collection.prepend(artFallback('assets/icon-set-bonus.png','🎀','set-ribbon u14-art'));$('panelBody').append(collection,element('p',D.easyExtras.set,'easy-description'));
    const guides=element('section','','bestiary-guides');
    for(const [name,key,path] of [['NDD','tutorial','aud-tutorial-dogyeom-happy.png'],['밍기리','helper','aud-mingiri-dark-happy.png']]){if(key==='helper'&&!state.trophies.theater)continue;const card=element('article','','bestiary-guide');const art=element('span','','entry-emoji');art.append(element('span',key==='helper'?'👹':'🙎','sprite-fallback'));sprite(art,'assets/'+path);card.append(art,element('h3',name),element('p',D.storyV15[key].bio));guides.append(card);}
    const badges=element('div','','reward-badges');
    for(const r of D.stageRewards){const badge=element('figure','','reward-badge');const art=element('img');art.src=`assets/reward-${r.id}.png`;art.alt=r.effect;badge.classList.toggle('earned',state.features.rewards.includes(r.id));badge.append(art,element('figcaption',`${C.venueBySlug(r.venueSlug).name} · ${r.effect}`));badges.append(badge);} $('panelBody').append(badges);
    const list = element('div', '', 'bestiary-list');
    for (const venue of D.venues.filter(v=>!v.mergedInto&&(v.slug!=='future'||state.visited.includes('future')))) {
      const reached = state.visited.includes(venue.slug);
      const section = element('section', '', 'bestiary-venue');
      const set=C.venueSetProgress(state,venue.slug),setLine=element('p',`관객 세트 ${set.current}/${set.total}${set.complete?' · 마술 실력 +3%':''}`,'set-progress');if(set.complete)setLine.prepend(artFallback('assets/icon-set-bonus.png','🎀','set-ribbon u14-art'));
      const trophy = !!state.trophies[venue.slug];
      section.append(element('h2', reached ? `${venue.id}. ${venue.name} · 관객 ${venue.crowd}명` : `${venue.id}. 아직 도착하지 않은 무대`));
      section.append(setLine);
      if(state.u18.revealed){const p=C.trueFanProgress(state,venue.slug);section.append(element('p',`찐팬 ${p.current}/${p.total}${p.complete?' · 🎀 마술 실력 +5%':''}`,p.complete?'truefan-ribbon':'truefan-progress'));}
      if(reached)section.append(action('무대 지도',()=>openStageMap(venue.slug),!state.u18.map&&!C.travelAllowed(state)));
      if (!reached) {
        const silhouettes = element('div', '', 'bestiary-silhouettes');
        for (const a of [...venue.audiences, venue.headliner]) {
          const known=state.knownAudiences.includes(a.id);
          const silhouette = element('span', known ? a.name : a.emoji);
          if(known) silhouette.title=a===venue.headliner ? D.ui.patterns[a.pattern] : a.flavor;
          else silhouette.setAttribute('aria-hidden', 'true');
          if(state.u18.revealed){const slot=element('small','🔒 찐팬','truefan-slot');slot.setAttribute('aria-label','잠긴 찐팬 · '+C.trueFanRule(venue.slug).label);silhouette.append(slot);}
          silhouettes.append(silhouette);
        }
        section.append(silhouettes, element('p', '앞 무대를 통과하면 공개돼요'));
      } else {
        if(venue.slug==='meetup'&&trophy){const memory=element('div','함께 마술하던 주말','meetup-memory');sprite(memory,'assets/memory-meetup.png');section.append(memory);}
        section.append(element('p', `🏆 ${venue.trophy} · ${trophy ? '획득' : '아직 도전 중'}`, trophy ? 'trophy earned' : 'trophy'));
        const grid = element('div', '', 'bestiary-grid');
        for (const a of [...venue.audiences, venue.headliner]) {
          const head = a === venue.headliner;
          const rec = state.bestiary[a.id] || { wins: 0, extra: false, removed: false };
          const card = element('article', '', `bestiary-entry${rec.removed ? ' completed' : ''}`);
          const art = element('span', '', 'entry-emoji'); art.append(element('span', a.emoji, 'sprite-fallback')); if (rec.wins > 0 || (head && trophy)) happySprite(art, audienceAsset(venue, a)); else sprite(art, audienceAsset(venue, a));
          const portrait = element('div', '', 'entry-portrait'); portrait.append(art);
          card.append(portrait, element('h3', a.name), element('p', a.bio || a.flavor, 'entry-flavor'));
          if (head) {
            card.append(element('strong', '헤드라이너'), element('p', `박수 ${trophy ? '1 / 1' : '0 / 1'}`), element('p', `패턴: ${D.ui.patterns[a.pattern]}`), element('small', `보상: 🏆 ${venue.trophy}`));
          } else {
            const need = a.extra && a.extra.type !== 'none';
            const condition = need ? D.ui.extras[a.extra.type].replace('{value}', String(a.extra.value)) : '추가 조건 없음';
            card.append(element('strong', `감탄 ${Math.min(3, rec.wins)} / 3`), element('p', condition), element('small', need ? (rec.extra ? '✓ 추가 조건 달성' : '추가 조건 미달성') : '✓ 관객이 3번 감탄하면 완성'), element('small', `보상: 📕 책 1개 · ${rec.removed ? '획득' : '완성하면 획득'}`));
            if (rec.removed) portrait.append(element('span', '완전히 팬이 됨', 'fan-stamp'));
          }
          card.append(element('p', audienceBenefit(venue, a), 'audience-benefit'));
          if(head&&trophy)portrait.append(element('span','완전히 팬이 됨','fan-stamp'));
          if(state.u18.revealed){const done=state.u18.fans.includes(a.id),slot=element('div','',done?'truefan-slot earned':'truefan-slot');slot.append(element('strong',done?'🏅 열렬한 찐팬':'🔒 찐팬'),element('p',C.trueFanRule(venue.slug).label),element('small',state.u18.paid.includes(a.id)?'마술 실력 +1% 받음':'첫 성공 마술 실력 +1%','truefan-bonus'));slot.append(action('찐팬 도전',()=>startMapFight(venue.slug,a.id,'trueFan'),!C.beatenOnce(state,venue,a)||(!state.u18.map&&!C.travelAllowed(state))));card.append(slot);}
          grid.append(card);
        }
        section.append(grid);
      }
      list.append(section);
    }
    $('panelBody').append(list,element('h2','도우미 친구들','bestiary-guides-title'),guides);
  }
  function dealer() {
    if (['boo','fail','ending','rebirth','bossPhase'].includes(menu) || dealerBusy) return;
    if (state.mode !== 'dealer' && C.failureDealerAvailable(state) && C.openFailureDealer(state)) save();
    if (state.mode !== 'dealer' || !state.dealer) return;
    if (menu !== 'dealer') {
      dealerGameView=null; dealerMessage = ''; dealerLost = state.dealer.phase === 'card-done'; dealerResult = '';
      dealerPicked = new Set(state.dealer.cards.map((card, i) => card.open && !card.dud && !dealerLost ? i : -1).filter(i => i >= 0));
      openPanel('dealer', D.ui.dealerTitle);
    }
    drawDealer();
  }
  let dealerGameView=null;
  function drawDealer() {
    const d = state.dealer;
    if (!d || menu !== 'dealer') return;
    $('panelBody').replaceChildren();
    const host = element('div', '', 'dealer-host');
    const figure = element('span', '', 'dealer-emoji');
    const portrait = element('img', '', 'dealer-serona'); portrait.src = 'assets/serona-hooded.png'; portrait.alt = D.dealer.name;
    figure.append(portrait);
    const bubble = element('div', D.storyV15.dealerActs[state.venue>=10?2:state.venue>=5?1:0].map(l=>l.speaker+' · '+l.text).join(' '), 'dealer-speech');
    host.append(figure, bubble);
    const wallet = element('p', `🪙 ${rounded(state.coins)} · 실크 ${state.gems} · 책 ${state.keys}`, 'dealer-wallet');
    const status = element('p', dealerMessage, 'dealer-message'); status.setAttribute('role', 'status');
    $('panelBody').append(host, wallet, status);
    // Card pick and the slot machine are out of play. A save from the middle of either still loads (phase stays valid) and lands on this menu.
    drawDealerGames(d);
    $('closePanel').disabled = dealerBusy;
  }
  // Curtain-call presentation holds the existing story queue without mutating it.
  let cheerData=null,curtainScene=null,curtainTimer=null,curtainFinish=null;
  cheerData=D.storyV15.cheers;

  function openCurtainCall(slug,review=false){
    const v=D.venues.find(v=>v.slug===slug),data=cheerData?.[slug];
    if(!v||!data)return false;
    const finish=()=>{curtainFinish=null;clearTimeout(curtainTimer);curtainScene?.remove();curtainScene=null;menu='';$('panel').hidden=true;presentation.finish();previous=0;dialogKey='';if(review){bestiaryTab='memories';bestiary();}else render();};
    openPanel('curtain',data.title);clearDecorations();
    const scene=element('section','','curtain-memory');curtainScene=scene;
    scene.style.backgroundImage=`url(${assetUrl(venueAsset(v))})`;
    const cast=element('div','','curtain-cast'),all=[...v.audiences];
    all.splice(Math.floor(all.length/2),0,v.headliner);
    for(const a of all){const actor=element('span','',a===v.headliner?'curtain-actor headliner':'curtain-actor');actor.dataset.audience=a.id;happySprite(actor,audienceAsset(v,a));cast.append(actor);}
    const bubble=action('',()=>{if(lineStep())advance();}); /* v4 U51b 2: one step per press (shared gate) */bubble.className='curtain-bubble';bubble.setAttribute('aria-label','응원 다음 대사');
    const closing=element('p','','curtain-closing'),lineRow=element('div','','curtain-line');scene.append(closing,cast,lineRow);lineRow.append(bubble); // v4 U51 2: 다음 sits right of the line (see below)
    // v4 U51 2 (owner: "닫기 버튼을 남겨줘. 그리고 그거 이름을 건너뛰기로"): the header 닫기 and the old in-scene 건너뛰기 both ended the call; only the
    // header one stays, labelled 건너뛰기 (closePanel runs this finish), and the scene gets a 다음 at the right that shows the next line (the last one closes).
    curtainFinish=finish;$('closePanel').textContent='건너뛰기';$('closePanel').setAttribute('aria-label','건너뛰기');
    const nextLine=action('다음',()=>{if(lineStep())advance();});nextLine.id='curtainNext';nextLine.className='curtain-next line-next u26-primary';lineRow.append(nextLine);$('panelBody').append(scene);$('closePanel').disabled=false;
    let index=0;
    function advance(){
      if(!scene.isConnected)return;clearTimeout(curtainTimer);
      if(index>data.lines.length){finish();return;}
      const line=data.lines[index++];
      if(line){const a=[...v.audiences,v.headliner].find(a=>a.id===line.id);bubble.textContent=(a?.name||'')+' · '+line.text;cast.querySelectorAll('.speaking').forEach(el=>el.classList.remove('speaking'));cast.querySelector(`[data-audience="${line.id}"]`)?.classList.add('speaking');}
      else{bubble.hidden=true;closing.textContent=data.closing.speaker+' · '+data.closing.text;}
      if(C.autoStage(state)&&state.dimension>=2)curtainTimer=setTimeout(advance,1600);
    }
    if(!review){uiSave.memories[slug]={slug,title:data.title,dimension:state.dimension};savePresentation();}
    if(!reduced){for(let i=0;i<8;i++){const fx=element('span','','curtain-confetti');fx.style.left=(8+i*11)+'%';fx.style.top=(4+i%3*10)+'px';fx.style.animationDelay=(i%3*40)+'ms';scene.append(fx);setTimeout(()=>fx.remove(),600);}}
    advance();return true;
  }
  function gameArt(name,cls=''){
    const img=element('img','',cls);img.src='assets/ui/'+name+'.png';img.alt='';img.draggable=false;return img;
  }
  function gameTable(kind){
    const table=element('div','',kind+'-table routine-table');
    table.append(gameArt('cb-mat','routine-mat'));
    if(kind==='cups')table.append(gameArt('cb-wand','routine-wand'));
    else table.append(gameArt('monte-hand-cover','routine-hand'));
    return table;
  }
  const waitRoutine=ms=>new Promise(resolve=>setTimeout(resolve,reduced?0:ms));
  // Every move uses the same arc and timing on every outcome (no arc tell). Reduced motion: both cards are
  // highlighted for about 300 ms, then they move instantly, so the move can still be followed.
  const holdMs=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function swapRoutine(nodes,a,b,table,duration,onMid){
    const moving=nodes.filter(el=>Number(el.dataset.slot)===a||Number(el.dataset.slot)===b);
    const pitch=table.clientWidth*.25;
    const running=[];
    for(const el of moving){const slot=Number(el.dataset.slot),next=slot===a?b:a,dx=(next-slot)*pitch;
      if(reduced)el.classList.add('routine-highlight');
      else{const animation=el.animate([{transform:'translate(0,0)'},{transform:`translate(${dx/2}px,${slot===a?-24:16}px)`,offset:.5},{transform:`translate(${dx}px,0)`}],{duration,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});running.push(animation);}
      el.dataset.nextSlot=next;el.style.zIndex=slot===a?'3':'';
    }
    if(onMid)setTimeout(onMid,reduced?150:duration*.5);
    if(reduced){await holdMs(300);moving.forEach(el=>el.classList.remove('routine-highlight'));}
    else await waitRoutine(duration);
    if(!table.isConnected){running.forEach(a=>a.cancel());return false;}
    moving.forEach(el=>{el.dataset.slot=el.dataset.nextSlot;el.style.setProperty('--slot',el.dataset.slot);el.style.boxShadow='';el.style.zIndex='';});
    running.forEach(a=>a.cancel());return true;
  }
  async function revealCups(c,table,choice){
    if(dealerBusy||c.phase!=='pick')return;dealerBusy=true;sound('flip');
    const cups=[...table.querySelectorAll('.game-cup')];cups.forEach(el=>el.disabled=true);dealerBack(true);
    // Pick first (saved), then animate, so a reload cannot be used to pick again.
    C.dealerCupsPick(state,choice);save();
    for(const cup of cups){if(!table.isConnected){dealerBusy=false;return;}const slot=Number(cup.dataset.slot),art=cup.querySelector('.cup-prop');
      if(!reduced)animate(art,[{transform:'translateY(0)'},{transform:'translateY(-32px)'}],260);
      art.style.transform='translateY(-32px)';
      if(slot===c.ball){cup.querySelector('.cup-ball').hidden=false;sound('coin');}
      await waitRoutine(280);if(!table.isConnected){dealerBusy=false;return;}
    }
    dealerBusy=false;sound(c.hit?'coin':'flip');drawDealer();
  }
  let monteGo=-1;
  // v4 U48 D1: a chosen mini game waits for its own 시작하기 button; nothing moves on opening or on choosing (UI only, the game state is unchanged).
  const gameStarted=new WeakSet();
  const startButton=(game)=>{const b=action('시작하기',()=>{if(dealerBusy)return;gameStarted.add(game);drawDealer();});b.classList.add('game-start','u26-primary');return b;};
  // The monte table before 시작하기: three face-down cards (no face is drawn, so nothing can leak the queen), the start button and the way back.
  function monteWaiting(m,area){
    area.append(element('h2','카드 몬테'),element('p','준비됐어요. 시작하기를 누르면 여왕 카드를 보여줄게요.','monte-line'));
    const table=gameTable('monte');
    for(let i=0;i<3;i++){const card=action('',()=>{},true);card.className='routine-card';card.dataset.slot=i;card.style.setProperty('--slot',i);card.setAttribute('aria-label',`카드 ${i+1}`);card.append(gameArt('monte-back','card-art'));table.append(card);}
    const back=action('샵 매니저 메뉴',()=>{if(dealerBusy)return;dealerGameView='';drawDealer();},dealerBusy);back.className='dealer-back';
    area.append(table,element('span','','flex-break'),startButton(m),back);$('panelBody').append(area);return true;
  }
  const monteFace=(card,name)=>{const img=card.querySelector('img');img.src='assets/ui/'+name+'.png';};
  async function monteFlip(cards,name,flipNames){
    sound('flip');
    if(!reduced)cards.forEach(c=>c.classList.add('card-flipping'));
    await waitRoutine(240);
    cards.forEach((c,i)=>{c.classList.remove('card-flipping');monteFace(c,flipNames?flipNames[i]:name);});
    if(reduced){cards.forEach(c=>{c.classList.add('routine-highlight');setTimeout(()=>c.classList.remove('routine-highlight'),150);});}
  }
  const dealerBack=disabled=>{const b=document.querySelector('#panelBody .dealer-back');if(b)b.disabled=disabled;};
  // The bend-in class only plays the intro; it is dropped afterwards so a bend that stayed (win) and one that was
  // moved (loss) end with identical classes.
  const addBend=(card,animated)=>{
    if(!card||card.querySelector('.bent-corner'))return;
    const mark=element('span','',animated&&!reduced?'bent-corner bend-in':'bent-corner');
    if(animated&&!reduced){const drop=()=>mark.classList.remove('bend-in');mark.addEventListener('animationend',drop,{once:true});setTimeout(drop,500);}
    card.append(mark);
  };
  // The bend moves only while the dealer hand covers the cards (identical hand motion on winning rounds).
  function moveBend(cards,to,a,b){
    const pre=to===a?b:to===b?a:to,el=cards.find(c=>Number(c.dataset.slot)===pre);
    if(!el)return;
    // Always recreate, win or loss, so the DOM work is identical on every outcome.
    cards.forEach(c=>c.querySelector('.bent-corner')?.remove());addBend(el,false);
  }
  // U30c cover move: a cloth with a plain hand (no red card) is laid over exactly the three cards, inside the
  // table, and the cards are faded to opacity 0 BEFORE the cover swap starts. The swap, the bend transfer
  // and the fade back all happen while nothing can be seen. Same timeline on every outcome.
  const COVER_MS=240;
  function layCover(table,cards){
    const t=table.getBoundingClientRect(),rs=cards.map(c=>c.getBoundingClientRect()),k=scale||1;
    const left=(Math.min(...rs.map(r=>r.left))-t.left)/k-6,top=(Math.min(...rs.map(r=>r.top))-t.top)/k-6;
    const width=(Math.max(...rs.map(r=>r.right))-Math.min(...rs.map(r=>r.left)))/k+12,height=(Math.max(...rs.map(r=>r.bottom))-Math.min(...rs.map(r=>r.top)))/k+12;
    const cover=element('div','','monte-cover');
    cover.style.cssText=`left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
    cover.append(gameArt('monte-hand-cover','monte-cover-hand'));
    table.append(cover);return cover;
  }
  async function coverSwap(table,cards,swap,bendTo){
    const cover=layCover(table,cards);let fades=[];
    if(reduced){
      cover.style.opacity='1';cards.forEach(c=>{c.style.opacity='0';});await holdMs(300);
    }else{
      fades=[cover.animate([{opacity:0},{opacity:1}],{duration:COVER_MS,fill:'forwards'}),...cards.map(c=>c.animate([{opacity:1},{opacity:0}],{duration:COVER_MS,fill:'forwards'}))];
      await Promise.all(fades.map(f=>f.finished.catch(()=>{})));
      // Inline state keeps the cover shown and the cards hidden even if a Reduce Motion toggle cancels the animations.
      cover.style.opacity='1';cards.forEach(c=>{c.style.opacity='0';});
    }
    if(!table.isConnected){cover.remove();return false;}
    bendTo();                       // the bend moves only after the fade-out finished
    const ok=await swap();          // the swap runs while the cards are invisible
    if(!ok){cover.remove();return false;}
    if(reduced){cards.forEach(c=>{c.style.opacity='';});cover.remove();return true;}   // restore only after the swap committed
    const back=[cover.animate([{opacity:1},{opacity:0}],{duration:COVER_MS,fill:'forwards'}),...cards.map(c=>c.animate([{opacity:0},{opacity:1}],{duration:COVER_MS}))];
    fades.forEach(f=>f.cancel());
    await Promise.all(back.map(f=>f.finished.catch(()=>{})));
    cards.forEach(c=>{c.style.opacity='';});
    cover.remove();return true;
  }
  async function animateMonte(m,table,status){
    dealerBusy=true;$('closePanel').disabled=true;dealerBack(true);
    const plan=C.monteRound(m,m.round),cards=[...table.querySelectorAll('.routine-card')];
    const alive=()=>table.isConnected&&menu==='dealer'&&dealerGameView==='monte'&&state.dealer?.games.monte===m;
    const stop=()=>{dealerBusy=false;};
    cards.forEach(c=>c.disabled=true);
    // First round: the queen stays face-up long enough to see. 포스 adds 0.6s per level. Later rounds keep the old 900ms.
    const showMs=m.round===0?1800+600*(state.tree.forceRemove||0):900;
    await waitRoutine(showMs);if(!alive()){stop();return;}
    if(plan.bend){
      addBend(cards.find(c=>Number(c.dataset.slot)===plan.bend.start),true);status.textContent='앗, 카드가 좀 휘었네';sound('flip');
      await (reduced?holdMs(700):waitRoutine(1100));if(!alive()){stop();return;}
      status.textContent='여왕을 잘 봐요!';
    }
    await monteFlip(cards,'monte-back');if(!alive()){stop();return;}
    await waitRoutine(160);
    for(let i=0;i<plan.swaps.length;i++){
      if(!alive()){stop();return;}
      const ms=C.monteMoveMs(state.venue,m.round,i,state.tree.forceRemove||0),[a,b]=plan.swaps[i],cover=!!plan.bend&&plan.bend.cover===i;
      const swap=()=>swapRoutine(cards,a,b,table,ms,null);
      if(!await(cover?coverSwap(table,cards,swap,()=>moveBend(cards,plan.bend.to,a,b)):swap())){stop();return;}
      for(const f of plan.fakes.filter(f=>f.at===i)){
        const el=cards.find(c=>Number(c.dataset.slot)===f.slot);
        if(el){if(reduced){el.classList.add('routine-highlight');await holdMs(300);el.classList.remove('routine-highlight');}else{el.animate([{transform:'translateY(0)'},{transform:'translateY(-34px)',offset:.5},{transform:'translateY(0)'}],{duration:ms,easing:'cubic-bezier(.2,.8,.2,1)'});await waitRoutine(ms);}}
        if(!alive()){stop();return;}
      }
    }
    if(!alive()){stop();return;}
    status.textContent='여왕은 어디 있을까?';
    cards.forEach(c=>c.disabled=false);dealerBusy=false;$('closePanel').disabled=false;dealerBack(false);
  }
  async function revealMonte(m,table,status,choice){
    if(dealerBusy)return;dealerBusy=true;$('closePanel').disabled=true;dealerBack(true);
    // The pick is applied and saved first, so a reload during the reveal cannot be used to pick again.
    const round=m.round,plan=C.monteRound(m,round),cards=[...table.querySelectorAll('.routine-card')];
    C.dealerMontePick(state,choice);save();
    cards.forEach(c=>c.disabled=true);
    const chosen=cards.find(c=>Number(c.dataset.slot)===choice),others=cards.filter(c=>c!==chosen);
    const faces=Presentation.monteFaces(plan,true),face=c=>faces[Number(c.dataset.slot)];
    await monteFlip([chosen],'',[face(chosen)]);if(!table.isConnected){dealerBusy=false;return;}
    if(choice===plan.queen){chosen.classList.add('money-win','gold-shine');sound('coin');}
    await waitRoutine(420);
    for(const c of others){if(!table.isConnected){dealerBusy=false;return;}await monteFlip([c],'',[face(c)]);await waitRoutine(180);}
    if(!table.isConnected){dealerBusy=false;return;}
    // v4 U48 D2: the bend line only when the player picked the bent card (the bend is now a red herring on winning rounds too).
    if(choice!==plan.queen)status.textContent=(plan.bend&&choice===plan.bend.end?plan.bend.line:'')||plan.trick?.line||'여왕은 여기 있었어요!';
    await waitRoutine(plan.bend&&choice!==plan.queen?1500:500);dealerBusy=false;drawDealer();
  }
  function drawDealerGames(d){
    const games=d.games&&typeof d.games==='object'&&!Array.isArray(d.games)?d.games:(d.games={cups:null,monte:null});
    const cupsKnown=g=>!!(g&&(g.phase==='shuffle'||g.phase==='pick'||g.phase==='result'));
    const monteKnown=g=>!!(g&&(g.phase==='playing'||g.phase==='lost'||g.phase==='banked'));
    if(dealerGameView==='cups'&&cupsKnown(games.cups)){
      const c=games.cups,area=element('section','','gem-game cups-game'),waiting=c.phase==='shuffle'&&!gameStarted.has(c);
      area.append(element('h2','컵앤볼'),element('p',waiting?'준비됐어요. 시작하기를 누르면 공을 보여줄게요.':c.phase==='shuffle'?'공을 보여줄게요. 컵을 잘 봐요!':c.phase==='pick'?'공이 어디 있을까?':c.hit?'찾았다!':'아깝다! 공은 다른 컵에 있었어요.'));
      const table=gameTable('cups');
      for(let i=0;i<3;i++){
        const cup=action('',()=>revealCups(c,table,Number(cup.dataset.slot)),c.phase!=='pick');
        cup.className='game-cup';cup.dataset.slot=i;cup.style.setProperty('--slot',i);cup.setAttribute('aria-label',`컵 ${i+1}`);
        const ball=gameArt(c.phase==='result'&&c.keys?(state.venue%2?'cb-lemon':'cb-orange'):'cb-ball','cup-ball');ball.hidden=waiting||!((i===c.initial&&c.phase==='shuffle')||(i===c.ball&&c.phase==='result'));const art=gameArt(c.phase==='result'?'fx-cup-lift-04':'fx-cup-lift-01','cup-prop');cup.append(ball,art);if(c.phase==='result'&&c.keys&&i===c.ball){ball.classList.add('final-load');if(!reduced)cup.append(element('span','','final-load-fx'));}table.append(cup);
      }
      area.append(table,element('span','','flex-break'));
      if(c.phase==='result')area.append(element('p',`동전 +${rounded(c.coins)}${c.gems?` · 실크 +${c.gems}`:''}${c.keys?' · 책 +1':''}`,'game-result'));
      if(waiting)area.append(startButton(c));
      const back=action('샵 매니저 메뉴',()=>{if(dealerBusy)return;dealerGameView=null;drawDealer();},dealerBusy||c.phase==='shuffle'&&!waiting);back.className='dealer-back';area.append(back);$('panelBody').append(area);
      if(c.phase==='shuffle'&&!waiting&&Array.isArray(c.swaps))animateCups(c,table);
      return true;
    }
    if(dealerGameView==='monte'&&monteKnown(games.monte)){
      const m=games.monte,area=element('section','','gem-game monte-game');
      const settled=m.phase!=='playing'||(m.round>0&&monteGo!==m.round&&(!m.last||m.last.round===m.round-1));
      const waiting=!settled&&m.round===0&&!m.last&&!gameStarted.has(m); // v4 U48 D1: the first round waits for 시작하기 (later rounds wait for 다음 판)
      if(waiting)return monteWaiting(m,area);
      const lastRound=m.phase==='playing'?m.round-1:(m.last?m.last.round:(m.phase==='lost'?m.round:m.round-1));
      const plan=C.monteRound(m,settled?Math.max(0,lastRound):m.round);
      const status=element('p',settled?(m.phase==='lost'?(!m.last?'지난 판은 끝났어요':(plan.bend&&m.last.slot===plan.bend.end?plan.bend.line:'')||(plan.trick?plan.trick.line:'여왕은 여기 있었어요!')):m.phase==='banked'?'선물을 받았어요!':'찾았어요! 계속할까요?'):'여왕을 잘 봐요!','monte-line');status.setAttribute('role','status');
      area.append(element('h2','카드 몬테'),status);
      const table=gameTable('monte');
      const faces=Presentation.monteFaces(plan,settled);
      for(let i=0;i<3;i++){
        const showFace=!!m.last;
        const card=action('',()=>revealMonte(m,table,status,Number(card.dataset.slot)),settled);
        card.className='routine-card';card.dataset.slot=i;card.style.setProperty('--slot',i);card.setAttribute('aria-label',`카드 ${i+1}`);
        card.append(gameArt(settled&&!showFace?'monte-back':faces[i],'card-art'));
        if(settled&&m.last&&m.last.slot===i&&m.last.round===lastRound&&m.last.hit)card.classList.add('money-win','gold-shine');
        if(settled&&plan.bend&&showFace&&plan.bend.end===i)addBend(card,false);
        table.append(card);
      }
      area.append(table,element('span','','flex-break'));
      area.append(element('p',`지금 선물: 동전 ${rounded(m.coins)}${m.gems?` · 실크 ${m.gems}`:''}${m.keys?' · 책 1':''}`));
      if(m.phase==='playing'&&settled){
        const row=element('div','','dealer-controls');
        row.append(action('다음 판',()=>{if(dealerBusy)return;monteGo=m.round;drawDealer();}));
        const bank=action('그만하고 받기',()=>{if(dealerBusy)return;C.dealerMonteBank(state);save();sound('coin');drawDealer();},m.round<1);bank.dataset.bank='true';row.append(bank);area.append(row);
      }
      area.append(element('small',`정답마다 실크 +${D.silkRewards.monteCorrect} 즉시 지급 · 탈락해도 받은 실크는 남아요`));
      if(m.phase==='playing')area.append(element('small','1번 90초 동전·실크 · 2번 225초 · 3번 책·실크 + 300초'));
      const back=action('샵 매니저 메뉴',()=>{if(dealerBusy)return;dealerGameView=null;drawDealer();},dealerBusy||!settled);back.className='dealer-back';
      area.append(back);$('panelBody').append(area);
      if(!settled)animateMonte(m,table,status);
      return true;
    }
    dealerGameView=null;
    const row=element('div','','dealer-pick');
    for(const [id,label,cost,emoji,art,reward] of [
      ['cups','컵앤볼',2,'🔴','cb-ball','맞히면 동전·실크, 가끔 책'],
      ['monte','카드 몬테',3,'🂡','monte-queen',`정답마다 실크 +${D.silkRewards.monteCorrect}, 세 번이면 책`]
    ]){
      const played=games[id],need=!played&&state.gems<cost;
      const card=element('article','','dealer-game-card');
      const pic=element('div','','dealer-game-art');
      pic.append(element('span',emoji,'dealer-game-emoji'),gameArt(art,'dealer-game-img'));
      const start=action(played?(['result','lost','banked'].includes(played.phase)?'결과 보기':'이어 하기'):'시작',()=>{
        if(dealerBusy)return;
        if(played||C.dealerGameStart(state,id)){dealerGameView=id;save();drawDealer();}
      },dealerBusy||need);
      start.className='game-start u26-primary';
      const note=element('small',need?`실크 ${cost}장이 필요해요`:'','dealer-need');if(!need)note.setAttribute('aria-hidden','true');
      card.append(pic,element('h2',label),element('p',`실크 ${cost}`,'dealer-cost'),element('p',reward,'dealer-reward'),note,start);
      row.append(card);
    }
    const quit=action('그만하기',closePanel,dealerBusy);quit.className='dealer-leave';
    $('panelBody').append(row,quit);return true;
  }
  async function animateCups(c,table){
    dealerBusy=true;$('closePanel').disabled=true;
    const nodes=[...table.querySelectorAll('.game-cup')];
    sound('flip');animate(table.querySelector('.routine-wand'),[{transform:'rotate(0)'},{transform:'rotate(-12deg)'},{transform:'rotate(0)'}],280);
    await waitRoutine(320);
    for(let i=0;i<3;i++){
      if(!table.isConnected){dealerBusy=false;return;}
      const prop=nodes[i].querySelector('.cup-prop'),ball=nodes[i].querySelector('.cup-ball');
      if(i===c.initial){ball.hidden=false;if(!reduced)ball.classList.add('ball-popping');}
      if(!reduced)prop.classList.add('cup-lifting');else{nodes[i].classList.add('routine-highlight');}
      await waitRoutine(i===c.initial?900:520);
      prop.classList.remove('cup-lifting');ball.classList.remove('ball-popping');ball.hidden=true;nodes[i].classList.remove('routine-highlight');
    }
    const duration=Math.max(260,Math.min(420,c.duration/c.swaps.length));
    for(const [a,b] of c.swaps){if(menu!=='dealer'||dealerGameView!=='cups'||state.dealer?.games.cups!==c||!await swapRoutine(nodes,a,b,table,duration)){dealerBusy=false;return;}}
    if(table.isConnected){C.dealerCupsReady(state);save();dealerBusy=false;drawDealer();}
  }

  function kaliArtPath(){if(state.u18.equipped.kali==='future')return 'assets/kali-outfit-2.png';return state.u18.equipped.kali?`assets/kali-skin-${state.u18.equipped.kali}.png`:`assets/kali-outfit-${state.u14.outfit}.png`;}
  function startMapFight(slug,id,kind){
    if(!C.travelTo(state,slug,id,kind)){toast('지금은 무대를 이동할 수 없어요');return;}
    menu='';$('panel').hidden=true;$('phoneMore').hidden=true;previous=0;lastAudience='';dialogKey='';save();render();
  }
  function openStageMap(selected=''){
    if(menu==='boo')return;
    if(schoolChainPaused()||(chainMark()&&!state.u15.tutorial.done)){toast('튜토리얼을 먼저 끝내 주세요');return;}
    if(!state.u18.map&&!C.openMap(state)){toast('이 장면이 끝나면 이동할 수 있어요');return;}
    openPanel('map','무대 지도');$('phoneMore').hidden=true;
    $('panelBody').append(element('p','도착했던 무대는 무료로 다시 갈 수 있어요','flow-lead'),action('지금 무대로 돌아가기',()=>{if(C.returnToStage(state)){menu='';$('panel').hidden=true;previous=0;lastAudience='';save();render();}}));
    const fork=D.progressFork||{after:'multiverse',main:['lecturenote','future'],mainChoice:'내가 될 수 있는 모습만 볼까?',ifChoice:'아직 어린 나도 만나 볼까?',ifRoute:[]};
    const mainSlugs=new Set(fork.main||[]);
    const spine=D.venues.filter(v=>!v.mergedInto&&!mainSlugs.has(v.slug));
    const here=D.venues[state.venue-1];
    let reached=-1;
    spine.forEach((v,i)=>{if(state.visited.includes(v.slug)||here&&here.slug===v.slug)reached=i;});
    const castOf=v=>[...(v.audiences||[]),v.headliner].filter(Boolean);
    const ifReached=id=>BatchDView.visibleRoute(state.batchD,id,!!state.trophies.multiverse);
    const face=(v,i,kind)=>{
      const current=!!(here&&here.slug===v.slug);
      if(kind==='if')return ifReached(v.slug)?'cleared':'hidden';
      if(kind==='main'){
        const seen=state.visited.includes(v.slug)||(v.slug==='lecturenote'&&(!!state.homecomingCleared||state.knownAudiences.includes(v.headliner.id)))||(v.slug==='future'&&!!state.u19.cleared);
        if(!seen&&!current)return 'hidden';
        if(current)return 'current';
        return state.visited.includes(v.slug)?'cleared':'future';
      }
      if(current)return 'current';
      if(state.visited.includes(v.slug))return 'cleared';
      return i<=reached+1?'future':'hidden';
    };
    const dots=(v,status)=>{
      const row=element('span','','flow-dots');row.setAttribute('aria-hidden','true');
      castOf(v).forEach((a,n)=>{
        const dot=element('i','','flow-dot');
        let kind='hollow';
        if(status==='cleared')kind='filled';
        else if(status==='current'){
          if(n===state.j-1)kind='ring';
          else if(n<state.j-1||(a.id===v.headliner.id?!!state.trophies[v.slug]:!!(state.bestiary[a.id]&&state.bestiary[a.id].wins>=1)))kind='filled';
        }
        dot.classList.add('is-'+kind);row.append(dot);
      });
      return row;
    };
    const stop=(v,status)=>{
      const li=element('li','',`flow-stop is-${status}`);li.dataset.venue=v.slug;
      const mark=element('span','','flow-mark');mark.setAttribute('aria-hidden','true');
      const name=status==='hidden'?'???':v.name;
      let node;
      if(status==='cleared'){
        const first=castOf(v)[0];
        node=action('',()=>['young-kali','mirror-stage'].includes(v.slug)?startBatchDSide(v.slug==='young-kali'?'young':'mirror'):startMapFight(v.slug,first.id,'normal'),!state.u18.map&&!C.travelAllowed(state));
        node.className='flow-node';node.setAttribute('aria-label',v.name+'로 이동');
      }else node=element('div','','flow-node');
      node.append(element('span',name,'flow-name'),dots(v,status));
      li.append(mark,node);return li;
    };
    const ifVenue=(node)=>{
      const n=Math.max(1,node.dots|0),audiences=[];
      for(let i=0;i<n-1;i++)audiences.push({id:node.id+'-'+i});
      return {slug:node.id,name:node.name,audiences,headliner:{id:node.id+'-h'}};
    };
    const list=element('ol','','flow-spine');
    spine.forEach((v,i)=>{
      list.append(stop(v,face(v,i,'spine')));
      if(v.slug!==fork.after)return;
      const split=element('li','','flow-fork');
      const grid=element('div','','flow-fork-grid');
      for(const [branch,choice,venues] of [
        ['main',fork.mainChoice,(fork.main||[]).map(slug=>D.venues.find(v=>v.slug===slug)).filter(Boolean)],
        ['if',fork.ifChoice,(fork.ifRoute||[]).filter(node=>BatchDView.visibleRoute(state.batchD,node.id,!!state.trophies.multiverse)).map(ifVenue)]
      ]){
        if(branch==='if'&&!venues.length)continue;
        const col=element('div','','flow-branch flow-branch-'+branch);
        col.append(element('p',choice,'flow-choice'));
        const ol=element('ol','','flow-branch-spine');
        venues.forEach(venue=>ol.append(stop(venue,face(venue,-1,branch))));
        col.append(ol);grid.append(col);
      }
      split.append(grid);list.append(split);
    });
    const chart=element('div','','progress-flow');chart.append(list);
    $('panelBody').append(chart);
    const focus=selected||here&&here.slug;
    if(focus)chart.querySelector(`[data-venue="${focus}"]`)?.scrollIntoView({block:'center'});
    save();
  }
  let customizeTab='kali';
  function customize(){
    if(['boo','fail','ending','rebirth','bossPhase','headliner','dealer'].includes(menu)||state.u15.scene)return;
    openPanel('customize','꾸미기');$('phoneMore').hidden=true;
    panelTabs([['kali','칼리 의상'],['cases','카드 케이스']],customizeTab,tab=>{customizeTab=tab;customize();});
    $('panelBody').append(element('p',`실크 ${state.gems}개 · 꾸미기는 환생해도 남아요`),action('기본 모습',()=>{C.equipCosmetic(state,customizeTab,'');save();render();customize();}));
    if(customizeTab==='kali'){
      const tiers=element('div','','story-outfits');for(let tier=1;tier<=3;tier++){const owned=tier<=state.u14.outfit;tiers.append(element('p',`${owned?'✓':'🔒'} ${['','거실 티셔츠','무대 정장','우주 망토'][tier]} · ${['','처음부터','TV 오디션 완료','달 무대 완료'][tier]}`));}$('panelBody').append(tiers);
    }
    const grid=element('div','','cosmetic-grid');
    for(const x of D.cosmetics[customizeTab].filter(x=>x.id!=='future'||state.u19.cleared||state.u18.owned.kali.includes('future'))){
      const info=C.cosmeticInfo(state,customizeTab,x.id),equipped=state.u18.equipped[customizeTab]===x.id,card=element('article','',`cosmetic-card${info.owned?'':' locked'}`);
      const icon=artFallback(`assets/icon-${customizeTab==='kali'?'kali-skin':'case'}-${x.id}.png`,x.emoji,'cosmetic-icon');card.append(icon,element('h3',x.name),element('p',info.hint));
      card.append(action(equipped?'사용 중':info.owned?'입히기':x.milestone?'아직 잠김':`열기 · 🧣 ${x.cost}`,()=>{if(!info.owned)C.buyCosmetic(state,customizeTab,x.id);C.equipCosmetic(state,customizeTab,x.id);save();render();customize();},equipped||!info.available));grid.append(card);
    }
    $('panelBody').append(grid);save();
  }

  function padArt(key,icon=false){
    const [id,color]=key.split(':'),pad=D.pads.find(p=>p.id===id),base=pad.asset+(color?'-'+color:'');
    return `assets/${icon&&id!=='floor'?'icon-':''}${base}-${icon&&id!=='floor'?'64':'512'}.webp`;
  }
  function padName(key){const [id,color]=key.split(':'),pad=D.pads.find(p=>p.id===id);return pad.name+(color?' · '+D.padColors[color].name:'');}
  function effectText(effects){
    const values=Object.entries(effects).filter(([,value])=>value);
    return values.length?values.map(([key,value])=>`${D.gearEffectLabels[key]} ${value>0?'+':''}${+(value*100).toFixed(2)}%`).join(' · '):'추가 효과 없음';
  }
  function effectDifference(tab,id){
    const equipped=tab==='pads'?state.u18.pads.equipped:state.u18.equipped.kali;
    const a=C.gearEffects(state,tab,id),b=C.gearEffects(state,tab,equipped);
    const keys=[...new Set([...Object.keys(a),...Object.keys(b)])],parts=[];
    for(const key of keys){const diff=(a[key]||0)-(b[key]||0);if(Math.abs(diff)>1e-9)parts.push(`${D.gearEffectLabels[key]} ${diff>0?'높음':'낮음'}`);}
    return parts.length?'착용 중 대비 '+parts.join(' · '):'착용 중과 같은 효과';
  }
  function renderBoardPad(){
    const board=$('board'),path=padArt(state.u18.pads.equipped);
    if(board.dataset.padPath===path)return;
    board.dataset.padPath=path;board.style.removeProperty('--equipped-pad');
    const image=assetImage(path),ready=()=>{if(board.dataset.padPath!==path)return;if(image.naturalWidth>0)board.style.setProperty('--equipped-pad',`url('${state.u18.pads.equipped==='personal:green'?'assets/kit/felt-tile.webp':assetUrl(path)}')`);};
    if(image.complete)ready();else image.addEventListener('load',ready,{once:true});
  }
  function padShopSection(){
    const section=element('section','','shop-pads');section.append(element('h2','마술 패드'));
    const grid=element('div','','shop-cosmetic-grid');
    for(const pad of D.pads.filter(p=>p.id!=='floor'))for(const color of pad.colors){
      const info=C.padInfo(state,pad.id,color),key=info.key,status=info.equipped?'착용 중':info.owned?'착용':`실크 ${info.cost}`;
      const tile=action('',()=>{if(!info.owned&&!C.buyPad(state,pad.id,color))return;if(C.equipPad(state,key)){save();render();gemShop();}},info.equipped||!info.available);
      tile.className='shop-cosmetic-tile';tile.dataset.pad=key;tile.setAttribute('aria-pressed',String(info.equipped));
      tile.setAttribute('aria-label',`${padName(key)} · ${status} · ${effectText(C.gearEffects(state,'pads',key))}`);
      tile.append(artFallback(padArt(key,true),'▰','cosmetic-icon'),element('span',padName(key),'shop-cosmetic-name'),element('small',status),element('small',effectText(C.gearEffects(state,'pads',key)),'gear-effect'));
      if(info.reason)tile.append(element('small',info.reason,'shop-cosmetic-lock'));grid.append(tile);
    }
    section.append(grid);appendPadUpgrade(section,gemShop);return section;
  }
  function appendPadUpgrade(host,refresh){
    const info=C.padUpgradeInfo(state), block=element('div','','pad-upgrade');host.append(block);host=block;
    host.append(element('p',`칼리 패드 강화 ${info.level}회 · 꾹 누르기 속도 +${+(info.level*5).toFixed(2)}%p`));
    const button=action(`강화 +5%p · 동전 ${C.formatNumber(info.cost)}`,()=>{if(C.upgradePad(state)){save();render();refresh();}},!info.available);button.dataset.padUpgrade='true';host.append(button);
    if(info.reason)host.append(element('small',info.reason));
  }
  function wardrobe(){
    if(['boo','fail','ending','rebirth','bossPhase','headliner'].includes(menu))return;
    openPanel('wardrobe','옷장');
    $('panelBody').append(element('p','타일을 누르면 바로 착용해요. 산 색을 눌러 패드 색을 바꿔요.'));
    const sections = element('div','','wardrobe-sections'); $('panelBody').append(sections);
    for(const tab of ['pads','kali']){
      const section=element('section','',tab==='pads'?'wardrobe-pads':'wardrobe-outfits');section.append(element('h2',tab==='pads'?'마술 패드':'옷'));
      const equipped=tab==='pads'?state.u18.pads.equipped:state.u18.equipped.kali;
      const name=tab==='pads'?padName(equipped):D.cosmetics.kali.find(x=>x.id===equipped)?.name||'기본 의상';
      section.append(element('p',`착용 중: ${name} · ${effectText(C.gearEffects(state,tab,equipped))}`,'wardrobe-equipped'));
      if(tab==='kali')for(const x of D.cosmetics.kali)C.cosmeticInfo(state,tab,x.id);
      const ids=tab==='pads'?state.u18.pads.owned:['',...state.u18.owned.kali],grid=element('div','','shop-cosmetic-grid');
      for(const id of ids){
        const item=tab==='kali'?D.cosmetics.kali.find(x=>x.id===id):null,label=tab==='pads'?padName(id):item?.name||'기본 의상';
        const tile=action('',()=>{if(tab==='pads'?C.equipPad(state,id):C.equipCosmetic(state,'kali',id)){save();render();wardrobe();}},id===equipped);
        tile.className='shop-cosmetic-tile';tile.dataset.gear=tab+':'+id;tile.setAttribute('aria-pressed',String(id===equipped));
        const effect=effectText(C.gearEffects(state,tab,id)),difference=effectDifference(tab,id);
        tile.setAttribute('aria-label',`${label} · ${effect} · ${difference}`);
        tile.append(artFallback(tab==='pads'?padArt(id,true):item?`assets/icon-kali-skin-${id}.png`:'assets/magician-mini.png',item?.emoji||'▰','cosmetic-icon'),element('span',label,'shop-cosmetic-name'),element('small',effect,'gear-effect'),element('small',difference,'gear-difference'));
        grid.append(tile);
      }
      section.append(grid); sections.append(section);
    }
    appendPadUpgrade($('panelBody'),wardrobe);
  }
  function gemShop(){
    if(['boo','fail','ending','rebirth','bossPhase','headliner'].includes(menu))return;
    openPanel('gemShop','실크 상점');
    const balance=element('p',`실크 ${state.gems}개`,'dealer-wallet shop-balance');
    $('panel').querySelector('header').insertBefore(balance,$('closePanel'));
    // Purchases keep their existing handlers and save keys; sections only change presentation.
    const abilities = element('section','','shop-abilities'), routines = element('section','','shop-routines');
    abilities.append(element('h2','스킬'));
    routines.append(element('h2','마술 루틴'));
    for(const item of D.gemShop){
      if((item.id==='glove'||item.id==='brick')&&!C.hasDeck(state))continue;
      const card=element('section','','gem-shop-item');card.dataset.shopItem=item.id;
      const iconPath=item.id.startsWith('routine-')?`assets/icon-${item.id}.webp`:item.id==='potion'?'assets/node-chicken.webp':item.id==='refill'?'assets/kit/icon-showtime.webp':'assets/kit/icon-card-rain.webp';
      const heading=element('h3',item.name);heading.prepend(artFallback(iconPath,'✦','shop-item-icon'));
      card.append(heading,element('p',item.desc));
      const add=skill=>{const info=C.gemShopInfo(state,item.id,skill),label=skill?D.skills.find(k=>k.id===skill).name+' 충전':'사기';
        const buy=action('',()=>{if(C.gemShopBuy(state,item.id,skill)){save();sound('skill');gemShop();render();}},!info.available);
        buy.setAttribute('aria-label',`${label} · 실크 ${info.cost}`);buy.append(element('span',label),element('span',String(info.cost),'kit-price kit-price-silk'));card.append(buy);if(info.reason&&item.id!=='refill')card.append(element('small',info.reason));};
      if(item.id==='refill')D.skills.forEach(k=>add(k.id));else add();
      (item.id.startsWith('routine-')?routines:abilities).append(card);
    }
    const pads=padShopSection();
    const looks=element('section','','shop-customization');looks.append(element('h2','옷'));
    for(const tab of ['kali','cases']){
      looks.append(element('h3',tab==='kali'?'칼리 의상':'카드 케이스'));
      const grid=element('div','','shop-cosmetic-grid');
      for(const x of D.cosmetics[tab].filter(x=>x.id!=='future'||state.u19.cleared||state.u18.owned.kali.includes('future'))){
        const info=C.cosmeticInfo(state,tab,x.id),equipped=state.u18.equipped[tab]===x.id;
        const status=equipped?'착용 중':info.owned?'착용':x.milestone?'잠김':`실크 ${info.cost}`;
        const tile=action('',()=>{
          if(!info.owned&&!C.buyCosmetic(state,tab,x.id))return;
          if(C.equipCosmetic(state,tab,x.id)){save();render();gemShop();}
        },equipped||!info.available);
        tile.className='shop-cosmetic-tile';tile.dataset.cosmetic=tab+':'+x.id;
        tile.setAttribute('aria-label',`${x.name} · ${status}${!info.available?' · '+info.hint:''}`);
        if(equipped)tile.setAttribute('aria-pressed','true');
        const icon=artFallback(`assets/icon-${tab==='kali'?'kali-skin':'case'}-${x.id}.png`,x.emoji,'cosmetic-icon');
        tile.append(icon,element('span',x.name,'shop-cosmetic-name'),element('small',status));
        if(tab==='kali')tile.append(element('small',effectText(C.gearEffects(state,'kali',x.id)),'gear-effect'));
        if(x.milestone&&!info.owned)tile.append(element('small',info.hint,'shop-cosmetic-lock'));
        grid.append(tile);
      }
      looks.append(grid);
    }
    $('panelBody').append(abilities,routines,pads,looks);
  }
  // U30c: "피버 타임!" shows inside the stage, centered just below the doubt and heckle bars, then fades.
  // Reduced motion: no animation, it just stays for the same time and disappears.
  let feverBannerTimer=0;
  function showFeverBanner(){
    const banner=$('feverBanner'),heckle=$('heckleMeter');if(!banner)return;
    clearTimeout(feverBannerTimer);for(const a of banner.getAnimations?.()||[]){a.oncancel=null;a.onfinish=null;a.cancel();}
    banner.style.top=`${heckle.offsetTop+heckle.offsetHeight+6}px`;banner.hidden=false;
    const hide=()=>{banner.hidden=true;};
    if(reduced)feverBannerTimer=setTimeout(hide,1800);
    else{const a=banner.animate([{opacity:0},{opacity:1,offset:.12},{opacity:1,offset:.7},{opacity:0}],{duration:1800});a.onfinish=hide;a.oncancel=hide;}
  }
  function renderU17(){
    const active=state.features.encoreLeft>0,gauge=$('feverGauge'),overlay=$('feverOverlay');
    gauge.setAttribute('aria-valuenow',String(Math.floor(state.u17.feverGauge)));gauge.querySelector('span').style.width=`${active?100:state.u17.feverGauge}%`;
    gauge.hidden=!active&&state.u17.feverGauge<=0;gauge.classList.toggle('active',active);overlay.hidden=!active;
    if(active&&!renderU17.was)showFeverBanner();renderU17.was=active;overlay.classList.toggle('fever-paused',paused()||state.mode!=='fight');
    const confetti=$('feverConfetti');confetti.hidden=!active||reduced;confetti.classList.toggle('fever-paused',paused()||state.mode!=='fight'); // v4 U47 9
    if(window.Sfx)window.Sfx.setMusicScene(D.venues[state.venue-1].slug,state.j>D.venues[state.venue-1].audiences.length,active);
  }
  function spinDealer() {
    const coins = state.coins, gems = state.gems;
    if (dealerBusy || !C.dealerSlotSpin(state)) return;
    dealerBusy = true; sound('slot'); save(); drawDealer();
    const nodes = Array.from($('panelBody').querySelectorAll('.slot-cell'));
    nodes.forEach(node => node.classList.remove('paying'));
    const pool = D.dealer.slotSymbols.filter(symbol => !state.dealer.banned[symbol.id]);
    let tick = 0;
    if (!reduced) nodes.forEach(node => { node.textContent = '🎰'; node.setAttribute('aria-label', '회전 중'); });
    const timer = reduced ? null : setInterval(() => {
      nodes.forEach((node, i) => { node.textContent = pool[(tick + i) % pool.length]?.emoji || '❔'; }); tick++;
    }, 75);
    setTimeout(() => {
      clearInterval(timer); dealerBusy = false;
      dealerResult = state.coins > coins ? `동전 +${rounded(state.coins - coins)}${state.gems > gems ? ` · 실크 +${state.gems - gems}` : ''}` : '아쉽지만 맞는 줄이 없어요';
      if (state.coins > coins) sound('coin');
      if (menu === 'dealer') { drawDealer(); burst(700, 430, '#ffe65c'); }
    }, reduced ? 200 : 1050);
  }
  function updateSoundButton() {
    const on = window.Sfx && !window.Sfx.isMuted();
    $('soundButton').textContent = phone?(on?'소리 ON':'소리 OFF'):on?D.ui.soundOn:D.ui.soundOff;
    $('soundButton').setAttribute('aria-pressed', String(!!on));
  }
  function panelTabs(tabs, selected, select) {
    const nav = element('nav', '', 'panel-tabs'); nav.setAttribute('aria-label', '도감과 강화 분류');
    for (const [id, label] of tabs) {
      const button = action(label, () => select(id));
      button.setAttribute('aria-pressed', String(id === selected)); nav.append(button);
    }
    $('panelBody').append(nav);
  }
  function drawArchive() {
    const grid = element('div', '', 'ending-archive');
    const homeSeen=state.homecomingCleared||state.knownAudiences.includes('h-lecturenote-kim');
    const home=element('article','','ending-entry'+(homeSeen?' seen':''));
    home.append(element('h2',homeSeen?'칼리 마술 성장기 · 돌아올 무대':'아직 만나지 않은 이야기'),element('p',homeSeen?'멀리 다녀와도, 같이 마술할 곳이 있다.':'새로운 이야기를 만나면 공개돼요'));
    grid.append(home);
    const dimensions = [...new Set([1,2,3,4,5, ...state.endings])].sort((a,b) => a-b);
    for (const d of dimensions) {
      const seen = state.endings.includes(d), ending = endingText(d);
      const card = element('article', '', `ending-entry${seen ? ' seen' : ''}${d === 5 ? ' true-ending' : ''}`);
      card.append(element('span', seen ? '🏆' : '🔒', 'entry-emoji'), element('p', `멀티버스 회상 · 차원 ${d}`), element('h2', seen ? ending.title : '아직 만나지 않은 엔딩'), element('p', seen ? ending.body : '이 차원의 멀티버스 공연을 마치면 공개돼요'));
      grid.append(card);
    }
    $('panelBody').append(element('p', `기록한 엔딩 ${new Set(state.endings).size}개 · 환생해도 남아요`, 'tree-wallet'), grid);
  }
  function phaseTransition() {
    sound('finisher'); release();
    sceneLight(.06);
    animate($('audience'), [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)', offset: .45 }, { transform: 'scaleX(-1)' }], 650);
    const line = U5.phase2Line(D.venues, state.audId, state.venue);
    queueAudienceLine(line,'phase:mirror');
    openPanel('bossPhase', '마지막 의심 · 2단계');
    const scene = element('div', '', 'climax-scene');
    scene.append(element('span', '🪞', 'result-icon'), element('h2', line), element('p', '거울 속 내가 지팡이를 들었다. 손놀림은 느려지고, 의심은 다시 차오른다.'));
    const go = action('나를 위한 마지막 공연', () => {
      if (menu !== 'bossPhase') return;
      clearTimeout(dialogueTimer); menu = ''; $('panel').hidden = true; previous = 0;
      render(); $('bookButton').focus();
    });
    scene.append(go); $('panelBody').append(scene); go.focus(); save();
    dialogueTimer = setTimeout(() => { if (menu === 'bossPhase' && !document.hidden) go.click(); }, 4200);
  }
  function clearEndingEffects() {
    particles.length=0; flights.length=0; numbers.length=0; badges.length=0; events.recentBadges?.clear(); wonMoment=null;
    presentation.clear();toastQueue.length=0; visibleToasts.forEach(t=>t.el.remove()); visibleToasts.length=0; lastToastKind='';
    clearTimeout(bannerTimer); bannerQueue.length=0; unlockBannerQueue.length=0; bannerActive=null; $('banner').hidden=true;
    document.querySelectorAll('.case-lightning').forEach(el=>el.remove());
  }
  function showEnding() {
    clearTimeout(dialogueTimer); release(); clearEndingEffects();
    if(!state.homecomingCleared) {
      openPanel('ending','이어지는 공연');
      const next=action('이어지는 공연',()=>{C.continueStory(state);menu='';$('panel').hidden=true;previous=0;lastAudience='';save();render();});
      $('panelBody').append(element('h2','우주 끝에서, 다시 사람 곁으로'),next); next.focus();
      return;
    }
    openPanel('ending',state.u19.cleared?'미래의 나 · 다음 한 장':'돌아올 무대 · 렉쳐노트');
    sound('ending'); drawEnding();
  }
  function drawEnding() {
    clearTimeout(dialogueTimer); $('panelBody').replaceChildren();
    const venue=C.venueBySlug(state.u19.cleared?'future':'lecturenote'), lines=state.u19.cleared?D.futureEnding:venue.headliner.endingLines;
    const scene=element('div','','ending-scene homecoming-scene');
    let primary;
    const picture=element('div','','homecoming-picture');
    picture.style.backgroundImage=`url("${assetUrl(venueAsset(venue))}")`;
    const fallback=element('div','','homecoming-portraits');
    for(const a of [...venue.audiences,venue.headliner]) {const face=element('span',a.name,'homecoming-face');sprite(face,audienceAsset(venue,a));fallback.append(face);}
    picture.append(fallback); sprite(picture,state.u19.cleared?'assets/ending-future-table.png':'assets/ending-lecturenote.png'); scene.append(picture);
    if(endingStep<lines.length) {
      primary=action('장면 건너뛰기',()=>{endingStep=lines.length;drawEnding();});
      // v4 U51 2: a 다음 at the right shows the next line at once (the lines still move on by themselves every 4.5 s); after the last line it shows the recap, as before.
      const lineNext=action('다음',()=>{if(menu!=='ending'||!lineStep())return;endingStep++;drawEnding();});lineNext.classList.add('ending-next','line-next','u26-primary');primary.classList.add('line-skip');
      const row=element('div','','ending-actions ending-line-actions');row.append(primary,lineNext);primary=lineNext; // 다음 takes the focus (Enter = next line)
      scene.append(element('h2',lines[endingStep]),row);
      // Four 4.5-second beats: 18 seconds, pausing while the page is hidden.
      const next=()=>{if(menu!=='ending')return;if(document.hidden){dialogueTimer=setTimeout(next,500);return;}endingStep++;drawEnding();};
      dialogueTimer=setTimeout(next,4500);
    } else {
      const counts=C.recap(state);
      scene.append(element('h2','칼리 마술 성장기'),element('p',lines[3]),element('p',`관객 감탄 ${counts.wins}회 · 함께한 도우미 ${counts.helpers}종 · 방문한 무대 ${counts.venues}곳`,'homecoming-recap'));
      const buttons=element('div','','ending-actions');
      primary=state.u19.cleared?action('가게에 남기',continueDimension):action('서재 앞 테이블로',()=>{C.beginFuture(state,true);menu='';$('panel').hidden=true;previous=0;lastAudience='';endingStep=0;save();render();});
      buttons.append(primary);if(state.u19.cleared)buttons.append(action('다음 차원의 공연',showRebirth)); scene.append(buttons);
      if (state.u19.cleared) appendMagicInvitation(scene);
    }
    $('panelBody').append(scene); primary.focus();
  }
  function appendMagicInvitation(host) {
    host.append(element('p', '칼리: 마술이 재미있었으면 마술 톡방에 한번 들어가 봐'));
    for (const [label, href] of [['마술 톡방','https://open.kakao.com/o/gQns7wzi'],['마술 소개','https://kalimagic.netlify.app/video.html']]) {
      const link = element('a', label, 'magic-invitation'); link.href = href; link.target = '_blank'; link.rel = 'noopener'; host.append(link);
    }
  }
  function continueDimension() {
    clearTimeout(dialogueTimer); C.stayHome(state); menu=''; $('panel').hidden=true; previous=0;
    lastAudience=''; revealEnding=false; save(); render(); $('bookButton').focus();
  }
  function showRebirth() {
    if (!state.u19.cleared) { showEnding(); return; }
    openPanel('rebirth', '다음 차원의 공연');
    const scene = element('div', '', 'rebirth-scene');
    const gain = C.starGain(state.dimension);
    scene.append(element('h2', `차원 ${state.dimension}에서 차원 ${state.dimension + 1}로`), element('p', `🕊️ 비둘기 +${gain} · 환생 후 비둘기 ${state.starlight + gain}`, 'rebirth-gain'));
    const columns = element('div', '', 'rebirth-lists');
    for (const [title, lines] of [
      ['처음부터 시작해요', ['동전, 실크, 책', '마술 비법서의 모든 일반 강화와 해금', '무대 진행과 초대장, 트로피', '관객 도감의 감탄 횟수, 추가 조건, 팬 기록', '공연 성공과 공연 종료 횟수, 샵 매니저 진행과 임시 버프', '보드와 케이스, 날아가는 아이템', '레벨, 경험치, 최고 액트 기록, 피날레, 자신감', '멘탈은 새 차원의 최대치로 회복하고 가족 거실에서 시작']],
      ['다음 차원에도 남아요', ['차원 번호는 1 증가', '보유 비둘기와 이번에 얻는 비둘기', '비둘기 강화의 모든 레벨', '이미 본 모든 엔딩 기록과 감탄한 관객의 기억', '소리 설정과 저장 기능']]
    ]) {
      const section = element('section'); section.append(element('h3', title));
      const list = element('ul'); lines.forEach(line => list.append(element('li', line))); section.append(list); columns.append(section);
    }
    const controls = element('div', '', 'ending-actions');
    const go = action('환생하고 새 공연 시작', () => {
      if (!state.homecomingCleared) return;
      C.rebirth(state); sound('rebirth');
      menu = ''; $('panel').hidden = true; previous = 0; lastAudience = ''; lastLayout = ''; pendingIntro = null;
      revealEnding = false; particles.length = 0; flights.length = 0; numbers.length = 0; badges.length = 0; events.recentBadges?.clear(); wonMoment = null;
      presentation.clear();clearTimeout(bannerTimer); bannerQueue.length = 0; unlockBannerQueue.length = 0; bannerActive = null; $('banner').hidden = true;
      save(); render(); toast(`차원 ${state.dimension} · 비둘기 ${gain}개를 얻었어요`); $('bookButton').focus();
    });
    controls.append(go, action('엔딩으로 돌아가기', () => { revealEnding = false; endingStep = D.futureEnding.length; openPanel('ending', '미래의 나 · 다음 한 장'); drawEnding(); }));
    scene.append(columns, controls); $('panelBody').append(scene); go.focus();
  }
  function modeHooks() {
    if (state.mode !== lastMode) {
      lastMode = state.mode;
      window.dispatchEvent(new CustomEvent('magicshow:mode', { detail: { mode: state.mode, state } }));
    }
    if (menu || document.hidden || state.u15.scene || state.u15.tutorial.active) return;
    if(state.features.guide==='place' && state.features.collected.length && !modeHooks.equipHinted) {
      modeHooks.equipHinted=true; toast('🎩 마술용품에서 모은 소품을 놓아 보세요');
    }
    if(state.features.climax.left>0)return;
    if (state.mode === 'dealer') dealer();
    else if (pendingIntro && state.mode === 'fight') headlinerIntro(pendingIntro);
    else if (state.mode === 'ending'&&!state.u15.scene&&!state.u15.queue.length&&!presentation.busy) showEnding();
  }
  $('replayTutorial').addEventListener('click',()=>{moreReturn=false;closePanel();C.replayTutorial(state);startIntro(false);});
  // The notebook is reachable from the dock, landscape navigation and failure panel.
  $('equipButton').addEventListener('click',()=>{if(!C.equipSlots(state))return;if(!state.guidance.seen.includes('equipButton'))state.guidance.seen.push('equipButton');bestiaryTab='equip';bestiary();save();});
  $('openChatButton').addEventListener('click',()=>{save();window.open('https://open.kakao.com/o/gUJkfxzi','_blank','noopener');});
  $('coffeeButton').addEventListener('click',()=>{save();window.open('https://qr.kakaopay.com/Ej8rDsX4f','_blank','noopener');});
  $('bookButton').addEventListener('click', () => {
    if (['boo','fail','ending','rebirth','bossPhase'].includes(menu) || dealerBusy) return;
    const mark=chainMark();
    if(mark&&!state.u15.tutorial.done&&!state.u15.tutorial.active&&mark.step!=='upgrade-play'){toast('지금은 공연에 집중해 봐요');return;}
    tree();
  });
  $('bestiaryButton').addEventListener('click', bestiary);
  $('rebirthButton').addEventListener('click', () => {
    if (!['boo','fail','dealer','headliner','ending','rebirth','bossPhase'].includes(menu) && state.seenEnding) showRebirth();
  });
  $('mapButton').addEventListener('click',()=>openStageMap());
  $('customizeButton').addEventListener('click',customize);
  $('gemShopButton').addEventListener('click',()=>{if(lineOpen())return;gemShop();});
  $('wardrobeButton').addEventListener('click',wardrobe);
  // v4 U50b: no shop from the skill column while a character dialog is open (Codex Sol U50 FAIL 1). U50c: this comment used to swallow the rest of the line.
  const shopQuick=action('',()=>{if(lineOpen())return;gemShop();});shopQuick.id='gemShopQuick';shopQuick.className='active-skill gem-shop-quick';shopQuick.setAttribute('aria-label','실크 상점');
  shopQuick.append(Object.assign(document.createElement('img'),{className:'cur-icon skill-art',src:'assets/cur-silk.webp',alt:'',width:18,height:18}),element('span','실크 상점'));
  $('activeSkills').append(shopQuick);
  const practiceBtn = action('연습 모드', () => openPracticePrompt());
  practiceBtn.id = 'practiceButton';
  practiceBtn.type = 'button';
  practiceBtn.setAttribute('aria-pressed', 'false');
  practiceBtn.setAttribute('aria-label', '연습 모드');
  practiceBtn.hidden = true;
  $('activeSkills').append(practiceBtn);
  $('practicePromptText').textContent = PRACTICE_COPY;
  $('practiceStart').addEventListener('click', () => { closePracticePrompt(); hideMore(); setPractice(true); });
  $('practiceDismiss').addEventListener('click', closePracticePrompt);
  $('practiceVeil').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); dismissSaver(); });
  document.addEventListener('pointerdown', () => { practiceIdleAt = performance.now(); }, true);
  document.addEventListener('keydown', dismissSaver);
  function dismissSaver() { $('practiceVeil').hidden = true; practiceIdleAt = performance.now(); }
  function tickScreenCare(dt, now) {
    if (state.u15.gloveLeft > 0) { if (!paused()) deckContinuousMs += dt; } else deckContinuousMs = 0;
    if (!deckSaverAsked && deckContinuousMs >= 300000 && !menu) {
      deckSaverAsked = true;
      openPanel('screenCare', '화면 보호 모드로 바꿀까요?');
      $('panelBody').append(action('화면 보호 모드', () => { closePanel(); $('practiceVeil').hidden = false; }), action('계속하기', closePanel));
    }
    if (practiceOn && !paused() && now - practiceIdleAt >= 20000) $('practiceVeil').hidden = false;
    if (!$('practiceVeil').hidden) {
      if (menu || (!practiceOn && state.u15.gloveLeft <= 0)) dismissSaver();
      else $('practiceVeil').firstElementChild.style.transform = `translate(${Math.sin(now / 19000) * 24}px, ${Math.cos(now / 23000) * 18}px)`;
    }
  }
  // v4 U47 9: 피버 confetti: 36 small pieces (24 on phones, under caps.particles 48), compositor-only transforms, no pointer events, drawn behind the HUD, never with Reduce Motion.
  for(let i=0;i<36;i++){const piece=element('span','',`confetti-piece c${i%5}${i>=24?' extra':''}`);piece.style.setProperty('--x',`${(i*29+7)%97+1}%`);piece.style.setProperty('--d',`-${((i*7)%13)*.7}s`);piece.style.setProperty('--t',`${7+(i*5)%5}s`);piece.style.setProperty('--sway',`${12+(i*11)%20}px`);$('feverConfetti').append(piece);}
  for(let i=0;i<8;i++){const petal=pxIcons(element('span',i%3?'✦':'🌸','fever-petal'));petal.style.setProperty('--x',`${(i*37)%100}%`);petal.style.setProperty('--delay',`${i*.08}s`);petal.style.setProperty('--drift',`${i%2?80:-80}px`);$('feverPetals').append(petal);}
  $('musicButton').addEventListener('click',()=>{if(window.Sfx){const on=window.Sfx.toggleMusic();$('musicButton').textContent=phone?(on?'음악 ON':'음악 OFF'):on?'배경음악 켜짐':'배경음악 꺼짐';$('musicButton').setAttribute('aria-pressed',String(on));}});
  $('musicVolume').addEventListener('input',()=>window.Sfx&&window.Sfx.setMusicVolume(Number($('musicVolume').value)));
  if(window.Sfx){$('musicVolume').value=window.Sfx.musicVolume();const on=window.Sfx.musicEnabled();$('musicButton').textContent=phone?(on?'음악 ON':'음악 OFF'):on?'배경음악 켜짐':'배경음악 꺼짐';$('musicButton').setAttribute('aria-pressed',String(on));}
  $('missionsButton').addEventListener('click',()=>{if(!['boo','fail','dealer','headliner','ending','rebirth','bossPhase'].includes(menu))drawMissions();});
  $('hapticsButton').addEventListener('click',()=>{C.toggleHaptics(state);save();renderU14();});  $('eventVisitor').addEventListener('click',()=>{if(paused()&&!dialogOnlyPause()&&menu!=='boo')return;if(C.visitorBlocked(state)||paused()||lineOpen()){if(state.u14.visitor.left>0)visitorTap=state.u14.visitor.serial+1;return;}const list=C.catchVisitor(state);events(list);render();}); // v4 U49 4 / U49b 1: a tap during any line (story dialog, heckle, win, boo) is kept; renderU14 catches it after the line
  $('soundButton').addEventListener('click', () => {
    if (window.Sfx) window.Sfx.toggle();
    updateSoundButton();
  });
  $('retreatButton').addEventListener('click', () => {
    if (['boo','fail','ending','rebirth','bossPhase'].includes(menu) || dealerBusy) return;
    moreReturn = false; if (menu) closePanel();
    const traveling = !!state.u18.anchor;
    release(); C.retreat(state); lastAudience = ''; save(); render(); toast(traveling ? '도전을 마치고 지도로 돌아가요' : `${D.venues[state.venue - 1].name} 처음부터 다시 시작해요`);
  });
  $('closePanel').addEventListener('click', closePanel);
  // v4 U48 M: a tap outside a panel no longer closes it; panels close only with their own 닫기/뒤로 (and Escape or the phone Back flow).
  document.addEventListener('keydown', e => {
    if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && $('leaveConfirm').hidden) { // v4 U51b 3: no shortcut under the leave question
      const key=e.key.toLowerCase();
      if(['1','2','3'].includes(key) && !paused()) { e.preventDefault(); activateSkill(D.skills[Number(key)-1].id); }
      if (key==='b' && menu==='fail') { e.preventDefault(); document.querySelector('#panelBody .practice-enter')?.click(); } // v4 U47 3: the notebook opens only from the fail panel
      if (key==='d') { e.preventDefault(); $('bestiaryButton').click(); }
    }
    if (e.key === 'Escape' && !$('leaveConfirm').hidden) { e.preventDefault(); $('leaveStay').click(); return; } // v4 U51b 3: the leave question is the top layer; Escape = 계속하기, nothing under it closes
    if (e.key === 'Escape' && menu && menu !== 'fail') closePanel();
    else if (e.key === 'Escape' && !menu && !$('phoneMore').hidden) hideMore(); // v4 U51 1: Escape closes the top layer, the menu too
    if (e.key === 'Tab' && menu) {
      const buttons = Array.from($('panel').querySelectorAll('button:not(:disabled)')).filter(el => !el.hidden);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  $('debug').hidden = !debug;
  if (debug) {
    $('debugCoins').addEventListener('click', () => { state.coins = Math.min(1e12, state.coins + 1000); save(); if (menu === 'book') tree(); render(); });
    $('debugWin').addEventListener('click', () => {
      if (paused() || state.mode !== 'fight') return;
      state.audHp = 0; events(C.step(state, 1, { taps: [] })); render();
    });
    $('debugNext').addEventListener('click', () => {
      if (dealerBusy) return;
      if (menu && menu !== 'fail') closePanel();
      if (menu === 'fail') { menu = ''; $('panel').hidden = true; failure = null; }
      if (state.mode === 'dealer') for (let k = 0; k < 2 && state.mode === 'dealer'; k++) C.dealerClose(state);
      // Exercise automatic progression through Core wins, never assign a venue.
      const venue = state.venue;
      for (let i = 0; i < 12 && state.venue === venue; i++) {
        if (state.mode === 'dealer') for (let k = 0; k < 2 && state.mode === 'dealer'; k++) C.dealerClose(state);
        if (state.mode === 'transition') events(C.step(state, Math.max(1, state.transMs + 1), { taps: [] }));
        if (state.mode === 'dealer') for (let k = 0; k < 2 && state.mode === 'dealer'; k++) C.dealerClose(state);
        if (state.mode !== 'fight') break;
        state.audHp = 0; events(C.step(state, 1, { taps: [] }));
      }
      if (state.dealerQueued && state.mode === 'transition') events(C.step(state, Math.max(1, state.transMs + 1), { taps: [] }));
      for (let k = 0; k < 2 && state.mode === 'dealer'; k++) C.dealerClose(state);
      save(); render();
    });
  }
  function star(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? r * .45 : r;
      const px = Math.round(x + Math.cos(a) * radius), py = Math.round(y + Math.sin(a) * radius);
      if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
  function cacheEffectZones(){
    const stageRect = $('stage').getBoundingClientRect?.();
    if (stageRect) {
      const reserved = [...document.querySelectorAll('.stat-label, .hud, .menu, #goalStrip')];
      if (phone) reserved.push(...document.querySelectorAll('#phoneTop, #toasts, .doubt, .mental, .shield, .xp-row'));
      const zones = reserved.map(el => {
        const r = el.getBoundingClientRect();
        return { x: (r.left - stageRect.left) / scale - 3, y: (r.top - stageRect.top) / scale - 3,
          w: r.width / scale + 6, h: r.height / scale + 6 };
      });
      U5.noDrawZones.splice(0, U5.noDrawZones.length, ...zones);
    }
  }
  let effectsDrawn = true;
  function drawEffects() {
    const busy = particles.length || flights.length || numbers.length || badges.length;
    if (!busy && !effectsDrawn) return;
    effectsDrawn = !!busy;
    ctx.clearRect(0, 0, layoutWidth, layoutHeight);
    ctx.save();
    // Intersect individual exclusions so overlapping reserved regions stay clear.
    for (const z of U5.noDrawZones) {
      ctx.beginPath(); ctx.rect(0, 0, layoutWidth, layoutHeight);
      ctx.rect(z.x, z.y, z.w, z.h); ctx.clip('evenodd');
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i], t = (clock - p.start) / p.life;
      if (t >= 1) { particles.splice(i, 1); continue; }
      if (t < 0) continue;
      const x = p.x + p.dx * t, y = p.y + p.dy * t + (p.finale ? 10 : 28) * t * t;
      ctx.globalAlpha = 1 - t; ctx.fillStyle = p.color;
      if (p.finale) {
        ctx.save(); ctx.font = '16px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.shape === 'card' ? '🃏' : '🪙', Math.round(x), Math.round(y)); ctx.restore(); continue;
      }
      const sheets={card:'card-shards',cardrain:'card-shards',coin:'coin-spark',ring:'ring-flash',silk:'ribbon',sponge:'puff',dove:'feathers',cheer:'heart-pop',showtime:'shockwave',critical:'critical'};
      const sheet=p.shape && p.shape !== 'critical' && assetImage('assets/ui/fx-'+sheets[p.shape]+'.png');
      if(sheet?.complete&&sheet.naturalWidth){if(!p.sheetLead)continue;ctx.imageSmoothingEnabled=false;ctx.drawImage(sheet,Math.min(3,Math.floor(t*4))*32,0,32,32,Math.round(x)-16,Math.round(y)-16,32,32);
      } else if(p.shape==='showtime'){
        ctx.beginPath();ctx.moveTo(x,y-12);ctx.lineTo(x-8,y+8);ctx.lineTo(x+8,y+8);ctx.closePath();ctx.globalAlpha*=.3;ctx.fill();
      } else if(p.shape){
        ctx.font=`${p.size*2+4}px Galmuri11`;
        const shapes={card:'▱',coin:'·',ring:'○',silk:'∿',sponge:'●',dove:'⌁',cardrain:'▱',cheer:'♥',showtime:'△'};
        ctx.fillText(shapes[p.shape]||'·',Math.round(x),Math.round(y));
      } else if (p.line) {
        ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + p.dx * .35, y + p.dy * .35); ctx.stroke();
      } else if (p.square) { const s = p.size * 2; ctx.fillRect(Math.round(x) - p.size, Math.round(y) - p.size, s, s); }
      else star(x, y, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    for (let i = badges.length - 1; i >= 0; i--) {
      const b = badges[i];
      // The case is the origin. Common drops are icon-only in every layout.
      const named = ['rare', 'hero', 'legend', 'myth'].includes(b.rarity);
      const color = D.items.rarities.find(r => r.id === b.rarity)?.color || '#ffe35b';
      fly(b.x, b.y, portraitLayout() ? portraitDropTarget(b.effect) : target(b.effect), b.emoji || b.icon, named ? String(b.name || '').slice(0, 12) : '', color, 0, b.image);
      badges.splice(i, 1);
    }
    const paintFlight = f => {
      const t = (clock - f.start) / f.life;
      const arc = f.arc === 'up'
        ? p => {
          const dx = f.tx - f.x, dy = f.ty - f.y, len = Math.hypot(dx, dy) || 1, s = Math.sin(Math.PI * p);
          return { x: f.x + dx * p + (-dy / len) * 12 * s, y: f.y + dy * p - 24 * s };
        }
        : p => ({ x: f.x + (f.tx - f.x) * p, y: f.y + (f.ty - f.y) * p - 24 * Math.sin(Math.PI * p) });
      ctx.fillStyle = f.color;
      for (let p = Math.max(0, t - .04); p < t; p += .06) {
        const a = arc(p); ctx.fillRect(Math.round(a.x) - 1, Math.round(a.y) - 1, 2, 2);
      }
      const a = arc(t); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.imageSmoothingEnabled = false;
      const pop = f.arc === 'up' && t > 0.86 ? 1 + 0.28 * Math.sin((1 - t) / 0.14 * Math.PI) : 1;
      const size = 48 * pop;
      ctx.font = '42px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; if (f.image && f.image.complete && f.image.naturalWidth) ctx.drawImage(f.image, a.x - size / 2, a.y - size / 2, size, size);
      else ctx.fillText(f.emoji, a.x, a.y);
      if (f.label) {
        ctx.font = '700 11px Galmuri11'; ctx.lineWidth = 5; ctx.strokeStyle = '#000';
        ctx.strokeText(f.label, a.x, a.y + 34); ctx.fillText(f.label, a.x, a.y + 34);
      }
    };
    const rising = [];
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i], t = (clock - f.start) / f.life;
      if (t >= 1) { if (f.pop) landPop(f.pop); flights.splice(i, 1); continue; }
      if (t < 0) continue;
      // Portrait throws cross the stats band. Draw them after the HUD clip so the icon stays visible the whole way up.
      if (f.arc === 'up' && portraitLayout()) { rising.push(f); continue; }
      paintFlight(f);
    }
    for (let i = numbers.length - 1; i >= 0; i--) {
      const n = numbers[i], t = (clock - n.start) / n.life;
      if (t >= 1) { numbers.splice(i, 1); continue; }
      ctx.globalAlpha = t < .6 ? 1 : (1 - t) / .4;
      ctx.font = `700 ${n.size||14}px Galmuri11`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.fillStyle = n.color;
      const progress=n.tier===4?(t<.24?t*.4:.096+(t-.24)*(.904/.76)):t;
      const y = Math.round(n.y - (reduced || n.fixed ? 0 : progress*(14+(n.tier||0))));
      const nx=Math.round(n.x+(!reduced&&n.tier===1?Math.sin(t*Math.PI)*8:0));
      const width=Math.max(ctx.measureText(n.text).width+6,n.critical?ctx.measureText(n.text).width+14:0), radius=!reduced&&n.tier>=3?8+t*16:0;
      if(!U5.clearOfZones({x:nx-Math.max(width/2,radius),y:y-Math.max(n.size/2+3,radius),w:Math.max(width,radius*2),h:Math.max(n.size+6,radius*2)}))continue;
      if(radius){ctx.strokeStyle=n.color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(nx,y,radius,0,Math.PI*2);ctx.stroke();}
      if(n.critical){const bw=Math.max(44,Math.ceil(width));ctx.fillStyle='#261b2b';ctx.fillRect(nx-bw/2,y-10,bw,20);ctx.strokeStyle='#eac568';ctx.lineWidth=1;ctx.strokeRect(nx-bw/2,y-10,bw,20);ctx.fillStyle=n.color;}
      ctx.save();ctx.translate(nx,y);if(!reduced&&n.tier===2){const punch=1+.12*Math.max(0,1-t*4);ctx.scale(punch,punch);}ctx.strokeStyle=n.tier===4?'#c99e4d':'#17121d';ctx.lineWidth=n.tier===4?3:2;ctx.strokeText(n.text,0,0);ctx.fillText(n.text,0,0);ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.restore();
    if (rising.length) { ctx.save(); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false; for (const f of rising) paintFlight(f); ctx.restore(); }
  }

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
  function speakerPortrait(name){
    if(D.storyV15.portraits[name])return D.storyV15.portraits[name];
    if(name==='같은 반 여학생')return 'assets/aud-s1-classmate.png';
    if(name==='수학 선생님')return 'assets/aud-s1-teacher.png';
    if(name==='밍기리')return state.trophies.theater?'assets/aud-mingiri-dark-happy.png':'assets/aud-mingiri-dark.png';
    if(name==='어린 칼리')return 'assets/aud-young-kali.png';
    if(name==='완벽한 칼리')return 'assets/aud-perfect-kali.png';
    if(name==='수상한 샵 매니저')return 'assets/serona-hooded.png';
    if(name==='NDD')return 'assets/aud-tutorial-dogyeom'+(state.u15.tutorial.won?'-happy':'')+'.png';
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
  function typeLine(p,text){
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
  function renderDialog(lines,index,key,advance,skip){
    const host=$('storyDialog');host.hidden=false;clearDecorations();
    if(dialogKey===key+':'+index)return;dialogKey=key+':'+index;host.replaceChildren();
    const line=lines[Math.min(index,lines.length-1)],art=element('span',line.speaker==='칼리'?'🎩':'👤','story-portrait');
    if(line.speaker==='칼리'){const mood=line.mood||D.lineFaces.moods[u25DialogMoodKey(key,index)]||'serious';art.classList.toggle('future-suit',state.u18.equipped.kali==='future');if(['sad','surprised'].includes(mood))sprite(art,'assets/kali-react-'+mood+'.png');else moodSprite(art,kaliArtPath(),mood);}
    else if(key.includes('lecturenote')&&line.speaker==='세로나')sprite(art,'assets/serona-reveal.png');
    else if(key.startsWith('tutorial:')&&line.speaker==='세로나')moodSprite(art,'assets/serona.png',line.mood||'serious'); // tutorial helper, not the lecturenote 세로나 sprite and not 밍기리
    else{const a=D.venues.flatMap(v=>C.roster(v)).find(a=>a.name===line.speaker);const moodKey=u25DialogMoodKey(key,index);moodSprite(art,speakerPortrait(line.speaker),line.mood||D.lineFaces.moods[moodKey]||D.lineFaces.faceMap.roleDefaults[a?.role]||'serious');}
    { const after=lines[index+1]; if(after){ const p=after.speaker==='칼리'?kaliArtPath():(key.startsWith('tutorial:')&&after.speaker==='세로나'?'assets/serona.png':speakerPortrait(after.speaker)); if(p)assetImage(p); } } // v4 U49 3: warm the next speaker's portrait
    const copy=element('div','','story-copy'),lineText=element('p','');copy.append(element('strong',line.speaker),lineText);typeLine(lineText,line.text); // v4 U47 4: typed per character; a tap completes the line, the next tap goes on
    // v4 U51 2/3: every line has the same two buttons, 건너뛰기 and 다음 (the last line's 다음 closes the lines the same way; there is no 무대 시작
    // button any more, the stage starts by itself about 1 s after the lines are over, see autoStartStage).
    const next=action('다음',()=>{if(finishTypingNow())return;if(!lineStep())return;advance();save();}),dismiss=action('건너뛰기',skip);next.className='line-next u26-primary';dismiss.className='line-skip';host.append(art,copy,dismiss,next); // v4 U50b: DOM (and Tab) order = visual order, 건너뛰기 then 다음 (다음 is the rightmost button, right thumb)
    host.onclick=e=>{if(e.target.closest('button'))return;if(finishTypingNow())return;if(!lineStep())return;advance();};
  }
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
  function chainDuringLine() {
    const mark = chainMark();
    if (!mark || state.u15.tutorial.active || !mark.step.endsWith('-fight')) return '';
    const pack = D.storyV15.tutorial.schoolChain;
    const line = mark.step.startsWith('teacher') ? pack.teacherDuring[0] : pack.girlDuring[0];
    return line ? line.text : '';
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
    const step = mark.step;
    if (chainBackup) replaceState(C.deserialize(chainBackup));
    chainFighting = false; chainBackup = '';
    state.onboarding.intro = true;
    setChain(step, 0);
    lastAudience = '';
    toast('다시 한 번 보여 주세요');
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
    const advance = () => {
      if (mark.line + 1 < lines.length) setChain(mark.step, mark.line + 1);
      else if(mark.step==='lesson-intro')beginNdd();
      else setChain(CHAIN_AFTER[mark.step] || 'girl-intro', 0);
    };
    renderDialog(lines, mark.line, 'tutorial:' + mark.step, advance, endSchoolTutorial);
    return true;
  }
  function renderU15(){
    const u=state.u15,t=u.tutorial,glove=$('item-auto-glove');
    if(glove){const deck=C.hasDeck(state),left=u.gloveLeft,sec=Math.ceil(left/1000);glove.classList.toggle('glove-active',left>0);glove.querySelector('small').className='item-count';glove.hidden=!deck&&u.gloves===0&&left===0;glove.disabled=paused()||state.mode!=='fight'||left>0||u.gloves<1;glove.setAttribute('aria-pressed','false');glove.querySelector('small').textContent=left>0?(sec>=60?`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`:sec+'초'):u.gloves+'개';glove.setAttribute('aria-label',left>0?`칼리 덱 자동 연습 중 · 남은 시간 ${sec}초 · ${u.gloves}개 보유`:`칼리 덱 쓰기 · ${u.gloves}개 보유`);if(left>gloveRun)gloveRun=left;if(!left)gloveRun=0;glove.style.setProperty('--cooldown',Math.min(1,left/Math.max(120000,gloveRun))*360+'deg');}
    if(renderSchoolChain()){updateAudienceLine();return;}
    if(t.active){
      if(t.won&&t.phase!=='overview')t.phase='defeat';
      if(t.phase==='fight'){
        $('storyDialog').hidden=true;dialogKey='';
        if(state.fightMs>40000&&state.onboarding.step>=4&&u.gloves===0&&u.gloveLeft===0)u.gloves=1;
        const coaching=D.storyV15.tutorial.coaching;
        const line=coaching[Math.min(coaching.length-1,Math.floor(state.fightMs/18000))];queueAudienceLine(line.text,'coaching:'+line.text);updateAudienceLine();
        return;
      }
      if(t.won&&$('audience').dataset.asset!=='assets/aud-tutorial-dogyeom-happy.png')sprite($('audience'),'assets/aud-tutorial-dogyeom-happy.png');
      const overview=D.storyV15.tutorial.overview;
      const lines=t.phase==='overview'?overview:D.storyV15.tutorial[t.phase==='defeat'?'defeat':'intro'];
      const finish=()=>{endSchoolTutorial();};
      renderDialog(lines,t.line||0,'tutorial:'+t.phase,()=>{if((t.line||0)+1<lines.length)t.line=(t.line||0)+1;else if(t.phase==='intro'){t.phase='fight';t.line=0;}else finish();save();},finish);return;
    }
    // Story state owns the dialogue lifetime. Notifications may wait behind it, but cannot strand it in a held queue item.
    // Finish clear notices before opening the last story lines; a queued reward/banner must not appear
    // in the readable start pause afterwards. Ordinary queued toasts do not hold the stage.
    const transitionNotice=!!presentation.active?.stageTransition||presentation.items.some(item=>item.stageTransition);
    const storyBlocked=blockingSheetOpen()||transitionNotice||document.hidden||portrait()||!$('leaveConfirm').hidden||!$('offlineCard').hidden||!$('sceneCard').hidden||!$('banner').hidden||!!stageRewardHost;
    if(!storyBlocked&&!state.u18.anchor&&t.done&&(state.mode!=='transition'||state.idle.waiting||state.batchD.encore.phase==='choice'||state.batchD.rebirthOffer)&&!u.scene&&u.queue.length&&state.features.climax.left<=0)C.startScene(state);
    if(u.scene){const scene=u.scene,lines=D.storyV15.venues[scene.slug][scene.kind];renderDialog(lines,scene.line,'story:'+scene.dimension+':'+scene.slug+':'+scene.kind,()=>{C.advanceScene(state,false);save();},()=>{C.advanceScene(state,true);save();});}
    else{$('storyDialog').hidden=true;dialogKey='';}
    // v4 U51b 1: the 칼리 덱 auto path only moves the story lines on (every 2.5 s, and not under the menu, the leave question or the offline card); the
    // stage itself is started only by autoStartStage (all its guards and the 1 s pause), never directly from here.
    if(C.autoStage(state)&&(u.scene||state.idle.waiting)&&!blockingSheetOpen()&&!document.hidden&&!portrait()&&$('leaveConfirm').hidden&&$('sceneCard').hidden&&$('introStory').hidden&&$('offlineCard').hidden&&!stageRewardHost&&$('banner').hidden){
      $('autoIndicator').hidden=false;if($('autoIndicator').textContent!=='칼리 덱 자동 진행 중: 다음 무대로 이동해요')$('autoIndicator').textContent='칼리 덱 자동 진행 중: 다음 무대로 이동해요';
      const key=u.scene?u.scene.slug+':'+u.scene.kind+':'+u.scene.line:'stage:'+state.venue;
      if(renderU15.autoKey!==key){renderU15.autoKey=key;renderU15.autoAt=clock;}
      if(dialogTyping)renderU15.autoAt=clock;
      if(clock-renderU15.autoAt>=2500&&u.scene){C.advanceScene(state,false);save();}
    }else{renderU15.autoKey='';if($('autoIndicator').textContent!=='자동')$('autoIndicator').textContent='자동';}
    updateAudienceLine();
    autoStartStage(); // Check every rendered frame, including blocked frames, so closing a layer starts a fresh pause.
  }
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
  let batchDPanelKey='',batchDReplayFinish=null,batchDCutsceneTimer=null;
  function batchDLeavePanel(){
    clearTimeout(batchDCutsceneTimer);batchDCutsceneTimer=null;
    batchDPanelKey='';menu='';$('panel').hidden=true;previous=0;lastAudience='';moreReturn=false;
  }
  function runBatchDAction(kind){
    if(!C.batchDAction(state,kind))return false;
    batchDLeavePanel();save();render();return true;
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
    const lines=key==='twist'?[...t.intro,...t.hidden,...t.failures.flat(),...t.gift,...t.counter,...t.complete]:Object.values(D.storyReview.ifRoute[D.batchD.stages[key].script]).filter(Array.isArray).flat();
    showBatchDLines(key==='twist'?'반전 무대':D.batchD.stages[key].name,lines);
  }
  function drawOilWater(finish){
    let finished=false;const done=()=>{if(finished)return;finished=true;clearTimeout(batchDCutsceneTimer);finish();};
    const scene=element('div','','batch-d-scene');
    scene.append(element('p','오일 앤 워터 · 섞어도 다시 나뉘는 빨강과 검정'));
    const table=element('div','','batch-d-cards');table.setAttribute('aria-label','빨간 카드 세 장과 검은 카드 세 장이 세 번 섞였다가 나뉩니다');
    for(let i=0;i<6;i++){
      const card=element('div','','batch-d-card '+(i%2?'is-black':'is-red'));
      card.style.setProperty('--mixed',i);card.style.setProperty('--sorted',i%2?3+(i-1)/2:i/2);
      const img=document.createElement('img');img.src=assetUrl('assets/ui/'+(i%2?'monte-jack':'monte-queen')+'.png');img.alt=i%2?'검은 카드':'빨간 카드';
      card.append(img,element('span',i%2?'♠':'♥'));table.append(card);
    }
    scene.append(table,element('p',D.storyReview.twist.oilWater[0].text),action('장면 건너뛰기',done));$('panelBody').append(scene);
    clearTimeout(batchDCutsceneTimer);
    batchDCutsceneTimer=setTimeout(()=>{
      if(!scene.isConnected)return;
      scene.replaceChildren(element('h2','관객 대만족!'),element('p',D.storyReview.twist.oilWater[1].text),action('공연 마치기',done));sound('milestone');
    },reduced?150:D.batchD.twist.cutsceneMs);
  }
  function renderBatchD(){
    const b=state.batchD,t=b.twist,side=D.batchD.stages[b.side];
    if(side){
      $('venueName').textContent=side.name;$('doubtTitle').dataset.audience=side.character;
      $('doubtTitle').textContent=portraitLayout()?'의심':side.character+'의 의심';$('audience').setAttribute('aria-label',side.character);
      stageAudienceFace($('audience'),side.portrait,audienceDoubtStage());
      const lines=D.storyReview.ifRoute[side.script].beforeHeadliner;
      const index=Math.floor(state.fightMs/7000)%lines.length;
      queueAudienceLine(lines[index].text,'if:'+b.side+':'+Math.floor(state.fightMs/7000));updateAudienceLine();
      $('patternLabel').textContent='IF 공연 · 한 사람씩 마음을 건네요';
    }
    if(t.scene==='hidden'){
      $('hint').textContent='🃏 아직 마지막 마술이 남았다 · '+Math.ceil(t.left/1000)+'초';
      queueAudienceLine(D.storyReview.twist.hidden[0].text,'twist:hidden');updateAudienceLine();
    }else if(b.interference.left>0)$('hint').textContent=(b.interference.kind==='lock'?'🔒 잠깐 잠긴 케이스':'🙈 잠깐 가린 케이스')+' · '+Math.ceil(b.interference.left/1000)+'초';
    else if(b.encore.phase==='round')$('hint').textContent='앙코르 · '+Math.ceil(b.encore.left/1000)+'초 · 추가 보상 도전';
    const key=BatchDView.panel(b);
    if(!key||menu||state.u15.scene||state.u15.queue.length||presentation.busy||wonMoment||!$('offlineCard').hidden||!$('sceneCard').hidden||!$('leaveConfirm').hidden||!state.onboarding.intro)return;
    batchDPanelKey=key;openPanel('batchD',key==='encore'?'한 번 더 보여 줄까요?':key==='rebirth'?'멀티버스의 갈림길':'반전 무대');
    $('closePanel').textContent=key==='encore'?'인사하고 내려가기':key==='rebirth'?'본편 이어가기':'장면 건너뛰기';
    const body=$('panelBody'),scene=element('div','','batch-d-scene');body.append(scene);
    if(key==='encore'){
      scene.append(element('p','한 번만 더 도전해요. 성공하면 동전 보너스, 실패하면 멘탈이 조금 줄어요. 기본 보상은 유지돼요.'),action('앙코르',()=>runBatchDAction('encore')),action('인사하고 내려가기',()=>runBatchDAction('leave')));
    }else if(key==='rebirth'){
      scene.append(element('p',D.progressFork.mainChoice),action('렉쳐노트로 이어가기',()=>runBatchDAction('continue')),element('p',D.progressFork.ifChoice));
      if(b.ifRoute)scene.append(element('p','두 번째 공연의 갈림길이에요. 어린 칼리를 만나면 거울 속 무대가 열려요.'),action('어린 칼리 만나기',()=>{C.batchDAction(state,'continue');startBatchDSide('young');}));
      else scene.append(element('p','환생하면 처음부터 시작해요. 마술 실력 '+Math.round(D.batchD.rebirth.permanentBonus*100)+'%가 영구히 더해져요. 다시 멀티버스를 마치면 IF 무대를 고를 수 있어요.'),action('환생하고 IF 루트 열기',()=>runBatchDAction('rebirth')));
    }else if(key==='twist:cutscene')drawOilWater(()=>runBatchDAction('counter-finish'));
    else{
      const kind=key.split(':')[1],copy=D.storyReview.twist;
      const lines=kind==='failure'?copy.failures[Math.max(0,t.failures-1)]:copy[kind];
      for(const line of lines||[])scene.append(element('strong',line.speaker),element('p',line.text));
      if(kind==='failure')scene.append(element('p','놀라움으로 멘탈 붕괴 · '+t.failures+'/3 · 강화와 동전은 그대로예요'));
      if(kind==='gift')scene.append(element('p','비법 트레이스 무료 습득 · 멘탈 회복'));
      scene.append(action(kind==='counter'?'반격 피날레':kind==='failure'?'보스부터 재도전':'다음',()=>runBatchDAction(kind==='counter'?'counter':'twist-next')));
    }
    body.querySelector('button')?.focus();
  }
  function storyList(){
    openPanel('stories','이야기');
    const seen=state.u15.seen;
    const replayNames={twist:'반전 무대 · 세 번의 단서',oilWater:'반격 피날레 · 오일 앤 워터',young:'어린 칼리와의 대결',mirror:'거울 속 무대'};
    for(const key of BatchDView.replayKeys(state.batchD))$('panelBody').append(action(replayNames[key],()=>replayBatchD(key)));
    if(!seen.length)$('panelBody').append(element('p','한 번 본 이야기가 여기에 모여요.'));
    for(const key of seen){const [dimension,slug,kind]=key.split(':'),v=C.venueBySlug(slug);const labels={opening:'첫 인사',beforeHeadliner:'마지막 관객',afterClear:'공연 뒤'};
      $('panelBody').append(action(`차원 ${dimension} · ${v.name} · ${labels[kind]}`,()=>{moreReturn=false;closePanel();C.startScene(state,{dimension:Number(dimension),slug,kind});save();render();}));}
  }
  $('storyButton').addEventListener('click',storyList);sprite($('storyIcon'),'assets/icon-story.png');
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
  function installGuide() {
    installGuideShown = true;
    openPanel('install', '홈 화면에 추가');
    const ua = navigator.userAgent;
    const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|; wv\)/i.test(ua);
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const copy = inApp ? '다른 브라우저로 열기: 메뉴에서 외부 브라우저를 선택해 Chrome 또는 Safari로 열어 주세요.' : ios ? 'Safari에서 공유 버튼을 누르고 홈 화면에 추가를 선택한 뒤 추가를 누르세요.' : 'Chrome 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하세요.';
    $('panelBody').append(element('p', copy));
    if (installPrompt && !inApp && !ios) $('panelBody').append(action('설치', async () => { const prompt = installPrompt; installPrompt = null; try { await prompt.prompt(); } catch (e) {} }));
  }
  $('endingReplayButton').addEventListener('click', () => { if (state.u19.cleared) { endingStep = D.futureEnding.length; showEnding(); } });
  $('installButton').addEventListener('click', installGuide);
  let installGuideShown = !!state.trophies[D.venues[0].slug];
  function tickInstallGuide() {
    $('endingReplayButton').hidden = !state.u19.cleared;
    if (!installGuideShown && state.trophies[D.venues[0].slug] && !paused() && state.mode === 'fight' && !state.u15.scene) { installGuideShown = true; installGuide(); }
  }
  // Session-only counters: no storage and no network.
  const portraitStats = { enter: 0, rotate: 0, leave: 0 };
  window.magicShowPortraitStats = portraitStats;
  let statsPortrait = false;
  function countPortrait(rotated = false) {
    const next = portraitLayout();
    if (next !== statsPortrait) portraitStats[next ? 'enter' : 'leave']++;
    if (rotated) portraitStats.rotate++;
    statsPortrait = next;
  }
  window.addEventListener('resize', () => countPortrait());
  window.addEventListener('orientationchange', () => countPortrait(true));
  window.addEventListener('pagehide', () => { if (statsPortrait) { portraitStats.leave++; statsPortrait = false; } });
  countPortrait();
  const meanings=D.statMeanings;
  document.querySelectorAll('.stat').forEach((el,i)=>{if(i<3)el.append(element('small',meanings[['power','damage','mental'][i]],'stat-meaning'));});

  const MAX_FRAME_MS = 250;
  let lastRun = 0;
  function loop(now) {
    // U29: nothing runs while hidden; when paused with no effects on screen, 30 fps is enough.
    if (document.hidden) { previous = 0; requestAnimationFrame(loop); return; }
    // U35: 60 fps cap (120 Hz phones ran the whole render twice as often); a quiet stage (paused, or nothing drawn and no held press) idles at 30 fps.
    const quiet = !particles.length && !flights.length && !numbers.length && !badges.length && (paused() || !boardHolds.length);
    if (now - lastRun < (quiet ? 30 : 14)) { requestAnimationFrame(loop); return; }
    lastRun = now;
    // v4 U40: the three card rects are re-read every 8th frame (and after fit()), not every frame: they only move on resize, so the per-frame read at the top
    // forced a style recalculation (CSS animations dirty the style before every frame) for nothing. A stale rect is at most 8 frames old.
    if (geoAge++ % 8 === 0) { geo.clear(); rectOf($('stage')); rectOf($('board')); rectOf($('audience')); boardWidth(); }
    portrait();
    countPortrait();
    // U36: game time follows real time. The old 50 ms cap made the whole game run in slow motion below 20 fps (about 45 percent speed at the 9 fps
    // a phone reached late in the game: timers, attacks, fans, glove). A frame now advances up to 250 ms; Core steps it in 50 ms substeps.
    const dt = previous ? Math.max(0, Math.min(MAX_FRAME_MS, now - previous)) : 0;
    previous = now;
    tickScreenCare(dt, now);
    tickInstallGuide();
    if (!document.hidden) clock += dt * presentationRate(now); // v4 U46 A2: presentation clock only; the combat step below still gets the full dt
    drawEffects(); // v4 U40: drawn before this frame's combat step and DOM writes (see the note at the end of loop); effects born in the step start drawing next frame
    if (!paused()) {
      let remaining = dt * (debug ? 10 : 1);
      // Stop at a failure event, even at debug speed: Core already restarted.
      while (remaining > 0 && !paused()) {
        const freePractice = practiceOn && !boardHolds.length && state.mode === 'fight' && !(state.u15 && state.u15.gloveLeft > 0);
        const clocks = boardHolds.length ? boardHolds : (freePractice && practiceHold ? [practiceHold] : []);
        const slice = Math.min(50, remaining, ...clocks.map(p=>Math.max(.001,p.left)));
        // No targets during the intervals between UI pulses. Combat still advances
        // with the measured dt; the 0.001 ms press lets Core emit its instant hit.
        stepCombat(slice,{taps:[],holding:boardHolds.length>0 || freePractice});
        remaining -= slice;
        if (boardHolds.length && !paused()) {
          const next=C.advanceHolds(boardHolds,slice,C.wandRate(state)); boardHolds=next.holds;
          for (const point of next.pulses) pulse(point, 'hold');
        } else if (freePractice && practiceHold && !paused()) {
          // TODO core auto practice
          const next=C.advanceHolds([practiceHold],slice,C.wandRate(state)); practiceHold=next.holds[0];
          for (const point of next.pulses) pulseFreePractice(point);
        }
      }
    }
    // v4 U40: the canvas draw (drawEffects, above) goes before the DOM writes: setting ctx.font after them forced a style recalculation about 540 times in 10 s, 1.6 ms each at 4x CPU.
    flushNums(); renderU17(); render(); renderCoach(); updateLearningBadge(); nextToasts(dt); if (prefetchWinSeen && performance.now() >= prefetchLoadAt + 10000) prefetchNextVenue(state.venue); requestAnimationFrame(loop);
  }
  motion.addEventListener('change', e => {
    reduced = e.matches; particles.length = 0; flights.length = 0; numbers.length = 0;
    for (const el of document.querySelectorAll('*')) for (const animation of el.getAnimations()) animation.cancel();
  });
  document.addEventListener('visibilitychange', () => {
    release(); previous=0;
    if (practiceOn && !document.hidden) requestPracticeWake();
    $('feverOverlay').classList.toggle('fever-paused',document.hidden||paused()||state.mode!=='fight');
    if(document.hidden){C.markAway(state,Date.now());save();}
    else {receiveOffline(Date.now());save();showOffline();}
  });
  window.addEventListener('pagehide', save);
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  $('moreButton').addEventListener('click', () => {
    if(menu==='boo')return;
    // v4 U51 1: 메뉴 while a panel is open (desktop, where the top bar stays tappable) goes to the menu as the one layer: the panel closes first,
    // a panel that cannot be closed here (fail, ending, a busy dealer) keeps the menu shut.
    // v4 U51b 4: closing one panel can reopen another (a 도감 추억 replay goes back to 도감): keep closing while each close changes the panel (at most 3)
    if(menu){for(let i=0;i<3&&menu;i++){const was=menu;moreReturn=false;closePanel();if(menu===was)break;}if(menu)return;showMore();return;}
    if($('phoneMore').hidden)showMore();else hideMore();
  });
  // v4 U48 M: settings and other in-place entries (소리, 음악, 진동, 글자 속도, 앱 설치, links) keep the menu open and update in place. The menu gives
  // way only when the entry opened a panel (closing that panel comes back here) or left for the show (퇴장, 처음 안내).
  $('phoneMore').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const left = ['retreatButton', 'replayTutorial'].includes(b.id);
    if (menu && !left) moreReturn = true;
    if (menu || left || !$('introStory').hidden) { $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false'); }
  });
  $('statsButton').addEventListener('click', () => {
    if(phone){
      openPanel('stats','능력치');
      // v4 U38: the fight numbers come first and use the same units as the threat numbers on the audience card (per second, C.formatNumber).
      const F=C.formatNumber,th=C.threatInfo(state),mine=C.attackRate(state);
      const rows=[
        ['초당 연출','관객의 의심을 1초에 이만큼 줄여요',mine==null?'0/초':`${F(mine)}/초`],
        ['야유',th.last?'지금은 마지막 야유 한 번이 와요 (멘탈과 자신감을 합친 만큼 버텨요)':`야유 게이지가 가득 차면 이만큼 받아요 (${+th.every.toFixed(1)}초마다 한 번)`,th.last?`마지막 한 번 ${F(th.hit)}`:`한 번에 ${F(th.hit)}`]
      ];
      if(th.regen>0)rows.push(['의심 회복','관객의 의심이 1초에 이만큼 다시 차올라요',`${F(th.regen)}/초`]);
      rows.push(['멘탈',`야유를 버티는 힘 (가득 차면 ${F(state.mentalMax)})`,F(state.mental)]);
      rows.push(['자신감',`야유를 먼저 막아 줘요 (야유 한 번 ${F(th.hit)} 중 막는 양 ${F(th.block)})`,F(th.shield)]);
      rows.push([D.statNames.power,D.statMeanings.power,F(C.wandDamage(state))],[D.statNames.damage,D.statMeanings.damage,F(C.CONST.itemDamage*state._V)]);
      rows.push(['찐팬 도전 보너스',`관객마다 첫 찐팬 도전 성공이 마술 실력을 1% 올려요 (최대 ${Math.round(C.CHALLENGE_CAP*100)}%)`,`+${Math.round(C.challengeBonus(state)*100)}%`]); // v4 U46 C1
      for(const [name,meaning,value] of rows){const row=element('section','','easy-stat');row.append(element('h2',name),element('p',meaning),element('strong',value));$('panelBody').append(row);}
      // v4 U47 13: every cell is as tall as the tallest one (rows measured once, in px), so the boxes are one even grid.
      const grid=$('panelBody'),fitGrid=()=>{if(menu!=='stats')return;const cells=[...grid.querySelectorAll('.easy-stat')];grid.style.gridAutoRows='auto';grid.style.gridAutoRows=(Math.ceil(Math.max(0,...cells.map(c=>c.scrollHeight)))+4)+'px';};
      fitGrid();requestAnimationFrame(fitGrid);document.fonts?.ready?.then(fitGrid);
      return;
    }
    const expanded = $('statsButton').classList.toggle('expanded');
    $('statsButton').setAttribute('aria-expanded', String(expanded));
    document.querySelector('.stats').classList.toggle('phone-expanded', expanded);
  });
  $('banner').addEventListener('click',()=>{if(phone)presentation.finish();});
  setInterval(save, 5000);
  setInterval(() => {
    if (newerSave || restoring || !saveStore) return;
    try { saveStore.rollingBackup(); } catch (error) { /* Keep the current save when backup storage is full. */ }
  }, 300000);
  // Stable screen/audio integration hooks for U4 and U5.
  window.MagicShowUI = {
    motionMetrics:()=>({particles:particles.length,flights:flights.length,numbers:numbers.length,badges:badges.length,coinOrigin:clearMoment.origin||null,flightOrigins:flights.map(f=>[f.x,f.y])}), hitTier, openCurtainCall, openRestore, getState: () => state, startScene:C.startScene, storyList, renderU15, getHolds: () => boardHolds, startIntro, events, save, toast, banner, openPanel, closePanel, render, showFailure, showBoo, clearDecorations, opaqueSprites,
    openBook: tree, focusNode, openBestiary: bestiary, openMissions:drawMissions, renderCoach,
    openDealer: dealer, openGemShop:gemShop, openWardrobe:wardrobe, openMap:openStageMap, openCustomize:customize, drawDealer, openEnding: () => { if (state.seenEnding) { revealEnding = false; showEnding(); } },
    openRebirth: () => { if (state.seenEnding) showRebirth(); }, isPaused: paused, renderDialog, speakerPortrait, portraitFocus,
  };
  // v4 U50d test hook: show the current audience with a mood face through the normal path (sprite, opaque crop, tablet snap). v4 U51b 5: only under
  // automation (navigator.webdriver, true in the Playwright tests and the flag beforeunload already uses), so a player's console cannot freeze the faces.
  if (navigator.webdriver) window.MagicShowUI.audienceMood = mood => { audTestMood = mood || ''; if (!mood) return ''; const v = D.venues[state.venue - 1], a = v.audiences[state.j - 1] || v.headliner; const art = stageAudienceAsset(v, a); moodSprite($('audience'), art, mood); return art; };
  sprite($('magicianMini'), 'assets/magician-mini.png');
  renderOutfit();
  $('magicianMini').dataset.frame = '0';$('magicianMini').classList.remove('reacting');
  // v4 U47 3: the goal strip is plain text (no click): the notebook only opens from the fail panel, so the strip must not open it.
  $('gameLogo').textContent = D.title;
  $('gameLogo').setAttribute('aria-label', D.title);
  revealEnding = state.mode === 'ending' && state.endings.length === 1;
  updateSoundButton();
  initIdleControls();
  receiveOffline(Date.now());
  const launchSaved = save();
  for(const name of ['ui-panel','ui-panel-inner','ui-button','ui-button-pressed','ui-button-primary','ui-button-disabled','ui-bar-frame','ui-bar-frame-main','ui-board-cell','ui-board-cell-next','ui-top-bar','ui-dialog']){
    const image=assetImage('assets/ui/'+name+'.png');const failed=()=>document.body.classList.add('missing-'+name);if(image.complete&&!image.naturalWidth)failed();else image.addEventListener('error',failed,{once:true});
  }
  for(const name of ['card-shards','coin-spark','critical','feathers','heart-pop','puff','ribbon','ring-flash','shockwave'])assetImage('assets/ui/fx-'+name+'.png');
  let presentationLayoutPending=false;
  const refreshPresentation=()=>{
    if(presentationLayoutPending)return;presentationLayoutPending=true;
    requestAnimationFrame(()=>{
      presentationLayoutPending=false;cacheEffectZones();
      for(const context of [$('panelBody'),$('storyDialog'),$('phoneMore')]){
        const current=context.querySelector('.u26-primary');
        const preferred=context.querySelector('.stage-start:not([disabled]),.line-next:not([disabled]),.practice-enter:not([disabled]),.tree-buy:not([disabled])')|| /* v4 U51 2: a line window's 다음 is its primary button */(context.id==='phoneMore'?null:[...context.querySelectorAll('button:not([disabled])')].find(el=>!el.hidden&&!el.closest('.panel-tabs')&&!el.classList.contains('game-cup')&&!el.classList.contains('routine-card')&&!el.classList.contains('dealer-back')&&!el.closest('.cups-table')));
        if(current!==preferred){current?.classList.remove('u26-primary');preferred?.classList.add('u26-primary');}
      }
    });
  };
  const presentationObserver=new MutationObserver(records=>{
    if(records.some(r=>r.attributeName==='hidden'&&r.oldValue!==r.target.getAttribute('hidden')))autoStartStage.since=0;
    if(records.some(r=>r.type==='childList'?[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1):r.oldValue!==r.target.getAttribute(r.attributeName)))refreshPresentation();});
  for(const id of ['panelBody','storyDialog','phoneMore'])presentationObserver.observe($(id),{childList:true,subtree:true,attributes:true,attributeFilter:['disabled'],attributeOldValue:true});
  for(const id of ['panel','storyDialog','phoneMore','banner','leaveConfirm','sceneCard','introStory','offlineCard'])presentationObserver.observe($(id),{attributes:true,attributeFilter:['hidden'],attributeOldValue:true});
  window.addEventListener('resize',refreshPresentation);motion.addEventListener('change',refreshPresentation);
  refreshPresentation();
  $('audience').addEventListener('click',()=>{replayAudienceLine();renderU15();});
  $('audience').setAttribute('tabindex','0');$('audience').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();replayAudienceLine();renderU15();}});
  // v4 U46 A5: static icons once, and the panel / menu sheets whenever their content is rebuilt (they change rarely; the per-frame HUD uses pxText).
  for (const el of [document.querySelector('.stats'), $('shield'), document.querySelector('.hud'), $('coffeeButton')]) pxIcons(el);
  { const iconize = list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1 ? !n.classList.contains('px-icon') : n.nodeType === 3) pxIcons(n.nodeType === 1 ? n : n.parentElement); };
    for (const root of [$('panelBody'), $('phoneMore'), $('panel').querySelector('header')]) if (root) { pxIcons(root); new MutationObserver(iconize).observe(root, { childList: true, subtree: true }); } }
  fit(); render(); showOffline();
  if(state.u18.map)openStageMap();
  if (!state.onboarding.intro) startIntro(false);
  if (seasonReset) toast('새 테스트가 시작됐어요. 처음부터 다시 즐겨 주세요!');
  if (corrupt) toast('저장을 불러오지 못해 백업해 두었어요');
  if (recoveredSave) toast('저장이 손상돼 최근 백업에서 되찾았어요');
  if (repairedSave) toast('저장을 조금 고쳐서 불러왔어요');
  if (refundedCoins > 0) toast(`끝없는 비법이 정리돼서 동전 ${C.formatNumber(refundedCoins)}을 돌려받았어요`);
  if (refundedKeys > 0) toast(`칼리 덱이 비법으로 합쳐져서 책 ${C.formatNumber(refundedKeys)}개를 돌려받았어요`);
  if (state._deckGift > 0) toast(`칼리 덱이 이제 쓰는 아이템이 됐어요. 칼리 덱 ${state._deckGift}개를 드려요`); // v4 U48 A
  if (newerSave) showSaveNotice();
  if (giftEnded && launchSaved) toast('선물 기간이 끝나서 성장 속도가 원래대로 돌아왔어요');
  if (launchQuery.get('restored') === '1') {
    const v = D.venues[(state.vMax|0)-1];
    // Not toast(): the toast queue waits behind the offline-gain card, and this must be seen right away.
    const note = element('div',`이전 저장을 되찾았어요 · ${v && v.name ? v.name : `무대 ${state.vMax}`} · 동전 ${C.formatNumber(state.coins)}`,'save-version-notice');
    note.id = 'restoredNotice'; note.setAttribute('role','status'); document.body.append(note);
    setTimeout(() => note.remove(), 8000);
    try { const url = new URL(location.href); url.searchParams.delete('restored'); history.replaceState(null,'',url.href); } catch (error) { /* URL cleanup is cosmetic. */ }
  }
  if (restoring) { /* A restore is reloading the page; leave the list closed. */ }
  else if (launchQuery.get('restore') === '1') {
    openRestore();
    if (restoreNoBetter && saveStore && !inaccessible) $('panelBody').prepend(element('p','지금 저장이 가장 많이 진행된 저장이에요'));
  }
  if (inaccessible) toast('저장을 사용할 수 없어요. 공연은 계속돼요');
  // U36 TEMPORARY title screen (owner art). It is plain markup in index.html (first paint). It fades out (250 ms, none under Reduce Motion) once the
  // game is ready and at least 1.2 s have passed since the page started, or at once on a tap. It never touches the game state, saves or the
  // install prompt. Browser automation (navigator.webdriver) skips it unless the URL has ?title=1, so tests and capture tools see the game directly.
  (function titleScreen() {
    const title = document.getElementById('titleScreen');
    if (!title) return;
    if (navigator.webdriver && launchQuery.get('title') !== '1') { title.remove(); return; }
    let leaving = false;
    const hide = () => {
      if (leaving) return; leaving = true;
      if (reduced) { title.remove(); return; }
      title.classList.add('leaving'); setTimeout(() => title.remove(), 300);
    };
    title.addEventListener('pointerdown', hide);
    setTimeout(hide, Math.max(0, 1200 - performance.now()));
  })();
  // v4 U47 6: leaving the game. A history guard entry (pushed at the first tap, because browsers skip entries made without a user gesture) turns the first
  // Back press (Android back, browser back, PWA back) into the in-game panel "저장하고 나갈까요?". The guard is not re-armed behind it, so a second Back
  // press at the page's first entry leaves natively (the browser exits or goes to the previous page; a page cannot close an installed app by itself).
  // [저장 칸에 저장] opens the save-slot panel and comes back here after a slot was written; [그냥 나가기] goes back at once; [계속하기] re-arms the guard.
  // beforeunload (tab close or reload where the browser allows it) auto-saves and asks the browser's own generic question only when there is progress and no
  // slot was written in the last 10 minutes; its text cannot be customised, and browsers show nothing on touch devices where the page was closed from the task list.
  let guardOn = false, leaveGo = false, leavePending = false, lastSlotSaveAt = 0;
  function armLeaveGuard() { if (guardOn) return; try { history.pushState({ magicLeaveGuard: 1 }, '', location.href); guardOn = true; } catch (error) { /* no history access: beforeunload below still applies */ } }
  function showLeaveConfirm(saved = false) {
    release(); $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false');
    $('leaveTitle').textContent = saved ? '저장했어요. 나갈까요?' : '저장하고 나갈까요?';
    $('leaveNote').textContent = saved ? '저장 칸에 남겼어요. 자동 저장도 계속 돼요.' : '자동 저장은 계속 돼요. 저장 칸에 따로 남겨 둘 수도 있어요.';
    $('leaveSave').textContent = saved ? '다른 칸에도 저장' : '저장 칸에 저장';
    $('leaveConfirm').hidden = false; $('leaveStay').focus();
  }
  window.addEventListener('popstate', e => {
    if (e.state && e.state.magicLeaveGuard) { guardOn = true; return; } // forward onto the guard entry
    if (!guardOn || leaveGo) return;
    guardOn = false; showLeaveConfirm();
  });
  document.addEventListener('pointerdown', () => { if (!guardOn && !leaveGo && $('leaveConfirm').hidden) armLeaveGuard(); }, true);
  $('leaveStay').addEventListener('click', () => { $('leaveConfirm').hidden = true; leavePending = false; armLeaveGuard(); });
  $('leaveSave').addEventListener('click', () => { $('leaveConfirm').hidden = true; openSaveSlots(); leavePending = true; });
  $('leaveNow').addEventListener('click', () => {
    leaveGo = true; leavePending = false; save(); $('leaveConfirm').hidden = true;
    try { history.back(); } catch (error) { /* nothing to go back to */ }
    setTimeout(() => { // still here: nothing came before this page (new tab, or the installed app's first screen)
      try { window.close(); } catch (error) { /* only script-opened windows can close */ }
      toast('뒤로가기를 한 번 더 누르면 나가요'); leaveGo = false;
    }, 500);
  });
  window.addEventListener('beforeunload', e => {
    if (restoring || leaveGo) return;
    save();
    let newest = lastSlotSaveAt;
    for (let n = 1; n <= 3; n++) { try { newest = Math.max(newest, SaveSlots.read(localStorage, n).slot?.savedAt || 0); } catch (error) { /* unreadable slot */ } }
    if (!navigator.webdriver && (state.wins > 0 || state.vMax > 1) && Date.now() - newest > 600000) { e.preventDefault(); e.returnValue = ''; }
  });
  // v4 U47 4: the 글자 속도 menu entry cycles 보통, 느리게, 빠르게 (빠르게 = the whole line at once); stored in the presentation settings.
  function updateTextSpeedButton(){const s=textSpeed(),b=$('textSpeedButton');b.textContent='글자 속도: '+TEXT_SPEED_LABEL[s];b.title=s==='fast'?'한 번에 보이기':'한 글자씩 나와요';b.setAttribute('aria-label','글자 속도 '+TEXT_SPEED_LABEL[s]+(s==='fast'?' (한 번에 보이기)':''));}
  $('textSpeedButton').addEventListener('click',()=>{uiSave.textSpeed=TEXT_SPEEDS[(TEXT_SPEEDS.indexOf(textSpeed())+1)%TEXT_SPEEDS.length];savePresentation();updateTextSpeedButton();});
  // A late font or a line changed between renders must settle before the next paint.
  document.fonts?.ready?.then(() => { invalidateStageAudience(); syncFlags(); });
  const audienceTextObserver = new MutationObserver(() => syncFlags());
  for (const id of ['audienceLine', 'patternLabel', 'phaseIndicator', 'toasts']) audienceTextObserver.observe($(id), { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
  updateTextSpeedButton();
  mountRound8();
  requestAnimationFrame(loop);
})();

// Lane 1g: presentation-only adornments retain the existing handlers and save model.
(function installKitV2() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const menu = document.getElementById('phoneMore');
  const title = document.createElement('h2');
  title.className = 'kit-menu-title'; title.textContent = '메뉴 · 설정'; menu.prepend(title);
  const decorate = root => {
    if (!(root instanceof Element)) return;
    const close = document.getElementById('closePanel');
    const closeLabel = close.textContent.trim();
    const simpleClose = ['닫기', '뒤로', '← 뒤로'].includes(closeLabel);
    close.classList.toggle('kit-close', simpleClose);
    if (simpleClose) close.setAttribute('aria-label', closeLabel);
    for (const tile of root.querySelectorAll('.shop-cosmetic-tile')) {
      const equipped = tile.getAttribute('aria-pressed') === 'true';
      tile.classList.toggle('kit-locked', !equipped && !!tile.querySelector('.shop-cosmetic-lock'));
      if (equipped && !tile.querySelector('.kit-equipped')) {
        const badge = document.createElement('img'); badge.src = 'assets/kit/badge-equipped.webp';
        badge.alt = '착용 중'; badge.className = 'kit-equipped'; tile.append(badge);
      }
    }
    for (const price of root.querySelectorAll('.shop-cosmetic-tile small')) {
      if (/^실크\s*\d/.test(price.textContent.trim())) price.classList.add('kit-price');
    }
    for (const lock of root.querySelectorAll('.shop-cosmetic-lock')) {
      if (lock.querySelector('.kit-lock-mark')) continue;
      const icon = document.createElement('img'); icon.src = 'assets/kit/icon-lock.webp';
      icon.alt = ''; icon.className = 'kit-lock-mark'; lock.prepend(icon);
    }
  };
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; decorate(stage); });
  });
  for (const id of ['panelBody', 'phoneMore', 'closePanel']) {
    observer.observe(document.getElementById(id), { childList:true, subtree:true, characterData:true });
  }
  decorate(stage);
})();
