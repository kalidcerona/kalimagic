// The build replaces this marker with SHA-256(game.data + shell sources).
const CACHE = "planb-35404ca2b97216a46e39c77e848c5a3a6d66fd7b97f33efd34dd7328bba713df-5e50f4a36eeb7905995d271e41ab1bb12cc40b629779998b4e91846165f6c1e8";
const SHELL = ["./", "index.html", "game.js", "love.js", "love.wasm", "game.data",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(url =>
    new Request(url, {cache: "reload"})))));
  if (!self.registration.active) self.skipWaiting();
});
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key =>
    key.startsWith("planb-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const key = event.request.mode === "navigate" ? new URL("index.html", self.registration.scope).href : event.request;
    return (await cache.match(key)) || fetch(event.request);
  }));
});
