'use strict';
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
  function installGuide() {
    installGuideShown = true;
    openPanel('install', '홈 화면에 추가');
    const ua = navigator.userAgent;
    const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|; wv\)/i.test(ua);
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const copy = inApp ? '다른 브라우저로 열기: 메뉴에서 외부 브라우저를 선택해 Chrome 또는 Safari로 열어 주세요.' : ios ? 'Safari에서 공유 버튼을 누르고 홈 화면에 추가를 선택한 뒤 추가를 누르세요.' : 'Chrome 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하세요.';
    $('panelBody').append(element('p', copy));
    if (installPrompt && !inApp && !ios) $('panelBody').append(action('설치', async () => { const prompt = installPrompt; installPrompt = null; try { await prompt.prompt(); } catch (e) {} }));
  }
  $('endingReplayButton').addEventListener('click', () => { if (state.u19.cleared) { endingStep = D.futureEnding.length; showEnding(); } });
  $('installButton').addEventListener('click', installGuide);
  let installGuideShown = !!state.trophies[D.venues[0].slug];
  function tickInstallGuide() {
    $('endingReplayButton').hidden = !state.u19.cleared;
    if (!installGuideShown && state.trophies[D.venues[0].slug] && !paused() && state.mode === 'fight' && !state.u15.scene) { installGuideShown = true; installGuide(); }
  }
  // Session-only counters: no storage and no network.
  const portraitStats = { enter: 0, rotate: 0, leave: 0 };
  window.magicShowPortraitStats = portraitStats;
  let statsPortrait = false;
  function countPortrait(rotated = false) {
    const next = portraitLayout();
    if (next !== statsPortrait) portraitStats[next ? 'enter' : 'leave']++;
    if (rotated) portraitStats.rotate++;
    statsPortrait = next;
  }
  window.addEventListener('resize', () => countPortrait());
  window.addEventListener('orientationchange', () => countPortrait(true));
  window.addEventListener('pagehide', () => { if (statsPortrait) { portraitStats.leave++; statsPortrait = false; } });
  countPortrait();
  const meanings=D.statMeanings;
  document.querySelectorAll('.stat').forEach((el,i)=>{if(i<3)el.append(element('small',meanings[['power','damage','mental'][i]],'stat-meaning'));});

  const MAX_FRAME_MS = 250;
  let lastRun = 0;
  function loop(now) {
    // U29: nothing runs while hidden; when paused with no effects on screen, 30 fps is enough.
    if (document.hidden) { previous = 0; requestAnimationFrame(loop); return; }
    // U35: 60 fps cap (120 Hz phones ran the whole render twice as often); a quiet stage (paused, or nothing drawn and no held press) idles at 30 fps.
    const quiet = !particles.length && !flights.length && !numbers.length && !badges.length && (paused() || !boardHolds.length);
    if (now - lastRun < (quiet ? 30 : 14)) { requestAnimationFrame(loop); return; }
    lastRun = now;
    // v4 U40: the three card rects are re-read every 8th frame (and after fit()), not every frame: they only move on resize, so the per-frame read at the top
    // forced a style recalculation (CSS animations dirty the style before every frame) for nothing. A stale rect is at most 8 frames old.
    if (geoAge++ % 8 === 0) { geo.clear(); rectOf($('stage')); rectOf($('board')); rectOf($('audience')); boardWidth(); }
    portrait();
    countPortrait();
    // U36: game time follows real time. The old 50 ms cap made the whole game run in slow motion below 20 fps (about 45 percent speed at the 9 fps
    // a phone reached late in the game: timers, attacks, fans, glove). A frame now advances up to 250 ms; Core steps it in 50 ms substeps.
    const dt = previous ? Math.max(0, Math.min(MAX_FRAME_MS, now - previous)) : 0;
    previous = now;
    tickScreenCare(dt, now);
    tickInstallGuide();
    if (!document.hidden) clock += dt * presentationRate(now); // v4 U46 A2: presentation clock only; the combat step below still gets the full dt
    drawEffects(); // v4 U40: drawn before this frame's combat step and DOM writes (see the note at the end of loop); effects born in the step start drawing next frame
    if (!paused()) {
      let remaining = dt * (debug ? 10 : 1);
      // Stop at a failure event, even at debug speed: Core already restarted.
      while (remaining > 0 && !paused()) {
        const freePractice = practiceOn && !boardHolds.length && state.mode === 'fight' && !(state.u15 && state.u15.gloveLeft > 0);
        const clocks = boardHolds.length ? boardHolds : (freePractice && practiceHold ? [practiceHold] : []);
        const slice = Math.min(50, remaining, ...clocks.map(p=>Math.max(.001,p.left)));
        // No targets during the intervals between UI pulses. Combat still advances
        // with the measured dt; the 0.001 ms press lets Core emit its instant hit.
        stepCombat(slice,{taps:[],holding:boardHolds.length>0 || freePractice});
        remaining -= slice;
        if (boardHolds.length && !paused()) {
          const next=C.advanceHolds(boardHolds,slice,C.wandRate(state)); boardHolds=next.holds;
          for (const point of next.pulses) pulse(point, 'hold');
        } else if (freePractice && practiceHold && !paused()) {
          // TODO core auto practice
          const next=C.advanceHolds([practiceHold],slice,C.wandRate(state)); practiceHold=next.holds[0];
          for (const point of next.pulses) pulseFreePractice(point);
        }
      }
    }
    // v4 U40: the canvas draw (drawEffects, above) goes before the DOM writes: setting ctx.font after them forced a style recalculation about 540 times in 10 s, 1.6 ms each at 4x CPU.
    flushNums(); renderU17(); render(); renderCoach(); updateLearningBadge(); if (typeof tickHints === 'function') tickHints(); nextToasts(dt); if (prefetchWinSeen && performance.now() >= prefetchLoadAt + 10000) prefetchNextVenue(state.venue); requestAnimationFrame(loop);
  }
  motion.addEventListener('change', e => {
    reduced = e.matches; particles.length = 0; flights.length = 0; numbers.length = 0;
    for (const el of document.querySelectorAll('*')) for (const animation of el.getAnimations()) animation.cancel();
  });
  document.addEventListener('visibilitychange', () => {
    release(); previous=0; if (document.hidden && typeof stopCloseWin === 'function') stopCloseWin(); // s5t-2: no applause after the player left
    if (practiceOn && !document.hidden) requestPracticeWake();
    if (!document.hidden) requestScreenWake();
    $('feverOverlay').classList.toggle('fever-paused',document.hidden||paused()||state.mode!=='fight');
    if(document.hidden){C.markAway(state,Date.now());save();}
    else {receiveOffline(Date.now());save();showOffline();}
  });
  // Standing owner rule (10-21): the screen stays awake while the game is open and visible. Re-requested when the page becomes visible
  // again (the browser drops the lock on hide) and at a tap (Safari may refuse a request made without a user gesture); a refusal is ignored.
  let screenWake = null, screenWakePending = false;
  function requestScreenWake() {
    try {
      if (screenWake || screenWakePending || document.hidden || !navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') return;
      screenWakePending = true;
      navigator.wakeLock.request('screen').then(lock => {
        screenWakePending = false; screenWake = lock;
        lock.addEventListener('release', () => { if (screenWake === lock) screenWake = null; });
      }).catch(() => { screenWakePending = false; screenWake = null; });
    } catch (e) { screenWakePending = false; screenWake = null; }
  }
  requestScreenWake();
  document.addEventListener('pointerdown', requestScreenWake, true);
  window.addEventListener('pagehide', save);
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  $('moreButton').addEventListener('click', () => {
    if(menu==='boo')return;
    // v4 U51 1: 메뉴 while a panel is open (desktop, where the top bar stays tappable) goes to the menu as the one layer: the panel closes first,
    // a panel that cannot be closed here (fail, ending, a busy dealer) keeps the menu shut.
    // v4 U51b 4: closing one panel can reopen another (a 도감 추억 replay goes back to 도감): keep closing while each close changes the panel (at most 3)
    if(menu){for(let i=0;i<3&&menu;i++){const was=menu;moreReturn=false;closePanel();if(menu===was)break;}if(menu)return;showMore();return;}
    if($('phoneMore').hidden)showMore();else hideMore();
  });
  // v4 U48 M: settings and other in-place entries (소리, 음악, 진동, 글자 속도, 앱 설치, links) keep the menu open and update in place. The menu gives
  // way only when the entry opened a panel (closing that panel comes back here) or left for the show (퇴장, 처음 안내).
  $('phoneMore').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const left = ['retreatButton', 'replayTutorial'].includes(b.id);
    if (menu && !left) moreReturn = true;
    if (menu || left || !$('introStory').hidden) { $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false'); }
  });
  $('statsButton').addEventListener('click', () => {
    if(phone){
      openPanel('stats','능력치');
      // v4 U38: the fight numbers come first and use the same units as the threat numbers on the audience card (per second, C.formatNumber).
      const F=C.formatNumber,th=C.threatInfo(state),mine=C.attackRate(state);
      const rows=[
        ['초당 연출','관객의 의심을 1초에 이만큼 줄여요',mine==null?'0/초':`${F(mine)}/초`],
        ['야유',th.last?'지금은 마지막 야유 한 번이 와요 (멘탈과 자신감을 합친 만큼 버텨요)':`야유 게이지가 가득 차면 이만큼 받아요 (${+th.every.toFixed(1)}초마다 한 번)`,th.last?`마지막 한 번 ${F(th.hit)}`:`한 번에 ${F(th.hit)}`]
      ];
      if(th.regen>0)rows.push(['의심 회복','관객의 의심이 1초에 이만큼 다시 차올라요',`${F(th.regen)}/초`]);
      rows.push(['멘탈',`야유를 버티는 힘 (가득 차면 ${F(state.mentalMax)})`,F(state.mental)]);
      rows.push(['자신감',`야유를 먼저 막아 줘요 (야유 한 번 ${F(th.hit)} 중 막는 양 ${F(th.block)})`,F(th.shield)]);
      rows.push([D.statNames.power,D.statMeanings.power,F(C.wandDamage(state))],[D.statNames.damage,D.statMeanings.damage,F(C.CONST.itemDamage*state._V)]);
      rows.push(['찐팬 도전 보너스',`관객마다 첫 찐팬 도전 성공이 마술 실력을 1% 올려요 (최대 ${Math.round(C.CHALLENGE_CAP*100)}%)`,`+${Math.round(C.challengeBonus(state)*100)}%`]); // v4 U46 C1
      for(const [name,meaning,value] of rows){const row=element('section','','easy-stat');row.append(element('h2',name),element('p',meaning),element('strong',value));$('panelBody').append(row);}
      // v4 U47 13: every cell is as tall as the tallest one (rows measured once, in px), so the boxes are one even grid.
      const grid=$('panelBody'),fitGrid=()=>{if(menu!=='stats')return;const cells=[...grid.querySelectorAll('.easy-stat')];grid.style.gridAutoRows='auto';grid.style.gridAutoRows=(Math.ceil(Math.max(0,...cells.map(c=>c.scrollHeight)))+4)+'px';};
      fitGrid();requestAnimationFrame(fitGrid);document.fonts?.ready?.then(fitGrid);
      return;
    }
    const expanded = $('statsButton').classList.toggle('expanded');
    $('statsButton').setAttribute('aria-expanded', String(expanded));
    document.querySelector('.stats').classList.toggle('phone-expanded', expanded);
  });
  $('banner').addEventListener('click',()=>{if(phone)presentation.finish();});
  let periodicSavePending = false;
  setInterval(() => {
    if (periodicSavePending) return;
    if (document.hidden || typeof window.requestIdleCallback !== 'function') { save(); return; }
    periodicSavePending = true;
    window.requestIdleCallback(() => { periodicSavePending = false; save(); }, {timeout:1000});
  }, 5000);
  setInterval(() => {
    if (newerSave || restoring || !saveStore) return;
    try { saveStore.rollingBackup(); } catch (error) { /* Keep the current save when backup storage is full. */ }
  }, 300000);
  // Stable screen/audio integration hooks for U4 and U5.
  window.MagicShowUI = {
    // Read-only deployment signal: paused menus are safe; active stories, games and animation beats are not.
    isRestScreen: () => {
      const visible = id => { const node = $(id); return !!node && !node.hidden; };
      if (document.hidden || state.u15.scene || state.u15.queue.length || state.batchD.twist.scene ||
          state.u15.tutorial.active || chainFighting || dealerBusy || (menu === 'dealer' && dealerGameView) ||
          presentation.busy || wonMoment || state.features.climax.left > 0 ||
          (state._theaterBeat && clock < state._theaterBeat.until) ||
          ['storyDialog', 'introStory', 'sceneCard', 'tutorialCoach', 'routineCutin'].some(visible)) return false;
      return (state.mode !== 'fight' || blockingSheetOpen()) &&
        (blockingSheetOpen() || visible('titleScreen') || !!stageRewardHost || ['transition', 'ending', 'fail', 'boo'].includes(state.mode));
    },
    motionMetrics:()=>({particles:particles.length,flights:flights.length,numbers:numbers.length,badges:badges.length,coinOrigin:clearMoment.origin||null,flightOrigins:flights.map(f=>[f.x,f.y])}), hitTier, openCurtainCall, openRestore, getState: () => state, startScene:C.startScene, storyList, renderU15, getHolds: () => boardHolds, startIntro, events, save, toast, banner, openPanel, closePanel, render, showFailure, showBoo, clearDecorations, opaqueSprites,
    openBook: tree, focusNode, openBestiary: bestiary, openMissions:drawMissions, renderCoach,
    openDealer: dealer, openGemShop:gemShop, openWardrobe:wardrobe, openMap:openStageMap, openCustomize:customize, drawDealer, openEnding: () => { if (state.seenEnding) { revealEnding = false; showEnding(); } },
    openRebirth: () => { if (state.seenEnding) showRebirth(); }, isPaused: paused, renderDialog, speakerPortrait, portraitFocus,
  };
  // v4 U50d test hook: show the current audience with a mood face through the normal path (sprite, opaque crop, tablet snap). v4 U51b 5: only under
  // automation (navigator.webdriver, true in the Playwright tests and the flag beforeunload already uses), so a player's console cannot freeze the faces.
  // s4d test hook (automation only, like audienceMood below): hold one of 칼리's poses so tools/kali-size-check.cjs can measure her on-screen box.
  if (navigator.webdriver) window.MagicShowUI.kaliPoseHold = kind => { const host = $('magicianMini'); if (kind === 'idle') { kaliUntil = 0; host.dataset.face = ''; return; } if (kind === 'sad') kaliFlinch(); else if (kind === 'surprised') { host.classList.add('reacting'); host.dataset.face = 'event'; sprite(host, kaliReact('surprised')); } else kaliPose(kind === 'p2' ? 2 : 1, 0); kaliUntil = clock + 1e7; };
  // s5c test hook (automation only): queue a first-use hint and read the queue, so test-u84 can check the gating without waiting for a trigger.
  if (navigator.webdriver) window.MagicShowUI.hints = { queue: (id, arg) => firstUseHint(id, arg), pending: () => hintQueue.slice(), failDialog: () => ({ pending: seronaFail.pending, index: seronaFail.index }), sessionSeen: () => [...sessionHintsSeen] };
  if (navigator.webdriver) window.MagicShowUI.audienceMood = mood => { audTestMood = mood || ''; if (!mood) return ''; const v = D.venues[state.venue - 1], a = v.audiences[state.j - 1] || v.headliner; const art = stageAudienceAsset(v, a); moodSprite($('audience'), art, mood); return art; };
  sprite($('magicianMini'), 'assets/magician-mini.png');
  renderOutfit();
  $('magicianMini').dataset.frame = '0';$('magicianMini').classList.remove('reacting');
  // v4 U47 3: the goal strip is plain text (no click): the notebook only opens from the fail panel, so the strip must not open it.
  $('gameLogo').textContent = D.title;
  $('gameLogo').setAttribute('aria-label', D.title);
  revealEnding = state.mode === 'ending' && state.endings.length === 1;
  updateSoundButton();
  initIdleControls();
  receiveOffline(Date.now());
  const launchSaved = save();
  for(const name of ['ui-panel','ui-panel-inner','ui-button','ui-button-pressed','ui-button-primary','ui-button-disabled','ui-bar-frame','ui-bar-frame-main','ui-board-cell','ui-board-cell-next','ui-top-bar','ui-dialog']){
    const image=assetImage('assets/ui/'+name+'.png');const failed=()=>document.body.classList.add('missing-'+name);if(image.complete&&!image.naturalWidth)failed();else image.addEventListener('error',failed,{once:true});
  }
  for(const name of ['card-shards','coin-spark','critical','feathers','heart-pop','puff','ribbon','ring-flash','shockwave'])assetImage('assets/ui/fx-'+name+'.png');
  let presentationLayoutPending=false;
  const refreshPresentation=()=>{
    if(presentationLayoutPending)return;presentationLayoutPending=true;
    requestAnimationFrame(()=>{
      presentationLayoutPending=false;cacheEffectZones();
      for(const context of [$('panelBody'),$('storyDialog'),$('phoneMore')]){
        const current=context.querySelector('.u26-primary');
        const preferred=context.querySelector('.stage-start:not([disabled]),.line-next:not([disabled]),.practice-enter:not([disabled]),.tree-buy:not([disabled])')|| /* v4 U51 2: a line window's 다음 is its primary button */(context.id==='phoneMore'?null:[...context.querySelectorAll('button:not([disabled])')].find(el=>!el.hidden&&!el.closest('.panel-tabs')&&!el.classList.contains('game-cup')&&!el.classList.contains('routine-card')&&!el.classList.contains('dealer-back')&&!el.closest('.cups-table')));
        if(current!==preferred){current?.classList.remove('u26-primary');preferred?.classList.add('u26-primary');}
      }
    });
  };
  const presentationObserver=new MutationObserver(records=>{
    if(records.some(r=>r.attributeName==='hidden'&&r.oldValue!==r.target.getAttribute('hidden')))autoStartStage.since=0;
    if(records.some(r=>r.type==='childList'?[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1):r.oldValue!==r.target.getAttribute(r.attributeName)))refreshPresentation();});
  for(const id of ['panelBody','storyDialog','phoneMore'])presentationObserver.observe($(id),{childList:true,subtree:true,attributes:true,attributeFilter:['disabled'],attributeOldValue:true});
  for(const id of ['panel','storyDialog','phoneMore','banner','leaveConfirm','sceneCard','introStory','offlineCard'])presentationObserver.observe($(id),{attributes:true,attributeFilter:['hidden'],attributeOldValue:true});
  window.addEventListener('resize',refreshPresentation);motion.addEventListener('change',refreshPresentation);
  refreshPresentation();
  $('audience').addEventListener('click',()=>{replayAudienceLine();renderU15();});
  $('audience').setAttribute('tabindex','0');$('audience').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();replayAudienceLine();renderU15();}});
  // v4 U46 A5: static icons once, and the panel / menu sheets whenever their content is rebuilt (they change rarely; the per-frame HUD uses pxText).
  for (const el of [document.querySelector('.stats'), document.querySelector('.hud'), $('coffeeButton')]) pxIcons(el);
  { const iconize = list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1 ? !n.classList.contains('px-icon') : n.nodeType === 3) pxIcons(n.nodeType === 1 ? n : n.parentElement); };
    for (const root of [$('panelBody'), $('phoneMore'), $('panel').querySelector('header')]) if (root) { pxIcons(root); new MutationObserver(iconize).observe(root, { childList: true, subtree: true }); } }
  owedCurtainCall(); // curtain fix: before the first render, which would start the 공연 뒤 lines
  fit(); render(); showOffline();
  if(state.u18.map)openStageMap();
  if (typeof markPassedHints === 'function') markPassedHints(); // s5c: a save past venue 1 never gets a burst of first-use hints
  if (C.twistLoadIntro && C.twistLoadIntro(state)) save(); // s5t: an old save mid-fight at the meetup headliner, before the twist began, starts with its intro
  if (!state.onboarding.intro) startIntro(false);
  if (seasonReset) toast('새 테스트가 시작됐어요. 처음부터 다시 즐겨 주세요!');
  if (corrupt) toast('저장을 불러오지 못해 백업해 두었어요');
  if (recoveredSave) toast('저장이 손상돼 최근 백업에서 되찾았어요');
  if (repairedSave) toast('저장을 조금 고쳐서 불러왔어요');
  if (refundedCoins > 0) toast(`끝없는 비법이 정리돼서 동전 ${C.formatNumber(refundedCoins)}을 돌려받았어요`);
  if (refundedKeys > 0) toast(`칼리 덱이 비법으로 합쳐져서 책 ${C.formatNumber(refundedKeys)}개를 돌려받았어요`);
  if (state._deckGift > 0) toast(`칼리 덱이 이제 쓰는 아이템이 됐어요. 칼리 덱 ${state._deckGift}개를 드려요`); // v4 U48 A
  if (newerSave) showSaveNotice();
  if (giftEnded && launchSaved) toast('선물 기간이 끝나서 성장 속도가 원래대로 돌아왔어요');
  if (launchQuery.get('restored') === '1') {
    const v = D.venues[(state.vMax|0)-1];
    // Not toast(): the toast queue waits behind the offline-gain card, and this must be seen right away.
    const note = element('div',`이전 저장을 되찾았어요 · ${v && v.name ? v.name : `무대 ${state.vMax}`} · 동전 ${C.formatNumber(state.coins)}`,'save-version-notice');
    note.id = 'restoredNotice'; note.setAttribute('role','status'); document.body.append(note);
    setTimeout(() => note.remove(), 8000);
    try { const url = new URL(location.href); url.searchParams.delete('restored'); history.replaceState(null,'',url.href); } catch (error) { /* URL cleanup is cosmetic. */ }
  }
  if (restoring) { /* A restore is reloading the page; leave the list closed. */ }
  else if (launchQuery.get('restore') === '1') {
    openRestore();
    if (restoreNoBetter && saveStore && !inaccessible) $('panelBody').prepend(element('p','지금 저장이 가장 많이 진행된 저장이에요'));
  }
  if (inaccessible) toast('저장을 사용할 수 없어요. 공연은 계속돼요');
  // U36 TEMPORARY title screen (owner art). It is plain markup in index.html (first paint). It fades out (250 ms, none under Reduce Motion) once the
  // game is ready and at least 1.2 s have passed since the page started, or at once on a tap. It never touches the game state, saves or the
  // install prompt. Browser automation (navigator.webdriver) skips it unless the URL has ?title=1, so tests and capture tools see the game directly.
  (function titleScreen() {
    const title = document.getElementById('titleScreen');
    if (!title) return;
    if (navigator.webdriver && launchQuery.get('title') !== '1') { title.remove(); return; }
    let leaving = false;
    const hide = () => {
      if (leaving) return; leaving = true;
      if (reduced) { title.remove(); return; }
      title.classList.add('leaving'); setTimeout(() => title.remove(), 300);
    };
    title.addEventListener('pointerdown', hide);
    setTimeout(hide, Math.max(0, 1200 - performance.now()));
  })();
  // v4 U47 6: leaving the game. A history guard entry (pushed at the first tap, because browsers skip entries made without a user gesture) turns the first
  // Back press (Android back, browser back, PWA back) into the in-game panel "저장하고 나갈까요?". The guard is not re-armed behind it, so a second Back
  // press at the page's first entry leaves natively (the browser exits or goes to the previous page; a page cannot close an installed app by itself).
  // [저장 칸에 저장] opens the save-slot panel and comes back here after a slot was written; [그냥 나가기] goes back at once; [계속하기] re-arms the guard.
  // beforeunload (tab close or reload where the browser allows it) auto-saves and asks the browser's own generic question only when there is progress and no
  // slot was written in the last 10 minutes; its text cannot be customised, and browsers show nothing on touch devices where the page was closed from the task list.
  let guardOn = false, leaveGo = false, leavePending = false, lastSlotSaveAt = 0;
  function armLeaveGuard() { if (guardOn) return; try { history.pushState({ magicLeaveGuard: 1 }, '', location.href); guardOn = true; } catch (error) { /* no history access: beforeunload below still applies */ } }
  function showLeaveConfirm(saved = false) {
    release(); $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false');
    $('leaveTitle').textContent = saved ? '저장했어요. 나갈까요?' : '저장하고 나갈까요?';
    $('leaveNote').textContent = saved ? '저장 칸에 남겼어요. 자동 저장도 계속 돼요.' : '자동 저장은 계속 돼요. 저장 칸에 따로 남겨 둘 수도 있어요.';
    $('leaveSave').textContent = saved ? '다른 칸에도 저장' : '저장 칸에 저장';
    $('leaveConfirm').hidden = false; $('leaveStay').focus();
  }
  window.addEventListener('popstate', e => {
    if (e.state && e.state.magicLeaveGuard) { guardOn = true; return; } // forward onto the guard entry
    if (!guardOn || leaveGo) return;
    guardOn = false; showLeaveConfirm();
  });
  document.addEventListener('pointerdown', () => { if (!guardOn && !leaveGo && $('leaveConfirm').hidden) armLeaveGuard(); }, true);
  $('leaveStay').addEventListener('click', () => { $('leaveConfirm').hidden = true; leavePending = false; armLeaveGuard(); });
  $('leaveSave').addEventListener('click', () => { $('leaveConfirm').hidden = true; openSaveSlots(); leavePending = true; });
  $('leaveNow').addEventListener('click', () => {
    leaveGo = true; leavePending = false; save(); $('leaveConfirm').hidden = true;
    try { history.back(); } catch (error) { /* nothing to go back to */ }
    setTimeout(() => { // still here: nothing came before this page (new tab, or the installed app's first screen)
      try { window.close(); } catch (error) { /* only script-opened windows can close */ }
      toast('뒤로가기를 한 번 더 누르면 나가요'); leaveGo = false;
    }, 500);
  });
  window.addEventListener('beforeunload', e => {
    if (restoring || leaveGo) return;
    save();
    let newest = lastSlotSaveAt;
    for (let n = 1; n <= 3; n++) { try { newest = Math.max(newest, SaveSlots.read(localStorage, n).slot?.savedAt || 0); } catch (error) { /* unreadable slot */ } }
    if (!navigator.webdriver && (state.wins > 0 || state.vMax > 1) && Date.now() - newest > 600000) { e.preventDefault(); e.returnValue = ''; }
  });
  // v4 U47 4: the 글자 속도 menu entry cycles 보통, 느리게, 빠르게 (빠르게 = the whole line at once); stored in the presentation settings.
  function updateTextSpeedButton(){const s=textSpeed(),b=$('textSpeedButton');b.textContent='글자 속도: '+TEXT_SPEED_LABEL[s];b.title=s==='fast'?'한 번에 보이기':'한 글자씩 나와요';b.setAttribute('aria-label','글자 속도 '+TEXT_SPEED_LABEL[s]+(s==='fast'?' (한 번에 보이기)':''));}
  $('textSpeedButton').addEventListener('click',()=>{uiSave.textSpeed=TEXT_SPEEDS[(TEXT_SPEEDS.indexOf(textSpeed())+1)%TEXT_SPEEDS.length];savePresentation();updateTextSpeedButton();});
  // A late font or a line changed between renders must settle before the next paint.
  document.fonts?.ready?.then(() => { invalidateStageAudience(); syncFlags(); });
  const audienceTextObserver = new MutationObserver(() => syncFlags());
  for (const id of ['audienceLine', 'patternLabel', 'phaseIndicator', 'toasts']) audienceTextObserver.observe($(id), { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
  updateTextSpeedButton();
  mountRound8();
  requestAnimationFrame(loop);
