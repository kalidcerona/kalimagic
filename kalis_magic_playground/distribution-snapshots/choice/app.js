import './module-start.js';
import './controller.js';

if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}
