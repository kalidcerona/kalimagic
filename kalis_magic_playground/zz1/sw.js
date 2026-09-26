const PREFIX = "stopwatch-uni-" + encodeURIComponent(self.registration.scope) + "-";
const CACHE = PREFIX + "v21";
const FILES = [
  './index.html',
  './logic.js',
  './manifest.webmanifest',
  './sw.js',
  './icon-192.png',
  './icon-512.png',
  './icon.svg',
  './brand-logo.jpg',
  './brand-logo.png',
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith(PREFIX) && name !== CACHE).map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(self.registration.scope)) return;
  if (request.mode === "navigate") { event.respondWith(fetch(request).catch(() => caches.open(CACHE).then((cache) => cache.match("./index.html")))); return; }
  event.respondWith(caches.open(CACHE).then((cache) => cache.match(request)).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone())).catch(() => {});
    return response;
  })));
});
