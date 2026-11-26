// Index complete pairs of generated photos, so pages only reference available images.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function indexPhotos(folder, filename, depth) {
  const dir = path.join(root, 'public', 'img', folder);
  const files = new Set();
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.isFile()) files.add(path.relative(dir, p).split(path.sep).join('/'));
    }
  }
  walk(dir);
  const keys = new Set();
  for (const f of files) {
    const m = f.match(/^(.+)-(640|960|1280|1920)\.webp$/);
    if (!m) continue;
    const key = m[1];
    if (key.split('/').length !== depth) continue;
    const need = key.endsWith('/cover') ? [960, 1920] : [640, 1280];
    if (need.every((w) => files.has(`${key}-${w}.webp`))) keys.add(key);
  }
  const list = [...keys].sort();
  fs.writeFileSync(path.join(root, 'src', 'data', filename), JSON.stringify(list) + '\n');
  console.log(folder, list.length);
}

indexPhotos('photos', 'photo-index.json', 3);
indexPhotos('posts', 'post-photo-index.json', 2);
