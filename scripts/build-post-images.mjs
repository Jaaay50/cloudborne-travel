// Convert source photos to the two responsive WebP sizes used by posts.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, 'art-src', 'posts');
const output = path.join(root, 'public', 'img', 'posts');
const id = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function buildPostImages(input, out, onlySlug) {
  if (!fs.existsSync(input)) return 0;
  let count = 0;
  for (const slug of fs.readdirSync(input, { withFileTypes: true })) {
    if (!slug.isDirectory() || !id.test(slug.name) || (onlySlug && onlySlug !== slug.name)) continue;
    const folder = path.join(input, slug.name);
    const destination = path.join(out, slug.name);
    const sources = new Map();
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const ext = path.extname(entry.name);
      const name = path.basename(entry.name, ext);
      const supported = /^\.(png|jpe?g)$/i.test(ext) || (onlySlug && ext === '.webp');
      if (!entry.isFile() || !supported || !id.test(name)) continue;
      if (sources.has(name)) throw new Error(`Multiple sources for ${slug.name}/${name}`);
      sources.set(name, path.join(folder, entry.name));
    }
    for (const [name, file] of sources) {
      fs.mkdirSync(destination, { recursive: true });
      const widths = name === 'cover' ? [960, 1920] : [640, 1280];
      for (const [i, width] of widths.entries()) {
        const outputFile = path.join(destination, `${name}-${width}.webp`);
        if (!fs.existsSync(outputFile) || fs.statSync(outputFile).mtimeMs < fs.statSync(file).mtimeMs) {
          const temp = `${outputFile}.${process.pid}.tmp`;
          try {
            execFileSync('cwebp', ['-quiet', '-q', i === 0 ? '80' : '82', '-m', '6', '-sharp_yuv',
              '-resize', String(width), '0', file, '-o', temp]);
            fs.renameSync(temp, outputFile);
          } finally {
            fs.rmSync(temp, { force: true });
          }
        }
        count += 1;
      }
    }
  }
  return count;
}

const args = process.argv.slice(2);
if (args.length !== 0 && args.length !== 3) {
  console.error('Usage: node scripts/build-post-images.mjs [source-dir output-dir slug]');
  process.exitCode = 2;
} else {
  console.log('post images', buildPostImages(...(args.length ? args : [source, output])));
  if (!args.length) execFileSync(process.execPath, [path.join(root, 'scripts', 'photo-index.mjs')], { stdio: 'inherit' });
}
