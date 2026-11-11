'use strict';
  // Presentation preferences never enter the game save or its validators.
  const REDUCED_KEY = 'magicShowBuster.v3.reduceMotion';
  let reducedChoice = false;
  try { reducedChoice = localStorage.getItem(REDUCED_KEY) === 'true'; } catch (error) { /* Keep the in-memory choice. */ }
  function syncReducedMotion(cancel = true) {
    const next = motion.matches || reducedChoice, changed = reduced !== next;
    reduced = next;
    document.documentElement.classList.toggle('reduce-motion', reduced);
    const button = $('reduceMotionButton');
    button.setAttribute('aria-pressed', String(reduced));
    button.setAttribute('aria-disabled', String(motion.matches));
    $('reduceMotionStatus').textContent = motion.matches ? '켜짐 · 기기 설정을 따라요' : reduced ? '켜짐' : '꺼짐';
    if (changed && cancel) {
      particles.length = 0; flights.length = 0; numbers.length = 0;
      if (reduced) for (const el of document.querySelectorAll('*')) for (const animation of el.getAnimations()) animation.cancel();
      window.dispatchEvent(new Event('presentationmotionchange'));
    }
  }
  $('reduceMotionButton').addEventListener('click', () => {
    if (motion.matches) return;
    reducedChoice = !reducedChoice;
    try { localStorage.setItem(REDUCED_KEY, String(reducedChoice)); } catch (error) { /* Memory remains authoritative for this session. */ }
    syncReducedMotion();
  });
  motion.addEventListener('change', () => syncReducedMotion());
  syncReducedMotion(false);

  // Cache media results on events; paused() never measures the viewport per frame.
  const touchPointer = matchMedia('(pointer: coarse)');
  const touchHover = matchMedia('(hover: none)');
  const landscapeScreen = matchMedia('(orientation: landscape)');
  let rotateFocus = null;
  function blockRotateInput(event) {
    if (!touchLandscapeBlocked || $('touchRotateGuard').contains(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    $('touchRotateGuard').focus({preventScroll:true});
  }
  for (const name of ['keydown', 'click', 'pointerdown', 'focusin']) window.addEventListener(name, blockRotateInput, true);
  function syncTouchOrientation() {
    const blocked = touchPointer.matches && touchHover.matches && landscapeScreen.matches;
    if (blocked === touchLandscapeBlocked) return;
    touchLandscapeBlocked = blocked;
    const guard = $('touchRotateGuard'); guard.hidden = !blocked;
    previous = 0; autoStartStage.since = 0; release();
    if (blocked) {
      rotateFocus = document.activeElement;
      clearDecorations(); guard.focus({preventScroll:true});
    } else {
      if (rotateFocus?.isConnected && !rotateFocus.closest('[hidden],[inert]')) rotateFocus.focus({preventScroll:true});
      rotateFocus = null;
    }
  }
  for (const media of [touchPointer, touchHover, landscapeScreen]) media.addEventListener('change', syncTouchOrientation);
  for (const name of ['resize', 'orientationchange']) window.addEventListener(name, syncTouchOrientation);
  syncTouchOrientation();
