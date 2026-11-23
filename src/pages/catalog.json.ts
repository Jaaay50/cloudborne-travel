import { clientCatalog, getRegion, trips } from '../lib/content';
import { REGIONS, THEMES, THEME_SLUGS, SINGLE_PREF_REGIONS } from '../lib/japan';

export function GET() {
  const base = clientCatalog();
  const r = REGIONS.filter((x) => !SINGLE_PREF_REGIONS.has(x.slug)).map((x) => ({
    n: x.name, u: `/japan/region/${x.slug}/`, d: getRegion(x.slug)?.tagline ?? '', k: getRegion(x.slug)?.kana ?? '',
  }));
  const th = THEME_SLUGS.map((t) => ({ n: THEMES[t].name, u: `/japan/themes/${t}/`, d: THEMES[t].season }));
  const tr = trips.map((t) => ({ n: t.title, u: `/japan/trips/${t.id}/`, d: t.for }));
  const to = [
    { n: '日语大字卡', u: '/japan/tools/phrases/', d: '点餐、忌口、购物、交通、求助', k: '日语 翻译 点餐 过敏 香菜' },
    { n: '机场进城', u: '/japan/tools/airports/', d: '成田 羽田 关西 中部 新千岁 福冈 那霸', k: '机场 交通 成田 羽田 关西' },
    { n: '退税计算', u: '/japan/tools/tax-free/', d: '2026 年 11 月起出境退税', k: '退税 免税 消费税' },
    { n: '行前清单', u: '/japan/tools/checklist/', d: '证件 支付 网络 行李', k: '清单 签证 插头 Suica' },
    { n: '紧急求助', u: '/japan/tools/emergency/', d: '报警 急救 使领馆', k: '110 119 大使馆 护照 丢失' },
    { n: '2026 新规', u: '/japan/tools/rules-2026/', d: '出国税 住宿税 免税改退税', k: '新规 出国税 住宿税' },
    { n: '交通常识', u: '/japan/tools/transport/', d: 'IC 卡 新干线 行李 周游券', k: 'JR Pass 新干线 IC卡 周游券' },
    { n: '算预算', u: '/budget/', d: '机票 住宿 交通 吃喝 一页算清', k: '预算 费用 花多少钱' },
  ];
  return new Response(JSON.stringify({ ...base, r, th, tr, to }), { headers: { 'Content-Type': 'application/json' } });
}
