'use strict';
  function emptyBestiary() {
    var b = {};
    var i;
    for (i = 0; i < AUD_IDS.length; i++) b[AUD_IDS[i]] = { wins: 0, extra: false, removed: false };
    b["h-broadcast"] = { wins: 0, extra: false, removed: false };
    return b;
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
    state._preparedLevel=DATA.tree.reduce(function(n,node){return n+(state.tree[node.id]||0);},0);
    var C = CONST;
    var b = Math.floor((balanceRank(state.vMax) - 1) / C.boxLevelDiv);
    if (b < 0) b = 0;
    state._boxHp = C.boxHpBase * Math.pow(C.boxHpGrowth, b);
    var tau = C.spawnBase / Math.pow(C.spawnGrowth, state.tree.spawn) * 1000;
    tau *= Math.pow(C.starTempoTau, state.stars.tempo);
    if (state.slow) tau *= C.slowSpawn;
    if (tau < 40) tau = 40;
    state._tau = Math.max(40,tau / statMultiplier(state,"spawn") / statMultiplier(state,"starTempo"));
    var rate = Math.min(C.tapCap, C.tapBase + C.tapPerSpeed * state.tree.speed);
    rate *= Math.pow(C.starTempoRate, state.stars.tempo);
    if (state.slow) rate *= C.slowTap;
    if (rate < 0.2) rate = 0.2;
    state._rate = rate * statMultiplier(state,"speed") * statMultiplier(state,"starTempo");
    var wand = C.wandBase * Math.pow(C.wandGrowth, state.tree.power);
    wand *= Math.pow(C.starWand, state.stars.trick) * statMultiplier(state,"starTrick");
    state._wand = wand * statMultiplier(state,"power") * branchBonus(state, "hand");
    var V = Math.pow(C.Vbase, balanceRank(state.vMax) - 1) * Math.pow(C.Vattack, state.tree.attack) * (1 + C.Vlevel * state.level);
    V *= Math.pow(C.starTrick, state.stars.trick) * statMultiplier(state,"starTrick");
    V *= 1 + state.removedCount * C.bestiaryDmg;
    V *= 1 + (state.buff || 0) / 100;
    V *= 1 + achievementBonus(state);
    V *= productMultiplier(state) * gearMultiplier(state,"performance");
    V *= 1 + (state.batchD ? state.batchD.permanentBonus : 0);
    state._V = V * statMultiplier(state,"attack") * branchBonus(state, "collection") * branchBonus(state, "star");
    var U = Math.pow(C.Ubase, balanceRank(state.vMax) - 1) * Math.pow(C.starGuard, state.stars.guard) * statMultiplier(state,"starGuard");
    U *= 1 + state.removedCount * C.bestiaryU;
    state._U = U;
    var mm = C.mentalBase * U * Math.pow(C.mentalGrowth, state.tree.mental);
    var prev = state.mentalMax || 0;
    mm *= statMultiplier(state,"mental") * branchBonus(state, "heart") * gearMultiplier(state,"mental");
    if (state.trophies.cafe) mm *= 1.02; // Card1412's heckler advice.
    state.mentalMax = mm;
    if (!sync && prev > 0 && mm > prev) {
      autoHeal(state, mm - prev);
    }
    var cap = mm * nodeEffects(state).shieldRatio;
    if (state.shield > cap) state.shield = cap;
    state._coinMul = Math.pow(C.starCoin, state.stars.bounty) * statMultiplier(state,"starBounty") * branchBonus(state, "luck") * gearMultiplier(state,"coins");
  }

  function wandRate(state) {
    if (state._rate == null) recompute(state, true);
    return state._rate * padSpeed(state) * gearMultiplier(state,"hold") * (state.features.encoreLeft>0 ? 1.25 : 1);
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
    o.slotIds = (state.u15 ? state.u15.positions : CONST.slotOrder).slice(0, cap);
    o.cols = CONST.boardCols;
    o.rows = CONST.boardRows;
    o.capacity = cap;
    return o;
  }

  function cellPosition(state, i) {
    if (!Number.isInteger(i) || i < 0 || i >= CONST.boardMax) return null;
    var slot = state.u15 ? state.u15.positions[i] : CONST.slotOrder[i];
    return { col: slot % CONST.boardCols, row: Math.floor(slot / CONST.boardCols) };
  }

