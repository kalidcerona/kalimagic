'use strict';
  // Preview the live purchase path on detached state, never a save/load round trip.
  // Save normalization drops transient buffs, pending scenes and cached values.
  function cloneTreePreview(value, seen) {
    if (value === null || typeof value !== 'object') return value;
    seen = seen || new WeakMap();
    if (seen.has(value)) return seen.get(value);
    var copy = Array.isArray(value) ? new Array(value.length) : Object.create(Object.getPrototypeOf(value));
    seen.set(value, copy);
    Object.keys(value).forEach(function(key) { copy[key] = cloneTreePreview(value[key], seen); });
    if (showSequences.has(value)) showSequences.set(copy,cloneTreePreview(showSequences.get(value),seen));
    return copy;
  }

  // Formula values, not a projected combat DPS or a promise about clear time.
  // All readers (including cache-writing readers) receive only the private copy.
  function treePreviewValues(state) {
    recompute(state, true);
    var area = wandArea(state), effects = nodeEffects(state);
    var values = {
      wandDamage: wandDamage(state),
      wandRate: wandRate(state),
      performance: state._V,
      mentalMax: state.mentalMax,
      coinMultiplier: state._coinMul,
      spawnMs: state._tau,
      boardCapacity: boardCapacity(state),
      areaCols: area.cols,
      areaRows: area.rows,
      equipSlots: equipSlots(state),
      helperSpeed: helperSpeed(state),
      fanCount: fanCount(state),
      colleagueCount: colleagueCount(state),
      colleagueDamage: colleagueDamage(state)
    };
    Object.keys(effects).forEach(function(key) { values['effects.' + key] = effects[key]; });
    DATA.tree.forEach(function(node) {
      var key = 'branch.' + node.branch;
      if (!(key in values)) values[key] = branchBonus(state, node.branch);
    });
    return values;
  }

  // amount follows buyAmount: 1 (default), 10, or 'max', bounded at 10000.
  // Only successful, affordable purchases count. Costs are gross prices, so
  // achievement rewards cannot disguise the amount spent. No state is returned.
  function treePreview(state, id, amount) {
    var copy = cloneTreePreview(state), known = Object.prototype.hasOwnProperty.call(NODE_BY_ID, id);
    var routine = DATA.bookLayout.routineAbilities.some(function(a) { return a.nodeId === id; });
    function purchaseInfo() {
      if (!routine) return known ? nodeInfo(copy, id) : {purchasable:false,cost:null,blockedReason:'알 수 없는 비법'};
      var shop = gemShopInfo(copy, id);
      return {purchasable:shop.available,currency:'gems',cost:shop.cost,blockedReason:shop.reason};
    }
    var info = purchaseInfo();
    var before = treePreviewValues(cloneTreePreview(copy));
    var count = 0, spent = {coins:0,keys:0,starlight:0,gems:0};
    var limit = amount === 'max' ? 10000 : amount === 10 ? 10 : 1;
    while (known && count < limit) {
      var next = purchaseInfo();
      if (!next.purchasable) break;
      // The opening is a purchase; an already open shop is just navigation.
      var opening = id === 'autoLearn' ? helperShopInfo(copy, 'assistant') : null;
      if (!(routine ? gemShopBuy(copy, id) : buyNode(copy, id))) break;
      if (opening) { spent.keys += opening.books; spent.gems += opening.cost; }
      else spent[next.currency] += next.cost;
      count++;
    }
    var after = count ? treePreviewValues(copy) : cloneTreePreview(before);
    var changes = {};
    Object.keys(before).forEach(function(key) {
      var delta = after[key] - before[key];
      if (!delta) return;
      changes[key] = {before:before[key],after:after[key],delta:delta,
        percent:before[key] === 0 ? null : delta / Math.abs(before[key]) * 100};
    });
    return {id:id,count:count,purchasable:!!info.purchasable,currency:info.currency || null,
      cost:info.cost,spent:spent,blockedReason:info.blockedReason || '',
      before:before,after:after,changes:changes};
  }
