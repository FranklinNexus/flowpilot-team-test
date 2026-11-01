const CACHE='flowpilot-team-test-github-2026-11-01-v1';
const BASE=new URL('./',self.location.href);
const FILES=['./','index.html','style.css','app.js','graph.js','journey.js','icon.svg','manifest.webmanifest','guide.html','guide.css','guide.js','scene-map.js','scene-map.css','vendor/three.module.js','vendor/OrbitControls.js','assets/materials/limestone-color.jpg','assets/materials/limestone-normal.jpg','assets/materials/limestone-rough.jpg'].map(path=>new URL(path,BASE).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('flowpilot-team-test-github-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok&&FILES.includes(url.href)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
  return response;
 }).catch(()=>caches.match(event.request)));
});

