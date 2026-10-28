'use strict';
  function modeHooks() {
    if (state.mode !== lastMode) {
      lastMode = state.mode;
      window.dispatchEvent(new CustomEvent('magicshow:mode', { detail: { mode: state.mode, state } }));
    }
    if (menu || document.hidden || state.u15.scene || state.u15.tutorial.active) return;
    if(state.features.guide==='place' && state.features.collected.length && !modeHooks.equipHinted) {
      modeHooks.equipHinted=true; toast('🎩 마술용품에서 모은 소품을 놓아 보세요');
    }
    if(state.features.climax.left>0)return;
    if (state.mode === 'dealer') dealer();
    else if (pendingIntro && state.mode === 'fight') headlinerIntro(pendingIntro);
    else if (state.mode === 'ending'&&!state.u15.scene&&!state.u15.queue.length&&!presentation.busy) showEnding();
  }
  $('replayTutorial').addEventListener('click',()=>{moreReturn=false;closePanel();C.replayTutorial(state);startIntro(false);});
  // The notebook is reachable from the dock, landscape navigation and failure panel.
  $('equipButton').addEventListener('click',()=>{if(!C.equipSlots(state))return;if(!state.guidance.seen.includes('equipButton'))state.guidance.seen.push('equipButton');bestiaryTab='equip';bestiary();save();});
  $('openChatButton').addEventListener('click',()=>{save();window.open('https://open.kakao.com/o/gUJkfxzi','_blank','noopener');});
  $('coffeeButton').addEventListener('click',()=>{save();window.open('https://qr.kakaopay.com/Ej8rDsX4f','_blank','noopener');});
  $('bookButton').addEventListener('click', () => {
    if (['boo','fail','ending','rebirth','bossPhase'].includes(menu) || dealerBusy) return;
    const mark=chainMark();
    if(mark&&!state.u15.tutorial.done&&!state.u15.tutorial.active&&mark.step!=='upgrade-play'){toast('지금은 공연에 집중해 봐요');return;}
    tree();
  });
  $('bestiaryButton').addEventListener('click', bestiary);
  $('rebirthButton').addEventListener('click', () => {
    if (!['boo','fail','dealer','headliner','ending','rebirth','bossPhase'].includes(menu) && state.seenEnding) showRebirth();
  });
  $('mapButton').addEventListener('click',()=>openStageMap());
  $('customizeButton').addEventListener('click',customize);
  $('gemShopButton').addEventListener('click',()=>{if(lineOpen())return;gemShop();});
  $('wardrobeButton').addEventListener('click',wardrobe);
  // v4 U50b: no shop from the skill column while a character dialog is open (Codex Sol U50 FAIL 1). U50c: this comment used to swallow the rest of the line.
  const shopQuick=action('',()=>{if(lineOpen())return;gemShop();});shopQuick.id='gemShopQuick';shopQuick.className='active-skill gem-shop-quick';shopQuick.setAttribute('aria-label','실크 상점');
  shopQuick.append(Object.assign(document.createElement('img'),{className:'cur-icon skill-art',src:'assets/cur-silk.webp',alt:'',width:18,height:18}),element('span','실크 상점'));
  $('activeSkills').append(shopQuick);
  const practiceBtn = action('연습 모드', () => openPracticePrompt());
  practiceBtn.id = 'practiceButton';
  practiceBtn.type = 'button';
  practiceBtn.setAttribute('aria-pressed', 'false');
  practiceBtn.setAttribute('aria-label', '연습 모드');
  practiceBtn.hidden = true;
  $('activeSkills').append(practiceBtn);
  $('practicePromptText').textContent = PRACTICE_COPY;
  $('practiceStart').addEventListener('click', () => { closePracticePrompt(); hideMore(); setPractice(true); });
  $('practiceDismiss').addEventListener('click', closePracticePrompt);
  $('practiceVeil').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); dismissSaver(); });
  document.addEventListener('pointerdown', () => { practiceIdleAt = performance.now(); }, true);
  document.addEventListener('keydown', dismissSaver);
  function dismissSaver() { $('practiceVeil').hidden = true; practiceIdleAt = performance.now(); }
  function tickScreenCare(dt, now) {
    if (state.u15.gloveLeft > 0) { if (!paused()) deckContinuousMs += dt; } else deckContinuousMs = 0;
    if (!deckSaverAsked && deckContinuousMs >= 300000 && !menu) {
      deckSaverAsked = true;
      openPanel('screenCare', '화면 보호 모드로 바꿀까요?');
      $('panelBody').append(action('화면 보호 모드', () => { closePanel(); $('practiceVeil').hidden = false; }), action('계속하기', closePanel));
    }
    if (practiceOn && !paused() && now - practiceIdleAt >= 20000) $('practiceVeil').hidden = false;
    if (!$('practiceVeil').hidden) {
      if (menu || (!practiceOn && state.u15.gloveLeft <= 0)) dismissSaver();
      else $('practiceVeil').firstElementChild.style.transform = `translate(${Math.sin(now / 19000) * 24}px, ${Math.cos(now / 23000) * 18}px)`;
    }
  }
  // v4 U47 9: 피버 confetti: 36 small pieces (24 on phones, under caps.particles 48), compositor-only transforms, no pointer events, drawn behind the HUD, never with Reduce Motion.
  for(let i=0;i<36;i++){const piece=element('span','',`confetti-piece c${i%5}${i>=24?' extra':''}`);piece.style.setProperty('--x',`${(i*29+7)%97+1}%`);piece.style.setProperty('--d',`-${((i*7)%13)*.7}s`);piece.style.setProperty('--t',`${7+(i*5)%5}s`);piece.style.setProperty('--sway',`${12+(i*11)%20}px`);$('feverConfetti').append(piece);}
  for(let i=0;i<8;i++){const petal=pxIcons(element('span',i%3?'✦':'🌸','fever-petal'));petal.style.setProperty('--x',`${(i*37)%100}%`);petal.style.setProperty('--delay',`${i*.08}s`);petal.style.setProperty('--drift',`${i%2?80:-80}px`);$('feverPetals').append(petal);}
  $('musicButton').addEventListener('click',()=>{if(window.Sfx){const on=window.Sfx.toggleMusic();$('musicButton').textContent=phone?(on?'음악 ON':'음악 OFF'):on?'배경음악 켜짐':'배경음악 꺼짐';$('musicButton').setAttribute('aria-pressed',String(on));}});
  $('musicVolume').addEventListener('input',()=>window.Sfx&&window.Sfx.setMusicVolume(Number($('musicVolume').value)));
  if(window.Sfx){$('musicVolume').value=window.Sfx.musicVolume();const on=window.Sfx.musicEnabled();$('musicButton').textContent=phone?(on?'음악 ON':'음악 OFF'):on?'배경음악 켜짐':'배경음악 꺼짐';$('musicButton').setAttribute('aria-pressed',String(on));}
  $('missionsButton').addEventListener('click',()=>{if(!['boo','fail','dealer','headliner','ending','rebirth','bossPhase'].includes(menu))drawMissions();});
  $('hapticsButton').addEventListener('click',()=>{C.toggleHaptics(state);save();renderU14();});  $('eventVisitor').addEventListener('click',()=>{if(paused()&&!dialogOnlyPause()&&menu!=='boo')return;if(C.visitorBlocked(state)||paused()||lineOpen()){if(state.u14.visitor.left>0)visitorTap=state.u14.visitor.serial+1;return;}const list=C.catchVisitor(state);events(list);render();}); // v4 U49 4 / U49b 1: a tap during any line (story dialog, heckle, win, boo) is kept; renderU14 catches it after the line
  $('soundButton').addEventListener('click', () => {
    if (window.Sfx) window.Sfx.toggle();
    updateSoundButton();
  });
  $('retreatButton').addEventListener('click', () => {
    if (['boo','fail','ending','rebirth','bossPhase'].includes(menu) || dealerBusy) return;
    moreReturn = false; if (menu) closePanel();
    const traveling = !!state.u18.anchor;
    release(); C.retreat(state); lastAudience = ''; save(); render(); toast(traveling ? '도전을 마치고 지도로 돌아가요' : `${D.venues[state.venue - 1].name} 처음부터 다시 시작해요`);
  });
  $('closePanel').addEventListener('click', closePanel);
  // v4 U48 M: a tap outside a panel no longer closes it; panels close only with their own 닫기/뒤로 (and Escape or the phone Back flow).
  document.addEventListener('keydown', e => {
    if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && $('leaveConfirm').hidden) { // v4 U51b 3: no shortcut under the leave question
      const key=e.key.toLowerCase();
      if(['1','2','3'].includes(key) && !paused()) { e.preventDefault(); activateSkill(D.skills[Number(key)-1].id); }
      if (key==='b' && menu==='fail') { e.preventDefault(); document.querySelector('#panelBody .practice-enter')?.click(); } // v4 U47 3: the notebook opens only from the fail panel
      if (key==='d') { e.preventDefault(); $('bestiaryButton').click(); }
    }
    if (e.key === 'Escape' && !$('leaveConfirm').hidden) { e.preventDefault(); $('leaveStay').click(); return; } // v4 U51b 3: the leave question is the top layer; Escape = 계속하기, nothing under it closes
    if (e.key === 'Escape' && menu && menu !== 'fail') closePanel();
    else if (e.key === 'Escape' && !menu && !$('phoneMore').hidden) hideMore(); // v4 U51 1: Escape closes the top layer, the menu too
    if (e.key === 'Tab' && menu) {
      const buttons = Array.from($('panel').querySelectorAll('button:not(:disabled)')).filter(el => !el.hidden);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  $('debug').hidden = !debug;
  if (debug) {
    $('debugCoins').addEventListener('click', () => { state.coins = Math.min(1e12, state.coins + 1000); save(); if (menu === 'book') tree(); render(); });
    $('debugWin').addEventListener('click', () => {
      if (paused() || state.mode !== 'fight') return;
      state.audHp = 0; events(C.step(state, 1, { taps: [] })); render();
    });
    $('debugNext').addEventListener('click', () => {
      if (dealerBusy) return;
      if (menu && menu !== 'fail') closePanel();
      if (menu === 'fail') { menu = ''; $('panel').hidden = true; failure = null; }
      C.dealerLeave(state);
      // Exercise automatic progression through Core wins, never assign a venue.
      const venue = state.venue;
      for (let i = 0; i < 12 && state.venue === venue; i++) {
        C.dealerLeave(state);
        if (state.mode === 'transition') events(C.step(state, Math.max(1, state.transMs + 1), { taps: [] }));
        C.dealerLeave(state);
        if (state.mode !== 'fight') break;
        state.audHp = 0; events(C.step(state, 1, { taps: [] }));
      }
      if (state.dealerQueued && state.mode === 'transition') events(C.step(state, Math.max(1, state.transMs + 1), { taps: [] }));
      C.dealerLeave(state);
      save(); render();
    });
  }
  function star(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? r * .45 : r;
      const px = Math.round(x + Math.cos(a) * radius), py = Math.round(y + Math.sin(a) * radius);
      if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
