'use strict';
  // v4 U42: shared formulas. The expression order matches the old inline copies exactly (float results must stay byte-identical).
  function caseHp(base, lv) { return base * Math.pow(1.12, lv - 1); }
  function xpNeed(state) { return CONST.xpBase + CONST.xpPerLevel * state.level; }
  function starGain(d) { return CONST.starGainBase + d; }
  function dealerCoinGrowthPow(state) { return Math.pow(CONST.dealerCoinGrowth, balanceRank(state.vMax) - 1); }
  function idleRates(saved) {
    var state=Object.assign({},saved,{_area:Object.assign({},saved._area||{}),skills:emptySkills(),features:JSON.parse(JSON.stringify(saved.features))});
    state.features.encoreLeft=0;
    state.u14=Object.assign({},saved.u14,{visitor:Object.assign({},saved.u14.visitor,{buff:0})});
    recompute(state,true);
    var t=state.tree,w=state.features.workers,m=state.features.magic, speed=helperSpeed(state);
    var area=wandArea(state), coverage=0;
    state.board.forEach(function(c,i){var p=cellPosition(state,i),col=Math.max(0,Math.min(5-area.cols,p.col-Math.floor((area.cols-1)/2))),row=Math.max(0,Math.min(5-area.rows,p.row-Math.floor((area.rows-1)/2)));state.board.forEach(function(c,j){var q=cellPosition(state,j);if(q.col>=col&&q.col<col+area.cols&&q.row>=row&&q.row<row+area.rows)coverage++;});});
    var dps=practiceRate(state)*coverage/Math.max(1,state.board.length);
    dps+=(!w.fanPaused?fanCount(state)*.35*speed/(nodeEffects(state).helperEvery/1000):0)*(1+.15*t.fanPower)*branchBonus(state,'pet');
    dps+=(t.assistant&&!w.assistantPaused?.8*speed/1.2:0)*(1+.15*t.fanPower)*branchBonus(state,'pet');
    if(t.sponge&&!m.paused.sponge)for(var b=0;b<Math.min(3,1+t.spongeCount);b++)dps+=Math.hypot(310+b*40,230+b*50)/120*(state.board.length/25)*.25*(1+.15*t.spongePower)*(1+.12*t.spongeSpeed)*speed;
    if(t.cardthrow&&!m.paused.cardthrow)dps+=Math.min(4,1+t.cardthrowCount)*.4*(1+.15*t.cardthrowPower)*speed/(1.5*(1-.1*t.cardthrowSpeed));
    if(t.spotlight&&!m.paused.spotlight){var rows=new Set(state.board.map(function(c,i){return cellPosition(state,i).row;})).size;dps+=Math.min(rows,2,1+t.spotlightCount)*state.board.length/Math.max(1,rows)*.6*(1+.15*t.spotlightPower)*speed/(4*(1-.1*t.spotlightSpeed));}
    var perCell=dps*wandDamage(state)*gearMultiplier(state,"open")/Math.max(1,state.board.length), xp=[], coins=0;
    var rarityMean=CONST.rarityW.reduce(function(n,w,i){return n+w*CONST.rarityMult[i];},0)/CONST.rarityW.reduce(function(a,b){return a+b;},0);
    var weights=DATA.items.types.map(function(k){var weight=k.share*100;if(k.id==='coin')weight+=t.coinLuck*statMultiplier(state,'coinLuck')*CONST.coinLuckAdd;if(t.equip)weight*=Math.pow(1+CONST.equipWeightPerItem,state.features.equipped.filter(function(id){return itemType(id)===k;}).length);return weight;});
    var totalShare=weights.reduce(function(a,b){return a+b;},0), coinShare=DATA.items.types.reduce(function(n,k,i){return n+(k.effect==='coins'?weights[i]:0);},0)/totalShare;
    state.board.forEach(function(c){
      var hp=caseHp(state._boxHp,c.lv||1);
      var opens=perCell>0?1/(hp/perCell+state._tau/1000):0;
      xp.push(c.lv<caseCap(state)?opens*(1+.15*t.caseXp):0);
      coins+=opens*(Math.max(1,Math.round(CONST.coinPerBox*state._coinMul))+caseItems(c.lv||1)*coinShare*CONST.itemCoins*rarityMean*state._coinMul*Math.pow(1.1,(c.lv||1)-1)*milestoneMultiplier(c.lv||1,[10,25,50])*branchBonus(state,'box')*caseItemBonus(state));
    });
    if(t.tipbox&&!m.paused.tipbox)coins+=(2+legacyRank(state.venue))*(1+.25*t.tipboxPower)*speed/(6*(1-.1*t.tipboxSpeed));
    if(t.rabbit&&!state.features.helperPaused)coins+=nodeEffects(state).rabbitCoins/(nodeEffects(state).rabbitEvery/1000);
    // A tiny rehearsal stipend is available before the first helper.
    if(!dps)coins=.01;
    return {coins:coins,xp:xp};
  }
  function offlineGain(state,now) {
    var zero={awayMs:0,coins:0,xp:state.board.map(function(){return 0;})};
    if(!Number.isFinite(now)||!state.idle.wallMs||now-state.idle.wallMs<60000)return zero;
    var ms=Math.min(now-state.idle.wallMs,(8+state.tree.nightShow)*3600000), eff=.7+.1*state.tree.manager /* v4 U51 6: base 70% (was 50%), 매니저 계약 max 3 = 100% */, rates=idleRates(state);
    return {awayMs:ms,coins:Math.min(1e18,Math.floor(rates.coins*ms/1000*eff)),xp:rates.xp.map(function(x,i){var c=state.board[i],remaining=0;for(var lv=c.lv;lv<caseCap(state);lv++)remaining+=caseNeed(lv);remaining=Math.max(0,remaining-(c.xp||0));return Math.min(remaining,x*ms/1000*eff);})};
  }
  function collectOffline(state,now) {
    var gain=offlineGain(state,now);
    if(!Number.isFinite(now)||now<state.idle.wallMs)return gain;
    state.idle.wallMs=now;
    if(!gain.awayMs)return gain;
    earnCoins(state,gain.coins);state.u14.visitor.incomeCoins=Math.max(0,state.u14.visitor.incomeCoins-gain.coins);dailyProgress(state,'offline',1);var levels=0;
    state.board.forEach(function(c,i){if(c.lv>=caseCap(state))return;c.xp+=gain.xp[i];while(c.lv<caseCap(state)&&c.xp>=caseNeed(c.lv)){c.xp-=caseNeed(c.lv);c.lv++;levels++;}if(c.lv>=caseCap(state))c.xp=0;});
    state.idle.reward={awayMs:gain.awayMs,coins:gain.coins,levels:levels,doubled:false};
    checkAchievements(state,null);
    return gain;
  }
  function doubleOffline(state) { var r=state.idle.reward;if(!r||r.doubled)return false;earnCoins(state,r.coins);state.u14.visitor.incomeCoins=Math.max(0,state.u14.visitor.incomeCoins-r.coins);r.doubled=true;checkAchievements(state,null);return true; }

  function emptyStars() {
    return { trick: 0, guard: 0, tempo: 0, bounty: 0 };
  }

  function emptyTree() {
    var tree = {};
    TREE_KEYS.forEach(function (id) { tree[id] = id === "root" ? 1 : 0; });
    return tree;
  }

  function emptyFeatures() {
    return { elapsedMs: 0, goldMs: CONST.goldFirstMs, goldPending: false, goldCell: -1,
      helperMs: CONST.helperEveryMs, helperCursor: 0, dovePaused: false, helperPaused: false,
      encoreMs: CONST.encoreEveryMs, encoreLeft: 0, comboPaid: {},
      collected: [], equipped: [], legacyProductCollection: [],
      workers: { fanPaused: false, assistantPaused: false, fanCursor: 0, assistantCursor: 0, actors: [] },
      magic: { timers: {}, paused: {}, balls: [], papers: [], cursor: 0, clock: 0 }, rewards: [], guide: "idle", climax: { paradeDone: false, left: 0, mirrorMs: 15000, mirrored: [], confidence: 0, milestone: 0 },
      damage: { manual: 0, fan: 0, assistant: 0, chain: 0, magic: 0 }, progress: { comboMax: 0, dealerFlips: 0, coinsEarned: 0, goldenOpened: 0, runBoxes: 0, finales: 0, fevers: 0, crits: 0, cupsWins: 0, monteWins: 0, montePerfects: 0, mentalClutches: 0, bossLossVenue: 0, bossLossStreak: 0, tapStreak: 0, tapStreakMax: 0 }, achievements: [], boxes: 0, helperBreaks: 0,
      reveals: [], revealQueue: [], revealMs: 0 };
  }

