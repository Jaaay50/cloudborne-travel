# 游记数据与每日发布

中文原稿存放于 `src/data/posts/<slug>.json`。英文和日文构建读取各自的翻译副本，并在副本缺失时使用中文原稿。文章链接为 `/posts/<slug>/`，三语目录的 `po` 数组保留这个无语言前缀的链接。站点地图列出每篇文章的三语地址。RSS 在 `/rss.xml` 提供中文标题、摘要和发布日期。

## 冻结的 PostData 契约

下表列出 JSON 的全部顶层字段。带 `?` 的字段可以省略。字段名和枚举值区分大小写。路径用的小写 kebab-case ID 由 ASCII 字母、数字和连字符组成。

| 字段 | 类型 | 约定 |
| --- | --- | --- |
| `slug` | string | 小写 kebab-case，与 JSON 文件名一致 |
| `country` | string | `japan`、`australia` 或 `usa` |
| `places` | string[] | 本国现有地点键。日本如 `kyoto`，澳洲如 `au.victoria`，美国如 `us.utah` |
| `category` | PostCategory | `route` 路线实录、`pitfall` 避坑指南、`food` 美食探店、`season` 当季实况、`transport` 交通住宿、`budget` 预算复盘 |
| `date`、`checked` | string | 发布日 `YYYY-MM-DD`、资料核对月 `YYYY-MM` |
| `featured?` | boolean | 同一天的精选文章优先显示 |
| `title`、`subtitle`、`excerpt` | string | 文章标题、副标题、摘要 |
| `author` | PostAuthor | `id`、`name`、`handle`、`role`、`avatar`、`tone` 均为字符串 |
| `meta` | object | `days`、`budget`、`season`、`pace`、`audience` 均为字符串 |
| `tags`、`lead`、`highlights`、`pitfalls` | string[] | 标签、导语段落、亮点和避坑提示 |
| `cover` | PostPhotoSpec | `id` 固定为 `cover` |
| `steps` | PostStep[] | 5–10 个有序步骤。步骤 ID 在文章中唯一 |
| `budgetBreakdown` | PostBudgetRow[] | 至少一项，每项含字符串 `item`、`detail`、`amount` |
| `sources` | PostSource[] | 每项含字符串 `title`、`url`、`platform?`，至少两个不同的 HTTPS URL |

每个 `PostStep` 包含小写 kebab-case `id`，字符串 `phase`、`title`、`location` 和非空字符串数组 `paragraphs`。可选字段 `duration`、`cost`、`tip` 为字符串，`spotRefs` 为现有景点或食物键数组，`photo` 为 `PostPhotoSpec`。新稿使用 `s:<place>/<id>` 和 `f:<place>/<id>` 引用景点及食物。校验器也接受现有裸键 `<place>/<id>`。

`PostPhotoSpec` 的 `id`、`scene`、`caption`、`alt` 均为字符串。步骤照片使用独立的小写 kebab-case ID。用英文 `scene` 描述拍摄对象、角度、光线和背景。用中文写明 `caption` 和用于无障碍阅读的 `alt`。

### 图片与作者

- 封面输出为 `public/img/posts/<slug>/cover-{960,1920}.webp`。步骤照片输出为 `public/img/posts/<slug>/<photoId>-{640,1280}.webp`。生成器使用横向 3:2 图像，转换保留比例。
- 把手工原图放入 `art-src/posts/<slug>/`，以照片 ID 命名并使用 PNG 或 JPEG。运行 `npm run post:images` 生成 WebP 和索引。索引只收录两个尺寸齐全的 `<slug>/<photoId>`。未收录的图片会在内容检查中产生警告。
- 每个国家使用固定编辑人格。日本的小栖偏重铁路和换乘，澳洲的阿澜偏重海岸公路，美国的林野偏重公园路线。保持 `id`、`handle` 和口吻稳定，用 `role` 标明虚拟作者。在导语注明公开资料来源和 AI 配图。用第一人称呈现行程选择，明确注明估算和查价条件。

## 每日自动发布

```sh
npm run post:research -- --count 2 --country japan
npm run post:auto -- --country japan --dry-run
npm run post:auto -- --count 1 --country auto --translate
```

1. 采集 Reddit 公共 JSON、旅游 RSS 和 Atom，以及 Japan-Guide、Live Japan 的公开文章列表。根据当前月份、地点、选题和来源时效排序，并检查已有帖子与 `research/auto-post-history.json`。可从 Tavily、Serper、Brave 补充小红书、马蜂窝、穷游和知乎的公开搜索结果。使用 `--topic` 提供选题，使用 `--out-research` 保存研究 JSON。
2. 将候选资料、地点和现有条目键发送到兼容 Chat Completions 的模型，生成 6–7 个步骤、1 张封面和 4–5 张步骤图的配置。结构校验失败时请求一次修复。`--research-only` 完成采集后停止。`--dry-run` 完成草稿校验后停止。
3. 图像 API 返回 Base64 或 HTTPS 下载地址。用 `cwebp` 生成两档尺寸并重建索引。`--skip-images` 允许发布没有图片文件的数据。
4. 校验新稿，按需执行英日翻译并更新发布历史。运行失败时回滚本次新稿、图片、索引和缓存变化。

Python 3.9+ 使用标准库。生成图片需要 Node.js 和 `cwebp`。脚本依次使用 `CBT_API_KEY`、`OPENAI_API_KEY`、`CBT_API_KEY_FILE`。兼容 API 的默认地址是 `https://api.cloudborne.cn/v1`，通过 `OPENAI_BASE_URL` 配置。`CBT_POST_MODEL` 默认为 `gpt-6.1-sol`，`CBT_IMAGE_MODEL` 默认为 `gpt-image-2.6`。可选搜索凭据变量为 `TAVILY_API_KEY`、`SERPER_API_KEY` 和 `BRAVE_API_KEY`。

GitHub Actions 每日 22:00 UTC（次日 06:00 北京时间）运行，也支持手动输入 `count`、`country`、`topic`。配置仓库的 `CBT_API_KEY` secret 后，工作流生成、验证、构建，并把内容、索引、图片、翻译缓存和历史推到 `main`。缺少 secret 时工作流发出跳过通知。由 `GITHUB_TOKEN` 推送的提交不会触发另一条推送工作流。已有 Pages 定时构建会读取届时的 `main`。

### 导入离线翻译

准备 JSON 对象，以 `posts/<slug>.json` 为键、同结构的译文对象为值。可把文件映射放在 `files`，同时用 `ui` 提供中文原文到译文的映射。译文应保留原文的数组顺序、结构和占位符。分别导入英文和日文，再构建及核对缓存覆盖率。

```sh
python3 -I scripts/i18n.py import-cache --lang en translations-en.json
python3 -I scripts/i18n.py import-cache --lang ja translations-ja.json
python3 -I scripts/i18n.py build
python3 -I scripts/i18n.py check --strict
```
