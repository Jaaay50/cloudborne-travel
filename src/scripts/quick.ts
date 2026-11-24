// Quick planner: turns a handful of multiple-choice answers into a day-by-day draft trip.
// Pure functions over the client catalogue so it runs offline and instantly.
import type { Catalog, CatPref, CatSpot } from './catalog';
import { ct } from './i18n';

export interface QuickAnswers {
  country: 'japan' | 'australia' | 'usa';
  month: number; // 1-12, 0 = not sure
  days: number;
  people: 'solo' | 'couple' | 'family' | 'friends' | 'elders';
  budget: 'save' | 'mid' | 'lux';
  pace: 'easy' | 'normal' | 'packed';
  likes: string[]; // theme slugs or 'food'
  first: boolean; // first time in this country
}

export interface QuickDay { place: string; items: string[]; note?: string }
export interface QuickPlan { title: string; days: QuickDay[]; bases: { place: string; nights: number }[]; tips: string[] }

const dist = (a: [number, number], b: [number, number]) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const centroid = (pts: [number, number][]): [number, number] =>
  pts.length ? [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length] : [0, 0];

// Places first-timers usually start with.
const CLASSICS: Record<string, string[]> = {
  japan: ['tokyo', 'kyoto', 'osaka', 'nara', 'kanagawa', 'hokkaido', 'okinawa', 'hiroshima', 'fukuoka'],
  australia: ['au.new-south-wales', 'au.victoria', 'au.queensland', 'au.tasmania', 'au.northern-territory', 'au.western-australia', 'au.south-australia'],
  usa: ['us.california', 'us.new-york', 'us.nevada', 'us.arizona', 'us.utah', 'us.hawaii', 'us.washington-dc', 'us.florida'],
};

/** Score every place for these answers. */
function scorePlaces(cat: Catalog, a: QuickAnswers) {
  const tw = cat.tw[a.country] ?? {};
  const classics = CLASSICS[a.country] ?? [];
  const spotsBy = new Map<string, CatSpot[]>();
  for (const s of cat.s) {
    const pk = s.k.split('/')[0];
    if (!spotsBy.has(pk)) spotsBy.set(pk, []);
    spotsBy.get(pk)!.push(s);
  }
  const inSeason = (theme: string) => !a.month || !tw[theme] || tw[theme].includes(a.month);
  // Spots closed in the travel month (alpine roads, seasonal parks) are left out entirely.
  const isOpen = (s: CatSpot) => !a.month || !s.o || s.o.includes(a.month);
  return cat.p.filter((p) => p.c === a.country).map((p) => {
    const spots = (spotsBy.get(p.s) ?? []).filter(isOpen);
    let sc = 0;
    if (a.month && p.m.includes(a.month)) sc += 6;
    else if (a.month && p.m.length) sc -= 2;
    for (const s of spots) {
      for (const t of s.th) if (a.likes.includes(t) && inSeason(t)) sc += 2.2;
      for (const t of s.th) if (!inSeason(t) && s.th.length === 1) sc -= 0.6;
    }
    if (a.first) { const i = classics.indexOf(p.s); if (i >= 0) sc += 8 - i * 0.6; }
    else if (classics.slice(0, 3).includes(p.s)) sc -= 1;
    if (a.people === 'family' || a.people === 'elders') sc -= spots.filter((s) => s.d === 'hiking').length * 0.8;
    if (a.people === 'family' && spots.some((s) => s.th.includes('family') || s.d === 'theme-park' || s.d === 'wildlife')) sc += 2;
    sc += Math.min(spots.length, 8) * 0.25;
    return { p, spots, sc, ll: centroid(spots.map((s) => s.ll)) };
  }).filter((x) => x.spots.length > 0).sort((x, y) => y.sc - x.sc);
}

/** How many bases (overnight places) fit the trip length and pace. */
const baseCount = (days: number, pace: QuickAnswers['pace']) => {
  const per = pace === 'easy' ? 3.5 : pace === 'normal' ? 2.6 : 2;
  return Math.max(1, Math.min(6, Math.round(days / per)));
};

export function buildPlan(cat: Catalog, a: QuickAnswers, variant = 0): QuickPlan {
  const ranked = scorePlaces(cat, a);
  // "换一版": rotate which strong place anchors the trip, without changing the user's answers.
  if (variant > 0 && ranked.length > 1) {
    const top = ranked.slice(0, Math.min(4, ranked.length));
    const pick = top[variant % top.length];
    ranked.splice(ranked.indexOf(pick), 1);
    ranked.unshift(pick);
  }
  if (!ranked.length) return { title: ct('我的行程'), days: Array.from({ length: a.days }, () => ({ place: '', items: [] })), bases: [], tips: [] };
  const want = baseCount(a.days, a.pace);
  // Greedy pick: best place first, then good places that are not too far from what we have.
  // Distances are between spot centroids; domestic flights make longer hops OK in AU / US.
  const maxKm = a.country === 'japan' ? (a.days >= 9 ? 750 : 420) : a.days <= 5 ? 800 : a.days <= 8 ? 1300 : 2600;
  // First-timers get the country's best classic as the anchor (Tokyo / Sydney / California…).
  const classics = CLASSICS[a.country] ?? [];
  const anchor = a.first && a.days >= 4 && variant === 0
    ? ranked.filter((r) => classics.slice(0, 3).includes(r.p.s)).sort((x, y) => y.sc - x.sc)[0] ?? ranked[0]
    : ranked[0];
  const chosen = [anchor];
  // Keep the whole trip within a sensible span so short trips don't zig-zag across the country.
  const span = a.country === 'japan' ? (a.days <= 5 ? 300 : a.days <= 8 ? 520 : 900) : a.days <= 5 ? 900 : a.days <= 8 ? 2200 : 4200;
  for (const r of ranked) {
    if (chosen.length >= want) break;
    if (chosen.includes(r)) continue;
    const near = Math.min(...chosen.map((c) => dist(c.ll, r.ll)));
    const far = Math.max(...chosen.map((c) => dist(c.ll, r.ll)));
    if (far > span) continue;
    if (near > maxKm && !(a.days >= 10 && r.sc > ranked[0].sc * 0.7)) continue;
    // Skip tiny neighbours that the stronger base already covers (e.g. Nara from Kyoto) unless the trip is long.
    if (near < 60 && a.days < 6 && r.sc < chosen[0].sc * 0.8) continue;
    chosen.push(r);
  }
  // Order bases along a path: start from the base farthest from the centroid, then nearest neighbour.
  const mid = centroid(chosen.map((c) => c.ll));
  const order = [chosen.reduce((f, c) => (dist(c.ll, mid) > dist(f.ll, mid) ? c : f), chosen[0])];
  const rest = chosen.filter((c) => c !== order[0]);
  while (rest.length) {
    const last = order[order.length - 1];
    rest.sort((x, y) => dist(last.ll, x.ll) - dist(last.ll, y.ll));
    order.push(rest.shift()!);
  }
  // Nights per base: by score, but never more than the place's spots can fill (and at most 5),
  // so no day is left empty. If every base is full, add the next-best nearby place.
  const perDay = a.pace === 'easy' ? 1.6 : a.pace === 'normal' ? 2.2 : 3;
  const capOf = (o: (typeof ranked)[number]) => Math.max(1, Math.min(5, Math.ceil(o.spots.length / perDay)));
  const total = a.days;
  const fill = () => {
    const weights = order.map((o) => Math.max(1, o.sc));
    const caps = order.map(capOf);
    const n = order.map(() => 1);
    let left = total - n.length;
    while (left > 0) {
      let best = -1;
      order.forEach((_, i) => { if (n[i] < caps[i] && (best < 0 || weights[i] / n[i] > weights[best] / n[best])) best = i; });
      if (best < 0) break;
      n[best]++; left--;
    }
    return { n, left };
  };
  let { n: nights, left } = fill();
  while (left > 0 && order.length < 8) {
    // Every base is full: add the nearest unused place to the last base (re-ordering the path).
    const last = order[order.length - 1];
    const extra = ranked.filter((r) => !order.includes(r)).sort((x, y) => dist(last.ll, x.ll) - dist(last.ll, y.ll) - (y.sc - x.sc) * 40)[0];
    if (!extra) break;
    order.push(extra);
    ({ n: nights, left } = fill());
  }
  // Caps count spots, but the day loop may still run dry (long spots, travel days): trim nights
  // where a base cannot fill them and hand them to the base with the most unused spots.
  const room = (i: number) => order[i].spots.length - nights[i] * perDay;
  if (left > 0) nights[nights.length - 1] += left; // tiny countries: allow a free day rather than lose days
  for (let guard = 0; guard < 20; guard++) {
    const worst = nights.findIndex((n, i) => n > 1 && room(i) < 0);
    if (worst < 0) break;
    let best = -1;
    nights.forEach((_, i) => { if (i !== worst && room(i) >= 1 && (best < 0 || room(i) > room(best))) best = i; });
    if (best < 0) {
      // No base has spare spots: bring in the nearest unused place for the extra night.
      const from = order[worst];
      const extra = ranked.filter((r) => !order.includes(r) && r.spots.length >= 2).sort((x, y) => dist(from.ll, x.ll) - dist(from.ll, y.ll))[0];
      if (!extra || order.length >= 8) break;
      order.splice(worst + 1, 0, extra);
      nights.splice(worst + 1, 0, 0);
      best = worst + 1;
    }
    nights[worst]--; nights[best]++;
  }
  // Keep the trip shorter than the request only if we truly ran out of places; the counts always add up.
  while (order.length > nights.length) order.pop();

  const budgetH = a.pace === 'easy' ? 5 : a.pace === 'normal' ? 7 : 9;
  const maxSpots = a.pace === 'easy' ? 2 : a.pace === 'normal' ? 3 : 4;
  const tw = cat.tw[a.country] ?? {};
  const inSeason = (t: string) => !a.month || !tw[t] || tw[t].includes(a.month);
  const foodsBy = (pk: string) => cat.f.filter((f) => f.k.startsWith(pk + '/'));
  const days: QuickDay[] = [];
  order.forEach((o, bi) => {
    // Rank this base's spots for the answers.
    const scored = [...o.spots].map((s, idx) => {
      // Files list the best-known spots first; first-timers lean on that order more.
      let sc = 1 + ((o.spots.length - idx) / o.spots.length) * (a.first ? 3 : 1.2) + (a.first && idx === 0 ? 3 : a.first && idx === 1 ? 1.5 : 0);
      for (const t of s.th) { if (a.likes.includes(t)) sc += inSeason(t) ? 3 : -2; else if (!inSeason(t)) sc -= 1; }
      if ((a.people === 'elders' || a.people === 'family') && (s.d === 'hiking' || s.h[0] >= 6)) sc -= 2.5;
      if (a.budget === 'save' && s.x) sc -= 0.5;
      return { s, sc };
    }).sort((x, y) => y.sc - x.sc);
    // Stay around one hub (the best spot) so days at the same base don't sit hundreds of km apart.
    const hub = scored[0].s.ll;
    const hubKm = a.country === 'japan' ? 110 : 320;
    const near = scored.filter((x) => dist(hub, x.s.ll) <= hubKm);
    const pool = near.length >= Math.min(scored.length, nights[bi] * 2) ? near : scored.sort((x, y) => dist(hub, x.s.ll) - dist(hub, y.s.ll) || y.sc - x.sc);
    const spots = pool.sort((x, y) => y.sc - x.sc - (dist(hub, y.s.ll) - dist(hub, x.s.ll)) / (hubKm * 2)).map((x) => x.s);
    // Spots outside the hub radius are a reserve for days that would otherwise be empty.
    const reserve = scored.map((x) => x.s).filter((x) => !spots.includes(x));
    const foods = foodsBy(o.p.s);
    let foodI = 0;
    const isTravelDay = (d: number) => bi > 0 && d === 0;
    for (let d = 0; d < nights[bi]; d++) {
      const day: QuickDay = { place: o.p.s, items: [] };
      let h = isTravelDay(d) ? budgetH - 3 : budgetH;
      // Route inside the day: start from the first remaining spot and take the nearest next ones.
      let cur: CatSpot | undefined;
      if (!spots.length && reserve.length) spots.push(reserve.shift()!);
      while (spots.length && day.items.filter((k) => k[0] === 's').length < (isTravelDay(d) ? Math.max(1, maxSpots - 1) : maxSpots)) {
        let idx = 0;
        if (cur) {
          let best = Infinity;
          spots.slice(0, 6).forEach((s, i) => { const km = dist(cur!.ll, s.ll); if (km < best) { best = km; idx = i; } });
        }
        const s = spots[idx];
        const t = s.h[0];
        if (day.items.length && t > h + 0.5) break;
        spots.splice(idx, 1);
        day.items.push(`s:${s.k}`);
        h -= t;
        cur = s;
        if (h <= 0.5) break;
      }
      if (foods.length && (a.likes.includes('food') || foodI < foods.length) && (foodI < foods.length)) {
        if (a.likes.includes('food') || d % 2 === 0) day.items.push(`f:${foods[foodI++].k}`);
      }
      if (isTravelDay(d)) day.note = ct('从{a}到{b}', { a: placeName(cat, order[bi - 1].p), b: placeName(cat, o.p) });
      else if (!day.items.some((k) => k[0] === 's')) day.note = ct('自由活动，或去周边转转');
      days.push(day);
    }
  });

  const names = order.map((o) => placeName(cat, o.p));
  const tips: string[] = [];
  if (order.length >= 3) tips.push(ct('这趟换 {n} 个地方住，行李尽量轻。', { n: order.length }));
  if (a.people === 'elders') tips.push(ct('每天留出午休时间，长距离移动尽量放在上午。'));
  if (a.people === 'family') tips.push(ct('带孩子的话，每天只排一个重点，其余随缘。'));
  if (a.budget === 'save') tips.push(ct('提前一个月以上订住宿和交通，价格差别很大。'));
  if (a.country !== 'japan') tips.push(ct('点下面的「出行须知」看签证和入境要求。'));
  return {
    title: `${names.slice(0, 3).join(' · ')} ${ct('{n} 天', { n: a.days })}`,
    days,
    bases: order.map((o, i) => ({ place: o.p.s, nights: nights[i] })),
    tips,
  };
}

const placeName = (cat: Catalog, p: CatPref) => cat.p.find((x) => x.s === p.s)?.n ?? p.n;
