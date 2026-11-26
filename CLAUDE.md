# cloudborne-travel 工作边界

- **提交身份**：公开仓库 `Jaaay50/cloudborne-travel`，每次提交必须显式传环境变量 `GIT_AUTHOR_NAME=Jaaay50 GIT_AUTHOR_EMAIL=Jaaay50@users.noreply.github.com GIT_COMMITTER_NAME=Jaaay50 GIT_COMMITTER_EMAIL=Jaaay50@users.noreply.github.com`，不要依赖全局 `~/.gitconfig`，也不要改全局配置。
- **推送与体积边界**：`art-src/` 不进 Git，仓库只保留 `public/img/` 双尺寸 WebP。本机 HTTPS 代理对单次 >10 MB 推送容易断连，新增大量图片时按每批 ≤5 MB 拆提交并用 `git -c http.version=HTTP/1.1 push origin main` 推送。默认不推送、不打标签，除非当次会话明确授权。
- **兼容性红线**：绝不改动行程条目键（`s:<place>/<id>`、`f:<place>/<id>`）或已有 `localStorage` 键名（`cbt-theme`、`cbt.saved-posts.v1`、`cbt.trip.v1`、`cbt-lang`）；用户分享链接与本地行程依赖这些键。
- **视觉与主题边界**：默认保持暖纸色浅色编辑基调与 `2–4px` 建筑感控件，保留自主明暗切换（`light` / `dark` / `system`，首屏内联脚本防闪烁）；深色模式下的强调徽章与紧急求助卡片统一使用 `var(--on-ink)` 保证 WCAG 对比度；禁止在卡片 hover 态叠入 `.reveal` 延迟或全屏 `feTurbulence` / `background-attachment: fixed`。
- **内容与三语校验**：修改 `src/data/` 或代码中的 `t()` / `ct()` 后，提交前必须跑通 `npm run check && python3 -I scripts/i18n.py build && python3 -I scripts/i18n.py check --strict && npx astro check && npm run build`。内容不得提及中国外交部赴日出行提醒，不得把 AI 合成攻略伪装成无法核实的个人多年亲历，图片一律标注为 AI 生成。
- **安全与凭据**：严禁绕过 `secret-guard`（gitleaks），严禁在仓库或文档写入任何 API Key / SSH Key 明文（自动化密钥仅走 GitHub Actions Secrets：`CBT_API_KEY`、`GZ_DEPLOY_KEY` 及可选搜索 Key）；`scripts/auto-post.py` 外链抓取与重定向必须经过公网 HTTPS 校验。

| 主题 | 真源 |
| --- | --- |
| 架构、常用命令、本地数据与部署验收 | [README.md](README.md) |
| 攻略帖 JSON 契约、配图与每日自动发布 | [POST-SCHEMA.md](POST-SCHEMA.md) |
| 日本 47 县与行程模板数据格式 | [CONTENT-SCHEMA.md](CONTENT-SCHEMA.md) |
| 澳大利亚 / 美国各州数据与生图规范 | [CONTENT-SCHEMA-AU-US.md](CONTENT-SCHEMA-AU-US.md) |
