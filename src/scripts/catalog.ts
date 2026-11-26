// Lazily loaded catalogue of prefectures, spots, foods, themes, trips and tools (built by /catalog.json).
/** Place: s = place key ("kyoto", "us.utah"), c = country, i = cover image prefix, ph = cover is a photo, m = best months. */
export interface CatPref { s: string; c: string; n: string; k: string; e: string; r: string; t: string; d: string; m: number[]; i: string; ph: number }
/** Spot: t = time text; h = rough hours [quick planner, day planner]; x = 1 when pricey. Both come from the Chinese source. */
export interface CatSpot { k: string; n: string; l: string; e: string; d: string; t: string; h: [number, number]; x: number; ll: [number, number]; th: string[]; f: string; ph?: number; o?: number[] }
export interface CatFood { k: string; n: string; l: string; w: string; pr: string; ph?: number }
export interface CatLink { n: string; u: string; d: string; k?: string }
export interface CatPost { s: string; c: string; n: string; d: string; cat: string; dt: string; tg: string[]; pl: string[]; i: string; u: string }
export interface Catalog {
  po?: CatPost[];
  p: CatPref[]; s: CatSpot[]; f: CatFood[]; r: CatLink[]; th: CatLink[]; tr: CatLink[]; to: CatLink[];
  /** themes per country, theme best months per country, regions per country */
  tm: Record<string, Record<string, { n: string; c: string }>>;
  tw: Record<string, Record<string, number[]>>;
  rg: Record<string, { s: string; n: string; p: string[] }[]>;
  /** trips with their day items (place keys), for the quick planner */
  tp: { id: string; c: string; n: string; u: string; r: string; dc: number; days: string[][] }[];
}

let cache: Promise<Catalog> | null = null;
export function getCatalog(): Promise<Catalog> {
  if (!cache) {
    cache = fetch(`${document.documentElement.dataset.lp || ''}/catalog.json`).then((r) => {
      if (!r.ok) throw new Error('catalog ' + r.status);
      return r.json();
    });
    cache.catch(() => (cache = null));
  }
  return cache;
}

export const prefOfKey = (key: string) => key.slice(2).split('/')[0];
export const photoUrl = (item: string, size: 640 | 1280 = 640) => {
  const [place, id] = item.slice(2).split('/');
  const country = place.startsWith('au.') ? 'australia' : place.startsWith('us.') ? 'usa' : 'japan';
  const slug = place.replace(/^(au|us)\./, '');
  return `/img/photos/${country}/${slug}/${item[0]}-${id}-${size}.webp`;
};
