const CACHE='magic-qr-v2';
const ASSETS=['./','./index.html','./style.css','./app.mjs','./core.mjs','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./vendor/qrcodegen.js','./vendor/jsQR.js','./vendor/LICENSE-nayuki.txt','./vendor/LICENSE-jsqr.txt'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('magic-qr-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url);if(u.origin!==self.location.origin||!u.href.startsWith(self.registration.scope))return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));});
