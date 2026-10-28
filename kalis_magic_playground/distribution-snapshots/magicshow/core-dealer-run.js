'use strict';
  function setupDealer(state) {
    addGain(state.u19b, 'dealerVisits', 1, 1000000);
    state.winsSinceDealer = 0;
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
      spun: false, games: {cups:null,monte:null}
    };
    state.dealerQueued = false;
    addGain(state, 'gems', 2, 1e9);
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
      earnCoins(state, Math.round(prize.value * CONST.dealerRewardMult * dealerCoinGrowthPow(state) * nodeEffects(state).dealerCoin));
    } else if (prize.kind === "gems") {
      addGain(state, 'gems', Math.round(prize.value * CONST.dealerRewardMult), 1e9);
    } else if (prize.kind === "heal") {
      state.mental = Math.min(state.mentalMax, state.mental + state.mentalMax * (Math.min(100, prize.value * CONST.dealerRewardMult) / 100)*gearMultiplier(state,"recovery"));
    } else if (prize.kind === "buff") {
      state.buff = (state.buff || 0) + Math.min(50, prize.value * CONST.dealerRewardMult);
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
    dailyProgress(state,'dealer',1);
    c.open = true;
    if (c.dud) {
      var i;
      for (i = 0; i < d.cards.length && i < 8; i++) d.cards[i].open = true;
      d.phase = "card-done";
      refreshRisk(d);
      return true;
    }
    addGain(state.features.progress, 'dealerFlips', 1, 1e24);
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

  // Leave the dealer in one call. dealerClose may first step a legacy card save to the slot phase, so it can take two closes;
  // this is the same loop the UI used at every exit (at most two closes, stop once the mode is no longer dealer). No rng use.
  function dealerLeave(state) {
    for (var i = 0; i < 2 && state.mode === "dealer"; i++) dealerClose(state);
  }

  function forceCost(state) {
    return Math.max(1, CONST.forceGemCost - state.tree.forceRemove);
  }

  function dealerForce(state, symbolId) {
    var d = state.dealer;
    if (!d || d.phase !== "slot" || d.spun) return false;
    dailyProgress(state,'dealer',1);
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
    dailyProgress(state,'dealer',1);
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
      earnCoins(state, Math.round(pays * CONST.slotCoin * CONST.dealerRewardMult * dealerCoinGrowthPow(state) * nodeEffects(state).jackpot));
      if (pays >= 2) addGain(state, 'gems', Math.round(CONST.slotGem * CONST.dealerRewardMult), 1e9);
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
    if(state.batchD.side){finishSide(state,false,null);return state;}
    if(state.batchD.encore.phase==='round'){finishEncore(state,false,null);return state;}
    if(state.batchD.twist.scene||state.batchD.encore.phase==='choice'||state.batchD.rebirthOffer)return state;
    state.features.progress.runBoxes=0;state.features.progress.tapStreak=0;
    var retryFuture=state.homecomingCleared&&VENUES[state.venue-1].slug==='future'&&!state.u19.cleared;
    var futureRetryJ=state.j;
    if(state.u18.anchor){finishTravel(state,null,false);return state;}
    state.idle.waiting=false;delete state.idle.next;
    cancelWorkers(state);
    unseal(state);
    state.doveMs = nodeEffects(state).doveEvery;
    state.rabbitMs = nodeEffects(state).rabbitEvery;
    state.flashBreaks = 0;
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
    state.shield = state.mentalMax * nodeEffects(state).openingShield * gearMultiplier(state,"confidence");
    clearBoard(state);
    if (state.tree.startFinale > 0) state.finisher = nodeEffects(state).finaleNeed;
    var pos = retryFuture ? {v:venueNumber('future'),j:futureRetryJ} : state.homecomingCleared ? {v:venueNumber('lecturenote'),j:1} : firstOpen(state);
    beginAudience(state, pos.v, pos.j, null);
    state.mode = "fight";
    return state;
  }

  function retreat(state) {
    if(state.u18.anchor){finishTravel(state,null,false);return state;}
    return restartRun(state);
  }

  function failRun(state, ev, forcedCause) {
    if(state.batchD.side){finishSide(state,false,ev);return;}
    if(state.batchD.encore.phase==='round'){finishEncore(state,false,ev);return;}
    state.features.progress.runBoxes=0;
    if(state.j===headlinerJ(state.venue)){
      var p=state.features.progress;
      p.bossLossStreak=p.bossLossVenue===state.venue?Math.min(1e24,p.bossLossStreak+1):1;p.bossLossVenue=state.venue;
      checkAchievements(state,ev);
    } else {state.features.progress.bossLossVenue=0;state.features.progress.bossLossStreak=0;}
    if(state.u18.anchor){finishTravel(state,ev,false);return;}
    var pct = 0;
    if (state.audHpMax > 0) pct = Math.round(100 * state.audHp / state.audHpMax);
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    var failedVenue=state.venue,failedId=state.audId,offer=state.venue>=venueNumber(DATA.dealer.cardVenue)&&state.winsSinceDealer>0;
    // U32 cause: gate pressure first, then how much of the doubt bar this run actually removed.
    var failCause = forcedCause ? forcedCause : gatePressure(state) > 0 ? "gate" : (state.audHpMax > 0 && state.u19.damage / state.audHpMax < 0.4 ? "damage" : "mental");
    var failedGate = state.u19b.gates[failedId];
    if (failedGate && gatePressure(state) > 0) failedGate.fails = Math.min(CONST.gateFailSteps, (failedGate.fails || 0) + 1);
    var failEvent = { type: "fail", reasonPct: pct, cause: failCause, venue:failedVenue,audId:failedId };
    if (theaterPhase(state)) failEvent.theaterPhase = theaterPhase(state); // s5b: the UI shows 앞줄 관객 for a phase-1 loss
    emit(ev, failEvent);
    addGain(state, 'fails', 1, 1e7);
    restartRun(state);
    state.u19b.failedId=failedId;
    if(offer)state.u19b.dealerOffer=true;
  }

  function checkLevel(state, ev) {
    var guard = 0;
    while (state.level < 100000 && state.xp >= xpNeed(state) && guard++ < 24) {
      state.xp -= xpNeed(state);
      addGain(state, 'level', 1, 100000);
      recompute(state, false);
      autoHeal(state, state.mentalMax * nodeEffects(state).levelHeal);
      emit(ev, { type: "levelUp", level: state.level });
    }
  }

