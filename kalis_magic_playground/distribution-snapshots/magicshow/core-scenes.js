'use strict';
  function emptyU15(){return {positions:CONST.slotOrder.slice(),gloves:0,gloveLeft:0,deckOn:false,drops:{},seen:[],queue:[],scene:null,bios:[],tutorial:{done:false,active:false,won:false,baseline:null}};}
  function validU15(u){
    if(!u||!Array.isArray(u.positions)||u.positions.length!==CONST.boardMax||new Set(u.positions).size!==CONST.boardMax||u.positions.some(function(n){return integer(n,0,CONST.boardMax-1)==null;}))return false;
    if(integer(u.gloves,0,100000)==null||num(u.gloveLeft,0,CONST.gloveLeftMax)==null||!u.drops||Array.isArray(u.drops))return false;
    if(u.deckOn!==undefined&&typeof u.deckOn!=='boolean')return false;
    if(Object.keys(u.drops).some(function(k){var d=u.drops[k];return !venueNumber(k)||!d||integer(d.boxes,0,1e9)==null||integer(d.count,0,100000)==null;}))return false;
    function sceneOK(x){return x&&integer(x.dimension,1,999)!=null&&venueNumber(x.slug)&&['opening','beforeHeadliner','afterClear'].indexOf(x.kind)>=0;}
    if(!Array.isArray(u.seen)||u.seen.length>50000||new Set(u.seen).size!==u.seen.length||u.seen.some(function(k){if(typeof k!=='string')return true;var p=k.split(':');return p.length!==3||!sceneOK({dimension:Number(p[0]),slug:p[1],kind:p[2]});}))return false;
    if(!Array.isArray(u.queue)||u.queue.length>48||u.queue.some(function(x){return !sceneOK(x);}))return false;
    if(u.scene&&(!sceneOK(u.scene)||integer(u.scene.line,0,DATA.storyV15.venues[u.scene.slug][u.scene.kind].length-1)==null))return false;
    if(!Array.isArray(u.bios)||u.bios.length>50000||u.bios.some(function(k){return typeof k!=='string'||k.length>80;}))return false;
    var t=u.tutorial;
    if(!t||typeof t.done!=='boolean'||typeof t.active!=='boolean'||typeof t.won!=='boolean'||t.active&&t.done)return false;
    if(t.active){
      if(typeof t.baseline!=='string'||t.baseline.length>=200000||['intro','fight','defeat','overview'].indexOf(t.phase)<0)return false;
      var maxLine=t.phase==='intro'?DATA.storyV15.tutorial.intro.length-1:t.phase==='defeat'?DATA.storyV15.tutorial.defeat.length-1:t.phase==='overview'?2:0;
      if(integer(t.line,0,maxLine)==null||(['defeat','overview'].indexOf(t.phase)>=0&&!t.won))return false;
      try{var main=JSON.parse(t.baseline);if(integer(main.v,12,globalThis.Core.SAVE_VERSION)==null||!main.u15||!main.u15.tutorial||main.u15.tutorial.active||!deserialize(t.baseline))return false;}catch(error){return false;}
    }
    return true;
  }
  function queueScene(state,slug,kind){
    if(state.u18.anchor)return;
    var u=state.u15,key=state.dimension+':'+slug+':'+kind;
    if(!DATA.storyV15.venues[slug]||u.seen.indexOf(key)>=0||u.queue.some(function(x){return x.dimension===state.dimension&&x.slug===slug&&x.kind===kind;})||u.scene&&u.scene.slug===slug&&u.scene.kind===kind&&u.scene.dimension===state.dimension)return;
    u.queue.push({dimension:state.dimension,slug:slug,kind:kind});
  }
  function startScene(state,replay){
    if(state.u18.anchor||state.u15.scene||state.u15.tutorial.active)return false;
    var next=replay||state.u15.queue.shift();if(!next)return false;
    var lines=DATA.storyV15.venues[next.slug]&&DATA.storyV15.venues[next.slug][next.kind];if(!lines)return false;
    state.u15.scene={dimension:next.dimension,slug:next.slug,kind:next.kind,line:0};return true;
  }
  function advanceScene(state,skip){
    var s=state.u15.scene;if(!s)return false;
    var lines=DATA.storyV15.venues[s.slug][s.kind];
    var key=s.dimension+':'+s.slug+':'+s.kind,cfg=DATA.theaterPhases;
    // s5b: the first time through, the theater beforeHeadliner stops before the subway memory (cfg.sceneLine); the fight's phase 1 follows and the
    // memory plays at phase 2 (startTheaterScene). Ending or skipping that first part does not mark the key, so the memory is still due. Replays
    // (the key is seen) play all the lines.
    if(cfg&&s.slug===cfg.slug&&s.kind==='beforeHeadliner'&&s.line<cfg.sceneLine&&state.u15.seen.indexOf(key)<0){
      if(!skip&&s.line+1<cfg.sceneLine){s.line++;return true;}
      state.u15.scene=null;return true;
    }
    if(!skip&&s.line+1<lines.length){s.line++;return true;}
    if(state.u15.seen.indexOf(key)<0)state.u15.seen.push(key);
    state.u15.scene=null;return true;
  }
  // v4 U44: the product node p-kali-deck (it replaced the late key node deckMaster). v4 U48 A: learning it no longer gives a permanent on/off
  // skill; it unlocks the 칼리 덱 consumable (120 s auto practice, u15.gloves / u15.gloveLeft): sold in the gem shop and dropped by cases.
  // u15.deckOn stays in saves (validator unchanged) but nothing reads it any more.
  function hasDeck(state){return (state.tree['p-kali-deck']||0)>0;}
  function autoStage(state){return state.dimension>=2&&state.u15.gloveLeft>0;}
  function startStage(state){
    if(state.batchD.side||state.batchD.encore.phase||state.batchD.twist.scene||state.batchD.rebirthOffer)return false;
    if(!state.idle.waiting||state.u15.scene||state.u15.queue.length)return false;
    state.idle.waiting=false;state.mode="fight";state.dealerQueued=false;state.heckleMs=state.interval*1000;state.telegraphed=false;return true;
  }
  // Flags reuse the existing bios string list. Old saves never opt into this lesson.
  function tutorialLessonPending(state){return state.u15.tutorial.active&&state.u15.bios.indexOf('lesson:attempt')>=0&&state.u15.bios.indexOf('lesson:failed')<0;}
  function failTutorialLesson(state,ev){
    if(!tutorialLessonPending(state))return false;
    if(!finishTutorial(state))return false;
    state.u15.tutorial.done=false;
    state.u15.bios=state.u15.bios.filter(function(k){return k.indexOf('tchain:')!==0&&k!=='lesson:attempt';});
    state.u15.bios.push('lesson:failed','tchain:lesson-fail:0');
    emit(ev,{type:'tutorialLessonFail'});return true;
  }
  function startTutorial(state){
    var t=state.u15.tutorial;if(t.done||t.active)return false;
    var baseline=serialize(state);t.active=true;t.baseline=baseline;t.phase="intro";t.line=0;
    state.u15.queue=[];state.u15.scene=null;state.audHp=state.audHpMax=170;state.atk=0.25;/* Keep the tutorial near 50 seconds after the hold-power reduction. */state.interval=1.5;state.heckleMs=1500;
    state.onboarding={intro:true,panel:0,step:0,facts:[]};return true;
  }
  function finishTutorial(state){
    var t=state.u15.tutorial;if(!t.active)return false;
    var earned=state.features.achievements.slice(),main=resumeHelpers(deserialize(t.baseline));if(!main)return false;
    Object.keys(state).forEach(function(k){delete state[k];});Object.assign(state,main);
    state.features.achievements=Array.from(new Set(state.features.achievements.concat(earned)));
    recompute(state,false);
    state.u15.tutorial={done:true,active:false,won:false,baseline:null};
    state.onboarding={intro:true,panel:0,step:8,facts:[]};return true;
  }
  // v4 U46 B: unused by the game since the drag-to-move UI was removed (ui.js no longer calls it); kept for test-u15 and old tools. Saved positions still load and place cases.
  function moveCase(state,from,to){
    if(state.u15.scene||state.mode!=='fight'||!Number.isInteger(from)||from<0||from>=state.board.length||!Number.isInteger(to)||to<0||to>=CONST.boardMax)return false;
    var slots=state.u15.positions,other=slots.indexOf(to),old=slots[from];slots[from]=to;slots[other]=old;delete state._layout;return true;
  }
  function toggleDeck(state){return false;} // v4 U48 A: the on/off 칼리 덱 skill is gone (kept as a no-op for old callers)
  function useGlove(state){
    if(state.mode!=='fight'||state.resolved||state.u15.scene||state.features.climax.left>0||state.u15.gloveLeft>0||state.u15.gloves<1)return false;
    state.u15.gloves--;state.u15.gloveLeft=120000;state.holding=false;state.tapAcc=0;return true;
  }


