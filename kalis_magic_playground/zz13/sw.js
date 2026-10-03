const scope=new URL(self.registration.scope),PREFIX='magic-qr-'+encodeURIComponent(scope.href)+'-',CACHE=PREFIX+'v20261004-contact-2';
const GUARDED=scope.pathname.startsWith('/tools/');
const ASSETS=['./','./index.html','./style.css','./brand-logo.png','./app.mjs','./core.mjs','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./vendor/qrcodegen.js','./vendor/jsQR.js','./vendor/LICENSE-nayuki.txt','./vendor/LICENSE-jsqr.txt'].filter(path=>!GUARDED||(path!=='./'&&path!=='./index.html'));
const STATIC=new Set(ASSETS.map(path=>new URL(path,scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
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
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url);if(u.origin!==scope.origin||!u.href.startsWith(scope.href)||u.pathname.includes('/_check')||u.pathname.includes('/api/'))return;if(u.pathname===new URL('manifest.webmanifest',scope).pathname){event.respondWith(caches.open(CACHE).then(cache=>freshManifest(event.request,cache)));return;}if(!STATIC.has(u.href))return;event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(hit=>hit||fetch(event.request)));});
