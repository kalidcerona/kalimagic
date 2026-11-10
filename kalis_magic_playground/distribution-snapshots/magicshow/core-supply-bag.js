'use strict';
  // v25 supplies survive travel and rebirth independently of per-show flags.
  function supplyField(id) { return id === 'potion' ? 'potionCount' : id === 'refill' ? 'refillCount' : ''; }
  function gemShopUseInfo(state, id, skill) {
    var field = supplyField(id), reason = '';
    if (!field) reason = '없는 상품이에요';
    else if (state[field] < 1) reason = '가진 것이 없어요';
    else if (id === 'refill' && (!skillUnlocked(state, skill) || !(state.skills.cooldowns[skill] > 0))) reason = '기다리는 스킬만 충전해요';
    else if (id === 'potion' && (state.mode !== 'fight' || state.resolved || state.features.climax.left > 0)) reason = '관객과 공연 중에 써요';
    else if (id === 'potion' && state.u17.potionUsed) reason = '이번 공연에서 이미 썼어요';
    else if (id === 'potion' && state.mental >= state.mentalMax) reason = '멘탈이 이미 가득해요';
    return { count: field ? state[field] : 0, reason: reason, available: !reason };
  }
  function gemShopUse(state, id, skill) {
    if (!gemShopUseInfo(state, id, skill).available) return false;
    state[supplyField(id)]--;
    if (id === 'refill') state.skills.cooldowns[skill] = 0;
    if (id === 'potion') {
      state.mental = Math.min(state.mentalMax, state.mental + state.mentalMax * .3 * gearMultiplier(state, 'recovery'));
      state.u17.potionUsed = true;
    }
    return true;
  }
  function validSupplyBag(o) {
    return integer(o.potionCount, 0, 99) != null && integer(o.refillCount, 0, 99) != null;
  }
  // Preserve the exact v15-v24 validator source and project only the v25 additions.
  var deserializeLegacy24 = deserialize;
  function deserializeV25(str) {
    try {
      if (typeof str !== 'string' || str.length > 2000000) return null;
      var o = JSON.parse(str);
      if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
      var current = typeof o.v === 'number' && isFinite(o.v) && o.v >= 25;
      if (current && !validSupplyBag(o)) return null;
      var potion = current ? o.potionCount : 0, refill = current ? o.refillCount : 0;
      if (current) o.v = 24;
      var state = deserializeLegacy24(JSON.stringify(o));
      if (state) { state.potionCount = potion; state.refillCount = refill; }
      return state;
    } catch (error) { return null; }
  }
  deserialize = deserializeV25;
