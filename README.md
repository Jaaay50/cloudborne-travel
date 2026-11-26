# 栖云旅行 · travel.cloudborne.cn

Cloudborne 栖云的真实攻略社区与旅行指南，覆盖日本（47 个都道府县）、澳大利亚（8 个州和领地）、美国（15 个热门州）：社交论坛式攻略信息流（多图、分步、含实测花费与避坑清单，支持国家/板块/标签/收藏筛选、文内一键加入行程与全屏灯箱）、每日自动调研/写作/生图/翻译流水线、自主切换明暗主题（浅色/深色/跟随系统），以及原有的互动地图、写实风格配图、每月天气表、行程模板、一分钟生成攻略、行程规划、预算计算与离线随身工具。中文、English（`/en/`）、日本語（`/ja/`）三种语言。纯静态站（Astro 7），不登录、无后端、无数据库；用户数据只存在浏览器 localStorage。

## 目录

| 路径 | 内容 |
| --- | --- |
| `src/data/posts/*.json` | 真实感分步多图攻略帖（路线实录/避坑指南/美食探店/当季实况/交通住宿/预算复盘）。格式见 `POST-SCHEMA.md` |
| `src/data/post-photo-index.json` | 已生成的攻略帖配图清单（`npm run photos` 按 `public/img/posts/` 重建，构建时自动跑） |
| `src/data/japan/prefectures/*.json` | 47 个县的正文、景点（含坐标）、美食、交通、提醒、来源。格式见 `CONTENT-SCHEMA.md` |
| `src/data/{australia,usa}/states/*.json` | 澳大利亚、美国各州，含每个景点/美食的英文 `photo` 描述和州封面 `cover.scene`（生图用）。格式见 `CONTENT-SCHEMA-AU-US.md` |
| `src/data/{australia,usa}/trips/*.json`、`guide.json` | 行程模板；出行须知（签证、入境、小费、自驾、紧急电话、使领馆、预算档位） |
| `src/data/japan/photos/*.json` | 日本景点和美食的英文照片描述（生图用） |
| `src/data/photo-index.json` | 已生成的照片清单（`npm run photos` 按 `public/img/photos/` 重建，构建时自动跑） |
| `src/data/climate.json` | 每地每月气温和降水（Open-Meteo ERA5，1996–2025 平均），`npm run climate` 生成 |
| `src/data/rates.json` | 人民币汇率，构建时 `scripts/fetch-rates.mjs` 自动更新（取不到就保留旧值） |
| `src/data/japan/regions/*.json` | 7 个多县地区（北海道、冲绳的地区页直接用县页） |
| `src/data/japan/trips/*.json` | 行程模板，引用县文件里的 spot/food id |
| `src/data/japan/covers.json` | 首页长图、47 县、7 地区、9 主题插画的场景描述和 alt |
| `src/data/toolkit/*.json` | 日语卡、紧急求助、退税、行前清单、交通、2026 新规 |
| `src/data/geo/*.json` | 日本县界、澳大利亚和美国州界（Natural Earth 10m admin-1，公有领域），由 `scripts/prepare-geo.mjs`、`scripts/prepare-geo-world.mjs` 生成 |
| `src/i18n/` | 多语言：`cache/{en,ja}.json` 翻译缓存（进 Git）、`ui-source.json` 界面文字清单、`ui-overrides.json` 手改界面词、`content-overrides.json` 按读者改写的正文（签证途径）；`en/`、`ja/` 是构建时生成的译文 JSON，不进 Git |
| `src/lib/` | 数据加载（`content.ts`、`toolkit.ts`）、三国统一视图（`world.ts`）、国家与地区常量（`japan.ts`、`countries.ts`）、地图投影（`geo.ts`、`atlas.ts`）、行程条目键（`keys.ts`） |
| `src/components/WorldMap.astro` | 地图：国家页「全国→地区→州/县」缩放 + 侧栏；州/县/地区页固定视角；景点悬停/轻点弹出照片 |
| `src/components/PlacePage.astro`、`CountryHome.astro`、`TripPage.astro`、`GuidePage.astro`、`ClimateTable.astro` | 三国共用的州/县页、国家首页、行程页、出行须知、天气表 |
| `src/pages/[...lang]/` | 全部页面，`lang` 为空（中文）/`en`/`ja`；`src/middleware.ts` 设定渲染语言，并给英日页面里的站内链接加前缀 |
| `src/pages/[...lang]/quick.astro` + `src/scripts/quick.ts` | 一分钟生成攻略：选择题 → 按天排好的草稿行程 |
| `src/scripts/share-image.ts` | 行程长图（canvas 绘制 PNG） |
| `src/scripts/` | 全站脚本：搜索、加入行程、行程存储与分享编码 |
| `public/img/` | 日本高清木刻风插画 WebP（960/1920 宽，首页长图 1280/2560）；`photos/` 高清写实配图（景点/美食 640/1280，澳美州封面 960/1920） |
| `public/fonts/wenkai/` | 自托管霞鹜文楷屏幕版（LXGW WenKai Screen，按 `unicode-range` 拆片加载，SIL OFL 1.1） |
| `art-src/` | 插画原图 PNG，**不进 Git**（体积大）；本机另有备份时可删 |
| `research/` | Natural Earth 日本子集原始数据 |

## 常用命令

```bash
npm install
npm run check      # 校验内容 JSON（scripts/check_content.py）
npm run dev        # 本地开发 http://localhost:4321
npm run build      # 输出 dist/
npm run preview    # 预览 dist/
node scripts/build-images.mjs   # art-src/ → public/img/（只转新的或改过的）
node scripts/prepare-geo.mjs    # 重新生成县界
node scripts/prepare-geo-world.mjs <ne_10m_admin_1_states_provinces.geojson>   # 澳大利亚、美国州界
npm run climate    # 补齐每月天气（Open-Meteo 免费额度每天 1 万次，缓存在 research/climate-cache/）
npm run photos     # 按 public/img/photos/ 重建照片清单
npm run i18n -- extract                 # 收集代码里 t('…') / ct('…') 的界面文字
npm run i18n -- translate --lang en     # 只翻新增或改过的正文和界面文字（ja 同理）
npm run i18n -- check                   # 列出还没翻译的部分
npm run i18n -- prune                   # 删掉不再用到的旧译文
npm run post:research -- --count 2 --country japan   # 仅调研公开旅游攻略线索并去重
npm run post:auto -- --count 1 --country auto --translate   # 调研 → 原创分步写作 → AI 生图转 WebP → 校验 → 英日翻译
npm run post:images                     # 将 art-src/posts/ 下的手工原图转为双尺寸 WebP 并刷新索引
```

## 插画与照片

- 日本封面：木刻版画（新版画）风格，AI 生成（2026-11-23，64 张）。风格提示词和场景描述在 `covers.json`。新增：按 `style` + 场景生成 1536×1024，放进 `art-src/<组>/<slug>.png`，跑 `build-images.mjs`。
- 景点、美食和澳美州封面：写实照片风格，AI 按每条的英文 `photo` / `cover.scene` 描述生成（gpt-image-2.6，1536×1024；`scripts/photo-jobs.py` 生成任务清单），转成 WebP 放在 `public/img/photos/<国家>/<州或县>/<s|f>-<id>-<宽>.webp`、`.../cover-<宽>.webp`。没有图的条目页面自动不显示图片。新增条目：写好描述 → 生图 → 转 WebP → `npm run photos`。关于页写明了图片是 AI 生成。

## 内容与核对

正文为原创。票价、时长、政策由写作时用官方来源核对，来源和核对月份写在每个文件的 `sources` / `checked`，页面底部显示。未能核实的只写了「约」或不写具体数字（见下方「待补核」）。

改内容后跑 `npm run check`，再 `npm run build`。

## 多语言

- 中文是原文。英文、日文由 `scripts/i18n.py` 用 AI 翻译（中转站临时限额 Key，`CBT_I18N_KEY_FILE` 指向 Key 文件，模型 `gpt-6.1-sol`），译文按「每个景点/条目」缓存在 `src/i18n/cache/`，只有改过的条目才重翻。构建时 `i18n.py build` 把缓存套到中文 JSON 上生成 `src/i18n/{en,ja}/**`；没译到的部分显示中文，CI 的 `i18n.py check` 会列出来。
- 写给中国大陆读者的内容，英日版改成通用说法（签证和驾照「看你的护照/驾照」、联系「你所持护照国家的使领馆」）；中国使领馆和 12308 只在中文版出现。美国、澳洲的签证途径（ESTA / ETA / eVisitor）是按读者写的，在 `content-overrides.json` 里手工维护。
- 界面文字：代码里写 `t('中文')`（构建时）或 `ct('中文')`（浏览器），中文原文就是查找键。`npm run i18n -- extract` 后再 `translate`。
- 日文版没有「日语大字卡」页（`src/lib/i18n.ts` 的 `MISSING`）。英日版不显示高德、小红书链接；预算按读者货币算（英文美元、日文日元，机票留空自填）。
- 语言切换在页头；选过的语言记在 `cbt-lang`，之后打开中文首页时自动转到该语言（只首页、每次访问一次）。分享链接、其他页面不跳转。

## 本地数据（localStorage）

- `cbt-theme`：用户手动选择的明暗主题（`light` / `dark`；未设置时跟随系统 `prefers-color-scheme`）。
- `cbt.saved-posts.v1`：本地收藏的攻略帖 slug 列表。
- `cbt.trip.v1`：行程（天数组、待安排、标题、出发日）。条目键 `s:<地点>/<id>`、`f:<地点>/<id>`，日本地点是县 slug（`kyoto`），澳美加前缀（`au.victoria`、`us.utah`），见 `src/lib/keys.ts`。分享链接把它 deflate + base64url 放在 `/plan/#t=…`，服务器不接收。
- `cbt-lang`：选过的界面语言。`cbt.budget.v1`：预算输入（含所选国家）。`cbt.checklist.v1`：清单勾选。`cbt.phrases.fav`：日语卡收藏。

## 离线

`/sw.js`（由 `src/pages/sw.js.ts` 生成，`scripts/finalize-sw.mjs` 在构建后按内容算版本、补上 CSS/JS 预缓存）预缓存首页、行程、快速攻略、预算、日本随身工具和澳美出行须知（英日版预缓存首页和行程），其它页面访问过即缓存，图片单独缓存（最多 400 张）。

## 部署

公开仓库 `Jaaay50/cloudborne-travel`，推送 `main` 后由 `.github/workflows/pages.yml` 构建（`npm ci && npm run build`）并发布到 GitHub Pages，约 1–2 分钟生效；每天北京时间 06:00 由 `.github/workflows/daily-posts.yml` 自动调研、写作、AI 生图、三语翻译并提交新攻略帖（需在仓库 Secrets 配置 `CBT_API_KEY`，可选配置 `TAVILY_API_KEY` / `SERPER_API_KEY` / `BRAVE_API_KEY` 扩展中文社媒检索），随后 06:17 的 `pages.yml` 自动重建上线（同步更新汇率和当季推荐）。自定义域名 `travel.cloudborne.cn`（`public/CNAME`；DNSPod `travel` CNAME → `jaaay50.github.io.`），HTTPS 强制。`art-src/` 不在仓库里，插画以 `public/img/` 的 WebP 为准。

**国内线路**（2026-11-24 起）：DNSPod `travel` 分线路解析——「境内」CNAME → `travel.cloudborne.cn.eo.dnse0.com.`（腾讯云 EdgeOne 个人版，站点 `zone-3xsll1v25wlu`，加速区域中国大陆，免费证书由 EdgeOne 自动续期），「默认」继续 → GitHub Pages。EdgeOne 回源到广州服务器（`175.178.188.85`，nginx `sites-available/cloudborne-travel.conf`，文件在 `/srv/travel/current` → `releases/<时间>`，保留最近 5 版）。同一个工作流的 `mirror` 任务把构建产物 rsync 到广州并 `publish`；仓库 secret `GZ_DEPLOY_KEY` 只能写 `/srv/travel/stage` 和执行 `publish`（服务器 `/usr/local/sbin/cbt-deploy` 强制命令）。缓存跟随源站：页面 `no-cache`，`/_astro/` 一年，`/img/` 七天；改了图片要在 EdgeOne 刷新 `/img/` 目录。页脚备案号 粤ICP备2026056740号-1。

上线后验收：`curl -sI https://travel.cloudborne.cn/` 为 200，首页、一个县页、`/plan/`、`/sw.js` 可访问，`/sw.js` 里的 `const V` 与本地 `dist/sw.js` 一致；国内线路从广州服务器 `dig @119.29.29.29 travel.cloudborne.cn` 应指向 EdgeOne，`/sw.js` 版本同样一致。

## 待补核

以下类型的数字目前只按维基百科或公开资料写了「约」，可再对照运营方官网补核：
- 日本：各地区内铁路/巴士时长、部分门票（金阁寺、清水寺、大阪城、彦根城未写价格）、美食人均区间、祭典固定日期。
- 澳大利亚：BridgeClimb、塔龙加动物园、龙柏考拉保护区、普芬比利小火车、库兰达火车的票价；部分州驾照规定页面当时打不开；北领地公园通行证价格来自旅游局。
- 美国：签证诚信费的收取状态、大都会博物馆票价、迪士尼日票区间、羚羊谷团费、部分州（纽约、麻省、宾州、犹他、科罗拉多、夏威夷）外国驾照细则；黄石 2026 春季开路日期。
- 三国的预算档位和美食人均都是估算。
