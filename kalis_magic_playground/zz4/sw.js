const CACHE = 'magic-choice-shell-v5';
const CACHE_PREFIX = 'magic-choice-shell-';
const ASSETS = [
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
  './brand-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    await cache.addAll(ASSETS);
    const index = await cache.match('./index.html');
    if (index) await cache.put('./', index.clone());
    await self.skipWaiting();
  }));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(async (keys) => {
    await Promise.all(keys.filter((key) => (
      (key.startsWith(CACHE_PREFIX) && key !== CACHE)
      || key.startsWith('stopwatch2-')
    )).map((key) => caches.delete(key)));
    await self.clients.claim();
  }));
});

function inOwnScope(url) {
  return url.href.startsWith(self.registration.scope);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!inOwnScope(url)) return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        await cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
