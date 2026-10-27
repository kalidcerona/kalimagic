import './module-start.js';
import { hideGestureGuide } from './gesture-guide.js'; // local-preview-hook
import './controller.js';
import { showView } from './views.js'; // local-preview-hook
import { closeFakeHome } from './performance.js'; // local-preview-hook
import { installLocalPreview } from './local-preview.js'; // local-preview-hook

if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  const registration = navigator.serviceWorker.register('./sw.js', { scope: './' });
  registration.catch(() => {});
  globalThis.MagicUpdate?.init({ registrationPromise: registration, safe: () => document.body.dataset.view === 'settings' });
}
installLocalPreview(() => { hideGestureGuide(); closeFakeHome(); showView('home', { push: false }); }); // local-preview-hook
