// Every page render runs with its language set (from the /en/ or /ja/ prefix), so lang() and t()
// in src/lib/i18n.ts work in components and lib code without passing the language around.
// English and Japanese HTML then gets its internal page links prefixed (/japan/ -> /en/japan/):
// only href="/…/" page paths (they all end in a slash); assets, absolute URLs and the language
// switch links (they carry hreflang) are left alone.
import { defineMiddleware } from 'astro:middleware';
import { runLang, type Lang } from './lib/i18n';

const A_TAG = /<a\b[^>]*>/g;
const PAGE_HREF = /\bhref="\/(?!\/|en\/|ja\/)([^"?#]*\/)?([?#][^"]*)?"/;

export const onRequest = defineMiddleware(async (ctx, next) => {
  const m = ctx.url.pathname.match(/^\/(en|ja)(?:\/|$)/);
  const l: Lang = m ? (m[1] as Lang) : 'zh';
  const res = await runLang(l, () => next());
  if (l === 'zh' || !(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  const html = (await res.text()).replace(A_TAG, (tag) =>
    tag.includes('hreflang=') ? tag : tag.replace(PAGE_HREF, (_s, path = '', rest = '') => `href="/${l}/${path}${rest}"`));
  return new Response(html, { status: res.status, statusText: res.statusText, headers: res.headers });
});
