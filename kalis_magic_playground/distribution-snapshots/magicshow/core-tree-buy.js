'use strict';
  // v4 U48 C: a node with more than 10 levels (or a max outside 1, 3, 5, 10) is shown in the book as several nodes (data.js "v4 U48 C"):
  // the original node is part I (n.levels = the old total, n.max = the part size) and each later part has partOf (the original id) and
  // partOffset. The save keeps ONE number under the original key (state.tree[id] or state.stars[key]) = the total level, exactly as before,
  // so every effect formula and every old save is unchanged; a part's own level is the slice of that total that falls into its range.
  function baseNode(node) { return node.partOf ? NODE_BY_ID[node.partOf] : node; }
  function storedLevel(state, node) { var b = baseNode(node); return (b.starKey ? state.stars[b.starKey] : state.tree[b.id]) || 0; }
  function treeMax(id) { var n = NODE_BY_ID[id]; return n.levels || n.max; }
  function nodeLevel(state, node) {
    if (!node.partOf && !node.levels) return node.starKey ? state.stars[node.starKey] : state.tree[node.id];
    return Math.max(0, Math.min(node.max, storedLevel(state, node) - (node.partOffset || 0)));
  }
  // The part of a split node the player learns next (the original id for an unsplit node; the last part when all are full).
  function activePart(state, id) { var b = NODE_BY_ID[id]; if (!b || !b.parts) return id; for (var i = 0; i < b.parts.length; i++) if (nodeLevel(state, NODE_BY_ID[b.parts[i]]) < NODE_BY_ID[b.parts[i]].max) return b.parts[i]; return b.parts[b.parts.length - 1]; }
  function fullyLearned(state, id) { return storedLevel(state, NODE_BY_ID[id]) >= treeMax(id) || (id === "board" && boardCapacity(state) >= CONST.boardMax); }

  // v4 U38: every finite coin/key node is at its last level (star nodes are a separate track, pending nodes cannot be learned yet).
  function allLearned(state) {
    return DATA.tree.every(function (n) {
      return n.starKey || n.shopOnly || n.pending || nodeLevel(state, n) >= n.max || (baseNode(n).id === "board" && boardCapacity(state) >= CONST.boardMax);
    });
  }
  function branchMaxed(state, node) { return (node.branchMax || []).every(function(id) { return fullyLearned(state, id); }); }
  function gateProgress(state, gate) {
    if (!gate) return null;
    var current = gate.type === 'venue' ? (reached(state,gate.slug) ? 1 : 0) : gate.type === 'casesAtLv' ? state.board.filter(function(c){return (c.lv||1)>=gate.lv;}).length : state.features.progress[gate.type] || 0;
    var label = {venue:'공연장 도착',casesAtLv:'LV '+gate.lv+' 케이스 수',comboMax:'최고 액트',dealerFlips:'컵앤볼·카드 몬테 성공',coinsEarned:'차원 누적 동전',goldenOpened:'황금 케이스 개봉'}[gate.type];
    var target = gate.type === 'venue' ? 1 : gate.target;
    if (gate.type === 'venue') return {current:current,target:target,met:!!current,text:VENUES[venueNumber(gate.slug)-1].name+' 도착 필요'};
    return {current:current,target:target,met:current>=target,text:'조건: '+label+' ('+formatNumber(current)+'/'+formatNumber(gate.target)+')'};
  }
  function nodeInfo(state, id) {
    var node = NODE_BY_ID[id];
    if (!node || !state || !state.tree) return { level: 0, max: 0, currency: "coins", cost: null, revealed: false, purchasable: false, blockedReason: "알 수 없는 비법" };
    // v4 U48 C: for a split node, cost, gates and the area/board rules read the stored total level (the same index as before the split).
    var base = baseNode(node), bid = base.id, split = !!(node.partOf || node.levels);
    var level = nodeLevel(state, node), total = split ? storedLevel(state, node) : level, cost = null;
    if (level < node.max) cost = Array.isArray(node.cost) ? node.cost[total] : Math.ceil(node.cost.c * Math.pow(node.cost.g, total));
    if(cost!==null)cost=Math.ceil(cost*gearMultiplier(state,"price"));
    var revealed = id === "root" || (node.reveal === "E" ? state.endings.length > 0 : level > 0 || node.prereqs.some(function (pre) { return nodeLevel(state, NODE_BY_ID[pre]) > 0; }));
    if (node.u13 && (bid==='autoPractice' || /Cooldown$/.test(bid))) revealed = level>0 || (bid==='autoPractice' ? practiceUnlocked(state) : skillUnlocked(state,bid.replace('Cooldown','')));
    if (node.hidden) revealed = level > 0 || branchMaxed(state,node);
    // v4 U44: a 칼리 product is discovered by reaching its venue (no chain of earlier products is needed); its prereqs only draw the book lines.
    // v4 U45: every 칼리 컬렉션 node (branch collection: the nine wall products, 칼리 덱 and 틴 케이스) follows that rule.
    if (node.branch === "collection") revealed = level > 0 || reached(state, node.venueSlug);
    if (id === "autoLearn") revealed = false; // v4 U47 10: retired node (kept in the data and in saves, never offered)
    // v4 U48 C: a later part shows up once the part before it is full.
    if (node.partOf) revealed = level > 0 || (total >= node.partOffset && (node.reveal !== "E" || state.endings.length > 0));
    if(node.shopOnly)revealed=false;
    var progress = gateProgress(state,node.gates ? node.gates[total] : node.gate);
    var reason = "";
    if (node.shopOnly) reason = "실크 상점에서 살 수 있어요";
    else if (level >= node.max) reason = "최대 레벨";
    else if (node.reveal === "E" && !state.endings.length) reason = "첫 멀티버스 공연 완료";
    else if (!revealed) reason = "아직 발견하지 못한 비법";
    else if (progress && !progress.met) reason = progress.text;
    else if (node.pending) reason = "준비 중";
    else if (node.partOf && total < node.partOffset) reason = "선행 비법 필요: " + NODE_BY_ID[node.prereqs[0]].name;
    else if (node.branch !== "collection" && !node.prereqs.every(function (pre) { return nodeLevel(state, NODE_BY_ID[pre]) > 0; })) reason = "선행 비법 필요: " + node.prereqs.filter(function (pre) { return nodeLevel(state, NODE_BY_ID[pre]) < 1; }).map(function (pre) { return NODE_BY_ID[pre].name; }).join(", ");
    else if (node.venueSlug && !reached(state,node.venueSlug)) reason = VENUES[venueNumber(node.venueSlug)-1].name + " 도착 필요";
    else if (bid === "area" && !reached(state,CONST.areaVenueNeeds[total])) reason = VENUES[venueNumber(CONST.areaVenueNeeds[total])-1].name + " 도착 필요";
    else if (bid === "area" && boardCapacity(state) < CONST.areaNeeds[total]) reason = "케이스 자리 " + CONST.areaNeeds[total] + "칸 필요";
    else if (bid === "board" && boardCapacity(state) >= CONST.boardMax) reason = "케이스 자리 25칸 완성";
    else if (state[node.currency] < cost) reason = ({ coins: "동전", keys: "책", starlight: "비둘기" })[node.currency] + " 부족";
    // Dimension 2+: stage, trophy and reveal locks no longer hide a 비법. Costs and prerequisites stay.
    if ((state.dimension | 0) >= 2 && id !== "autoLearn" && !node.shopOnly && !node.pending && !(node.partOf && total < (node.partOffset || 0))) {
      revealed = true;
      var gateLock = reason === "아직 발견하지 못한 비법" || reason === "첫 멀티버스 공연 완료" || (progress && reason === progress.text) || /도착 필요$/.test(reason);
      if (gateLock) reason = state[node.currency] < cost ? (({ coins: "동전", keys: "책", starlight: "비둘기" })[node.currency] || "재화") + " 부족" : "";
    }
    return { level: level, max: node.max, total: total, totalMax: treeMax(bid), gate:progress, currency: node.currency, cost: cost, revealed: revealed, purchasable: !reason, blockedReason: reason };
  }

  // Numeric price contract, null for unavailable upgrades. Wallet is checked by buyNode.
  function nodeCost(state, id) {
    var info = nodeInfo(state, id);
    if (info.cost == null || (info.blockedReason && !info.blockedReason.endsWith(" 부족"))) return null;
    return info.cost;
  }

  function buyNode(state, id) {
    var info = nodeInfo(state, id), part = NODE_BY_ID[id];
    if (!info.purchasable) return false;
    // v4 U48 C: learning a part of a split node raises the one stored total under the original id; the rest below sees that id.
    var node = baseNode(part); id = node.id;
    state[info.currency] -= info.cost;
    if (node.starKey) state.stars[node.starKey]++;
    else state.tree[id]++;
    routineLearn(state,node);dailyProgress(state,'learn',1);checkSets(state,null);
    if (id === "dove") state.doveMs = nodeEffects(state).doveEvery;
    if (id === "rabbit") state.rabbitMs = nodeEffects(state).rabbitEvery;
    if (id === "flash") state.flashBreaks = 0;
    if (node.statMilestone && [10,25].indexOf(storedLevel(state,node))>=0) state.idle.milestones.push(id);
    recompute(state, false);
    if (id === "board") { ensureBoard(state); reveal(state, "slot"); }
    if (id === "area") reveal(state, "area");
    if (id === "dove" || id === "rabbit" || id === "boxHelper" || id === "assistant") reveal(state, id);
    if (id === "boxHelper" || id === "assistant") syncWorkers(state);
    if (id === "equip") {
      if (state.features.guide !== "done") { state.features.guide = "place"; state.features.equipped = []; }
      else state.features.collected.forEach(function (item) { if (state.features.equipped.length < CONST.equipBaseSlots) equipItem(state,item); });
      reveal(state, "equip");
    }
    DATA.tree.forEach(function(n){ if(n.hidden && branchMaxed(state,n)) reveal(state,'hidden:'+n.id); });
    checkAchievements(state,null);
    return true;
  }
  function buyMany(state, id) { var n=0; while(n<10000 && buyNode(state,id)) n++; return n; }

  // U12 bulk purchases always re-evaluate visibility, gates and wallets.
  function affordableNodes(state) {
    return DATA.tree.filter(function (n) {
      if (n.currency !== "coins" || n.starKey || n.pending) return false;
      var i = nodeInfo(state,n.id);
      return i.revealed && i.purchasable && Number.isFinite(i.cost) && i.cost > 0;
    }).sort(function (a,b) {
      return nodeInfo(state,a.id).cost-nodeInfo(state,b.id).cost || a.id.localeCompare(b.id);
    });
  }
  function buyAll(state) {
    var count = 0, ids = [], choice;
    while (count < 10000 && (choice = affordableNodes(state)[0])) {
      if (!buyNode(state,choice.id)) break;
      count++; ids.push(choice.id);
    }
    return {count:count,ids:ids};
  }
  function buyAmount(state,id,amount) {
    var count = 0, limit = amount === "max" ? 10000 : amount === 10 ? 10 : 1;
    while (count < limit && buyNode(state,id)) count++;
    return count;
  }
  function tickAutoLearn(state,dt,ev) {
    // v4 U47 10: auto-learn is off for everyone (the player picks 비법 after a failure). A saved learning.on = true still loads (same field, same validator) and is treated as off.
    if (true) return;
    state.learning.ms += dt;
    if (state.learning.ms >= 3000) {
      state.learning.ms %= 3000;
      var result = buyAll(state);
      if (result.count) emit(ev,{type:"learnAll",count:result.count});
    }
  }
  // Pure per-pointer clocks. Moving and adding another finger never reset a clock.
  function holdPointers(list,action) {
    var next = list.map(function (p) { return Object.assign({},p); });
    var i = next.findIndex(function (p) { return p.id === action.id; });
    if (action.type === "clear") return [];
    if (action.type === "up") return next.filter(function (p) { return p.id !== action.id; });
    if (action.type === "down" && i < 0 && next.length < 3) next.push({id:action.id,x:action.x,y:action.y,left:0});
    if (action.type === "move" && i >= 0) { next[i].x=action.x; next[i].y=action.y; }
    return next;
  }
  function advanceHolds(list,dt,rate) {
    var pulses = [], period = 1000 / Math.max(0.01,rate);
    var holds = list.slice(0,3).map(function (p) {
      var q = Object.assign({},p); q.left -= Math.max(0,dt);
      while (q.left <= 0) { pulses.push({id:q.id,x:q.x,y:q.y}); q.left += period; }
      return q;
    });
    return {holds:holds,pulses:pulses};
  }
  var TUTORIAL_ACTIONS = ["hold","badge","doubt","heckle","learn","buyAll","goal","win"];
  function tutorialAction(state,action) {
    var t = state.onboarding;
    if (TUTORIAL_ACTIONS.indexOf(action)<0 || t.step>=8) return false;
    if (t.facts.indexOf(action)<0) t.facts.push(action);
    var before=t.step;
    while (t.step<8 && t.facts.indexOf(TUTORIAL_ACTIONS[t.step])>=0) t.step++;
    return before!==t.step;
  }

  function starCost(state, id) {
    if (STAR_KEYS.indexOf(id) < 0) return null;
    var lv = state.stars[id] | 0;
    if (lv >= 30) return null;
    if (id === "trick") return 1;
    return 2;
  }

  function buyStar(state, id) {
    var node = DATA.tree.find(function (n) { return n.starKey === id && !n.partOf; });
    return node ? buyNode(state, activePart(state, node.id)) : false;
  }

