// Teufy : cache du navigateur (généré par src/site.mjs, ne pas modifier sw.js à la main).
// - images, polices, scripts versionnés : servis depuis le cache (instantané), mis en cache au premier passage ;
// - pages : toujours le réseau d'abord (agenda à jour), le cache seulement hors connexion ou réseau très lent ;
// - vidéos et autres sites : jamais interceptés.
const V = 'e0cf419b';
const PAGES = `teufy-pages-${V}`, FICHIERS = 'teufy-fichiers-v1';
const MAX_FICHIERS = 400;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('teufy-pages-') && k !== PAGES) await caches.delete(k);
  await self.clients.claim();
})()));

const estFichier = (u) => /\/site\/(affiches|img|fonts|partenaires|lieux|vendor)\//.test(u.pathname) || /\/site\/[^/]+\.min\.(js|css)$/.test(u.pathname) || /\/media\/.+\.(jpe?g|png|webp)$/.test(u.pathname);

async function limiter(cache) {
  const k = await cache.keys();
  for (let i = 0; i < k.length - MAX_FICHIERS; i++) await cache.delete(k[i]);
}

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || /\.(mp4|webm|ics|json|xml)$/.test(u.pathname)) return;
  if (estFichier(u)) {
    // Jamais d'échec à cause du cache : au moindre souci (stockage plein, navigateur restreint), réseau direct.
    e.respondWith((async () => {
      try {
        const c = await caches.open(FICHIERS);
        const deja = await c.match(r);
        if (deja) return deja;
        const rep = await fetch(r);
        if (rep.ok && rep.type === 'basic') { c.put(r, rep.clone()).then(() => limiter(c)).catch(() => {}); }
        return rep;
      } catch { return fetch(r).catch(() => new Response('', { status: 504, statusText: 'Hors connexion' })); } // jamais de rejet (Firefox le signale en erreur)
    })());
    return;
  }
  if (r.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(PAGES).catch(() => null);
      if (!c) return fetch(r);
      try {
        const rep = await Promise.race([fetch(r), new Promise((_, non) => setTimeout(() => non(new Error('lent')), 6000))]);
        if (rep.ok) c.put(r, rep.clone()).catch(() => {});
        return rep;
      } catch (err) {
        const deja = await c.match(r).catch(() => null);
        if (deja) return deja;
        return fetch(r); // pas en cache : on attend le réseau
      }
    })());
  }
});
