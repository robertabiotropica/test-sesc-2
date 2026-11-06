/* Roteiro · guarda o site no aparelho para abrir sem internet. */
const VERSAO = "roteiro-v2";
const BASE = ["/evento", "/", "/assets/app.js", "/assets/style.css", "/favicon.svg", "/icons/icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => Promise.all(BASE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function redePrimeiro(req, reserva) {
  const cache = await caches.open(VERSAO);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(req)) || (reserva && (await cache.match(reserva))) || Response.error();
  }
}
async function cacheAtualiza(req) {
  const cache = await caches.open(VERSAO), salvo = await cache.match(req);
  const rede = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => salvo);
  return salvo || rede;
}

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === "navigate") return e.respondWith(redePrimeiro(req, url.pathname.startsWith("/e/") ? "/evento" : "/"));
    if (url.pathname.startsWith("/eventos/")) return e.respondWith(redePrimeiro(req));
    return e.respondWith(cacheAtualiza(req));
  }
  if (url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com") return e.respondWith(cacheAtualiza(req));
});
