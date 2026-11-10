'use strict';
  // Runtime-only clocks and random stream. Neither belongs to SAVE_KEYS or u19.
  var showSequences = new WeakMap();
  function showGap(count) {
    return DATA.showSequence.gapMs * (DATA.routines.length - count) / (DATA.routines.length - 1);
  }
  function ownedShowRoutines(state) {
    return DATA.routines.filter(function(r) { return routineOwned(state,r.id); }).map(function(r) { return r.id; });
  }
  function showRuntime(state) {
    var q=showSequences.get(state);
    if (!q) {
      q={phase:'off',left:0,id:'',previous:'',owned:[],rngState:state.rngState >>> 0,revision:0};
      showSequences.set(state,q);
    }
    return q;
  }
  function currentShowId(state) {
    var q=showSequences.get(state);
    return q && q.phase==='show' && routineOwned(state,q.id) ? q.id : '';
  }
  function syncShowOwnership(state,q) {
    var ids=ownedShowRoutines(state);
    if (ids.join(',')===q.owned.join(',')) return;
    q.owned=ids;
    // A purchase shortens the remaining card interval, but never interrupts a show.
    if (q.phase!=='show' || ids.indexOf(q.id)<0) {
      var active=!!q.id;
      q.id='';q.phase=ids.length?'gap':'off';q.left=ids.length?showGap(ids.length):0;
      if(active)finishShowValues(state);
    }
  }
  function showSequence(state) {
    var q=showRuntime(state);syncShowOwnership(state,q);
    return {phase:q.phase,left:q.left,id:q.id,count:q.owned.length,revision:q.revision};
  }
  function finishShowValues(state) {
    recompute(state,true);
    // A show may raise the cap. Ending it removes only the part above the resting cap.
    state.mental=Math.min(state.mental,state.mentalMax);
  }
  // The sequencer is not saved. Write the resting vitals so a reload, which starts
  // in a gap, matches this snapshot. The live show keeps its bonus.
  function showSaveVitals(state) {
    var q=showSequences.get(state);
    var showing=q&&q.phase==='show'&&q.id&&routineOwned(state,q.id);
    if(!showing)return {mental:state.mental,mentalMax:state.mentalMax,shield:state.shield};
    var phase=q.phase,snap={
      mental:state.mental,mentalMax:state.mentalMax,shield:state.shield,
      _preparedLevel:state._preparedLevel,_boxHp:state._boxHp,_tau:state._tau,_rate:state._rate,
      _wand:state._wand,_V:state._V,_U:state._U,_coinMul:state._coinMul
    },out;
    try {
      q.phase='gap';
      recompute(state,true);
      out={mental:Math.min(snap.mental,state.mentalMax),mentalMax:state.mentalMax,shield:state.shield};
    } finally {
      q.phase=phase;
      state.mental=snap.mental;state.mentalMax=snap.mentalMax;state.shield=snap.shield;
      state._preparedLevel=snap._preparedLevel;state._boxHp=snap._boxHp;state._tau=snap._tau;state._rate=snap._rate;
      state._wand=snap._wand;state._V=snap._V;state._U=snap._U;state._coinMul=snap._coinMul;
    }
    return out;
  }
  function nextShow(q) {
    // No repeats is within the <=20% rule, including n=2. Uniform over alternatives.
    var choices=q.owned.filter(function(id) { return q.owned.length===1 || id!==q.previous; });
    return choices[Math.floor(rngNext(q)*choices.length)];
  }
  function tickShowSequence(state,dt,ev) {
    var q=showRuntime(state);syncShowOwnership(state,q);
    if(!q.owned.length)return;
    // Presentation and simulation pause together. Outside a fight, return to card tricks.
    if(state.mode!=='fight') {
      if(q.id){q.id='';q.phase='gap';q.left=showGap(q.owned.length);finishShowValues(state);}
      return;
    }
    while(dt+1e-7>=q.left) {
      dt=Math.max(0,dt-q.left);
      if(q.phase==='show') {
        var ended=q.id;q.id='';q.phase='gap';q.left=showGap(q.owned.length);
        finishShowValues(state);emit(ev,{type:'showEnd',id:ended});
      } else {
        q.id=nextShow(q);q.previous=q.id;q.phase='show';q.left=DATA.showSequence.showMs;q.revision++;
        finishShowValues(state);emit(ev,{type:'showStart',id:q.id});
      }
      if(dt===0 && q.left>0)break;
    }
    q.left-=dt;
  }
