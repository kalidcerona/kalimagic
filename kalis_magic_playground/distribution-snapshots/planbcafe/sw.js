// The build replaces this marker with SHA-256(game.data + shell sources).
const CACHE = "planb-bd532cd70acc6643035e29037f921c619ff4bb586ea79dd2512b7080c51d9615-59fafbde95bd9b6a6299261d3d4c5067bf5850529b490d814fd754d896741abf";
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
