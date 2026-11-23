// List the photos that exist in public/img/photos/ into src/data/photo-index.json, so pages only
// reference images that were actually generated. Keys: "<country>/<place>/<s|f>-<id>" or ".../cover".
// A key is listed only when both sizes exist (400+800 for spots/foods, 800+1600 for covers).
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const dir = path.join(root, 'public', 'img', 'photos');
const files = new Set();
const walk = (d) => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(path.join(d, f.name)) : files.add(path.relative(dir, path.join(d, f.name))); };
walk(dir);
const keys = new Set();
for (const f of files) {
  const m = f.match(/^(.+)-(400|800|1600)\.webp$/);
  if (!m) continue;
  const key = m[1];
  const need = key.endsWith('/cover') ? [800, 1600] : [400, 800];
  if (need.every((w) => files.has(`${key}-${w}.webp`))) keys.add(key);
}
const list = [...keys].sort();
fs.writeFileSync(path.join(root, 'src', 'data', 'photo-index.json'), JSON.stringify(list, null, 0) + '\n');
console.log('photos', list.length);
