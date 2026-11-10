'use strict';
  function dealAud(state, dmg, ev, source) {
    if(state.batchD.twist.scene)return;
    if(twistEligible(state))dmg=Math.min(dmg,Math.max(0,state.audHp-state.audHpMax*DATA.batchD.twist.threshold));
    if (dmg < 0) dmg = 0;
    if(profile(state)==='future'){var u=state.u19;if(u.telegraph>0)return;if(u.phase===1&&state.skills.showtimeLeft>0)dmg*=.45;if(u.phase===3&&u.window>0&&state._futureSource!==u.target)return;}
    if(profile(state)==='future'&&state.u19.phase<3)dmg=Math.min(dmg,Math.max(0,state.audHp-state.audHpMax*(state.u19.phase===1?.65:.3)));
    addGain(state.u19, 'damage', Math.min(state.audHp,dmg), 1e100);
    if (isFinalBoss(state) && state.review.bonusMs > 0) dmg *= 1.2;
    if (state.pattern === "twoPhase" && !state.phase2 && !state.batchD.side && state.batchD.encore.phase!=='round') {
      var threshold = state.audHpMax * CONST.phase2At;
      if (state.audHp - dmg <= threshold) {
        var phaseApplied=Math.max(0,state.audHp-threshold);
        state.phase2 = true;
        state.audHp = state.audHpMax * CONST.phase2Hp;
        state.slow = true;
        state.pHeal = true;
        recompute(state, false);
        emit(ev, { type: "audHit", dmg: dmg, applied:phaseApplied, source: source });
        emit(ev, { type: "phase2" });
        return;
      }
    }
    // s5b: the theater phase 1 ends exactly at its share of the bar; the rest of this hit is not carried into 밍기리's bar (like twoPhase above).
    if (theaterPhase(state) === 1 && state.audHp - dmg <= theaterCut(state)) {
      var cutApplied = Math.max(0, state.audHp - theaterCut(state));
      theaterPhaseTwo(state, ev);
      emit(ev, { type: "audHit", dmg: dmg, applied: cutApplied, source: source });
      return;
    }
    var applied=Math.min(state.audHp,dmg);
    state.audHp -= dmg;
    // Keep the mandatory twist boundary exact after floating-point subtraction.
    if(twistEligible(state))state.audHp=Math.max(state.audHp,state.audHpMax*DATA.batchD.twist.threshold);
    if (state.audHp < 0) state.audHp = 0;
    if(twistEligible(state)&&!state.batchD.twist.hiddenUsed&&state.audHp<=state.audHpMax*(DATA.batchD.twist.threshold+1e-12)){state.batchD.twist.hiddenUsed=true;state.batchD.twist.scene='hidden';state.batchD.twist.left=DATA.batchD.twist.hiddenMs;state.flights=[];batchEvent(ev,'hidden');}
    emit(ev, { type: "audHit", dmg: dmg, applied:applied, source: source });
  }

  function fireFinisher(state, ev) {
    state.finisher = 0;
    state.finisherFired = true;
    addGain(state.features.progress, 'finales', 1, 1e24);checkAchievements(state,ev);
    var dmg = (hasReward(state, 6) ? 1.3 : 1) * (profile(state) === "mirror" && state.phase2 ? 1 + state.features.climax.confidence / 100 : 1) * CONST.finisherDmg * ((state._V || 1) * helperBuffMultiplier(state,'dmg')) * nodeEffects(state).finalePower * branchBonus(state, "finale");
    if (isFinalBoss(state) && state.review.finaleReady && !state.review.finaleUsed) { dmg *= 2; state.review.finaleUsed=true; state.review.finaleReady=false; emit(ev,{type:"curtainFinale"}); }
    emit(ev, { type: "finisher", dmg: dmg });
    dealAud(state, dmg, ev);
  }

  function breakCell(state, i, ev, source, chain) {
    var cell = state.board[i];
    if (!cell || cell.hpMax <= 0) return;
    var golden = !!cell.golden, f = state.features;
    reviewOpen(state,i,source,ev);
    var itemLv = cell.lv || 1;
    // A legacy golden level must not remain on the now-ordinary empty cell.
    if (golden) cell.lv = 1;
    cell.xp = 0;
    f.workers.actors.forEach(function (a) {
      if (a.phase !== "move" || a.cell !== i) return;
      a.phase = "idle"; a.cell = -1; a.remainingMs = 0;
      emit(ev, { type: "worker", workerId: a.id, cell: -1, audId: a.audId, phase: "idle" });
    });
    cell.golden = false; cell.goldenBroken = golden;
    addGain(f, 'boxes', 1, 1e9);addGain(f.progress, 'runBoxes', 1, 1e24);dailyProgress(state,'boxes',1);
    if (source === "magic" || source === "helper" || source === "fan" || source === "assistant") addGain(f, 'helperBreaks', 1, 1e9);
    if (golden) {
      dailyProgress(state,'golden',1);addGain(f.progress, 'goldenOpened', 1, 1e24); f.goldCell = -1; f.goldMs = nodeEffects(state).goldEvery;
      var bonus = Math.round(CONST.goldCoinBase * Math.pow(1.32, balanceRank(state.vMax) - 1) * nodeEffects(state).goldCoins * helperBuffMultiplier(state,"coin"));
      earnCoins(state, bonus); stamp(state, "golden", ev);
      emit(ev, { type: "goldenBreak", cell: i, coins: bonus });
    }
    cell.hp = 0;
    cell.hpMax = 0;
    cell.spawn = state._tau || 350;
    cell.sealed = false;
    addGain(state, 'combo', 1, 1e7);
    if(!state.features.encoreLeft) state.u17.feverPending=Math.min(100,state.u17.feverPending+1+Math.min(1,state.combo/50));
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    f.progress.comboMax = Math.max(f.progress.comboMax, state.combo);dailyProgress(state,'combo',state.combo,true);
    state.comboMs = nodeEffects(state).comboMs;
    emit(ev, { type: "combo", n: state.combo });
    if (state.tree.comboGift) {
      var paid = f.comboPaid[state.audId] || 0;
      for (var ci = 0; ci < CONST.comboThresholds.length; ci++) {
        if (state.combo < CONST.comboThresholds[ci] || (paid & (1 << ci))) continue;
        paid |= 1 << ci; f.comboPaid[state.audId] = paid;
        var gift = CONST.comboCoinRewards[ci] * Math.pow(1.32, balanceRank(state.venue) - 1) * nodeEffects(state).comboValue * helperBuffMultiplier(state,"coin");
        earnCoins(state, gift); addGain(state, 'finisher', CONST.comboGaugeRewards[ci]*gearMultiplier(state,'finale'), 1000);
        emit(ev, { type: "comboMilestone", threshold: CONST.comboThresholds[ci], coins: gift, gauge: CONST.comboGaugeRewards[ci], audId: state.audId });
      }
    }
    checkAchievements(state, ev);
    addGain(state, 'xp', CONST.xpPerBox * nodeEffects(state).boxXP, 1e12);
    state.shield = Math.min(state.mentalMax * nodeEffects(state).shieldRatio, state.shield + nodeEffects(state).boxShield*gearMultiplier(state,"confidence"));
    autoHeal(state, nodeEffects(state).boxHeal);
    checkLevel(state, ev);
    var coinMul = (state._coinMul || 1) * helperBuffMultiplier(state,'coin');
    earnCoins(state, Math.max(1, Math.round(CONST.coinPerBox * (state._coinMul || 1))) * caseOpeningMultiplier(itemLv, golden, state) * helperBuffMultiplier(state,'coin'));
    for (var tw = 0; tw < DATA.items.types.length; tw++) {
      TYPE_W[tw] = DATA.items.types[tw].share * 100;
      if (DATA.items.types[tw].id === "coin") TYPE_W[tw] += state.tree.coinLuck * statMultiplier(state,"coinLuck") * CONST.coinLuckAdd;
    }
    if (state.tree.equip) {
      for (var ei = 0; ei < DATA.items.types.length; ei++) {
        var et = DATA.items.types[ei];
        var count = f.equipped.filter(function (id) { return itemType(id) === et; }).length;
        TYPE_W[ei] *= Math.pow(1 + CONST.equipWeightPerItem, count);
      }
    }
    for (var drop = 0; drop < caseItems(itemLv, golden); drop++) {
    var type = DATA.items.types[pickW(state, TYPE_W)];
    var dropSample={value:0};
    var ri = pickW(state, CONST.rarityW,dropSample);
    var minRarity = Math.max(golden ? 1 : 0, type.minRarity || 0);
    if (ri < minRarity) {
      // Equivalent to rerolling until eligible, without an unbounded rejection loop.
      ri = minRarity + pickW(state, CONST.rarityW.slice(minRarity));
    }
    if(drop===0 && !state.u15.tutorial.active){
      var slug=VENUES[state.venue-1].slug, ledger=state.u15.drops[slug]||(state.u15.drops[slug]={boxes:0,count:0});
      addGain(ledger, 'boxes', 1, 1e9);
      // v4 U48 A: the 칼리 덱 drops only once its node is learned (the node unlocks the consumable); the ledger still counts every box.
      if(hasDeck(state)&&(slug==='family'?(ledger.count===0&&(ledger.boxes>=30||dropSample.value<.004)):dropSample.value<.004)){
        addGain(ledger, 'count', 1, 100000);addGain(state.u15, 'gloves', 1, 100000);emit(ev,{type:'gloveDrop',cell:i});
      }
    }
    var product = type.ladder[type.rarityMap[ri]];
    if (f.collected.indexOf(product.id) < 0) f.collected.push(product.id);
    routineItem(state, product.id, ev); // v4 U48 N4: a learned routine's item shows its trick now and then, 20 s apart. v4 U53: any rarity (the rare-only rule made the coins and rope tricks impossible and the others about 1 in 60 to 1 in 80 drops)
    var mult = CONST.rarityMult[ri];
    var kind = type.id;
    var effect = product.effect || type.effect;
    var amount = 0;
    if (effect === "damage") amount = CONST.itemDamage * state._V * helperBuffMultiplier(state,'dmg') * mult;
    else if (effect === "shield") amount = CONST.itemShield * state._U * mult * nodeEffects(state).shieldValue;
    else if (effect === "heal") amount = CONST.itemHeal * state._U * mult * nodeEffects(state).healValue;
    else if (effect === "coins") amount = CONST.itemCoins * mult * coinMul;
    else if (effect === "xpBurst") amount = 0.5 * xpNeed(state);
    else if (effect === "finisher") amount = 5;
    else if (effect === "boxFill") amount = 0.3;
    var itemBonus = (effect === "coins" || effect === "damage" ? caseMultiplier(itemLv, effect === "coins" ? "coin" : "damage", golden, state) : DATA.caseGrades.goldenMultiplier) * branchBonus(state, "box") * caseItemBonus(state);
    amount *= itemBonus;
    var gem = 0;
    if (ri >= 1 && rngNext(state) < CONST.gemChance[ri] + nodeEffects(state).gemFind && state.u17.gemWait<=0) {
      state.u17.gemWait=90000;
      addGain(state, 'gems', DATA.silkRewards.caseDrop, 1e9);
      gem = DATA.silkRewards.caseDrop;
    }
    emit(ev, { type: "boxBreak", openId: f.boxes, source: source || "manual", cell: i, item: kind, itemId: product.id, name: product.name, emoji: product.emoji, effect: effect, rarity: CONST.rarityIds[ri], value: amount, gem: gem });
    if (state.flights.length < CONST.flightCap) {
      var flight = {
        ms: CONST.itemFlightMs,
        kind: kind,
        itemId: product.id, name: product.name, emoji: product.emoji, effect: effect,
        amount: amount,
        rarity: CONST.rarityIds[ri],
        cell: i,
        audId: state.audId
      };
      // v4 U44: an xp item keeps its case-level and branch bonus for the landing, when the amount is recomputed from the current need.
      if (effect === "xpBurst") flight.xpFactor = itemBonus;
      state.flights.push(flight);
    }
    }
    if (state.tree.flashpaper && !f.magic.paused.flashpaper && f.magic.papers.length < 2 && rngNext(state) < .03 + .01 * state.tree.flashpaperChance) {
      f.magic.papers.push({cell:i}); emit(ev,{type:'paperDrop',cell:i});
    }
    state.features.climax.mirrored = state.features.climax.mirrored.filter(function (n) {return n !== i;});
    if (state.tree.flash > 0 && ++state.flashBreaks >= CONST.flashEvery) {
      state.flashBreaks = 0; usedHelper(state,"flash");
      var burst = CONST.flashDamage * state._V * helperBuffMultiplier(state,'dmg');
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
    addGain(state, 'finisher', gearMultiplier(state,'finale'), 1000);
    checkAchievements(state,ev);
    if (state.finisher >= nodeEffects(state).finaleNeed) fireFinisher(state, ev);
    if (state.audHp <= 0 && state.mode === "fight" && !state.resolved) onWin(state, ev);
  }

  function damageCell(state, i, dmg, ev, source, chain) {
    if(state.batchD.twist.scene)return;
    dmg *= gearMultiplier(state,"open");
    var c = state.board[i];
    if(state.batchD.interference.left>0&&state.batchD.interference.cell===i&&state.batchD.interference.kind==='lock')return;
    if(profile(state)==='future'){var u=state.u19;if(u.telegraph>0)return;if(u.phase===3&&u.window>0&&i!==u.target)return;if(u.phase===2&&(!source||source==='manual'||source==='active')){if(i===u.target)u.hitMs=0;}}
    if (!c || c.hp <= 0 || (c.sealed && source!=='active')) return;
    if (state.features.climax.mirrored.indexOf(i) >= 0 && (!source || source === 'manual')) return;
    var role = source === 'magic' ? 'magic' : source === "fan" || source === "assistant" || source === "chain" ? source : "manual";
    addGain(state.features.damage, role, Math.min(c.hp, dmg), 1e27);
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

  function applyTaps(state, dt, taps, ev, pulse) {
    var n = state.board.length;
    var list = dedupe(taps, n);
    if (!list.length) {
      state.holding = false;
      state.tapAcc = 0;
      return;
    }
    var fresh = !state.holding;
    if (!state.holding) {
      state.holding = true;
      if (state.tapAcc < 1) state.tapAcc = 1;
    }
    if (state._rate == null) recompute(state, true);
    state.tapAcc += wandRate(state) * dt / 1000;
    var hits = Math.floor(state.tapAcc);
    if (hits > 8) hits = 8;
    if (hits < 0) hits = 0;
    state.tapAcc -= hits;
    if (hits <= 0 || state.mode !== "fight") return;
    var dmg = wandDamage(state);
    var h, k;
    for (h = 0; h < hits; h++) {
      if (state.mode !== "fight" || state.u18.map) return;
      var mods = nodeEffects(state);
      var crit = mods.critRate > 0 && rngNext(state) < mods.critRate;
      var alive = 0;
      for (k = 0; k < list.length; k++) {
        var cell = state.board[list[k]];
        if (cell.hp > 0 && !cell.sealed) alive++;
      }
      // pulse 'tap' is a new press. 'hold' and 'auto' (칼리 덱 glove) stay on holdPower.
      var mul = pulse === "auto" || pulse === "hold" ? CONST.holdPower : pulse === "tap" ? CONST.tapPower : (fresh && h === 0 ? CONST.tapPower : CONST.holdPower);
      var hitDmg = dmg * mul * (crit ? mods.critPower : 1) * (alive === 1 ? mods.sweep : 1);
      if(h===0&&pulse!=='auto'&&pulse!=='hold'&&(pulse==='tap'||fresh)){
        var p=state.features.progress;p.tapStreak=alive===list.length?Math.min(1e24,p.tapStreak+1):0;p.tapStreakMax=Math.max(p.tapStreakMax,p.tapStreak);
      }
      if(crit&&alive)addGain(state.features.progress, 'crits', 1, 1e24);
      checkAchievements(state,ev);
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
      if (f.effect === "xpBurst") f.amount = 0.5 * xpNeed(state) * (f.xpFactor || 1); // v4 U44: the current level's need, keeping the case-level and branch bonus
      emit(ev, { type: "itemLand", cell: f.cell, item: f.kind, itemId: f.itemId, name: f.name, emoji: f.emoji, effect: f.effect, rarity: f.rarity, value: f.amount });
      if (f.kind === "card") {
        if (state.mode === "fight" && !state.resolved && f.audId === state.audId) {
          var dmg = f.amount;
          if (nodeEffects(state).miss > 0 && rngNext(state) < nodeEffects(state).miss) dmg = 0;
          if (dmg > 0){state._futureSource=f.cell;dealAud(state,dmg,ev);state._futureSource=null;}
          else emit(ev, { type: "audHit", dmg: 0 });
          if (state.audHp <= 0 && !state.resolved) onWin(state, ev);
        }
      } else if (f.kind === "silk") {
        var cap = state.mentalMax * nodeEffects(state).shieldRatio;
        state.shield += f.amount*gearMultiplier(state,"confidence");
        if (state.shield > cap) state.shield = cap;
      } else if (f.kind === "water") {
        autoHeal(state, f.amount);
      } else if (f.kind === "coin") {
        earnCoins(state, Math.max(0, Math.round(f.amount)));
      } else if (f.effect === "xpBurst") {
        addGain(state, 'xp', f.amount, 1e12);
        checkLevel(state, ev);
      } else if (f.effect === "finisher") {
        addGain(state, 'finisher', 5*gearMultiplier(state,'finale'), 1000);
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
    if(state.batchD.side||state.batchD.encore.phase==='round')return;
    // s5b: theater phase 1 has no sealBox (a save from the single-phase fight may still hold a sealed case: open it); the bar crossing the
    // phase-1 share (a loaded save, gate regrowth never moves it down) starts phase 2 here as well as in dealAud.
    var theater = theaterPhase(state);
    if (theater === 1 && state.audHp <= theaterCut(state)) { theaterPhaseTwo(state, ev); theater = 2; }
    if (theater === 1) { if (state.sealCell >= 0 || state.sealMs > 0) unseal(state); }
    else if (state.pattern === "sealBox") {
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

  // s5d: the visible-hit numbers; 미래의 칼리 uses the row of her current phase (CONST.future), every other fight the global ones.
  function visibleRule(state){if(profile(state)!=='future')return{every:CONST.mentalVisibleEvery,hit:CONST.mentalVisibleHit,absorb:CONST.mentalVisibleAbsorb,ms:CONST.mentalVisibleMs};var F=CONST.future,i=Math.max(0,Math.min(2,(state.u19.phase||1)-1)),p=state.features.progress,streak=p.bossLossVenue===state.venue?p.bossLossStreak:0,ease=i?Math.max(F.retryEase,1-F.retryEase*streak):1;return{every:F.visibleEvery[i],hit:F.visibleHit[i]*ease,absorb:F.visibleAbsorb[i],ms:F.visibleMs[i]};}
  function lastHeckleArmed(state){return state.review.lastHeckle===1&&isFinalBoss(state);}
  var HECKLE_RATIO_REDUCTION_PER_LEVEL = 0.04;
  function heckleRatioScale(state) {
    var level = nodeLevel(state, NODE_BY_ID.mental) + nodeLevel(state, NODE_BY_ID['mental-2']);
    return Math.max(0.045, 0.075 * (1 - HECKLE_RATIO_REDUCTION_PER_LEVEL * level)) / 0.075;
  }
  function heckleStrength(state){if(lastHeckleArmed(state))return CONST.finalHeckle;var pressure=gatePressure(state),base=state.atk*nodeEffects(state).calm;if(!pressure)return base;return Math.max(Math.min(base,state.mentalMax*.05*heckleRatioScale(state)),state.mentalMax*(.04+GATE_POLICY.ramp*Math.max(0,Math.min(1,(state.fightMs-20000)/20000)))*pressure*heckleRatioScale(state));}
  // Preview the next uncancelled hit without advancing visibility or changing state.
  function nextHeckle(state) {
    var vr=visibleRule(state), visibility=MENTAL_VISIBILITY.get(state), counted=!lastHeckleArmed(state)&&!state.u15.tutorial.active&&state.venue>=venueNumber('school');
    var visible=counted&&((visibility ? visibility.count : 0)+1)%vr.every===0, dmg=heckleStrength(state);
    if(visible&&!gatePressure(state))dmg=Math.max(dmg,state.mentalMax*vr.hit*(profile(state)==='future'?1:heckleRatioScale(state)));
    if(isFinalBoss(state)&&!lastHeckleArmed(state))dmg*=CONST.finalBossHeckleScale;
    return {dmg:dmg,visible:visible,counted:counted,block:Math.min(Math.max(0,state.shield||0),dmg*(visible?vr.absorb:1))};
  }
  // v4 U38: threat numbers the player can compare with their own. Everything is per second so 야유, 회복 and 내 공격 share one unit.
  // hit = one heckle, every = seconds between heckles, perSecond = hit / every, regen = doubt the audience wins back per second
  // (gate pressure and the heal pattern), block = how much of one heckle the 자신감 shield soaks up right now.
  function threatInfo(state) {
    var next = nextHeckle(state), hit = next.dmg, every = Math.max(400, (state.interval || 4) * 1000) / 1000, pressure = gatePressure(state);
    var regen = (pressure ? state.audHpMax * GATE_POLICY.regen * pressure : 0) + (state.pHeal || state.pattern === "heal" ? state.audHpMax * CONST.patternHealPct / (CONST.patternHealEvery / 1000) : 0);
    return { last: lastHeckleArmed(state), hit: hit, every: every, perSecond: hit / every, regen: regen, block: next.block, shield: Math.max(0, state.shield || 0) };
  }
  // 내 공격/초: doubt removed per second, a smoothed measure of what really landed (it follows the current hold rate and skills).
  // Transient (never saved). It is seeded with the fight average after 4 seconds and then follows an 8 second smoothing.
  function trackAttackRate(state, dt) {
    var d = state.u19.damage, last = typeof state._dmgLast === "number" && d >= state._dmgLast ? state._dmgLast : d;
    state._dmgLast = d;
    if (typeof state._atkRate !== "number") { if (state.fightMs >= 4000) state._atkRate = d / (state.fightMs / 1000); return; }
    state._atkRate += ((d - last) / (dt / 1000) - state._atkRate) * (dt / (8000 + dt));
  }
  function attackRate(state) { return typeof state._atkRate === "number" ? Math.max(0, state._atkRate) : null; }
  function tickHeckle(state, dt, ev) {
    if(state.batchD.twist.scene)return;
    if(state.u15.tutorial.active)state.mental=Math.max(state.mental,10);
    var pressure=gatePressure(state);
    if(pressure)state.audHp=Math.min(theaterPhase(state)===2?theaterCut(state):state.audHpMax,state.audHp+state.audHpMax*GATE_POLICY.regen*pressure*dt/1000); // s5b: theater phase 2 regrows up to its own bar
    state.heckleMs -= dt;
    if (!state.telegraphed && (lastHeckleArmed(state) || state.heckleMs <= CONST.telegraphMs)) {
      state.telegraphed = true;
      emit(ev, { type: "heckleTelegraph" });
    }
    var guard = 0;
    while (state.heckleMs <= 0 && guard++ < 4 && state.mode === "fight" && !state.resolved) {
      var intervalMs = state.interval * 1000;
      if (intervalMs < 400) intervalMs = 400;
      state.heckleMs += intervalMs;
      state.telegraphed = state.heckleMs <= CONST.telegraphMs;
      var big = lastHeckleArmed(state);
      if (state.skills.cheerGuard) { state.skills.cheerGuard=false; if (big) state.review.lastHeckle=2; emit(ev,{type:'heckleCancelled'}); continue; }
      if (state.review.cancel) { state.review.cancel=false; if (big) state.review.lastHeckle=2; emit(ev,{type:"heckleCancelled"}); continue; }
      var next = nextHeckle(state), dmg = next.dmg;
      if (next.counted) {
        var visibility = MENTAL_VISIBILITY.get(state);
        if (!visibility) { visibility = { count: 0, left: 0, budget: 0, capped: false }; MENTAL_VISIBILITY.set(state, visibility); }
        var vr = visibleRule(state);
        visibility.count++;
        if (next.visible) {
          visibility.left = vr.ms; visibility.budget = 0; visibility.capped = true;
        }
      }
      if (big) state.review.lastHeckle = 2;
      var shieldDmg = next.block;
      state.shield -= shieldDmg;
      var mentalDmg = dmg - shieldDmg;
      if (mentalDmg > 0) {
        state.mental -= mentalDmg;
        state.tookMental = true;
      }
      var taken = state.pattern === "stealCoins" ? takeFightCoins(state) : 0;
      emit(ev, { type: "heckle", dmg: dmg, shieldDmg: shieldDmg, coinsTaken: taken });
      if (state.mental <= 0) {
        state.mental = 0;
        failRun(state, ev, big ? "lastHeckle" : undefined);
        return;
      }
    }
  }

  // Require a cumulative two percent of max doubt to restart the 75-second stall clock.
  // The two fields are not saved: a loaded fight starts its clock again from the loaded doubt.
  function tickStall(state, dt, ev) {
    if (state.u15.tutorial.active || state.u18.anchor) return;
    var progress = Math.max(1e-9, state.audHpMax * .02);
    if (typeof state.stallMin !== "number" || state.stallMin - state.audHp >= progress) { state.stallMin = state.audHp; state.stallMs = 0; return; }
    state.stallMs = (state.stallMs || 0) + dt;
    if (state.stallMs >= CONST.stallMs) { state.stallMs = 0; failRun(state, ev, "stall"); }
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

