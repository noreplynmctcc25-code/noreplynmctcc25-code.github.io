const V='eclass-v230',A=['./','index.html','gradu-voice.wav','manifest.json','logo.png','city-seal.jpg','icon-192.png','icon-512.png','icon-maskable-192.png','icon-maskable-512.png','apple-touch-icon.png','favicon-32.png','schools/tcc.png','inter.woff2','fraunces-latin.woff2','fraunces-latin-ext.woff2','scanner/index.html','scanner/manifest.json','scanner/app.css','scanner/scanner.css','scanner/storage.js','scanner/app.js','scanner/tools.js','scanner/scanner-engine.js','scanner/sw.js'];
const O=['mammoth.min.js','pdf.min.js','pdf.worker.min.js','templates/eclass-dbme.xlsx'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(A).then(()=>Promise.allSettled(O.map(u=>c.add(u))))));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=V).map(x=>caches.delete(x)))).then(()=>clients.claim())));
/* v185: stale-while-revalidate. The saved copy opens at once (no waiting on a slow connection); a fresh copy is fetched in the background and used next launch. */
self.addEventListener('fetch',e=>{const q=e.request,u=new URL(q.url);if(q.method!='GET'||u.origin!=location.origin)return;
 e.respondWith(caches.open(V).then(async c=>{const hit=await c.match(q,{ignoreSearch:q.mode=='navigate'}),
  fresh=fetch(q).then(r=>{if(r.ok&&r.type=='basic')c.put(q,r.clone());return r}).catch(()=>null);
  if(hit){e.waitUntil(fresh.then(async r=>{if(!r||q.mode!='navigate')return;const a=hit.headers.get('etag'),b=r.headers.get('etag');if(a&&b&&a!=b)(await clients.matchAll()).forEach(x=>x.postMessage({t:'upd'}))}));return hit}
  const r=await fresh;return r||(q.mode=='navigate'?c.match('index.html'):Response.error())}))});
