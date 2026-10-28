'use strict';
  var LEGACY_KEYS = ["power", "attack", "mental", "spawn", "speed", "board", "area", "coinLuck", "startFinale", "forceRemove", "dove", "rabbit", "flash"];
  var TREE_KEYS = DATA.tree.filter(function (n) { return !n.starKey && !n.partOf; }).map(function (n) { return n.id; }); // v4 U48 C: parts are not saved
  var NODE_BY_ID = Object.create(null);
  DATA.tree.forEach(function (n) { NODE_BY_ID[n.id] = n; });
  var STAR_KEYS = ["trick", "guard", "tempo", "bounty"];
  var VENUES = DATA.venues;
  var ALL_VENUES = VENUES;
  var U6_VENUES = DATA.legacyVenueSlugs.map(function(slug) { return VENUES.find(function(v) { return v.slug === slug; }); });
  var OLD_VENUES = U6_VENUES.filter(function (v) { return v.slug !== "broadcast"; });
  var VENUE_INDEX = new Map([ALL_VENUES,U6_VENUES,OLD_VENUES].map(function(list){return [list,new Map(list.map(function(v,i){return [v.slug,i+1];}))];}));
  function venueNumber(slug) { return VENUE_INDEX.get(VENUES).get(slug) || 0; }
  function reached(state, slug) { var n = venueNumber(slug); return n > 0 && state.vMax >= n; }
  function legacyRank(v) { return VENUES[v-1].economyRank || Math.max(1, DATA.legacyVenueSlugs.indexOf(VENUES[v-1].slug) + 1); } // hotel stage: the hotel is not in the legacy list, it sits between 대학 축제 (6) and TV 오디션 (7)
  function emptyU19(){return {cleared:false,phase:1,telegraph:0,window:0,target:0,hitMs:0,damage:0,power:1,lastDps:0,lastPower:1,routines:[],pending:[],cooldown:0};}
  function profile(state) { if(state.batchD&&(state.batchD.side||state.batchD.encore.phase==='round'))return ''; var a = getAud(state.venue,state.j); return a && a.bossProfile || ''; }
  // lastHeckle (v4 U38): 0 = not yet, 1 = the final boss's last heckle is the next one, 2 = it has come (or was cancelled).
  function emptyReview() { return {act:1,cycle:0,target:-1,elapsed:0,cancel:false,bonusMs:0,pairs:0,lastSource:'',lastCell:-1,finaleReady:false,finaleUsed:false,actMs:0,lastHeckle:0}; }
  function balanceRank(v) { return VENUES[v - 1].balanceRank; }
  var PRIZE_LIST = DATA.dealer.cardPrizes;
  var SYMBOLS = DATA.dealer.slotSymbols;
  var AUD_IDS = [];
  var AUD_BY_ID = {};
  for (var vi = 0; vi < VENUES.length; vi++) {
    var auds = VENUES[vi].audiences;
    for (var aj = 0; aj < auds.length; aj++) {
      AUD_IDS.push(auds[aj].id);
      AUD_BY_ID[auds[aj].id] = { v: vi + 1, j: aj + 1, extra: auds[aj].extra };
    }
  }

  var COMBO_AUD_IDS = AUD_IDS.concat(VENUES.map(function (v) { return v.headliner.id; }));

  var SEEN = new Uint32Array(32);
  var SEEN_STAMP = 1;
  var DEDUPE = [];
  var ITEM_TYPES = Object.create(null);
  DATA.items.types.forEach(function (t) { if (t.id !== "lecture") t.ladder.forEach(function (p) { ITEM_TYPES[p.id] = t; }); });
  var TYPE_W = DATA.items.types.map(function (t) { return t.share; });

  function rngNext(state) {
    var a = state.rngState >>> 0;
    a = (a + 0x6D2B79F5) >>> 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    state.rngState = a >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function pickW(state, weights, sample) {
    var sum = 0;
    var i;
    for (i = 0; i < weights.length; i++) sum += weights[i];
    var roll = rngNext(state);
    if(sample)sample.value=roll;
    var r = roll * sum;
    for (i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  function emit(ev, e) {
    if (ev && ev.length < 4000) ev.push(e);
  }

