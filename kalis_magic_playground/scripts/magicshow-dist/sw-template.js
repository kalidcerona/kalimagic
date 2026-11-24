// Cache only the explicit app shell. API, authentication and user data stay on the network.
const CACHE_PREFIX = 'magicshow-dist-';
const CACHE_NAME = CACHE_PREFIX + '__VERSION__-coherent-1-distribution';
const SHELL = [
  "./index.html",
  "./style.css",
  "./portrait.css",
  "./app.mjs",
  "./core.mjs",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];
const SHELL_NAMES = new Set(SHELL.map((file) => file.replace(/^\.\//, '')));
// Art and fonts are optional: store the executable shell first, then warm these in the background.
const ART = SHELL.filter(file => /^\.\/(?:assets|fonts)\//.test(file));
const CRITICAL = SHELL.filter(file => !ART.includes(file));
const GUARDED = new URL(self.registration.scope).pathname.startsWith('/tools/');
// Include scope in new cache ownership; retain the known legacy cache only at its original scope.
const SCOPED_CACHE = CACHE_NAME + '-' + encodeURIComponent(new URL(self.registration.scope).pathname);
let artPending = null, artAbort = null, artCursor = 0, activating = false;
function abortArt() { artAbort?.abort(); }
async function fetchBounded(url, consume) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  const parent = artAbort;
  const abort = () => controller.abort();
  parent?.signal.addEventListener('abort', abort, { once: true });
  try {
    if (parent?.signal.aborted) controller.abort();
    const response = await fetch(new Request(url, { cache: 'reload', redirect: 'error', signal: controller.signal }));
    if (!response.ok || response.redirected || response.type === 'opaque' || response.status === 206) throw new Error('Invalid art response');
    await consume(response);
  } finally {
    clearTimeout(timer);
    parent?.signal.removeEventListener('abort', abort);
  }
}
function precacheArt(source) {
  // Legacy PRECACHE_ART is intentionally ignored. Only a new, idle controlling page requests batches.
  if (activating || self.registration.waiting || self.registration.installing) return Promise.resolve();
  if (artPending) return artPending;
  artAbort = new AbortController();
  artPending = (async () => {
    const cache = await caches.open(SCOPED_CACHE);
    for (let count = 0; count < 4 && artCursor < ART.length && !artAbort.signal.aborted; count++) {
      const file = ART[artCursor++];
      try {
        const url = new URL(file, self.registration.scope).href;
        if (!await cache.match(url)) await fetchBounded(url, response => cache.put(url, response));
      } catch (error) { console.warn('Magicshow optional art deferred:', file, error); }
    }
  })().catch(error => console.warn('Magicshow art cache unavailable:', error)).finally(() => {
    const aborted = artAbort.signal.aborted;
    const remaining = !aborted && artCursor < ART.length;
    if (aborted || artCursor >= ART.length) artCursor = 0;
    artPending = null;
    artAbort = null;
    source?.postMessage({ type: 'MAGICSHOW_ART_BATCH', remaining });
  });
  return artPending;
}
async function verifyDeployment() {
  // Generated releases include sw.js. Its embedded identity pins the deployment
  // on both sides of the shell download; a deployment change rejects installation.
  if (!SHELL_NAMES.has('sw.js')) return;
  const response = await fetch(new Request(new URL('sw.js', self.registration.scope).href, { cache: 'no-store', redirect: 'error' }));
  const declaration = "const CACHE_NAME = CACHE_PREFIX + '" + CACHE_NAME.slice(CACHE_PREFIX.length) + "';";
  if (!response.ok || response.redirected || !(await response.text()).includes(declaration)) {
    throw new Error('Release changed; update needed');
  }
}
let installProgress = { type: 'MAGICSHOW_UPDATE_PROGRESS', done: 0, total: CRITICAL.length, failed: false };
async function reportInstall() {
  // Progress delivery must never decide whether a release can install.
  try {
    const progress = { ...installProgress };
    const windows = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const client of windows) client.postMessage(progress);
  } catch {}
}
self.addEventListener('install', event => {
  // Updates remain waiting until the player accepts, or all existing clients close.
  event.waitUntil((async () => {
    const cache = await caches.open(SCOPED_CACHE);
    // Legacy and modern controllers follow the same atomic shell installation.
    // Failure leaves the previous complete release available for offline launch.
    const files = CRITICAL;
    installProgress.total = Math.max(1, files.length);
    let next = 0, failure = null, lastReport = Date.now();
    await reportInstall();
    const download = async () => {
      while (!failure && next < files.length) {
        const file = files[next++];
        try {
          const url = new URL(file, self.registration.scope).href;
          const response = await fetch(new Request(url, { cache: 'reload', redirect: 'error' }));
          if (!response.ok || response.redirected || response.type === 'opaque' || response.status === 206 || response.headers.get('Vary') === '*') throw new Error('Invalid shell response');
          await cache.put(url, response);
          installProgress.done++;
          if (!failure && installProgress.done < files.length && Date.now() - lastReport >= 100) {
            lastReport = Date.now();
            await reportInstall();
          }
        } catch (error) { failure = failure || error; }
      }
    };
    // Check the deployed worker before and after downloading. A changed release
    // cannot activate or retain the partial cache; the previous controller stays usable.
    try {
      await verifyDeployment();
      // Drain in-flight writes before removing an incomplete release's cache.
      await Promise.all(Array.from({ length: Math.min(6, files.length) }, download));
      if (!failure) await verifyDeployment();
    } catch (error) { failure = failure || error; }
    if (failure) {
      installProgress.failed = true;
      await reportInstall();
      await caches.delete(SCOPED_CACHE);
      throw failure;
    }
    await reportInstall();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'GET_UPDATE_PROGRESS') event.source?.postMessage({ ...installProgress });
  if (event.data?.type === 'GET_RELEASE') {
    const release = { type: 'MAGICSHOW_RELEASE', release: SCOPED_CACHE };
    (event.ports?.[0] || event.source)?.postMessage(release);
  }
  if (event.data?.type === 'ABORT_ART') abortArt();
  if (event.data?.type === 'SKIP_WAITING') { abortArt(); event.waitUntil(self.skipWaiting()); }
  if (event.data?.type === 'WARM_ART_BATCH') event.waitUntil(precacheArt(event.source));
});
self.addEventListener('activate', event => {
  activating = true;
  abortArt();
  event.waitUntil((async () => {
    try {
      const scope = new URL(self.registration.scope).pathname;
      const suffix = '-' + encodeURIComponent(scope);
      const names = await caches.keys();
      await Promise.all(names.filter(name => name !== SCOPED_CACHE && name.startsWith(CACHE_PREFIX) &&
        (name.endsWith(suffix) || (scope === '/tools/magicshow/' && /^magicshow-dist-[a-f0-9]+-coherent-1-distribution$/.test(name))))
        .map(name => caches.delete(name)));
    } catch (error) { console.warn('Magicshow old cache cleanup deferred:', error); }
    // Quota/cache cleanup failures must never strand a player on the old controller.
    await self.clients.claim();
    activating = false;
  })());
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
    const cache = await caches.open(SCOPED_CACHE);
    const name = shellName(request.url);
    if (name === 'manifest.webmanifest') return freshManifest(request, cache);
    const page = name === '' || name === 'index.html' || name.endsWith('.html');
    const executable = page || /\.(?:js|mjs|css)$/.test(name);
    const cached = await cache.match(new URL(name === '' ? 'index.html' : name, self.registration.scope).href, { ignoreSearch: true });
    // Public beta navigation stays coherent with this release's cached runtime.
    if (page && GUARDED && cached) return cached;
    if (executable) {
      if (cached) return cached;
      // A cache miss has no release-pinned bytes. Never mix a later deployment
      // into this release, even transiently; ask for a complete replacement.
      event.waitUntil(Promise.resolve().then(() => self.registration.update?.()).catch(() => {}));
      return page ? unavailable() : Response.error();
    }
    if (cached) return cached;
    try { return await refresh(request, cache); } catch { return unavailable(); }
  })());
});
