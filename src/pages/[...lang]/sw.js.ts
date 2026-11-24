// Service worker template, one per language: /sw.js (Chinese), /en/sw.js, /ja/sw.js. Each precaches its own
// language's shell pages only. scripts/finalize-sw.mjs fills in the version and the /_astro/ assets after the build.
// - precache (versioned): shell pages + their CSS/JS, replaced on each deploy
// - runtime (stable name): pages, catalog and images the visitor opened; survives deploys
import { TOOLS } from '../../lib/toolkit';
import { langPaths, lang, L, hasPage } from '../../lib/i18n';

export const getStaticPaths = langPaths;

export function GET() {
  const l = lang();
  const shell = ['/', '/plan/', '/budget/', '/quick/', '/japan/tools/', ...TOOLS.map((t) => `/japan/tools/${t.slug}/`), '/australia/guide/', '/usa/guide/']
    .filter((p) => hasPage(l, p)).map((p) => L(p));
  const precache = [...shell, L('/catalog.json'), '/favicon.svg', L('/manifest.webmanifest')];
  const home = L('/');
  const js = `
const V = "dev";
const LP = ${JSON.stringify(l === 'zh' ? '' : '-' + l)};
const PRE = 'cbt-pre' + LP + '-' + V, RUN = 'cbt-run-v1', ASSETS = 'cbt-assets-v1', IMG = 'cbt-img-v1';
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PRE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('cbt-pre' + LP + '-') && k !== PRE && (LP || !/^cbt-pre-(en|ja)-/.test(k))).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const trim = async (name, max) => { const c = await caches.open(name); const ks = await c.keys(); for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]); };
const put = (name, req, res, max) => { const copy = res.clone(); caches.open(name).then((c) => c.put(req, copy)).then(() => max && trim(name, max)); };
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Pages and catalog: network first (no HTTP cache), fall back to what we have offline.
  if (req.mode === 'navigate' || /^\/(?:(?:en|ja)\/)?catalog\.json$/.test(url.pathname)) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) put(RUN, req, res, 160);
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match(${JSON.stringify(home)}) : undefined))
      .then((r) => r || Response.error())));
    return;
  }
  // Hashed build assets and self-hosted fonts: cache first, kept separately so page churn never evicts them.
  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) put(ASSETS, req, res, 240); return res; })));
    return;
  }
  // Illustrations and photos: cache first, in their own cache so page visits don't evict them.
  if (url.pathname.startsWith('/img/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) put(IMG, req, res, 400); return res; })));
  }
});
`;
  return new Response(js, { headers: { 'Content-Type': 'text/javascript' } });
}
