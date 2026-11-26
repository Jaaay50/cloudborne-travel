import { prefs } from '../lib/content';
import { REGIONS, SINGLE_PREF_REGIONS, THEME_SLUGS } from '../lib/japan';
import { TOOLS } from '../lib/toolkit';
import { placesOf, tripsAll } from '../lib/world';
import { allPosts } from '../lib/posts';
import { LANGS, L, HTML_LANG, hasPage } from '../lib/i18n';

// Every page in every language it exists in, with hreflang alternates (Google's sitemap form).
export function GET({ site }: { site: URL }) {
  const paths = [
    '/', '/japan/', '/australia/', '/usa/', '/australia/guide/', '/usa/guide/', '/quick/', '/trips/',
    '/japan/themes/', '/japan/tools/', '/budget/', '/about/',
    ...allPosts().map((p) => p.href),
    ...REGIONS.filter((r) => !SINGLE_PREF_REGIONS.has(r.slug)).map((r) => `/japan/region/${r.slug}/`),
    ...prefs.map((p) => `/japan/${p.slug}/`),
    ...placesOf('australia').map((p) => p.href),
    ...placesOf('usa').map((p) => p.href),
    ...THEME_SLUGS.map((t) => `/japan/themes/${t}/`),
    ...tripsAll().map((t) => t.href),
    ...TOOLS.map((t) => `/japan/tools/${t.slug}/`),
  ];
  const url = (p: string) => new URL(p, site).href;
  const entries = paths.flatMap((p) => {
    const langs = LANGS.filter((l) => hasPage(l, p));
    const alt = langs.map((l) => `    <xhtml:link rel="alternate" hreflang="${HTML_LANG[l]}" href="${url(L(p, l))}"/>`).join('\n')
      + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${url(p)}"/>`;
    return langs.map((l) => `  <url><loc>${url(L(p, l))}</loc>\n${alt}\n  </url>`);
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
