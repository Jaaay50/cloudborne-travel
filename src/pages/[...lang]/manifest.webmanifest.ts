import { langPaths, t, lang, L, HTML_LANG } from '../../lib/i18n';

export const getStaticPaths = langPaths;

// Install manifest per language (name, start page and lang follow the reader's language).
export function GET() {
  const body = {
    name: t('栖云旅行 · 日本、澳大利亚、美国旅行指南'),
    short_name: t('栖云旅行'),
    start_url: L('/'),
    scope: '/',
    display: 'standalone',
    background_color: '#f2efe9',
    theme_color: '#f2efe9',
    lang: HTML_LANG[lang()],
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'Content-Type': 'application/manifest+json' } });
}
