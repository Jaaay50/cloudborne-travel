// Fetch today's CNY exchange rates into src/data/rates.json (run before the build; the daily
// GitHub Actions build keeps them fresh). On any failure the committed file is kept as is.
import fs from 'node:fs';

const out = new URL('../src/data/rates.json', import.meta.url);
try {
  const ctrl = AbortSignal.timeout(15000);
  const r = await fetch('https://open.er-api.com/v6/latest/CNY', { signal: ctrl });
  const d = await r.json();
  if (d.result !== 'success') throw new Error('bad response');
  const pick = { JPY: d.rates.JPY, AUD: d.rates.AUD, USD: d.rates.USD };
  if (!Object.values(pick).every((v) => typeof v === 'number' && v > 0)) throw new Error('missing rates');
  const date = new Date(d.time_last_update_unix * 1000).toISOString().slice(0, 10);
  fs.writeFileSync(out, JSON.stringify({ base: 'CNY', date, rates: { JPY: +pick.JPY.toFixed(3), AUD: +pick.AUD.toFixed(4), USD: +pick.USD.toFixed(4) } }, null, 2) + '\n');
  console.log('rates', date, pick);
} catch (e) {
  console.warn('rates: keeping the committed file:', e.message);
}
