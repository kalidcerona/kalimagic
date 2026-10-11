/* Pure U5 presentation models shared by runtime and tests. */
globalThis.U5 = (() => {
  const effects = {
    power: ['🪄', '마술 실력', 'stat-power'], damage: ['🃏', '연출', 'stat-damage'],
    shield: ['🛡️', '멘탈 보호막', 'stat-guard'], heal: ['🥤', '멘탈 회복', 'stat-heal'],
    coins: ['🪙', '동전', 'coins'], xpBurst: ['⭐', '경험치', 'xpNumber'],
    finisher: ['🔥', '피날레', 'finisherFill'], boxFill: ['📦', '케이스', 'board']
  };
  function effectBadge(e) {
    const [icon, label, stat] = effects[e.effect] || effects.damage;
    const value = e.effect === 'boxFill' ? `${Math.round(e.value * 100)}%` : String(Math.max(0, Math.round(e.value || 0)));
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
  function measure(width, height, safe = {}, coarse = false) {
    const left = safe.left || 0, right = safe.right || 0, top = safe.top || 0, bottom = safe.bottom || 0;
    const w = width - left - right, h = height - top - bottom;
    const phone = Math.min(width, height) <= 500 || (coarse && Math.min(width / 1600, height / 900) < .6);
    const board = Math.max(0, Math.min(h - 82, w - 240));
    return { phone, width: w, height: h, board, audience: w - board - 18 };
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
  return { measure, transform };
})();
/* U11 guidance is read-only: purchases remain explicit Core actions. */
globalThis.Guidance = (() => {
  function target(state, D, C) {
    const pinned = D.tree.find(n => n.id === state.guidance.pin);
    if (pinned) return pinned;
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
    const costText = !node ? '' : info.cost === null ? '완성' : info.purchasable ? '배울 수 있어요!' : remaining ? `${{coins:'동전',keys:'열쇠',starlight:'별빛'}[info.currency]} ${remaining} 더` : info.blockedReason;
    const nodeText = node ? node.name : '비법 완성';
    const learn = node ? `${nodeText} · ${costText}` : nodeText;
    const venue = D.venues[state.venue];
    return { node, progress, nodeText, costText, caseText: `개봉 ${progress}%`, targetText: learn, venueText: venue ? `다음 ${venue.name}` : '귀환 엔딩', text: `다음 목표 · 개봉 ${progress}% · ${learn} · ${venue ? venue.name : '귀환 엔딩'}` };
  }
  function failure(state,D,C) {
    const ids = ['mental','openingShield','calm','attack','power'];
    const node = ids.map(id => D.tree.find(n=>n.id===id)).find(n => n && C.nodeInfo(state,n.id).revealed && C.nodeInfo(state,n.id).cost !== null) || target(state,D,C) || D.tree[0];
    return { line: '야유를 버틸 멘탈이 부족했어요', node };
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
/* DOM presentation only. All combat, progression and purchases use Core. */
(function () {
  'use strict';
  const D = window.GAME_DATA, C = window.Core;
  const sound = (name, options) => window.Sfx && window.Sfx.play(name, options);
  let bestiaryTab = 'audiences', endingStep = 0, revealEnding = false;
  const assetCache = new Map();
  function assetImage(path) {
    if (!assetCache.has(path)) {
      const img = new Image(); img.src = path; assetCache.set(path, img);
    }
    return assetCache.get(path);
  }
  function sprite(host, path) {
    host.querySelectorAll(':scope > .asset-sprite').forEach(img => img.remove());
    host.classList.remove('asset-ready'); host.dataset.asset = path;
    const source = assetImage(path);
    const show = () => {
      if (host.dataset.asset !== path || !source.naturalWidth) return;
      const image = source.cloneNode(); image.className = 'asset-sprite'; image.alt = '';
      host.append(image); host.classList.add('asset-ready');
    };
    if (source.complete) show(); else source.addEventListener('load', show, { once: true });
  }
  const venueAsset = v => `assets/${v.venueAsset}`;
  const audienceAsset = (v, a) => a.portraitAsset ? `assets/${a.portraitAsset}` : a === v.headliner ? `assets/headliner-${a.id}.png` : `assets/aud-${a.id}.png`;
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
  let saveWarning = false, failure = null, lastMode = '', tapRemaining = 0, shakeUntil = 0;
  const pointer = { id: null, held: false, x: -1, y: -1, inside: false };
  const particles = [], flights = [], numbers = [], cells = [];
  let badges = [], wonMoment = null;
  const lastHeckles = new Map(), happyCache = new Map();
  const caps = { particles: coarse ? 120 : 240, icons: 24, numbers: 12 };
  const canvas = $('effects'), ctx = canvas.getContext('2d');
  const animations = new WeakMap();
  const patterns = ['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
  let corrupt = false, inaccessible = false;
  let state = C.newGame(Date.now() >>> 0);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const loaded = C.deserialize(raw);
      if (loaded) state = loaded;
      else corrupt = true;
    }
  } catch (error) { inaccessible = true; }

  function num(el, value) {
    const compact = phone && ['coins','gems','keys'].includes(el.id) && Number(value) >= 10000;
    const text = compact ? (Number(value) >= 1e8 ? `${(Number(value) / 1e8).toFixed(1)}억` : `${(Number(value) / 1e4).toFixed(1)}만`) : String(value);
    if (el.dataset.rendered === text) return;
    el.dataset.rendered = text;
    el.setAttribute('aria-label', text);
    el.replaceChildren();
    for (const ch of text) {
      const glyph = document.createElement('span');
      glyph.setAttribute('aria-hidden', 'true');
      if (/\d/.test(ch)) {
        glyph.className = 'digit';
        for (const bit of patterns[Number(ch)]) {
          const pixel = document.createElement('i');
          if (bit === '0') pixel.className = 'off';
          glyph.append(pixel);
        }
      } else { glyph.className = 'digit-separator'; glyph.textContent = ch; }
      el.append(glyph);
    }
  }
  const rounded = v => Math.max(0, Math.round(v));
  const randomLine = list => list[Math.floor(Math.random() * list.length)];
  const portrait = () => innerHeight > innerWidth;
  const paused = () => document.hidden || !!menu || portrait() || !!stageRewardHost || (phone && !$('phoneMore').hidden);
  function fit() {
    const vv = window.visualViewport;
    const width = vv ? vv.width : innerWidth, height = vv ? vv.height : innerHeight;
    const probe = getComputedStyle($('safeArea'));
    const safe = Object.fromEntries(['left','right','top','bottom'].map(side => [side, parseFloat(probe.getPropertyValue(`padding-${side}`)) || 0]));
    const layout = PhoneLayout.measure(width, height, safe, coarse);
    phone = layout.phone;
    document.body.classList.toggle('phone', phone);
    document.body.classList.toggle('phone-tight', phone && layout.height <= 340);
    document.body.classList.toggle('portrait', portrait());
    scale = phone ? 1 : Math.min(innerWidth / 1600, innerHeight / 900);
    layoutWidth = phone ? layout.width : 1600; layoutHeight = phone ? layout.height : 900;
    const frame = $('frame'), stage = $('stage');
    frame.style.width = `${layoutWidth * scale}px`; frame.style.height = `${layoutHeight * scale}px`;
    frame.style.position = phone ? 'absolute' : 'relative';
    frame.style.left = phone ? `${safe.left + (vv?.offsetLeft || 0)}px` : '';
    frame.style.top = phone ? `${safe.top + (vv?.offsetTop || 0)}px` : '';
    stage.style.width = `${layoutWidth}px`; stage.style.height = `${layoutHeight}px`;
    stage.style.transform = `scale(${scale})`;
    stage.style.setProperty('--board-size', `${layout.board}px`);
    stage.style.setProperty('--audience-width', `${layout.audience}px`);
    const dpr = phone ? Math.min(2, window.devicePixelRatio || 1) : 1;
    canvas.width = Math.round(layoutWidth * dpr); canvas.height = Math.round(layoutHeight * dpr);
    canvas.style.width = `${layoutWidth}px`; canvas.style.height = `${layoutHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    caps.particles = phone ? 48 : (coarse ? 120 : 240); caps.icons = phone ? 8 : 24;
    particles.length = 0; flights.length = 0; numbers.length = 0; badges.length = 0;
    phoneChrome(); release(); previous = 0;
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
      for (const id of ['dealerButton','rebirthButton','soundButton','retreatButton','helperControls','debug']) moveChrome($(id), $('phoneMore'));
      $('bookButton').textContent = '📖 비법'; $('bestiaryButton').textContent = '📚 도감';
      $('closePanel').textContent = '← 뒤로';
    } else {
      for (const [el, home] of [...chromeHomes].reverse()) home.parent.insertBefore(el, home.next?.parentNode === home.parent ? home.next : null);
      chromeHomes.clear(); $('bookButton').textContent = '비법서'; $('bestiaryButton').textContent = '도감'; $('closePanel').textContent = '닫기';
    }
    $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false');
  }
  function boardTransform() { return PhoneLayout.transform($('board').getBoundingClientRect(), C.CONST.boardSize); }
  function boardPoint(x, y) {
    const p = boardTransform().toScreen(x, y), r = $('stage').getBoundingClientRect();
    return { x: (p.x - r.left) / scale, y: (p.y - r.top) / scale };
  }
  const toastQueue = [], visibleToasts = [];
  let lastToastKind = '';
  function toast(text, kind = '') {
    const last = toastQueue[toastQueue.length - 1] || visibleToasts[visibleToasts.length - 1];
    if (kind === 'trophy' && lastToastKind === kind && last?.kind === kind) {
      last.count++; last.text = `새 기록 ${last.count}개 · 자세한 내용은 도감에서`;
      if (last.el) { last.el.textContent = last.text; last.age = 0; }
    } else toastQueue.push({ text: kind === 'trophy' ? '새 기록 1개 · 자세한 내용은 도감에서' : text, kind, count: 1 });
    lastToastKind = kind;
    nextToasts();
  }
  function nextToasts(dt = 0) {
    const lane = $('toasts');
    // Defer messages and their lifetime while a panel or cinematic is visible.
    lane.hidden = !!menu || !$('panel').hidden || document.hidden ||
      state.features.climax.left > 0 || !!document.querySelector('.stage-reward');
    if (lane.hidden) return;
    for (let i = visibleToasts.length - 1; i >= 0; i--) {
      const item = visibleToasts[i]; item.age += dt;
      item.el.style.opacity = String(Math.min(1, (2500 - item.age) / 350));
      if (item.age >= 2500) { item.el.remove(); visibleToasts.splice(i, 1); }
    }
    while (visibleToasts.length < 2 && toastQueue.length) {
      const el = document.createElement('div');
      const item = toastQueue.shift(); el.className = 'toast'; el.textContent = item.text;
      lane.prepend(el); visibleToasts.push({ ...item, el, age: 0 });
    }
  }
  function winLine() {
    // Curtain call names the final pre-boss sequence, never a generic victory.
    return randomLine(D.pools.win.filter(line => !line.includes('커튼콜')));
  }
  function save() {
    try {
      // Core's expired timers can be slightly negative at real frame boundaries.
      // Its validator expects nonnegative saved timers. Normalize only the save
      // snapshot, leaving the live simulation and every other field untouched.
      const snapshot = Object.assign({}, state, {
        comboMs: Math.max(0, state.comboMs),
        sealMs: Math.max(0, state.sealMs),
        transMs: Math.max(0, state.transMs)
      });
      localStorage.setItem(KEY, C.serialize(snapshot));
    }
    catch (error) {
      if (!saveWarning) { toast('저장할 수 없어요. 이번 공연은 계속돼요'); saveWarning = true; }
    }
  }
  let bannerTimer, stageRewardTimer, stageRewardHost = null;
  const bannerQueue = [], unlockBannerQueue = [];
  let bannerActive = null, bigBannerAt = state.features.elapsedMs - 8000, bannerDimension = state.dimension;
  function bannerContext() {
    const c = U5.encounter(D.venues, state);
    return state.mode === 'transition' && wonMoment && clock < wonMoment.until ? wonMoment.context : c;
  }
  function dismissBanner() {
    clearTimeout(bannerTimer); $('banner').hidden = true; bannerActive = null;
  }
  function banner(text, sub = '', big = false, permanent = false, context = bannerContext()) {
    const queue = permanent ? unlockBannerQueue : bannerQueue;
    if (queue.length < 16) queue.push({ text, sub, big, permanent, ...context });
    nextBanner();
  }
  function nextBanner() {
    const context = bannerContext();
    for (let i = bannerQueue.length - 1; i >= 0; i--) if (!U5.bannerMatches(bannerQueue[i], context)) bannerQueue.splice(i, 1);
    if (bannerActive && !bannerActive.permanent && !U5.bannerMatches(bannerActive, context)) dismissBanner();
    if (bannerDimension !== state.dimension) { bannerDimension = state.dimension; bigBannerAt = -C.CONST.revealGapMs; }
    if (bannerActive || stageRewardHost || menu) return;
    const queue = bannerQueue.length ? bannerQueue : unlockBannerQueue;
    if (!queue.length || (queue[0].big && state.features.elapsedMs - bigBannerAt < C.CONST.revealGapMs)) return;
    const b = queue.shift(); bannerActive = b;
    if (b.big) bigBannerAt = state.features.elapsedMs;
    $('banner').replaceChildren(document.createTextNode(b.text));
    if (b.sub) { const small = document.createElement('small'); small.textContent = b.sub; $('banner').append(small); }
    $('banner').classList.toggle('big', b.big); $('banner').hidden = false;
    bannerTimer = setTimeout(() => { dismissBanner(); nextBanner(); }, b.big ? 1600 : 1200);
  }
  function showStageReward(reward) {
    if (state.mode !== 'transition') return;
    if (bannerActive?.permanent) unlockBannerQueue.unshift(bannerActive);
    dismissBanner(); clearTimeout(stageRewardTimer); stageRewardHost?.remove();
    const r = D.stageRewards[reward - 1];
    const host = element('button', '', 'stage-reward'); stageRewardHost = host;
    host.type = 'button'; host.setAttribute('aria-label', `${r.effect} · 눌러서 계속`);
    const art = element('img'); art.src = `assets/reward-${r.id}.png`; art.alt = '';
    host.append(art, element('h2', r.effect), element('p', r.quote)); $('stage').append(host);
    const skip = () => { clearTimeout(stageRewardTimer); host.remove(); stageRewardHost = null; previous = 0; nextBanner(); };
    host.addEventListener('click', skip); stageRewardTimer = setTimeout(skip, 1500);
    release();
  }
  function animate(el, frames, duration) {
    if (!el || reduced) return;
    const old = animations.get(el);
    if (old) old.cancel();
    animations.set(el, el.animate(frames, { duration, easing: 'linear' }));
  }
  function tilt() {
    if (clock < shakeUntil) return;
    animate($('audience'), [{ transform: `rotate(${Math.random() < .5 ? -3 : 3}deg)` }, { transform: 'rotate(0deg)' }], 120);
  }
  function float(text, x, y, color = '#b8ff91', size = 32) {
    if (phone) {
      if (x === 426 || x === 676) { const r = $('audience').getBoundingClientRect(), stage = $('stage').getBoundingClientRect(); x = r.left + r.width / 2 - stage.left; y = r.top + r.height / 2 - stage.top; }
      size = Math.min(size, 16);
    }
    if (numbers.length >= caps.numbers) return;
    numbers.push({ text, x, y, color, size, start: clock, life: 450 });
  }
  function statFloat(effect, value) {
    const model = U5.effectBadge({ effect, value });
    const collapsed = typeof phone !== 'undefined' && phone && !$('statsButton').classList.contains('expanded') && ['power','damage','shield','heal'].includes(effect);
    const el = $(collapsed ? 'statsButton' : model.stat);
    animate(el, [{ opacity: .4 }, { opacity: 1 }], 220);
    // Currency arrivals pulse their value without drawing over the reserved HUD.
    if (effect === 'coins') return;
    const r = el?.getBoundingClientRect(), stage = $('stage').getBoundingClientRect();
    if (!r) return;
    const x = (r.left - stage.left) / scale + (collapsed ? r.width + 22 : -26), y = (r.top + r.height / 2 - stage.top) / scale;
    if (numbers.length < caps.numbers) numbers.push({ text: model.text.slice(model.text.indexOf('+')), x, y,
      color: '#a8e8ff', size: 18, start: clock, life: 350, fixed: true });
  }
  function burst(x, y, color) {
    if (reduced) return;
    for (let i = 0; i < 14 && particles.length < caps.particles; i++) {
      const angle = i * Math.PI * 2 / 14;
      particles.push({ x, y, dx: Math.cos(angle) * (40 + i % 3 * 15), dy: Math.sin(angle) * (42 + i % 4 * 13), start: clock, life: i < 4 ? 120 : 320, line: i < 4, color, size: 8 + i % 3 * 3 });
    }
  }
  function target(effect) {
    if (phone) {
      const id = effect === 'gems' ? 'gems' : U5.effectBadge({ effect }).stat;
      const el = ['stat-power','stat-damage','stat-guard','stat-heal'].includes(id) && !$('statsButton').classList.contains('expanded') ? $('statsButton') : $(id);
      const r = el.getBoundingClientRect(), stage = $('stage').getBoundingClientRect();
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
  function coinStream(x, y, count) {
    for (let i = 0; i < Math.min(count, 8); i++) fly(x + i * 5, y, target('coins'), '🪙', '', '#ffe35b', i * 28);
  }
  function cellCenter(i) {
    const p = C.cellPosition(state, i), k = C.CONST;
    const pitch = k.cellSize + k.cellGap;
    return boardPoint(k.boardInset + p.col * pitch + k.cellSize / 2, k.boardInset + p.row * pitch + k.cellSize / 2);
  }

  function events(list) {
    for (const [id,,message] of Guidance.firstEffects(state,list)) {
      state.guidance.seen.push(id); toast(message);
      animate($('board'), [{filter:'brightness(1)'},{filter:'brightness(1.4)'},{filter:'brightness(1)'}], 450);
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
    for (const e of list) {
      if (e.type === 'stageReward') {
        sound('milestone'); showStageReward(e.reward);
      }
      if (e.type === 'magicHit') {
        const p=cellCenter(e.cell); squash(e.cell);
        if (e.helper === 'cardthrow') fly(700,650,p,'🃏','', '#fff',0,assetImage('assets/proj-card.png'));
      }
      if(e.type === 'magicCoins'){const p=cellCenter(e.cell);coinStream(p.x,p.y,e.coins);}
      if(e.type === 'spotlight'){
        const beam=element('div','','spotlight-beam');beam.style.top=`${160+8+e.row*120}px`;$('stage').append(beam);setTimeout(()=>beam.remove(),600);
      }
      if(e.type === 'paperFlash'){$('stage').classList.add('paper-flash');sound('finisher');setTimeout(()=>$('stage').classList.remove('paper-flash'),300);}
      if(e.type === 'bossMirror')toast('의심의 거울 · 연쇄와 도우미가 열어 줘요');
      window.dispatchEvent(new CustomEvent('magicshow:event', { detail: e }));
      const sounds = { crit: 'crit', golden: 'golden', goldenBreak: 'golden', comboMilestone: 'milestone', encore: 'encore', boxBreak: 'box', combo: 'combo', audHit: 'hit', finisher: 'finisher', heckleTelegraph: 'heckle', fail: 'failure', win: 'coin' };
      if (sounds[e.type]) sound(sounds[e.type], { combo: e.n, auto: !pointer.held && ['boxBreak','combo','audHit'].includes(e.type) });
      if (e.type === 'heckle' && e.dmg > e.shieldDmg) sound('mental');
      if (e.type === 'itemLand' && e.effect === 'coins') sound('coin');
      if (e.type === 'finisher') kaliPose(1,400);
      if (e.type === 'boxHit') squash(e.cell);
      if (e.type === 'boxBreak') {
        if (e.source === 'manual') kaliPose(1,400);
        squash(e.cell);
        const p = cellCenter(e.cell);
        const rarity = D.items.rarities.find(r => r.id === e.rarity);
        const color = rarity ? rarity.color : '#ffe35b';
        burst(p.x, p.y, color); sound('whoosh', { auto: !pointer.held });

        coinStream(p.x, p.y, 1);
        if (e.gem) fly(p.x, p.y, target('gems'), '💎');
      } else if (e.type === 'unlockReveal') {
        const labels = { slot: ['새 케이스 자리!', '옆자리에서도 마술을 시작해요'], area: ['지팡이가 넓어졌어요!', '여러 케이스를 한 번에 두드려요'], dove: ['마술 비둘기 등장!', '관객에게 날아가 감탄을 더해요'], rabbit: ['마술 토끼 등장!', '주머니에서 동전을 꺼내줘요'], boxHelper: ['팬들이 일을 도와요!', '케이스를 돌아가며 두드려요'], assistant: ['마술 어시스턴트 등장!', '황금 케이스 작업도 맡겨요'], equip: ['소품 진열대 해금!', '최대 3개 자동 장착 · 소품마다 해당 종류 드롭 가중치 ×1.02'] };
        banner(...(labels[e.id] || ['숨은 비법 발견!', D.tree.find(n => 'hidden:' + n.id === e.id)?.name || '새 비법을 확인하세요']), true, true); save();
      } else if (e.type === 'comboMilestone') {
        toast(`콤보 ${e.threshold}! 피날레 +${e.gauge} · 동전 +${rounded(e.coins)}`);
      } else if (e.type === 'golden') {
        const p = cellCenter(e.cell); burst(p.x, p.y, '#ffe65c'); toast('황금 케이스! 희귀 이상 소품과 추가 동전');
      } else if (e.type === 'goldenBreak') {
        toast(`금빛 사례 +${e.coins}`);
      } else if (e.type === 'achievement') {
        toast(`🏅 ${achievementLabels[e.id]} · 연출 +0.5%`);
      } else if (e.type === 'encore') {
        toast(`앵콜! ${e.duration / 1000}초간 지팡이가 강해져요`);
      } else if (e.type === 'worker' && e.phase === 'work') {
        squash(e.cell); sound('worker', { auto: true });
      } else if (e.type === 'crit') {
        const p = cellCenter(e.cell);
        float(`번뜩임! ${rounded(e.dmg)}`, p.x, p.y - 50, '#ffe65c', 48);
        burst(p.x, p.y, '#ffe65c');
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
        animate($('flash'), [{ opacity: .55 }, { opacity: 0 }], 160);
        shakeUntil = clock + 160; sound('whoosh');
      } else if (e.type === 'combo') {
        animate($('combo'), [{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], 140);
      } else if (e.type === 'audHit') {
        tilt(); float(e.dmg ? String(rounded(e.dmg)) : '빗나감', 426, 326);
      } else if (e.type === 'itemLand') {
        statFloat(e.effect, e.value);
      } else if (e.type === 'finisher') {
        shakeUntil = clock + 160;
        animate($('flash'), [{ opacity: .8, offset: 0 }, { opacity: .16, offset: .2 }, { opacity: 0 }], 400);
        animate($('audienceCard'), [{ transform: 'translateX(0)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(0)' }], 160);
        float(`피날레 ${rounded(e.dmg)}`, 426, 275, '#ffe65c');
      } else if (e.type === 'heckleTelegraph') {
        const v = D.venues[state.venue - 1], a = v.audiences[state.j - 1] || v.headliner;
        const line = U5.selectHeckle(a, venueHeckles(state.venue), lastHeckles.get(a.id));
        lastHeckles.set(a.id, line); $('heckle').textContent = line;
      } else if (e.type === 'heckle') {
        if (e.dmg > e.shieldDmg) float(`멘탈 −${rounded(e.dmg - e.shieldDmg)}`, 426, 714, '#ff8d8d');
        if (state.pattern === 'stealCoins') {
          for (let i = 0; i < 5; i++) fly(1230, 90, { x: 426 + i * 25, y: 320 }, '🪙', '', '#ffbd73', i * 25);
          patternPulse('동전을 가져갔어요');
        }
        if (e.shieldDmg) float(`방어 −${rounded(e.shieldDmg)}`, 676, 714, '#a8e8ff');
        animate($('mental'), [{ opacity: 1 }, { opacity: .2 }, { opacity: 1 }], 120);
      } else if (e.type === 'caseLevelUp') {
        const p = cellCenter(e.cell);
        float('LV UP!', p.x, p.y - 35, '#fff18a', e.tierChanged ? 56 : 32);
        sound(e.tierChanged ? 'caseTier' : 'caseLevel');
        if (e.tierChanged) { burst(p.x, p.y, '#fff18a'); squash(e.cell); }
      } else if (e.type === 'chain') {
        const a = cellCenter(e.from), b = cellCenter(e.to);
        const line = element('div', '', 'case-lightning');
        Object.assign(line.style, {left: `${a.x}px`, top: `${a.y}px`, width: `${Math.hypot(b.x-a.x,b.y-a.y)}px`, transform: `rotate(${Math.atan2(b.y-a.y,b.x-a.x)}rad)`});
        $('stage').append(line); setTimeout(() => line.remove(), 180);
      } else if (e.type === 'levelUp') {
        toast(`레벨 ${e.level}! 멘탈 회복`);
      } else if (e.type === 'win') {
        kaliPose(2,C.CONST.winTransitionMs);
        const v = D.venues[e.venue - 1], a = v.audiences[e.j - 1] || v.headliner;
        const context = { ...U5.encounter(D.venues, state), venueSlug: v.slug, audId: a.id,
          encounterId: `${state.dimension}:${state.wins}:${state.fails}:${a.id}` };
        wonMoment = { v, a, context, until: clock + C.CONST.winTransitionMs };
        happySprite($('audience'), audienceAsset(v, a));
        $('audienceLine').textContent = a.winLine;
        animate($('audience'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)' }, { transform: 'translateY(0)' }], 420);
        burst(426, 350, '#ffe65c');
        banner(winLine(), e.j === v.audiences.length + 1 ? v.headliner.defeatLine : `동전 +${e.coins}`, false, false, context);
        coinStream(426, 412, e.coins);
        if (e.trophy) toast(`🏆 ${v.trophy} 획득!`, 'trophy');
        if (e.keys) toast('🔑 관객 도감 완성! 열쇠 1개');
        save();
      } else if (e.type === 'venueUnlocked') {
        if (e.name) banner(`${e.name} 도착!`, D.venues[e.venue - 1].intro, true); save();
      } else if (e.type === 'fail') {
        failure = e.reasonPct; lastAudience = ''; release();
        showFailure(); save();
      } else if (e.type === 'phase2') {
        phaseTransition();
      } else if (e.type === 'selfReconciliation') {
        openPanel('bossPhase', '나에게 보내는 박수');
        e.lines.forEach(line => $('panelBody').append(element('p',line)));
        const next=action('렉쳐노트로 돌아가기', () => { menu=''; $('panel').hidden=true; previous=0; save(); });
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
    animate(cells[i].box, [{ transform: 'scale(1)' }, { transform: 'scale(.92,.88)', offset: 1 / 3 }, { transform: 'scale(1)' }], 120);
  }
  function slotCondition() {
    const cost = C.nodeCost(state, 'board');
    const options = [];
    if (cost !== null) options.push(`비법서 케이스 자리 구매 · 동전 ${cost}`);
    if (state.vMax < D.venues.length) options.push(`${D.venues[state.vMax].name} 첫 도착`);
    return options.join(' 또는 ');
  }
  function buildBoard() {
    if (lastLayout === 'fixed') return;
    lastLayout = 'fixed'; cells.length = 0; $('board').replaceChildren();
    for (let i = 0; i < C.CONST.boardMax; i++) {
      const p = C.cellPosition(state, i);
      const el = document.createElement('div'); el.className = 'cell working';
      el.style.gridColumn = p.col + 1; el.style.gridRow = p.row + 1;
      el.innerHTML = '<div class="lv"></div><div class="box"><div class="box-fill"></div><div class="chest"></div><div class="box-number"><span class="bitmap"></span><span class="percent-symbol">%</span></div><span class="spawn-timer"></span></div>';
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
    if (wonMoment && clock < wonMoment.until) return;
    wonMoment = null;
    const v = D.venues[state.venue - 1];
    const a = v.audiences[state.j - 1] || v.headliner;
    const key = `${state.dimension}:${state.audId}`;
    if (key !== lastAudience) {
      lastAudience = key; pendingIntro = null;
      $('room').dataset.venue = v.slug;
      sprite($('room'), venueAsset(v));
      $('room').style.setProperty('--venue-bg1', v.palette.bg1);
      $('room').style.setProperty('--venue-bg2', v.palette.bg2);
      $('room').style.setProperty('--venue-accent', v.palette.accent);
      $('venueName').textContent = v.name;
      $('doubtTitle').textContent = `${a.name}의 의심`;
      $('audience').replaceChildren(element('span', a.emoji, 'sprite-fallback'));
      sprite($('audience'), audienceAsset(v, a)); $('audience').setAttribute('aria-label', a.name);
      $('audience').classList.toggle('headliner', a === v.headliner);
      $('audienceLine').textContent = a.flavor;
      $('audienceCard').dataset.pattern = state.pattern;
      $('patternLabel').textContent = state.pattern === 'invisible' ? '보이지 않는 의심' : state.pattern === 'none' ? '' : D.ui.patterns[state.pattern];
      if (a === v.headliner) pendingIntro = a;
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
      $('stageNumber').textContent = `${state.venue} / ${D.venues.length}`;
      const dimension = D.dimensions[state.dimension - 1];
      $('dimensionLabel').textContent = `차원 ${state.dimension} · ${dimension ? dimension.name : '새로운 앵콜'}`;
      $('stage').style.setProperty('--dimension-hue', `${dimension ? dimension.hue : (state.dimension * 47) % 360}deg`);
    }
  }
  let kaliUntil = 0;
  function kaliPose(frame,ms) {
    kaliUntil = clock + ms;
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
      strip.append(element('span','다음 목표','goal-title'),element('span','','goal-case'),target,element('span','','goal-venue'));
    }
    for (const [name,text] of [['case',goal.caseText],['node',goal.nodeText],['cost',goal.costText],['venue',goal.venueText]]) {
      const label = strip.querySelector(`.goal-${name}`); if (label.textContent !== text) label.textContent = text;
    }
    strip.setAttribute('aria-label',goal.text); strip.title = goal.text;
    $('goalStrip').dataset.nodeId = goal.node?.id || '';
    if (clock >= kaliUntil && $('magicianMini').dataset.frame !== '0') {
      $('magicianMini').dataset.frame = '0';
      if (!$('magicianMini').classList.contains('performance-ready')) sprite($('magicianMini'),'assets/magician-idle.png');
    }
  }
  function focusNode(id) {
    const node = D.tree.find(n=>n.id===id); if (!node) return;
    treeView.selected = id; treeView.sheet = true; treeView.centerPending = true;
    treeView.x = -node.x * 140 * treeView.zoom;
    treeView.y = -node.y * 140 * treeView.zoom;
    tree(true);
  }
  function render() {
    buildBoard(); audience(); nextBanner(); renderFeatures(); renderMagic(); renderGuidance();
    const home=C.bossProfile(state)==='homecoming';
    const boss = C.bossProfile(state)==='mirror';
    $('audienceCard').classList.toggle('final-boss', boss);
    $('audienceCard').classList.toggle('boss-mirror', boss && state.phase2);
    $('phaseIndicator').hidden = !boss && !home;
    $('phaseIndicator').textContent = state.phase2 ? `최종 공연 · 마지막 질문 · 확신 ${state.features.climax.confidence}%` : '최종 공연 · 의심의 거울';
    if (boss) $('patternLabel').textContent = state.phase2 ? '콤보 10마다 확신 +10% · 피날레 최대 ×2' : '15초마다 거울 케이스 2개 · 도우미와 연쇄로 열어요';
    $('starlightLabel').textContent = `✦ 별빛 ${state.starlight}`;
    if(home) {
      $('phaseIndicator').textContent=['','1막 · 준비한 한 수','2막 · 함께 만든 공연','3막 · 마지막 인사'][state.review.act];
      $('audienceLine').textContent=D.venues.find(v=>v.slug==='lecturenote').headliner['act'+state.review.act+'Line'];
      $('patternLabel').textContent=['','별표 케이스를 열면 다음 질문을 쉬어요','직접 개봉과 도우미를 연결해요 · 도우미 없이 두 칸도 좋아요','개봉을 이어 마지막 피날레를 완성해요'][state.review.act];
    }
    $('rebirthButton').hidden = !state.seenEnding;
    $('rebirthButton').textContent=phone ? (state.homecomingCleared ? '✨ 환생' : '✨ 이어서') : (state.homecomingCleared?'다음 차원의 공연':'이어지는 공연');
    if (state.pattern === 'heal' && state.mode === 'fight') $('audienceCard').classList.toggle('healing', state.patternHealMs > C.CONST.patternHealEvery - 600);
    else $('audienceCard').classList.remove('healing');
    num($('doubtNumber'), `${rounded(state.audHp)}/${rounded(state.audHpMax)}`);
    $('doubtFill').style.width = `${state.audHp / state.audHpMax * 100}%`;
    num($('attackNumber'), state.atk);
    $('countdown').textContent = `${Math.max(0, state.heckleMs / 1000).toFixed(1)}초`;
    $('audienceCard').classList.toggle('telegraph', state.mode === 'fight' && state.heckleMs <= C.CONST.telegraphMs);
    num($('stat-power'), rounded(C.wandDamage(state)));
    num($('stat-damage'), rounded(C.CONST.itemDamage * state._V));
    num($('stat-guard'), rounded(C.CONST.itemShield * state._U));
    num($('stat-heal'), rounded(C.CONST.itemHeal * state._U));
    num($('bestCombo'), state.maxCombo);
    num($('comboNumber'), state.combo);
    const finalePercent = `${Math.min(100, state.finisher / C.nodeEffects(state).finaleNeed * 100)}%`;
    $('finisherFill').style.height = phone ? '100%' : finalePercent;
    $('finisherFill').style.width = phone ? finalePercent : '';
    $('mentalNumber').textContent = `${rounded(state.mental)} / ${rounded(state.mentalMax)}`;
    $('hearts').querySelectorAll('.heart').forEach((el, i) => el.classList.toggle('empty', i >= Math.ceil(state.mental / state.mentalMax * 5)));
    num($('shieldNumber'), rounded(state.shield));
    num($('levelNumber'), state.level);
    const xpNeed = C.CONST.xpBase + C.CONST.xpPerLevel * state.level;
    num($('xpNumber'), `${rounded(state.xp)}/${xpNeed}`);
    $('xpFill').style.width = `${Math.min(100, state.xp / xpNeed * 100)}%`;
    for (const id of ['coins','gems','keys']) num($(id), rounded(state[id]));
    for (let i = 0; i < cells.length; i++) {
      const cell = state.board[i], dom = cells[i];
      const locked = !cell, next = i === state.board.length;
      dom.el.classList.toggle('locked', locked);
      dom.el.classList.toggle('next-slot', next);
      dom.el.tabIndex = next ? 0 : -1;
      dom.el.setAttribute('role', next ? 'button' : 'img');
      dom.el.setAttribute('aria-label', next ? slotCondition() : locked ? '잠긴 자리' : `카드 케이스 ${i + 1}`);
      if (locked) { dom.lv.textContent = ''; continue; }
      const pct = cell.hpMax ? Math.min(100, Math.max(0, Math.round((1 - cell.hp / cell.hpMax) * 100))) : 0;
      dom.lv.textContent = (cell.lv || 1) >= C.caseCap(state) ? `LV ${cell.lv || 1} MAX` : `LV ${cell.lv || 1}`;
      const chest = dom.el.querySelector('.chest');
      dom.el.classList.toggle('golden', !!cell.golden);
      dom.el.classList.toggle('golden-broken', !!cell.goldenBroken && cell.hp <= 0);
      const path = cell.goldenBroken && cell.hp <= 0 ? 'assets/box-golden-broken.png' : `assets/${C.caseTier(cell)}.png`;
      if (chest.dataset.asset !== path) sprite(chest, path);
      num(dom.num, pct); dom.fill.style.height = `${pct}%`; dom.fill.style.setProperty('--fill', pct / 100);
      dom.el.classList.toggle('empty', cell.hp <= 0);
      dom.timer.textContent = `${(cell.spawn / 1000).toFixed(1)}`;
      dom.el.classList.toggle('sealed', cell.sealed);
      dom.el.classList.toggle('mirrored', state.features.climax.mirrored.includes(i));
      dom.el.classList.toggle('review-warning',state.review.target===i&&state.review.elapsed<2000);
      dom.el.classList.toggle('review-active',state.review.target===i&&state.review.elapsed>=2000);
    }
    const a = C.wandArea(state);
    $('areaLabel').textContent = `지팡이 범위 ${a.cols} × ${a.rows}`;
    if ($('rangeShape')) { $('rangeShape').textContent = '▦'; $('rangeShape').setAttribute('aria-label', `${a.cols}열 ${a.rows}행`); }
    $('hint').textContent = menu ? '공연 일시정지' : `${state.wins ? '케이스' : '카드 케이스'}를 꾹 누르세요 · 초당 ${C.wandRate(state).toFixed(1)}회`;
    $('dealerButton').disabled = !(state.dealerQueued || state.mode === 'dealer' || state.dealer);
    $('dealerButton').title = $('dealerButton').disabled ? '관객을 감탄시키면 토끼 딜러가 찾아와요' : '대기 중인 토끼 딜러 만나기';
    updateWand(); modeHooks();
  }
  function wandRect() {
    const a = C.wandArea(state), k = C.CONST;
    const pitch = k.cellSize + k.cellGap;
    const width = a.cols * pitch - k.cellGap, height = a.rows * pitch - k.cellGap;
    return { x: Math.max(0, Math.min(k.boardSize - width, pointer.x - width / 2)),
      y: Math.max(0, Math.min(k.boardSize - height, pointer.y - height / 2)), width, height };
  }
  function coveredCells() {
    if (!pointer.inside) return [];
    const r = wandRect(), l = C.boardLayout(state), k = C.CONST;
    const pitch = k.cellSize + k.cellGap, found = [];
    for (let i = 0; i < l.capacity; i++) {
      const p = C.cellPosition(state, i);
      const x = k.boardInset + p.col * pitch + k.cellSize / 2;
      const y = k.boardInset + p.row * pitch + k.cellSize / 2;
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) found.push(i);
    }
    return found;
  }
  function updateWand() {
    $('wand').classList.toggle('visible', pointer.inside && !menu && !portrait());
    if (!pointer.inside) return;
    const r = wandRect(), ratio = $('board').clientWidth / C.CONST.boardSize;
    $('wand').style.width = `${r.width * ratio}px`; $('wand').style.height = `${r.height * ratio}px`;
    $('wand').style.transform = `translate(${r.x * ratio}px,${r.y * ratio}px)`;
  }
  function locate(e) {
    const p = boardTransform().toBoard(e.clientX, e.clientY);
    pointer.x = p.x; pointer.y = p.y;
    pointer.inside = p.x >= 0 && p.x <= C.CONST.boardSize && p.y >= 0 && p.y <= C.CONST.boardSize;
    updateWand();
  }
  function pulse() {
    // Core grants the first hit on a new nonempty input. Explicit release between
    // scheduled pulses avoids its empty-target reset accelerating a held drag.
    events(C.step(state, .001, { taps: [] }));
    if (paused() || state.mode !== 'fight') return;
    const taps = coveredCells();
    if (taps.length) { sound('tap'); events(C.step(state, .001, { taps })); }
  }
  function release() {
    const id = pointer.id, wasHeld = pointer.held;
    pointer.held = false; pointer.id = null; tapRemaining = 0;
    if (id !== null && $('board').hasPointerCapture(id)) $('board').releasePointerCapture(id);
    // Reset Core's own hold accumulator through its API, never on pointermove.
    if (wasHeld && !document.hidden && !menu && !portrait()) events(C.step(state, .001, { taps: [] }));
  }
  $('board').addEventListener('pointerdown', e => {
    if (paused() || state.mode !== 'fight' || (e.pointerType === 'mouse' && e.button !== 0) || pointer.id !== null) return;
    e.preventDefault(); locate(e);
    if (!pointer.inside) return;
    if (state.board.length < C.CONST.boardMax) {
      const p = C.cellPosition(state, state.board.length), k = C.CONST, pitch = k.cellSize + k.cellGap;
      const x = k.boardInset + p.col * pitch, y = k.boardInset + p.row * pitch;
      if (pointer.x >= x && pointer.x <= x + k.cellSize && pointer.y >= y && pointer.y <= y + k.cellSize) return;
    }
    pointer.id = e.pointerId; pointer.held = true;
    $('board').setPointerCapture(e.pointerId);
    // A physical press hits now. Subsequent pulses use only elapsed simulation
    // time and Core.wandRate, even when the pointer crosses a gap or leaves.
    pulse(); tapRemaining = 1000 / C.wandRate(state); render();
    window.dispatchEvent(new CustomEvent('magicshow:gesture'));
  });
  $('board').addEventListener('pointermove', e => {
    if (pointer.id !== null && e.pointerId !== pointer.id) return;
    if (e.pointerType === 'mouse' || pointer.held) locate(e);
  });
  $('board').addEventListener('pointerleave', () => {
    if (!pointer.held) { pointer.inside = false; updateWand(); }
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) $('board').addEventListener(name, e => {
    if (pointer.id !== e.pointerId) return;
    release();
    if (e.pointerType !== 'mouse') { pointer.inside = false; updateWand(); }
  });
  window.addEventListener('blur', release);
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());

  function openPanel(kind, title) {
    release(); menu = kind; previous = 0;
    focusBeforePanel = document.activeElement;
    $('panel').dataset.screen = kind;
    $('panel').classList.remove('climax-dialogue');
    $('panel').querySelector('header').querySelectorAll('.tree-wallet,.constellation-controls').forEach(el=>el.remove());
    $('closePanel').textContent = '닫기';
    $('panelTitle').textContent = title;
    $('panelBody').replaceChildren(); $('panelBody').scrollTop = 0; $('panel').hidden = false;
    $('closePanel').hidden = kind === 'fail'; $('closePanel').disabled = false;
    // Reset the Core hold before pausing so the next gesture starts immediately.
    events(C.step(state, .001, { taps: [] }));
    $('closePanel').hidden = ['fail','ending','rebirth','bossPhase'].includes(kind);
    $('closePanel').focus(); updateWand(); nextToasts();
  }
  function closePanel() {
    if (['fail','ending','rebirth','bossPhase'].includes(menu) || (menu === 'dealer' && dealerBusy)) return;
    clearTimeout(dialogueTimer);
    if (menu === 'dealer' && state.mode === 'dealer') {
      for (let i = 0; i < 2 && state.mode === 'dealer'; i++) C.dealerClose(state);
      save();
    }
    if (menu === 'book' && failure !== null) { showFailure(); return; }
    menu = ''; $('panel').hidden = true; previous = 0;
    if (focusBeforePanel && focusBeforePanel.isConnected) focusBeforePanel.focus();
    render();
  }
  function showFailure() {
    openPanel('fail', '공연 종료');
    const result = document.createElement('div'); result.className = 'result';
    const icon = document.createElement('span'); icon.className = 'result-icon'; icon.textContent = '🎩';
    const title = document.createElement('h2'); title.textContent = randomLine(D.pools.fail);
    const reason = document.createElement('p'); reason.textContent = D.pools.failReason.replace('{pct}', String(failure));
    const button = document.createElement('button'); button.textContent = '연습실로';
    button.addEventListener('click', () => {
      C.restartRun(state); failure = null; menu = ''; $('panel').hidden = true;
      previous = 0; flights.length = 0; particles.length = 0; numbers.length = 0; badges.length = 0; events.recentBadges?.clear(); wonMoment = null;
      save(); render(); $('bookButton').focus();
    });
    const advice = Guidance.failure(state,D,C);
    const related = action(`${advice.node.name} 비법 보기`, () => focusNode(advice.node.id));
    result.append(icon, title, reason, element('p',advice.line,'fail-cause'), related, button); $('panelBody').append(result); button.focus();
  }
  const treeView = { x: 0, y: 0, zoom: 1, selected: 'root', sheet: false, centerPending: false, lastTap: null, revealed: new Set(), ready: false };
  function treePreview(node) {
    const lv = C.nodeInfo(state, node.id).level;
    const next = Math.min(node.max, lv + 1), k = C.CONST;
    const percent = v => `${+(v * 100).toFixed(2)}%`;
    const number = v => String(+v.toFixed(2));
    const change = (label, before, after, fmt = number) => `${label} ${fmt(before)} → ${fmt(after)}`;
    const altered = { ...state, tree: { ...state.tree }, stars: { ...state.stars } };
    if (node.starKey) altered.stars[node.starKey] = next; else altered.tree[node.id] = next;
    const before = C.nodeEffects(state), after = C.nodeEffects(altered);
    const specs = {
      crit: ['번뜩임 확률', 'critRate', percent], critRate: ['번뜩임 확률', 'critRate', percent], critPower: ['번뜩임 배율', 'critPower'],
      comboHold: ['콤보 유예 ms', 'comboMs'], sweepFocus: ['단일 케이스 피해 배율', 'sweep'], precision: ['투명 패턴 빗나감', 'miss', percent],
      goldPity: ['황금 간격 ms', 'goldEvery'], goldCoins: ['황금 동전 배율', 'goldCoins'], prepared: ['등장 파괴 진행률', 'prepared', percent],
      boxXP: ['케이스 XP 배율', 'boxXP'], boxShield: ['파괴 멘탈 보호막', 'boxShield'], boxHeal: ['파괴 회복', 'boxHeal'],
      shieldCap: ['멘탈 보호막 최대 비율', 'shieldRatio', percent], shieldValue: ['실크 배율', 'shieldValue'], healValue: ['회복 배율', 'healValue'],
      winHeal: ['승리 회복', 'winHeal', percent], levelHeal: ['레벨업 회복', 'levelHeal', percent], openingShield: ['시작 멘탈 보호막 비율', 'openingShield', percent],
      calm: ['야유 피해 배율', 'calm'], tip: ['승리 동전 배율', 'tip'], dealerCoin: ['딜러 카드 동전 배율', 'dealerCoin'], jackpot: ['슬롯 동전 배율', 'jackpot'],
      gemFind: ['보석 확률 추가', 'gemFind', percent], lessonBias: ['케이스 XP 배율', 'boxXP'], doveTempo: ['비둘기 주기 ms', 'doveEvery'],
      dovePower: ['비둘기 피해 배율', 'dovePower'], rabbitTempo: ['토끼 주기 ms', 'rabbitEvery'], rabbitPurse: ['토끼 동전', 'rabbitCoins'],
      helperTempo: ['팬 작업 주기 ms', 'helperEvery'], finalePower: ['피날레 피해 배율', 'finalePower'], finaleNeed: ['피날레 필요 게이지', 'finaleNeed'],
      comboValue: ['콤보 동전 배율', 'comboValue'], encorePower: ['앵콜 피해 보너스', 'encorePower', percent], encoreSpan: ['앵콜 지속 ms', 'encoreSpan']
    };
    if (specs[node.id]) {
      const [label, key, fmt] = specs[node.id];
      // Preview the invisible pattern even when the current audience has no miss chance.
      if (node.id === 'precision') return change('투명 패턴 빗나감', Math.max(0, k.missChance - .02 * lv), Math.max(0, k.missChance - .02 * next), percent);
      return change(label, before[key], after[key], fmt);
    }
    const scales = { power: ['마술 실력', state._wand, k.wandGrowth], attack: ['연출', state._V, k.Vattack], mental: ['최대 멘탈', state.mentalMax, k.mentalGrowth], spawn: ['재생성 ms', state._tau, 1 / k.spawnGrowth] };
    if (scales[node.id]) { const [label, value, mul] = scales[node.id]; return change(label, value, node.id === 'spawn' ? Math.max(40, value * mul ** (next - lv)) : value * mul ** (next - lv)); }
    if (node.id === 'caseMax') return change('케이스 최대 LV', 5 + lv, 5 + next);
    if (node.id === 'caseStart') return change('새 케이스 시작 LV', Math.min(C.caseCap(state), 1 + lv), Math.min(C.caseCap(state), 1 + next));
    if (node.id === 'caseXp') return change('케이스 XP 배율', 1 + .15 * lv, 1 + .15 * next);
    if (node.id === 'chain4') return change('연쇄 지팡이 피해', lv ? .3 + .1 * state.tree.chainPower : 0, .3 + .1 * state.tree.chainPower, percent);
    if (node.id === 'chain8') return change('연쇄 방향', lv ? 8 : 4, 8);
    if (node.id === 'chainPower') return change('연쇄 지팡이 피해', .3 + .1 * lv, .3 + .1 * next, percent);
    if (node.statBranch) {
      const total = (state.tree['hidden-' + node.statBranch] || 0) + (state.tree['infinite-' + node.statBranch] || 0);
      return change('가지 능력 보너스', .02 * total, .02 * (total + next - lv), percent);
    }
    if (node.productMultiplier) return change('연출', state._V, state._V * node.productMultiplier ** (next - lv));
    if (node.id === 'boxHelper') return change('팬 수', C.fanCount(state), C.fanCount(altered));
    if (node.id === 'assistant') return change('케이스 타격', lv ? .8 * C.wandDamage(state) : 0, .8 * C.wandDamage(state)) + ' · 황금 ×1.5';
    if (node.id === 'speed') return change('초당 타격', C.wandRate(state), Math.min(k.tapCap, k.tapBase + k.tapPerSpeed * next) * k.starTempoRate ** state.stars.tempo * (state.slow ? k.slowTap : 1));
    if (node.id === 'board') return change('케이스 자리', C.boardLayout(state).capacity, Math.min(25, C.boardLayout(state).capacity + next - lv));
    if (node.id === 'area') return change('범위', k.areas[lv], k.areas[next], a => a.join('×'));
    if (node.id === 'coinLuck') {
      const shares = D.items.types.map(t => t.share * 100);
      const weight = shares[D.items.types.findIndex(t => t.id === 'coin')];
      const total = shares.reduce((a, b) => a + b, 0);
      return change('동전 추첨 확률', (weight + 6 * lv) / (total + 6 * lv), (weight + 6 * next) / (total + 6 * next), percent);
    }
    if (node.id === 'forceRemove') return change('포스 보석 비용', Math.max(1, 3 - lv), Math.max(1, 3 - next));
    if (node.id === 'startFinale') return change('시작 게이지', lv ? before.finaleNeed : 0, next ? after.finaleNeed : 0);
    if (node.id === 'dove') return change('비둘기 피해', lv ? 4 * state._V * before.dovePower : 0, 4 * state._V * after.dovePower);
    if (node.id === 'rabbit') return change('토끼 지급 동전', lv ? before.rabbitCoins : 0, after.rabbitCoins);
    if (node.id === 'flash') return change('25개 파괴 피해', lv ? 8 * state._V : 0, 8 * state._V);
    if (node.starKey) {
      const delta = next - lv;
      if (node.starKey === 'trick') return change('연출', state._V, state._V * k.starTrick ** delta) + ' · ' + change('타격', state._wand, state._wand * k.starWand ** delta);
      if (node.starKey === 'guard') return change('최대 멘탈', state.mentalMax, state.mentalMax * k.starGuard ** delta);
      if (node.starKey === 'tempo') return change('초당 타격', C.wandRate(state), C.wandRate(state) * k.starTempoRate ** delta) + ' · ' + change('재생성 ms', state._tau, Math.max(40, state._tau * k.starTempoTau ** delta));
      return change('동전 배율', state._coinMul, state._coinMul * k.starCoin ** delta);
    }
    if (node.id === 'root') return '모든 비법의 시작. 이미 배웠다.';
    const unlocks = { golden: '첫 황금 케이스 30초 · 파괴 후 180초', equip: '처음 3칸 · 소품마다 해당 종류 드롭 가중치 ×1.02', slotPlus: `장착칸 ${C.equipSlots(state)} → ${Math.min(9, C.equipSlots(state) + 1)}`, boxHelper: '팬마다 2초 주기 · 마술 실력의 35%', comboGift: '콤보 10/25/50/100 · 피날레 +1/+1/+2/+2', encore: '전투 300초마다 15초간 지팡이 +20%', challenge: '추가 도전 3개 · 각각 연출 +0.5%' };
    return unlocks[node.id] || '비법을 배우면 효과가 더해져요';
  }
  function tree(focusMap = false) {
    if (menu !== 'book') openPanel('book', D.ui.bookTitle);
    const body = $('panelBody'); body.replaceChildren();
    const wallet = element('div', `🪙 동전 ${rounded(state.coins)} · 🔑 열쇠 ${state.keys} · ✦ 별빛 ${state.starlight}`, 'tree-wallet');
    const layout = element('div', '', 'constellation-layout');
    const map = element('div', '', 'constellation-map'); map.tabIndex = 0;
    map.setAttribute('aria-label', '별자리 지도. 방향키로 이동하고 더하기와 빼기로 확대합니다.');
    const world = element('div', '', 'constellation-world');
    const detail = element('aside', '', 'constellation-detail'); detail.setAttribute('aria-live', 'polite');
    const infos = new Map(D.tree.map(n => [n.id, C.nodeInfo(state, n.id)]));
    const shown = new Set(D.tree.filter(n => infos.get(n.id).revealed || (!(n.hidden || n.infinite) && (n.reveal === 'E' || n.prereqs.some(id => infos.get(id).revealed)))).map(n => n.id));
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
      button.setAttribute('aria-label', unknown ? (node.reveal === 'E' ? '첫 멀티버스 공연 완료' : '미확인 비법') : `${node.name} 레벨 ${info.level} / ${info.max}`);
      const icon = element('span', unknown ? '❔' : node.emoji, 'constellation-icon sprite-fallback');
      const iconHost = element('span', '', 'constellation-icon-host'); iconHost.append(icon);
      sprite(iconHost, `assets/${unknown ? 'node-unknown.png' : node.icon}`);
      button.append(iconHost);
      if (!unknown) button.append(element('span', node.name, 'constellation-name'), element('small', `${info.level} / ${info.max}`, 'constellation-level'));
      button.addEventListener('click', () => { if (!suppressClick) select(node.id); }); world.append(button);
    }
    treeView.revealed = new Set(D.tree.filter(n => infos.get(n.id).revealed).map(n => n.id)); treeView.ready = true;
    const selected = D.tree.find(n => n.id === treeView.selected) || D.tree[0], info = infos.get(selected.id);
    if (!info.revealed) {
      detail.append(element('h2', '미확인 비법'), element('p', selected.reveal === 'E' ? '첫 멀티버스 공연 완료' : '이웃 비법을 배워 발견하세요.'));
    } else {
      if (selected.branch === 'collection') detail.append(element('small', '칼리 컬렉션'));
      detail.append(element('h2', selected.name), element('p', `레벨 ${info.level} / ${info.max}`), element('p', selected.desc), element('p', selected.id === 'root' ? '첫 주문을 바탕으로 이웃 비법을 배워보세요.' : treePreview(selected), 'tree-preview'));
      if (selected.desc.includes('L')) detail.append(element('small', 'L은 이 비법의 레벨입니다.'));
      if (selected.venueSlug) detail.append(element('p', `${D.venues.find(v=>v.slug===selected.venueSlug).name} 도착 필요`));
      const currency = { coins: '🪙 동전', keys: '🔑 열쇠', starlight: '✦ 별빛' }[info.currency];
      detail.append(element('strong', info.cost === null ? '완성' : `${currency} ${info.cost}`), element('p', info.blockedReason || '구매 가능', 'tree-reason'));
      if (info.gate) detail.append(element('p', info.gate.text, 'tree-gate'));
      let heldTimer = null, longBought = false;
      const purchase = many => {
        const count = many ? C.buyMany(state, selected.id) : (C.buyNode(state, selected.id) ? 1 : 0);
        if (!count) return;
        sound('coin'); toast(`×${count} 구매 · ${selected.name}`); save(); tree(); render();
      };
      const buy = action(window.matchMedia('(pointer: coarse)').matches ? '배우기 · 꾹 눌러 최대 구매' : '배우기 · Shift 또는 꾹 눌러 최대 구매', e => {
        clearTimeout(heldTimer); if (!longBought) purchase(e.shiftKey); longBought = false;
      }, !info.purchasable);
      buy.addEventListener('pointerdown', () => { longBought = false; heldTimer = setTimeout(() => {longBought = true; purchase(true);}, 600); });
      for (const type of ['pointerup','pointercancel','pointerleave']) buy.addEventListener(type, () => clearTimeout(heldTimer));
      buy.classList.add('tree-buy');
      const pin = action(state.guidance.pin === selected.id ? '고정 해제' : '목표로 고정', () => {
        state.guidance.pin = state.guidance.pin === selected.id ? null : selected.id;
        save(); tree(); render();
      }); pin.classList.add('tree-pin');
      detail.append(pin,buy);
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
    if (typeof phone !== 'undefined' && phone) {
      const header = $('panel').querySelector('header');
      header.querySelectorAll('.tree-wallet,.constellation-controls').forEach(el=>el.remove());
      header.insertBefore(wallet,$('closePanel')); header.insertBefore(controls,$('closePanel'));
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
    if(guiding) body.append(element('h2','첫 소품을 빈 진열대에 놓아 보세요.','guide-line'));
    body.append(element('p', slots ? `장착 ${state.features.equipped.length} / ${slots} · 소품당 종류 가중치 ×1.02 · 종류당 최대 3개` : '비법서에서 소품 진열대를 배우세요.'));
    for (let i = 0; i < 9; i++) {
      const id = state.features.equipped[i], product = D.items.types.flatMap(t => t.ladder).find(p => p.id === id);
      const button = action(product ? `${product.emoji} ${product.name} · 해제` : i < slots ? '빈 자리' : '🔒 잠긴 자리', () => { C.unequipItem(state, id); save(); bestiary(); }, !product);
      if (guiding && i===0) button.classList.add('guide-highlight');
      if (product) sprite(button, `assets/item-${id}.png`); grid.append(button);
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
          if(guiding){menu='';$('panel').hidden=true;previous=0;const label=type.id==='card'?'트럼프 카드':product.name;toast(`${label} 가중치 ×1.02`);render();}
          else bestiary();
        } else toast('빈 자리와 종류별 3개 제한을 확인하세요.');
      }, !slots || state.features.equipped.includes(id));
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
  function helperMotion(id, dest) {
    const host = helperActor(id), origin = id === 'dove' ? { x: 820, y: 290 } : { x: 820, y: 680 };
    sprite(host, `assets/helper-${id}-${id === 'dove' ? 'fly' : 'move'}.png`);
    animate(host, [{ transform: 'translate(0,0)' }, { transform: `translate(${dest.x - origin.x}px,${dest.y - origin.y - 28}px)`, offset: .6 }, { transform: `translate(${dest.x - origin.x}px,${dest.y - origin.y}px)`, offset: .8 }, { transform: 'translate(0,0)' }], 700);
    host.dataset.busyUntil = clock + 700;
    setTimeout(() => { sprite(host, `assets/helper-${id}-${id === 'dove' ? 'hit' : 'work'}.png`); }, 350);
  }
  function renderMagic() {
    let layer=$('magicLayer');
    if(!layer){layer=element('div','','magic-layer');layer.id='magicLayer';$('stage').append(layer);}
    const actors=renderMagic.actors || (renderMagic.actors={balls:[],papers:[],controls:{}});
    actors.balls.forEach(n=>n.hidden=true);actors.papers.forEach(n=>n.hidden=true);
    state.features.magic.balls.forEach((b,i)=>{const ball=actors.balls[i] || (actors.balls[i]=element('img','','sponge-projectile'));ball.hidden=false;ball.src='assets/proj-sponge.png';ball.alt='스펀지볼';const point=typeof phone !== 'undefined' && phone ? boardPoint(b.x,b.y) : {x:870+b.x,y:160+b.y};ball.style.left=`${point.x-16}px`;ball.style.top=`${point.y-16}px`;if(!ball.dataset.mounted){layer.append(ball);ball.dataset.mounted="1";}});
    state.features.magic.papers.forEach((p,i)=>{const at=cellCenter(p.cell);let button=actors.papers[i];if(!button){button=action('플래시 페이퍼',()=>{events(C.tapPaper(state,Number(button.dataset.cell)));save();render();});actors.papers[i]=button;}button.hidden=false;button.dataset.cell=p.cell;button.className='paper-drop';button.style.left=`${at.x-25}px`;button.style.top=`${at.y-25}px`;if(button.dataset.asset!=='assets/drop-flashpaper.png')sprite(button,'assets/drop-flashpaper.png');if(!button.dataset.mounted){layer.append(button);button.dataset.mounted="1";}});
    let controls=$('magicControls');
    if(!controls){controls=element('div','','magic-controls');controls.id='magicControls';($('helperControls') || $('stage')).append(controls);}
    Object.values(actors.controls).forEach(n=>n.hidden=true);
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
      const paradeVenues=D.venues.filter(v=>v.headliner.bossProfile!=='homecoming');
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
      const equip = action('🎩 소품 진열대', () => { bestiaryTab = 'equip'; bestiary(); }); equip.id = 'equipOpen'; hud.append(equip);
      ($('helperControls') || $('stage')).append(hud);
    }
    const goal = C.nextComboGoal(state);
    $('comboGoal').textContent = goal ? `다음 ${goal.threshold} · 피날레 +${goal.gauge} · 동전 +${rounded(goal.coins)}` : state.tree.comboGift ? '이번 관객 콤보 보상 완료' : '';
    const active = state.tree.encore && state.features.encoreLeft > 0;
    $('stage').classList.toggle('encore-active', !!active);
    const seconds = Math.ceil((active ? state.features.encoreLeft : state.features.encoreMs) / 1000);
    $('encoreStatus').textContent = state.tree.encore ? `${active ? '앵콜 중' : '앵콜까지'} ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '';
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
    for (const host of Object.values(workerActors)) host.hidden = true;
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
      const progress = actor.phase === 'move' ? 1 - actor.remainingMs / 300 : 1;
      host.style.transitionDuration = actor.phase === 'idle' ? '300ms' : '50ms';
      host.style.transform = `translate(${(targetX - origin.x) * progress}px,${(targetY - origin.y) * progress}px)`;
      host.classList.toggle('worker-work', actor.phase === 'work');
      host.classList.toggle('paused', state.features.workers[actor.role + 'Paused']);
      if (actor.phase === 'idle' && host.dataset.lastPhase && host.dataset.lastPhase !== 'idle') host.dataset.returnUntil = clock + 300;
      host.dataset.lastPhase = actor.phase;
      const phase = actor.phase === 'idle' && Number(host.dataset.returnUntil || 0) > clock ? 'move' : actor.phase;
      const path = `assets/helper-${actor.role}-${phase}.png`;
      if (host.dataset.asset !== path) sprite(host, path);
    }
    $('equipOpen').hidden = !state.tree.equip;
  }
  function bestiary() {
    if (['fail','dealer','headliner','ending','rebirth','bossPhase'].includes(menu)) return;
    openPanel('bestiary', D.ui.bestiaryTitle);
    panelTabs([['audiences','관객 도감'],['endings','엔딩 도감'],['achievements','업적'],['equip','소품 진열대']], bestiaryTab, tab => { bestiaryTab = tab; bestiary(); });
    if (bestiaryTab === 'endings') { drawArchive(); return; }
    if (bestiaryTab === 'equip') { equipPanel(); return; }
    if (bestiaryTab === 'achievements') { achievementPanel(); return; }
    const badges=element('div','','reward-badges');
    for(const r of D.stageRewards){const badge=element('figure','','reward-badge');const art=element('img');art.src=`assets/reward-${r.id}.png`;art.alt=r.effect;badge.classList.toggle('earned',state.features.rewards.includes(r.id));badge.append(art,element('figcaption',`${D.venues.find(v=>v.slug===r.venueSlug).name} · ${r.effect}`));badges.append(badge);} $('panelBody').append(badges);
    const list = element('div', '', 'bestiary-list');
    for (const venue of D.venues) {
      const reached = state.visited.includes(venue.slug);
      const section = element('section', '', 'bestiary-venue');
      const trophy = !!state.trophies[venue.slug];
      section.append(element('h2', reached ? `${venue.id}. ${venue.name} · 관객 ${venue.crowd}명` : `${venue.id}. 아직 도착하지 않은 무대`));
      if (!reached) {
        const silhouettes = element('div', '', 'bestiary-silhouettes');
        for (const a of [...venue.audiences, venue.headliner]) {
          const known=state.knownAudiences.includes(a.id);
          const silhouette = element('span', known ? a.name : a.emoji);
          if(known) silhouette.title=a===venue.headliner ? D.ui.patterns[a.pattern] : a.flavor;
          else silhouette.setAttribute('aria-hidden', 'true'); silhouettes.append(silhouette);
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
          card.append(art, element('h3', a.name), element('p', a.flavor, 'entry-flavor'));
          if (head) {
            card.append(element('strong', '헤드라이너'), element('p', `승리 ${trophy ? '1 / 1' : '0 / 1'}`), element('p', `패턴: ${D.ui.patterns[a.pattern]}`), element('small', `보상: 🏆 ${venue.trophy}`));
          } else {
            const need = a.extra && a.extra.type !== 'none';
            const condition = need ? D.ui.extras[a.extra.type].replace('{value}', String(a.extra.value)) : '추가 조건 없음';
            card.append(element('strong', `감탄 ${Math.min(3, rec.wins)} / 3`), element('p', condition), element('small', need ? (rec.extra ? '✓ 추가 조건 달성' : '추가 조건 미달성') : '✓ 승리 3번이면 완성'), element('small', `보상: 🔑 열쇠 1개 · ${rec.removed ? '획득' : '완성하면 획득'}`));
            if (rec.removed) card.append(element('span', '완전히 팬이 됨', 'fan-stamp'));
          }
          grid.append(card);
        }
        section.append(grid);
      }
      list.append(section);
    }
    $('panelBody').append(list);
  }
  function dealer() {
    if (['fail','ending','rebirth','bossPhase'].includes(menu) || dealerBusy) return;
    if (state.dealerQueued && state.mode === 'transition') events(C.step(state, Math.max(1, state.transMs + 1), { taps: [] }));
    if (state.mode !== 'dealer' || !state.dealer) return;
    if (menu !== 'dealer') {
      dealerMessage = ''; dealerLost = state.dealer.phase === 'card-done'; dealerResult = '';
      dealerPicked = new Set(state.dealer.cards.map((card, i) => card.open && !card.dud && !dealerLost ? i : -1).filter(i => i >= 0));
      openPanel('dealer', D.ui.dealerTitle);
    }
    drawDealer();
  }
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
    $('soundButton').textContent = on ? D.ui.soundOn : D.ui.soundOff;
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
    home.append(element('h2',homeSeen?'칼리 마술 성장기 · 돌아올 무대':'렉쳐노트 귀환'),element('p',homeSeen?'멀리 다녀와도, 같이 마술할 곳이 있다.':'렉쳐노트의 마지막 공연을 마치면 공개돼요'));
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
    animate($('flash'), [{ opacity: 1 }, { opacity: .6, offset: .2 }, { opacity: 0 }], 600);
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
    toastQueue.length=0; visibleToasts.forEach(t=>t.el.remove()); visibleToasts.length=0; lastToastKind='';
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
    openPanel('ending','돌아올 무대 · 렉쳐노트');
    sound('ending'); drawEnding();
  }
  function drawEnding() {
    clearTimeout(dialogueTimer); $('panelBody').replaceChildren();
    const venue=D.venues.find(v=>v.slug==='lecturenote'), lines=venue.headliner.endingLines;
    const scene=element('div','','ending-scene homecoming-scene');
    let primary;
    const picture=element('div','','homecoming-picture');
    picture.style.backgroundImage=`url("${venueAsset(venue)}")`;
    const fallback=element('div','','homecoming-portraits');
    for(const a of [...venue.audiences,venue.headliner]) {const face=element('span',a.name,'homecoming-face');sprite(face,audienceAsset(venue,a));fallback.append(face);}
    picture.append(fallback); sprite(picture,'assets/ending-lecturenote.png'); scene.append(picture);
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
      primary=action('가게에 남기',continueDimension);
      buttons.append(primary,action('다음 차원의 공연',showRebirth)); scene.append(buttons);
    }
    $('panelBody').append(scene); primary.focus();
  }
  function continueDimension() {
    clearTimeout(dialogueTimer); C.stayHome(state); menu=''; $('panel').hidden=true; previous=0;
    lastAudience=''; revealEnding=false; save(); render(); $('bookButton').focus();
  }
  function showRebirth() {
    if (!state.homecomingCleared) { showEnding(); return; }
    openPanel('rebirth', '다음 차원의 공연');
    const scene = element('div', '', 'rebirth-scene');
    const gain = C.CONST.starGainBase + state.dimension;
    scene.append(element('h2', `차원 ${state.dimension}에서 차원 ${state.dimension + 1}로`), element('p', `✦ 별빛 +${gain} · 환생 후 별빛 ${state.starlight + gain}`, 'rebirth-gain'));
    const columns = element('div', '', 'rebirth-lists');
    for (const [title, lines] of [
      ['처음부터 시작해요', ['동전, 보석, 열쇠', '마술 비법서의 모든 일반 강화와 해금', '무대 진행과 초대장, 트로피', '관객 도감의 승리 횟수, 추가 조건, 팬 기록', '공연 승리와 실패 횟수, 딜러 진행과 임시 버프', '보드와 케이스, 날아가는 아이템', '레벨, 경험치, 루틴 최고 기록, 피날레, 멘탈 보호막', '멘탈은 새 차원의 최대치로 회복하고 가족 거실에서 시작']],
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
      clearTimeout(bannerTimer); bannerQueue.length = 0; unlockBannerQueue.length = 0; bannerActive = null; $('banner').hidden = true;
      save(); render(); toast(`차원 ${state.dimension} · 별빛 ${gain}개를 얻었어요`); $('bookButton').focus();
    });
    controls.append(go, action('엔딩으로 돌아가기', () => { revealEnding = false; endingStep = 4; openPanel('ending', '돌아올 무대 · 렉쳐노트'); drawEnding(); }));
    scene.append(columns, controls); $('panelBody').append(scene); go.focus();
  }
  function modeHooks() {
    if (state.mode !== lastMode) {
      lastMode = state.mode;
      window.dispatchEvent(new CustomEvent('magicshow:mode', { detail: { mode: state.mode, state } }));
    }
    if (menu || document.hidden) return;
    if(state.features.guide==='place' && state.features.collected.length){bestiaryTab='equip';bestiary();return;}
    if(state.features.climax.left>0)return;
    if (state.mode === 'dealer') dealer();
    else if (pendingIntro && state.mode === 'fight') headlinerIntro(pendingIntro);
    else if (state.mode === 'ending') showEnding();
  }
  $('bookButton').addEventListener('click', () => { if (!['fail','dealer','headliner','ending','rebirth','bossPhase'].includes(menu)) tree(); });
  $('bestiaryButton').addEventListener('click', bestiary);
  $('dealerButton').addEventListener('click', dealer);
  $('rebirthButton').addEventListener('click', () => {
    if (!['fail','dealer','headliner','ending','rebirth','bossPhase'].includes(menu) && state.seenEnding) showRebirth();
  });
  $('soundButton').addEventListener('click', () => {
    if (window.Sfx) window.Sfx.toggle();
    updateSoundButton();
  });
  $('retreatButton').addEventListener('click', () => {
    if (['fail','ending','rebirth','bossPhase'].includes(menu) || dealerBusy) return;
    if (menu) closePanel();
    release(); C.retreat(state); lastAudience = ''; save(); render(); toast('연습실에서 다시 시작해요');
  });
  $('closePanel').addEventListener('click', closePanel);
  document.addEventListener('keydown', e => {
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
  function drawEffects() {
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
      const x = p.x + p.dx * t, y = p.y + p.dy * t + 28 * t * t;
      ctx.globalAlpha = 1 - t; ctx.fillStyle = p.color;
      if (p.line) {
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
      const w = phone ? U5.badgeWidth(104 * $('board').clientWidth / 608) : b.width, h = phone ? Math.min(b.nameLabel ? 30 : 20, 112 * $('board').clientWidth / 608 - 18) : (b.nameLabel ? 54 : 34);
      ctx.fillStyle = '#10121af5'; ctx.strokeStyle = D.items.rarities.find(r => r.id === b.rarity)?.color || '#ffe65c';
      ctx.lineWidth = 2; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      const y = b.nameLabel ? (phone ? -5 : -9) : 0;
      if (phone) { /* Compact badge reserves its width for the value. */ }
      else if (b.image.complete && b.image.naturalWidth) ctx.drawImage(b.image, -w / 2 + 3, y - 12, 24, 24);
      else { ctx.font = '18px sans-serif'; ctx.fillText(b.emoji || b.icon, -w / 2 + 15, y); }
      ctx.font = `bold ${phone ? 13 : 17}px sans-serif`; ctx.fillText(b.text, phone ? 0 : 12, y, phone ? w - 4 : w - 32);
      if (b.nameLabel) { ctx.font = '12px sans-serif'; ctx.fillText(b.nameLabel, 0, phone ? 9 : 14, w - 6); }
      ctx.restore();
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i], t = (clock - f.start) / f.life;
      if (t >= 1) { flights.splice(i, 1); continue; }
      if (t < 0) continue;
      const arc = p => ({ x: f.x + (f.tx - f.x) * p, y: f.y + (f.ty - f.y) * p - 112 * Math.sin(Math.PI * p) });
      ctx.fillStyle = f.color;
      for (let p = Math.max(0, t - .5); p < t; p += .034) {
        const a = arc(p); ctx.fillRect(Math.round(a.x) - 3, Math.round(a.y) - 3, 6, 6);
      }
      const a = arc(t); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.imageSmoothingEnabled = false;
      ctx.font = '42px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; if (f.image && f.image.complete && f.image.naturalWidth) ctx.drawImage(f.image, a.x - 24, a.y - 24, 48, 48);
      else ctx.fillText(f.emoji, a.x, a.y);
      if (f.label) {
        ctx.font = 'bold 16px sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = '#000';
        ctx.strokeText(f.label, a.x, a.y + 34); ctx.fillText(f.label, a.x, a.y + 34);
      }
    }
    for (let i = numbers.length - 1; i >= 0; i--) {
      const n = numbers[i], t = (clock - n.start) / n.life;
      if (t >= 1) { numbers.splice(i, 1); continue; }
      ctx.globalAlpha = t < .6 ? 1 : (1 - t) / .4;
      ctx.font = `bold ${n.size || 32}px "Courier New",monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.fillStyle = n.color;
      const y = n.y - (reduced || n.fixed ? 0 : t * 52);
      const width = ctx.measureText(n.text).width + 6;
      if (!U5.clearOfZones({ x: n.x - width / 2, y: y - n.size / 2 - 3, w: width, h: n.size + 6 })) continue;
      ctx.strokeText(n.text, n.x, y); ctx.fillText(n.text, n.x, y);
    }
    ctx.globalAlpha = 1; ctx.restore();
  }
  function loop(now) {
    const dt = previous ? Math.max(0, Math.min(50, now - previous)) : 0;
    previous = now;
    if (!document.hidden) clock += dt;
    if (!paused()) {
      let remaining = dt * (debug ? 10 : 1);
      // Stop at a failure event, even at debug speed: Core already restarted.
      while (remaining > 0 && !paused()) {
        const slice = Math.min(50, remaining, pointer.held && tapRemaining > 0 ? tapRemaining : 50);
        // No targets during the intervals between UI pulses. Combat still advances
        // with the measured dt; the 0.001 ms press lets Core emit its instant hit.
        events(C.step(state, slice, { taps: [] }));
        remaining -= slice;
        if (pointer.held) {
          tapRemaining -= slice;
          if (tapRemaining <= .000001 && !paused()) {
            pulse(); tapRemaining = 1000 / C.wandRate(state);
          }
        }
      }
    }
    render(); nextToasts(dt); drawEffects(); requestAnimationFrame(loop);
  }
  motion.addEventListener('change', e => {
    reduced = e.matches; particles.length = 0; flights.length = 0; numbers.length = 0;
    for (const el of document.querySelectorAll('*')) for (const animation of el.getAnimations()) animation.cancel();
  });
  document.addEventListener('visibilitychange', () => { release(); save(); previous = 0; });
  window.addEventListener('pagehide', save);
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  $('moreButton').addEventListener('click', () => {
    release(); $('phoneMore').hidden = !$('phoneMore').hidden;
    $('moreButton').setAttribute('aria-expanded', String(!$('phoneMore').hidden));
  });
  $('phoneMore').addEventListener('click', e => { if (e.target.closest('button')) { $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false'); } });
  $('statsButton').addEventListener('click', () => {
    const expanded = $('statsButton').classList.toggle('expanded');
    $('statsButton').setAttribute('aria-expanded', String(expanded));
    document.querySelector('.stats').classList.toggle('phone-expanded', expanded);
  });
  $('banner').addEventListener('click', () => { if (phone) { dismissBanner(); nextBanner(); } });
  setInterval(save, 5000);
  // Stable screen/audio integration hooks for U4 and U5.
  window.MagicShowUI = {
    getState: () => state, events, save, toast, banner, openPanel, closePanel, render,
    openBook: tree, focusNode, openBestiary: bestiary,
    openDealer: dealer, openEnding: () => { if (state.seenEnding) { revealEnding = false; showEnding(); } },
    openRebirth: () => { if (state.seenEnding) showRebirth(); }, isPaused: paused
  };
  sprite($('magicianMini'), 'assets/magician-mini.png');
  const performanceStrip = assetImage('assets/kali-performance.png');
  const stripReady = () => { if (performanceStrip.naturalWidth === 768 && performanceStrip.naturalHeight === 256) $('magicianMini').classList.add('performance-ready'); };
  if (performanceStrip.complete) stripReady(); else performanceStrip.addEventListener('load',stripReady,{once:true});
  $('magicianMini').dataset.frame = '0';
  $('goalStrip').addEventListener('click', () => { const id = $('goalStrip').dataset.nodeId; if (id) focusNode(id); });
  $('gameLogo').textContent = D.title;
  $('gameLogo').setAttribute('aria-label', D.title);
  revealEnding = state.mode === 'ending' && state.endings.length === 1;
  updateSoundButton();
  fit(); render();
  if (corrupt) toast('저장 파일을 읽을 수 없어 새 공연을 시작해요');
  if (inaccessible) toast('저장을 사용할 수 없어요. 공연은 계속돼요');
  requestAnimationFrame(loop);
})();
