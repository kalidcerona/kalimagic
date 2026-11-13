'use strict';
  // Session presentation only. Nothing here is serialized into the game state.
  const bookSession = { owner: null, tab: '시작', tabs: new Map(), revision: 0 };
  function bookMemory(tab = bookSession.tab) {
    if (!bookSession.tabs.has(tab)) bookSession.tabs.set(tab, { scroll: 0, selected: new Map(), expanded: new Set() });
    return bookSession.tabs.get(tab);
  }
  function bookStageInfo(slot, id) {
    return C.nodeInfo(state, id);
  }

  function bookPick(slot, memory) {
    if (memory.selected.has(slot.slot)) return memory.selected.get(slot.slot);
    const id = slot.ids.find(id => { const i = bookStageInfo(slot,id); return i.displayable && i.stageOpen !== false && i.cost !== null; }) || slot.ids[0];
    memory.selected.set(slot.slot,id);
    return id;
  }
  function bookRememberScroll(body, memory, revision) {
    const top=memory.scroll,content=body.firstChild;
    const restore=()=>{if(menu==='book'&&bookSession.revision===revision&&body.firstChild===content){const missing=top-(body.scrollHeight-body.clientHeight);if(missing>0){let space=body.querySelector('.book-return-space');if(!space){space=element('div','','book-return-space');space.setAttribute('aria-hidden','true');body.append(space);}space.style.height=((parseFloat(space.style.height)||0)+Math.ceil(missing))+'px';}body.scrollTop=top;}};
    // Keep the requested position through late header/content reflow, until real input.
    bookSession.stopRestore?.();
    let cancelled=false;
    const apply=()=>{if(!cancelled)restore();};
    const inputs=['wheel','pointerdown','touchstart','keydown'];
    let observer;
    const stop=()=>{cancelled=true;observer?.disconnect();for(const name of inputs)body.removeEventListener?.(name,stop);body.removeEventListener?.('scroll',apply);};
    bookSession.stopRestore=stop;
    // Native scroll clamping/focus can run after the final resize notification.
    body.addEventListener?.('scroll',apply,{passive:true});
    for(const name of inputs)body.addEventListener?.(name,stop,{once:true,passive:true});
    if(typeof ResizeObserver==='function'){
      observer=new ResizeObserver(()=>{if(menu!=='book'||bookSession.revision!==revision||body.firstChild!==content)stop();else apply();});
      observer.observe(body);if(content)observer.observe(content);
      observer.observe($('panel').querySelector('header'));
    }
    apply();requestAnimationFrame(()=>{apply();requestAnimationFrame(apply);});
  }
  function bookTabs(host) {
    const row = element('div','','book-tabs'); row.setAttribute('role','tablist'); row.setAttribute('aria-label','비법 분류');
    const hint = element('small','','book-tabs-hint'); hint.setAttribute('aria-live','polite');
    const update = () => {
      if (menu !== 'book' || !row.isConnected) return;
      const left = row.scrollLeft > 1, right = row.scrollWidth - row.clientWidth - row.scrollLeft > 1;
      hint.textContent = left && right ? '← 앞뒤에 다른 분류가 있어요 →' : right ? '다른 분류가 더 있어요 →' : left ? '← 앞에 다른 분류가 있어요' : '';
    };
    D.bookLayout.tabs.forEach((tab,index) => {
      const button = action(tab, () => { bookMemory().scroll=$('panelBody').scrollTop; bookSession.tab = tab; tree(); });
      button.setAttribute('role','tab'); button.setAttribute('aria-selected',String(tab === bookSession.tab));
      button.setAttribute('aria-controls','bookCards'); button.tabIndex = tab === bookSession.tab ? 0 : -1;
      button.addEventListener('keydown',event => {
        const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!delta && !['Home','End'].includes(event.key)) return;
        event.preventDefault();
        bookMemory().scroll=$('panelBody').scrollTop;
        bookSession.tab = D.bookLayout.tabs[event.key === 'Home' ? 0 : event.key === 'End' ? D.bookLayout.tabs.length-1 : (index+delta+D.bookLayout.tabs.length)%D.bookLayout.tabs.length];
        tree(); $('panel').querySelector('.book-tabs [aria-selected="true"]')?.focus({preventScroll:true});
      });
      row.append(button);
    });
    row.addEventListener('scroll',update); host.append(row,hint);
    requestAnimationFrame(() => {
      if (menu !== 'book' || !row.isConnected) return;
      const selected=row.querySelector('[aria-selected="true"]');
      if(selected){const r=selected.getBoundingClientRect(),host=row.getBoundingClientRect();
        if(r.left<host.left)row.scrollLeft+=r.left-host.left;
        else if(r.right>host.right)row.scrollLeft+=r.right-host.right;
      }
      update();
    });
    // ResizeObserver covers rotation, text zoom and panel width changes, and is retired on rebuild.
    bookTabs.observer?.disconnect();
    if (typeof ResizeObserver !== 'undefined') { bookTabs.observer = new ResizeObserver(update); bookTabs.observer.observe(row); }
  }
  // Labels describe the formula returned by Core, not projected combat DPS.
  const bookValueLabels = {
    wandDamage:'두드리는 힘', wandRate:'누르기 속도', performance:'연출', mentalMax:'최대 멘탈',
    coinMultiplier:'동전 배수', spawnMs:'케이스 생성 간격 (ms)', boardCapacity:'케이스 자리',
    areaCols:'누르기 범위 가로', areaRows:'누르기 범위 세로',
    equipSlots:'소품 장착 자리', helperSpeed:'도우미 속도 배수', fanCount:'팬 수',
    colleagueCount:'동료 수', colleagueDamage:'동료 힘',
    critRate:'대박 확률', critPower:'대박 힘 배수', comboMs:'액트 유지 시간 (밀리초)',
    sweep:'한곳 집중 배수', miss:'헛손질 확률', goldEvery:'황금 케이스 간격 (ms)',
    goldCoins:'황금 케이스 동전 배수', prepared:'케이스 시작 피해 비율', boxXP:'케이스 개봉 경험치 배수', caseGradeFraction:'좋은 케이스 확률 성장', caseCoinBoost:'은색 이상 동전 배수', caseDmgBoost:'은색 이상 피해 배수',
    boxShield:'개봉 자신감', boxHeal:'개봉 멘탈 회복', shieldRatio:'자신감 상한 비율',
    shieldValue:'자신감 아이템 배수', healValue:'회복 아이템 배수', winHeal:'공연 완료 회복 비율',
    levelHeal:'레벨업 회복 비율', openingShield:'공연 시작 자신감 비율', calm:'야유 피해 배수',
    tip:'공연 완료 동전 배수', dealerCoin:'딜러 동전 배수', jackpot:'카드 몬테 연속 성공 보상 배수',
    gemFind:'실크 발견 확률', doveEvery:'비둘기 동작 간격 (ms)', dovePower:'비둘기 힘 배수',
    rabbitEvery:'토끼 동작 간격 (ms)', rabbitCoins:'토끼 동전', helperEvery:'팬 동작 간격 (ms)',
    colleagueEvery:'동료 동작 간격 (ms)', finalePower:'피날레 힘 배수', finaleNeed:'피날레 필요 개봉 수',
    comboValue:'연속 동작 보상 배수', encorePower:'피버 추가 마술 실력 비율', encoreSpan:'피버 시간 (밀리초)'
  };
  function bookNumber(value) {
    return Number.isFinite(value) ? value.toLocaleString('ko-KR',{maximumSignificantDigits:6}) : '계산 불가';
  }
  function bookGrowth(id) {
    const preview = C.treePreview(state,id,1), host = element('div','','tree-preview book-growth');
    host.setAttribute('aria-label','1회 구매 미리보기');
    const costs = Object.entries(preview.spent).filter(([,value])=>value>0)
      .map(([key,value])=>`${{coins:'동전',keys:'책',starlight:'비둘기',gems:'실크'}[key]} ${bookNumber(value)}`);
    host.append(element('p',`구매 ${preview.count}회 · 총가격 ${costs.join(' · ') || '0'}`));
    const changes = Object.entries(preview.changes);
    if (!changes.length) host.append(element('p',preview.count ? '이번 구매로 표시 수식의 변화는 없어요.' : '구매 전후 수식 변화 0'));
    for (const [key,change] of changes) {
      const label = key.startsWith('branch.') ? `${{hand:'표현력',box:'케이스',heart:'마음가짐',luck:'동전',pet:'도우미',finale:'피날레',collection:'컬렉션',star:'귀환 성장'}[key.slice(7)]} 가지 배수` : bookValueLabels[key.replace(/^effects\./,'')];
      const delta = `${change.delta>0?'+':''}${bookNumber(change.delta)}`;
      const percent = change.percent === null ? '기준값 0 · 변화율 계산 안 함' : `${change.percent>0?'+':''}${bookNumber(change.percent)}%`;
      const row = element('p',`${label}: 현재 ${bookNumber(change.before)} → 구매 후 ${bookNumber(change.after)} · 변화 ${delta} (${percent})`);
      row.dataset.formula = key; host.append(row);
    }
    return host;
  }
  // A failed write keeps ownership; retry the same state without another charge.
  const helperOpening = { owner: null, busy: false, pending: false };
  function openHelperShop() {
    if (helperOpening.owner !== state) Object.assign(helperOpening,{owner:state,busy:false,pending:false});
    if (helperOpening.busy) return;
    helperOpening.busy = true;
    try {
      if (!helperOpening.pending) {
        const before = typeof bookMotionBeforeBuy === 'function' ? bookMotionBeforeBuy() : null;
        if (!C.buyNode(state,'autoLearn')) return;
        if (before) bookMotionAfterBuy(before);
        helperOpening.pending = true;
      }
      if (!save()) { tree(); render(); panelStatus('저장하지 못했어요. 저장을 다시 시도해 주세요.'); return; }
      helperOpening.pending = false;
      sound('learn'); render(); shopFocus('helpers'); gemShop();
      panelStatus('도우미 상점이 열렸어요 · 어시스턴트 무료 합류 · 다음은 팬 · 동네 카페 · 실크 10개');
    } finally { helperOpening.busy = false; }
  }
  function bookDetail(slot, id, memory) {
    const node = D.tree.find(n => n.id === id), info = bookStageInfo(slot,id);
    const detail = element('div','','book-detail'); detail.id = `book-detail-${slot.slot}`;
    detail.append(element('p',node.desc,'tree-effect'));
    if(node.skillUpgrade)detail.append(element('p',`사용할 때마다 실크 ${node.skillUpgrade.fee}개 · 실크가 부족하면 기본 스킬 사용`,'skill-upgrade-cost'));
    if (typeof bookRemaining === 'function') bookRemaining(detail,info);
    if ((node.partOf || id) === 'area') detail.append(areaRangePreview());
    detail.append(element('p',`레벨 ${C.formatNumber(info.level)} / ${C.formatNumber(info.max)}`,'tree-level'));
    if (node.statMilestone) {
      const next = C.nextMilestone(info.total,[10,25],info.totalMax);
      detail.append(element('p',next ? `다음 2배: 전체 레벨 ${next} · ${next-info.total}레벨 남음` : `지금 힘 ${C.statMultiplier(state,node.partOf||id)}배`,'tree-next'),element('p',D.easyExtras.milestone,'tree-preview'));
    }
    if (info.stageOpen !== false && info.purchasable) detail.append(bookGrowth(id));
    if (id === 'autoLearn') {
      const retry = helperOpening.owner === state && helperOpening.pending;
      detail.append(element('p',D.bookLayout.helperShop.nextGoodsNote));
      if (!C.helperShopOpen(state) || retry) {
        const buy = action(retry ? '저장 다시 시도 · 추가 차감 없음' : '상점 열기 · 책 2권 · 어시스턴트 무료',openHelperShop,!retry && !info.purchasable);
        buy.classList.add('tree-cost','tree-buy'); detail.append(buy);
        return detail;
      }
    }
    if (id === 'autoLearn' && C.helperShopOpen(state)) {
      detail.append(action('도우미 상점으로 · 무료 · 성장 0', () => { shopFocus('helpers'); gemShop(); }));
      return detail;
    }
    const currency = {coins:'동전',keys:'책',starlight:'비둘기',gems:'실크'}[info.currency];
    if (info.cost === null) detail.append(element('strong',node.skillUpgrade?'✓ 배움 · 사용 시 실크 '+node.skillUpgrade.fee+'개':'✓ MAX · 완성했어요','tree-cost'));
    else {
      const buy = action(`${currency} ${C.formatNumber(info.cost)} · 배우기`, () => {
        const current = bookStageInfo(slot,id); if (!current.purchasable) return;
        memory.scroll=$('panelBody').scrollTop;
        const before = typeof bookMotionBeforeBuy === 'function' ? bookMotionBeforeBuy() : null;
        const paid = state[info.currency]; if (!C.buyNode(state,id)) return;
        if (before) bookMotionAfterBuy(before);
        if(newTutorialLesson()&&chainMark()?.step==='upgrade-play'&&id===chainNodeId&&!state.u15.bios.includes('lesson:bought'))state.u15.bios.push('lesson:bought');
        tutorialSignal('learn'); sound('learn'); save(); tree(); render(); learnedMoment(id,info.currency,paid);
      }, !info.purchasable);
      buy.classList.add('tree-cost', 'tree-buy'); buy.type = 'button';
      buy.setAttribute('aria-label',`배우기, ${currency} ${C.formatNumber(info.cost)}`); detail.append(buy);
    }
    return detail;
  }
  function tree(focusMap = false) {
    if (bookSession.owner !== state) {
      bookSession.owner = state; bookSession.tab = '시작'; bookSession.tabs.clear();
    }
    const practice = typeof failure !== 'undefined' && failure !== null;
    const entering = menu !== 'book';
    if (entering) openPanel('book',practice ? D.ui.practiceTitle : D.ui.bookTitle);
    const panel = $('panel'), header = panel.querySelector('header'), body = $('panelBody');
    if (practice) panel.dataset.practice = '1'; else delete panel.dataset.practice;
    header.querySelectorAll('.tree-wallet,.tree-learning,.practice-go,.book-navigation').forEach(el=>el.remove());
    body.replaceChildren();
    if (practice && !(newTutorialLesson()&&!state.u15.bios.includes('lesson:bought'))) {
      const go = action(practiceGoLabel(),restartAfterFailure); go.classList.add('practice-go','u26-primary'); header.insertBefore(go,$('closePanel'));
    }
    const wallet = element('div','','tree-wallet');
    [['🪙 ','동전 ',rounded(state.coins)],['📕 ','책 ',state.keys],['🕊️ ','비둘기 ',state.starlight],['','실크 ',state.gems]].forEach(([icon,name,value],i)=>{
      if(i)wallet.append(element('span','·','wallet-sep'));
      wallet.append(element('span',icon),element('span',name,'wallet-name'),element('span',String(value)));
    });
    header.insertBefore(wallet,$('closePanel')); $('closePanel').textContent = '뒤로';
    const navigation = element('nav','','book-navigation tree-learning'); bookTabs(navigation); header.insertBefore(navigation,$('closePanel'));
    const memory = bookMemory(), revision = ++bookSession.revision;
    const cards = element('div','','book-cards'); cards.id = 'bookCards'; cards.setAttribute('role','tabpanel'); cards.setAttribute('aria-label',bookSession.tab);
    // Fixed contract order, including locked placeholders. Wallet changes never reorder cards.
    for (const slot of D.bookLayout.slots.filter(slot => slot.tab === bookSession.tab)) {
      const id = bookPick(slot,memory), info = bookStageInfo(slot,id);
      const expanded = memory.expanded.has(slot.slot);
      const card = element('section','',expanded ? 'book-card book-card-expanded' : 'book-card'); card.dataset.slot = String(slot.slot);
      const known = slot.ids.some(stage => C.nodeInfo(state,stage).displayable) && (!slot.visibleAfterHire || state.tree[slot.visibleAfterHire] > 0);
      const title = expanded ? D.tree.find(node => node.id === id).name : slot.name;
      const toggle = action(known ? `${slot.slot}. ${title}` : `${slot.slot}. 미확인 비법`, () => {
        memory.scroll=$('panelBody').scrollTop;
        if (memory.expanded.has(slot.slot)) memory.expanded.delete(slot.slot); else memory.expanded.add(slot.slot);
        tree();
      });
      toggle.classList.add('book-card-toggle','constellation-node'); toggle.dataset.nodeId = id;
      toggle.setAttribute('aria-expanded',String(memory.expanded.has(slot.slot))); toggle.setAttribute('aria-controls',`book-detail-${slot.slot}`);
      if (practice && slot.ids.includes(practiceRec) && C.nodeInfo(state,practiceRec).cost !== null) toggle.append(element('span','추천','rec-tag'));
      card.append(toggle);
      const status = info.cost === null ? 'MAX' : info.purchasable ? '배울 수 있어요' : info.blockedReason;
      const statusLine = element('p',known ? status : slot.visibleAfterHire ? '도우미 합류 후 확인해요' : '앞선 비법을 배워 확인해요','book-card-status');
      if (expanded && known && typeof bookStatus === 'function') {
        const current = bookStatus(info); statusLine.textContent = current.text; statusLine.dataset.status = current.kind;
      }
      card.append(statusLine);
      if (memory.expanded.has(slot.slot)) {
        if (known) {
          const stages = element('div','','book-stages'); stages.setAttribute('aria-label',`${slot.name} 단계`);
          slot.ids.forEach((stage,index) => {
            const si = bookStageInfo(slot,stage);
            const available = si.displayable && si.stageOpen !== false;
            const button = action(`${index+1}단계`, () => { memory.scroll=$('panelBody').scrollTop; memory.selected.set(slot.slot,stage); tree(); },!available);
            button.setAttribute('aria-label',`${index+1}단계 · ${D.tree.find(n=>n.id===stage).name}`);
            button.setAttribute('aria-pressed',String(stage===id)); button.dataset.stage = stage; stages.append(button);
          });
          const detail = info.displayable ? bookDetail(slot,id,memory) : element('div','아직 발견하지 못한 비법이에요.','book-detail');
          detail.id = `book-detail-${slot.slot}`; detail.prepend(stages); card.append(detail);
        } else { const detail = element('p','아직 발견하지 못한 비법이에요.','book-detail'); detail.id = `book-detail-${slot.slot}`; card.append(detail); }
      }
      cards.append(card);
    }
    if(state.batchD.twist.trace)body.append(element('p','📖 트레이스 · 흔들리지 않는 마음: 숨겨진 마술 피해 90% 감소, 멘탈은 최소 1 남아요.','batch-d-note'));
    body.append(cards);
    // A single handler reads the current tab; detached callbacks cannot scroll another panel.
    body.onscroll = () => { if (menu === 'book' && bookSession.revision === revision) memory.scroll = body.scrollTop; };
    bookRememberScroll(body,memory,revision);
    if (typeof bookMotionRender === 'function') bookMotionRender(cards,body,entering,revision);
    if (focusMap) {
      // Moving to the focused card is a deliberate scroll. The restore guard would undo it back to the old position.
      bookSession.stopRestore?.();
      const target = body.querySelector(`[data-node-id="${treeView.selected}"]`);
      if(target){const r=target.getBoundingClientRect(),host=body.getBoundingClientRect();
        if(r.top<host.top)body.scrollTop+=r.top-host.top;
        else if(r.bottom>host.bottom)body.scrollTop+=r.bottom-host.bottom;
        target.focus({preventScroll:true});
      }
    }
  }
  let pendingIntro = null;
  function venueHeckles(venue) {
    const map = [
      { words: ['무중력', '달', '태양', '은하'], venues: ['moon','sun','galaxy'] },
      { words: ['리모컨', '거실'], venues: ['family'] },
      { words: ['파티', '케이크'], venues: ['party'] },
      { words: ['학교', '종이 울'], venues: ['school'] },
      { words: ['커피', '샷'], venues: ['cafe'] },
      { words: ['객석', '뒷자리', '끝자리', '맨 뒤'], venues: ['theater','festival','hotel','audition','broadcast','vegas','broadway','moon','sun','galaxy','multiverse'] }
    ];
    return D.pools.heckles.filter(line => map.every(rule => !rule.words.some(word => line.includes(word)) || rule.venues.includes(D.venues[venue-1].slug)));
  }
  function patternPulse(text) {
    $('patternLabel').textContent = C.threatInfo(state).last?`마지막 야유 · 한 번에 ${C.formatNumber(C.CONST.finalHeckle)}`:`${D.ui.patterns[state.pattern]} · ${text}`;
    const label=$('patternLabel');
    if(C.threatInfo(state).last){for(const a of label.getAnimations?.()||[])a.cancel();label.style.opacity='1';}
    else animate(label, [{ opacity: .3 }, { opacity: 1 }], 500);
  }
  function headlinerIntro(a) {
    pendingIntro = null;
    openPanel('headliner', a.name);
    const box = element('button', '', 'headliner-dialogue');
    const portrait = element('span', '', 'dialogue-emoji');
    portrait.append(element('span', a.emoji, 'sprite-fallback'));
    sprite(portrait, audienceAsset(D.venues[state.venue - 1], a));
    box.append(portrait, element('strong', a.preLine), element('small', '누르면 바로 공연 시작'));
    box.addEventListener('click', closePanel);
    $('panelBody').append(box); box.focus();
    if (a.pattern === 'twoPhase') {
      $('panel').classList.add('climax-dialogue');
      box.querySelector('small').textContent = '마지막 관객은 나 자신이다 · 누르면 공연 시작';
    } else dialogueTimer = setTimeout(() => { if (menu === 'headliner') closePanel(); }, 1200);
  }
  // Live catalog. Names, hidden "???" text and the bonus come from C.achievementInfo / C.achievementBonus.
  const achievementLabels = D.achievements;
  function achievementPanel() {
    const defs = achievementLabels || [];
    const earnedN = defs.filter(a => state.features.achievements.includes(a.id)).length;
    const pct = Math.round(C.achievementBonus(state) * 1000) / 10;
    const list = element('div', '', 'achievement-list');
    list.append(element('p', `달성 ${earnedN} / 전체 ${defs.length} · 마술 실력 +${pct}% · 차원 환생에서 초기화`, 'achievement-head'));
    const order = ['무대', '수집', '손맛', '숨은 업적'];
    const groups = order.concat([...new Set(defs.map(a => a.group))].filter(g => !order.includes(g)));
    for (const group of groups) {
      const items = defs.filter(a => a.group === group);
      if (!items.length) continue;
      const section = element('section', '', 'achievement-group');
      section.append(element('h2', group));
      for (const a of items) {
        const info = C.achievementInfo(state, a.id);
        const row = element('div', '', `achievement-stamp${info.earned ? ' earned' : ''}${info.hidden && !info.earned ? ' secret' : ''}`);
        const medal = element('span', '', `medal sprite-host${info.earned ? ' earned' : ' pending'}`);
        medal.append(element('span', info.earned ? '🏅' : '○', 'sprite-fallback'));
        if (info.earned) medal.append(element('span', '✓', 'medal-check'));
        sprite(medal, `assets/medal-${info.earned ? 'gold' : 'silver'}.png`);
        const copy = element('span', '', 'achievement-copy');
        copy.append(element('strong', info.name), element('small', info.desc+(info.hidden&&!info.earned?'':` · 달성 시 실크 +${D.silkRewards.achievement}`)));
        row.append(medal, copy, element('small', info.earned ? '달성' : '도전 중', 'achievement-state'));
        section.append(row);
      }
      list.append(section);
    }
    $('panelBody').append(list);
  }
  function equipPanel() {
    const body = $('panelBody'), slots = C.equipSlots(state), grid = element('div', '', 'equip-grid');
    const keepScroll = equipPanel._scrollTop; equipPanel._scrollTop = null;
    const guiding = state.features.guide === 'place';
    // openPanel sets #panelBody.scrollTop to 0 before this rebuild. The click stores it first.
    const reopen = () => { equipPanel._scrollTop = body.scrollTop; bestiary(); };
    if(guiding) body.append(element('h2','첫 마술용품을 빈 자리에 놓아 보세요.','guide-line'));
    body.append(element('p', slots ? `소품 ${state.features.equipped.length} / ${slots} · 같은 종류가 더 잘 나와요 · 종류마다 최대 3개` : '비법서에서 마술용품를 배우세요.'));
    for (let i = 0; i < 9; i++) {
      const id = state.features.equipped[i], product = D.items.types.flatMap(t => t.ladder).find(p => p.id === id);
      const button = action(product ? `${product.emoji} ${product.name} · 해제` : i < slots ? '' : '🔒 잠긴 자리', () => { C.unequipItem(state, id); save(); reopen(); }, !product);
      if (!product && i < slots) button.setAttribute('aria-label', '빈 자리');
      if (guiding && i===0) button.classList.add('guide-highlight');
      if (product) sprite(button, `assets/item-${id==='water-glass'?'chicken':id}.png`); if(product)easyTooltip(button,product.desc);grid.append(button);
    }
    body.append(grid, element('p', '수집한 소품 · 장착해도 기존 드롭 효과는 그대로예요.'));
    const collection = element('div', '', 'equip-collection');
    for (const id of state.features.collected) {
      const type = D.items.types.find(t => t.id !== 'lecture' && t.ladder.some(p => p.id === id));
      if (!type) continue;
      const product = type.ladder.find(p => p.id === id);
      const prop=action(`${product.emoji} ${product.name}`, () => {
        if (C.equipItem(state, id)) {
          save();
          if(guiding){const label=type.id==='card'?'트럼프 카드':product.name;toast(`${label} 종류가 더 잘 나와요`);}
          reopen();
        } else toast('빈 자리와 종류별 3개 제한을 확인하세요.');
      }, !slots || state.features.equipped.includes(id));easyTooltip(prop,product.desc);
      if(guiding && id===state.features.collected[0]) prop.classList.add('guide-highlight');
      const entry = element('div', '', 'equip-collected-item');
      entry.append(prop, element('small', `${product.desc.split('\n')[0]} · 장착 시 같은 종류 등장 가중치 +${C.CONST.equipWeightPerItem * 100}%`, 'equip-effect'));
      collection.append(entry);
    }
    body.append(collection);
    if (typeof keepScroll === 'number') {
      body.scrollTop = keepScroll;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { body.scrollTop = keepScroll; });
    }
  }
  const workerActors = {};
  function workerActor(id, role) {
    if (!workerActors[id]) {
      const host = element('span', '', 'helper-actor board-worker');
      host.append(element('span', role === 'fan' ? '👏' : '🎩', 'sprite-fallback'));
      host.setAttribute('aria-hidden', 'true'); $('stage').append(host); workerActors[id] = host;
    }
    return workerActors[id];
  }
  const helperActors = {};
  function helperActor(id) {
    if (helperActors[id]) return helperActors[id];
    const host = element('span', '', `helper-actor helper-${id}`); host.append(element('span', id === 'dove' ? '🕊️' : '🐇', 'sprite-fallback'));
    $('stage').append(host); helperActors[id] = host; return host;
  }
  const impactPool = [];
  let impactLive = 0;
  function impactSprite(p,emoji,kind,asset){
    // U36: at most 8 impact sprites on screen (helpers fire many per second late in the game).
    if (impactLive >= 8) return;
    impactLive++;
    const n=impactPool.pop()||element('span','','');n.className='projectile-impact '+kind;n.hidden=false;n.textContent=asset?'':emoji;pxIcons(n);delete n.dataset.asset;n.setAttribute('aria-hidden','true');
    n.style.left=`${p.x}px`;n.style.top=`${p.y}px`;if(asset)sprite(n,asset);$('stage').append(n);setTimeout(()=>{impactLive--;n.remove();if(impactPool.length<8)impactPool.push(n);},600);
  }
  function spongeImpact(e,p){
    const b=state.features.magic.balls[e.ball];if(!b)return;
    (renderMagic.bounces||(renderMagic.bounces={}))[e.ball]=clock+480;
    const at=phone?boardPoint(b.x,b.y):{x:870+b.x,y:160+b.y};
    impactSprite(at,'🔴','sponge-impact','assets/proj-sponge.png');
  }
  function helperMotion(id, dest) {
    const host = helperActor(id), origin = id === 'dove' ? { x: 820, y: 290 } : { x: 820, y: 680 };
    sprite(host, `assets/helper-${id}-${id === 'dove' ? 'fly' : 'move'}.png`);
    animate(host, [{ transform: 'translate(0,0)' }, { transform: `translate(${dest.x - origin.x}px,${dest.y - origin.y - 28}px)`, offset: .6 }, { transform: `translate(${dest.x - origin.x}px,${dest.y - origin.y}px)`, offset: .8 }, { transform: 'translate(0,0)' }], 1750,true);
    host.dataset.busyUntil = clock + 1750;
    if(id==='dove')setTimeout(()=>impactSprite(dest,'✨','dove-impact'),1400);
    setTimeout(() => { sprite(host, `assets/helper-${id}-${id === 'dove' ? 'hit' : 'work'}.png`); }, 875);
  }
