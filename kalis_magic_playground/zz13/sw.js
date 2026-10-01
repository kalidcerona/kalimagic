const scope=new URL(self.registration.scope),PREFIX='magic-qr-'+encodeURIComponent(scope.href)+'-',CACHE=PREFIX+'v13';
const GUARDED=scope.pathname.startsWith('/tools/');
const ASSETS=['./','./index.html','./style.css','./brand-logo.png','./app.mjs','./core.mjs','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./vendor/qrcodegen.js','./vendor/jsQR.js','./vendor/LICENSE-nayuki.txt','./vendor/LICENSE-jsqr.txt'].filter(path=>!GUARDED||(path!=='./'&&path!=='./index.html'));
const STATIC=new Set(ASSETS.map(path=>new URL(path,scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url);if(u.origin!==scope.origin||!u.href.startsWith(scope.href)||u.pathname.includes('/_check')||u.pathname.includes('/api/')||!STATIC.has(u.href))return;event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(hit=>hit||fetch(event.request)));});
