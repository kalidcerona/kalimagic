'use strict';
  function caseCap(state) { return 5 + (state.tree.caseMax || 0); }
  function caseNeed(lv) { return Math.ceil(3 * Math.pow(1.35, lv - 1)); }
  // v4 U48 M2 (owner: "카드케이스에 레벨 보이는 거 지우고 케이스 색으로 레벨을 가늠하게 해줘."): the board shows no LV text; the case art tells the level
  // band over the whole range (LV 1 to 5 + caseMax 45 = 50): red 1-4, blue 5-9, black 10-17, silver 18-29, purple galaxy 30-50 (golden stays golden).
  // casePips is the place inside the band (1 to 4 small dots). Presentation only: nothing in the fight reads either.
  var CASE_BANDS = [1, 5, 10, 18, 30, 51];
  function caseBand(lv) { for (var b = 0; b < 5; b++) if (lv < CASE_BANDS[b + 1]) return b; return 4; }
  function caseTier(cell) { return cell.golden ? 'box-golden' : 'box-' + caseBand(cell.lv || 1); }
  function casePips(cell) { var lv = cell.lv || 1, b = caseBand(lv), lo = CASE_BANDS[b], span = CASE_BANDS[b + 1] - lo; return 1 + Math.min(3, Math.floor((lv - lo) * 4 / span)); }
  function caseItems(lv) { return 1 + Math.floor((lv - 1) / 3); }
  // v4 U38: the endless nodes are gone; only the one-level hidden node of a branch still adds its 2 percent.
  // v4 U48 N4: each learned routine 비법 (routine-<id>) adds 3 percent to its routine's branch.
  var ROUTINE_NODES = DATA.tree.filter(function (n) { return n.routine; });
  function branchBonus(state, branch) { var r = 0; for (var i = 0; i < ROUTINE_NODES.length; i++) if (ROUTINE_NODES[i].routineBranch === branch && state.tree[ROUTINE_NODES[i].id]) r++; return 1 + .02 * (state.tree['hidden-' + branch] || 0) + .03 * r; }
  // v4 U45: 틴 케이스 (node.caseItemMult) multiplies what every opened case's items do (damage, shield, heal, coins, xp); 1 without it.
  function caseItemBonus(state) { var m = 1; DATA.tree.forEach(function (n) { if (n.caseItemMult && state.tree[n.id]) m *= n.caseItemMult; }); return m; }
  // Saturate gains at the existing strict-save limits, before state is serialized.
  function addGain(target, key, amount, max) {
    target[key] = Math.min(max, (target[key] || 0) + Math.max(0, amount));
    return target[key];
  }
  function earnCoins(state, amount) {
    addGain(state.u14.visitor, 'incomeCoins', amount, 1e24);
    addGain(state, 'coins', amount, 1e18);
    addGain(state.features.progress, 'coinsEarned', amount, 1e24);
  }
  function fillBox(state, cell) {
    cell.lv = cell.lv || Math.min(caseCap(state), 1 + (state.tree.caseStart || 0) + (hasReward(state, 4) ? 1 : 0));
    cell.xp = cell.xp || 0;
    var hp = caseHp(state._boxHp || CONST.boxHpBase, cell.lv);
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
    MENTAL_VISIBILITY.delete(state);
    if (VENUES[v-1].mergedInto) { v=venueNumber(VENUES[v-1].mergedInto); j=1; }
    state.features.progress.tapStreak=0;
    state._colMs = null;
    unseal(state);
    cancelWorkers(state);
    var aud = getAud(v, j);
    state.venue = v;
    var arrived = state.visited.indexOf(VENUES[v-1].slug) < 0; // hotel stage: the audience event tells the UI about a first arrival (arrival banner)
    if (arrived) state.visited.push(VENUES[v-1].slug);
    // Crowd is display-only and does not scale combat stats.
    state.crowd = VENUES[v - 1].crowd;
    state.j = j;
    if (v > state.vMax) { state.vMax = v; ensureBoard(state); reveal(state, "slot"); }
    state.audId = aud ? aud.id : "";
    var st = audStats(v, j);
    state.u19.damage=0;state.u19.power=state._V||1;
    state.batchD.interference={cell:-1,left:0,clock:0,kind:''};
    if(!state.batchD.side){state.batchD.twist.hiddenUsed=false;state.batchD.twist.traceUsed=false;}
    state.audHpMax = st.hp;
    state.audHp = st.hp;
    state.atk = st.atk;
    state.interval = st.interval;
    state.heckleMs = st.interval * 1000;
    state.telegraphed = false;
    state.fightMs = 0;
    state.u17.potionUsed = false;
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
    if (pattern === "sealBox" && theaterPhase(state) !== 1) sealOne(state); // s5b: the theater phase 1 (앞줄 관객) has no sealBox
    if (VENUES[v-1].invitation && !state.invited[VENUES[v-1].slug]) {
      state.invited[VENUES[v-1].slug] = 1;
      var inv = VENUES[v - 1] && VENUES[v - 1].invitation;
      emit(ev, { type: "venueUnlocked", venue: v, crowd: state.crowd, name: inv ? inv.name : "" });
    }
    state.mode = "fight";
    state.features.climax.mirrored = []; state.features.climax.mirrorMs = 15000;
    state.features.climax.confidence = 0; state.features.climax.milestone = 0;
    state.review = emptyReview();
    if(VENUES[v-1].slug==='future'&&j<headlinerJ(v)){
      state.audHp=state.audHpMax=Math.max(1,Math.round(futurePower(state)*12));
      state.atk=state.mentalMax*0.002;state.interval=2;state.heckleMs=2000;
    }
    if(profile(state)==='future'){
      var u=state.u19;u.phase=1;u.telegraph=3000;u.window=0;u.hitMs=0;u.target=strongestCase(state);
      var dps=u.lastDps>0?u.lastDps*(state._V||1)/u.lastPower:futurePower(state);
      var fp=state.features.progress,retry=fp.bossLossVenue===state.venue&&fp.bossLossStreak>0?CONST.future.retryHp:1;
      state.audHp=state.audHpMax=Math.max(1,Math.round(dps*112*retry));futureThreat(state);state.heckleMs=CONST.future.firstHeckleMs;
      emit(ev,{type:'futurePhase',phase:1});
    }
    if (profile(state) === "homecoming") emit(ev,{type:"homecomingAct",act:1,line:aud.act1Line});
    if (isFinalBoss(state) && !state.u18.anchor && !state.features.climax.paradeDone) {
      state.features.climax.left = 30000;
      emit(ev, { type: 'curtainCall', cell: 0 });
    }
    if(!state.u15.tutorial.active && !state.u18.anchor){
      if(j===firstFightJ(v))queueScene(state,VENUES[v-1].slug,'opening');
      if(j===headlinerJ(v))queueScene(state,VENUES[v-1].slug,'beforeHeadliner');
    }
    if(gateAudience(state)&&!state.u19b.gates[state.audId])state.u19b.gates[state.audId]={prepared:preparation(state),need:gateNeed(state),cleared:false,studied:false};
    if(gatePressure(state)>0)state.audHp=state.audHpMax=Math.max(state.audHpMax,Math.round(wallPower(state)*(VENUES[v-1].slug==='theater'?75:45)));
    state.stallMin = state.audHp; state.stallMs = 0;
    if(twistEligible(state)&&!state.batchD.twist.failures&&!state.batchD.twist.scene)state.batchD.twist.scene='intro';
    checkAchievements(state,ev);
    emit(ev, { type: "audience", venue: v, j: j, audId: state.audId, crowd: state.crowd, arrived: arrived });
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

  function checkWinMedals(state,ev){
    if(state.tree.challenge){
      if(!state.tookMental)stamp(state,'noDamage',ev);
      if(state.finisherFired)stamp(state,'finale',ev);
      var extra=getAud(state.venue,state.j).extra;
      if(extra&&extra.type==='timeLimit'&&metExtra(state,extra))stamp(state,'timed',ev);
    }
  }
  function checkVictoryAchievements(state,ev){
    if(state.mental>0&&state.mental<state.mentalMax*.1)addGain(state.features.progress,'mentalClutches',1,1e24);
    checkWinMedals(state,ev);checkAchievements(state,ev);
  }

  function onWin(state, ev) {
    if (state.resolved || state._skillBatch) return;
    if(state.batchD.side){checkVictoryAchievements(state,ev);finishSide(state,true,ev);return;}
    if(state.batchD.encore.phase==='round'){checkVictoryAchievements(state,ev);finishEncore(state,true,ev);return;}
    if(twistEligible(state)){state.audHp=Math.max(1,state.audHpMax*DATA.batchD.twist.threshold);return;}
    if(state.u15.tutorial.active){if(tutorialLessonPending(state)){state.audHp=1;return;}checkVictoryAchievements(state,ev);state.resolved=true;state.u15.tutorial.won=true;emit(ev,{type:'tutorialWin'});return;}
    if(state.u18.challenge&&state.u18.challenge.kind==='trueFan'){var rule=trueFanRule(state.u18.challenge.slug);if(rule.type==='combo'&&!metExtra(state,rule)){state.audHp=1;return;}if(metExtra(state,rule))checkVictoryAchievements(state,ev);finishTravel(state,ev,true);return;}
    checkVictoryAchievements(state,ev);
    state.features.progress.bossLossVenue=0;state.features.progress.bossLossStreak=0;
    state.resolved = true;
    unseal(state);
    var venue = state.venue;
    var j = state.j;
    var audId = state.audId;
    var coins = Math.round(CONST.winCoinBase * Math.pow(CONST.winCoinGrowth, balanceRank(venue) - 1) * (state._coinMul || 1) * nodeEffects(state).tip * gearMultiplier(state,"reward"));
    if (coins < 1) coins = 1;
    earnCoins(state, coins);
    if(state.fightMs>0){state.u19.lastDps=state.u19.damage/(state.fightMs/1000);state.u19.lastPower=state._V||1;}
    addGain(state, 'wins', 1, 1e7); dailyProgress(state,'wins',1);
    if(state.u14.satisfied.indexOf(audId)<0)state.u14.satisfied.push(audId);
    if(j===headlinerJ(venue)){dailyProgress(state,'clear',1);var tier=VENUES[venue-1].slug==='moon'?3:VENUES[venue-1].slug==='audition'?2:1;if(tier>state.u14.outfit){state.u14.outfit=tier;emit(ev,{type:'outfit',tier:tier});}}
    checkSets(state,ev);recompute(state,false);
    if (state.knownAudiences.indexOf(audId) < 0) state.knownAudiences.push(audId);
    if (profile(state) === "mirror" && !state.u18.anchor) {
      state.seenEnding = true;
      if (state.endings.indexOf(state.dimension) < 0) state.endings.push(state.dimension);
      emit(ev,{type:"selfReconciliation",lines:DATA.story.reveal.slice()});
    }
    var removed = false;
    var keys = 0;
    var trophy = false;
    if (j === headlinerJ(venue)) {
      if (audId === "h-broadcast") addGain(state.bestiary[audId], 'wins', 1, 100000);
      if (!state.trophies[VENUES[venue-1].slug]) {
        state.trophies[VENUES[venue-1].slug] = 1;
        VENUES.filter(function(v){return v.mergedInto===VENUES[venue-1].slug;}).forEach(function(v){
          state.trophies[v.slug]=1;
          var legacyReward=DATA.stageRewards.find(function(r){return r.venueSlug===v.slug;});
          if(legacyReward&&!hasReward(state,legacyReward.id)){state.features.rewards.push(legacyReward.id);emit(ev,{type:"stageReward",reward:legacyReward.id,cell:0});}
        });
        queueScene(state,VENUES[venue-1].slug,"afterClear");
        trophy = true;
        addGain(state, 'gems', DATA.silkRewards.firstClear, 1e9);
        var reward = DATA.stageRewards.find(function (r) { return r.venueSlug === VENUES[venue-1].slug; });
        if (reward && !hasReward(state, reward.id)) { state.features.rewards.push(reward.id); emit(ev, {type:'stageReward',reward:reward.id,cell:0,gems:DATA.silkRewards.firstClear}); }
      }
    } else {
      var rec = state.bestiary[audId];
      var meta = AUD_BY_ID[audId];
      var extra = meta ? meta.extra : { type: "none", value: 0 };
      if (rec) {
        addGain(rec, 'wins', 1, 100000);
        if (metExtra(state, extra)) rec.extra = true;
        var need = extra && extra.type !== "none";
        if (!rec.removed && rec.wins >= CONST.bestiaryWins && (!need || rec.extra)) {
          rec.removed = true;
          removed = true;
          addGain(state, 'keys', 1, 1e6);
          keys = 1;
          state.removedCount = countRemoved(state);
          recompute(state, false);
        }
      }
    }
    // v4 U37: the rabbit dealer visits only after a failed stage. A win never queues a visit and ends any unused offer from an earlier failure.
    if (state.venue >= venueNumber(DATA.dealer.cardVenue)) addGain(state, 'winsSinceDealer', 1, 1e6);
    state.dealerQueued = false;
    state.u19b.dealerOffer = false;
    state.buff = 0;
    if(state.u19b.gates[state.audId])state.u19b.gates[state.audId].cleared=true;
    emit(ev, { type: "win", venue: venue, crowd: state.crowd, j: j, coins: coins, removed: removed, trophy: trophy, keys: keys, gems: trophy ? DATA.silkRewards.firstClear : 0 });
    checkTrueFanReveal(state,ev);unlockCosmetics(state);checkAchievements(state,ev);
    if(state.u18.anchor){finishTravel(state,ev,true);return;}
    if(j===headlinerJ(venue)){state.batchD.encore={phase:'choice',reward:coins*DATA.batchD.encore.rewardFactor,left:0};batchEvent(ev,'encoreChoice');}
    if(profile(state)==='future'&&!state.u18.anchor){state.u19.cleared=true;state.mode='transition';state.transMs=CONST.winTransitionMs;state.after='ending';unlockCosmetics(state);emit(ev,{type:'futureWin'});return;}
    if(VENUES[venue-1].slug==='multiverse'&&j===headlinerJ(venue)){state.batchD.multiverseCleared=true;state.batchD.rebirthOffer=true;batchEvent(ev,'rebirthOffer');}
    var next = advanceFrom(state);
    if (isFinalBoss(state)) {
      autoHeal(state, state.mentalMax * nodeEffects(state).winHeal);
      state.mode = "transition";
      state.transMs = CONST.winTransitionMs;
      state.after = state.homecomingCleared ? "stay" : "ending";
      return;
    }
    state.idle.next = {v:next.v,j:next.j};
    state.idle.waiting = false;
    autoHeal(state, state.mentalMax * nodeEffects(state).winHeal);
    state.mode = "transition";
    state.transMs = CONST.winTransitionMs;
    state.after = "fight";
  }

  function enterEnding(state, ev) {
    state.mode = "ending";
    state.dealer = null;
    state.dealerQueued = false;
    state.flights = []; cancelWorkers(state);
    state.homecomingCleared = true;unlockCosmetics(state);
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

