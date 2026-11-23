// Lazily loaded catalogue of prefectures, spots, foods, themes, trips and tools (built by /catalog.json).
export interface CatPref { s: string; n: string; k: string; e: string; r: string; t: string }
export interface CatSpot { k: string; n: string; l: string; e: string; d: string; t: string; ll: [number, number]; th: string[]; f: string }
export interface CatFood { k: string; n: string; l: string; w: string; pr: string }
export interface CatLink { n: string; u: string; d: string; k?: string }
export interface Catalog { p: CatPref[]; s: CatSpot[]; f: CatFood[]; r: CatLink[]; th: CatLink[]; tr: CatLink[]; to: CatLink[] }

let cache: Promise<Catalog> | null = null;
export function getCatalog(): Promise<Catalog> {
  if (!cache) {
    cache = fetch('/catalog.json', { cache: 'force-cache' }).then((r) => {
      if (!r.ok) throw new Error('catalog ' + r.status);
      return r.json();
    });
    cache.catch(() => (cache = null));
  }
  return cache;
}

export const prefOfKey = (key: string) => key.slice(2).split('/')[0];
