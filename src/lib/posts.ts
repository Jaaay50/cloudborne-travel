import type { CountrySlug } from './countries';
import { dataDir, perLang } from './data';
import { translated } from './i18n';
import { placeByKey } from './world';
import postPhotoIndex from '../data/post-photo-index.json';

export type PostCategory = 'route' | 'pitfall' | 'food' | 'season' | 'transport' | 'budget';

export const POST_CATEGORIES: Record<PostCategory, { label: string; desc: string; tone: string }> = translated({
  route: { label: '路线实录', desc: '按时间走完一段旅程', tone: '#58785c' },
  pitfall: { label: '避坑指南', desc: '提前了解常见的旅行误区', tone: '#a45e45' },
  food: { label: '美食探店', desc: '从街头小吃到当地餐桌', tone: '#bf8243' },
  season: { label: '当季实况', desc: '跟着季节安排旅行', tone: '#7873a5' },
  transport: { label: '交通住宿', desc: '实用的出行与住宿经验', tone: '#517889' },
  budget: { label: '预算复盘', desc: '细算旅途中的每一笔开支', tone: '#9b7956' },
});

export interface PostAuthor { id: string; name: string; handle: string; role: string; avatar: string; tone: string }
export interface PostPhotoSpec { id: string; scene: string; caption: string; alt: string }
export interface PostStep {
  id: string; phase: string; title: string; location: string; duration?: string; cost?: string;
  paragraphs: string[]; tip?: string; spotRefs?: string[]; photo?: PostPhotoSpec;
}
export interface PostBudgetRow { item: string; detail: string; amount: string }
export interface PostSource { title: string; url: string; platform?: string }
export interface PostData {
  slug: string; country: 'japan' | 'australia' | 'usa'; places: string[]; category: PostCategory;
  date: string; checked: string; featured?: boolean; title: string; subtitle: string; excerpt: string;
  author: PostAuthor;
  meta: { days: string; budget: string; season: string; pace: string; audience: string };
  tags: string[]; cover: PostPhotoSpec; lead: string[]; highlights: string[];
  steps: PostStep[]; budgetBreakdown: PostBudgetRow[]; pitfalls: string[]; sources: PostSource[];
}
export interface ResolvedPhoto { id: string; prefix: string; widths: [number, number]; caption: string; alt: string }
export interface PostView extends PostData {
  href: string;
  coverImg: ResolvedPhoto | null;
  gallery: ResolvedPhoto[];
  stepPhotos: Record<string, ResolvedPhoto>;
  photoCount: number;
  readMinutes: number;
  placeNames: string[];
  categoryLabel: string;
}

const PHOTOS = new Set<string>(postPhotoIndex);
export function postPhoto(slug: string, photoId: string): string | null {
  const key = `${slug}/${photoId}`;
  return PHOTOS.has(key) ? `/img/posts/${key}` : null;
}

function resolvePhoto(slug: string, spec: PostPhotoSpec): ResolvedPhoto | null {
  const prefix = postPhoto(slug, spec.id);
  return prefix ? {
    id: spec.id, prefix, widths: spec.id === 'cover' ? [960, 1920] : [640, 1280],
    caption: spec.caption, alt: spec.alt,
  } : null;
}

const loadPosts = perLang((l) => dataDir<PostData>('posts', l).map((post): PostView => {
  const coverImg = resolvePhoto(post.slug, post.cover);
  const gallery: ResolvedPhoto[] = coverImg ? [coverImg] : [];
  const stepPhotos: Record<string, ResolvedPhoto> = Object.create(null);
  for (const step of post.steps) {
    const photo = step.photo && resolvePhoto(post.slug, step.photo);
    if (photo) {
      stepPhotos[step.id] = photo;
      gallery.push(photo);
    }
  }
  const text = [...post.lead, ...post.highlights, ...post.steps.flatMap((s) => [...s.paragraphs, s.tip ?? '']), ...post.pitfalls].join(' ');
  const readMinutes = Math.max(1, Math.ceil(l === 'en' ? text.trim().split(/\s+/).length / 200 : text.replace(/\s/g, '').length / 350));
  return {
    ...post, href: `/posts/${post.slug}/`, coverImg, gallery, stepPhotos, photoCount: gallery.length, readMinutes,
    placeNames: post.places.map((key) => placeByKey(key)?.name ?? key),
    categoryLabel: POST_CATEGORIES[post.category].label,
  };
}).sort((a, b) => b.date.localeCompare(a.date) || Number(!!b.featured) - Number(!!a.featured) || a.slug.localeCompare(b.slug)));

export const allPosts = (): PostView[] => loadPosts();
export const postsOf = (country: CountrySlug): PostView[] => allPosts().filter((p) => p.country === country);
export const postsForPlace = (placeKey: string): PostView[] => allPosts().filter((p) => p.places.includes(placeKey));
export const postBySlug = (slug: string): PostView | undefined => allPosts().find((p) => p.slug === slug);

export function relatedPosts(post: PostView, limit = 3): PostView[] {
  const score = (p: PostView) => 4 * p.places.filter((key) => post.places.includes(key)).length
    + 2 * Number(p.country === post.country) + Number(p.category === post.category)
    + p.tags.filter((tag) => post.tags.includes(tag)).length;
  return allPosts().filter((p) => p.slug !== post.slug && score(p) > 0)
    .sort((a, b) => score(b) - score(a)).slice(0, Math.max(0, limit));
}

export function allPostTags(country?: CountrySlug): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of country ? postsOf(country) : allPosts()) {
    for (const tag of new Set(post.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
