// Post-build: write dist/sw.js with a content-hash version and the exact /_astro/ assets
// referenced by the precached pages, so the offline shell has its CSS and JS.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dist = path.join(path.dirname(path.dirname(new URL(import.meta.url).pathname)), 'dist');
const tpl = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
const pages = JSON.parse(tpl.match(/const PRECACHE = (\[[^\n]*\]);/)[1]);
const assets = new Set();
for (const p of pages.filter((p) => p.endsWith('/'))) {
  const file = path.join(dist, p, 'index.html');
  if (!fs.existsSync(file)) throw new Error('precache page missing: ' + p);
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/(?:href|src)="(\/_astro\/[^"]+)"/g)) assets.add(m[1]);
}
// JS chunks import other chunks; follow static imports.
const queue = [...assets].filter((a) => a.endsWith('.js'));
while (queue.length) {
  const a = queue.pop();
  const src = fs.readFileSync(path.join(dist, a), 'utf8');
  for (const m of src.matchAll(/from\s*["']\.\/([^"']+\.js)["']|import\s*["']\.\/([^"']+\.js)["']/g)) {
    const dep = '/_astro/' + (m[1] || m[2]);
    if (!assets.has(dep)) { assets.add(dep); queue.push(dep); }
  }
}
const all = [...pages, ...[...assets].sort()];
const h = crypto.createHash('sha256');
for (const a of all) {
  const f = a.endsWith('/') ? path.join(dist, a, 'index.html') : path.join(dist, a);
  h.update(a).update(fs.readFileSync(f));
}
const version = h.digest('hex').slice(0, 12);
const out = tpl
  .replace(/const V = "[^"]*";/, `const V = ${JSON.stringify(version)};`)
  .replace(/const PRECACHE = \[[^\n]*\];/, `const PRECACHE = ${JSON.stringify(all)};`);
fs.writeFileSync(path.join(dist, 'sw.js'), out);
console.log(`sw.js: version ${version}, ${pages.length} pages + ${assets.size} assets precached`);
