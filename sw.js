const V='eclass-v172',A=['./','index.html','manifest.json','logo.png','city-seal.jpg','icon-192.png','icon-512.png','icon-maskable-192.png','icon-maskable-512.png','apple-touch-icon.png','favicon-32.png','schools/tcc.png','inter.woff2'];
const O=['mammoth.min.js','pdf.min.js','pdf.worker.min.js','templates/eclass-dbme.xlsx'];
const T=5000; /* network timeout (ms) before falling back to the cache */
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(A).then(()=>Promise.allSettled(O.map(u=>c.add(u))))));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=V).map(x=>caches.delete(x)))).then(()=>clients.claim())));
const net=r=>Promise.race([fetch(r),new Promise((_,j)=>setTimeout(()=>j(new Error('timeout')),T))]);
self.addEventListener('fetch',e=>{const q=e.request,u=new URL(q.url);if(q.method!='GET'||u.origin!=location.origin)return;
 e.respondWith(net(q).then(r=>{if(r.ok&&r.type=='basic'){const c=r.clone();caches.open(V).then(x=>x.put(q,c))}return r})
  .catch(()=>caches.match(q).then(r=>r||(q.mode=='navigate'?caches.match('index.html'):Response.error()))))});
