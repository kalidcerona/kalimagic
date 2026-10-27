// The build replaces this marker with SHA-256(game.data + shell sources).
const CACHE = "planb-d4e4df8002474b67efb49db4aeb195aa1d4c7e5612120e936bda1e4a26201000-6da84ceea3c9efd8a64602a54423ab829de087f96af85fddba4598ac7b1ad01e";
const SHELL = ["./", "index.html", "game.js", "love.js", "love.wasm", "game.data",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png"];
self.addEventListener("install", event => {
  // Keep the previous worker until every new file is cached. Activation waits
  // for old game tabs to close, so a running session never mixes two builds.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(url =>
    new Request(url, {cache: "reload"})))));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key =>
    key.startsWith("planb-") && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const key = event.request.mode === "navigate" ? new URL("index.html", self.registration.scope).href : event.request;
    return (await cache.match(key)) || fetch(event.request);
  }));
});
