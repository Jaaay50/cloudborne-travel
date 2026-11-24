// Build-time language support. Chinese pages live at /, English at /en/, Japanese at /ja/.
// The middleware runs every page render inside runLang(), so lang() / t() work anywhere during a render
// (components, lib functions) without passing the language around.
//
// t('中文原文', { n: 3 }) returns the translation from src/i18n/<lang>/_ui.json (machine translated by
// scripts/i18n.py, overridden by src/i18n/ui-overrides.json) with {placeholders} filled in.
// Chinese stays the source of truth: a string without a translation falls back to Chinese.
// @ts-ignore -- Node built-in; the project has no @types/node and this module only runs at build time.
import { AsyncLocalStorage } from 'node:async_hooks';
import enUi from '../i18n/en/_ui.json';
import jaUi from '../i18n/ja/_ui.json';
import overrides from '../i18n/ui-overrides.json';
import uiSource from '../i18n/ui-source.json';

export type Lang = 'zh' | 'en' | 'ja';
export const LANGS: Lang[] = ['zh', 'en', 'ja'];
export const HTML_LANG: Record<Lang, string> = { zh: 'zh-Hans', en: 'en', ja: 'ja' };
export const LANG_LABEL: Record<Lang, string> = { zh: '中文', en: 'English', ja: '日本語' };
export const LANG_SHORT: Record<Lang, string> = { zh: '中', en: 'EN', ja: '日' };
export const LOCALE: Record<Lang, string> = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' };

interface Store { run<T>(l: Lang, fn: () => T): T; getStore(): Lang | undefined }
const als: Store = new AsyncLocalStorage();
export const runLang = <T>(l: Lang, fn: () => T): T => als.run(l, fn);
export const lang = (): Lang => als.getStore() ?? 'zh';

const DICT: Record<'en' | 'ja', Record<string, string>> = {
  en: { ...(enUi as Record<string, string>), ...(overrides.en as Record<string, string>) },
  ja: { ...(jaUi as Record<string, string>), ...(overrides.ja as Record<string, string>) },
};

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

// English singulars: when vars.n === 1 and the dictionary has "<zh>|1", that form is used ("1 day").
export function t(zh: string, vars?: Record<string, string | number>): string {
  const l = lang();
  if (l === 'zh') return fill(zh, vars);
  const one = vars && vars.n === 1 ? DICT[l][`${zh}|1`] : undefined;
  return fill(one ?? DICT[l][zh] ?? zh, vars);
}
/** Translate a string that is not a literal at the call site (constant tables, data). */
export const tr = (zh: string) => {
  const l = lang();
  return l === 'zh' ? zh : DICT[l][zh] ?? zh;
};

/** Path in the current (or given) language: "/japan/" -> "/en/japan/". */
export const L = (path: string, l: Lang = lang()) =>
  l === 'zh' || !path.startsWith('/') || path.startsWith('//') || /^\/(en|ja)\//.test(path) ? path : `/${l}${path}`;

/** Strip the language prefix: "/en/japan/" -> "/japan/". */
export const basePath = (path: string) => path.replace(/^\/(en|ja)(?=\/)/, '');

/** getStaticPaths for a page that exists in every language. */
export const langPaths = () => LANGS.map((l) => ({ params: { lang: l === 'zh' ? undefined : l } }));
export const langOf = (param: string | undefined): Lang => (param === 'en' || param === 'ja' ? param : 'zh');

/** Pages that a language does not have (Japanese readers get no Japanese phrase cards). */
export const MISSING: Record<Lang, string[]> = { zh: ['/404/'], en: [], ja: ['/japan/tools/phrases/'] };
export const hasPage = (l: Lang, path: string) => !MISSING[l].includes(basePath(path).replace(/[?#].*$/, ''));

/** Strings the browser scripts need, for the current language (embedded once per page). */
export function clientDict(): Record<string, string> {
  const l = lang();
  if (l === 'zh') return {};
  const out: Record<string, string> = {};
  for (const s of (uiSource as { client?: string[] }).client ?? []) {
    const v = DICT[l][s];
    if (v && v !== s) out[s] = v;
    if (DICT[l][`${s}|1`]) out[`${s}|1`] = DICT[l][`${s}|1`];
  }
  return out;
}

// ---------------- translated views of constant tables ----------------
// translated(obj) returns a read-only view whose Chinese string leaves come back through tr().
// Views are cached per object, so identity checks (includes, ===) keep working.
const views = new WeakMap<object, object>();
const HAN = /[㐀-鿿]/;
export function translated<T extends object>(obj: T): T {
  const hit = views.get(obj);
  if (hit) return hit as T;
  const view = new Proxy(obj, {
    get(target, key, recv) {
      const v = Reflect.get(target, key, recv);
      if (typeof v === 'string') return HAN.test(v) ? tr(v) : v;
      if (v && typeof v === 'object') return translated(v as object);
      return v;
    },
  });
  views.set(obj, view);
  return view as T;
}

// ---------------- formatting ----------------
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Short month label: 3 -> "3月" / "Mar" / "3月". */
export const monthName = (m: number) => (lang() === 'en' ? MONTH_EN[m - 1] : `${m}月`);
/** Month range: (3, 5) -> "3–5 月" / "Mar–May" / "3〜5月". */
export function monthSpan(a: number, b?: number) {
  const l = lang();
  if (l === 'en') return b ? `${MONTH_EN[a - 1]}–${MONTH_EN[b - 1]}` : MONTH_EN[a - 1];
  if (l === 'ja') return b ? `${a}〜${b}月` : `${a}月`;
  return b ? `${a}–${b} 月` : `${a} 月`;
}
export const listSep = () => (lang() === 'en' ? ', ' : '、');
export const fmtNum = (n: number) => Math.round(n).toLocaleString(LOCALE[lang()]);
