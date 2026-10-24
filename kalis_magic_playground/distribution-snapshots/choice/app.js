import './module-start.js';
import { hideGestureGuide } from './gesture-guide.js';
import './controller.js';
import { showView } from './views.js';
import { closeFakeHome } from './performance.js';

if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}
const localSettingsHost = typeof location !== 'undefined' && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
if (localSettingsHost && new URLSearchParams(location.search).get('local-preview') === '1') {
  window.addEventListener('magic-local-settings', () => {
    hideGestureGuide();
    closeFakeHome(); showView('home', { push: false });
  });
  document.documentElement.dataset.localSettingsReady = 'true';
}
