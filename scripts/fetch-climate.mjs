// Build src/data/climate.json: 1996–2025 monthly averages for one representative city per place,
// from the Open-Meteo historical archive (ERA5 reanalysis, ~25 km grid, free, no key).
//   Japan: one city per prefecture (table below, keyed by PREF_SLUGS in src/lib/japan.ts).
//   Australia / USA: the `climate` field ({ city, ll }) of src/data/<country>/states/*.json.
// Per month: [mean daily max °C, mean daily min °C, mean monthly precipitation mm, mean days with ≥ 1 mm].
// Raw responses are cached gzipped in research/climate-cache/, so re-runs only fetch new places.
// Open-Meteo's free tier weighs a request by days × variables: one place (3 decades) ≈ 235 of the
// 5,000/hour and 10,000/day budget, so a cold run of ~55 places spans two days. On the hourly limit
// the script waits; on the daily limit it saves what it has and lists the rest — re-run after the reset.
//
//   node scripts/fetch-climate.mjs                      all places
//   node scripts/fetch-climate.mjs --only japan/kyoto   one place (repeatable), others kept as they are
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const OUT = path.join(root, 'src', 'data', 'climate.json');
const CACHE = path.join(root, 'research', 'climate-cache');
const SOURCE = 'Open-Meteo (ERA5), 1996–2025 平均';
const CHUNKS = [['1996-01-01', '2005-12-31'], ['2006-01-01', '2015-12-31'], ['2016-01-01', '2025-12-31']];
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum';

// Prefectural capitals (Tokyo: Chiyoda), [lon, lat].
const JAPAN = {
  hokkaido: ['札幌', [141.3544, 43.0621]], aomori: ['青森', [140.7400, 40.8244]], iwate: ['盛冈', [141.1527, 39.7036]],
  miyagi: ['仙台', [140.8719, 38.2682]], akita: ['秋田', [140.1024, 39.7186]], yamagata: ['山形', [140.3633, 38.2404]],
  fukushima: ['福岛', [140.4747, 37.7608]], ibaraki: ['水户', [140.4714, 36.3659]], tochigi: ['宇都宫', [139.8828, 36.5551]],
  gunma: ['前桥', [139.0634, 36.3895]], saitama: ['埼玉', [139.6455, 35.8617]], chiba: ['千叶', [140.1063, 35.6073]],
  tokyo: ['东京', [139.7530, 35.6894]], kanagawa: ['横滨', [139.6380, 35.4437]], niigata: ['新潟', [139.0364, 37.9161]],
  toyama: ['富山', [137.2137, 36.6959]], ishikawa: ['金泽', [136.6562, 36.5613]], fukui: ['福井', [136.2196, 36.0641]],
  yamanashi: ['甲府', [138.5684, 35.6623]], nagano: ['长野', [138.1950, 36.6485]], gifu: ['岐阜', [136.7608, 35.4232]],
  shizuoka: ['静冈', [138.3828, 34.9756]], aichi: ['名古屋', [136.9066, 35.1815]], mie: ['津', [136.5056, 34.7186]],
  shiga: ['大津', [135.8547, 35.0179]], kyoto: ['京都', [135.7681, 35.0116]], osaka: ['大阪', [135.5023, 34.6937]],
  hyogo: ['神户', [135.1955, 34.6901]], nara: ['奈良', [135.8048, 34.6851]], wakayama: ['和歌山', [135.1708, 34.2306]],
  tottori: ['鸟取', [134.2351, 35.5011]], shimane: ['松江', [133.0484, 35.4682]], okayama: ['冈山', [133.9195, 34.6551]],
  hiroshima: ['广岛', [132.4553, 34.3853]], yamaguchi: ['山口', [131.4737, 34.1781]], tokushima: ['德岛', [134.5548, 34.0703]],
  kagawa: ['高松', [134.0466, 34.3428]], ehime: ['松山', [132.7657, 33.8392]], kochi: ['高知', [133.5311, 33.5590]],
  fukuoka: ['福冈', [130.4017, 33.5902]], saga: ['佐贺', [130.3009, 33.2635]], nagasaki: ['长崎', [129.8777, 32.7503]],
  kumamoto: ['熊本', [130.7079, 32.8031]], oita: ['大分', [131.6126, 33.2382]], miyazaki: ['宫崎', [131.4239, 31.9111]],
  kagoshima: ['鹿儿岛', [130.5571, 31.5969]], okinawa: ['那霸', [127.6792, 26.2124]],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => n.toFixed(4);

function args() {
  const only = [];
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--only' && a[i + 1]) only.push(a[++i]);
    else if (a[i].startsWith('--only=')) only.push(a[i].slice(7));
    else throw new Error(`unknown argument: ${a[i]}`);
  }
  return { only };
}

function locations() {
  const src = fs.readFileSync(path.join(root, 'src', 'lib', 'japan.ts'), 'utf8');
  const slugs = [...(src.match(/PREF_SLUGS\s*=\s*\[([^\]]+)\]/)?.[1] ?? '').matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  if (slugs.length !== 47) throw new Error(`expected 47 PREF_SLUGS in src/lib/japan.ts, found ${slugs.length}`);
  const extra = Object.keys(JAPAN).filter((s) => !slugs.includes(s));
  if (extra.length) throw new Error(`city table has unknown slugs: ${extra.join(', ')}`);
  const list = slugs.map((s) => {
    if (!JAPAN[s]) throw new Error(`no city for prefecture ${s}`);
    return { key: `japan/${s}`, city: JAPAN[s][0], ll: JAPAN[s][1] };
  });
  for (const country of ['australia', 'usa']) {
    const dir = path.join(root, 'src', 'data', country, 'states');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const c = j.climate;
      const ok = c && typeof c.city === 'string' && Array.isArray(c.ll) && c.ll.length === 2 &&
        Math.abs(c.ll[0]) <= 180 && Math.abs(c.ll[1]) <= 90 && c.ll.every(Number.isFinite);
      if (!ok) { console.warn(`skip ${country}/${f}: no valid "climate": { "city", "ll": [lon, lat] }`); continue; }
      list.push({ key: `${country}/${j.slug || f.replace(/\.json$/, '')}`, city: c.city, ll: [+c.ll[0].toFixed(4), +c.ll[1].toFixed(4)] });
    }
  }
  return list;
}

class LimitError extends Error {}

// Sequential requests; pace by the per-minute budget in the response headers, back off on 429/5xx.
const rate = { remaining: Infinity, reset: 0, cost: 0, used: 0 };
async function request(url) {
  for (let attempt = 0, hourly = 0; ; attempt++) {
    if (rate.remaining < rate.cost + 20) {
      const wait = Math.max(1000, rate.reset * 1000 - Date.now() + 1500);
      await sleep(Math.min(wait, 65_000));
      rate.remaining = Infinity;
    }
    let res;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    } catch (e) {
      if (attempt >= 5) throw e;
      const wait = 5000 * 2 ** attempt;
      console.warn(`  network error (${e.cause?.code ?? e.name}), retry in ${wait / 1000} s`);
      await sleep(wait);
      continue;
    }
    const h = res.headers;
    if (h.get('x-ratelimit-remaining')) rate.remaining = +h.get('x-ratelimit-remaining');
    if (h.get('x-ratelimit-reset')) rate.reset = +h.get('x-ratelimit-reset');
    if (h.get('x-ratelimit-cost')) rate.cost = +h.get('x-ratelimit-cost');
    if (res.ok) {
      const text = await res.text();
      rate.used += rate.cost;
      return text;
    }
    const body = await res.text();
    const reason = (() => { try { return JSON.parse(body).reason ?? ''; } catch { return ''; } })();
    if (res.status === 429) {
      // The 429 carries the window that ran out; wait for its reset instead of polling.
      const until = rate.reset * 1000 + 2000;
      const at = new Date(until).toLocaleTimeString('zh-CN', { hour12: false });
      if (/daily/i.test(reason)) throw new LimitError(`daily limit, resets about ${at}`);
      if (++hourly > 3) throw new LimitError(reason);
      const wait = Math.min(Math.max(until - Date.now(), 65_000), 3_700_000);
      console.warn(`  ${/hourly/i.test(reason) ? 'hourly' : 'minute'} limit reached, waiting until ${new Date(Date.now() + wait).toLocaleTimeString('zh-CN', { hour12: false })}`);
      await sleep(wait);
      attempt = -1;
      continue;
    }
    if (res.status >= 500 && attempt < 5) {
      const wait = 5000 * 2 ** attempt;
      console.warn(`  HTTP ${res.status}, retry in ${wait / 1000} s`);
      await sleep(wait);
      continue;
    }
    throw new Error(`HTTP ${res.status} ${reason || body.slice(0, 200)}`);
  }
}

async function chunk(loc, [start, end], stats) {
  const [lon, lat] = loc.ll;
  const file = path.join(CACHE, `${loc.key.replace('/', '-')}_${fmt(lat)}_${fmt(lon)}_era5_${start.slice(0, 4)}-${end.slice(0, 4)}.json.gz`);
  if (fs.existsSync(file)) { stats.cached++; return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')); }
  if (limit) throw new LimitError(limit); // quota gone: only cached places can still be built
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${fmt(lat)}&longitude=${fmt(lon)}` +
    `&start_date=${start}&end_date=${end}&daily=${DAILY}&timezone=auto&models=era5`;
  const text = await request(url);
  const j = JSON.parse(text);
  const d = j.daily;
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  if (!d || d.time?.length !== days || !d.temperature_2m_max || !d.temperature_2m_min || !d.precipitation_sum) {
    throw new Error(`unexpected response for ${loc.key} ${start}: ${text.slice(0, 200)}`);
  }
  fs.writeFileSync(file, zlib.gzipSync(text, { level: 9 }));
  stats.fetched++;
  await sleep(1500);
  return j;
}

function monthly(responses) {
  const acc = Array.from({ length: 12 }, () => ({ days: 0, hi: [0, 0], lo: [0, 0], p: [0, 0], wet: 0 }));
  const years = new Set();
  for (const { daily: d } of responses) {
    d.time.forEach((t, i) => {
      const a = acc[+t.slice(5, 7) - 1];
      years.add(t.slice(0, 4));
      a.days++;
      const hi = d.temperature_2m_max[i], lo = d.temperature_2m_min[i], p = d.precipitation_sum[i];
      if (hi != null) { a.hi[0] += hi; a.hi[1]++; }
      if (lo != null) { a.lo[0] += lo; a.lo[1]++; }
      if (p != null) { a.p[0] += p; a.p[1]++; if (p >= 1) a.wet++; }
    });
  }
  const r1 = (x) => Math.round(x * 10) / 10 || 0;
  return acc.map((a) => {
    const perMonth = a.days / years.size; // average days in this month
    if (a.hi[1] < a.days * 0.9 || a.lo[1] < a.days * 0.9 || a.p[1] < a.days * 0.9) throw new Error('too many missing days');
    return [r1(a.hi[0] / a.hi[1]), r1(a.lo[0] / a.lo[1]), Math.round((a.p[0] / a.p[1]) * perMonth), Math.round((a.wet / a.p[1]) * perMonth)];
  });
}

function write(places, order) {
  const keys = [...order.filter((k) => places[k]), ...Object.keys(places).filter((k) => !order.includes(k)).sort()];
  const lines = keys.map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(places[k])}`);
  fs.writeFileSync(OUT, `{\n  "source": ${JSON.stringify(SOURCE)},\n  "places": {\n${lines.join(',\n')}\n  }\n}\n`);
}

const { only } = args();
const all = locations();
const known = new Set(all.map((l) => l.key));
const bad = only.filter((k) => !known.has(k));
if (bad.length) throw new Error(`unknown --only key(s): ${bad.join(', ')} (known: japan/<pref>, australia/<state>, usa/<state>)`);
const todo = only.length ? all.filter((l) => only.includes(l.key)) : all;

fs.mkdirSync(CACHE, { recursive: true });
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).places ?? {} : {};
// --only keeps every other existing entry; a full run drops entries whose place no longer exists.
const places = only.length ? { ...prev } : Object.fromEntries(Object.entries(prev).filter(([k]) => known.has(k)));
const stats = { fetched: 0, cached: 0 };
const pending = [];
const failed = [];
let limit = '';

for (const [i, loc] of todo.entries()) {
  try {
    const res = [];
    for (const c of CHUNKS) res.push(await chunk(loc, c, stats));
    places[loc.key] = { city: loc.city, ll: loc.ll, m: monthly(res) };
    const m = places[loc.key].m;
    console.log(`${String(i + 1).padStart(2)}/${todo.length} ${loc.key} ${loc.city}  1月 ${m[0][0]}/${m[0][1]}  7月 ${m[6][0]}/${m[6][1]}  年降水 ${m.reduce((s, x) => s + x[2], 0)} mm`);
  } catch (e) {
    if (e instanceof LimitError) { limit = e.message; pending.push(loc.key); if (places[loc.key]) console.log(`   ${loc.key}: kept previous data`); continue; }
    failed.push(`${loc.key}: ${e.message}`);
    console.error(`  ${loc.key} failed: ${e.message}`);
  }
  if (i % 5 === 4) write(places, all.map((l) => l.key)); // keep progress if interrupted
}
write(places, all.map((l) => l.key));

const size = fs.statSync(OUT).size;
console.log(`\n${Object.keys(places).length} places in src/data/climate.json (${(size / 1024).toFixed(1)} KiB)`);
console.log(`chunks: ${stats.fetched} fetched, ${stats.cached} from cache; API weight used ≈ ${Math.round(rate.used)}`);
if (failed.length) console.log(`failed (${failed.length}):\n  ${failed.join('\n  ')}`);
if (pending.length) console.log(`not fetched yet (${pending.length}, ${limit}): ${pending.join(' ')}\nre-run later; cached chunks are not fetched again.`);
const missing = all.filter((l) => !places[l.key]).map((l) => l.key);
if (missing.length && !pending.length && !only.length) console.log(`missing: ${missing.join(' ')}`);
process.exitCode = failed.length || pending.length ? 2 : 0;
