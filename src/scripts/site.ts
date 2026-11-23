// Site-wide behaviour: header, mobile menu, search dialog, trip buttons, toast, reveal-on-scroll.
import { load, subscribe, toggle, has, count, type TripState } from './trip';
import { getCatalog, type Catalog } from './catalog';

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
    if (label) label.textContent = on ? '已加入' : '加入行程';
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
  toast(added ? `已把「${name}」加入行程 <a href="/plan/">去排行程</a>` : `已从行程移除「${name}」`);
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

function search(qRaw: string): Hit[] {
  if (!cat) return [];
  const q = norm(qRaw);
  if (!q) return [];
  const prefName = Object.fromEntries(cat.p.map((p) => [p.s, p.n]));
  const hits: Hit[] = [];
  for (const p of cat.p) {
    const sc = score(q, [p.n, p.k, p.e, p.t]);
    if (sc) hits.push({ href: `/japan/${p.s}/`, title: p.n, sub: p.t, ico: `<img src="/img/prefectures/${p.s}-640.webp" alt="" loading="lazy">`, score: sc + 20, grp: '目的地' });
  }
  for (const r of cat.r) {
    const sc = score(q, [r.n, r.k ?? '', r.d]);
    if (sc) hits.push({ href: r.u, title: r.n, sub: r.d, ico: '地', score: sc + 15, grp: '目的地' });
  }
  for (const s of cat.s) {
    const pref = s.k.split('/')[0];
    const sc = score(q, [s.n, s.l, s.e, prefName[pref] ?? '']);
    if (sc) hits.push({ href: `/japan/${pref}/#spot-${s.k.split('/')[1]}`, title: s.n, sub: `${prefName[pref]} · ${s.t}`, ico: '景', score: sc, grp: '景点' });
  }
  for (const f of cat.f) {
    const pref = f.k.split('/')[0];
    const sc = score(q, [f.n, f.l, prefName[pref] ?? '']);
    if (sc) hits.push({ href: `/japan/${pref}/#food-${f.k.split('/')[1]}`, title: f.n, sub: `${prefName[pref]} · ${f.w}`, ico: '食', score: sc - 2, grp: '美食' });
  }
  for (const [arr, grp, ico] of [[cat.th, '主题', '季'], [cat.tr, '行程模板', '程'], [cat.to, '随身工具', '具']] as const) {
    for (const t of arr) {
      const sc = score(q, [t.n, t.d, t.k ?? '']);
      if (sc) hits.push({ href: t.u, title: t.n, sub: t.d, ico, score: sc - 4, grp });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 24);
}

function renderResults() {
  if (!list || !input) return;
  const q = input.value.trim();
  input.removeAttribute('aria-activedescendant');
  if (!q) {
    list.innerHTML = `<div class="search-empty">试试「京都」「温泉」「拉面」「红叶」「机场」「退税」</div>`;
    return;
  }
  if (!cat) {
    list.innerHTML = `<div class="search-empty">正在加载…</div>`;
    return;
  }
  const hits = search(q);
  if (!hits.length) {
    list.innerHTML = `<div class="search-empty">没有找到「${esc(q)}」。换个说法，或用县名、景点名试试。</div>`;
    return;
  }
  sel = Math.min(sel, hits.length - 1);
  const nq = norm(q);
  let html = '';
  let last = '';
  const order = ['目的地', '景点', '美食', '主题', '行程模板', '随身工具'];
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
    .catch(() => list && (list.innerHTML = `<div class="search-empty">搜索数据加载失败，请检查网络后重试。</div>`));
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
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io?.unobserve(en.target);
        }
      }),
      { rootMargin: '0px 0px -8% 0px' },
    )
  : null;
$$('.reveal').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));

/* ---------- service worker (offline) ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
