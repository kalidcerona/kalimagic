'use strict';
  // One tuning point; runtime is intentionally outside the serialized state.
  var HELPER_BUFF_RULES = Object.freeze({ intervalMs:12000, durationMs:6000, bonus:.15 });
  var helperBuffClocks = new WeakMap();
  function helperBuffRuntime(state) {
    var q=helperBuffClocks.get(state);
    if(!q){q={elapsed:0,active:{dmg:false,coin:false}};helperBuffClocks.set(state,q);}
    return q;
  }
  function helperBuffMultiplier(state,kind) {
    var q=helperBuffClocks.get(state), index=kind==='dmg'?4:5;
    return q && q.active[kind] && state.mode==='fight' && colleagueCount(state)>index ? 1+HELPER_BUFF_RULES.bonus : 1;
  }
  function helperBuffs(state) {
    var q=helperBuffRuntime(state);
    return {elapsed:q.elapsed,dmg:helperBuffMultiplier(state,'dmg')>1,coin:helperBuffMultiplier(state,'coin')>1};
  }
  function endHelperBuffs(state,ev) {
    var q=helperBuffClocks.get(state);if(!q)return;
    ['dmg','coin'].forEach(function(kind,i){if(q.active[kind])emit(ev,{type:'helperBuffEnd',kind:kind,index:i+4});});
    helperBuffClocks.delete(state);
  }
  function tickHelperBuffs(state,dt,ev) {
    if(state.mode!=='fight'||state.resolved){endHelperBuffs(state,ev);return;}
    var q=helperBuffRuntime(state),rules=HELPER_BUFF_RULES;
    // Production substeps are shorter than either boundary; handle arbitrary test steps too.
    var target=q.elapsed+dt;
    while(q.elapsed<target){
      var phase=q.elapsed%rules.intervalMs;
      var next=q.elapsed+(phase<rules.durationMs?rules.durationMs-phase:rules.intervalMs-phase);
      q.elapsed=Math.min(next,target);
      var active=q.elapsed>=rules.intervalMs && q.elapsed%rules.intervalMs<rules.durationMs;
      ['dmg','coin'].forEach(function(kind,i){
        var on=active&&colleagueCount(state)>i+4;
        if(on!==q.active[kind]){q.active[kind]=on;emit(ev,{type:on?'helperBuffStart':'helperBuffEnd',kind:kind,index:i+4});}
      });
    }
  }
