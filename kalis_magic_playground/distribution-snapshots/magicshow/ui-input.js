'use strict';
  function wandRect(point = pointer) {
    const a = C.wandArea(state), k = C.CONST;
    const pitch = k.cellSize + k.cellGap;
    const width = a.cols * pitch - k.cellGap, height = a.rows * pitch - k.cellGap;
    // U36: the wand box snaps to the case grid. It used to follow the finger freely, so the drawn box could cover most of a case whose
    // center lay a few pixels outside it (a 2x1 wand then drew over two cases and hit one). The drawn box, the hit set and the idle
    // path in core (tickPractice) now all use the same whole-cell block.
    const col = Math.max(0, Math.min(5 - a.cols, Math.round((point.x - k.boardInset - width / 2) / pitch)));
    const row = Math.max(0, Math.min(5 - a.rows, Math.round((point.y - k.boardInset - height / 2) / pitch)));
    return { x: k.boardInset + col * pitch, y: k.boardInset + row * pitch, width, height, col, row, cols: a.cols, rows: a.rows };
  }
  function coveredCells(point = pointer) {
    if (point.x < 0 || point.y < 0 || point.x > C.CONST.boardSize || point.y > C.CONST.boardSize || point.inside === false) return [];
    const r = wandRect(point), l = C.boardLayout(state), found = [];
    for (let i = 0; i < l.capacity; i++) {
      const p = C.cellPosition(state, i);
      if (p.col >= r.col && p.col < r.col + r.cols && p.row >= r.row && p.row < r.row + r.rows) found.push(i);
    }
    return found;
  }
  function updateWand() {
    $('wand').classList.toggle('visible', pointer.inside && !menu && !portrait());
    if (!pointer.inside) return;
    const r = wandRect();
    const first = $('board').querySelector('.cell');
    if (!first) return;
    const cell = first.getBoundingClientRect(), card = $('boardCard').getBoundingClientRect();
    const k = C.CONST, pos = C.cellPosition(state, 0), pitch = k.cellSize + k.cellGap;
    const ratioX = cell.width / scale / k.cellSize, ratioY = cell.height / scale / k.cellSize;
    const x = (cell.left - card.left) / scale - (k.boardInset + pos.col * pitch) * ratioX;
    const y = (cell.top - card.top) / scale - (k.boardInset + pos.row * pitch) * ratioY;
    const wand = $('wand'), ratio = ratioX;
    wand.style.left = `${x + r.x * ratioX}px`; wand.style.top = `${y + r.y * ratioY}px`;
    wand.style.width = `${r.width * ratioX}px`; wand.style.height = `${r.height * ratioY}px`;
    wand.style.transform = 'none';
    if(phone){
      const target=coveredCells().find(i=>i<state.board.length),icon=$('wandIcon');
      icon.hidden=target===undefined;
      if(target!==undefined){
        const k=C.CONST,pos=C.cellPosition(state,target),pitch=k.cellSize+k.cellGap;
        icon.style.left=`${(k.boardInset+pos.col*pitch-r.x+k.cellSize)*ratio-22}px`;
        icon.style.top=`${(k.boardInset+pos.row*pitch-r.y)*ratio+14}px`;
        icon.style.right='auto';
      }
    }else{$('wandIcon').hidden=false;for(const key of ['left','top','right'])$('wandIcon').style[key]='';}

  }
  function locate(e) {
    const p = boardTransform().toBoard(e.clientX, e.clientY);
    if (typeof portraitLayout === 'function' && portraitLayout()) { const hit = portraitBoardPoint(e.clientX, e.clientY); if (hit) { p.x = hit.x; p.y = hit.y; } }
    pointer.x = p.x; pointer.y = p.y;
    pointer.inside = p.x >= 0 && p.x <= C.CONST.boardSize && p.y >= 0 && p.y <= C.CONST.boardSize;
    updateWand();
  }
  // New presses share one rolling budget; hold pulses keep their per-pointer cadence.
  const tapMarks = new Map();
  const holdMarks = tapMarks;
  const pressMarks = [];
  function countTap(id, kind = 'hold') {
    const now = performance.now();
    let marks = pressMarks;
    if (kind === 'hold') {
      marks = holdMarks.get(id);
      if (!marks) { marks = []; holdMarks.set(id, marks); }
    }
    let i = 0;
    while (i < marks.length && now - marks[i] >= 1000) i++;
    if (i) marks.splice(0, i);
    if (marks.length >= 12) return false;
    marks.push(now);
    return true;
  }
  function pressCells(taps, kind) {
    const scale = kind === 'tap' ? .92 : .96;
    const ms = kind === 'tap' ? 40 : 80;
    for (const i of taps) {
      const el = cells[i] && cells[i].box;
      if (!el) continue;
      animate(el, [{ transform: `scale(${scale})` }, { transform: `scale(${scale})`, offset: .45 }, { transform: 'scale(1)' }], ms);
    }
  }
  function pulseFreePractice() {
    // TODO core auto practice
    if ((typeof caseArrange !== 'undefined' && caseArrange) || paused() || state.mode !== 'fight' || (state.u15 && state.u15.gloveLeft > 0)) return;
    const taps = [];
    for (let i = 0; i < state.board.length; i++) taps.push(i);
    if (!taps.length || !countTap('practice', 'hold')) return;
    stepCombat(.001,{taps:[],holding:true});
    if (paused() || state.mode !== 'fight') return;
    sound('tap'); stepCombat(.001,{taps,holding:true,pulse:'hold'});
    pressCells(taps, 'hold');
  }
  function pulse(point = pointer, kind = 'hold') {
    if ((typeof caseArrange !== 'undefined' && caseArrange) || paused() || state.mode !== 'fight') return;
    stepCombat(.001,{taps:[],holding:true});
    if (paused() || state.mode !== 'fight') return;
    const taps = coveredCells(point);
    if (!taps.length || !countTap(point.id, kind)) return;
    sound('tap'); stepCombat(.001,{taps,holding:true,pulse:kind});
    pressCells(taps, kind);
  }
  function syncPointer() {
    const p = boardHolds[0]; pointer.held = !!p; pointer.id = p ? p.id : null;
    if (p) { pointer.x=p.x; pointer.y=p.y; pointer.inside=p.x>=0&&p.y>=0&&p.x<=608&&p.y<=608; }
    updateWand();
  }
  function release() {
    const arranging = arrangePress; arrangePress = null;
    arrangeFeedback();
    if (arranging && $('board').hasPointerCapture(arranging.id)) $('board').releasePointerCapture(arranging.id);
    const old = boardHolds; boardHolds = []; holdMarks.clear(); syncPointer();
    for (const p of old) if ($('board').hasPointerCapture(p.id)) $('board').releasePointerCapture(p.id);
    if (!caseArrange && old.length && !document.hidden && !menu && !portrait()) events(C.step(state,.001,{taps:[]}));
  }
  // Arrangement uses the existing saved permutation, never the combat hold path.
  function arrangeSlot(e) {
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('#board .cell');
    const index = cells.findIndex(c => c.el === hit);
    return index < 0 ? null : state.u15.positions[index];
  }
  function arrangeFeedback(slot = null) {
    const from = caseArrange && arrangePress ? state.u15.positions.indexOf(arrangePress.slot) : -1;
    for (let i = 0; i < cells.length; i++) {
      cells[i].el.classList.toggle('arrange-source', slot !== null && from >= 0 && from < state.board.length && from === i);
      cells[i].el.classList.toggle('arrange-target', from >= 0 && from < state.board.length && slot !== null && state.u15.positions[i] === slot);
    }
  }
  function arrangeSelect(slot) {
    if (slot === null) return;
    const index = state.u15.positions.indexOf(slot);
    if (arrangeFrom === null) {
      if (index < state.board.length) arrangeFrom = index;
    } else {
      if (C.moveCase(state, arrangeFrom, slot)) { save(); geo.clear(); }
      arrangeFrom = null;
    }
    render();
  }
  $('board').addEventListener('click', e => { if (caseArrange) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  function setCaseArrange(on) {
    release(); arrangeFrom = null; arrangePress = null; caseArrange = on;
    for (const id of ['caseArrangeButton','caseArrangeMenuButton']) $(id).setAttribute('aria-pressed', String(caseArrange));
    $('board').classList.toggle('arranging', caseArrange);
    $('caseArrangeControls').hidden = !caseArrange;
    $('activeSkills').classList.toggle('arrange-replaced', caseArrange);
    geo.clear(); wandOffset = null;
  }
  // Borrow the disabled skill rail/row, leaving all case slots and the stats strip untouched.
  function syncCaseArrange() {
    if (!caseArrange) return;
    const rail = $('activeSkills').getBoundingClientRect(), card = $('boardCard').getBoundingClientRect();
    const controls = $('caseArrangeControls');
    controls.style.left = `${(rail.left - card.left) / scale}px`;
    controls.style.top = `${(rail.top - card.top) / scale}px`;
    controls.style.width = `${rail.width / scale}px`; controls.style.height = `${rail.height / scale}px`;
    controls.style.setProperty('--arrange-touch', `${44 / scale}px`);
    const row = rail.width > rail.height;
    controls.classList.toggle('arrange-row', row);
    $('caseArrangeHint').hidden = row ? rail.width < 240 : rail.width < 44 || rail.height < 120;
  }
  for (const id of ['caseArrangeButton','caseArrangeMenuButton']) $(id).addEventListener('click', () => {
    setCaseArrange(!caseArrange); hideMore(); render();
  });
  $('caseArrangeDone').addEventListener('click', () => {
    setCaseArrange(false); hideMore(); render();
  });
  $('board').addEventListener('pointerdown', e => {
    if (paused() || state.mode !== 'fight' || (e.pointerType === 'mouse' && e.button !== 0) || boardHolds.length >= 3) return;
    if (caseArrange) {
      if (arrangePress) return;
      e.preventDefault(); arrangePress = {id:e.pointerId, slot:arrangeSlot(e)};
      arrangeFeedback(arrangePress.slot);
      $('board').setPointerCapture(e.pointerId); return;
    }
    // Let the next locked slot receive its click without board pointer capture.
    if (e.target.closest('.cell.next-slot')) return;
    e.preventDefault(); const p = boardTransform().toBoard(e.clientX,e.clientY);
    if (typeof portraitLayout === 'function' && portraitLayout()) { const hit = portraitBoardPoint(e.clientX, e.clientY); if (hit) { p.x = hit.x; p.y = hit.y; } }
    if (p.x<0||p.y<0||p.x>608||p.y>608) return;
    boardHolds = C.holdPointers(boardHolds,{type:'down',id:e.pointerId,...p});
    $('board').setPointerCapture(e.pointerId); syncPointer();
    const initial = C.advanceHolds(boardHolds,0,C.wandRate(state)); boardHolds=initial.holds;
    for (const point of initial.pulses) pulse(point, 'tap');
    tutorialSignal('hold'); render();
    window.dispatchEvent(new CustomEvent('magicshow:gesture'));
  });
  $('board').addEventListener('pointermove', e => {
    if (caseArrange) {
      if (arrangePress?.id === e.pointerId) arrangeFeedback(arrangeSlot(e));
      return;
    }
    if (boardHolds.some(p=>p.id===e.pointerId)) {
      const p=boardTransform().toBoard(e.clientX,e.clientY);
      if (typeof portraitLayout === 'function' && portraitLayout()) { const hit = portraitBoardPoint(e.clientX, e.clientY); if (hit) { p.x = hit.x; p.y = hit.y; } }
      boardHolds=C.holdPointers(boardHolds,{type:'move',id:e.pointerId,...p}); syncPointer();
    } else if (e.pointerType==='mouse' && !boardHolds.length) locate(e);
  });
  $('board').addEventListener('pointerleave', () => {
    if (!pointer.held) { pointer.inside=false; updateWand(); }
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) $('board').addEventListener(name,e=> {
    if (caseArrange && arrangePress?.id === e.pointerId) {
      const press = arrangePress; arrangePress = null;
      arrangeFeedback();
      if (name === 'pointerup' && !paused() && state.mode === 'fight') {
        const slot = arrangeSlot(e);
        if (slot !== null && slot !== press.slot) {
          const from = state.u15.positions.indexOf(press.slot);
          if (from >= 0 && from < state.board.length) { arrangeFrom = from; arrangeSelect(slot); }
        } else if (slot !== null) arrangeSelect(slot);
      }
    }
    boardHolds=C.holdPointers(boardHolds,{type:'up',id:e.pointerId}); holdMarks.delete(e.pointerId); syncPointer();
    if (!boardHolds.length && e.pointerType!=='mouse') { pointer.inside=false; updateWand(); }
  });
  window.addEventListener('blur', release);
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());

  function setupPanelHelp(kind) {
    const header = $('panel').querySelector('header');
    header.querySelector('.panel-help-button')?.remove();
    const entry = D.panelHelp && D.panelHelp[kind];
    if (!entry) return;
    const button = action('?', () => {
      const body = $('panelBody');
      const existing = body.querySelector('.panel-help-card');
      if (existing) { existing.remove(); button.setAttribute('aria-expanded', 'false'); return; }
      const selected = kind === 'bestiary' ? entry[bestiaryTab] : entry;
      const lines = typeof selected === 'function' ? selected(state) : selected;
      if (!lines) return;
      const card = element('section', '', 'panel-help-card');
      card.setAttribute('aria-label', '도움말');
      lines.forEach(line => card.append(element('p', line)));
      const close = action('닫기', () => { card.remove(); button.setAttribute('aria-expanded', 'false'); button.focus(); });
      card.append(close); body.prepend(card); body.scrollTop = 0;
      button.setAttribute('aria-expanded', 'true');
    });
    button.className = 'panel-help-button';
    button.setAttribute('aria-label', '도움말'); button.setAttribute('aria-expanded', 'false');
    header.insertBefore(button, $('closePanel'));
  }
  function openPanel(kind, title) {
    if (caseArrange) setCaseArrange(false);
    delete $('panel').dataset.cutscene; delete $('stage').dataset.cutscene; // 12-116: a twist beat sets it again after opening
    if(menu==='curtain'&&kind!=='curtain'){curtainFinish=null;clearTimeout(curtainTimer);curtainScene?.remove();curtainScene=null;presentation.finish();}
    // v4 U51 1: one top layer. A panel opened while the menu sheet is open (from inside the menu or from the top bar 도감) replaces the menu: the menu
    // closes here and the panel's 닫기/뒤로 brings the menu back (the U48 M pattern), so the menu never stays drawn over (or under) a panel.
    if (!$('phoneMore').hidden) { $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false'); moreReturn = true; }
    menu = kind; previous = 0; clearDecorations();
    focusBeforePanel = document.activeElement;
    $('panel').dataset.screen = kind; delete $('panel').dataset.practice; $('panelBody').style.gridAutoRows = ''; // v4 U47 13: the stats grid sets its own row height
    $('panel').classList.remove('climax-dialogue');
    $('panel').querySelector('header').querySelectorAll('.tree-wallet,.constellation-controls,.tree-learning,.practice-go,.tree-more,.shop-balance').forEach(el=>el.remove());
    $('closePanel').textContent = '닫기'; $('closePanel').removeAttribute('aria-label'); // v4 U51 2: the curtain call relabels it 건너뛰기
    $('panelTitle').textContent = title;
    $('panelBody').replaceChildren(); $('panelBody').scrollTop = 0; $('panel').hidden = false;
    setupPanelHelp(kind);
    $('closePanel').hidden = kind === 'fail'; $('closePanel').disabled = false;
    // Reset the Core hold before pausing so the next gesture starts immediately.
    state.holding=false; state.tapAcc=0;
    $('closePanel').hidden = ['boo','fail','ending','rebirth','bossPhase'].includes(kind);
    $('closePanel').focus(); updateWand(); nextToasts();
  }
  function closePanel() {
    if(menu==='batchD'){resolveBatchDPanel();return;}
    if(menu==='batchDReplay'){finishBatchDReplay();return;}
    if(menu==='curtain'&&curtainFinish){curtainFinish();return;} // v4 U51 2: the header 건너뛰기 of the curtain call ends it like the old in-scene 건너뛰기
    if(menu==='curtain'){clearTimeout(curtainTimer);curtainScene?.remove();curtainScene=null;presentation.finish();}
    if (['boo','fail','ending','rebirth','bossPhase'].includes(menu) || (menu === 'dealer' && dealerBusy)) return;
    if (menu === 'saveslots') slotSaveWake?.(); // 12-118: end a running save feedback now; it resumes after this close
    clearTimeout(dialogueTimer); leavePending = false; // v4 U47 6: closing the save-slot panel without saving cancels the leave question
    if (menu === 'dealer' && state.mode === 'dealer') {
      C.dealerLeave(state);
      save();
    }
    if(state.u18.map){C.returnToStage(state);save();}
    if (['book','dealer'].includes(menu) && failure !== null) { showFailure(); return; }
    menu = ''; $('panel').hidden = true; previous = 0;
    if (focusBeforePanel && focusBeforePanel.isConnected) focusBeforePanel.focus();
    if (moreReturn) { moreReturn = false; showMore(); } // v4 U48 M: a panel opened from the menu goes back to the menu, not to the show
    render();
  }
  function clearDecorations() {
    flights.length=0;particles.length=0;numbers.length=0;badges.length=0;
    $('stage').classList.add('decorations-paused');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    document.querySelectorAll('.projectile-impact,.helper-actor').forEach(n=>{n.hidden=true;for(const animation of n.getAnimations?.()||[])animation.cancel();});
    if($('magicLayer'))$('magicLayer').hidden=true;
  }
  function showBoo(e) {
    failureVenue=e.venue;menu='boo';previous=0;release();clearDecorations();
    const v=D.venues[e.venue-1],head=C.roster(v).find(a=>a.id===e.audId),a=e.theaterPhase===1&&D.theaterPhases&&v.audiences.find(x=>x.id===D.theaterPhases.face)||head; // s5b: a theater phase-1 loss is against 앞줄 관객
    failureAudience=a?a.id:e.audId;
    if(a)sprite($('audience'),tutorialStageBase()||audienceAsset(v,a));
    $('audienceCard').classList.add('boo-scene'); $('stage').classList.add('f-boo-scene');
    // v6 script (owner Q11): the lose moment is the audience's own regretful line (missLine), with no 「우우!」; a heckle line only when it has none.
    $('heckle').textContent=(typeof tutorialMissLine==='function'?tutorialMissLine():'')||a?.missLine||a?.lines?.heckles?.[0]||a?.heckles?.[0]||'다음에는 더 잘해 봐!';
    $('heckle').classList.add('visible');$('magicianMini').classList.add('disappointed','reacting');$('magicianMini').dataset.face='boo';sprite($('magicianMini'),kaliReact('sad'));
    clearTimeout(booTimer);booTimer=setTimeout(()=>{$('audienceCard').classList.remove('boo-scene');$('stage').classList.remove('f-boo-scene');$('heckle').classList.remove('visible');$('magicianMini').classList.remove('disappointed','reacting');$('magicianMini').dataset.face='';kaliMoodState='normal';audMoodState='doubt';sprite($('magicianMini'),'assets/magician-idle.png');menu='';showFailure();},1500);
  }
  function practiceGoLabel() {
    const name = D.venues[state.venue - 1]?.name || '', code = name ? name.charCodeAt(name.length - 1) : 0;
    if (code < 0xAC00 || code > 0xD7A3) return D.ui.practiceFallback;
    const final = (code - 0xAC00) % 28;
    return `${name}${final === 0 || final === 8 ? '로' : '으로'} 가기`;
  }
  function restartAfterFailure() {
    C.restartRun(state);state.u15.queue=[];state.u15.scene=null;state.idle.waiting=false;delete state.idle.next; failure = null; menu = ''; $('panel').hidden = true;
    previous = 0; flights.length = 0; particles.length = 0; numbers.length = 0; badges.length = 0; events.recentBadges?.clear(); wonMoment = null; if (typeof stopCloseWin === 'function') stopCloseWin(); // s5t-2
    save(); render(); $('bookButton').focus();
  }
  // v4 U44: the player taps the product row of the fail panel; this is the only place that buys from it.
  function learnFailureProduct(id) { if (C.buyNode(state, id)) { save(); sound('skill'); showFailure(); } }
  function showFailure() {
    if (typeof firstUseHint === 'function') firstUseHint('buyAll'); // s5c/s5t: the first show that ends without a win (세로나's dialogue once the player is back on stage)
    if(newTutorialLesson()&&state.u15.bios.includes('lesson:failed')&&!state.u15.bios.includes('lesson:bought')){
      openPanel('fail','실패 연습 완료');
      if(D.storyV15.tutorial.missLine)$('panelBody').append(element('p','NDD · '+D.storyV15.tutorial.missLine)); // v6 script: NDD's regretful line on the planned loss
      for(const line of D.storyReview.tutorialLesson.fail)$('panelBody').append(element('p',line.speaker?line.speaker+' · '+line.text:line.text)); // s5t (read-through bug 6): speaker · line, as the curtain call
      const go=action('비법 하나 배우러 가기',()=>{setChain('upgrade-play',0);const node=ensureUpgradeNode();tree();if(node)focusNode(node.id);chainFocused=true;save();});
      $('panelBody').append(go);go.focus();return;
    }
    openPanel('fail', '공연 종료');
    const result = document.createElement('div'); result.className = 'result';
    const title = document.createElement('h2'); title.textContent = randomLine(D.pools.fail);
    const reason = document.createElement('p'); reason.textContent = D.pools.failReason.replace('{pct}', String(failure));
    const button = action(D.ui.restart, () => { tree(); });
    button.classList.add('practice-enter');
    const advice = Guidance.failure(state,D,C,failureCause);
    practiceRec = advice.node ? advice.node.id : null;
    // U32: the audience that heckled and Kali's sad face replace the lone hat icon when art exists.
    const scene = element('div', '', 'fail-scene');
    const fv = D.venues[(failureVenue || state.venue) - 1], fa = fv && C.roster(fv).find(x => x && x.id === failureAudience);
    if (fa) { const face = element('span', '', 'fail-face'); sprite(face, audienceAsset(fv, fa)); scene.append(face); }
    const sad = element('span', '', 'fail-kali'); sprite(sad, kaliReact('sad')); scene.append(sad);
    result.append(scene, title, reason, element('p',advice.line,'fail-cause'));
    if(advice.hint)result.append(element('p',advice.hint,'fail-hint'));
    // v4 U44: the 칼리 product of this venue is one option among the others (a quiet row, the player decides).
    const product=C.failureProduct(state);
    if(product){
      const pinfo=C.nodeInfo(state,product.id),prow=element('div','','practice-gate fail-product');
      prow.append(element('span',`${product.name} · 연출 ×${product.productMultiplier} · 동전 ${rounded(pinfo.cost)}`),action(pinfo.purchasable?'배우기':`동전 ${rounded(Math.ceil(pinfo.cost-state.coins))} 더`,()=>learnFailureProduct(product.id),!pinfo.purchasable));
      result.append(prow);
    }
    if(C.failureDealerAvailable(state))result.append(action('샵 매니저와 한 판 하고 다시 도전',()=>{if(C.openFailureDealer(state)){save();menu='';dealer();}}));
    const stageGo = action(practiceGoLabel(), restartAfterFailure); stageGo.classList.add('fail-stage');
    const row = element('div', '', 'fail-actions'); row.append(button, stageGo);
    result.append(row); $('panelBody').append(result); button.focus();
  }
