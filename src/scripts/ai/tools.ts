import { ITEM_RE, parseItem, type Country } from '../../lib/keys';
import type { Catalog } from '../catalog';
import type { AgentDay, AgentPlan, AgentStop, OpenAiToolDef, PersonalProfile, StopKind, ToolTrace } from './types';

const id = () => globalThis.crypto?.randomUUID?.() ?? `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const text = (value: unknown, max = 500) => typeof value === 'string' ? value.slice(0, max) : undefined;
const object = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const kinds: StopKind[] = ['spot', 'food', 'transport', 'hotel', 'shopping', 'tip'];
const countries: Country[] = ['japan', 'australia', 'usa'];

export function googleMapsUrl(query: string): string {
  const url = new URL('https://www.google.com/maps/search/');
  const trimmed = query.trim();
  const safe = typeof trimmed.toWellFormed === 'function' ? trimmed.toWellFormed() : trimmed;
  // Use a URI-encoded query to preserve the same format as saved travel links.
  return `${url.href}?api=1&query=${encodeURIComponent(safe)}`;
}

const string = { type: 'string' };
const strings = { type: 'array', items: string };
const integer = (minimum: number, maximum?: number) => ({ type: 'integer', minimum, ...(maximum === undefined ? {} : { maximum }) });
const schema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const array = (items: Record<string, unknown>) => ({ type: 'array', items });
const stopSchema = schema({
  id: string, catalogKey: string, name: string, kind: { type: 'string', enum: kinds },
  timeSlot: string, duration: string, cost: string, note: string, mapQuery: string, place: string,
});
const dayFields = { title: string, place: string, stay: string, move: string, note: string, stops: array(stopSchema) };
const planSchema = schema({
  title: string, country: { type: 'string', enum: [...countries, 'mixed'] }, summary: string,
  bases: array(schema({ place: string, nights: integer(0, 60) }, ['place', 'nights'])),
  days: array(schema({ day: integer(1, 60), ...dayFields }, ['day', 'title', 'stops'])), tips: strings,
  budgetNote: string, updatedAt: integer(0),
}, ['title', 'days']);
const profileFields = ['departureCity', 'companions', 'budget', 'pace', 'avoid', 'notes'] as const;

function tool(name: string, description: string, parameters: Record<string, unknown>): OpenAiToolDef {
  return { type: 'function', function: { name, description, parameters } };
}

export const AGENT_TOOLS: OpenAiToolDef[] = [
  tool('search_catalog', 'Search verified catalog items, places, and travel guides by keyword. Copy item catalogKey values exactly into the itinerary.', schema({
    query: string, place: string, country: { type: 'string', enum: countries },
    kind: { type: 'string', enum: ['spot', 'food', 'place', 'post'] }, limit: integer(1, 20),
  }, ['query'])),
  tool('get_place_detail', 'Get verified attraction or food details by catalogKey, or a destination by place key.', schema({ catalogKey: string, place: string })),
  tool('set_itinerary', 'Replace the full itinerary. For custom stops omit catalogKey and supply name and kind.', schema({ plan: planSchema }, ['plan'])),
  tool('update_day', 'Update one itinerary day. Supplied stops replace that day’s stops.', schema({ day: integer(1, 60), ...dayFields }, ['day'])),
  tool('optimize_day_route', 'Reorder stops with catalog coordinates to reduce geographic distance. Other stops stay in their original slots.', schema({ day: integer(1, 60) }, ['day'])),
  tool('update_profile', 'Save travel preferences explicitly supplied or confirmed by the traveler.', schema({
    ...Object.fromEntries(profileFields.map((key) => [key, string])), interests: strings,
  })),
];

function catalogItem(catalog: Catalog, key: string) {
  if (!ITEM_RE.test(key)) return undefined;
  const { kind, place, href } = parseItem(key);
  const slug = key.slice(2);
  const item = kind === 'spot' ? catalog.s.find((row) => row.k === slug) : catalog.f.find((row) => row.k === slug);
  return item && { item, kind, place, href };
}

function sanitizeStop(value: unknown, catalog: Catalog): AgentStop | undefined {
  const raw = object(value);
  if (!raw) return undefined;
  const catalogKey = raw.catalogKey;
  const details = typeof catalogKey === 'string' ? catalogItem(catalog, catalogKey) : undefined;
  const kind = details?.kind ?? raw.kind as StopKind;
  const name = details?.item.n ?? text(raw.name, 160)?.trim();
  if (!name || !kinds.includes(kind)) return undefined;
  const stop: AgentStop = { id: text(raw.id, 100)?.trim() || id(), name, kind };
  if (details && typeof catalogKey === 'string') stop.catalogKey = catalogKey;
  for (const field of ['timeSlot', 'duration', 'cost', 'note'] as const) {
    const value = text(raw[field]);
    if (value !== undefined) stop[field] = value;
  }
  stop.place = details?.place ?? text(raw.place);
  stop.mapQuery = text(raw.mapQuery) || (details ? [details.item.l || name, catalog.p.find((p) => p.s === details.place)?.n].filter(Boolean).join(' ') : undefined);
  return stop;
}

function validStops(value: unknown[], catalog: Catalog): AgentStop[] {
  return value.slice(0, 30).map((stop) => sanitizeStop(stop, catalog)).filter((stop): stop is AgentStop => Boolean(stop));
}

function updateDay(day: AgentDay, raw: Record<string, unknown>, catalog: Catalog): AgentDay {
  const updated = { ...day };
  for (const field of ['title', 'place', 'stay', 'move', 'note'] as const) {
    const value = text(raw[field]);
    if (value !== undefined) updated[field] = value;
  }
  if (Array.isArray(raw.stops)) updated.stops = validStops(raw.stops, catalog);
  return updated;
}

export function sanitizePlan(value: unknown, catalog: Catalog): AgentPlan | null {
  const raw = object(value);
  const title = text(raw?.title, 160)?.trim();
  if (!raw || !title || !Array.isArray(raw.days)) return null;
  const days: AgentDay[] = [];
  const used = new Set<number>();
  for (const [index, value] of raw.days.slice(0, 60).entries()) {
    const row = object(value);
    if (!row) continue;
    let day = typeof row.day === 'number' && Number.isInteger(row.day) && row.day >= 1 && row.day <= 60 ? row.day : index + 1;
    while (used.has(day)) day = day % 60 + 1;
    used.add(day);
    days.push(updateDay({ day, title: `Day ${day}`, stops: [] }, row, catalog));
  }
  const bases: AgentPlan['bases'] = [];
  for (const value of Array.isArray(raw.bases) ? raw.bases.slice(0, 20) : []) {
    const base = object(value), place = text(base?.place, 160)?.trim();
    const nights = base?.nights;
    if (place && typeof nights === 'number' && Number.isInteger(nights) && nights >= 0 && nights <= 60) bases.push({ place, nights });
  }
  const country = raw.country as AgentPlan['country'];
  return {
    title,
    country: country === 'mixed' || countries.includes(country as Country) ? country : undefined,
    summary: text(raw.summary),
    bases,
    days: days.sort((a, b) => a.day - b.day),
    tips: Array.isArray(raw.tips) ? raw.tips.filter((tip): tip is string => typeof tip === 'string').slice(0, 30).map((tip) => tip.slice(0, 300)) : [],
    budgetNote: text(raw.budgetNote),
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) && raw.updatedAt >= 0 ? raw.updatedAt : Date.now(),
  };
}

function searchCatalog(catalog: Catalog, args: Record<string, unknown>) {
  const tokens = (text(args.query) ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const place = text(args.place)?.trim().toLowerCase();
  const destinations = new Map(catalog.p.map((row) => [row.s, row]));
  const rows = [
    ...catalog.s.filter((row) => ITEM_RE.test(`s:${row.k}`)).map((row) => ({
      kind: 'spot', catalogKey: `s:${row.k}`, name: row.n, localName: row.l, englishName: row.e,
      place: row.k.split('/')[0], description: row.d, tags: row.th,
    })),
    ...catalog.f.filter((row) => ITEM_RE.test(`f:${row.k}`)).map((row) => ({
      kind: 'food', catalogKey: `f:${row.k}`, name: row.n, localName: row.l,
      place: row.k.split('/')[0], description: row.w, price: row.pr,
    })),
    ...catalog.p.map((row) => ({
      kind: 'place', place: row.s, name: row.n, localName: row.k, englishName: row.e, description: row.d, country: row.c,
    })),
    ...(catalog.po ?? []).map((row) => ({
      kind: 'post', name: row.n, description: row.d, places: row.pl, country: row.c, tags: row.tg, href: row.u,
    })),
  ];
  const limit = typeof args.limit === 'number' && Number.isInteger(args.limit) ? Math.min(20, Math.max(1, args.limit)) : 10;
  return { items: rows.filter((row) => {
    if (args.kind && args.kind !== row.kind) return false;
    const places = 'places' in row ? row.places : [row.place];
    const labels = places.flatMap((key) => {
      const destination = destinations.get(key);
      return [key, destination?.n, destination?.k, destination?.e];
    }).filter(Boolean).join(' ').toLowerCase();
    if (place && !labels.includes(place)) return false;
    if (args.country && args.country !== ('country' in row ? row.country : destinations.get(row.place)?.c ?? parseItem(row.catalogKey).country)) return false;
    const haystack = (Object.values(row).flat().join(' ') + ' ' + labels).toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  }).slice(0, limit) };
}

type Coordinates = [number, number];
function haversine(a: Coordinates, b: Coordinates): number {
  const radians = Math.PI / 180;
  const dLat = (b[1] - a[1]) * radians, dLon = (b[0] - a[0]) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}

function optimizeRoute(stops: AgentStop[], catalog: Catalog) {
  const indexed = stops.flatMap((stop, index) => {
    const entry = stop.catalogKey ? catalogItem(catalog, stop.catalogKey) : undefined;
    const ll = entry && 'll' in entry.item ? entry.item.ll : undefined;
    return ll?.length === 2 && ll.every(Number.isFinite) && Math.abs(ll[0]) <= 180 && Math.abs(ll[1]) <= 90
      ? [{ stop, index, ll }]
      : [];
  });
  if (indexed.length < 3) return stops;
  const route = [indexed[0]], rest = indexed.slice(1);
  while (rest.length) {
    const from = route[route.length - 1].ll;
    let best = 0;
    for (let i = 1; i < rest.length; i++) {
      if (haversine(from, rest[i].ll) < haversine(from, rest[best].ll)) best = i;
    }
    route.push(rest.splice(best, 1)[0]);
  }
  for (let pass = 0; pass < route.length; pass++) {
    let improved = false;
    for (let i = 1; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const before = route[i - 1].ll, first = route[i].ll, last = route[j].ll, after = route[j + 1]?.ll;
        const old = haversine(before, first) + (after ? haversine(last, after) : 0);
        const next = haversine(before, last) + (after ? haversine(first, after) : 0);
        if (next + 0.001 < old) {
          route.splice(i, j - i + 1, ...route.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  const length = (rows: typeof indexed) => rows.slice(1).reduce((total, row, i) => total + haversine(rows[i].ll, row.ll), 0);
  if (length(route) + 0.001 >= length(indexed)) return stops;
  const ordered = [...stops];
  indexed.forEach((slot, index) => { ordered[slot.index] = route[index].stop; });
  return ordered;
}

type Context = { catalog: Catalog; plan: AgentPlan | null; profile: PersonalProfile };
type ToolResult = { resultJson: string; trace: ToolTrace; plan: AgentPlan | null; profile: PersonalProfile; planChanged: boolean; profileChanged: boolean };

export function executeAgentTool(name: string, argsJson: string, ctx: Context): ToolResult {
  let args: Record<string, unknown> | undefined;
  try { args = object(JSON.parse(argsJson)); } catch { /* Invalid arguments are returned to the model. */ }
  const { catalog, plan, profile } = ctx;
  const respond = (result: unknown, summary: string, ok: boolean, nextPlan = plan, nextProfile = profile): ToolResult => ({
    resultJson: JSON.stringify(result), trace: { id: id(), name, summary, ok }, plan: nextPlan, profile: nextProfile,
    planChanged: nextPlan !== plan, profileChanged: nextProfile !== profile,
  });
  const fail = (reason: string) => respond({ error: reason }, reason, false);
  if (!args) return fail('Invalid JSON arguments');

  switch (name) {
    case 'search_catalog': {
      const result = searchCatalog(catalog, args);
      return respond(result, `Found ${result.items.length} catalog results`, true);
    }
    case 'get_place_detail': {
      if (typeof args.catalogKey === 'string') {
        const match = catalogItem(catalog, args.catalogKey);
        if (!match) return fail('Invalid catalogKey');
        const query = [match.item.l || match.item.n, catalog.p.find((p) => p.s === match.place)?.n].filter(Boolean).join(' ');
        return respond({ catalogKey: args.catalogKey, ...match, mapUrl: googleMapsUrl(query) }, match.item.n, true);
      }
      const place = catalog.p.find((row) => row.s === args.place);
      return place ? respond({ place }, place.n, true) : fail('Unknown catalog place');
    }
    case 'set_itinerary': {
      const next = sanitizePlan(args.plan, catalog);
      if (!next) return fail('Invalid itinerary');
      next.updatedAt = Date.now();
      return respond({ ok: true, plan: next }, `Set ${next.days.length} itinerary days`, true, next);
    }
    case 'update_day':
    case 'optimize_day_route': {
      if (!plan) return fail('No current itinerary');
      const number = args.day;
      if (typeof number !== 'number' || !Number.isInteger(number) || number < 1 || number > 60) return fail('Invalid day number');
      const current = plan.days.find((day) => day.day === number);
      if (name === 'optimize_day_route' && !current) return fail('Day not found');
      const original = current ?? { day: number, title: `Day ${number}`, stops: [] };
      const stops = name === 'optimize_day_route' ? optimizeRoute(original.stops, catalog) : original.stops;
      const day = name === 'update_day' ? updateDay(original, args, catalog) : { ...original, stops };
      const changed = name === 'update_day' || stops !== original.stops;
      const next = changed ? {
        ...plan,
        days: current ? plan.days.map((row) => row === current ? day : row) : [...plan.days, day].sort((a, b) => a.day - b.day),
        updatedAt: Date.now(),
      } : plan;
      return respond({ ok: true, day, changed }, `Day ${number}`, true, next);
    }
    case 'update_profile': {
      const next = { ...profile };
      for (const key of profileFields) {
        const value = text(args[key]);
        if (value !== undefined) next[key] = value;
      }
      if (Array.isArray(args.interests)) {
        next.interests = args.interests.filter((value): value is string => typeof value === 'string').slice(0, 30).map((value) => value.slice(0, 80));
      }
      const changed = JSON.stringify(next) !== JSON.stringify(profile);
      return respond({ ok: true, profile: next }, 'Traveler profile', true, plan, changed ? next : profile);
    }
    default:
      return fail('Unknown tool');
  }
}

export function extractFallbackPlan(input: string, catalog: Catalog): { plan: AgentPlan | null; cleanText: string } {
  let plan: AgentPlan | null = null;
  const fence = /\x60{3}cbt-plan[^\S\r\n]*\r?\n([\s\S]*?)\x60{3}/gi;
  const cleanText = input.replace(fence, (_, body: string) => {
    try { plan = sanitizePlan(JSON.parse(body), catalog) ?? plan; } catch { /* Discard malformed plan payloads. */ }
    return '';
  });
  return { plan, cleanText: cleanText === input ? input : cleanText.trim() };
}
