// Trip state kept in localStorage. Items are "s:<place>/<spot>" (spot) or "f:<place>/<food>" (food); see lib/keys.ts.
import { ITEM_RE } from '../lib/keys';
export interface TripState {
  v: 1;
  title: string;
  start: string | null; // yyyy-mm-dd
  days: string[][];
  pool: string[]; // saved but not yet scheduled
  notes: Record<string, string>;
}

const KEY = 'cbt.trip.v1';
const listeners = new Set<(s: TripState) => void>();

export const emptyTrip = (): TripState => ({ v: 1, title: '我的行程', start: null, days: [[]], pool: [], notes: {} });

function sanitize(raw: unknown): TripState {
  const s = emptyTrip();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Partial<TripState>;
  const ok = (k: unknown): k is string => typeof k === 'string' && ITEM_RE.test(k);
  if (typeof r.title === 'string') s.title = r.title.slice(0, 40);
  // Accept only real calendar dates (rejects 2026-13-45): the date must survive a UTC round trip unchanged.
  if (typeof r.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.start)) {
    const d = new Date(r.start + 'T00:00:00Z');
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === r.start) s.start = r.start;
  }
  const seen = new Set<string>();
  const take = (arr: unknown) => (Array.isArray(arr) ? arr.filter((k) => ok(k) && !seen.has(k) && seen.add(k)) : []);
  if (Array.isArray(r.days)) s.days = r.days.slice(0, 30).map(take);
  if (!s.days.length) s.days = [[]];
  s.pool = take(r.pool);
  if (r.notes && typeof r.notes === 'object') {
    for (const [k, v] of Object.entries(r.notes)) if (seen.has(k) && typeof v === 'string') s.notes[k] = v.slice(0, 120);
  }
  return s;
}

// In-memory copy used when localStorage is blocked or full, so the session still works.
let memory: TripState | null = null;
export let persistent = true;

export function load(): TripState {
  if (memory) return sanitize(memory);
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) || 'null'));
  } catch {
    return emptyTrip();
  }
}

/** Returns false when the trip could only be kept in memory (private mode, storage full). */
export function save(s: TripState): boolean {
  const clean = sanitize(s);
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
    memory = null;
    persistent = true;
  } catch {
    memory = clean;
    persistent = false;
  }
  listeners.forEach((fn) => fn(clean));
  return persistent;
}

export const subscribe = (fn: (s: TripState) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const allKeys = (s: TripState) => [...s.pool, ...s.days.flat()];
export const count = (s: TripState) => allKeys(s).length;
export const has = (s: TripState, key: string) => allKeys(s).includes(key);

export function toggle(key: string): boolean {
  const s = load();
  if (has(s, key)) {
    s.pool = s.pool.filter((k) => k !== key);
    s.days = s.days.map((d) => d.filter((k) => k !== key));
    delete s.notes[key];
    save(s);
    return false;
  }
  s.pool.push(key);
  save(s);
  return true;
}

// Cross-tab sync.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) listeners.forEach((fn) => fn(load()));
});

// ---- share links: state -> base64url(deflate(json)) in the URL hash ----
const b64url = (bytes: Uint8Array) => {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const MAX_SHARE_BYTES = 64 * 1024;
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = Infinity) {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > limit) { await reader.cancel(); throw new Error('share data too large'); }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export async function encodeShare(s: TripState): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify({ t: s.title, st: s.start, d: s.days, p: s.pool, n: s.notes }));
  if ('CompressionStream' in window) return 'z' + b64url(await pipe(json, new CompressionStream('deflate-raw')));
  return 'j' + b64url(json);
}

export async function decodeShare(code: string): Promise<TripState | null> {
  try {
    const kind = code[0];
    if (code.length > 20000) return null;
    let bytes = unb64url(code.slice(1));
    if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'), MAX_SHARE_BYTES);
    else if (kind !== 'j') return null;
    const o = JSON.parse(new TextDecoder().decode(bytes));
    return sanitize({ title: o.t, start: o.st, days: o.d, pool: o.p, notes: o.n });
  } catch {
    return null;
  }
}
