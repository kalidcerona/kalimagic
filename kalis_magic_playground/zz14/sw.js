const CACHE = "pimax-practice-v20261005-7";
const CORE = ["./", "./index.html", "./style.css", "./app.mjs", "./core.mjs", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("pimax-practice-") && key !== CACHE && key.endsWith("-distribution") === CACHE.endsWith("-distribution")).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
 const request = event.request; const url = new URL(request.url);
 if (request.method !== "GET" || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
 event.respondWith(fetch(request).then(response => {
   if (response.ok && !response.redirected && response.type === "basic") {
     const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
   }
   return response;
 }).catch(() => caches.match(request).then(cached => cached || (request.mode === "navigate" ? caches.match(new URL("index.html", self.registration.scope)) : Response.error()))));
});
