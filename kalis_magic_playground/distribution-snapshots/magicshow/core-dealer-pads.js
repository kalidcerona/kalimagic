'use strict';
  // U17 outcomes are dealt once, using the existing combat RNG.
  function emptyU17(){return {gloveBuys:{},potionUsed:false,feverGauge:0,feverPending:0,gemWait:0};}
  function validU17(u){return !!(u&&typeof u.potionUsed==='boolean'&&num(u.feverGauge,0,100)!=null&&num(u.feverPending,0,100)!=null&&num(u.gemWait,0,90000)!=null&&u.gloveBuys&&typeof u.gloveBuys==='object'&&!Array.isArray(u.gloveBuys)&&Object.keys(u.gloveBuys).every(function(k){return venueNumber(k)&&integer(u.gloveBuys[k],0,100000)!=null;}));}
  function validDealerGames(g){
    if(!g||typeof g!=='object')return false;
    var c=g.cups,m=g.monte;
    if(c){
      if(integer(c.gems,0,3)==null||['shuffle','pick','result'].indexOf(c.phase)<0||integer(c.ball,0,2)==null||integer(c.initial,0,2)==null||num(c.income,0,1e18)==null||num(c.duration,2000,3000)==null||typeof c.keyRoll!=='boolean'||!Array.isArray(c.swaps)||c.swaps.length<4||c.swaps.length>12||c.swaps.some(function(p){return !Array.isArray(p)||p.length!==2||integer(p[0],0,2)==null||integer(p[1],0,2)==null||p[0]===p[1];}))return false;
      if(c.phase==='result'&&(integer(c.choice,0,2)==null||typeof c.hit!=='boolean'||num(c.coins,0,1e18)==null||integer(c.keys,0,1)==null))return false;
    }
    if(m){
      if(integer(m.gems,0,3)==null||['playing','lost','banked'].indexOf(m.phase)<0||integer(m.round,0,3)==null||num(m.income,0,1e18)==null||!Array.isArray(m.cards)||m.cards.length!==4||m.cards.some(function(n,i){return integer(n,1,13)==null||i>0&&n===m.cards[i-1];})||num(m.coins,0,1e18)==null||integer(m.keys,0,1)==null)return false;
      if(m.phase==='playing'&&m.round>=3)return false;
    }
    return true;
  }
  // A finished cups or monte game can be bought again in the same visit. An in-progress game cannot.
  function dealerGameSettled(id,game){return !!game&&(id==='cups'?game.phase==='result':game.phase==='lost'||game.phase==='banked');}
  function dealerGameStart(state,id){
    var d=state.dealer,cost=id==='cups'?2:id==='monte'?3:0;
    if(state.mode!=='dealer'||!d||!cost)return false;
    if(!d.games)d.games={cups:null,monte:null};
    if((d.games[id]&&!dealerGameSettled(id,d.games[id]))||state.gems<cost)return false;
    state.gems-=cost;dailyProgress(state,'dealer',1);
    var income=Math.max(0,state.u14.visitor.incomeRate);
    if(id==='cups'){
      var initial=Math.floor(rngNext(state)*3),ball=initial,swaps=[],count=4+Math.min(4,state.venue);
      for(var i=0;i<count;i++){var a=Math.floor(rngNext(state)*3),b=(a+1+Math.floor(rngNext(state)*2))%3;swaps.push([a,b]);if(ball===a)ball=b;else if(ball===b)ball=a;}
      d.games.cups={phase:'shuffle',gems:0,initial:initial,ball:ball,swaps:swaps,duration:Math.max(2000,3000-state.venue*70),income:income,keyRoll:rngNext(state)<Math.min(.9,.25*CONST.dealerRewardMult)};
    }else{
      var cards=[1+Math.floor(rngNext(state)*13)];
      for(var j=1;j<4;j++){var next=1+Math.floor(rngNext(state)*12);if(next>=cards[j-1])next++;cards.push(next);}
      d.games.monte={phase:'playing',gems:0,cards:cards,round:0,income:income,coins:0,keys:0};
    }
    return true;
  }
  // Seconds of income times the dealer multiplier, never more than dealerCapSeconds of income (and never less than the unmultiplied pay).
  function dealerPayout(income,seconds){return Math.min(1e18,Math.round(Math.max(income*seconds,Math.min(income*seconds*CONST.dealerRewardMult,income*CONST.dealerCapSeconds))));}
  // Cups and monte coin seconds, raised x1.5, then 딜러의 선물 and (monte) streak. Clamped before the 2.5x so one visit cannot pass dealerCapSeconds of income.
  function dealerVisitCoins(state,income,seconds,streak){
    var boosted=seconds*1.5*(nodeEffects(state).dealerCoin||1)*(streak||1);
    return dealerPayout(income,Math.min(boosted,CONST.dealerCapSeconds));
  }
  function dealerCupsReady(state){var c=state.dealer&&state.dealer.games&&state.dealer.games.cups;if(state.mode!=='dealer'||!c||c.phase!=='shuffle')return false;c.phase='pick';return true;}
  function gemGameCoins(state,amount){earnCoins(state,amount);state.u14.visitor.incomeCoins=Math.max(0,state.u14.visitor.incomeCoins-amount);}
  // Replay would otherwise pay dealerCapSeconds again on every win. The visit total stays inside one cap. Silk is not capped.
  // visitCoins and winStreak live on the dealer object and are omitted from dealerSnap, so a reload or a new visit starts them at 0.
  function dealerCoinRoom(state,income){var paid=state.dealer&&state.dealer.visitCoins||0;return Math.max(0,income*CONST.dealerCapSeconds-paid);}
  function dealerShownCoins(state,income,amount){return Math.round(Math.min(Math.max(0,amount),dealerCoinRoom(state,income)));}
  function dealerGrantCoins(state,income,amount){var give=dealerShownCoins(state,income,amount);if(state.dealer)state.dealer.visitCoins=(state.dealer.visitCoins||0)+give;if(give)gemGameCoins(state,give);return give;}
  function grantKaliPads(state){
    var p=state.u18&&state.u18.pads;if(!p||p.owned.some(function(k){var e=padEntry(k);return e&&e.id==='kali';}))return false;
    ['emerald','red'].forEach(function(c){var key=padKey('kali',c);if(p.owned.indexOf(key)<0)p.owned.push(key);});
    return true;
  }
  function bumpDealerStreak(state,outcome){
    var d=state.dealer;if(!d||outcome==='ignore')return;
    if(outcome==='miss'){d.winStreak=0;return;}
    d.winStreak=(d.winStreak||0)+1;
    if(d.winStreak>=5&&grantKaliPads(state))d.padReward=true;
  }
  function dealerCupsPick(state,index){
    var c=state.dealer&&state.dealer.games&&state.dealer.games.cups;
    if(state.mode!=='dealer'||!c||c.phase!=='pick'||integer(index,0,2)==null)return false;
    c.choice=index;c.hit=index===c.ball;c.phase='result';c.coins=dealerGrantCoins(state,c.income,dealerVisitCoins(state,c.income,c.hit?90:10,1));c.keys=c.hit&&state.venue>=3&&c.keyRoll?1:0;c.gems=c.hit?3:0;
    addGain(state, 'keys', c.keys, 1e6);addGain(state, 'gems', c.gems, 1e9);
    bumpDealerStreak(state,c.hit?'hit':'miss');
    // jackpot still reads dealerFlips. The card-pick game that used to increment it is gone, so a cups hit counts.
    if(c.hit){addGain(state.features.progress, 'dealerFlips', 1, 1e24);addGain(state.features.progress, 'cupsWins', 1, 1e24);checkAchievements(state,null);}
    return true;
  }
  // U30: Monte is a queen-tracking game. The per-round outcome keeps the old high/low odds
  // (the recommended guess: higher when the card is 7 or less), derived from the stored cards
  // with a local hash, so no state RNG is consumed and saves stay compatible.
  function monteHash(m,round){
    var h=2166136261>>>0,i,k=m.cards.concat([round,97]);
    for(i=0;i<k.length;i++){h^=k[i]+1;h=Math.imul(h,16777619)>>>0;}
    return function(){h=(h+0x6D2B79F5)>>>0;var t=Math.imul(h^h>>>15,1|h);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  }
  function monteWin(m,round){return (m.cards[round+1]>m.cards[round])===(m.cards[round]<=7);}
  function monteRound(m,round){
    // v4 U48 D2: the first round is always fair (no trick; the queen is where the player saw it go).
    var r=monteHash(m,round),win=round===0?true:monteWin(m,round),start=Math.floor(r()*3),n=4+round,swaps=[],vq=start,i,a,b,queen,vis=[start];
    for(i=0;i<n;i++){
      a=(i===n-1&&!win)?vq:Math.floor(r()*3);b=(a+1+Math.floor(r()*2))%3;
      // U30c: the last swap's order is randomized on every outcome (drawn on wins too), so a loss does not always lift the queen's slot first.
      if(i===n-1){var flipLast=r()<.5,tmp;if(!win&&flipLast){tmp=a;a=b;b=tmp;}}
      swaps.push([a,b]);queen=vq;if(vq===a)vq=b;else if(vq===b)vq=a;vis.push(vq);
    }
    var trick=win?null:{index:n-1,kind:r()<.5?'throw':'under',line:null};
    if(trick)trick.line=trick.kind==='throw'?'던지는 척하고 아래 카드를 놨지!':'위 카드랑 아래 카드를 슬쩍 바꿨지!';
    var fakes=[];for(i=0;i<Math.min(2,round);i++)fakes.push({at:1+i*2,slot:Math.floor(r()*3)});
    // U30b bent-corner ploy (round 2 on): the queen's corner is bent in plain view, then a hand-cover move
    // (same hand motion and move timing on every outcome) hides the bend's transfer. On a win the bend stays
    // on the queen; on a loss it ends on the black card that is neither the followed card nor the queen.
    // v4 U48 D2 (owner): when the ploy is shown the bent card is a red herring: the queen always comes out of one of the OTHER cards. On a win
    // the queen is the card the player followed and the bend ends on one of the two others; on a loss the bend ends on the card that is
    // neither the followed card nor the queen (as before). The bend's path after the cover move is traced back from where it ends.
    var bend=null;
    if(round>0){
      var cover=Math.floor(r()*(n-1)),q=win?vq:queen,others=[0,1,2].filter(function(x){return x!==q;}),pickOther=r()<.5?others[0]:others[1],end=win?pickOther:3-vq-q,s=end,k;
      for(k=n-1;k>cover;k--){a=swaps[k][0];b=swaps[k][1];s=s===a?b:s===b?a:s;}
      bend={start:start,cover:cover,to:s,end:end,line:'휜 카드를 따라왔지? 그게 함정이야!'};
    }
    return {win:win,start:start,swaps:swaps,fakes:fakes,tracked:vq,queen:win?vq:queen,trick:trick,bend:bend};
  }
  function monteMoveMs(venue,round,i,forceLevel){
    // First shuffle stays readable (about 650ms). 포스 slows that first shuffle a little. Later rounds keep the old 260-420ms.
    if((round|0)===0){var extra=50*(forceLevel||0);return Math.max(600,Math.min(700+extra,650+extra));}
    return Math.max(260,Math.min(420,Math.round(420-(venue||1)*8-round*30-(i%3)*6)));
  }
  function dealerMontePick(state,slot){
    var m=state.dealer&&state.dealer.games&&state.dealer.games.monte;
    if(state.mode!=='dealer'||!m||m.phase!=='playing'||integer(slot,0,2)==null)return false;
    var plan=monteRound(m,m.round),hit=slot===plan.queen;m.last={round:m.round,slot:slot,hit:hit};
    // Round 0 always wins and is neither a streak success nor a miss. Later rounds count.
    if(!hit){m.phase='lost';m.coins=0;m.keys=0;m.gems=0;if((m.round|0)>=1)bumpDealerStreak(state,'miss');return true;}
    if((m.round|0)>=1)bumpDealerStreak(state,'hit');
    // Same dealerFlips field as cups (save key unchanged). One count per correct monte pick.
    addGain(state.features.progress, 'dealerFlips', 1, 1e24);addGain(state.features.progress, 'monteWins', 1, 1e24);
    m.round++;
    // Immediate rewards do not enter the saved banked pot and are never paid again on reload.
    addGain(state, 'gems', DATA.silkRewards.monteCorrect, 1e9);
    if(m.round===3)addGain(state.features.progress, 'montePerfects', 1, 1e24);
    checkAchievements(state,null);
    // 행운의 박수: each correct pick in a row adds +15% per level (round 1, 2, 3).
    var streak=1+0.15*(state.tree.jackpot||0)*m.round;
    m.coins=dealerShownCoins(state,m.income,dealerVisitCoins(state,m.income,[0,60,150,200][m.round],streak));m.keys=m.round===3?1:0;m.gems=m.round;
    if(m.round===3)dealerMonteBank(state);return true;
  }
  function dealerMonteBank(state){
    var m=state.dealer&&state.dealer.games&&state.dealer.games.monte;
    if(state.mode!=='dealer'||!m||m.phase!=='playing'||m.round<1)return false;
    m.phase='banked';m.coins=dealerGrantCoins(state,m.income,m.coins);addGain(state, 'keys', m.keys, 1e6);addGain(state, 'gems', (m.gems||0), 1e9);return true;
  }
  function gemShopInfo(state,id,skill){
    var routine=DATA.routines.find(function(r){return r.shopCost && id==='routine-'+r.id;});
    var cost=routine?routine.shopCost:id==='glove'?2:id==='brick'?CONST.brickGems:id==='refill'?2:id==='potion'?3:0,reason='';
    if(!cost)reason='없는 상품이에요';
    else if(routine&&state.u19.routines.indexOf(routine.id)>=0)reason='이미 배운 루틴이에요';
    else if(state.u15.tutorial.active)reason='첫 연습 뒤에 살 수 있어요';
    else if((id==='glove'||id==='brick')&&!hasDeck(state))reason='칼리 덱 비법을 배우면 살 수 있어요'; // v4 U48 A/A2
    else if(id==='brick'&&state.u15.gloveLeft+CONST.brickMs>CONST.gloveLeftMax)reason='자동 연습 시간이 이미 넉넉해요';
    else if(id==='refill'&&(!skillUnlocked(state,skill)||!(state.skills.cooldowns[skill]>0)))reason='기다리는 스킬만 충전해요';
    else if(id==='potion'&&(state.mode!=='fight'||state.resolved||state.features.climax.left>0))reason='관객과 공연 중에 써요';
    else if(id==='potion'&&state.u17.potionUsed)reason='이번 공연에서 이미 썼어요';
    else if(id==='potion'&&state.mental>=state.mentalMax)reason='멘탈이 이미 가득해요';
    else if(state.gems<cost)reason='실크 '+cost+'개가 필요해요';
    return {cost:cost,reason:reason,available:!reason};
  }
  function gemShopBuy(state,id,skill){
    var info=gemShopInfo(state,id,skill);if(!info.available)return false;state.gems-=info.cost;
    var routine=DATA.routines.find(function(r){return r.shopCost && id==='routine-'+r.id;});
    if(routine){state.tree[id]=1;routineLearn(state,NODE_BY_ID[id]);recompute(state,false);}
    if(id==='glove'){var slug=VENUES[state.venue-1].slug;addGain(state.u17.gloveBuys, slug, 1, 100000);addGain(state.u15, 'gloves', 1, 100000);}
    // v4 U48 A2: 칼리 덱 한 브릭 starts 30 minutes of auto practice at once (game time; it adds on top of a running deck).
    if(id==='brick'){state.u15.gloveLeft+=CONST.brickMs;state.holding=false;state.tapAcc=0;}
    if(id==='refill')state.skills.cooldowns[skill]=0;
    if(id==='potion'){state.mental=Math.min(state.mentalMax,state.mental+state.mentalMax*.3*gearMultiplier(state,"recovery"));state.u17.potionUsed=true;}
    return true;
  }


  function emptyPads(){return {owned:['floor'],equipped:'floor',upgrades:0};}
  function padKey(id,color){return id==='floor'||id==='lecturenote'?id:id+':'+color;}
  function padEntry(key){return DATA.pads.find(function(p){return p.colors.some(function(c){return padKey(p.id,c)===key;});});}
  function validPads(p){return !!p&&Array.isArray(p.owned)&&p.owned.indexOf('floor')>=0&&new Set(p.owned).size===p.owned.length&&p.owned.every(function(k){return !!padEntry(k);})&&p.owned.indexOf(p.equipped)>=0&&integer(p.upgrades,0,DATA.padPrices.upgradeMax)!=null&&(!p.upgrades||p.owned.some(function(k){return padEntry(k).id==='kali';}));}
  function padSpeed(state){var p=state.u18&&state.u18.pads;if(!p)return 1;var entry=padEntry(p.equipped);return entry.speed+(entry.id==='kali'?p.upgrades*.05:0);}
  function gearBonus(state,key){var p=state.u18&&state.u18.pads;if(!p)return 0;var entry=padEntry(p.equipped),color=DATA.padColors[p.equipped.split(':')[1]],bonus=color&&color[entry.id];return bonus&&bonus[key]||0;}
  function outfitBonus(state,key){var id=state.u18&&state.u18.equipped.kali,e=DATA.outfitEffects[id];return e&&e[key]||0;}
  function gearMultiplier(state,key){return (1+gearBonus(state,key))*(1+outfitBonus(state,key));}
  function gearEffects(state,tab,id){
    if(tab==='kali')return Object.assign({},DATA.outfitEffects[id]||{});
    var entry=padEntry(id);if(!entry)return {};var color=DATA.padColors[id.split(':')[1]],effect=Object.assign({},color&&color[entry.id]||{});
    effect.hold=entry.speed-1+(entry.id==='kali'?state.u18.pads.upgrades*.05:0);return effect;
  }
  function padInfo(state,id,color){
    var entry=DATA.pads.find(function(p){return p.id===id;});if(!entry||entry.colors.indexOf(color)<0)return null;
    var key=padKey(id,color),p=state.u18.pads,owned=p.owned.indexOf(key)>=0,reason='';
    if(!owned){if(entry.hidden)reason='판매하지 않아요';else if(state.u15.tutorial.active)reason='첫 연습 뒤에 살 수 있어요';else if(entry.requires&&!p.owned.some(function(k){return padEntry(k).id===entry.requires;}))reason='앞 단계 패드를 먼저 사세요';else if(entry.venue&&!reached(state,entry.venue))reason='전국 마술 매니아 도착 필요';else if(state.gems<entry.cost)reason='실크 '+entry.cost+'개가 필요해요';}
    return {key:key,owned:owned,cost:entry.cost,available:!reason,reason:reason,equipped:p.equipped===key};
  }
  function buyPad(state,id,color){var info=padInfo(state,id,color);if(!info||info.owned||!info.available)return false;state.gems-=info.cost;state.u18.pads.owned.push(info.key);return true;}
  function equipPad(state,key){if(state.u18.pads.owned.indexOf(key)<0)return false;state.u18.pads.equipped=key;recompute(state,true);return true;}
  function padUpgradeInfo(state){var p=state.u18.pads,cost=Math.ceil(DATA.padPrices.upgradeBase*Math.pow(DATA.padPrices.upgradeGrowth,p.upgrades)),reason=p.upgrades>=DATA.padPrices.upgradeMax?'최대 강화':!p.owned.some(function(k){return padEntry(k).id==='kali';})?'칼리 패드를 얻으면 가능':state.coins<cost?'동전 부족':'';return {cost:cost,level:p.upgrades,available:!reason,reason:reason};}
  function upgradePad(state){var info=padUpgradeInfo(state);if(!info.available)return false;state.coins-=info.cost;state.u18.pads.upgrades++;return true;}

