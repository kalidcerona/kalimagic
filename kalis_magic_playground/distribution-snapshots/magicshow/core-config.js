'use strict';
  var DATA = (typeof globalThis !== "undefined" ? globalThis : this).GAME_DATA;
  if (!DATA || !DATA.venues) throw new Error("GAME_DATA missing");

  var CONST = {
    revealGapMs: 8000,
    goldFirstMs: 30000, goldHpMultiplier: 1.5, goldCoinBase: 20,
    comboThresholds: [10, 25, 50, 100], comboGaugeRewards: [1, 1, 2, 2], comboCoinRewards: [2, 4, 8, 16],
    helperEveryMs: 2000,
    equipBaseSlots: 3, equipMaxSlots: 9, equipTypeLimit: 3, equipWeightPerItem: 0.02,
    achievementVPer: 0.005,
    achievementVPerNew: 0.002, // Simulation will tune new achievement rewards.
    encoreEveryMs: 300000,
    spawnBase: 0.35,
    spawnGrowth: 1.08,
    boxHpBase: 100,
    boxHpGrowth: 1.25,
    boxLevelDiv: 3,
    wandBase: 25,
    wandGrowth: 1.1,
    tapBase: 3,
    tapPerSpeed: 0.12,
    tapCap: 4.6,
    // A new press is stronger than holding. The simulation will tune these.
    tapPower: 2.4,
    holdPower: 0.6,
    Vbase: 1.3,
    Vattack: 1.05,
    Vlevel: 0.00133,
    Ubase: 1.42,
    mentalBase: 40,
    mentalGrowth: 1.18,
    shieldRatio: 0.48,
    xpPerBox: 1,
    xpBase: 20,
    xpPerLevel: 10,
    levelHeal: 0.16,
    audHpBase: [340, 400, 550, 750],
    audHpGrowth: 1.95,
    audHpMul: 1,
    audAtkBase: [3, 5, 7, 11],
    audAtkGrowth: 1.3,
    audAtkMul: 0.45,
    intervalBase: 1.5,
    intervalPerJ: 0,
    intervalPerV: 0,
    intervalMin: 1.5,
    telegraphMs: 600,
    mentalVisibleEvery: 2, mentalVisibleHit: 0.075, mentalVisibleAbsorb: 0.8,
    mentalVisibleMs: 500, mentalVisibleRegen: 0.005,
    winTransitionMs: 2500,
    // s5d (owner 10-23 decision 12): 미래의 칼리 enters gently and the player wins narrowly. One row per phase (1-3): atk = one heckle as a
    // share of max 멘탈, interval = seconds between heckles. firstHeckleMs = the wait after the opening telegraph before the first heckle.
    // The visible-hit rule (mentalVisible*) also has a row per phase here: every Nth heckle hits at least visibleHit of max 멘탈, the
    // 자신감 shield takes visibleAbsorb of it, and 멘탈 recovery stays capped for visibleMs after it (so the drop stays on screen).
    // Phase 1 keeps the global numbers (a gentle entry). In phases 2 and 3 every heckle is visible and the cap outlasts the 1.5 s gap
    // (and one 야유 막기), so 멘탈 runs down slowly instead of refilling at once: it was 98-100 percent at every win before (the late
    // 자신감 and recovery soak any plain heckle), and a bigger plain heckle only switched from "never hurt" to "sudden loss".
    // retryEase: each loss in a row at this table lowers the phase 2-3 visible hit by that share, down to that share (gate rule U41 alike).
    // retryHp (owner Q 11-1 ①, 10-28): after a loss to 미래의 칼리 (bossLossStreak at this venue >= 1) the next entry's 기대 is that share
    // of the first try's, so a loss plus the retry stays near the first try's length; the first try is unchanged (streak 0).
    future: { firstHeckleMs: 1500, atk: [0.0046875, 0.0046875, 0.0046875], interval: [1.5, 1.5, 1.5],
      visibleEvery: [2, 1, 1], visibleHit: [0.075, 0.055, 0.095], visibleAbsorb: [0.8, 0.7, 0.7], visibleMs: [500, 3200, 3200], retryEase: 1 / 3, retryHp: 0.65 },
    // v4 U45: test-season number. applySaveEpoch wipes progress ONCE per device when this is higher than the stored magicShowBuster.epoch.
    // Keep it at 1: later releases then keep every player's progress. Raise it only when the owner asks for another fresh start.
    saveEpoch: 1,
    winHeal: 0.2,
    comboResetMs: 2000,
    finisherNeed: 20,
    finisherDmg: 22,
    colleagueEvery: 5000,
    colleagueDmg: 2,
    coinPerBox: 1,
    winCoinBase: 10,
    winCoinGrowth: 1.32,
    itemFlightMs: 240,
    flightCap: 1024,
    itemDamage: 8,
    itemShield: 0.54,
    itemHeal: 1.8,
    itemCoins: 8, // v4 U48: was 4. With 비법 learned only after a failure the build grows only from saved coins, so case coins pay twice as much (SPEC "v4 U48").
    rarityW: [70, 22, 6.5, 1.4, 0.1],
    rarityMult: [1, 2, 4, 10, 25],
    rarityIds: ["common", "rare", "hero", "legend", "myth"],
    gemChance: [0, 0.02, 0.05, 0.12, 0.3],
    nodeBase: { power: 120, attack: 45, mental: 30, spawn: 35, speed: 60 },
    coinLuckAdd: 6,
    boardCosts: [40, 120, 300, 700, 1600, 3500, 7500, 15000, 30000, 55000, 90000, 140000],
    legacyCaps: [1, 2, 4, 6, 9, 12, 16, 25],
    boardCols: 5, boardRows: 5, boardMax: 25, boardNodeMax: 12,
    boardSize: 608, boardInset: 8, cellSize: 112, cellGap: 8,
    slotUnlockSpawnMs: 350, slotRevealStaggerMs: 120,
    slotOrder: [12, 13, 18, 17, 11, 16, 6, 7, 8, 9, 14, 19, 24, 23, 22, 21, 1, 2, 3, 4, 0, 5, 10, 15, 20],
    areaCosts: [90, 8000, 16000, 18000, 6000, 15000, 35000, 90000],
    areaNeeds: [2, 5, 5, 6, 9, 12, 16, 25],
    areaVenueNeeds: DATA.areaVenueSlugs,
    areas: [[1, 1], [2, 1], [3, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 5]],
    bestiaryWins: 3,
    bestiaryDmg: 0.03,
    bestiaryU: 0.1,
    cardMin: 3,
    cardMax: 5,
    dealerCoinGrowth: 1.35,
    // v4 U37: the dealer now visits only after a failed stage, so what it pays is multiplied. Income based games (cups, monte) are capped
    // at dealerCapSeconds of the player's coin income per payout so one visit cannot skip a stage.
    dealerRewardMult: 2.5,
    dealerCapSeconds: 600,
    forceGemCost: 3,
    doveEvery: 3000,
    doveDamage: 4,
    rabbitEvery: 5000,
    flashEvery: 25,
    flashDamage: 8,
    slotCoin: 40,
    slotGem: 1,
    slowTap: 0.72,
    slowSpawn: 1.4,
    sealDur: 8000,
    sealEvery: 14000,
    stealPct: 0.04,
    patternHealPct: 0.0025,
    patternHealEvery: 9000,
    // v4 U38: a show ends as a failure when doubt has not gone below its lowest point for this long (a stall, e.g. gate pressure out-healing the player).
    stallMs: 75000,
    // v4 U48 A2: 칼리 덱 한 브릭 (a box of 12 decks): 30 minutes of auto practice for brickGems gems (a single deck is 2 gems for 120 s).
    // gloveLeftMax is the saved cap of the running auto-practice time (two bricks and a deck); save version 20.
    brickGems: 20, brickMs: 1800000, gloveLeftMax: 3720000,
    // v4 U41: node levels a gate asks the player to learn after first meeting it (the old fixed number; see gateNeed for the cap).
    gatePrep: 30,
    // v4 U41: failed shows at one gate that remove its pressure completely (each one removes 1/gateFailSteps).
    gateFailSteps: 3,
    // v4 U38: the final boss's last heckle. When its doubt falls to 30 percent (act 3) the next heckle is this one: a fixed, announced size that the
    // mental and 자신감 of a build without the tail of 무대 배짱 (levels 11 to 15) cannot soak up (281k + 169k at the final boss, so 450k), the full build can
    // (644k mental alone), and 야유 막기 cancels outright. finalHeckleWarnMs is the pause that announces it.
    finalHeckle: 560000,
    finalHeckleWarnMs: 4000,
    missChance: 0.22,
    phase2At: 0.75,
    phase2Hp: 0.12,
    bossHpMult: 0.8,
    starGainBase: 3,
    starTrick: 1.4,
    starWand: 1.14,
    starGuard: 1.18,
    starTempoRate: 1.06,
    starTempoTau: 0.92,
    starCoin: 1.12,
    substepMs: 50,
    maxSubsteps: 2000,
    loopCap: 128
  };

  // Every localStorage key the game writes, in one place (12-107 S4). The strings never change: existing saves, backups, slots and
  // settings on players' devices are found by these exact names. The sound module keeps its own copies of .sound and .music.
  var SAVE_KEYS = Object.freeze({
    main: "magicShowBuster.v3",
    backupPrefix: "magicShowBuster.v3.backup.",
    keepPrefix: "magicShowBuster.v3.keep.",
    epoch: "magicShowBuster.epoch",
    preResetPrefix: "magicShowBuster.preReset.",
    slotPrefix: "magicShowBuster.slot.",
    presentation: "magicShowBuster.v3.presentation",
    sound: "magicShowBuster.v3.sound",
    music: "magicShowBuster.v3.music"
  });

  // Fight-local recovery budget is transient, so the save shape stays unchanged.
  var MENTAL_VISIBILITY = new WeakMap();
  function tickMentalRecovery(state, dt) {
    var v = MENTAL_VISIBILITY.get(state);
    if (!v) return;
    v.capped = v.left > 0;
    v.budget = state.mentalMax * CONST.mentalVisibleRegen * gearMultiplier(state,"recovery") * Math.min(dt, v.left) / 1000;
    v.left = Math.max(0, v.left - dt);
  }
  function autoHeal(state, amount) {
    var v = MENTAL_VISIBILITY.get(state);
    amount = Math.max(0, Math.min(amount * gearMultiplier(state,"recovery"), state.mentalMax - state.mental));
    if (v && v.capped) { amount = Math.min(amount, v.budget); v.budget -= amount; }
    state.mental = Math.min(state.mentalMax, state.mental + amount);
  }

