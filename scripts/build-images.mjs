// Convert the original illustrations in art-src/ (not in Git) to WebP in public/img/.
// Covers: 1200w (page hero) and 640w (cards). Home hero: 2304w and 1280w.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const src = path.join(root, 'art-src');
const out = path.join(root, 'public', 'img');

const jobs = [];
for (const group of ['prefectures', 'regions', 'themes']) {
  for (const f of fs.readdirSync(path.join(src, group)).filter((f) => f.endsWith('.png'))) {
    const name = f.replace(/\.png$/, '');
    for (const w of [1200, 640]) jobs.push([path.join(src, group, f), path.join(out, group, `${name}-${w}.webp`), w, w === 640 ? 72 : 78]);
  }
}
for (const w of [2304, 1280]) jobs.push([path.join(src, 'hero.png'), path.join(out, `hero-${w}.webp`), w, 78]);

let bytes = 0;
for (const [i, o, w, q] of jobs) {
  fs.mkdirSync(path.dirname(o), { recursive: true });
  if (!fs.existsSync(o) || fs.statSync(o).mtimeMs < fs.statSync(i).mtimeMs) {
    execFileSync('cwebp', ['-quiet', '-q', String(q), '-m', '6', '-resize', String(w), '0', i, '-o', o]);
  }
  bytes += fs.statSync(o).size;
}
console.log(`${jobs.length} images, ${(bytes / 1048576).toFixed(1)} MiB`);
