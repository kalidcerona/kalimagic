// Cache only the explicit app shell. API, authentication and user data stay on the network.
const CACHE_PREFIX = 'aletheia-shell-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE_NAME = CACHE_PREFIX + 'v20260928-1';
const SHELL = [
  "./settings-ui.js",
  "./settings-ui.css",
  "./index.html",
  "./fullscreen.js",
  "./style.css",
  "./app.js",
  "./deck-loader.js",
  "./logic.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./install-prompt.js",
  "./brand-logo.jpg",
  "./court-cards/S-J.png",
  "./court-cards/S-Q.png",
  "./court-cards/S-K.png",
  "./court-cards/D-J.png",
  "./court-cards/D-Q.png",
  "./court-cards/D-K.png",
  "./court-cards/C-J.png",
  "./court-cards/C-Q.png",
  "./court-cards/C-K.png",
  "./court-cards/H-J.png",
  "./court-cards/H-Q.png",
  "./court-cards/H-K.png"
];
const SHELL_NAMES = new Set(SHELL.map((file) => file.replace(/^\.\//, '')));
const GUARDED = new URL(self.registration.scope).pathname.startsWith('/tools/');

self.addEventListener('install', (event) => {
  // Reject installation unless the whole critical shell is stored.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL.map((file) => new Request(new URL(file, self.registration.scope).href, { cache: 'reload', redirect: 'error' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names
    .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
    .map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});
function shellName(rawUrl) {
  const url = new URL(rawUrl), scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return null;
  const name = url.pathname.slice(scope.pathname.length);
  return name === '' || SHELL_NAMES.has(name) ? name : null;
}
function unavailable() {
  return new Response('오프라인 상태이며 저장된 화면이 없습니다.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
async function refresh(request, cache) {
  const response = await fetch(request);
  if (response.ok && !response.redirected && response.type !== 'opaque') {
    const name = shellName(request.url);
    // Keep one canonical entry per asset even when install/version query strings change.
    await cache.put(new URL(name || 'index.html', self.registration.scope).href, response.clone());
  }
  return response;
}
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || shellName(request.url) === null) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const name = shellName(request.url);
    const page = name === '' || name === 'index.html';
    const cached = await cache.match(new URL(page ? 'index.html' : name, self.registration.scope).href, { ignoreSearch: true });
    // Friend distribution navigation must still reach the server entitlement gate.
    // Its cached HTML also runs the fail-closed /tools/_check before revealing the app.
    if (page && GUARDED) {
      try { return await refresh(request, cache); } catch { return cached || unavailable(); }
    }
    if (cached) {
      if (page) event.waitUntil(refresh(request, cache).catch(() => {}));
      return cached;
    }
    try { return await refresh(request, cache); } catch { return unavailable(); }
  })());
});
