// Static facts about Japan's 47 prefectures and 9 travel regions.
export const PREF_SLUGS = ['hokkaido', 'aomori', 'iwate', 'miyagi', 'akita', 'yamagata', 'fukushima', 'ibaraki', 'tochigi', 'gunma', 'saitama', 'chiba', 'tokyo', 'kanagawa', 'niigata', 'toyama', 'ishikawa', 'fukui', 'yamanashi', 'nagano', 'gifu', 'shizuoka', 'aichi', 'mie', 'shiga', 'kyoto', 'osaka', 'hyogo', 'nara', 'wakayama', 'tottori', 'shimane', 'okayama', 'hiroshima', 'yamaguchi', 'tokushima', 'kagawa', 'ehime', 'kochi', 'fukuoka', 'saga', 'nagasaki', 'kumamoto', 'oita', 'miyazaki', 'kagoshima', 'okinawa'] as const;
export type PrefSlug = (typeof PREF_SLUGS)[number];

export const PREF_NAMES: Record<PrefSlug, string> = {
  hokkaido: '北海道', aomori: '青森', iwate: '岩手', miyagi: '宫城', akita: '秋田', yamagata: '山形', fukushima: '福岛',
  ibaraki: '茨城', tochigi: '栃木', gunma: '群马', saitama: '埼玉', chiba: '千叶', tokyo: '东京', kanagawa: '神奈川',
  niigata: '新潟', toyama: '富山', ishikawa: '石川', fukui: '福井', yamanashi: '山梨', nagano: '长野', gifu: '岐阜',
  shizuoka: '静冈', aichi: '爱知', mie: '三重', shiga: '滋贺', kyoto: '京都', osaka: '大阪', hyogo: '兵库', nara: '奈良',
  wakayama: '和歌山', tottori: '鸟取', shimane: '岛根', okayama: '冈山', hiroshima: '广岛', yamaguchi: '山口',
  tokushima: '德岛', kagawa: '香川', ehime: '爱媛', kochi: '高知', fukuoka: '福冈', saga: '佐贺', nagasaki: '长崎',
  kumamoto: '熊本', oita: '大分', miyazaki: '宫崎', kagoshima: '鹿儿岛', okinawa: '冲绳',
};

export const REGION_SLUGS = ['hokkaido', 'tohoku', 'kanto', 'chubu', 'kansai', 'chugoku', 'shikoku', 'kyushu', 'okinawa'] as const;
export type RegionSlug = (typeof REGION_SLUGS)[number];

export interface RegionMeta { slug: RegionSlug; name: string; tone: string; ink: string; prefs: PrefSlug[] }

const RANGES: [RegionSlug, number, number][] = [
  ['hokkaido', 1, 1], ['tohoku', 2, 7], ['kanto', 8, 14], ['chubu', 15, 23], ['kansai', 24, 30],
  ['chugoku', 31, 35], ['shikoku', 36, 39], ['kyushu', 40, 46], ['okinawa', 47, 47],
];
// Woodblock-print palette: soft fill + a deeper ink for text and active states.
const TONES: Record<RegionSlug, [string, string, string]> = {
  hokkaido: ['北海道', '#8fb0c6', '#3d6584'],
  tohoku: ['东北', '#9db48a', '#4e6b3c'],
  kanto: ['关东', '#d9b46e', '#8a6420'],
  chubu: ['中部', '#cf9a78', '#8b4d2c'],
  kansai: ['关西', '#d98b78', '#a13b26'],
  chugoku: ['中国地方', '#d6bf8a', '#7f6527'],
  shikoku: ['四国', '#8fbcae', '#33695a'],
  kyushu: ['九州', '#c99aa6', '#80465a'],
  okinawa: ['冲绳', '#7fbccb', '#23687a'],
};

export const REGIONS: RegionMeta[] = RANGES.map(([slug, lo, hi]) => ({
  slug,
  name: TONES[slug][0],
  tone: TONES[slug][1],
  ink: TONES[slug][2],
  prefs: PREF_SLUGS.slice(lo - 1, hi) as PrefSlug[],
}));
export const REGION_BY_SLUG = Object.fromEntries(REGIONS.map((r) => [r.slug, r])) as Record<RegionSlug, RegionMeta>;
export const REGION_OF_PREF = Object.fromEntries(REGIONS.flatMap((r) => r.prefs.map((p) => [p, r.slug]))) as Record<PrefSlug, RegionSlug>;
/** Regions that consist of a single prefecture share its page. */
export const SINGLE_PREF_REGIONS = new Set<RegionSlug>(['hokkaido', 'okinawa']);

export const THEMES = {
  sakura: { name: '赏樱', tone: '#d77b92', season: '3 月下旬 – 5 月上旬' },
  flowers: { name: '花海', tone: '#9a7bc2', season: '4 月 – 8 月' },
  autumn: { name: '红叶', tone: '#c9532f', season: '10 月中 – 12 月上旬' },
  snow: { name: '雪国', tone: '#5f8fb4', season: '12 月 – 2 月' },
  onsen: { name: '温泉', tone: '#b4744a', season: '全年，冬天最好' },
  sea: { name: '海岛', tone: '#2f95a8', season: '5 月 – 10 月' },
  heritage: { name: '古迹', tone: '#8a5a3c', season: '全年' },
  nature: { name: '山野', tone: '#5c8a4e', season: '春 – 秋' },
  art: { name: '艺术', tone: '#4a5fa0', season: '全年' },
} as const;
export type ThemeSlug = keyof typeof THEMES;
export const THEME_SLUGS = Object.keys(THEMES) as ThemeSlug[];

export const KIND_NAMES: Record<string, string> = {
  temple: '寺院', shrine: '神社', castle: '城郭', nature: '自然', onsen: '温泉', city: '街区', street: '老街',
  museum: '美术馆', garden: '庭园', market: '市场', park: '公园', island: '海岛', viewpoint: '观景', 'theme-park': '乐园', hiking: '徒步',
};
export const SEASON_NAMES = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' } as const;
export type Season = keyof typeof SEASON_NAMES;
