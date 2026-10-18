// public/sw.js — repeat-visit cache for the game's static assets.
//
// Cache-first for same-origin GETs under /sprites/, /sfx/ and /assets/ (Vite's
// hashed JS/CSS). The cache name carries the build id passed on registration
// (`sw.js?v=<build id>`), so every new build gets a fresh cache and the old
// one is deleted on activate — updated art can never be served stale.
//
// Not cached: index.html (always fresh from the network), music (<audio> uses
// Range requests and the files are large — the browser's own HTTP cache handles
// them), and non-200 responses (missing optional sprites 404 and stay 404).
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `bloons-assets-${VERSION}`;
const CACHEABLE = /\/(sprites|sfx|assets)\//;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(n => n.startsWith('bloons-assets-') && n !== CACHE).map(n => caches.delete(n)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET' || req.headers.has('range')) return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin || !CACHEABLE.test(url.pathname)) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.status === 200) {
            try { await cache.put(req, res.clone()); } catch (e) { /* quota full: just skip caching */ }
        }
        return res;
    })());
});
