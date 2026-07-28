const CACHE_NAME = "kali-calc-v2";
const CACHE_PREFIX = "kali-calc-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => APP_SHELL.reduce(
        (pending, path) => pending.then(async () => {
          const request = new Request(new URL(path, self.registration.scope), {
            cache: "reload"
          });
          const response = await fetch(request);
          if (isGateLoginResponse(response)) {
            await caches.delete(CACHE_NAME);
            return;
          }
          if (canCache(response)) await cache.put(request, response);
        }),
        Promise.resolve()
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

function isInScope(request) {
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
}

function canCache(response) {
  return response.ok &&
    response.status !== 302 &&
    !response.redirected &&
    response.type !== "opaque";
}

function isGateLoginResponse(response) {
  if (response.status === 302) return true;
  try {
    const pathname = new URL(response.url).pathname;
    return pathname === "/tools/login/" || pathname === "/tools/login";
  } catch {
    return false;
  }
}

async function networkFirstDocument(request) {
  try {
    const response = await fetch(request);
    if (isGateLoginResponse(response)) {
      await caches.delete(CACHE_NAME);
      return response;
    }
    if (response.status === 200 && canCache(response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match(
      new URL("./index.html", self.registration.scope)
    );
    if (fallback) return fallback;
    throw error;
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isGateLoginResponse(response)) {
    await caches.delete(CACHE_NAME);
    return response;
  }
  if (canCache(response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !isInScope(request)) return;

  event.respondWith(
    request.mode === "navigate" || request.destination === "document"
      ? networkFirstDocument(request)
      : cacheFirstAsset(request)
  );
});
