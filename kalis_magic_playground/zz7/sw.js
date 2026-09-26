/* App-shell cache only. Never store question sets or other user data. */
const CACHE = "usotsuki-shell-v6";
const CACHE_PREFIX = "usotsuki-shell-";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./detector.js",
  "./logic.js",
  "./manifest.webmanifest",
  "./install-prompt.js",
  "./icon-192.png",
  "./icon-512.png",
  "./icon.svg",
  "./brand-logo.jpg",
  "./brand-logo.png",
  "./sw.js",
];

const SHELL_PATHS = new Set([
  "/",
  "/index.html",
  "/style.css",
  "/detector.js",
  "/logic.js",
  "/manifest.webmanifest",
  "/install-prompt.js",
  "/icon-192.png",
  "/icon-512.png",
  "/icon.svg",
  "/brand-logo.jpg",
  "/brand-logo.png",
  "/sw.js",
]);

function shellPath(url) {
  if (url.origin !== self.location.origin) return null;
  const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
  let path = url.pathname;
  if (scopePath && (path === scopePath || path.startsWith(`${scopePath}/`))) {
    path = path.slice(scopePath.length) || "/";
  }
  if (!path.startsWith("/")) path = `/${path}`;
  if (path === "/index.html") return "/";
  return SHELL_PATHS.has(path) ? path : null;
}

async function cacheShell(request, response) {
  if (!response || !response.ok || response.type === "opaque") return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        FILES.map(async (url) => {
          try {
            await cache.add(url);
          } catch {
            /* A missing optional precache must not block the shell. */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!shellPath(url)) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) await cacheShell(request, fresh.clone());
        return fresh;
      } catch (error) {
        const cached =
          (await caches.match(request, { ignoreSearch: true })) ||
          (request.mode === "navigate" ? await caches.match("./index.html") : null);
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
