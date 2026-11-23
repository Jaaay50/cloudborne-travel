# 栖云旅行 · 澳大利亚与美国内容格式

站点 `travel.cloudborne.cn` 面向中文游客。本文件规定澳大利亚、美国的州文件、行程模板和出行须知格式。通用写作要求与日本相同（见 `CONTENT-SCHEMA.md` 的「写作要求」），这里只写不同之处。

## 写作要求（补充）

- 简体中文，口语、直接、实用，像去过很多次的朋友在讲。不写广告腔，不堆形容词，不抄任何现有网站或攻略的句子。
- 读者从中国大陆出发：写清直飞航线（哪些城市有直飞、大约几小时）、签证和入境要点、要不要自驾、时差和季节。
- **澳洲在南半球，季节和中国相反**：一律写月份（「12–2 月」），不要只写「夏天」「冬天」。
- 货币：澳洲写「约 25 澳元」，美国写「约 35 美元」，千分位「1,200 美元」。美国价格注明是否含税或小费时再写；餐饮人均写区间「一人约 20–30 美元（不含小费）」。
- 数字只写有把握的，一律加「约」；票价、门票、签证费、国家公园门票、预约制要上网核对，优先官方来源（nps.gov、parksaustralia.gov.au、各州旅游局、航司、机场官网、immi.homeaffairs.gov.au、travel.state.gov 等），来源写进 `sources`。拿不准就写成可执行的建议（例如「旺季提前两个月订营地」），不要编。
- 不编店名；写店名时确认真实存在且仍在营业。
- 自驾：中国驾照在澳洲各州 / 美国各州的规定不同（多数需要 NAATI 或认证翻译件，美国部分州认可外国驾照加翻译件），涉及自驾时写清该州的要求或提醒「出发前查该州交通部门官网」。右舵 / 左行（澳洲）要提醒。
- 安全：澳洲海滩只在红黄旗之间游泳、北部海域水母季和鳄鱼；美国国家公园的高温、海拔、熊和野生动物距离；只写真实、有用的。
- 坐标 `ll` 为 `[经度, 纬度]`，4 位小数，必须落在该州境内（美国西经、澳洲南纬都是负数：洛杉矶约 `[-118.2437, 34.0522]`，悉尼约 `[151.2093, -33.8688]`）。

## 枚举

- `kind`（景点类型）：日本那套（`temple shrine castle nature onsen city street museum garden market park island viewpoint theme-park hiking`）加上：`national-park` 国家公园、`beach` 海滩、`landmark` 城市地标、`winery` 酒庄、`wildlife` 野生动物、`drive` 自驾路线。
- `themes`（每个景点 0–3 个）：
  - 澳大利亚可用：`sea` 海岛海边、`wildlife` 野生动物、`nature` 山野自然、`roadtrip` 自驾公路、`city` 城市、`wine` 酒庄美食、`flowers` 花海、`snow` 冰雪、`aurora` 极光星空、`art` 艺术建筑、`family` 乐园亲子
  - 美国可用：`nature` 山野自然、`roadtrip` 自驾公路、`city` 城市、`sea` 海岛海边、`family` 乐园亲子、`art` 艺术建筑、`autumn` 秋色红叶、`snow` 冰雪、`aurora` 极光星空、`wine` 酒庄美食、`heritage` 历史古迹、`wildlife` 野生动物
- `seasons.months`：最适合去的月份数组，1–12，例如 `[9, 10, 11, 3, 4, 5]`。

## 州 slug（文件名 = slug）

澳大利亚 `src/data/australia/states/<slug>.json`：

| slug | name | local | region |
| --- | --- | --- | --- |
| new-south-wales | 新南威尔士 | New South Wales | nsw-act |
| australian-capital-territory | 首都领地 | Australian Capital Territory | nsw-act |
| victoria | 维多利亚 | Victoria | victoria |
| queensland | 昆士兰 | Queensland | queensland |
| western-australia | 西澳 | Western Australia | western-australia |
| south-australia | 南澳 | South Australia | south-australia |
| tasmania | 塔斯马尼亚 | Tasmania | tasmania |
| northern-territory | 北领地 | Northern Territory | northern-territory |

美国 `src/data/usa/states/<slug>.json`：

| slug | name | local | region |
| --- | --- | --- | --- |
| california | 加州 | California | west-coast |
| washington | 华盛顿州 | Washington | west-coast |
| nevada | 内华达 | Nevada | mountain-west |
| arizona | 亚利桑那 | Arizona | mountain-west |
| utah | 犹他 | Utah | mountain-west |
| colorado | 科罗拉多 | Colorado | mountain-west |
| wyoming | 怀俄明 | Wyoming | mountain-west |
| new-york | 纽约 | New York | northeast |
| massachusetts | 麻省 | Massachusetts | northeast |
| pennsylvania | 宾州 | Pennsylvania | northeast |
| washington-dc | 华盛顿特区 | Washington, D.C. | northeast |
| illinois | 伊利诺伊 | Illinois | midwest |
| florida | 佛罗里达 | Florida | south |
| alaska | 阿拉斯加 | Alaska | alaska |
| hawaii | 夏威夷 | Hawaii | hawaii |

## 州文件

```json
{
  "slug": "new-south-wales",
  "country": "australia",
  "name": "新南威尔士",
  "local": "New South Wales",
  "abbr": "NSW",
  "region": "nsw-act",
  "tagline": "一句话定位，≤ 28 字",
  "intro": ["2–3 段，每段 60–140 字：这地方是什么、适合谁、怎么安排"],
  "days": "4–6 天",
  "seasons": { "months": [9, 10, 11, 3, 4, 5], "note": "≤ 70 字：什么时候去最好、要避开什么（写月份）" },
  "stay": "≤ 90 字：住哪个区域、为什么",
  "access": [
    { "from": "中国大陆", "how": "≤ 80 字：哪些城市有直飞、约几小时" },
    { "from": "墨尔本", "how": "飞机约 1.5 小时" }
  ],
  "spots": [
    {
      "id": "sydney-opera-house",
      "name": "悉尼歌剧院",
      "local": "Sydney Opera House",
      "kind": "landmark",
      "ll": [151.2153, -33.8568],
      "text": "60–130 字：为什么去、怎么玩",
      "time": "1–2 小时",
      "tip": "可选，≤ 50 字",
      "fee": "可选：免费 / 导览约 45 澳元",
      "themes": ["city", "art"],
      "photo": "English, 25–70 words: what a real photo of this place looks like (see below)"
    }
  ],
  "foods": [
    {
      "id": "flat-white",
      "name": "澳白咖啡",
      "local": "Flat White",
      "text": "40–100 字",
      "where": "≤ 50 字：在哪一带吃",
      "price": "可选：一杯约 5–6 澳元",
      "photo": "English, 25–60 words"
    }
  ],
  "tips": ["3–5 条，每条 ≤ 60 字"],
  "nearby": ["australian-capital-territory", "queensland", "victoria"],
  "climate": { "city": "悉尼", "ll": [151.2093, -33.8688] },
  "cover": { "scene": "English, 40–90 words: the iconic photo for the state page banner (wide 3:2)", "alt": "中文 ≤ 24 字" },
  "sources": [{ "title": "来源名", "url": "https://..." }],
  "checked": "2026-11"
}
```

数量：`spots` 5–8 个（加州、纽约、新南威尔士、维多利亚、昆士兰、夏威夷可到 10 个），`foods` 3–5 个，`access` 2–4 条（第一条写从中国大陆怎么去），`nearby` 2–4 个**同一国家**的州 slug（可以是本表以外没有文件的州，就不填）。`spot.id`、`food.id` 小写英文加连字符，本州内唯一。`local` 写英文原名。景点的 `en` 字段不需要（`local` 已是英文）。

`climate`：用来画「每月天气表」的代表城市（一般是首府或游客最多的城市）和它的坐标，数据由脚本自动取，不用你填数字。

### `photo` 与 `cover.scene`（生图用，不显示在页面上）

我们用 AI 生成「看起来像真实照片」的配图，避免用别人的照片侵权。`photo` 用英文写这张照片里**真实能看到的东西**：

- 景点：拍摄位置和角度、主体建筑 / 地貌的真实特征（颜色、材质、形状）、季节和时间（选最佳季节）、天气光线。例：`View from Mrs Macquarie's Chair across Farm Cove at blue hour: the white sail-shaped shells of the Sydney Opera House glowing, Harbour Bridge arch behind, calm water reflections, clear sky.`
- 美食：食物本身的真实样子、器皿、摆法、角度（俯拍或 45°）、背景环境。例：`A flat white in a white ceramic cup on a light timber cafe table, glossy microfoam with a simple rosetta, morning window light, shallow depth of field.`
- 不要写画风词（不要 painting、illustration、woodblock），不写人名、品牌标识、可读文字、近景人脸；人只能是远处小人。
- 要符合实情：不把雪山写进热带，不给没有灯光的地方加夜景。

## 行程模板 `src/data/<country>/trips/<id>.json`

格式同日本（见 `CONTENT-SCHEMA.md`），区别：

- 加 `"country": "australia"` 或 `"usa"`；`region` 用上表的 region。
- `items` 里 `{ "pref": "<州 slug>", "spot": "<id>" }`（字段名仍叫 `pref`），只能引用你自己写的州文件里真实存在的 id。
- 天数 3–10 天；`move` 写当天主要交通（自驾里程和时长、国内航班时长）。

## 出行须知 `src/data/<country>/guide.json`

```json
{
  "country": "australia",
  "sections": [
    {
      "id": "visa",
      "title": "签证与入境",
      "items": [{ "title": "≤ 16 字", "text": "≤ 160 字" }]
    }
  ],
  "numbers": [{ "label": "报警 / 急救 / 火警", "number": "000", "note": "≤ 40 字" }],
  "contacts": [{ "name": "中国驻悉尼总领事馆", "phone": "+61 ...", "hours": "可选", "note": "领区：…", "url": "https://..." }],
  "budget": {
    "currency": "AUD",
    "save": { "flight": 4500, "hotel": 150, "food": 60, "local": 15, "tickets": 20, "rail": 150, "airport": 25, "sim": 30, "shop": 150, "insure": 100 },
    "mid": { "...": "同上" },
    "lux": { "...": "同上" },
    "note": "≤ 80 字：这些数字怎么来的、什么时候会更贵"
  },
  "sources": [{ "title": "...", "url": "https://..." }],
  "checked": "2026-11"
}
```

`sections` 按这个顺序写 7 节，每节 2–5 条：`visa` 签证与入境、`customs` 入境申报与检疫、`money` 支付、小费与退税、`transport` 交通与自驾、`phone` 网络与电话、`safety` 安全与天气、`basics` 插头、电压与时差。

`budget`：`flight` 是从中国大陆出发每人往返机票（人民币，经济舱为 save/mid，lux 可写商务舱）；其余是当地货币：`hotel` 每晚每间、`food` / `local` / `tickets` 每人每天、`rail` 每人整趟的城际交通（国内航班或租车分摊）、`airport` 每人机场往返、`sim` 每人流量、`shop` 每人购物、`insure` 每人保险（人民币）。

## 校验

写完每个文件：

```bash
python3 -I -m json.tool <file> > /dev/null
python3 -I scripts/check_content.py <file> ...
```

文件里**不要**写 `id`（数字）、`kana` 字段。
