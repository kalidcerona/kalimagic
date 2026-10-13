/* Pure U5 presentation models shared by runtime and tests. */
globalThis.U5 = (() => {
  const effects = {
    power: ['🪄', '마술 실력', 'stat-power'], damage: ['🃏', '연출', 'stat-damage'],
    shield: ['🛡️', '자신감', 'stat-guard'], heal: ['🥤', '멘탈 회복', 'stat-heal'],
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
    const choices = pool.filter(line => line !== previous);
    const list = choices.length ? choices : pool;
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
    const costText = !node ? '' : info.cost === null ? '완성' : info.purchasable ? '배울 수 있어요!' : remaining ? `${{coins:'동전',gems:'보석',keys:'열쇠',starlight:'별빛'}[info.currency]} ${C.formatNumber(remaining)} 더` : info.blockedReason;
    // v4 U38: with nothing left to learn the strip says so (friendly, no node to point at); otherwise it keeps pointing at the notebook.
    const done = !node && C.allLearned(state);
    const nodeText = node ? node.name : done ? '모든 비법을 익혔어요' : '비법 노트를 열어 보세요';
    const learn = node ? `${nodeText} · ${costText}` : nodeText;
    return { node, done, progress, nodeText, costText, caseText: `개봉 ${progress}%`, targetText: learn, text: `다음 목표 · 개봉 ${progress}% · ${learn}` };
  }
  // U31b: the cause line is a soft guess plus a soft suggestion. cause = how this run really ended:
  // 'mental' (mental ran out with little doubt left) or 'damage' (mental ran out while much doubt was left).
  function failure(state,D,C,cause='mental') {
    if (cause === 'gate') return { line: '이 관객은 준비가 조금 더 필요해 보여요. 비법을 몇 개 더 익혀 보면 어떨까요?', node: null, hint: C.failureHint(state, 'gate') || "'야유 받아넘기기'가 도움이 될지도 몰라요" };
    // v4 U38 'lastHeckle': the final boss's announced last heckle was bigger than 멘탈 and 자신감 together; the line names both ways out and picks none.
    if (cause === 'lastHeckle') return { line: '마지막 야유가 한 번에 너무 컸나 봐요. 멘탈이나 스킬을 다시 살펴볼까요?', node: null, hint: C.failureHint(state, 'lastHeckle') };
    // v4 U38 'stall': doubt did not reach a new low for a long time, so the soft suggestion is about taking doubt down faster.
    const stall = cause === 'stall';
    const damage = cause === 'damage' || stall;
    const ids = damage ? ['attack','power','speed'] : ['mental','shieldCap','openingShield','calm','boxHeal','winHeal'];
    const first = ids.map(id => D.tree.find(n=>n.id===id)).find(n => n && C.nodeInfo(state,n.id).revealed && C.nodeInfo(state,n.id).cost !== null) || null;
    // v4 U41: a suggestion the wallet cannot pay is replaced by the best node of the whole book that can be bought now (Core.failureLessons);
    // with nothing to buy at all the hint is Core.failureHint (nearest block, case levels), not a recommendation the player cannot act on.
    const payable = first && C.nodeInfo(state,first.id).purchasable ? first : (C.failureLessons(state).find(n => n.id.indexOf('gate:') !== 0 && !n.productMultiplier) || null);
    const node = payable || first;
    const code = node ? node.name.charCodeAt(node.name.length - 1) : 0;
    const particle = code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 === 0 ? '를' : '을';
    const guess = stall ? '관객의 의심이 다시 차오르는 게 더 빨랐나 봐요.' : damage ? '의심을 깎을 힘이 조금 모자랐나 봐요.' : '야유를 버틸 멘탈이 부족했나 봐요.';
    const line = stall ? `${guess} 비법을 몇 개 더 익혀 보면 어떨까요?` : node ? `${guess} 한번 ${node.name}${particle} 높여 보면 어떨까요?` : guess;
    return { line, node, hint: payable ? `'${payable.name}' 비법이 도움이 될지도 몰라요` : (C.failureHint(state, cause) || (node ? `'${node.name}' 비법이 도움이 될지도 몰라요` : '')) };
  }
  function firstEffects(state,list) {
    const hits = list.filter(e => (e.type === 'boxHit' || e.type === 'boxBreak') && e.source === 'manual');
    return [
      ['range', state.tree.area > 0 && new Set(hits.map(e=>e.cell)).size > 1, '범위 비법 덕분에 여러 케이스를 함께 두드렸어요!'],
      ['helper', list.some(e=>e.type==='worker' && e.phase==='work' || ['dove','rabbit','magicHit','magicCoins'].includes(e.type)), '도우미 비법 덕분에 칼리와 함께 마술을 하고 있어요!'],
      ['chain', list.some(e=>e.type==='chain'), '연쇄 비법 덕분에 옆 케이스까지 타격이 이어졌어요!'],
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
      this.items.sort((a,b)=>(b.priority||0)-(a.priority||0)||a.serial-b.serial);
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
  function figureSize(path) {
    if(/mingiri|past-kali|kali-past|aud-a108(?:-|\.)/.test(path))return 'small';
    return /headliner-|future-kali/.test(path)?'large':'regular';
  }
  // U32: on tablets the audience sprite is drawn at a whole-number multiple of its pixel size (no uneven pixel columns).
  function snapAudience(image) {
    const host = $('audience'), img = image || host.querySelector(':scope > .asset-sprite');
    if (!img) return;
    if (!document.body.classList.contains('tablet')) { img.style.height = ''; delete img.dataset.snap; return; }
    const apply = () => {
      const nat = img.naturalHeight, factor = host.dataset.figureSize === 'large' ? .95 : host.dataset.figureSize === 'small' ? .72 : .84;
      if (!nat || !host.clientHeight) return;
      let k = Math.max(1, Math.round(host.clientHeight * factor / nat));
      if (k > 1 && nat * k > host.clientHeight * 1.06) k--;
      img.style.height = `${nat * k}px`; img.dataset.snap = String(k);
    };
    if (img.complete && img.naturalHeight) apply(); else img.addEventListener('load', apply, { once: true });
  }
  function sprite(host, path) {
    host.querySelectorAll(':scope > .asset-sprite').forEach(img => img.remove());
    host.classList.remove('asset-ready'); host.dataset.asset = path;
    const source = assetImage(path);
    const show = () => {
      if (host.dataset.asset !== path || !source.naturalWidth) return;
      host.querySelectorAll(':scope > .asset-sprite').forEach(img => img.remove());
      const image = source.cloneNode(); image.className = 'asset-sprite'; image.alt = '';
      if (/assets\/(?:aud-|headliner-)/.test(path)||host.classList.contains('story-portrait')&&/^assets\/kali-/.test(path)) {
        host.classList.add('normalized-figure');host.dataset.figureSize=figureSize(path);
        try { image.src=opaqueSprite(source,path,host.classList.contains('story-portrait')||host.classList.contains('dialogue-emoji')); }
        catch(error) { /* Keep the source if a cross-origin canvas is unavailable. */ }
      }
      if(/^assets\/(?:box-|case-)/.test(path)){try{image.src=opaqueSprite(source,path);}catch(error){ /* Keep fallback geometry if alpha access fails. */ }}
      host.append(image); host.classList.add('asset-ready');
      if (host.id === 'audience') snapAudience(image);
    };
    if (source.complete) show(); else source.addEventListener('load', show, { once: true });
  }
  const venueAsset = v => `assets/${v.venueAsset}`;
  const audienceAsset = (v, a) => a.portraitAsset ? `assets/${a.portraitAsset}` : a === v.headliner ? `assets/headliner-${a.id}.png` : `assets/aud-${a.id}.png`;
  function moodSprite(host,path,mood='doubt'){
    if(!path){host.dataset.mood=mood;return;}
    const emotes={happy:'😊',serious:'💭',surprised:'❗',sad:'💧',smug:'😏'};
    const paths=['happy','serious','surprised','sad'].includes(mood)?[path.replace(/\.png$/,'-'+mood+'.png')]:[path];
    if(mood==='surprised')paths.push(path.replace(/\.png$/,'-happy.png'));paths.push(path);
    host.dataset.mood=mood;host.dataset.emote=emotes[mood]||'';
    const attempt=i=>{if(host.dataset.mood!==mood)return;const source=assetImage(paths[i]);
      const ready=()=>{if(host.dataset.mood!==mood)return;if(source.naturalWidth){sprite(host,paths[i]);host.dataset.emote=i===0&&mood!=='smug'?'':emotes[mood]||'';}else if(i+1<paths.length)attempt(i+1);};
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
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer:coarse)').matches;
  let phone = false, layoutWidth = 1600, layoutHeight = 900;
  let reduced = motion.matches, scale = 1, clock = 0, previous = 0;
  let menu = '', focusBeforePanel = null, lastAudience = '', lastLayout = '';
  let dialogueTimer, dealerBusy = false, dealerMessage = '', dealerLost = false, dealerResult = '';
  let dealerPicked = new Set();
  let booTimer=null, failureAudience=null, failureVenue=null;
  let failureCause = 'mental', practiceRec = null;
  let saveWarning = false, failure = null, lastMode = '';
  let boardHolds = [];
  const pointer = { id: null, held: false, x: -1, y: -1, inside: false };
  const particles = [], flights = [], numbers = [], cells = [];
  let heartEls = null;
  let badges = [], wonMoment = null;
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
    if (loaded.state) { state = loaded.state; loaded0 = true; }
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
      return !!target && store.restore(target.key, true);
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
            SaveSlots.write(localStorage, n, state); openSaveSlots(); toast('저장 칸에 남겼어요');
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
  const saveSlotsButton = action('저장 칸', openSaveSlots);
  saveSlotsButton.id = 'saveSlotsButton';
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
  const portrait = () => { let v = geo.get('portrait'); if (v === undefined) { v = innerHeight > innerWidth; geo.set('portrait', v); } return v; };
  const presentation=new Presentation.Queue();
  const paused = () => wonMoment?.pending || state.u18.map || !!state.u15.scene || (state.u15.tutorial.active && (state.u15.tutorial.phase!=='fight' || state.u15.tutorial.won)) || !state.onboarding.intro || document.hidden || !!menu || portrait() || !!stageRewardHost || !$('offlineCard').hidden || (phone && !$('phoneMore').hidden);
  function fit() {
    const vv = window.visualViewport;
    const width = vv ? vv.width : innerWidth, height = vv ? vv.height : innerHeight;
    geo.clear(); wandOffset = null; geoAge = 0;
    const probe = getComputedStyle($('safeArea'));
    const safe = Object.fromEntries(['left','right','top','bottom'].map(side => [side, parseFloat(probe.getPropertyValue(`padding-${side}`)) || 0]));
    const layout = PhoneLayout.measure(width, height, safe, coarse, true);
    phone = layout.phone;
    document.body.classList.toggle('phone', phone);
    document.body.classList.toggle('tablet',!!layout.tablet);
    document.body.classList.toggle('phone-tight', phone && layout.height <= 340);
    document.body.classList.toggle('phone-compact',phone&&!layout.tablet&&layout.height<352);
    document.body.classList.toggle('phone-narrow',phone&&!layout.tablet&&layout.audience<260);
    document.body.classList.toggle('phone-low',phone&&!layout.tablet&&layout.height<320);
    document.body.classList.toggle('phone-xshort',phone&&!layout.tablet&&layout.height<300);
    document.body.classList.toggle('phone-short',phone&&!layout.tablet&&layout.height<400);
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
    stage.style.setProperty('--layout-height',`${layoutHeight}px`);
    stage.style.setProperty('--board-size', `${layout.board}px`);
    stage.style.setProperty('--audience-width', `${layout.audience}px`);
    const dpr = phone ? Math.min(2, window.devicePixelRatio || 1) : 1;
    canvas.width = Math.round(layoutWidth * dpr); canvas.height = Math.round(layoutHeight * dpr);
    canvas.style.width = `${layoutWidth}px`; canvas.style.height = `${layoutHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    caps.particles = phone ? 48 : (coarse ? 120 : 240); caps.icons = phone ? 8 : 24;
    particles.length = 0; flights.length = 0; numbers.length = 0; badges.length = 0;
    phoneChrome(); release(); previous = 0; snapAudience();
    if (menu === 'book') tree();
  }
  const chromeHomes = new Map();
  function moveChrome(el, host) {
    if (!chromeHomes.has(el)) chromeHomes.set(el, { parent: el.parentNode, next: el.nextSibling });
    host.append(el);
  }
  function phoneChrome() {
    if (phone) {
      moveChrome(document.querySelector('.venue-heading'), $('phoneVenue'));
      moveChrome(document.querySelector('.hud'), $('phoneWallet'));
      moveChrome($('goalStrip'),$('phoneTop'));
      moveChrome($('bookButton'),$('phoneTop'));
      moveChrome($('equipButton'),$('phoneTop'));
      moveChrome($('moreButton'),$('phoneTop')); $('moreButton').textContent='☰ 메뉴';
      for (const id of ['buyAllButton','bestiaryButton','storyButton','installButton','statsButton','dealerButton','rebirthButton','missionsButton','gemShopButton','mapButton','customizeButton','soundButton','musicButton','musicVolume','hapticsButton','retreatButton','helperControls','debug','coffeeButton','openChatButton']) moveChrome(id==='musicVolume'?$(id).parentElement:$(id), $('phoneMore'));
      $('bookButton').textContent = innerWidth<=740?'📖':'📖 비법'; $('equipButton').textContent=innerWidth<=740?'🎩':'🎩 마술용품'; $('moreButton').textContent=innerWidth<=740?'☰':'☰ 메뉴'; $('moreButton').setAttribute('aria-label','메뉴'); $('bestiaryButton').textContent = '📚 도감';
      $('buyAllButton').textContent='다 배우기';updateSoundButton();const on=window.Sfx?.musicEnabled();$('musicButton').textContent=on?'음악 ON':'음악 OFF';
      $('closePanel').textContent = '← 뒤로';
    } else {
      for (const [el, home] of [...chromeHomes].reverse()) home.parent.insertBefore(el, home.next?.parentNode === home.parent ? home.next : null);
      $('buyAllButton').textContent='모두 배우기';updateSoundButton();const on=window.Sfx?.musicEnabled();$('musicButton').textContent=on?'배경음악 켜짐':'배경음악 꺼짐';
      chromeHomes.clear(); $('moreButton').textContent='☰ 더보기'; $('equipButton').textContent='🎩 마술용품'; $('bookButton').textContent = '비법서'; $('bestiaryButton').textContent = '도감'; $('closePanel').textContent = '닫기';
    }
    $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false');
  }
  function boardTransform() { return PhoneLayout.transform(rectOf($('board')), C.CONST.boardSize); }
  function boardPoint(x, y) {
    const p = boardTransform().toScreen(x, y), r = rectOf($('stage'));
    return { x: (p.x - r.left) / scale, y: (p.y - r.top) / scale };
  }
  const toastQueue = [], visibleToasts = [];
  let lastToastKind = '';
  function toast(text,kind='') {
    presentation.push({merge:'toast:'+kind+':'+text,minimum:1200,start:item=>{
      const el=element('div',text+(item.extra?' · '+item.extra:''),'toast');$('toasts').append(el);item.end=()=>el.remove();
    }});
  }
  function milestonePop(text,p){presentation.push({merge:'milestone:'+text,minimum:1200,start:item=>{const el=element('div',text+(item.extra?' · '+item.extra:''),'toast');$('toasts').append(el);float('×2!',p.x,p.y,'#ffe65c',22);item.end=()=>el.remove();}});}
  function nextToasts(dt=0){
    presentation.tick(dt,!!menu||document.hidden||portrait()||!$('offlineCard').hidden||(phone&&!$('phoneMore').hidden)||state.features.climax.left>0);
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
      const snapshot = Object.assign({}, state, {
        comboMs: Math.max(0, state.comboMs),
        sealMs: Math.max(0, state.sealMs),
        transMs: Math.max(0, state.transMs)
      });
      if (!document.hidden) C.markAway(state,Date.now());
      snapshot.idle=state.idle;
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
  function banner(text,sub='',big=false,permanent=false,context=bannerContext()){
    presentation.push({merge:'banner:'+text,minimum:2000,priority:big?10:0,start:item=>{
      bannerActive={text,sub,big,permanent,...context};$('banner').replaceChildren(document.createTextNode(text));
      if(sub||item.extra)$('banner').append(element('small',[sub,item.extra].filter(Boolean).join(' · ')));
      $('banner').classList.toggle('big',big);$('banner').hidden=false;if(!reduced)animate($('banner'),[{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)',offset:.2},{opacity:1,offset:.8},{opacity:0,transform:'translateY(-4px)'}],2000);item.end=dismissBanner;
    }});
  }
  function nextBanner(){ /* All notices share presentation.tick. */ }
  function showStageReward(reward){
    presentation.push({minimum:2000,priority:20,start:item=>{
      const r=D.stageRewards[reward-1],host=element('button','','stage-reward');stageRewardHost=host;host.type='button';
      host.setAttribute('aria-label',r.effect+' · 눌러서 계속');const art=element('img');art.src='assets/reward-'+r.id+'.png';art.alt='';
      host.append(art,element('h2',r.effect),element('p',r.quote));$('stage').append(host);
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
    const count=Math.max(0,Math.min(8-nearby,Math.ceil((3+tier)*(state.features.encoreLeft>0?1.5:1))));
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
    one.classList.add('performing'); one.querySelector('.colleague-trick').textContent = colleagueTricks[(e.index + state.fails + state.wins) % colleagueTricks.length];
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
  function burst(x, y, color) {
    if (reduced) return;
    for (let i = 0; i < 8 && particles.length < caps.particles; i++) {
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
    if (reduced || flights.length >= caps.icons) return;
    flights.push({ x, y, tx: dest.x, ty: dest.y, emoji, label, color, image, start: clock + delay, life: 240 });
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
      const rot = 'rotate(-8deg)';
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
  function events(list) {
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
          image: assetImage(`assets/item-${b.itemId}.png`) };
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
        if (e.type==='learnAll') { tutorialSignal('learn'); tutorialSignal('buyAll'); toast(`비법 ${e.count}개 배움`); sound('coin'); const p=target('coins'); burst(p.x,p.y,'#ffe65c'); save(); }
      }
      if(e.type==='caseLevelUp')haptic(15);
      if(e.type==='skill'||e.type==='visitorCatch')haptic(40);
      if(e.type==='homecomingAct'||e.type==='phase2'||(e.type==='win'&&C.isHeadliner(D.venues[e.venue-1],e.j)))haptic([30,40,30]);
      if(e.type==='outfit'){renderOutfit();banner('새 무대 의상!',['','거실 티셔츠','무대 정장','우주 망토'][e.tier]);sound('milestone');const p=target('mental');burst(p.x,p.y,'#ffe65c');$('magicianMini').classList.add('outfit-sparkle');setTimeout(()=>$('magicianMini').classList.remove('outfit-sparkle'),650);save();}
      if(e.type==='trueFanReveal'){banner('숨은 도전 발견! 열렬한 찐팬','도감에서 새로운 도전을 확인해 보세요',false,true);sound('milestone');save();}
      if(e.type==='travelResult'){save();toast(e.success?`도전 성공!${e.gems?' 보석 +'+e.gems:''}`:'도전 종료 · 다시 도전할 수 있어요');openStageMap();}
      if(e.type==='routine')showRoutine(e.id);
      if(e.type==='futurePhase'){sound('finisher');$('routineCutin').hidden=true;if(e.phase===3)animate($('audience'),[{opacity:0},{opacity:1}],650);}
      if(e.type==='futureWin'){banner('미래의 나','다음 한 장은 네 몫이야');sound('ending');}
      if(e.type==='setBonus'){banner(e.slug==='collection'?'칼리 컬렉션 세트 완성!':'관객 세트 완성!',e.slug==='collection'?'연출 +10%':`${C.venueBySlug(e.slug).name} · 마술 실력 +3%`);sound('milestone');save();}
      if(e.type==='visitorCatch'){const r=$('eventVisitor').getBoundingClientRect(),stage=$('stage').getBoundingClientRect(),p={x:(r.left+r.width/2-stage.left)/scale,y:(r.top+r.height/2-stage.top)/scale};burst(p.x,p.y,'#ffe65c');toast(e.reward==='power'?'30초 마술 실력 ×2':e.reward==='coins'?`동전 +${C.formatNumber(e.amount)}`:'열쇠 +1');sound('event');save();}
      if (e.type === 'stageReward') {
        sound('milestone'); showStageReward(e.reward);
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
      if (e.type === 'finisher') { kaliPose(1,400); audSurprisedUntil = clock + 600; }
      if (e.type === 'crit') audSurprisedUntil = clock + 500;
      if (e.type === 'boxHit') squash(e.cell);
      if (e.type === 'boxBreak') {
        if (e.source === 'manual') kaliPose(1,400);
        squash(e.cell);
        const p = cellCenter(e.cell);
        const rarity = D.items.rarities.find(r => r.id === e.rarity);
        const color = rarity ? rarity.color : '#ffe35b';
        hitParticles(p.x,p.y,particleSource(e),color); sound('whoosh', { auto: !pointer.held });

        coinStream(p.x, p.y, 1);
        if (e.gem) fly(p.x, p.y, target('gems'), '💎');
      } else if (e.type === 'unlockReveal') {
        const labels = { slot: ['새 케이스 자리!', '옆자리에서도 마술을 시작해요'], area: ['지팡이가 넓어졌어요!', '여러 케이스를 한 번에 두드려요'], dove: ['마술 비둘기 등장!', '관객에게 날아가 감탄을 더해요'], rabbit: ['마술 토끼 등장!', '주머니에서 동전을 꺼내줘요'], boxHelper: ['팬들이 일을 도와요!', '케이스를 돌아가며 두드려요'], assistant: ['마술 어시스턴트 등장!', '황금 케이스 작업도 맡겨요'], equip: ['마술용품 해금!', '소품 3개 놓기 · 같은 종류가 더 잘 나와요'] };
        banner(...(labels[e.id] || ['숨은 비법 발견!', D.tree.find(n => 'hidden:' + n.id === e.id)?.name || '새 비법을 확인하세요']), true, true); save();
      } else if (e.type === 'comboMilestone') {
        toast(`콤보 ${e.threshold}! 피날레 +${e.gauge} · 동전 +${rounded(e.coins)}`);
      } else if (e.type === 'golden') {
        const p = cellCenter(e.cell); burst(p.x, p.y, '#ffe65c'); toast('황금 케이스! 희귀 이상 소품과 추가 동전');
      } else if (e.type === 'goldenBreak') {
        toast(`금빛 사례 +${C.formatNumber(e.coins)}`);
      } else if (e.type === 'achievement') {
        toast(`🏅 ${achievementLabels[e.id]} · 연출 +0.5%`);
      } else if (e.type === 'encore') {
        banner('피버 타임!',`${e.duration / 1000}초 · 마술 실력 ×2`);
      } else if (e.type === 'worker' && e.phase === 'work') {
        squash(e.cell); const host=workerActors[e.workerId];if(host)animate(host.querySelector('.asset-sprite')||host,[{transform:'translateY(0)'},{transform:'translateY(2px)'},{transform:'translateY(0)'}],140);sound('worker', { auto: true });const p=cellCenter(e.cell);float('+'+rounded(e.dmg),p.x-20,p.y,'#89d8c1',11);
      } else if (e.type === 'crit') {
        const p = cellCenter(e.cell);
        if(numbers.length>=caps.numbers)numbers.shift();float('CRITICAL',p.x,p.y-12,'#eac568',14,2);numbers[numbers.length-1].critical=true;hitParticles(p.x,p.y,'critical','#E8BF68',2);sceneLight(.06);
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
        if(e.source==='colleague'){if(!e.blocked)colleagueHitFx(e);}
        else hitFeedback(e,hitSource,e.presentationMaxDoubt||hitMaxDoubt);
      } else if (e.type === 'itemLand') {
        statFloat(e.effect, e.value);if(e.effect!=='damage'){const p=target(e.effect);hitParticles(p.x,p.y,hitSource,'#eac568');}
      } else if (e.type === 'finisher') {
        sceneLight(.08);
      } else if (e.type === 'heckleTelegraph') {
        const v = D.venues[state.venue - 1], a = C.audienceAt(v, state.j);
        const line = U5.selectHeckle(a, venueHeckles(state.venue), lastHeckles.get(a.id));
        lastHeckles.set(a.id, line); $('heckle').textContent = line;
        audHeckleMood = D.lineFaces.moods['fight:'+a.id+':heckles:'+a.heckles.indexOf(line)]||D.lineFaces.faceMap.roleDefaults[a.role]||'doubt';
        moodSprite($('audience'),audienceAsset(v,a),audHeckleMood);
      } else if (e.type === 'heckle') {
        if(e.dmg>=state.mentalMax*.2||e.critical){$('magicianMini').classList.add('reacting');$('magicianMini').dataset.face='event';sprite($('magicianMini'),'assets/kali-react-surprised.png');kaliUntil=clock+800;animate($('stage'),[{marginLeft:'0px'},{marginLeft:'2px'},{marginLeft:'0px'}],180);animate($('mental'),[{boxShadow:'0 0 0 3px #E8BF68'},{boxShadow:'none'}],150);}
        if (e.dmg > e.shieldDmg) float(`−${C.formatNumber(e.dmg - e.shieldDmg)} 멘탈`, 426, 714, '#ff8d8d');
        if (state.pattern === 'stealCoins') {
          for (let i = 0; i < 5; i++) fly(1230, 90, { x: 426 + i * 25, y: 320 }, '🪙', '', '#ffbd73', i * 25);
          patternPulse('동전을 가져갔어요');
        }
        if (e.shieldDmg) float(`방어 −${rounded(e.shieldDmg)}`, 676, 714, '#a8e8ff');
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
        prefetchWinSeen = true;
        const v = D.venues[e.venue - 1], a = C.audienceAt(v, e.j);
        const context = { ...U5.encounter(D.venues, state), venueSlug: v.slug, audId: a.id,
          encounterId: `${state.dimension}:${state.wins}:${state.fails}:${a.id}` };
        audience.restored=true;wonMoment = { v, a, context, pending:true,until:Infinity };
        presentation.push({winner:true,minimum:2500,priority:100,start:item=>{wonMoment.pending=false;wonMoment.until=clock+2500;C.holdWinTransition(state,2500);
          moodSprite($('audience'),audienceAsset(v,a),D.lineFaces.moods['fight:'+a.id+':winLine']||'happy');$('audienceLine').textContent=a.winLine;$('audienceLine').hidden=false;kaliPose(2,2500);
          sceneLight(.06);
          const head=C.isHeadliner(v,e.j),progress=`관객 ${e.j}/${v.audiences.length+1}`;
          bannerActive={...context};$('banner').replaceChildren(document.createTextNode(winLine()));$('banner').append(element('small',progress+' · '+(head?v.headliner.defeatLine:'동전 +'+C.formatNumber(e.coins))));$('banner').classList.add('win-banner');$('banner').hidden=false;
          const moment=clearMoment(head,e.coins);
          item.end=()=>{moment.stop();dismissBanner();wonMoment=null;};
        }});
        if (e.trophy) {toast(`🏆 ${v.trophy} 획득!`, 'trophy');presentation.push({minimum:0,hold:true,priority:60,start:item=>{if(!openCurtainCall(v.slug))item.hold=false;else item.end=()=>{};}});}
        if (e.keys) toast('🔑 관객 도감 완성! 열쇠 1개');
        save();
      } else if (e.type === 'venueUnlocked') {
        if (e.name) banner(`${e.name} 도착!`, D.venues[e.venue - 1].intro, true); save();
      } else if (e.type === 'fail') {
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
        $('audienceLine').textContent=e.line; patternPulse(e.line);
      } else if (['reviewApplause','jointApplause','heckleCancelled','curtainFinale'].includes(e.type)) {
        const message={reviewApplause:'좋은 한 수였어요',jointApplause:'함께 만든 박수',heckleCancelled:'질문 대신 박수',curtainFinale:'마지막 인사'}[e.type];
        patternPulse(message); toast(`👏 ${message}`); sound('milestone');
      } else if (e.type === 'ending') {
        revealEnding = state.endings.length === 1; endingStep = 0; save();
      }
    }
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
  function buildBoard() {
    if (lastLayout === 'fixed') return;
    lastLayout = 'fixed'; cells.length = 0; $('board').replaceChildren();
    for (let i = 0; i < C.CONST.boardMax; i++) {
      const p = C.cellPosition(state, i);
      const el = document.createElement('div'); el.className = 'cell working';
      el.style.gridColumn = p.col + 1; el.style.gridRow = p.row + 1;
      el.innerHTML = '<div class="box"><div class="lv"></div><div class="box-fill"></div><div class="chest"></div><div class="box-number"><span class="bitmap"></span><span class="percent-symbol">%</span></div><span class="spawn-timer"></span></div>';
      el.addEventListener('click', () => { if (i === state.board.length) toast(slotCondition()); });
      el.addEventListener('keydown', e => {
        if (i === state.board.length && ['Enter', ' '].includes(e.key)) { e.preventDefault(); toast(slotCondition()); }
      });
      $('board').append(el);
      cells.push({ el, box: el.querySelector('.box'), fill: el.querySelector('.box-fill'),
        num: el.querySelector('.bitmap'), lv: el.querySelector('.lv'), timer: el.querySelector('.spawn-timer') });
    }
  }
  function audience() {
    if(state.mode==='transition'&&state.resolved&&state.idle.next&&!audience.restored){const v=D.venues[state.venue-1],a=C.audienceAt(v,state.j);audience.restored=true;wonMoment={v,a,context:U5.encounter(D.venues,state),until:clock+state.transMs};moodSprite($('audience'),audienceAsset(v,a),D.lineFaces.moods['fight:'+a.id+':winLine']||'happy');$('audienceLine').textContent=a.winLine;$('audienceLine').hidden=false;}
    if (wonMoment && (wonMoment.pending||presentation.active?.winner||clock < wonMoment.until)) return;
    wonMoment = null;
    const v = D.venues[state.venue - 1];
    const a = state.u15.tutorial.active ? {name:'김도겸',emoji:'🙎',flavor:D.storyV15.tutorial.bio,bio:D.storyV15.tutorial.bio} : v.audiences[state.j - 1] || v.headliner;
    const key = `${state.dimension}:${state.u15.tutorial.active?'tutorial':state.audId}${state.pattern==='futureMirror'&&state.u19.phase===3?':true':''}`;
    if (key !== lastAudience) {
      lastAudience = key; pendingIntro = null;
      $('room').dataset.venue = v.slug;
      sprite($('room'), venueAsset(v));
      $('room').style.setProperty('--venue-bg1', v.palette.bg1);
      $('room').style.setProperty('--venue-bg2', v.palette.bg2);
      $('room').style.setProperty('--venue-accent', v.palette.accent);
      $('venueName').textContent = v.name;
      $('doubtTitle').textContent = `${a.name}의 ${['supporter','helper'].includes(a.role)?'기대':'의심'}`;
      $('audience').replaceChildren(element('span', a.emoji, 'sprite-fallback'));
      sprite($('audience'), state.u15.tutorial.active ? (state.u15.tutorial.won?'assets/aud-tutorial-dogyeom-happy.png':'assets/aud-tutorial-dogyeom.png') : (audienceAsset(v,a))); $('audience').setAttribute('aria-label', a.name);
      if(!state.u15.tutorial.active)moodSprite($('audience'),audienceAsset(v,a),['supporter','helper'].includes(a.role)?'happy':D.lineFaces.faceMap.roleDefaults[a.role]||'doubt');
      animate($('audience'),[{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}],350);
      $('audience').classList.toggle('headliner', a === v.headliner);
      $('audienceLine').textContent = a.encounterLine || a.bio || a.flavor;
      bioPending=a.encounterLine?key:state.u15.bios.includes(key)?'':key;bioUntil=0;
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
    }
    if (audience.winExit) { audience.winExit.cancel(); audience.winExit = null; } // the slide-out held the old audience hidden; the entrance above (if any) already runs
  }
  let kaliUntil = 0, kaliMoodState = 'normal', audMoodState = 'doubt', audSurprisedUntil = 0, audHeckleMood = '';
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
    if (menu === 'boo' || wonMoment || state.u15.tutorial.active || (state.pattern === 'futureMirror' && state.u19.phase === 3)) return;
    const v = D.venues[state.venue - 1], a = v && C.audienceAt(v, state.j), host = $('audience');
    if (!a || !host.dataset.asset) return;
    audMoodState = C.audienceMood(state, audMoodState, { heckle: state.telegraphed && state.mode === 'fight' ? audHeckleMood : '', surprised: clock < audSurprisedUntil });
    if (host.dataset.mood !== audMoodState) moodSprite(host, audienceAsset(v, a), audMoodState);
  }
  function kaliPose(frame,ms) {
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
      const shown=compact&&name==='cost'&&text.length>14?'비법 보기':text;
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
      el.hidden=!C.skillUnlocked(state,k.id);el.disabled=!ready||paused()||state.mode!=='fight';
      el.classList.toggle('ready',ready);el.classList.toggle('in-use',k.id==='showtime'&&state.skills.showtimeLeft>0);el.style.setProperty('--cooldown',`${Math.round(left/C.skillCooldown(state,k.id)*360)}deg`);
      el.querySelector('small').textContent=ready ? (k.id==='showtime' && state.skills.showtimeLeft>0 ? `${Math.ceil(state.skills.showtimeLeft/1000)}초` : k.hint) : `${Math.ceil(left/1000)}초`;
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
    const coins=state.features.progress.coinsEarned,health=state.mental+state.shield,aud=state.audId;
    const fight=state.mode==='fight' && state.features.climax.left<=0;
    const maxDoubt=state.audHpMax;
    const list=C.step(state,dt,input);
    list.filter(e=>e.type==='audHit').forEach(e=>e.presentationMaxDoubt=maxDoubt);
    if(fight)sampleRates(dt,list,state.features.progress.coinsEarned-coins,health-state.mental-state.shield,aud);
    events(list);return list;
  }
  function activateSkill(id) { if(paused())return;const coins=state.features.progress.coinsEarned,health=state.mental+state.shield,aud=state.audId;const maxDoubt=state.audHpMax;const list=C.useSkill(state,id);list.filter(e=>e.type==='audHit').forEach(e=>e.presentationMaxDoubt=maxDoubt);if(list.length){sampleRates(0,list,state.features.progress.coinsEarned-coins,health-state.mental-state.shield,aud);events(list);sound('skill');kaliPose(2,500);save();render();} }
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
    sprite(button.querySelector('.skill-art'),'assets/'+k.icon);button.addEventListener('click',()=>activateSkill(k.id));$('activeSkills').append(button);
  });
  const glove=action('',()=>{if(!paused()&&(C.hasDeck(state)?C.toggleDeck(state):C.useGlove(state))){tutorialSignal('learn');save();render();}});glove.id='item-auto-glove';glove.className='active-skill';
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

  function localDate(now=new Date()) { return `${String(now.getFullYear()).padStart(4,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; }
  function syncDaily() { const date=localDate();if(state.u14.daily.date!==date)C.setDailyDate(state,date); }
  let outfitPath='', outfitGeneration=0, collectionShown=state.u14.collection;
  function renderOutfit() {
    const path=kaliArtPath();
    if(outfitPath===path)return;outfitPath=path;const generation=++outfitGeneration,host=$('magicianMini');
    host.dataset.outfit=String(state.u14.outfit);host.classList.remove('performance-ready');
    const image=assetImage(path);
    const ready=()=>{if(generation!==outfitGeneration)return;if(image.naturalWidth===768 && image.naturalHeight===256){host.style.backgroundImage=`url('${assetUrl(path)}')`;host.classList.add('performance-ready');}else{host.style.backgroundImage='none';sprite(host,'assets/magician-idle.png');}};
    if(image.complete)ready();else {image.addEventListener('load',ready,{once:true});image.addEventListener('error',ready,{once:true});}
  }
  function renderU14() {
    syncDaily();renderOutfit();
    if(state.u14.collection&&!collectionShown){banner('칼리 컬렉션 세트 완성!','연출 +10%');sound('milestone');}collectionShown=state.u14.collection;
    const v=state.u14.visitor,host=$('eventVisitor');
    host.hidden=v.left<=0||C.visitorBlocked(state)||!!menu||document.hidden;
    if(!host.hidden){
      if(host.dataset.kind!==v.kind){host.dataset.kind=v.kind;host.replaceChildren();host.append(document.createTextNode(v.kind==='rabbit'?'🐇':'✍️'));const img=element('img');img.src=`assets/event-${v.kind==='rabbit'?'golden-rabbit':'fan-sign'}.png`;img.alt='';img.onload=()=>host.classList.add('visitor-art');img.onerror=()=>host.classList.remove('visitor-art');host.classList.remove('visitor-art');host.append(img);}
      host.style.left=`${6+(1-v.left/8000)*76}%`;host.setAttribute('aria-label',v.kind==='rabbit'?'황금 토끼 잡기':'사인 요청 팬 잡기');
    }
    const d=state.u14.daily,r=d.records[d.date]||{claimed:[],progress:{}},selected=C.dailySelection(d.date),remaining=selected.filter(id=>!r.claimed.includes(id)).length;
    if(missionsShown!==remaining){missionsShown=remaining;$('missionsButton').textContent='오늘의 공연';$('missionsButton').dataset.badge=remaining?String(remaining):'✓';$('missionsButton').setAttribute('aria-label',`오늘의 공연 · ${remaining}개 남음`);}
    $('hapticsButton').textContent=state.u14.haptics?'진동 켜짐':'진동 꺼짐';$('hapticsButton').setAttribute('aria-pressed',String(state.u14.haptics));
    if(menu==='missions' && dailyPanelSignature!==JSON.stringify(r))drawMissions();
  }
  let dailyPanelSignature='',missionsShown=-1;
  function artFallback(path,emoji,className='') {
    const host=element('span',emoji,className),img=element('img');img.src=path;img.alt='';img.onload=()=>host.classList.add('art-loaded');img.onerror=()=>host.classList.remove('art-loaded');host.append(img);return host;
  }
  function drawMissions() {
    syncDaily();const d=state.u14.daily,r=d.records[d.date]||{claimed:[],progress:{},bonus:false,streakReward:0},streak=d.latest&&C.dateOrdinal(d.date)-C.dateOrdinal(d.latest)>1?0:d.streak;openPanel('missions','오늘의 공연');dailyPanelSignature=JSON.stringify(r);
    const intro=element('div','','mission-heading');intro.append(artFallback('assets/icon-mission.png','🎯','u14-art'),element('p',`${d.date} · 연속 공연 ${streak}일`));$('panelBody').append(intro);
    const cycle=element('div','','streak-cycle');D.streakGems.forEach((g,i)=>{const day=element('span',`${i+1}일 · 💎 ${g}`);day.classList.toggle('current',streak>0&&(streak-1)%7===i);cycle.append(day);});$('panelBody').append(cycle);
    for(const id of C.dailySelection(d.date)){
      const m=D.missions.find(m=>m.id===id),done=r.claimed.includes(id),progress=Math.min(m.target,r.progress[id]||0),card=element('article','','daily-mission');
      card.classList.toggle('completed',done);card.append(element('strong',m.name),element('p',`${C.formatNumber(progress)} / ${m.target} · 💎 ${m.gems}${done?' · 보상 받음':''}`));const meter=element('progress');meter.max=m.target;meter.value=progress;meter.setAttribute('aria-label',m.name);card.append(meter);$('panelBody').append(card);
    }
    $('panelBody').append(element('p',r.bonus?'세 공연 완료 · 보너스 열쇠 +1 받음':'세 공연을 모두 마치면 열쇠 +1'),element('p',r.streakReward?`오늘 연속 공연 보석 +${r.streakReward} 받음`:'오늘 첫 미션을 마치면 연속 공연 보석을 받아요'));
  }
  let routineUntil=0;
  function showRoutine(id){
    if(menu||state.u15.scene||state.u15.queue.length||state.u15.tutorial.active||state.telegraphed||state.heckleMs<=C.CONST.telegraphMs||state.features.climax.left>0||C.bossProfile(state)==='future'&&state.u19.telegraph>0)return false;
    if(presentation.items.some(x=>x.routine===id)||presentation.active?.routine===id)return true;
    presentation.push({routine:id,minimum:1600,priority:5,start:item=>{paintRoutine(id);item.end=()=>{$('routineCutin').hidden=true;};}});return true;
  }
  function paintRoutine(id){
    const r=D.routines.find(r=>r.id===id);if(!r)return false;
    const panel=$('routineCutin');panel.replaceChildren();const art=element('div','✨','routine-strip');
    const path=`assets/routine-${id}.png`;art.style.backgroundImage=`url('${assetUrl(path)}')`;const image=assetImage(path);if(image.complete&&!image.naturalWidth)art.style.backgroundImage='none';
    panel.append(art,element('small',r.name));panel.hidden=false;panel.classList.remove('playing');void panel.offsetWidth;panel.classList.add('playing');routineUntil=clock+1600;return true;
  }
  function renderU19(){
    const future=C.bossProfile(state)==='future',u=state.u19;
    const warning=$('futureTelegraph');warning.hidden=!future||u.telegraph<=0;warning.textContent=u.phase===1?'네 쇼타임을 따라 할게.\n끝난 뒤에 나를 노려 봐.':['','','완벽한 루틴\n빛나는 칸을 계속 눌러 줘.','이게 진짜 미래의 나야.\n20초 동안 빛나는 칸만!'][u.phase];
    $('magicianMini').classList.toggle('future-suit',state.u18.equipped.kali==='future');
    if(menu||state.u15.scene)$('routineCutin').hidden=true;
    if(u.pending.length&&$('routineCutin').hidden&&showRoutine(u.pending[0]))u.pending.shift();
    document.querySelectorAll('#board .cell').forEach((el,i)=>el.classList.toggle('future-target',future&&u.phase>=2&&i===u.target&&(u.phase===2||u.window>0)));
  }
  // U36: state flags that style.css used to read through :has() selectors on #stage, #audienceCard and #activeSkills (see the U36 note in style.css).
  function syncFlags() {
    const stage = $('stage'), card = $('audienceCard'), skills = $('activeSkills'), coach = $('tutorialCoach');
    const story = !$('storyDialog').hidden, coachShown = !coach.hidden, statsx = !!card.querySelector('.stats.phone-expanded'), routine = !$('routineCutin').hidden;
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
    card.classList.toggle('f-routine', routine);
    // U39: the bubble wins over the pattern label. Measure only when the text, the label or the viewport changed (not every frame).
    const lineEl = $('audienceLine'), patEl = $('patternLabel'), both = phone && !lineEl.hidden && !!patEl.textContent;
    const tailKey = lineEl.hidden ? '' : lineEl.textContent + '|' + innerWidth + 'x' + innerHeight; // the tail sits at the bubble's upper third, so read its height once per text
    if (tailKey !== syncFlags.tailKey) { syncFlags.tailKey = tailKey; if (tailKey) card.style.setProperty('--line-h', lineEl.offsetHeight + 'px'); }
    const lineKey = both ? lineEl.textContent.length + '|' + patEl.textContent + '|' + innerWidth + 'x' + innerHeight : '';
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
  function render() {
    $('stage').classList.toggle('decorations-paused',paused());
    $('equipButton').hidden=!C.equipSlots(state); $('equipButton').classList.toggle('is-new',!!C.equipSlots(state)&&!state.guidance.seen.includes('equipButton'));
    renderU19();renderU14(); renderIdle(); renderU15();
    buildBoard(); if(menu!=='boo')audience(); nextBanner(); renderFeatures(); renderMagic(); renderGuidance(); renderColleagues();
    const home=C.bossProfile(state)==='homecoming';
    const boss = C.bossProfile(state)==='mirror';
    $('audienceCard').classList.toggle('final-boss', boss);
    $('audienceCard').classList.toggle('boss-mirror', boss && state.phase2);
    $('phaseIndicator').hidden = !boss && !home;
    $('phaseIndicator').textContent = state.phase2 ? `최종 공연 · 마지막 질문 · 확신 ${state.features.climax.confidence}%` : '최종 공연 · 의심의 거울';
    if (boss) $('patternLabel').textContent = state.phase2 ? '콤보 10마다 확신 +10% · 피날레 최대 ×2' : '15초마다 거울 케이스 2개 · 도우미와 연쇄로 열어요';
    $('starlightLabel').textContent = `✦ 별빛 ${state.starlight}`;
    if(home&&!wonMoment) {
      $('phaseIndicator').textContent=['','1막 · 준비한 한 수','2막 · 함께 만든 공연','3막 · 마지막 인사'][state.review.act];
      $('audienceLine').textContent=C.venueBySlug('lecturenote').headliner['act'+state.review.act+'Line'];
      $('patternLabel').textContent=['','별표 케이스를 열면 다음 질문을 쉬어요','직접 개봉과 도우미를 연결해요 · 도우미 없이 두 칸도 좋아요','개봉을 이어 마지막 피날레를 완성해요'][state.review.act];
      // v4 U38: the announced last heckle: its size is printed so the player can compare it with 멘탈 + 자신감 (and 야유 막기 can cancel it).
      if(C.threatInfo(state).last)$('patternLabel').textContent=`마지막 야유 · 한 번에 ${C.formatNumber(C.CONST.finalHeckle)}`;
    }
    if(C.bossProfile(state)==='future'&&!wonMoment){const u=state.u19;$('phaseIndicator').hidden=false;$('phaseIndicator').textContent=['','1막 · 거울 쇼타임','2막 · 완벽한 루틴','3막 · 마지막 한 장'][u.phase];$('patternLabel').textContent=u.telegraph>0?['','쇼타임을 쓰면 내 방어도 올라가. 끝난 뒤 노려 봐.','빛나는 케이스를 2초마다 눌러 콤보를 이어 줘.','이게 진짜 미래의 나야. 20초 동안 빛나는 칸만!'][u.phase]:u.phase===1?'쇼타임 중 거울 방어 상승':u.phase===2?'빛나는 칸을 계속 눌러요':u.window>0?`빛나는 최강 케이스만 · ${Math.ceil(u.window/1000)}초`:'마지막 한 장을 이어 가요';}
    if(state.u18.challenge){const c=state.u18.challenge;$('patternLabel').textContent=c.kind==='trueFan'?'찐팬 도전 · '+C.trueFanRule(c.slug).label:'다시 만난 관객';}
    $('mapButton').disabled=!state.u18.map&&!C.travelAllowed(state);
    $('rebirthButton').hidden = !state.seenEnding || state.homecomingCleared&&!state.u19.cleared;
    $('rebirthButton').textContent=phone ? (state.homecomingCleared ? '✨ 환생' : '✨ 이어서') : (state.homecomingCleared?'다음 차원의 공연':'이어지는 공연');
    if (state.pattern === 'heal' && state.mode === 'fight') $('audienceCard').classList.toggle('healing', state.patternHealMs > C.CONST.patternHealEvery - 600);
    else $('audienceCard').classList.remove('healing');
    num($('doubtNumber'), `${rounded(state.audHp)}/${rounded(state.audHpMax)}`, true);
    $('doubtFill').style.width = `${Math.round(state.audHp / state.audHpMax * 500) / 5}%`;
    {
      // v4 U38: heckle strength per second, doubt regrowth per second (only when there is any) and the player's own matching numbers.
      const th=C.threatInfo(state),heckleText=th.last?`마지막 한 번 ${rounded(th.hit)}`:`${rounded(th.perSecond)}/초`,regenText=th.regen>0?`회복 ${rounded(th.regen)}/초`:'';
      if($('attackNumber').textContent!==heckleText)$('attackNumber').textContent=heckleText;
      if($('doubtRegen').textContent!==regenText)$('doubtRegen').textContent=regenText;
      const mine=C.attackRate(state),mineText=mine==null?'재는 중':`${rounded(mine)}/초`;
      if($('stat-rate').textContent!==mineText)$('stat-rate').textContent=mineText;
      if($('stat-heckle').textContent!==heckleText)$('stat-heckle').textContent=heckleText;
    }
    $('countdown').textContent = `${Math.max(0, state.heckleMs / 1000).toFixed(1)}초`;
    $('audienceCard').classList.toggle('telegraph', state.mode === 'fight' && state.heckleMs <= C.CONST.telegraphMs);
    const meter=$('heckleMeter'),progress=Math.max(0,Math.min(100,(1-state.heckleMs/Math.max(400,state.interval*1000))*100));
    $('heckleFill').style.width=progress+'%';meter.setAttribute('aria-valuenow',String(Math.round(progress)));meter.classList.toggle('imminent',state.mode==='fight'&&!state.resolved&&state.heckleMs<=600);
    syncMotionLoops();
    num($('stat-power'), rounded(C.wandDamage(state)));
    num($('stat-damage'), rounded(C.CONST.itemDamage * state._V));
    num($('stat-guard'), rounded(C.CONST.itemShield * state._U));
    num($('stat-heal'), rounded(C.CONST.itemHeal * state._U));
    num($('bestCombo'), state.maxCombo, true);
    num($('comboNumber'), state.combo, true);
    const finalePercent = `${Math.min(100, state.finisher / C.nodeEffects(state).finaleNeed * 100)}%`;
    $('finisherFill').style.height = phone ? '100%' : finalePercent;
    $('finisherFill').style.width = phone ? finalePercent : '';
    $('mentalNumber').textContent = `멘탈 ❤ ${rounded(state.mental)} / ${rounded(state.mentalMax)}`;
    (heartEls||(heartEls=[...$('hearts').querySelectorAll('.heart')])).forEach((el, i) => el.classList.toggle('empty', i >= Math.ceil(state.mental / state.mentalMax * 5)));
    num($('shieldNumber'), rounded(state.shield));
    num($('levelNumber'), state.level);
    const xpNeed = C.xpNeed(state);
    num($('xpNumber'), `${rounded(state.xp)}/${C.formatNumber(xpNeed)}`, true);
    $('xpFill').style.width = `${Math.min(100, state.xp / xpNeed * 100)}%`;
    for (const id of ['coins','gems','keys']) num($(id), rounded(state[id]), true);
    for (let i = 0; i < cells.length; i++) {
      const cell = state.board[i], dom = cells[i];
      const pos=C.cellPosition(state,i);dom.el.style.gridColumn=pos.col+1;dom.el.style.gridRow=pos.row+1;
      dom.el.dataset.center=pos.row>=1&&pos.row<=3&&pos.col>=1&&pos.col<=3?'1':'';
      const locked = !cell, next = i === state.board.length;
      dom.el.classList.toggle('locked', locked);
      dom.el.classList.toggle('next-slot', next);
      dom.el.tabIndex = next ? 0 : -1;
      dom.el.setAttribute('role', next ? 'button' : 'img');
      dom.el.setAttribute('aria-label', next ? slotCondition() : locked ? '잠긴 자리' : `카드 케이스 ${i + 1}`);
      if (locked) { dom.lv.textContent = ''; continue; }
      const pct = cell.hpMax ? Math.min(100, Math.max(0, Math.round((1 - cell.hp / cell.hpMax) * 100))) : 0;
      dom.lv.textContent = `LV${cell.lv || 1}`;
      const chest = dom.el.querySelector('.chest');
      dom.el.classList.toggle('golden', !!cell.golden);
      dom.el.classList.toggle('golden-broken', !!cell.goldenBroken && cell.hp <= 0);
      const skin=state.u18.equipped.cases;
      const path = skin ? `assets/case-${skin}${cell.hp<=0?'-broken':''}.png` : cell.goldenBroken && cell.hp <= 0 ? 'assets/box-golden-broken.png' : `assets/${C.caseTier(cell)}.png`;
      dom.el.classList.toggle('case-customized',!!skin);dom.el.dataset.tier=C.caseTier(cell);
      let fallback=chest.querySelector('.sprite-fallback');if(!fallback){fallback=element('span','','sprite-fallback');chest.append(fallback);}fallback.textContent=skin?D.cosmetics.cases.find(x=>x.id===skin).emoji:'📦';
      if (chest.dataset.asset !== path) sprite(chest, path);
      num(dom.num, pct, true);
      // U36: the fill bar follows the percentage at most every 100 ms (the number above is throttled the same way).
      if (dom.fillPct !== pct && (dom.fillAt === undefined || performance.now() - dom.fillAt >= NUM_MS || pct === 0)) { dom.fillPct = pct; dom.fillAt = performance.now(); dom.fill.style.height = `${pct}%`; dom.fill.style.setProperty('--fill', pct / 100); }
      dom.el.classList.toggle('empty', cell.hp <= 0);
      if (cell.hp <= 0) dom.timer.textContent = `${(cell.spawn / 1000).toFixed(1)}`;
      dom.el.classList.toggle('sealed', cell.sealed);
      dom.el.classList.toggle('mirrored', state.features.climax.mirrored.includes(i));
      dom.el.classList.toggle('review-warning',state.review.target===i&&state.review.elapsed<2000);
      dom.el.classList.toggle('review-active',state.review.target===i&&state.review.elapsed>=2000);
    }
    const a = C.wandArea(state);
    $('areaLabel').textContent = `지팡이 범위 ${a.cols} × ${a.rows}`;
    if ($('rangeShape')) { $('rangeShape').textContent = '▦'; $('rangeShape').setAttribute('aria-label', `${a.cols}열 ${a.rows}행`); }
    $('hint').textContent = menu ? '공연 일시정지' : `${state.wins ? '케이스' : '카드 케이스'}를 꾹 누르세요 · 초당 ${C.wandRate(state).toFixed(1)}회`;
    $('dealerButton').disabled = !(C.failureDealerAvailable(state) || state.mode === 'dealer' || state.dealer);
    $('dealerButton').title = $('dealerButton').disabled ? '공연에 실패하면 토끼 딜러가 찾아와요' : '기다리는 토끼 딜러 만나기';
    updateWand(); modeHooks(); syncFlags();
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
    const r = wandRect(), ratio = boardWidth() / C.CONST.boardSize;
    $('wand').style.width = `${r.width * ratio}px`; $('wand').style.height = `${r.height * ratio}px`;
    // U36: since the skill column moved into #boardCard (U30c) the board sits 60 px right of and 27 px below the wand's own origin on phones,
    // so the drawn box was shifted by about half a case against the cells it hit. The board's offset inside the card is added here.
    // v4 U40: the offset only changes with the layout, so it is kept until fit() clears it (it used to be re-read every frame, forcing a layout after the frame's DOM writes).
    let off = wandOffset;
    if (!off) { off = { x: $('board').offsetLeft + $('board').clientLeft - $('wand').offsetLeft, y: $('board').offsetTop + $('board').clientTop - $('wand').offsetTop }; wandOffset = off; }
    $('wand').style.transform = `translate(${off.x + r.x * ratio}px,${off.y + r.y * ratio}px)`;
    if(phone){
      const target=coveredCells().find(i=>i<state.board.length),icon=$('wandIcon');
      icon.hidden=target===undefined || (typeof caseGestures!=='undefined' && [...caseGestures.values()].some(g=>g.drag));
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
    pointer.x = p.x; pointer.y = p.y;
    pointer.inside = p.x >= 0 && p.x <= C.CONST.boardSize && p.y >= 0 && p.y <= C.CONST.boardSize;
    updateWand();
  }
  function pulse(point = pointer) {
    if (paused() || state.mode !== 'fight') return;
    stepCombat(.001,{taps:[],holding:true});
    if (paused() || state.mode !== 'fight') return;
    const taps = coveredCells(point);
    if (taps.length) { sound('tap'); stepCombat(.001,{taps,holding:true}); }
  }
  function syncPointer() {
    const p = boardHolds[0]; pointer.held = !!p; pointer.id = p ? p.id : null;
    if (p) { pointer.x=p.x; pointer.y=p.y; pointer.inside=p.x>=0&&p.y>=0&&p.x<=608&&p.y<=608; }
    updateWand();
  }
  function release() {
    if(typeof caseGestures!=='undefined')for(const id of caseGestures.keys())clearDrag(id,false);
    const old = boardHolds; boardHolds = []; syncPointer();
    for (const p of old) if ($('board').hasPointerCapture(p.id)) $('board').releasePointerCapture(p.id);
    if (old.length && !document.hidden && !menu && !portrait()) events(C.step(state,.001,{taps:[]}));
  }
  const caseGestures=new Map();
  function dragTarget(x,y){const p=boardTransform().toBoard(x,y),k=C.CONST;const col=Math.floor((p.x-k.boardInset)/(k.cellSize+k.cellGap)),row=Math.floor((p.y-k.boardInset)/(k.cellSize+k.cellGap));return col>=0&&col<5&&row>=0&&row<5?row*5+col:-1;}
  function startDrag(g){if(!g||paused()||state.mode!=='fight')return;g.drag=true;cells[g.from].el.classList.add('case-dragging');if(typeof phone!=='undefined' && phone)$('wandIcon').hidden=true;}
  function dragMove(g,e){
    startDrag(g);g.moved=true;boardHolds=C.holdPointers(boardHolds,{type:'up',id:e.pointerId});syncPointer();
    g.to=dragTarget(e.clientX,e.clientY);cells.forEach((c,i)=>c.el.classList.toggle('drop-target',state.u15.positions[i]===g.to));
  }
  function clearDrag(id,drop){const g=caseGestures.get(id);if(!g)return;clearTimeout(g.timer);if(drop&&g.drag&&g.moved&&g.to>=0){C.moveCase(state,g.from,g.to);save();}caseGestures.delete(id);cells.forEach(c=>c.el.classList.remove('case-dragging','drop-target'));}
  $('board').addEventListener('pointerdown', e => {
    if (paused() || state.mode !== 'fight' || (e.pointerType === 'mouse' && e.button !== 0) || boardHolds.length >= 3) return;
    e.preventDefault(); const p = boardTransform().toBoard(e.clientX,e.clientY);
    if (p.x<0||p.y<0||p.x>608||p.y>608) return;
    boardHolds = C.holdPointers(boardHolds,{type:'down',id:e.pointerId,...p});
    $('board').setPointerCapture(e.pointerId); syncPointer();
    const el=e.target.closest('.cell'),from=cells.findIndex(c=>c.el===el);
    if(from>=0&&from<state.board.length){const g={from,x:e.clientX,y:e.clientY,to:-1,drag:false,moved:false};g.timer=setTimeout(()=>startDrag(g),300);caseGestures.set(e.pointerId,g);}
    const initial = C.advanceHolds(boardHolds,0,C.wandRate(state)); boardHolds=initial.holds;
    for (const point of initial.pulses) pulse(point);
    tutorialSignal('hold'); render();
    window.dispatchEvent(new CustomEvent('magicshow:gesture'));
  });
  $('board').addEventListener('pointermove', e => {
    const gesture=caseGestures.get(e.pointerId);
    if(gesture && (gesture.moved||Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>12)){dragMove(gesture,e);return;}
    if (boardHolds.some(p=>p.id===e.pointerId)) {
      const p=boardTransform().toBoard(e.clientX,e.clientY);
      boardHolds=C.holdPointers(boardHolds,{type:'move',id:e.pointerId,...p}); syncPointer();
    } else if (e.pointerType==='mouse' && !boardHolds.length) locate(e);
  });
  $('board').addEventListener('pointerleave', () => {
    if (!pointer.held) { pointer.inside=false; updateWand(); }
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) $('board').addEventListener(name,e=> {
    clearDrag(e.pointerId,name==='pointerup');
    boardHolds=C.holdPointers(boardHolds,{type:'up',id:e.pointerId}); syncPointer();
    if (!boardHolds.length && e.pointerType!=='mouse') { pointer.inside=false; updateWand(); }
  });
  window.addEventListener('blur', release);
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());

  function openPanel(kind, title) {
    if(menu==='curtain'&&kind!=='curtain'){clearTimeout(curtainTimer);curtainScene?.remove();curtainScene=null;presentation.finish();}
    menu = kind; previous = 0; clearDecorations();
    focusBeforePanel = document.activeElement;
    $('panel').dataset.screen = kind; delete $('panel').dataset.practice;
    $('panel').classList.remove('climax-dialogue');
    $('panel').querySelector('header').querySelectorAll('.tree-wallet,.constellation-controls,.tree-learning,.practice-go,.tree-more').forEach(el=>el.remove());
    $('closePanel').textContent = '닫기';
    $('panelTitle').textContent = title;
    $('panelBody').replaceChildren(); $('panelBody').scrollTop = 0; $('panel').hidden = false;
    $('closePanel').hidden = kind === 'fail'; $('closePanel').disabled = false;
    // Reset the Core hold before pausing so the next gesture starts immediately.
    state.holding=false; state.tapAcc=0;
    $('closePanel').hidden = ['boo','fail','ending','rebirth','bossPhase'].includes(kind);
    $('closePanel').focus(); updateWand(); nextToasts();
  }
  function closePanel() {
    if(menu==='curtain'){clearTimeout(curtainTimer);curtainScene?.remove();curtainScene=null;presentation.finish();}
    if (['boo','fail','ending','rebirth','bossPhase'].includes(menu) || (menu === 'dealer' && dealerBusy)) return;
    clearTimeout(dialogueTimer);
    if (menu === 'dealer' && state.mode === 'dealer') {
      for (let i = 0; i < 2 && state.mode === 'dealer'; i++) C.dealerClose(state);
      save();
    }
    if(state.u18.map){C.returnToStage(state);save();}
    if (['book','dealer'].includes(menu) && failure !== null) { showFailure(); return; }
    menu = ''; $('panel').hidden = true; previous = 0;
    if (focusBeforePanel && focusBeforePanel.isConnected) focusBeforePanel.focus();
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
    if(a)sprite($('audience'),audienceAsset(v,a));
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
      prow.append(element('span',`${product.name} · 공격 ×${product.productMultiplier} · 동전 ${rounded(pinfo.cost)}`),action(pinfo.purchasable?'배우기':`동전 ${rounded(Math.ceil(pinfo.cost-state.coins))} 더`,()=>learnFailureProduct(product.id),!pinfo.purchasable));
      result.append(prow);
    }
    if(C.failureDealerAvailable(state))result.append(action('딜러와 한 판 하고 다시 도전',()=>{if(C.openFailureDealer(state)){save();menu='';dealer();}}));
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
    $('bookButton').dataset.affordable=String(count);
    $('bookButton').setAttribute('aria-label',`비법서 · 지금 배울 수 있는 비법 ${count}개`);
    $('buyAllButton').disabled=!count;
  }
  function buyAllUI() {
    if (!state.onboarding.intro || ['boo','fail','dealer','headliner','ending','rebirth','bossPhase','curtain'].includes(menu)) return;
    tutorialSignal('buyAll');
    const result=C.buyAll(state);
    if (result.count) {
      tutorialSignal('learn'); sound('coin'); toast(`비법 ${result.count}개 배움`);
      const p=target('coins'); burst(p.x,p.y,'#ffe65c');
      animate($('bookButton'),[{boxShadow:'inset 0 0 0 1px #eac56888'},{boxShadow:'inset 0 0 0 1px transparent'}],240);
      save(); if (menu==='book') tree(); render();
    } else toast('지금 배울 수 있는 비법이 없어요');
    updateLearningBadge.at=0; updateLearningBadge();
  }
  function startIntro(replay = true) {
    if(!replay && !state.u15.tutorial.done){C.resumeTutorial(state);$('introStory').hidden=true;renderU15();save();return;}

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
    const next=action(`${state.onboarding.panel+1} / ${D.onboarding.intro.length} · ${state.onboarding.panel===4?D.onboarding.start:'눌러서 다음'}`,advance);
    next.classList.add('intro-next');
    const line=element('p',panel.line,'intro-line');
    const skip=action(D.onboarding.skip,finish); skip.classList.add('intro-skip');
    host.append(backdrop,kali,dad,line,next,skip);
    host.onclick=e=>{ if (!e.target.closest('button')) advance(); };
    save();
  }
  function renderCoach() {
    const host=$('tutorialCoach'), t=state.onboarding;
    const ids=['#board .cell:not(.locked)','#board .cell:not(.locked)','#doubtFill','#mental','#bookButton','#buyAllButton','#goalStrip','#doubtFill'];
    if(state.u15.tutorial.active)ids[4]='#item-auto-glove';
    const targets=menu==='book' ? ['','','','','.tree-buy','#treeBuyAll','',''] : ids;
    const eligible=!state.u15.scene && (!state.u15.tutorial.active || state.u15.tutorial.phase==='fight' && !state.u15.tutorial.won) && t.intro && t.step<(state.u15.tutorial.active?5:8) && !document.hidden && !portrait() && (!menu || menu==='book');
    const node=eligible && targets[t.step] ? document.querySelector(targets[t.step]) : null;
    host.hidden=!node;
    if (renderCoach.target!==node) {
      renderCoach.target?.classList.remove('tutorial-target');
      node?.classList.add('tutorial-target'); renderCoach.target=node;
    }
    if (host.hidden) return;
    const key=String(t.step);
    if (host.dataset.step!==key) {
      host.dataset.step=key; host.replaceChildren();
      const copy=D.onboarding.tutorial[t.step];
      const helper=element('img','','coach-helper');helper.src='assets/aud-tutorial-mingiri-happy.png';helper.alt='밍기리';helper.onerror=()=>{helper.hidden=true;};
      host.append(helper,element('strong',state.u15.tutorial.active?`밍기리 · ${t.step+1} / 5`:`${t.step+1} / 8 · ${copy.title}`),element('p',state.u15.tutorial.active?D.storyV15.helper.coaching[t.step].text:copy.body));
      const skip=action(state.u15.tutorial.active?'건너뛰기':'안내 닫기',()=>{if(state.u15.tutorial.active){C.finishTutorial(state);lastAudience='';}else t.step=8; save(); renderCoach();}); host.append(skip);
    }
    const audience=$('audienceCard'),r=audience.getBoundingClientRect(),stage=$('stage').getBoundingClientRect();
    host.dataset.compact=String(phone&&r.width<330);
    host.style.width=`${phone?Math.min(250,r.width*.42-16):340}px`;
    if(menu==='book'){host.style.left='8px';host.style.top='auto';host.style.bottom='8px';return;}
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

  const treeView = { x: 0, y: 0, zoom: 1, selected: 'root', sheet: false, centerPending: false, lastTap: null, revealed: new Set(), ready: false };
  function tree(focusMap = false) {
    const practice = typeof failure !== 'undefined' && failure !== null;
    if (menu !== 'book') openPanel('book', practice ? D.ui.practiceTitle : D.ui.bookTitle);
    if (practice) $('panel').dataset.practice = '1'; else delete $('panel').dataset.practice;
    const body = $('panelBody'); body.replaceChildren();
    const learning = element('div','','tree-learning');
    const all = action('모두 배우기',buyAllUI); all.id='treeBuyAll'; all.dataset.affordable=String(C.affordableNodes(state).length);
    const auto = action(state.learning.on ? '자동 켜짐' : '자동 배우기',()=> { C.toggleAutoLearn(state); save(); tree(); },!state.tree.autoLearn);
    auto.setAttribute('aria-pressed',String(state.learning.on)); auto.title='학교 장기자랑 도착 후 자동 배우기 비법으로 해금';
    learning.append(all,auto);
    const header = $('panel').querySelector('header');
    header.querySelectorAll('.tree-learning,.practice-go').forEach(el=>el.remove()); header.insertBefore(learning,$('closePanel'));
    if (practice) { const go = action(practiceGoLabel(), restartAfterFailure); go.classList.add('practice-go','u26-primary'); header.insertBefore(go,$('closePanel')); }
    const wallet = element('div', '', 'tree-wallet');
    [['🪙 ','동전 ',rounded(state.coins)],['🔑 ','열쇠 ',state.keys],['✦ ','별빛 ',state.starlight]].forEach(([icon,name,value],i)=>{
      if(i)wallet.append(element('span','·','wallet-sep'));
      wallet.append(element('span',icon),element('span',name,'wallet-name'),element('span',String(value)));
    });
    const layout = element('div', '', 'constellation-layout');
    const map = element('div', '', 'constellation-map'); map.tabIndex = 0;
    map.setAttribute('aria-label', '별자리 지도. 방향키로 이동하고 더하기와 빼기로 확대합니다.');
    const world = element('div', '', 'constellation-world');
    const detail = element('aside', '', 'constellation-detail'); detail.setAttribute('aria-live', 'polite');
    const infos = new Map(D.tree.map(n => [n.id, C.nodeInfo(state, n.id)]));
    const shown = new Set(D.tree.filter(n => infos.get(n.id).revealed || (!n.hidden && (n.reveal === 'E' || n.prereqs.some(id => infos.get(id).revealed)))).map(n => n.id));
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
      const unknown = !info.revealed;
      const button = element('button', '', `constellation-node${node.branch === 'collection' ? ' collection' : ''}${unknown ? ' unknown' : ''}${info.level ? ' owned' : ''}${treeView.selected === node.id ? ' selected' : ''}${newly.has(node.id) ? ' newly-revealed' : ''}`);
      button.dataset.nodeId = node.id;
      button.style.left = `${node.x * 140}px`; button.style.top = `${node.y * 140}px`;
      button.setAttribute('aria-label', unknown ? (node.reveal === 'E' ? '첫 멀티버스 공연 완료' : '미확인 비법') : `${node.name} 레벨 ${C.formatNumber(info.level)} / ${typeof info.max==='number' ? C.formatNumber(info.max) : info.max}`);
      const icon = element('span', unknown ? '❔' : node.emoji, 'constellation-icon sprite-fallback');
      const iconHost = element('span', '', 'constellation-icon-host'); iconHost.append(icon);
      sprite(iconHost, `assets/${unknown ? 'node-unknown.png' : node.icon}`);
      button.append(iconHost);
      if (practice && !unknown && node.id === practiceRec && infos.get(node.id).cost !== null) button.append(element('span', '추천', 'rec-tag'));
      if (!unknown) button.append(element('span', node.short || node.name /* v4 U45: long product names use a map label */, 'constellation-name'), element('small', `${C.formatNumber(info.level)} / ${typeof info.max==='number' ? C.formatNumber(info.max) : info.max}`, 'constellation-level'));
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
      if(selected.statMilestone){const next=C.nextMilestone(info.level,[10,25],selected.max);detail.append(element('p',next ? `다음 2배: 레벨 ${next} · ${next-info.level}레벨 남음` : `지금 힘 ${C.statMultiplier(state,selected.id)}배`,'tree-next'),element('p', D.easyExtras.milestone, 'tree-preview'));}
      if (selected.desc.includes('L')) detail.append(element('small', 'L은 이 비법의 레벨입니다.', 'tree-note-l'));
      const currency = { coins: '🪙 동전', keys: '🔑 열쇠', starlight: '✦ 별빛' }[info.currency];
      detail.append(element('strong', maxed ? '완성했어요' : `${currency} ${C.formatNumber(info.cost)}`, 'tree-cost'));
      if (!maxed && info.blockedReason) detail.append(element('p', info.blockedReason, 'tree-reason'));
      if (info.gate) detail.append(element('p', info.gate.text, 'tree-gate'));
      const buy = action('배우기', () => {
        if (!C.buyNode(state, selected.id)) return;
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
      const z = Math.max(.35, Math.min(1.8, treeView.zoom * factor)), ratio = z / treeView.zoom;
      treeView.x = point.x - map.clientWidth / 2 - (point.x - map.clientWidth / 2 - treeView.x) * ratio;
      treeView.y = point.y - map.clientHeight / 2 - (point.y - map.clientHeight / 2 - treeView.y) * ratio;
      treeView.zoom = z; transform();
    };
    const controls = element('div', '', 'constellation-controls');
    controls.append(action('− 축소', () => zoom(1 / 1.2)), action('+ 확대', () => zoom(1.2)), action('중앙으로', () => { treeView.x = 0; treeView.y = 0; treeView.zoom = 1; transform(); }));
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
    map.append(world); layout.append(map, detail); body.append(wallet, controls, layout, element('p', '드래그·방향키로 이동 · 휠·두 손가락으로 확대 · 열쇠는 관객 도감 완성으로 얻어요.', 'tree-note'));
    // U32: the gate lesson (야유 받아넘기기) lives in the practice note only; no auto focus, no primary styling.
    if (practice) {
      const gate = C.failureLessons(state).find(n => n.id.indexOf('gate:') === 0);
      if (gate) {
        const gid = gate.id.slice(5), cost = C.failureLessonInfo(state, gate.id).cost;
        let who = ''; for (const v of D.venues) for (const a of C.roster(v)) if (a && a.id === gid) who = a.name;
        const row = element('div', '', 'practice-gate');
        row.append(element('span', `'${who}' 야유 받아넘기기 · 동전 ${rounded(cost)}`), action('배우기', () => { if (C.learnFailureLesson(state, gate.id)) { save(); tree(); } }));
        body.prepend(row);
      }
    }
    if (typeof phone !== 'undefined' && phone) {
      const header = $('panel').querySelector('header');
      header.querySelectorAll('.tree-wallet,.constellation-controls,.tree-more').forEach(el=>el.remove());
      header.insertBefore(wallet,$('closePanel'));
      // U32: rarely used buttons (auto learn, zoom, center) sit behind one ⋯ button so the header stays calm.
      const more = element('div','','tree-more'), pop = element('div','','tree-more-pop');
      const toggle = action('⋯', () => { const open = more.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); });
      toggle.classList.add('tree-more-toggle'); toggle.setAttribute('aria-label','더 보기'); toggle.setAttribute('aria-expanded','false');
      pop.append(auto, controls); more.append(toggle, pop);
      header.insertBefore(more,$('closePanel'));
      $('closePanel').textContent = '뒤로';
    }
    if (treeView.centerPending) {
      // Keep the centered node in the visible map above the phone sheet.
      if (typeof phone !== 'undefined' && phone && treeView.sheet) treeView.y -= (detail.getBoundingClientRect().height + 6) / 2;
      treeView.centerPending = false;
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
  const achievementLabels = { boxes: '케이스 100개 열기', combo: '콤보 25', slots: '케이스 자리 9칸', golden: '첫 황금 케이스 열기', helper: '팬과 어시스턴트로 케이스 25개 열기', noDamage: '멘탈 손상 없이 승리', finale: '피날레 공연 승리', timed: '제한 시간 안에 승리' };
  function achievementPanel() {
    const list = element('div', '', 'achievement-list');
    list.append(element('p', `업적 연출 +${(state.features.achievements.length * .5).toFixed(1)}% · 차원 환생에서 초기화`));
    Object.entries(achievementLabels).forEach(([id, label], i) => {
      const earned = state.features.achievements.includes(id), locked = i >= 5 && !state.tree.challenge;
      const row = element('div', '', `achievement-stamp${earned ? ' earned' : ''}`);
      const medal = element('span', '', 'medal sprite-host'); medal.append(element('span', earned ? '🏅' : '○', 'sprite-fallback'));
      sprite(medal, `assets/medal-${i < 3 ? 'bronze' : i < 5 ? 'silver' : 'gold'}.png`);
      row.append(medal, element('span', locked ? '도전 수첩을 배우면 공개돼요' : label), element('small', earned ? '달성 · +0.5%' : '도전 중')); list.append(row);
    });
    $('panelBody').append(list);
  }
  function equipPanel() {
    const body = $('panelBody'), slots = C.equipSlots(state), grid = element('div', '', 'equip-grid');
    const guiding = state.features.guide === 'place';
    if(guiding) body.append(element('h2','첫 마술용품을 빈 자리에 놓아 보세요.','guide-line'));
    body.append(element('p', slots ? `소품 ${state.features.equipped.length} / ${slots} · 같은 종류가 더 잘 나와요 · 종류마다 최대 3개` : '비법서에서 마술용품를 배우세요.'));
    for (let i = 0; i < 9; i++) {
      const id = state.features.equipped[i], product = D.items.types.flatMap(t => t.ladder).find(p => p.id === id);
      const button = action(product ? `${product.emoji} ${product.name} · 해제` : i < slots ? '빈 자리' : '🔒 잠긴 자리', () => { C.unequipItem(state, id); save(); bestiary(); }, !product);
      if (guiding && i===0) button.classList.add('guide-highlight');
      if (product) sprite(button, `assets/item-${id}.png`); if(product)easyTooltip(button,product.desc);grid.append(button);
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
      collection.append(prop);
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
    const n=impactPool.pop()||element('span','','');n.className='projectile-impact '+kind;n.hidden=false;n.textContent=emoji;delete n.dataset.asset;n.setAttribute('aria-hidden','true');
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
    const actors=renderMagic.actors || (renderMagic.actors={balls:[],papers:[],controls:{}});
    // U36: hidden flags are written once per frame (they used to be set true for every actor and then false again, two attribute writes each).
    for(let i=state.features.magic.balls.length;i<actors.balls.length;i++)actors.balls[i].hidden=true;
    for(let i=state.features.magic.papers.length;i<actors.papers.length;i++)actors.papers[i].hidden=true;
    state.features.magic.balls.forEach((b,i)=>{const ball=actors.balls[i] || (actors.balls[i]=element('img','','sponge-projectile'));ball.hidden=((renderMagic.bounces||{})[i]||0)>clock;if(!ball.__art){ball.src='assets/proj-sponge.png';ball.alt='스펀지볼';ball.__art=true;}const point=typeof phone !== 'undefined' && phone ? boardPoint(b.x,b.y) : {x:870+b.x,y:160+b.y};ball.style.left=`${point.x-16}px`;ball.style.top=`${point.y-16}px`;if(!ball.dataset.mounted){layer.append(ball);ball.dataset.mounted="1";}});
    state.features.magic.papers.forEach((p,i)=>{const at=cellCenter(p.cell);let button=actors.papers[i];if(!button){button=action('플래시 페이퍼',()=>{events(C.tapPaper(state,Number(button.dataset.cell)));save();render();});button.addEventListener('pointerdown',e=>e.stopPropagation());button.addEventListener('pointerup',e=>e.stopPropagation());actors.papers[i]=button;}button.hidden=false;button.dataset.cell=p.cell;button.className='paper-drop';button.style.left=`${at.x-25}px`;button.style.top=`${at.y-25}px`;if(button.dataset.asset!=='assets/drop-flashpaper.png')sprite(button,'assets/drop-flashpaper.png');if(!button.dataset.mounted){layer.append(button);button.dataset.mounted="1";}});
    let controls=$('magicControls');
    if(!controls){controls=element('div','','magic-controls');controls.id='magicControls';($('helperControls') || $('stage')).append(controls);}
    for(const id in actors.controls)if(!state.tree[id])actors.controls[id].hidden=true;
    for(const id of ['sponge','cardthrow','tipbox','flashpaper','crystal','water','spotlight'])if(state.tree[id]){
      const n=D.tree.find(n=>n.id===id);let button=actors.controls[id];if(!button){button=action('',()=>{C.toggleHelper(state,id);save();render();});actors.controls[id]=button;controls.append(button);}button.hidden=false;
      const icons={sponge:'🔴',cardthrow:'🃏',tipbox:'🪙',flashpaper:'🔥',crystal:'🔮',water:'🥤',spotlight:'🔦'};
      const label=`${n.name} ${state.features.magic.paused[id]?'다시 시작':'일시정지'}`;
      button.textContent=`${icons[id]} ${state.features.magic.paused[id]?'▶':'Ⅱ'}`;
      button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(!!state.features.magic.paused[id]));
    }
    let parade=$('curtainCall');
    if(state.features.climax.left>0){
      if(!parade){parade=action('',()=>{C.skipCurtainCall(state);pendingIntro=null;save();render();});parade.id='curtainCall';parade.className='curtain-call';$('stage').append(parade);}
      const paradeVenues=D.venues.filter(v=>!['homecoming','future'].includes(v.headliner.bossProfile));
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
      for (const id of ['dove', 'rabbit', 'fan', 'assistant']) {
        const button = action('', () => { C.toggleHelper(state, id); save(); render(); }); button.id = `${id}Pause`; hud.append(button);
      }
      ($('helperControls') || $('stage')).append(hud);
    }
    const goal = C.nextComboGoal(state);
    $('comboGoal').textContent = goal ? `다음 ${goal.threshold} · 피날레 +${goal.gauge} · 동전 +${rounded(goal.coins)}` : state.tree.comboGift ? '이번 관객 콤보 보상 완료' : '';
    const active = state.features.encoreLeft > 0;
    $('stage').classList.toggle('encore-active', !!active);
    const seconds = Math.ceil((active ? state.features.encoreLeft : state.features.encoreMs) / 1000);
    $('encoreStatus').textContent = active ? `피버 ${Math.ceil(state.features.encoreLeft/1000)}초` : `피버 ${Math.floor(state.u17.feverGauge)}%`;
    for (const id of ['dove', 'rabbit', 'fan', 'assistant']) {
      const owned = state.tree[id === 'fan' ? 'boxHelper' : id];
      const paused = id === 'fan' || id === 'assistant' ? state.features.workers[id + 'Paused'] : state.features[id === 'dove' ? 'dovePaused' : 'helperPaused'];
      const button = $(`${id}Pause`), names = { dove: '비둘기', rabbit: '토끼', fan: '팬', assistant: '어시스턴트' };
      button.hidden = !owned; button.textContent = `${({ dove: '🕊️', rabbit: '🐇', fan: '👏', assistant: '🎩' })[id]} ${paused ? '▶' : 'Ⅱ'}`;
      button.title = `${names[id]} ${paused ? '다시 시작' : '일시정지'}`;
      button.setAttribute('aria-label', button.title); button.setAttribute('aria-pressed', String(!!paused));
      if (id === 'fan' || id === 'assistant') continue;
      const host = helperActor(id); host.hidden = !owned;
      if (Number(host.dataset.busyUntil || 0) <= clock && host.dataset.asset !== `assets/helper-${id}-idle.png`) sprite(host, `assets/helper-${id}-idle.png`);
      host.classList.toggle('paused', paused);
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
  function bestiary() {
    if (['boo','fail','dealer','headliner','ending','rebirth','bossPhase','curtain'].includes(menu)) return;
    openPanel('bestiary', D.ui.bestiaryTitle);
    panelTabs([['audiences','관객 도감'],['endings','엔딩 도감'],['achievements','업적'],['memories','추억'],['equip','마술용품']], bestiaryTab, tab => { bestiaryTab = tab; bestiary(); });
    if(bestiaryTab==='memories'){for(const v of D.venues.filter(v=>uiSave.memories[v.slug]))$('panelBody').append(action(uiSave.memories[v.slug].title,()=>openCurtainCall(v.slug,true)));return;}
    if (bestiaryTab === 'endings') { drawArchive(); return; }
    if (bestiaryTab === 'equip') { equipPanel(); return; }
    if (bestiaryTab === 'achievements') { achievementPanel(); return; }
    const outfit=element('div','','outfit-collection');outfit.append(element('strong',`칼리 의상 · ${state.u18.equipped.kali?D.cosmetics.kali.find(x=>x.id===state.u18.equipped.kali).name:['','거실 티셔츠','무대 정장','우주 망토'][state.u14.outfit]}`));const strip=element('div','','outfit-preview'+(state.u18.equipped.kali==='future'?' future-suit':''));strip.style.backgroundImage=`url('${assetUrl(kaliArtPath())}')`;strip.textContent='🎩';const image=assetImage(kaliArtPath());const ready=()=>{if(image.naturalWidth===768&&image.naturalHeight===256)strip.classList.add('art-loaded');else strip.style.backgroundImage='none';};if(image.complete)ready();else {image.addEventListener('load',ready,{once:true});image.addEventListener('error',ready,{once:true});}outfit.append(strip);$('panelBody').append(outfit);
    const routines=element('div','','routine-collection');routines.append(element('strong','나의 마술'));for(const r of D.routines.filter(r=>state.u19.routines.includes(r.id))){const item=element('span',r.name);item.prepend(artFallback(`assets/icon-routine-${r.id}.png`,'✨','routine-icon'));routines.append(item);}$('panelBody').append(routines);if(state.u19.cleared||state.u18.owned.kali.includes('future'))$('panelBody').append(element('p','🏅 미래의 나 · 다음 한 장을 건네받았다.'));
    const products=D.tree.filter(n=>n.branch==='collection'),owned=products.filter(n=>state.tree[n.id]>0).length,collection=element('p',`칼리 컬렉션 ${owned}/${products.length}${state.u14.collection?' · 연출 +10%':''}`);if(state.u14.collection)collection.prepend(artFallback('assets/icon-set-bonus.png','🎀','set-ribbon u14-art'));$('panelBody').append(collection,element('p',D.easyExtras.set,'easy-description'));
    const guides=element('section','','bestiary-guides');
    for(const [name,key,path] of [['김도겸','tutorial','aud-tutorial-dogyeom-happy.png'],['밍기리','helper','aud-tutorial-mingiri-happy.png']]){const card=element('article','','bestiary-guide');const art=element('span','','entry-emoji');art.append(element('span',key==='helper'?'👹':'🙎','sprite-fallback'));sprite(art,'assets/'+path);card.append(art,element('h3',name),element('p',D.storyV15[key].bio));guides.append(card);}
    const badges=element('div','','reward-badges');
    for(const r of D.stageRewards){const badge=element('figure','','reward-badge');const art=element('img');art.src=`assets/reward-${r.id}.png`;art.alt=r.effect;badge.classList.toggle('earned',state.features.rewards.includes(r.id));badge.append(art,element('figcaption',`${C.venueBySlug(r.venueSlug).name} · ${r.effect}`));badges.append(badge);} $('panelBody').append(badges);
    const list = element('div', '', 'bestiary-list');
    for (const venue of D.venues.filter(v=>v.slug!=='future'||state.visited.includes('future'))) {
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
            card.append(element('strong', '헤드라이너'), element('p', `승리 ${trophy ? '1 / 1' : '0 / 1'}`), element('p', `패턴: ${D.ui.patterns[a.pattern]}`), element('small', `보상: 🏆 ${venue.trophy}`));
          } else {
            const need = a.extra && a.extra.type !== 'none';
            const condition = need ? D.ui.extras[a.extra.type].replace('{value}', String(a.extra.value)) : '추가 조건 없음';
            card.append(element('strong', `감탄 ${Math.min(3, rec.wins)} / 3`), element('p', condition), element('small', need ? (rec.extra ? '✓ 추가 조건 달성' : '추가 조건 미달성') : '✓ 승리 3번이면 완성'), element('small', `보상: 🔑 열쇠 1개 · ${rec.removed ? '획득' : '완성하면 획득'}`));
            if (rec.removed) portrait.append(element('span', '완전히 팬이 됨', 'fan-stamp'));
          }
          if(head&&trophy)portrait.append(element('span','완전히 팬이 됨','fan-stamp'));
          if(state.u18.revealed){const done=state.u18.fans.includes(a.id),slot=element('div','',done?'truefan-slot earned':'truefan-slot');slot.append(element('strong',done?'🏅 열렬한 찐팬':'🔒 찐팬'),element('p',C.trueFanRule(venue.slug).label));slot.append(action('찐팬 도전',()=>startMapFight(venue.slug,a.id,'trueFan'),(!head&&!rec.removed)||(head&&!trophy)||(!state.u18.map&&!C.travelAllowed(state))));card.append(slot);}
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
    const rabbit = element('span', '', 'dealer-emoji'); rabbit.append(element('span', '🐇', 'sprite-fallback'));
    sprite(rabbit, 'assets/dealer.png');
    host.append(rabbit, element('div', D.dealer.introLines.join(' ')));
    const wallet = element('p', `🪙 ${rounded(state.coins)}   💎 ${state.gems}`, 'dealer-wallet');
    const status = element('p', dealerMessage, 'dealer-message'); status.setAttribute('role', 'status');
    $('panelBody').append(host, wallet);
    if(drawDealerGames(d)){$('closePanel').disabled=dealerBusy;return;}
    if (d.phase !== 'slot') {
      $('panelBody').append(element('p', D.dealer.cardRules, 'dealer-rules'), element('p', `얻은 보상은 지켜져요. 남은 카드 ${d.cards.filter(card => !card.open).length}장 · 꽝 확률 ${Math.round(d.risk * 100)}%`, 'dealer-note'));
      const row = element('div', '', 'dealer-cards');
      d.cards.forEach((card, index) => {
        const prize = D.dealer.cardPrizes.find(p => p.id === card.prize) || { emoji: '❔', name: '알 수 없는 보상' };
        const button = action('', () => {
          if (dealerBusy || !C.dealerCardPick(state, index)) return;
          dealerBusy = true; sound('flip');
          if (card.dud) { dealerLost = true; dealerMessage = D.dealer.dudLine; }
          else {
            dealerPicked.add(index);
            dealerMessage = `${prize.emoji} ${prize.name} 획득!`; sound('coin');
            burst(800, 420, '#ffe65c'); toast(dealerMessage);
          }
          save(); drawDealer();
          animate($('panelBody').querySelectorAll('.dealer-card')[index], [{ transform: 'rotateY(90deg) scale(.9)' }, { transform: 'rotateY(0deg) scale(1)' }], 350);
          setTimeout(() => {
            dealerBusy = false;
            if (card.dud && menu === 'dealer') closePanel();
            else if (menu === 'dealer') drawDealer();
          }, reduced ? 450 : 650);
        }, dealerBusy || card.open || d.phase !== 'card');
        button.className = `dealer-card${card.open ? ' revealed' : ''}`;
        if (dealerLost && !card.dud && !dealerPicked.has(index)) button.append(element('span', '💨'), element('small', '사라진 카드'));
        else if (card.open) button.append(element('span', card.dud ? '💥' : prize.emoji), element('strong', card.dud ? '꽝' : prize.name));
        else button.append(element('span', '🂠'), element('small', `${index + 1}번 카드`));
        row.append(button);
      });
      $('panelBody').append(row, status);
      const controls = element('div', '', 'dealer-controls');
      if (C.reached(state,D.dealer.slotVenue) && !dealerLost) controls.append(action('슬롯으로 넘어가기', () => { C.dealerClose(state); save(); drawDealer(); }, dealerBusy));
      controls.append(action('그만하기', closePanel, dealerBusy));
      $('panelBody').append(controls);
    } else {
      $('panelBody').append(element('p', D.dealer.slotRules, 'dealer-rules'), element('p', '가로, 세로, 대각선 8줄 중 좋은 문양이 맞으면 동전 보상! 2줄부터 보석도 받아요.', 'dealer-note'));
      const grid = element('div', '', 'slot-grid');
      const wins = d.spun ? payLines.filter(line => line.every(i => d.grid[i] === d.grid[line[0]]) && D.dealer.slotSymbols.some(s => s.id === d.grid[line[0]] && s.good)) : [];
      for (let i = 0; i < 9; i++) {
        const symbol = D.dealer.slotSymbols.find(s => s.id === d.grid[i]);
        const cell = element('div', symbol ? symbol.emoji : '❔', `slot-cell${wins.some(line => line.includes(i)) ? ' paying' : ''}`);
        cell.setAttribute('aria-label', symbol ? symbol.name : '회전 대기'); grid.append(cell);
      }
      const slotArea = element('div', '', 'slot-area');
      const force = element('div', '', 'force-controls');
      const forceCost = C.forceCost(state), forceLocked = state.tree.forceRemove < 1;
      force.append(element('strong', D.dealer.forceLine), element('small', `${forceLocked ? '🔒 비법서에서 포스를 해금하세요 · ' : ''}문양 하나당 💎 ${forceCost} · 보석 ${state.gems}개`));
      for (const symbol of D.dealer.slotSymbols.filter(s => !s.good)) {
        force.append(action(`${symbol.emoji} ${symbol.name} ${d.banned[symbol.id] ? '제거됨' : forceLocked ? '🔒 잠김' : `포스 💎 ${forceCost}`}`, () => {
          if (C.dealerForce(state, symbol.id)) { dealerMessage = `${symbol.name} 문양을 지웠어요`; save(); drawDealer(); }
        }, dealerBusy || d.spun || !!d.banned[symbol.id] || forceLocked || state.gems < forceCost));
      }
      if (wins.length && !dealerBusy) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 360 318'); svg.classList.add('pay-lines'); svg.setAttribute('aria-hidden', 'true');
        for (const line of wins) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
          path.setAttribute('points', line.map(i => `${70 + i % 3 * 116},${63 + Math.floor(i / 3) * 102}`).join(' '));
          svg.append(path);
        }
        grid.append(svg);
      }
      slotArea.append(grid, force); $('panelBody').append(slotArea, status);
      if (d.spun && !dealerBusy) {
        const names = ['윗줄','가운데 줄','아랫줄','왼쪽 세로','가운데 세로','오른쪽 세로','오른쪽 아래 대각선','왼쪽 아래 대각선'];
        $('panelBody').append(element('p', dealerResult || `${wins.length}줄 당첨`, 'slot-result'), element('small', wins.map(line => names[payLines.indexOf(line)]).join(' · ')));
      }
      const controls = element('div', '', 'dealer-controls');
      controls.append(action(dealerBusy ? '회전 중' : d.spun ? '회전 완료' : '슬롯 돌리기', () => spinDealer(), dealerBusy || d.spun), action('그만하기', closePanel, dealerBusy));
      $('panelBody').append(controls);
    }
    $('closePanel').disabled = dealerBusy;
  }
  // Curtain-call presentation holds the existing story queue without mutating it.
  let cheerData=null,curtainScene=null,curtainTimer=null;
  cheerData={
 "family": {
  "title": "거실이 들썩",
  "lines": [
   {
    "id": "a1",
    "text": "우리 아들 손이 빠르구나. 용돈도 벌어 오겠어."
   },
   {
    "id": "a2",
    "text": "형, 좀 하는데? 상금 받으면 나 큰 간식 사 줘."
   },
   {
    "id": "a3",
    "text": "마술 보느라 밥이 식었다. 오늘은 네가 데워 줘."
   },
   {
    "id": "h1",
    "text": "안경 쓰고도 못 잡았다. 이 안경 바꿔야겠구나."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "할머니 안경까지 이겼다! 파티에서도 한 판!"
  }
 },
 "party": {
  "title": "케이크보다 마술",
  "lines": [
   {
    "id": "a4",
    "text": "풍선은 안 터졌는데 애들이 터졌어. 웃느라!"
   },
   {
    "id": "a5",
    "text": "노래 껐는데 박자가 생겼어. 전부 박수 소리야."
   },
   {
    "id": "a6",
    "text": "초보다 네 마술이 먼저 끝났어. 소원도 빨리 빌어!"
   },
   {
    "id": "h2",
    "text": "주인공 자리는 뺏겼어도 케이크 첫 조각은 내 거다."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "케이크는 먹고 갈게. 학교 무대도 기다려라!"
  }
 },
 "school": {
  "title": "우리 반 대박 사건",
  "lines": [
   {
    "id": "a7",
    "text": "신청서 몰래 낸 값 할게. 매점에서 골라!"
   },
   {
    "id": "a8",
    "text": "응원봉 다 켰다! 건전지 값은 우리 반이 낸다!"
   },
   {
    "id": "a9",
    "text": "종 치기 전에 끝냈지? 감점할 틈도 안 주더라."
   },
   {
    "id": "a46",
    "text": "끝까지 서 있더라. 체육 시간에도 그 체력 써라."
   },
   {
    "id": "h3",
    "text": "칭찬은 안 한다. 생활기록부는 좀 길어지겠구나."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "매점 털고 카페로 간다. 신청서는 내가 낼게!"
  }
 },
 "cafe": {
  "title": "커피 식는 줄도",
  "lines": [
   {
    "id": "a10",
    "text": "노트북 닫았어요. 오늘 마감은 칼리 탓입니다."
   },
   {
    "id": "a11",
    "text": "케이크를 못 먹었어요. 입이 안 다물어져서요."
   },
   {
    "id": "a12",
    "text": "창가 자리 아깝다 했는데, 오늘은 손만 봤어요."
   },
   {
    "id": "a50",
    "text": "커피 한 잔 더 줄게. 오늘 손이 제일 바빴잖아."
   },
   {
    "id": "h4",
    "text": "커피보다 마술이 빨리 끝났어. 다음 잔은 천천히."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "커피값은 마술로 냈다! 전단 속 모임도 가 봐야지."
  }
 },
 "meetup": {
  "title": "별명 부자 모임",
  "lines": [
   {
    "id": "a-meetup-busan",
    "text": "첫차 값 뽑았어요. 카드도 가져가요, 공연용으로!"
   },
   {
    "id": "a-meetup-daegu",
    "text": "카드 얘기 세 시간 하려 했는데, 박수부터 쳤다."
   },
   {
    "id": "a-meetup-changwon",
    "text": "빨간 모자 챙도 올렸어요. 손 하나도 안 놓치게요!"
   },
   {
    "id": "a-meetup-incheon",
    "text": "비타민 충전 완료! 영상 찍어 뒀으니 또 볼래요."
   },
   {
    "id": "a-meetup-geoje",
    "text": "거제 야호! 돌아가면 마술 봤다고 자랑할 거예요!"
   },
   {
    "id": "a-meetup-cheonan",
    "text": "구미 착한 천사님도 박수 쳐요! 호두과자는 칼리 몫이에요."
   },
   {
    "id": "a-meetup-suwon",
    "text": "까만 팔찌가 인정! 제가 섞은 카드까지 맞혔어요."
   },
   {
    "id": "h-meetup-seoul",
    "text": "난 마술 3일만 해서 잘 몰라. 네 카드, 내 주머니에 있네?"
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "3일 차가 저 정도라고요? 소극장 가서 연습할게요!"
  }
 },
 "theater": {
  "title": "커튼 다시 열어요",
  "lines": [
   {
    "id": "a13",
    "text": "앞줄 값 뽑았어요! 박수는 따로 더 냈고요!"
   },
   {
    "id": "a14",
    "text": "프로그램은 집에서 읽을게요. 손 보느라 바빴어요."
   },
   {
    "id": "a15",
    "text": "카드 섞겠다고 까불었죠? 오늘은 박수만 칠게요."
   },
   {
    "id": "a54",
    "text": "대본에 반전 하나 추가요. 제 예상도 빗나갔어요."
   },
   {
    "id": "a55",
    "text": "목 풀었으니 앙코르 해 주세요. 아직 목이 멀쩡해요!"
   },
   {
    "id": "h5",
    "text": "별 네 개 반이다. 반 개는 날 속인 벌점이다."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "별 반 개는 축제에서 찾자. 앙코르는 덤이에요!"
  }
 },
 "festival": {
  "title": "박수가 밴드급",
  "lines": [
   {
    "id": "a16",
    "text": "과 깃발 너무 흔들었어요. 내일 팔 운동은 쉽니다!"
   },
   {
    "id": "a17",
    "text": "치킨 식었다. 마술 보느라 한 입도 못 먹었다."
   },
   {
    "id": "a18",
    "text": "목 쉬었어요, 선배. TV 나가시면 목값으로 밥요!"
   },
   {
    "id": "a59",
    "text": "기타 보러 왔는데 카드에 소리 질렀어요."
   },
   {
    "id": "a60",
    "text": "야광봉 다 닳았어요. 박수는 충전 안 해도 되죠?"
   },
   {
    "id": "h6",
    "text": "빌린 동전값, 박수로 갚았다. 이자까지 들었지?"
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "동전 이자가 박수라니! 이 기세로 TV 오디션!"
  }
 },
 "audition": {
  "title": "점수판도 놀랐다",
  "lines": [
   {
    "id": "a19",
    "text": "점수판 올리느라 바빴어요. 손보다 숫자가 빨라요!"
   },
   {
    "id": "a20",
    "text": "손 가까이 찍어도 못 잡았어요. 카메라 탓은 아닙니다."
   },
   {
    "id": "a21",
    "text": "합격했지? 다음엔 내가 이긴다. 도망가지 마라."
   },
   {
    "id": "a64",
    "text": "반전은 못 맞혔어요. 제 대본보다 한 수 위네요."
   },
   {
    "id": "a65",
    "text": "연습 때랑 다르더군요. 오늘 표정이 훨씬 편했어요."
   },
   {
    "id": "a66",
    "text": "박수 신호 기다렸는데, 손이 먼저 출발했어요!"
   },
   {
    "id": "h7",
    "text": "의심 다 썼다. 생방송 전엔 좀 채워 와야겠군."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "합격! 생방송에서도 카메라보다 손이 빨라야지."
  }
 },
 "broadcast": {
  "title": "생방송 무사 착륙",
  "lines": [
   {
    "id": "a112",
    "text": "시간 딱 맞췄어요. 시계까지 마술로 맞춘 건가요?"
   },
   {
    "id": "a113",
    "text": "그 농담 빌려도 돼요? 다음 대본에 웃음이 모자라요."
   },
   {
    "id": "a114",
    "text": "박수 소리가 너무 커요. 마이크가 더 바빴습니다."
   },
   {
    "id": "a115",
    "text": "신호 전에 박수 쳤어요. 손이 말을 안 들어요!"
   },
   {
    "id": "a116",
    "text": "댓글도 저도 난리예요. 패널 자리에서 일어났어요!"
   },
   {
    "id": "a117",
    "text": "조명 끌 틈이 없었어요. 계속 빛나시니까요!"
   },
   {
    "id": "h-broadcast",
    "text": "아버님 전화 바쁘시겠어요. 아들 자랑하시느라요."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "아빠, 저 봤죠? 사진은 라스베가스에서 보낼게요!"
  }
 },
 "vegas": {
  "title": "박수에 전부 건다",
  "lines": [
   {
    "id": "a22",
    "text": "칩 걸길 잘했다. 오늘 본전은 웃음으로 뽑았어."
   },
   {
    "id": "a23",
    "text": "깃털 부채가 멈췄어. 내 손도 마술에 걸렸나 봐."
   },
   {
    "id": "a24",
    "text": "소매 안 보기로 했죠. 약속 지키기 힘들었어요."
   },
   {
    "id": "a70",
    "text": "방에서 내려오길 잘했어요. 침대는 마술 안 하니까요."
   },
   {
    "id": "a71",
    "text": "사인해 주세요. 친구한테 직접 봤다고 자랑할래요!"
   },
   {
    "id": "a72",
    "text": "찍은 사진마다 손이 흐려요. 카메라보다 빠르셨군요."
   },
   {
    "id": "h8",
    "text": "내 눈이 졌다. 뉴욕 초대장은 네 손에 걸지."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "아빠한테 사진 전송 끝! 뉴욕에선 손도 찍힐까?"
  }
 },
 "broadway": {
  "title": "일어선 객석",
  "lines": [
   {
    "id": "a25",
    "text": "노래도 안 했는데 일어났어요. 카드가 고음도 내요?"
   },
   {
    "id": "a26",
    "text": "표 값 안 아까워요. 오늘은 기념품 안 사도 돼요."
   },
   {
    "id": "a27",
    "text": "아까 쓴 한 줄 그대로 갑니다. 칭찬도 고치기 귀찮아요."
   },
   {
    "id": "a76",
    "text": "표에 사인해 주세요. 오늘 건 따로 모아 둘래요."
   },
   {
    "id": "a77",
    "text": "손목이 춤추더군요. 발레는 손으로도 되나 봐요."
   },
   {
    "id": "a78",
    "text": "박수 박자가 딱 맞아요. 객석도 연습한 줄 알겠어요."
   },
   {
    "id": "a79",
    "text": "소매가 안 걸렸어요. 옷 만든 사람도 안심합니다."
   },
   {
    "id": "h9",
    "text": "박수를 길게 만들었군. 내 노래보다 길면 곤란한데."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "노래 한 곡 없이 이 박수! 다음 객석은 달이다!"
  }
 },
 "moon": {
  "title": "달에서도 짝짝",
  "lines": [
   {
    "id": "a28",
    "text": "놀라서 고개 들다가 헬멧에 부딪쳤습니다. 또 봅니다."
   },
   {
    "id": "a29",
    "text": "본부에 보고했어요. 카드 실종, 박수 발생입니다."
   },
   {
    "id": "a30",
    "text": "로켓까지 태워 드려요. 먼지는 발판에서 털어 주세요."
   },
   {
    "id": "a83",
    "text": "달에서도 손이 안 흔들렸어요. 연구할 게 늘었어요."
   },
   {
    "id": "a84",
    "text": "별빛 병은 닫아 뒀어요. 마술 보다가 놓칠까 봐요."
   },
   {
    "id": "a85",
    "text": "케이스 튼튼하죠? 제가 조인 나사는 안 사라집니다."
   },
   {
    "id": "a86",
    "text": "달 사진보다 마술 사진이 많아요. 여행 목적 바꿔요."
   },
   {
    "id": "h10",
    "text": "달 먼지까지 털었군. 청소부로 붙잡고 싶구나."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "달 청소는 끝! 태양 갈 땐 선글라스부터 챙기자."
  }
 },
 "sun": {
  "title": "불꽃보다 뜨겁다",
  "lines": [
   {
    "id": "a31",
    "text": "불꽃 파도 와도 버티더라. 내 보드에도 한번 서 봐."
   },
   {
    "id": "a32",
    "text": "흑점 투어는 잠깐 멈췄어요. 흑점은 내일도 있으니까요!"
   },
   {
    "id": "a33",
    "text": "불꽃보다 손을 더 찍었어요. 오늘 주인공은 바뀌었어요."
   },
   {
    "id": "a90",
    "text": "빛은 연구했는데 카드는 놓쳤어요. 숙제가 늘었어요."
   },
   {
    "id": "a91",
    "text": "아이스크림 다 녹았어요. 그래도 눈은 못 뗐어요."
   },
   {
    "id": "a92",
    "text": "망원경으로도 못 잡았다. 오늘 기록은 물음표다."
   },
   {
    "id": "a93",
    "text": "중심 잘 잡더라. 마술 끝나면 파도도 탈 수 있겠다."
   },
   {
    "id": "a94",
    "text": "사진이 흔들렸어요. 놀란 제 손 탓이에요."
   },
   {
    "id": "h11",
    "text": "동전은 돌려주마. 녹이기엔 네 표정이 너무 밝다."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "동전도 챙겼다! 은하에선 아이스크림부터 먹자."
  }
 },
 "galaxy": {
  "title": "은하도 손뼉 쳐",
  "lines": [
   {
    "id": "a34",
    "text": "번역기는 아직 고민 중이다. 박수는 바로 통했지!"
   },
   {
    "id": "a35",
    "text": "구경하느라 연료 썼어요. 오늘은 박수로 날고 싶어요."
   },
   {
    "id": "a36",
    "text": "게임 친구가 준 이름이죠? 칼리 별자리로 돌려드려요."
   },
   {
    "id": "a98",
    "text": "박수가 곡이 됐어요. 제목은 칼리, 따라 부르기 쉽죠."
   },
   {
    "id": "a99",
    "text": "손끝에 별빛이 찍혔어요. 별 사진 대회에 낼까 봐요."
   },
   {
    "id": "a100",
    "text": "다음 길은 어두워요. 랜턴 따라오세요, 카드는 챙기고요."
   },
   {
    "id": "a101",
    "text": "손이 내 혜성보다 빠르다. 카드로 경주할 생각은 없지?"
   },
   {
    "id": "a102",
    "text": "소원 이뤄졌어요! 칼리 마술 한 번 더 보기였거든요."
   },
   {
    "id": "h12",
    "text": "박수 치다 왕관이 기울었다. 이건 마술로 바로잡겠지?"
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "왕관은 손으로 고쳐요! 저는 거울 너머로 갑니다."
  }
 },
 "multiverse": {
  "title": "객석이 전부 나",
  "lines": [
   {
    "id": "a37",
    "text": "지팡이 없이도 되잖아. 두 손은 공짜니까."
   },
   {
    "id": "a38",
    "text": "연습실 못 간 날엔 집에서 했지. 방도 쓸 만했어."
   },
   {
    "id": "a39",
    "text": "접힌 카드로도 해냈지. 카드만 보면 종이접기 선수야."
   },
   {
    "id": "a106",
    "text": "친구들 앞에 서길 잘했지? 아직도 그 웃음이 들려."
   },
   {
    "id": "a107",
    "text": "TV 따라 하던 중학생이 저기 있다! 박수는 내가 친다."
   },
   {
    "id": "a108",
    "text": "추석 개그쇼로 배웠지? 웃긴 마술이 오래 남더라."
   },
   {
    "id": "a109",
    "text": "서점에서 산 마술 책, 오늘도 펼칠 곳이 있겠다."
   },
   {
    "id": "a110",
    "text": "조명은 뜨거웠지? 다음엔 손수건도 소품으로 챙겨."
   },
   {
    "id": "a111",
    "text": "친구들이 좋아하던 그 마술, 나도 또 보고 싶었어."
   },
   {
    "id": "h13",
    "text": "의심은 잠깐 쉰다. 박수까지 의심하긴 손이 바빠."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "나한테 박수 받으니 두 배로 좋다! 렉쳐노트로!"
  }
 },
 "lecturenote": {
  "title": "돌아온 매니저",
  "lines": [
   {
    "id": "a-lecturenote-hecate",
    "text": "점검 통과입니다. 부장 눈까지 속이셨군요."
   },
   {
    "id": "a-lecturenote-serona",
    "text": "선물 숨겨 뒀어요. 오늘 반전 하나는 제 몫이에요."
   },
   {
    "id": "a-lecturenote-jung",
    "text": "우주 다녀오셨죠? 카드 포장은 지구 방식으로 할게요."
   },
   {
    "id": "h-lecturenote-kim",
    "text": "밤 알바가 매니저 되더니, 이제 우주 손님도 데려오냐."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "사장님, 서재 앞 큰 테이블도 꽉 채워 볼게요!"
  }
 },
 "future": {
  "title": "다음 한 장은 너",
  "lines": [
   {
    "id": "h-future-kali",
    "text": "큰 테이블 또 찼어. 초보들 눈이 카드보다 동그래."
   }
  ],
  "closing": {
   "speaker": "칼리",
   "text": "100명 중 2명이 마술 보는 날까지, 한 장 더!"
  }
 }
};
  function openCurtainCall(slug,review=false){
    const v=D.venues.find(v=>v.slug===slug),data=cheerData?.[slug];
    if(!v||!data)return false;
    const finish=()=>{clearTimeout(curtainTimer);curtainScene?.remove();curtainScene=null;menu='';$('panel').hidden=true;presentation.finish();previous=0;dialogKey='';if(review){bestiaryTab='memories';bestiary();}else render();};
    openPanel('curtain',data.title);clearDecorations();
    const scene=element('section','','curtain-memory');curtainScene=scene;
    scene.style.backgroundImage=`url(${assetUrl(venueAsset(v))})`;
    const cast=element('div','','curtain-cast'),all=[...v.audiences];
    all.splice(Math.floor(all.length/2),0,v.headliner);
    for(const a of all){const actor=element('span','',a===v.headliner?'curtain-actor headliner':'curtain-actor');actor.dataset.audience=a.id;happySprite(actor,audienceAsset(v,a));cast.append(actor);}
    const bubble=action('',advance);bubble.className='curtain-bubble';bubble.setAttribute('aria-label','응원 다음 대사');
    const closing=element('p','','curtain-closing');scene.append(closing,cast,bubble);
    const skip=action('건너뛰기',finish);skip.id='curtainSkip';scene.append(skip);$('panelBody').append(scene);$('closePanel').disabled=false;
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
    await waitRoutine(900);if(!alive()){stop();return;}
    if(plan.bend){
      addBend(cards.find(c=>Number(c.dataset.slot)===plan.bend.start),true);status.textContent='앗, 카드가 좀 휘었네';sound('flip');
      await (reduced?holdMs(700):waitRoutine(1100));if(!alive()){stop();return;}
      status.textContent='여왕을 잘 봐요!';
    }
    await monteFlip(cards,'monte-back');if(!alive()){stop();return;}
    await waitRoutine(160);
    for(let i=0;i<plan.swaps.length;i++){
      if(!alive()){stop();return;}
      const ms=C.monteMoveMs(state.venue,m.round,i),[a,b]=plan.swaps[i],cover=!!plan.bend&&plan.bend.cover===i;
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
    if(choice!==plan.queen)status.textContent=plan.bend?.line||plan.trick?.line||'여왕은 여기 있었어요!';
    await waitRoutine(plan.bend&&choice!==plan.queen?1500:500);dealerBusy=false;drawDealer();
  }
  function drawDealerGames(d){
    const games=d.games||(d.games={cups:null,monte:null});
    if(dealerGameView==='cups'&&games.cups){
      const c=games.cups,area=element('section','','gem-game cups-game');
      area.append(element('h2','컵앤볼'),element('p',c.phase==='shuffle'?'공을 보여줄게요. 컵을 잘 봐요!':c.phase==='pick'?'공이 어디 있을까?':c.hit?'찾았다!':'아깝다! 공은 다른 컵에 있었어요.'));
      const table=gameTable('cups');
      for(let i=0;i<3;i++){
        const cup=action('',()=>revealCups(c,table,Number(cup.dataset.slot)),c.phase!=='pick');
        cup.className='game-cup';cup.dataset.slot=i;cup.style.setProperty('--slot',i);cup.setAttribute('aria-label',`컵 ${i+1}`);
        const ball=gameArt(c.phase==='result'&&c.keys?(state.venue%2?'cb-lemon':'cb-orange'):'cb-ball','cup-ball');ball.hidden=!((i===c.initial&&c.phase==='shuffle')||(i===c.ball&&c.phase==='result'));const art=gameArt(c.phase==='result'?'fx-cup-lift-04':'fx-cup-lift-01','cup-prop');cup.append(ball,art);if(c.phase==='result'&&c.keys&&i===c.ball){ball.classList.add('final-load');if(!reduced)cup.append(element('span','','final-load-fx'));}table.append(cup);
      }
      area.append(table,element('span','','flex-break'));
      if(c.phase==='result')area.append(element('p',`동전 +${rounded(c.coins)}${c.keys?' · 열쇠 +1':''}`,'game-result'));
      const back=action('딜러 메뉴',()=>{if(dealerBusy)return;dealerGameView=null;drawDealer();},dealerBusy||c.phase==='shuffle');back.className='dealer-back';area.append(back);$('panelBody').append(area);
      if(c.phase==='shuffle')animateCups(c,table);
      return true;
    }
    if(dealerGameView==='monte'&&games.monte){
      const m=games.monte,area=element('section','','gem-game monte-game');
      const settled=m.phase!=='playing'||(m.round>0&&monteGo!==m.round&&(!m.last||m.last.round===m.round-1));
      const lastRound=m.phase==='playing'?m.round-1:(m.last?m.last.round:(m.phase==='lost'?m.round:m.round-1));
      const plan=C.monteRound(m,settled?Math.max(0,lastRound):m.round);
      const status=element('p',settled?(m.phase==='lost'?(!m.last?'지난 판은 끝났어요':plan.bend?.line||(plan.trick?plan.trick.line:'여왕은 여기 있었어요!')):m.phase==='banked'?'선물을 받았어요!':'찾았어요! 계속할까요?'):'여왕을 잘 봐요!','monte-line');status.setAttribute('role','status');
      area.append(element('h2','몬테'),status);
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
      area.append(element('p',`지금 선물: 동전 ${rounded(m.coins)}${m.keys?' · 열쇠 1개':''}`));
      if(m.phase==='playing'&&settled){
        const row=element('div','','dealer-controls');
        row.append(action('다음 판',()=>{if(dealerBusy)return;monteGo=m.round;drawDealer();}));
        const bank=action('그만하고 받기',()=>{if(dealerBusy)return;C.dealerMonteBank(state);save();sound('coin');drawDealer();},m.round<1);bank.dataset.bank='true';row.append(bank);area.append(row);
      }
      if(m.phase==='playing')area.append(element('small','1번 60초 동전 · 2번 150초 · 3번 열쇠 + 200초'));
      const back=action('딜러 메뉴',()=>{if(dealerBusy)return;dealerGameView=null;drawDealer();},dealerBusy||!settled);back.className='dealer-back';
      area.append(back);$('panelBody').append(area);
      if(!settled)animateMonte(m,table,status);
      return true;
    }
    dealerGameView=null;
    const row=element('div','','dealer-gem-menu');
    for(const [id,label,cost] of [['cups','컵앤볼',2],['monte','몬테',3]]){
      const played=games[id],reason=!played&&state.gems<cost?`보석 ${cost}개가 필요해요`:'';
      row.append(action(`${label} · 💎 ${cost}${played?(['result','lost','banked'].includes(played.phase)?' · 결과 보기':' · 이어 하기'):''}`,()=>{if(played||C.dealerGameStart(state,id)){dealerGameView=id;save();drawDealer();}},!!reason));
      row.append(element('small',id==='cups'?'공을 찾으면 동전, 가끔 열쇠도 받아요':'여왕 카드를 찾을수록 선물이 늘어요. 틀리면 놓쳐요'));
      if(reason)row.append(element('small',reason));
    }
    $('panelBody').append(row);return false;
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
    if(!state.u18.map&&!C.openMap(state)){toast('이 장면이 끝나면 이동할 수 있어요');return;}
    openPanel('map','무대 지도');$('phoneMore').hidden=true;
    $('panelBody').append(element('p','도착했던 무대는 무료로 다시 갈 수 있어요'),action('지금 무대로 돌아가기',()=>{if(C.returnToStage(state)){menu='';$('panel').hidden=true;previous=0;lastAudience='';save();render();}}));
    const list=element('div','','stage-map');
    for(const v of D.venues.filter(v=>state.visited.includes(v.slug))){
      const section=element('section','','map-venue');section.dataset.venue=v.slug;section.append(element('h2',v.name));
      if(state.u18.revealed){const p=C.trueFanProgress(state,v.slug);section.append(element('p',`찐팬 ${p.current}/${p.total}${p.complete?' · 🎀 실력 +5%':''}`,'truefan-progress'));}
      for(const a of [...v.audiences,v.headliner]){
        const row=element('div','','map-audience'),full=a===v.headliner?!!state.trophies[v.slug]:!!state.bestiary[a.id]?.removed;
        const art=element('span','','map-portrait');sprite(art,audienceAsset(v,a));row.append(art);
        row.append(element('strong',a.name),action('일반 공연',()=>startMapFight(v.slug,a.id,'normal')));
        if(state.u18.revealed)row.append(action(state.u18.fans.includes(a.id)?'찐팬 다시 도전':'찐팬 도전',()=>startMapFight(v.slug,a.id,'trueFan'),!full),element('small',C.trueFanRule(v.slug).label));
        section.append(row);
      }
      list.append(section);
    }
    $('panelBody').append(list);if(selected)list.querySelector(`[data-venue="${selected}"]`)?.scrollIntoView({block:'start'});save();
  }
  let customizeTab='kali';
  function customize(){
    if(['boo','fail','ending','rebirth','bossPhase','headliner','dealer'].includes(menu)||state.u15.scene)return;
    openPanel('customize','꾸미기');$('phoneMore').hidden=true;
    panelTabs([['kali','칼리 의상'],['cases','카드 케이스']],customizeTab,tab=>{customizeTab=tab;customize();});
    $('panelBody').append(element('p',`💎 보석 ${state.gems}개 · 꾸미기는 환생해도 남아요`),action('기본 모습',()=>{C.equipCosmetic(state,customizeTab,'');save();render();customize();}));
    if(customizeTab==='kali'){
      const tiers=element('div','','story-outfits');for(let tier=1;tier<=3;tier++){const owned=tier<=state.u14.outfit;tiers.append(element('p',`${owned?'✓':'🔒'} ${['','거실 티셔츠','무대 정장','우주 망토'][tier]} · ${['','처음부터','TV 오디션 완료','달 무대 완료'][tier]}`));}$('panelBody').append(tiers);
    }
    const grid=element('div','','cosmetic-grid');
    for(const x of D.cosmetics[customizeTab].filter(x=>x.id!=='future'||state.u19.cleared||state.u18.owned.kali.includes('future'))){
      const info=C.cosmeticInfo(state,customizeTab,x.id),equipped=state.u18.equipped[customizeTab]===x.id,card=element('article','',`cosmetic-card${info.owned?'':' locked'}`);
      const icon=artFallback(`assets/icon-${customizeTab==='kali'?'kali-skin':'case'}-${x.id}.png`,x.emoji,'cosmetic-icon');card.append(icon,element('h3',x.name),element('p',info.hint));
      card.append(action(equipped?'사용 중':info.owned?'입히기':x.milestone?'아직 잠김':`열기 · 💎 ${x.cost}`,()=>{if(!info.owned)C.buyCosmetic(state,customizeTab,x.id);C.equipCosmetic(state,customizeTab,x.id);save();render();customize();},equipped||!info.available));grid.append(card);
    }
    $('panelBody').append(grid);save();
  }

  function gemShop(){
    if(['boo','fail','ending','rebirth','bossPhase','headliner'].includes(menu))return;
    openPanel('gemShop','보석 상점');$('panelBody').append(element('p',`💎 보석 ${state.gems}개`,'dealer-wallet'));
    for(const item of D.gemShop){
      if(item.id==='glove'&&C.hasDeck(state))continue; // v4 U44: the 칼리 덱 skill replaces the 120 s glove
      const card=element('section','','gem-shop-item');card.append(element('h2',item.name),element('p',item.desc));
      const add=skill=>{const info=C.gemShopInfo(state,item.id,skill),label=skill?D.skills.find(k=>k.id===skill).name+' 충전':'사기';
        card.append(action(`${label} · 💎 ${info.cost}`,()=>{if(C.gemShopBuy(state,item.id,skill)){save();sound('skill');gemShop();render();}},!info.available));if(info.reason)card.append(element('small',info.reason));};
      if(item.id==='refill')D.skills.forEach(k=>add(k.id));else add();$('panelBody').append(card);
    }
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
      dealerResult = state.coins > coins ? `동전 +${rounded(state.coins - coins)}${state.gems > gems ? ` · 보석 +${state.gems - gems}` : ''}` : '아쉽지만 맞는 줄이 없어요';
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
    $('audienceLine').textContent = line;
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
    presentation.clear();renderU15.sceneRequested=false;toastQueue.length=0; visibleToasts.forEach(t=>t.el.remove()); visibleToasts.length=0; lastToastKind='';
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
      scene.append(element('h2',lines[endingStep]),primary);
      // Four 4.5-second beats: 18 seconds, pausing while the page is hidden.
      const next=()=>{if(menu!=='ending')return;if(document.hidden){dialogueTimer=setTimeout(next,500);return;}endingStep++;drawEnding();};
      dialogueTimer=setTimeout(next,4500);
    } else {
      const counts=C.recap(state);
      scene.append(element('h2','칼리 마술 성장기'),element('p',lines[3]),element('p',`관객 감탄 ${counts.wins}회 · 함께한 도우미 ${counts.helpers}종 · 방문한 무대 ${counts.venues}곳`,'homecoming-recap'));
      const buttons=element('div','','ending-actions');
      primary=state.u19.cleared?action('가게에 남기',continueDimension):action('서재 앞 테이블로',()=>{C.beginFuture(state,true);menu='';$('panel').hidden=true;previous=0;lastAudience='';endingStep=0;save();render();});
      buttons.append(primary);if(state.u19.cleared)buttons.append(action('다음 차원의 공연',showRebirth)); scene.append(buttons);
    }
    $('panelBody').append(scene); primary.focus();
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
    scene.append(element('h2', `차원 ${state.dimension}에서 차원 ${state.dimension + 1}로`), element('p', `✦ 별빛 +${gain} · 환생 후 별빛 ${state.starlight + gain}`, 'rebirth-gain'));
    const columns = element('div', '', 'rebirth-lists');
    for (const [title, lines] of [
      ['처음부터 시작해요', ['동전, 보석, 열쇠', '마술 비법서의 모든 일반 강화와 해금', '무대 진행과 초대장, 트로피', '관객 도감의 승리 횟수, 추가 조건, 팬 기록', '공연 승리와 실패 횟수, 딜러 진행과 임시 버프', '보드와 케이스, 날아가는 아이템', '레벨, 경험치, 루틴 최고 기록, 피날레, 자신감', '멘탈은 새 차원의 최대치로 회복하고 가족 거실에서 시작']],
      ['다음 차원에도 남아요', ['차원 번호는 1 증가', '보유 별빛과 이번에 얻는 별빛', '별빛 강화의 모든 레벨', '이미 본 모든 엔딩 기록과 감탄한 관객의 기억', '소리 설정과 저장 기능']]
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
      presentation.clear();renderU15.sceneRequested=false;clearTimeout(bannerTimer); bannerQueue.length = 0; unlockBannerQueue.length = 0; bannerActive = null; $('banner').hidden = true;
      save(); render(); toast(`차원 ${state.dimension} · 별빛 ${gain}개를 얻었어요`); $('bookButton').focus();
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
  $('buyAllButton').addEventListener('click',buyAllUI);
  $('replayTutorial').addEventListener('click',()=>{closePanel();C.replayTutorial(state);startIntro(false);});
  $('bookButton').addEventListener('click', () => {
    if (['boo','fail','dealer','headliner','ending','rebirth','bossPhase','curtain'].includes(menu)) return;
    if (state.onboarding.step===4) { const next=Guidance.target(state,D,C); if (next) { focusNode(next.id); return; } }
    tree();
  });
  $('equipButton').addEventListener('click',()=>{if(!C.equipSlots(state))return;if(!state.guidance.seen.includes('equipButton'))state.guidance.seen.push('equipButton');bestiaryTab='equip';bestiary();save();});
  $('openChatButton').addEventListener('click',()=>{save();window.open('https://open.kakao.com/o/gUJkfxzi','_blank','noopener');});
  $('coffeeButton').addEventListener('click',()=>{save();window.open('https://qr.kakaopay.com/Ej8rDsX4f','_blank','noopener');});
  $('bestiaryButton').addEventListener('click', bestiary);
  $('dealerButton').addEventListener('click', dealer);
  $('rebirthButton').addEventListener('click', () => {
    if (!['boo','fail','dealer','headliner','ending','rebirth','bossPhase'].includes(menu) && state.seenEnding) showRebirth();
  });
  $('mapButton').addEventListener('click',()=>openStageMap());
  $('customizeButton').addEventListener('click',customize);
  $('gemShopButton').addEventListener('click',gemShop);
  const shopQuick=action('💎',gemShop);shopQuick.id='gemShopQuick';shopQuick.className='active-skill gem-shop-quick';shopQuick.setAttribute('aria-label','보석 상점');$('activeSkills').append(shopQuick);
  for(let i=0;i<8;i++){const petal=element('span',i%3?'✦':'🌸','fever-petal');petal.style.setProperty('--x',`${(i*37)%100}%`);petal.style.setProperty('--delay',`${i*.08}s`);petal.style.setProperty('--drift',`${i%2?80:-80}px`);$('feverPetals').append(petal);}
  $('musicButton').addEventListener('click',()=>{if(window.Sfx){const on=window.Sfx.toggleMusic();$('musicButton').textContent=phone?(on?'음악 ON':'음악 OFF'):on?'배경음악 켜짐':'배경음악 꺼짐';$('musicButton').setAttribute('aria-pressed',String(on));}});
  $('musicVolume').addEventListener('input',()=>window.Sfx&&window.Sfx.setMusicVolume(Number($('musicVolume').value)));
  if(window.Sfx){$('musicVolume').value=window.Sfx.musicVolume();const on=window.Sfx.musicEnabled();$('musicButton').textContent=phone?(on?'음악 ON':'음악 OFF'):on?'배경음악 켜짐':'배경음악 꺼짐';$('musicButton').setAttribute('aria-pressed',String(on));}
  $('missionsButton').addEventListener('click',()=>{if(!['boo','fail','dealer','headliner','ending','rebirth','bossPhase'].includes(menu))drawMissions();});
  $('hapticsButton').addEventListener('click',()=>{C.toggleHaptics(state);save();renderU14();});
  $('eventVisitor').addEventListener('click',()=>{if(paused())return;const list=C.catchVisitor(state);events(list);render();});
  $('soundButton').addEventListener('click', () => {
    if (window.Sfx) window.Sfx.toggle();
    updateSoundButton();
  });
  $('retreatButton').addEventListener('click', () => {
    if (['boo','fail','ending','rebirth','bossPhase'].includes(menu) || dealerBusy) return;
    if (menu) closePanel();
    const traveling = !!state.u18.anchor;
    release(); C.retreat(state); lastAudience = ''; save(); render(); toast(traveling ? '도전을 마치고 지도로 돌아가요' : `${D.venues[state.venue - 1].name} 처음부터 다시 시작해요`);
  });
  $('closePanel').addEventListener('click', closePanel);
  document.addEventListener('pointerdown',e=>{if(menu&&!['boo','fail','boo','ending','rebirth','bossPhase','headliner','dealer'].includes(menu)&&!$('panel').contains(e.target)&&!e.target.closest('#phoneTop,.menu'))closePanel();});
  document.addEventListener('keydown', e => {
    if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      const key=e.key.toLowerCase();
      if(['1','2','3'].includes(key) && !paused()) { e.preventDefault(); activateSkill(D.skills[Number(key)-1].id); }
      if (key==='b') { e.preventDefault(); $('bookButton').click(); }
      if (key==='a') { e.preventDefault(); buyAllUI(); }
      if (key==='d') { e.preventDefault(); $('bestiaryButton').click(); }
    }
    if (e.key === 'Escape' && menu && menu !== 'fail') closePanel();
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
      const x = p.x + p.dx * t, y = p.y + p.dy * t + 28 * t * t;
      ctx.globalAlpha = 1 - t; ctx.fillStyle = p.color;
      const sheets={card:'card-shards',cardrain:'card-shards',coin:'coin-spark',ring:'ring-flash',silk:'ribbon',sponge:'puff',dove:'feathers',cheer:'heart-pop',showtime:'shockwave',critical:'critical'};
      const sheet=p.shape&&assetImage('assets/ui/fx-'+sheets[p.shape]+'.png');
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
      } else star(x, y, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    for (let i = badges.length - 1; i >= 0; i--) {
      const b = badges[i], age = clock - b.start;
      if (age >= 350) {
        fly(b.x, b.y, target(b.effect), b.emoji || b.icon, '', D.items.rarities.find(r => r.id === b.rarity)?.color, 0, b.image);
        badges.splice(i, 1); continue;
      }
      ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y) + (phone ? 6 : 0));
      const w = phone ? U5.badgeWidth(104 * boardWidth() / 608) : b.width, h = phone ? Math.min(b.nameLabel ? 30 : 20, 112 * boardWidth() / 608 - 18) : (b.nameLabel ? 54 : 34);
      ctx.fillStyle = '#10121af5'; ctx.strokeStyle = D.items.rarities.find(r => r.id === b.rarity)?.color || '#ffe65c';
      ctx.lineWidth = 2; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      const y = b.nameLabel ? (phone ? -5 : -9) : 0;
      if (phone) { /* Compact badge reserves its width for the value. */ }
      else if (b.image.complete && b.image.naturalWidth) ctx.drawImage(b.image, -w / 2 + 3, y - 12, 24, 24);
      else { ctx.font = '18px sans-serif'; ctx.fillText(b.emoji || b.icon, -w / 2 + 15, y); }
      ctx.font = '700 11px Galmuri11'; ctx.fillText(b.text, phone ? 0 : 12, y, phone ? w - 4 : w - 32);
      if (b.nameLabel) { ctx.font = '400 11px Galmuri11'; ctx.fillText(b.nameLabel, 0, phone ? 9 : 14, w - 6); }
      ctx.restore();
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i], t = (clock - f.start) / f.life;
      if (t >= 1) { flights.splice(i, 1); continue; }
      if (t < 0) continue;
      const arc = p => ({ x: f.x + (f.tx - f.x) * p, y: f.y + (f.ty - f.y) * p - 112 * Math.sin(Math.PI * p) });
      ctx.fillStyle = f.color;
      for (let p = Math.max(0, t - .12); p < t; p += .06) {
        const a = arc(p); ctx.fillRect(Math.round(a.x) - 1, Math.round(a.y) - 1, 2, 2);
      }
      const a = arc(t); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.imageSmoothingEnabled = false;
      ctx.font = '42px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; if (f.image && f.image.complete && f.image.naturalWidth) ctx.drawImage(f.image, a.x - 24, a.y - 24, 48, 48);
      else ctx.fillText(f.emoji, a.x, a.y);
      if (f.label) {
        ctx.font = '700 11px Galmuri11'; ctx.lineWidth = 5; ctx.strokeStyle = '#000';
        ctx.strokeText(f.label, a.x, a.y + 34); ctx.fillText(f.label, a.x, a.y + 34);
      }
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
      const width=Math.max(ctx.measureText(n.text).width+6,n.critical?76:0), radius=!reduced&&n.tier>=3?8+t*16:0;
      if(!U5.clearOfZones({x:nx-Math.max(width/2,radius),y:y-Math.max(n.size/2+3,radius),w:Math.max(width,radius*2),h:Math.max(n.size+6,radius*2)}))continue;
      if(radius){ctx.strokeStyle=n.color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(nx,y,radius,0,Math.PI*2);ctx.stroke();}
      if(n.critical){ctx.fillStyle='#261b2b';ctx.fillRect(nx-38,y-10,76,20);ctx.strokeStyle='#eac568';ctx.lineWidth=1;ctx.strokeRect(nx-38,y-10,76,20);ctx.fillStyle=n.color;}
      ctx.save();ctx.translate(nx,y);if(!reduced&&n.tier===2){const punch=1+.12*Math.max(0,1-t*4);ctx.scale(punch,punch);}ctx.strokeStyle=n.tier===4?'#c99e4d':'#17121d';ctx.lineWidth=n.tier===4?3:2;ctx.strokeText(n.text,0,0);ctx.fillText(n.text,0,0);ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.restore();
  }

  let bioUntil=0,bioPending='',dialogKey='',installPrompt=null;

  function easyTooltip(button,copy){
    button.title=copy;button.setAttribute('aria-description',copy);
    let timer,long=false;
    const show=(suppressClick=true)=>{long=suppressClick;const tip=$('easyTooltip');tip.textContent=copy;tip.hidden=false;const r=button.getBoundingClientRect(),stage=$('stage').getBoundingClientRect();tip.style.left=Math.max(4,Math.min(layoutWidth-240,(r.left-stage.left)/scale-240))+'px';tip.style.top=Math.max(48,(r.top-stage.top)/scale)+'px';};
    button.addEventListener('pointerdown',()=>{long=false;timer=setTimeout(show,400);});
    button.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')show(false);});
    for(const event of ['pointerup','pointercancel','pointerleave'])button.addEventListener(event,()=>{clearTimeout(timer);$('easyTooltip').hidden=true;});
    button.addEventListener('click',e=>{if(long){e.stopImmediatePropagation();long=false;}},true);
  }
  function speakerPortrait(name){
    if(name==='밍기리')return 'assets/aud-tutorial-mingiri-happy.png';
    if(name==='김도겸')return 'assets/aud-tutorial-dogyeom'+(state.u15.tutorial.won?'-happy':'')+'.png';
    if(name==='칼리')return kaliArtPath();
    for(const v of D.venues){const a=C.roster(v).find(a=>a.name===name);if(a)return audienceAsset(v,a);}
    return '';
  }
  function u25DialogMoodKey(key,index){const parts=key.split(':');return parts[0]==='story'?'story:'+parts.slice(2).join(':')+':'+index:parts[0]==='tutorial'?'story:tutorial:'+parts[1]+':'+index:key+':'+index;}
  function renderDialog(lines,index,key,advance,skip){
    const host=$('storyDialog');host.hidden=false;clearDecorations();
    if(dialogKey===key+':'+index)return;dialogKey=key+':'+index;host.replaceChildren();
    const line=lines[Math.min(index,lines.length-1)],art=element('span',line.speaker==='칼리'?'🎩':'👤','story-portrait');
    if(line.speaker==='칼리'){const mood=D.lineFaces.moods[u25DialogMoodKey(key,index)]||'serious';art.classList.toggle('future-suit',state.u18.equipped.kali==='future');if(['sad','surprised'].includes(mood))sprite(art,'assets/kali-react-'+mood+'.png');else moodSprite(art,kaliArtPath(),mood);}
    else{const a=D.venues.flatMap(v=>C.roster(v)).find(a=>a.name===line.speaker);const moodKey=u25DialogMoodKey(key,index);moodSprite(art,speakerPortrait(line.speaker),D.lineFaces.moods[moodKey]||D.lineFaces.faceMap.roleDefaults[a?.role]||'serious');}
    const copy=element('div','','story-copy');copy.append(element('strong',line.speaker),element('p',line.text));
    const start=(state.idle.waiting||state.u15?.scene?.kind==='opening')&&index===lines.length-1&&!state.u15.queue.length;
    const next=action(start?'무대 시작':'다음',()=>{advance();if(start)C.startStage(state);save();}),dismiss=action('건너뛰기',skip);dismiss.hidden=start;host.classList.toggle('stage-launch',start);host.append(art,copy,next,dismiss);
    next.classList.toggle('stage-start',start);
    host.onclick=e=>{if(!e.target.closest('button')&&!start)advance();};
  }
  function renderU15(){
    const u=state.u15,t=u.tutorial,glove=$('item-auto-glove');
    if(glove){const deck=C.hasDeck(state);glove.classList.toggle('glove-active',u.gloveLeft>0||deck&&u.deckOn);glove.querySelector('small').className='item-count';glove.hidden=!deck&&u.gloves===0&&u.gloveLeft===0;glove.disabled=paused()||state.mode!=='fight'||!deck&&u.gloveLeft>0;glove.setAttribute('aria-pressed',deck?String(!!u.deckOn):'false');glove.querySelector('small').textContent=deck?(u.deckOn?'자동 ON':'자동 OFF'):u.gloveLeft>0?Math.ceil(u.gloveLeft/1000)+'초':u.gloves+'개';glove.style.setProperty('--cooldown',u.gloveLeft/120000*360+'deg');}
    if(t.active){
      if(t.won&&t.phase!=='overview')t.phase='defeat';
      if(t.phase==='fight'){
        $('storyDialog').hidden=true;dialogKey='';
        if(state.fightMs>40000&&state.onboarding.step>=4&&u.gloves===0&&u.gloveLeft===0)u.gloves=1;
        const line=D.storyV15.tutorial.coaching[Math.min(3,Math.floor(state.fightMs/18000))];$('audienceLine').textContent=line.text;
        return;
      }
      if(t.won&&$('audience').dataset.asset!=='assets/aud-tutorial-dogyeom-happy.png')sprite($('audience'),'assets/aud-tutorial-dogyeom-happy.png');
      const overview=['관객의 의심을 줄여 감탄시키자!','케이스를 열어 더 큰 무대로 가자!','비법으로 강해지고 도감에서 친구를 만나!'].map(text=>({speaker:'밍기리',text}));
      const lines=t.phase==='overview'?overview:D.storyV15.tutorial[t.phase==='defeat'?'defeat':'intro'];
      const finish=()=>{C.finishTutorial(state);lastAudience='';dialogKey='';save();render();};
      renderDialog(lines,t.line||0,'tutorial:'+t.phase,()=>{if((t.line||0)+1<lines.length)t.line=(t.line||0)+1;else if(t.phase==='intro'){t.phase='fight';t.line=0;}else if(t.phase==='defeat'){t.phase='overview';t.line=0;}else finish();save();},finish);return;
    }
    if(!renderU15.sceneRequested&&!presentation.busy&&!state.u18.anchor&&t.done&&(state.mode!=='transition'||state.idle.waiting)&&!u.scene&&u.queue.length&&!menu&&!document.hidden&&state.features.climax.left<=0){renderU15.sceneRequested=true;presentation.push({minimum:0,hold:true,priority:50,start:item=>{renderU15.sceneRequested=false;if(!C.startScene(state))item.hold=false;}});}
    if(u.scene){if(!presentation.active&& !presentation.items.length)presentation.push({minimum:0,hold:true,priority:50});if(bioPending)bioUntil=0;const scene=u.scene,lines=D.storyV15.venues[scene.slug][scene.kind];renderDialog(lines,scene.line,'story:'+scene.dimension+':'+scene.slug+':'+scene.kind,()=>{C.advanceScene(state,false);if(!u.scene)presentation.finish();save();},()=>{C.advanceScene(state,true);presentation.finish();save();});}
    else if(state.idle.waiting&&!presentation.busy&&!u.queue.length){renderDialog([{speaker:D.venues[state.venue-1].name,text:'새 관객에게 마술을 보여 주세요.'}],0,'stage:'+state.dimension+':'+state.venue,()=>C.startStage(state),()=>C.startStage(state));}
    else{if(!(state.idle.waiting&&u.queue.length)){$('storyDialog').hidden=true;dialogKey='';}if(bioPending&&state.mode==='fight'&&!state.telegraphed&&state.review.target<0){if(!u.bios.includes(bioPending))u.bios.push(bioPending);bioPending='';bioUntil=0;}}
    if(C.autoStage(state)&&(u.scene||state.idle.waiting)&&!menu&&!document.hidden&&!portrait()){
      $('autoIndicator').hidden=false;if($('autoIndicator').textContent!=='칼리 덱 자동 진행 중: 다음 무대로 이동해요')$('autoIndicator').textContent='칼리 덱 자동 진행 중: 다음 무대로 이동해요';
      const key=u.scene?u.scene.slug+':'+u.scene.kind+':'+u.scene.line:'stage:'+state.venue;
      if(renderU15.autoKey!==key){renderU15.autoKey=key;renderU15.autoAt=clock;}
      if(clock-renderU15.autoAt>=2500){if(u.scene){C.advanceScene(state,false);if(!u.scene){presentation.finish();if(state.idle.waiting&&!u.queue.length)C.startStage(state);}save();}else if(C.startStage(state))save();else renderU15.autoAt=clock;}
    }else{renderU15.autoKey='';if($('autoIndicator').textContent!=='자동')$('autoIndicator').textContent='자동';}
    $('audienceLine').hidden=!wonMoment&&(clock>bioUntil||!!u.scene||state.telegraphed||state.review.target>=0);
  }
  function storyList(){
    openPanel('stories','이야기');
    const seen=state.u15.seen;
    if(!seen.length)$('panelBody').append(element('p','한 번 본 이야기가 여기에 모여요.'));
    for(const key of seen){const [dimension,slug,kind]=key.split(':'),v=C.venueBySlug(slug);const labels={opening:'첫 인사',beforeHeadliner:'마지막 관객',afterClear:'공연 뒤'};
      $('panelBody').append(action(`차원 ${dimension} · ${v.name} · ${labels[kind]}`,()=>{closePanel();C.startScene(state,{dimension:Number(dimension),slug,kind});save();render();}));}
  }
  $('storyButton').addEventListener('click',storyList);sprite($('storyIcon'),'assets/icon-story.png');
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
  $('installButton').addEventListener('click',()=>{if(installPrompt){installPrompt.prompt();installPrompt=null;}else{openPanel('install','앱 설치');$('panelBody').append(element('p','브라우저 메뉴에서 홈 화면에 추가를 누르세요.'));}});
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
    // U36: game time follows real time. The old 50 ms cap made the whole game run in slow motion below 20 fps (about 45 percent speed at the 9 fps
    // a phone reached late in the game: timers, attacks, fans, glove). A frame now advances up to 250 ms; Core steps it in 50 ms substeps.
    const dt = previous ? Math.max(0, Math.min(MAX_FRAME_MS, now - previous)) : 0;
    previous = now;
    if (!document.hidden) clock += dt;
    drawEffects(); // v4 U40: drawn before this frame's combat step and DOM writes (see the note at the end of loop); effects born in the step start drawing next frame
    if (!paused()) {
      let remaining = dt * (debug ? 10 : 1);
      // Stop at a failure event, even at debug speed: Core already restarted.
      while (remaining > 0 && !paused()) {
        const slice = Math.min(50, remaining, ...boardHolds.map(p=>Math.max(.001,p.left)));
        // No targets during the intervals between UI pulses. Combat still advances
        // with the measured dt; the 0.001 ms press lets Core emit its instant hit.
        stepCombat(slice,{taps:[],holding:boardHolds.length>0});
        remaining -= slice;
        if (boardHolds.length && !paused()) {
          const next=C.advanceHolds(boardHolds,slice,C.wandRate(state)); boardHolds=next.holds;
          for (const point of next.pulses) pulse(point);
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
    $('phoneMore').hidden = !$('phoneMore').hidden;
    if(!$('phoneMore').hidden){release();clearDecorations();}
    $('moreButton').setAttribute('aria-expanded', String(!$('phoneMore').hidden));
  });
  $('phoneMore').addEventListener('click', e => { if (e.target.closest('button')) { $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false'); } });
  $('statsButton').addEventListener('click', () => {
    if(phone){
      openPanel('stats','능력치');
      // v4 U38: the fight numbers come first and use the same units as the threat numbers on the audience card (per second, C.formatNumber).
      const F=C.formatNumber,th=C.threatInfo(state),mine=C.attackRate(state);
      const rows=[
        ['내 공격','관객의 의심을 1초에 이만큼 줄여요',mine==null?'재는 중':`${F(mine)}/초`],
        ['야유',th.last?'지금은 마지막 야유 한 번이 와요 (멘탈과 자신감을 합친 만큼 버텨요)':`관객의 야유가 1초에 이만큼이에요 (한 번 ${F(th.hit)}, ${+th.every.toFixed(1)}초마다)`,th.last?`마지막 한 번 ${F(th.hit)}`:`${F(th.perSecond)}/초`]
      ];
      if(th.regen>0)rows.push(['의심 회복','관객의 의심이 1초에 이만큼 다시 차올라요',`${F(th.regen)}/초`]);
      rows.push(['멘탈',`야유를 버티는 힘 (가득 차면 ${F(state.mentalMax)})`,F(state.mental)]);
      rows.push(['자신감',`야유를 먼저 막아 줘요 (야유 한 번 ${F(th.hit)} 중 막는 양 ${F(th.block)})`,F(th.shield)]);
      rows.push([D.statNames.power,D.statMeanings.power,F(C.wandDamage(state))],[D.statNames.damage,D.statMeanings.damage,F(C.CONST.itemDamage*state._V)]);
      for(const [name,meaning,value] of rows){const row=element('section','','easy-stat');row.append(element('h2',name),element('p',meaning),element('strong',value));$('panelBody').append(row);}
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
    motionMetrics:()=>({particles:particles.length,flights:flights.length,numbers:numbers.length,badges:badges.length,coinOrigin:clearMoment.origin||null,flightOrigins:flights.map(f=>[f.x,f.y])}), hitTier, openCurtainCall, openRestore, getState: () => state, startScene:C.startScene, storyList, renderU15, getHolds: () => boardHolds, startIntro, buyAll: buyAllUI, events, save, toast, banner, openPanel, closePanel, render, showFailure, showBoo, clearDecorations, opaqueSprites,
    openBook: tree, focusNode, openBestiary: bestiary, openMissions:drawMissions, renderCoach,
    openDealer: dealer, openGemShop:gemShop, openMap:openStageMap, openCustomize:customize, drawDealer, openEnding: () => { if (state.seenEnding) { revealEnding = false; showEnding(); } },
    openRebirth: () => { if (state.seenEnding) showRebirth(); }, isPaused: paused
  };
  sprite($('magicianMini'), 'assets/magician-mini.png');
  renderOutfit();
  $('magicianMini').dataset.frame = '0';$('magicianMini').classList.remove('reacting');
  $('goalStrip').addEventListener('click', () => { tutorialSignal('goal'); const id = $('goalStrip').dataset.nodeId; if (id) focusNode(id); });
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
        const preferred=context.querySelector('.stage-start:not([disabled]),.practice-enter:not([disabled]),.tree-buy:not([disabled])')||(context.id==='phoneMore'?null:[...context.querySelectorAll('button:not([disabled])')].find(el=>!el.hidden&&!el.closest('.panel-tabs')&&!el.classList.contains('game-cup')&&!el.classList.contains('routine-card')&&!el.classList.contains('dealer-back')&&!el.closest('.cups-table')));
        if(current!==preferred){current?.classList.remove('u26-primary');preferred?.classList.add('u26-primary');}
      }
    });
  };
  const presentationObserver=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'?[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1):r.oldValue!==r.target.getAttribute(r.attributeName)))refreshPresentation();});
  for(const id of ['panelBody','storyDialog','phoneMore'])presentationObserver.observe($(id),{childList:true,subtree:true,attributes:true,attributeFilter:['disabled'],attributeOldValue:true});
  for(const id of ['panel','storyDialog','phoneMore','banner'])presentationObserver.observe($(id),{attributes:true,attributeFilter:['hidden'],attributeOldValue:true});
  window.addEventListener('resize',refreshPresentation);motion.addEventListener('change',refreshPresentation);
  refreshPresentation();
  $('audience').addEventListener('click',()=>{bioUntil=clock+5000;renderU15();});
  $('audience').setAttribute('tabindex','0');$('audience').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();bioUntil=clock+5000;renderU15();}});
  fit(); render(); showOffline();
  if(state.u18.map)openStageMap();
  if (!state.onboarding.intro) startIntro(false);
  if (seasonReset) toast('새 테스트가 시작됐어요. 처음부터 다시 즐겨 주세요!');
  if (corrupt) toast('저장을 불러오지 못해 백업해 두었어요');
  if (recoveredSave) toast('저장이 손상돼 최근 백업에서 되찾았어요');
  if (repairedSave) toast('저장을 조금 고쳐서 불러왔어요');
  if (refundedCoins > 0) toast(`끝없는 비법이 정리돼서 동전 ${C.formatNumber(refundedCoins)}을 돌려받았어요`);
  if (refundedKeys > 0) toast(`칼리 덱이 스킬로 합쳐져서 열쇠 ${C.formatNumber(refundedKeys)}개를 돌려받았어요`);
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
  requestAnimationFrame(loop);
})();
