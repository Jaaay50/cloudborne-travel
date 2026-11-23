import { prefs, trips } from '../lib/content';
import { REGIONS, SINGLE_PREF_REGIONS, THEME_SLUGS } from '../lib/japan';
import { TOOLS } from '../lib/toolkit';

export function GET({ site }: { site: URL }) {
  const paths = [
    '/', '/japan/themes/', '/japan/trips/', '/japan/tools/', '/budget/', '/about/',
    ...REGIONS.filter((r) => !SINGLE_PREF_REGIONS.has(r.slug)).map((r) => `/japan/region/${r.slug}/`),
    ...prefs.map((p) => `/japan/${p.slug}/`),
    ...THEME_SLUGS.map((t) => `/japan/themes/${t}/`),
    ...trips.map((t) => `/japan/trips/${t.id}/`),
    ...TOOLS.map((t) => `/japan/tools/${t.slug}/`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
