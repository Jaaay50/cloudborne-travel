// Site-wide behaviour: header, mobile menu, search dialog, trip buttons, toast, reveal-on-scroll.
import { load, subscribe, toggle, has, count, type TripState } from './trip';
import { getCatalog, type Catalog } from './catalog';
import { placeHref, parseItem, parsePlace } from '../lib/keys';
import { ct, lp, LANG } from './i18n';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

/* ---------- header ---------- */
const hdr = $('#hdr');
const onScroll = () => hdr?.classList.toggle('scrolled', window.scrollY > 4);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const menuBtn = $<HTMLButtonElement>('[data-menu]');
const mobileNav = $('[data-mobile-nav]');
menuBtn?.addEventListener('click', () => {
  const open = mobileNav!.hidden;
  mobileNav!.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
});
mobileNav?.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('a')) {
    mobileNav.hidden = true;
    menuBtn?.setAttribute('aria-expanded', 'false');
  }
});

/* ---------- language switch ---------- */
// The choice is remembered: the Chinese home page sends a returning English / Japanese reader to their
// language once per visit (other pages and shared links are never redirected).
const langSw = $('[data-lang-sw]');
const langBtn = $<HTMLButtonElement>('[data-lang-btn]');
const langMenu = $('[data-lang-menu]');
const closeLang = () => { if (langMenu) langMenu.hidden = true; langBtn?.setAttribute('aria-expanded', 'false'); };
langBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = langMenu!.hidden;
  langMenu!.hidden = !open;
  langBtn.setAttribute('aria-expanded', String(open));
  if (open) langMenu!.querySelector<HTMLAnchorElement>('[aria-checked="true"]')?.focus();
});
document.addEventListener('click', (e) => { if (langSw && !langSw.contains(e.target as Node)) closeLang(); });
langMenu?.addEventListener('keydown', (e) => {
  const items = $$<HTMLAnchorElement>('a', langMenu);
  const i = items.indexOf(document.activeElement as HTMLAnchorElement);
  if (e.key === 'Escape') { closeLang(); langBtn?.focus(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }
});
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-set-lang]');
  if (!a) return;
  try { localStorage.setItem('cbt-lang', a.dataset.setLang!); sessionStorage.setItem('cbt-lang-seen', '1'); } catch { /* private mode */ }
  // Keep the in-page position (#spot-…) when switching.
  if (location.hash && !a.hash) a.hash = location.hash;
});
try {
  const pref = localStorage.getItem('cbt-lang');
  if (LANG === 'zh' && location.pathname === '/' && !location.search && !location.hash && (pref === 'en' || pref === 'ja') && !sessionStorage.getItem('cbt-lang-seen')) {
    sessionStorage.setItem('cbt-lang-seen', '1');
    location.replace(`/${pref}/`);
  }
  sessionStorage.setItem('cbt-lang-seen', '1');
} catch { /* private mode */ }

/* ---------- toast ---------- */
const toastEl = $('#toast');
let toastTimer = 0;
export function toast(html: string, ms = 2600) {
  if (!toastEl) return;
  toastEl.innerHTML = html;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), ms);
}
(window as unknown as { cbtToast: typeof toast }).cbtToast = toast;

/* ---------- trip buttons ---------- */
function paintTrip(s: TripState) {
  const n = count(s);
  $$('[data-trip-count]').forEach((el) => {
    if (el.textContent !== String(n)) {
      el.textContent = String(n);
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  });
  $$<HTMLButtonElement>('[data-add]').forEach((b) => {
    const on = has(s, b.dataset.add!);
    b.setAttribute('aria-pressed', String(on));
    const label = b.querySelector('[data-label]');
    if (label) label.textContent = on ? ct('已加入') : ct('加入行程');
  });
}
paintTrip(load());
subscribe(paintTrip);
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-add]');
  if (!b) return;
  e.preventDefault();
  const added = toggle(b.dataset.add!);
  const name = b.dataset.name || '';
  const nm = esc(name);
  toast(added ? `${ct('已把「{name}」加入行程', { name: nm })} <a href="${lp('/plan/')}">${ct('去排行程')}</a>` : ct('已从行程移除「{name}」', { name: nm }));
});

/* ---------- search ---------- */
const dlg = $<HTMLDialogElement>('#search-dlg');
const input = $<HTMLInputElement>('#search-input');
const list = $('#search-list');
let cat: Catalog | null = null;
let sel = 0;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
function hl(text: string, q: string) {
  const i = norm(text).indexOf(q);
  if (!q || i < 0 || text.length !== norm(text).length) return esc(text);
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}

interface Hit { href: string; title: string; sub: string; ico: string; score: number; grp: string }
function score(q: string, fields: string[]) {
  let best = 0;
  fields.forEach((f, i) => {
    const n = norm(f);
    if (!n) return;
    const w = i === 0 ? 1 : 0.6;
    if (n === q) best = Math.max(best, 100 * w);
    else if (n.startsWith(q)) best = Math.max(best, 70 * w);
    else if (n.includes(q)) best = Math.max(best, 40 * w);
  });
  return best;
}

const COUNTRY_NAME: Record<string, string> = { japan: ct('日本'), australia: ct('澳大利亚'), usa: ct('美国') };
const G = { dest: ct('目的地'), spot: ct('景点'), food: ct('美食'), theme: ct('主题'), trip: ct('行程模板'), tool: ct('随身工具') };
function search(qRaw: string): Hit[] {
  if (!cat) return [];
  const q = norm(qRaw);
  if (!q) return [];
  const place = Object.fromEntries(cat.p.map((p) => [p.s, p]));
  const hrefOf = (key: string) => placeHref(key);
  const hits: Hit[] = [];
  for (const p of cat.p) {
    const sc = score(q, [p.n, p.k, p.e, p.t, COUNTRY_NAME[p.c] ?? '']);
    const ico = p.i ? `<img src="${p.i}-${p.ph ? '800' : '640'}.webp" alt="" loading="lazy">` : ct('地');
    if (sc) hits.push({ href: hrefOf(p.s), title: p.n, sub: `${COUNTRY_NAME[p.c]} · ${p.t}`, ico, score: sc + 20, grp: G.dest });
  }
  for (const r of cat.r) {
    const sc = score(q, [r.n, r.k ?? '', r.d]);
    if (sc) hits.push({ href: lp(r.u), title: r.n, sub: r.d, ico: ct('地'), score: sc + 15, grp: G.dest });
  }
  const thumb = (key: string, ph: number | undefined, kind: 's' | 'f', fallback: string) => {
    if (!ph) return fallback;
    const { place: pk, id } = parseItem(`${kind}:${key}`);
    const { country, slug } = parsePlace(pk);
    return `<img src="/img/photos/${country}/${slug}/${kind}-${id}-400.webp" alt="" loading="lazy">`;
  };
  for (const s of cat.s) {
    const pk = s.k.split('/')[0];
    const sc = score(q, [s.n, s.l, s.e, place[pk]?.n ?? '']);
    if (sc) hits.push({ href: `${hrefOf(pk)}#spot-${s.k.split('/')[1]}`, title: s.n, sub: `${place[pk]?.n ?? ''} · ${s.t}`, ico: thumb(s.k, s.ph, 's', ct('景')), score: sc, grp: G.spot });
  }
  for (const f of cat.f) {
    const pk = f.k.split('/')[0];
    const sc = score(q, [f.n, f.l, place[pk]?.n ?? '']);
    if (sc) hits.push({ href: `${hrefOf(pk)}#food-${f.k.split('/')[1]}`, title: f.n, sub: `${place[pk]?.n ?? ''} · ${f.w}`, ico: thumb(f.k, f.ph, 'f', ct('食')), score: sc - 2, grp: G.food });
  }
  for (const [arr, grp, ico] of [[cat.th, G.theme, ct('季')], [cat.tr, G.trip, ct('程')], [cat.to, G.tool, ct('具')]] as const) {
    for (const t of arr) {
      const sc = score(q, [t.n, t.d, t.k ?? '']);
      if (sc) hits.push({ href: lp(t.u), title: t.n, sub: t.d, ico, score: sc - 4, grp });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 24);
}

function renderResults() {
  if (!list || !input) return;
  const q = input.value.trim();
  input.removeAttribute('aria-activedescendant');
  if (!q) {
    list.innerHTML = `<div class="search-empty">${esc(ct('试试「京都」「大堡礁」「黄石」「温泉」「拉面」'))}</div>`;
    return;
  }
  if (!cat) {
    list.innerHTML = `<div class="search-empty">${esc(ct('正在加载…'))}</div>`;
    return;
  }
  const hits = search(q);
  if (!hits.length) {
    list.innerHTML = `<div class="search-empty">${ct('没有找到「{q}」，换个说法试试。', { q: esc(q) })}</div>`;
    return;
  }
  sel = Math.min(sel, hits.length - 1);
  const nq = norm(q);
  let html = '';
  let last = '';
  const order = [G.dest, G.spot, G.food, G.theme, G.trip, G.tool];
  hits.sort((a, b) => order.indexOf(a.grp) - order.indexOf(b.grp) || b.score - a.score);
  hits.forEach((h, i) => {
    if (h.grp !== last) {
      html += `<div class="grp">${h.grp}</div>`;
      last = h.grp;
    }
    html += `<a href="${h.href}" role="option" id="sr-${i}" aria-selected="${i === sel}"><span class="ico">${h.ico}</span><span><b>${hl(h.title, nq)}</b><small>${esc(h.sub)}</small></span></a>`;
  });
  list.innerHTML = html;
  input.setAttribute('aria-activedescendant', `sr-${sel}`);
}

function openSearch(prefill = '') {
  if (!dlg || !input) return;
  if (!dlg.open) dlg.showModal();
  input.value = prefill;
  sel = 0;
  renderResults();
  input.focus();
  getCatalog()
    .then((c) => {
      cat = c;
      renderResults();
    })
    .catch(() => list && (list.innerHTML = `<div class="search-empty">${esc(ct('搜索数据加载失败，请检查网络后重试。'))}</div>`));
}
$$('[data-open-search]').forEach((b) => b.addEventListener('click', () => openSearch((b as HTMLElement).dataset.q || '')));
$$('[data-close-search]').forEach((b) => b.addEventListener('click', () => dlg?.close()));
dlg?.addEventListener('click', (e) => {
  if (e.target === dlg) dlg.close();
});
input?.addEventListener('input', () => {
  sel = 0;
  renderResults();
});
input?.addEventListener('keydown', (e) => {
  const items = $$<HTMLAnchorElement>('a[role="option"]', list!);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((a, i) => a.setAttribute('aria-selected', String(i === sel)));
    items[sel].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', items[sel].id);
  } else if (e.key === 'Enter') {
    const a = items[sel];
    if (a) {
      e.preventDefault();
      dlg?.close();
      location.href = a.href;
    }
  }
});
list?.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('a')) dlg?.close();
});
document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) {
    e.preventDefault();
    openSearch();
  }
});

/* ---------- reveal on scroll ---------- */
// Siblings that enter together are staggered by 60 ms each.
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver(
      (entries) => {
        const entering = entries.filter((en) => en.isIntersecting);
        entering.forEach((en, i) => {
          (en.target as HTMLElement).style.setProperty('--d', `${Math.min(i, 6) * 60}ms`);
          en.target.classList.add('in');
          io?.unobserve(en.target);
        });
      },
      { rootMargin: '0px 0px -6% 0px' },
    )
  : null;
$$('.reveal').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));

/* ---------- photos fade in once decoded ---------- */
const fadeIn = (img: HTMLImageElement) => {
  if (img.complete && img.naturalWidth) { img.classList.add('ok'); return; }
  img.classList.add('fade');
  const done = () => img.classList.add('ok');
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', done, { once: true });
};
$$<HTMLImageElement>('img[data-fade]').forEach(fadeIn);

/* ---------- service worker (offline) ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // One worker per language (/sw.js, /en/sw.js, /ja/sw.js); each one's scope is its own language's pages.
  window.addEventListener('load', () => navigator.serviceWorker.register(lp('/sw.js')).catch(() => {}));
}
