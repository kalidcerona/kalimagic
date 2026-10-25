// Owner's computer only: opens settings from the local-preview page. Friend builds delete this file and the marked line that imports it.
export function installLocalPreview(openSettings) {
  const localSettingsHost = typeof location !== 'undefined' && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
  if (localSettingsHost && new URLSearchParams(location.search).get('local-preview') === '1') {
    window.addEventListener('magic-local-settings', () => openSettings());
    document.documentElement.dataset.localSettingsReady = 'true';
  }
}
