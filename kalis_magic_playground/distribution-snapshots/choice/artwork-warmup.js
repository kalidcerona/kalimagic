import { choiceArtworkUrls, refreshVisibleOfflineReady } from './precheck.js';

// Fetching the artwork now lets the service worker keep it for offline use without slowing the install.
// Three tries, with a short bounded pause between them. A miss must not retry forever.
const ARTWORK_ATTEMPTS = 3;
const ARTWORK_BACKOFF_MS = 300;
let artworkWarmStarted = false;
let artworkWarmPending = 0;

function artworkWarmSettled() {
  artworkWarmPending -= 1;
  if (artworkWarmPending === 0) refreshVisibleOfflineReady();
}

function warmOneArtwork(url, attempt) {
  fetch(url, { cache: 'reload' }).then((response) => {
    if (!response || response.ok === false) throw new Error('artwork miss');
    artworkWarmSettled();
  }).catch(() => {
    if (attempt >= ARTWORK_ATTEMPTS) {
      artworkWarmSettled();
      return;
    }
    setTimeout(() => warmOneArtwork(url, attempt + 1), ARTWORK_BACKOFF_MS * attempt);
  });
}

function warmShellArtwork() {
  if (artworkWarmStarted || !navigator.serviceWorker?.controller) return;
  artworkWarmStarted = true;
  const urls = choiceArtworkUrls();
  artworkWarmPending = urls.length;
  if (!urls.length) {
    refreshVisibleOfflineReady();
    return;
  }
  urls.forEach((url) => warmOneArtwork(url, 1));
}

// Wait until a controller exists. ready covers a page that is already controlled;
// controllerchange covers the first claim. Neither path is a timed guess.
function armArtworkWarmup() {
  try {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker) return;
    const worker = navigator.serviceWorker;
    const kick = () => { if (worker.controller) warmShellArtwork(); };
    if (typeof worker.addEventListener === 'function') worker.addEventListener('controllerchange', kick);
    const ready = worker.ready;
    if (ready && typeof ready.then === 'function') ready.then(kick, () => {});
  } catch { /* A blocked worker must not stop the app. */ }
}

export { armArtworkWarmup };
