// Build-time map geometry for every country, in one shape the map component understands.
// Japan reuses geo.ts (its own projections and the Okinawa inset); Australia and the USA are built here.
import { geoAlbersUsa, geoConicConformal, geoPath, type GeoProjection } from 'd3-geo';
import polylabel from 'polylabel';
import type { FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import auRaw from '../data/geo/australia-states.json';
import usRaw from '../data/geo/usa-states.json';
import * as jp from './geo';
import { REGIONS as JP_REGIONS, PREF_NAMES, THEMES as JP_THEMES, KIND_NAMES } from './japan';
import { COUNTRIES, EXTRA_KINDS, type CountrySlug, type XCountry } from './countries';

export type Box = [number, number, number, number];
export interface AtlasShape { slug: string; region: string; d: string; box: Box; label: [number, number]; name: string; covered: boolean }
export interface AtlasRegion { slug: string; name: string; tone: string; ink: string; places: string[]; box: Box; label: [number, number] }
export interface AtlasFrame { x: number; y: number; w: number; h: number; label?: string }
export interface Atlas {
  country: CountrySlug;
  view: { w: number; h: number };
  shapes: AtlasShape[];
  regions: AtlasRegion[];
  frames: AtlasFrame[];
  project: (ll: [number, number]) => [number, number];
  themes: Record<string, { name: string; tone: string }>;
  kinds: Record<string, string>;
  /** URL of a covered place's page. */
  href: (slug: string) => string;
  unit: string; // 县 / 州
  nationName: string; // 全国 / 全澳 / 全美
}

const union = (a: Box | null, b: Box | null): Box | null =>
  !a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

export function fitBox(points: [number, number][], base: Box | undefined, view: { w: number; h: number }, pad = 24, minSize = 70): Box {
  let b: Box | null = base ?? null;
  for (const [x, y] of points) b = union(b, [x, y, x, y]);
  if (!b) return [0, 0, view.w, view.h];
  let [x0, y0, x1, y1] = b;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const w = Math.max(x1 - x0, minSize), h = Math.max(y1 - y0, minSize);
  x0 = cx - w / 2 - pad; x1 = cx + w / 2 + pad; y0 = cy - h / 2 - pad; y1 = cy + h / 2 + pad;
  return [+x0.toFixed(1), +y0.toFixed(1), +x1.toFixed(1), +y1.toFixed(1)];
}

// ---------------- Japan (wraps geo.ts) ----------------
function japanAtlas(): Atlas {
  const view = jp.VIEW;
  return {
    country: 'japan',
    view,
    shapes: jp.shapes.map((s) => ({ slug: s.slug, region: s.region, d: s.d, box: s.box, label: s.label, name: PREF_NAMES[s.slug], covered: true })),
    regions: JP_REGIONS.map((r) => ({
      slug: r.slug, name: r.name, tone: r.tone, ink: r.ink, places: r.prefs, box: jp.regionBoxes[r.slug],
      label: r.slug === 'okinawa' ? [jp.INSET.x + 250, jp.INSET.y + 140] : jp.regionLabels[r.slug],
    })),
    frames: [{ ...jp.INSET, label: '冲绳 · 奄美' }],
    project: jp.project,
    themes: JP_THEMES,
    kinds: KIND_NAMES,
    href: (slug) => `/japan/${slug}/`,
    unit: '县',
    nationName: '全国',
  };
}

// ---------------- Australia / USA ----------------
type Fc = FeatureCollection<MultiPolygon, { slug: string }>;

function build(country: XCountry, fc: Fc, proj: GeoProjection, width: number, frames: (path: ReturnType<typeof geoPath>) => AtlasFrame[]): Atlas {
  const meta = COUNTRIES[country];
  // Fit to the width, then size the view to the content height.
  proj.fitWidth(width - 60, fc);
  let path = geoPath(proj).digits(1);
  const b = path.bounds(fc);
  const t = proj.translate();
  proj.translate([t[0] + 30 - b[0][0], t[1] + 30 - b[0][1]]);
  path = geoPath(proj).digits(1);
  const view = { w: width, h: Math.round(b[1][1] - b[0][1] + 60) };
  const regionOfState = Object.fromEntries(meta.regions.flatMap((r) => r.states.map((s) => [s, r.slug])));
  const polyBox = (poly: Position[][]): Box => {
    const bb = path.bounds({ type: 'Polygon', coordinates: poly } as Polygon);
    return [bb[0][0], bb[0][1], bb[1][0], bb[1][1]];
  };
  const shapes: AtlasShape[] = fc.features.map((f) => {
    const slug = f.properties.slug;
    const polys = f.geometry.coordinates;
    let core = polys[0], best = -1;
    for (const p of polys) {
      const a = path.area({ type: 'Polygon', coordinates: p } as Polygon);
      if (a > best) { best = a; core = p; }
    }
    // Zoom box: the main landmass plus islands near it (Hawaii keeps all its islands).
    const coreBox = polyBox(core);
    let box = coreBox;
    for (const p of polys) {
      const pb = polyBox(p);
      const near = !(pb[0] > coreBox[2] + 40 || pb[2] < coreBox[0] - 40 || pb[1] > coreBox[3] + 40 || pb[3] < coreBox[1] - 40);
      if (slug === 'hawaii' || near) box = union(box, pb)!;
    }
    const projected = core.map((ring) => ring.map((c) => proj(c as [number, number]) ?? [0, 0]));
    const pl = polylabel(projected as [number, number][][], 0.5);
    return {
      slug, region: regionOfState[slug] ?? '', d: path(f.geometry) ?? '', box,
      label: [+pl[0].toFixed(1), +pl[1].toFixed(1)], name: meta.names[slug] ?? slug, covered: !!regionOfState[slug],
    };
  });
  const bySlug = Object.fromEntries(shapes.map((s) => [s.slug, s]));
  const regions: AtlasRegion[] = meta.regions.map((r) => {
    const box = r.states.reduce<Box | null>((acc, s) => union(acc, bySlug[s]?.box ?? null), null)!;
    // Label on the largest state when the region box centre would fall outside the region (e.g. CA + WA).
    const centre: [number, number] = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    const lead = bySlug[r.states[0]];
    let label: [number, number] = r.states.length > 1 && r.slug !== 'west-coast' && r.slug !== 'nsw-act' ? centre : lead.label;
    // Hand-placed anchors where the automatic spot collides with a neighbour or falls in the sea.
    const FIX: Record<string, (s: typeof bySlug) => [number, number]> = {
      'west-coast': (b) => [b.california.label[0] - 22, b.california.label[1] + 40], // south of Nevada's label, inside CA
      'mountain-west': (b) => [b.utah.label[0] + 10, b.utah.label[1] - 26],
      victoria: (b) => [b.victoria.label[0] - 18, b.victoria.label[1] - 4],
      tasmania: (b) => [b.tasmania.label[0] + 6, b.tasmania.label[1] + 4],
      'nsw-act': (b) => [b['new-south-wales'].label[0] + 6, b['new-south-wales'].label[1] - 30],
    };
    if (FIX[r.slug] && r.states.every((x) => bySlug[x])) label = FIX[r.slug](bySlug);
    return { slug: r.slug, name: r.name, tone: r.tone, ink: r.ink, places: r.states, box, label };
  });
  const project = (ll: [number, number]): [number, number] => {
    const p = proj(ll) ?? [0, 0];
    return [+p[0].toFixed(1), +p[1].toFixed(1)];
  };
  const themes = Object.fromEntries(Object.entries(meta.themes).map(([k, v]) => [k, { name: v.name, tone: v.tone }]));
  return {
    country, view, shapes, regions, frames: frames(path), project, themes, kinds: { ...KIND_NAMES, ...EXTRA_KINDS },
    href: (slug) => `/${country}/${slug}/`, unit: '州', nationName: country === 'usa' ? '全美' : '全澳',
  };
}

const auFc = auRaw as unknown as Fc;
const usFc = usRaw as unknown as Fc;

function australiaAtlas(): Atlas {
  const proj = geoConicConformal().parallels([-18, -36]).rotate([-134, 0]);
  return build('australia', auFc, proj, 1000, () => []);
}

function usaAtlas(): Atlas {
  const proj = geoAlbersUsa();
  return build('usa', usFc, proj, 1000, (path) => {
    // Soft frames around the Alaska and Hawaii insets.
    const frame = (slug: string): AtlasFrame | null => {
      const f = usFc.features.find((x) => x.properties.slug === slug);
      if (!f) return null;
      const b = path.bounds(f);
      return { x: b[0][0] - 12, y: b[0][1] - 12, w: b[1][0] - b[0][0] + 24, h: b[1][1] - b[0][1] + 24 };
    };
    return [frame('alaska'), frame('hawaii')].filter((x): x is AtlasFrame => !!x);
  });
}

const cache = new Map<CountrySlug, Atlas>();
export function atlas(country: CountrySlug): Atlas {
  if (!cache.has(country)) cache.set(country, country === 'japan' ? japanAtlas() : country === 'australia' ? australiaAtlas() : usaAtlas());
  return cache.get(country)!;
}
