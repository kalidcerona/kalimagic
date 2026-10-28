'use strict';
  function reveal(state, id) {
    var f = state.features;
    if (f.reveals.indexOf(id) >= 0) return;
    f.reveals.push(id); f.revealQueue.push(id);
  }

  function stamp(state, id, ev) {
    var f = state.features;
    if (f.achievements.indexOf(id) >= 0) return;
    f.achievements.push(id);
    addGain(state, 'gems', DATA.silkRewards.achievement, 1e9);
    recompute(state, false);
    emit(ev, { type: "achievement", id: id, gems: DATA.silkRewards.achievement });
  }

  function achievementBonus(state) {
    return DATA.achievements.reduce(function(sum,a){return sum+(state.features.achievements.indexOf(a.id)>=0 ? (a.legacy ? CONST.achievementVPer : CONST.achievementVPerNew) : 0);},0);
  }
  function achievementInfo(state, id) {
    var a=DATA.achievements.find(function(a){return a.id===id;});
    if(!a)return null;
    var earned=state.features.achievements.indexOf(id)>=0, secret=a.hidden&&!earned;
    return {id:id,name:secret?'???':a.name,desc:secret?'???':a.desc,description:secret?'???':a.desc,group:a.group,hidden:a.hidden,earned:earned,bonus:a.legacy?CONST.achievementVPer:CONST.achievementVPerNew};
  }
  function checkAchievements(state, ev) {
    var f = state.features;
    if(state.resolved&&state.audHp<=0)checkWinMedals(state,ev);
    if (f.progress.goldenOpened >= 1) stamp(state, "golden", ev);
    if (f.boxes >= 100) stamp(state, "boxes", ev);
    if (state.maxCombo >= 25) stamp(state, "combo", ev);
    if (boardCapacity(state) >= 9) stamp(state, "slots", ev);
    if (f.helperBreaks >= 25) stamp(state, "helper", ev);
    var metrics={reach:state.vMax,sets:state.u14.sets.length,types:new Set(f.collected.map(itemType).filter(Boolean)).size,cosmetics:state.u18.owned.kali.length+state.u18.owned.cases.length,helperBreaks:f.helperBreaks};
    DATA.achievements.forEach(function(a){
      if(!a.metric)return;
      if(a.metric==='clear' ? !!state.trophies[a.target] : (metrics[a.metric]===undefined ? f.progress[a.metric]||0 : metrics[a.metric])>=a.target)stamp(state,a.id,ev);
    });
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
    return gearMultiplier(state,"tap") * (state.u14.visitor.buff>0?2:1) * (1+.03*state.u14.sets.length+.05*state.u18.sets.length) * (state.skills.showtimeLeft > 0 ? 3 : 1) * (state._wand || CONST.wandBase) * (hasReward(state, 2) ? 1.2 : 1) * (state.features.encoreLeft > 0 ? 2 * (state.tree.encore ? 1 + nodeEffects(state).encorePower : 1) : 1) * (1 + challengeBonus(state));
  }
  // v4 U46 C1: every audience whose 찐팬 challenge was cleared for the first time (u18.paid, kept through rebirth) adds 1 percent to 마술 실력, at most 20 percent.
  var CHALLENGE_STEP = .01, CHALLENGE_CAP = .2;
  function challengeBonus(state) { var n = state.u18 && state.u18.paid ? state.u18.paid.length : 0; return Math.min(CHALLENGE_CAP, CHALLENGE_STEP * n); }

  // Shared formula modifiers.
  function nodeEffects(state) {
    var t = state.tree;
    return {
      critRate: Math.min(1, (t.crit ? Math.min(0.14, 0.08 + 0.02 * t.critRate) : 0) + gearBonus(state,"crit")),
      critPower: Math.min(1.8, 1.5 + 0.1 * t.critPower),
      comboMs: Math.min(3000, CONST.comboResetMs + 250 * t.comboHold) + (hasReward(state, 1) ? 500 : 0),
      sweep: 1 + 0.05 * t.sweepFocus,
      miss: Math.max(0, (state.miss || 0) - 0.02 * t.precision),
      goldEvery: Math.max(120000, 180000 - 20000 * t.goldPity),
      goldCoins: 1 + 0.2 * t.goldCoins,
      prepared: 0.05 * t.prepared,
      boxXP: 1 + 0.1 * t.boxXP + 0.1 * t.lessonBias,
      boxShield: 0.02 * t.boxShield * (state._U || 1),
      boxHeal: 0.05 * t.boxHeal * (state._U || 1),
      shieldRatio: CONST.shieldRatio + 0.03 * t.shieldCap,
      shieldValue: 1 + 0.05 * t.shieldValue,
      healValue: 1 + 0.05 * t.healValue,
      winHeal: CONST.winHeal + 0.02 * t.winHeal,
      levelHeal: CONST.levelHeal + 0.02 * t.levelHeal,
      openingShield: 0.01 * t.openingShield,
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
      colleagueEvery: (CONST.colleagueEvery - 500 * t.colleagueTempo) / helperSpeed(state),
      finalePower: 1 + 0.08 * t.finalePower,
      finaleNeed: Math.max(18, CONST.finisherNeed - t.finaleNeed),
      comboValue: 1 + 0.2 * t.comboValue,
      encorePower: 0.2 + 0.05 * t.encorePower,
      encoreSpan: 12000 + 3000 * t.encoreSpan
    };
  }

