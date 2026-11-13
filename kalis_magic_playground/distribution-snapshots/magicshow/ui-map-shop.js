'use strict';
  function openStageMap(selected=''){
    if(menu==='boo')return;
    if(schoolChainPaused()||(chainMark()&&!state.u15.tutorial.done)){toast('튜토리얼을 먼저 끝내 주세요');return;}
    if(!state.u18.map&&!C.openMap(state)){toast('이 장면이 끝나면 이동할 수 있어요');return;}
    openPanel('map','무대 지도');$('phoneMore').hidden=true;
    $('panelBody').append(element('p','도착했던 무대는 무료로 다시 갈 수 있어요','flow-lead'),action('지금 무대로 돌아가기',()=>{if(C.returnToStage(state)){menu='';$('panel').hidden=true; $('stage').classList.remove('map-open');previous=0;lastAudience='';save();render();}}));
    const fork=D.progressFork||{after:'multiverse',main:['lecturenote','future'],mainChoice:'내가 될 수 있는 모습만 볼까?',ifChoice:'아직 어린 나도 만나 볼까?',ifRoute:[]};
    const mainSlugs=new Set(fork.main||[]);
    const spine=D.venues.filter(v=>!v.mergedInto&&!mainSlugs.has(v.slug));
    const here=D.venues[state.venue-1];
    let reached=-1;
    spine.forEach((v,i)=>{if(state.visited.includes(v.slug)||here&&here.slug===v.slug)reached=i;});
    const castOf=v=>[...(v.audiences||[]).filter(a=>!a.bench),v.headliner].filter(Boolean);
    const ifReached=id=>BatchDView.visibleRoute(state.batchD,id,!!state.trophies.multiverse);
    const face=(v,i,kind)=>{
      const current=!!(here&&here.slug===v.slug);
      if(kind==='if')return ifReached(v.slug)?'cleared':'hidden';
      if(kind==='main'){
        const seen=state.visited.includes(v.slug)||(v.slug==='lecturenote'&&(!!state.homecomingCleared||state.knownAudiences.includes(v.headliner.id)))||(v.slug==='future'&&!!state.u19.cleared);
        if(!seen&&!current)return 'hidden';
        if(current)return 'current';
        return state.visited.includes(v.slug)?'cleared':'future';
      }
      if(current)return 'current';
      if(state.visited.includes(v.slug))return 'cleared';
      return i<=reached+1?'future':'hidden';
    };
    const dots=(v,status)=>{
      const row=element('span','','flow-dots');row.setAttribute('aria-hidden','true');
      castOf(v).forEach((a,n)=>{
        const dot=element('i','','flow-dot');
        let kind='hollow';
        if(status==='cleared')kind='filled';
        else if(status==='current'){
          if(n===state.j-1)kind='ring';
          else if(n<state.j-1||(a.id===v.headliner.id?!!state.trophies[v.slug]:!!(state.bestiary[a.id]&&state.bestiary[a.id].wins>=1)))kind='filled';
        }
        dot.classList.add('is-'+kind);row.append(dot);
      });
      return row;
    };
    const stop=(v,status)=>{
      const li=element('li','',`flow-stop is-${status}`);li.dataset.venue=v.slug;
      const mark=element('span','','flow-mark');mark.setAttribute('aria-hidden','true');
      const venueNumber=D.venues.findIndex(venue=>venue.slug===v.slug)+1;
      const name=status==='hidden'?'???':`${venueNumber ? venueNumber+' · ' : ''}${v.name}`;
      let node;
      if(status==='cleared'){
        const first=castOf(v)[0];
        node=action('',()=>['young-kali','mirror-stage'].includes(v.slug)?startBatchDSide(v.slug==='young-kali'?'young':'mirror'):startMapFight(v.slug,first.id,'normal'),!state.u18.map&&!C.travelAllowed(state));
        node.className='flow-node';node.setAttribute('aria-label',name+'로 이동');
      }else node=element('div','','flow-node');
      node.append(element('span',name,'flow-name'),dots(v,status));
      li.append(mark,node);return li;
    };
    const ifVenue=(node)=>{
      const n=Math.max(1,node.dots|0),audiences=[];
      for(let i=0;i<n-1;i++)audiences.push({id:node.id+'-'+i});
      return {slug:node.id,name:node.name,audiences,headliner:{id:node.id+'-h'}};
    };
    const list=element('ol','','flow-spine');
    spine.forEach((v,i)=>{
      list.append(stop(v,face(v,i,'spine')));
      if(v.slug!==fork.after)return;
      const split=element('li','','flow-fork');
      const grid=element('div','','flow-fork-grid');
      for(const [branch,choice,venues] of [
        ['main',fork.mainChoice+(state.dimension>1?' · 일반 엔딩':''),(fork.main||[]).map(slug=>D.venues.find(v=>v.slug===slug)).filter(Boolean)],
        ['if',fork.ifChoice+(state.dimension>1?' · 히든 엔딩':''),(fork.ifRoute||[]).filter(node=>BatchDView.visibleRoute(state.batchD,node.id,!!state.trophies.multiverse)).map(ifVenue)]
      ]){
        if(branch==='if'&&!venues.length)continue;
        const col=element('div','','flow-branch'+(branch==='if'&&state.dimension>1?' flow-branch-if':''));
        col.append(element('p',choice,'flow-choice'));
        const ol=element('ol','','flow-branch-spine');
        venues.forEach(venue=>ol.append(stop(venue,face(venue,-1,branch))));
        col.append(ol);grid.append(col);
      }
      split.append(grid);list.append(split);
    });
    const chart=element('div','','progress-flow');chart.append(list);
    $('panelBody').append(chart);
    const focus=selected||here&&here.slug;
    if(focus)chart.querySelector(`[data-venue="${focus}"]`)?.scrollIntoView({block:'center'});
    save();
  }
  // Confirmation belongs to the live button, never to the save or a detached panel.
  function silkPurchase(button, infoNow, commit, refresh, selector, afterSave) {
    if (!button.isConnected || button.disabled || button._silkBusy) return;
    const info = infoNow(), cost = Number(info.cost);
    if (!info.available || !Number.isFinite(cost) || cost < 0 || state.gems < cost) {
      button._silkCost = null; panelStatus(info.reason || info.hint || '실크가 부족해요'); return;
    }
    if (button._silkCost !== cost) {
      button._silkCost = cost;
      const question = `실크 ${cost}개로 살까요?`, scroll=$('panelBody').scrollTop;
      button._silkScroll=scroll; panelStatus(question); restorePanelScroll(scroll); button.setAttribute('aria-label',question);
      return;
    }
    button._silkBusy = true; button._silkCost = null;
    const before = state.gems, scroll = button._silkScroll ?? $('panelBody').scrollTop;
    if (!commit()) { button._silkBusy = false; panelStatus('지금은 살 수 없어요'); return; }
    const saved = save(); render(); refresh(scroll);
    panelStatus(`샀어요 · 실크 -${before - state.gems}`); restorePanelScroll(scroll); sound('learn');
    const card = $('panelBody').querySelector(selector), wallet = $('panel').querySelector('.shop-balance');
    for (const el of [card, wallet]) if (el && !reduced) animate(el,[{boxShadow:'0 0 0 3px #E8BF68'},{boxShadow:'none'}],300);
    if (afterSave) afterSave(saved,scroll);
  }
  let customizeTab='kali';
  function visibleCosmetic(tab,x){return x.id!=='future'||state.u19.cleared||state.u18.owned.kali.includes('future');}
  function customize(keepScroll=0){
    if(!Number.isFinite(keepScroll))keepScroll=0;
    if(['boo','fail','ending','rebirth','bossPhase','headliner','dealer'].includes(menu)||state.u15.scene)return;
    openPanel('customize','커스텀');$('phoneMore').hidden=true;
    panelTabs([['kali','칼리 의상'],['pads','마술 패드'],['cases','카드 케이스']],customizeTab,tab=>{customizeTab=tab;customize();});
    const reset=()=>{
      const top=$('panelBody').scrollTop;
      const ok=customizeTab==='pads'?C.equipPad(state,'floor'):C.equipCosmetic(state,customizeTab,'');
      if(!ok)return;save();render();customize(top);panelStatus('기본 모습으로 돌아갔어요');restorePanelScroll(top);
    };
    $('panelBody').append(element('p','가진 모습을 골라 입어요. 없는 것은 실크 상점에서 사요.','shop-balance'),action('기본 모습',reset));
    if(customizeTab==='kali'){
      const tiers=element('div','','story-outfits');for(let tier=1;tier<=3;tier++){const owned=tier<=state.u14.outfit;tiers.append(element('p',`${owned?'✓':'🔒'} ${['','거실 티셔츠','무대 정장','우주 망토'][tier]} · ${['','처음부터','TV 오디션 완료','달 무대 완료'][tier]}`));}$('panelBody').append(tiers);
    }
    const equipped=customizeTab==='pads'?state.u18.pads.equipped:state.u18.equipped[customizeTab];
    const equippedName=customizeTab==='pads'?padName(equipped):D.cosmetics[customizeTab].find(x=>x.id===equipped)?.name||(customizeTab==='kali'?'기본 의상':'기본 케이스');
    const wearing=customizeTab==='cases'?`착용 중: ${equippedName}`:`착용 중: ${equippedName} · ${effectText(C.gearEffects(state,customizeTab==='pads'?'pads':'kali',customizeTab==='pads'?equipped:equipped))}`;
    $('panelBody').append(element('p',wearing,'wardrobe-equipped'));
    const grid=element('div','',customizeTab==='pads'?'shop-cosmetic-grid':'cosmetic-grid');
    if(customizeTab==='pads'){
      for(const pad of D.pads)for(const color of pad.colors){
        const info=C.padInfo(state,pad.id,color);if(!info||(pad.hidden&&!info.owned))continue;
        const key=info.key,on=info.equipped,label=padName(key);
        const tile=action('',()=>{
          if(!C.padInfo(state,pad.id,color).owned){openShopAt('pads');return;}
          const top=$('panelBody').scrollTop;
          if(C.equipPad(state,key)){save();render();customize(top);panelStatus('입었어요');restorePanelScroll(top);}
        },on);
        tile.className='shop-cosmetic-tile'+(info.owned?'':' locked');tile.dataset.gear='pads:'+key;tile.dataset.pad=key;tile.setAttribute('aria-pressed',String(on));
        const effect=effectText(C.gearEffects(state,'pads',key)),difference=effectDifference('pads',key);
        tile.setAttribute('aria-label',`${label} · ${info.owned?on?'사용 중':'입히기':'실크 상점에서 열기'}`);
        tile.append(artFallback(padArt(key,true),'▰','cosmetic-icon'),element('span',label,'shop-cosmetic-name'),element('small',on?'사용 중':info.owned?'입히기':'실크 상점에서 열기'),element('small',effect,'gear-effect'),element('small',difference,'gear-difference'));
        grid.append(tile);
      }
      $('panelBody').append(grid);appendPadUpgrade($('panelBody'),customize);
    }else{
      const tab=customizeTab,shopSection=tab==='kali'?'outfits':'cases';
      for(const x of D.cosmetics[tab].filter(x=>visibleCosmetic(tab,x))){
        const info=C.cosmeticInfo(state,tab,x.id),on=state.u18.equipped[tab]===x.id;
        const tile=action('',()=>{
          if(!C.cosmeticInfo(state,tab,x.id).owned){openShopAt(shopSection);return;}
          const top=$('panelBody').scrollTop;
          if(C.equipCosmetic(state,tab,x.id)){save();render();customize(top);panelStatus('입었어요');restorePanelScroll(top);}
        },on);
        tile.className='shop-cosmetic-tile'+(info.owned?'':' locked');tile.dataset.gear=tab+':'+x.id;tile.dataset.cosmetic=tab+':'+x.id;tile.setAttribute('aria-pressed',String(on));
        tile.setAttribute('aria-label',`${x.name} · ${info.owned?on?'사용 중':'입히기':'실크 상점에서 열기'}`);
        const icon=artFallback(tab==='kali'&&x.id==='future'?'assets/kali-outfit-2.png':`assets/icon-${tab==='kali'?'kali-skin':'case'}-${x.id}.png`,x.emoji,'cosmetic-icon');
        tile.append(icon,element('span',x.name,'shop-cosmetic-name'),element('small',on?'사용 중':info.owned?'입히기':'실크 상점에서 열기'));
        if(tab==='kali')tile.append(element('small',effectText(C.gearEffects(state,'kali',x.id)),'gear-effect'),element('small',effectDifference('kali',x.id),'gear-difference'));
        if(!info.owned&&info.hint)tile.append(element('small',info.hint,'shop-cosmetic-lock'));
        grid.append(tile);
      }
      $('panelBody').append(grid);
    }
    restorePanelScroll(keepScroll);save();
  }

  function padArt(key,icon=false){
    const [id,color]=key.split(':'),pad=D.pads.find(p=>p.id===id),base=pad.asset+(color?'-'+color:'');
    return `assets/${icon&&id!=='floor'?'icon-':''}${base}-${icon&&id!=='floor'?'64':'512'}.webp`;
  }
  function padName(key){const [id,color]=key.split(':'),pad=D.pads.find(p=>p.id===id);return pad.name+(color?' · '+D.padColors[color].name:'');}
  function effectText(effects){
    const values=Object.entries(effects).filter(([,value])=>value);
    return values.length?values.map(([key,value])=>`${D.gearEffectLabels[key]} ${value>0?'+':''}${+(value*100).toFixed(2)}%`).join(' · '):'추가 효과 없음';
  }
  function effectDifference(tab,id){
    const equipped=tab==='pads'?state.u18.pads.equipped:state.u18.equipped.kali;
    const a=C.gearEffects(state,tab,id),b=C.gearEffects(state,tab,equipped);
    const keys=[...new Set([...Object.keys(a),...Object.keys(b)])],parts=[];
    for(const key of keys){const diff=(a[key]||0)-(b[key]||0);if(Math.abs(diff)>1e-9)parts.push(`${D.gearEffectLabels[key]} ${diff>0?'높음':'낮음'}`);}
    return parts.length?'착용 중 대비 '+parts.join(' · '):'착용 중과 같은 효과';
  }
  function renderBoardPad(){
    const board=$('board'),path=state.u18.pads.equipped==='personal:green'?'assets/kit/felt-tile.webp':padArt(state.u18.pads.equipped);
    if(board.dataset.padPath===path)return;
    board.dataset.padPath=path;board.style.removeProperty('--equipped-pad');
    const image=assetImage(path),ready=()=>{if(board.dataset.padPath!==path)return;if(image.naturalWidth>0)board.style.setProperty('--equipped-pad',`url('${assetUrl(path)}')`);};
    if(image.complete)ready();else image.addEventListener('load',ready,{once:true});
  }
  function shopFocus(next){if(arguments.length){shopFocus.current=next||'';return shopFocus.current;}return shopFocus.current||'';}
  function openShopAt(section){shopFocus(section);gemShop();}
  function openCustomAt(tab,keepScroll=0){customizeTab=tab;customize(keepScroll);}
  function padShopSection(){
    const section=element('section','','shop-pads');section.dataset.shopSection='pads';section.append(element('h2','마술 패드'),element('p','첫 연습 뒤 판매 · 앞 단계 패드 하나 소유 필요'));
    const grid=element('div','','shop-cosmetic-grid');
    for(const pad of D.pads.filter(p=>p.id!=='floor'&&!p.hidden))for(const color of pad.colors){
      const info=C.padInfo(state,pad.id,color),key=info.key,status=info.owned?'커스텀에서 입기':`실크 ${info.cost}`;
      const tile=action('',()=>{
        const now=C.padInfo(state,pad.id,color);
        if(!now.owned){silkPurchase(tile,()=>C.padInfo(state,pad.id,color),()=>{if(!C.buyPad(state,pad.id,color))return false;return true;},keepScroll=>{
          gemShop(keepScroll);
          if(pad.id==='lecturenote'&&typeof playManagerLines==='function')playManagerLines(D.dealer.padMention,'dealer:padMention',()=>{if(menu==='gemShop')gemShop(keepScroll);});
        },`[data-pad="${key}"]`);return;}
        openCustomAt('pads');
      },!info.owned&&!info.available);
      tile.className='shop-cosmetic-tile';tile.dataset.pad=key;tile.setAttribute('aria-pressed',String(info.equipped));
      tile.setAttribute('aria-label',`${padName(key)} · ${status} · ${effectText(C.gearEffects(state,'pads',key))}`);
      tile.append(artFallback(padArt(key,true),'▰','cosmetic-icon'),element('span',padName(key),'shop-cosmetic-name'),element('small',status),element('small',effectText(C.gearEffects(state,'pads',key)),'gear-effect'));
      if(info.reason)tile.append(element('small',info.reason,'shop-cosmetic-lock'));grid.append(tile);
    }
    section.append(grid);appendPadUpgrade(section,gemShop);return section;
  }
  function appendPadUpgrade(host,refresh){
    if(!state.u18.pads.owned.some(key=>key!=='floor'))return;
    const info=C.padUpgradeInfo(state), block=element('div','','pad-upgrade');host.append(block);host=block;
    host.append(element('p',`패드 공통 강화 ${info.level}단계 · ${padName(state.u18.pads.equipped)} · 누르기 속도 ${+C.padSpeed(state).toFixed(3)}배`));
    const label=info.level>info.max?'옛 강화 효과 유지 · 추가 강화 불가':info.cost===null?'최대 강화':info.nextPercentagePoints==null?`패드 장착 후 강화 · 실크 ${info.cost}개`:`다음 속도 +${info.nextPercentagePoints}%p · 실크 ${info.cost}개`;
    const button=action(label,()=>silkPurchase(button,()=>C.padUpgradeInfo(state),()=>C.upgradePadSilk(state),refresh,'[data-pad-upgrade]'),!info.available);button.dataset.padUpgrade='true';host.append(button);
    if(info.reason)host.append(element('small',info.reason));
  }
  // Owner 10-31: the 도감 wardrobe tab is gone. This opens 커스텀 so older calls still land on wearing.
  function wardrobe(keepScroll=0){
    if(['boo','fail','ending','rebirth','bossPhase','headliner'].includes(menu))return;
    openCustomAt('pads',keepScroll);
  }
  function restorePanelScroll(top,body=$('panelBody'),preserveRange=false){const content=body.firstChild;let cancelled=false,framesDone=false,imagesDone=false;const cancel=()=>{cancelled=true;cleanup();};
    const cleanup=()=>{for(const name of ['wheel','pointerdown'])body.removeEventListener?.(name,cancel);};const finish=()=>{if(framesDone&&imagesDone)cleanup();};
    const restore=()=>{if(cancelled||body.firstChild!==content)return;if(preserveRange){const missing=top-(body.scrollHeight-body.clientHeight);if(missing>0){let space=body.querySelector('.shop-return-space');if(!space){space=element('div','','shop-return-space');space.setAttribute('aria-hidden','true');body.append(space);}space.style.height=((parseFloat(space.style.height)||0)+Math.ceil(missing))+'px';}}body.scrollTop=Math.max(0,Math.min(top,body.scrollHeight-body.clientHeight));};
    for(const name of ['wheel','pointerdown'])body.addEventListener?.(name,cancel,{once:true,passive:true});restore();requestAnimationFrame(()=>{restore();requestAnimationFrame(()=>{restore();framesDone=true;finish();});});
    const images=[...(body.querySelectorAll?.('img')||[])].filter(img=>!img.complete);Promise.all(images.map(img=>new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}))).then(()=>requestAnimationFrame(()=>{restore();imagesDone=true;finish();}));
  }
  // Shop navigation is session-only; every purchase still reads the live Core quote.
  const shopView={tab:'supplies',scroll:{},joined:false};
  // Return coordinates and save failures belong to this live session, never the save schema.
  let shopRoutineReturn=null;
  function playShopRoutine(id,scroll,saved){
    if(!state.u19.routines.includes(id))return;
    if(!state.u19.pending.includes(id))state.u19.pending.push(id);
    shopRoutineReturn={state,id,scroll,more:moreReturn,ready:false,completed:false};
    if(saved===undefined)saved=save();
    shopRoutineReturn.ready=!!saved;
    if(!saved){panelStatus('저장하지 못했어요. 다시 보기를 눌러 저장 후 재생해 주세요.');return;}
    shopView.scroll.magic=scroll;moreReturn=false;closePanel();
  }
  function helperShopSection(){
    const section=element('section','','shop-helpers'),cfg=D.bookLayout.helperShop;
    section.dataset.shopSection='helpers';
    const opened=C.helperShopOpen(state),info=C.helperShopInfo(state,'assistant'),next=info.next;
    section.append(element('h2','도우미'),element('p',opened?'한 번에 한 명씩 함께해요.':'책 2권으로 비법 14번을 열면 어시스턴트가 무료로 합류해요.','shop-helper-note'));
    if(!opened){
      section.append(element('p',`개점 조건: 학교 축제 도착 · 케이스 자리 비법 1단계 · 책 ${cfg.opening.books}권`),element('p',cfg.nextGoodsNote));
      section.append(element('p','비법에서 책 2권으로 열기','shop-helper-note'));
    }else if(next){
      const quote=C.helperShopInfo(state,next.id),card=element('section','','gem-shop-item');card.dataset.helper=next.id+':'+next.level;
      const venue=D.venues.find(v=>v.slug===next.gate).name;
      card.append(element('h3',next.name),element('p',`실크 ${quote.cost}개${state.dimension>=2?'':' · '+venue+' 도착'}`));
      const button=action(`${next.name} 합류 · 실크 ${quote.cost}개`,()=>silkPurchase(button,()=>C.helperShopInfo(state,next.id),()=>C.helperShopBuy(state,next.id),gemShop,'[data-shop-section="helpers"]'),!quote.available);
      card.append(button);if(quote.reason)card.append(element('small',quote.reason));section.append(card);
    }else section.append(element('p','모든 도우미가 합류했어요.'));
    const joined=cfg.line.filter(person=>(state.tree[person.id]||0)>=person.level);
    if(joined.length){
      const details=element('details','','shop-joined');details.open=shopView.joined;
      details.ontoggle=()=>{shopView.joined=details.open;};
      details.append(element('summary',`합류한 도우미 ${joined.length}명`));
      joined.forEach(person=>details.append(element('p',person.name+' · 고용 완료')));section.append(details);
    }
    return section;
  }
  function gemShop(keepScroll=0){
    if(['boo','fail','ending','rebirth','bossPhase','headliner'].includes(menu))return;
    const focus=shopFocus();shopFocus('');
    if(focus)shopView.tab=focus==='helpers'?'helpers':['pads','outfits','cases'].includes(focus)?'decor':focus==='routines'||focus.startsWith('routine-')?'magic':'supplies';
    openPanel('gemShop','실크 상점');
    const balance=element('div',`실크 ${state.gems}개`,'dealer-wallet shop-balance');
    $('panel').querySelector('header').insertBefore(balance,$('closePanel'));
    const nav=element('nav','','shop-tabs');nav.setAttribute('aria-label','실크 상점 분류');
    for(const [id,label] of [['supplies','준비물'],['magic','마술'],['helpers','도우미'],['decor','꾸미기']]){
      const button=action(label+(id==='helpers'&&!C.helperShopOpen(state)?' 🔒':''),()=>{shopView.scroll[shopView.tab]=$('panelBody').scrollTop;shopView.tab=id;gemShop(shopView.scroll[id]||0);});
      button.setAttribute('aria-pressed',String(shopView.tab===id));button.dataset.shopTab=id;nav.append(button);
    }
    balance.append(nav);
    const abilities = element('section','','shop-abilities'), routines = element('section','','shop-routines');
    abilities.append(element('p','실크는 동전보다 귀해요. 오래 남는 아이템에 써 보세요.','shop-silk-note'),element('h2','스킬'));
    routines.append(element('h2','마술 루틴'),element('p','칼리가 무대에서 선보이는 마술이에요','shop-routine-note'));
    const previewRoutines=D.routines.filter(r=>!D.gemShop.some(item=>item.id==='routine-'+r.id)).map(r=>{
      const node=D.tree.find(n=>n.id==='routine-'+r.id);return {id:node.id,name:node.name,desc:node.desc,preview:true};
    });
    for(const item of [...D.gemShop,...previewRoutines]){
      if((item.id==='glove'||item.id==='brick')&&!C.hasDeck(state))continue;
      const card=element('section','','gem-shop-item');card.dataset.shopItem=item.id;
      const ownedRoutine=item.id.startsWith('routine-')&&state.u19.routines.includes(item.id.slice('routine-'.length));
      if(ownedRoutine)card.className+=' is-owned';
      const iconPath=item.id.startsWith('routine-')?`assets/icon-${item.id}.webp`:item.id==='potion'?'assets/node-chicken.webp':item.id==='refill'?'assets/kit/icon-showtime.webp':'assets/kit/icon-card-rain.webp';
      const heading=element('h3',item.name);heading.prepend(artFallback(iconPath,'✦','shop-item-icon'));
      card.append(heading,element('p',item.desc));
      const ability=D.bookLayout.routineAbilities.find(a=>a.nodeId===item.id);
      if(ability){
        const key=ability.formula==='branchBonus'?'branch.'+ability.key:ability.formula==='nodeEffects'?'effects.'+ability.key:'wandRate';
        const line=element('p',`${ownedRoutine?'공연 순서에 들어 있어요':'사면 자동 공연에 들어가요'}`,'shop-routine-preview');
        line.dataset.formula=key;card.append(line);
      }
      const add=skill=>{const info=C.gemShopInfo(state,item.id,skill),label=skill?D.skills.find(k=>k.id===skill).name+' 충전':'사기';
        const buy=action('',()=>silkPurchase(buy,()=>C.gemShopInfo(state,item.id,skill),()=>C.gemShopBuy(state,item.id,skill),gemShop,`[data-shop-item="${item.id}"]`,item.id.startsWith('routine-')?(saved,scroll)=>playShopRoutine(item.id.slice('routine-'.length),scroll,saved):null),!info.available);
        buy.setAttribute('aria-label',`${label} · 실크 ${info.cost}`);buy.append(element('span',label),element('span',String(info.cost),'kit-price kit-price-silk'));card.append(buy);if(info.reason&&item.id!=='refill')card.append(element('small',info.reason));};
      if(ownedRoutine){
        card.append(action('무료 다시 보기',()=>playShopRoutine(item.id.slice('routine-'.length),$('panelBody').scrollTop)));
      }else if(item.preview)card.append(element('small','배우면 무료로 다시 볼 수 있어요.'));
      else if(item.id==='refill'||item.id==='potion')supplyBagCard(card,item);else add();
      if(ownedRoutine)card.append(element('span','배움','shop-owned-badge'));
      (item.id.startsWith('routine-')?routines:abilities).append(card);
    }
    const pads=padShopSection();
    const outfits=element('section','','shop-customization');outfits.dataset.shopSection='outfits';outfits.append(element('h2','옷'));
    const cases=element('section','','shop-cases');cases.dataset.shopSection='cases';cases.append(element('h2','카드 케이스'));
    for(const tab of ['kali','cases']){
      const host=tab==='kali'?outfits:cases,grid=element('div','','shop-cosmetic-grid');
      for(const x of D.cosmetics[tab]){
        const info=C.cosmeticInfo(state,tab,x.id);
        const status=info.owned?'커스텀에서 입기':x.milestone?'무료 완료 보상':`실크 ${info.cost}`;
        const tile=action('',()=>{
          const now=C.cosmeticInfo(state,tab,x.id);
          if(!now.owned){
            if(x.milestone||!now.available){panelStatus(now.hint||'아직 잠김');return;}
            silkPurchase(tile,()=>C.cosmeticInfo(state,tab,x.id),()=>C.buyCosmetic(state,tab,x.id),gemShop,`[data-cosmetic="${tab}:${x.id}"]`);return;
          }
          openCustomAt(tab);
        },!info.owned&&!info.available);
        tile.className='shop-cosmetic-tile';tile.dataset.cosmetic=tab+':'+x.id;
        tile.setAttribute('aria-label',`${x.name} · ${status}${!info.owned&&info.hint?' · '+info.hint:''}`);
        const icon=artFallback(tab==='kali'&&x.id==='future'?'assets/kali-outfit-2.png':`assets/icon-${tab==='kali'?'kali-skin':'case'}-${x.id}.png`,x.emoji,'cosmetic-icon');
        tile.append(icon,element('span',x.name,'shop-cosmetic-name'),element('small',status));
        tile.append(element('small',tab==='kali'?effectText(C.gearEffects(state,'kali',x.id)):'케이스 모습 변경 · 능력 변화 없음','gear-effect'));
        if(x.milestone)tile.append(element('small',info.owned?'무료 완료 보상으로 받았어요':info.hint,'shop-cosmetic-lock'));
        else tile.append(element('small','첫 연습 뒤 판매'));
        grid.append(tile);
      }
      host.append(grid);
    }
    const helpers=helperShopSection();
    for(const [tab,sections] of [['supplies',[abilities]],['magic',[routines]],['helpers',[helpers]],['decor',[pads,outfits,cases]]]){
      for(const section of sections){section.hidden=shopView.tab!==tab;$('panelBody').append(section);}
    }
    $('panelBody').append(element('p','남는 것: 패드와 강화, 마술, 도우미, 쓰다 남은 소모품, 케이스 외형 · 다시 쓰는 것: 보드와 케이스, 일반 비법 레벨','shop-rebirth-note'));
    if(focus){
      const host=$('panelBody'),node=host&&typeof host.querySelector==='function'?host.querySelector(focus.startsWith('routine-')?`[data-shop-item="${focus}"]`:`[data-shop-section="${focus}"]`):null;
      // Scroll only the body, never clipped ancestors.
      if(node){host.scrollTop+=node.getBoundingClientRect().top-host.getBoundingClientRect().top;node.querySelector('button')?.focus({preventScroll:true});}
    }
    else restorePanelScroll(keepScroll);
  }
  // U30c: "피버 타임!" shows inside the stage, centered just below the doubt and heckle bars, then fades.
  // Reduced motion: no animation, it just stays for the same time and disappears.
  let feverBannerTimer=0;
  function showFeverBanner(){
    const banner=$('feverBanner'),heckle=$('heckleMeter');if(!banner)return;
    clearTimeout(feverBannerTimer);for(const a of banner.getAnimations?.()||[]){a.oncancel=null;a.onfinish=null;a.cancel();}
    banner.style.top=`${heckle.offsetTop+heckle.offsetHeight+6}px`;banner.hidden=false;
    const hide=()=>{banner.hidden=true;};
    if(reduced)feverBannerTimer=setTimeout(hide,1800);
    else{const a=banner.animate([{opacity:0},{opacity:1,offset:.12},{opacity:1,offset:.7},{opacity:0}],{duration:1800});a.onfinish=hide;a.oncancel=hide;}
  }
  function renderU17(){
    const active=state.features.encoreLeft>0,gauge=$('feverGauge'),overlay=$('feverOverlay');
    if(gauge.parentElement!==$('boardCard'))$('boardCard').append(gauge); // s4d: the 피버타임 gauge sits on the workbench frame (it scrolled with the window before)
    gauge.setAttribute('aria-valuenow',String(Math.floor(state.u17.feverGauge)));gauge.querySelector('span').style.width=`${active?100:state.u17.feverGauge}%`;
    gauge.hidden=!active&&state.u17.feverGauge<=0;gauge.classList.toggle('active',active);overlay.hidden=!active;
    if(active&&!renderU17.was)showFeverBanner();renderU17.was=active;overlay.classList.toggle('fever-paused',paused()||state.mode!=='fight');
    const confetti=$('feverConfetti');confetti.hidden=!active||reduced;confetti.classList.toggle('fever-paused',paused()||state.mode!=='fight'); // v4 U47 9
    if(window.Sfx)window.Sfx.setMusicScene(D.venues[state.venue-1].slug,state.j>D.venues[state.venue-1].audiences.length,active);
  }
  function updateSoundButton() {
    const on = window.Sfx && !window.Sfx.isMuted();
    $('soundButton').textContent = phone?(on?'소리 ON':'소리 OFF'):on?D.ui.soundOn:D.ui.soundOff;
    $('soundButton').setAttribute('aria-pressed', String(!!on));
  }
  function panelTabs(tabs, selected, select) {
    const nav = element('nav', '', 'panel-tabs'); nav.setAttribute('aria-label', '도감과 강화 분류');
    for (const [id, label] of tabs) {
      const button = action(label, () => select(id));
      button.setAttribute('aria-pressed', String(id === selected)); nav.append(button);
    }
    $('panelBody').append(nav);
  }
  function drawArchive() {
    const grid = element('div', '', 'ending-archive');
    const homeSeen=state.homecomingCleared||state.knownAudiences.includes('h-lecturenote-kim');
    const home=element('article','','ending-entry'+(homeSeen?' seen':''));
    home.append(element('h2',homeSeen?'칼리 마술 성장기 · 돌아올 무대':'아직 만나지 않은 이야기'),element('p',homeSeen?'멀리 다녀와도, 같이 마술할 곳이 있다.':'새로운 이야기를 만나면 공개돼요'));
    grid.append(home);
    const dimensions = [...new Set([1,2,3,4,5, ...state.endings])].sort((a,b) => a-b);
    for (const d of dimensions) {
      const seen = state.endings.includes(d), ending = endingText(d);
      const card = element('article', '', `ending-entry${seen ? ' seen' : ''}${d === 5 ? ' true-ending' : ''}`);
      card.append(element('span', seen ? '🏆' : '🔒', 'entry-emoji'), element('p', `멀티버스 회상 · 차원 ${d}`), element('h2', seen ? ending.title : '아직 만나지 않은 엔딩'), element('p', seen ? ending.body : '이 차원의 멀티버스 공연을 마치면 공개돼요'));
      grid.append(card);
    }
    $('panelBody').append(element('p', `기록한 엔딩 ${new Set(state.endings).size}개 · 환생해도 남아요`, 'tree-wallet'), grid);
  }
  function phaseTransition() {
    sound('finisher'); release();
    sceneLight(.06);
    animate($('audience'), [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)', offset: .45 }, { transform: 'scaleX(-1)' }], 650);
    const line = U5.phase2Line(D.venues, state.audId, state.venue);
    queueAudienceLine(line,'phase:mirror');
    openPanel('bossPhase', '마지막 의심 · 2단계');
    const scene = element('div', '', 'climax-scene');
    scene.append(element('span', '🪞', 'result-icon'), element('h2', line), element('p', '거울 속 내가 지팡이를 들었다. 손놀림은 느려지고, 의심은 다시 차오른다.'));
    const go = action('나를 위한 마지막 공연', () => {
      if (menu !== 'bossPhase') return;
      clearTimeout(dialogueTimer); menu = ''; $('panel').hidden = true; $('stage').classList.remove('map-open'); previous = 0;
      render(); $('bookButton').focus();
    });
    scene.append(go); $('panelBody').append(scene); go.focus(); save();
    dialogueTimer = setTimeout(() => { if (menu === 'bossPhase' && !document.hidden) go.click(); }, 4200);
  }
  function clearEndingEffects() {
    particles.length=0; flights.length=0; numbers.length=0; badges.length=0; events.recentBadges?.clear(); wonMoment=null;
    presentation.clear();toastQueue.length=0; visibleToasts.forEach(t=>t.el.remove()); visibleToasts.length=0; lastToastKind='';
    clearTimeout(bannerTimer); bannerQueue.length=0; unlockBannerQueue.length=0; bannerActive=null; $('banner').hidden=true;
    document.querySelectorAll('.case-lightning').forEach(el=>el.remove());
  }
  function showEnding() {
    clearTimeout(dialogueTimer); release(); clearEndingEffects();
    if(!state.homecomingCleared) {
      openPanel('ending','이어지는 공연');
      const next=action('이어지는 공연',()=>{C.continueStory(state);menu='';$('panel').hidden=true; $('stage').classList.remove('map-open');previous=0;lastAudience='';save();render();});
      $('panelBody').append(element('h2','우주 끝에서, 다시 사람 곁으로'),next); next.focus();
      return;
    }
    openPanel('ending',state.u19.cleared?'미래의 나 · 다음 한 장':'돌아올 무대 · 렉쳐노트');
    sound('ending'); drawEnding();
  }
  function drawEnding() {
    clearTimeout(dialogueTimer); $('panelBody').replaceChildren();
    const venue=C.venueBySlug(state.u19.cleared?'future':'lecturenote'), lines=state.u19.cleared?D.futureEnding:venue.headliner.endingLines;
    const scene=element('div','','ending-scene homecoming-scene');
    let primary;
    const picture=element('div','','homecoming-picture');
    picture.style.backgroundImage=`url("${assetUrl(venueAsset(venue))}")`;
    const fallback=element('div','','homecoming-portraits');
    for(const a of [...venue.audiences,venue.headliner]) {const face=element('span',a.name,'homecoming-face');sprite(face,audienceAsset(venue,a));fallback.append(face);}
    picture.append(fallback); sprite(picture,state.u19.cleared?'assets/ending-future-table.png':'assets/ending-lecturenote.png'); scene.append(picture);
    if(endingStep<lines.length) {
      primary=action('장면 건너뛰기',()=>{endingStep=lines.length;drawEnding();});
      // v4 U51 2: a 다음 at the right shows the next line at once (the lines still move on by themselves every 4.5 s); after the last line it shows the recap, as before.
      const lineNext=action('다음',()=>{if(menu!=='ending'||!lineStep())return;endingStep++;drawEnding();});lineNext.classList.add('ending-next','line-next','u26-primary');primary.classList.add('line-skip');
      const row=element('div','','ending-actions ending-line-actions');row.append(primary,lineNext);primary=lineNext; // 다음 takes the focus (Enter = next line)
      scene.append(element('h2',lines[endingStep]),row);
      // Four 4.5-second beats: 18 seconds, pausing while the page is hidden.
      const next=()=>{if(menu!=='ending')return;if(document.hidden){dialogueTimer=setTimeout(next,500);return;}endingStep++;drawEnding();};
      dialogueTimer=setTimeout(next,4500);
    } else {
      const counts=C.recap(state);
      scene.append(element('h2','칼리 마술 성장기'),element('p',lines[lines.length-1]), /* s5t: the last line (futureEnding was reordered; lecturenote has 4) */element('p',`관객 감탄 ${counts.wins}회 · 함께한 도우미 ${counts.helpers}종 · 방문한 무대 ${counts.venues}곳`,'homecoming-recap'));
      const buttons=element('div','','ending-actions');
      primary=state.u19.cleared?action('가게에 남기',continueDimension):action('서재 앞 테이블로',()=>{C.beginFuture(state,true);menu='';$('panel').hidden=true; $('stage').classList.remove('map-open');previous=0;lastAudience='';endingStep=0;save();render();});
      buttons.append(primary);if(state.u19.cleared)buttons.append(action('다음 차원의 공연',showRebirth)); scene.append(buttons);
      if (state.u19.cleared) appendMagicInvitation(scene);
    }
    $('panelBody').append(scene); primary.focus();
  }
  function appendMagicInvitation(host) {
    host.append(element('p', '칼리: 마술이 재미있었으면 마술 톡방에 한번 들어가 봐'));
    for (const [label, href] of [['마술 톡방','https://open.kakao.com/o/gQns7wzi'],['마술 소개','https://kalimagic.netlify.app/video.html']]) {
      const link = element('a', label, 'magic-invitation'); link.href = href; link.target = '_blank'; link.rel = 'noopener'; host.append(link);
    }
  }
  function continueDimension() {
    clearTimeout(dialogueTimer); C.stayHome(state); menu=''; $('panel').hidden=true; $('stage').classList.remove('map-open'); previous=0;
    lastAudience=''; revealEnding=false; save(); render(); $('bookButton').focus();
  }
  function showRebirth() {
    if (!state.u19.cleared) { showEnding(); return; }
    openPanel('rebirth', '다음 차원의 공연');
    const scene = element('div', '', 'rebirth-scene');
    const gain = C.starGain(state.dimension);
    const keptCoins = Math.floor(state.coins / 2), keptGems = Math.floor(state.gems / 2), keptKeys = Math.floor(state.keys / 2);
    scene.append(element('h2', `차원 ${state.dimension}에서 차원 ${state.dimension + 1}로`), element('p', `🕊️ 비둘기 +${gain} · 환생 후 비둘기 ${state.starlight + gain}`, 'rebirth-gain'));
    const columns = element('div', '', 'rebirth-lists');
    for (const [title, lines] of [
      ['다시 쓰는 것', ['마술과 도우미를 제외한 일반 비법 레벨과 해금', '무대 진행과 초대장, 트로피', '관객 도감의 감탄 횟수, 추가 조건, 팬 기록', '공연 성공과 공연 종료 횟수, 샵 매니저 진행과 임시 버프', '보드와 케이스, 날아가는 아이템', '레벨, 경험치, 최고 액트 기록, 피날레, 자신감', '멘탈은 새 차원의 최대치로 회복하고 가족 거실에서 시작']],
      ['남는 것', ['패드와 강화, 마술, 도우미, 쓰다 남은 소모품, 케이스 외형', `멘탈 회복 물약 ${state.potionCount}개 · 스킬 바로 충전 ${state.refillCount}개`, '차원 번호는 1 증가', '동전, 실크, 책의 절반', `동전 ${C.formatNumber(keptCoins)}개 · 실크 ${C.formatNumber(keptGems)}개 · 책 ${C.formatNumber(keptKeys)}개 가져가요`, '일반 비법은 처음부터 다시 배워요', '보유 비둘기와 이번에 얻는 비둘기', '비둘기 강화의 모든 레벨', '이미 본 모든 엔딩 기록과 감탄한 관객의 기억', '소리 설정과 저장 기능']]
    ]) {
      const section = element('section'); section.append(element('h3', title));
      const list = element('ul'); lines.forEach(line => list.append(element('li', line))); section.append(list); columns.append(section);
    }
    const controls = element('div', '', 'ending-actions');
    const go = action('환생하고 새 공연 시작', () => {
      if (!state.homecomingCleared) return;
      C.rebirth(state); sound('rebirth');
      menu = ''; $('panel').hidden = true; $('stage').classList.remove('map-open'); previous = 0; lastAudience = ''; lastLayout = ''; pendingIntro = null;
      revealEnding = false; particles.length = 0; flights.length = 0; numbers.length = 0; badges.length = 0; events.recentBadges?.clear(); wonMoment = null; if (typeof stopCloseWin === 'function') stopCloseWin(); // s5t-2
      presentation.clear();clearTimeout(bannerTimer); bannerQueue.length = 0; unlockBannerQueue.length = 0; bannerActive = null; $('banner').hidden = true;
      save(); render(); toast(`차원 ${state.dimension} · 비둘기 ${gain}개를 얻었어요`); $('bookButton').focus();
    });
    controls.append(go, action('엔딩으로 돌아가기', () => { revealEnding = false; endingStep = D.futureEnding.length; openPanel('ending', '미래의 나 · 다음 한 장'); drawEnding(); }));
    scene.append(columns, controls); $('panelBody').append(scene); go.focus();
  }
