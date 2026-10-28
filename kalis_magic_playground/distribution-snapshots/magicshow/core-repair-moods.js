'use strict';
  // ---- v4 U37 faces. Pure functions of the current state (plus the previous answer for hysteresis); the UI re-evaluates them every frame, so no face
  // can latch: each one leaves as soon as its condition does. Short event faces live in the UI and expire by clock.
  // Kali is flustered when 자신감 is gone after taking a hit or 멘탈 is under 35 percent, and calm again once 멘탈 is back to 50 percent and
  // 자신감 is up (or no hit has landed in this fight). A fresh fight starts calm: 자신감 is 0 at every start, so 0 alone would never smile.
  function kaliMood(state, prev) {
    var ratio = state.mentalMax > 0 ? state.mental / state.mentalMax : 1;
    var shaken = !(state.shield > 0) && !!state.tookMental;
    if (prev === 'flustered') return ratio >= 0.5 && !shaken ? 'normal' : 'flustered';
    return shaken || ratio < 0.35 ? 'flustered' : 'normal';
  }
  // Audience face from the doubt bar: serious while doubt is high, plain in the middle, happy as doubt runs low and on a win. heckle (the
  // mood of the line being telegraphed) and surprised (a short flash after a critical or the finisher) are passed in by the caller while they last.
  function audienceMood(state, prev, opts) {
    opts = opts || {};
    if (state.resolved || state.mode === 'transition' && state.audHp <= 0) return 'happy';
    if (opts.heckle) return opts.heckle;
    if (opts.surprised) return 'surprised';
    var a = getAud(state.venue, state.j), ratio = state.audHpMax > 0 ? state.audHp / state.audHpMax : 1;
    if (a && (a.role === 'supporter' || a.role === 'helper')) return 'happy';
    if (prev === 'happy') return ratio < 0.38 ? 'happy' : 'doubt';
    if (prev === 'serious') return ratio > 0.55 ? 'serious' : 'doubt';
    return ratio < 0.3 ? 'happy' : ratio > 0.65 ? 'serious' : 'doubt';
  }

  // ---- v4 U37 save safety: repair instead of reject. The strict validators above stay the definition of a valid save; this layer only
  // reshapes a parsed save so they accept it, and records every change. It never touches a save the strict path already accepts.
  var SAVE_SCALARS = [
    ['seed','int',0,4294967295],['rngState','int',0,4294967295],['dimension','int',1,999],['starlight','num',0,100000],
    ['coins','num',0,1e18],['gems','int',0,1e9],['keys','int',0,1e6],['audHp','num',0,1e24],['audHpMax','num',1,1e24],
    ['atk','num',0,1e9],['interval','num',0.2,60],['mental','num',0,1e12],['mentalMax','num',0,1e12],['shield','num',0,1e12],
    ['level','int',0,100000],['xp','num',0,1e12],['combo','int',0,1e7],['maxCombo','int',0,1e7],['finisher','num',0,1000],['miss','num',0,1],
    ['sealCell','int',-1,31],['winsSinceDealer','int',0,1e6],['wins','int',0,1e7],['fails','int',0,1e7],['buff','num',0,1000],
    ['comboMs','num',0,1e7],['fightMs','num',0,1e12],['sealMs','num',0,1e7],['sealCd','num',0,1e7],['patternHealMs','num',0,1e7],
    ['heckleMs','num',0,1e7],['transMs','num',0,1e7],['tapAcc','num',0,100],
    ['u15.gloves','int',0,100000],['u15.gloveLeft','num',0,CONST.gloveLeftMax],
    ['u17.feverGauge','num',0,100],['u17.feverPending','num',0,100],['u17.gemWait','num',0,90000],
    ['u19b.dealerVisits','int',0,1000000],['idle.autoAcc','num',0,100],['idle.cursor','int',0,1e12],['idle.wallMs','num',0,1e16],
    ['skills.showtimeLeft','num',0,20000],
    ['features.boxes','int',0,1e9],['features.helperBreaks','int',0,1e9],
    ['features.progress.comboMax','num',0,1e24],['features.progress.dealerFlips','num',0,1e24],['features.progress.coinsEarned','num',0,1e24],['features.progress.goldenOpened','num',0,1e24],
    ['features.progress.runBoxes','num',0,1e24],
    ['features.progress.finales','num',0,1e24],
    ['features.progress.fevers','num',0,1e24],
    ['features.progress.crits','num',0,1e24],
    ['features.progress.cupsWins','num',0,1e24],
    ['features.progress.monteWins','num',0,1e24],
    ['features.progress.montePerfects','num',0,1e24],
    ['features.progress.mentalClutches','num',0,1e24],
    ['features.progress.bossLossVenue','num',0,1e24],
    ['features.progress.bossLossStreak','num',0,1e24],
    ['features.progress.tapStreak','num',0,1e24],
    ['features.progress.tapStreakMax','num',0,1e24],
    ['features.damage.manual','num',0,1e27],['features.damage.fan','num',0,1e27],['features.damage.assistant','num',0,1e27],['features.damage.chain','num',0,1e27],['features.damage.magic','num',0,1e27]
  ];
  function pathGet(o, path) { var p = path.split('.'), x = o; for (var i = 0; i < p.length; i++) { if (!x || typeof x !== 'object') return undefined; x = x[p[i]]; } return x; }
  function pathSet(o, path, v) {
    var p = path.split('.'), x = o;
    for (var i = 0; i < p.length - 1; i++) { if (!x[p[i]] || typeof x[p[i]] !== 'object') return false; x = x[p[i]]; }
    if (v === undefined) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = v;
    return true;
  }
  function clampValue(v, kind, lo, hi) {
    if (typeof v !== 'number' || v !== v) return lo;
    v = Math.min(hi, Math.max(lo, v));
    return kind === 'int' ? Math.floor(v) : v;
  }
  function clampSave(o, rep) {
    function fix(holder, key, kind, lo, hi, label) {
      if (!holder || typeof holder !== 'object' || !(key in holder)) return;
      var nv = clampValue(holder[key], kind, lo, hi);
      if (nv !== holder[key]) { holder[key] = nv; rep.push(label); }
    }
    SAVE_SCALARS.forEach(function (s) {
      var p = s[0].split('.'), key = p.pop(), holder = p.length ? pathGet(o, p.join('.')) : o;
      if (!p.length && holder && !(key in holder)) { holder[key] = s[2]; rep.push(s[0]); return; }
      fix(holder, key, s[1], s[2], s[3], s[0]);
    });
    fix(o, 'doveMs', 'num', 0, 1e7, 'doveMs'); fix(o, 'rabbitMs', 'num', 0, 1e7, 'rabbitMs'); fix(o, 'flashBreaks', 'int', 0, CONST.flashEvery - 1, 'flashBreaks');
    if (o.v >= 2) { if (typeof o.legacySlots === 'undefined') { o.legacySlots = 0; rep.push('legacySlots'); } else fix(o, 'legacySlots', 'int', 0, CONST.boardMax - 1, 'legacySlots'); }
    // Keyed ledgers: drop unknown venue keys, clamp every count.
    function ledger(holder, label, fields) {
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)) return;
      Object.keys(holder).forEach(function (k) {
        if (!venueNumber(k)) { delete holder[k]; rep.push(label + ' key ' + k); return; }
        if (fields) { if (!holder[k] || typeof holder[k] !== 'object') { holder[k] = { boxes: 0, count: 0 }; rep.push(label + ' ' + k); return; } fields.forEach(function (f) { fix(holder[k], f[0], 'int', f[1], f[2], label + '.' + f[0]); }); }
        else fix(holder, k, 'int', 0, 100000, label);
      });
    }
    if (o.u15) ledger(o.u15.drops, 'drops', [['boxes', 0, 1e9], ['count', 0, 100000]]);
    if (o.u17) ledger(o.u17.gloveBuys, 'gloveBuys', null);
    if (o.bestiary && typeof o.bestiary === 'object') Object.keys(o.bestiary).forEach(function (id) { fix(o.bestiary[id], 'wins', 'int', 0, 100000, 'bestiary wins'); });
    if (o.stars && typeof o.stars === 'object') Object.keys(o.stars).forEach(function (id) { fix(o.stars, id, 'int', 0, 30, 'stars'); });
    if (o.v >= 7 && o.tree && typeof o.tree === 'object') TREE_KEYS.forEach(function (id) {
      var n = NODE_BY_ID[id];
      if (n && id in o.tree && o.tree[id] != null) fix(o.tree, id, 'int', id === 'root' ? 1 : 0, treeMax(id), 'tree');
    });
    if (o.features && o.features.comboPaid && typeof o.features.comboPaid === 'object') Object.keys(o.features.comboPaid).forEach(function (id) {
      if (COMBO_AUD_IDS.indexOf(id) < 0) { delete o.features.comboPaid[id]; rep.push('comboPaid key'); } else fix(o.features.comboPaid, id, 'int', 0, 15, 'comboPaid');
    });
    // v4 U45: a flight with an invalid xpFactor (the strict loader rejects it) loads with the factor dropped (landing factor 1), recorded once per flight.
    if (Array.isArray(o.flights)) o.flights.forEach(function (f) { if (f && typeof f === 'object' && 'xpFactor' in f && (typeof f.xpFactor !== 'number' || !isFinite(f.xpFactor) || f.xpFactor < 1 || f.xpFactor > 1e6)) { delete f.xpFactor; rep.push('flight xpFactor'); } });
    if (Array.isArray(o.endings)) { var ne = o.endings.slice(0, CONST.loopCap).map(function (e) { return clampValue(e, 'int', 1, 999); }); if (JSON.stringify(ne) !== JSON.stringify(o.endings)) { o.endings = ne; rep.push('endings'); } }
    if (typeof o.mode !== 'string' || ['fight', 'transition', 'dealer', 'ending'].indexOf(o.mode) < 0) { o.mode = 'fight'; rep.push('mode'); }
    if (['fight', 'dealer', 'ending', 'continue', 'stay', 'legacyEnding'].indexOf(o.after) < 0) { o.after = 'fight'; rep.push('after'); }
    if (o.v >= 7) {
      // Venue identity is derived: the stage numbers are clamped, everything that must agree with them is recomputed.
      fix(o, 'vMax', 'int', 1, VENUES.length, 'vMax'); fix(o, 'venue', 'int', 1, VENUES.length, 'venue');
      if (o.venue > o.vMax) { o.venue = o.vMax; rep.push('venue'); }
      fix(o, 'j', 'int', 1, headlinerJ(o.venue), 'j');
      var aud = getAud(o.venue, o.j), pat = o.j === headlinerJ(o.venue) ? (aud.pattern || 'none') : 'none';
      [['audId', aud.id], ['pattern', pat], ['crowd', VENUES[o.venue - 1].crowd], ['venueSlug', VENUES[o.venue - 1].slug], ['maxVenueSlug', VENUES[o.vMax - 1].slug]].forEach(function (p) {
        if (o[p[0]] !== p[1]) { o[p[0]] = p[1]; rep.push(p[0]); }
      });
      if (Array.isArray(o.board) && o.tree && typeof o.tree === 'object') {
        var cap = Math.min(CONST.boardMax, 1 + (o.tree.board | 0) + DATA.slotRewardSlugs.filter(function (slug) { return venueNumber(slug) <= o.vMax; }).length + (o.legacySlots | 0));
        var capLv = 5 + (o.tree.caseMax | 0);
        var blank = function () { return { lv: 1, xp: 0, hp: 0, hpMax: 0, spawn: 0, sealed: false, golden: false, goldenBroken: false }; };
        var before = JSON.stringify(o.board);
        var nb = o.board.slice(0, cap).map(function (c) {
          if (!c || typeof c !== 'object') return blank();
          c.hpMax = clampValue(c.hpMax, 'num', 0, 1e9); c.hp = clampValue(c.hp, 'num', 0, c.hpMax); c.spawn = clampValue(c.spawn, 'num', 0, 1e7);
          c.lv = clampValue(c.lv, 'int', 1, capLv); if (c.lv === 0) c.lv = 1;
          c.xp = clampValue(c.xp, 'num', 0, Math.ceil(3 * Math.pow(1.35, c.lv - 1)) - 1); if (c.lv === capLv) c.xp = 0;
          c.sealed = c.sealed === true; c.golden = c.golden === true; c.goldenBroken = c.goldenBroken === true;
          return c;
        });
        while (nb.length < cap) nb.push(blank());
        var gold = nb.map(function (c, i) { return c.golden ? i : -1; }).filter(function (i) { return i >= 0; });
        var f = o.features;
        if (f && typeof f === 'object' && (gold.length > 1 || (gold.length ? gold[0] !== f.goldCell || f.goldPending === true || nb[gold[0]].hp <= 0 : f.goldCell !== -1))) {
          nb.forEach(function (c) { c.golden = false; }); f.goldCell = -1; f.goldPending = false; rep.push('golden case');
        }
        if (JSON.stringify(nb) !== before) { o.board = nb; if (rep.indexOf('board') < 0) rep.push('board'); }
      }
    }
  }

  // Ordered finest-first so the smallest broken piece is the one reset to its default.
  var SAVE_UNITS = ['u15.drops', 'u15.seen', 'u15.queue', 'u15.scene', 'u15.bios', 'u15.positions', 'u15.tutorial', 'u15.deckOn', 'u15',
    'u17.gloveBuys', 'u17', 'u19b.gates', 'u19b.failedId', 'u19b.dealerOffer', 'u19b', 'u19',
    'u18.pads', 'u18.anchor', 'u18.challenge', 'u18.owned', 'u18.equipped', 'u18.sets', 'u18.fans', 'u18.paid', 'u18',
    'idle.reward', 'idle.milestones', 'idle.next', 'idle', 'skills.cooldowns', 'skills',
    'u14.daily', 'u14.visitor', 'u14.sets', 'u14.satisfied', 'u14',
    'guidance', 'onboarding', 'learning', 'review', 'visited', 'knownAudiences', 'helpersUsed', 'trophies', 'invited',
    'features.magic', 'features.climax', 'features.rewards', 'features.guide', 'features.workers', 'features.comboPaid', 'features.equipped', 'features.collected',
    'features.achievements', 'features.reveals', 'features.revealQueue', 'features.legacyProductCollection', 'features.progress', 'features.damage', 'features',
    'flights', 'dealer'];

  // Returns {state, repairs}. state is null only when the save cannot be reshaped at all (not JSON, not an object, unknown version).
  function deserializeRepair(str) {
    var mig = migrateHotelSave(str), result = deserializeRepairBase(mig.str); // hotel stage: renumber a pre-hotel save first (migrateHotelSave)
    afterHotelMigration(result.state, mig);
    resumeHelpers(result.state);
    // v4 U38: the refund of the removed endless nodes is part of the U37 repair list as 'refund:<coins>'.
    if (result.state && result.state._refundCoins > 0) result.repairs.push('refund:' + result.state._refundCoins);
    // v4 U44: the 30 keys paid for the folded-in key node deckMaster.
    if (result.state && result.state._refundKeys > 0) result.repairs.push('refundKeys:' + result.state._refundKeys);
    return result;
  }
  function deserializeRepairBase(str) {
    var strict = deserialize(str);
    if (strict) return { state: strict, repairs: [] };
    var o;
    try {
      if (typeof str !== 'string' || str.length > 2000000) return { state: null, repairs: [] };
      o = JSON.parse(str);
    } catch (error) { return { state: null, repairs: [] }; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.v !== 'number' || o.v < 1 || o.v !== Math.floor(o.v)) return { state: null, repairs: [] };
    if (o.v > 23) o.v = 23;
    var rep = [];
    var attempt = function (obj) { return deserialize(JSON.stringify(obj)); };
    try {
      // Story edits can shorten a scene without changing the save schema. Recover
      // only known pre-edit offsets; unrelated invalid values still use normal repair.
      var legacySceneLengths={theater:{afterClear:20},moon:{opening:6,beforeHeadliner:9},multiverse:{opening:6,afterClear:4},cafe:{beforeHeadliner:7},broadway:{afterClear:4},
        family:{beforeHeadliner:6},audition:{afterClear:5},broadcast:{afterClear:4},vegas:{afterClear:5},sun:{afterClear:5},galaxy:{beforeHeadliner:6,afterClear:5},
        lecturenote:{opening:6,afterClear:5},future:{afterClear:5}};
      legacySceneLengths.audition={beforeHeadliner:6,afterClear:5}; // hotel stage (10-26): the TV 오디션 scenes were rewritten (before the headliner 6 -> 5 lines) // s5a: the cafe hat line moved to afterClear; s5t: the broadway 삭제 line was removed; v6 script (10-26): the old length of every scene the revised script shortened (the 비법 lines left the afterClear scenes)
      var scene=o.u15&&o.u15.scene,pack=scene&&DATA.storyV15.venues[scene.slug];
      var sceneLines=pack&&pack[scene.kind],oldLength=scene&&legacySceneLengths[scene.slug]&&legacySceneLengths[scene.slug][scene.kind];
      if(sceneLines&&Number.isInteger(scene.line)&&scene.line>=sceneLines.length&&scene.line<oldLength){
        scene.line=sceneLines.length-1;rep.push('resume revised story scene');
      }
      // v6 script (10-26): the NDD after-win lines lost the 비법 line (5 -> 4); a save on that last line resumes on the new last line.
      var tut=o.u15&&o.u15.tutorial,defeatLines=DATA.storyV15.tutorial.defeat.length;
      if(tut&&tut.active&&tut.phase==='defeat'&&Number.isInteger(tut.line)&&tut.line>=defeatLines&&tut.line<5){tut.line=defeatLines-1;rep.push('resume revised tutorial lines');}
      clampSave(o, rep);
      var s = attempt(o);
      if (s) return { state: s, repairs: rep };
      var def = JSON.parse(serialize(newGame(clampValue(o.seed, 'int', 0, 4294967295))));
      def.u15.tutorial = { done: true, active: false, won: false, baseline: null };
      def.onboarding = { intro: true, panel: 0, step: 8, facts: [] };
      def.u18.anchor = null;
      var applied = [], found = null;
      for (var i = 0; i < SAVE_UNITS.length && !found; i++) {
        var path = SAVE_UNITS[i], was = JSON.parse(JSON.stringify(pathGet(o, path) === undefined ? null : pathGet(o, path)));
        var had = pathGet(o, path) !== undefined;
        var dv = path === 'idle.next' ? undefined : pathGet(def, path);
        if (had === false && dv === undefined) continue;
        if (!pathSet(o, path, dv === undefined ? undefined : JSON.parse(JSON.stringify(dv)))) continue;
        applied.push({ path: path, was: had ? was : undefined, def: dv });
        found = attempt(o);
      }
      if (!found) return { state: null, repairs: rep };
      // Give back every default that was not needed (coarse first), keeping only what is required for the save to load.
      for (var k = applied.length - 1; k >= 0; k--) {
        var a = applied[k], cur = pathGet(o, a.path), snapshot = cur === undefined ? undefined : JSON.parse(JSON.stringify(cur));
        if (!pathSet(o, a.path, a.was === undefined ? undefined : JSON.parse(JSON.stringify(a.was)))) continue;
        if (attempt(o)) { applied.splice(k, 1); continue; }
        pathSet(o, a.path, snapshot);
      }
      applied.forEach(function (a) { rep.push('reset ' + a.path); });
      found = attempt(o);
      return found ? { state: found, repairs: rep } : { state: null, repairs: rep };
    } catch (error) { return { state: null, repairs: rep }; }
  }

