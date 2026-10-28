'use strict';
  function tree(focusMap = false) {
    const practice = typeof failure !== 'undefined' && failure !== null;
    const opening = menu !== 'book';
    if (opening) openPanel('book', practice ? D.ui.practiceTitle : D.ui.bookTitle);
    if (practice) $('panel').dataset.practice = '1'; else delete $('panel').dataset.practice;
    const body = $('panelBody'); body.replaceChildren();
    if(state.batchD.twist.trace)body.append(element('p','📖 트레이스 · 흔들리지 않는 마음: 숨겨진 마술 피해 90% 감소, 멘탈은 최소 1 남아요.','batch-d-note'));
    // v4 U47 10: no learn-all and no auto-learn button (the player picks 비법 one by one after a failure).
    const header = $('panel').querySelector('header');
    header.querySelectorAll('.tree-learning,.practice-go').forEach(el=>el.remove());
    if (practice && !(newTutorialLesson()&&!state.u15.bios.includes('lesson:bought'))) { const go = action(practiceGoLabel(), restartAfterFailure); go.classList.add('practice-go','u26-primary'); header.insertBefore(go,$('closePanel')); }
    const wallet = element('div', '', 'tree-wallet');
    [['🪙 ','동전 ',rounded(state.coins)],['📕 ','책 ',state.keys],['🕊️ ','비둘기 ',state.starlight]].forEach(([icon,name,value],i)=>{
      if(i)wallet.append(element('span','·','wallet-sep'));
      wallet.append(element('span',icon),element('span',name,'wallet-name'),element('span',String(value)));
    });
    const layout = element('div', '', 'constellation-layout');
    const map = element('div', '', 'constellation-map'); map.tabIndex = 0;
    map.setAttribute('aria-label', '별자리 지도. 방향키로 이동하고 더하기와 빼기로 확대합니다.');
    const world = element('div', '', 'constellation-world');
    const detail = element('aside', '', 'constellation-detail'); detail.setAttribute('aria-live', 'polite');
    const minTreeZoom=Math.max(.8,44/(56*(scale||1)));
    treeView.zoom=Math.max(minTreeZoom,treeView.zoom);
    const infos = new Map(D.tree.map(n => [n.id, C.nodeInfo(state, n.id)]));
    const nodeStatus=(node,info)=>{
      const maxed=info.revealed&&info.cost===null;
      const shortage=!!info.revealed&&/ 부족$/.test(info.blockedReason||'');
      const missing=Math.max(0,(info.cost||0)-(state[info.currency]||0));
      const currency={coins:'동전',keys:'책',starlight:'비둘기'}[info.currency];
      const pre=node.prereqs.find(id=>!(infos.get(id)?.level>0));
      const requirement=node.reveal==='E'&&!state.endings.length?'첫 멀티버스 완료':pre&&node.branch!=='collection'?(D.tree.find(n=>n.id===pre).short||D.tree.find(n=>n.id===pre).name)+' 배우기':info.blockedReason==='아직 발견하지 못한 비법'?(node.venueSlug?C.venueBySlug(node.venueSlug).name+' 도착':'이웃 비법 배우기'):info.blockedReason;
      const kind=maxed?'maxed':info.purchasable?'learnable':shortage?'unaffordable':'locked';
      const text=maxed?'MAX':kind==='locked'?requirement:`${currency} ${C.formatNumber(info.cost)}`;
      return {kind,text,missing,currency};
    };
    const shown = new Set(D.tree.filter(n => !n.shopOnly && n.id !== 'autoLearn' /* v4 U47 10: retired node, never drawn */ && (infos.get(n.id).revealed ||(!n.hidden && (n.reveal === 'E' || n.prereqs.some(id => infos.get(id).revealed))))).map(n => n.id));
    const centerUnlocked = () => {
      const nodes = D.tree.filter(n => shown.has(n.id) && infos.get(n.id).revealed && (!infos.get(n.id).gate || infos.get(n.id).gate.met));
      treeView.x = -(Math.min(...nodes.map(n=>n.x)) + Math.max(...nodes.map(n=>n.x))) * 70 * treeView.zoom;
      treeView.y = -(Math.min(...nodes.map(n=>n.y)) + Math.max(...nodes.map(n=>n.y))) * 70 * treeView.zoom;
    };
    if (opening) treeView.sheet = false;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('constellation-lines');
    for (const node of D.tree) {
      if (!shown.has(node.id)) continue;
      for (const id of node.prereqs) {
        if (!shown.has(id) || (!infos.get(node.id).revealed && !infos.get(id).revealed) || (node.reveal === 'E' && !infos.get(node.id).revealed)) continue;
        const pre = D.tree.find(n => n.id === id);
        if (Math.hypot(pre.x-node.x, pre.y-node.y) > 2.1) continue;
        const line = document.createElementNS(svg.namespaceURI, 'line');
        for (const [key, value] of Object.entries({ x1: pre.x * 140, y1: pre.y * 140, x2: node.x * 140, y2: node.y * 140 })) line.setAttribute(key, value);
        line.classList.toggle('owned', infos.get(node.id).level > 0); svg.append(line);
      }
    }
    world.append(svg);
    let suppressClick = false;
    const select = id => {
      const now = performance.now(), last = treeView.lastTap;
      treeView.lastTap = {id, at: now}; treeView.selected = id; treeView.sheet = true;
      if (last && last.id === id && now-last.at < 350) { focusNode(id); return; }
      tree(true);
    };
    const newly = new Set();
    for (const node of D.tree) {
      const info = infos.get(node.id);
      if (info.revealed && treeView.ready && !treeView.revealed.has(node.id)) newly.add(node.id);
      if (!shown.has(node.id)) continue;
      const unknown = !info.revealed,status=nodeStatus(node,info);
      const button = element('button', '', `constellation-node${node.branch === 'collection' ? ' collection' : ''}${unknown ? ' unknown' : ''}${info.level ? ' owned' : ''}${treeView.selected === node.id ? ' selected' : ''}${newly.has(node.id) ? ' newly-revealed' : ''}`);
      button.dataset.nodeId = node.id;button.dataset.state=status.kind;button.classList.add(status.kind);
      button.setAttribute('aria-pressed',String(treeView.selected===node.id));button.title=status.text;
      button.style.left = `${node.x * 140}px`; button.style.top = `${node.y * 140}px`;
      button.setAttribute('aria-label', unknown ? (node.reveal === 'E' ? '첫 멀티버스 공연 완료' : '미확인 비법') : `${node.name} 레벨 ${C.formatNumber(info.level)} / ${typeof info.max==='number' ? C.formatNumber(info.max) : info.max}`);
      button.setAttribute('aria-label',button.getAttribute('aria-label')+' · '+status.text+(status.kind==='unaffordable'?' · '+C.formatNumber(status.missing)+' 부족':''));
      const icon = element('span', unknown ? '❔' : node.emoji, 'constellation-icon sprite-fallback');
      const iconHost = element('span', '', 'constellation-icon-host'); iconHost.append(icon);
      sprite(iconHost, `assets/${unknown ? 'node-unknown.png' : node.icon}`);
      button.append(iconHost);
      if (practice && !unknown && node.id === practiceRec && infos.get(node.id).cost !== null) button.append(element('span', '추천', 'rec-tag'));
      if (!unknown) button.append(element('span', node.short || node.name /* v4 U45: long product names use a map label */, 'constellation-name'), element('small', `${C.formatNumber(info.level)} / ${typeof info.max==='number' ? C.formatNumber(info.max) : info.max}`, 'constellation-level'));
      const badge=status.kind==='maxed'?'MAX':status.kind==='locked'?'🔒':status.kind==='learnable'?'↑':info.level?'✓':'';
      if(badge)button.append(element('span',badge,'node-state-badge'));
      if(info.level&&status.kind!=='maxed')button.append(element('span','✓','node-learned'));
      button.append(element('span',status.text,'node-status'));
      if(status.kind==='unaffordable')button.append(element('small',status.currency+' '+C.formatNumber(status.missing)+' 부족','node-missing'));
      button.addEventListener('click', () => { if (!suppressClick) select(node.id); }); world.append(button);
    }
    treeView.revealed = new Set(D.tree.filter(n => infos.get(n.id).revealed).map(n => n.id)); treeView.ready = true;
    const selected = D.tree.find(n => n.id === treeView.selected) || D.tree[0], info = infos.get(selected.id);
    if (!info.revealed) {
      detail.append(element('h2', '미확인 비법'), element('p', selected.reveal === 'E' ? '첫 멀티버스 공연 완료' : '이웃 비법을 배워 발견하세요.'));
    } else {
      // v4 U45: one reading order. Name with the level chip, the effect (first line) and its step (second line), the next milestone,
      // then the price and, only when something blocks it, the reason. The arrival line is part of the reason now (it was shown twice).
      const maxed = info.cost === null;
      detail.append(element('h2', selected.name), element('span', `레벨 ${C.formatNumber(info.level)} / ${typeof info.max==='number' ? C.formatNumber(info.max) : info.max}`, 'tree-level'));
      if (selected.branch === 'collection') detail.append(element('small', '칼리 컬렉션', 'tree-tag'));
      detail.append(element('p', selected.desc, 'tree-effect'));
      if ((selected.partOf || selected.id) === 'area') detail.append(areaRangePreview());
      // v4 U48 N5: a routine 비법 shows its trick (frame 2 of the routine strip) at a readable size, so the player knows which trick it is.
      if (selected.routine) { const art = element('div', '', 'tree-routine-art'); art.style.backgroundImage = `url('${assetUrl(`assets/routine-${selected.routine}.png`)}')`; art.setAttribute('role', 'img'); art.setAttribute('aria-label', selected.name); detail.append(art); }
      // v4 U48 C: milestones count the total level of a split node (part II of 무대 배짱 continues at 11).
      if(selected.statMilestone){const next=C.nextMilestone(info.total,[10,25],info.totalMax);const label=selected.partOf||selected.levels?'전체 레벨':'레벨';detail.append(element('p',next ? `다음 2배: ${label} ${next} · ${next-info.total}레벨 남음` : `지금 힘 ${C.statMultiplier(state,selected.partOf||selected.id)}배`,'tree-next'),element('p', D.easyExtras.milestone, 'tree-preview'));}
      if (selected.desc.includes('L')) detail.append(element('small', 'L은 이 비법의 레벨입니다.', 'tree-note-l'));
      const currency = { coins: '🪙 동전', keys: '📕 책', starlight: '🕊️ 비둘기' }[info.currency];
      const status=nodeStatus(selected,info);
      detail.dataset.state=status.kind;
      detail.append(element('strong', maxed ? '✓ MAX · 완성했어요' : `${currency} ${C.formatNumber(info.cost)}`, 'tree-cost'));
      if(status.kind==='unaffordable')detail.append(element('p',`${status.currency} ${C.formatNumber(status.missing)} 부족`,'tree-missing'));
      if (!maxed && info.blockedReason) detail.append(element('p', info.blockedReason, 'tree-reason'));
      if (info.gate) detail.append(element('p', info.gate.text, 'tree-gate'));
      const buy = action('배우기', () => {
        const paid = state[info.currency];
        if (!C.buyNode(state, selected.id)) return;
        if(newTutorialLesson()&&chainMark()?.step==='upgrade-play'&&selected.id===chainNodeId&&!state.u15.bios.includes('lesson:bought'))state.u15.bios.push('lesson:bought');
        // s4e2 G: the answer comes inside the 비법서 (node pop, rising tone, wallet counting down); no late toast after closing.
        tutorialSignal('learn'); sound('learn'); save(); tree(); render(); learnedMoment(selected.id, info.currency, paid);
      }, !info.purchasable);
      buy.classList.add('tree-buy');
      if (!maxed) detail.append(buy); // fixP 4: a finished 비법 shows only 「MAX · 완성했어요」, no disabled 배우기
    }
    if (typeof phone !== 'undefined' && phone) {
      detail.hidden = !treeView.sheet;
      const dismiss = action('상세 닫기', () => { treeView.sheet = false; detail.hidden = true; transform(); }); // fixP 4: the map widens in landscape, so re-centre it
      dismiss.classList.add('tree-detail-dismiss'); detail.prepend(dismiss);
    }
    const transform = () => { world.style.transform = `translate(${map.clientWidth / 2 + treeView.x}px,${map.clientHeight / 2 + treeView.y}px) scale(${treeView.zoom})`; };
    const zoom = (factor, point = { x: map.clientWidth / 2, y: map.clientHeight / 2 }) => {
      const z = Math.max(minTreeZoom, Math.min(Math.max(1.8,minTreeZoom), treeView.zoom * factor)), ratio = z / treeView.zoom;
      treeView.x = point.x - map.clientWidth / 2 - (point.x - map.clientWidth / 2 - treeView.x) * ratio;
      treeView.y = point.y - map.clientHeight / 2 - (point.y - map.clientHeight / 2 - treeView.y) * ratio;
      treeView.zoom = z; transform();
    };
    const controls = element('div', '', 'constellation-controls');
    controls.append(action('− 축소', () => zoom(1 / 1.2)), action('+ 확대', () => zoom(1.2)), action('중앙으로', () => { treeView.zoom = Math.max(1,minTreeZoom); centerUnlocked(); transform(); }));
    const local = e => { const r = map.getBoundingClientRect(); return { x: (e.clientX - r.left) * map.clientWidth / r.width, y: (e.clientY - r.top) * map.clientHeight / r.height }; };
    const pointers = new Map(); let drag = null;
    map.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const point = local(e); pointers.set(e.pointerId, point);
      drag = { point, x: treeView.x, y: treeView.y, moved: false }; suppressClick = false;
      map.setPointerCapture(e.pointerId); map.focus({ preventScroll: true });
    });
    map.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const point = local(e), previous = pointers.get(e.pointerId);
      if (pointers.size === 2) {
        const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
        const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
        if (oldDistance > 0) zoom(Math.hypot(point.x - other.x, point.y - other.y) / oldDistance, { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 });
        suppressClick = true; drag.moved = true;
      } else if (drag) {
        const dx = point.x - drag.point.x, dy = point.y - drag.point.y;
        if (Math.hypot(dx, dy) > 4) drag.moved = true;
        if (drag.moved) { treeView.x = drag.x + dx; treeView.y = drag.y + dy; suppressClick = true; transform(); }
      }
      pointers.set(e.pointerId, point);
    });
    const release = e => {
      // Pointer capture targets clicks at the viewport, so resolve a stationary node tap here.
      if (drag && !drag.moved && e.type === 'pointerup') {
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.constellation-node');
        if (target && map.contains(target)) { suppressClick = true; select(target.dataset.nodeId); }
      }
      pointers.delete(e.pointerId);
      if (pointers.size) { const point = [...pointers.values()][0]; drag = { point, x: treeView.x, y: treeView.y, moved: true }; } else drag = null;
    };
    map.addEventListener('pointerup', release); map.addEventListener('pointercancel', release);
    map.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, local(e)); }, { passive: false });
    map.addEventListener('keydown', e => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key)) e.preventDefault(); else return;
      if (e.key === '+' || e.key === '=') zoom(1.2);
      else if (e.key === '-') zoom(1 / 1.2);
      else if (e.key === 'Home') { treeView.x = 0; treeView.y = 0; transform(); }
      else { treeView.x += e.key === 'ArrowLeft' ? 70 : e.key === 'ArrowRight' ? -70 : 0; treeView.y += e.key === 'ArrowUp' ? 70 : e.key === 'ArrowDown' ? -70 : 0; transform(); }
    });
    map.append(world); layout.append(map, detail); body.append(wallet, controls, layout, element('p', '드래그·방향키로 이동 · 휠·두 손가락으로 확대 · 책은 관객 도감 완성으로 얻어요.', 'tree-note'));
    // v4 U51 4 (owner: "야유 받아넘기기 배우기 라는게 계속 뜨는데 이거 없애줘"): the practice note no longer offers the gate lesson. Core keeps the
    // mechanic untouched (a save that already studied a gate keeps it; a gate also loses a third of its pressure per failed show, v4 U41).
    if (typeof phone !== 'undefined' && phone) {
      const header = $('panel').querySelector('header');
      header.querySelectorAll('.tree-wallet,.constellation-controls,.tree-more').forEach(el=>el.remove());
      header.insertBefore(wallet,$('closePanel'));
      // U32: rarely used buttons (zoom, center; the auto-learn button went away in v4 U47) sit behind one ⋯ button so the header stays calm.
      const more = element('div','','tree-more'), pop = element('div','','tree-more-pop');
      const toggle = action('지도', () => { const open = more.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); });
      toggle.classList.add('tree-more-toggle'); toggle.setAttribute('aria-label','지도 확대와 이동'); toggle.setAttribute('aria-expanded','false');
      pop.append(controls); more.append(toggle, pop);
      header.insertBefore(more,$('closePanel'));
      $('closePanel').textContent = '뒤로';
    }
    if (treeView.centerPending) {
      // Keep the centered node in the visible map above the phone sheet.
      if (typeof phone !== 'undefined' && phone && treeView.sheet && (portraitLayout() || document.body.classList.contains('tablet'))) treeView.y -= (detail.getBoundingClientRect().height + 6) / 2; // fixP 4: the landscape phone detail is a side column, not a sheet over the map
      treeView.centerPending = false;
    }
    if (opening) {
      const nodes = D.tree.filter(n => shown.has(n.id) && infos.get(n.id).revealed && (!infos.get(n.id).gate || infos.get(n.id).gate.met));
      const span = axis => (Math.max(...nodes.map(n=>n[axis])) - Math.min(...nodes.map(n=>n[axis]))) * 140;
      treeView.zoom = Math.min(1, (map.clientWidth - 20) / (span('x') + 140), (map.clientHeight - 20) / (span('y') + 140));
      treeView.zoom = Math.max(minTreeZoom, treeView.zoom);
      centerUnlocked(); treeView.y -= 30 * treeView.zoom + Math.max(0, (map.clientHeight - (span('y') + 140) * treeView.zoom) / 2 - 20);
    }
    transform();
    // fixP 4: in phone landscape the side column narrows the map; a tapped node that would fall behind it is brought back to the map's middle.
    if (typeof phone !== 'undefined' && phone && treeView.sheet && !portraitLayout() && !document.body.classList.contains('tablet')) {
      const picked = world.querySelector('.constellation-node.selected'), m = map.getBoundingClientRect(), r = picked && picked.getBoundingClientRect();
      if (r && (r.left < m.left || r.right > m.right)) { treeView.x += (m.left + m.width / 2) - (r.left + r.width / 2); transform(); }
    }
    if (focusMap) map.focus({ preventScroll: true });
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
    $('patternLabel').textContent = `${D.ui.patterns[state.pattern]} · ${text}`;
    animate($('patternLabel'), [{ opacity: .3 }, { opacity: 1 }], 500);
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
    const guiding = state.features.guide === 'place';
    if(guiding) body.append(element('h2','첫 마술용품을 빈 자리에 놓아 보세요.','guide-line'));
    body.append(element('p', slots ? `소품 ${state.features.equipped.length} / ${slots} · 같은 종류가 더 잘 나와요 · 종류마다 최대 3개` : '비법서에서 마술용품를 배우세요.'));
    for (let i = 0; i < 9; i++) {
      const id = state.features.equipped[i], product = D.items.types.flatMap(t => t.ladder).find(p => p.id === id);
      const button = action(product ? `${product.emoji} ${product.name} · 해제` : i < slots ? '' : '🔒 잠긴 자리', () => { C.unequipItem(state, id); save(); bestiary(); }, !product);
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
          bestiary();
        } else toast('빈 자리와 종류별 3개 제한을 확인하세요.');
      }, !slots || state.features.equipped.includes(id));easyTooltip(prop,product.desc);
      if(guiding && id===state.features.collected[0]) prop.classList.add('guide-highlight');
      const entry = element('div', '', 'equip-collected-item');
      entry.append(prop, element('small', `${product.desc.split('\n')[0]} · 장착 시 같은 종류 등장 가중치 +${C.CONST.equipWeightPerItem * 100}%`, 'equip-effect'));
      collection.append(entry);
    }
    body.append(collection);
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
