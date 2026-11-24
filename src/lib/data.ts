// Content JSON per language. Chinese originals live in src/data/**; scripts/i18n.py build writes the
// English and Japanese copies to src/i18n/<lang>/** with the same relative paths and shapes.
// A file missing in a language falls back to Chinese.
import { lang, runLang, type Lang } from './i18n';

const ZH = import.meta.glob<unknown>(['../data/**/*.json', '!../data/geo/**'], { eager: true, import: 'default' });
const TR = import.meta.glob<unknown>(['../i18n/en/**/*.json', '../i18n/ja/**/*.json', '!../i18n/*/_ui.json'], { eager: true, import: 'default' });

const zhKey = (rel: string) => `../data/${rel}`;
const trKey = (l: Lang, rel: string) => `../i18n/${l}/${rel}`;

/** One content file, e.g. dataFile('japan/prefectures/kyoto.json'). */
export function dataFile<T>(rel: string, l: Lang = lang()): T | undefined {
  if (l !== 'zh') {
    const v = TR[trKey(l, rel)];
    if (v !== undefined) return v as T;
  }
  return ZH[zhKey(rel)] as T | undefined;
}

/** All files in a folder (not recursive), in file-name order. */
export function dataDir<T>(dir: string, l: Lang = lang()): T[] {
  const prefix = zhKey(dir.replace(/\/?$/, '/'));
  return Object.keys(ZH)
    .filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
    .sort()
    .map((k) => dataFile<T>(k.slice('../data/'.length), l)!);
}

/** Memoise a value per language (content views are rebuilt once per language, not per page).
 *  make() runs with that language set, so anything it reads (live exports, t()) matches. */
export function perLang<T>(make: (l: Lang) => T): (l?: Lang) => T {
  const cache = new Map<Lang, T>();
  return (l = lang()) => {
    if (!cache.has(l)) cache.set(l, runLang(l, () => make(l)));
    return cache.get(l)!;
  };
}

/** A value that always reads as the current language's version (for module-level exports like `prefs`).
 *  The proxy target is an empty array / object so no proxy invariant ties it to one language. */
export function live<T extends object>(get: (l: Lang) => T): T {
  const current = perLang(get);
  const target = (Array.isArray(current('zh')) ? [] : {}) as T;
  return new Proxy(target, {
    get: (_t, key) => {
      const cur = current();
      const v = Reflect.get(cur, key);
      return typeof v === 'function' ? v.bind(cur) : v;
    },
    has: (_t, key) => Reflect.has(current(), key),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_t, key) => Reflect.getOwnPropertyDescriptor(current(), key),
  });
}
