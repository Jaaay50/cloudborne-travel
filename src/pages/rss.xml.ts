import { allPosts } from '../lib/posts';
import { runLang } from '../lib/i18n';

function xml(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function GET({ site }: { site: URL }) {
  const link = xml(new URL('/posts/', site).href);
  const items = runLang('zh', () => allPosts().map((post) => {
    const url = xml(new URL(post.href, site).href);
    return `    <item>
      <title>${xml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${xml(post.excerpt)}</description>
      <category>${xml(post.categoryLabel)}</category>
      <pubDate>${new Date(post.date + 'T00:00:00+08:00').toUTCString()}</pubDate>
    </item>`;
  }));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>栖云旅行 · 游记</title>
    <link>${link}</link>
    <description>栖云旅行的路线、攻略与旅行见闻</description>
    <language>zh-cn</language>
    <atom:link href="${xml(new URL('/rss.xml', site).href)}" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
