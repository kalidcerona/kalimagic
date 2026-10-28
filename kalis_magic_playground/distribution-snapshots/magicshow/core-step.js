'use strict';
  function substep(state, dt, taps, ev, manualHolding, pulse) {
    if(state.mode==='fight'||state.batchD.encore.phase==='choice'||state.batchD.rebirthOffer||state.batchD.twist.scene){if(tickBatchD(state,dt,ev))return;}
    if(state.u18.map || state.u15.scene || state.u15.tutorial.won)return;
    if (state.mode === "ending") return;
    if (state.mode === "dealer") return;
    tickMentalRecovery(state, dt);
    if (state.mode === "transition") {
      if (state.idle.waiting) return;
      state.transMs = Math.max(0, state.transMs - dt);
      tickSpawn(state, dt);
      landFlights(state, dt, ev);
      if (state.transMs <= 0) {
        if(state.idle.next){
          var next=state.idle.next,stage=next.v>state.venue,after=state.after;delete state.idle.next;
          beginAudience(state,next.v,next.j,ev);
          if(stage){state.mode="transition";state.after=after;state.transMs=0;state.idle.waiting=true;emit(ev,{type:"stageReady"});return;}
        }
        if (state.after === "ending") enterEnding(state, ev);
        else if (state.after === "continue") restartRun(state);
        else if (state.after === "stay") stayHome(state);
        else if (state.after === "legacyEnding") { state.mode='ending'; state.seenEnding=true; if(state.endings.indexOf(state.dimension)<0)state.endings.push(state.dimension); }
        else {
          // An old save may still carry after "dealer" or a queued visit; since v4 U37 only a failure opens the dealer.
          state.dealerQueued = false;
          state.mode = "fight";
          state.heckleMs = state.interval * 1000;
          state.telegraphed = false;
        }
      }
      return;
    }
    if (state.mode !== "fight" || state.u18.map) return;
    if (state.features.climax.left > 0) {
      state.features.climax.left = Math.max(0,state.features.climax.left-dt);
      if (!state.features.climax.left || taps.length) skipCurtainCall(state);
      if (!state.features.climax.left) state.features.climax.paradeDone = true;
      return;
    }
    if(profile(state)==='future'&&state.u19.telegraph>0){tickFuture(state,dt,ev);return;}
    state.fightMs += dt;
    // Only the first new-player rehearsal: normal taps finish by 48 seconds regardless of drops.
    if(taps.length&&!state.u15.tutorial.done&&state.u15.bios.indexOf('lesson:v1')>=0&&state.u15.bios.indexOf('tchain:girl-fight:0')>=0){
      var practiceCeiling=state.audHpMax*Math.max(0,1-state.fightMs/48000);
      if(state.audHp>practiceCeiling)dealAud(state,state.audHp-practiceCeiling,ev);
      if(state.mode!=='fight')return;
    }
    if(tutorialLessonPending(state)&&state.fightMs>=8000){failTutorialLesson(state,ev);return;}
    state.u19.cooldown=Math.max(0,state.u19.cooldown-dt);
    if(state.u18.challenge&&state.u18.challenge.kind==='trueFan'){var rule=trueFanRule(state.u18.challenge.slug);if(rule.type==='timeLimit'&&state.fightMs>rule.value*1000||rule.type==='noDamage'&&state.tookMental){finishTravel(state,ev,false);return;}}
    tickSkills(state,dt);
    if(!state.u15.tutorial.active)tickVisitor(state,dt,ev);
    tickAutoLearn(state,dt,ev);
    tickBoss(state,dt,ev);
    tickFeatures(state, dt, ev);
    tickSpawn(state, dt, ev);
    landFlights(state, dt, ev);
    if (state.mode !== "fight" || state.u18.map) return;
    tickPatterns(state, dt, ev);
    tickAutos(state, dt, ev);
    if (state.mode !== "fight" || state.u18.map) return;
    tickMagic(state, dt, ev);
    if (state.mode !== "fight" || state.u18.map) return;
    tickBoxHelper(state, dt, ev);
    if (state.mode !== "fight" || state.u18.map) return;
    tickColleagues(state, dt, ev);
    if (state.mode !== "fight" || state.u18.map) return;
    if (state.combo > 0) {
      state.comboMs -= dt;
      if (state.comboMs <= 0) {
        state.combo = 0;
        state.comboMs = 0;
      }
    }
    var gloveActive=state.u15.gloveLeft>0;
    if(gloveActive){
      // One shared manual accumulator prevents extra real fingers from adding hits.
      // Paid 칼리 덱 auto uses holdPower so it does not beat active tapping.
      applyTaps(state,dt,state.board.map(function(c,i){return i;}),ev,"auto");
      state.u15.gloveLeft=Math.max(0,state.u15.gloveLeft-dt);
    }else applyTaps(state, dt, taps, ev, pulse);
    if (!gloveActive && !taps.length && !manualHolding) tickPractice(state,dt,ev);
    else state.idle.autoAcc=0;
    if (state.mode !== "fight" || state.u18.map || state.resolved) return;
    if (state.audHp <= 0) onWin(state, ev);
    if (state.mode !== "fight" || state.u18.map || state.resolved) return;
    tickHeckle(state, dt, ev);
    if (state.mode !== "fight" || state.u18.map || state.resolved) return;
    tickStall(state, dt, ev);
    trackAttackRate(state, dt);
    if(state.u18.challenge&&state.u18.challenge.kind==='trueFan'&&trueFanRule(state.u18.challenge.slug).type==='noDamage'&&state.tookMental)finishTravel(state,ev,false);
  }

  function step(state, dtMs, input) {
    if (!state || typeof state !== "object" || !state.board) return [];
    var out = [];
    var quiet = !!(input && input.quiet);
    var ev = quiet ? null : out;
    var taps = input && input.taps ? input.taps : [];
    dtMs = +dtMs;
    if (!isFinite(dtMs) || dtMs < 0) dtMs = 0;
    var cap = CONST.substepMs * CONST.maxSubsteps;
    if (dtMs > cap) dtMs = cap;
    var guard = 0;
    while (dtMs > 0 && guard < CONST.maxSubsteps) {
      var dt = dtMs > CONST.substepMs ? CONST.substepMs : dtMs;
      if(state.mode==="fight" && state.u15.gloveLeft>0)dt=Math.min(dt,state.u15.gloveLeft);
      var failuresBefore=state.fails,lessonBefore=tutorialLessonPending(state);
      substep(state, dt, taps, ev, !!(input && input.holding), input && input.pulse);
      dtMs -= dt;
      guard++;
      if (state.mode === "ending" || state.mode === "dealer" || state.fails!==failuresBefore||lessonBefore&&!state.u15.tutorial.active) break;
    }
    checkAchievements(state,ev);
    return out;
  }

