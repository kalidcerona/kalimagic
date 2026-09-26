// Relative-scope shell cache. Network first, then this app's cached files.

const CACHE_PREFIX = 'tobira-shell-';
const CACHE_NAME = CACHE_PREFIX + 'v4';
const SHELL_NAMES = new Set([
  '',
  'index.html',
  'style.css',
  'app.js',
  'logic.js',
  'manifest.webmanifest',
  'icon.svg',
  'brand-logo.jpg',
  'brand-logo.png',
]);
const SHELL_URLS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './logic.js',
  './manifest.webmanifest',
  './icon.svg',
  './brand-logo.jpg',
  './brand-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function shellName(url) {
  const scopePath = new URL(self.registration.scope).pathname;
  let path = url.pathname;
  try {
    path = decodeURI(path);
  } catch {
    // Keep the raw pathname when decoding fails.
  }
  if (!path.startsWith(scopePath)) return null;
  let relative = path.slice(scopePath.length);
  if (relative.endsWith('/')) relative = relative.slice(0, -1);
  return relative;
}

function isShell(url) {
  const name = shellName(url);
  return name != null && SHELL_NAMES.has(name);
}

async function fromCache(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  if (request.mode !== 'navigate') return null;
  const indexUrl = new URL('./index.html', self.registration.scope).href;
  const index = await caches.match(indexUrl, { ignoreSearch: true });
  if (index) return index;
  const rootUrl = new URL('./', self.registration.scope).href;
  return caches.match(rootUrl, { ignoreSearch: true });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok && fresh.type !== 'opaque' && isShell(new URL(request.url))) {
      await cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await fromCache(request);
    if (cached) return cached;
    return new Response('오프라인 상태이며 저장된 화면이 없습니다.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (!url.href.startsWith(self.registration.scope)) return;
  event.respondWith(networkFirst(event.request));
});
