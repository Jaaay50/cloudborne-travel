# 栖云旅行 · travel.cloudborne.cn

Cloudborne 栖云的日本旅行指南：47 个都道府县的原创攻略、互动地图、季节主题、行程模板、行程规划（拖拽排天、路线图、分享链接）、预算计算和离线随身工具。纯静态站（Astro 7），不登录、无后端、无数据库；用户数据只存在浏览器 localStorage。

## 目录

| 路径 | 内容 |
| --- | --- |
| `src/data/japan/prefectures/*.json` | 47 个县的正文、景点（含坐标）、美食、交通、提醒、来源。格式见 `CONTENT-SCHEMA.md` |
| `src/data/japan/regions/*.json` | 7 个多县地区（北海道、冲绳的地区页直接用县页） |
| `src/data/japan/trips/*.json` | 行程模板，引用县文件里的 spot/food id |
| `src/data/japan/covers.json` | 首页长图、47 县、7 地区、9 主题插画的场景描述和 alt |
| `src/data/toolkit/*.json` | 日语卡、紧急求助、退税、行前清单、交通、2026 新规 |
| `src/data/geo/japan-prefectures.json` | 县界（Natural Earth 10m admin-1，公有领域），由 `scripts/prepare-geo.mjs` 生成 |
| `src/lib/` | 数据加载（`content.ts`、`toolkit.ts`）、县与地区常量（`japan.ts`）、地图投影（`geo.ts`） |
| `src/components/JapanMap.astro` | 地图：首页「全国→地区→县」缩放 + 侧栏；县/地区页固定视角 |
| `src/scripts/` | 全站脚本：搜索、加入行程、行程存储与分享编码 |
| `public/img/` | 插画 WebP（1200/640 宽，首页长图 2304/1280） |
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
```

## 插画

木刻版画（新版画）风格，AI 生成（2026-11-23，64 张）。风格提示词和每张的场景描述在 `covers.json`。新增插画：按 `covers.json` 的 `style` + 场景生成 1536×1024 的图，放进 `art-src/<组>/<slug>.png`，跑 `build-images.mjs`。插画是风格化描绘，页脚已声明不代表实景。

## 内容与核对

正文为原创。票价、时长、政策由写作时用官方来源核对，来源和核对月份写在每个文件的 `sources` / `checked`，页面底部显示。未能核实的只写了「约」或不写具体数字（见下方「待补核」）。

改内容后跑 `npm run check`，再 `npm run build`。

## 本地数据（localStorage）

- `cbt.trip.v1`：行程（天数组、待安排、标题、出发日）。分享链接把它 deflate + base64url 放在 `/plan/#t=…`，服务器不接收。
- `cbt.budget.v1`：预算输入。`cbt.checklist.v1`：清单勾选。`cbt.phrases.fav`：日语卡收藏。

## 离线

`/sw.js`（由 `src/pages/sw.js.ts` 生成，`scripts/finalize-sw.mjs` 在构建后按内容算版本、补上 CSS/JS 预缓存）预缓存首页、行程、预算和全部随身工具页，其它页面和图片访问过即缓存。

## 部署

公开仓库 `Jaaay50/cloudborne-travel`，推送 `main` 后由 `.github/workflows/pages.yml` 构建（`npm ci && npm run build`）并发布到 GitHub Pages，约 1–2 分钟生效。自定义域名 `travel.cloudborne.cn`（`public/CNAME`；DNSPod `travel` CNAME → `jaaay50.github.io.`），HTTPS 强制。`art-src/` 不在仓库里，插画以 `public/img/` 的 WebP 为准。

上线后验收：`curl -sI https://travel.cloudborne.cn/` 为 200，首页、一个县页、`/plan/`、`/sw.js` 可访问，`/sw.js` 里的 `const V` 与本地 `dist/sw.js` 一致。

## 待补核

以下类型的数字目前只按维基百科或公开资料写了「约」，可再对照运营方官网补核：各地区内铁路/巴士时长、部分门票（金阁寺、清水寺、大阪城、彦根城未写价格）、美食人均区间、祭典固定日期。
