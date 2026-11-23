// Dev helper: render the national map to /tmp/cbt-map.svg for a quick visual check.
import fs from 'node:fs';
const { shapes, INSET, regionBoxes } = await import('../src/lib/geo.ts');
const { REGION_BY_SLUG } = await import('../src/lib/japan.ts');
let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" style="background:#f3efe6">`;
s += `<rect x="${INSET.x}" y="${INSET.y}" width="${INSET.w}" height="${INSET.h}" fill="none" stroke="#999" rx="10"/>`;
for (const p of shapes) s += `<path d="${p.d}" fill="${REGION_BY_SLUG[p.region].tone}" stroke="#fff" stroke-width=".6"/><text x="${p.label[0]}" y="${p.label[1]}" font-size="9" text-anchor="middle">${p.slug.slice(0,4)}</text>`;
for (const [k, b] of Object.entries(regionBoxes)) s += `<rect x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" fill="none" stroke="red" stroke-dasharray="3 3" stroke-width=".7"/>`;
s += '</svg>';
fs.writeFileSync('/tmp/cbt-map.svg', s);
console.log('bytes', s.length);
