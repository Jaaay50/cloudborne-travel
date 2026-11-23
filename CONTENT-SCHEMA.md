# Cloudborne 旅行 · 内容数据格式（日本）

站点：`travel.cloudborne.cn`，面向中文游客的日本旅行指南。所有内容为我们**原创**撰写，不抄任何现有网站的文字。

## 写作要求

- 简体中文，口语、直接、实用；像一位去过很多次的朋友在讲，不写广告腔、不堆形容词。
- 每条都要回答「为什么去 / 怎么去 / 花多少时间 / 有什么坑」中的至少一个。
- 数字（票价、时长、营业时间）只写有把握的，一律加「约」。会变的信息（票价、政策、营业时间、预约制）上网核对，优先官方来源；核对过的来源写进 `sources`。拿不准就不写具体数字，改写成可执行的建议（例如「旺季提前一个月订」）。
- 不写具体店铺的人均价时可以写「一人约 X–Y 日元」这类区间；不编店名，写店名时要确认真实存在且仍在营业。
- 日元数字用千分位：`1,230 日元`。时长写「约 35 分钟」。
- 中国大陆驾照不能直接在日本开车（需要日本驾照或经认可的译本以外的证件均不行），涉及自驾时提醒这一点。
- 坐标 `ll` 为 `[经度, 纬度]`，保留 4 位小数，必须落在该县境内。

## 枚举

- `kind`（景点类型）：`temple` 寺院、`shrine` 神社、`castle` 城郭、`nature` 自然风景、`onsen` 温泉、`city` 街区/城市、`street` 老街、`museum` 博物馆/美术馆、`garden` 庭园、`market` 市场、`park` 公园、`island` 海岛、`viewpoint` 观景台/夜景、`theme-park` 主题乐园、`hiking` 徒步路线。
- `themes`（主题，景点可以有 0–3 个）：`sakura` 赏樱、`flowers` 花海（樱花以外，如薰衣草、紫藤、绣球、粉蝶花）、`autumn` 红叶、`snow` 雪国冬景、`onsen` 温泉、`sea` 海岛海边、`heritage` 古迹与世界遗产、`nature` 山野自然、`art` 艺术与建筑。
- `seasons.best`：`spring`、`summer`、`autumn`、`winter`（可多选）。
- 地区 `region`：`hokkaido`、`tohoku`、`kanto`、`chubu`、`kansai`（含三重）、`chugoku`、`shikoku`、`kyushu`、`okinawa`。

## 都道府县文件 `src/data/japan/prefectures/<slug>.json`

```json
{
  "id": 26,
  "slug": "kyoto",
  "name": "京都",
  "local": "京都府",
  "kana": "きょうと",
  "en": "Kyoto",
  "region": "kansai",
  "tagline": "一句话定位，≤ 28 字",
  "intro": ["2–3 段，每段 60–140 字：这地方是什么、适合谁、怎么安排"],
  "days": "2–3 天",
  "seasons": { "best": ["spring", "autumn"], "note": "≤ 70 字：什么时候去最好、要避开什么" },
  "stay": "≤ 90 字：住哪个区域、为什么",
  "access": [
    { "from": "大阪", "how": "JR 新快速约 30 分钟到京都站" }
  ],
  "spots": [
    {
      "id": "fushimi-inari",
      "name": "伏见稻荷大社",
      "local": "伏見稲荷大社",
      "en": "Fushimi Inari Taisha",
      "kind": "shrine",
      "ll": [135.7727, 34.9671],
      "text": "60–130 字：为什么去、怎么玩",
      "time": "2–3 小时",
      "tip": "可选，≤ 50 字：最好的时段、避坑",
      "fee": "可选：免费 / 约 600 日元",
      "themes": ["heritage"]
    }
  ],
  "foods": [
    {
      "id": "yudofu",
      "name": "汤豆腐",
      "local": "湯豆腐",
      "text": "40–100 字：是什么、为什么是这里的味道",
      "where": "≤ 50 字：在哪一带吃",
      "price": "可选：一人约 3,000–4,000 日元"
    }
  ],
  "tips": ["3–5 条，每条 ≤ 60 字的实用提醒"],
  "nearby": ["osaka", "nara", "shiga"],
  "sources": [{ "title": "来源名", "url": "https://..." }],
  "checked": "2026-11"
}
```

数量：`spots` 5–8 个（东京、京都、大阪、北海道、冲绳可到 10 个），`foods` 3–5 个，`access` 2–4 条（含最近的机场或大城市）。
`spot.id`、`food.id` 用小写英文和连字符，在本县内唯一。`nearby` 填 2–4 个相邻或常一起游的县 slug。

## 地区文件 `src/data/japan/regions/<slug>.json`

```json
{
  "slug": "kansai",
  "name": "关西",
  "kana": "かんさい",
  "en": "Kansai",
  "tagline": "≤ 28 字",
  "intro": ["2 段，每段 60–140 字"],
  "days": "5–7 天",
  "season": "≤ 50 字",
  "gateways": [
    { "name": "关西国际机场（KIX）", "how": "≤ 80 字：到主要城市怎么走、约多久、约多少钱" }
  ],
  "cities": ["京都", "大阪", "奈良", "神户"],
  "passes": [
    { "name": "周游券名", "text": "≤ 80 字：覆盖范围、适合谁、要不要买" }
  ],
  "prefectures": ["kyoto", "osaka", "hyogo", "nara", "wakayama", "shiga", "mie"],
  "sources": [{ "title": "...", "url": "https://..." }],
  "checked": "2026-11"
}
```

## 行程模板 `src/data/japan/trips/<id>.json`

```json
{
  "id": "kansai-first-5d",
  "title": "第一次去关西 · 5 天",
  "region": "kansai",
  "daysCount": 5,
  "for": "≤ 40 字：适合谁",
  "season": "≤ 30 字：什么时候最合适",
  "summary": "60–130 字：这条路线的思路",
  "bases": ["京都 3 晚", "大阪 2 晚"],
  "days": [
    {
      "title": "≤ 16 字",
      "stay": "京都",
      "items": [
        { "pref": "kyoto", "spot": "fushimi-inari" },
        { "pref": "kyoto", "food": "yudofu" },
        { "note": "自由文字 ≤ 40 字，例如「傍晚回酒店休息」" }
      ],
      "move": "可选，≤ 60 字：当天的主要交通"
    }
  ]
}
```

`items` 里的 `spot` / `food` 必须是对应县文件里真实存在的 id（可以跨县，但只能引用你自己负责的县）。每天 2–5 项。`id` 用小写英文和连字符。

## 县 slug 与编号

1 hokkaido · 2 aomori · 3 iwate · 4 miyagi · 5 akita · 6 yamagata · 7 fukushima · 8 ibaraki · 9 tochigi · 10 gunma · 11 saitama · 12 chiba · 13 tokyo · 14 kanagawa · 15 niigata · 16 toyama · 17 ishikawa · 18 fukui · 19 yamanashi · 20 nagano · 21 gifu · 22 shizuoka · 23 aichi · 24 mie · 25 shiga · 26 kyoto · 27 osaka · 28 hyogo · 29 nara · 30 wakayama · 31 tottori · 32 shimane · 33 okayama · 34 hiroshima · 35 yamaguchi · 36 tokushima · 37 kagawa · 38 ehime · 39 kochi · 40 fukuoka · 41 saga · 42 nagasaki · 43 kumamoto · 44 oita · 45 miyazaki · 46 kagoshima · 47 okinawa

地区归属：hokkaido=1；tohoku=2–7；kanto=8–14；chubu=15–23；kansai=24–30；chugoku=31–35；shikoku=36–39；kyushu=40–46；okinawa=47。

## 校验

写完每个文件后运行 `python3 -I -m json.tool <file> > /dev/null` 确认是合法 JSON；再运行 `python3 -I scripts/check_content.py <file>...` 检查字段。

## 封面插画

县和地区的封面插画统一在 `src/data/japan/covers.json` 里描述，内容文件里**不要**写 `cover` 字段。
