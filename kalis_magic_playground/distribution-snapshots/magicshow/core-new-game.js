'use strict';
  function rebirth(state) {
    if(state.batchD.side||state.batchD.encore.phase==='round'||state.batchD.twist.scene&&!state.batchD.twist.complete)return state;
    var keepCoins = Math.floor(state.coins / 2), keepGems = Math.floor(state.gems / 2), keepKeys = Math.floor(state.keys / 2);
    if(state.batchD.multiverseCleared){state.batchD.ifRoute=true;state.batchD.permanentBonus=Math.max(DATA.batchD.rebirth.permanentBonus,state.batchD.permanentBonus);}
    state.batchD.encore={phase:'',reward:0,left:0};state.batchD.rebirthOffer=false;state.batchD.interference={cell:-1,left:0,clock:0,kind:''};state.batchD.twist.scene='';
    var d = state.dimension | 0;
    if (d < 1) d = 1;
    var gain = starGain(d);
    if (gain < 1) gain = 1;
    addGain(state, 'starlight', gain, 100000);
    var i;
    var has = false;
    if (state.mode === "ending" || state.seenEnding) {
      for (i = 0; i < state.endings.length && i < CONST.loopCap; i++) if (state.endings[i] === d) has = true;
      if (!has && state.endings.length < CONST.loopCap) state.endings.push(d);
    }
    state.dimension = d + 1;
    state.u15.gloves=0;state.u15.gloveLeft=0;state.u15.deckOn=false;state.u15.drops={};state.u15.positions=CONST.slotOrder.slice();state.u15.scene=null;state.u15.queue=[];
    state.u19=emptyU19();state.u18.anchor=null;state.u18.challenge=null;state.u18.map=false;state.u18.fans=[];state.u18.sets=[];
    state.u14.satisfied=[];state.u14.sets=[];state.u14.collection=false;state.u14.visitor=emptyU14().visitor;state.u14.visitor.wait=90000+Math.floor(rngNext(state)*60001);
    state.seenEnding = false;
    state.level = 0;
    state.homecomingCleared = false; state.visited = []; state.helpersUsed = [];
    state.coins = 0;
    state.gems = 0;
    state.u17=emptyU17();state.u19b={gates:{},dealerOffer:false,failedId:'',dealerVisits:0};
    state.keys = 0;
    state.vMax = 1;
    state.legacySlots = 0;
    state.wins = 0;
    state.fails = 0;
    state.winsSinceDealer = 0;
    var reveals = state.features.reveals.slice(), guideDone = state.features.guide === "done";
    state.features = emptyFeatures(); state.features.reveals = reveals;
    if (guideDone) state.features.guide = "done";
    state.tree = emptyTree();
    state.skills=emptySkills(); state.idle.reward=null; state.idle.waiting=false; state.idle.autoAcc=0; state.idle.cursor=0; state.idle.milestones=[];
    state.bestiary = emptyBestiary();
    state.trophies = {};
    state.invited = {};
    state.removedCount = 0;
    state.board = [{ lv: 1, xp: 0, hp: 0, hpMax: 0, spawn: 350, sealed: false }];
    state.flights = [];
    state.dealer = null;
    recompute(state, true);
    state.mental = state.mentalMax;
    restartRun(state);
    reconcileAchievements(state);
    state.coins = keepCoins;
    state.gems = keepGems;
    state.keys = keepKeys;
    return state;
  }

  function fresh(seed) {
    seed = seed >>> 0;
    var state = {
      batchD: emptyBatchD(),
      u15: emptyU15(),
      u14: emptyU14(),
      features: emptyFeatures(),
      idle: emptyIdle(), skills: emptySkills(), u17: emptyU17(), u18: emptyU18(), u19: emptyU19(), u19b: {gates:{},dealerOffer:false,failedId:'',dealerVisits:0},
      seed: seed,
      rngState: seed >>> 0,
      dimension: 1,
      starlight: 0,
      stars: emptyStars(),
      endings: [],
      seenEnding: false,
      guidance: { seen: [] },
      onboarding: { intro: false, panel: 0, step: 0, facts: [] },
      learning: { on: false, ms: 0 },
      homecomingCleared: false, visited: [], knownAudiences: [], helpersUsed: [], review: emptyReview(),
      coins: 0,
      gems: 0,
      keys: 0,
      tree: emptyTree(),
      vMax: 1,
      legacySlots: 0,
      venue: 1,
      crowd: VENUES[venueNumber("family")-1].crowd,
      j: 1,
      audId: "",
      audHp: 0,
      audHpMax: 1,
      atk: 1,
      interval: 4,
      mental: 0,
      mentalMax: 0,
      shield: 0,
      level: 0,
      xp: 0,
      combo: 0,
      doveMs: CONST.doveEvery,
      rabbitMs: CONST.rabbitEvery,
      flashBreaks: 0,
      comboMs: 0,
      maxCombo: 0,
      finisher: 0,
      finisherFired: false,
      fightMs: 0,
      tookMental: false,
      phase2: false,
      pattern: "none",
      slow: false,
      miss: 0,
      pHeal: false,
      sealCell: -1,
      sealMs: 0,
      sealCd: 0,
      patternHealMs: CONST.patternHealEvery,
      heckleMs: 4000,
      telegraphed: false,
      mode: "fight",
      transMs: 0,
      after: "fight",
      dealerQueued: false,
      winsSinceDealer: 0,
      wins: 0,
      fails: 0,
      buff: 0,
      removedCount: 0,
      tapAcc: 0,
      holding: false,
      resolved: false,
      board: [{ lv: 1, xp: 0, hp: 0, hpMax: 0, spawn: 0, sealed: false }],
      flights: [],
      bestiary: emptyBestiary(),
      trophies: {},
      invited: {},
      dealer: null
    };
    return state;
  }

  function newGame(seed) {
    if (typeof seed !== "number" || !isFinite(seed)) seed = 1;
    var state = fresh(seed >>> 0);
    state.u15.bios.push('lesson:v1');
    state.u14.visitor.wait=90000+Math.floor(rngNext(state)*60001);
    recompute(state, true);
    state.mental = state.mentalMax;
    fillBox(state, state.board[0]);
    var start = firstOpen(state);
    beginAudience(state, start.v, start.j, null);
    state.mode = "fight";
    return state;
  }

  function dealerSnap(d) {
    if (!d) return null;
    var cards = [];
    var i;
    for (i = 0; i < d.cards.length && i < 8; i++) {
      cards.push({ open: !!d.cards[i].open, dud: !!d.cards[i].dud, prize: d.cards[i].prize || "" });
    }
    var banned = [];
    for (i = 0; i < SYMBOLS.length; i++) if (d.banned && d.banned[SYMBOLS[i].id]) banned.push(SYMBOLS[i].id);
    return {
      phase: d.phase,
      cards: cards,
      risk: d.risk,
      banned: banned,
      grid: d.grid.slice(0, 9),
      spun: !!d.spun, games: d.games || {cups:null,monte:null}
    };
  }

  function featureSnap(features) {
    var f = JSON.parse(JSON.stringify(features));
    for (var key of ["elapsedMs", "goldMs", "helperMs", "encoreMs", "encoreLeft", "revealMs"]) f[key] = savedTimer(features[key], 1e12);
    f.workers.actors.forEach(function (a) { a.remainingMs = savedTimer(a.remainingMs, 300); a.cycleRemainingMs = savedTimer(a.cycleRemainingMs, 4000); });
    return f;
  }

