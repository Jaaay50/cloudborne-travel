// One common view over Japan, Australia and the USA for pages and the client catalogue.
import { prefs, getRegion, trips as jpTrips, covers, statesOf, tripsOf, photo, type TripItem } from './content';
import { REGIONS as JP_REGIONS, REGION_OF_PREF, SINGLE_PREF_REGIONS, THEMES as JP_THEMES, type Season } from './japan';
import { COUNTRIES, type CountrySlug, type XCountry } from './countries';
import { placeKey, type Country } from './keys';

export interface WSpot {
  id: string; key: string; item: string; name: string; local?: string; en?: string; kind: string; ll: [number, number];
  text: string; time: string; tip?: string; fee?: string; themes: string[]; img: string | null; open?: number[];
}
export interface WFood { id: string; key: string; item: string; name: string; local?: string; text: string; where: string; price?: string; img: string | null }
export interface WPlace {
  country: Country; slug: string; key: string; name: string; local: string; en: string; region: string; tagline: string;
  days: string; months: number[]; href: string; cover: string; coverPhoto: boolean; coverAlt: string;
  spots: WSpot[]; foods: WFood[];
}
export interface WRegion { country: Country; slug: string; name: string; tone: string; ink: string; places: string[]; tagline: string; href: string | null; cover: string }
export interface WTrip {
  country: Country; id: string; title: string; region: string; daysCount: number; for: string; season: string; summary: string;
  bases: string[]; href: string; cover: string; days: { title: string; stay: string; move?: string; items: TripItem[] }[];
}

const SEASON_MONTHS: Record<Season, number[]> = { spring: [3, 4, 5], summer: [6, 7, 8], autumn: [9, 10, 11], winter: [12, 1, 2] };

function japanPlaces(): WPlace[] {
  return prefs.map((p) => ({
    country: 'japan', slug: p.slug, key: p.slug, name: p.name, local: p.kana, en: p.en, region: p.region, tagline: p.tagline, days: p.days,
    months: p.seasons.best.flatMap((s) => SEASON_MONTHS[s]), href: `/japan/${p.slug}/`,
    cover: `/img/prefectures/${p.slug}`, coverPhoto: false, coverAlt: covers.prefectures[p.slug]?.alt ?? '',
    spots: p.spots.map((s) => ({
      id: s.id, key: `${p.slug}/${s.id}`, item: `s:${p.slug}/${s.id}`, name: s.name, local: s.local, en: s.en, kind: s.kind, ll: s.ll,
      text: s.text, time: s.time, tip: s.tip, fee: s.fee, themes: s.themes, img: photo('japan', p.slug, 's', s.id), open: s.open,
    })),
    foods: p.foods.map((f) => ({
      id: f.id, key: `${p.slug}/${f.id}`, item: `f:${p.slug}/${f.id}`, name: f.name, local: f.local, text: f.text, where: f.where, price: f.price,
      img: photo('japan', p.slug, 'f', f.id),
    })),
  }));
}

function xPlaces(c: XCountry): WPlace[] {
  return statesOf[c].map((st) => {
    const key = placeKey(c, st.slug);
    const cover = photo(c, st.slug, 'cover');
    return {
      country: c, slug: st.slug, key, name: st.name, local: st.local, en: st.local, region: st.region, tagline: st.tagline, days: st.days,
      months: st.seasons.months, href: `/${c}/${st.slug}/`, cover: cover ?? '', coverPhoto: true, coverAlt: st.cover.alt,
      spots: st.spots.map((s) => ({
        id: s.id, key: `${key}/${s.id}`, item: `s:${key}/${s.id}`, name: s.name, local: s.local, kind: s.kind, ll: s.ll,
        text: s.text, time: s.time, tip: s.tip, fee: s.fee, themes: s.themes, img: photo(c, st.slug, 's', s.id), open: s.open,
      })),
      foods: st.foods.map((f) => ({
        id: f.id, key: `${key}/${f.id}`, item: `f:${key}/${f.id}`, name: f.name, local: f.local, text: f.text, where: f.where, price: f.price,
        img: photo(c, st.slug, 'f', f.id),
      })),
    };
  });
}

const cache: Partial<Record<CountrySlug, WPlace[]>> = {};
export const placesOf = (c: CountrySlug): WPlace[] => (cache[c] ??= c === 'japan' ? japanPlaces() : xPlaces(c));
export const allPlaces = () => [...placesOf('japan'), ...placesOf('australia'), ...placesOf('usa')];
export const placeByKey = (key: string) => allPlaces().find((p) => p.key === key);

export function regionsOf(c: CountrySlug): WRegion[] {
  if (c === 'japan') {
    return JP_REGIONS.map((r) => {
      const single = SINGLE_PREF_REGIONS.has(r.slug);
      const reg = getRegion(r.slug);
      const pref = single ? prefs.find((p) => p.slug === r.prefs[0]) : undefined;
      return {
        country: 'japan', slug: r.slug, name: r.name, tone: r.tone, ink: r.ink, places: r.prefs, tagline: reg?.tagline ?? pref?.tagline ?? '',
        href: single ? `/japan/${r.prefs[0]}/` : `/japan/region/${r.slug}/`, cover: single ? `/img/prefectures/${r.prefs[0]}` : `/img/regions/${r.slug}`,
      };
    });
  }
  const places = placesOf(c);
  return COUNTRIES[c].regions.map((r) => {
    const ps = r.states.map((s) => places.find((p) => p.slug === s)).filter((p): p is WPlace => !!p);
    return {
      country: c, slug: r.slug, name: r.name, tone: r.tone, ink: r.ink, places: r.states.map((s) => placeKey(c, s)),
      tagline: ps.length === 1 ? ps[0].tagline : ps.map((p) => p.name).join(' · '),
      href: ps.length === 1 ? ps[0].href : null, cover: ps[0]?.cover ?? '',
    };
  });
}

/** Region tone for a place (map colours, chips). */
export function toneOf(country: CountrySlug, region: string) {
  const r = country === 'japan' ? JP_REGIONS.find((x) => x.slug === region) : COUNTRIES[country].regions.find((x) => x.slug === region);
  return { tone: r?.tone ?? '#c9bfa8', ink: r?.ink ?? '#5a5040', name: r?.name ?? '' };
}

export const themesOf = (c: CountrySlug): Record<string, { name: string; tone: string; season: string }> =>
  c === 'japan' ? (JP_THEMES as unknown as Record<string, { name: string; tone: string; season: string }>) : COUNTRIES[c].themes;

/** Rough months a theme is at its best, used by the quick planner to avoid out-of-season picks. */
export const THEME_MONTHS: Record<CountrySlug, Record<string, number[]>> = {
  japan: { sakura: [3, 4], flowers: [4, 5, 6, 7, 8], autumn: [10, 11, 12], snow: [12, 1, 2, 3], sea: [5, 6, 7, 8, 9, 10] },
  australia: { sea: [10, 11, 12, 1, 2, 3, 4], snow: [6, 7, 8, 9], flowers: [8, 9, 10, 11], aurora: [5, 6, 7, 8, 9] },
  usa: { autumn: [9, 10], snow: [12, 1, 2, 3], aurora: [9, 10, 11, 12, 1, 2, 3] },
};

function tripCover(country: Country, items: TripItem[]) {
  const first = items.find((i) => 'pref' in i) as { pref: string } | undefined;
  if (country === 'japan') return `/img/prefectures/${first?.pref ?? 'tokyo'}`;
  const st = first?.pref ?? '';
  return photo(country, st, 'cover') ?? '';
}

export function tripsAll(c?: CountrySlug): WTrip[] {
  const jp: WTrip[] = jpTrips.map((t) => ({
    country: 'japan', id: t.id, title: t.title, region: t.region, daysCount: t.daysCount, for: t.for, season: t.season, summary: t.summary,
    bases: t.bases, href: `/japan/trips/${t.id}/`, cover: tripCover('japan', t.days.flatMap((d) => d.items)), days: t.days,
  }));
  const x = (country: XCountry): WTrip[] => tripsOf[country].map((t) => ({
    country, id: t.id, title: t.title, region: t.region, daysCount: t.daysCount, for: t.for, season: t.season, summary: t.summary,
    bases: t.bases, href: `/${country}/trips/${t.id}/`, cover: tripCover(country, t.days.flatMap((d) => d.items)),
    // Trip items reference bare state slugs; turn them into place keys.
    days: t.days.map((d) => ({ ...d, items: d.items.map((i) => ('pref' in i ? { ...i, pref: placeKey(country, i.pref) } : i)) as TripItem[] })),
  }));
  const all = { japan: jp, australia: x('australia'), usa: x('usa') };
  return c ? all[c] : [...all.japan, ...all.australia, ...all.usa];
}

/** Compact catalogue for the browser: search, planner, quick planner. */
export function catalogData() {
  const places = allPlaces();
  return {
    p: places.map((p) => ({ s: p.key, c: p.country, n: p.name, k: p.local, e: p.en, r: p.region, t: p.tagline, d: p.days, m: p.months, i: p.cover, ph: p.coverPhoto ? 1 : 0 })),
    s: places.flatMap((p) => p.spots.map((s) => ({ k: s.key, n: s.name, l: s.local ?? '', e: s.en ?? '', d: s.kind, t: s.time, ll: s.ll, th: s.themes, f: s.fee ?? '', ph: s.img ? 1 : 0, ...(s.open ? { o: s.open } : {}) }))),
    f: places.flatMap((p) => p.foods.map((f) => ({ k: f.key, n: f.name, l: f.local ?? '', w: f.where, pr: f.price ?? '', ph: f.img ? 1 : 0 }))),
    tm: Object.fromEntries((['japan', 'australia', 'usa'] as const).map((c) => [c, Object.fromEntries(Object.entries(themesOf(c)).map(([k, v]) => [k, { n: v.name, c: v.tone }]))])),
    tw: THEME_MONTHS,
    rg: Object.fromEntries((['japan', 'australia', 'usa'] as const).map((c) => [c, regionsOf(c).map((r) => ({ s: r.slug, n: r.name, p: r.places }))])),
  };
}

export const REGION_OF = (country: CountrySlug, place: string) => (country === 'japan' ? REGION_OF_PREF[place as keyof typeof REGION_OF_PREF] : COUNTRIES[country].regions.find((r) => r.states.includes(place))?.slug);
