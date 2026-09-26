// Network-first cache for the ALETHEIA app shell only.
const CACHE_NAME = 'aletheia-shell-v5';
const LEGACY_CACHE_PREFIX = `unlock-${encodeURIComponent(self.registration.scope)}-`;

const SHELL = [
  './index.html',
  './style.css',
  './app.js',
  './logic.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './install-prompt.js',
  './brand-logo.jpg',
  './brand-logo.png',
];

const SHELL_NAMES = new Set([
  'index.html',
  'style.css',
  'app.js',
  'logic.js',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'install-prompt.js',
  'brand-logo.jpg',
  'brand-logo.png',
]);

function relativePath(rawUrl) {
  const url = new URL(rawUrl);
  if (!url.href.startsWith(self.registration.scope)) return null;
  return url.href.slice(self.registration.scope.length).split('#')[0].split('?')[0];
}

function isShellUrl(rawUrl) {
  const relative = relativePath(rawUrl);
  if (relative == null) return false;
  return relative === '' || SHELL_NAMES.has(relative);
}

function offlineResponse() {
  return new Response('오프라인 상태이며 저장된 화면이 없습니다.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function networkFirst(event) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(event.request);
    if (response && response.ok && !response.redirected) {
      try {
        await cache.put(event.request, response.clone());
      } catch {
        // Keep the fresh response even when the cache cannot be updated.
      }
    }
    return response;
  } catch {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    if (event.request.mode === 'navigate') {
      return (await cache.match('./index.html'))
        || (await cache.match('./'))
        || offlineResponse();
    }
    return offlineResponse();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => (
        (key.startsWith('aletheia-shell-') && key !== CACHE_NAME)
        || key.startsWith(LEGACY_CACHE_PREFIX)
      ))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!isShellUrl(event.request.url)) return;
  event.respondWith(networkFirst(event));
});
