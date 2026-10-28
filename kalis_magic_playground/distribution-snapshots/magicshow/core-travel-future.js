'use strict';
  function emptyU18(){return {revealed:false,fans:[],paid:[],sets:[],owned:{kali:[],cases:[]},equipped:{kali:'',cases:''},pads:emptyPads(),map:false,anchor:null,challenge:null};}
  // v4 U46 C1: the challenge is offered once the audience was beaten (headliner: the venue trophy; others: one win), and the challenges are revealed
  // with the first venue trophy (it used to need one whole venue of full fans).
  function beatenOnce(state,v,a){return a.id===v.headliner.id?!!state.trophies[v.slug]:!!(state.bestiary[a.id]&&state.bestiary[a.id].wins>=1);}
  function checkTrueFanReveal(state,ev){
    if(state.u18.revealed)return false;
    if(!VENUES.some(function(v){return !!state.trophies[v.slug];}))return false;
    state.u18.revealed=true;emit(ev,{type:'trueFanReveal'});return true;
  }
  function trueFanRule(slug){var n=venueNumber(slug);return n?DATA.trueFanRules[(n-1)%DATA.trueFanRules.length]:null;}
  function trueFanReward(slug){var n=venueNumber(slug);return n?4+Math.floor((n-1)/4):0;}
  function trueFanProgress(state,slug){
    var v=VENUES[venueNumber(slug)-1];if(!v)return {current:0,total:0,complete:false};
    var ids=v.audiences.filter(function(a){return !a.bench;}).concat([v.headliner]).map(function(a){return a.id;});
    return {current:ids.filter(function(id){return state.u18.fans.indexOf(id)>=0;}).length,total:ids.length,complete:state.u18.sets.indexOf(slug)>=0};
  }
  function travelAllowed(state){if(state.batchD.side||state.batchD.encore.phase||state.batchD.twist.scene||state.batchD.rebirthOffer)return false;return profile(state)!=='future'&& !state.u15.tutorial.active&&!state.u15.scene&&state.mode==='fight'&&!state.resolved&&!state.features.climax.left&&!state.telegraphed&&!state.features.climax.mirrored.length&&state.review.target<0;}
  function openMap(state){
    if(state.u18.map)return true;if(!travelAllowed(state))return false;
    if(!state.u18.anchor)state.u18.anchor=serialize(state);
    else if(state.u18.challenge){restoreTimeline(state);state.u18.challenge=null;}
    state.u18.map=true;state.holding=false;state.tapAcc=0;return true;
  }
  var TRAVEL_FIELDS=['venue','crowd','j','audId','audHp','audHpMax','atk','interval','mental','shield','combo','comboMs','maxCombo','finisher','finisherFired','fightMs','tookMental','phase2','pattern','slow','miss','pHeal','sealCell','sealMs','sealCd','patternHealMs','heckleMs','telegraphed','mode','transMs','after','resolved','review','dealer','dealerQueued','winsSinceDealer','buff','flights','doveMs','rabbitMs','flashBreaks'];
  function restoreTimeline(state){
    var original=resumeHelpers(deserialize(state.u18.anchor));if(!original)return false;
    TRAVEL_FIELDS.forEach(function(k){state[k]=original[k];});
    state.u15.scene=original.u15.scene;state.u15.queue=original.u15.queue;
    state.features.climax=original.features.climax;state.features.workers=original.features.workers;
    state.skills=original.skills;state.u17.potionUsed=original.u17.potionUsed;
    state.idle.waiting=original.idle.waiting;state.holding=false;state.tapAcc=0;
    state.board.forEach(function(b){b.sealed=false;});if(state.sealCell>=0&&state.board[state.sealCell])state.board[state.sealCell].sealed=true;
    recompute(state,false);state.mental=Math.min(state.mental,state.mentalMax);return true;
  }
  function returnToStage(state){
    if(!state.u18.anchor)return false;
    if(!state.u18.map&&!travelAllowed(state))return false;
    if(!restoreTimeline(state))return false;
    state.u18.anchor=null;state.u18.map=false;state.u18.challenge=null;return true;
  }
  function travelTo(state,slug,id,kind){
    var v=VENUES[venueNumber(slug)-1];kind=kind||'normal';
    if(!v||state.visited.indexOf(slug)<0||['normal','trueFan'].indexOf(kind)<0)return false;
    var list=v.audiences.concat([v.headliner]),j=list.findIndex(function(a){return a.id===id;})+1;if(!j)return false;
    if(kind==='trueFan'&&(!state.u18.revealed||!beatenOnce(state,v,list[j-1])))return false;
    if(!state.u18.map&&!openMap(state))return false;
    state.u18.map=false;state.u18.challenge={slug:slug,id:id,kind:kind};
    state.u15.queue=[];state.features.climax.left=0;state.features.climax.paradeDone=true;
    beginAudience(state,venueNumber(slug),j,null);
    state.mental=state.mentalMax;state.shield=state.mentalMax*nodeEffects(state).openingShield;
    state.combo=0;state.comboMs=0;state.finisher=0;state.flights=[];state.dealerQueued=false;
    return true;
  }
  function recordBenchedFans(state,slug){
    var v=VENUES[venueNumber(slug)-1];if(!v)return;
    v.audiences.forEach(function(a){if(a.bench&&state.u18.fans.indexOf(a.id)<0)state.u18.fans.push(a.id);});
  }
  function finishTravel(state,ev,won){
    var c=state.u18.challenge;if(!c)return false;
    var success=won&&(c.kind!=='trueFan'||metExtra(state,trueFanRule(c.slug))),reward=0;
    if(success&&c.kind==='trueFan'){
      if(state.u18.fans.indexOf(c.id)<0)state.u18.fans.push(c.id);
      // Benched roster ids stay out of the fight rotation, but a listed set must still name every audience.
      recordBenchedFans(state,c.slug);
      if(state.u18.paid.indexOf(c.id)<0){state.u18.paid.push(c.id);reward=trueFanReward(c.slug);addGain(state, 'gems', reward, 1e9);}
      var p=trueFanProgress(state,c.slug);if(p.current===p.total&&!p.complete){recordBenchedFans(state,c.slug);state.u18.sets.push(c.slug);}
    }
    restoreTimeline(state);state.u18.map=true;state.u18.challenge=null;
    emit(ev,{type:'travelResult',success:success,kind:c.kind,gems:reward,slug:c.slug});return success;
  }
  function unlockCosmetics(state){
    DATA.cosmetics.kali.forEach(function(x){if(x.milestone&&(state.trophies[x.milestone]||x.milestone==='lecturenote'&&state.homecomingCleared)&&state.u18.owned.kali.indexOf(x.id)<0)state.u18.owned.kali.push(x.id);});
  }
  function cosmeticInfo(state,tab,id){
    var x=DATA.cosmetics[tab]&&DATA.cosmetics[tab].find(function(x){return x.id===id;});if(!x)return null;
    unlockCosmetics(state);var owned=state.u18.owned[tab].indexOf(id)>=0;
    return {owned:owned,cost:x.cost,available:owned||(!x.milestone&&state.gems>=x.cost),hint:owned?'사용할 수 있어요':x.hint||'실크 '+x.cost+'개로 열기'};
  }
  function buyCosmetic(state,tab,id){var info=cosmeticInfo(state,tab,id);if(!info||info.owned||!info.available)return false;state.gems-=info.cost;state.u18.owned[tab].push(id);checkAchievements(state,null);return true;}
  function equipCosmetic(state,tab,id){
    if(!DATA.cosmetics[tab])return false;
    if(id){var info=cosmeticInfo(state,tab,id);if(!info||!info.owned)return false;}
    state.u18.equipped[tab]=id;recompute(state,true);state.mental=Math.min(state.mental,state.mentalMax);return true;
  }
  function validU18(u,state){
    if(!u||!validPads(u.pads)||typeof u.revealed!=='boolean'||typeof u.map!=='boolean'||!u.owned||!u.equipped)return false;
    for(var key of ['fans','paid','sets'])if(!Array.isArray(u[key])||new Set(u[key]).size!==u[key].length||u[key].some(function(id){return key==='sets'?!venueNumber(id):COMBO_AUD_IDS.indexOf(id)<0;}))return false;
    if(!u.revealed&&(u.fans.length||u.paid.length||u.sets.length))return false;
    for(var tab of ['kali','cases'])if(!Array.isArray(u.owned[tab])||new Set(u.owned[tab]).size!==u.owned[tab].length||u.owned[tab].some(function(id){return !DATA.cosmetics[tab].some(function(x){return x.id===id;});})||typeof u.equipped[tab]!=='string'||u.equipped[tab]&&u.owned[tab].indexOf(u.equipped[tab])<0)return false;
    if(u.sets.some(function(slug){var v=VENUES[venueNumber(slug)-1];return !v.audiences.concat([v.headliner]).every(function(a){return u.fans.indexOf(a.id)>=0;});}))return false;
    if(u.anchor!==null){
      if(typeof u.anchor!=='string'||u.anchor.length>500000)return false;
      var snap=JSON.parse(u.anchor);if(!snap.u18||snap.u18.anchor!==null||snap.u18.map||snap.u18.challenge||snap.dimension!==state.dimension||!deserialize(u.anchor))return false;
    }else if(u.map||u.challenge)return false;
    if(u.challenge){var c=u.challenge,v=VENUES[venueNumber(c.slug)-1];if(u.map||!v||state.visited.indexOf(c.slug)<0||!v.audiences.concat([v.headliner]).some(function(a){return a.id===c.id;})||c.id!==state.audId||['normal','trueFan'].indexOf(c.kind)<0||c.kind==='trueFan'&&!u.revealed)return false;}
    return true;
  }

  function strongestCase(state){var best=0;state.board.forEach(function(c,i){if(c.lv>state.board[best].lv)best=i;});return best;}
  // v4 U44: a gate is sized to the build WITHOUT the product that belongs to that wall (node.wall = the audience id), so that product's attack
  // bonus is real strength on that wall instead of making the audience bigger. Other products and everything else count as usual.
  function wallProductMult(state){var m=1;DATA.tree.forEach(function(n){if(n.productMultiplier&&n.wall===state.audId&&state.tree[n.id])m*=n.productMultiplier;});return m;}
  function wallPower(state){var m=wallProductMult(state),keep=state._V;if(m>1&&keep)state._V=keep/m;var p=futurePower(state);state._V=keep;return p;}
  function futurePower(state){
    var rarity=CONST.rarityW.reduce(function(sum,w,i){return sum+w*CONST.rarityMult[i];},0)/CONST.rarityW.reduce(function(a,b){return a+b;},0);
    var t=state.tree,mods=nodeEffects(state),rate=wandRate(state),area=wandArea(state),coverage=Math.min(state.board.length,area.cols*area.rows)/Math.max(1,state.board.length);
    var hitRate=rate*coverage+(t.boxHelper?fanCount(state)*.35/(mods.helperEvery/1000):0)/Math.max(1,state.board.length)+(t.assistant?.8/1.2:0)/Math.max(1,state.board.length);
    var damage=state.board.reduce(function(sum,c){var lv=c.lv||1,hp=caseHp(state._boxHp,lv),opens=1/(hp/Math.max(1,wandDamage(state)*gearMultiplier(state,"open")*hitRate)+state._tau/1000);return sum+opens*(CONST.itemDamage*(state._V||1)*rarity*.56*caseItems(lv)*Math.pow(1.1,lv-1)*milestoneMultiplier(lv,[10,25,50])*branchBonus(state,'box')*caseItemBonus(state)+CONST.finisherDmg*(state._V||1)*mods.finalePower/mods.finaleNeed);},0);
    return Math.max(1,damage);
  }
  function beginFuture(state,prepare){if(!state.homecomingCleared||state.u19.cleared||state.u15.tutorial.active||state.u18.anchor)return false;state.u15.queue=[];state.u15.scene=null;state.dealer=null;state.dealerQueued=false;beginAudience(state,venueNumber('future'),1,null);state.mental=state.mentalMax;if(prepare){state.idle.waiting=true;state.mode='transition';state.transMs=0;state.after='fight';}return true;}
  // s5d: the heckle of the current phase (CONST.future). Applied at the start, at each phase change and every fight tick, so a save taken
  // mid-fight (whose atk/interval came from the old fixed numbers) continues with the current phase's values.
  function futureThreat(state){var F=CONST.future,i=Math.max(0,Math.min(2,(state.u19.phase||1)-1));state.atk=state.mentalMax*F.atk[i];state.interval=F.interval[i];}
  function tickFuture(state,dt,ev){
    if(profile(state)!=='future')return;var u=state.u19;
    if(u.telegraph>0){u.telegraph=Math.max(0,u.telegraph-dt);return;}
    futureThreat(state);
    var epsilon=state.audHpMax*1e-12;
    var phase=state.audHp<=state.audHpMax*.3+epsilon?3:state.audHp<=state.audHpMax*.65+epsilon?2:1;
    if(phase>u.phase){u.phase=phase;u.telegraph=3000;u.target=strongestCase(state);u.hitMs=0;if(phase===3)u.window=20000;emit(ev,{type:'futurePhase',phase:phase});return;}
    if(u.phase===2){u.hitMs+=dt;if(u.hitMs>2500){state.combo=0;state.comboMs=0;}}
    if(u.phase===3)u.window=Math.max(0,u.window-dt);
  }
  // v4 U48 N4: a routine is unlocked (u19.routines) and its cut-in queued only by learning its own routine 비법; the old "a related node reaches
  // LV 1, 5 or 10" trigger is gone. Later cut-ins come from the routine's skill (routineSkill) or one of its case items (routineItem), 20 s apart.
  function routineLearn(state,node){var id=node.routine;if(!id)return;if(state.u19.routines.indexOf(id)<0)state.u19.routines.push(id);if(state.u19.pending.indexOf(id)<0)state.u19.pending.push(id);}
  // v4 U53: when several learned routines share the item (silk-handkerchief, linking-rings, cups-and-balls), they take turns (a counter outside the
  // save, presentation only: no state but the existing cooldown changes), so thumbtie, silk and bottles are not always shadowed by the first one.
  var routineTurn=0;
  function routineItem(state,item,ev){if(state.u19.cooldown>0||!ev)return;var list=DATA.routines.filter(function(r){return r.items.indexOf(item)>=0&&state.u19.routines.indexOf(r.id)>=0;});if(!list.length)return;var r=list[routineTurn++%list.length];state.u19.cooldown=20000;emit(ev,{type:'routine',id:r.id});}
  function routineSkill(state,id,ev){if(state.u19.cooldown>0)return;var r=DATA.routines.find(function(r){return r.skill===id&&state.u19.routines.indexOf(r.id)>=0;});if(r){state.u19.cooldown=20000;emit(ev,{type:'routine',id:r.id});}}
  function validU19(u){return u&&typeof u.cleared==='boolean'&&integer(u.phase,1,3)!=null&&['telegraph','window','hitMs','damage','power','lastDps','lastPower','cooldown','target'].every(function(k){return num(u[k],0,1e100)!=null;})&&integer(u.target,0,24)!=null&&u.telegraph<=3000&&u.window<=20000&&['routines','pending'].every(function(k){return Array.isArray(u[k])&&u[k].length<=DATA.routines.length&&new Set(u[k]).size===u[k].length&&u[k].every(function(id){return DATA.routines.some(function(r){return r.id===id;});});});} /* round 14: cap follows D.routines (was 8) so the five new ids save; unknown ids still fail; shorter old lists still load */
