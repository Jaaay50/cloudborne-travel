// Loads the hand-written content (src/data/**, or its English / Japanese copy in src/i18n/<lang>/**)
// at build time. Every export reads as the current render language (see lib/data.ts `live`).
import { PREF_SLUGS, REGION_OF_PREF, REGIONS, type PrefSlug, type RegionSlug, type Season, type ThemeSlug } from './japan';
import { COUNTRIES, regionOf, type XCountry } from './countries';
import photoIndex from '../data/photo-index.json';
import { dataDir, dataFile, live, perLang } from './data';

export interface Source { title: string; url: string }
export interface Spot {
  id: string; name: string; local?: string; en?: string; kind: string; ll: [number, number];
  text: string; time: string; tip?: string; fee?: string; themes: ThemeSlug[];
  /** Months the spot can be visited (seasonal closures); absent = all year. */
  open?: number[];
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

// Optional fields default to empty so pages never crash on a spot without themes.
const loadJapan = perLang((l) => {
  const prefList = dataDir<Pref>('japan/prefectures', l);
  for (const p of prefList) for (const s of p.spots ?? []) s.themes ??= [];
  const prefMap = Object.fromEntries(prefList.map((p) => [p.slug, p])) as Partial<Record<PrefSlug, Pref>>;
  const regionMap = Object.fromEntries(dataDir<Region>('japan/regions', l).map((r) => [r.slug, r])) as Partial<Record<RegionSlug, Region>>;
  const tripList = dataDir<Trip>('japan/trips', l).sort((a, b) => {
    const ra = REGIONS.findIndex((r) => r.slug === a.region);
    const rb = REGIONS.findIndex((r) => r.slug === b.region);
    return ra - rb || a.daysCount - b.daysCount;
  });
  return {
    prefs: PREF_SLUGS.map((s) => prefMap[s]).filter((p): p is Pref => !!p),
    prefMap, regionMap, trips: tripList,
    covers: dataFile<Covers>('japan/covers.json', l)!,
  };
});

export const prefs: Pref[] = live((l) => loadJapan(l).prefs);
export const getPref = (slug: PrefSlug) => loadJapan().prefMap[slug];
export const getRegion = (slug: RegionSlug) => loadJapan().regionMap[slug];
export const trips: Trip[] = live((l) => loadJapan(l).trips);

interface Covers { hero: Cover; prefectures: Record<PrefSlug, Cover>; regions: Partial<Record<RegionSlug, Cover>>; themes: Record<ThemeSlug, Cover> }
export const covers: Covers = live((l) => loadJapan(l).covers);

export interface SpotRef extends Spot { pref: PrefSlug; prefName: string; region: RegionSlug; key: string }
export const allSpots: SpotRef[] = live((l) => loadJapan(l).prefs.flatMap((p) =>
  p.spots.map((s) => ({ ...s, pref: p.slug, prefName: p.name, region: REGION_OF_PREF[p.slug], key: `${p.slug}/${s.id}` })),
));
export interface FoodRef extends Food { pref: PrefSlug; prefName: string; key: string }
export const allFoods: FoodRef[] = live((l) => loadJapan(l).prefs.flatMap((p) => p.foods.map((f) => ({ ...f, pref: p.slug, prefName: p.name, key: `${p.slug}/${f.id}` }))));

export const spotByKey = (key: string) => allSpots.find((s) => s.key === key);
export const foodByKey = (key: string) => allFoods.find((f) => f.key === key);

export const mapLinks = (name: string, [lon, lat]: [number, number]) => ({
  amap: `https://uri.amap.com/marker?position=${lon},${lat}&name=${encodeURIComponent(name)}&coordinate=wgs84&callnative=1`,
  google: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
  apple: `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent(name)}`,
});

export const xhs = (q: string) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}`;

// ---------------- Australia / USA ----------------

export interface XSpot extends Omit<Spot, 'themes' | 'en'> { themes: string[]; photo?: string }
export interface XFood extends Food { photo?: string }
export interface XState {
  slug: string; country: XCountry; name: string; local: string; abbr: string; region: string; tagline: string; intro: string[];
  days: string; seasons: { months: number[]; note: string }; stay: string; access: { from: string; how: string }[];
  spots: XSpot[]; foods: XFood[]; tips: string[]; nearby: string[]; climate: { city: string; ll: [number, number] };
  cover: { scene: string; alt: string }; sources: Source[]; checked: string;
}
export interface XTrip {
  id: string; country: XCountry; title: string; region: string; daysCount: number; for: string; season: string; summary: string;
  bases: string[]; days: { title: string; stay: string; items: TripItem[]; move?: string }[];
}
export interface Guide {
  country: XCountry;
  sections: { id: string; title: string; items: { title: string; text: string }[] }[];
  numbers: { label: string; number: string; note?: string }[];
  contacts: { name: string; phone: string; hours?: string; note?: string; url?: string }[];
  budget: { currency: string; save: Record<string, number>; mid: Record<string, number>; lux: Record<string, number>; note: string };
  sources: Source[]; checked: string;
}

const order = (c: XCountry) => COUNTRIES[c].regions.flatMap((r) => r.states);
const loadX = perLang((l) => {
  const states = (c: XCountry) => {
    const list = dataDir<XState>(`${c}/states`, l);
    for (const s of list) for (const x of s.spots ?? []) x.themes ??= [];
    return list.sort((a, b) => order(c).indexOf(a.slug) - order(c).indexOf(b.slug));
  };
  const trips = (c: XCountry) => dataDir<XTrip>(`${c}/trips`, l).sort((a, b) => a.daysCount - b.daysCount);
  return {
    states: { australia: states('australia'), usa: states('usa') } as Record<XCountry, XState[]>,
    trips: { australia: trips('australia'), usa: trips('usa') } as Record<XCountry, XTrip[]>,
  };
});

export const statesOf: Record<XCountry, XState[]> = live((l) => loadX(l).states);
export const getState = (c: XCountry, slug: string) => loadX().states[c].find((s) => s.slug === slug);
export const tripsOf: Record<XCountry, XTrip[]> = live((l) => loadX(l).trips);
export const guideOf = (c: XCountry) => dataFile<Guide>(`${c}/guide.json`);

export interface XSpotRef extends XSpot { country: XCountry; state: string; stateName: string; region: string; key: string }
export interface XFoodRef extends XFood { country: XCountry; state: string; stateName: string; key: string }
export const xSpots = (c: XCountry): XSpotRef[] => statesOf[c].flatMap((st) =>
  st.spots.map((s) => ({ ...s, country: c, state: st.slug, stateName: st.name, region: regionOf(c, st.slug)?.slug ?? st.region, key: `${st.slug}/${s.id}` })));
export const xFoods = (c: XCountry): XFoodRef[] => statesOf[c].flatMap((st) =>
  st.foods.map((f) => ({ ...f, country: c, state: st.slug, stateName: st.name, key: `${st.slug}/${f.id}` })));

// ---------------- photos ----------------
// photo-index.json lists every generated photo as "<country>/<place>/<s|f>-<id>" (plus "<country>/<place>/cover").
const PHOTOS = new Set<string>(photoIndex as string[]);
/** URL prefix of a photo, or null when there is none yet.
 *  Spots/foods: append "-640.webp" or "-1280.webp". Covers: append "-960.webp" or "-1920.webp". */
export function photo(country: string, place: string, kind: 's' | 'f' | 'cover', id = ''): string | null {
  const key = kind === 'cover' ? `${country}/${place}/cover` : `${country}/${place}/${kind}-${id}`;
  return PHOTOS.has(key) ? `/img/photos/${key}` : null;
}
