// Cache only the explicit app shell. API, authentication and user data stay on the network.
const CACHE_PREFIX = 'tobira-shell-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE_NAME = CACHE_PREFIX + 'v20261004-first-guide-1-manual-install-1-perf-1-coherent-1-img-1-compat-1-wake-1';
const SHELL = [
  "./settings-ui.js",
  "./settings-ui.css",
  "./index.html",
  "./style.css",
  "./app.js",
  "./logic.js",
  "./sensor-motion.js",
  "./manifest.webmanifest",
  "./install-prompt.js",
  "./icon-192.png",
  "./icon-512.png",
  "./icon.svg",
  "./brand-logo.jpg",
  "./coin-kennedy.webp",
  "./coin-500won.webp",
  "./card-rider-red.jpg",
  "./card-rider-blue.jpg"
];
const SHELL_NAMES = new Set(SHELL.map((file) => file.replace(/^\.\//, '')));
const GUARDED = new URL(self.registration.scope).pathname.startsWith('/tools/');

self.addEventListener('install', (event) => {
  // Reject installation unless the whole critical shell is stored.
  // A later version stays waiting until every client of this app has closed, so the next launch applies it.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL.map((file) => new Request(new URL(file, self.registration.scope).href, { cache: 'reload', redirect: 'error' })))).then(() => { if (!self.registration.active) return self.skipWaiting(); }));
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
// Installation metadata must not remain stale while the performance shell stays cached.
async function freshManifest(request, cache) {
  const canonical = new URL('manifest.webmanifest', self.registration.scope).href;
  const cached = await cache.match(canonical, { ignoreSearch: true });
  try {
    const response = await fetch(new Request(request, { cache: 'no-store', redirect: 'error' }));
    const type = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!response.ok || response.redirected || response.type === 'opaque' ||
        (response.url && new URL(response.url).origin !== new URL(self.registration.scope).origin) ||
        !/^application\/(?:manifest\+json|json)$/.test(type)) throw new Error('Invalid manifest response');
    const manifest = await response.clone().json();
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) ||
        typeof manifest.start_url !== 'string' ||
        !(typeof manifest.name === 'string' || typeof manifest.short_name === 'string') ||
        new URL(manifest.start_url, canonical).origin !== new URL(self.registration.scope).origin) {
      throw new Error('Invalid manifest metadata');
    }
    // Cache writes are optional; a quota failure must not replace fresh metadata with stale metadata.
    await cache.put(canonical, response.clone()).catch(() => {});
    return response;
  } catch {
    return cached || Response.error();
  }
}
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || shellName(request.url) === null) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const name = shellName(request.url);
    if (name === 'manifest.webmanifest') return freshManifest(request, cache);
    const page = name === '' || name === 'index.html' || name.endsWith('.html');
    const executable = page || /\.(?:js|mjs|css)$/.test(name);
    const cached = await cache.match(new URL(name === '' ? 'index.html' : name, self.registration.scope).href, { ignoreSearch: true });
    // Friend distribution navigation serves this release's cached index.html, the same as a personal app.
    // That is safe: the cached HTML still runs the injected /tools/_check entitlement script before revealing anything,
    // and the edge gate still protects every network fetch.
    if (page && GUARDED && cached) return cached;
    if (executable) {
      if (cached) return cached;
      try { return await fetch(request); } catch { return page ? unavailable() : Response.error(); }
    }
    if (cached) return cached;
    try { return await refresh(request, cache); } catch { return unavailable(); }
  })());
});
