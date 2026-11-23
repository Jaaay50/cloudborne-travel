// Service worker: precache the shell + toolkit pages, cache other pages/images as they are visited.
import { TOOLS } from '../lib/toolkit';

export function GET() {
  const version = Date.now().toString(36);
  const precache = ['/', '/plan/', '/budget/', '/japan/tools/', ...TOOLS.map((t) => `/japan/tools/${t.slug}/`), '/catalog.json', '/favicon.svg', '/manifest.webmanifest'];
  const js = `
const V = ${JSON.stringify(version)};
const PRE = 'cbt-pre-' + V, RUN = 'cbt-run-' + V;
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PRE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== PRE && k !== RUN).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const trim = async (name, max) => { const c = await caches.open(name); const ks = await c.keys(); for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]); };
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Pages + catalog: network first, fall back to cache when offline.
  if (req.mode === 'navigate' || url.pathname === '/catalog.json') {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(RUN).then((c) => c.put(req, copy)).then(() => trim(RUN, 220)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('/'))));
    return;
  }
  // Hashed assets and images: cache first.
  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/img/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(RUN).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});
`;
  return new Response(js, { headers: { 'Content-Type': 'text/javascript' } });
}
