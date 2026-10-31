'use strict';
  let dealerIntroSeen = false, dealerIntroLine = -1;
  // Shared 다음/건너뛰기 dialogue. The host is the story dialog, so the portrait and buttons match every other line.
  function playManagerLines(lines,key,done){
    let index=0;
    const close=()=>{dialogKey='';const host=$('storyDialog');if(host)host.hidden=true;done();};
    const show=()=>{
      if(index>=lines.length){close();return;}
      renderDialog(lines,index,key,()=>{index++;show();},()=>{index=lines.length;show();});
    };
    show();
  }
  function dealer() {
    if (['boo','fail','ending','rebirth','bossPhase'].includes(menu) || dealerBusy) return;
    if (state.mode !== 'dealer' && C.failureDealerAvailable(state) && C.openFailureDealer(state)) save();
    if (state.mode !== 'dealer' || !state.dealer) return;
    if (menu !== 'dealer') {
      dealerGameView=null; dealerMessage = '';
      dealerIntroLine = dealerIntroSeen ? -1 : 0; dealerIntroSeen = true;
      openPanel('dealer', D.ui.dealerTitle);
    }
    drawDealer();
  }
  let dealerGameView=null;
  function drawDealer() {
    const d = state.dealer;
    if (!d || menu !== 'dealer') return;
    $('panelBody').replaceChildren();
    if (dealerIntroLine >= 0) {
      const host = element('div', '', 'dealer-intro-dialog');
      $('panelBody').append(host);
      const finish = () => { finishTypingNow(); dealerIntroLine = -1; dialogKey = ''; drawDealer(); };
      renderDialog(D.dealer.firstMeeting, dealerIntroLine, 'dealer:firstMeeting', () => {
        if (++dealerIntroLine >= D.dealer.firstMeeting.length) finish();
        else drawDealer();
      }, finish, host);
      return;
    }
    const host = element('div', '', 'dealer-host');
    const figure = element('span', '', 'dealer-emoji');
    const portrait = element('img', '', 'dealer-serona'); portrait.src = 'assets/serona-hooded.png'; portrait.alt = D.dealer.name;
    figure.append(portrait);
    const bubble = element('div', '', 'dealer-speech'); // hotel stage: the act ranges follow the slugs (were venues 5-9 and 10 on)
    // fixP 3: one paragraph per speaker turn, the name as its own label (consecutive lines of one speaker stay in one paragraph).
    for (const l of D.storyV15.dealerActs[state.venue>=C.venueNumber('vegas')?2:state.venue>=C.venueNumber('meetup')?1:0]) {
      const last = bubble.lastElementChild;
      if (last && last.dataset.speaker === l.speaker) { last.lastElementChild.textContent += ' ' + l.text; continue; }
      const turn = element('p', '', 'dealer-turn'); turn.dataset.speaker = l.speaker;
      turn.append(element('span', l.speaker, 'dealer-name'), element('span', l.text, 'dealer-said')); bubble.append(turn);
    }
    host.append(figure, bubble);
    const wallet = element('p', `🪙 ${rounded(state.coins)} · 실크 ${state.gems} · 책 ${state.keys}`, 'dealer-wallet');
    const status = element('p', dealerMessage, 'dealer-message'); status.setAttribute('role', 'status');
    // The streak is the hidden-pad hint. It stays hidden until the player owns the pad the manager talks about.
    const streakN=d.winStreak|0, showStreak=state.u18.pads.owned.indexOf('lecturenote')>=0;
    const streak=element('p', showStreak?`연속 ${streakN}`:'', 'dealer-streak');
    if(!showStreak)streak.hidden=true; else streak.setAttribute('aria-label',`연속 성공 ${streakN}`);
    $('panelBody').append(host, wallet, streak, status);
    // Card pick and the slot machine are out of play. A save from the middle of either still loads (phase stays valid) and lands on this menu.
    drawDealerGames(d);
    if(d.padReward){
      d.padReward=false;
      if(typeof toast==='function')toast('칼리 패드를 얻었어요');
      if(typeof sound==='function')sound('fanfare');
      playManagerLines(D.dealer.padReward,'dealer:padReward',()=>{if(menu==='dealer')drawDealer();});
    }
    $('closePanel').disabled = dealerBusy;
  }
  // Curtain-call presentation holds the existing story queue without mutating it.
  let cheerData=null,curtainScene=null,curtainTimer=null,curtainFinish=null;
  cheerData=D.storyV15.cheers;

  function openCurtainCall(slug,review=false){
    const v=D.venues.find(v=>v.slug===slug),data=cheerData?.[slug];
    if(!v||!data)return false;
    // curtain fix: the memory is written when the call ends (here, also via 건너뛰기), so a reload during the call still owes it (owedCurtainCall)
    const finish=()=>{if(!review){uiSave.memories[slug]={slug,title:data.title,dimension:state.dimension};savePresentation();}curtainFinish=null;clearTimeout(curtainTimer);curtainScene?.remove();curtainScene=null;menu='';$('panel').hidden=true;presentation.finish();previous=0;dialogKey='';if(review){bestiaryTab='memories';bestiary();}else render();};
    openPanel('curtain',data.title);clearDecorations();
    const scene=element('section','','curtain-memory');curtainScene=scene;
    scene.style.backgroundImage=`url(${assetUrl(venueAsset(v))})`;
    const cast=element('div','','curtain-cast'),all=[...v.audiences.filter(a=>!a.bench)];
    all.splice(Math.floor(all.length/2),0,v.headliner);all.push(...(v.regulars||[])); // s5a: crowd regulars (단골 손님 at the cafe) join the cast
    for(const a of all){const actor=element('span','',a===v.headliner?'curtain-actor headliner':'curtain-actor');actor.dataset.audience=a.id;happySprite(actor,audienceAsset(v,a));cast.append(actor);}
    const bubble=action('',()=>{if(lineStep())advance();}); /* v4 U51b 2: one step per press (shared gate) */bubble.className='curtain-bubble';bubble.setAttribute('aria-label','응원 다음 대사');
    const closing=element('p','','curtain-closing'),lineRow=element('div','','curtain-line');scene.append(closing,cast,lineRow);lineRow.append(bubble); // v4 U51 2: 다음 sits right of the line (see below)
    // v4 U51 2 (owner: "닫기 버튼을 남겨줘. 그리고 그거 이름을 건너뛰기로"): the header 닫기 and the old in-scene 건너뛰기 both ended the call; only the
    // header one stays, labelled 건너뛰기 (closePanel runs this finish), and the scene gets a 다음 at the right that shows the next line (the last one closes).
    curtainFinish=finish;$('closePanel').textContent='건너뛰기';$('closePanel').setAttribute('aria-label','건너뛰기');
    const nextLine=action('다음',()=>{if(lineStep())advance();});nextLine.id='curtainNext';nextLine.className='curtain-next line-next u26-primary';lineRow.append(nextLine);$('panelBody').append(scene);$('closePanel').disabled=false;
    let index=0;
    function advance(){
      if(!scene.isConnected)return;clearTimeout(curtainTimer);
      if(index>data.lines.length){finish();return;}
      let line=data.lines[index++];
      while(line&&v.audiences.some(a=>a.id===line.id&&a.bench))line=data.lines[index++];
      if(line){const a=[...v.audiences,v.headliner,...(v.regulars||[])].find(a=>a.id===line.id);bubble.textContent=(a?.name||'')+' · '+line.text;cast.querySelectorAll('.speaking').forEach(el=>el.classList.remove('speaking'));cast.querySelector(`[data-audience="${line.id}"]`)?.classList.add('speaking');}
      else if(data.closing){bubble.hidden=true;closing.textContent=data.closing.speaker+' · '+data.closing.text;}
      else{finish();return;} // v6 script: no closing line (the 비법 line is only in the 비법 노트); the call ends after the last audience line
      if(C.autoStage(state)&&state.dimension>=2)curtainTimer=setTimeout(advance,1600);
    }
    if(!review){
      // s4e2 F: the curtain call is the end of the clear sequence: a 300 ms fade in with a short fanfare (it used to open silently with a hard cut).
      if(typeof sound==='function')sound('fanfare');if(!reduced&&typeof animate==='function')animate($('panel'),[{opacity:0},{opacity:1}],300);}
    if(!reduced){for(let i=0;i<8;i++){const fx=element('span','','curtain-confetti');fx.style.left=(8+i*11)+'%';fx.style.top=(4+i%3*10)+'px';fx.style.animationDelay=(i%3*40)+'ms';scene.append(fx);setTimeout(()=>fx.remove(),600);}}
    advance();return true;
  }
  // curtain fix (Sol 6.1 item 2): the curtain call waits only in the in-memory presentation queue, so a reload after a headliner clear (the
  // twist complete panel closed, or a regular win moment) or during the call used to drop it and go straight to the 공연 뒤 lines. No new save
  // field: at boot it is still owed when this dimension's afterClear scene is queued and not started and that venue's curtain call was not
  // finished in this dimension (uiSave.memories). An open twist scene (the complete panel) queues its own call on 다음.
  function owedCurtainCall(){
    const u=state.u15;if(u.scene||u.tutorial.active||state.u18.anchor||state.batchD.twist.scene)return;
    const owed=u.queue.find(x=>x.kind==='afterClear'&&x.dimension===state.dimension&&state.trophies[x.slug]&&cheerData?.[x.slug]&&uiSave.memories[x.slug]?.dimension!==state.dimension);
    if(owed)presentation.push({stageTransition:true,minimum:0,hold:true,priority:60,start:item=>{if(!openCurtainCall(owed.slug))item.hold=false;else item.end=()=>{};}});
  }
  function gameArt(name,cls=''){
    const img=element('img','',cls);img.src='assets/ui/'+name+'.png';img.alt='';img.draggable=false;MinigameMotion.art(img,name);return img;
  }
  function gameTable(kind){
    const table=element('div','',kind+'-table routine-table');
    table.append(gameArt('cb-mat','routine-mat'));
    if(kind==='cups')table.append(gameArt('cb-wand','routine-wand'));
    else table.append(gameArt('monte-hand-cover','routine-hand'));
    return table;
  }
  const waitRoutine=ms=>new Promise(resolve=>setTimeout(resolve,reduced?0:ms));
  // Every move uses the same arc and timing on every outcome (no arc tell). Reduced motion: both cards are
  // highlighted for about 300 ms, then they move instantly, so the move can still be followed.
  const holdMs=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function swapRoutine(nodes,a,b,table,duration,onMid){
    const moving=nodes.filter(el=>Number(el.dataset.slot)===a||Number(el.dataset.slot)===b);
    const pitch=table.clientWidth*.25;
    const running=[];
    for(const el of moving){const slot=Number(el.dataset.slot),next=slot===a?b:a,dx=(next-slot)*pitch;
      // Establish overlap before motion begins; keep it through the entire crossing.
      el.style.zIndex=slot===a?'1':'3';
      if(reduced){el.classList.add('routine-highlight');el.animate?.([{opacity:.55},{opacity:1}],{duration:300});}
      else{const animation=el.animate(MinigameMotion.arc(dx,slot!==a,Math.min(24,table.clientWidth*.06)),{duration,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});running.push(animation);}
      el.dataset.nextSlot=next;
    }
    const midpoint=onMid?setTimeout(()=>{if(table.isConnected)onMid();},reduced?150:duration*.5):null;
    if(reduced){await holdMs(300);moving.forEach(el=>el.classList.remove('routine-highlight'));}
    else await waitRoutine(duration);
    if(midpoint)clearTimeout(midpoint);
    if(!table.isConnected){running.forEach(a=>a.cancel());return false;}
    moving.forEach(el=>{el.dataset.slot=el.dataset.nextSlot;el.style.setProperty('--slot',el.dataset.slot);el.style.boxShadow='';el.style.zIndex='';});
    running.forEach(a=>a.cancel());return true;
  }
  async function revealCups(c,table,choice){
    if(dealerBusy||c.phase!=='pick')return;dealerBusy=true;$('closePanel').disabled=true;
    const cups=[...table.querySelectorAll('.game-cup')];cups.forEach(el=>el.disabled=true);dealerBack(true);
    // Pick first (saved), then animate, so a reload cannot be used to pick again.
    C.dealerCupsPick(state,choice);save();
    const chosen=cups.find(el=>Number(el.dataset.slot)===choice);
    if(chosen){cups.splice(cups.indexOf(chosen),1);cups.unshift(chosen);}
    for(const cup of cups){if(!table.isConnected){dealerBusy=false;return;}const slot=Number(cup.dataset.slot),art=cup.querySelector('.cup-prop');
      await MinigameMotion.lift(cup,true,()=>reduced);
      if(!table.isConnected){dealerBusy=false;return;}
      if(slot===c.ball)cup.querySelector('.cup-ball').hidden=false;
      if(slot===choice)sound(c.hit?'coin':'flip');
      await waitRoutine(280);if(!table.isConnected){dealerBusy=false;return;}
    }
    dealerBusy=false;drawDealer();
  }
  let monteGo=-1;
  // v4 U48 D1: a chosen mini game waits for its own 시작하기 button; nothing moves on opening or on choosing (UI only, the game state is unchanged).
  const gameStarted=new WeakSet();
  const startButton=(game)=>{const b=action('시작하기',()=>{if(dealerBusy)return;gameStarted.add(game);drawDealer();});b.classList.add('game-start','u26-primary');return b;};
  // The monte table before 시작하기: three face-down cards (no face is drawn, so nothing can leak the queen), the start button and the way back.
  function monteWaiting(m,area){
    area.append(element('h2','카드 몬테'),element('p','준비됐어요. 시작하기를 누르면 여왕 카드를 보여줄게요.','monte-line'));
    const table=gameTable('monte');
    for(let i=0;i<3;i++){const card=action('',()=>{},true);card.className='routine-card';card.dataset.slot=i;card.style.setProperty('--slot',i);card.setAttribute('aria-label',`카드 ${i+1}`);card.append(gameArt('monte-back','card-art'));table.append(card);}
    const back=action('샵 매니저 메뉴',()=>{if(dealerBusy)return;dealerGameView='';drawDealer();},dealerBusy);back.className='dealer-back';
    area.append(table,element('span','','flex-break'),startButton(m),back);$('panelBody').append(area);return true;
  }
  const monteFace=(card,name)=>{const img=card.querySelector('.card-art');img.src='assets/ui/'+name+'.png';MinigameMotion.art(img,name);MinigameMotion.refreshBend(card,()=>reduced);};
  async function monteFlip(cards,name,flipNames){
    sound('flip');
    await MinigameMotion.flip(cards,()=>cards.forEach((c,i)=>monteFace(c,flipNames?flipNames[i]:name)),()=>reduced);
    if(reduced){cards.forEach(c=>{c.classList.add('routine-highlight');setTimeout(()=>c.classList.remove('routine-highlight'),150);});}
  }
  const dealerBack=disabled=>{const b=document.querySelector('#panelBody .dealer-back');if(b)b.disabled=disabled;};
  // The bend-in class only plays the intro; it is dropped afterwards so a bend that stayed (win) and one that was
  // moved (loss) end with identical classes.
  const addBend=(card,animated)=>{
    if(!card||card.querySelector('.bent-corner'))return;
    const mark=element('span','',animated&&!reduced?'bent-corner bend-in':'bent-corner');
    if(animated&&!reduced){const drop=()=>mark.classList.remove('bend-in');mark.addEventListener('animationend',drop,{once:true});setTimeout(drop,500);}
    card.append(mark);MinigameMotion.bend(card,mark,animated,()=>reduced);
  };
  // The bend moves only while the dealer hand covers the cards (identical hand motion on winning rounds).
  function moveBend(cards,to,a,b){
    const pre=to===a?b:to===b?a:to,el=cards.find(c=>Number(c.dataset.slot)===pre);
    if(!el)return;
    // Always recreate, win or loss, so the DOM work is identical on every outcome.
    cards.forEach(c=>{c.querySelector('.bent-corner')?.remove();c.classList.remove('has-drawn-fold');});addBend(el,false);
  }
  // U30c cover move: a cloth with a plain hand (no red card) is laid over exactly the three cards, inside the
  // table, and the cards are faded to opacity 0 BEFORE the cover swap starts. The swap, the bend transfer
  // and the fade back all happen while nothing can be seen. Same timeline on every outcome.
  const COVER_MS=240;
  function layCover(table,cards){
    const t=table.getBoundingClientRect(),rs=cards.map(c=>c.getBoundingClientRect()),k=scale||1;
    const left=(Math.min(...rs.map(r=>r.left))-t.left)/k-6,top=(Math.min(...rs.map(r=>r.top))-t.top)/k-6;
    const width=(Math.max(...rs.map(r=>r.right))-Math.min(...rs.map(r=>r.left)))/k+12,height=(Math.max(...rs.map(r=>r.bottom))-Math.min(...rs.map(r=>r.top)))/k+12;
    const cover=element('div','','monte-cover');
    cover.style.cssText=`left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
    cover.append(gameArt('monte-hand-cover','monte-cover-hand'));
    table.append(cover);return cover;
  }
  async function coverSwap(table,cards,swap,bendTo){
    const cover=layCover(table,cards);let fades=[];
    if(reduced){
      cover.style.opacity='1';cards.forEach(c=>{c.style.opacity='0';});await holdMs(300);
    }else{
      fades=[cover.animate([{opacity:0},{opacity:1}],{duration:COVER_MS,fill:'forwards'}),...cards.map(c=>c.animate([{opacity:1},{opacity:0}],{duration:COVER_MS,fill:'forwards'}))];
      await Promise.all(fades.map(f=>f.finished.catch(()=>{})));
      // Inline state keeps the cover shown and the cards hidden even if a Reduce Motion toggle cancels the animations.
      cover.style.opacity='1';cards.forEach(c=>{c.style.opacity='0';});
    }
    if(!table.isConnected){cover.remove();return false;}
    bendTo();                       // the bend moves only after the fade-out finished
    const ok=await swap();          // the swap runs while the cards are invisible
    if(!ok){cover.remove();return false;}
    if(reduced){cards.forEach(c=>{c.style.opacity='';});cover.remove();return true;}   // restore only after the swap committed
    const back=[cover.animate([{opacity:1},{opacity:0}],{duration:COVER_MS,fill:'forwards'}),...cards.map(c=>c.animate([{opacity:0},{opacity:1}],{duration:COVER_MS}))];
    fades.forEach(f=>f.cancel());
    await Promise.all(back.map(f=>f.finished.catch(()=>{})));
    cards.forEach(c=>{c.style.opacity='';});
    cover.remove();return true;
  }
  async function animateMonte(m,table,status){
    dealerBusy=true;$('closePanel').disabled=true;dealerBack(true);
    const plan=C.monteRound(m,m.round),cards=[...table.querySelectorAll('.routine-card')];
    const alive=()=>table.isConnected&&menu==='dealer'&&dealerGameView==='monte'&&state.dealer?.games.monte===m;
    const stop=()=>{dealerBusy=false;};
    cards.forEach(c=>c.disabled=true);
    // First round: the queen stays face-up long enough to see. 포스 adds 0.6s per level. Later rounds keep the old 900ms.
    const showMs=m.round===0?1800+600*(state.tree.forceRemove||0):900;
    await waitRoutine(showMs);if(!alive()){stop();return;}
    if(plan.bend){
      addBend(cards.find(c=>Number(c.dataset.slot)===plan.bend.start),true);status.textContent='앗, 카드가 좀 휘었네';sound('flip');
      await (reduced?holdMs(700):waitRoutine(1100));if(!alive()){stop();return;}
      status.textContent='여왕을 잘 봐요!';
    }
    await monteFlip(cards,'monte-back');if(!alive()){stop();return;}
    await waitRoutine(160);
    for(let i=0;i<plan.swaps.length;i++){
      if(!alive()){stop();return;}
      const ms=C.monteMoveMs(state.venue,m.round,i,state.tree.forceRemove||0),[a,b]=plan.swaps[i],cover=!!plan.bend&&plan.bend.cover===i;
      const swap=()=>swapRoutine(cards,a,b,table,ms,null);
      if(!await(cover?coverSwap(table,cards,swap,()=>moveBend(cards,plan.bend.to,a,b)):swap())){stop();return;}
      for(const f of plan.fakes.filter(f=>f.at===i)){
        const el=cards.find(c=>Number(c.dataset.slot)===f.slot);
        if(el){if(reduced){el.classList.add('routine-highlight');await holdMs(300);el.classList.remove('routine-highlight');}else{el.animate([{transform:'translateY(0)'},{transform:'translateY(-34px)',offset:.5},{transform:'translateY(0)'}],{duration:ms,easing:'cubic-bezier(.2,.8,.2,1)'});await waitRoutine(ms);}}
        if(!alive()){stop();return;}
      }
    }
    if(!alive()){stop();return;}
    status.textContent='여왕은 어디 있을까?';
    cards.forEach(c=>c.disabled=false);dealerBusy=false;$('closePanel').disabled=false;dealerBack(false);
  }
  async function revealMonte(m,table,status,choice){
    if(dealerBusy)return;dealerBusy=true;$('closePanel').disabled=true;dealerBack(true);
    // The pick is applied and saved first, so a reload during the reveal cannot be used to pick again.
    const round=m.round,plan=C.monteRound(m,round),cards=[...table.querySelectorAll('.routine-card')];
    C.dealerMontePick(state,choice);save();
    cards.forEach(c=>c.disabled=true);
    const chosen=cards.find(c=>Number(c.dataset.slot)===choice),others=cards.filter(c=>c!==chosen);
    const faces=Presentation.monteFaces(plan,true),face=c=>faces[Number(c.dataset.slot)];
    await monteFlip([chosen],'',[face(chosen)]);if(!table.isConnected){dealerBusy=false;return;}
    if(choice===plan.queen){chosen.classList.add('money-win','gold-shine');sound('coin');}
    await waitRoutine(420);
    for(const c of others){if(!table.isConnected){dealerBusy=false;return;}await monteFlip([c],'',[face(c)]);await waitRoutine(180);}
    if(!table.isConnected){dealerBusy=false;return;}
    // v4 U48 D2: the bend line only when the player picked the bent card (the bend is now a red herring on winning rounds too).
    if(choice!==plan.queen)status.textContent=(plan.bend&&choice===plan.bend.end?plan.bend.line:'')||plan.trick?.line||'여왕은 여기 있었어요!';
    await waitRoutine(plan.bend&&choice!==plan.queen?1500:500);dealerBusy=false;drawDealer();
  }
  function drawDealerGames(d){
    const games=d.games&&typeof d.games==='object'&&!Array.isArray(d.games)?d.games:(d.games={cups:null,monte:null});
    const cupsKnown=g=>!!(g&&(g.phase==='shuffle'||g.phase==='pick'||g.phase==='result'));
    const monteKnown=g=>!!(g&&(g.phase==='playing'||g.phase==='lost'||g.phase==='banked'));
    if(dealerGameView==='cups'&&cupsKnown(games.cups)){
      const c=games.cups,area=element('section','','gem-game cups-game'),waiting=c.phase==='shuffle'&&!gameStarted.has(c);
      area.append(element('h2','컵앤볼'),element('p',waiting?'준비됐어요. 시작하기를 누르면 공을 보여줄게요.':c.phase==='shuffle'?'공을 보여줄게요. 컵을 잘 봐요!':c.phase==='pick'?'공이 어디 있을까?':c.hit?'찾았다!':'아깝다! 공은 다른 컵에 있었어요.'));
      const table=gameTable('cups');
      for(let i=0;i<3;i++){
        const cup=action('',()=>revealCups(c,table,Number(cup.dataset.slot)),c.phase!=='pick');
        cup.className='game-cup';cup.dataset.slot=i;cup.style.setProperty('--slot',i);cup.setAttribute('aria-label',`컵 ${i+1}`);
        const ball=gameArt(c.phase==='result'&&c.keys?(state.venue%2?'cb-lemon':'cb-orange'):'cb-ball','cup-ball');ball.hidden=c.phase!=='result'||i!==c.ball;const art=gameArt('fx-cup-lift-01','cup-prop');cup.append(ball,art);MinigameMotion.shadow(cup);if(c.phase==='result')MinigameMotion.lift(cup,true,true);if(c.phase==='result'&&c.keys&&i===c.ball){ball.classList.add('final-load');if(!reduced)cup.append(element('span','','final-load-fx'));}table.append(cup);
      }
      area.append(table,element('span','','flex-break'));
      if(c.phase==='result')area.append(element('p',`동전 +${rounded(c.coins)}${c.gems?` · 실크 +${c.gems}`:''}${c.keys?' · 책 +1':''}`,'game-result'));
      if(waiting)area.append(startButton(c));
      const back=action('샵 매니저 메뉴',()=>{if(dealerBusy)return;dealerGameView=null;drawDealer();},dealerBusy||c.phase==='shuffle'&&!waiting);back.className='dealer-back';area.append(back);$('panelBody').append(area);
      if(c.phase==='shuffle'&&!waiting&&Array.isArray(c.swaps))animateCups(c,table);
      return true;
    }
    if(dealerGameView==='monte'&&monteKnown(games.monte)){
      const m=games.monte,area=element('section','','gem-game monte-game');
      const settled=m.phase!=='playing'||(m.round>0&&monteGo!==m.round&&(!m.last||m.last.round===m.round-1));
      const waiting=!settled&&m.round===0&&!m.last&&!gameStarted.has(m); // v4 U48 D1: the first round waits for 시작하기 (later rounds wait for 다음 판)
      if(waiting)return monteWaiting(m,area);
      const lastRound=m.phase==='playing'?m.round-1:(m.last?m.last.round:(m.phase==='lost'?m.round:m.round-1));
      const plan=C.monteRound(m,settled?Math.max(0,lastRound):m.round);
      const status=element('p',settled?(m.phase==='lost'?(!m.last?'지난 판은 끝났어요':(plan.bend&&m.last.slot===plan.bend.end?plan.bend.line:'')||(plan.trick?plan.trick.line:'여왕은 여기 있었어요!')):m.phase==='banked'?'선물을 받았어요!':'찾았어요! 계속할까요?'):'여왕을 잘 봐요!','monte-line');status.setAttribute('role','status');
      area.append(element('h2','카드 몬테'),status);
      const table=gameTable('monte');
      const faces=Presentation.monteFaces(plan,settled);
      for(let i=0;i<3;i++){
        const showFace=!!m.last;
        const card=action('',()=>revealMonte(m,table,status,Number(card.dataset.slot)),settled);
        card.className='routine-card';card.dataset.slot=i;card.style.setProperty('--slot',i);card.setAttribute('aria-label',`카드 ${i+1}`);
        card.append(gameArt(settled&&!showFace?'monte-back':faces[i],'card-art'));
        if(settled&&m.last&&m.last.slot===i&&m.last.round===lastRound&&m.last.hit)card.classList.add('money-win','gold-shine');
        if(settled&&plan.bend&&showFace&&plan.bend.end===i)addBend(card,false);
        table.append(card);
      }
      area.append(table,element('span','','flex-break'));
      area.append(element('p',`지금 선물: 동전 ${rounded(m.coins)}${m.gems?` · 실크 ${m.gems}`:''}${m.keys?' · 책 1':''}`));
      if(m.phase==='playing'&&settled){
        const row=element('div','','dealer-controls');
        row.append(action('다음 판',()=>{if(dealerBusy)return;monteGo=m.round;drawDealer();}));
        const bank=action('그만하고 받기',()=>{if(dealerBusy)return;C.dealerMonteBank(state);save();sound('coin');drawDealer();},m.round<1);bank.dataset.bank='true';row.append(bank);area.append(row);
      }
      area.append(element('small',`정답마다 실크 +${D.silkRewards.monteCorrect} 즉시 지급 · 탈락해도 받은 실크는 남아요`));
      if(m.phase==='playing')area.append(element('small','1번 90초 동전·실크 · 2번 225초 · 3번 책·실크 + 300초'));
      const back=action('샵 매니저 메뉴',()=>{if(dealerBusy)return;dealerGameView=null;drawDealer();},dealerBusy||!settled);back.className='dealer-back';
      area.append(back);$('panelBody').append(area);
      if(!settled)animateMonte(m,table,status);
      return true;
    }
    dealerGameView=null;
    const row=element('div','','dealer-pick');
    for(const [id,label,cost,emoji,art,reward] of [
      ['cups','컵앤볼',2,'🔴','cb-ball','맞히면 동전·실크, 가끔 책'],
      ['monte','카드 몬테',3,'🂡','monte-queen',`정답마다 실크 +${D.silkRewards.monteCorrect}, 세 번이면 책`]
    ]){
      const played=games[id],settled=!!played&&C.dealerGameSettled(id,played),need=(settled||!played)&&state.gems<cost;
      const card=element('article','','dealer-game-card');
      const pic=element('div','','dealer-game-art');
      pic.append(element('span',emoji,'dealer-game-emoji'),gameArt(art,'dealer-game-img'));
      const start=action(settled?'다시 하기':played?'이어 하기':'시작',()=>{
        if(dealerBusy)return;
        if(settled){if(C.dealerGameStart(state,id)){dealerGameView=id;save();drawDealer();}}
        else if(played||C.dealerGameStart(state,id)){dealerGameView=id;save();drawDealer();}
      },dealerBusy||need);
      start.className='game-start u26-primary';
      const note=element('small',need?`실크 ${cost}장이 필요해요`:'','dealer-need');if(!need)note.setAttribute('aria-hidden','true');
      card.append(pic,element('h2',label),element('p',`실크 ${cost}`,'dealer-cost'),element('p',reward,'dealer-reward'),note,start);
      row.append(card);
    }
    const quit=action('그만하기',closePanel,dealerBusy);quit.className='dealer-leave';
    $('panelBody').append(row,quit);return true;
  }
  async function animateCups(c,table){
    dealerBusy=true;$('closePanel').disabled=true;
    const nodes=[...table.querySelectorAll('.game-cup')];
    sound('flip');animate(table.querySelector('.routine-wand'),[{transform:'rotate(0)'},{transform:'rotate(-12deg)'},{transform:'rotate(0)'}],280);
    await waitRoutine(320);
    for(let i=0;i<3;i++){
      if(!table.isConnected){dealerBusy=false;return;}
      const prop=nodes[i].querySelector('.cup-prop'),ball=nodes[i].querySelector('.cup-ball');
      ball.hidden=true;
      await MinigameMotion.lift(nodes[i],true,()=>reduced);
      if(i===c.initial)ball.hidden=false;
      if(!table.isConnected){dealerBusy=false;return;}
      if(reduced)nodes[i].classList.add('routine-highlight');
      await waitRoutine(i===c.initial?900:520);
      ball.hidden=true;
      await MinigameMotion.lift(nodes[i],false,()=>reduced);
      if(!table.isConnected){dealerBusy=false;return;}
      ball.classList.remove('ball-popping');ball.hidden=true;nodes[i].classList.remove('routine-highlight');
    }
    const duration=Math.max(260,Math.min(420,c.duration/c.swaps.length));
    for(const [a,b] of c.swaps){if(menu!=='dealer'||dealerGameView!=='cups'||state.dealer?.games.cups!==c||!await swapRoutine(nodes,a,b,table,duration)){dealerBusy=false;return;}}
    if(table.isConnected){C.dealerCupsReady(state);save();dealerBusy=false;drawDealer();}
  }

  function kaliArtPath(){if(state.u18.equipped.kali==='future')return 'assets/kali-outfit-2.png';return state.u18.equipped.kali?`assets/kali-skin-${state.u18.equipped.kali}.png`:`assets/kali-outfit-${state.u14.outfit}.png`;}
  function startMapFight(slug,id,kind){
    if(!C.travelTo(state,slug,id,kind)){toast('지금은 무대를 이동할 수 없어요');return;}
    menu='';$('panel').hidden=true;$('phoneMore').hidden=true;previous=0;lastAudience='';dialogKey='';save();render();
  }
