// localStorage that never throws (private mode, blocked storage, corrupt values).
export function readJSON<T>(key: string, fallback: T, check: (v: unknown) => v is T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return check(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function remove(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
export const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
