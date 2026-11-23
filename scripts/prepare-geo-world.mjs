// One-off: Natural Earth 10m admin-1 → simplified state outlines for Australia and the USA
// (src/data/geo/australia-states.json, src/data/geo/usa-states.json).
// Usage: node scripts/prepare-geo-world.mjs <path to ne_10m_admin_1_states_provinces.geojson>
// - Australia: 8 states/territories; Jervis Bay goes to the ACT, Lord Howe and Macquarie are dropped.
// - USA: 50 states + DC (Aleutians west of 180° are dropped).
import fs from 'node:fs';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { feature } from 'topojson-client';

const src = JSON.parse(fs.readFileSync(process.argv[2]));
const round = (polys) => polys.map((poly) => poly.map((ring) => ring.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)])));
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
};
const polysOf = (g) => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]);

const AU = {
  'AU-NSW': 'new-south-wales', 'AU-ACT': 'australian-capital-territory', 'AU-X02~': 'australian-capital-territory', 'AU-VIC': 'victoria',
  'AU-QLD': 'queensland', 'AU-WA': 'western-australia', 'AU-SA': 'south-australia', 'AU-TAS': 'tasmania', 'AU-NT': 'northern-territory',
};
const US_NAMES = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california', CO: 'colorado', CT: 'connecticut', DE: 'delaware',
  DC: 'washington-dc', FL: 'florida', GA: 'georgia', HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa', KS: 'kansas',
  KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland', MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi',
  MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new-hampshire', NJ: 'new-jersey', NM: 'new-mexico', NY: 'new-york',
  NC: 'north-carolina', ND: 'north-dakota', OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode-island',
  SC: 'south-carolina', SD: 'south-dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont', VA: 'virginia', WA: 'washington',
  WV: 'west-virginia', WI: 'wisconsin', WY: 'wyoming',
};

function build(country, pick, minWeight, minArea, outFile) {
  const by = new Map();
  for (const f of src.features) {
    const slug = pick(f.properties);
    if (!slug) continue;
    for (const poly of polysOf(f.geometry)) {
      if (country === 'usa' && poly[0].some(([x]) => x > 0)) continue; // Aleutians across 180°
      if (country === 'australia' && f.properties.name === 'Lord Howe Island') continue;
      if (!by.has(slug)) by.set(slug, []);
      by.get(slug).push(poly);
    }
  }
  const features = [...by].map(([slug, polys]) => ({ type: 'Feature', id: slug, properties: { slug }, geometry: { type: 'MultiPolygon', coordinates: polys } }));
  let topo = presimplify(topology({ s: { type: 'FeatureCollection', features } }));
  topo = simplify(topo, minWeight);
  const out = feature(topo, topo.objects.s);
  for (const f of out.features) {
    const polys = polysOf(f.geometry).filter((p) => p[0].length >= 4 && ringArea(p[0]) >= minArea(f.properties.slug));
    f.geometry = { type: 'MultiPolygon', coordinates: round(polys) };
    f.id = f.properties.slug;
  }
  const json = { type: 'FeatureCollection', source: 'Natural Earth 10m admin-1 (public domain), cleaned by scripts/prepare-geo-world.mjs', features: out.features };
  fs.writeFileSync(new URL(`../src/data/geo/${outFile}`, import.meta.url), JSON.stringify(json));
  console.log(outFile, out.features.length, 'features', JSON.stringify(json).length, 'bytes');
}

build('australia', (p) => (p.adm0_a3 === 'AUS' ? AU[p.iso_3166_2] : null), 0.004, (s) => (s === 'australian-capital-territory' ? 0.0005 : 0.02), 'australia-states.json');
build('usa', (p) => (p.adm0_a3 === 'USA' ? US_NAMES[p.postal] : null), 0.002, (s) => (s === 'hawaii' ? 0.02 : s === 'washington-dc' || s === 'rhode-island' ? 0.0001 : 0.03), 'usa-states.json');
