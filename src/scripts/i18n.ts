// Browser side of the language support (see src/lib/i18n.ts for the build side).
// Each page embeds the translations its scripts need in <script type="application/json" id="i18n-dict">
// and its language prefix in <html data-lp="/en">.
const root = typeof document !== 'undefined' ? document.documentElement : null;
const DICT: Record<string, string> = (() => {
  try { return JSON.parse(document.getElementById('i18n-dict')?.textContent || '{}'); } catch { return {}; }
})();
export type Lang = 'zh' | 'en' | 'ja';
export const LANG: Lang = (root?.dataset.lang as Lang) || 'zh';
export const LP = root?.dataset.lp || '';
export const LOCALE = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' }[LANG];

/** Client-side t(): same Chinese source strings as the build side, filled from the embedded dictionary. */
export function ct(zh: string, vars?: Record<string, string | number>): string {
  const s = (vars && vars.n === 1 ? DICT[`${zh}|1`] : undefined) ?? DICT[zh] ?? zh;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}
/** Site path in the page's language: "/plan/" -> "/en/plan/". */
export const lp = (path: string) => (LP && path.startsWith('/') && !path.startsWith('//') && !/^\/(en|ja)\//.test(path) ? LP + path : path);
export const fmtNum = (n: number) => Math.round(n).toLocaleString(LOCALE);
