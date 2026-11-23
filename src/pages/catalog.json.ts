import { getRegion } from '../lib/content';
import { REGIONS, THEMES, THEME_SLUGS, SINGLE_PREF_REGIONS } from '../lib/japan';
import { catalogData, tripsAll, regionsOf } from '../lib/world';

export function GET() {
  const base = catalogData();
  const r = [
    ...REGIONS.filter((x) => !SINGLE_PREF_REGIONS.has(x.slug)).map((x) => ({
      n: x.name, u: `/japan/region/${x.slug}/`, d: getRegion(x.slug)?.tagline ?? '', k: getRegion(x.slug)?.kana ?? '',
    })),
    ...(['australia', 'usa'] as const).flatMap((c) => regionsOf(c).filter((x) => x.places.length > 1).map((x) => ({ n: x.name, u: `/${c}/#r=${x.slug}`, d: x.tagline, k: '' }))),
    { n: '日本', u: '/japan/', d: '47 个都道府县', k: 'japan 日本' },
    { n: '澳大利亚', u: '/australia/', d: '8 个州和领地', k: 'australia 澳洲 澳洲旅行' },
    { n: '美国', u: '/usa/', d: '热门州与国家公园', k: 'usa america 美国' },
  ];
  const th = THEME_SLUGS.map((t) => ({ n: THEMES[t].name, u: `/japan/themes/${t}/`, d: `日本 · ${THEMES[t].season}` }));
  const trips = tripsAll();
  const tr = trips.map((t) => ({ n: t.title, u: t.href, d: t.for }));
  const tp = trips.map((t) => ({
    id: t.id, c: t.country, n: t.title, u: t.href, r: t.region, dc: t.daysCount,
    days: t.days.map((d) => d.items.flatMap((i) => ('spot' in i ? [`s:${i.pref}/${i.spot}`] : 'food' in i ? [`f:${i.pref}/${i.food}`] : []))),
  }));
  const to = [
    { n: '快速攻略', u: '/quick/', d: '选几个选项，马上生成一份行程', k: '攻略 生成 规划 推荐' },
    { n: '日语大字卡', u: '/japan/tools/phrases/', d: '点餐、忌口、购物、交通、求助', k: '日语 翻译 点餐 过敏 香菜' },
    { n: '机场进城', u: '/japan/tools/airports/', d: '成田 羽田 关西 中部 新千岁 福冈 那霸', k: '机场 交通 成田 羽田 关西' },
    { n: '退税计算', u: '/japan/tools/tax-free/', d: '日本 2026 年 11 月起出境退税', k: '退税 免税 消费税' },
    { n: '行前清单', u: '/japan/tools/checklist/', d: '证件 支付 网络 行李', k: '清单 签证 插头 Suica' },
    { n: '紧急求助', u: '/japan/tools/emergency/', d: '报警 急救 使领馆', k: '110 119 大使馆 护照 丢失' },
    { n: '2026 新规', u: '/japan/tools/rules-2026/', d: '出国税 住宿税 免税改退税', k: '新规 出国税 住宿税' },
    { n: '交通常识', u: '/japan/tools/transport/', d: 'IC 卡 新干线 行李 周游券', k: 'JR Pass 新干线 IC卡 周游券' },
    { n: '澳大利亚出行须知', u: '/australia/guide/', d: '签证 入境 小费 自驾 紧急电话', k: '澳洲 签证 600 入境 检疫 000' },
    { n: '美国出行须知', u: '/usa/guide/', d: '签证 EVUS 小费 自驾 紧急电话', k: '美国 签证 B1/B2 EVUS 911' },
    { n: '算预算', u: '/budget/', d: '机票 住宿 交通 吃喝 一页算清', k: '预算 费用 花多少钱' },
  ];
  return new Response(JSON.stringify({ ...base, r, th, tr, to, tp }), { headers: { 'Content-Type': 'application/json' } });
}
