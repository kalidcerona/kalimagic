import { $, session } from './session.js';
import { normalizeSettings, lockScreenCopy, createState } from './logic.js';
import { resetTwoFingerTaps } from './gestures.js';

const showScreen = (...args) => session.showScreen(...args);
const refreshCroppedImages = (...args) => session.refreshCroppedImages(...args);
const displayImage = (...args) => session.displayImage(...args);
const openDB = (...args) => session.openDB(...args);
const readImage = (...args) => session.readImage(...args);
const setFilePickerState = (...args) => session.setFilePickerState(...args);
const showSettingsEntryTutorial = (...args) => session.showSettingsEntryTutorial(...args);
const updateOneUiExtras = (...args) => session.updateOneUiExtras(...args);
const SETTINGS_KEY = session.SETTINGS_KEY;
const originals = session.originals;
const imageKeys = session.imageKeys;

const REWIND_GUIDE_KEY = 'release.rewindGridGuide.v1';
const REWIND_CHARGING_KEY = 'release.rewindCharging.v1';
const REWIND_DND_KEY = 'release.rewindDnd.v1';

    function populateForm() {
      $('performance').value = session.settings.performance;
      $('time-delay').value = session.settings.timeDelay;
      $('birth-days-link').checked = session.settings.birthDaysLink;
      $('hitsuzen-link').disabled = !session.settings.birthDaysLink;
      if (!session.settings.birthDaysLink) $('hitsuzen-link-status').textContent = '자동 전달이 꺼져 있습니다. 체크하면 연동할 수 있습니다.';
      $('style').value = session.settings.style;
      $('digits').value = session.settings.digits;
      $('unlock-mode').value = session.settings.unlockMode;
      $('unlock-attempt').value = session.settings.unlockAttempt;
      $('reveal-attempt').value = session.settings.revealAttempt;
      $('vibration').checked = session.settings.vibration;
      $('delay').value = session.settings.delaySeconds;
      $('crop').value = session.settings.cropTop;
      $('position').value = session.settings.imagePosition;
      $('status-style').value = session.settings.statusStyle;
      $('status-color').value = session.settings.statusColor;
      updateUnlockControls();
    }

    function formSettings() {
      return normalizeSettings({ birthDaysLink: $('birth-days-link').checked, performance: $('performance').value, timeDelay: $('time-delay').value, timeDuration: session.settings.timeDuration, style: $('style').value, digits: Number($('digits').value), unlockMode: $('unlock-mode').value,
        unlockAttempt: $('unlock-attempt').value, revealAttempt: $('reveal-attempt').value, vibration: $('vibration').checked, delaySeconds: $('delay').value,
        cropTop: $('crop').value, imagePosition: $('position').value, statusStyle: $('status-style').value, statusColor: $('status-color').value });
    }

    function updateUnlockControls() {
      $('time-options').hidden = false;
      const attemptMode = $('unlock-mode').value === 'attempt';
      $('delay-field').hidden = attemptMode;
      $('attempt-field').hidden = !attemptMode;
      $('delay').disabled = attemptMode;
      $('unlock-attempt').disabled = !attemptMode;
    }

    function applyAppearance(value) {
      $('input-screen').classList.toggle('galaxy', value.style === 'galaxy');
      $('time-lock').classList.toggle('galaxy', value.style === 'galaxy');
      const previewCopy = lockScreenCopy(value.style, session.state.current.length > 0);
      for (const [element, text] of [[$('prompt'), previewCopy.prompt], [$('emergency').querySelector('span'), previewCopy.emergency]]) { element.dataset.magicNativeLabel = text; element.textContent = text; }
      $('delete').dataset.magicNativeLabel = lockScreenCopy(value.style, false).trailing;
      $('delete').dataset.magicCustomIdle = String(session.state.current.length === 0);
      $('delete').textContent = previewCopy.trailing;
      document.documentElement.style.setProperty('--status-color', value.statusColor);
      document.querySelector('meta[name="theme-color"]').content = value.statusColor;
      document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content = value.statusStyle;
      for (const id of ['lock-image', 'unlock-image', 'home2-image', 'time-wallpaper', 'lock-preview', 'unlock-preview', 'home2-preview']) {
        $(id).style.objectPosition = `50% ${value.imagePosition}%`;
      }
      for (const preview of document.querySelectorAll('.preview')) {
        const naturalHeight = Number(preview.dataset.naturalHeight);
        const percent = naturalHeight > 0 ? Math.min(100, value.cropTop / naturalHeight * 100) : 0;
        preview.querySelector('.crop-overlay').style.height = `${percent}%`;
        const handle = preview.querySelector('.crop-handle');
        handle.style.top = `${percent}%`;
        handle.setAttribute('aria-valuenow', String(value.cropTop));
      }
    }

    $('crop').addEventListener('change', refreshCroppedImages);
    $('settings-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (session.pendingImages > 0) return;
      session.settings = formSettings();
      $('start').disabled = true;
      try {
        await Promise.all(imageKeys.map((key) => displayImage(key, session.settings.cropTop)));
        applyAppearance(session.settings);
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(session.settings)); }
        catch { $('storage-status').textContent = '설정을 저장하지 못했습니다. 이번 실행에만 적용됩니다.'; }
        session.state = createState(session.settings.digits);
        resetTwoFingerTaps();
        session.timeTriggeredAt = null;
        session.timeDigits = [];
        // Explicit Start begins a new gesture sequence, outside the settings swipe.
        session.timeSuppressUntil = 0;
        showScreen('input');
      } catch { $('storage-status').textContent = '이미지 처리 실패. 잘라낼 높이와 이미지를 확인하세요.'; }
      finally { $('start').disabled = false; }
    });

    async function prepareOffline() {
      if (!('serviceWorker' in navigator)) {
        $('offline-status').textContent = '오프라인 저장 불가: 보안 연결 또는 localhost로 열어 주세요.';
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        const updateStatus = () => {
          if (navigator.serviceWorker.controller) $('offline-status').textContent = '오프라인 준비 완료 · 홈 화면에 추가한 뒤 비행기 모드에서 확인하세요.';
        };
        navigator.serviceWorker.addEventListener('controllerchange', updateStatus);
        const watch = (worker) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'redundant') $('offline-status').textContent = '오프라인 파일 저장 실패. 연결 상태를 확인하고 다시 여세요.';
            updateStatus();
          });
        };
        watch(registration.installing);
        registration.addEventListener('updatefound', () => watch(registration.installing));
        updateStatus();
      } catch { $('offline-status').textContent = '오프라인 준비 실패. 보안 연결 또는 localhost에서 다시 열어 주세요.'; }
    }

function boot() {
    try { $('rewind-grid-guide').checked = localStorage.getItem(REWIND_GUIDE_KEY) === '1'; } catch {}
    $('rewind-grid-guide').addEventListener('change', () => {
      try { localStorage.setItem(REWIND_GUIDE_KEY, $('rewind-grid-guide').checked ? '1' : '0'); } catch {}
    });
    for (const [id, key] of [['rewind-charging', REWIND_CHARGING_KEY], ['rewind-dnd', REWIND_DND_KEY]]) {
      try { $(id).checked = localStorage.getItem(key) === '1'; } catch {}
      $(id).addEventListener('change', () => {
        try { localStorage.setItem(key, $(id).checked ? '1' : '0'); } catch {}
        updateOneUiExtras();
      });
    }
    new MutationObserver(updateOneUiExtras).observe($('time-lock'), { attributes: true, attributeFilter: ['hidden'] });
    populateForm();
    applyAppearance(session.settings);
    // Performance does not depend on opening or decoding the image database.
    showScreen('input');
    showSettingsEntryTutorial();
    imageKeys.forEach((key) => { $(`${key}-info`).textContent = '기본 배경 사용 · 저장된 사진을 확인하는 중입니다.'; });
    prepareOffline();
    session.dbReady = openDB().then((connection) => {
      session.db = connection;
      session.db.onversionchange = () => { connection.close(); if (session.db === connection) session.db = null; };
      return connection;
    }).catch((error) => {
      $('storage-status').textContent = `이미지 저장소를 불러오지 못했습니다. ${error.message} 기본 배경으로 공연할 수 있습니다.`;
      return null;
    });
    void (async () => {
      try {
        if (!await session.dbReady) return;
        await Promise.all(imageKeys.map(async (key) => {
          const blob = await readImage(key);
          // An upload selected while startup was loading owns the newest value.
          if (blob && !originals.has(key)) {
            originals.set(key, blob);
            await displayImage(key, session.settings.cropTop, true);
          } else if (!blob && !originals.has(key)) {
            setFilePickerState(key, false);
            $(`${key}-info`).textContent = '기본 배경 사용 · 사진을 등록하면 이 기기에 저장됩니다.';
          }
        }));
        if (!session.pendingImages) $('storage-status').textContent = '기본 배경으로 바로 공연할 수 있습니다. 등록한 사진은 이 기기에만 저장됩니다.';
      } catch (error) {
        $('storage-status').textContent = `이미지 저장소를 불러오지 못했습니다. ${error.message} 기본 배경으로 공연할 수 있습니다.`;
      }
    })();
}
session.boot = boot;

Object.assign(session, {
  populateForm, formSettings, updateUnlockControls, applyAppearance, prepareOffline,
});
