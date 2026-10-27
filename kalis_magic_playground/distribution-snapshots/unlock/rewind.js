import { $, session } from './session.js';
import { hiddenDigit, appendMinuteDigit, timeMachineClock, unlockDragTarget } from './time-machine.js';

const applyAppearance = (...args) => session.applyAppearance(...args);
const exitRewindFullscreen = (...args) => session.exitRewindFullscreen(...args);
const renderInput = (...args) => session.renderInput(...args);
const refreshCroppedImages = (...args) => session.refreshCroppedImages(...args);
const renderAttempts = (...args) => session.renderAttempts(...args);
const setHomePage = (...args) => session.setHomePage(...args);
const cancelReveal = (...args) => session.cancelReveal(...args);
const populateForm = (...args) => session.populateForm(...args);
const clearHomeSwipe = (...args) => session.clearHomeSwipe(...args);
const clearFeedback = (...args) => session.clearFeedback(...args);
const updateUnlockControls = (...args) => session.updateUnlockControls(...args);
const formSettings = (...args) => session.formSettings(...args);

const UNLOCK_ANIMATION_MS = 520;
let unlockTimer = null;
let timeFrame = null;

    let rewindGuideTimers = [];
    function stopRewindGuide() {
      for (const timer of rewindGuideTimers) clearTimeout(timer);
      rewindGuideTimers = [];
      const guide = $('rewind-digit-guide');
      guide.hidden = true;
      guide.classList.remove('is-fading');
    }
    function startRewindGuide() {
      stopRewindGuide();
      if (!$('rewind-grid-guide').checked) return;
      const guide = $('rewind-digit-guide');
      void guide.offsetWidth;
      guide.hidden = false;
      rewindGuideTimers.push(setTimeout(() => {
        if (guide.hidden) return;
        guide.classList.add('is-fading');
        rewindGuideTimers.push(setTimeout(stopRewindGuide, 400));
      }, 800));
    }

    let wakeLock = null;
    let wakeLockPending = false;

    function performanceWakeWanted() {
      return session.screen !== "settings";
    }

    async function acquireWakeLock() {
      if (
        !performanceWakeWanted() ||
        !("wakeLock" in navigator) ||
        document.visibilityState !== "visible" ||
        wakeLock !== null ||
        wakeLockPending
      ) {
        return;
      }

      wakeLockPending = true;
      try {
        const lock = await navigator.wakeLock.request("screen");

        if (!performanceWakeWanted() || document.visibilityState !== "visible") {
          await lock.release();
          return;
        }

        wakeLock = lock;
        lock.addEventListener("release", () => {
          if (wakeLock === lock) wakeLock = null;
          if (document.visibilityState === "visible") acquireWakeLock();
        }, { once: true });
      } catch {
        wakeLock = null;
      } finally {
        wakeLockPending = false;
      }
    }

    async function releaseWakeLock() {
      const lock = wakeLock;
      wakeLock = null;
      if (lock === null) return;

      try {
        await lock.release();
      } catch {
        // Wake Lock API is optional; release failures need no UI.
      }
    }

    function syncPerformanceWakeLock() {
      if (performanceWakeWanted()) acquireWakeLock();
      else releaseWakeLock();
    }

    function showScreen(next, animate = false) {
      clearTimeout(unlockTimer);
      session.screen = next;
      if (next !== 'time-black' && next !== 'time-lock') {
        applyAppearance(session.settings);
        exitRewindFullscreen();
      }
      cancelAnimationFrame(timeFrame);
      cancelUnlockMotion();
      session.timePointer = null;
      session.timeLastTap = null;
      session.emergencyLastTap = null;
      $('time-black').hidden = next !== 'time-black';
      $('time-lock').hidden = next !== 'time-lock';
      $('time-lock').classList.toggle('galaxy', session.settings.style === 'galaxy');
      if (next === 'time-lock') renderTimeMachine();
      $('input-screen').hidden = next !== 'input' && !(next === 'unlocked' && animate);
      $('unlocked-screen').hidden = next !== 'unlocked';
      $('peek-screen').hidden = next !== 'unlocked' || animate;
      $('settings-screen').hidden = next !== 'settings';
      $('input-screen').classList.remove('unlocking-out');
      $('unlocked-screen').classList.remove('unlocking');
      $('unlocked-screen').style.transform = '';
      clearHomeSwipe();
      cancelReveal();
      if (next === 'input') renderInput();
      if (next === 'settings') void refreshCroppedImages();
      if (next === 'unlocked') {
        renderAttempts();
        setHomePage('home1', false);
        requestAnimationFrame(() => { $('home-track').style.transition = ''; });
        if (animate) {
          settleUnlockMotion($('input-screen'), 0, true);
        }
      }
      if (next === 'settings') { $('settings-entry-tutorial').hidden = true; populateForm(); $('settings-screen').scrollTop = 0; }
      if (next === 'time-black') startRewindGuide();
      else stopRewindGuide();
      // Update prompt: asked only on the settings screen, hidden on every other screen.
      if (next === 'settings') globalThis.MagicUpdate?.offer(); else globalThis.MagicUpdate?.hide();
      // Extracted rewind tests run showScreen without this helper in scope.
      if (typeof syncPerformanceWakeLock === 'function') syncPerformanceWakeLock();
    }

    let oneUiBattery = null;
    function updateOneUiExtras() {
      const dnd = $('rewind-dnd').checked;
      $('oneui-dnd').hidden = !dnd;
      let show = false;
      if ($('rewind-charging').checked) {
        const b = oneUiBattery;
        if (b) {
          show = !!b.charging;
          if (show) {
            $('oneui-level').textContent = String(Math.round(b.level * 100));
            const t = b.chargingTime;
            $('oneui-eta').textContent = Number.isFinite(t) && t > 0 ? Math.max(1, Math.round(t / 60)) + '분 후 충전이 완료됩니다' : '';
          }
        }
      }
      $('oneui-charge').hidden = !show;
    }
    if (typeof navigator.getBattery === 'function') {
      navigator.getBattery().then((b) => {
        oneUiBattery = b;
        for (const ev of ['chargingchange', 'levelchange', 'chargingtimechange']) b.addEventListener(ev, updateOneUiExtras);
        updateOneUiExtras();
      }).catch(() => {});
    }
    function renderTimeMachine() {
      if (session.screen !== 'time-lock') return;
      const date = new Date(timeMachineClock(session.timeMinutes, session.timeTriggeredAt, performance.now(),
        session.settings.timeDelay, Date.now(), session.timeTriggeredWallAt));
      $('time-date').textContent = date.toLocaleDateString('ko-KR', {month:'long',day:'numeric',weekday:'long'});
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      for (const [id, value] of [['time-hour', hour], ['time-minute', minute]]) {
        const element = $(id);
        if (element.textContent === value) continue;
        const hadValue = element.textContent.length > 0;
        element.textContent = value;
        if (hadValue && session.timeTriggeredAt !== null && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          element.getAnimations().forEach((animation) => animation.cancel());
          element.animate([
            { opacity: .12, transform: 'translateY(-13px)', filter: 'blur(5px)' },
            { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
          ], { duration: 650, easing: 'cubic-bezier(.18,.75,.2,1)' });
        }
      }
      $('time-clock').dateTime = date.toISOString();
      $('time-clock').setAttribute('aria-label', `${hour}시 ${minute}분`);
      timeFrame = requestAnimationFrame(renderTimeMachine);
    }

    // One geometry read at drag start; all frames update compositor properties only.
    let unlockDrag = null;
    let unlockAnimations = [];
    function cancelUnlockMotion() {
      clearTimeout(unlockTimer);
      unlockTimer = null;
      if (unlockDrag && $('time-lock').hasPointerCapture(unlockDrag.id)) {
        $('time-lock').releasePointerCapture(unlockDrag.id);
      }
      unlockDrag = null;
      for (const animation of unlockAnimations) animation.cancel();
      unlockAnimations = [];
      for (const id of ['input-screen', 'time-lock', 'unlocked-screen']) {
        const element = $(id);
        element.style.transform = '';
        element.style.opacity = '';
        element.style.pointerEvents = '';
      }
      $('time-face').style.opacity = '';
      if (session.screen !== 'unlocked') $('unlocked-screen').hidden = true;
    }
    function unlockPose(distance, height) {
      const progress = Math.min(1, distance / height);
      return { lock: `translate3d(0,${-distance}px,0)`,
        home: `translate3d(0,${(1-progress)*28}px,0) scale(${.96+.04*progress})`,
        opacity: String(1-progress*.8), homeOpacity: String(.7+.3*progress) };
    }
    function settleUnlockMotion(lock, distance, complete, height = window.innerHeight) {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const start = unlockPose(distance, height);
      const end = unlockPose(complete ? height : 0, height);
      const options = {duration: reduced ? 0 : UNLOCK_ANIMATION_MS,
        easing: complete ? 'cubic-bezier(.22,.82,.18,1)' : 'cubic-bezier(.2,1.25,.35,1)', fill: 'both'};
      lock.style.pointerEvents = 'none';
      $('unlocked-screen').style.pointerEvents = 'none';
      unlockAnimations = [
        lock.animate([{transform:start.lock,opacity:start.opacity}, {transform:end.lock,opacity:complete?'0':'1'}], options),
        $('unlocked-screen').animate([{transform:start.home,opacity:start.homeOpacity}, {transform:end.home,opacity:complete?'1':'.7'}], options),
      ];
      const finish = () => {
        lock.style.pointerEvents = '';
        cancelUnlockMotion();
        if (complete) {
          lock.hidden = true;
          $('unlocked-screen').hidden = false;
          $('peek-screen').hidden = false;
          clearFeedback();
        } else $('unlocked-screen').hidden = true;
      };
      unlockTimer = setTimeout(finish, options.duration);
    }
    const rewindLock = $('time-lock');
    rewindLock.addEventListener('pointerdown', (event) => {
      if (session.screen !== 'time-lock' || !event.isPrimary || performance.now() < session.timeSuppressUntil) return;
      unlockDrag = {id:event.pointerId,y:event.clientY,distance:0,height:rewindLock.getBoundingClientRect().height,
        samples:[{y:event.clientY,at:performance.now()}],active:false};
    });
    rewindLock.addEventListener('pointermove', (event) => {
      const drag = unlockDrag;
      if (!drag || drag.id !== event.pointerId) return;
      drag.distance = Math.max(0, drag.y-event.clientY);
      if (!drag.active && drag.distance < 12) return;
      drag.active = true;
      session.timePointer = null;
      session.timeLastTap = null;
      rewindLock.setPointerCapture(event.pointerId);
      const now = performance.now();
      drag.samples.push({y:event.clientY,at:now});
      drag.samples = drag.samples.filter((sample) => now-sample.at <= 80);
      const pose = unlockPose(drag.distance, drag.height);
      $('unlocked-screen').hidden = false;
      rewindLock.style.transform = pose.lock;
      $('time-face').style.opacity = pose.opacity;
      $('unlocked-screen').style.transform = pose.home;
      $('unlocked-screen').style.opacity = pose.homeOpacity;
    });
    function finishUnlockDrag(event, cancelled = false) {
      const drag = unlockDrag;
      if (!drag || drag.id !== event.pointerId) return;
      unlockDrag = null;
      if (!drag.active) return;
      if (rewindLock.hasPointerCapture(event.pointerId)) rewindLock.releasePointerCapture(event.pointerId);
      const sample = drag.samples[0];
      const velocity = (sample.y-event.clientY)/Math.max(1,performance.now()-sample.at);
      const complete = !cancelled && unlockDragTarget(drag.distance,velocity,drag.height);
      if (complete) {
        session.screen = 'unlocked';
          cancelAnimationFrame(timeFrame);
        session.state = {...session.state, unlocked:true};
        renderAttempts();
        setHomePage('home1',false);
      }
      settleUnlockMotion(rewindLock,drag.distance,complete,drag.height);
    }
    rewindLock.addEventListener('pointerup', (event) => finishUnlockDrag(event));
    rewindLock.addEventListener('pointercancel', (event) => finishUnlockDrag(event,true));
    function interruptUnlockMotion() {
      if (unlockDrag || unlockAnimations.length) {
        clearTimeout(unlockTimer);
        cancelUnlockMotion();
        showScreen(session.screen);
      }
    }
    // Resolve the current logical screen before another gesture or viewport takes over.
    document.addEventListener('pointerdown', interruptUnlockMotion, {capture:true});
    window.addEventListener('resize', interruptUnlockMotion);
    window.addEventListener('orientationchange', interruptUnlockMotion);
    window.addEventListener('blur', interruptUnlockMotion);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        interruptUnlockMotion();
        // The drag fixture extracts this listener without the wake-lock helpers.
        if (typeof releaseWakeLock === 'function') releaseWakeLock();
      } else if (typeof acquireWakeLock === 'function') {
        acquireWakeLock();
      }
    });

    for (const id of ['time-black', 'time-lock']) {
      $(id).addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || performance.now() < session.timeSuppressUntil) { session.timePointer = null; return; }
        session.timePointer = {id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now()};
      });
      $(id).addEventListener('pointercancel', () => { session.timePointer = null; });
      $(id).addEventListener('pointerup', (event) => {
        const point = session.timePointer;
        session.timePointer = null;
        if (!point || point.id !== event.pointerId || performance.now() < session.timeSuppressUntil
            || performance.now() - point.at > 500 || Math.hypot(event.clientX-point.x,event.clientY-point.y)>12) return;
        if (session.screen === 'time-black') {
          const rect = $('time-black').getBoundingClientRect();
          const digit = hiddenDigit(event.clientX-rect.left,event.clientY-rect.top,rect.width,rect.height);
          if (digit === null) return;
          const entry = appendMinuteDigit(session.timeDigits, digit);
          session.timeDigits = entry.digits;
          if (entry.minutes === null) return;
          session.timeMinutes = entry.minutes; session.timeTriggeredAt = null; session.timeTriggeredWallAt = null;
          showScreen('time-lock');
        } else if (session.screen === 'time-lock' && session.timeTriggeredAt === null) {
          const now = performance.now();
          if (session.timeLastTap !== null && now - session.timeLastTap <= 450) { session.timeTriggeredAt = now; session.timeTriggeredWallAt = Date.now(); session.timeLastTap = null; }
          else session.timeLastTap = now;
        }
      });
    }

    $('settings-form').addEventListener('input', () => { updateUnlockControls(); applyAppearance(formSettings()); });

Object.assign(session, {
  stopRewindGuide, startRewindGuide, performanceWakeWanted, acquireWakeLock, releaseWakeLock,
  syncPerformanceWakeLock, showScreen, updateOneUiExtras, renderTimeMachine, cancelUnlockMotion,
  unlockPose, settleUnlockMotion, finishUnlockDrag, interruptUnlockMotion,
});
