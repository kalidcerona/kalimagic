// Network-first cache for the ALETHEIA app shell only.
const CACHE_NAME = 'aletheia-shell-v11';
const CACHE_PREFIX = 'aletheia-shell-';
const LEGACY_CACHE_PREFIX = `unlock-${encodeURIComponent(self.registration.scope)}-`;
const COURT_FILES = ['S-J', 'S-Q', 'S-K', 'D-J', 'D-Q', 'D-K',
  'C-J', 'C-Q', 'C-K', 'H-J', 'H-Q', 'H-K']
  .map((code) => `./court-cards/${code}.png`);

const SHELL = [
  './index.html',
  './style.css',
  './app.js',
  './deck-loader.js',
  './logic.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './install-prompt.js',
  './brand-logo.jpg',
  './brand-logo.png',
];

const SHELL_NAMES = new Set([...SHELL, ...COURT_FILES].map((path) => path.slice(2)));

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
      event.waitUntil(cache.put(event.request, response.clone()).catch(() => {}));
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

async function cachedCourtCard(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request, { ignoreSearch: true });
  if (cached) return cached;
  return networkFirst(event);
}

async function migrateCourtCards(oldNames) {
  const current = await caches.open(CACHE_NAME);
  for (const name of oldNames) {
    const old = await caches.open(name);
    for (const file of COURT_FILES) {
      if (await current.match(file)) continue;
      const response = await old.match(file);
      if (response && response.ok) await current.put(file, response);
    }
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
    const oldShells = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    if (oldShells.length) await migrateCourtCards(oldShells);
    await Promise.all([...oldShells, ...keys.filter((key) => key.startsWith(LEGACY_CACHE_PREFIX))]
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!isShellUrl(event.request.url)) return;
  const relative = relativePath(event.request.url);
  event.respondWith(relative && relative.startsWith('court-cards/')
    ? cachedCourtCard(event)
    : networkFirst(event));
});
