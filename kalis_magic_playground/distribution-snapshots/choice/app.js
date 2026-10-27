import './module-start.js';
import './controller.js';

if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  const registration = navigator.serviceWorker.register('./sw.js', { scope: './' });
  registration.catch(() => {});
  globalThis.MagicUpdate?.init({ registrationPromise: registration, safe: () => document.body.dataset.view === 'settings' });
}
