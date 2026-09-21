const CACHE_PREFIX = 'unlock-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE_NAME = CACHE_PREFIX + 'v7';
// ⚠️ cache.addAll 은 하나라도 실패하면 전체가 거부되어 오프라인이 통째로 깨진다.
//    배포본에 실제로 존재하는 파일만 넣을 것. selftest.mjs·README.md 는 배포하지 않는다.
const FILES = ['./index.html', './logic.js', './manifest.webmanifest', './sw.js',
  './icon-192.png', './icon-512.png', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(
    names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    if (event.request.mode === 'navigate') return cache.match('./index.html');
    return new Response('', { status: 404, statusText: 'Not cached' });
  }));
});
