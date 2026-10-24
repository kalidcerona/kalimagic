import { $, session } from './session.js';
import { FINGERPRINT_HOLD_MS, lockScreenCopy, pushDigit, submitPin, fingerprintHold, attemptFeedback, feedbackVibration, deleteDigit, clearCurrent, toggleDigits } from './logic.js';
import { registerEmergencyTap } from './time-machine.js';

const showScreen = (...args) => session.showScreen(...args);
const SETTINGS_KEY = session.SETTINGS_KEY;

let feedbackTimer = null;
let feedback = null;
let fingerprintTimer = null;
let fingerprintPress = null;
let toastTimer = null;

    function toast(message) {
      clearTimeout(toastTimer);
      $('toast').textContent = message;
      $('toast').hidden = false;
      toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2400);
    }

    function clearFeedback() {
      clearTimeout(feedbackTimer);
      feedback = null;
      $('dots').classList.remove('shake');
    }

    function renderInput() {
      $('input-screen').classList.toggle('galaxy', session.settings.style === 'galaxy');
      const copy = lockScreenCopy(session.settings.style, session.state.current.length > 0);
      $('prompt').dataset.magicNativeLabel = copy.prompt;
      $('prompt').textContent = copy.prompt;
      $('prompt').setAttribute('aria-label', `${copy.prompt}, ${session.state.digits === 4 ? 6 : 4}자리로 전환`);
      const count = feedback ? session.state.digits : session.state.current.length;
      $('dots').replaceChildren(...Array.from({ length: session.state.digits }, (_, i) => {
        const dot = document.createElement('span');
        dot.className = 'dot' + (i < count ? ' filled' : '');
        return dot;
      }));
      $('dots').setAttribute('aria-label', `${session.state.digits}자리 중 ${count}자리 입력`);
      $('emergency').querySelector('span').dataset.magicNativeLabel = copy.emergency;
      $('emergency').querySelector('span').textContent = copy.emergency;
      $('delete').dataset.magicNativeLabel = lockScreenCopy(session.settings.style, false).trailing;
      $('delete').dataset.magicCustomIdle = String(session.state.current.length === 0);
      $('delete').textContent = copy.trailing;
    }

    let lastBirthDays = null;
    function publishBirthDays(days) {
      if (!Number.isInteger(days)) return false;
      lastBirthDays = days;
      if (!session.settings.birthDaysLink) return false;
      try { return Boolean(window.MagicPerformanceLink?.write(localStorage, location.pathname, days)); } catch (_) { return false; }
    }

    $('birth-days-link').addEventListener('change', () => {
      session.settings.birthDaysLink = $('birth-days-link').checked;
      $('hitsuzen-link').disabled = !session.settings.birthDaysLink;
      let stored = false;
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(session.settings));
        stored = session.settings.birthDaysLink || Boolean(window.MagicPerformanceLink?.clear(localStorage, location.pathname));
      } catch (_) {}
      if (session.settings.birthDaysLink && lastBirthDays !== null) publishBirthDays(lastBirthDays);
      $('hitsuzen-link-status').textContent = !stored
        ? '설정을 저장하지 못했습니다. 브라우저의 저장 공간을 확인해 주세요.'
        : session.settings.birthDaysLink
          ? '생일을 입력하면 일수가 자동 전달됩니다. 연동 버튼으로 히츠젠을 열어 주세요.'
          : '자동 전달을 껐으며, 저장된 연동 일수도 지웠습니다.';
    });
    $('hitsuzen-link').addEventListener('click', () => {
      if (!session.settings.birthDaysLink) return;
      if (lastBirthDays !== null && !publishBirthDays(lastBirthDays)) {
        $('hitsuzen-link-status').textContent = '일수를 저장하지 못했습니다. 브라우저의 저장 공간을 확인해 주세요.';
        return;
      }
      location.assign(/^\/tools\/(?:unlock|release)(?:\/|$)/.test(location.pathname) ? '/tools/hitsuzen/' : '/zz3/');
    });

    function handleAttemptOutcome(previousCount) {
      const outcome = attemptFeedback(session.state, previousCount);
      const pattern = feedbackVibration(outcome, session.settings.vibration);
      if (pattern.length && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(pattern); } catch {}
      }
      if (outcome === 'success') {
        feedback = session.state.attempts.at(-1);
        renderInput();
        showScreen('unlocked', true);
        return true;
      }
      if (outcome === 'failure') {
        feedback = session.state.attempts.at(-1);
        $('dots').classList.add('shake');
        feedbackTimer = setTimeout(() => {
          clearFeedback();
          renderInput();
        }, 420);
      }
      renderInput();
      return outcome !== 'pending';
    }

    function inputDigit(digit) {
      if (session.screen !== 'input' || feedback) return;
      const previousCount = session.state.attempts.length;
      const autoSubmit = session.settings.style !== 'galaxy';
      const unlockAttempt = session.settings.unlockMode === 'attempt' ? session.settings.unlockAttempt : null;
      session.state = pushDigit(session.state, digit, performance.now(), session.settings.delaySeconds * 1000, autoSubmit, unlockAttempt);
      if (session.state.attempts.length > previousCount) handleAttemptOutcome(previousCount);
      else renderInput();
    }

    const letters = ['', '', 'abc', 'def', 'ghi', 'jkl', 'mno', 'pqrs', 'tuv', 'wxyz'];
    for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) {
      const key = document.createElement('button');
      key.type = 'button';
      key.className = 'key';
      key.dataset.digit = digit;
      key.setAttribute('aria-label', String(digit));
      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = digit;
      const alphabet = document.createElement('span');
      alphabet.className = 'letters';
      alphabet.textContent = letters[digit];
      key.append(number, alphabet);
      key.addEventListener('click', () => inputDigit(digit));
      $('keypad').append(key);
    }

    function addActionKey(action, label, svg) {
      const key = document.createElement('button');
      key.type = 'button';
      key.className = 'key galaxy-only';
      key.dataset.action = action;
      key.setAttribute('aria-label', label);
      key.innerHTML = svg;
      $('keypad').append(key);
      return key;
    }
    const backspaceKey = addActionKey('backspace', '한 자리 삭제', '<svg class="action-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M13 8h13a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H13L4 16l9-8Z"/><path d="m17 12 7 8m0-8-7 8"/></svg>');
    const confirmKey = addActionKey('confirm', 'PIN 확인', '<svg class="action-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="m7 16 6 6L26 9"/></svg>');

    $('prompt').addEventListener('click', () => {
      if (session.state.unlocked) return;
      clearFeedback();
      session.state = toggleDigits(session.state);
      renderInput();
    });
    function removeDigit() {
      if (feedback) return;
      session.state = session.state.current.length ? deleteDigit(session.state) : clearCurrent(session.state);
      renderInput();
    }
    $('delete').addEventListener('click', removeDigit);
    function enterRewindFullscreen() {
      const root = document.documentElement;
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!request || document.fullscreenElement || document.webkitFullscreenElement) return;
      try {
        const pending = request.call(root, { navigationUI: 'hide' });
        if (pending && typeof pending.catch === 'function') pending.catch(() => {});
      } catch (_) {}
    }

    function exitRewindFullscreen() {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) return;
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (!exit) return;
      try {
        const pending = exit.call(document);
        if (pending && typeof pending.catch === 'function') pending.catch(() => {});
      } catch (_) {}
    }

    function enterRewindStatusCover() {
      // Match the personal black safe-area paint and default status text at rewind entry.
      // The OS owns status-bar glyphs; CSS cannot draw over them.
      document.documentElement.style.setProperty('--status-color', '#000000');
      document.querySelector('meta[name="theme-color"]').content = '#000000';
      document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content = 'default';

    }

    $('emergency').addEventListener('click', (event) => {
      if (session.screen !== 'input' || session.settings.performance !== 'time-machine') return;
      const result = registerEmergencyTap(session.emergencyLastTap, performance.now());
      session.emergencyLastTap = result.lastTap;
      if (result.enter) {
        enterRewindFullscreen();
        enterRewindStatusCover();
        session.timeDigits = [];
        session.timeMinutes = 0;
        session.timeTriggeredAt = null;
        session.timeTriggeredWallAt = null;
        showScreen('time-black');
      }
    });
    backspaceKey.addEventListener('click', removeDigit);
    confirmKey.addEventListener('click', () => {
      if (session.screen !== 'input' || session.settings.style !== 'galaxy' || feedback) return;
      const previousCount = session.state.attempts.length;
      const unlockAttempt = session.settings.unlockMode === 'attempt' ? session.settings.unlockAttempt : null;
      session.state = submitPin(session.state, performance.now(), session.settings.delaySeconds * 1000, unlockAttempt);
      handleAttemptOutcome(previousCount);
    });

    function releaseFingerprint(pointerId, pulse) {
      clearTimeout(fingerprintTimer);
      fingerprintTimer = null;
      fingerprintPress = null;
      $('fingerprint').classList.remove('holding');
      if ($('fingerprint').hasPointerCapture(pointerId)) $('fingerprint').releasePointerCapture(pointerId);
      if (pulse) {
        $('fingerprint').classList.remove('pulse');
        void $('fingerprint').offsetWidth;
        $('fingerprint').classList.add('pulse');
      }
    }
    $('fingerprint').addEventListener('pointerdown', (event) => {
      if (session.screen !== 'input' || session.settings.style !== 'galaxy' || feedback || fingerprintPress) return;
      fingerprintPress = { pointerId: event.pointerId, startedAt: performance.now() };
      $('fingerprint').setPointerCapture(event.pointerId);
      $('fingerprint').classList.add('holding');
      fingerprintTimer = setTimeout(() => {
        if (!fingerprintPress) return;
        const previousCount = session.state.attempts.length;
        session.state = fingerprintHold(session.state, FINGERPRINT_HOLD_MS, performance.now());
        const pointerId = fingerprintPress.pointerId;
        releaseFingerprint(pointerId, false);
        handleAttemptOutcome(previousCount);
      }, FINGERPRINT_HOLD_MS);
      event.preventDefault();
    });
    $('fingerprint').addEventListener('pointerup', (event) => {
      if (!fingerprintPress || fingerprintPress.pointerId !== event.pointerId) return;
      releaseFingerprint(event.pointerId, true);
      event.preventDefault();
    });
    $('fingerprint').addEventListener('pointercancel', (event) => {
      if (fingerprintPress?.pointerId === event.pointerId) releaseFingerprint(event.pointerId, false);
    });
    $('fingerprint').addEventListener('contextmenu', (event) => event.preventDefault());

Object.assign(session, {
  toast, clearFeedback, renderInput, publishBirthDays,
  enterRewindFullscreen, exitRewindFullscreen, enterRewindStatusCover,
});
