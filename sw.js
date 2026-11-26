/* sw.js — lets the platform install as a phone app and open an offline notice.
   Network first for everything: records always come live from Firebase, and the cache is only a fallback
   for the page shell when there is no connection. Cross-origin requests (Firebase, Google) are never touched. */
const CACHE='sahafa-shell-v2';
const SHELL=['./offline.html','./design-system.css','./ui-polish.css','./assets/sahafa-school-logo.jpeg','./assets/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    // no-store: an installed app always opens the latest published page, never a stale HTTP-cached copy.
    e.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match('./offline.html')));
    return;
  }
  // no-cache: revalidate every file with the server (cheap 304 when unchanged) so updates show at once.
  e.respondWith(fetch(req,{cache:'no-cache'}).then(res=>{
    if(res.ok&&SHELL.some(p=>url.pathname.endsWith(p.slice(1)))){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}
    return res;
  }).catch(()=>caches.match(req)));
});
