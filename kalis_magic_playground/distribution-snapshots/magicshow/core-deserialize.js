'use strict';
  function savedTimer(x, hi) {
    return typeof x === "number" && isFinite(x) ? Math.min(hi, Math.max(0, x)) : 0;
  }

  // v4 U38: the removed "끝없는 비법" nodes cost ceil(20000 * 1.5^level) coins for level 0, 1, 2 ...; the refund is exactly what was paid.
  var INFINITE_BRANCHES = ['hand', 'box', 'heart', 'luck', 'pet', 'finale', 'collection', 'star'];
  function infiniteRefund(tree) {
    var sum = 0;
    if (!tree || typeof tree !== 'object') return 0;
    INFINITE_BRANCHES.forEach(function (b) {
      var level = integer(tree['infinite-' + b], 1, 1e9);
      if (level == null) return;
      for (var l = 0; l < level && l < 120 && sum < 1e12; l++) sum += Math.ceil(20000 * Math.pow(1.5, l));
    });
    return Math.min(sum, 1e12);
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
      // Forward saves may share our known schema. Never persist this projection.
      if (isNewerSave(str)) o.v = 23;
      if (o.v !== 23 && o.v !== 22 && o.v !== 21 && o.v !== 20 && o.v !== 19 && o.v !== 18 && o.v !== 17 && o.v !== 16 && o.v !== 1&&o.v !== 2 && o.v !== 3 && o.v !== 4 && o.v !== 5 && o.v !== 6 && o.v !== 7 && o.v !== 8 && o.v !== 9 && o.v !== 10 && o.v !== 11 && o.v !== 12 && o.v !== 13 && o.v !== 14 && o.v !== 15) return null;
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
      var coins = num(o.coins, 0, 1e18);  // v4 U45: 1e18 (was 1e12): a maxed late build with 12 hours away reaches about 3e12 legitimately
      var gems = integer(o.gems, 0, 1e9);
      var keys = integer(o.keys, 0, 1e6);
      var vMax = integer(o.vMax, 1, VENUES.length);
      var venue = integer(o.venue, 1, VENUES.length);
      var j = venue == null ? null : integer(o.j, 1, headlinerJ(venue));
      // v4 U44: 1e16 (was 1e12): the venue doubt scales with the attack of the 칼리 products, the last venues reach several 1e12.
      // v4 U45: 1e24 (was 1e16): a gate sized to a maxed build reaches about 7e18 at the lecturenote.
      var audHp = num(o.audHp, 0, 1e24);
      var audHpMax = num(o.audHpMax, 1, 1e24);
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
      if(o.u19b){
        var b=o.u19b;
        if(!b.gates||typeof b.gates!=='object'||Array.isArray(b.gates)||typeof b.dealerOffer!=='boolean'||integer(b.dealerVisits,0,1000000)==null||typeof b.failedId!=='string'||b.failedId!==''&&COMBO_AUD_IDS.indexOf(b.failedId)<0)return null;
        var gateIds=Object.keys(b.gates);
        if(gateIds.length>COMBO_AUD_IDS.length||gateIds.some(function(id){var g=b.gates[id];return COMBO_AUD_IDS.indexOf(id)<0||!g||integer(g.prepared,0,1000000)==null||g.need!==undefined&&integer(g.need,1,30)==null||g.fails!==undefined&&integer(g.fails,0,3)==null||typeof g.cleared!=='boolean'||typeof g.studied!=='boolean';}))return null;
        state.u19b=JSON.parse(JSON.stringify(b));
      }
      if(o.u19){if(!validU19(o.u19))return null;state.u19=JSON.parse(JSON.stringify(o.u19));}
      if(o.v>=12){
        if(!validU15(o.u15))return null;
        state.u15=JSON.parse(JSON.stringify(o.u15));if(state.u15.deckOn===undefined)state.u15.deckOn=false;
      }else state.u15.tutorial.done=true;
      if (o.v >= 8) {
        var g = o.guidance;
        if (!g || !Array.isArray(g.seen) || g.seen.length > 5 ||
            g.seen.some(function (id) { return ["range", "helper", "chain", "case", "equipButton"].indexOf(id) < 0; }) || new Set(g.seen).size !== g.seen.length) return null;
        state.guidance = { seen: g.seen.slice() };
      }
      if (o.v >= 9) {
        var intro = o.onboarding, learning = o.learning;
        if (!intro || typeof intro.intro !== "boolean" || integer(intro.panel,0,4)==null || integer(intro.step,0,8)==null || !Array.isArray(intro.facts) || intro.facts.length>8 || new Set(intro.facts).size!==intro.facts.length || intro.facts.some(function (id) { return TUTORIAL_ACTIONS.indexOf(id)<0; })) return null;
        if (!learning || typeof learning.on!=="boolean" || num(learning.ms,0,3000)==null) return null;
        state.onboarding = {intro:intro.intro,panel:intro.panel,step:intro.step,facts:intro.facts.slice()};
        state.learning = {on:learning.on,ms:learning.ms};
      } else state.onboarding = {intro:true,panel:0,step:8,facts:[]};
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
        var max = key === "board" && o.v === 1 ? 7 : key === "area" && o.v < 5 ? 3 : treeMax(key); // v4 U48 C: the stored total of a split node
        var rawLevel = o.tree[key];
        if (NODE_BY_ID[key].u31 && rawLevel == null) rawLevel = 0;
        if (o.v < 20 && NODE_BY_ID[key].routine && rawLevel == null) rawLevel = 0; // v4 U48 N4: routine 비법 are new in version 20
        // v21 migration: pre-expansion saves lack these five nodes. Preserve learned levels; default only absent nodes.
        // The original eight routine keys stay required in v20 saves.
        if (o.v < 21 && rawLevel == null && NODE_BY_ID[key].routine && ['eggbag','rubberband','coloringbook','cube','wand'].indexOf(NODE_BY_ID[key].routine) >= 0) rawLevel = 0;
        if (o.v < 10 && NODE_BY_ID[key].u13 && rawLevel == null) rawLevel = 0;
        if (o.v < 9 && NODE_BY_ID[key].u12 && rawLevel == null) rawLevel = 0;
        if (o.v < 6 && NODE_BY_ID[key].u4a && rawLevel == null) rawLevel = 0;
        if (NODE_BY_ID[key].u4b && rawLevel == null && !(o.features && o.features.magic)) rawLevel = 0;
        if (o.v < 5 && (key === "assistant" || key.indexOf("p-") === 0) && rawLevel == null) rawLevel = 0;
        if (o.v < 3 && LEGACY_KEYS.indexOf(key) < 0 && rawLevel == null) rawLevel = key === "root" ? 1 : 0;
        var tv = integer(rawLevel, key === "root" ? 1 : 0, max);
        if (tv == null) return null;
        state.tree[key] = tv;
      }
      // v4 U38: refund the removed endless nodes. Applied only to saves older than version 16, so a re-saved game is never refunded twice.
      if (o.v < 16) {
        var refund = Math.min(infiniteRefund(o.tree), 1e18 - state.coins);
        if (refund > 0) { state.coins += refund; state._refundCoins = refund; }
      }
      // v4 U44: the key node deckMaster is folded into the 칼리 덱 skill (p-kali-deck). An older save that owned it gets the skill (deckOn is kept)
      // and its 30 keys back; saves from version 18 on never carry the node, so nobody is paid twice.
      if (o.v < 18 && o.tree && o.tree.deckMaster === 1) {
        state.tree["p-kali-deck"] = 1;
        var keysBack = Math.max(0, Math.min(30, 1e6 - state.keys));
        state.keys += keysBack; state._refundKeys = 30;
      }
      // v4 U48 A: the 칼리 덱 node no longer gives a permanent on/off skill. A save below version 20 that owns it keeps the node (which now
      // unlocks the deck consumable) and gets 3 decks once; version 20 saves never pass here again.
      if (o.v < 20 && state.tree["p-kali-deck"] === 1) { state.u15.gloves = Math.min(100000, state.u15.gloves + 3); state._deckGift = 3; }
      // v4 U48 N4: a routine the old save had already unlocked (u19.routines) becomes its learned routine 비법 (no refund, nothing to pay).
      if (o.v < 20 && state.u19 && Array.isArray(state.u19.routines)) state.u19.routines.forEach(function (rid) { if (NODE_BY_ID['routine-' + rid]) state.tree['routine-' + rid] = 1; });
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
        var amount = num(f.amount, 0, 1e24);
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
        var lf = { ms: ms, kind: f.kind, amount: amount, rarity: f.rarity, cell: cell, audId: f.audId, itemId: f.itemId, name: f.name, emoji: f.emoji, effect: f.effect, legacy: !!f.legacy };
        var xf = f.xpFactor === undefined ? null : num(f.xpFactor, 1, 1e6);
        if (f.xpFactor !== undefined && xf == null) return null;  // v4 U45: an explicit invalid factor is rejected (repair drops it and records it)
        if (xf > 1) lf.xpFactor = xf;
        state.flights.push(lf);
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
        // v21 migration: old minigames had no gem reward. Never replay a paid result or invent a pending reward.
        if(o.v < 21 && o.dealer.games) ['cups','monte'].forEach(function(id) {
          var game = o.dealer.games[id];
          if(game && game.gems === undefined) game.gems = 0;
        });
        if(o.v>=13 && !validDealerGames(o.dealer.games))return null;
        return { phase: o.dealer.phase, cards: cards, risk: risk, banned: banned, grid: grid, spun: !!o.dealer.spun, games:o.v>=13 ? JSON.parse(JSON.stringify(o.dealer.games)) : {cups:null,monte:null} };
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
          for(var pk of Object.keys(defaults.progress)) { var pv=num(o.v < 21 && f.progress[pk]===undefined && ["runBoxes", "finales", "fevers", "crits", "cupsWins", "monteWins", "montePerfects", "mentalClutches", "bossLossVenue", "bossLossStreak", "tapStreak", "tapStreakMax"].indexOf(pk)>=0 ? 0 : f.progress[pk],0,1e24); if(pv==null)return null; defaults.progress[pk]=pv; }
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
        var allowed = { collected: products, equipped: o.v < 5 ? DATA.items.legacyTypes.filter(function (t) { return t.id !== "lecture"; }).flatMap(function (t) { return t.ladder.map(function (p) { return p.id; }); }) : products.filter(itemType), achievements: DATA.achievements.map(function(a){return a.id;}), reveals: ["slot", "area", "dove", "rabbit", "boxHelper", "assistant", "equip"].concat(DATA.tree.filter(function(n){return n.hidden;}).map(function(n){return "hidden:"+n.id;})), revealQueue: ["slot", "area", "dove", "rabbit", "boxHelper", "assistant", "equip"].concat(DATA.tree.filter(function(n){return n.hidden;}).map(function(n){return "hidden:"+n.id;})) };
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
            if (!f.damage || num(f.damage[role], 0, 1e27) == null) return null;
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
          if(num(f.damage.magic,0,1e27)==null)return null;defaults.damage.magic=f.damage.magic;
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
        if (!r || integer(r.act,1,3)==null || integer(r.cycle,0,1e9)==null || integer(r.target,-1,state.board.length-1)==null || num(r.elapsed,0,18000)==null || num(r.bonusMs,0,4000)==null || integer(r.pairs,0,3)==null || integer(r.lastCell,-1,state.board.length-1)==null || typeof r.lastSource!=='string' || typeof r.cancel!=='boolean' || typeof r.finaleReady!=='boolean' || typeof r.finaleUsed!=='boolean' || num(r.actMs,0,1e12)==null || (r.lastHeckle!==undefined && integer(r.lastHeckle,0,2)==null)) return null;
        state.review=JSON.parse(JSON.stringify(r)); if (state.review.lastHeckle===undefined) state.review.lastHeckle=0; state.visited=o.visited.slice(); state.knownAudiences=o.knownAudiences.slice(); state.helpersUsed=o.helpersUsed.slice(); state.homecomingCleared=o.homecomingCleared;
      }
      if (o.v >= 10) {
        var idle=o.idle, skills=o.skills;
        if (!idle || num(idle.wallMs,0,1e16)==null || num(idle.autoAcc,0,100)==null || integer(idle.cursor,0,1e12)==null || typeof idle.autoAdvance!=='boolean' || typeof idle.waiting!=='boolean' || !Array.isArray(idle.milestones) || idle.milestones.some(function(id){return !NODE_BY_ID[id]||!NODE_BY_ID[id].statMilestone;}) || idle.milestones.length>10000) return null;
        if (idle.reward!==null) { var r=idle.reward; if(!r||num(r.awayMs,60000,43200000)==null||num(r.coins,0,1e18)==null||integer(r.levels,0,1225)==null||typeof r.doubled!=='boolean'||(r.totalAwayMs!==undefined&&num(r.totalAwayMs,r.awayMs,1e16)==null))return null; }
        if (!skills || num(skills.showtimeLeft,0,20000)==null || typeof skills.cheerGuard!=='boolean' || !skills.cooldowns || DATA.skills.some(function(k){return num(skills.cooldowns[k.id],0,k.cooldown)==null;})) return null;
        state.idle=JSON.parse(JSON.stringify(idle)); state.idle.autoAdvance=false;
        if(idle.next&&(integer(idle.next.v,1,VENUES.length)==null||integer(idle.next.j,1,headlinerJ(idle.next.v))==null))return null;
        state.skills=JSON.parse(JSON.stringify(skills));
      }
      if(o.v>=11){
        var u=o.u14,v=u&&u.visitor,d=u&&u.daily;
        if(!u||integer(u.outfit,1,3)==null||typeof u.haptics!=='boolean'||typeof u.collection!=='boolean'||!Array.isArray(u.satisfied)||!Array.isArray(u.sets)||new Set(u.satisfied).size!==u.satisfied.length||new Set(u.sets).size!==u.sets.length||u.satisfied.some(function(id){return COMBO_AUD_IDS.indexOf(id)<0;})||u.sets.some(function(slug){return !venueNumber(slug);}))return null;
        if(!v||num(v.wait,0,150000)==null||num(v.left,0,8000)==null||num(v.buff,0,30000)==null||integer(v.serial,0,1e12)==null||num(v.incomeMs,0,3000)==null||num(v.incomeCoins,0,1e24)==null||num(v.incomeRate,0,1e18)==null||['rabbit','fan'].indexOf(v.kind)<0)return null;
        if(!d||typeof d.date!=='string'||typeof d.latest!=='string'||(d.date&&dateOrdinal(d.date)===null)||(d.latest&&dateOrdinal(d.latest)===null)||integer(d.streak,0,1e12)==null||!d.records||Array.isArray(d.records)||typeof d.records!=='object'||Object.keys(d.records).length>10000)return null;
        for(var date of Object.keys(d.records)){
          var r=d.records[date],selection=dailySelection(date);
          if(dateOrdinal(date)===null||!r||!r.progress||typeof r.progress!=='object'||Array.isArray(r.progress)||!Array.isArray(r.claimed)||new Set(r.claimed).size!==r.claimed.length||r.claimed.some(function(id){return selection.indexOf(id)<0;})||typeof r.bonus!=='boolean'||integer(r.streakReward,0,10)==null)return null;
          if(Object.keys(r.progress).some(function(id){return !DATA.missions.some(function(m){return m.id===id;})||num(r.progress[id],0,1e12)==null;}))return null;
          if(r.claimed.some(function(id){return (r.progress[id]||0)<DATA.missions.find(function(m){return m.id===id;}).target;})||r.bonus!==(r.claimed.length===3)||(r.streakReward>0&&!r.claimed.length))return null;
        }
        if((d.date&&!d.records[d.date])||(d.latest&&!d.records[d.latest])||(!d.latest&&d.streak)||(d.latest&&(!d.streak||!d.records[d.latest].claimed.length)))return null;
        // v4 U45 (save version 19): 클래식 콜렉션 리마스터 2편 is a new product. A save below 19 that completed the old collection owns 1편 only,
        // so its collection bonus waits until 2편 is learned (checkSets sets it again).
        if(o.v<19&&u.collection&&!state.tree['p-classic-collection-remastered-2'])u=Object.assign({},u,{collection:false});
        if(u.collection&&!DATA.tree.filter(function(n){return n.productMultiplier;}).every(function(n){return state.tree[n.id]>0;}))return null;
        state.u14=JSON.parse(JSON.stringify(u));
        if(state.u14.sets.some(function(slug){var p=venueSetProgress(state,slug);return p.current!==p.total;}))return null;
      }else{
        state.u14.outfit=(state.trophies.moon||state.endings.length||state.knownAudiences.indexOf(DATA.venues[venueNumber('moon')-1].headliner.id)>=0)?3:(state.trophies.audition||state.knownAudiences.indexOf(DATA.venues[venueNumber('audition')-1].headliner.id)>=0)?2:1;
        state.u14.satisfied=Object.keys(state.bestiary).filter(function(id){return state.bestiary[id].wins>0;});
        DATA.venues.forEach(function(v){if(state.trophies[v.slug]&&state.u14.satisfied.indexOf(v.headliner.id)<0)state.u14.satisfied.push(v.headliner.id);});
        checkSets(state,null);
      }
      if(o.v>=13){if(!validU17(o.u17))return null;state.u17=JSON.parse(JSON.stringify(o.u17));}
      else state.features.encoreLeft=0;
      if(o.v>=14){if(o.v<23&&o.u18)o.u18.pads=emptyPads();if(!validU18(o.u18,state))return null;state.u18=JSON.parse(JSON.stringify(o.u18));}
      else {checkTrueFanReveal(state,null);unlockCosmetics(state);}
      // Shop routines used to be purchasable in the tree. Preserve both ownership representations.
      DATA.routines.forEach(function(r){var id='routine-'+r.id;if(!r.shopCost)return;if(state.tree[id]&&state.u19.routines.indexOf(r.id)<0)state.u19.routines.push(r.id);if(state.u19.routines.indexOf(r.id)>=0)state.tree[id]=Math.max(1,state.tree[id]||0);});
      if (audHp > audHpMax * 1.05 + 1) return null;
      recompute(state, true);
      if (state.mental > state.mentalMax * 1.05 + 1) state.mental = state.mentalMax;
      if (state.shield > state.mentalMax) state.shield = state.mentalMax * nodeEffects(state).shieldRatio;
      // v4 U41: a gate saved before version 17 has no 'need'. It gets the levels still reachable now plus what was learned since it was first met,
      // never more than the old 30, so nobody is asked for more than before. A failure here keeps the old rule (30).
      var oldGates = Object.keys(state.u19b.gates).filter(function (id) { return !state.u19b.gates[id].need; });
      if (oldGates.length) {
        var left = CONST.gatePrep;
        try { left = reachableLevelsLeft(state); } catch (err2) { left = CONST.gatePrep; }
        oldGates.forEach(function (id) { var g = state.u19b.gates[id]; g.need = Math.max(1, Math.min(CONST.gatePrep, left + Math.max(0, preparation(state) - g.prepared))); });
      }
      if(o.v>=22){if(!validBatchD(o.batchD))return null;if(o.batchD.twist.scene&&(!o.batchD.twist.complete||o.batchD.twist.scene!=='complete')&&(VENUES[state.venue-1].slug!=='meetup'||state.j!==headlinerJ(state.venue)||state.mode!=='fight'))return null;state.batchD=JSON.parse(JSON.stringify(o.batchD));}
      else if(state.trophies.multiverse||state.homecomingCleared||state.endings.length){state.batchD.multiverseCleared=true;state.batchD.twist={failures:3,trace:true,complete:true,scene:'',left:0,hiddenUsed:true,traceUsed:true};state.tree['p-trace']=Math.max(1,state.tree['p-trace']||0);}
      recompute(state,false);
      return state;
    } catch (err) {
      return null;
    } finally { VENUES = savedVenues; }
  }


