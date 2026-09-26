// App-shell cache only. Non-shell responses are never stored.

const CACHE = "asrai-shell-v5";
const CACHE_PREFIX = "asrai-shell-";
const SHELL_FILES = [
  "index.html",
  "style.css",
  "contacts.js",
  "logic.js",
  "manifest.webmanifest",
  "install-ui.js",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "brand-logo.jpg",
  "brand-logo.png",
];

function shellUrls() {
  const scope = self.registration.scope;
  return [new URL("./", scope).href, ...SHELL_FILES.map((file) => new URL(file, scope).href)];
}

async function storeResponse(cache, request, response) {
  try {
    await cache.put(request, response.clone());
  } catch {
    const body = await response.clone().blob();
    await cache.put(
      request,
      new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }),
    );
  }
}

function relativePath(url) {
  const scopePath = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePath)) return null;
  return url.pathname.slice(scopePath.length);
}

function isShellRequest(url) {
  if (url.origin !== self.location.origin) return false;
  const relative = relativePath(url);
  if (relative == null) return false;
  return relative === "" || relative === "/" || SHELL_FILES.includes(relative);
}

async function cachedIndex() {
  const cache = await caches.open(CACHE);
  return (
    (await cache.match(new URL("index.html", self.registration.scope).href)) ||
    (await cache.match(new URL("./", self.registration.scope).href))
  );
}

async function networkThenShell(request, url) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok && fresh.type === "basic") {
      const cache = await caches.open(CACHE);
      await storeResponse(cache, request, fresh);
    }
    return fresh;
  } catch {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    if (
      request.mode === "navigate" ||
      url.pathname.endsWith("/") ||
      url.pathname.endsWith("/index.html")
    ) {
      const index = await cachedIndex();
      if (index) return index;
    }
    return new Response("offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        shellUrls().map(async (url) => {
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok) throw new Error("shell unavailable");
          await storeResponse(cache, url, response);
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
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (!isShellRequest(url)) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          if (request.mode === "navigate") {
            const index = await cachedIndex();
            if (index) return index;
          }
          return new Response("offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  event.respondWith(networkThenShell(request, url));
});
