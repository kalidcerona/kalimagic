// ALETHEIA settings, local storage, and performance surface.
import { MESSAGES } from './logic.js';
import { view, warmCourtDeck, boot, startBootPerformance } from './controller.js';
import { hideGestureGuide } from './gesture-guide.js';
import { setError } from './status.js';
import { openSettings } from './pointer.js';

boot().catch(() => {
  setError(MESSAGES.storageReadFailed);
}).then(startBootPerformance).catch(() => {
  setError('공연 화면을 준비하지 못했습니다. 저장된 데이터는 바꾸지 않았습니다.');
});
requestAnimationFrame(() => {
  if (view === 'settings') warmCourtDeck();
});
const localSettingsHost = typeof location !== 'undefined' && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
if (localSettingsHost && new URLSearchParams(location.search).get('local-preview') === '1') {
  window.addEventListener('magic-local-settings', () => {
    hideGestureGuide();
    openSettings();
  });
  document.documentElement.dataset.localSettingsReady = 'true';
}
