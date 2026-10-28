'use strict';
  // U13: explicit time inputs keep offline accounting pure and reproducible.
  function emptyU14() { return {outfit:1,satisfied:[],sets:[],collection:false,visitor:{wait:120000,left:0,kind:'rabbit',serial:0,buff:0,incomeMs:0,incomeCoins:0,incomeRate:0},daily:{date:'',records:{},latest:'',streak:0},haptics:true}; }
  function dateOrdinal(date) {
    if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
    var y=+date.slice(0,4),m=+date.slice(5,7),d=+date.slice(8,10),leap=y%4===0&&(y%100!==0||y%400===0);
    var days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
    if(y<1||m<1||m>12||d<1||d>days[m-1])return null;
    var n=y-1;return 365*n+Math.floor(n/4)-Math.floor(n/100)+Math.floor(n/400)+days.slice(0,m-1).reduce(function(a,b){return a+b;},0)+d;
  }
  function dailySelection(date) {
    var h=2166136261;for(var i=0;i<date.length;i++)h=Math.imul(h^date.charCodeAt(i),16777619)>>>0;
    var pool=DATA.missions.slice(),out=[];
    for(i=0;i<3;i++){h=(Math.imul(h,1664525)+1013904223)>>>0;out.push(pool.splice(h%pool.length,1)[0].id);}return out;
  }
  function setDailyDate(state,date) {
    if(dateOrdinal(date)===null)return false;
    var daily=state.u14.daily;
    if(!daily.records[date]){if(Object.keys(daily.records).length>=10000)return false;daily.records[date]={progress:{},claimed:[],bonus:false,streakReward:0};}
    daily.date=date;return true;
  }
  function dailyProgress(state,id,value,max) {
    var daily=state.u14.daily,r=daily.records[daily.date];if(!r)return;
    r.progress[id]=Math.min(1e12,max?Math.max(r.progress[id]||0,value):(r.progress[id]||0)+value);
    claimMission(state,id);
  }
  function claimMission(state,id) {
    var d=state.u14.daily,r=d.records[d.date],m=DATA.missions.find(function(m){return m.id===id;});
    if(!r||!m||dailySelection(d.date).indexOf(id)<0||r.claimed.indexOf(id)>=0||(r.progress[id]||0)<m.target)return false;
    r.claimed.push(id);addGain(state, 'gems', m.gems, 1e9);
    if(r.claimed.length===1 && (!d.latest || dateOrdinal(d.date)>dateOrdinal(d.latest))) {
      d.streak=d.latest && dateOrdinal(d.date)-dateOrdinal(d.latest)===1?Math.min(1e12,d.streak+1):1;d.latest=d.date;
      r.streakReward=DATA.streakGems[(d.streak-1)%7];addGain(state, 'gems', r.streakReward, 1e9);
    }
    if(r.claimed.length===3&&!r.bonus){r.bonus=true;addGain(state, 'keys', 1, 1e6);}
    return true;
  }
  function venueSetProgress(state,slug) {
    var v=DATA.venues.find(function(v){return v.slug===slug;});if(!v)return {current:0,total:0,complete:false};
    var ids=v.audiences.filter(function(a){return !a.bench;}).concat([v.headliner]).map(function(a){return a.id;});
    return {current:ids.filter(function(id){return state.u14.satisfied.indexOf(id)>=0;}).length,total:ids.length,complete:state.u14.sets.indexOf(slug)>=0};
  }
  function checkSets(state,ev) {
    DATA.venues.forEach(function(v){var p=venueSetProgress(state,v.slug);if(p.current===p.total&&!p.complete){state.u14.sets.push(v.slug);emit(ev,{type:'setBonus',slug:v.slug});}});
    var all=DATA.tree.filter(function(n){return n.branch==='collection';}).every(function(n){return state.tree[n.id]>0;});  // v4 U45: all 11 칼리 컬렉션 nodes
    if(all&&!state.u14.collection){state.u14.collection=true;emit(ev,{type:'setBonus',slug:'collection'});}
  }
  function visitorBlocked(state) {
    return !!state.u15.scene||(profile(state)==='future'&&state.u19.telegraph>0)||state.mode!=='fight'||state.resolved||state.features.climax.left>0||state.telegraphed||state.heckleMs<=CONST.telegraphMs||state.review.target>=0;
  }
  function tickVisitor(state,dt,ev) {
    var v=state.u14.visitor;v.buff=Math.max(0,v.buff-dt);v.wait=Math.max(0,v.wait-dt);
    v.incomeMs+=dt;if(v.incomeMs>=3000){v.incomeRate=Math.min(1e18,v.incomeCoins/(v.incomeMs/1000));v.incomeMs=0;v.incomeCoins=0;}
    // v4 U47 5: the pickup's 8 seconds only run while it can be tapped. While it is hidden (heckle telegraph, stage change, curtain call) the time stands still, so a character line never eats it.
    if(v.left>0){if(visitorBlocked(state))return;v.left=Math.max(0,v.left-dt);if(!v.left)emit(ev,{type:'visitorMiss'});return;}
    if(!v.wait&&!visitorBlocked(state)){v.kind=rngNext(state)<.5?'rabbit':'fan';v.left=8000;addGain(v, 'serial', 1, 1e12);v.wait=90000+Math.floor(rngNext(state)*60001);emit(ev,{type:'visitor',kind:v.kind,serial:v.serial});}
  }
  function catchVisitor(state,options) {
    var ev=options&&options.quiet?null:[],v=state.u14.visitor;
    if(!v.left||visitorBlocked(state))return ev||[];
    v.left=0;var reward=pickW(state,[50,40,10]),amount=0;
    if(reward===0)v.buff=30000;
    if(reward===1){amount=Math.floor(v.incomeRate*60);earnCoins(state,amount);v.incomeCoins=Math.max(0,v.incomeCoins-amount);}
    if(reward===2){amount=1;addGain(state, 'keys', 1, 1e6);}
    dailyProgress(state,'events',1);emit(ev,{type:'visitorCatch',reward:['power','coins','key'][reward],amount:amount});return ev||[];
  }
  function emptyIdle() { return {wallMs:0,autoAdvance:false,waiting:false,autoAcc:0,cursor:0,reward:null,milestones:[]}; }
  function emptySkills() { return {showtimeLeft:0,cheerGuard:false,cooldowns:{showtime:0,cardrain:0,cheer:0}}; }
  function milestoneMultiplier(level, marks) { return Math.pow(2,(marks||[10,25]).filter(function(n){return level>=n;}).length); }
  function statMultiplier(state,id) { return NODE_BY_ID[id] && NODE_BY_ID[id].statMilestone ? milestoneMultiplier(storedLevel(state,NODE_BY_ID[id])) : 1; } // v4 U48 C: the stored total, also for split nodes
  function nextMilestone(level, marks, cap) { if(cap==null)cap=Infinity;return (marks||[10,25]).find(function(n){return n>level && n<=cap;}) || null; }
  function formatNumber(value) {
    var n=Number(value); if(!isFinite(n))return '0';
    var abs=Math.abs(n), units=[[1e12,'조'],[1e8,'억'],[1e4,'만']];
    if(abs>99999) for(var u of units) if(abs>=u[0])return String(+(n/u[0]).toFixed(1))+u[1];
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  }
  function practiceUnlocked(state) { return !!state.trophies.family || state.knownAudiences.indexOf(DATA.venues[venueNumber('family')-1].headliner.id)>=0; }
  function practiceRate(state) { return practiceUnlocked(state) ? wandRate(state)*(.4+.1*state.tree.autoPractice) : 0; }
  function tickPractice(state,dt,ev) {
    state.idle.autoAcc+=practiceRate(state)*dt/1000;
    while(state.idle.autoAcc>=1 && state.mode==='fight') {
      state.idle.autoAcc--;
      var i=state.idle.cursor%state.board.length, p=cellPosition(state,i), a=wandArea(state);
      addGain(state.idle, 'cursor', 1, 1e12);
      var col=Math.max(0,Math.min(5-a.cols,p.col-Math.floor((a.cols-1)/2))),row=Math.max(0,Math.min(5-a.rows,p.row-Math.floor((a.rows-1)/2)));
      emit(ev,{type:'autoPractice',cell:i});
      // Auto practice uses holdPower so it does not beat active tapping.
      for(var j=0;j<state.board.length;j++) {var q=cellPosition(state,j);if(q.col>=col&&q.col<col+a.cols&&q.row>=row&&q.row<row+a.rows)damageCell(state,j,wandDamage(state)*CONST.holdPower,ev,'magic');}
    }
  }
  function skillUnlocked(state,id) { var k=DATA.skills.find(function(k){return k.id===id;});return !!(k && (state.trophies[k.clear] || state.knownAudiences.indexOf(DATA.venues[venueNumber(k.clear)-1].headliner.id)>=0)); }
  function skillCooldown(state,id) { var k=DATA.skills.find(function(k){return k.id===id;});return k ? k.cooldown*(1-.1*(state.tree[id+'Cooldown']||0))*gearMultiplier(state,"cooldown") : 0; }
  function useSkill(state,id,options) {
    var ev=options&&options.quiet ? null : [];
    if(state.u15.scene||profile(state)==='future'&&state.u19.telegraph>0||state.mode!=='fight'||state.resolved||state.features.climax.left>0||state.skills.cooldowns[id]>0||!skillUnlocked(state,id))return ev||[];
    state.skills.cooldowns[id]=skillCooldown(state,id);
    routineSkill(state,id,ev);emit(ev,{type:'skill',id:id}); dailyProgress(state,'skills',1);
    if(id==='showtime')state.skills.showtimeLeft=20000;
    if(id==='cheer'){state.skills.cheerGuard=true;state.mental=Math.min(state.mentalMax,state.mental+state.mentalMax*.1*gearMultiplier(state,"recovery"));}
    if(id==='cardrain'){
      state._skillBatch=true;
      try {for(var i=0;i<state.board.length;i++)damageCell(state,i,wandDamage(state)*3,ev,'active');}
      finally {state._skillBatch=false;}
      if(state.audHp<=0 && !state.resolved)onWin(state,ev);
    }
    checkAchievements(state,ev);
    return ev||[];
  }
  function tickSkills(state,dt) { state.skills.showtimeLeft=Math.max(0,state.skills.showtimeLeft-dt); DATA.skills.forEach(function(k){state.skills.cooldowns[k.id]=Math.max(0,state.skills.cooldowns[k.id]-dt);}); }
