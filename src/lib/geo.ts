// Build-time map geometry: SVG paths, label anchors and boxes for Japan's prefectures.
// Main islands use one conic projection; the Nansei islands (Okinawa + Amami, south of 29°N)
// are drawn in an inset box at the bottom right, as most Japanese maps do.
import { geoConicConformal, geoPath, type GeoProjection } from 'd3-geo';
import polylabel from 'polylabel';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import raw from '../data/geo/japan-prefectures.json';
import { PREF_SLUGS, REGIONS, REGION_OF_PREF, type PrefSlug, type RegionSlug } from './japan';

export const VIEW = { w: 1000, h: 1000 };
export const INSET = { x: 620, y: 712, w: 352, h: 262 };

type PrefFeature = Feature<MultiPolygon, { id: number; slug: PrefSlug }>;
const fc = raw as unknown as FeatureCollection<MultiPolygon, { id: number; slug: PrefSlug }>;

const isNansei = (ring: Position[]) => {
  let x = 0, y = 0;
  for (const [a, b] of ring) { x += a; y += b; }
  return y / ring.length < 29 && x / ring.length < 131.5;
};
const isNanseiLL = ([lon, lat]: [number, number]) => lat < 29 && lon < 131.5;

const split = (f: PrefFeature) => {
  const main: Position[][][] = [];
  const inset: Position[][][] = [];
  for (const poly of f.geometry.coordinates) (isNansei(poly[0]) ? inset : main).push(poly);
  return { main, inset };
};
const mp = (coordinates: Position[][][]): MultiPolygon => ({ type: 'MultiPolygon', coordinates });
const parts = fc.features.map((f) => ({ slug: f.properties.slug, ...split(f) }));

const mainProj: GeoProjection = geoConicConformal().parallels([33, 43]).rotate([-137.5, 0]).fitExtent(
  [[30, 24], [VIEW.w - 24, VIEW.h - 20]],
  { type: 'FeatureCollection', features: parts.filter((p) => p.main.length).map((p) => ({ type: 'Feature', properties: {}, geometry: mp(p.main) })) },
);
const insetProj: GeoProjection = geoConicConformal().parallels([25, 28]).rotate([-127.5, 0]).fitExtent(
  [[INSET.x + 14, INSET.y + 30], [INSET.x + INSET.w - 14, INSET.y + INSET.h - 12]],
  { type: 'FeatureCollection', features: parts.filter((p) => p.inset.length).map((p) => ({ type: 'Feature', properties: {}, geometry: mp(p.inset) })) },
);

const mainPath = geoPath(mainProj).digits(1);
const insetPath = geoPath(insetProj).digits(1);

export type Box = [number, number, number, number]; // x0 y0 x1 y1
const union = (a: Box | null, b: Box | null): Box | null =>
  !a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

export interface PrefShape { slug: PrefSlug; region: RegionSlug; d: string; box: Box; label: [number, number] }

const largestPoly = (polys: Position[][][], proj: GeoProjection) => {
  let best: Position[][] | null = null, bestA = -1;
  for (const poly of polys) {
    const a = geoPath(proj).area({ type: 'Polygon', coordinates: poly } as Polygon);
    if (a > bestA) { bestA = a; best = poly; }
  }
  return best!;
};

const polyBox = (poly: Position[][], path: ReturnType<typeof geoPath>): Box => {
  const b = path.bounds({ type: 'Polygon', coordinates: poly } as Polygon);
  return [b[0][0], b[0][1], b[1][0], b[1][1]];
};
const near = (a: Box, b: Box, gap: number) =>
  !(b[0] > a[2] + gap || b[2] < a[0] - gap || b[1] > a[3] + gap || b[3] < a[1] - gap);

export const shapes: PrefShape[] = parts.map(({ slug, main, inset }) => {
  let d = '';
  if (main.length) d += mainPath(mp(main)) ?? '';
  if (inset.length) d += insetPath(mp(inset)) ?? '';
  const useInset = !main.length;
  const proj = useInset ? insetProj : mainProj;
  const path = useInset ? insetPath : mainPath;
  const polys = useInset ? inset : main;
  const core = largestPoly(polys, proj);
  // Zoom box: the largest landmass plus islands close to it (drops Izu, Tsushima, Tokara ...).
  // Okinawa (inset-only) keeps every island so Yaeyama and Miyako stay in view.
  let box: Box = polyBox(core, path);
  const coreBox = box;
  for (const poly of polys) {
    const b = polyBox(poly, path);
    if (useInset || near(coreBox, b, 26)) box = union(box, b)!;
  }
  const projected = core.map((ring) => ring.map((c) => proj(c as [number, number])!));
  const pl = polylabel(projected as [number, number][][], 0.5);
  return { slug, region: REGION_OF_PREF[slug], d, box, label: [+pl[0].toFixed(1), +pl[1].toFixed(1)] as [number, number] };
}).sort((a, b) => PREF_SLUGS.indexOf(a.slug) - PREF_SLUGS.indexOf(b.slug));

export const shapeBySlug = Object.fromEntries(shapes.map((s) => [s.slug, s])) as Record<PrefSlug, PrefShape>;

export const regionBoxes = Object.fromEntries(
  REGIONS.map((r) => [r.slug, r.prefs.reduce<Box | null>((acc, p) => union(acc, shapeBySlug[p].box), null)!]),
) as Record<RegionSlug, Box>;

export const regionLabels = Object.fromEntries(
  REGIONS.map((r) => {
    const fixed: Partial<Record<RegionSlug, [number, number]>> = {};
    if (fixed[r.slug]) return [r.slug, fixed[r.slug]];
    const b = regionBoxes[r.slug];
    return [r.slug, [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]];
  }),
) as Record<RegionSlug, [number, number]>;

/** Project a [lon, lat] point to SVG coordinates (inset for the Nansei islands). */
export function project(ll: [number, number]): [number, number] {
  const p = (isNanseiLL(ll) ? insetProj : mainProj)(ll)!;
  return [+p[0].toFixed(1), +p[1].toFixed(1)];
}

/** Bounding box (with padding) around a list of points and optional base box. */
export function fitBox(points: [number, number][], base?: Box, pad = 24, minSize = 70): Box {
  let b: Box | null = base ?? null;
  for (const [x, y] of points) b = union(b, [x, y, x, y]);
  if (!b) return [0, 0, VIEW.w, VIEW.h];
  let [x0, y0, x1, y1] = b;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const w = Math.max(x1 - x0, minSize), h = Math.max(y1 - y0, minSize);
  x0 = cx - w / 2 - pad; x1 = cx + w / 2 + pad; y0 = cy - h / 2 - pad; y1 = cy + h / 2 + pad;
  return [+x0.toFixed(1), +y0.toFixed(1), +x1.toFixed(1), +y1.toFixed(1)];
}
