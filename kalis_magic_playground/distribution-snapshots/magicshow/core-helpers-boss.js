'use strict';
  function tickFeatures(state, dt, ev) {
    var f = state.features;
    f.elapsedMs += dt;
    state.u17.gemWait=Math.max(0,state.u17.gemWait-dt);
    f.revealMs = Math.max(0, f.revealMs - dt);
    if (!f.revealMs && f.revealQueue.length) {
      var id = f.revealQueue.shift(); f.revealMs = CONST.revealGapMs;
      emit(ev, { type: "unlockReveal", id: id });
    }
    if (state.tree.golden && !f.goldPending && f.goldCell < 0) {
      f.goldMs = Math.max(0, f.goldMs - dt);
      if (!f.goldMs) f.goldPending = true;
    }
    var wasActive=f.encoreLeft>0;
    f.encoreLeft=Math.max(0,f.encoreLeft-dt);
    if(wasActive && !f.encoreLeft)emit(ev,{type:"encoreEnd"});
    if(!wasActive){
      var charge=Math.min(state.u17.feverPending,dt*100/150000);
      state.u17.feverPending-=charge;state.u17.feverGauge=Math.min(100,state.u17.feverGauge+charge);
      if(state.u17.feverGauge>=100){
        state.u17.feverGauge=0;state.u17.feverPending=0;
        f.encoreLeft=nodeEffects(state).encoreSpan;
        addGain(f.progress, 'fevers', 1, 1e24);
        emit(ev,{type:"encore",duration:f.encoreLeft});
      }
    }
    checkAchievements(state, ev);
  }

  function productMultiplier(state) {
    var value = 1;
    DATA.tree.forEach(function (n) { if (n.productMultiplier && state.tree[n.id]) value *= n.productMultiplier; });
    return value*(state.u14.collection?1.1:1);
  }
  function fanCount(state) {
    if (!state.tree.boxHelper) return 0;
    return DATA.fanVenueSlugs.filter(function(slug) {return reached(state,slug);}).length;
  }
  function syncWorkers(state) {
    var w = state.features.workers, ids = [], count = fanCount(state);
    var roster = count + ":" + (state.tree.assistant ? 1 : 0);
    if (state._workerRoster === roster && w.actors.length === count + (state.tree.assistant ? 1 : 0)) return;
    state._workerRoster = roster;
    for (var i = 0; i < count; i++) ids.push("fan-" + i);
    if (state.tree.assistant) ids.push("assistant-0");
    w.actors = w.actors.filter(function (a) { return ids.indexOf(a.id) >= 0; });
    ids.forEach(function (id) {
      if (w.actors.some(function (a) { return a.id === id; })) return;
      var role = id.split("-")[0], every = role === "fan" ? nodeEffects(state).helperEvery : 1200;
      w.actors.push({ id: id, role: role, phase: "idle", cell: -1, audId: state.audId,
        remainingMs: 0, cycleRemainingMs: every + (role === "fan" ? Number(id.split("-")[1]) * every / 5 : 0) });
    });
  }
  function cancelWorkers(state) {
    state.features.workers.actors.forEach(function (a) { a.phase = "idle"; a.cell = -1; a.remainingMs = 0; });
  }
  function tickBoxHelper(state, dt, ev) {
    if (!state.tree.boxHelper && !state.tree.assistant && !state.features.workers.actors.length) return;
    syncWorkers(state);
    var w = state.features.workers;
    for (var a of w.actors) {
      if (w[a.role + "Paused"]) continue;
      var every = (a.role === "fan" ? nodeEffects(state).helperEvery : 1200) / helperSpeed(state);
      a.cycleRemainingMs = Math.max(0, a.cycleRemainingMs - dt);
      if (a.phase !== "idle") {
        var c = state.board[a.cell];
        if (a.audId !== state.audId || !c || c.sealed || (a.phase === "move" && c.hp <= 0)) {
          a.phase = "idle"; a.cell = -1; a.remainingMs = 0;
          emit(ev, { type: "worker", workerId: a.id, cell: -1, audId: state.audId, phase: "idle" });
          continue;
        }
        a.remainingMs = Math.max(0, a.remainingMs - dt);
        if (a.remainingMs) continue;
        if (a.phase === "move") {
          a.phase = "work"; a.remainingMs = 150;
          var dmg = wandDamage(state) * branchBonus(state, "pet") * (1 + .15 * state.tree.fanPower) * (a.role === "fan" ? 0.35 : 0.8 * (c.golden ? 1.5 : 1));
          emit(ev, { type: "worker", workerId: a.id, cell: a.cell, audId: a.audId, phase: "work", dmg: dmg });
          usedHelper(state,a.role); damageCell(state, a.cell, dmg, ev, a.role);
          if (state.mode !== "fight" || state.u18.map) return;
        } else {
          a.phase = "idle"; a.cell = -1;
          emit(ev, { type: "worker", workerId: a.id, cell: -1, audId: state.audId, phase: "idle" });
        }
        continue;
      }
      if (a.cycleRemainingMs > 300) continue;
      var cursorKey = a.role + "Cursor", chosen = -1;
      for (var pass = 0; pass < 2 && chosen < 0; pass++) {
        for (var n = 0; n < state.board.length; n++) {
          var i = (w[cursorKey] + n) % state.board.length, cell = state.board[i];
          if (cell.hp <= 0 || cell.sealed) continue;
          if (!pass && w.actors.some(function (other) { return other !== a && other.phase !== "idle" && other.cell === i; })) continue;
          chosen = i; break;
        }
      }
      if (chosen < 0) continue;
      w[cursorKey] = (chosen + 1) % state.board.length;
      a.cell = chosen; a.audId = state.audId; a.phase = "move"; a.remainingMs = 300;
      a.cycleRemainingMs += every;
      emit(ev, { type: "worker", workerId: a.id, cell: chosen, audId: a.audId, phase: "move" });
    }
  }

  function colleagueCount(state) { return state.tree.colleague ? 1 + state.tree.colleagueMore : 0; }
  function colleagueDamage(state) { return CONST.colleagueDmg * (state._V || 1) * (1 + .2 * state.tree.colleaguePower) * branchBonus(state, "pet"); }
  function tickColleagues(state, dt, ev) {
    var n = colleagueCount(state);
    if (!n || state.u15.tutorial.active) return;
    var timers = state._colMs || (state._colMs = []), every = nodeEffects(state).colleagueEvery;
    timers.length = n;
    for (var i = 0; i < n; i++) {
      if (timers[i] == null) timers[i] = every * (.5 + .5 * i / n);
      timers[i] -= dt;
      if (timers[i] > 0) continue;
      timers[i] += every;
      var dmg = colleagueDamage(state);
      emit(ev, { type: "colleague", index: i, name: DATA.colleagueNames[i % DATA.colleagueNames.length], dmg: dmg });
      // U31b: the colleague's hit is always its own audHit (source 'colleague'); blocked when the doubt did not change.
      var hpBefore = state.audHp, from = ev ? ev.length : 0;
      dealAud(state, dmg, ev, "colleague");
      if (ev) {
        var mine = null;
        for (var k = from; k < ev.length; k++) if (ev[k].type === "audHit" && ev[k].source === "colleague") { mine = ev[k]; mine.index = i; }
        if (!mine) emit(ev, { type: "audHit", dmg: 0, applied: 0, blocked: true, source: "colleague", index: i });
        else if (state.audHp === hpBefore) mine.blocked = true;
      }
      if (state.audHp <= 0 && state.mode === "fight" && !state.resolved) { onWin(state, ev); return; }
    }
  }
  function hasReward(state, id) { return state.features.rewards.indexOf(id) >= 0; }
  function helperSpeed(state) { return hasReward(state,3) ? 1.1 : 1; }
  function isFinalBoss(state) { return profile(state) === "homecoming"; }
  function skipCurtainCall(state) {
    if (state.features.climax.left <= 0) return false;
    state.features.climax.left = 0; state.features.climax.paradeDone = true; return true;
  }
  function tapPaper(state, cell) {
    var ev=[], m=state.features.magic;
    if (state.mode !== 'fight' || state.features.climax.left > 0) return ev;
    var at=m.papers.findIndex(function(p){return p.cell===cell;});
    if(at<0)return ev;
    m.papers.splice(at,1); usedHelper(state,"flashpaper");
    emit(ev,{type:'paperFlash',cell:cell});
    for(var i=0;i<state.board.length && state.mode==='fight';i++) damageCell(state,i,wandDamage(state)*1.5*(1+.2*state.tree.flashpaperPower),ev,'magic');
    return ev;
  }
  function tickMagic(state, dt, ev) {
    var m=state.features.magic,t=state.tree; m.clock+=dt;
    var live=function(){return state.board.map(function(c,i){return c.hp>0&&!c.sealed?i:-1;}).filter(function(i){return i>=0;});};
    var strike=function(id,i,ratio){if(state.mode!=='fight')return;emit(ev,{type:'magicHit',helper:id,cell:i,ball:id==='sponge'?m.balls.indexOf(b):-1});damageCell(state,i,wandDamage(state)*ratio,ev,'magic');};
    if(t.sponge && !m.paused.sponge) {
      usedHelper(state,"sponge");
      var count=Math.min(3,1+t.spongeCount);
      while(m.balls.length<count) {var n=m.balls.length;m.balls.push({x:64+n*90,y:64+n*140,vx:310+n*40,vy:230+n*50,last:{}});}
      for(var b of m.balls){
        var speed=(1+.12*t.spongeSpeed)*helperSpeed(state);
        b.x+=b.vx*speed*dt/1000;b.y+=b.vy*speed*dt/1000;
        for(var axis of ['x','y']){if(b[axis]<16){b[axis]=32-b[axis];b['v'+axis]=Math.abs(b['v'+axis]);}if(b[axis]>592){b[axis]=1184-b[axis];b['v'+axis]=-Math.abs(b['v'+axis]);}}
        for(var i of live()){var p=cellPosition(state,i),x=8+p.col*120,y=8+p.row*120;
          if(b.x>=x-12&&b.x<=x+124&&b.y>=y-12&&b.y<=y+124&&(b.last[i]==null||m.clock-b.last[i]>=400)) {b.last[i]=m.clock;strike('sponge',i,.25*(1+.15*t.spongePower));if(state.mode!=='fight')return;}
        }
      }
    }
    var periods={cardthrow:1500,tipbox:6000,crystal:8000,water:9000,spotlight:4000};
    for(var id of Object.keys(periods)) {
      if(!t[id]||m.paused[id])continue;
      var every=periods[id]*(1-.1*t[id+'Speed'])/helperSpeed(state);
      if(m.timers[id]==null)m.timers[id]=every;
      m.timers[id]-=dt;
      if(m.timers[id]>0)continue;
      m.timers[id]+=every;
      var cells=live(),cell=cells.length?cells[m.cursor%cells.length]:0;if(cells.length)addGain(m, 'cursor', 1, 1e12);
      if(id==='cardthrow')for(var n=0;n<Math.min(4,1+t.cardthrowCount)&&cells.length;n++)strike(id,cells[(m.cursor+n)%cells.length],.4*(1+.15*t.cardthrowPower));
      if(id==='tipbox'){var coins=(2+legacyRank(state.venue))*(1+.25*t.tipboxPower);earnCoins(state,coins);emit(ev,{type:'magicCoins',cell:cell,coins:coins});}
      if(id==='crystal')state.shield=Math.min(state.mentalMax*nodeEffects(state).shieldRatio,state.shield+state.mentalMax*.006*(1+.2*t.crystalPower)*gearMultiplier(state,"confidence"));
      if(id==='water')autoHeal(state,state.mentalMax*.03*(1+.2*t.waterPower));
      if(id==='spotlight'){
        var rows=Array.from(new Set(state.board.map(function(c,i){return cellPosition(state,i).row;})));
        var start=m.cursor%rows.length;addGain(m, 'cursor', 1, 1e12);
        for(var n=0;n<Math.min(2,1+t.spotlightCount);n++){var row=rows[(start+n)%rows.length];emit(ev,{type:'spotlight',cell:cell,row:row});for(var i of cells)if(cellPosition(state,i).row===row)strike(id,i,.6*(1+.15*t.spotlightPower));}
      }
      usedHelper(state,id); emit(ev,{type:'magicPulse',helper:id,cell:cell});
      if(state.mode!=='fight')return;
    }
  }
  function usedHelper(state,id) { if (state.helpersUsed.indexOf(id)<0) state.helpersUsed.push(id); }
  function selectReviewTarget(state) {
    var r=state.review;
    for(var n=0;n<state.board.length;n++) {
      var i=(r.cycle+n)%state.board.length, c=state.board[i];
      if(c.hp>0&&!c.sealed) { r.target=i; return; }
    }
    r.target=-1;
  }
  function tickReview(state,dt,ev) {
    if(state.batchD.side||state.batchD.encore.phase==='round')return;
    var home=isFinalBoss(state), friendly=state.pattern==='friendlyReview';
    if(!home&&!friendly)return;
    var r=state.review;
    r.bonusMs=Math.max(0,r.bonusMs-dt); r.actMs+=dt;
    if(home) {
      var act=state.audHp<=state.audHpMax*.30?3:state.audHp<=state.audHpMax*.65?2:1;
      while(r.act<act) {
        r.act++; r.actMs=0; r.target=-1; r.elapsed=0;
        emit(ev,{type:'homecomingAct',act:r.act,line:getAud(state.venue,state.j)['act'+r.act+'Line']});
        if(r.act===3&&!r.lastHeckle){r.lastHeckle=1;state.heckleMs=CONST.finalHeckleWarnMs;state.telegraphed=false;emit(ev,{type:'lastHeckle',hit:CONST.finalHeckle});}
      }
      if(r.act===3) { if(r.actMs>=2000&&!r.finaleUsed)r.finaleReady=true; return; }
      if(r.act===2)return;
    }
    var period=friendly?18000:15000, duration=friendly?6000:8000;
    r.elapsed+=dt;
    if(r.elapsed>=period) { r.elapsed-=period; addGain(r, 'cycle', 1, 1e9); selectReviewTarget(state); emit(ev,{type:'reviewTarget',cell:r.target}); }
    if(r.target>=0 && (!state.board[r.target] || state.board[r.target].hp<=0 || state.board[r.target].sealed))selectReviewTarget(state);
    if(r.elapsed>=2000+duration)r.target=-1;
    // Cycle zero waits for the first full period before showing a target.
  }
  function reviewOpen(state,i,source,ev) {
    var r=state.review, home=isFinalBoss(state);
    if(!home&&state.pattern!=='friendlyReview')return;
    if(r.target===i&&r.elapsed>=2000) {
      r.cancel=true; r.target=-1;
      if(home)r.bonusMs=4000;
      emit(ev,{type:'reviewApplause',cell:i});
    }
    if(home&&r.act===2&&r.pairs<3) {
      var manual=!source||source==='manual', kind=manual?'manual':'auto';
      var automation=state.tree.boxHelper||state.tree.assistant||state.tree.chain4||['sponge','cardthrow','spotlight','flashpaper'].some(function(id){return state.tree[id];});
      if(r.lastSource && ((kind!==r.lastSource) || (!automation&&manual&&r.lastCell!==i))) {
        r.pairs++; addGain(state, 'finisher', 5*gearMultiplier(state,'finale'), 1000); r.lastSource='';r.lastCell=-1;
        emit(ev,{type:'jointApplause',cell:i});
      } else { r.lastSource=kind; r.lastCell=i; }
    }
  }
  function tickBoss(state,dt,ev) {
    tickFuture(state,dt,ev);
    tickReview(state,dt,ev);
    if(profile(state) !== "mirror")return;
    var c=state.features.climax;
    if(!state.phase2){c.mirrorMs-=dt;if(c.mirrorMs<=0){c.mirrorMs+=15000;c.mirrored=state.board.map(function(b,i){return b.hp>0&&!b.sealed?i:-1;}).filter(function(i){return i>=0;}).slice(0,2);emit(ev,{type:'bossMirror',cell:c.mirrored[0]||0});}}
    else {c.mirrored=[];var milestone=Math.floor(state.combo/10);if(milestone>c.milestone){c.confidence=Math.min(100,c.confidence+(milestone-c.milestone)*10);c.milestone=milestone;emit(ev,{type:'confidence',cell:0,value:c.confidence});}}
  }

