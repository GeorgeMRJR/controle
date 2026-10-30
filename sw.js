const V = "nalinha-v1", A = ["./", "index.html", "app.js", "calc.js", "style.css", "manifest.webmanifest", "icon.svg"];
self.addEventListener("install", e => e.waitUntil(caches.open(V).then(c => c.addAll(A)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("nalinha-") && k !== V).map(k => caches.delete(k)))).then(() => clients.claim())));
self.addEventListener("fetch", e => { if (e.request.method === "GET" && new URL(e.request.url).origin === location.origin) e.respondWith(fetch(e.request).then(r => { if (r.status === 200) { const c = r.clone(); e.waitUntil(caches.open(V).then(x => x.put(e.request, c)).catch(() => {})); } return r; }).catch(() => caches.match(e.request))); });
