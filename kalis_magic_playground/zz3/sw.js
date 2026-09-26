const SCOPE_URL = new URL(self.registration.scope);
const PREFIX = `calc2-${encodeURIComponent(SCOPE_URL.href)}-`;
const CACHE = `${PREFIX}v6`;
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon.svg",
  "./brand-logo.jpg",
  "./brand-logo.png",
].map((path) => new URL(path, SCOPE_URL).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name.startsWith(PREFIX) && name !== CACHE)
        .map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);
  if (
    request.method !== "GET" ||
    requestUrl.origin !== SCOPE_URL.origin ||
    !requestUrl.pathname.startsWith(SCOPE_URL.pathname)
  ) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        return await fetch(request);
      } catch {
        return cache.match(new URL("./index.html", SCOPE_URL).href);
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      try {
        await cache.put(request, response.clone());
      } catch (_) {}
    }
    return response;
  })());
});
