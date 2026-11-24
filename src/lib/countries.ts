// Static facts about Australia and the USA: states we cover, travel regions, themes, palettes.
// Japan keeps its own module (japan.ts) because its slugs and regions are fixed by the prefecture list.
// Chinese literals here are UI strings: scripts/i18n.py extract collects them, and the exported tables
// are translated() views, so they read in the current render language.
import { translated, tr, monthSpan, listSep } from './i18n';

export type CountrySlug = 'japan' | 'australia' | 'usa';
export type XCountry = 'australia' | 'usa';

export interface XTheme { name: string; tone: string; season: string }
export interface XRegion { slug: string; name: string; en: string; tone: string; ink: string; states: string[] }
export interface CountryMeta {
  slug: XCountry;
  name: string;
  en: string;
  unit: string; // 州 / 州和领地
  currency: 'AUD' | 'USD';
  currencyName: string;
  rate: number; // default: 1 CNY = ? local currency
  /** All state slugs drawn on the map (covered or not) with their Chinese names. */
  names: Record<string, string>;
  regions: XRegion[];
  themes: Record<string, XTheme>;
  kinds: Record<string, string>;
}

const EXTRA_KINDS_ZH: Record<string, string> = {
  'national-park': '国家公园', beach: '海滩', landmark: '地标', winery: '酒庄', wildlife: '野生动物', drive: '自驾路线',
};

const AU_THEMES: Record<string, XTheme> = {
  sea: { name: '海岛海滩', tone: '#2f95a8', season: '10–4 月' },
  wildlife: { name: '野生动物', tone: '#9b6a3c', season: '全年' },
  nature: { name: '山野自然', tone: '#5c8a4e', season: '全年' },
  roadtrip: { name: '自驾公路', tone: '#c26a2e', season: '全年' },
  city: { name: '城市', tone: '#4a5fa0', season: '全年' },
  wine: { name: '酒庄美食', tone: '#8a3b5c', season: '2–5 月采收季' },
  flowers: { name: '花海', tone: '#9a7bc2', season: '8–11 月' },
  snow: { name: '冰雪', tone: '#5f8fb4', season: '6–9 月' },
  aurora: { name: '极光星空', tone: '#2b4f6e', season: '5–9 月' },
  art: { name: '艺术建筑', tone: '#7a5aa6', season: '全年' },
  family: { name: '乐园亲子', tone: '#d77b92', season: '全年' },
};
const US_THEMES: Record<string, XTheme> = {
  nature: { name: '国家公园', tone: '#5c8a4e', season: '4–10 月' },
  roadtrip: { name: '自驾公路', tone: '#c26a2e', season: '全年' },
  city: { name: '城市', tone: '#4a5fa0', season: '全年' },
  sea: { name: '海岛海滩', tone: '#2f95a8', season: '全年' },
  family: { name: '乐园亲子', tone: '#d77b92', season: '全年' },
  art: { name: '艺术建筑', tone: '#7a5aa6', season: '全年' },
  autumn: { name: '秋色', tone: '#c9532f', season: '9 月底–10 月' },
  snow: { name: '冰雪', tone: '#5f8fb4', season: '12–3 月' },
  aurora: { name: '极光星空', tone: '#2b4f6e', season: '9–3 月' },
  wine: { name: '酒庄美食', tone: '#8a3b5c', season: '全年' },
  heritage: { name: '历史古迹', tone: '#8a5a3c', season: '全年' },
  wildlife: { name: '野生动物', tone: '#9b6a3c', season: '全年' },
};

const COUNTRIES_ZH: Record<XCountry, CountryMeta> = {
  australia: {
    slug: 'australia', name: '澳大利亚', en: 'Australia', unit: '州和领地', currency: 'AUD', currencyName: '澳元', rate: 0.21,
    names: {
      'new-south-wales': '新南威尔士', 'australian-capital-territory': '首都领地', victoria: '维多利亚', queensland: '昆士兰',
      'western-australia': '西澳', 'south-australia': '南澳', tasmania: '塔斯马尼亚', 'northern-territory': '北领地',
    },
    regions: [
      { slug: 'nsw-act', name: '新州与堪培拉', en: 'NSW & ACT', tone: '#d9a46e', ink: '#8a5a20', states: ['new-south-wales', 'australian-capital-territory'] },
      { slug: 'victoria', name: '维多利亚', en: 'Victoria', tone: '#8fb0c6', ink: '#3d6584', states: ['victoria'] },
      { slug: 'queensland', name: '昆士兰', en: 'Queensland', tone: '#8fbcae', ink: '#33695a', states: ['queensland'] },
      { slug: 'western-australia', name: '西澳', en: 'Western Australia', tone: '#d98b78', ink: '#a13b26', states: ['western-australia'] },
      { slug: 'south-australia', name: '南澳', en: 'South Australia', tone: '#c99aa6', ink: '#80465a', states: ['south-australia'] },
      { slug: 'tasmania', name: '塔斯马尼亚', en: 'Tasmania', tone: '#9db48a', ink: '#4e6b3c', states: ['tasmania'] },
      { slug: 'northern-territory', name: '北领地', en: 'Northern Territory', tone: '#cf9a78', ink: '#8b4d2c', states: ['northern-territory'] },
    ],
    themes: AU_THEMES,
    kinds: {},
  },
  usa: {
    slug: 'usa', name: '美国', en: 'United States', unit: '州', currency: 'USD', currencyName: '美元', rate: 0.14,
    names: {
      alabama: '亚拉巴马', alaska: '阿拉斯加', arizona: '亚利桑那', arkansas: '阿肯色', california: '加州', colorado: '科罗拉多',
      connecticut: '康涅狄格', delaware: '特拉华', 'washington-dc': '华盛顿特区', florida: '佛罗里达', georgia: '佐治亚', hawaii: '夏威夷',
      idaho: '爱达荷', illinois: '伊利诺伊', indiana: '印第安纳', iowa: '艾奥瓦', kansas: '堪萨斯', kentucky: '肯塔基', louisiana: '路易斯安那',
      maine: '缅因', maryland: '马里兰', massachusetts: '麻省', michigan: '密歇根', minnesota: '明尼苏达', mississippi: '密西西比',
      missouri: '密苏里', montana: '蒙大拿', nebraska: '内布拉斯加', nevada: '内华达', 'new-hampshire': '新罕布什尔', 'new-jersey': '新泽西',
      'new-mexico': '新墨西哥', 'new-york': '纽约', 'north-carolina': '北卡', 'north-dakota': '北达科他', ohio: '俄亥俄', oklahoma: '俄克拉何马',
      oregon: '俄勒冈', pennsylvania: '宾州', 'rhode-island': '罗得岛', 'south-carolina': '南卡', 'south-dakota': '南达科他', tennessee: '田纳西',
      texas: '得州', utah: '犹他', vermont: '佛蒙特', virginia: '弗吉尼亚', washington: '华盛顿州', 'west-virginia': '西弗吉尼亚',
      wisconsin: '威斯康星', wyoming: '怀俄明',
    },
    regions: [
      { slug: 'west-coast', name: '西海岸', en: 'West Coast', tone: '#d98b78', ink: '#a13b26', states: ['california', 'washington'] },
      { slug: 'mountain-west', name: '西部山地', en: 'Mountain West', tone: '#cf9a78', ink: '#8b4d2c', states: ['nevada', 'arizona', 'utah', 'colorado', 'wyoming'] },
      { slug: 'northeast', name: '东北部', en: 'Northeast', tone: '#8fb0c6', ink: '#3d6584', states: ['new-york', 'massachusetts', 'pennsylvania', 'washington-dc'] },
      { slug: 'midwest', name: '中西部', en: 'Midwest', tone: '#d6bf8a', ink: '#7f6527', states: ['illinois'] },
      { slug: 'south', name: '南部', en: 'South', tone: '#8fbcae', ink: '#33695a', states: ['florida'] },
      { slug: 'alaska', name: '阿拉斯加', en: 'Alaska', tone: '#9db48a', ink: '#4e6b3c', states: ['alaska'] },
      { slug: 'hawaii', name: '夏威夷', en: 'Hawaii', tone: '#7fbccb', ink: '#23687a', states: ['hawaii'] },
    ],
    themes: US_THEMES,
    kinds: {},
  },
};

const COUNTRY_LIST_ZH = [
  { slug: 'japan' as const, name: '日本', en: 'Japan', href: '/japan/' },
  { slug: 'australia' as const, name: '澳大利亚', en: 'Australia', href: '/australia/' },
  { slug: 'usa' as const, name: '美国', en: 'USA', href: '/usa/' },
];

export const EXTRA_KINDS = translated(EXTRA_KINDS_ZH);
export const COUNTRIES = translated(COUNTRIES_ZH);
export const COUNTRY_LIST = translated(COUNTRY_LIST_ZH);

export const regionOf = (c: XCountry, state: string) => COUNTRIES[c].regions.find((r) => r.states.includes(state));

/** "3, 4, 5, 9, 10" -> "3–5 月、9–10 月" */
export function monthRanges(months: number[]): string {
  const ms = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (ms.length === 12) return tr('全年');
  // wrap-around (11, 12, 1, 2): rotate so a run that crosses the new year stays together
  let start = 0;
  for (let i = 0; i < ms.length; i++) if ((ms[(i - 1 + ms.length) % ms.length] % 12) + 1 !== ms[i]) { start = i; break; }
  const rot = [...ms.slice(start), ...ms.slice(0, start)];
  const runs: number[][] = [];
  for (const m of rot) {
    const last = runs[runs.length - 1];
    if (last && (last[last.length - 1] % 12) + 1 === m) last.push(m);
    else runs.push([m]);
  }
  return runs.map((r) => (r.length === 1 ? monthSpan(r[0]) : monthSpan(r[0], r[r.length - 1]))).join(listSep());
}
