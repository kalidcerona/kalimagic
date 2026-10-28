'use strict';
  function headlinerJ(v) {
    return VENUES[v - 1].audiences.length + 1;
  }

  function preparation(state) { return state._preparedLevel || 0; }
  function gateAudience(state) {
    if(state.venue===1 || VENUES[state.venue-1].slug==='future' || state.u15.tutorial.active || state.u18.anchor || ["homecoming","future"].indexOf(profile(state))>=0)return false;
    var v=state.venue;
    return state.j===headlinerJ(v) || v>=3 && state.j===Math.ceil(VENUES[v-1].audiences.length/2);
  }
  // v4 U41: the node levels still to learn at this position: every coin node that nothing but the wallet blocks (revealed, prerequisites,
  // venue and area needs, progress gates), bought one level at a time on a copy with an unlimited purse until nothing changes. Key and starlight nodes
  // are not counted: they cannot be bought with the coins a retrying player earns.
  function copyPlain(x) {
    if (x === null || typeof x !== 'object') return x;
    if (Array.isArray(x)) return x.map(copyPlain);
    var o = {};
    Object.keys(x).forEach(function (k) { o[k] = copyPlain(x[k]); });
    return o;
  }
  function reachableLevelsLeft(state) {
    var c = copyPlain(state), total = 0, changed = true, guard = 0;
    c.coins = 1e30;
    while (changed && guard++ < 500) {
      changed = false;
      DATA.tree.forEach(function (n) {
        if (n.starKey || n.pending || n.currency !== 'coins') return;
        while (nodeInfo(c, n.id).purchasable && buyNode(c, n.id)) { total++; changed = true; }
      });
    }
    return total;
  }
  // The preparation a gate asks for is 30 node levels, or all the levels that can still be learned when there are fewer than 30 (at least 1),
  // so a player who has learned everything reachable can always remove the pressure.
  function gateNeed(state) { return Math.max(1, Math.min(CONST.gatePrep, reachableLevelsLeft(state))); }
  function gatePressure(state) {
    if(!gateAudience(state))return 0;
    var g=state.u19b.gates[state.audId];
    // v4 U41: each failed show at this gate also lowers the pressure by a third (g.fails, at most 3), so a player who has nothing left to buy
    // with the coins on hand still gets through after three tries.
    return g&&!g.cleared&&!g.studied?Math.max(0,1-(preparation(state)-g.prepared)/(g.need||CONST.gatePrep)-(g.fails||0)/CONST.gateFailSteps):0;
  }
  function failureLessons(state) {
    var ids=['mental','attack','power','speed','calm','shieldCap','boxHeal'];
    var lessons=ids.map(function(id){return NODE_BY_ID[activePart(state,id)];}).filter(function(n){return n&&nodeInfo(state,n.id).purchasable;});
    var id=state.u19b.failedId,g=state.u19b.gates[id];
    if(!lessons.length){
      // v4 U41: nothing in the usual seven can be bought now, so offer the best node of the whole book that can be (still the player's choice).
      var rest=bookLesson(state);
      if(rest)lessons.push(rest);
    }
    // v4 U44: the 칼리 product of this venue is one more option while it is unbought, discovered and payable (still only a suggestion).
    var prod=failureProduct(state);
    if(prod&&nodeInfo(state,prod.id).purchasable)lessons.unshift(prod);
    if(g&&!g.cleared&&!g.studied&&state.coins>=failureLessonCost(state,id))lessons.unshift({id:'gate:'+id,name:'야유 받아넘기기'});
    return lessons.slice(0,3);
  }
  // v4 U44: the product that belongs to the venue the player stands in, while it is discovered and not yet bought (payable or not).
  function failureProduct(state){
    var fid=state.u19b.failedId,fv=fid&&VENUES.find(function(v){return v.audiences.concat([v.headliner]).some(function(a){return a.id===fid;});})||VENUES[state.venue-1];
    var slug=fv&&fv.slug,n=DATA.tree.find(function(p){var origin=VENUES[venueNumber(p.venueSlug)-1];return p.wall&&(p.venueSlug===slug||origin&&origin.mergedInto===slug)&&!(state.tree[p.id]>0);});
    if(!n)return null;
    var info=nodeInfo(state,n.id);
    return info.revealed&&info.level<1?n:null;
  }
  // v4 U41: the order a node of the whole book is offered in after a failure: what makes a fight easier first (stage nerves, damage, helpers),
  // then the coin and collection nodes, then anything else, cheapest first. Only nodes the wallet can pay for now are candidates.
  var BOOK_LESSON_ORDER = ['shieldValue','healValue','winHeal','levelHeal','openingShield','critPower','critRate','comboHold','sweepFocus','precision','area','caseXp','caseStart','chainPower','chain4','chain8','caseMax','fanPower','helperTempo','colleaguePower','colleagueMore','colleagueTempo','spongePower','cardthrowPower','flashpaperPower','crystalPower','waterPower','spotlightPower','dovePower','doveTempo','rabbitTempo','finalePower','encorePower','comboValue','boxShield','boxXP','prepared','spawn','coinLuck','tip','jackpot','goldCoins'];
  function bookLesson(state) {
    var best=null,bestRank=1e9,bestCost=Infinity;
    DATA.tree.forEach(function(n){
      if(n.starKey||n.pending||n.id==='root')return;
      var info=nodeInfo(state,n.id);
      if(!info.purchasable||!info.revealed)return;
      var rank=BOOK_LESSON_ORDER.indexOf(baseNode(n).id);if(rank<0)rank=BOOK_LESSON_ORDER.length;
      if(rank<bestRank||rank===bestRank&&info.cost<bestCost){best=n;bestRank=rank;bestCost=info.cost;}
    });
    return best;
  }
  // v4 U41: one friendly line when the fail panel has nothing to buy (or the gate lesson cannot be paid): the nearest block and the real way to grow.
  // cause is the way the run ended ('mental', 'damage', 'gate', 'stall', 'lastHeckle'). Returns '' when there is nothing true to say.
  function failureHint(state, cause) {
    if(cause==='lastHeckle')return '야유 막기 스킬을 마지막 야유 알림이 뜬 뒤에 눌러 보세요. 한 번 막아 줘요';
    if(cause==='gate'){
      var gid=state.u19b.failedId,gr=state.u19b.gates[gid];
      if(gr&&!gr.cleared&&!gr.studied&&state.coins<failureLessonCost(state,gid))return '동전 '+formatNumber(Math.ceil(failureLessonCost(state,gid)-state.coins))+' 더 모으면 야유 받아넘기기를 배울 수 있어요';
      return '';
    }
    if(failureLessons(state).some(function(n){return n.id.indexOf('gate:')!==0;}))return '';
    // The nearest wallet block: the fight nodes of the usual seven first, then everything else, the smallest shortfall first.
    var fight=['mental','attack','power','speed','calm','shieldCap','boxHeal'],near=null,nearKey=null;
    DATA.tree.forEach(function(n){
      if(n.starKey||n.pending||n.currency!=='coins')return;
      var info=nodeInfo(state,n.id);
      if(!info.revealed||info.cost==null||!/ 부족$/.test(info.blockedReason||''))return;
      var key=[fight.indexOf(n.id)>=0?0:1,info.cost-state.coins];
      if(!nearKey||key[0]<nearKey[0]||key[0]===nearKey[0]&&key[1]<nearKey[1]){near=n;nearKey=key;}
    });
    if(near)return '동전 '+formatNumber(Math.ceil(nearKey[1]))+' 더 모으면 '+near.name+' 비법을 올릴 수 있어요';
    // Cases gain levels by being opened, so retrying is real growth while any case is below the cap.
    if(state.board.some(function(c){return (c.lv||1)<caseCap(state);}))return '케이스 레벨을 올리면 더 세져요. 다시 열어 볼까요?';
    var stuck=null;
    fight.forEach(function(id){if(stuck)return;var info=nodeInfo(state,id);if(info.revealed&&info.level<info.max&&info.blockedReason)stuck={name:NODE_BY_ID[id].name,reason:info.blockedReason};});
    return stuck?stuck.name+' 비법은 '+stuck.reason+' 뒤에 올릴 수 있어요':'';
  }
  function failureLessonCost(state,id) {var v=VENUES.find(function(v){return v.audiences.concat([v.headliner]).some(function(a){return a.id===id;});});return v?v.id*25:Infinity;}
  function failureLessonInfo(state,id) {return id.indexOf('gate:')===0?{currency:'coins',cost:failureLessonCost(state,id.slice(5))}:{currency:nodeInfo(state,id).currency,cost:nodeCost(state,id)};}
  function learnFailureLesson(state,id) {
    if(id.indexOf('gate:')!==0)return buyNode(state,id);
    var aud=id.slice(5),g=state.u19b.gates[aud],cost=failureLessonCost(state,aud);
    if(!g||g.studied||g.cleared||state.u19b.failedId!==aud||state.coins<cost)return false;
    state.coins-=cost;g.studied=true;return true;
  }
  function failureDealerAvailable(state) {return !!state.u19b.dealerOffer&&state.gems>=2&&state.mode==='fight'&&!state.resolved&&!state.idle.next;}
  function openFailureDealer(state) {
    if(!failureDealerAvailable(state)||state.mode==='dealer')return false;
    state.u19b.dealerOffer=false;setupDealer(state);state.mode='dealer';return true;
  }
  function audStats(v, j) {
    var C = CONST;
    var n = headlinerJ(v) - 1;
    // Benched slots are skipped, so the first regular in the rotation keeps the easiest anchor (v5 first-win fix).
    var p = j, m = n, k;
    for (k = 1; k <= n; k++) if (isBenched(v, k)) { m--; if (k < j) p--; }
    // Stretch the original three regular anchors; headliners retain the fourth.
    var idx = j > n ? 3 : 2 * (p - 1) / Math.max(1, m - 1);
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

  // A benched regular stays in the roster for old saves, but the main rotation skips that slot.
  function isBenched(v, j) {
    if (j === headlinerJ(v)) return false;
    var a = getAud(v, j);
    return !!(a && a.bench);
  }

  function firstFightJ(v) {
    var j;
    for (j = 1; j < headlinerJ(v); j++) if (!isBenched(v, j)) return j;
    return headlinerJ(v);
  }

  function firstOpen(state) {
    var v, j;
    var guard = 0;
    for (v = 1; v <= VENUES.length; v++) {
      if (VENUES[v-1].mergedInto) continue;
      if (v < state.vMax && state.visited.indexOf(VENUES[v-1].slug)<0) continue;
      var complete = !!state.trophies[VENUES[v-1].slug];
      for (j = 1; j < headlinerJ(v); j++) {
        if (!isRemoved(state, v, j) && !isBenched(v, j)) complete = false;
      }
      if (complete) continue;
      for (j = 1; j <= headlinerJ(v); j++) {
        if (++guard > CONST.loopCap) return { v: 1, j: headlinerJ(1) };
        if (!isRemoved(state, v, j) && !isBenched(v, j)) return { v: v, j: j };
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
      if (VENUES[v-1].mergedInto) { j = headlinerJ(v); continue; }
      // A migrated run skips inserted, unvisited venues on retries as well as restart.
      if (v < state.vMax && state.visited.indexOf(VENUES[v-1].slug) < 0) { j = headlinerJ(v); continue; }
      if (!isRemoved(state, v, j) && !isBenched(v, j)) return { v: v, j: j };
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

