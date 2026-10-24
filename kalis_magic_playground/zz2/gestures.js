import { $, session } from './session.js';
import { reset, clearCurrent, formatAttemptLabel, latestBirthdateAttempt, selectedAttemptReveal, homeSwipeTarget, completeHomeSwipe, peekOffset, registerTwoFingerTap, settleTwoFingerTaps } from './logic.js';
import { isSettingsSwipe, horizontalPeekOffset } from './time-machine.js';

const showScreen = (...args) => session.showScreen(...args);
const publishBirthDays = (...args) => session.publishBirthDays(...args);
const clearFeedback = (...args) => session.clearFeedback(...args);
const interruptUnlockMotion = (...args) => session.interruptUnlockMotion(...args);

let tapSequence = null;
let lockTapSequence = null;
let tapTimer = null;
let tapCandidate = null;
let swipe = null;
let homePage = 'home1';
let revealVisible = false;
let revealShownAt = null;
let revealHideTimer = null;
let settingsSwipe = null;

export function resetTwoFingerTaps() {
  tapSequence = null;
  clearTimeout(tapTimer);
}

function clearHomeSwipe() { swipe = null; }

    function renderAttempts() {
      const attempts = [...session.state.attempts].reverse();
      $('attempt-list').replaceChildren(...attempts.map((digits, reverseIndex) => {
        const index = session.state.attempts.length - reverseIndex - 1;
        const row = document.createElement('li');
        const pin = document.createElement('span');
        pin.className = 'attempt-pin';
        pin.textContent = formatAttemptLabel(digits, index, new Date());
        row.append(pin);
        return row;
      }));
      const birthdate = latestBirthdateAttempt(session.state.attempts, new Date());
      if (birthdate) publishBirthDays(birthdate.days);
      $('birthday-summary').hidden = !birthdate;
      $('birthday-summary').textContent = birthdate
        ? `${birthdate.attemptNumber}번째 ${birthdate.pin} · ${birthdate.days.toLocaleString('ko-KR')}일 · ${birthdate.zodiac} · ${birthdate.animal}`
        : '';
      requestAnimationFrame(() => { $('attempt-list').scrollTop = 0; });
    }

    function renderReveal() {
      const selected = selectedAttemptReveal(session.state.attempts, session.settings.revealAttempt, new Date());
      $('reveal-label').textContent = `${session.settings.revealAttempt}번째 입력 PIN`;
      $('reveal-number').textContent = selected?.pin ?? '-';
      $('reveal-days').hidden = selected?.days === null || selected?.days === undefined;
      if (selected?.days !== null && selected?.days !== undefined) {
        publishBirthDays(selected.days);
        $('reveal-days').textContent = `태어난 지 ${selected.days.toLocaleString('ko-KR')}일`;
      }
      $('reveal-zodiac').hidden = !selected?.zodiac;
      $('reveal-animal').hidden = !selected?.animal;
      $('reveal-zodiac').textContent = selected?.zodiac ?? '';
      $('reveal-animal').textContent = selected?.animal ?? '';
    }

    function setRevealVisible(visible) {
      if (visible === revealVisible) return;
      revealVisible = visible;
      if (visible) {
        clearTimeout(revealHideTimer);
        revealHideTimer = null;
        revealShownAt = performance.now();
        renderReveal();
      } else revealShownAt = null;
      $('reveal-card').classList.toggle('visible', visible);
      $('reveal-card').setAttribute('aria-hidden', String(!visible));
    }

    function cancelReveal() {
      clearTimeout(revealHideTimer);
      revealHideTimer = null;
      setRevealVisible(false);
    }

    function setHomePage(next, animate = true) {
      homePage = next;
      const index = next === 'home2' ? 1 : 0;
      const track = $('home-track');
      if (animate && track.style.transition === 'none') void track.offsetWidth;
      track.style.transition = animate ? '' : 'none';
      track.style.transform = `translate3d(${-index * 100}%, 0, 0)`;
    }

    function gestureAction(action) {
      if (!action) return;
      clearFeedback();
      if (action === 'reset') { session.state = reset(session.state); session.timeDigits = []; session.timeTriggeredAt = null; showScreen('input'); }
      if (action === 'settings') { session.state = clearCurrent(session.state); showScreen('settings'); }
    }

    function finishTap() {
      const now = performance.now();
      const expired = settleTwoFingerTaps(tapSequence, now);
      tapSequence = expired.sequence;
      gestureAction(expired.action);
      const result = registerTwoFingerTap(tapSequence, now, session.screen);
      tapSequence = result.sequence;
      if (result.action !== 'settings') gestureAction(result.action);
      clearTimeout(tapTimer);
      if (tapSequence) {
        tapTimer = setTimeout(() => {
          const result = settleTwoFingerTaps(tapSequence, performance.now());
          tapSequence = result.sequence;
          gestureAction(result.action);
        }, Math.max(0, tapSequence.startedAt + 1200 - now) + 1);
      }
    }

    function returnSwipe(keepBriefReveal = false) {
      $('unlocked-screen').classList.add('returning');
      $('unlocked-screen').style.transform = 'translateY(0px)';
      $('peek-screen').classList.remove('side-peek');
      setHomePage(homePage);
      swipe = null;
      if (keepBriefReveal && revealVisible && revealShownAt !== null) {
        const remaining = Math.max(0, 500 - (performance.now() - revealShownAt));
        revealHideTimer = setTimeout(cancelReveal, remaining);
      } else cancelReveal();
    }

    document.addEventListener('touchstart', (event) => {
      if (session.screen === 'settings') return;
      if (event.touches.length === 2) {
        cancelReveal();
        settingsSwipe = Array.from(event.touches, (t) => ({id:t.identifier,x:t.clientX,y:t.clientY}));
        session.timePointer = null;
        session.timeLastTap = null;
        session.timeSuppressUntil = performance.now() + 800;
        event.preventDefault();
        returnSwipe();
        interruptUnlockMotion();
        tapCandidate = {
          startedAt: performance.now(), valid: true,
          points: Array.from(event.touches, (t) => ({ id: t.identifier, x: t.clientX, y: t.clientY })),
        };
      } else if (event.touches.length > 2) {
        settingsSwipe = null;
        if (tapCandidate) tapCandidate.valid = false;
        returnSwipe();
      } else if (session.screen === 'unlocked' && event.touches.length === 1) {
        cancelReveal();
        const touch = event.touches[0];
        swipe = { id: touch.identifier, x: touch.clientX, y: touch.clientY, axis: null };
        $('unlocked-screen').classList.remove('returning');
      }
    }, { passive: false });

    document.addEventListener('touchmove', (event) => {
      if (session.screen === 'settings') return;
      if (settingsSwipe && event.touches.length === 2 && isSettingsSwipe(settingsSwipe,
          Array.from(event.touches, (t) => ({id:t.identifier,x:t.clientX,y:t.clientY})))) {
        event.preventDefault();
        settingsSwipe = null;
        tapCandidate = null;
        tapSequence = null;
        clearTimeout(tapTimer);
        gestureAction('settings');
        return;
      }
      if (tapCandidate) {
        for (const touch of event.touches) {
          const start = tapCandidate.points.find((p) => p.id === touch.identifier);
          if (!start || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) tapCandidate.valid = false;
        }
        event.preventDefault();
      }
      if (swipe && event.touches.length === 1) {
        const touch = event.touches[0];
        if (touch.identifier !== swipe.id) return;
        event.preventDefault();
        const dx = touch.clientX - swipe.x, dy = touch.clientY - swipe.y;
        if (!swipe.axis && Math.hypot(dx, dy) >= 10) swipe.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (swipe.axis === 'x') {
          const reveal = homeSwipeTarget(homePage, dx, dy, true, false, $('app').clientWidth).revealVisible;
          if (reveal) setRevealVisible(true);
          else cancelReveal();
          const index = homePage === 'home2' ? 1 : 0;
          const width = $('app').clientWidth;
          const drag = Math.max(index === 0 ? -width : 0,
            Math.min(index === 1 ? width : 0, dx));
          $('home-track').style.transition = 'none';
          $('home-track').style.transform = `translate3d(calc(${-index * 100}% + ${drag}px), 0, 0)`;
          return;
        }
        $('peek-screen').classList.toggle('side-peek', swipe.axis === 'x');
        const offset = swipe.axis === 'x'
          ? horizontalPeekOffset(swipe.x, touch.clientX, $('app').clientWidth)
          : peekOffset(swipe.y, touch.clientY, $('app').clientHeight);
        $('unlocked-screen').style.transform = swipe.axis === 'x' ? `translateX(${offset}px)` : `translateY(${offset}px)`;
      }
    }, { passive: false });

    document.addEventListener('touchend', (event) => {
      if (session.screen === 'settings') return;
      if (tapCandidate) {
        event.preventDefault();
        for (const touch of event.changedTouches) {
          const start = tapCandidate.points.find((p) => p.id === touch.identifier);
          if (!start || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) tapCandidate.valid = false;
        }
        if (event.touches.length === 0) {
          const valid = tapCandidate.valid && performance.now() - tapCandidate.startedAt <= 300;
          tapCandidate = null;
          if (valid) finishTap();
        }
      }
      if (swipe) {
        let keepBriefReveal = false;
        if (event.changedTouches.length === 1) {
          const touch = event.changedTouches[0];
          if (touch.identifier === swipe.id) {
            const dx = touch.clientX - swipe.x;
            const dy = touch.clientY - swipe.y;
            const releaseTarget = homeSwipeTarget(homePage, dx, dy,
              true, false, $('app').clientWidth);
            if (releaseTarget.revealVisible) setRevealVisible(true);
            const target = completeHomeSwipe(homePage, dx, dy,
              true, $('app').clientWidth);
            if (!target.peek) homePage = target.page;
            keepBriefReveal = releaseTarget.revealVisible && homePage === 'home2';
          }
        }
        returnSwipe(keepBriefReveal);
      }
    }, { passive: false });
    document.addEventListener('touchcancel', () => { settingsSwipe = null; session.timePointer = null; tapCandidate = null; returnSwipe(); });
    window.addEventListener('blur', () => { tapCandidate = null; returnSwipe(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { tapCandidate = null; returnSwipe(); }
    });
    window.addEventListener('pagehide', () => { tapCandidate = null; returnSwipe(); });

Object.assign(session, {
  renderAttempts, renderReveal, setRevealVisible, cancelReveal, setHomePage, clearHomeSwipe,
});
