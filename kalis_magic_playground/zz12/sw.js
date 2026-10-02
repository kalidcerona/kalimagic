const CACHE_PREFIX=`magic-memdeck-${self.registration.scope}-`;
const CACHE=`${CACHE_PREFIX}v20261003-install-2`;
const ASSETS=['./','./index.html','./style.css','./app.mjs','./core.mjs','./data.mjs','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'].map(path=>new URL(path,self.registration.scope).href);
const INDEX=new URL('index.html',self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
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
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  if(url.pathname===new URL('manifest.webmanifest',self.registration.scope).pathname){event.respondWith(caches.open(CACHE).then(cache=>freshManifest(event.request,cache)));return;}
  if(!ASSETS.includes(url.href)&&event.request.mode!=='navigate')return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&ASSETS.includes(url.href)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(()=>caches.open(CACHE).then(cache=>cache.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?cache.match(INDEX):Response.error())))));
});
