'use strict';
  // v4 U42: lookups the UI and the sim used to re-implement. They take the venue object (DATA.venues entry), not the venue number.
  function audienceAt(venue, j) { return venue.audiences[j - 1] || venue.headliner; }
  function roster(venue) { return venue.audiences.concat([venue.headliner]); }
  function isHeadliner(venue, j) { return j === venue.audiences.length + 1; }
  function venueBySlug(slug) { return DATA.venues.find(function (v) { return v.slug === slug; }); }
  // v4 U42: named state actions for what the UI used to assign directly. Same assignments as before; Core is now the only writer.
  function holdWinTransition(s, ms) { s.transMs = ms; }
  function resumeTutorial(s) { startTutorial(s); s.u15.tutorial.phase = s.u15.tutorial.phase || 'intro'; s.u15.tutorial.line = s.u15.tutorial.line || 0; }
  function replayTutorial(s) { s.u15.tutorial.done = false; }
  function toggleAutoLearn(s) { s.learning.on = !s.learning.on; s.learning.ms = 0; }
  function toggleHaptics(s) { s.u14.haptics = !s.u14.haptics; }
  function markAway(s, wallMs) { s.idle.wallMs = Math.max(s.idle.wallMs, wallMs); }
  function setAwayTotal(s, awayMs) { s.idle.reward.totalAwayMs = awayMs; }
  // Manual save slots: metadata only; the main save store and validators stay independent.
  function slotSummary(state) {
    var venue = DATA.venues[state.venue - 1];
    return {venueName: venue.name, venueNo: state.venue, level: state.level,
      coins: formatNumber(state.coins), playMinutes: Math.floor(state.features.elapsedMs / 60000)};
  }
  function validSlot(obj) {
    try {
      if (!obj || obj.v !== 1 || !Number.isSafeInteger(obj.savedAt) || obj.savedAt < 0 || obj.savedAt > 8640000000000000 || typeof obj.data !== 'string') return false;
      var s = obj.summary;
      if (!s || typeof s.venueName !== 'string' || !s.venueName.trim() || s.venueName.length > 200 ||
          !Number.isInteger(s.venueNo) || s.venueNo < 1 || s.venueNo > DATA.venues.length ||
          !Number.isSafeInteger(s.level) || s.level < 0 || typeof s.coins !== 'string' || !s.coins.trim() || s.coins.length > 100 ||
          !Number.isSafeInteger(s.playMinutes) || s.playMinutes < 0) return false;
      return !!deserialize(migrateHotelSave(obj.data).str); // hotel stage: a slot saved before the hotel loads renumbered
    } catch (error) { return false; }
  }

  // Keep save validation independent of post-load reward reconciliation.
  // Removed helper pause controls: retain legacy save keys, resume after validation.
  function resumeHelpers(state){
    if(!state)return state;
    var f=state.features;
    f.dovePaused=false;f.helperPaused=false;
    f.workers.fanPaused=false;f.workers.assistantPaused=false;
    Object.keys(f.magic.paused).forEach(function(id){f.magic.paused[id]=false;});
    // s5b: a save from the single-phase theater, taken in the old long beforeHeadliner after the theater part (the subway lines, still before the
    // fight), would replay the memory before phase 1. Close that scene instead: phase 1 starts and the whole memory plays at phase 2 (the key is
    // still unseen). The scene length is unchanged, so legacySceneLengths needs no theater beforeHeadliner entry.
    var sc=state.u15&&state.u15.scene,cfg=DATA.theaterPhases;
    if(cfg&&sc&&sc.slug===cfg.slug&&sc.kind==='beforeHeadliner'&&sc.line>=cfg.sceneLine&&!state.phase2&&state.u15.seen.indexOf(sc.dimension+':'+sc.slug+':'+sc.kind)<0)state.u15.scene=null;
    return state;
  }
  // Reconcile existing milestones without paying historical achievements again.
  function reconcileAchievements(state){
    var gems=state.gems;checkAchievements(state,null);state.gems=gems;
  }
  // Hotel stage (10-26): 호텔 마술 대회 is inserted after 대학 축제 (data.js "Hotel stage"). A save written before it numbers its venues without
  // the hotel (venue, vMax and idle.next count one less from TV 오디션 on), keeps the old TV 오디션 roster (a19 a20 a21 a64 a65 a66, a19 a21 a64
  // a65 are hotel audiences now) and has no bestiary entry for the new faces. migrateHotelSave rewrites such a raw save into the current
  // numbering before the strict validator sees it, so the validator text (and its hash) stays as it is. The player stays in the same venue in
  // front of the same audience; one who stood before an audience that moved to the hotel starts TV 오디션 again at its first audience. Trophies
  // stay; the old TV 오디션 3등 is the hotel story now, so a save that cleared the old TV 오디션 also holds the hotel trophy, and a complete old
  // TV 오디션 audience set (u14 and u18) is counted as the complete hotel set. The hotel stays unvisited, so nobody is sent back. Nested saves
  // (tutorial baseline, IF side anchor, map anchor) are migrated the same way. Returns {str, pre, restart}.
  var HOTEL_PRE = ALL_VENUES.filter(function (v) { return v.slug !== 'hotel'; });
  var OLD_AUDITION = ['a19','a20','a21','a64','a65','a66'], HOTEL_NEW = ['a-hotel-neighbor','a-audition-fd','a-audition-waiting'];
  function migrateHotelSave(str) {
    var o, result = {str: str, pre: false, restart: false};
    try { o = JSON.parse(str); } catch (error) { return result; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.v !== 'number' || !venueNumber('hotel')) return result;
    var hotel = ALL_VENUES[venueNumber('hotel')-1], audition = ALL_VENUES[venueNumber('audition')-1], changed = false;
    var add = function (list, id) { if (Array.isArray(list) && list.indexOf(id) < 0) { list.push(id); changed = true; } };
    var oldFor = function (n, slug) { return Number.isInteger(n) && !!HOTEL_PRE[n-1] && HOTEL_PRE[n-1].slug === slug && (!ALL_VENUES[n-1] || ALL_VENUES[n-1].slug !== slug); };
    var shifted = o.v >= 7 && (oldFor(o.venue, o.venueSlug) || oldFor(o.vMax, o.maxVenueSlug));
    var list = o.v < 5 ? OLD_VENUES : o.v < 7 ? U6_VENUES : shifted ? HOTEL_PRE : ALL_VENUES;
    var pre = o.v < 7 || shifted;
    var slugAt = function (n) { return Number.isInteger(n) && list[n-1] ? list[n-1].slug : ''; };
    // the new TV 오디션 j for an old TV 오디션 audience id (0 when it moved to the hotel)
    var auditionJ = function (id) { if (id === audition.headliner.id) return audition.audiences.length + 1; return audition.audiences.findIndex(function (a) { return a.id === id; }) + 1; };
    var curSlug = slugAt(o.venue), nextSlug = o.idle && o.idle.next && typeof o.idle.next === 'object' ? slugAt(o.idle.next.v) : '';
    if (shifted) {
      var renum = function (n) { return Number.isInteger(n) && HOTEL_PRE[n-1] ? venueNumber(HOTEL_PRE[n-1].slug) : n; };
      o.venue = renum(o.venue); o.vMax = renum(o.vMax); if (nextSlug) o.idle.next.v = renum(o.idle.next.v); changed = true;
    }
    if (pre && curSlug === 'audition' && typeof o.audId === 'string') {
      var j = auditionJ(o.audId), c = o.u18 && o.u18.challenge;
      if (j) { if (o.j !== j) { o.j = j; changed = true; } }
      else if (o.v >= 7 && c && c.id === o.audId) {
        // a map replay of an audience that is a hotel audience now: replay it at the hotel
        o.venue = venueNumber('hotel'); o.j = hotel.audiences.findIndex(function (a) { return a.id === o.audId; }) + 1; o.crowd = hotel.crowd; c.slug = 'hotel'; add(o.visited, 'hotel'); changed = true;
      } else { o.j = 1; o.audId = audition.audiences[0].id; result.restart = true; changed = true; }
    }
    if (pre && nextSlug === 'audition' && Number.isInteger(o.idle.next.j)) {
      var oldId = o.idle.next.j === OLD_AUDITION.length + 1 ? audition.headliner.id : OLD_AUDITION[o.idle.next.j - 1];
      o.idle.next.j = auditionJ(oldId) || 1; changed = true;
    }
    // Future table: absent guest ledger entries identify the headliner-only roster.
    var futureGuests=['a-future-student','a-future-beginner'];
    var oldFuture=o.bestiary&&futureGuests.every(function(id){return !Object.prototype.hasOwnProperty.call(o.bestiary,id);});
    if(oldFuture){
      if(curSlug==='future'&&o.crowd===1){o.crowd=3;changed=true;}
      if(curSlug==='future'&&o.audId==='h-future-kali'&&o.j===1){o.j=headlinerJ(venueNumber('future'));changed=true;}
      if(nextSlug==='future'&&o.idle.next.j===1){o.idle.next.j=headlinerJ(venueNumber('future'));changed=true;}
      futureGuests.forEach(function(id){o.bestiary[id]={wins:0,extra:false,removed:false};changed=true;});
      var fs=o.u15&&o.u15.scene;
      if(fs&&fs.slug==='future'&&Number.isInteger(fs.line)){
        var offsets={opening:[0,2,3,4],beforeHeadliner:[2,3,4,4,0],afterClear:[3,4,5,6]};
        if(offsets[fs.kind]&&offsets[fs.kind][fs.line]!=null)fs.line=offsets[fs.kind][fs.line];
      }
    }
    if (o.bestiary && typeof o.bestiary === 'object' && !Array.isArray(o.bestiary)) HOTEL_NEW.forEach(function (id) { if (!o.bestiary[id]) { o.bestiary[id] = {wins: 0, extra: false, removed: false}; changed = true; } });
    if (pre && o.v >= 7 && o.trophies && o.trophies.audition === 1 && o.trophies.hotel !== 1) { o.trophies.hotel = 1; add(o.knownAudiences, hotel.headliner.id); if (o.u14) add(o.u14.satisfied, hotel.headliner.id); changed = true; }
    if (pre) [['u14', 'satisfied'], ['u18', 'fans']].forEach(function (p) {
      var u = o[p[0]]; if (!u || !Array.isArray(u.sets) || u.sets.indexOf('audition') < 0) return;
      u.sets.splice(u.sets.indexOf('audition'), 1); add(u.sets, 'hotel'); add(u[p[1]], 'a-hotel-neighbor'); add(u[p[1]], hotel.headliner.id); changed = true;
    });
    [[o.u15 && o.u15.tutorial, 'baseline'], [o.batchD, 'sideAnchor'], [o.u18, 'anchor']].forEach(function (p) {
      if (p[0] && typeof p[0][p[1]] === 'string') { var inner = migrateHotelSave(p[0][p[1]]).str; if (inner !== p[0][p[1]]) { p[0][p[1]] = inner; changed = true; } }
    });
    result.pre = pre;
    if (changed) result.str = JSON.stringify(o);
    return result;
  }
  // The post-load half for the saves whose ledgers were arrays (version below 7) or rebuilt on load (below 11), and the restart above.
  function afterHotelMigration(state, mig) {
    if (!state || !mig.pre) return state;
    var hotel = VENUES[venueNumber('hotel')-1], h = hotel.headliner.id;
    if (state.trophies.audition && !state.trophies.hotel) { state.trophies.hotel = 1; if (state.knownAudiences.indexOf(h) < 0) state.knownAudiences.push(h); if (state.u14.satisfied.indexOf(h) < 0) state.u14.satisfied.push(h); }
    var oldSetDone = OLD_AUDITION.concat(['h7']).every(function (id) { return state.u14.satisfied.indexOf(id) >= 0; });
    if (oldSetDone && state.u14.sets.indexOf('hotel') < 0) { ['a-hotel-neighbor', h].forEach(function (id) { if (state.u14.satisfied.indexOf(id) < 0) state.u14.satisfied.push(id); }); checkSets(state, null); }
    if (mig.restart && state.mode === 'fight') beginAudience(state, state.venue, state.j, null);
    return state;
  }
  function loadState(raw){var mig=migrateHotelSave(raw),state=resumeHelpers(afterHotelMigration(deserialize(mig.str),mig));if(state)reconcileAchievements(state);return state;}

