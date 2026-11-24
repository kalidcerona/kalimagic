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
  let installFocus = null;
  const installStrip = '#phoneInstallGuide, #magicshow-install-overlay[data-portrait]';
  const installObserver = new MutationObserver(clearInstallFocus);
  function clearInstallFocus() {
    restoreInstallFocus.pending = null;
    installObserver.disconnect();
    installFocus = null;
  }
  window.addEventListener('focusin', event => {
    if (event.target === $('touchRotateGuard')) return;
    clearInstallFocus();
    const button = event.target.closest?.('button');
    const strip = button?.closest(installStrip);
    if (!strip || button !== event.target || landscapeScreen.matches || strip.hidden) return;
    installFocus = {button, strip};
    installObserver.observe(strip, {attributes:true, attributeFilter:['hidden', 'data-portrait']});
  }, true);
  window.addEventListener('focusout', event => {
    if (event.target !== installFocus?.button || touchLandscapeBlocked || landscapeScreen.matches) return;
    const viewport = window.visualViewport;
    if (viewport && viewport.width > viewport.height) return;
    clearInstallFocus();
  }, true);
  window.addEventListener('appinstalled', clearInstallFocus);
  function restoreInstallFocus() {
    const saved = restoreInstallFocus.pending;
    if (!saved || saved !== installFocus || touchLandscapeBlocked ||
        !document.body.classList.contains('portrait-layout')) return;
    const changed = installObserver.takeRecords().length > 0;
    const {button, strip} = saved;
    clearInstallFocus();
    if (changed || touchLandscapeBlocked || !button.isConnected || button.closest(installStrip) !== strip ||
        button.matches(':disabled, [aria-disabled="true"]') || button.closest('[hidden], [inert]') ||
        !button.getClientRects().length || getComputedStyle(button).visibility !== 'visible') return;
    if ([document.body, $('touchRotateGuard')].includes(document.activeElement)) button.focus({preventScroll:true});
  }
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
      restoreInstallFocus.pending = null;
      rotateFocus = document.activeElement;
      clearDecorations(); guard.focus({preventScroll:true});
    } else {
      if (installFocus) {
        restoreInstallFocus.pending = installFocus;
        queueMicrotask(restoreInstallFocus);
      } else if (!rotateFocus?.closest?.(installStrip) && rotateFocus?.isConnected && !rotateFocus.closest('[hidden],[inert]')) rotateFocus.focus({preventScroll:true});
      rotateFocus = null;
    }
  }
  for (const media of [touchPointer, touchHover, landscapeScreen]) media.addEventListener('change', syncTouchOrientation);
  for (const name of ['resize', 'orientationchange']) window.addEventListener(name, syncTouchOrientation);
  syncTouchOrientation();
