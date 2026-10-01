const CACHE_PREFIX=`magic-memdeck-${self.registration.scope}-`;
const CACHE=`${CACHE_PREFIX}v5`;
const ASSETS=['./','./index.html','./style.css','./app.mjs','./core.mjs','./data.mjs','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'].map(path=>new URL(path,self.registration.scope).href);
const INDEX=new URL('index.html',self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  if(!ASSETS.includes(url.href)&&event.request.mode!=='navigate')return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&ASSETS.includes(url.href)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(()=>caches.open(CACHE).then(cache=>cache.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?cache.match(INDEX):Response.error())))));
});
