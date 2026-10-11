/* Magic Show Buster v3: pure deterministic core. No DOM, no Date, no Math.random. */
(function () {
  "use strict";

  var DATA = (typeof globalThis !== "undefined" ? globalThis : this).GAME_DATA;
  if (!DATA || !DATA.venues) throw new Error("GAME_DATA missing");

  var CONST = {
    critChance: 0.08, critMultiplier: 1.5,
    revealGapMs: 8000,
    goldFirstMs: 30000, goldIntervalMs: 180000, goldHpMultiplier: 1.5, goldCoinBase: 20,
    comboThresholds: [10, 25, 50, 100], comboGaugeRewards: [1, 1, 2, 2], comboCoinRewards: [2, 4, 8, 16],
    helperEveryMs: 2000, helperWandRatio: 0.35,
    equipBaseSlots: 3, equipMaxSlots: 9, equipTypeLimit: 3, equipWeightPerItem: 0.02,
    achievementVPer: 0.005,
    encoreEveryMs: 300000, encoreDurationMs: 15000, encoreWandBonus: 0.20,
    spawnBase: 0.35,
    spawnGrowth: 1.08,
    boxHpBase: 100,
    boxHpGrowth: 1.25,
    boxLevelDiv: 3,
    wandBase: 25,
    wandGrowth: 1.1,
    tapBase: 3,
    tapPerSpeed: 0.12,
    tapCap: 4.6,
    Vbase: 1.3,
    Vattack: 1.05,
    Vlevel: 0.005,
    Ubase: 1.42,
    mentalBase: 40,
    mentalGrowth: 1.18,
    shieldRatio: 0.48,
    xpPerBox: 1,
    xpBase: 20,
    xpPerLevel: 10,
    levelHeal: 0.16,
    audHpBase: [340, 400, 550, 750],
    audHpGrowth: 1.95,
    audHpMul: 1,
    audAtkBase: [3, 5, 7, 11],
    audAtkGrowth: 1.3,
    audAtkMul: 1,
    intervalBase: 4,
    intervalPerJ: 0.2,
    intervalPerV: 0.05,
    intervalMin: 2.2,
    telegraphMs: 600,
    winTransitionMs: 800,
    winHeal: 0.2,
    comboResetMs: 2000,
    finisherNeed: 20,
    finisherDmg: 22,
    coinPerBox: 1,
    winCoinBase: 10,
    winCoinGrowth: 1.32,
    itemFlightMs: 240,
    flightCap: 1024,
    itemDamage: 8,
    itemShield: 2.7,
    itemHeal: 1.8,
    itemCoins: 4,
    rarityW: [70, 22, 6.5, 1.4, 0.1],
    rarityMult: [1, 2, 4, 10, 25],
    rarityIds: ["common", "rare", "hero", "legend", "myth"],
    gemChance: [0, 0.02, 0.05, 0.12, 0.3],
    nodeBase: { power: 120, attack: 45, mental: 30, spawn: 35, speed: 60 },
    nodeGrowth: 2.2,
    nodeMax: 10,
    coinLuckBase: 70,
    coinLuckAdd: 6,
    boardCosts: [40, 120, 300, 700, 1600, 3500, 7500, 15000, 30000, 55000, 90000, 140000],
    legacyCaps: [1, 2, 4, 6, 9, 12, 16, 25],
    boardCols: 5, boardRows: 5, boardMax: 25, boardNodeMax: 12,
    boardSize: 608, boardInset: 8, cellSize: 112, cellGap: 8,
    slotUnlockSpawnMs: 350, slotRevealStaggerMs: 120,
    slotOrder: [12, 13, 18, 17, 11, 16, 6, 7, 8, 9, 14, 19, 24, 23, 22, 21, 1, 2, 3, 4, 0, 5, 10, 15, 20],
    areaCosts: [90, 8000, 16000, 18000, 6000, 15000, 35000, 90000],
    areaNeeds: [2, 5, 5, 6, 9, 12, 16, 25],
    areaVenueNeeds: DATA.areaVenueSlugs,
    areas: [[1, 1], [2, 1], [3, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 5]],
    keyCost: { startFinale: 1, forceRemove: 1, dove: 2, rabbit: 2, flash: 2 },
    bestiaryWins: 3,
    bestiaryDmg: 0.03,
    bestiaryU: 0.1,
    dealerEvery: 3,
    cardMin: 3,
    cardMax: 5,
    dealerDuds: 1,
    dealerCoinGrowth: 1.35,
    forceGemCost: 3,
    forceMax: 2,
    doveEvery: 3000,
    doveDamage: 4,
    rabbitEvery: 5000,
    flashEvery: 25,
    flashDamage: 8,
    slotCoin: 40,
    slotGem: 1,
    slowTap: 0.72,
    slowSpawn: 1.4,
    sealDur: 8000,
    sealEvery: 14000,
    stealPct: 0.04,
    patternHealPct: 0.0025,
    patternHealEvery: 9000,
    missChance: 0.22,
    phase2At: 0.75,
    phase2Hp: 0.12,
    bossHpMult: 0.8,
    starGainBase: 3,
    starTrick: 1.3,
    starWand: 1.14,
    starGuard: 1.18,
    starTempoRate: 1.06,
    starTempoTau: 0.92,
    starCoin: 1.12,
    substepMs: 50,
    maxSubsteps: 2000,
    loopCap: 128
  };

  var LEGACY_KEYS = ["power", "attack", "mental", "spawn", "speed", "board", "area", "coinLuck", "startFinale", "forceRemove", "dove", "rabbit", "flash"];
  var TREE_KEYS = DATA.tree.filter(function (n) { return !n.starKey; }).map(function (n) { return n.id; });
  var NODE_BY_ID = Object.create(null);
  DATA.tree.forEach(function (n) { NODE_BY_ID[n.id] = n; });
  var STAR_KEYS = ["trick", "guard", "tempo", "bounty"];
  var VENUES = DATA.venues;
  var ALL_VENUES = VENUES;
  var U6_VENUES = DATA.legacyVenueSlugs.map(function(slug) { return VENUES.find(function(v) { return v.slug === slug; }); });
  var OLD_VENUES = U6_VENUES.filter(function (v) { return v.slug !== "broadcast"; });
  var VENUE_INDEX = new Map([ALL_VENUES,U6_VENUES,OLD_VENUES].map(function(list){return [list,new Map(list.map(function(v,i){return [v.slug,i+1];}))];}));
  function venueNumber(slug) { return VENUE_INDEX.get(VENUES).get(slug) || 0; }
  function reached(state, slug) { var n = venueNumber(slug); return n > 0 && state.vMax >= n; }
  function legacyRank(v) { return Math.max(1, DATA.legacyVenueSlugs.indexOf(VENUES[v-1].slug) + 1); }
  function profile(state) { var a = getAud(state.venue,state.j); return a && a.bossProfile || ''; }
  function emptyReview() { return {act:1,cycle:0,target:-1,elapsed:0,cancel:false,bonusMs:0,pairs:0,lastSource:'',lastCell:-1,finaleReady:false,finaleUsed:false,actMs:0}; }
  function balanceRank(v) { return VENUES[v - 1].balanceRank; }
  var PRIZE_LIST = DATA.dealer.cardPrizes;
  var SYMBOLS = DATA.dealer.slotSymbols;
  var AUD_IDS = [];
  var AUD_BY_ID = {};
  for (var vi = 0; vi < VENUES.length; vi++) {
    var auds = VENUES[vi].audiences;
    for (var aj = 0; aj < auds.length; aj++) {
      AUD_IDS.push(auds[aj].id);
      AUD_BY_ID[auds[aj].id] = { v: vi + 1, j: aj + 1, extra: auds[aj].extra };
    }
  }

  var COMBO_AUD_IDS = AUD_IDS.concat(VENUES.map(function (v) { return v.headliner.id; }));

  var SEEN = new Uint32Array(32);
  var SEEN_STAMP = 1;
  var DEDUPE = [];
  var ITEM_TYPES = Object.create(null);
  DATA.items.types.forEach(function (t) { if (t.id !== "lecture") t.ladder.forEach(function (p) { ITEM_TYPES[p.id] = t; }); });
  var TYPE_W = DATA.items.types.map(function (t) { return t.share; });

  function rngNext(state) {
    var a = state.rngState >>> 0;
    a = (a + 0x6D2B79F5) >>> 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    state.rngState = a >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function pickW(state, weights) {
    var sum = 0;
    var i;
    for (i = 0; i < weights.length; i++) sum += weights[i];
    var r = rngNext(state) * sum;
    for (i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  function emit(ev, e) {
    if (ev && ev.length < 4000) ev.push(e);
  }

  function emptyStars() {
    return { trick: 0, guard: 0, tempo: 0, bounty: 0 };
  }

  function emptyTree() {
    var tree = {};
    TREE_KEYS.forEach(function (id) { tree[id] = id === "root" ? 1 : 0; });
    return tree;
  }

  function emptyFeatures() {
    return { elapsedMs: 0, goldMs: CONST.goldFirstMs, goldPending: false, goldCell: -1,
      helperMs: CONST.helperEveryMs, helperCursor: 0, dovePaused: false, helperPaused: false,
      encoreMs: CONST.encoreEveryMs, encoreLeft: 0, comboPaid: {},
      collected: [], equipped: [], legacyProductCollection: [],
      workers: { fanPaused: false, assistantPaused: false, fanCursor: 0, assistantCursor: 0, actors: [] },
      magic: { timers: {}, paused: {}, balls: [], papers: [], cursor: 0, clock: 0 }, rewards: [], guide: "idle", climax: { paradeDone: false, left: 0, mirrorMs: 15000, mirrored: [], confidence: 0, milestone: 0 },
      damage: { manual: 0, fan: 0, assistant: 0, chain: 0, magic: 0 }, progress: { comboMax: 0, dealerFlips: 0, coinsEarned: 0, goldenOpened: 0 }, achievements: [], boxes: 0, helperBreaks: 0,
      reveals: [], revealQueue: [], revealMs: 0 };
  }

  function reveal(state, id) {
    var f = state.features;
    if (f.reveals.indexOf(id) >= 0) return;
    f.reveals.push(id); f.revealQueue.push(id);
  }

  function stamp(state, id, ev) {
    var f = state.features;
    if (f.achievements.indexOf(id) >= 0) return;
    f.achievements.push(id);
    recompute(state, false);
    emit(ev, { type: "achievement", id: id });
  }

  function checkAchievements(state, ev) {
    var f = state.features;
    if (f.boxes >= 100) stamp(state, "boxes", ev);
    if (state.maxCombo >= 25) stamp(state, "combo", ev);
    if (boardCapacity(state) >= 9) stamp(state, "slots", ev);
    if (f.helperBreaks >= 25) stamp(state, "helper", ev);
  }

  function itemType(id) {
    return ITEM_TYPES[id];
  }

  function equipSlots(state) { return state.tree.equip ? Math.min(CONST.equipMaxSlots, CONST.equipBaseSlots + state.tree.slotPlus) : 0; }
  function equipItem(state, id) {
    var f = state.features, type = itemType(id);
    if (!type || f.collected.indexOf(id) < 0 || f.equipped.indexOf(id) >= 0 || f.equipped.length >= equipSlots(state)) return false;
    if (f.equipped.filter(function (x) { return itemType(x) === type; }).length >= CONST.equipTypeLimit) return false;
    f.equipped.push(id); if (f.guide === "place") f.guide = "done"; return true;
  }
  function unequipItem(state, id) {
    var i = state.features.equipped.indexOf(id);
    if (i < 0) return false;
    state.features.equipped.splice(i, 1); return true;
  }
  function toggleHelper(state, id) {
    var key = id === "dove" ? "dovePaused" : id === "rabbit" ? "helperPaused" : null;
    if (DATA.tree.some(function (n) {return n.id === id && n.u4b;}) && id !== 'fanPower') {
      state.features.magic.paused[id] = !state.features.magic.paused[id]; return true;
    }
    if (id === "fan" || id === "assistant") {
      var w = state.features.workers, flag = id + "Paused";
      w[flag] = !w[flag]; return true;
    }
    if (!key) return false;
    state.features[key] = !state.features[key]; return true;
  }
  function nextComboGoal(state) {
    if (!state.tree.comboGift) return null;
    var paid = state.features.comboPaid[state.audId] || 0;
    for (var i = 0; i < CONST.comboThresholds.length; i++) if (!(paid & (1 << i))) return { threshold: CONST.comboThresholds[i], gauge: CONST.comboGaugeRewards[i], coins: CONST.comboCoinRewards[i] * Math.pow(1.32, balanceRank(state.venue) - 1) * nodeEffects(state).comboValue };
    return null;
  }
  function wandDamage(state) {
    return (state._wand || CONST.wandBase) * (hasReward(state, 2) ? 1.2 : 1) * (state.tree.encore && state.features.encoreLeft > 0 ? 1 + nodeEffects(state).encorePower : 1);
  }

  // Shared formula modifiers.
  function nodeEffects(state) {
    var t = state.tree;
    return {
      critRate: t.crit ? Math.min(0.14, 0.08 + 0.02 * t.critRate) : 0,
      critPower: Math.min(1.8, 1.5 + 0.1 * t.critPower),
      comboMs: Math.min(3000, CONST.comboResetMs + 250 * t.comboHold) + (hasReward(state, 1) ? 500 : 0),
      sweep: 1 + 0.05 * t.sweepFocus,
      miss: Math.max(0, (state.miss || 0) - 0.02 * t.precision),
      goldEvery: Math.max(120000, 180000 - 20000 * t.goldPity),
      goldCoins: 1 + 0.2 * t.goldCoins,
      prepared: 0.05 * t.prepared,
      boxXP: 1 + 0.1 * t.boxXP + 0.1 * t.lessonBias,
      boxShield: 0.1 * t.boxShield * (state._U || 1),
      boxHeal: 0.05 * t.boxHeal * (state._U || 1),
      shieldRatio: CONST.shieldRatio + 0.03 * t.shieldCap,
      shieldValue: 1 + 0.05 * t.shieldValue,
      healValue: 1 + 0.05 * t.healValue,
      winHeal: CONST.winHeal + 0.02 * t.winHeal,
      levelHeal: CONST.levelHeal + 0.02 * t.levelHeal,
      openingShield: 0.05 * t.openingShield,
      calm: 1 - 0.02 * t.calm,
      tip: 1 + 0.05 * t.tip,
      dealerCoin: 1 + 0.1 * t.dealerCoin,
      jackpot: 1 + 0.15 * t.jackpot,
      gemFind: 0.01 * t.gemFind,
      doveEvery: (CONST.doveEvery - 250 * t.doveTempo) / helperSpeed(state),
      dovePower: 1 + 0.1 * t.dovePower,
      rabbitEvery: (CONST.rabbitEvery - 400 * t.rabbitTempo) / helperSpeed(state),
      rabbitCoins: 3 + legacyRank(state.venue) + t.rabbitPurse,
      helperEvery: 2000 - 200 * t.helperTempo,
      finalePower: 1 + 0.08 * t.finalePower,
      finaleNeed: Math.max(18, CONST.finisherNeed - t.finaleNeed),
      comboValue: 1 + 0.2 * t.comboValue,
      encorePower: 0.2 + 0.05 * t.encorePower,
      encoreSpan: 15000 + 3000 * t.encoreSpan
    };
  }

  function emptyBestiary() {
    var b = {};
    var i;
    for (i = 0; i < AUD_IDS.length; i++) b[AUD_IDS[i]] = { wins: 0, extra: false, removed: false };
    b["h-broadcast"] = { wins: 0, extra: false, removed: false };
    return b;
  }

  function zeros(n) {
    var a = [];
    var i;
    for (i = 0; i < n; i++) a.push(0);
    return a;
  }

  function countRemoved(state) {
    var n = 0;
    var i;
    var b = state.bestiary;
    for (i = 0; i < AUD_IDS.length && i < CONST.loopCap + 40; i++) {
      if (b[AUD_IDS[i]] && b[AUD_IDS[i]].removed) n++;
    }
    return n;
  }

  function recompute(state, sync) {
    var C = CONST;
    var b = Math.floor((balanceRank(state.vMax) - 1) / C.boxLevelDiv);
    if (b < 0) b = 0;
    state._boxHp = C.boxHpBase * Math.pow(C.boxHpGrowth, b);
    var tau = C.spawnBase / Math.pow(C.spawnGrowth, state.tree.spawn) * 1000;
    tau *= Math.pow(C.starTempoTau, state.stars.tempo);
    if (state.slow) tau *= C.slowSpawn;
    if (tau < 40) tau = 40;
    state._tau = tau;
    var rate = Math.min(C.tapCap, C.tapBase + C.tapPerSpeed * state.tree.speed);
    rate *= Math.pow(C.starTempoRate, state.stars.tempo);
    if (state.slow) rate *= C.slowTap;
    if (rate < 0.2) rate = 0.2;
    state._rate = rate;
    var wand = C.wandBase * Math.pow(C.wandGrowth, state.tree.power);
    wand *= Math.pow(C.starWand, state.stars.trick);
    state._wand = wand * branchBonus(state, "hand");
    var V = Math.pow(C.Vbase, balanceRank(state.vMax) - 1) * Math.pow(C.Vattack, state.tree.attack) * (1 + C.Vlevel * state.level);
    V *= Math.pow(C.starTrick, state.stars.trick);
    V *= 1 + state.removedCount * C.bestiaryDmg;
    V *= 1 + (state.buff || 0) / 100;
    V *= 1 + state.features.achievements.length * C.achievementVPer;
    V *= productMultiplier(state);
    state._V = V * branchBonus(state, "collection") * branchBonus(state, "star");
    var U = Math.pow(C.Ubase, balanceRank(state.vMax) - 1) * Math.pow(C.starGuard, state.stars.guard);
    U *= 1 + state.removedCount * C.bestiaryU;
    state._U = U;
    var mm = C.mentalBase * U * Math.pow(C.mentalGrowth, state.tree.mental);
    var prev = state.mentalMax || 0;
    mm *= branchBonus(state, "heart");
    state.mentalMax = mm;
    if (!sync && prev > 0 && mm > prev) {
      state.mental = Math.min(mm, (state.mental || 0) + (mm - prev));
    }
    var cap = mm * nodeEffects(state).shieldRatio;
    if (state.shield > cap) state.shield = cap;
    state._coinMul = Math.pow(C.starCoin, state.stars.bounty) * branchBonus(state, "luck");
  }

  function wandRate(state) {
    if (state._rate == null) recompute(state, true);
    return state._rate;
  }

  function wandArea(state) {
    var a = CONST.areas[state.tree.area] || CONST.areas[0];
    var o = state._area;
    if (!o) o = state._area = { cols: 1, rows: 1 };
    o.cols = a[0];
    o.rows = a[1];
    return o;
  }

  function boardCapacity(state) {
    return Math.min(CONST.boardMax, 1 + state.tree.board + DATA.slotRewardSlugs.filter(function(slug) { return reached(state,slug); }).length + (state.legacySlots || 0));
  }

  function boardLayout(state) {
    var cap = boardCapacity(state);
    var o = state._layout;
    if (!o) o = state._layout = {};
    if (o.capacity !== cap) o.slotIds = CONST.slotOrder.slice(0, cap);
    o.cols = CONST.boardCols;
    o.rows = CONST.boardRows;
    o.capacity = cap;
    return o;
  }

  function cellPosition(state, i) {
    if (!Number.isInteger(i) || i < 0 || i >= CONST.boardMax) return null;
    var slot = CONST.slotOrder[i];
    return { col: slot % CONST.boardCols, row: Math.floor(slot / CONST.boardCols) };
  }

  function headlinerJ(v) {
    return VENUES[v - 1].audiences.length + 1;
  }

  function audStats(v, j) {
    var C = CONST;
    var n = headlinerJ(v) - 1;
    // Stretch the original three regular anchors; headliners retain the fourth.
    var idx = j > n ? 3 : 2 * (j - 1) / Math.max(1, n - 1);
    var lo = Math.floor(idx), hi = Math.ceil(idx), t = idx - lo;
    var hpBase = C.audHpBase[lo] * (1 - t) + C.audHpBase[hi] * t;
    var atkBase = C.audAtkBase[lo] * (1 - t) + C.audAtkBase[hi] * t;
    var hp = Math.round(C.audHpMul * Math.pow(C.audHpGrowth, balanceRank(v) - 1) * hpBase * (VENUES[v - 1].hpFactor || 1));
    var atk = Math.max(1, Math.round(C.audAtkMul * Math.pow(C.audAtkGrowth, balanceRank(v) - 1) * atkBase));
    if (j === headlinerJ(v)) hp = Math.round(hp * (VENUES[v-1].bossHpFactor || (VENUES[v-1].headliner.bossProfile === "mirror" ? C.bossHpMult : 1)));
    var T = Math.max(C.intervalMin, C.intervalBase - C.intervalPerJ * idx - C.intervalPerV * (balanceRank(v) - 1));
    return { hp: hp, atk: atk, interval: T };
  }

  function getAud(v, j) {
    var venue = VENUES[v - 1];
    if (!venue) return null;
    if (j === headlinerJ(v)) return venue.headliner;
    return venue.audiences[j - 1] || null;
  }

  function isRemoved(state, v, j) {
    if (j === headlinerJ(v)) return false;
    var a = getAud(v, j);
    if (!a) return false;
    var rec = state.bestiary[a.id];
    return !!(rec && rec.removed);
  }

  function firstOpen(state) {
    var v, j;
    var guard = 0;
    for (v = 1; v <= VENUES.length; v++) {
      if (v < state.vMax && state.visited.indexOf(VENUES[v-1].slug)<0) continue;
      var complete = !!state.trophies[VENUES[v-1].slug];
      for (j = 1; j < headlinerJ(v); j++) {
        if (!isRemoved(state, v, j)) complete = false;
      }
      if (complete) continue;
      for (j = 1; j <= headlinerJ(v); j++) {
        if (++guard > CONST.loopCap) return { v: 1, j: headlinerJ(1) };
        if (!isRemoved(state, v, j)) return { v: v, j: j };
      }
    }
    return { v: 1, j: headlinerJ(1) };
  }

  function advanceFrom(state) {
    var v = state.venue;
    var j = state.j;
    var n;
    for (n = 0; n < CONST.loopCap; n++) {
      if (j < headlinerJ(v)) j++;
      else { v++; j = 1; }
      if (v > VENUES.length) return null;
      // A migrated run skips inserted, unvisited venues on retries as well as restart.
      if (v < state.vMax && state.visited.indexOf(VENUES[v-1].slug) < 0) { j = headlinerJ(v); continue; }
      if (!isRemoved(state, v, j)) return { v: v, j: j };
    }
    return null;
  }

  function ensureBoard(state, stagger) {
    var cap = boardCapacity(state);
    var added = 0;
    while (state.board.length < cap) {
      state.board.push({ lv: Math.min(caseCap(state), 1 + (state.tree.caseStart || 0) + (hasReward(state, 4) ? 1 : 0)), xp: 0, hp: 0, hpMax: 0,
        spawn: CONST.slotUnlockSpawnMs + (stagger ? added * CONST.slotRevealStaggerMs : 0), sealed: false });
      added++;
    }
  }

  function caseCap(state) { return 5 + (state.tree.caseMax || 0); }
  function caseNeed(lv) { return Math.ceil(3 * Math.pow(1.35, lv - 1)); }
  function caseTier(cell) { return cell.golden ? 'box-golden' : 'box-' + Math.min(4, Math.floor(((cell.lv || 1) - 1) / 3)); }
  function caseItems(lv) { return 1 + Math.floor((lv - 1) / 3); }
  function branchBonus(state, branch) { return 1 + .02 * ((state.tree['infinite-' + branch] || 0) + (state.tree['hidden-' + branch] || 0)); }
  function earnCoins(state, amount) { state.coins += amount; state.features.progress.coinsEarned += amount; }
  function fillBox(state, cell) {
    cell.lv = cell.lv || Math.min(caseCap(state), 1 + (state.tree.caseStart || 0) + (hasReward(state, 4) ? 1 : 0));
    cell.xp = cell.xp || 0;
    var hp = (state._boxHp || CONST.boxHpBase) * Math.pow(1.12, cell.lv - 1);
    cell.hp = hp * (1 - nodeEffects(state).prepared);
    cell.hpMax = hp;
    cell.sealed = false;
    cell.golden = false; cell.goldenBroken = false;
    if (state.tree.golden && state.mode === "fight" && state.features.goldPending) {
      cell.golden = true; state.features.goldPending = false;
      state.features.goldCell = state.board.indexOf(cell);
      cell.hp *= CONST.goldHpMultiplier; cell.hpMax *= CONST.goldHpMultiplier;
    }
  }

  function beginAudience(state, v, j, ev) {
    unseal(state);
    cancelWorkers(state);
    var aud = getAud(v, j);
    state.venue = v;
    if (state.visited.indexOf(VENUES[v-1].slug) < 0) state.visited.push(VENUES[v-1].slug);
    // Crowd is display-only and does not scale combat stats.
    state.crowd = VENUES[v - 1].crowd;
    state.j = j;
    if (v > state.vMax) { state.vMax = v; ensureBoard(state); reveal(state, "slot"); }
    state.audId = aud ? aud.id : "";
    var st = audStats(v, j);
    state.audHpMax = st.hp;
    state.audHp = st.hp;
    state.atk = st.atk;
    state.interval = st.interval;
    state.heckleMs = st.interval * 1000;
    state.telegraphed = false;
    state.fightMs = 0;
    state.tookMental = false;
    state.maxCombo = 0;
    state.finisherFired = false;
    state.phase2 = false;
    state.resolved = false;
    state.sealMs = 0;
    state.sealCd = 0;
    state.sealCell = -1;
    state.patternHealMs = CONST.patternHealEvery;
    var pattern = aud && aud.pattern ? aud.pattern : "none";
    if (j !== headlinerJ(v)) pattern = "none";
    state.pattern = pattern;
    state.slow = pattern === "slow";
    state.miss = pattern === "invisible" ? CONST.missChance : 0;
    state.pHeal = pattern === "heal";
    recompute(state, false);
    if (pattern === "sealBox") sealOne(state);
    if (VENUES[v-1].invitation && !state.invited[VENUES[v-1].slug]) {
      state.invited[VENUES[v-1].slug] = 1;
      var inv = VENUES[v - 1] && VENUES[v - 1].invitation;
      emit(ev, { type: "venueUnlocked", venue: v, crowd: state.crowd, name: inv ? inv.name : "" });
    }
    state.mode = "fight";
    state.features.climax.mirrored = []; state.features.climax.mirrorMs = 15000;
    state.features.climax.confidence = 0; state.features.climax.milestone = 0;
    state.review = emptyReview();
    if (profile(state) === "homecoming") emit(ev,{type:"homecomingAct",act:1,line:aud.act1Line});
    if (isFinalBoss(state) && !state.features.climax.paradeDone) {
      state.features.climax.left = 30000;
      emit(ev, { type: 'curtainCall', cell: 0 });
    }
    emit(ev, { type: "audience", venue: v, j: j, audId: state.audId, crowd: state.crowd });
  }

  function sealOne(state) {
    unseal(state);
    state.sealCd = CONST.sealEvery;
    var i;
    var n = state.board.length;
    if (n > 32) n = 32;
    for (i = 0; i < n; i++) {
      if (state.board[i].hp > 0 && !state.board[i].sealed) {
        state.board[i].sealed = true;
        state.sealCell = i;
        state.sealMs = CONST.sealDur;
        return;
      }
    }
    state.sealCd = CONST.sealEvery;
  }

  function unseal(state) {
    for (var i = 0; i < state.board.length; i++) state.board[i].sealed = false;
    state.sealCell = -1;
    state.sealMs = 0;
  }

  function metExtra(state, extra) {
    if (!extra || extra.type === "none") return true;
    if (extra.type === "finisher") return !!state.finisherFired;
    if (extra.type === "noDamage") return !state.tookMental;
    if (extra.type === "timeLimit") return state.fightMs <= extra.value * 1000;
    if (extra.type === "combo") return state.maxCombo >= extra.value;
    return false;
  }

  function onWin(state, ev) {
    if (state.resolved) return;
    state.resolved = true;
    unseal(state);
    var venue = state.venue;
    var j = state.j;
    var audId = state.audId;
    var coins = Math.round(CONST.winCoinBase * Math.pow(CONST.winCoinGrowth, balanceRank(venue) - 1) * (state._coinMul || 1) * nodeEffects(state).tip);
    if (coins < 1) coins = 1;
    earnCoins(state, coins);
    state.wins++;
    if (state.knownAudiences.indexOf(audId) < 0) state.knownAudiences.push(audId);
    if (profile(state) === "mirror") {
      state.seenEnding = true;
      if (state.endings.indexOf(state.dimension) < 0) state.endings.push(state.dimension);
      emit(ev,{type:"selfReconciliation",lines:DATA.story.reveal.slice()});
    }
    if (state.tree.challenge) {
      if (!state.tookMental) stamp(state, "noDamage", ev);
      if (state.finisherFired) stamp(state, "finale", ev);
      var extraRule = getAud(venue, j).extra;
      if (extraRule && extraRule.type === "timeLimit" && metExtra(state, extraRule)) stamp(state, "timed", ev);
    }
    var removed = false;
    var keys = 0;
    var trophy = false;
    if (j === headlinerJ(venue)) {
      if (audId === "h-broadcast") state.bestiary[audId].wins++;
      if (!state.trophies[VENUES[venue-1].slug]) {
        state.trophies[VENUES[venue-1].slug] = 1;
        trophy = true;
        var reward = DATA.stageRewards.find(function (r) { return r.venueSlug === VENUES[venue-1].slug; });
        if (reward && !hasReward(state, reward.id)) { state.features.rewards.push(reward.id); emit(ev, {type:'stageReward',reward:reward.id,cell:0}); }
      }
    } else {
      var rec = state.bestiary[audId];
      var meta = AUD_BY_ID[audId];
      var extra = meta ? meta.extra : { type: "none", value: 0 };
      if (rec) {
        rec.wins++;
        if (metExtra(state, extra)) rec.extra = true;
        var need = extra && extra.type !== "none";
        if (!rec.removed && rec.wins >= CONST.bestiaryWins && (!need || rec.extra)) {
          rec.removed = true;
          removed = true;
          state.keys++;
          keys = 1;
          state.removedCount = countRemoved(state);
          recompute(state, false);
        }
      }
    }
    if (state.venue >= venueNumber(DATA.dealer.cardVenue)) {
      state.winsSinceDealer++;
      if (state.winsSinceDealer >= CONST.dealerEvery) {
        state.winsSinceDealer = 0;
        state.dealerQueued = true;
        emit(ev, { type: "dealerQueued" });
      }
    }
    state.buff = 0;
    emit(ev, { type: "win", venue: venue, crowd: state.crowd, j: j, coins: coins, removed: removed, trophy: trophy, keys: keys });
    var next = advanceFrom(state);
    if (isFinalBoss(state)) {
      state.mental = Math.min(state.mentalMax, state.mental + state.mentalMax * nodeEffects(state).winHeal);
      state.mode = "transition";
      state.transMs = CONST.winTransitionMs;
      state.after = state.homecomingCleared ? "stay" : "ending";
      return;
    }
    beginAudience(state, next.v, next.j, ev);
    state.mental = Math.min(state.mentalMax, state.mental + state.mentalMax * nodeEffects(state).winHeal);
    state.mode = "transition";
    state.transMs = CONST.winTransitionMs;
    state.after = state.features.climax.left > 0 ? "fight" : state.dealerQueued ? "dealer" : "fight";
  }

  function enterEnding(state, ev) {
    state.mode = "ending";
    state.dealer = null;
    state.dealerQueued = false;
    state.flights = []; cancelWorkers(state);
    state.homecomingCleared = true;
    state.seenEnding = true;
    if (state.endings.indexOf(state.dimension) < 0) state.endings.push(state.dimension);
    emit(ev, {type:'ending', dimension:state.dimension, title:DATA.title});
  }
  function stayHome(state) {
    state.dealerQueued = false; state.dealer = null; state.flights = [];
    beginAudience(state,venueNumber('lecturenote'),1,null);
    state.mental = state.mentalMax;
    return state;
  }
  function continueStory(state) {
    if (!state.seenEnding || state.homecomingCleared) return false;
    stayHome(state); return true;
  }
  function recap(state) { return {wins:state.wins, helpers:state.helpersUsed.length, venues:state.visited.length}; }

  function endingText(d) {
    if (d >= 1 && d <= DATA.dimensions.length) return DATA.dimensions[d - 1].ending;
    var g = DATA.genericEnding;
    var s = String(d);
    return {
      title: g.title.split("{d}").join(s),
      body: g.body.split("{d}").join(s)
    };
  }

  function setupDealer(state) {
    var n = CONST.cardMin + Math.floor(rngNext(state) * (CONST.cardMax - CONST.cardMin + 1));
    if (n < 3) n = 3;
    if (n > 5) n = 5;
    var dudAt = Math.floor(rngNext(state) * n);
    var cards = [];
    var i;
    for (i = 0; i < n; i++) {
      if (i === dudAt) cards.push({ open: false, dud: true, prize: "" });
      else {
        var p = PRIZE_LIST[Math.floor(rngNext(state) * PRIZE_LIST.length)];
        cards.push({ open: false, dud: false, prize: p.id });
      }
    }
    state.dealer = {
      phase: "card",
      cards: cards,
      risk: 1 / n,
      banned: {},
      grid: ["", "", "", "", "", "", "", "", ""],
      spun: false
    };
    state.dealerQueued = false;
    refreshRisk(state.dealer);
  }

  function refreshRisk(d) {
    var unopened = 0;
    var i;
    var dudLeft = 0;
    for (i = 0; i < d.cards.length && i < 8; i++) {
      if (!d.cards[i].open) {
        unopened++;
        if (d.cards[i].dud) dudLeft++;
      }
    }
    if (unopened <= 0) d.risk = 1;
    else d.risk = dudLeft / unopened;
  }

  function prizeById(id) {
    var i;
    for (i = 0; i < PRIZE_LIST.length; i++) if (PRIZE_LIST[i].id === id) return PRIZE_LIST[i];
    return null;
  }

  function applyPrize(state, prize) {
    if (!prize) return;
    if (prize.kind === "coins") {
      earnCoins(state, Math.round(prize.value * Math.pow(CONST.dealerCoinGrowth, balanceRank(state.vMax) - 1) * nodeEffects(state).dealerCoin));
    } else if (prize.kind === "gems") {
      state.gems += prize.value;
    } else if (prize.kind === "heal") {
      state.mental = Math.min(state.mentalMax, state.mental + state.mentalMax * (prize.value / 100));
    } else if (prize.kind === "buff") {
      state.buff = (state.buff || 0) + prize.value;
      if (state.buff > 100) state.buff = 100;
      recompute(state, false);
    }
  }

  function dealerCardPick(state, index) {
    var d = state.dealer;
    if (!d || d.phase !== "card") return false;
    index = index | 0;
    if (index < 0 || index >= d.cards.length) return false;
    var c = d.cards[index];
    if (!c || c.open) return false;
    c.open = true;
    if (c.dud) {
      var i;
      for (i = 0; i < d.cards.length && i < 8; i++) d.cards[i].open = true;
      d.phase = "card-done";
      refreshRisk(d);
      return true;
    }
    state.features.progress.dealerFlips++;
    applyPrize(state, prizeById(c.prize));
    refreshRisk(d);
    var any = false;
    for (var k = 0; k < d.cards.length && k < 8; k++) if (!d.cards[k].open) any = true;
    if (!any) d.phase = "card-done";
    return true;
  }

  function slotAvailable(state) {
    return reached(state, DATA.dealer.slotVenue);
  }

  function dealerClose(state) {
    var d = state.dealer;
    if (state.mode !== "dealer" && !d) return false;
    if (d && (d.phase === "card" || d.phase === "card-done") && slotAvailable(state)) {
      d.phase = "slot";
      return true;
    }
    state.dealer = null;
    state.dealerQueued = false;
    if (state.mode === "dealer" || state.mode === "transition") state.mode = "fight";
    state.heckleMs = (state.interval || 4) * 1000;
    state.telegraphed = false;
    return true;
  }

  function forceCost(state) {
    return Math.max(1, CONST.forceGemCost - state.tree.forceRemove);
  }

  function dealerForce(state, symbolId) {
    var d = state.dealer;
    if (!d || d.phase !== "slot" || d.spun) return false;
    if (state.tree.forceRemove < 1 || state.gems < forceCost(state)) return false;
    var sym = null;
    var i;
    for (i = 0; i < SYMBOLS.length; i++) if (SYMBOLS[i].id === symbolId) sym = SYMBOLS[i];
    if (!sym || sym.good) return false;
    if (d.banned[symbolId]) return false;
    state.gems -= forceCost(state);
    d.banned[symbolId] = 1;
    return true;
  }

  function dealerSlotSpin(state) {
    var d = state.dealer;
    if (!d || d.phase !== "slot" || d.spun) return false;
    var pool = [];
    var i;
    for (i = 0; i < SYMBOLS.length && i < CONST.loopCap; i++) {
      if (!d.banned[SYMBOLS[i].id]) pool.push(SYMBOLS[i]);
    }
    if (!pool.length) pool = SYMBOLS;
    var grid = [];
    for (i = 0; i < 9; i++) {
      var s = pool[Math.floor(rngNext(state) * pool.length)];
      grid.push(s.id);
    }
    d.grid = grid;
    d.spun = true;
    var lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    var pays = 0;
    for (i = 0; i < lines.length; i++) {
      var a = grid[lines[i][0]];
      var b = grid[lines[i][1]];
      var c = grid[lines[i][2]];
      if (a && a === b && b === c) {
        var good = false;
        var k;
        for (k = 0; k < SYMBOLS.length; k++) if (SYMBOLS[k].id === a && SYMBOLS[k].good) good = true;
        if (good) pays++;
      }
    }
    if (pays > 0) {
      earnCoins(state, Math.round(pays * CONST.slotCoin * Math.pow(CONST.dealerCoinGrowth, balanceRank(state.vMax) - 1) * nodeEffects(state).jackpot));
      if (pays >= 2) state.gems += CONST.slotGem;
    }
    return true;
  }

  function clearBoard(state) {
    var tau = state._tau || 350;
    var i;
    for (i = 0; i < state.board.length && i < 32; i++) {
      if (state.board[i].golden) { state.board[i].sealed = false; continue; }
      state.board[i].hp = 0;
      state.board[i].hpMax = 0;
      state.board[i].spawn = tau;
      state.board[i].sealed = false;
    }
  }

  function restartRun(state) {
    cancelWorkers(state);
    unseal(state);
    state.doveMs = nodeEffects(state).doveEvery;
    state.rabbitMs = nodeEffects(state).rabbitEvery;
    state.flashBreaks = 0;
    state.level = 0;
    state.xp = 0;
    state.shield = 0;
    state.combo = 0;
    state.comboMs = 0;
    state.maxCombo = 0;
    state.finisher = 0;
    state.finisherFired = false;
    state.buff = 0;
    state.phase2 = false;
    state.slow = false;
    state.miss = 0;
    state.pHeal = false;
    state.tapAcc = 0;
    state.holding = false;
    state.flights = [];
    state.dealer = null;
    state.dealerQueued = false;
    state.resolved = false;
    state.tookMental = false;
    state.fightMs = 0;
    state.pattern = "none";
    state.sealCell = -1;
    state.after = "fight";
    state.transMs = 0;
    recompute(state, true);
    state.mental = state.mentalMax;
    state.shield = state.mentalMax * nodeEffects(state).openingShield;
    clearBoard(state);
    if (state.tree.startFinale > 0) state.finisher = nodeEffects(state).finaleNeed;
    var pos = state.homecomingCleared ? {v:venueNumber('lecturenote'),j:1} : firstOpen(state);
    beginAudience(state, pos.v, pos.j, null);
    state.mode = "fight";
    return state;
  }

  function retreat(state) {
    return restartRun(state);
  }

  function failRun(state, ev) {
    var pct = 0;
    if (state.audHpMax > 0) pct = Math.round(100 * state.audHp / state.audHpMax);
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    emit(ev, { type: "fail", reasonPct: pct, cause: "mental" });
    state.fails++;
    restartRun(state);
  }

  function checkLevel(state, ev) {
    var guard = 0;
    while (state.xp >= CONST.xpBase + CONST.xpPerLevel * state.level && guard++ < 24) {
      state.xp -= CONST.xpBase + CONST.xpPerLevel * state.level;
      state.level++;
      recompute(state, false);
      state.mental = Math.min(state.mentalMax, state.mental + state.mentalMax * nodeEffects(state).levelHeal);
      emit(ev, { type: "levelUp", level: state.level });
    }
  }

  function dealAud(state, dmg, ev) {
    if (dmg < 0) dmg = 0;
    if (isFinalBoss(state) && state.review.bonusMs > 0) dmg *= 1.2;
    if (state.pattern === "twoPhase" && !state.phase2) {
      var threshold = state.audHpMax * CONST.phase2At;
      if (state.audHp - dmg <= threshold) {
        state.phase2 = true;
        state.audHp = state.audHpMax * CONST.phase2Hp;
        state.slow = true;
        state.pHeal = true;
        recompute(state, false);
        emit(ev, { type: "audHit", dmg: dmg });
        emit(ev, { type: "phase2" });
        return;
      }
    }
    state.audHp -= dmg;
    if (state.audHp < 0) state.audHp = 0;
    emit(ev, { type: "audHit", dmg: dmg });
  }

  function fireFinisher(state, ev) {
    state.finisher = 0;
    state.finisherFired = true;
    var dmg = (hasReward(state, 6) ? 1.3 : 1) * (profile(state) === "mirror" && state.phase2 ? 1 + state.features.climax.confidence / 100 : 1) * CONST.finisherDmg * (state._V || 1) * nodeEffects(state).finalePower * branchBonus(state, "finale");
    if (isFinalBoss(state) && state.review.finaleReady && !state.review.finaleUsed) { dmg *= 2; state.review.finaleUsed=true; state.review.finaleReady=false; emit(ev,{type:"curtainFinale"}); }
    emit(ev, { type: "finisher", dmg: dmg });
    dealAud(state, dmg, ev);
  }

  function breakCell(state, i, ev, source, chain) {
    var cell = state.board[i];
    if (!cell || cell.hpMax <= 0) return;
    var golden = !!cell.golden, f = state.features;
    reviewOpen(state,i,source,ev);
    var itemLv = cell.lv || 1, oldTier = caseTier(cell);
    cell.lv = itemLv; cell.xp = cell.xp || 0;
    if (cell.lv < caseCap(state)) cell.xp += 1 + .15 * (state.tree.caseXp || 0);
    while (cell.lv < caseCap(state) && cell.xp >= caseNeed(cell.lv)) {
      cell.xp -= caseNeed(cell.lv); cell.lv++;
      emit(ev, {type:'caseLevelUp',cell:i,level:cell.lv,tierChanged:oldTier !== caseTier(cell)});
    }
    if (cell.lv >= caseCap(state)) cell.xp = 0;
    f.workers.actors.forEach(function (a) {
      if (a.phase !== "move" || a.cell !== i) return;
      a.phase = "idle"; a.cell = -1; a.remainingMs = 0;
      emit(ev, { type: "worker", workerId: a.id, cell: -1, audId: a.audId, phase: "idle" });
    });
    cell.golden = false; cell.goldenBroken = golden;
    f.boxes++;
    if (source === "magic" || source === "helper" || source === "fan" || source === "assistant") f.helperBreaks++;
    if (golden) {
      f.progress.goldenOpened++; f.goldCell = -1; f.goldMs = nodeEffects(state).goldEvery;
      var bonus = Math.round(CONST.goldCoinBase * Math.pow(1.32, balanceRank(state.vMax) - 1) * nodeEffects(state).goldCoins);
      earnCoins(state, bonus); stamp(state, "golden", ev);
      emit(ev, { type: "goldenBreak", cell: i, coins: bonus });
    }
    cell.hp = 0;
    cell.hpMax = 0;
    cell.spawn = state._tau || 350;
    cell.sealed = false;
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    f.progress.comboMax = Math.max(f.progress.comboMax, state.combo);
    state.comboMs = nodeEffects(state).comboMs;
    emit(ev, { type: "combo", n: state.combo });
    if (state.tree.comboGift) {
      var paid = f.comboPaid[state.audId] || 0;
      for (var ci = 0; ci < CONST.comboThresholds.length; ci++) {
        if (state.combo < CONST.comboThresholds[ci] || (paid & (1 << ci))) continue;
        paid |= 1 << ci; f.comboPaid[state.audId] = paid;
        var gift = CONST.comboCoinRewards[ci] * Math.pow(1.32, balanceRank(state.venue) - 1) * nodeEffects(state).comboValue;
        earnCoins(state, gift); state.finisher += CONST.comboGaugeRewards[ci];
        emit(ev, { type: "comboMilestone", threshold: CONST.comboThresholds[ci], coins: gift, gauge: CONST.comboGaugeRewards[ci], audId: state.audId });
      }
    }
    checkAchievements(state, ev);
    state.xp += CONST.xpPerBox * nodeEffects(state).boxXP;
    state.shield = Math.min(state.mentalMax * nodeEffects(state).shieldRatio, state.shield + nodeEffects(state).boxShield);
    state.mental = Math.min(state.mentalMax, state.mental + nodeEffects(state).boxHeal);
    checkLevel(state, ev);
    var coinMul = state._coinMul || 1;
    earnCoins(state, Math.max(1, Math.round(CONST.coinPerBox * coinMul)));
    for (var tw = 0; tw < DATA.items.types.length; tw++) {
      TYPE_W[tw] = DATA.items.types[tw].share * 100;
      if (DATA.items.types[tw].id === "coin") TYPE_W[tw] += state.tree.coinLuck * CONST.coinLuckAdd;
    }
    if (state.tree.equip) {
      for (var ei = 0; ei < DATA.items.types.length; ei++) {
        var et = DATA.items.types[ei];
        var count = f.equipped.filter(function (id) { return itemType(id) === et; }).length;
        TYPE_W[ei] *= Math.pow(1 + CONST.equipWeightPerItem, count);
      }
    }
    for (var drop = 0; drop < caseItems(itemLv); drop++) {
    var type = DATA.items.types[pickW(state, TYPE_W)];
    var ri = pickW(state, CONST.rarityW);
    var minRarity = Math.max(golden ? 1 : 0, type.minRarity || 0);
    if (ri < minRarity) {
      // Equivalent to rerolling until eligible, without an unbounded rejection loop.
      ri = minRarity + pickW(state, CONST.rarityW.slice(minRarity));
    }
    var product = type.ladder[type.rarityMap[ri]];
    if (f.collected.indexOf(product.id) < 0) f.collected.push(product.id);
    var mult = CONST.rarityMult[ri];
    var kind = type.id;
    var effect = product.effect || type.effect;
    var amount = 0;
    if (effect === "damage") amount = CONST.itemDamage * state._V * mult;
    else if (effect === "shield") amount = CONST.itemShield * state._U * mult * nodeEffects(state).shieldValue;
    else if (effect === "heal") amount = CONST.itemHeal * state._U * mult * nodeEffects(state).healValue;
    else if (effect === "coins") amount = CONST.itemCoins * mult * coinMul;
    else if (effect === "xpBurst") amount = 0.5 * (CONST.xpBase + CONST.xpPerLevel * state.level);
    else if (effect === "finisher") amount = 5;
    else if (effect === "boxFill") amount = 0.3;
    amount *= Math.pow(1.10, itemLv - 1) * branchBonus(state, "box");
    var gem = 0;
    if (ri >= 1 && rngNext(state) < CONST.gemChance[ri] + nodeEffects(state).gemFind) {
      state.gems++;
      gem = 1;
    }
    emit(ev, { type: "boxBreak", openId: f.boxes, source: source || "manual", cell: i, item: kind, itemId: product.id, name: product.name, emoji: product.emoji, effect: effect, rarity: CONST.rarityIds[ri], value: amount, gem: gem });
    if (state.flights.length < CONST.flightCap) {
      state.flights.push({
        ms: CONST.itemFlightMs,
        kind: kind,
        itemId: product.id, name: product.name, emoji: product.emoji, effect: effect,
        amount: amount,
        rarity: CONST.rarityIds[ri],
        cell: i,
        audId: state.audId
      });
    }
    }
    if (state.tree.flashpaper && !f.magic.paused.flashpaper && f.magic.papers.length < 2 && rngNext(state) < .03 + .01 * state.tree.flashpaperChance) {
      f.magic.papers.push({cell:i}); emit(ev,{type:'paperDrop',cell:i});
    }
    state.features.climax.mirrored = state.features.climax.mirrored.filter(function (n) {return n !== i;});
    if (state.tree.flash > 0 && ++state.flashBreaks >= CONST.flashEvery) {
      state.flashBreaks = 0; usedHelper(state,"flash");
      var burst = CONST.flashDamage * state._V;
      emit(ev, { type: "flash", dmg: burst, cell: i });
      dealAud(state, burst, ev);
    }
    if (state.tree.chain4 && state.mode === 'fight') {
      chain = chain || {seen: new Set([i]), depth: 0};
      if (chain.depth < 2) {
        var pos = cellPosition(state, i);
        for (var ni = 0; ni < state.board.length; ni++) {
          var np = cellPosition(state, ni), dx = Math.abs(np.col-pos.col), dy = Math.abs(np.row-pos.row);
          if (ni === i || chain.seen.has(ni) || dx > 1 || dy > 1 || (!state.tree.chain8 && dx+dy !== 1)) continue;
          if (state.board[ni].hp <= 0 || state.board[ni].sealed) continue;
          chain.seen.add(ni);
          emit(ev,{type:'chain',from:i,to:ni});
          damageCell(state,ni,wandDamage(state)*(.3+.1*(state.tree.chainPower||0))*(hasReward(state,5)?1.15:1),ev,'chain',{seen:chain.seen,depth:chain.depth+1});
        }
      }
    }
    state.finisher++;
    if (state.finisher >= nodeEffects(state).finaleNeed) fireFinisher(state, ev);
    if (state.audHp <= 0 && state.mode === "fight" && !state.resolved) onWin(state, ev);
  }

  function damageCell(state, i, dmg, ev, source, chain) {
    var c = state.board[i];
    if (!c || c.hp <= 0 || c.sealed) return;
    if (state.features.climax.mirrored.indexOf(i) >= 0 && (!source || source === 'manual')) return;
    var role = source === 'magic' ? 'magic' : source === "fan" || source === "assistant" || source === "chain" ? source : "manual";
    state.features.damage[role] += Math.min(c.hp, dmg);
    c.hp -= dmg;
    if (c.hp <= 0) breakCell(state, i, ev, source, chain);
    else emit(ev, { type: "boxHit", source: role, cell: i, pct: Math.round((1 - c.hp / c.hpMax) * 100) });
  }

  function dedupe(taps, n) {
    DEDUPE.length = 0;
    if (!taps || !taps.length || n <= 0) return DEDUPE;
    SEEN_STAMP++;
    if (SEEN_STAMP > 2000000000) {
      SEEN.fill(0);
      SEEN_STAMP = 1;
    }
    var limit = taps.length;
    if (limit > 400) limit = 400;
    var i;
    for (i = 0; i < limit; i++) {
      var raw = taps[i];
      if (typeof raw !== "number" || raw !== (raw | 0)) continue;
      var c = raw | 0;
      if (c < 0 || c >= n || c >= 32) continue;
      if (SEEN[c] === SEEN_STAMP) continue;
      SEEN[c] = SEEN_STAMP;
      DEDUPE.push(c);
    }
    return DEDUPE;
  }

  function applyTaps(state, dt, taps, ev) {
    var n = state.board.length;
    var list = dedupe(taps, n);
    if (!list.length) {
      state.holding = false;
      state.tapAcc = 0;
      return;
    }
    if (!state.holding) {
      state.holding = true;
      if (state.tapAcc < 1) state.tapAcc = 1;
    }
    if (state._rate == null) recompute(state, true);
    state.tapAcc += state._rate * dt / 1000;
    var hits = Math.floor(state.tapAcc);
    if (hits > 8) hits = 8;
    if (hits < 0) hits = 0;
    state.tapAcc -= hits;
    if (hits <= 0 || state.mode !== "fight") return;
    var dmg = wandDamage(state);
    var h, k;
    for (h = 0; h < hits; h++) {
      if (state.mode !== "fight") return;
      var mods = nodeEffects(state);
      var crit = state.tree.crit > 0 && rngNext(state) < mods.critRate;
      var alive = 0;
      for (k = 0; k < list.length; k++) {
        var cell = state.board[list[k]];
        if (cell.hp > 0 && !cell.sealed) alive++;
      }
      var hitDmg = dmg * (crit ? mods.critPower : 1) * (alive === 1 ? mods.sweep : 1);
      if (crit && alive) emit(ev, { type: "crit", dmg: hitDmg, cell: list.find(function (i) { return state.board[i].hp > 0 && !state.board[i].sealed; }) });
      for (k = 0; k < list.length; k++) damageCell(state, list[k], hitDmg, ev);
    }
  }

  function landFlights(state, dt, ev) {
    var list = state.flights;
    if (!list.length) return;
    var i;
    // Reserve pending flights before boxFill can enqueue newly broken boxes.
    state.flights = [];
    for (i = 0; i < list.length && i < CONST.flightCap; i++) {
      list[i].ms -= dt;
      if (list[i].ms > 0) state.flights.push(list[i]);
    }
    for (i = 0; i < list.length && i < CONST.flightCap; i++) {
      var f = list[i];
      if (f.ms > 0) continue;
      if (f.effect === "xpBurst") f.amount = 0.5 * (CONST.xpBase + CONST.xpPerLevel * state.level);
      emit(ev, { type: "itemLand", cell: f.cell, item: f.kind, itemId: f.itemId, name: f.name, emoji: f.emoji, effect: f.effect, rarity: f.rarity, value: f.amount });
      if (f.kind === "card") {
        if (state.mode === "fight" && !state.resolved && f.audId === state.audId) {
          var dmg = f.amount;
          if (nodeEffects(state).miss > 0 && rngNext(state) < nodeEffects(state).miss) dmg = 0;
          if (dmg > 0) dealAud(state, dmg, ev);
          else emit(ev, { type: "audHit", dmg: 0 });
          if (state.audHp <= 0 && !state.resolved) onWin(state, ev);
        }
      } else if (f.kind === "silk") {
        var cap = state.mentalMax * nodeEffects(state).shieldRatio;
        state.shield += f.amount;
        if (state.shield > cap) state.shield = cap;
      } else if (f.kind === "water") {
        state.mental += f.amount;
        if (state.mental > state.mentalMax) state.mental = state.mentalMax;
      } else if (f.kind === "coin") {
        earnCoins(state, Math.max(0, Math.round(f.amount)));
      } else if (f.effect === "xpBurst") {
        state.xp += f.amount;
        checkLevel(state, ev);
      } else if (f.effect === "finisher") {
        state.finisher += 5;
        if (state.finisher >= nodeEffects(state).finaleNeed) fireFinisher(state, ev);
      } else if (f.effect === "boxFill") {
        // Progress every owned cell, including sealed and respawning boxes.
        // Live boxes lose 30% max HP; empty boxes lose 30% of respawn time.
        for (var bi = 0; bi < state.board.length; bi++) {
          var bc = state.board[bi];
          if (bc.hp > 0) {
            bc.hp = Math.max(0, bc.hp - bc.hpMax * 0.3);
            if (bc.hp === 0) breakCell(state, bi, ev);
          } else {
            bc.spawn = Math.max(0, bc.spawn - state._tau * 0.3);
          }
        }
      }
    }
  }

  function tickSpawn(state, dt, ev) {
    var board = state.board;
    var i;
    var tau = state._tau || 350;
    for (i = 0; i < board.length && i < 32; i++) {
      var c = board[i];
      if (c.hp > 0) continue;
      c.spawn -= dt;
      if (c.spawn <= 0) {
        fillBox(state, c);
        if (c.golden) emit(ev, { type: "golden", cell: i });
        c.spawn = 0;
      }
    }
    if (tau < 0) { /* keep tau referenced for tuning visibility */ }
  }

  function tickPatterns(state, dt, ev) {
    if (state.pattern === "sealBox") {
      if (state.sealMs > 0) {
        state.sealMs -= dt;
        if (state.sealMs <= 0) {
          unseal(state);
          state.sealCd = CONST.sealEvery;
        }
      } else {
        state.sealCd -= dt;
        if (state.sealCd <= 0) sealOne(state);
      }
    }
    if (state.pHeal || state.pattern === "heal") {
      state.patternHealMs -= dt;
      var guard = 0;
      while (state.patternHealMs <= 0 && guard++ < 4) {
        state.audHp += state.audHpMax * CONST.patternHealPct;
        if (state.audHp > state.audHpMax) state.audHp = state.audHpMax;
        state.patternHealMs += CONST.patternHealEvery;
      }
    }
  }

  function tickHeckle(state, dt, ev) {
    state.heckleMs -= dt;
    if (!state.telegraphed && state.heckleMs <= CONST.telegraphMs) {
      state.telegraphed = true;
      emit(ev, { type: "heckleTelegraph" });
    }
    var guard = 0;
    while (state.heckleMs <= 0 && guard++ < 4 && state.mode === "fight" && !state.resolved) {
      var intervalMs = state.interval * 1000;
      if (intervalMs < 400) intervalMs = 400;
      state.heckleMs += intervalMs;
      state.telegraphed = state.heckleMs <= CONST.telegraphMs;
      if (state.review.cancel) { state.review.cancel=false; emit(ev,{type:"heckleCancelled"}); continue; }
      var dmg = state.atk * nodeEffects(state).calm;
      var shieldDmg = 0;
      if (state.shield > 0) {
        shieldDmg = state.shield >= dmg ? dmg : state.shield;
        state.shield -= shieldDmg;
      }
      var mentalDmg = dmg - shieldDmg;
      if (mentalDmg > 0) {
        state.mental -= mentalDmg;
        state.tookMental = true;
      }
      if (state.pattern === "stealCoins" && state.coins > 0) {
        var take = Math.floor(state.coins * CONST.stealPct);
        if (take < 1) take = 1;
        if (take > state.coins) take = state.coins;
        state.coins -= take;
      }
      emit(ev, { type: "heckle", dmg: dmg, shieldDmg: shieldDmg });
      if (state.mental <= 0) {
        state.mental = 0;
        failRun(state, ev);
        return;
      }
    }
  }

  function tickAutos(state, dt, ev) {
    if (state.tree.dove > 0 && !state.features.dovePaused) {
      state.doveMs -= dt;
      if (state.doveMs <= 0) {
        usedHelper(state,"dove");
        state.doveMs += nodeEffects(state).doveEvery;
        var dmg = CONST.doveDamage * state._V * nodeEffects(state).dovePower;
        emit(ev, { type: "dove", dmg: dmg });
        dealAud(state, dmg, ev);
        if (state.audHp <= 0) { onWin(state, ev); return; }
      }
    }
    if (state.tree.rabbit > 0 && !state.features.helperPaused) {
      state.rabbitMs -= dt;
      if (state.rabbitMs <= 0) {
        usedHelper(state,"rabbit");
        state.rabbitMs += nodeEffects(state).rabbitEvery;
        var coins = nodeEffects(state).rabbitCoins;
        earnCoins(state, coins);
        emit(ev, { type: "rabbit", coins: coins });
      }
    }
  }

  function tickFeatures(state, dt, ev) {
    var f = state.features;
    f.elapsedMs += dt;
    f.revealMs = Math.max(0, f.revealMs - dt);
    if (!f.revealMs && f.revealQueue.length) {
      var id = f.revealQueue.shift(); f.revealMs = CONST.revealGapMs;
      emit(ev, { type: "unlockReveal", id: id });
    }
    if (state.tree.golden && !f.goldPending && f.goldCell < 0) {
      f.goldMs = Math.max(0, f.goldMs - dt);
      if (!f.goldMs) f.goldPending = true;
    }
    if (state.tree.encore) {
      var wasActive = f.encoreLeft > 0;
      f.encoreLeft = Math.max(0, f.encoreLeft - dt);
      f.encoreMs = Math.max(0, f.encoreMs - dt);
      if (!f.encoreMs) {
        f.encoreMs = CONST.encoreEveryMs;
        f.encoreLeft = nodeEffects(state).encoreSpan;
        emit(ev, { type: "encore", duration: f.encoreLeft });
      } else if (wasActive && !f.encoreLeft) emit(ev, { type: "encoreEnd" });
    }
    checkAchievements(state, ev);
  }

  function productMultiplier(state) {
    var value = 1;
    DATA.tree.forEach(function (n) { if (n.productMultiplier && state.tree[n.id]) value *= n.productMultiplier; });
    return value;
  }
  function fanCount(state) {
    if (!state.tree.boxHelper) return 0;
    return DATA.fanVenueSlugs.filter(function(slug) {return reached(state,slug);}).length;
  }
  function syncWorkers(state) {
    var w = state.features.workers, ids = [], count = fanCount(state);
    var roster = count + ":" + (state.tree.assistant ? 1 : 0);
    if (state._workerRoster === roster && w.actors.length === count + (state.tree.assistant ? 1 : 0)) return;
    state._workerRoster = roster;
    for (var i = 0; i < count; i++) ids.push("fan-" + i);
    if (state.tree.assistant) ids.push("assistant-0");
    w.actors = w.actors.filter(function (a) { return ids.indexOf(a.id) >= 0; });
    ids.forEach(function (id) {
      if (w.actors.some(function (a) { return a.id === id; })) return;
      var role = id.split("-")[0], every = role === "fan" ? nodeEffects(state).helperEvery : 1200;
      w.actors.push({ id: id, role: role, phase: "idle", cell: -1, audId: state.audId,
        remainingMs: 0, cycleRemainingMs: every + (role === "fan" ? Number(id.split("-")[1]) * every / 5 : 0) });
    });
  }
  function cancelWorkers(state) {
    state.features.workers.actors.forEach(function (a) { a.phase = "idle"; a.cell = -1; a.remainingMs = 0; });
  }
  function tickBoxHelper(state, dt, ev) {
    if (!state.tree.boxHelper && !state.tree.assistant && !state.features.workers.actors.length) return;
    syncWorkers(state);
    var w = state.features.workers;
    for (var a of w.actors) {
      if (w[a.role + "Paused"]) continue;
      var every = (a.role === "fan" ? nodeEffects(state).helperEvery : 1200) / helperSpeed(state);
      a.cycleRemainingMs = Math.max(0, a.cycleRemainingMs - dt);
      if (a.phase !== "idle") {
        var c = state.board[a.cell];
        if (a.audId !== state.audId || !c || c.sealed || (a.phase === "move" && c.hp <= 0)) {
          a.phase = "idle"; a.cell = -1; a.remainingMs = 0;
          emit(ev, { type: "worker", workerId: a.id, cell: -1, audId: state.audId, phase: "idle" });
          continue;
        }
        a.remainingMs = Math.max(0, a.remainingMs - dt);
        if (a.remainingMs) continue;
        if (a.phase === "move") {
          a.phase = "work"; a.remainingMs = 150;
          var dmg = wandDamage(state) * branchBonus(state, "pet") * (1 + .15 * state.tree.fanPower) * (a.role === "fan" ? 0.35 : 0.8 * (c.golden ? 1.5 : 1));
          emit(ev, { type: "worker", workerId: a.id, cell: a.cell, audId: a.audId, phase: "work", dmg: dmg });
          usedHelper(state,a.role); damageCell(state, a.cell, dmg, ev, a.role);
          if (state.mode !== "fight") return;
        } else {
          a.phase = "idle"; a.cell = -1;
          emit(ev, { type: "worker", workerId: a.id, cell: -1, audId: state.audId, phase: "idle" });
        }
        continue;
      }
      if (a.cycleRemainingMs > 300) continue;
      var cursorKey = a.role + "Cursor", chosen = -1;
      for (var pass = 0; pass < 2 && chosen < 0; pass++) {
        for (var n = 0; n < state.board.length; n++) {
          var i = (w[cursorKey] + n) % state.board.length, cell = state.board[i];
          if (cell.hp <= 0 || cell.sealed) continue;
          if (!pass && w.actors.some(function (other) { return other !== a && other.phase !== "idle" && other.cell === i; })) continue;
          chosen = i; break;
        }
      }
      if (chosen < 0) continue;
      w[cursorKey] = (chosen + 1) % state.board.length;
      a.cell = chosen; a.audId = state.audId; a.phase = "move"; a.remainingMs = 300;
      a.cycleRemainingMs += every;
      emit(ev, { type: "worker", workerId: a.id, cell: chosen, audId: a.audId, phase: "move" });
    }
  }

  function hasReward(state, id) { return state.features.rewards.indexOf(id) >= 0; }
  function helperSpeed(state) { return hasReward(state,3) ? 1.1 : 1; }
  function isFinalBoss(state) { return profile(state) === "homecoming"; }
  function skipCurtainCall(state) {
    if (state.features.climax.left <= 0) return false;
    state.features.climax.left = 0; state.features.climax.paradeDone = true; return true;
  }
  function tapPaper(state, cell) {
    var ev=[], m=state.features.magic;
    if (state.mode !== 'fight' || state.features.climax.left > 0) return ev;
    var at=m.papers.findIndex(function(p){return p.cell===cell;});
    if(at<0)return ev;
    m.papers.splice(at,1); usedHelper(state,"flashpaper");
    emit(ev,{type:'paperFlash',cell:cell});
    for(var i=0;i<state.board.length && state.mode==='fight';i++) damageCell(state,i,wandDamage(state)*1.5*(1+.2*state.tree.flashpaperPower),ev,'magic');
    return ev;
  }
  function tickMagic(state, dt, ev) {
    var m=state.features.magic,t=state.tree; m.clock+=dt;
    var live=function(){return state.board.map(function(c,i){return c.hp>0&&!c.sealed?i:-1;}).filter(function(i){return i>=0;});};
    var strike=function(id,i,ratio){if(state.mode!=='fight')return;emit(ev,{type:'magicHit',helper:id,cell:i});damageCell(state,i,wandDamage(state)*ratio,ev,'magic');};
    if(t.sponge && !m.paused.sponge) {
      usedHelper(state,"sponge");
      var count=Math.min(3,1+t.spongeCount);
      while(m.balls.length<count) {var n=m.balls.length;m.balls.push({x:64+n*90,y:64+n*140,vx:310+n*40,vy:230+n*50,last:{}});}
      for(var b of m.balls){
        var speed=(1+.12*t.spongeSpeed)*helperSpeed(state);
        b.x+=b.vx*speed*dt/1000;b.y+=b.vy*speed*dt/1000;
        for(var axis of ['x','y']){if(b[axis]<16){b[axis]=32-b[axis];b['v'+axis]=Math.abs(b['v'+axis]);}if(b[axis]>592){b[axis]=1184-b[axis];b['v'+axis]=-Math.abs(b['v'+axis]);}}
        for(var i of live()){var p=cellPosition(state,i),x=8+p.col*120,y=8+p.row*120;
          if(b.x>=x-12&&b.x<=x+124&&b.y>=y-12&&b.y<=y+124&&(b.last[i]==null||m.clock-b.last[i]>=400)) {b.last[i]=m.clock;strike('sponge',i,.25*(1+.15*t.spongePower));if(state.mode!=='fight')return;}
        }
      }
    }
    var periods={cardthrow:1500,tipbox:6000,crystal:8000,water:9000,spotlight:4000};
    for(var id of Object.keys(periods)) {
      if(!t[id]||m.paused[id])continue;
      var every=periods[id]*(1-.1*t[id+'Speed'])/helperSpeed(state);
      if(m.timers[id]==null)m.timers[id]=every;
      m.timers[id]-=dt;
      if(m.timers[id]>0)continue;
      m.timers[id]+=every;
      var cells=live(),cell=cells.length?cells[m.cursor++%cells.length]:0;
      if(id==='cardthrow')for(var n=0;n<Math.min(4,1+t.cardthrowCount)&&cells.length;n++)strike(id,cells[(m.cursor+n)%cells.length],.4*(1+.15*t.cardthrowPower));
      if(id==='tipbox'){var coins=(2+legacyRank(state.venue))*(1+.25*t.tipboxPower);earnCoins(state,coins);emit(ev,{type:'magicCoins',cell:cell,coins:coins});}
      if(id==='crystal')state.shield=Math.min(state.mentalMax*nodeEffects(state).shieldRatio,state.shield+state.mentalMax*.03*(1+.2*t.crystalPower));
      if(id==='water')state.mental=Math.min(state.mentalMax,state.mental+state.mentalMax*.03*(1+.2*t.waterPower));
      if(id==='spotlight'){
        var rows=Array.from(new Set(state.board.map(function(c,i){return cellPosition(state,i).row;})));
        var start=m.cursor++%rows.length;
        for(var n=0;n<Math.min(2,1+t.spotlightCount);n++){var row=rows[(start+n)%rows.length];emit(ev,{type:'spotlight',cell:cell,row:row});for(var i of cells)if(cellPosition(state,i).row===row)strike(id,i,.6*(1+.15*t.spotlightPower));}
      }
      usedHelper(state,id); emit(ev,{type:'magicPulse',helper:id,cell:cell});
      if(state.mode!=='fight')return;
    }
  }
  function usedHelper(state,id) { if (state.helpersUsed.indexOf(id)<0) state.helpersUsed.push(id); }
  function selectReviewTarget(state) {
    var r=state.review;
    for(var n=0;n<state.board.length;n++) {
      var i=(r.cycle+n)%state.board.length, c=state.board[i];
      if(c.hp>0&&!c.sealed) { r.target=i; return; }
    }
    r.target=-1;
  }
  function tickReview(state,dt,ev) {
    var home=isFinalBoss(state), friendly=state.pattern==='friendlyReview';
    if(!home&&!friendly)return;
    var r=state.review;
    r.bonusMs=Math.max(0,r.bonusMs-dt); r.actMs+=dt;
    if(home) {
      var act=state.audHp<=state.audHpMax*.30?3:state.audHp<=state.audHpMax*.65?2:1;
      while(r.act<act) {
        r.act++; r.actMs=0; r.target=-1; r.elapsed=0;
        emit(ev,{type:'homecomingAct',act:r.act,line:getAud(state.venue,state.j)['act'+r.act+'Line']});
      }
      if(r.act===3) { if(r.actMs>=2000&&!r.finaleUsed)r.finaleReady=true; return; }
      if(r.act===2)return;
    }
    var period=friendly?18000:15000, duration=friendly?6000:8000;
    r.elapsed+=dt;
    if(r.elapsed>=period) { r.elapsed-=period; r.cycle++; selectReviewTarget(state); emit(ev,{type:'reviewTarget',cell:r.target}); }
    if(r.target>=0 && (!state.board[r.target] || state.board[r.target].hp<=0 || state.board[r.target].sealed))selectReviewTarget(state);
    if(r.elapsed>=2000+duration)r.target=-1;
    // Cycle zero waits for the first full period before showing a target.
  }
  function reviewOpen(state,i,source,ev) {
    var r=state.review, home=isFinalBoss(state);
    if(!home&&state.pattern!=='friendlyReview')return;
    if(r.target===i&&r.elapsed>=2000) {
      r.cancel=true; r.target=-1;
      if(home)r.bonusMs=4000;
      emit(ev,{type:'reviewApplause',cell:i});
    }
    if(home&&r.act===2&&r.pairs<3) {
      var manual=!source||source==='manual', kind=manual?'manual':'auto';
      var automation=state.tree.boxHelper||state.tree.assistant||state.tree.chain4||['sponge','cardthrow','spotlight','flashpaper'].some(function(id){return state.tree[id];});
      if(r.lastSource && ((kind!==r.lastSource) || (!automation&&manual&&r.lastCell!==i))) {
        r.pairs++; state.finisher+=5; r.lastSource='';r.lastCell=-1;
        emit(ev,{type:'jointApplause',cell:i});
      } else { r.lastSource=kind; r.lastCell=i; }
    }
  }
  function tickBoss(state,dt,ev) {
    tickReview(state,dt,ev);
    if(profile(state) !== "mirror")return;
    var c=state.features.climax;
    if(!state.phase2){c.mirrorMs-=dt;if(c.mirrorMs<=0){c.mirrorMs+=15000;c.mirrored=state.board.map(function(b,i){return b.hp>0&&!b.sealed?i:-1;}).filter(function(i){return i>=0;}).slice(0,2);emit(ev,{type:'bossMirror',cell:c.mirrored[0]||0});}}
    else {c.mirrored=[];var milestone=Math.floor(state.combo/10);if(milestone>c.milestone){c.confidence=Math.min(100,c.confidence+(milestone-c.milestone)*10);c.milestone=milestone;emit(ev,{type:'confidence',cell:0,value:c.confidence});}}
  }

  function substep(state, dt, taps, ev) {
    if (state.mode === "ending") return;
    if (state.mode === "dealer") return;
    if (state.mode === "transition") {
      state.transMs = Math.max(0, state.transMs - dt);
      tickSpawn(state, dt);
      landFlights(state, dt, ev);
      if (state.transMs <= 0) {
        if (state.after === "ending") enterEnding(state, ev);
        else if (state.after === "continue") restartRun(state);
        else if (state.after === "stay") stayHome(state);
        else if (state.after === "legacyEnding") { state.mode='ending'; state.seenEnding=true; if(state.endings.indexOf(state.dimension)<0)state.endings.push(state.dimension); }
        else if (state.after === "dealer") {
          state.mode = "dealer";
          setupDealer(state);
        } else {
          state.mode = "fight";
          state.heckleMs = state.interval * 1000;
          state.telegraphed = false;
        }
      }
      return;
    }
    if (state.mode !== "fight") return;
    if (state.features.climax.left > 0) {
      state.features.climax.left = Math.max(0,state.features.climax.left-dt);
      if (!state.features.climax.left || taps.length) skipCurtainCall(state);
      if (!state.features.climax.left) state.features.climax.paradeDone = true;
      return;
    }
    state.fightMs += dt;
    tickBoss(state,dt,ev);
    tickFeatures(state, dt, ev);
    tickSpawn(state, dt, ev);
    landFlights(state, dt, ev);
    if (state.mode !== "fight") return;
    tickPatterns(state, dt, ev);
    tickAutos(state, dt, ev);
    if (state.mode !== "fight") return;
    tickMagic(state, dt, ev);
    if (state.mode !== "fight") return;
    tickBoxHelper(state, dt, ev);
    if (state.mode !== "fight") return;
    if (state.combo > 0) {
      state.comboMs -= dt;
      if (state.comboMs <= 0) {
        state.combo = 0;
        state.comboMs = 0;
      }
    }
    applyTaps(state, dt, taps, ev);
    if (state.mode !== "fight" || state.resolved) return;
    if (state.audHp <= 0) onWin(state, ev);
    if (state.mode !== "fight" || state.resolved) return;
    tickHeckle(state, dt, ev);
  }

  function step(state, dtMs, input) {
    if (!state || typeof state !== "object" || !state.board) return [];
    var out = [];
    var quiet = !!(input && input.quiet);
    var ev = quiet ? null : out;
    var taps = input && input.taps ? input.taps : [];
    dtMs = +dtMs;
    if (!isFinite(dtMs) || dtMs < 0) dtMs = 0;
    var cap = CONST.substepMs * CONST.maxSubsteps;
    if (dtMs > cap) dtMs = cap;
    var guard = 0;
    while (dtMs > 0 && guard < CONST.maxSubsteps) {
      var dt = dtMs > CONST.substepMs ? CONST.substepMs : dtMs;
      substep(state, dt, taps, ev);
      dtMs -= dt;
      guard++;
      if (state.mode === "ending" || state.mode === "dealer") break;
    }
    return out;
  }

  function nodeLevel(state, node) {
    return node.starKey ? state.stars[node.starKey] : state.tree[node.id];
  }

  function branchMaxed(state, node) { return (node.branchMax || []).every(function(id) { return nodeLevel(state,NODE_BY_ID[id]) >= NODE_BY_ID[id].max || (id === "board" && boardCapacity(state) >= CONST.boardMax); }); }
  function gateProgress(state, gate) {
    if (!gate) return null;
    var current = gate.type === 'venue' ? (reached(state,gate.slug) ? 1 : 0) : gate.type === 'casesAtLv' ? state.board.filter(function(c){return (c.lv||1)>=gate.lv;}).length : state.features.progress[gate.type] || 0;
    var label = {venue:'공연장 도착',casesAtLv:'LV '+gate.lv+' 케이스 수',comboMax:'최고 콤보',dealerFlips:'카드 뒤집기 성공',coinsEarned:'차원 누적 동전',goldenOpened:'황금 케이스 개봉'}[gate.type];
    var target = gate.type === 'venue' ? 1 : gate.target;
    if (gate.type === 'venue') return {current:current,target:target,met:!!current,text:VENUES[venueNumber(gate.slug)-1].name+' 도착 필요'};
    return {current:current,target:target,met:current>=target,text:'조건: '+label+' ('+Math.floor(current)+'/'+gate.target+')'};
  }
  function nodeInfo(state, id) {
    var node = NODE_BY_ID[id];
    if (!node || !state || !state.tree) return { level: 0, max: 0, currency: "coins", cost: null, revealed: false, purchasable: false, blockedReason: "알 수 없는 비법" };
    var level = nodeLevel(state, node), cost = null;
    if (level < node.max) cost = Array.isArray(node.cost) ? node.cost[level] : Math.ceil(node.cost.c * Math.pow(node.cost.g, level));
    var revealed = id === "root" || (node.reveal === "E" ? state.endings.length > 0 : level > 0 || node.prereqs.some(function (pre) { return nodeLevel(state, NODE_BY_ID[pre]) > 0; }));
    if (node.hidden || node.infinite) revealed = level > 0 || branchMaxed(state,node);
    var progress = gateProgress(state,node.gates ? node.gates[level] : node.gate);
    var reason = "";
    if (level >= node.max) reason = "최대 레벨";
    else if (node.reveal === "E" && !state.endings.length) reason = "첫 멀티버스 공연 완료";
    else if (!revealed) reason = "아직 발견하지 못한 비법";
    else if (progress && !progress.met) reason = progress.text;
    else if (node.pending) reason = "준비 중";
    else if (!node.prereqs.every(function (pre) { return nodeLevel(state, NODE_BY_ID[pre]) > 0; })) reason = "선행 비법 필요: " + node.prereqs.filter(function (pre) { return nodeLevel(state, NODE_BY_ID[pre]) < 1; }).map(function (pre) { return NODE_BY_ID[pre].name; }).join(", ");
    else if (node.venueSlug && !reached(state,node.venueSlug)) reason = VENUES[venueNumber(node.venueSlug)-1].name + " 도착 필요";
    else if (id === "area" && !reached(state,CONST.areaVenueNeeds[level])) reason = VENUES[venueNumber(CONST.areaVenueNeeds[level])-1].name + " 도착 필요";
    else if (id === "area" && boardCapacity(state) < CONST.areaNeeds[level]) reason = "케이스 자리 " + CONST.areaNeeds[level] + "칸 필요";
    else if (id === "board" && boardCapacity(state) >= CONST.boardMax) reason = "케이스 자리 25칸 완성";
    else if (state[node.currency] < cost) reason = ({ coins: "동전", keys: "열쇠", starlight: "별빛" })[node.currency] + " 부족";
    return { level: level, max: node.infinite ? "∞" : node.max, gate:progress, currency: node.currency, cost: cost, revealed: revealed, purchasable: !reason, blockedReason: reason };
  }

  // Numeric price contract, null for unavailable upgrades. Wallet is checked by buyNode.
  function nodeCost(state, id) {
    var info = nodeInfo(state, id);
    if (info.cost == null || (info.blockedReason && !info.blockedReason.endsWith(" 부족"))) return null;
    return info.cost;
  }

  function buyNode(state, id) {
    var info = nodeInfo(state, id), node = NODE_BY_ID[id];
    if (!info.purchasable) return false;
    state[info.currency] -= info.cost;
    if (node.starKey) state.stars[node.starKey]++;
    else state.tree[id]++;
    if (id === "dove") state.doveMs = nodeEffects(state).doveEvery;
    if (id === "rabbit") state.rabbitMs = nodeEffects(state).rabbitEvery;
    if (id === "flash") state.flashBreaks = 0;
    recompute(state, false);
    if (id === "board") { ensureBoard(state); reveal(state, "slot"); }
    if (id === "area") reveal(state, "area");
    if (id === "dove" || id === "rabbit" || id === "boxHelper" || id === "assistant") reveal(state, id);
    if (id === "boxHelper" || id === "assistant") syncWorkers(state);
    if (id === "equip") {
      if (state.features.guide !== "done") { state.features.guide = "place"; state.features.equipped = []; }
      else state.features.collected.forEach(function (item) { if (state.features.equipped.length < CONST.equipBaseSlots) equipItem(state,item); });
      reveal(state, "equip");
    }
    DATA.tree.forEach(function(n){ if(n.hidden && branchMaxed(state,n)) reveal(state,'hidden:'+n.id); });
    return true;
  }
  function buyMany(state, id) { var n=0; while(n<10000 && buyNode(state,id)) n++; return n; }

  function starCost(state, id) {
    if (STAR_KEYS.indexOf(id) < 0) return null;
    var lv = state.stars[id] | 0;
    if (lv >= 30) return null;
    if (id === "trick") return 1;
    return 2;
  }

  function buyStar(state, id) {
    var node = DATA.tree.find(function (n) { return n.starKey === id; });
    return node ? buyNode(state, node.id) : false;
  }

  function rebirth(state) {
    var d = state.dimension | 0;
    if (d < 1) d = 1;
    var gain = CONST.starGainBase + d;
    if (gain < 1) gain = 1;
    state.starlight += gain;
    var i;
    var has = false;
    if (state.mode === "ending" || state.seenEnding) {
      for (i = 0; i < state.endings.length && i < CONST.loopCap; i++) if (state.endings[i] === d) has = true;
      if (!has && state.endings.length < CONST.loopCap) state.endings.push(d);
    }
    state.dimension = d + 1;
    state.seenEnding = false;
    state.homecomingCleared = false; state.visited = []; state.helpersUsed = [];
    state.coins = 0;
    state.gems = 0;
    state.keys = 0;
    state.vMax = 1;
    state.legacySlots = 0;
    state.wins = 0;
    state.fails = 0;
    state.winsSinceDealer = 0;
    var reveals = state.features.reveals.slice(), guideDone = state.features.guide === "done";
    state.features = emptyFeatures(); state.features.reveals = reveals;
    if (guideDone) state.features.guide = "done";
    state.tree = emptyTree();
    state.bestiary = emptyBestiary();
    state.trophies = {};
    state.invited = {};
    state.removedCount = 0;
    state.board = [{ lv: 1, xp: 0, hp: 0, hpMax: 0, spawn: 350, sealed: false }];
    state.flights = [];
    state.dealer = null;
    recompute(state, true);
    state.mental = state.mentalMax;
    restartRun(state);
    return state;
  }

  function fresh(seed) {
    seed = seed >>> 0;
    var state = {
      features: emptyFeatures(),
      seed: seed,
      rngState: seed >>> 0,
      dimension: 1,
      starlight: 0,
      stars: emptyStars(),
      endings: [],
      seenEnding: false,
      guidance: { pin: null, seen: [] },
      homecomingCleared: false, visited: [], knownAudiences: [], helpersUsed: [], review: emptyReview(),
      coins: 0,
      gems: 0,
      keys: 0,
      tree: emptyTree(),
      vMax: 1,
      legacySlots: 0,
      venue: 1,
      crowd: VENUES[venueNumber("family")-1].crowd,
      j: 1,
      audId: "",
      audHp: 0,
      audHpMax: 1,
      atk: 1,
      interval: 4,
      mental: 0,
      mentalMax: 0,
      shield: 0,
      level: 0,
      xp: 0,
      combo: 0,
      doveMs: CONST.doveEvery,
      rabbitMs: CONST.rabbitEvery,
      flashBreaks: 0,
      comboMs: 0,
      maxCombo: 0,
      finisher: 0,
      finisherFired: false,
      fightMs: 0,
      tookMental: false,
      phase2: false,
      pattern: "none",
      slow: false,
      miss: 0,
      pHeal: false,
      sealCell: -1,
      sealMs: 0,
      sealCd: 0,
      patternHealMs: CONST.patternHealEvery,
      heckleMs: 4000,
      telegraphed: false,
      mode: "fight",
      transMs: 0,
      after: "fight",
      dealerQueued: false,
      winsSinceDealer: 0,
      wins: 0,
      fails: 0,
      buff: 0,
      removedCount: 0,
      tapAcc: 0,
      holding: false,
      resolved: false,
      board: [{ lv: 1, xp: 0, hp: 0, hpMax: 0, spawn: 0, sealed: false }],
      flights: [],
      bestiary: emptyBestiary(),
      trophies: {},
      invited: {},
      dealer: null
    };
    return state;
  }

  function newGame(seed) {
    if (typeof seed !== "number" || !isFinite(seed)) seed = 1;
    var state = fresh(seed >>> 0);
    recompute(state, true);
    state.mental = state.mentalMax;
    fillBox(state, state.board[0]);
    beginAudience(state, 1, 1, null);
    state.mode = "fight";
    return state;
  }

  function dealerSnap(d) {
    if (!d) return null;
    var cards = [];
    var i;
    for (i = 0; i < d.cards.length && i < 8; i++) {
      cards.push({ open: !!d.cards[i].open, dud: !!d.cards[i].dud, prize: d.cards[i].prize || "" });
    }
    var banned = [];
    for (i = 0; i < SYMBOLS.length; i++) if (d.banned && d.banned[SYMBOLS[i].id]) banned.push(SYMBOLS[i].id);
    return {
      phase: d.phase,
      cards: cards,
      risk: d.risk,
      banned: banned,
      grid: d.grid.slice(0, 9),
      spun: !!d.spun
    };
  }

  function featureSnap(features) {
    var f = JSON.parse(JSON.stringify(features));
    for (var key of ["elapsedMs", "goldMs", "helperMs", "encoreMs", "encoreLeft", "revealMs"]) f[key] = savedTimer(features[key], 1e12);
    f.workers.actors.forEach(function (a) { a.remainingMs = savedTimer(a.remainingMs, 300); a.cycleRemainingMs = savedTimer(a.cycleRemainingMs, 4000); });
    return f;
  }

  function serialize(state) {
    if (!state || typeof state !== "object") return "null";
    var bestiary = {};
    var i;
    for (i = 0; i < AUD_IDS.length; i++) {
      var rec = state.bestiary[AUD_IDS[i]] || { wins: 0, extra: false, removed: false };
      bestiary[AUD_IDS[i]] = { wins: rec.wins | 0, extra: !!rec.extra, removed: !!rec.removed };
    }
    bestiary["h-broadcast"] = state.bestiary["h-broadcast"] || { wins: 0, extra: false, removed: false };
    var board = [];
    for (i = 0; i < state.board.length && i < 32; i++) {
      var c = state.board[i];
      board.push({ lv: c.lv || 1, xp: c.xp || 0, hp: c.hp, hpMax: c.hpMax, spawn: savedTimer(c.spawn, 1e7), sealed: !!c.sealed, golden: !!c.golden, goldenBroken: !!c.goldenBroken });
    }
    var flights = [];
    for (i = 0; i < state.flights.length && i < CONST.flightCap; i++) {
      var f = state.flights[i];
      flights.push({ ms: savedTimer(f.ms, 1e7), kind: f.kind, amount: f.amount, rarity: f.rarity, cell: f.cell, audId: f.audId, itemId: f.itemId, name: f.name, emoji: f.emoji, effect: f.effect, legacy: !!f.legacy });
    }
    var tree = {};
    for (i = 0; i < TREE_KEYS.length; i++) tree[TREE_KEYS[i]] = state.tree[TREE_KEYS[i]];
    var stars = {};
    for (i = 0; i < STAR_KEYS.length; i++) stars[STAR_KEYS[i]] = state.stars[STAR_KEYS[i]] | 0;
    var obj = {
      v: 8,
      guidance: state.guidance,
      venueSlug: VENUES[state.venue-1].slug, maxVenueSlug:VENUES[state.vMax-1].slug,
      homecomingCleared:state.homecomingCleared, visited:state.visited.slice(), knownAudiences:state.knownAudiences.slice(), helpersUsed:state.helpersUsed.slice(), review:JSON.parse(JSON.stringify(state.review)),
      features: featureSnap(state.features),
      legacySlots: state.legacySlots || 0,
      seed: state.seed >>> 0,
      rngState: state.rngState >>> 0,
      dimension: state.dimension | 0,
      starlight: state.starlight,
      stars: stars,
      endings: state.endings.slice(0, CONST.loopCap),
      seenEnding: !!state.seenEnding,
      coins: state.coins,
      gems: state.gems | 0,
      keys: state.keys | 0,
      tree: tree,
      vMax: state.vMax | 0,
      venue: state.venue | 0,
      crowd: state.crowd,
      j: state.j | 0,
      audId: state.audId,
      audHp: state.audHp,
      audHpMax: state.audHpMax,
      atk: state.atk,
      interval: state.interval,
      mental: state.mental,
      mentalMax: state.mentalMax,
      shield: state.shield,
      level: state.level | 0,
      xp: state.xp,
      combo: state.combo | 0,
      doveMs: savedTimer(state.doveMs, 1e7),
      rabbitMs: savedTimer(state.rabbitMs, 1e7),
      flashBreaks: state.flashBreaks,
      comboMs: savedTimer(state.comboMs, 1e7),
      maxCombo: state.maxCombo | 0,
      finisher: state.finisher,
      finisherFired: !!state.finisherFired,
      fightMs: savedTimer(state.fightMs, 1e12),
      tookMental: !!state.tookMental,
      phase2: !!state.phase2,
      pattern: state.pattern,
      slow: !!state.slow,
      miss: state.miss,
      pHeal: !!state.pHeal,
      sealCell: state.sealCell | 0,
      sealMs: savedTimer(state.sealMs, 1e7),
      sealCd: savedTimer(state.sealCd, 1e7),
      patternHealMs: savedTimer(state.patternHealMs, 1e7),
      heckleMs: savedTimer(state.heckleMs, 1e7),
      telegraphed: !!state.telegraphed,
      mode: state.mode,
      transMs: savedTimer(state.transMs, 1e7),
      after: state.after,
      dealerQueued: !!state.dealerQueued,
      winsSinceDealer: state.winsSinceDealer | 0,
      wins: state.wins | 0,
      fails: state.fails | 0,
      buff: state.buff || 0,
      removedCount: countRemoved(state),
      tapAcc: savedTimer(state.tapAcc, 100),
      holding: !!state.holding,
      resolved: !!state.resolved,
      board: board,
      flights: flights,
      bestiary: bestiary,
      trophies: Object.assign({},state.trophies),
      invited: Object.assign({},state.invited),
      dealer: dealerSnap(state.dealer)
    };
    return JSON.stringify(obj);
  }

  function savedTimer(x, hi) {
    return typeof x === "number" && isFinite(x) ? Math.min(hi, Math.max(0, x)) : 0;
  }

  function loadTimer(x, hi) {
    var n = num(x, -CONST.substepMs, hi);
    return n == null ? null : Math.max(0, n);
  }

  function num(x, lo, hi) {
    if (typeof x !== "number" || !isFinite(x) || x < lo || x > hi) return null;
    return x;
  }

  function integer(x, lo, hi) {
    var n = num(x, lo, hi);
    return n != null && n === Math.floor(n) ? n : null;
  }

  function deserialize(str) {
    var savedVenues = VENUES;
    try {
      if (typeof str !== "string" || str.length > 2000000) return null;
      var o = JSON.parse(str);
      if (!o || typeof o !== "object" || Array.isArray(o)) return null;
      if (o.v !== 1 && o.v !== 2 && o.v !== 3 && o.v !== 4 && o.v !== 5 && o.v !== 6 && o.v !== 7 && o.v !== 8) return null;
      if (o.v === 7 && o.venueSlug === "lecturenote") {
        // Preserve the old index contract, then migrate by stable audience ID.
        var previousOrder = ["a-lecturenote-hecate", "a-lecturenote-jung", "h-lecturenote-kim"];
        if (previousOrder[o.j - 1] !== o.audId || o.crowd !== 3) return null;
        var home = VENUES.filter(function (v) { return v.slug === "lecturenote"; })[0];
        o.j = home.audiences.concat([home.headliner]).findIndex(function (a) { return a.id === o.audId; }) + 1;
        o.crowd = home.crowd;
      }
      if (o.v < 5) VENUES = OLD_VENUES;
      else if (o.v < 7) VENUES = U6_VENUES;
      var seed = integer(o.seed, 0, 4294967295);
      var rngState = integer(o.rngState, 0, 4294967295);
      var dimension = integer(o.dimension, 1, 999);
      var starlight = num(o.starlight, 0, 100000);
      var coins = num(o.coins, 0, 1e12);
      var gems = integer(o.gems, 0, 1e9);
      var keys = integer(o.keys, 0, 1e6);
      var vMax = integer(o.vMax, 1, VENUES.length);
      var venue = integer(o.venue, 1, VENUES.length);
      var j = venue == null ? null : integer(o.j, 1, headlinerJ(venue));
      var audHp = num(o.audHp, 0, 1e12);
      var audHpMax = num(o.audHpMax, 1, 1e12);
      var atk = num(o.atk, 0, 1e9);
      var interval = num(o.interval, 0.2, 60);
      var mental = num(o.mental, 0, 1e12);
      var mentalMax = num(o.mentalMax, 0, 1e12);
      var shield = num(o.shield, 0, 1e12);
      var level = integer(o.level, 0, 100000);
      var xp = num(o.xp, 0, 1e12);
      var combo = integer(o.combo, 0, 1e7);
      var comboMs = loadTimer(o.comboMs, 1e7);
      var maxCombo = integer(o.maxCombo, 0, 1e7);
      var finisher = num(o.finisher, 0, 1000);
      var fightMs = loadTimer(o.fightMs, 1e12);
      var miss = num(o.miss, 0, 1);
      var sealCell = integer(o.sealCell, -1, 31);
      var sealMs = loadTimer(o.sealMs, 1e7);
      var sealCd = loadTimer(o.sealCd, 1e7);
      var patternHealMs = loadTimer(o.patternHealMs, 1e7);
      var heckleMs = loadTimer(o.heckleMs, 1e7);
      var transMs = loadTimer(o.transMs, 1e7);
      var winsSinceDealer = integer(o.winsSinceDealer, 0, 1e6);
      var wins = integer(o.wins, 0, 1e7);
      var fails = integer(o.fails, 0, 1e7);
      var buff = num(o.buff, 0, 1000);
      var tapAcc = loadTimer(o.tapAcc, 100);
      if (seed == null || rngState == null || dimension == null || starlight == null || coins == null || gems == null || keys == null) return null;
      if (vMax == null || venue == null || j == null || audHp == null || audHpMax == null || atk == null || interval == null) return null;
      if (mental == null || mentalMax == null || shield == null || level == null || xp == null) return null;
      if (combo == null || comboMs == null || maxCombo == null || finisher == null || fightMs == null) return null;
      if (miss == null || sealCell == null || sealMs == null || sealCd == null || patternHealMs == null || heckleMs == null) return null;
      if (transMs == null || winsSinceDealer == null || wins == null || fails == null || buff == null || tapAcc == null) return null;
      if (o.mode !== "fight" && o.mode !== "transition" && o.mode !== "dealer" && o.mode !== "ending") return null;
      if (o.after !== "fight" && o.after !== "dealer" && o.after !== "ending" && o.after !== "continue" && o.after !== "stay" && o.after !== "legacyEnding") return null;
      var expectedAud = getAud(venue, j);
      var expectedPattern = j === headlinerJ(venue) ? (expectedAud.pattern || "none") : "none";
      if (o.audId !== expectedAud.id || o.pattern !== expectedPattern) return null;
      if (o.crowd != null && o.crowd !== VENUES[venue - 1].crowd) return null;
      if (!o.tree || !o.stars || !o.bestiary || !o.board || !o.flights || !o.trophies || !o.invited || !o.endings) return null;
      if (!Array.isArray(o.board) || !Array.isArray(o.flights) || (o.v < 7 && (!Array.isArray(o.trophies) || !Array.isArray(o.invited))) || !Array.isArray(o.endings)) return null;
      var state = fresh(seed);
      if (o.v >= 8) {
        var g = o.guidance;
        if (!g || (g.pin !== null && (typeof g.pin !== "string" || !NODE_BY_ID[g.pin])) || !Array.isArray(g.seen) || g.seen.length > 4 ||
            g.seen.some(function (id) { return ["range", "helper", "chain", "case"].indexOf(id) < 0; }) || new Set(g.seen).size !== g.seen.length) return null;
        state.guidance = { pin: g.pin, seen: g.seen.slice() };
      }
      state.rngState = rngState >>> 0;
      state.dimension = dimension;
      state.starlight = starlight;
      state.endings = [];
      var i;
      for (i = 0; i < o.endings.length && i < CONST.loopCap; i++) {
        var ed = integer(o.endings[i], 1, 999);
        if (ed == null) return null;
        state.endings.push(ed);
      }
      state.seenEnding = !!o.seenEnding;
      for (i = 0; i < STAR_KEYS.length; i++) {
        var sv = integer(o.stars[STAR_KEYS[i]], 0, 30);
        if (sv == null) return null;
        state.stars[STAR_KEYS[i]] = sv;
      }
      state.coins = coins;
      state.gems = gems;
      state.keys = keys;
      for (i = 0; i < TREE_KEYS.length; i++) {
        var key = TREE_KEYS[i];
        var max = key === "board" && o.v === 1 ? 7 : key === "area" && o.v < 5 ? 3 : NODE_BY_ID[key].max;
        var rawLevel = o.tree[key];
        if (o.v < 6 && NODE_BY_ID[key].u4a && rawLevel == null) rawLevel = 0;
        if (NODE_BY_ID[key].u4b && rawLevel == null && !(o.features && o.features.magic)) rawLevel = 0;
        if (o.v < 5 && (key === "assistant" || key.indexOf("p-") === 0) && rawLevel == null) rawLevel = 0;
        if (o.v < 3 && LEGACY_KEYS.indexOf(key) < 0 && rawLevel == null) rawLevel = key === "root" ? 1 : 0;
        var tv = integer(rawLevel, key === "root" ? 1 : 0, max);
        if (tv == null) return null;
        state.tree[key] = tv;
      }
      state.vMax = vMax;
      var cap;
      if (o.v === 1) {
        cap = CONST.legacyCaps[state.tree.board];
        state.tree.board = Math.min(CONST.boardNodeMax, cap - 1);
        state.legacySlots = Math.max(0, cap - (1 + state.tree.board + (vMax - 1)));
      } else {
        state.legacySlots = integer(o.legacySlots, 0, CONST.boardMax - 1);
        if (state.legacySlots == null) return null;
        cap = o.v < 7 ? Math.min(CONST.boardMax,1+state.tree.board+vMax-1+state.legacySlots) : boardCapacity(state);
      }
      if (o.board.length !== cap) return null;
      state.board = [];
      for (i = 0; i < o.board.length; i++) {
        var c = o.board[i];
        if (!c) return null;
        var hp = num(c.hp, 0, 1e9);
        var hpMax = num(c.hpMax, 0, 1e9);
        var spawn = loadTimer(c.spawn, 1e7);
        if (hp == null || hpMax == null || spawn == null || typeof c.sealed !== "boolean") return null;
        if (o.v >= 4 && (typeof c.golden !== "boolean" || typeof c.goldenBroken !== "boolean")) return null;
        if ((hp > 0 && hpMax === 0) || (hpMax > 0 && hp > hpMax * 1.01 + 1)) return null;
        var caseLv = o.v < 6 ? 1 : integer(c.lv,1,caseCap(state));
        var caseXp = o.v < 6 ? 0 : num(c.xp,0,caseNeed(caseLv || 1));
        if (caseLv == null || caseXp == null || caseXp >= caseNeed(caseLv) || (caseLv === caseCap(state) && caseXp !== 0)) return null;
        state.board.push({ lv: caseLv, xp: caseXp, hp: hp, hpMax: hpMax, spawn: spawn, sealed: c.sealed, golden: !!c.golden, goldenBroken: !!c.goldenBroken });
      }

      state.flights = [];
      if (o.flights.length > (o.v >= 6 ? CONST.flightCap : 32)) return null;
      for (i = 0; i < o.flights.length; i++) {
        var f = o.flights[i];
        var ms = loadTimer(f.ms, 1e7);
        var amount = num(f.amount, 0, 1e12);
        var cell = integer(f.cell, 0, 31);
        if (ms == null || amount == null || cell == null) return null;
        if (typeof f.kind !== "string" || typeof f.rarity !== "string" || typeof f.audId !== "string") return null;
        var flightTypes = o.v < 5 || f.legacy ? DATA.items.legacyTypes : DATA.items.types;
        var ft = flightTypes.filter(function (t) { return t.id === f.kind; })[0];
        var fri = CONST.rarityIds.indexOf(f.rarity);
        if (!ft || fri < 0 || (ft.minRarity != null && fri < ft.minRarity)) return null;
        var fp = ft.ladder.filter(function (p) { return p.id === f.itemId; })[0];
        var mapped = ft.rarityMap ? ft.rarityMap[fri] : fri;
        if (!fp && f.itemId == null && ft.id !== "lecture") fp = ft.ladder[mapped];
        if (!fp || (ft.id !== "lecture" && fp !== ft.ladder[mapped])) return null;
        f.legacy = o.v < 5 || !!f.legacy;
        f.itemId = fp.id; f.name = fp.name; f.emoji = fp.emoji; f.effect = fp.effect || ft.effect;
        state.flights.push({ ms: ms, kind: f.kind, amount: amount, rarity: f.rarity, cell: cell, audId: f.audId, itemId: f.itemId, name: f.name, emoji: f.emoji, effect: f.effect, legacy: !!f.legacy });
      }
      for (i = 0; i < AUD_IDS.length; i++) {
        var id = AUD_IDS[i];
        var rec = o.bestiary[id];
        if (!rec && o.v < 8 && id === "a-lecturenote-serona") continue;
        if (!rec && o.v < 7 && /^(a-meetup-|a-lecturenote-)/.test(id)) continue;
        if (!rec && o.v < 5 && /^a11[2-7]$/.test(id)) continue;
        if (!rec) return null;
        var wns = integer(rec.wins, 0, 100000);
        if (wns == null || typeof rec.extra !== "boolean" || typeof rec.removed !== "boolean") return null;
        state.bestiary[id] = { wins: wns, extra: rec.extra, removed: rec.removed };
      }
      if (o.v >= 5) {
        var mc = o.bestiary["h-broadcast"];
        if (!mc || integer(mc.wins, 0, 100000) == null || typeof mc.extra !== "boolean" || typeof mc.removed !== "boolean") return null;
        state.bestiary["h-broadcast"] = { wins: mc.wins, extra: mc.extra, removed: mc.removed };
      }
      if (o.v < 7) {
        if (o.trophies.length !== VENUES.length+1 || o.invited.length !== VENUES.length+1) return null;
        for(i=0;i<o.trophies.length;i++) {
          if([0,1].indexOf(o.trophies[i])<0 || [0,1].indexOf(o.invited[i])<0)return null;
          if(i) { if(o.trophies[i])state.trophies[VENUES[i-1].slug]=1; if(o.invited[i])state.invited[VENUES[i-1].slug]=1; }
        }
      } else {
        for(var ledger of ['trophies','invited']) {
          if(!o[ledger] || Array.isArray(o[ledger]) || Object.keys(o[ledger]).some(function(slug){return !venueNumber(slug)||o[ledger][slug]!==1;}))return null;
          state[ledger]=Object.assign({},o[ledger]);
        }
      }
      state.vMax = vMax;
      state.venue = venue;
      state.crowd = VENUES[venue - 1].crowd;
      state.j = j;
      state.audId = o.audId;
      state.audHp = audHp;
      state.audHpMax = audHpMax;
      state.atk = atk;
      state.interval = interval;
      state.mental = mental;
      state.mentalMax = mentalMax;
      state.shield = shield;
      state.level = level;
      state.xp = xp;
      state.combo = combo;
      state.doveMs = o.doveMs == null ? CONST.doveEvery : loadTimer(o.doveMs, 1e7);
      state.rabbitMs = o.rabbitMs == null ? CONST.rabbitEvery : loadTimer(o.rabbitMs, 1e7);
      state.flashBreaks = o.flashBreaks == null ? 0 : integer(o.flashBreaks, 0, CONST.flashEvery - 1);
      if (state.doveMs == null || state.rabbitMs == null || state.flashBreaks == null) return null;
      state.comboMs = comboMs;
      state.maxCombo = maxCombo;
      state.finisher = finisher;
      state.finisherFired = !!o.finisherFired;
      state.fightMs = fightMs;
      state.tookMental = !!o.tookMental;
      state.phase2 = !!o.phase2;
      state.pattern = o.pattern;
      state.slow = !!o.slow;
      state.miss = miss;
      state.pHeal = !!o.pHeal;
      state.sealCell = sealCell;
      state.sealMs = sealMs;
      state.sealCd = sealCd;
      state.patternHealMs = patternHealMs;
      state.heckleMs = heckleMs;
      state.telegraphed = !!o.telegraphed;
      state.mode = o.mode;
      state.transMs = transMs;
      state.after = o.after;
      state.dealerQueued = !!o.dealerQueued;
      state.winsSinceDealer = winsSinceDealer;
      state.wins = wins;
      state.fails = fails;
      state.buff = buff;
      state.tapAcc = tapAcc;
      state.holding = !!o.holding;
      state.resolved = !!o.resolved;
      state.removedCount = countRemoved(state);
      state.dealer = (function () {
        if (o.dealer == null) return null;
        if (!o.dealer || !Array.isArray(o.dealer.cards) || o.dealer.cards.length < 3 || o.dealer.cards.length > 5) return null;
        var cards = [];
        for (i = 0; i < o.dealer.cards.length; i++) {
          var cd = o.dealer.cards[i];
          if (!cd || typeof cd.open !== "boolean" || typeof cd.dud !== "boolean" || typeof cd.prize !== "string") return null;
          if (cd.dud ? cd.prize !== "" : !prizeById(cd.prize)) return null;
          cards.push({ open: cd.open, dud: cd.dud, prize: cd.prize });
        }
        if (!Array.isArray(o.dealer.grid) || o.dealer.grid.length !== 9) return null;
        if (!Array.isArray(o.dealer.banned)) return null;
        if (o.dealer.banned.length > SYMBOLS.length) return null;
        var banned = {};
        for (i = 0; i < o.dealer.banned.length && i < CONST.loopCap; i++) {
          if (!SYMBOLS.some(function (s) { return s.id === o.dealer.banned[i] && !s.good; })) return null;
          banned[o.dealer.banned[i]] = 1;
        }
        if (typeof o.dealer.spun !== "boolean") return null;
        var risk = num(o.dealer.risk, 0, 1);
        if (risk == null) return null;
        if (o.dealer.phase !== "card" && o.dealer.phase !== "card-done" && o.dealer.phase !== "slot") return null;
        var grid = [];
        for (i = 0; i < 9; i++) {
          if (typeof o.dealer.grid[i] !== "string") return null;
          if (o.dealer.grid[i] === "" ? !!o.dealer.spun : !SYMBOLS.some(function (s) { return s.id === o.dealer.grid[i]; })) return null;
          grid.push(o.dealer.grid[i]);
        }
        return { phase: o.dealer.phase, cards: cards, risk: risk, banned: banned, grid: grid, spun: !!o.dealer.spun };
      })();
      if (state.mode !== "dealer" || !state.dealer) {
        state.dealer = null;
        if (state.mode === "dealer" || o.dealer != null) {
          state.mode = "fight";
          state.after = "fight";
          state.dealerQueued = false;
          state.resolved = false;
          state.transMs = 0;
        }
      }
      if (o.v >= 4) {
        var f = o.features, defaults = emptyFeatures();
        if(o.v >= 6) {
          if(!f || !f.progress) return null;
          for(var pk of Object.keys(defaults.progress)) { var pv=num(f.progress[pk],0,1e15); if(pv==null)return null; defaults.progress[pk]=pv; }
        }
        if (!f || typeof f !== "object" || Array.isArray(f)) return null;
        for (var timer of ["elapsedMs", "goldMs", "helperMs", "encoreMs", "encoreLeft", "revealMs"]) {
          defaults[timer] = loadTimer(f[timer], 1e12); if (defaults[timer] == null) return null;
        }
        for (var counter of ["goldCell", "helperCursor", "boxes", "helperBreaks"]) {
          defaults[counter] = integer(f[counter], counter === "goldCell" ? -1 : 0, counter === "goldCell" || counter === "helperCursor" ? state.board.length - 1 : 1e9);
          if (defaults[counter] == null) return null;
        }
        for (var flag of ["goldPending", "dovePaused", "helperPaused"]) {
          if (typeof f[flag] !== "boolean") return null; defaults[flag] = f[flag];
        }
        var products = (o.v < 5 ? DATA.items.legacyTypes : DATA.items.types).flatMap(function (t) { return t.ladder.map(function (p) { return p.id; }); });
        var allowed = { collected: products, equipped: o.v < 5 ? DATA.items.legacyTypes.filter(function (t) { return t.id !== "lecture"; }).flatMap(function (t) { return t.ladder.map(function (p) { return p.id; }); }) : products.filter(itemType), achievements: ["boxes", "combo", "slots", "golden", "helper", "noDamage", "finale", "timed"], reveals: ["slot", "area", "dove", "rabbit", "boxHelper", "assistant", "equip"].concat(DATA.tree.filter(function(n){return n.hidden;}).map(function(n){return "hidden:"+n.id;})), revealQueue: ["slot", "area", "dove", "rabbit", "boxHelper", "assistant", "equip"].concat(DATA.tree.filter(function(n){return n.hidden;}).map(function(n){return "hidden:"+n.id;})) };
        for (var field in allowed) {
          if (!Array.isArray(f[field]) || new Set(f[field]).size !== f[field].length || !f[field].every(function (id) { return allowed[field].indexOf(id) >= 0; })) return null;
          defaults[field] = f[field].slice();
        }
        if (!defaults.revealQueue.every(function (id) { return defaults.reveals.indexOf(id) >= 0; })) return null;
        var loadItemType = o.v < 5 ? function (id) { return DATA.items.legacyTypes.find(function (t) { return t.id !== "lecture" && t.ladder.some(function (p) { return p.id === id; }); }); } : itemType;
        if ((defaults.equipped.length > equipSlots(state) || !defaults.equipped.every(function (id) { return defaults.collected.indexOf(id) >= 0 && defaults.equipped.filter(function (x) { return loadItemType(x) === loadItemType(id); }).length <= CONST.equipTypeLimit; }))) return null;
        if (!f.comboPaid || typeof f.comboPaid !== "object" || Array.isArray(f.comboPaid)) return null;
        for (var aid in f.comboPaid) {
          if (COMBO_AUD_IDS.indexOf(aid) < 0 || integer(f.comboPaid[aid], 0, 15) == null) return null;
          defaults.comboPaid[aid] = f.comboPaid[aid];
        }
        var goldCells = state.board.map(function (c, i) { return c.golden ? i : -1; }).filter(function (i) { return i >= 0; });
        if (goldCells.length > 1 || (goldCells.length ? goldCells[0] !== defaults.goldCell || defaults.goldPending || state.board[goldCells[0]].hp <= 0 : defaults.goldCell !== -1)) return null;
        if (o.v >= 5) {
          if (!Array.isArray(f.legacyProductCollection) || new Set(f.legacyProductCollection).size !== f.legacyProductCollection.length || !f.legacyProductCollection.every(function (id) { return DATA.tree.some(function (n) { return n.id === "p-" + id; }); })) return null;
          defaults.legacyProductCollection = f.legacyProductCollection.slice();
          var w = f.workers;
          if (!w || typeof w.fanPaused !== "boolean" || typeof w.assistantPaused !== "boolean" || integer(w.fanCursor, 0, state.board.length - 1) == null || integer(w.assistantCursor, 0, state.board.length - 1) == null || !Array.isArray(w.actors) || w.actors.length > 6 || new Set(w.actors.map(function (a) { return a.id; })).size !== w.actors.length) return null;
          defaults.workers = JSON.parse(JSON.stringify(w));
          for (var a of defaults.workers.actors) {
            if (!a || !/^(fan-[0-4]|assistant-0)$/.test(a.id) || a.role !== a.id.split("-")[0] || ["idle", "move", "work"].indexOf(a.phase) < 0 || integer(a.cell, -1, state.board.length - 1) == null || COMBO_AUD_IDS.indexOf(a.audId) < 0 || loadTimer(a.remainingMs, 300) == null || loadTimer(a.cycleRemainingMs, 4000) == null) return null;
            if ((a.role === "fan" && Number(a.id.split("-")[1]) >= fanCount(state)) || (a.role === "assistant" && !state.tree.assistant) || (a.phase === "idle" ? a.cell !== -1 : a.cell < 0 || a.audId !== state.audId)) return null;
            a.remainingMs = loadTimer(a.remainingMs, 300); a.cycleRemainingMs = loadTimer(a.cycleRemainingMs, 4000);
          }
          for (var role of ["manual", "fan", "assistant", "chain"]) {
            if (role === "chain" && o.v < 6) continue;
            if (!f.damage || num(f.damage[role], 0, 1e15) == null) return null;
            defaults.damage[role] = f.damage[role];
          }
        }
        if (f.magic != null) {
          var m=f.magic, cx=f.climax;
          if (!m || !cx || !Array.isArray(m.balls) || m.balls.length>3 || !Array.isArray(m.papers) || m.papers.length>2 || !Array.isArray(f.rewards) || new Set(f.rewards).size!==f.rewards.length || !f.rewards.every(function(n){return integer(n,1,6)!=null;}) || ['idle','place','done'].indexOf(f.guide)<0) return null;
          if (num(m.clock,0,1e12)==null || integer(m.cursor,0,1e12)==null || !m.timers || !m.paused || Object.values(m.timers).some(function(n){return num(n,0,9000)==null;}) || Object.values(m.paused).some(function(n){return typeof n!=='boolean';}))return null;
          for(var ball of m.balls)if(!ball || ['x','y'].some(function(k){return num(ball[k],0,608)==null;}) || ['vx','vy'].some(function(k){return num(ball[k],-1000,1000)==null;}) || !ball.last || Object.keys(ball.last).some(function(k){return integer(Number(k),0,state.board.length-1)==null||num(ball.last[k],0,m.clock)==null;}))return null;
          if(m.papers.some(function(p){return !p||integer(p.cell,0,state.board.length-1)==null;}) || typeof cx.paradeDone!=='boolean' || num(cx.left,0,30000)==null || num(cx.mirrorMs,0,15000)==null || num(cx.confidence,0,100)==null || integer(cx.milestone,0,1e6)==null || !Array.isArray(cx.mirrored) || cx.mirrored.length>2 || cx.mirrored.some(function(i){return integer(i,0,state.board.length-1)==null;}))return null;
          defaults.magic=JSON.parse(JSON.stringify(m));defaults.climax=JSON.parse(JSON.stringify(cx));defaults.rewards=f.rewards.slice();defaults.guide=f.guide;
          if(num(f.damage.magic,0,1e15)==null)return null;defaults.damage.magic=f.damage.magic;
        } else if(state.tree.equip) defaults.guide='done';
        state.features = defaults;
      } else {
        // Suppress historical first-unlock reveals; preserve only future discoveries.
        if (state.board.length > 1) state.features.reveals.push("slot");
        for (var rid of ["area", "dove", "rabbit", "boxHelper", "assistant", "equip"]) if (state.tree[rid]) state.features.reveals.push(rid);
        if (state.tree.equip) state.features.collected.forEach(function (id) { equipItem(state, id); });
      }
      if (o.v < 5) {
        // Validate with the original venue order before migrating any indices or capacity.
        state.tree.area = [0, 1, 3, 5][state.tree.area];
        if (state.venue >= 8) state.venue++;
        if (state.vMax >= 8) state.vMax++;
        if(state.vMax>=9)state.invited.broadcast=1;
        state.features.workers.fanPaused = state.features.helperPaused;
        var regularIds = DATA.items.types.flatMap(function (t) { return t.ladder.map(function (p) { return p.id; }); });
        var original = state.features.collected.slice();
        state.features.legacyProductCollection = original.filter(function (id) { return regularIds.indexOf(id) < 0; });
        state.features.collected = original.filter(function (id) { return regularIds.indexOf(id) >= 0; });
        var equipped = [];
        var retainedEquipment = state.features.equipped.filter(function (id) { return regularIds.indexOf(id) >= 0; });
        state.features.equipped.forEach(function (id) {
          var type = DATA.items.legacyTypes.find(function (t) { return t.ladder.some(function (p) { return p.id === id; }); });
          var replacement = regularIds.indexOf(id) >= 0 ? id : DATA.items.types.find(function (t) { return t.id === type.id; }).ladder.map(function (p) { return p.id; }).find(function (p) { return equipped.indexOf(p) < 0 && retainedEquipment.indexOf(p) < 0; });
          if (replacement && equipped.indexOf(replacement) < 0) { equipped.push(replacement); if (state.features.collected.indexOf(replacement) < 0) state.features.collected.push(replacement); }
        });
        state.features.equipped = equipped;
        VENUES = U6_VENUES; ensureBoard(state, true); syncWorkers(state);
      }
      if (o.v < 7) {
        var previousOrder = VENUES;
        var currentSlug = previousOrder[state.venue-1].slug, maxSlug = previousOrder[state.vMax-1].slug;
        state.visited = previousOrder.slice(0,state.vMax).map(function(v){return v.slug;});
        state.knownAudiences = Object.keys(state.bestiary).filter(function(id){return state.bestiary[id].wins > 0;});
        VENUES = ALL_VENUES;
        state.venue = venueNumber(currentSlug); state.vMax = venueNumber(maxSlug);
        // Preserve mirror state; the new final curtain call has not happened yet.
        state.features.climax.paradeDone = false; state.features.climax.left = 0;
        state.homecomingCleared = false;
        if (state.mode==='transition' && state.after==='ending' && currentSlug==='multiverse')state.after='legacyEnding';
      } else {
        if (o.venueSlug !== VENUES[venue-1].slug || o.maxVenueSlug !== VENUES[vMax-1].slug) return null;
        if (typeof o.homecomingCleared !== 'boolean' || !Array.isArray(o.visited) || !Array.isArray(o.knownAudiences) || !Array.isArray(o.helpersUsed)) return null;
        if (new Set(o.visited).size !== o.visited.length || o.visited.some(function(slug){return !venueNumber(slug);}) || o.knownAudiences.some(function(id){return COMBO_AUD_IDS.indexOf(id)<0;}) || o.helpersUsed.some(function(id){return ['fan','assistant','dove','rabbit','flash','sponge','cardthrow','tipbox','flashpaper','crystal','water','spotlight'].indexOf(id)<0;})) return null;
        var r=o.review;
        if (!r || integer(r.act,1,3)==null || integer(r.cycle,0,1e9)==null || integer(r.target,-1,state.board.length-1)==null || num(r.elapsed,0,18000)==null || num(r.bonusMs,0,4000)==null || integer(r.pairs,0,3)==null || integer(r.lastCell,-1,state.board.length-1)==null || typeof r.lastSource!=='string' || typeof r.cancel!=='boolean' || typeof r.finaleReady!=='boolean' || typeof r.finaleUsed!=='boolean' || num(r.actMs,0,1e12)==null) return null;
        state.review=JSON.parse(JSON.stringify(r)); state.visited=o.visited.slice(); state.knownAudiences=o.knownAudiences.slice(); state.helpersUsed=o.helpersUsed.slice(); state.homecomingCleared=o.homecomingCleared;
      }
      if (audHp > audHpMax * 1.05 + 1) return null;
      recompute(state, true);
      if (state.mental > state.mentalMax * 1.05 + 1) state.mental = state.mentalMax;
      if (state.shield > state.mentalMax) state.shield = state.mentalMax * nodeEffects(state).shieldRatio;
      return state;
    } catch (err) {
      return null;
    } finally { VENUES = savedVenues; }
  }

  globalThis.Core = {
    CONST: CONST,
    hasReward: hasReward, helperSpeed: helperSpeed, tapPaper: tapPaper, skipCurtainCall: skipCurtainCall,
    venueNumber:venueNumber, reached:reached, bossProfile:profile, recap:recap, stayHome:stayHome, continueStory:continueStory,
    fanCount: fanCount, productMultiplier: productMultiplier,
    newGame: newGame,
    step: step,
    equipItem: equipItem, unequipItem: unequipItem, equipSlots: equipSlots, toggleHelper: toggleHelper, nextComboGoal: nextComboGoal, wandDamage: wandDamage,
    wandRate: wandRate,
    wandArea: wandArea,
    boardLayout: boardLayout,
    cellPosition: cellPosition,
    caseCap: caseCap, caseNeed: caseNeed, caseTier: caseTier, caseItems: caseItems, gateProgress: gateProgress, buyMany: buyMany,
    buyNode: buyNode,
    nodeInfo: nodeInfo,
    nodeEffects: nodeEffects,
    nodeCost: nodeCost,
    retreat: retreat,
    restartRun: restartRun,
    dealerCardPick: dealerCardPick,
    dealerSlotSpin: dealerSlotSpin,
    dealerForce: dealerForce,
    forceCost: forceCost,
    dealerClose: dealerClose,
    rebirth: rebirth,
    serialize: serialize,
    deserialize: deserialize,
    starCost: starCost,
    buyStar: buyStar
  };
})();
