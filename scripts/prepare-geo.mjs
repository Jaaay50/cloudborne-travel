// One-off: turn the Natural Earth 10m admin-1 Japan subset (research/) into a cleaned
// prefecture GeoJSON for the site (src/data/geo/japan-prefectures.json).
// - keys features by prefecture slug and id (JIS code)
// - moves the Amami islands (mis-tagged JP-47 in Natural Earth) to Kagoshima
// - drops tiny remote islands that only stretch the map (Daito, Ogasawara/Izu south of 32N)
//   and the disputed Senkaku islets, which a travel map does not need to draw
// - rounds coordinates to 4 decimals
import fs from 'node:fs';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { feature } from 'topojson-client';

const SLUGS = 'hokkaido aomori iwate miyagi akita yamagata fukushima ibaraki tochigi gunma saitama chiba tokyo kanagawa niigata toyama ishikawa fukui yamanashi nagano gifu shizuoka aichi mie shiga kyoto osaka hyogo nara wakayama tottori shimane okayama hiroshima yamaguchi tokushima kagawa ehime kochi fukuoka saga nagasaki kumamoto oita miyazaki kagoshima okinawa'.split(' ');
const src = JSON.parse(fs.readFileSync(new URL('../research/ne_10m_admin1_jp.geojson', import.meta.url)));

const centroid = (ring) => {
  let x = 0, y = 0;
  for (const [a, b] of ring) { x += a; y += b; }
  return [x / ring.length, y / ring.length];
};
const round = (polys) => polys.map((poly) => poly.map((ring) => ring.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])));

const polysById = new Map();
for (const f of src.features) {
  const id = +f.properties.iso_3166_2.slice(3);
  const g = f.geometry;
  const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
  for (const poly of polys) {
    const [lon, lat] = centroid(poly[0]);
    let target = id;
    if (id === 47 && lon >= 128.4 && lat >= 27.0) target = 46; // Amami -> Kagoshima
    if (id === 47 && lon > 130.5) continue; // Daito islands
    if (id === 47 && lat > 25.6 && lat < 26.0 && lon > 123.4 && lon < 124.7) continue; // Senkaku
    if (id === 13 && lat < 34.2) continue; // southern Izu, Ogasawara: would fall into the Okinawa inset
    if (!polysById.has(target)) polysById.set(target, []);
    polysById.get(target).push(poly);
  }
}

const features = SLUGS.map((slug, i) => {
  const id = i + 1;
  const polys = polysById.get(id);
  if (!polys) throw new Error('missing ' + slug);
  return { type: 'Feature', id: slug, properties: { id, slug }, geometry: { type: 'MultiPolygon', coordinates: round(polys) } };
});
// Simplify with shared borders kept intact, then drop specks (keep small Nansei islands).
let topo = presimplify(topology({ prefs: { type: 'FeatureCollection', features } }));
const MIN_WEIGHT = +(process.env.GEO_MIN_WEIGHT || 0.0003);
topo = simplify(topo, MIN_WEIGHT);
const simplified = feature(topo, topo.objects.prefs);
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
};
for (const f of simplified.features) {
  const g = f.geometry;
  let polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
  polys = polys.filter((poly) => {
    const [lon, lat] = centroid(poly[0]);
    const nansei = lat < 29 && lon < 131.5;
    return poly[0].length >= 4 && ringArea(poly[0]) >= (nansei ? 0.0008 : 0.003);
  });
  f.geometry = { type: 'MultiPolygon', coordinates: round(polys) };
  f.id = f.properties.slug;
}
const out = { type: 'FeatureCollection', source: 'Natural Earth 10m admin-1 (public domain), cleaned by scripts/prepare-geo.mjs', features: simplified.features };
fs.writeFileSync(new URL('../src/data/geo/japan-prefectures.json', import.meta.url), JSON.stringify(out));
console.log('features', features.length, 'bytes', JSON.stringify(out).length);
