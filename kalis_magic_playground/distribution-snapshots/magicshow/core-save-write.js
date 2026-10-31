'use strict';
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
      var sf = { ms: savedTimer(f.ms, 1e7), kind: f.kind, amount: f.amount, rarity: f.rarity, cell: f.cell, audId: f.audId, itemId: f.itemId, name: f.name, emoji: f.emoji, effect: f.effect, legacy: !!f.legacy };
      if (f.xpFactor > 1) sf.xpFactor = f.xpFactor;
      flights.push(sf);
    }
    var tree = {};
    for (i = 0; i < TREE_KEYS.length; i++) tree[TREE_KEYS[i]] = state.tree[TREE_KEYS[i]];
    var stars = {};
    for (i = 0; i < STAR_KEYS.length; i++) stars[STAR_KEYS[i]] = state.stars[STAR_KEYS[i]] | 0;
    var obj = {
      v: 23,
      batchD: state.batchD,
      u15: state.u15,
      u14: state.u14,
      idle: state.idle, skills: state.skills, u17: state.u17, u18: state.u18, u19: state.u19, u19b: state.u19b,
      onboarding: state.onboarding, learning: state.learning,
      guidance: { seen: state.guidance.seen },
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

  function isNewerSave(raw) {
    try { var o=JSON.parse(raw); return !!o && typeof o.v==='number' && isFinite(o.v) && o.v>23; }
    catch (error) { return false; }
  }

  // v4 U45: one-time test-season reset (owner, update of 2026-10-13 21:30), run on boot before the save store reads anything.
  // When magicShowBuster.epoch is missing or below CONST.saveEpoch: the main save and every store backup the game could restore
  // (magicShowBuster.v3, .backup.*, .keep.*) are copied into magicShowBuster.preReset.<epoch> (never read by the game; manual recovery
  // only) and removed, then the epoch is written. Settings (.presentation, .sound, .music) and save slots (magicShowBuster.slot.*) stay.
  // A device with no save only gets the epoch key. With the epoch at CONST.saveEpoch nothing happens, so progress is kept from then on.
  function applySaveEpoch(storage) {
    var main=SAVE_KEYS.main, epochKey=SAVE_KEYS.epoch, seen=Number(storage.getItem(epochKey))||0, drop=[], copy={}, i, k;
    if (seen >= CONST.saveEpoch) return {reset:false};
    for (i = 0; i < storage.length; i++) { k = storage.key(i); if (k === main || (k && (k.indexOf(main + '.backup.') === 0 || k.indexOf(main + '.keep.') === 0))) drop.push(k); }
    if (drop.length) {
      drop.forEach(function (key) { copy[key] = storage.getItem(key); });
      var target = SAVE_KEYS.preResetPrefix + CONST.saveEpoch, copied = false;
      try { storage.setItem(target, JSON.stringify({epoch:CONST.saveEpoch, keys:copy})); copied = true; } catch (error) { /* full: keep at least the main save below */ }
      drop.forEach(function (key) { if (key !== main) storage.removeItem(key); });
      if (!copied && copy[main] != null) { try { var only = {}; only[main] = copy[main]; storage.setItem(target, JSON.stringify({epoch:CONST.saveEpoch, keys:only})); } catch (error) { /* nothing more can be kept */ } }
      storage.removeItem(main);
    }
    storage.setItem(epochKey, String(CONST.saveEpoch));
    return {reset:drop.length > 0};
  }
  function createSaveStore(storage, now) {
    var key=SAVE_KEYS.main, prefix=SAVE_KEYS.backupPrefix, autoKey=prefix+'auto', keepPrefix=SAVE_KEYS.keepPrefix, KEEP_MAX=8, blocked=false, noAuto=false, lastRaw=null;
    now=now || Date.now;
    function stamped(pre) {
      var result=[];
      for(var i=0;i<storage.length;i++) { var k=storage.key(i); if(k && k.indexOf(pre)===0 && /^\d+$/.test(k.slice(pre.length)))result.push(k); }
      return result.sort(function(a,b){return Number(b.slice(pre.length))-Number(a.slice(pre.length));});
    }
    function keys() { return stamped(prefix); }
    // Protected copies (unreadable, repaired or about to be overwritten by a less progressed save) are never touched by the 3-backup rotation.
    function keepKeys() { return stamped(keepPrefix); }
    function readable(raw) { return raw===null?{state:null,repairs:[]}:deserializeRepair(raw); }
    function backup(raw, protect, keep) {
      if(raw===null)return false;
      var all=keys(), kept=keepKeys();
      // Never store the same raw string twice.
      if(all.concat(kept).some(function(k){return storage.getItem(k)===raw;}))return false;
      var pre=keep?keepPrefix:prefix, mine=keep?kept:all;
      var stamp=Math.max(now(),mine[0]?Number(mine[0].slice(pre.length))+1:0);
      while(storage.getItem(pre+stamp)!==null)stamp++;
      storage.setItem(pre+stamp,raw);
      if(keep)keepKeys().slice(KEEP_MAX).forEach(function(k){storage.removeItem(k);});
      else keys().slice(3).forEach(function(k){if(k!==protect)storage.removeItem(k);});
      return true;
    }
    function rank(item) { return [item.dimension|0,item.stage|0,typeof item.coins==='number'&&isFinite(item.coins)?item.coins:0,Number(item.date)||0]; }
    function better(a,b) { for(var i=0;i<a.length;i++) { if(a[i]!==b[i])return a[i]>b[i]; } return false; }
    // Same ranking as the ?restore=1 page: dimension, stage, coins, then date.
    function bestBackup() {
      return list().filter(function(item){return item.restorable;}).reduce(function(top,item){return !top||better(rank(item),rank(top))?item:top;},null);
    }
    function load() {
      var raw=storage.getItem(key), newer=raw!==null && isNewerSave(raw);
      blocked=blocked || newer;
      var result=readable(raw), state=result?result.state:null, repairs=result?result.repairs:[], backedUp=false, recovered=false, giftEnded=false;
      if(raw!==null && !state && !newer) {
        // Unreadable main save: keep the raw protected, then load the most progressed restorable backup instead of a new game.
        backup(raw,null,true); backedUp=true;
        var best=bestBackup();
        if(best) {
          var bestRaw=storage.getItem(best.key), got=readable(bestRaw);
          if(got && got.state) { state=got.state; repairs=got.repairs; storage.setItem(key,bestRaw); raw=bestRaw; recovered=true; }
        }
        if(!recovered)noAuto=true;
      } else if(state && repairs.length) backup(raw,null,true);
      if(state) { lastRaw=raw; try { giftEnded=JSON.parse(raw).growth5x===true; } catch (error) { giftEnded=false; } }
      return {state:state,newer:newer,backedUp:backedUp,recovered:recovered,repairs:repairs,giftEnded:giftEnded};
    }
    function write(raw) {
      if(blocked)return {saved:false,newer:true};
      var old=storage.getItem(key);
      if(old!==null && isNewerSave(old)) { blocked=true;return {saved:false,newer:true}; }
      var backedUp=false;
      // Our own previous write needs no re-check; anything else (another tab, an older page) is checked before it can be replaced.
      if(old!==null && old!==lastRaw) {
        var was=readable(old);
        if(!was || !was.state) {
          // An unsuccessful backup throws before any replacement can happen.
          backedUp=backup(old,null,true);
          noAuto=true;
        } else {
          var nowState=null;
          try { nowState=JSON.parse(raw); } catch (error) { nowState=null; }
          var a=progress(was.state), b=nowState?[nowState.dimension|0,nowState.vMax|0]:[0,0];
          if(a[0]>b[0] || (a[0]===b[0] && a[1]>b[1]))backedUp=backup(old,null,true);
        }
      }
      storage.setItem(key,raw);
      lastRaw=raw;
      return {saved:true,backedUp:backedUp};
    }
    function progress(s) { return s?[s.dimension|0,s.vMax|0]:null; }
    function rollingBackup() {
      if(blocked || noAuto)return false;
      var raw=storage.getItem(key);
      if(raw===null || isNewerSave(raw))return false;
      var cur=readable(raw).state;
      if(!cur)return false;
      var oldRaw=storage.getItem(autoKey), old=oldRaw===null?null:readable(oldRaw).state;
      if(old) {
        var a=progress(cur), b=progress(old);
        if(a[0]<b[0] || (a[0]===b[0] && a[1]<b[1]))return false;
      }
      storage.setItem(autoKey,raw);
      return true;
    }
    function list() {
      var all=keys().concat(keepKeys()), auto=storage.getItem(autoKey);
      if(auto!==null)all.unshift(autoKey);
      return all.map(function(k){
        var raw=storage.getItem(k), state=readable(raw).state;
        var pre=k.indexOf(keepPrefix)===0?keepPrefix:prefix;
        return {key:k,date:k===autoKey?(state && state.idle.wallMs || null):Number(k.slice(pre.length)),stage:state?state.vMax:null,dimension:state?state.dimension:null,coins:state?state.coins:null,restorable:!!state,protectedCopy:pre===keepPrefix};
      });
    }
    function restore(k, confirmed) {
      if(confirmed!==true || (k!==autoKey && keys().indexOf(k)<0 && keepKeys().indexOf(k)<0))return false;
      var raw=storage.getItem(k);
      if(raw===null || !readable(raw).state)return false;
      // Preserve the displaced save, including a forward save, before explicit restore.
      backup(storage.getItem(key),k,true);
      storage.setItem(key,raw);
      blocked=isNewerSave(raw);
      return true;
    }
    function suppressAuto() { noAuto=true; }
    return {load:load,write:write,backup:backup,rollingBackup:rollingBackup,list:list,restore:restore,suppressAuto:suppressAuto};
  }

