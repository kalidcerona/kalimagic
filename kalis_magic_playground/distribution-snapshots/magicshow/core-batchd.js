'use strict';
  // Batch D keeps optional encounters and story combat separate from the main venue order.
  function emptyBatchD() { return {interference:{cell:-1,left:0,clock:0,kind:''},encore:{phase:'',reward:0,left:0},multiverseCleared:false,rebirthOffer:false,ifRoute:false,permanentBonus:0,youngCleared:false,mirrorUnlocked:false,mirrorCleared:false,side:'',sideAnchor:null,twist:{failures:0,trace:false,complete:false,scene:'',left:0,hiddenUsed:false,traceUsed:false}}; }
  function batchEvent(ev,kind,extra){emit(ev,Object.assign({type:'batchD',kind:kind},extra||{}));}
  // s5b (owner 10-24): the 소극장 headliner slot (DATA.theaterPhases) in two phases. 0 = not that fight (other slots, a travel/challenge revisit,
  // the side stages, the encore round, the tutorial), 1 = phase 1 (앞줄 관객, no sealBox), 2 = phase 2 (밍기리). The phase lives in the saved
  // phase2 flag and the doubt bar, so saves keep their schema. The multiverse twoPhase pattern is separate and unchanged.
  function theaterPhase(state){
    var cfg=DATA.theaterPhases;
    if(!cfg||state.u18.challenge||state.batchD.side||state.batchD.encore.phase==='round'||state.u15.tutorial.active)return 0;
    var v=VENUES[state.venue-1];if(!v||v.slug!==cfg.slug||state.j!==headlinerJ(state.venue))return 0;
    return state.phase2?2:1;
  }
  // Phase 1 removes cfg.phase1 of the bar (audHpMax stays the same, so gate regrowth and every HP rule keep their old size); phase 2 is the rest.
  function theaterCut(state){return state.audHpMax*(1-DATA.theaterPhases.phase1);}
  // The doubt bar as shown: each theater phase is its own full bar. Every other fight: the plain bar.
  function doubtView(state){
    var p=theaterPhase(state);if(!p)return {hp:state.audHp,max:state.audHpMax};
    var cut=theaterCut(state);
    return p===1?{hp:Math.max(0,state.audHp-cut),max:Math.max(1e-9,state.audHpMax-cut)}:{hp:Math.max(0,Math.min(state.audHp,cut)),max:Math.max(1e-9,cut)};
  }
  function theaterPhaseTwo(state,ev){
    state.phase2=true;state.audHp=Math.min(state.audHp,theaterCut(state));
    state.mental=state.mentalMax; // the "다시 일어서기" beat: 밍기리 starts against a full mental
    state.telegraphed=false;state.heckleMs=state.interval*1000;
    unseal(state);state.sealCd=1500; // 밍기리's first seal comes 1.5 s into phase 2 (the win beat and the memory hold the fight before that)
    emit(ev,{type:'theaterPhase2'});
  }
  function theaterSceneKey(state){return state.dimension+':'+DATA.theaterPhases.slug+':beforeHeadliner';}
  // The subway memory is the rest of beforeHeadliner. It is due once per dimension: in phase 2 of a main-timeline fight, until that scene key is
  // seen (the key is marked only when the memory ends or is skipped, see advanceScene). The UI starts it; the saved u15.scene line resumes it.
  function theaterSceneDue(state){
    return theaterPhase(state)===2&&!state.u18.anchor&&!state.u15.scene&&state.mode==='fight'&&!state.resolved&&state.u15.seen.indexOf(theaterSceneKey(state))<0;
  }
  function startTheaterScene(state){
    if(!theaterSceneDue(state))return false;
    var slug=DATA.theaterPhases.slug;
    state.u15.queue=state.u15.queue.filter(function(x){return !(x.slug===slug&&x.kind==='beforeHeadliner');});
    state.u15.scene={dimension:state.dimension,slug:slug,kind:'beforeHeadliner',line:DATA.theaterPhases.sceneLine};return true;
  }
  function twistEligible(state){return !state.u18.anchor&&!state.batchD.side&&state.batchD.encore.phase!=='round'&&VENUES[state.venue-1].slug===DATA.batchD.twist.venue&&state.j===headlinerJ(state.venue)&&!state.batchD.twist.complete&&(state.batchD.twist.failures>0||!!state.batchD.twist.scene||!twistPassed(state));}
  // s5t (owner 10-25): the twist plays for every player (no product requirement). A save that is already past the meetup (its trophy in this
  // dimension, or a later venue reached) never starts it there; a save in the middle of the twist (failures 1-3 or a scene) continues.
  function twistPassed(state){var n=venueNumber(DATA.batchD.twist.venue);return !!state.trophies[DATA.batchD.twist.venue]||state.vMax>n;}
  // s5t: an old save loaded mid-fight at the meetup headliner before the twist began (no products then) starts with the intro line.
  function twistLoadIntro(state){var t=state.batchD.twist;if(state.mode!=='fight'||t.failures||t.scene||t.hiddenUsed||!twistEligible(state))return false;t.scene='intro';return true;}
  function finishEncore(state,won,ev){var e=state.batchD.encore;if(won)earnCoins(state,e.reward);else state.mental=Math.max(1,state.mental-state.mentalMax*.1);e.phase='';e.left=0;state.resolved=true;state.mode='transition';state.transMs=CONST.winTransitionMs;state.audHp=0;state.flights=[];batchEvent(ev,'encoreEnd',{success:won});}
  function finishSide(state,won,ev){var b=state.batchD,side=b.side;if(won){if(side==='young'){b.youngCleared=true;b.mirrorUnlocked=true;}else b.mirrorCleared=true;}var anchor=deserialize(b.sideAnchor);if(anchor){TRAVEL_FIELDS.forEach(function(k){state[k]=anchor[k];});state.idle=anchor.idle;state.u15.scene=anchor.u15.scene;state.u15.queue=anchor.u15.queue;state.features.climax=anchor.features.climax;}b.side='';b.sideAnchor=null;recompute(state,false);batchEvent(ev,won?'sideWin':'sideLoss',{side:side});}
  function batchDAction(state,action){
    var b=state.batchD,t=b.twist,e=b.encore;
    if(action==='encore'&&e.phase==='choice'){e.phase='round';e.left=DATA.batchD.encore.durationMs;state.mode='fight';state.resolved=false;state.audHp=Math.max(1,state.audHpMax*DATA.batchD.encore.hpFactor);state.mental=Math.max(1,state.mental);state.atk*=DATA.batchD.encore.damageFactor;state.flights=[];state.telegraphed=false;state.heckleMs=state.interval*1000;state.features.climax.mirrored=[];state.features.climax.left=0;state.slow=false;state.pHeal=false;state.miss=0;unseal(state);state.u15.scene=null;state.u15.queue=[];return true;}
    if(action==='leave'&&e.phase==='choice'){e.phase='';return true;}
    if(action==='rebirth'&&b.rebirthOffer){b.rebirthOffer=false;b.ifRoute=true;b.permanentBonus=Math.max(DATA.batchD.rebirth.permanentBonus,b.permanentBonus);rebirth(state);return true;}
    if(action==='continue'&&b.rebirthOffer){b.rebirthOffer=false;return true;}
    if((action==='young'||action==='mirror')&&b.multiverseCleared&&state.trophies.multiverse&&!b.side&&!state.u18.anchor&&!e.phase&&!b.rebirthOffer&&(!t.scene||t.complete)&&(action==='young'||b.mirrorUnlocked)&&!state.u15.tutorial.active){
      b.sideAnchor=serialize(state);b.side=action;state.u15.scene=null;state.u15.queue=[];beginAudience(state,venueNumber('multiverse'),headlinerJ(venueNumber('multiverse')),null);state.features.climax.left=0;state.features.climax.paradeDone=true;state.u15.scene=null;state.u15.queue=[];state.audHp=state.audHpMax=Math.max(1,Math.round(Math.max(state.audHpMax,wallPower(state)*45)*DATA.batchD.stages[action].hpFactor));state.atk=Math.max(state.atk,state.atk*DATA.batchD.stages[action].damageFactor);state.mental=state.mentalMax;return true;
    }
    if(action==='twist-next'&&['intro','failure','gift','complete'].indexOf(t.scene)>=0){
      if(t.scene==='complete'){t.scene='';return true;}
      if(t.scene==='gift'){t.scene='counter';t.hiddenUsed=true;t.traceUsed=true;state.mental=Math.max(1,state.mentalMax-Math.min(state.mentalMax*DATA.batchD.twist.mentalCap,state.mentalMax*(1-DATA.batchD.twist.damageReduction)));return true;}
      if(t.scene==='failure'&&t.trace){t.scene='gift';return true;} // s5c: the third clue scene opens the gift (트레이스) sequence
      if(t.scene==='failure'){beginAudience(state,state.venue,headlinerJ(state.venue),null);state.u15.scene=null;state.u15.queue=[];state.audHp=Math.max(1,state.audHpMax*DATA.batchD.twist.threshold);state.mental=state.mentalMax;t.hiddenUsed=false;}
      t.scene='';return true;
    }
    if(action==='counter'&&t.scene==='counter'){t.scene='cutscene';return true;}
    if(action==='counter-finish'&&t.scene==='cutscene'){t.complete=true;t.scene='';state.audHp=0;onWin(state,null);t.scene='complete';return true;}
    return false;
  }
  function tickBatchD(state,dt,ev){
    var b=state.batchD,t=b.twist,i=b.interference,cfg=DATA.batchD&&DATA.batchD.interference;
    // s5c (review P2-3): each of the three planned losses is a short clue scene ('failure'; s5t: no 단서 n/3 label any more) with a small silk reward (clueSilk, given
    // with the failure count, so a save never pays twice); the third clue scene leads into today's gift/trace sequence (twist-next below).
    if(t.scene==='hidden'){t.left=Math.max(0,t.left-dt);if(!t.left){t.failures=Math.min(DATA.batchD.twist.failures,t.failures+1);state.mental=0;state.shield=0;var clue=DATA.batchD.twist.clueSilk||0;if(clue)addGain(state,'gems',clue,1e9);if(t.failures===DATA.batchD.twist.failures){t.trace=true;state.tree['p-trace']=Math.max(1,state.tree['p-trace']||0);recompute(state,false);state.mental=state.mentalMax;}t.scene='failure';batchEvent(ev,t.scene,{clue:t.failures,gems:clue});}return true;}
    if(t.scene||eChoice(b)||b.rebirthOffer&&b.encore.phase!=='round')return true;
    if(twistEligible(state)&&!t.hiddenUsed&&state.audHp<=state.audHpMax*(DATA.batchD.twist.threshold+1e-12)){t.hiddenUsed=true;t.scene='hidden';t.left=DATA.batchD.twist.hiddenMs;state.flights=[];batchEvent(ev,'hidden');return true;}
    if(b.encore.phase==='round'){b.encore.left=Math.max(0,b.encore.left-dt);if(!b.encore.left){finishEncore(state,false,ev);return true;}}
    if(i.left>0){i.left=Math.max(0,i.left-dt);if(!i.left){i.cell=-1;i.kind='';}}
    if(cfg&&cfg.characters[state.audId]&&state.board.length>1){i.clock+=dt;if(i.clock>=cfg.intervalMs){i.clock=0;i.cell=state.board.findIndex(function(c){return c.hp>0&&!c.sealed;});if(i.cell>=0){i.kind=cfg.characters[state.audId];i.left=cfg.durationMs;batchEvent(ev,'interference',{cell:i.cell,kind:i.kind});}}}
    return false;
  }
  function eChoice(b){return b.encore.phase==='choice';}
  function validBatchD(b){
    if(!b||!b.interference||!b.encore||!b.twist)return false;
    for(var k of ['multiverseCleared','rebirthOffer','ifRoute','youngCleared','mirrorUnlocked','mirrorCleared'])if(typeof b[k]!=='boolean')return false;
    var i=b.interference,e=b.encore,t=b.twist;
    if(integer(i.cell,-1,24)==null||num(i.left,0,60000)==null||num(i.clock,0,60000)==null||['','lock','hide'].indexOf(i.kind)<0||['','choice','round'].indexOf(e.phase)<0||num(e.reward,0,1e24)==null||num(e.left,0,20000)==null||num(b.permanentBonus,0,.15)==null||['','young','mirror'].indexOf(b.side)<0||integer(t.failures,0,3)==null||num(t.left,0,4000)==null||['','intro','hidden','failure','gift','counter','cutscene','complete'].indexOf(t.scene)<0)return false;
    for(var key of ['trace','complete','hiddenUsed','traceUsed'])if(typeof t[key]!=='boolean')return false;
    if(t.trace&&t.failures!==3||t.complete&&!t.trace||b.mirrorUnlocked&&!b.youngCleared||b.mirrorCleared&&!b.mirrorUnlocked||b.ifRoute&&!b.multiverseCleared||b.rebirthOffer&&!b.multiverseCleared)return false;
    if(b.side){if(typeof b.sideAnchor!=='string'||b.sideAnchor.length>500000)return false;var a=JSON.parse(b.sideAnchor);if(!a.batchD||a.batchD.side||a.batchD.sideAnchor!==null||!deserialize(b.sideAnchor))return false;}else if(b.sideAnchor!==null)return false;
    return true;
  }

