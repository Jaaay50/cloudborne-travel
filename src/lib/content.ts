// Loads the hand-written Japan content (src/data/japan/**) at build time.
import { PREF_SLUGS, REGION_OF_PREF, REGIONS, type PrefSlug, type RegionSlug, type Season, type ThemeSlug } from './japan';
import coversRaw from '../data/japan/covers.json';

export interface Source { title: string; url: string }
export interface Spot {
  id: string; name: string; local?: string; en?: string; kind: string; ll: [number, number];
  text: string; time: string; tip?: string; fee?: string; themes: ThemeSlug[];
}
export interface Food { id: string; name: string; local?: string; text: string; where: string; price?: string }
export interface Pref {
  id: number; slug: PrefSlug; name: string; local: string; kana: string; en: string; region: RegionSlug;
  tagline: string; intro: string[]; days: string; seasons: { best: Season[]; note: string }; stay: string;
  access: { from: string; how: string }[]; spots: Spot[]; foods: Food[]; tips: string[]; nearby: PrefSlug[];
  sources: Source[]; checked: string;
}
export interface Region {
  slug: RegionSlug; name: string; kana: string; en: string; tagline: string; intro: string[]; days: string; season: string;
  gateways: { name: string; how: string }[]; cities: string[]; passes?: { name: string; text: string }[];
  prefectures: PrefSlug[]; sources: Source[]; checked: string;
}
export type TripItem = { pref: PrefSlug; spot: string } | { pref: PrefSlug; food: string } | { note: string };
export interface Trip {
  id: string; title: string; region: RegionSlug; daysCount: number; for: string; season: string; summary: string;
  bases: string[]; days: { title: string; stay: string; items: TripItem[]; move?: string }[];
}
export interface Cover { scene: string; alt: string }

const prefMods = import.meta.glob<Pref>('../data/japan/prefectures/*.json', { eager: true, import: 'default' });
const regionMods = import.meta.glob<Region>('../data/japan/regions/*.json', { eager: true, import: 'default' });
const tripMods = import.meta.glob<Trip>('../data/japan/trips/*.json', { eager: true, import: 'default' });

const bySlug = <T extends { slug: string }>(mods: Record<string, T>) =>
  Object.fromEntries(Object.values(mods).map((m) => [m.slug, m])) as Record<string, T>;

// Optional fields default to empty so pages never crash on a spot without themes.
for (const p of Object.values(prefMods)) for (const s of p.spots ?? []) s.themes ??= [];
const prefMap = bySlug(prefMods) as Partial<Record<PrefSlug, Pref>>;
const regionMap = bySlug(regionMods) as Partial<Record<RegionSlug, Region>>;

export const prefs: Pref[] = PREF_SLUGS.map((s) => prefMap[s]).filter((p): p is Pref => !!p);
export const getPref = (slug: PrefSlug) => prefMap[slug];
export const getRegion = (slug: RegionSlug) => regionMap[slug];
export const trips: Trip[] = Object.values(tripMods).sort((a, b) => {
  const ra = REGIONS.findIndex((r) => r.slug === a.region);
  const rb = REGIONS.findIndex((r) => r.slug === b.region);
  return ra - rb || a.daysCount - b.daysCount;
});

export const covers = coversRaw as {
  hero: Cover; prefectures: Record<PrefSlug, Cover>; regions: Partial<Record<RegionSlug, Cover>>; themes: Record<ThemeSlug, Cover>;
};

export interface SpotRef extends Spot { pref: PrefSlug; prefName: string; region: RegionSlug; key: string }
export const allSpots: SpotRef[] = prefs.flatMap((p) =>
  p.spots.map((s) => ({ ...s, pref: p.slug, prefName: p.name, region: REGION_OF_PREF[p.slug], key: `${p.slug}/${s.id}` })),
);
export interface FoodRef extends Food { pref: PrefSlug; prefName: string; key: string }
export const allFoods: FoodRef[] = prefs.flatMap((p) => p.foods.map((f) => ({ ...f, pref: p.slug, prefName: p.name, key: `${p.slug}/${f.id}` })));

export const spotByKey = (key: string) => allSpots.find((s) => s.key === key);
export const foodByKey = (key: string) => allFoods.find((f) => f.key === key);

/** Compact catalogue used by the client (planner, search). */
export function clientCatalog() {
  return {
    p: prefs.map((p) => ({ s: p.slug, n: p.name, k: p.kana, e: p.en, r: p.region, t: p.tagline })),
    s: allSpots.map((s) => ({ k: s.key, n: s.name, l: s.local ?? '', e: s.en ?? '', d: s.kind, t: s.time, ll: s.ll, th: s.themes, f: s.fee ?? '' })),
    f: allFoods.map((f) => ({ k: f.key, n: f.name, l: f.local ?? '', w: f.where, pr: f.price ?? '' })),
  };
}

export const mapLinks = (name: string, [lon, lat]: [number, number]) => ({
  amap: `https://uri.amap.com/marker?position=${lon},${lat}&name=${encodeURIComponent(name)}&coordinate=wgs84&callnative=1`,
  google: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
  apple: `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent(name)}`,
});

export const xhs = (q: string) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}`;
