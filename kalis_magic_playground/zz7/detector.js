import { openSettings } from "./controller.js";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
const localSettingsHost = typeof location !== 'undefined' && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
if (localSettingsHost && new URLSearchParams(location.search).get('local-preview') === '1') {
  window.addEventListener('magic-local-settings', () => {
    document.querySelector(".first-run-guide button")?.click();
    openSettings();
  });
  document.documentElement.dataset.localSettingsReady = 'true';
}
