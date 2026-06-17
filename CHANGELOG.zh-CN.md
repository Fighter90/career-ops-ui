# 变更日志

**career-ops-ui** 的所有重要变更均记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

翻译版本:[English](CHANGELOG.md) · [Español](CHANGELOG.es.md) · [Português](CHANGELOG.pt-BR.md) · [한국어](CHANGELOG.ko-KR.md) · [日本語](CHANGELOG.ja.md) · [Русский](CHANGELOG.ru.md) · [繁體中文](CHANGELOG.zh-TW.md) · [Français](CHANGELOG.fr.md) · [Polski](CHANGELOG.pl.md) · [Українська](CHANGELOG.uk.md) · [العربية](CHANGELOG.ar.md)

> **说明** — 本文件已完整翻译为出版级简体中文(中国大陆用语规范),包含全部历史版本条目。代码块、提交信息、文件路径、URL、环境变量、命令行片段以及 CSP / SSRF / TOCTOU / WCAG / ATS / JD / SSE / REST / API 等通用英文缩写按原文保留。

---


## [1.74.2] — 2026-06-17

**fix(health): 在 `#/health` 和 `/api/status/providers` 中将 `GITHUB_MODELS_API_KEY` 作为可选检查项呈现。** v1.74.0 的 GitHub Models 提供商可在 `#/config` 中配置，但在 Health 页面上没有对应行，且在 `keysConfigured` 提供商表面中缺失。新增了可选检查项（与其他五个在线评估提供商相同的 "set / unset (manual mode)" 措辞），并将 `github`（及其 `GITHUB_MODELS_MODEL`）添加到 `/api/status/providers`，因此活动提供商路由和 Health 页面现在均反映全部六个。`tests/api.test.mjs` 的健康行测试已扩展到全部六个提供商。

---



## [1.74.1] — 2026-06-17

**docs + test: README「安装 AI 助手」章节；Gemini 连接器的完整分支覆盖。** 在 README 中新增安装/登录对照表——Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI 的安装链接 + 各自的 `#/config` 提供商映射 + 「继续前请先登录」（与 career-ops.org/docs 快速入门保持一致；说明 web-ui 是无需 CLI 的独立替代方案）。新增 `tests/gemini-connector.test.mjs`（8 个用例），覆盖 `runGemini` 的每个分支——无密钥、成功、API 错误、空/被屏蔽的补全、格式错误的响应体、超时、网络错误、`hasGeminiKey`——使 `server/lib/gemini.mjs` 语句覆盖率达到 100%。整体覆盖率：96% 行 / 88% 分支 / 96% 函数。测试套件 1126 → 1134。

---



## [1.74.0] — 2026-06-17

**feat(llm): GitHub Models (Copilot) 作为第6个提供商 + 6个助手的规范对齐。** career-ops.org/docs 列出了六个AI编程助手 — Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI。web-ui 现在支持全部六个：五个映射到现有的在线提供商（Anthropic / Gemini / OpenAI / Qwen / OpenRouter），GitHub Copilot CLI 获得了专用的 GitHub Models 连接器 — `runGitHubModels`（OpenAI-compatible；具有 `models` 权限范围的 GitHub PAT），可在 `#/config` 中配置（`GITHUB_MODELS_API_KEY` + `GITHUB_MODELS_MODEL`），并可通过 `LLM_PROVIDER=github` 选择；在 auto 顺序中排第6位。帮助包和 README 现在列出了规范的六个（将 Qwen CLI 重命名为 Qwen Code；添加了 Gemini CLI + GitHub Copilot CLI），README 还新增了完整的模式参考和门户适配器链接表，指向 career-ops.org/docs，使每个功能都可以追溯到父项目。`tests/llm-provider-context.test.mjs` 将获取边界矩阵扩展到所有六个提供商（`cv.md` + `profile.yml` 内联 + 返回的构件）；新的 `GITHUB_MODELS_*` 键已添加到所有 12 个语言区域字典中。测试套件 1125 → 1126。

---



## [1.73.0] — 2026-06-17

**feat(llm): 通用 Gemini 连接器 + 跨所有提供商验证的简历/配置文件上下文。** 新增 `server/lib/gemini.mjs`（`runGemini`）——一个无外部依赖的 Gemini `generateContent` 客户端，返回与 Anthropic / OpenAI 兼容客户端相同的 `{markdown, usage, error}` 结构。修复：`/api/mode/:slug` 和 `/api/deep` 此前将提示词路由至仅用于职位评估的 `gemini-eval.mjs`，导致 Gemini **Run live** 返回评估结果而非请求的产物（求职信、外联信、简报）。现在它们通过 `bundleProjectContext` 调用 `runGemini`，因此 `cv.md` + `config/profile.yml` 对 Gemini 的内联嵌入方式与其他所有提供商完全一致——信件和简报更加详尽且个性化。新增的 `tests/llm-provider-context.test.mjs` 模拟每个提供商的 HTTP 边界，并验证全部五个提供商（Anthropic / Gemini / OpenAI / Qwen / OpenRouter）均内联嵌入 `cv.md` + `profile.yml` 并返回产物（mode + deep + evaluate 矩阵，9 个用例）。`/api/evaluate` 保留其针对职位调优的 `gemini-eval.mjs`。Suite 1116 → 1125。

---



## [1.72.0] — 2026-06-17

**feat(modes): **Run live** 现在直接返回最终产出物（单次执行输出契约）。** 父模板 `modes/<slug>.md` 是为 Claude Code 的交互式会话编写的——其中一些（cover、contacto 等）在生成结果之前会暂停以询问澄清问题，这导致 Web UI 的 **Run live** 输出问卷而非产出物。`buildModePrompt` 现在将每个模式封装在非交互式输出契约中：静默执行分析（职位描述拆解、公司备注、ATS 关键词、个人档案↔职位描述差距、语气/角度选择），从 `cv.md` / `config/profile.yml` 中为模板通常会询问的内容选取合理的默认值，并仅输出最终产出物——以每种模式的「output ONLY {the cover letter / outreach message / …}」提示作为结束。因此，在 `#/cover` 上点击 **Run live** 现在将直接返回求职信本身；同样的修复适用于所有通用模式（cover、contacto、interview-prep、project、training、followup、patterns）的全部 12 个语言环境（产出物通过语言环境指令以 UI 语言书写）。Suite 1103 → 1116。

---



## [1.71.2] — 2026-06-17

**docs(i18n):** 发布文档一致性整理结果。每个 README 的 "Translations of this guide" 区块现在列出了全部 11 种同级语言（此前部分语言遗漏了 English/Français 或存在自链接），并恢复了节分隔符前的空行。完整的 QA 回归提示词已重命名为当前版本，文档（`CLAUDE.md`、`CONVENTIONS`、`LOCALIZATION`、`PROJECT-CONTEXT`）已与当前版本和测试数量（1103）同步。无代码或行为变更——仅文档变更，因此帮助/UI 翻译及 1.70.0–1.71.1 中的所有功能均保持不变。

---



## [1.71.1] — 2026-06-17

**fix(i18n): 应用内帮助指南现已完整翻译为全部 12 种语言。** 新增 `docs/help/{pl,uk,ar}.md`（每个文件均包含经过验证的 19 H2 / 75 H3 结构），使 `#/help` 能够为波兰语、乌克兰语和阿拉伯语提供原生语言包，而不再回退到英语 — `GET /api/help/{pl,uk,ar}` 现在会返回各自的语言区域内容。已接入所有帮助检查项（`help-ui`、`help.test`、`help-ru-config-section`、`canonical-docs-coverage`）。同时完成了所有 12 种语言的翻译列表：README 中的 «Translations of this guide» 部分（9 个 README）、本地化 CHANGELOG 中的 «Translations:» 标题（8 个文件），并更新了过时的文档计数。Suite 1100 → 1103。

---



## [1.71.0] — 2026-06-16

**feat(cover): 直接从 `#/cover` 生成求职信 PDF。** v1.70.0 新增的 cover 模式可生成信件正文；结果页面现在提供 **Generate PDF** 按钮，通过共享的内联 markdown→PDF 管道（`POST /api/stream/pdf/inline` → `generate-pdf.mjs`）进行渲染，与 interview-prep 使用的路径相同。现在无需离开 SPA 即可撰写信件并生成 PDF 发送。

**test/docs: v1.70.0 审查加固。** 为 cover 模式（白名单 + 提示词组装）、国旗 `<select>` 切换器 + 阿拉伯语 RTL（`dirFor`/`<html dir>`）、每个语言环境的 `top.langLabel`、求职信 PDF 连接，以及 `prompts.mjs` 语言环境指令 + fr/pl/uk/ar 脚手架新增了 CI 隔离覆盖率。更新了 `docs/sdd/CONVENTIONS.md` 和完整项目 QA 回归提示中过时的「全部 8 个」→ 12 个语言环境引用。

---



## [1.70.0] — 2026-06-16

**feat(i18n): 新增三种 UI 语言——波兰语（pl）、乌克兰语（uk）和阿拉伯语（ar，含完整 RTL 支持）——将 SPA 扩展至 12 个语言区域，与父项目 career-ops README 中的所有语言保持一致。** 每种新语言区域均附带包含 697 个键的完整词典（`public/js/lib/locales/i18n-dict.{pl,uk,ar}.js`），并通过现有的奇偶校验 / 覆盖率 / 无拉丁字母泄漏 / 无个人数据测试套件验证。阿拉伯语新增真正的从右到左支持：`i18n.js` 为 RTL 语言区域设置 `<html dir="rtl">`，`app.css` 中有作用域的 `[dir="rtl"]` 块镜像页面外壳（侧边栏、通知抽屉、markdown 表格/块引用、行内间距）——LTR 语言区域的字节内容完全不变。新增 `top.langLabel` 键（×12）为屏幕阅读器命名语言选择器。

**feat(ui): 带国旗图标的 `<select>` 语言切换器取代了原来会换行的按钮行。** 有 12 个语言区域时，旧的 `.lang-btn` 行在侧边栏中会换行为三行；原生 `<select>`（每个选项以国旗 emoji 为前缀）能够整洁地扩展，开箱即用地支持键盘和屏幕阅读器，并且对 CSP 安全（通过 `addEventListener` 处理变更事件，无内联 JS）。在平台缺少国旗字形的情况下，国旗会降级为地区字母，因此语言标签始终是关键标识符。

**feat(cover): 将父项目的求职信模式（career-ops v1.10.0 + v1.11.0 问候语）移植到 SPA。** 在"申请"导航组下新增 `#/cover` 页面，基于通用模式运行器构建：职位描述 + 公司/职位 + 可选问候语 → 从 `cv.md` / `modes/_profile.md` 生成的定制化求职信。将 `cover` 添加到服务器 `MODE_ALLOWLIST` 和 `cover.*` i18n 块（×12 个语言区域）。

**chore(compat): 跟踪父项目 career-ops v1.11.0。** 已验证读写契约完好无损——`data/applications.md` 仍是 markdown 真实数据源（v1.11.0 SQLite 追踪器索引是派生缓存），追踪器列仍按标题映射。`parentVersion` 现在报告 1.11.0。

**fix(i18n): 修复了一个潜在缺陷，即法语（在 v1.61.0 中添加）缺失于 `server/lib/prompts.mjs` 的 `LOCALE_NAMES` 和 `SCAFFOLD_STRINGS` 中**——法语 LLM 调用静默回退至英语输出和英语脚手架。fr/pl/uk/ar 现已全部接入提示语言区域路径。

> 已知后续工作：应用内帮助指南（`docs/help/`）对 pl/uk/ar 回退至英语（UI 外壳本身已完全本地化）；父项目的交互式面试引导、反向 ATS 发现以及较新的扫描提供商尚未在 SPA 中呈现。

---




## [1.69.2] — 2026-06-12

**fix(test)：修复一处测试隔离泄漏，此前 `npm test` 会覆盖你真实的 `config/profile.yml` 和 `data/scan-history.tsv`。** `tests/critical-fixes.test.mjs` 在文件顶部导入了 `prompts.mjs`（→ `paths.mjs`），导致在 `before()` 将 `CAREER_OPS_ROOT` 设为临时目录之前，`PROJECT_ROOT` 就解析到了真实的父目录 —— 于是 `PUT /api/profile` 每次运行都会把「Acceptance Test」夹具写入你的真实档案。修复：在 `before()` 内通过动态 `import()` 加载 `prompts.mjs`。新增 `tests/test-root-isolation.test.mjs`（2 个用例）保护整个测试套件免受该模式影响。无生产代码改动。测试套件 1084 → 1086。

---



## [1.69.1] — 2026-06-12

**fix(scan):`#/scan` 不再静默截断大型区域扫描。** 每个区域的显示集被硬限制为 500 条（真实的 RU 扫描有 1352 条匹配，却只显示 500 条，隐藏 852 条 —— 即「扫描 2000、仅显示约 600」的症状）。两个扫描器现在使用共享且可经环境变量覆盖的常量 `MAX_STORED_RESULTS`（默认 2000，可通过 `SCAN_MAX_RESULTS` 覆盖）。仅影响显示 —— 写入 `pipeline.md` / `scan-history.tsv` 早已使用未截断的集合。**fix(health/ui):`#/health` 检查卡片不再溢出。** 过长的名称/值会与 **Fix →** 按钮和状态徽章重叠；该行现在通过 `.health-check-row` 收缩并换行。新增测试 `scan-result-cap` + `health-card-overflow`。测试套件 1079 → 1084。

---



## [1.69.0] — 2026-06-12

**feat(scan)：扫描器适配器自动发现 (P-14)——只需在 `server/lib/sources/` 中放入一个 `.mjs` 文件即可注册新数据源。** 在 v1.69 之前，`server/lib/sources/registry.mjs` 中的数据源列表是手动维护的静态数组：添加适配器需要同时修改 `<id>.mjs` 和 `registry.mjs`。完成路线图项目 P-14（`docs/ROADMAP.md`）的剩余部分。现在 `server/lib/sources/` 中的每个 `*.mjs` 在模块启动时动态加载，每个适配器通过自描述块 `export const meta = { value, label, region, configKey? }` 声明自身。已发布的 12 个适配器（ashby / greenhouse / lever / rss / smartrecruiters / workable / workday + geekjob / getmatch / habr / hh / trudvsem）各自获得 `meta`；`registry.mjs` 通过 top-level await 解析 `readdirSync` + 动态 `import()`（Node 18+ ESM 标准）。公共 API（`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`）保持不变——所有现有导入继续工作。格式错误的 `meta` 会被拒绝，每个问题文件都会输出一次 `console.warn`。新增 `tests/sources-registry-discovery.test.mjs`，包含 14 个测试用例。套件 1065 → 1079。

---



## [1.68.2] — 2026-06-07

**fix(bin)：通过 `npx` / `npm link` 调用的 CLI 动词此前已损坏——现在 bin 路径会沿符号链接解析。** npm 和 npx 会将 `career-ops-ui` 暴露为 `node_modules/.bin/` 下的符号链接，而旧的 `dirname "${BASH_SOURCE[0]}"` 指向的是 `.bin` 而非包根目录，于是 `npx career-ops-ui init` 会执行 `node node_modules/scripts/init.mjs` 并以 `MODULE_NOT_FOUND` 崩溃（本地 `npm install` 运行不受影响，因而掩盖了该缺陷）。现在 `bin/career-ops-ui.sh` 与 `bin/start.sh` 会沿符号链接链规范化 `SCRIPT_DIR`（`readlink` 循环 + `cd -P`），因此每个动词都能从仓库、通过 `npm link` 以及通过 `npx` 正常工作。在 `tests/sh-files.test.mjs` 中新增一个回归锁，通过 `.bin` 风格的符号链接执行动词。套件 1065/1065。

---



## [1.68.1] — 2026-05-29

**fix(scan)：各来源抓取超时 10s → 60s。** v1.67.1 的 10s 快速失败也会切掉只是需要更多时间的「缓慢但存活」的 Ashby 看板。把默认值提高到一分钟，让它们有机会返回。权衡：真正死掉/挂起的来源现在会占用并发槽整整 60s（最坏情况扫描更慢），而长期挂起者（Perplexity、Supabase、Resend 等）很可能仍会超时——要真正解决需按来源处理 / 降低 Ashby 并发。可用 `SCAN_FETCH_TIMEOUT_MS` 覆盖。套件 1063/1063。

---



## [1.68.0] — 2026-05-29

**feat(scan)：重做结果筛选面板 —— 带标签的字段、应用按钮、现场办公选项，以及真正生效的薪资筛选。** `#/scan` 的每个筛选现在都是带标签的字段（标签在控件**上方**，而非占位符）：搜索 · 工作类型 · 薪资下限 · 薪资上限 · 来源 · 范围。显式的**应用**按钮（外加**重置**，以及在任意字段按 Enter）会重新执行筛选；页面提示说明用法。**薪资区间现在真正起作用** —— 一旦设置下限/上限，薪酬超出区间的职位**以及未标注薪资的职位**都会被移除（区间重叠；忽略币种）。工作类型筛选在 远程 / 混合 / 搬迁 之外新增**现场办公**选项。新增 i18n 键 ×9；`salaryInRange` 改为严格；套件 1063/1063。

---



## [1.67.1] — 2026-05-29

**fix(scan)：各来源抓取超时 30s → 10s（快速失败）。** v1.67.0 提到 30s 只挽回了约一半的缓慢 Ashby 看板；其余（Perplexity、Supabase、Resend、DeepL、Ramp 等）无论期限都会挂起，因此更长的超时只是让整次扫描在等待死槽时停滞。10s 对长期挂起者快速失败并保持扫描的响应性。可用 `SCAN_FETCH_TIMEOUT_MS` 覆盖。套件 1060/1060。

---



## [1.67.0] — 2026-05-29

**feat(scan)：`#/scan` 新增薪资区间（下限／上限）筛选，并延长各来源的抓取超时。** 结果表在文本与远程筛选旁新增两个数字输入（薪资 **下限** ／ **上限**）。每行的自由文本薪资（`от 100 000 до 200 000 ₽`、`120000-150000 USD`、`$120K–$150K` 等）会被解析为数字区间，并按区间重叠进行匹配；未标注薪资的行会保留，因此筛选只是缩小列表而非清空（比较不区分币种——不做汇率换算）。同时**将各来源扫描的抓取超时从 15s → 30s**（可用 `SCAN_FETCH_TIMEOUT_MS` 覆盖）：Ashby 的 `includeCompensation` 负载在 ×8 并发下经常超过 15s，导致每次扫描约有 30 个 Ashby 看板超时。新增 `window.Skills.parseSalaryRange`／`salaryInRange` + i18n ×9；新增 13 项测试；套件 1060/1060。

---



## [1.66.0] — 2026-05-28

**feat(scan)：RU 来源现在遍历全部结果页，而非仅第一页。** hh.ru、Habr Career 与 Trudvsem 此前每次查询只取前 ~50 条；现在会翻到最后一页——hh.ru/Habr 用 `&page=N`，Trudvsem 用 `offset`/`meta.total`——跨页去重，并在某页没有新结果时（或到 50 页安全上限）停止。像「Backend разработчик」这样的查询现在返回完整结果而非一页（如 hh.ru PHP 17 → 3 页 55+ 条；Trudvsem 返回全部 72 条）。逐页请求保留既有的超时 + AbortSignal。新增 4 项测试；套件 1045/1045。

---



## [1.65.0] — 2026-05-28

**feat(scan)：hh.ru 改为从其公开网站抓取，而非 JSON API——任何 IP 都可用，无需代理。** `api.hh.ru` 开始无论 IP 或 User-Agent 都对所有程序化客户端返回 `403 forbidden`（边缘反爬封锁）。而网站（`hh.ru/search/vacancy`）会向任何类浏览器客户端返回完整结果，因此适配器现在解析该 HTML（与 Habr Career 相同）。**移除 1.64.0 的 `HH_PROXY` 变量与 `undici` 依赖**——无需代理、密钥或 User-Agent。测试改写为 HTML 解析；套件 1041/1041。

---



## [1.64.0] — 2026-05-27

**feat(scan)：通过 `HH_PROXY` 将 hh.ru 请求经俄罗斯代理转发。** hh.ru 按 **IP**（而非 User-Agent）封锁其 API，因此单靠 `HH_USER_AGENT` 无法解除来自非俄罗斯出口节点的 403。将 `HH_PROXY` 设为俄罗斯 HTTP/HTTPS 代理 URL（如 `http://user:pass@ru-host:port`），则**仅** hh.ru 请求经该代理转发，其余来源保持直连。基于 `undici` 的 `ProxyAgent`（新增运行时依赖）；未设置 `HH_PROXY` 时完全不附加 dispatcher。新增 3 项测试；套件 1041/1041。

---



## [1.63.2] — 2026-05-27

**feat(scan):`#/scan` 控制台实时显示 % 进度 + 按来源的详细日志。** 进度条现为**确定式** —— 扫描器发出进度事件(EN:按公司;RU:按查询)经 SSE 转发,进度条带 **"Scanning… NN%"** 标签填充(动画条纹仅持续到首个事件)。每个来源的首次失败(超时 / 403 / 网络)会在控制台详细输出,之后的重复予以抑制。新增 1 项测试;套件 1040/1040。

---



## [1.63.1] — 2026-05-27

**style(scan):让 `#/scan` 进度条更醒目。** 为运行中指示器加上可见的 **"Scanning…"** 文案,并将进度条加高到 **8px**(原为细 4px),扫描时清晰可见。行为无变化。

---



## [1.63.0] — 2026-05-27

**feat(scan):按请求超时 + `#/scan` 进度条。** 来源请求没有截止时间,因此卡住的上游(例如来自被封 IP 的 `api.hh.ru`)可能**令整个扫描挂起**。新增 `server/lib/fetch-timeout.mjs` 包装扫描器的 `fetchImpl`(`makeTimeoutFetch`,默认 **15 秒**,可用 `SCAN_FETCH_TIMEOUT_MS` 覆盖),为每个请求设置硬性截止;超时来源记为非致命错误,扫描继续。`#/scan` 在扫描期间显示进度条(全部 9 个语言版本的 `scan.progress`)。新增 7 项测试;套件 1039/1039。

---



## [1.62.3] — 2026-05-27

**docs:明确安装方式(career-ops-ui 运行于 `career-ops/web-ui/` 内)+ `init` 故障排查,覆盖全部 9 个语言版本。** 将安装小节重写为 **Option 1**(一条 curl)/ **Option 2**(在现有 career-ops 项目内以 `web-ui` 克隆 UI)+ CLI 命令 + 提供方配置 + **Troubleshooting `init`** 区块。嵌套结构说明也加入 `/help` §1 Setup;README 高亮处汇总整个 v1.62.* 系列。仅文档,无代码改动。

---



## [1.62.2] — 2026-05-27

**fix(help):`#/help` 筛选现已支持全文检索(可找到像 RSS 这样的 H3 子小节)。** 帮助页的搜索/目录筛选此前仅匹配 H2 小节标题,因此 v1.62.x 的 RSS 文档(§5 Portals & sources 下的 H3)无法被找到。现在每个小节的正文也会被索引到筛选中,因此搜索如「RSS」即可定位到 §5。纯客户端改动,无 API 变更。

---



## [1.62.1] — 2026-05-27

**feat(scan)：来源筛选器加入 RSS + 修复 RSS 地点。** `#/scan` 的来源筛选下拉框现在列出 **RSS**(已加入 `server/lib/sources/registry.mjs` 与 SPA 回退列表),因此 RSS 招聘板(LaraJobs、WeWorkRemotely 等)的结果可像任何 ATS 来源一样筛选。RSS 适配器不再将订阅源的 `<category>` 标签映射到 `location` —— 这些非地点标签会让 `location_filter` 误删远程职位;现在 `location` 留空,订阅源即可通过地点筛选。扫描按钮的提示/标签与来源列表 i18n 文案已在全部 9 个语言版本中更新(Workable / SmartRecruiters / Workday / RSS)。已更新 i18n 快照与来源端点测试(EN 6 → 7)。

---



## [1.62.0] — 2026-05-27

**feat(scan)：用于非 ATS 招聘板的通用 RSS 适配器。** 新增 `rss` 适配器（`server/lib/portals/adapters/rss.mjs` + `server/lib/sources/rss.mjs`），使扫描器能够从任意 RSS 源抓取职位 —— LaraJobs、WeWorkRemotely、RemoteOK、golangprojects 以及 Greenhouse/Ashby/Lever 之外的其他招聘板。无新增依赖：基于正则的订阅解析，支持 CDATA 与 HTML 实体（标题/公司名去除标签，星位码点安全解码）。通过 `portals.yml` 中的 `provider: rss` / `rss:` / `feed_url:` 按公司启用，不会拦截已匹配 ATS 的公司。`ALL_ADAPTERS` 由 6 增至 7。新增 29 项测试；已在全部 9 个 README 语言版本中记录。

---



## [1.61.1] — 2026-05-22

**fix(i18n)：在全部 9 种语言中本地化主题切换按钮的 title 与 aria-label（MINOR-001）。** 明/暗主题按钮(`#theme-toggle`)在 `index.html` 中硬编码了 `title="Toggle theme"` 和 `aria-label="Toggle theme"` —— 所有语言下工具提示和屏幕阅读器文本都未翻译。新增 `top.themeToggle` 键 + `applyI18n()` 中的 `data-i18n-title` 处理器(沿用 v1.58.15 搜索 aria-label 修复的模式),在启动时及每次切换语言时本地化这两个属性。由 `tests/playwright-theme-toggle-i18n.mjs`(9 语言 + 运行时切换)和两个静态守卫锁定。v1.61.0 法语签收中唯一的 LOW 项。(MINOR-001)

---



## [1.61.0] — 2026-05-22

**feat(i18n)：新增法语作为第 9 种界面语言。** 新的按语言字典 `public/js/lib/locales/i18n-dict.fr.js`（`window.__I18N_DICT_FR`）与英语完全对等（**668 个键**）；新的帮助包 `docs/help/fr.md`（**19 H2 / 73 H3**，与 `en` 结构完全对等）。`fr` 已注册到语言切换器与浏览器自动检测（`i18n.js`）、装配器（`i18n-dict.js`）、`index.html`（位于装配器之前的 `<script>` 标签）、测试快照以及所有测试语言列表中。初始翻译表来自 **PR #9**（社区贡献）。逻辑无变化：`t()` 与所有视图保持不变。单元测试 **1001 / 1001**；Playwright 语言遍历扩展为 9 个子测试。(FR-LOCALE)

---



## [1.60.0] — 2026-05-22

**refactor(i18n): 将 8 语言合一的大文件拆分为按语言的文件 (I18N-SPLIT).** 翻译词典原先位于单个 `public/js/lib/i18n-dict.js`；现改为 `public/js/lib/locales/` 下**每种语言一个文件**外加共享的 `i18n-dict.aliases.js`，让译者可以独立编辑单一语言（i18next / OpenWA 布局）。`i18n-dict.js` 现在是一个**装配器**，把各语言表重新合并成完全相同的 `window.__I18N_DICT`，因此 `t()` 与所有视图保持不变。通过 `<script src>` 同步加载——无构建、无 fetch。快照证明迁移无损（678 个键）。工具与约 25 个测试已适配拆分；新增 `tests/i18n-locale-files.test.mjs` 与 `tests/playwright-locale-sweep.mjs`（在真实 Chromium 中逐页 × 8 语言验证）。994 → **1000** 单元 · 62 → **70** Playwright。无行为变化。(I18N-SPLIT)

---



## [1.59.13] — 2026-05-21

**fix(i18n): 用 @alias 合并真正重复的键 + 个人数据最终清理.** 从测试夹具/QA 报告中移除维护者真实姓名(→ `Jane Doe`),`LICENSE`/`package.json` 改为 `Fighter90` 句柄。`@alias` 机制合并 8 个语言完全相同的 10 个键。`nav.config`/`config.title` 因西班牙语不同而不合并。991 → **994** 测试。(I18N-CL3)

---



## [1.59.12] — 2026-05-21

**fix(i18n): i18n-dict.js 清理 — fr 语言前 (I18N-CL1, I18N-CL2, I18N-CL4).** 将 `training.coursePh` 中的个人数据替换为通用占位符,`followup.lastPh` 由固定日期改为格式提示,新增 `npm run audit:i18n`。重复值分组是有意为之(不同 UI 角色)—— 见字典头部。(I18N-CL1, I18N-CL2, I18N-CL4)

---



## [1.59.11] — 2026-05-21

**fix(test): v1.59.11 — e2e-comprehensive 套件现在 23/23 通过(之前 11/23)。** Playwright 的 `page.goto` 对仅改变 hash 的 URL 是 no-op,这是根因。新的 `goRoute(hash)` 助手通过 `about:blank` 反弹以强制真实导航。(e2e-harness-r1)

---



## [1.59.10] — 2026-05-21

**fix(api): NEW-F1-sub-r1 (v1.59.10) — 原始 `..` 守卫上移到所有 `/api` 路由注册之前。** v1.59.8 的位置在 `app.all` 之后,从未触发。现在它在 Express 规范化之前运行。(NEW-F1-sub-r1)

---



## [1.59.9] — 2026-05-21

**fix(ux): UX-A5-r4 (v1.59.9) — Help TOC 滚动监听调试标记 `data-toc-spy="active"` + 行为锁测试。** 第 6 个周期。同步初始绘制 + 双 rAF 重新计算 + resize 监听器 + hashchange 清理。(UX-A5-r4)

---



## [1.59.8] — 2026-05-21

**fix(ux+api): v1.59.8 — UX-A5-r3 + NEW-F1-sub (HIGH + LOW 合并)。** FINAL-REGRESSION-v1.59.7 报告授权的 doctrine 例外。UX-A5-r3: `#/help` 将 IntersectionObserver 替换为带 rAF 节流的 `scroll` 监听器。NEW-F1-sub: 中间件将 `/api/*` 的原始 `..` 以 404 JSON 拒绝。(UX-A5-r3 · NEW-F1-sub)

---



## [1.59.7] — 2026-05-20

**fix(api): NEW-D3-cache (v1.59.7) — `GET /api/cv` 发送 `Cache-Control: no-store`。** CV 是用户主要工件,始终重新验证。(NEW-D3-cache)

---



## [1.59.6] — 2026-05-20

**feat(a11y): NEW-D2-motion (v1.59.6) — 尊重 `prefers-reduced-motion: reduce`。** 新 `@media` 块禁用动画、过渡和 `scroll-behavior`。(NEW-D2-motion)

---



## [1.59.5] — 2026-05-20

**fix(api): NEW-F1 (v1.59.5) — 未知 `/api/*` 在任何 HTTP 动词上都返回 JSON 404。** `app.get` → `app.all`。(NEW-F1)

---



## [1.59.4] — 2026-05-20

**fix(ui): NEW-OR1 (v1.59.4) — `#/config` Active/Keys 芯片消除竞态。** 原子 replaceChildren + 在途令牌 + 上次良好状态缓存。(NEW-OR1)

---



## [1.59.3] — 2026-05-20

**fix(ux): UX-A5-r2 (v1.59.3) — 强化 `#/help` 滚动监听。** rootMargin 可见带从 10 % 扩展到 25 % + 挂载时计算初始状态。(UX-A5-r2)

---



## [1.59.2] — 2026-05-20

**fix(ui): v1.59.2 — Active/Keys 芯片:计数正确、提供方名称大写、不再重叠。** (post-v1.59.1 hotfix)

---



## [1.59.1] — 2026-05-20

**fix(test): v1.59.1 — NEW-D1 守卫接受 UX-A11 打磨过的 ES 文案。** (v1.59.1)

---



## [1.59.0] — 2026-05-20

**feat(ui): UX-A14 (v1.59.0) — 移动端(≤ 420 px)审计通过。** 新的 `@media (max-width: 420px)` 块中包含 5 项修复。(UX-A14)

---



## [1.58.65] — 2026-05-20

**test(ui): UX-A2 (v1.58.65) — Modes 结构化字段表单回归锁测试。** 新测试保护 v1.54.3 实现免受回归。(UX-A2)

---



## [1.58.64] — 2026-05-20

**fix(i18n): UX-A11 (v1.58.64) — es/pt-BR 文案打磨。** 英语借用词替换为母语等价表达。(UX-A11)

---



## [1.58.63] — 2026-05-20

**fix(ui): UX-A15 (v1.58.63) — Dashboard Pipeline 磁贴获得视觉主要强调。** Pipeline 磁贴现在带有强调边框、更大的图标和加粗的标签。(UX-A15)

---



## [1.58.62] — 2026-05-20

**feat(ui): UX-A9 (v1.58.62) — API keys 选项卡顶部的 sticky 摘要芯片。** `#/config → API keys` 选项卡顶部新增 sticky 芯片,显示活动提供方和已配置密钥数量。(UX-A9)

---



## [1.58.61] — 2026-05-20

**docs(readme): UX-A8 (v1.58.61) — 在所有 8 个 README 中添加首次运行清理章节。** 现在记录了在首次扫描前清理两个 QA 测试夹具 URL 的 `make clean-test-fixtures` 步骤。(UX-A8)

---



## [1.58.60] — 2026-05-20

**feat(ui): UX-A12 (v1.58.60) — 通知抽屉支持全部清除 + 单条关闭。** 通知面板新增全局清除按钮和每条 × 按钮。(UX-A12)

---



## [1.58.59] — 2026-05-20

**feat(ui): UX-A13 (v1.58.59) — `#/health` 失败行的可执行 "Fix →" CTA。** FAIL/OPTIONAL 行现在显示直接跳转到相应配置选项卡的 ghost 按钮。(UX-A13)

---



## [1.58.58] — 2026-05-20

**fix(ux): UX-A10 (v1.58.58) — 防止 `#/cv` 未保存的编辑丢失。** 浏览器关闭(`beforeunload`)和 SPA 内导航(`hashchange`)在脏缓冲区时显示本地化确认对话框。(UX-A10)

---



## [1.58.57] — 2026-05-20

**test(ui): UX-A7 (v1.58.57) — cost-line 自动刷新契约的回归锁测试。** 新增静态测试,确保 `providers-changed` 事件被派发、被订阅,以及所有 advisor 视图都调用 `UI.providerCostHint`。(UX-A7)

---



## [1.58.56] — 2026-05-20

**fix(a11y): UX-A4 (v1.58.56) — `.lang-btn` 满足 WCAG 2.5.8 最小触控目标尺寸。** 修复前语言按钮高 23–25 px,低于 24×24 px 标准。现在通过 `min-height: 28px` + `min-width: 28px` 达到 WCAG 2.2 AA 合规。(UX-A4)

---



## [1.58.55] — 2026-05-20

**feat(ui): UX-A3 (v1.58.55) — Dashboard 活动提供方芯片。** `#/dashboard` 主区现在显示当前活动的 LLM 提供方(`⚡ Live evals: Anthropic claude-sonnet-4-6` 或 `📋 Manual prompt mode`)。在 `#/config` 更改 `LLM_PROVIDER` 或标签页重新获得焦点时自动更新。(UX-A3)

---



## [1.58.54] — 2026-05-20

**fix(ux): UX-A1 (v1.58.54) — Deep 简报结构防御性警告。** 当保存的简报缺少 6 个标准章节(Company snapshot / Engineering culture / Recent news / Glassdoor / Interview process / Negotiation leverage)中至少 3 个时,`public/js/views/deep.js` 会在内容前显示一个非阻塞警告并链接到参考文档。这是 UI 层防护;根本的提示层修复位于父项目。(UX-A1)

---



## [1.58.53] — 2026-05-20

**fix(ux): UX-A6 — 所有 saved-card 通过单一 `renderSavedCard()` 助手渲染。** 保证任何渲染路径下都有 `<span>+<time>` 结构。948 → **949** 单元。(UX-A6)

---

## [1.58.52] — 2026-05-20

**fix(ux): UX-A5 — `#/help` TOC 滚动追踪现在能正确触发。** v1.58.45 的 setTimeout(0) 在路由挂载前就执行了。修复:直接引用 `headings` + 双重 `requestAnimationFrame`。947 → **948** 单元。(UX-A5)

---

## [1.58.51] — 2026-05-20

**chore(docs): v1.58.51 — v1.58.37 → v1.58.50 周期(14 个版本)的最终清理。** 不改代码。qa/ 重新整理(所有版本固定文档移到 `archive/v158-cycle/`);6 个 perennial 留在根目录。`REGRESSION-FINAL §13` 记录 v1.58.37→.50 的全部不变量。基线不变(947/947)。(housekeeping)

---

## [1.58.50] — 2026-05-20

**docs: DOC-1 — `qa/REGRESSION-FINAL.md` 新增 §5a(服务器错误正文按设计保持英文政策)。** 关闭 NEW-D4 为 `not-a-finding`。**完成 FIX-PROMPT-FINAL-EXHAUSTIVE.md 的 v1.58.37 → v1.58.50 队列(14 个版本)。** 946 → **947** 单元。(DOC-1)

---

## [1.58.49] — 2026-05-20

**chore(tooling): TOOL-1 — 新增 `make clean-test-fixtures` 与脚本,用于从父项目 `data/pipeline.md` 移除 example.com 行。** 支持 `--dry-run`。4 个 CI-isolated 测试。942 → **946** 单元。(TOOL-1)

---

## [1.58.48] — 2026-05-20

**fix(ux/onboarding): UX-D-B — 当用户仍使用默认模板资料时,`#/dashboard` 顶部显示全局警告横幅。** /api/health 检测到 `Profile customized: false` 时显示 `.hero-banner--warning`。新 i18n 键 `onboarding.fixtureWarning` + `onboarding.fixProfile` × 8。941 → **942** 单元。(UX-D-B)

---

## [1.58.47] — 2026-05-20

**fix(ux/naming): UX-D-C — 顶栏 "Quick scan" 重命名为 `打开 Scan`(它只是导航,并不真正启动扫描)。** 8 语言更新。940 → **941** 单元。(UX-D-C)

---

## [1.58.46] — 2026-05-20

**fix(ux): UX-D-D — `#/apply` 清单将 `{company}-{role}` 替换为从 URL/JD 派生的 slug。** 此前占位符按字面显示。新 `extractSlugs` + `substitutePlaceholders` 识别 Greenhouse/Lever/Ashby/Workable/SmartRecruiters/Workday。回退 `[company]/[role]`。939 → **940** 单元。(UX-D-D)

---

## [1.58.45] — 2026-05-20

**fix(ux): UX-D-K — `#/help` 的 TOC 滚动追踪高亮当前章节。** `IntersectionObserver` 把 `.toc-current` 应用到当前可见 H2 对应的 TOC 链接。938 → **939** 单元。(UX-D-K)

---

## [1.58.44] — 2026-05-20

**fix(ux): UX-D-L — `#/deep` 中打开的 Saved-research 简报新增内联 × 关闭按钮。** 此前只能滚动或离开页面才能关闭。新 i18n 键 `deep.closeBrief` × 8。937 → **938** 单元。(UX-D-L)

---

## [1.58.43] — 2026-05-20

**fix(ux): UX-D-F — `#/evaluate` 空提交时显示专用的本地化 toast。** 之前与"过短"是同一条消息。新 i18n 键 `eval.emptyJd` × 8。936 → **937** 单元。(UX-D-F)

---

## [1.58.42] — 2026-05-20

**fix(ux): UX-D-J — 所有 advisor 页面的 ETA 芯片一致性。** 此前仅 `#/auto` 显示 "⏱ ~1–2 min"。现 `#/evaluate`、`#/deep` 与 5 个 mode 页面同样显示 `⏱ ~30s`(新 i18n 键 `advisor.eta` × 8)。935 → **936** 单元。(UX-D-J)

---

## [1.58.41] — 2026-05-20

**fix(ux/truthfulness): UX-D-I — 费用提示在标签页重新可见 + `providers-changed` 事件时重新拉取。** 之前仅获取一次,在另一标签页更改提供商后旧值会持续显示。934 → **935** 单元。(UX-D-I)

---

## [1.58.40] — 2026-05-20

**fix(ux/docs): UX-D-H — 回归锁:每个可见的 `career-ops.org/docs/...` 深链必须保持可点击。** 新 `tests/external-doc-links.test.mjs` 校验 views/*.js 与 docs/help/*.md。932 → **934** 单元。(UX-D-H)

---

## [1.58.39] — 2026-05-20

**fix(ux): NEW-D2 — 仪表盘头部新增 Refresh 按钮并提供明确的反馈 toast。** 与连接横幅的 Refresh 不同;就地再取数 + 再渲染,不刷新页面。2 个新 i18n 键。931 → **932** 单元。(NEW-D2)

---

## [1.58.38] — 2026-05-20

**fix(a11y): NEW-D3 (WCAG 4.1.2) — `#/tracker` 搜索输入获得与 placeholder 不同的本地化 `aria-label`。** 此前仅有 placeholder,屏幕阅读器无法听到用途。新 i18n 键 `track.searchAria` × 8 语言,与 placeholder 不同。930 → **931** 单元。(NEW-D3)

---

## [1.58.37] — 2026-05-20

**fix(i18n): NEW-D1 — `#/pipeline` H1 在 es/pt-BR/ru 上本地化 + 修复 2 处 RU 标题泄漏。** 新 `tests/i18n-no-latin-leaks.test.mjs` 同时抓出 `contacto.title` 与 `health.title` 的 RU 泄漏。928 → **930** 单元。(NEW-D1)

---

## [1.58.36] — 2026-05-20

**chore(docs): v1.58.36 — v1.58.x 周期收尾的完整文档清理。** 不改代码。(1) qa/:3 个版本固定快照(`REGRESSION-END-TO-END-v1.58.16/33/35.md`)移到 `qa/archive/v158-cycle/`。(2) `REGRESSION-FINAL.md` 新增 **§12**(v1.58.4 → v1.58.35 全部不变量)。(3) `UX-AUDIT-PROMPT.md` 新增 30 行已关闭条目。(4) docs/architecture/ 刷新(FRONTEND 抽屉、TESTING 合计 928/62/20/23)。(5) CLAUDE.md 新增「v1.58.x 周期的硬经验教训」章节。(6) README ×8 新增「通知 🔔」行 + 修正过时的测试计数。基线无变化。(housekeeping)

---

## [1.58.35] — 2026-05-20

**fix(ui): v1.58.35 — 通知抽屉不再自动打开 + 帮助新增 §18「通知」(用户反馈)。** v1.58.34 bug:`.notif-drawer { display: flex }` 战胜了 UA 的 `[hidden] { display: none }`。修复:显式添加 `.notif-drawer[hidden] { display: none }`。抽屉仅在点击铃铛时打开。8 种语言的帮助新增 §18(类别表 + 键盘)。927 → **928** 单元。(用户反馈)

---

## [1.58.34] — 2026-05-20

**feat(ui): v1.58.34 — 通知抽屉(完全收口 U-13)。** 在 v1.58.33 捕获之上:新 `UI.onToast(fn)`、顶栏 🔔 + 未读徽章、右侧 `<aside role="dialog">`,本地化标题 / 空状态 / 条目(`notif.* × 8`)。Esc + 关闭 + 再次点击铃铛关闭。926 → **927** 单元。(U-13 follow-up)

---

## [1.58.33] — 2026-05-20

**fix(ux): U-13 + U-14 + U-15 — toast 日志(上限 50 + `UI.getToastHistory()`)+ `.page-header h1 + p` 兜底规则 + `#/cv` 未保存指示器。** 收尾 v1.58.x 系列。新增 i18n 键 `cv.unsaved` × 8 语言。925 → **926** 单元。(U-13/U-14/U-15)

---

## [1.58.32] — 2026-05-20

**fix(ux): U-12 — `#/help` TOC 过滤输入框获得 `min-width: 16ch` 以避免 KO/JA 占位符被截断。** 新增 `.help-toc__filter` 类。924 → **925** 单元。(U-12)

---

## [1.58.31] — 2026-05-20

**fix(ux): U-11 — Tracker `Legitimacy` 列表头新增本地化信息 ⓘ + tooltip 解释 High/Caution/Suspicious 级别。** 新增 i18n 键 `track.col.legitimacy.help` × 8 语言。923 → **924** 单元。(U-11)

---

## [1.58.30] — 2026-05-20

**fix(ux): U-10 — `data/applications.md` 为空时,Tracker 的 Normalize / Dedup / Merge 按钮禁用。** 本地化提示 (`track.fixEmpty` × 8 语言) 说明原因。922 → **923** 单元。(U-10)

---

## [1.58.29] — 2026-05-20

**fix(ux): U-9 — `#/pipeline` 计数 ↔ 过滤行在窄屏垂直堆叠。** 新 `.pipeline-controls` 类配合 `@media (max-width: 720px)` 把过滤拉伸到 100% 宽度。921 → **922** 单元。(U-9)

---

## [1.58.28] — 2026-05-20

**fix(ux): U-8 — 7 个 mode 页面的生成提示词块默认折叠。** 包裹在 `<details class="prompt-block">` 中;摘要显示本地化的 "Show prompt (N lines)"(`prompt.show` / `prompt.lines` × 8)。Copy + Run-live 仍可见。920 → **921** 单元。(U-8)

---

## [1.58.27] — 2026-05-20

**fix(ux): U-7 — `verify-pipeline.mjs` 的 `===` ASCII 分隔符从结果模态中移除。** 在处理函数内通过正则 `^={10,}$` 预先剥离。919 → **920** 单元。(U-7)

---

## [1.58.26] — 2026-05-20

**fix(ux): U-6 — `#/scan` 的 "Active companies N/M" 芯片通过 tooltip + aria-label 解释 N 与 M。** 新增 i18n 键 `scan.activeCo.help` × 8 语言。918 → **919** 单元。(U-6)

---

## [1.58.25] — 2026-05-20

**fix(ux/ia): U-5 — 仪表盘 CTA 去重(移除 header 的 `Open Pipeline` 按钮和 Quick-action 中 `Scan all sources` 卡片)。** 侧边栏与 hero 已覆盖两条路由;v1.58.3 QA 的 4× Pipeline / 4× Scan 减为各 2×。917 → **918** 单元。(U-5)

---

## [1.58.24] — 2026-05-20

**fix(ux): U-4 — 错误 toast 把 "(METHOD /path · HTTP NNN)" 后缀塞入折叠的 `<details>` 中。** 技术细节仍保留在 DOM 中(BUG-006 不变量),但标题更清爽。新增 i18n 键 `toast.details` × 8 语言。916 → **917** 单元。(U-4)

---

## [1.58.23] — 2026-05-20

**fix(ux): U-3 — `#/followup` 的 `lastContact` 占位符改为今日 − 14 天动态计算。** 固定 `2026-04-21` 会随时间老化;现在在渲染时通过 `new Date()` + `setDate(getDate() - 14)` 生成 ISO YYYY-MM-DD。915 → **916** 单元。(U-3)

---

## [1.58.22] — 2026-05-20

**fix(ux): U-2 — `#/auto` 的 H1 不再因前导 `✨` 而换行至两行。** 把 `✨` 从 `auto.title` 拆出到独立 `<span class="page-icon" aria-hidden="true">`;`.page-header--icon` 用 CSS grid 为图标设单独列。914 → **915** 单元。(U-2)

---

## [1.58.21] — 2026-05-20

**fix(ux): U-1 — `#/cv` 的 H1 + 副标题与其它页面统一(按设计撤回 v1.56.0 UX-9 chip)。** 移除 `.cv-breadcrumb` chip,改用 `<h1 class="page-title">` + `<p class="page-subtitle">`。单 `<h1>` 不变量保留。913 → **914** 单元。(U-1)

---

## [1.58.20] — 2026-05-20

**fix(i18n/platform): I-6 — 侧栏底部快捷键提示在 Mac 上显示 ⌘K、其它系统显示 Ctrl+K,动词本地化。** 之前在任何平台和语言下都显示英文字面 `CTRL+K — search`。`top.langhint` 现在采用 `{hotkey} — 搜索` 形式;`applyFooterHotkey()` 根据 `navigator.platform` 替换 `{hotkey}`。915 → **916** 单元。(I-6)

---

## [1.58.19] — 2026-05-20

**fix(i18n): I-4 — 俄语 `#/followup` 不再泄漏 `cadence` / `follow-up`。** RU followup 字符串(H1、提示)中混有 `cadence`、`follow-up`、`scope`、`timeline`。已替换为俄语本地表达。914 → **915** 单元。(I-4)

---

## [1.58.18] — 2026-05-20

**fix(i18n): I-3 — 帮助 TOC 项 2/5/13/14 在非拉丁语言下消除英文残留。** 修复前部分本地化帮助文档中仍含有 `## 2. App settings & API keys`、`## 5. Portals & Sources`、`## 13. Mode prompts`、`## 14. Apply checklist`。现 8 种语言全部完全本地化。913 → **914** 单元。(I-3)

---

## [1.58.17] — 2026-05-20

**fix(i18n): I-2 — Saved-research 卡片日期改用 `Intl.RelativeTimeFormat` 按语言本地化。** [public/js/views/deep.js](public/js/views/deep.js#L57-L82) 的 `formatRelative()` 之前在任何语言下都硬编码英文 `today` / `1d ago` / `Nd ago`。改为 `Intl.RelativeTimeFormat(I18n.getLang(), { numeric: 'auto' })` — 浏览器原生本地化字符串("今天/昨天/N 天前", "сегодня/вчера" 等)。超过 7 天的日期回退到 `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`。912 → **913** 单元。(I-2)

---

## [1.58.16] — 2026-05-20

**fix(ui): 品牌按钮悬停闪烁(用户反馈)。** 原因:`.btn-primary` / `.btn-danger` 默认背景为 `linear-gradient(...)`,`:hover` 把它换成纯色 `var(--rausch-dark)`。CSS 无法在渐变↔纯色之间补间,180ms `transition: background` 会"卡顿",用户看到白/粉色的瞬闪。修复 [public/css/app.css](public/css/app.css):悬停时保留渐变,改用 `filter: brightness(0.92)` 减暗 — `filter` 在所有浏览器中都能平滑补间。`.btn` 的 `transition` 列表新增 `filter var(--transition)`,让减暗带动画效果。911 → **912** 单元。(用户反馈)

---

## [1.58.15] — 2026-05-20

**fix(a11y/i18n): I-1 — 顶栏搜索的 `aria-label` 和视觉隐藏 `<label>` 现已本地化。** 之前所有 8 种语言下,屏幕阅读器听到的都是英文 aria-label。[public/js/app.js](public/js/app.js#L4-L29) 新增通用 `data-i18n-aria-label` 钩子 — `applyI18n()` 在每次语言切换时更新 `aria-label`,与 `data-i18n` / `data-i18n-placeholder` 对称。新增 2 个 i18n 键(`top.search.aria`, `top.search.label`)覆盖 8 种语言。钩子可被任何未来控件复用。910 → **911** 单元。(I-1)

---

## [1.58.14] — 2026-05-20

**fix(ux): M-9 — 连接横幅的"刷新"按钮现在提供反馈(之前为静默重载)。** 在 v1.58.13 之前,处理器直接调用 `location.reload()`。现在点击会立即弹出"刷新中…"的 toast,设置 `sessionStorage['refreshedToast']`,把按钮置为 `disabled` 防止双击叠加,并把 reload 延迟 200ms 让 toast 渲染。下次启动时 app.js 检测到标记,弹出成功 toast"已刷新"。在 8 种语言中新增 2 个 i18n 键(`common.refreshing`, `common.refreshed`)。909 → **910** 单元。(M-9)

---

## [1.58.13] — 2026-05-20

**fix(ux): M-8 — `#/apply` 清单变为可交互。** 在 v1.58.13 之前,"▶ 生成清单"把 0…7 号条目以等宽 `<pre>` 块呈现 — 只读、无法勾选。现在每个条目渲染为真正的 `<input type="checkbox">`,外层包裹 `<label>`(点击区域为整行,WCAG 2.5.5)。状态按 URL 持久化到 `localStorage['applyChecklist:'+slug]` — 勾选 3 项 → 刷新 → 3 项仍保持。按钮:**复制未勾选项**(把仍未完成的条目以 `- markdown` 子弹输出)与 **重置**。在 8 种语言中新增 5 个 i18n 键(`apply.checklist.copyUnchecked`, `resetBtn`, `copied`, `copyFailed`, `reset`)。解析器找不到条目时有防御性回退。908 → **909** 单元。(M-8)

---

## [1.58.12] — 2026-05-20

**fix(ux): M-7 — 成本提示跟随当前活跃提供商(OpenRouter 不再回退到伪造数字)。** `UI.providerCostHint()` 已经通过 `/api/status/providers` 实现 provider-aware,但 [public/js/api.js](public/js/api.js#L623-L676) 中的映射只列出 `anthropic`/`gemini`/`openai`/`qwen`。v1.57.0 加入 OpenRouter 为第 5 个提供商后,它会落到通用回退 0.03 并把名字显示为小写字面值 `openrouter`。现在 EST 加入 `openrouter: null`(由路由选择模型,费用因此而异),`=== null` 分支输出本地化的"cost varies (router picks)",而不是误导性的 `~$0.03/eval`。NAME 加入 `openrouter: 'OpenRouter'`。新增 i18n 键 `cost.varies` 覆盖 8 种语言。907 → **908** 单元。(M-7)

---

## [1.58.11] — 2026-05-20

**fix(ux): M-4 — 已保存研究卡片的标题↔日期间距改为结构化 CSS(原先为内联 margin)。** v1.58.3 MASTER 回归确认部分卡片显示为 `software-engineer-generaltoday`(标题与日期之间无空格),而另一些正常。原因:旧代码依赖两个裸 `<span>` 间的 `style="margin-left: 8px"`,在某些条目中折叠。修复:[public/js/views/deep.js](public/js/views/deep.js#L34-L55) — 将两个 `<span>` 替换为 `.saved-card__title` + 语义化 `<time class="saved-card__date" datetime="…">`,外层包裹 `.saved-card` flex 容器。间距由 `gap: var(--space-2, 8px)` 控制 → 不会再折叠,同时获得 `<time>` 的 a11y/SEO 语义。906 → **907** 单元。(M-4)

---

## [1.58.10] — 2026-05-20

**fix(ux): M-2 — 在打开任何结果模态框前先清空进度 toast。** 在 `#/cv` 点击 `sync-check` 时,"Running cv-sync-check.mjs…" toast 仍保留在右下角,而结果模态框已经打开 — 二者争夺注意,在窄屏上视觉重叠。Health 页面的 Doctor / verify-pipeline 按钮原本就在 `UI.modal()` 之前显式调用了 `UI.dismissToast()`;cv.js 的 sync-check 是唯一遗漏的入口。修复:[public/js/api.js](public/js/api.js#L272) — `UI.modal()` 现在将 `dismissToast()` 作为第一条可执行语句调用(边界处的纵深防御)。同时把 cv.js 中硬编码的英文字符串改为 `t('cv.syncCheckRunning')` / `t('cv.syncCheck')`,满足 BUG-008 不变量(模态框标题 == 本地化按钮标签)。在 8 种语言中新增两个 i18n 键。905 → **906** 单元。(M-2)

---

## [1.58.9] — 2026-05-20

**fix(a11y): M-1 — 在表单字段上恢复可见的 `:focus-visible` 焦点环(WCAG 2.4.7 Level AA)。** v1.58.3 MASTER 回归确认 `getComputedStyle(focusedInput)` 返回 `outline: rgb(255,255,255) none 1.5px` — `none` 关键字将每个字段的焦点环宽度坍缩为 0 px。根因:`.input, .textarea, .select { outline: none }` 与 `.searchbar input { outline: none }` 的基础规则比全局 `*:focus-visible` 优先级更高,悄悄移除了每页 88 个可聚焦元素的键盘焦点环。修复在 [public/css/app.css](public/css/app.css) — 显式添加 `.input:focus-visible/.textarea:focus-visible/.select:focus-visible` 与 `.searchbar input:focus-visible` 规则,带 `outline: 2px solid var(--rausch)` + 半透明 box-shadow;鼠标焦点(`:focus`)保持干净。904 → **905** 单元(静态契约守卫);Playwright **60 → 61**(Tab 遍历)。(M-1)

---

## [1.58.8] — 2026-05-20

**feat(health): 在 `#/health` 显示 `OPENAI_API_KEY` / `QWEN_API_KEY` / `OPENROUTER_API_KEY`(与 `GEMINI_API_KEY` 类似)。** v1.57.0 引入 OpenRouter 作为第 5 个 headless live-eval 供应商;v1.55.3(UX-2)上屏 4 供应商引导。但 `#/health` 页面仅显示 `GEMINI_API_KEY` 与 `ANTHROPIC_API_KEY` — 其余三个尽管 `/api/status/providers` 已路由,却在 Health 上不可见。用户要求:将"set / unset (manual mode)"行模式扩展到全部 headless 供应商。[server/lib/routes/health.mjs](server/lib/routes/health.mjs#L57-L71) 新增 3 个可选检查行,接入与 `/api/status/providers` 相同的 `isUsableKey` 闸。Health 视图迭代 `body.checks`,因此无需新增 8 语言字符串。903 → **904** 单元。(用户请求)

---

## [1.58.7] — 2026-05-20

**fix(security): NEW-2 — `isValidJobUrl` 现在拒绝成对的模板占位符语法(`${…}`、`{{…}}`),与错误消息一致。** `POST /api/pipeline` 的 400 响应声称 *"contain no script or template characters"*,但 v1.58.3 MASTER 回归确认:实际仅 ASP/EJS 形式的 `<%…%>` 被 `[<>"'`\\\s]` 守卫顺带拦截。JS 模板字面量 `${TEST}` 与 Mustache/Handlebars `{{TEST}}` 直接通过 — 正则与错误消息的语义不一致。fix-prompt 选项 A(把正则收紧以匹配消息):在 [server/lib/security.mjs](server/lib/security.mjs) 新增 `TEMPLATE_PATTERNS` 数组,经 `hasTemplatePlaceholder(url)` 在 `new URL(…)` 前检查。**只拒绝成对** 的占位符(`{normal}` 等单括号 ATS 路径继续接受)。901 → **903** 单元。(NEW-2)

---

## [1.58.6] — 2026-05-20

**fix(a11y/i18n): BUG-008-tb — 顶栏 `Doctor` 模态框标题现在与本地化按钮标签一致。** 在 v1.58.0 关闭的台账 BUG-008(*"模态框标题 == 本地化按钮标签"*)只覆盖了 Health 页面入口。v1.58.3 MASTER 回归发现**顶栏**入口仍违反不变量:无论 UI 语言为何,点击顶栏 `Doctor` 打开的模态框标题始终是 `doctor`(小写英文)。修复:[public/js/app.js:118](public/js/app.js#L118) 将字面量 `'doctor'` 替换为 `I18n.t('top.doctor', 'Doctor')`。`top.doctor` 键在 8 种语言中均已存在(EN `Doctor` · ES/pt-BR `Diagnóstico` · KO `진단` · JA `診断` · RU `Диагностика` · zh-CN `诊断` · zh-TW `診斷`),与按钮通过 `data-i18n="top.doctor"` 声明的键相同。`tests/qa-report-fixes.test.mjs` 新增静态契约守卫。900 → **901** 单元;Playwright 60/60。(BUG-008-tb)

---

## [1.58.5] — 2026-05-20

**fix(ui): NEW-3 — `#/followup` Run-live 双重 POST 判定为*不可复现*;以 Playwright 回归守卫锁定。** v1.58.3 MASTER 回归通过 monkey-patched `window.fetch` 观察到:在 `#/followup` 上单击 Run live 一次(公司/角色/备注已填,日期故意留空)后,~2 s 内出现两次对 `/api/mode/followup` 的相同 POST。按 fix-prompt 的"先复现"原则,对 `public/js/views/mode-page.js::submit()` 做了源码审查:(a) Run live 与 Generate prompt 均为普通 `<button>`,各自只有单个 `onClick`,既没有父 `<form>` 也没有 `addEventListener('submit')`,因此不存在双重触发路径;(b) `UI.withSpinner()`(FIX-L1)在请求进行中将 `button.disabled = true`,从源头阻断第二次物理点击。在 `tests/playwright-smoke.mjs` 新增了精确还原回归脚本的测试 — 填入公司/角色/备注、留空日期、点击与 Run live 共用 `submit()` 的手动按钮,然后在 3 s 窗口内断言 `POST /api/mode/followup` **恰好 1 次**。选择器与语言无关(8 个语言中 `▶` 字形相同),并通过 `addInitScript` 预置 `career-ops-ui:lang=en`,避免同一浏览器上下文中先前的语言切换测试干扰字段选择器。Playwright **59 → 60**。原 QA 观察以脚本形式存档,无需生产代码改动。(NEW-3)

---

## [1.58.4] — 2026-05-19

**fix(security): NEW-1 — 在每个响应上发送 `Content-Security-Policy`(此前仅在非 loopback 绑定时发送)。** 在 v1.58.4 之前,仅当 `isPubliclyExposed()` 为真(HOST 绑定到 loopback 之外)时才附加 CSP 头;在 `127.0.0.1` 上,`/` 与 `/api/health` 均**无** CSP 响应,`UI.md()` 的 escape-first 契约成为唯一的 XSS 防线。v1.58.3 MASTER 回归(§5)将其标记为 stop-ship 不变量。现在 CSP 为**无条件**,无论绑定地址如何,在每个响应上都相同:`default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`。`script-src` 绝不允许 `'unsafe-inline'`/`'unsafe-eval'`。指令集相对此前的"仅对外暴露"策略未变(已适配 SPA — 为 Inter 将 Google Fonts 加入允许列表),无视觉或功能回归。`tests/security-headers.test.mjs` 已重写;Playwright 路由巡检(en/ru/ja/zh-TW × 7 条路由)验证 **0 次 CSP 违规**。900 单元 · Playwright 58→59 · e2e 20/20+23/23。后续 fix-prompt 项按项目原则作为后续 one-fix 版本发布。(NEW-1)

---

## [1.58.3] — 2026-05-19

**fix(deep)：R-2 / FIX-C1 — 从研究输出中剥离孤立/不平衡的智能体脚手架标签。** v1.58.0 的 `cleanLlmMarkdown` 仅移除*成对*块与*末尾开*标签。v1.58.2 深度回归发现某模型产生不平衡轨迹——无开标签的孤立 `</tool_response>`（及 `</thinking>`）残留并字面渲染进已保存的 `#/deep` 简报。最终保守扫描现移除**任何**单独脚手架标记（开/闭、平衡与否）、Anthropic 工具 XML（`<invoke>`/`<parameter>`/`antml:*`）与 ```tool_*``` 围栏。纯函数·幂等；真实 `<https://…>` 自动链接与代码保留。**FIX-C2** 三联判定**不可复现**（i18n.js 已设 `<html lang>` 并检测 `navigator.language`）。二者均加回归守卫。896 → **900** 单元 · Playwright 58/58。v1.58.3 fix-prompt 其余项按单修发布排队（不批量）。

---

## [1.58.2] — 2026-05-19

**fix(i18n)：I18N-011 — 在 7 个非 EN 语言中本地化 `#/help` 目录。** TOC 由 `docs/help/<lang>.md` 的 `##` 标题生成。第 3/4/6/7/8/9/10/11/12 节在 es/pt-BR/ko/ja/ru/zh-CN/zh-TW 仍是**英文**标题，导致侧栏已翻译而 TOC 仍英文。现将每个标题本地化为与侧栏 `nav.*` 键**完全相同的术语**（单一事实源 — TOC 与侧栏一致），保留节号与 `(#/route …)` 原文。EN 不变。关闭 v1.58 QA 唯一的 i18n 待办。仅文档；896/896 单元 · 33/33 help · Playwright 58/58。

---

## [1.58.1] — 2026-05-19

**fix(test)：CI 隔离的 `checkProfileCustomized` 守卫（v1.58.0 补丁）。** v1.58.0 通过了（建议性）pre-commit 但在 `ci.yml`（Node 18/20/22）失败：测试使用 cache-bust 动态 import + 改写 `PATHS`，但 `paths.mjs` **每进程只解析一次**项目根。改为健壮的**静态守卫**（allow-list + `^(…)$/i` 锚定正则；含 "test" 的真实姓名绝不误判）。无生产代码改动；同时解除 `publish-package.yml`。896/896 单元 · Playwright 58/58。见 `qa/v158-regression/`。

---

## [1.58.0] — 2026-05-19

**fix(qa)：外部 QA 报告 bug 清扫 + 整洁、格式化的研究输出。** 修复：**BUG-001** `#/followup` 在客户端按 ISO `YYYY-MM-DD` 校验可选日期；**BUG-003** 块引用内的 `**粗体**`/`` `代码` ``/链接现已渲染（所有帮助页）；**BUG-005** 重复 URL 显示「已在队列中 — 已跳过」；**BUG-006** 无效 URL 文案人性化（`(POST /api/pipeline · HTTP 400)` 上下文按设计保留）；**BUG-007/008** 「Running doctor.mjs…」toast 在弹窗前关闭（新增 `UI.dismissToast()`），弹窗标题=按钮本地化文案；**BUG-010** `#/reports` 空状态补副标题；**BUG-002/UX-032** `checkProfileCustomized()` 将测试夹具名判为「未自定义」（不动父项目 `profile.yml`/`cv.md` — 规则 #1）；**I18N-012/013** 俄语 Deep research 真正翻译。**新增：** `cleanLlmMarkdown()` 从 `#/deep` 与已保存研究中剥离智能体脚手架（`<tool_call>{…}</tool_call>`、`<tool_response>`、`<thinking>` …），覆盖所有提供方及已保存文件读取；`#/outreach`→`#/contacto` 别名（BUG-004）；客户端网络错误经 `I18n.t()` 本地化（8 语言；服务端 `details` 按设计为英文诊断）。**测试：** 新增 `tests/qa-report-fixes.test.mjs`（10）、`tests/llm-output.test.mjs`（5），881 → 896 单元，Playwright 58/58。**未改（含理由）：** BUG-009（`#/cv` H1 按设计，WCAG single-h1）、父数据（parent-owned）、minor i18n/UX 长尾列入待办。完整细节见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.57.2] — 2026-05-19

**fix(config)：`/#/config`「validation failed」的真正根因 —— SPA 注入的 `lang` 字段。** `public/js/api.js` 会给*每个* JSON POST 请求体自动附加 `lang`（让 LLM 路由获取 UI 语言）。`/api/config` 不是 LLM 路由，`lang` 也不是配置键，因此 `validateConfig` 的（正确且与安全相关的）未知键拒绝对**每次保存**返回 400：`validation failed — lang: not a known config key`。这只在浏览器出现：curl/进程内复现从不发送 `lang`，所以 v1.57.0/.1 改善了*消息*却未除*根因*。配置路由现在在校验前剥离传输用的 `lang`；`KNOWN_KEYS` 写过滤仍丢弃任何真正未知的键 —— 注入防护不变。由点击真实保存按钮的新 Playwright 表单巡检发现。**测试：** 新增 `tests/playwright-forms.mjs`（26，纳入 `npm run test:e2e:browser`）巡检**所有表单**；`config-endpoint` 增加浏览器等价用例。879 → 881 单元，Playwright 32 → 58。完整细节见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.57.1] — 2026-05-19

**fix(ux)：每个 API 错误现在都说明"什么失败、在哪里、为什么"；输入错误文案尽可能详尽。** 服务端早已返回 `{ error, details: ["字段: 原因", …] }`，但各表单只显示首行（「validation failed」），所以在 `/#/config`（及各处）无法得知哪个字段有误。`api.js` 现在**全站**将逐字段 `details` 合入消息（改一处，所有表单受益），追加请求上下文 `(方法 /路径 · HTTP NNN)`（在哪里），非 JSON 响应显示原始正文片段，网络错误也带方法+路径；并暴露 `err.details`。`validateConfig` 消息改为尽可能详尽（哪里错、如何修）。**密钥字段绝不回显输入值**（仅字符数）——输错的真实 key 不会泄漏到 toast/日志。PORT 范围现真正校验（`99999` 被拒）。`/#/config` 的 PORT/HOST 预填真实默认值（`4317` / `127.0.0.1`）。错误 toast 停留更久（9–20 秒）且换行/滚动而非截断。**测试：** 新增 `tests/config-validation-detail.test.mjs`（12），874 → 879。完整细节见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.57.0] — 2026-05-19

**feat(provider): OpenRouter 作为第 5 个无头实时评估提供方 + fix(config): 保存任意 API key 时出现「validation failed」的修复。** 粘贴的 key 经常带有尾部换行或空格（操作系统剪贴板、提供方控制台的「复制」按钮）——1.57 之前这会触发 **所有** 提供方的换行守卫，且以 `$` 结尾锚定的 `ANTHROPIC_API_KEY` 正则会误拒真实的 Anthropic key。现在 `validateConfig` 在校验 **之前** 规范化（trim）每个值，路由持久化已修剪的值（运行时认证成功，不会因 `\n` 破坏 `.env`），Anthropic 检查改为健壮的 `sk-ant-` 前缀 + 长度（共享的 `isUsableKey()` ≥ 20 字符仍是真正的「是否真实 key」门槛）。内部换行仍被拒绝（`.env` 注入守卫）。**OpenRouter** 现为一等提供方：`/#/config` 的 `OPENROUTER_API_KEY` 一个 key 即可接入 300+ 模型。它是 `auto` 顺序的**最后一位**（Anthropic → Gemini → OpenAI → Qwen → **OpenRouter**），因此已有配置绝不会被静默改道；`LLM_PROVIDER=openrouter` 可固定。通过与 OpenAI/Qwen 相同的 `_tailProvider()` 路径接入 `/api/evaluate`、`/api/deep`、`/api/mode/:slug`，并在 `/api/status/providers` 与 Health 仪表盘中展示。OpenAI 兼容客户端（无新依赖——直接 `fetch`、`AbortController` 超时、key 不记录），带推荐的 `HTTP-Referer`/`X-Title` 头。模型下拉是实时的：`OPENROUTER_MODEL` 由 **`GET /api/openrouter/models`**（OpenRouter 公开目录的服务端代理——保持 CSP `connect-src 'self'`）填充，目录不可用时回退精选列表，10 分钟内存缓存。8 个语言新增 i18n key（`config.openrouter*`）。**测试：** 新增 `tests/openrouter-route.test.mjs`、`tests/openrouter-model-selector.test.mjs`，扩展 `env-config`/`openai`/`provider-selector`。831 → 855。完整细节见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.56.4] — 2026-05-19

**feat(ui):UX-N2 — 全局搜索输入框上随平台变化的可见 ⌘K / Ctrl K 提示。** Cmd/Ctrl+K(聚焦搜索)快捷键此前只存在于 `aria-label`/源码,视力用户无从发现,应用显得比实际慢。现在搜索胶囊末尾出现一个低调的 `<kbd class="kbd-shortcut">`,启动时按平台判定(`navigator.platform`/`userAgent`)从 `data-mac`/`data-other` 填充:macOS/iOS 为 **⌘K**,其余为 **Ctrl K**。它 `aria-hidden="true"`(既有 `aria-label` 已向辅助技术播报——徽标不应重复)且 `pointer-events:none`(装饰)。既有 Cmd/Ctrl+K 绑定不变。无新增 i18n 键(字形通用);徽标是既有 `.searchbar` 的 flex 子元素(无需包裹/绝对定位——input 已 `flex:1`)。**测试:** 新增 CI 隔离源静态套件 `tests/cmdk-hint-visible.test.mjs`(5):`<kbd class="kbd-shortcut">` 位于 `.searchbar` 内;`aria-hidden="true"` 且含 `data-mac`/`data-other` 两个变体;`app.js` 经 `navigator` 判定填充;`(e.ctrlKey||e.metaKey)&&e.key==='k'` → `search.focus()` 绑定健在(回归保护);`app.css` 为 `.kbd-shortcut` 设样式且非 `display:none`。826 → 831。`feat(ui)` · `test: tests/cmdk-hint-visible.test.mjs`。详情见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.56.3] — 2026-05-19

**fix(reliability):提供商密钥检测拒绝占位符 / 过短值,而不仅是空字符串。** 父 `.env` 中的占位符 `GEMINI_API_KEY` 被报告为"✓ set",并被选为活动提供商而非有效的 `ANTHROPIC_API_KEY`。`effectiveEnv()` 仅拒绝 `undefined`/`''`,故 10 字符垃圾被当作真实密钥:引导横幅显示 *GEMINI ✓ set*,`GET /api/status/providers` 返回 `activeProvider: "gemini"`,所有实时 ⚡ 评估会对着死密钥静默失败,而忽略有效的 108 字符 Anthropic 密钥。新纯函数 `isUsableKey()`(`env-config.mjs`)仅当密钥 ≥ 20 字符(受支持提供商密钥无更短者 — Gemini `AIza…` ≈ 39、Anthropic `sk-ant-…` ≈ 100+、OpenAI ≥ 40、Qwen ≈ 35)且非已知占位符(`your_*_here`、`changeme`、`placeholder`、`<…>`、单字符重复…)时才视为已配置。统一应用于 `hasAnthropicKey()`/`hasGeminiKey()`(`anthropic.mjs`)、`hasOpenAIKey()`/`hasQwenKey()`(`openai.mjs`)及 `GET /api/health` 的 `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` 行(从原始 `process.env` 迁移到同一 effective+plausible 视图)——健康页、提供商端点与 OR 路由现始终一致。`selectActiveProvider()` 不变(仅接收正确的 `keysConfigured`)。**测试:** 新增 CI 隔离套件 `tests/key-detection-rejects-placeholder.test.mjs`(5):`isUsableKey` 单元 + in-process `createApp()` 复现所报场景(临时 `.env` 含 10 字符 `GEMINI_API_KEY` + 真实 `ANTHROPIC_API_KEY`)——`gemini` 不在 `keysConfigured`,`activeProvider === "anthropic"`,`/api/health` 行一致。四个既有 effective-env 分层测试将过短桩值加长(契约不变)。821 → 826。`fix(reliability)` · `test: tests/key-detection-rejects-placeholder.test.mjs`。详情见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.56.2] — 2026-05-19

**feat(a11y):UX-N1 — 按路由的本地化 `document.title`(多标签页辨识 + 屏幕阅读器页面变更播报)。** 修复前 24 个路由都保持 `index.html` 的静态 `<title>`("career-ops — command center")——标签页同名、书签通用、每次"页面已更改"播报相同。`public/js/router.js` 的 `focusNewView()` 现从视图自身本地化的 `<h1 class="page-title">` 派生标题——"视图 — career-ops"——因此标题自动翻译(无需新 i18n 键)且每路由唯一。在首次绘制 guard **之前**设置,使初始标签页也有标题(与 v1.56.0 UX-12 的 `tabindex` 设置顺序一致)。视图无标题时回退为 `career-ops — command center`。**测试:** 新增 CI 隔离的源静态套件 `tests/document-title-per-route.test.mjs`(4):`focusNewView` 赋值 `document.title`;标题源自 `<h1>`(按路由 + 本地化,非单一字面量);赋值先于 `!firstPaintDone`;存在产品默认值。817 → 821。`feat(a11y)` · `test: tests/document-title-per-route.test.mjs`。详情见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.56.1] — 2026-05-19

**fix(a11y):消除路由托管的 `tabindex="-1"` 标题聚焦时出现的虚假品牌聚焦环。** `public/js/router.js` 在每次客户端导航时给目标视图标题加 `tabindex="-1"` 并 `.focus()`(让屏幕阅读器播报新页面)。`tabindex="-1"` 元素无法通过键盘到达,但 Chromium 的 `:focus-visible` 启发式仍绘制全局品牌环(`*:focus-visible { outline: 2px solid var(--rausch) }`)——每次导航在**页面标题周围出现红色矩形**(如 `#/dashboard` 的 "Command Center"),且已烘焙进 `images/dashboard-*.png` 主视觉截图。修复为一条限定作用域的规则 `[tabindex="-1"]:focus, [tabindex="-1"]:focus-visible { outline: none }`(WAI-ARIA APG 托管聚焦模式)。交互控件上真正的键盘聚焦保留全局 `*:focus-visible` 环(WCAG 2.4.7 不变);skip-link 的环不受影响(它是 `<a>`,非 `tabindex="-1"`,特异度更高)。8 个 `images/dashboard-*.png` 已重新生成——红框消失。**测试:** 新增 CI 隔离的源静态套件 `tests/managed-focus-no-ring.test.mjs`(4):全局 `*:focus-visible` 环仍定义(WCAG 2.4.7 无回归);`[tabindex="-1"]:focus,:focus-visible` ⇒ `outline:none`;抑制规则位于全局规则之后(层叠安全);修复有作用域(无全局 `*:focus{outline:none}`)。与 `tests/dashboard-initial-focus.test.mjs` 配对。813 → 817。`fix(a11y)` · `test: tests/managed-focus-no-ring.test.mjs`。详情见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.56.0] — 2026-05-19

**feat(ux):LOW 打磨合集 —— UX-9 / UX-10 / UX-11 / UX-12(一个分组的次要发布)。** **UX-9** `#/cv`:页面标题降级为安静的 `.cv-breadcrumb` 面包屑芯片,吵闹的副标题移入 `<h1>` 的 `title` 提示 —— 让用户的简历(预览中的姓名)占据视觉层级。F-V54-A 不变量保持 —— 仍是**恰好一个 `<h1>`**,仍为 `.page-title`。**UX-10** 新增共享助手 `UI.providerCostHint(t)`,置于 `#/auto`、`#/evaluate`、`#/deep` 及每个 `#/<mode>` 的 ⚡ 实时运行旁;复用 `GET /api/status/providers`(v1.55.3):有密钥时显示 *“预计费用:OpenAI gpt-5-codex · ~$0.04/eval”*(数量级,"~");无密钥时说明 ⚡ 复制手动提示(无 API 费用);fail-soft。**UX-11** `#/help`:当 TOC 过滤缩小到**恰好一个**区段时,300ms 空闲后滚动到该处(防抖;0 或 >1 不触发)。**UX-12** `#/dashboard`:首次绘制时将 `<h1>` 设为可聚焦(`tabindex="-1"`),`#content` 保持 `aria-live="polite"`(启动时朗读)—— **不**抢占焦点(避免与跳过链接冲突,v1.41.0 决定)。新增 i18n 键 `cost.estimate`、`cost.manual` ×8;新增 `.cv-breadcrumb`/`.cost-hint` CSS。**测试:**4 个新源静态 CI 隔离套件(cv-breadcrumb 3、run-cost-line 4、help-toc-autoscroll 4、dashboard-initial-focus 3);更新既有 `cv-single-h1`/`help-nav-a11y` 锁(不变量保留)。800 → 813。4 项实时 Playwright 探针,0 控制台错误。`feat(ux)` · 4 test suites。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.8] — 2026-05-19

**feat(tracker):服务端分页 + 可点击的漏斗芯片(UX-8)。** **服务端:**`GET /api/tracker` 新增**可选** `?page` / `?pageSize` / `?status` 查询参数。不带参数时,响应与旧的 `{ rows: [...] }` 逐字节一致(所有现有调用方/测试不受影响)。带参数时返回 `{ rows: slice, total, page, pageSize, funnel }` —— `pageSize` 钳制到 `[1,500]`,`page` 钳制到 `≥1`,`status` 过滤 `rows`+`total`,`funnel` 是**整个历史**的状态→计数细分(与页/过滤无关,故芯片始终准确)。**`#/tracker`:**顶部新增**可点击漏斗芯片栏** —— *“所有状态 · N · Applied · N · Interview · N …”*(顺序 Applied → Responded → Interview → Offer → Rejected → Discarded → Evaluated → SKIP)。点击芯片设置 Status 过滤(再次点击活动芯片则清除);活动芯片为 `aria-pressed` 且高亮。8 个语言新增 i18n 键 `track.funnelAria`;新增 `.tracker-funnel`/`.tracker-chip`/`.tracker-chip--active` CSS。**`test: tests/tracker-server-paged.test.mjs`**(新增,7 个用例,CI 隔离,临时端口进程内 Express + 临时 `CAREER_OPS_ROOT` applications.md —— CLAUDE.md #2/#8):back-compat(无参数 ⇒ 恰为 `{rows}`);`?page&pageSize` 切片 + total/page/pageSize/funnel 合计 N;最后部分页无重叠;越界页 ⇒ 空 rows + 有效 total;`?status=` 过滤 total/rows 而 funnel 为整个历史;pageSize 上限;+ 芯片栏源静态锁定。793 → 800。`feat(tracker)` · `test: tests/tracker-server-paged.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.7] — 2026-05-19

**feat(pipeline):>1000 行时的 vanilla-JS 行虚拟化(UX-7)。** `#/pipeline` 此前渲染**每一**行(`filtered.forEach(list.appendChild(urlRow))`)—— 一次扫描会用数千个 URL 填满队列,于是数千个行节点(每个是 flex div + `<a>` + 两个按钮)在每次筛选按键时同步构建,淹没 DOM 与无障碍树。新增 **vanilla-JS 虚拟化**(react-window 等价,无依赖):超过 `VIRTUALIZE_THRESHOLD = 1000` 时 `#/pipeline` 变为固定高度(`70vh`)滚动视口,配一个不可压缩的占位垫(`flex:0 0 auto`,`height = 行数 × 56px`)以保留**整个列表的真实滚动条**,rAF 节流的滚动监听只渲染视口 ± 5 行缓冲(一次约 16–19 个节点而非 N 个)。阈值及以下保持原始简单渲染**逐字节不变**,故典型管道与所有现有测试/e2e 不受影响。每个虚拟化行保留按 URL 区分的 ▶/✕ `aria-label`(F-V54-B 回归锁定)。窗口计算为纯函数 `computeWindow()`。**`test: tests/pipeline-virtualize.test.mjs`**(新增,5 个用例,CI 隔离,源静态):~1000 数值阈值;≤阈值分支保持 `forEach`→`appendChild`;>阈值分支以 rAF 滚动监听 + 占位垫渲染 `slice(start,end)`;`computeWindow()` 在 `[0,total]` ± 缓冲内钳制;行保留 ▶/✕ aria-label。788 → 793。实时 Playwright 探针(1200-URL 夹具):`scrollHeight≈67248`,DOM 中仅约 16–19 个节点,窗口端到端跟随滚动,0 控制台错误。`feat(pipeline)` · `test: tests/pipeline-virtualize.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.6] — 2026-05-19

**feat(scan):将次要筛选收纳进“高级筛选”折叠区(UX-4)。** `#/scan` 此前把所有筛选 —— 自由文本、远程/混合/现场、范围、来源,以及扫描后的 stack/level/dynamic facet 芯片 —— 等权堆叠,形成控件之墙。现在**日常筛选保持可见**(自由文本 + 远程/混合/现场;🌐 扫描按钮已在控件卡中单列),**次要筛选折叠进 `<details class="scan-advanced"><summary>高级筛选</summary>`**:范围 + 来源下拉,以及单独的 facet 芯片簇(现在新结果集以表格而非芯片墙开头,且仅在至少有一行芯片时渲染)。8 个语言新增 i18n 键 `scan.advancedFilters`;新增 `.scan-advanced` 摘要样式(安静的 ⚙ 提示、无标记、展开时加粗)。**`test: tests/scan-advanced-disclosure.test.mjs`**(新增,6 个用例,CI 隔离,源静态):带 `.scan-advanced` 钩子与 `scan.advancedFilters` 标签的 `<details>`/`<summary>` 存在;自由文本 + 远程保持可见;范围 + 来源在折叠区内;`chipsContainer` 为 `<details>`;`.scan-advanced summary` 有样式;`scan.advancedFilters` ×8。782 → 788。`feat(scan)` · `test: tests/scan-advanced-disclosure.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.5] — 2026-05-19

**feat(dashboard):2 个 P0 CTA + 聚焦近期活动提示的 hero(UX-3)。** `#/dashboard` 此前以约 30 个等权重节点打开 —— 没有清晰的“下一步做什么”。新增 `.dash-hero` 块现位于页头正下方:两个 P0 旅程 —— **✨ URL 自动管道** 与 **🌐 立即扫描** —— 提升为大号 `.btn-hero` 按钮;单一**聚焦近期活动提示**(“最近评估: `<分数>` — `<标题>`”,链接至报告;冷启动时经 `dash.heroNoEval` 显示引导空状态)告诉回访用户停在何处、告诉新用户唯一重要的动作。两个主按钮已从页头移除(仅保留次要的“📋 打开管道”)以避免动作重复。状态计数从醒目的 `.badge` 降级为安静的 `.dash-chip` 胶囊。8 个语言新增 i18n 键 `dash.lastEval`、`dash.heroNoEval`;新增 `.dash-hero`/`.btn-hero`/`.dash-chip` CSS。**`test: tests/dashboard-hero.test.mjs`**(新增,5 个用例,CI 隔离,源静态):`.dash-hero` 存在且先于 Quick-actions 网格;两个 P0 CTA 为带 `/auto`+`/scan` 路由的 `.btn-hero`;聚焦 `dash.lastEval` + 空状态 `dash.heroNoEval`;桶使用 `.dash-chip`;CSS 存在;`dash.lastEval`+`dash.heroNoEval` ×8。777 → 782。`feat(dashboard)` · `test: tests/dashboard-hero.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.4] — 2026-05-19

**feat(ux):Run 旁的诚实 auto-pipeline ETA + 扫描时醒目的 Stop(UX-6)。** `#/auto`:新增 `.auto-eta` 提示 —— *"⏱ 约 1–2 分钟"*(键 `auto.eta`,`title` 经 `auto.etaTitle`)—— 现位于 Run 按钮旁,使一键承诺在用户决定*之前*就对耗时诚实;文案与 career-ops.org/docs(“粘贴 URL → 1–2 分钟内完整报告”)一致。`#/scan`:在数分钟爬取运行中(`aria-busy`)时,**Stop** 从低对比度幽灵按钮提升为醒目的破坏性按钮(新增 `.btn-danger` —— 填充,高对比白字配珊瑚色,字重 600)。`setScanRunning(running)` 在 `btn-danger`(运行中)与 `btn-ghost`(空闲,反正隐藏)之间切换 `scan-stop-btn`,使用户在负载下也能找到并信任 Stop。8 个语言新增 i18n 键 `auto.eta`、`auto.etaTitle`;新增 `.btn-danger`/`.auto-eta` CSS。**`test: tests/auto-eta-stop.test.mjs`**(新增,4 个用例,CI 隔离,源静态):`#/auto` 在 `runBtn` 旁以 `.auto-eta` 类渲染 `t('auto.eta')`;`auto.eta` ×8;`setScanRunning(running)` 将 Stop 提升为 `btn-danger`;`.btn-danger` 存在且为高对比白字。773 → 777。`feat(ux)` · `test: tests/auto-eta-stop.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.3] — 2026-05-19

**feat(onboarding):屏幕上的 4 提供方 OR 状态 —— 冷启动横幅 + 活动提供方徽标(UX-2,HIGH)。** 新增只读端点 **`GET /api/status/providers`** → `{ activeProvider, activeModel, keysConfigured }`。`keysConfigured` 使用与 `llm.mjs` 门控相同的有效 env 视图(process.env ∨ 父 `.env`);`activeProvider` 是 OR 路由器实际会选的 —— `env-config.mjs` 中的新纯函数 `selectActiveProvider()` 遍历 `providerOrder()`(无对应密钥的 `LLM_PROVIDER` 锁定返回 `null`)。不返回任何机密 —— 仅提供方名称 + 模型 id。SPA 外壳现在渲染全局引导区域(`#onboarding-banner`,由 `app.js` 填充,仅 CSP 安全 DOM):**0 密钥 → 红色横幅** + 指向 `#/config?tab=api-keys` 的 CTA;**≥1 密钥 → 低调徽标** 显示活动提供方+模型。让招牌差异点("Anthropic / Gemini / OpenAI / Qwen 之一,自动排序")在屏幕上可发现,而非靠试错。8 个语言新增 `onboarding.*` i18n 键;新增 `.onboarding-warn`/`.onboarding-ok` CSS。**`test: tests/onboarding-key-banner.test.mjs`**(新增,9 个用例,CI 隔离):`selectActiveProvider` 语义;`GET /api/status/providers` 进程内(临时端口 + 临时 `CAREER_OPS_ROOT` `.env`,绝不读取真实父密钥 —— CLAUDE.md #2/#8);静态 SPA 接线 + `onboarding.*` ×8 覆盖。764 → 773。`feat(onboarding)` · `test: tests/onboarding-key-banner.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.2] — 2026-05-18

**fix(cv):为 `#/cv` markdown 编辑器赋予描述性、自包含的可访问名称(F-V55-H / UX-5)。** `#/cv` 主编辑器 `<textarea id="cv-editor">` 现在通过新键 `cv.editorAria` 携带描述性 `aria-label` —— *"CV Markdown 编辑器 —— 你的 markdown 格式专业简历"* —— 取代它从可见的"Markdown"区段标题继承的简略名称。注:与 F-V55-H 症状(仅检查 `aria-label`/`labels`)相反,该字段**并非**无名 —— v1.47.0(WS2 #16)早已通过 `aria-labelledby` → `<h3 id="cv-md-heading">Markdown</h3>` 绑定,故屏幕阅读器播报"Markdown,编辑,多行"。v1.55.2 将该简略"Markdown"升级为自包含标签。冗余的 `aria-labelledby` 被移除(否则即死标记 —— 按 ARIA 优先级 `aria-label` 胜出);可见的 `<h3>Markdown</h3>` 为视力正常用户保留。WCAG 1.3.1 + 4.1.2;与 v1.54.5 batch-tsv 修复(F-V54-C)平行。**`test: tests/cv-editor-a11y.test.mjs`**(新增,3 个用例,CI 隔离,如 `auto-stepper-prerender.test.mjs` 的源静态):`#cv-editor` 通过 `t('cv.editorAria', …)` 自命名且回退非空;`cv.editorAria` 在全部 8 个语言存在且非空;元素上无冗余 `aria-labelledby`。761 → 764。`fix(cv)` · `test: tests/cv-editor-a11y.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.1] — 2026-05-18

**fix(auto):在 `#/auto` 挂载时预渲染 5 阶段流水线步进器(F-V55-E / UX-1,资深观察 S-4 重新打开)。** `#/auto` 现在在屏幕挂载的那一刻就显示文档化的五阶段概要 —— **校验 → 抓取 → 评估 → 保存报告 → 加入跟踪器** —— 而不再在首个 SSE 事件前保持空白。此前 `<ol class="auto-stepper">` 以 `display:none` 创建,且 `renderStepper()` 仅从 `setStep()` / `run()` 到达,因此冷启动用户在点击 Run 之前从未见过文档承诺的流水线。步进器现在在挂载时即可见,五个阶段均为 `pending` 状态,并带有 `aria-label`(`auto.stepperAria`)以便辅助技术朗读该区域。关闭 F-V55-E(a11y/静态保证视角)与 UX-1(承诺保真视角)—— 同一修复,两个视角。**`test: tests/auto-stepper-prerender.test.mjs`**(新增,4 个用例,CI 隔离,如 `router.test.mjs` 的源静态):`STEPS` 数组恰好是 5 个规范阶段且按序;`stepperEl` 挂载时非 `display:none` 且带 `auto.stepperAria`;挂载作用域的 `renderStepper()` 调用先于 `function setStep(`;`auto.stepperAria` 存在于全部 8 个语言。757 → 761。`fix(auto)` · `test: tests/auto-stepper-prerender.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.0] — 2026-05-18

**feat(llm):无头实时评估通过 "OR" 工作 —— Anthropic | Gemini | OpenAI | Qwen,按设置了哪个密钥自动选择。** 应用户请求,web-ui 的 ⚡ 实时评估现在使用**任何已设置的 API 密钥**工作,而不仅是 Anthropic/Gemini。`LLM_PROVIDER` 新增 `openai` 与 `qwen`;`auto`(默认)使用第一个存在密钥的提供方,优先顺序为 **Anthropic → Gemini → OpenAI → Qwen**。显式值固定为一个;强制指定但无密钥的提供方仍回退到手动提示路径。新增 `server/lib/openai.mjs` —— 一个零依赖的 OpenAI 兼容 Chat Completions 客户端(与 `anthropic.mjs` 相同的安全直连 HTTPS 模式:`AbortController` 超时、密钥从不记录、`effectiveEnv()` 密钥解析使父 `.env` 的密钥无需重启即生效)。单一内核(`runOpenAICompatible`)支撑 **`runOpenAI`**(api.openai.com)与 **`runQwen`**(阿里云 DashScope 的 OpenAI 兼容模式;中国大陆主机在 raw `.env` 中用 `QWEN_BASE_URL` 覆盖端点)。无 SDK、**无任意 CLI 执行** —— 父项目保持 CLI 无关(Claude Code · Codex · Gemini · OpenCode · Qwen · Copilot · Kimi);这仅扩展*无头* API 密钥路径。OpenAI/Qwen 尾部已接入所有评估面:`/api/evaluate`、`/api/deep`、`/api/mode/:slug` 以及 `/api/auto-pipeline` SSE —— 在 Anthropic(内联)+ Gemini(子进程)分支之后被查询以保留 auto 偏好,并使用与 Anthropic 相同的打包上下文内联。`env-config.mjs`:`QWEN_API_KEY`(机密)+ `QWEN_MODEL`(非机密)加入 `KNOWN_KEYS`/`KEY_GROUPS.core`;`LLM_PROVIDERS` 与 `providerOrder()` 扩展;`OPENAI_API_KEY` 现为一级无头提供方密钥(此前仅存储)。`#/config` API 密钥标签页:`LLM_PROVIDER` 选择器新增 `openai`/`qwen`;新增 `QWEN_API_KEY` + `QWEN_MODEL` 字段(精选 `qwen-max`/`qwen-plus`/`qwen-turbo`/`qwen2.5-*` 列表);标签页顶部的新说明解释 CLI 无关的父项目 vs web-ui 无头评估及 OR 顺序。8 个语言全部新增 i18n 键。**`test: tests/openai.test.mjs`**(新增,9 个用例,CI 隔离):OpenAI/Qwen 成功 + 块数组内容、Bearer 认证、默认及 `QWEN_BASE_URL` 覆盖端点、4xx/5xx/格式错误、`max_tokens` 钳制、超时、`effectiveEnv` 密钥检测、密钥无泄漏金丝雀。`tests/provider-selector.test.mjs` 已更新以覆盖 v1.55.0 的 `providerOrder`/`LLM_PROVIDERS`/SECRET 面 + OpenAI/Qwen 尾部接线。748 → 757。`feat(llm)` · `test: tests/openai.test.mjs` · `test: tests/provider-selector.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.10] — 2026-05-18

**fix(auto-pipeline):SSE 客户端断开卫生 —— 消除不稳定的 Playwright e2e 作业。** Playwright e2e 作业间歇性变红(32/32 个单项测试通过,但 `not ok 2 - tests/playwright-smoke.mjs`):在 `#/auto` SSE 流进行中关闭页面,会使服务器下一次 `res.write()` 以 `EPIPE`/`"aborted"` 被拒绝,而 —— 由于响应上没有 `'error'` 监听器 —— Node 将其升级为 uncaughtException,node:test 报告为 "asynchronous activity after the test ended"。`auto-pipeline.mjs` 中的 `openSse()` 现在注册一个 no-op 的 `res.on('error')`,并以 `res.writableEnded || res.destroyed` 保护 `send()`(用 try/catch 包裹)—— 消失的客户端是预期的,而非异常。这是正确的生产 SSE 卫生,不只是测试修复。`tests/playwright-smoke.mjs`:Cmd+K 测试使用了真实的外发 URL(`https://example.com/jobs/123`),但只等待模态出现,因此 `closePage()` 在测试结束后中止了服务器进行中的 `safeGet()`。现在它等待管线到达终态(以便 fetch 在关闭前正常解析)。共享的 `closePage()` 辅助函数(`window.stop()` 然后关闭)和 `after` 钩子的 `server.closeAllConnections()` 作为纵深防御保留。已验证:连续 8/8 绿色运行(6× `node --test` + 2× browser-smoke),此前约每 2 次有 1 次红。`tests/auto-pipeline.test.mjs` +1 个静态用例,锁定 `openSse` 断开卫生契约(`res.on('error')` 监听器 + `writableEnded||destroyed` 守卫 + try 包裹的写入)。747 → 748。`fix(auto-pipeline)` · `test: tests/auto-pipeline.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.9] — 2026-05-18

**fix(llm):在请求时尊重父项目 `.env` 的 LLM 密钥 —— 停止错误路由到过期/无效的提供方。** 即便 `ANTHROPIC_API_KEY` 是已配置的提供方,实时评估也可能以 *"Gemini API error: API key not valid"* 失败。根本原因:`hasAnthropicKey()` / `hasGeminiKey()`(以及 `runAnthropic` 的密钥/模型查找)**只读取启动时的 `process.env` 快照**。如果在服务器启动后才把 Anthropic 密钥加入父 `.env`,运行中的进程永远看不到它 → Anthropic 检测为 false,评估随后回退到 `process.env` 中*确实*存在的任何过期密钥(通常是旧的、无效的 `GEMINI_API_KEY`)。Gemini 执行路径(父 Node 子进程)已经读取父项目的实时 `.env`,因此两个提供方解析密钥的方式不一致。`env-config.mjs` 新增 `effectiveEnv(key, envFilePath)`:非空的 `process.env` 值优先(覆盖 shell export 与 `POST /api/config` 的实时应用),否则查阅**当前父 `.env` 文件**。`anthropic.mjs` 现在通过它解析 `ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL` 和 Gemini 密钥检查,因此设置在父 `.env` 的密钥**无需重启服务器**即被尊重,且密钥检测始终与请求实际发送的密钥一致。提供方顺序不变(`auto` → Anthropic-然后-Gemini);这只修复检测。密钥从不被记录或返回(REVIEW-B4 无泄漏测试仍通过)。`tests/anthropic.test.mjs` 重写为 CI 隔离(temp `CAREER_OPS_ROOT`、动态 import),含 2 个复现确切 bug 的新用例(密钥仅在父 `.env` → 被检测到;`process.env` 未设置时 `runAnthropic` 发送父 `.env` 的密钥 + 模型)。`tests/env-config.test.mjs` +3 个 `effectiveEnv` 用例(`process.env` 优先、含空字符串视为未设置的 `.env` 回退、文件缺失 / 密钥缺失 / 无路径 → undefined)—— 新分支 100%。742 → 747。`fix(llm)` · `test: tests/anthropic.test.mjs` · `test: tests/env-config.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.8] — 2026-05-18

**feat(config):Modes 字段表单始终渲染规范模式(即便在空/桩文件上),并带 career-ops.org 字段指引。** v1.54.3 的 Modes 字段表单只为已存在的 `##` 小节渲染字段 —— 因此在全新、空或非模式的 `modes/_profile.md`(例如常见的 1 行桩)上,它会回退到 *"No ## sections found — use the raw editor below."*,用户拿不到任何字段。应用户请求(*"разбей по полям … описание полей возьми из career-ops.org/docs"*),表单现在**始终按文档化顺序渲染 5 个规范字段**(Target Roles、Adaptive Framing、Exit Narrative、Comp Targets、Location Policy),存在时从文件预填,不存在时为空但可编辑 —— 因此全新的 profile 可完全通过表单填写。每个字段显示一段**来自规范 career-ops.org Quick Start §Step-5 的描述**(在 Target Roles / Adaptive Framing / Exit Narrative / Comp Targets / Location Policy 中分别填什么),通过 `aria-describedby` 接入供屏幕阅读器使用。容忍标题变体:模板的 `## Your Target Roles`(等)映射到与 `## Target Roles` 相同的规范字段,因此模板与服务端脚手架约定都不会破坏表单。`collect()` 现在是带标签的载荷:当渲染的标题与文件现有标题完全一致时进行非破坏性的 **`{ sections }` 合并**(前言 + 未触碰 + 自定义小节按字节稳定保留),或当文件缺少模式时进行 **`{ markdown }` 全文件重建**,引导/规范化一份符合模式的文档。重建路径在 `config.js` 中**经确认门控**(它替换父文件 —— WS2 #4 破坏性保存不变量),保留现有前言(或文档化的默认值),并按 verbatim 保留非规范小节。8 个语言环境新增 6 个 i18n 键(`config.modesDescTargetRoles` … `config.modesDescLocationPolicy` + `config.modesFormRebuildBody`)。`tests/modes-form.test.mjs` 按 v1.54.8 契约重写:模式 + 规范顺序、`config.js` 载荷/确认接线、8 个语言环境中每个字段来自文档的描述存在、`canonicalKey` "Your X" 容忍、列表往返稳定性、引导始终渲染保证,以及带数据安全的带标签 sections-vs-markdown `collect()`。已针对真实父桩文件在线验证(5 个字段 + 描述出现,0 控制台错误)和隔离桩夹具(填写 → 经确认门控保存 → 5 个规范小节全部持久化)。`feat(config)` · `test: tests/modes-form.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.7] — 2026-05-18

**fix: W-001 — 代码/样式资源 + SPA 外壳以 `Cache-Control: no-store` 提供(部署卫生)。** SPA 通过不带版本查询字符串的纯 `<script src>` 加载 `api.js` / `router.js` / 每个视图,且没有构建步骤(无内容哈希),因此部署后浏览器可能**继续提供缓存的旧 bundle 数小时** —— 在查询字符串路由上出现 stale-cache 404(在 v1.29.2 回归期间在线观察到;回归运行 W-001)。`server/index.mjs` 现在通过 `express.static` 的 `setHeaders` 钩子在 `.js` / `.mjs` / `.css` / `.html` 上设置 `Cache-Control: no-store`,并在 SPA 外壳 catch-all(它使用 `sendFile` 并绕过 `setHeaders`)上显式设置,使浏览器始终重新校验驱动路由的代码。非代码静态资源保留 `express.static` 的默认缓存。安全头(CSP / nosniff / frame-deny / referrer-policy)不变 —— 由既有的 `security-headers` 套件(8 个用例)与新测试并行跑绿验证。新增 1 个测试文件 `tests/asset-cache-control.test.mjs` —— 4 个用例(JS 资源 `no-store`、CSS `no-store`、静态 `index.html` `no-store`、SPA catch-all 深层路由外壳 `no-store`),针对隔离的 `CAREER_OPS_ROOT` 启动真实应用。另加 `tests/playwright-smoke.mjs` 中的 flaky teardown 修复(单独的 `test(e2e)` 提交):auto-pipeline 的 SSE 冒烟测试现在在 `finally` 中取消 reader + 中止 fetch,且 `after` 钩子强制关闭残留套接字,消除了使 v1.54.6 Playwright e2e 作业变红的 teardown 后 "Error: aborted"。738 → 742。`fix` · `test: tests/asset-cache-control.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.6] — 2026-05-18

**fix(a11y): S-7 — `#/help` 的 back-to-top 按钮携带规范选择器类 `back-to-top`。** `#/help` 的浮动 back-to-top 按钮工作正常(已在线验证),但其类列表(`btn btn-primary help-back-top`)位于 spec §2 #28 测试所瞄准的 `.back-to-top` 选择器约定之外 —— 收紧后的选择器本会出现 flaky(回归运行 S-7,“轻松取胜”)。该按钮现在也携带规范的 `back-to-top` 类。纯粹增量且为 CSS no-op:`help-back-top`(既有的 CSS 钩子)未变,而 `back-to-top` 没有 CSS 规则 —— 它只是一个稳定的测试/自动化句柄。已在线验证:`document.querySelector('.back-to-top')` 解析到该按钮,`aria-label` 完整,0 控制台错误。在 `tests/help-nav-a11y.test.mjs` 中扩展了既有的 #12 用例,新增一条断言:back-to-top 按钮的类列表包含规范的 `back-to-top` 选择器(无新文件)。`fix(a11y)` · `test: tests/help-nav-a11y.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.5] — 2026-05-18

**fix(a11y): F-V54-C — `#/batch` TSV 编辑器拥有可访问名称。** `#/batch` 的 TSV `<textarea>` 此前有一个通过 `aria-describedby` 接线的提示,但**没有可访问名称** —— 无 `<label htmlFor>`,无 `aria-label`/`aria-labelledby`(回归运行 F-V54-C;WCAG 1.3.1 Info & Relationships / 4.1.2 Name, Role, Value)。`aria-describedby` 提供的是*描述*而非*名称*,因此屏幕阅读器读出的是无标签的“edit text”。该 textarea 现在通过新增 i18n 键 `batch.tsvAria` 携带 `aria-label`,与已使用 `*Aria` 键的同级运行控制输入保持一致;既有的 describedby 提示得以保留。已在线验证:`aria-label` 存在且已本地化,`aria-describedby` 完整,0 控制台错误。新增 i18n 键 `batch.tsvAria` 于全部 8 个语言区。新增 1 个测试文件 `tests/batch-tsv-accessible-name.test.mjs`(2 个用例:`batch-tsv` 块在保留其 describedby 提示的同时通过 `t(batch.tsvAria)` 拥有 `aria-label`;`batch.tsvAria` 在全部 8 个语言区中定义);736 → 738。`fix(a11y)` · `test: tests/batch-tsv-accessible-name.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.4] — 2026-05-18

**fix(a11y): F-V54-B — `#/pipeline` 行操作按钮拥有可访问名称。** `#/pipeline` 上每行的 `▶`(评估)和 `✕`(删除)按钮此前是仅含 `title` 属性的纯图标按钮(回归运行 F-V54-B;WCAG 4.1.2 Name, Role, Value)。`title` 不是可靠的可访问名称,因此屏幕阅读器用户听到的是一长串无法区分的“button”,无法判断删除会命中哪一行。两个按钮现在都带有显式 `aria-label`,通过新增的 `shortUrl()` 帮助函数以紧凑 URL 消歧(`host` + `…/` + 最后 2 个路径段;不可解析输入回退为尾部切片),因此 a11y 树读出如 *“Delete: hh.ru/…/vacancy/12345”*。无新增 i18n 键 —— 复用 `common.delete` / `pipe.evaluateBtn` + URL。已在线验证:1385 行,每个按钮名称按行唯一,0 控制台错误。新增 1 个测试文件 `tests/pipeline-row-action-names.test.mjs`(4 个用例:两个按钮均以 `shortUrl(url)` 接线 + 恰好两个此类标签,`shortUrl` 在使用前声明,同主机不同职位的 URL 不会合并,裸主机 / 不可解析 / 空回退);732 → 736。`fix(a11y)` · `test: tests/pipeline-row-action-names.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.3] — 2026-05-18

**feat(config): `#/config` "Modes" 标签页的结构化字段表单(不再是原始 markdown)。** "Modes" 标签页此前将 `modes/_profile.md` 按每个 `##` 区块编辑为单个原始 `<textarea>`(v1.36.0 的区块级粒度)。应用户要求,现在改为渲染**从文档化模式派生的结构化字段表单**(career-ops.org Quick Start §Step-5):`Target Roles` / `Adaptive Framing` / `Comp Targets` → **可增删的可重复带标签行输入**(每个字段一行 role/angle/comp,`＋ Add line` / 每行带 `aria-label` 的 `✕`);`Exit Narrative` / `Location Policy` → 单个带标签的散文 `<textarea>`。每个字段都是通过 `<label htmlFor>` 绑定、带 i18n 区块名的真实控件。新增 `public/js/lib/modes-form.js`(`window.ModesForm`)持有 parse → render → `collect()` 逻辑;它馈入**既有**的 `PUT /api/modes/_profile { sections }` 合并路径,因此前导文本、顺序以及表单未触及的任何区块都保持字节稳定(合并而非替换,由服务端强制)。**数据安全:** 正文不是纯项目符号列表的规范列表区块(用户在此放入了散文)以及任何非规范 `##` 区块,会回退为带说明注释的带标签原样 `<textarea>` —— 任意内容原样 round-trip,绝不会被静默重构或丢失。Round-trip 稳定性已验证:`serialise(parse(body))` 重新解析完全一致。整文件原始 markdown 编辑器仍作为带确认门的 **Advanced** 折叠区保留,用于增删区块及编辑前导文本(WS2 #4 破坏性保存门不变)。8 个语言区新增 10 个 i18n 键(`config.modesTargetRoles` … `config.modesUnknownNote`)。新增 1 个测试文件 `tests/modes-form.test.mjs`(7 个用例);725 → 732。已针对隔离的 `CAREER_OPS_ROOT` fixture 在线验证:5 个规范区块渲染为字段 + 1 个自定义区块作为带标签回退,编辑并保存的 round-trip 保留了前导文本 + 自定义区块,0 控制台错误。`feat(config)` · `test: tests/modes-form.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.2] — 2026-05-18

**feat(config): `#/config` 中的 OpenAI / Codex 模型选择器。** `#/config` 此前无法选择 OpenAI / Codex 模型 —— 尽管 `OPENAI_API_KEY` 已为父项目多 CLI(Codex / OpenCode)流程暴露,却只有 `ANTHROPIC_MODEL` 和 `GEMINI_MODEL` 有下拉框。现在 `OPENAI_MODEL` 成为一等环境变量键:已加入 `env-config.mjs` 的 `KNOWN_KEYS`(排在 `OPENAI_API_KEY` 之后)及 `core` 键组,并**有意不**纳入 `SECRET_KEYS` —— 它是模型 id 而非凭据,故永不脱敏。`config.js` 新增一份精选 `OPENAI_MODELS` 列表(默认 `gpt-5-codex`,其后为 `gpt-5` / `gpt-5-mini` / `gpt-4.1` / `o4-mini` / `o3`),以及在 OpenAI 键之后渲染的 `OPENAI_MODEL` `<select>` 字段,完全镜像 Anthropic/Gemini 模型字段。8 个语言区新增 i18n 键 `config.openaiModel` + `config.openaiModelHint`。新增 1 个测试文件 `tests/openai-model-selector.test.mjs`(4 个用例);721 → 725。已在线验证:`#/config` → 含 6 个选项的 `OPENAI_MODEL` select,默认 `gpt-5-codex`,已绑定标签,0 控制台错误。`feat(config)` · `test: tests/openai-model-selector.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.1] — 2026-05-18

**fix(a11y): F-V54-A —— `#/cv` 单一 `<h1>`。** CV markdown 自身的 `# Name` 渲染成了页面标题 `<h1>CV</h1>` 旁的**第二个**顶级 `<h1>`(回归运行 F-V54-A;WCAG 1.3.1 信息与关系 / 2.4.6 标题)。`cv.js` 现将 CV 预览的每个注入点(初次渲染、文件导入时刷新、编辑器实时同步)经由作用域受限的 `cvMd()` 统一处理,将标题下移一级(h1→h2 … h6→`role="heading" aria-level="7"`),使页面恰好保留一个 `<h1>`。有意将作用域限定于 `cv.js` —— `UI.md` 由 help/reports/deep/evaluate 共享,各自以自有方式管理标题。新增 1 个测试文件 `tests/cv-single-h1.test.mjs`(4 个用例);717 → 721。已在线验证:`#/cv` → 1 个 `<h1>`,用户的 `# Name` 现为 `<h2>`,0 控制台错误。`fix(a11y): F-V54-A` · `test: tests/cv-single-h1.test.mjs`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.0] — 2026-05-18

**WS10 —— canonical-docs 再验证 + help 包 H3 对等(最终收敛版本)。** CHANGELOG/结构 CI 闸门只检查 H2,因此 `docs/help/en.md` 已悄然漂移至 70 个 H3 子节,而 7 个本地化包仍停在 68 —— 差距在 §17(「Reference adapters」表 + 「Common pitfalls」列表,仅英文)。两者现已译入全部 7 种语言(适配器文件名 / 链接 / 标识符保持逐字节一致);8 个包现均为 17 H2 / 70 H3。`help-ru-config-section.test.mjs` 中新的 H3 对等闸门锁定之(716 → 717)。`canonical-docs-coverage.test.mjs` 7/7 确认 help 仍镜像 `career-ops.org/docs` 的全部 5 篇指南;WS2 的 UX 审计(v1.41→v1.52 的 40 项)对每个屏幕与 docs 进行校验 —— 无背离。`docs/sdd/CONVENTIONS.md` 更新至 v1.54.0(测试合计、H3 对等闸门、文件尺寸离群项、新增无障碍约定章节)。WS0–WS10 完成;仅余 WS11。`fix(docs): WS10 canonical re-validation + H3 parity` · `test(help): H3-parity gate`。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.53.0] — 2026-05-18

**WS9 —— shell 表面测试金字塔(最后一个未测层)。** 4 个 `bin/*.sh` 脚本与 `.githooks/pre-commit` 钩子此前覆盖率为**零**;新增的 `tests/sh-files.test.mjs` 加入 10 个用例,锁定 `bash -n`/`sh -n` 语法、shebang + 可执行位,以及其他 workstream 所依赖的行为契约:`career-ops-ui.sh` —— `help` 以 0 退出且无 shell-source 泄漏(v1.40.0 回归守卫),未知 verb 以 2 退出,`usage()` 为 heredoc;`start.sh` —— 尊重 `NO_OPEN`、要求 Node ≥ 18,并将浏览器前置委托给 `scripts/open-dashboard.mjs`(v1.43.0 守卫);`setup.sh` —— 严格模式、`SKIP_START`、克隆两个仓库;`run_all.sh` —— `--quick`/`--no-e2e` 解析与 4 个套件;`.githooks/pre-commit` exec WS7 评审器,且**没有任何 shell 文件调用 `git --no-verify`**(CLAUDE.md 硬规则 #7 守卫);`install-hooks.mjs` 接线 `core.hooksPath`。`docs/architecture/TESTING.md` —— 在金字塔图中加入 shell 表面基础层 + v1.53.0 合计注记(716 个 `node --test` 用例 / 90 个文件 + 4 个 E2E 表面)。706 → 716。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.52.0] — 2026-05-18

**WS2 LOWs #33–#40 —— 批量打磨清扫(收尾 UX 审计队列)。** 八项低严重度发现。`fix(a11y/i18n): WS2 LOW batch` —— #33:`#/dashboard` —— 页眉的 3 个 CTA 不一致(仅 2 个有前导图标);「Open Pipeline」现带 `📋`,三者齐整。#34:`#/profile` —— 原型的 `fit`/`level` 渲染为两个含糊的 chip;现加前缀(`Fit:` / `Level:`)并配对应的 `aria-label`。#35:`#/health` —— Run-doctor / verify 的 toast 显示 `doctor.mjs` 的原始字符串;现已 i18n 键化。#36:`#/health` —— 检查结果原是扁平的 `<div>` 串;现为 `role=list` 的 `<ul>`/`<li>`,状态徽章带 `aria-label="<check>: <status>"`。#37:`#/reports` —— 报告卡原是仅鼠标的 `<div onClick>`;现为 `role=link` + `tabindex` + Enter/Space 处理器 + `aria-label`。#38:`#/activity` —— 分页器注释写「200」而代码请求 500;已对齐到 `CAP` 常量,且当 500 上限截断旧历史时浮现 `role=note` 通知。#39:`#/batch` —— prose 占位符为英文硬编码而其 `aria-label` 已 localized;四个现已 i18n 键化。#40:模式页在异步探测后静默重命名主按钮;现由礼貌的 `role=status` 区域播报。新增 10 个 i18n 键 × 8 个语言区(`{n}` 保留);测试 +9:`test: tests/low-sweep.test.mjs`。697 → 706。收尾 WS2 的 UX 审计队列(v1.41→v1.52 的 #1–#40);接下来 WS9 → WS10 → WS11。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.51.0] — 2026-05-18

**WS2 #13 + #14 + #18 + #19 + #20 —— `#/auto` 与 `#/evaluate` 的 feedback/i18n 清扫。** UX 审计的五项发现。`fix(a11y/ux): auto+evaluate — busy state, actionable HTTP errors, clipboard fallback, aria-live result, spinner-guarded submit` —— #13:`#/auto` 的 Run 按钮现在显示忙碌状态(`is-loading` + `aria-busy` +「Running…」),而非仅禁用。#14:失败的 HTTP 请求现在在步骤上浮现可操作的 i18n 消息并附带 toast(带 `{n}` 的 `auto.httpFail`),不再是干巴巴的「HTTP 500」。#18:手动模式的「Copy prompt」现在使用异步 Clipboard API 并带 `execCommand` 回退,真正失败时 toast 提示,而非虚假的「Copied」。#19:evaluate 结果容器现为 `role=status` `aria-live=polite`,使漫长的 LLM 调用向屏幕阅读器播报。#20:Evaluate 按钮以 `UI.withSpinner` 包裹(原先为朴素的 `onClick: run`,允许重复提交)。新增 3 个 i18n 键 × 8 个语言区;测试 +6:691 → 697。另有一处仅测试的修复(提交 `7f8e250`):e2e pipeline-delete 的拆卸位于 v1.48 之前的原生 confirm 路径上;改为 API DELETE(`fix(test): …` —— CI 的 Playwright-e2e 为红;并非产品回归)。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.50.0] — 2026-05-18

**WS2 #12 + #27 + #28 —— help 导航无障碍。** 一份 17 个章节、90+ 个标题的指南中,`#/help` 上 UX 审计的三项发现,在 `help.js` 中修复。`fix(a11y): help — single h1, labelled+filterable TOC, focus-on-anchor, back-to-top` —— #28:文档 markdown 以自带的 `# Title` 开头,在页眉已提供规范 h1 的页面上又产生了第二个 `<h1>`;现已剥离文章的所有 `<h1>`,使全页恰有一个 h1,层级从 `<h2>` 章节干净起始。#27:TOC 的 `<nav>` 是无名地标(页面上有两个无标签 `<nav>`);现带 `aria-label`(`help.toc`),点击 TOC 条目时焦点移至章节标题(`tabindex=-1` + `focus()`),而非仅滚动视口。#12:长文档中无从查找;TOC 上方的 `type=search` 过滤器按标题文本实时收窄条目,滚动后出现带 `aria-label` 的浮动「Back to top」按钮,返回顶部并把焦点移回页面 `<h1>`;其 scroll 监听器在离开 `#/help` 的 `hashchange` 时移除。新增 2 个 i18n 键 × 8 个语言区 —— `help.tocFilter`、`help.backToTop`;测试 +6:`test: tests/help-nav-a11y.test.mjs`。685 → 691。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.49.0] — 2026-05-18

**WS2 #10 + #11 + #25 + #26 —— tracker 表格无障碍与排序。** `#/tracker` 上 UX 审计的四项发现,在 `tracker.js` 中修复。`fix(a11y): tracker headers, sortable table, localized fix labels, empty state` —— #10:动作列表头是空字符串,每行的 Report 按钮缺少上下文;现每个 `<th>` 均带 `scope=col`,动作表头与 `Score`/`PDF` 表头改为 i18n 键(原先为空或硬编码英文),Report 按钮获得带公司名的 `aria-label`(`<report> — <company>`)。#11:tracker 没有排序方式;Date / Score / Status 表头现为 `<th>` 内可键盘操作的排序按钮,带 `aria-sort`(`none`/`ascending`/`descending`);`sorted()` 比较器(score 按数值,date/status 按 locale 比较)在分页前运行,点击切换方向并重置分页器。#25:`track.normalize/dedup/merge` 是风险最高的破坏性控件,却在全部 8 个语言区为同一英文(原地重写 `data/applications.md`)—— 现已正确本地化,并新增 `title` 提示。#26:零行首次运行显示与过度筛选列表相同的「no match」消息;`rows.length === 0` 现渲染独立的空状态(标题 + 正文 +「Open pipeline」CTA)。新增 7 个 i18n 键 × 8 个语言区 + 3 个重新本地化;测试 +6:`test: tests/tracker-a11y-sort.test.mjs`。677 → 683。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.48.0] — 2026-05-18

**WS2 #8 + #22 —— pipeline:焦点陷阱确认 + 预览无障碍。** `#/pipeline` 上 UX 审计的两项发现,在 `pipeline.js` 中修复。`fix(a11y): pipeline UI.confirm() + live preview region` —— #8:`#/pipeline` 的三个动作均使用原生 `confirm()`(未做焦点陷阱):预览面板的 Delete、每行的 `✕` 删除、以及「Evaluate first」;现全部改走带焦点陷阱的 `UI.confirm()`(v1.44.0 基础设施)—— 两个删除 `danger:true`(Cancel 为默认),「Evaluate first」`danger:false`;`pipeline.js` 中已无任何原生 `confirm()`。#22:`previewPane` 没有 live 角色,且 fetch 失败被塞进 `previewBody`,渲染成误导性的 `<pre>`「preview」;现为带 `aria-label` 的 `role=region` `aria-live=polite`,失败时另设 `previewError` 并渲染为独立的 `role=alert` 区块((重新)选择时及删除当前行时清除)。新增 4 个 i18n 键 × 8 个语言区;测试 +5:`test: tests/pipeline-confirm-preview.test.mjs`。672 → 677。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.47.0] — 2026-05-18

**WS2 #7 + #30 + #31 + #16 —— 未绑定标签无障碍清扫。** UX 审计的四项发现:表单控件缺少程序化标签(WCAG 1.3.1 / 3.3.2 / 4.1.2),现已全部绑定。`fix(a11y): bind every swept form control to an accessible name` —— #7 `scan.js`:`dry-run` 复选框与 `company-select` 下拉框的标签缺少 `for`;按既有 `id` 添加 `htmlFor`。#30 `deep.js`:`company` / `role` 输入框存在未绑定标签;添加 `id` + `htmlFor`(`deep-company`、`deep-role`)。#31 `apply.js`:`url` / `jd` 存在未绑定标签;添加 `id` + `htmlFor`(`apply-url`、`apply-jd`)。#16 `cv.js`:主 markdown `<textarea>` 无可访问名称;通过 `aria-labelledby` 绑定到可见的「Markdown」标题 —— 屏幕阅读器名称与屏幕标题一致,无新增 i18n 键。沿用 `batch.js` / `mode-page.js` 中已为标准的显式 `label[for]`↔`control[id]` 模式;无新增 i18n 键;行为零变更。测试 +5:`test:` 667 → 672。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.46.0] — 2026-05-18

**WS2 #5 + #6 + #21 + #24 —— scan SSE 无障碍。** `#/scan` 上 UX 审计的四项发现,在 `scan.js` 中修复。`fix(a11y): scan SSE — live-log region, Stop, run-state, error banner` —— #5:流式控制台现为 `role=log` `aria-live=polite`(+ `aria-label`、`tabindex=0`、可键盘滚动),并有一个独立的视觉隐藏 assertive `role=status` 区域播报终态事件(完成 / 失败 / 已停止)。#6:Stop 按钮关闭进行中的 `EventSource`(`es.close()`),取消结果轮询并重置状态;仅在 scan 运行时显示。#21:scan 运行时 Scan 按钮被禁用 + 置 `aria-busy` 并显示 Stop,两条流路径均如此(单阶段 `streamTo` 与多阶段 `runScanAll` —— 后者仅在终态 `done`、`final !== false` 时结束本次运行)。#24:SSE 失败不再只是 3.5 秒提示条;现由持久的 `role=alert` 横幅显示错误并附带重试操作(重新调用上次的运行函数),下次运行时清除。新增 8 个 i18n 键 × 8 个语言区;测试 +7:`test: tests/scan-sse-a11y.test.mjs`。660 → 667。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.45.0] — 2026-05-18

**WS2 #3 —— #/config 标签页:完整的 WAI-ARIA Tabs 模式。** #/config 的三个标签页(API keys / Profile / Modes)曾是仅靠点击激活的朴素 `<button class="tab-btn">`:无 `role`、无 `aria-selected`、无键盘模型(UX 审计 HIGH #3,WCAG 4.1.2 / 2.1.1)。`fix(a11y): config.js tabs implement role=tablist/tab/tabpanel` —— 现为带 `aria-label` 的 `role=tablist` 容器;每个标签 `role=tab` + `id` + `aria-controls` + `aria-selected`(在 `activate()` 中同步)+ 漫游 `tabindex`(激活 0 / 其余 -1);面板 `role=tabpanel` + `tabindex=0` + 跟随激活标签的 `aria-labelledby`。完整键盘导航:←/→/↑/↓(环绕)+ Home/End 既移动焦点又激活。遗留 `.tab-btn.is-active` CSS 钩子予以保留。新增 1 个 i18n 键 × 8 个语言区(`config.tablistLabel`);测试 +7:`test: tests/config-tabs-aria.test.mjs`。另有一处仅测试的修复:`fix(test): retarget 2 stale auto-pipeline smoke tests` —— 两个 v1.34 之前的 Playwright-e2e smoke 测试断言一个仪表盘"Auto-pipeline"按钮在 v1.34.0 起不再打开的瞬态模态(→ `Router.go('/auto')`);它们在单独的 Playwright-e2e CI 作业中一直为红。重新指向 #/auto 屏幕。653 → 660。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.44.0] — 2026-05-18

**WS2 #4 + #9 —— 父项目文件破坏性覆盖前的焦点陷阱确认。** UX 审计两项 HIGH,均为数据丢失:(#4)`config.js` 的 `saveProfileRaw`/`saveModesRaw` 未经确认即整体替换父级 `config/profile.yml` / `_profile.md`;(#9)`tracker.js` 的 Normalize/Dedup/Merge 未经确认即就地重写父级 `data/applications.md`。`fix(a11y/safety): UI.confirm() gate before whole-file parent overwrites` —— 在 `public/js/api.js` 新增 `UI.confirm()`,一个复用既有 WAI-ARIA 模态基建的焦点陷阱对话框(`_onClose` 钩子使 Esc / backdrop / × / Cancel 所有关闭路径均 resolve `false`;焦点默认落在 Cancel;返回 `Promise<boolean>`;非原生 `confirm()`)。三处破坏性调用现已在写入前全部加门控。新增 8 个 i18n 键 × 8 个语言区(`{op}` 占位符逐字保留);测试 +8:`test: tests/confirm-gate.test.mjs`,644 → 652。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.43.0] — 2026-05-18

**用户请求 —— `career-ops-ui open` + autostart 将浏览器置于前台。** 在 `setup`/`run` 之后,当浏览器已在运行时,裸 `open`/`xdg-open` 会让仪表盘标签页停留在后台,用户不得不自行查找。`feat(cli): career-ops-ui open — open AND raise the dashboard tab` —— 新的 `scripts/open-dashboard.mjs` 从 HOST/PORT 构建 URL(将 `0.0.0.0` 绑定改写为 loopback),可选地等待 `/api/health`,打开默认浏览器,然后**强制将其置于前台** —— macOS 用 `osascript` 激活 Chrome/Brave/Edge/Safari/Arc/Firefox 中正在运行的那个,Linux 用 `xdg-open`+`wmctrl`,Windows 用 `start`。作为 `career-ops-ui open` 动词暴露(别名 `dash`、`focus`)。`bin/start.sh` 的 autostart 现委托给它,因此标签页会自动置于前台;`NO_OPEN=1` 在 headless/CI 启动时禁用 auto-open。README ×8 + help §1 ×8 已更新;测试 +8:`test: tests/open-dashboard.test.mjs`,636 → 644。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.42.0] — 2026-05-18

**WS2 修复 #2 —— 死路由 `#/portals` → config 深链。** `#/portals` 是一条未注册路由,会渲染 404 视图,尽管它是用于管理门户来源时合理的书签/手输 URL(UX 审计 HIGH 第 2 项)。`fix(router): #/portals 404 → alias to config + Regional-sources deep-link` —— 在 `router.js` 的 `ALIASES` 中新增 `portals: 'config'`(与 `settings→profile` 相同的书签稳定性模式),现在它解析为 config 视图且 **config** 导航项处于激活态。当存在 Regional-sources 分组时,视图(`config.js`)检测 `#/portals` 哈希,强制展开该 `<details>` 分组、滚动至可见区并将焦点移至其 summary(覆盖默认的 h1 焦点),使用户恰好落在门户来源控件上;绝不会仅凭别名渲染空的地区分组。help-bundle §5 × 8 新增一条快捷方式提示;router 测试 +1:`test(router): portals→config alias guarantee` 加入 `router.test.mjs`,635 → 636。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.41.0] — 2026-05-18

**WS2 —— 资深 UX/可用性审计 + 横切焦点管理修复。** 一次 10 年以上经验的启发式审计(Nielsen × WCAG 2.2 AA × 项目约定)审查了全部 17 条路由,产出一份按严重度排序的 40 项发现队列(`.planning/.../UX-AUDIT.md`);HIGH→MEDIUM→LOW 现按每个发布一项修复逐一交付。本次发布落地横切 HIGH 第 1 名。修复:`fix(a11y): move focus to the new view on every route change` —— `router.js render()` 在每次 hashchange 替换 `#content` 却从不移动焦点,因此键盘/屏幕阅读器用户停留在被销毁的节点上而丢失位置(WCAG 2.4.3 Focus Order / 4.1.3 Status Messages —— 横切,影响全部 17 个屏幕);新的 `focusNewView(content)` 聚焦新视图首个 `h1`/`.page-title`(简洁的 SR 播报 + 正确的焦点顺序),必要时令标题可聚焦(`tabindex=-1`)并回退到 `#content`;跳过最初一次绘制以免与 skip-link 冲突;在成功与错误两条渲染路径均接线;已实时验证:导航后 `document.activeElement` 为新视图的 `H1.page-title`。测试:`test(router): focus-management static guarantees` —— `router.test.mjs` 新增 4 个用例(辅助函数已定义、标题目标 + content 回退、首绘跳过守卫、≥2 个调用点);631 → 635。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.40.0] — 2026-05-18

**WS8.3 —— docs 实态化扫描 + `career-ops-ui help` 修复 + `askSecret` 加固。** 修复:`fix(cli): career-ops-ui help no longer leaks shell source` —— 调度器用 `sed -n '2,12p'` 打印其头部注释,但第 12 行(`set -euo pipefail`)是代码而非注释,因此 `career-ops-ui help`(以及未知动词的用法文本)以一行多余的 `set -euo pipefail` 结尾;在 `help` 与 `*)` 两种情形下收窄为 `2,11p`(注释块);`help` 以 exit 0 退出,未知动词以 exit 2 退出 —— 已验证。`fix(cli): scripts/init.mjs key entry never echoes` —— v1.39.0 的后续将装饰性的 readline 覆盖掩码替换为真实的 raw 模式读取器:`setRawMode(true)` + 带缓冲的行,使输入/粘贴的密钥字节根本不会到达终端(无 scrollback / tmux / 屏幕共享泄露);完整的 VT 转义 FSM 消费每个 CSI/SS3/OSC/DCS/SOS/PM/APC 序列,使方向键和功能键无法破坏密钥;`stdin` 通过依赖注入,因此非 TTY 回退在不触碰全局的情况下做单元测试;迭代至 AI 评审干净 LGTM。文档:README ×8 —— 旧的「一条命令安装」章节替换为醒目的 **「一条命令启动并初始化」** 章节(curl 单行加上显式的 `career-ops-ui` CLI 链:clone → `npm link` → `setup` → `init` → `doctor` → `run` → `help`,提供方向导说明,CI 形式 `--provider --anthropic-key --yes`,以及 `LLM_PROVIDER` 注记);8 个 README 徽章从陈旧的 v1.22–v1.24 / tests-461–474 实态化为 **v1.40.0 / tests-631**(e2e 徽章改为非数字以避免杜撰计数);help-bundle ×8 §1 —— 在快速上手手册顶部(「A. Setup」之前)向全部 8 个语言新增「一条命令启动 & init」标注;H2 章节配平保持(各 17 —— CI 闸门绿)。测试:`test(init): non-TTY askSecret fallback` —— `provider-selector.test.mjs` 新增一个 DI-stdin 用例,断言 `askSecret` 在非 TTY 下委托给普通 `ask()`(trim 配平)且不改动共享全局;629 → 631。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.39.0] — 2026-05-18

**WS8.2 —— LLM 提供方选择器 + OpenAI/Codex 密钥 + 交互式 `init` 向导。** env-config 新增 `LLM_PROVIDER`(auto|claude|gemini)+`OPENAI_API_KEY`(密钥)。llm.mjs 全部 6 个 gate-site 经 `_provGate()` 用 `providerOrder()`;auto 行为不变。#/config 新增 select+字段。`scripts/init.mjs` 现为真实向导(经校验路径写 parent .env)。7 测试。622 → 629。README ×8/规范文档 fold = WS8.3/WS10。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.38.0] — 2026-05-17

**WS8.1 —— 统一 CLI 调度器 + `doctor` 动词。** `bin/career-ops-ui.sh` 路由 setup/run/doctor/init/help。`scripts/doctor.mjs` 复用确切的 `/api/health` 引擎(createApp 进程内 → 终端报告);仅当所有必需检查通过才 exit 0。docs/sdd + help §1 ×8。6 测试。616 → 622。README ×8 = WS8.3。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.37.0] — 2026-05-17

**WS7 —— git 工作流 pre-commit AI 审查。** 确定性底线(fail-HARD):拦截 staged `.env`/密钥、diff 中密钥模式、staged 视图中的 `.also(`、`node --check` 失败。AI 层(fail-SOFT):CLI 可用且 `AI_REVIEW != off` 时跑 `claude -p`。`.githooks/pre-commit` + `prepare` 接 `core.hooksPath`。禁用 `--no-verify`。docs/sdd。6 测试。610 → 616。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.36.0] — 2026-05-17

**WS6.3 —— Modes 选项卡:原始块 → 分区编辑器。WS6 完成。** `modes/_profile.md` 按 `##` 区块编辑(每标题一个可折叠 textarea)。服务端 `splitProfileSections` 字节精确;`PUT { sections }` 仅合并指定区块 —— 前言+其他区块+顺序按字节保留。未知标题 → 400。raw 路径不变。i18n 5 键 ×8。help §2 ×8。新增 6 测试。604 → 610。WS6 收尾。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.35.0] — 2026-05-17

**WS6.4 —— Profile 数组编辑器 + WS6.2 API-keys 审计。** `PUT /api/profile` 接受 `{ arrays }`(可与 `{ fields }` 组合):Target roles/Superpowers(列表)、Archetypes(name/level/fit)、Proof points(name/url/hero-metric)。同样 merge-not-replace;空行丢弃;空列表删除键。#/config 新增 4 个增删编辑器。i18n 6 键 ×8。审计:KNOWN_KEYS ≡ FIELDS,无 gap。新增 7 测试。597 → 604。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.34.0] — 2026-05-17

**WS5 —— 一键 Auto-pipeline 页面(`#/auto`)。** 模态升级为独立可链接页面。一键运行 校验→抓取→评估→保存报告→跟踪器(SSE)。无障碍 stepper、深链、无 key 手动模式、可链接 `#/auto?url=…&go=1`。侧栏入口;dashboard ✨ 按钮改到此处。i18n 14 键 ×8。help §1 ×8 + README ×8。新增 8 测试。589 → 597。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.33.0] — 2026-05-17

**WS4 —— career-ops 1.8.0 对等审计 + `location_filter`。** 父 `scan.mjs` 新增 `location_filter`(#570);web-ui 的进程内 scanner 不委托给它,故未流通。新增 `server/lib/location-filter.mjs` 逐字复制语义,接入两个 scanner。help §5 ×8。新增 8 测试。581 → 589。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.32.0] — 2026-05-17

**`#/config` Profile 选项卡 —— 原始 YAML 块 → 逐字段表单(WS1)。** 3 个可折叠分区(候选人/叙述/薪酬),14 个标量路径。逐字段保存**合并**进 `config/profile.yml`:archetype、proof point 与自定义键原样保留。*Advanced* 保留 raw-YAML 退路(保留注释)。23 个 i18n 键 ×8。新增 7 测试。574 → 581。详见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.31.0] — 2026-05-17

**与 career-ops 1.8.0 同步 — `#/batch` 暴露 `--model` + `--start-from`。** 父项目 1.7.1 → 1.8.0;`batch-runner.sh` 新增 `--model NAME`(#504)与 `--start-from N`。web-ui 在 `#/batch` 暴露(**模型**、**起始 #** 输入)并在服务端做 defense-in-depth 校验。i18n ×8。新增 7 个测试。567 → 574。完整详情见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.30.0] — 2026-05-14

**`#/scan` 结果分页器 — 取代 v1.12 的「显示前 200(共 N)」截断。**

v1.30 之前,扫描结果表被硬截断为前 200 行过滤后的数据,底部一行「Showing first 200 of N」提示,201..N 行无法从 UI 访问。v1.30.0 将上限替换为 `UI.paginate`(与 `#/tracker` / `#/reports` / `#/activity` 同一 helper)。`PAGE_SIZE = 200` 保持原有视觉密度;boost-to-top 排序在跨页时仍稳定(先对完整集合排序,再分页);任意筛选变化时自动重置为第 1 页。已弃用的 i18n key `scan.shownTop` 被移除(8 个语种)。`tests/scan-paginator.test.mjs` 新增 9 个用例(7 个静态 canary + 含 6 个边界条件的纯逻辑表 1 个 + 汇总计算 1 个)。**558 → 567** 单元 + 验收测试(+9)。完整细节见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.29.2] — 2026-05-14

**热修复:`🌐 Scan` 在 `source=both` 模式下只跑了 EN 阶段,RU 阶段被静默丢弃。**

SSE 客户端(`public/js/api.js:156`)在第一个 `done` 事件就关闭了 `EventSource`,而服务端在 `source=both` 模式下每阶段各发一个 `done`。RU 阶段刚启动就被取消。修复:服务端在每个 `done` 上标记 `final: true|false`,客户端仅在 `final !== false` 时关闭。向后兼容 — 不设置 `final` 的单阶段生产者继续保持原行为。**547 → 558** 单元 + 验收测试(+11 新增)。完整细节见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.29.1] — 2026-05-14

**为 help-bundle §5 的 8 个语种全部加入面向用户的 5 个 RU 门户配置详尽指南。**

在 §5(Portals & sources)内新增 ### 子节「配置俄文门户 — 详细设置指南」:5 个来源的清单表(含认证与地理限制)、定位与编辑 `portals.yml` 的分步说明、完整的 5 来源 YAML 示例、与 negative 列表的冲突及其修复示例、临时禁用某个来源的方法、通过 🌐 Scan 与 SSE 日志验证设置的方法。§17(v1.29.0 上线)覆盖开发者流程,§5 v1.29.1 覆盖最终用户流程。**540 → 547** 单元 + 验收测试(+7 新增)。完整细节见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.29.0] — 2026-05-14

**俄文招聘门户扫描器从 2 个源扩展到 5 个;registry + 动态下拉框;新增 §17「如何添加新门户」。**

- **3 个新 RU adapter:** `Trudvsem`(政府 open-data API,无认证、无地理门),`GetMatch` 与 `GeekJob`(HTML 抓取,防御式解析器 — 解析失败返回 `[]`,健康 200 决不 throw)。
- **Source registry** 位于 `server/lib/sources/registry.mjs` — 由 dispatcher + endpoint + dropdown 共同消费的单一事实来源。v1.29 之前列表硬编码在三处。
- **新增 endpoint** `GET /api/scan/sources`(`Cache-Control: max-age=60`)— SPA 在挂载 `#/scan` 时动态重绘来源筛选下拉。
- **新增 §17** 覆盖 8 个语种:「如何添加新的招聘门户来源」(adapter 模板、registry 条目、dispatcher、mock 测试、`portals.yml`)。
- **`russian_portals.sources` 默认值**从 `["hh", "habr"]` 改为 5 个源;如果你的 `portals.yml` 已显式列出 `sources:`,需要手动加入 3 个新条目。
- 测试:**520 → 540**(+20)。完整细节见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.28.1] — 2026-05-14

**热修复:`?query` 哈希导致 router 404;从 health 移除 HH_USER_AGENT 行。**

v1.28.1 之前,`Router.go('/evaluate?url=…')` 产生的 hash 经 `split('/')` 后第一段是字面量 `"evaluate?url=…"`,永远不会匹配已注册的路由 → `__not_found__`(404)。一行修复:在按名称拆分前先 `hash.split('?')[0]`。覆盖两个已报告点击:`#/pipeline → ▶` 与「App settings → Modes」。`/api/health` 中可选的 `HH_USER_AGENT` 行被移除(俄国外 403 提示仍保留在 help-bundle §16 中,扫描时 stderr 也仍会提示)。**515 → 520** 单元 + 验收测试(+5 新增)。完整细节见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.28.0] — 2026-05-14

**文档对齐 + `#/batch` 新增 `--max-retries N` 控件。**关闭 `qa/QA-PROMPT-docs-vs-app.md` 中提出的两个未决 issue。

- **Issue #2** — `#/batch` 现在提供「Max retries」数字输入框(1–10),仅在勾选「Retry failed」时启用。服务端使用 `parseInt` 并校验 1≤N≤10,超出范围的值会被静默丢弃;未启用 `--retry-failed` 时 `--max-retries` 标志被忽略。`tests/batch-max-retries.test.mjs` 中 7 个测试用例。新增 2 个 i18n key × 8 语言。
- **Issue #1** — 8 个 help-bundle 与 8 个 README 中的 AI CLI 列表与 career-ops.org/docs 正典(Claude Code · Codex · OpenCode · Qwen CLI)对齐,并附本地化一句:*「其他 Claude 兼容 CLI 也通过相同的斜杠命令接口运行」*。README 中关于 web-ui 自身 shim 文件的 "Multi-CLI" 条目保持不变(那是另一种 surface)。`tests/canonical-docs-coverage.test.mjs` 中新增 2 个回归 canary。
- **506 → 515** 单元 + 验收测试(+9 新增)。Playwright 32/32 无变化。完整细节见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.27.0] — 2026-05-14

**外观 + 无障碍打磨：去重侧边栏 `#/dashboard` 入口。**

侧边栏中，品牌徽标（`<a class="logo" href="#/dashboard">`）和第一个导航项指向同一路由。屏幕阅读器会重复念出「Dashboard」两次，键盘用户多出一个无意义的 tab 焦点。徽标块现在是普通的 `<div class="logo">`，仅导航项保留为 `#/dashboard` 的唯一链接。**506 / 506** 单元测试 + **32 / 32** Playwright — 无变化。完整细节见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.26.1] — 2026-05-14

**WCAG 2.5.5 热修复 — 恢复 `.btn` 最小高度 44 px.**

v1.26.0 中 `.btn` 的 `min-height: 44px` 声明缺失,头部按钮渲染为 39-41 px(违反 WCAG 2.5.5)。v1.26.1 恢复 44 px 下限 + `flex-shrink: 0` + `line-height: 1.2`。**502 → 506** unit,Playwright 32/32 不变。详细见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.26.0] — 2026-05-14

**测试金字塔 + 行覆盖 ≥ 93 %.**

按 v1.25 待办事项采用四级测试金字塔(unit → functional → acceptance → e2e)。新增 22 个测试,覆盖 v1.25 的最大空白(jds.mjs 61.64 % → 100 %,auto-pipeline 拒绝路径)。新建 `tests/acceptance/` 目录用于跨端点用户旅程测试。**480 → 502** unit + acceptance,Playwright 32/32 不变。完整细节见 [`CHANGELOG.md`](CHANGELOG.md) 和 [`docs/architecture/TESTING.md`](docs/architecture/TESTING.md)。

---

## [1.25.0] — 2026-05-14

**自动管线手动短路 + 仪表盘修饰 + CHANGELOG 同步补齐。** 修复 G-014(自动管线忽略 `mode: 'manual'`)、G-012(CHANGELOG 同步滞后 — 6 个语言版本落后 2 个发布)以及仪表盘 `✨ ✨` 双字形修饰问题。G-003(`README.cn.md` 重命名)经核实已闭环 — 仓库内仅存在 `README.zh-CN.md`。G-005(A-G → A-F 报告区块对齐)需要父项目协同提交,继续推迟。

### 🛡️ G-014 — 自动管线 `mode: 'manual'` 短路

- **`fix(auto-pipeline): G-014 — honour mode:'manual' short-circuit`** ([`server/lib/routes/auto-pipeline.mjs:158-195`](server/lib/routes/auto-pipeline.mjs#L158-L195)) — v1.25 之前,该路由总是调用一次 LLM。传入 `mode: 'manual'`(自 v1.10.2 起对齐 `/api/evaluate` 的约定)会被静默忽略,请求会在 Anthropic 端口阻塞 1–3 分钟。新版处理器:
  - 同时接受 `mode` 与 `evalMode` 字段以保持向后兼容,任一字段取值为 `'manual'` 均触发短路。
  - 发送全部 5 个 SSE 阶段事件,携带 `status: 'done'` / `status: 'skipped'`。不发起 fetch,不调用 LLM,不再产生每次请求 $0.05 的费用。
  - `done` 事件载荷为 `{ mode: 'manual', prompt: <buildEvaluationPrompt scaffold>, message }` — SPA 可像已有的 `/api/evaluate` 手动提示卡片一样渲染。
- **闭环 `HOST=0.0.0.0` 下的 DoS 风险**:此前即便 `llmRateLimit` 限制为 10 req/60s/IP,10 名攻击者 × 10 请求依然会在 Anthropic 端消耗 $50/分钟。短路在速率限制计数前生效,确保真正的 LLM 调用永不发生。
- **测试** — [`tests/auto-pipeline-manual-mode.test.mjs`](tests/auto-pipeline-manual-mode.test.mjs) 中 3 个用例分别验证:(1) `mode: 'manual'` 在 2 s 内返回并完整下发 5 个 step 键;(2) 即便设置了 `ANTHROPIC_API_KEY`(原始症状),短路仍会触发;(3) 旧版 `evalMode: 'manual'` 调用方继续正常工作。

### 📝 G-012 — CHANGELOG 同步补齐(6 个语言版本 × 2 个缺失发布)

- **`docs(changelog): backfill v1.23.0, v1.24.0, v1.24.1, v1.25.0 in 6 lagging locales`** — v1.25 之前仅 EN 含有 v1.23–v1.24 条目;RU 落后 1 个发布,其余 6 个语言版本落后 2 个发布。v1.25 沿用 v1.23 的并行翻译代理策略,将四个版本条目一次性落地至 `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md`。RU 补齐 v1.24.0 + v1.24.1 + v1.25.0(其在 v1.23 周期中已包含 v1.23.0)。
- **`feat(ci): scripts/check-changelog-parity.mjs gate`** — 任一语言版本 CHANGELOG 的最新条目若早于 EN 规范版,构建即失败。已纳入 `npm run test:ci`。一旦再次出现类似 G-012 的同步漂移,在跨越 EN 边界的瞬间即会被拦截。

### ✨ 修饰 — 仪表盘双字形去重

- **`fix(dashboard): dedup ✨ glyph in auto-pipeline button label`** ([`public/js/lib/i18n-dict.js:219`](public/js/lib/i18n-dict.js#L219)) — `dash.autoPipeline` 在每种语言的字符串中均以 `✨` 起头,而 `public/js/views/dashboard.js:58` 又在视图层再次前置一个 `✨`,导致按钮渲染为 `✨ ✨ Auto-pipeline …`。v1.25 在每种语言的 DICT 条目中去除前导字形,视图层的前缀成为唯一来源。同一次审计扫了整套 i18n 资源包,未发现其他双字形模式。

### 🚫 推迟至后续发布

- **G-005 — 报告区块 A-G → A-F 对齐 career-ops.org/docs 规范** — 需要在父项目 `santifer/career-ops` 中协同提交(重写 `modes/oferta.md` 以输出 A=Role、B=CV-match、C=Strategy、D=Comp、E=Personalization、F=STAR — 去除 C-Risks 与 G-Legitimacy 作为独立区块)。v1.25.0 在 web-ui 侧已就绪可消费新 schema(自 v1.13 起 `reports.js` 即支持任意区块字母)。等待父子两端可同步交付的窗口期。
- **G-003 — `README.cn.md` → `README.zh-CN.md` 重命名** — v1.25 准备期间核实:仓库内已存在 `README.zh-CN.md`(整个工作树下无残留的 `README.cn.md`)。G-003 工单为过期信息。

### 🧪 测试

- **477 → 480** 单元测试(PR-B `auto-pipeline-manual-mode.test.mjs` 新增 +3)。
- Playwright 32/32 保持不变。
- `npm run test:ci` 现在串行执行 `npm test` + `check-no-also-leftovers.mjs` + `check-changelog-parity.mjs`。

### 验证

```bash
$ npm run test:ci
# 480 / 480
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.25.0

# G-014 — 即便设置了 ANTHROPIC_API_KEY,手动模式仍在 2 s 内返回:
$ ANTHROPIC_API_KEY=sk-ant-test PORT=4317 npm start &
$ sleep 3
$ time curl -sS -X POST -H 'Content-Type: application/json' \
    -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/x","mode":"manual"}' \
    http://127.0.0.1:4317/api/auto-pipeline | head -20
# real  0m0.1xx s  (此前为 1-3 min)
# event: start … event: step (×5) … event: done {"mode":"manual","prompt":"…"}

# G-012 — 每个语言版本 CHANGELOG 均含 v1.25.0 条目:
$ grep -c '^## \[1.25.0\]' CHANGELOG*.md
# 8 个文件,各 → 1

# 修饰 — 仪表盘字形:
$ grep "dash.autoPipeline" public/js/lib/i18n-dict.js
# 任一语言版本均不再含前导 ✨(由视图层提供唯一字形)
```

### 破坏性变更

无。`mode: 'manual'` 为可选启用项;旧版 `evalMode: 'manual'` 调用方继续正常工作。

### 范围之外(v1.26+)

| 项目 | 备注 |
|---|---|
| G-005 — A-F 报告区块对齐 | 需协同父项目提交(`santifer/career-ops` 重写 `modes/oferta.md`)。 |
| QA 场景 31 **可视化** 子测试的线上执行 | 需浏览器驱动代理(Claude Cowork)。Playwright 烟囱测试已部分覆盖。 |
| `i18n-dict.js` 超过 400 行目标 | 翻译资源固件 — 按策略豁免。拆分会在无打包器情况下增加 HTTP 请求数。 |

---

## [1.24.1] — 2026-05-14

**热修复:`#/config` 在 8 个语言版本下均崩溃(G-015)。**

### 🚑 关键热修复

- **`fix(config): G-015 — replace removed Element.prototype.also call in config.js`** ([`public/js/views/config.js:371`](public/js/views/config.js#L371)) — v1.22.0 N-2 移除了 `Element.prototype.also` 全局猴子补丁,并将 `cv.js` 迁移为自由语句模式,**但漏掉了 `config.js`**。结果是任一语言版本下 `#/config` 首次调用即崩溃并抛出 `c(...).also is not a function`。v1.24.1 沿用 `cv.js:188-201` 的同款迁移模式 — 将树根抽取为 `const root = c(...)`,在其后独立执行激活语句块,最后 `return root;`。

### 🛡️ CI 守卫

- **`feat(ci): scripts/check-no-also-leftovers.mjs sweep`** — 遍历 `public/js/views/` 下每一个文件,任一处 `.also(` 调用即构建失败(注释中的引用不计)。已纳入新增的 `npm run test:ci` 脚本。日后即便有人回滚猴子补丁的移除,也无法静默引入同一回归。

### 🧪 测试

- **`test: tests/config-view-syntax.test.mjs`** — 三道守卫:
  - 通过 `node:vm.Script` 解析 `config.js`(无需 Playwright 即可捕获语法层回归);
  - 断言除注释外不再残留任何 `.also(`;
  - 断言 `const root = c(...)` / `return root;` 迁移锚点已就位。
- **474 → 477** 单元测试(+3),Playwright 32/32 保持不变。

### 验证

```bash
$ npm run test:ci
# 477 / 477
# ✓ no .also( leftovers in views/

# 浏览器烟囱测试:
$ open http://127.0.0.1:4317/#/config
# → 正常渲染,不再出现 "is not a function" 卡片。每个语言版本均同。
```

### 范围之外(推迟至 v1.25)

- G-014、G-012、G-005、G-003 — 见下文 v1.25.0 条目的整体说明。

---

## [1.24.0] — 2026-05-14

**帮助资源包内容深度刷新 + QA 场景 31 线上执行 + RU CHANGELOG 端到端译文落地。** 闭环 v1.23.0 "范围之外" 表中两项推迟至 v1.24 的事项:其一,从 5 个 career-ops.org/docs 规范 URL 出发,对全部 8 个帮助资源包做内容深度刷新(自 v1.11.x 起仅完成 URL 覆盖);其二,QA 场景 31 在运行中服务器上的线上执行(此前被标注为 "需浏览器代理 + LLM 凭据" — 实测 6/6 子测试中可经 curl + grep 触达,仅可视化子测试需浏览器)。

### 📖 帮助资源包内容深度刷新

- **`docs(help): refresh en.md from 5 canonical career-ops.org/docs URLs`** ([`docs/help/en.md`](docs/help/en.md)) — v1.24 之前 EN 资源包为 1113 行,虽在 front-matter 中列出 5 个规范 URL,但正文未做展开。v1.24 经 WebFetch 抓取全部 5 个 URL,并对对应的 H2 区段加深内容:
  - **About career-ops(front-matter)** — 新增原则段(数据主权、AI 无关、用户主导)、"What career-ops is NOT" 段;概念清单由 6 行扩至 10 行(新增 Proof points、JD store、Interview-prep、Batch additions)。
  - **§5 Portals** — 新增规范引导命令 `cp templates/portals.example.yml portals.yml`,并按 `tracked_companies` 条目梳理必填与可选字段。
  - **§7 Scan** — 选项 A 段补充 "no AI tokens consumed" 提示,并列出后续命令清单(`apply` / `contacto` / `deep` / `tracker`)。
  - **§14 Apply checklist** — 拆分为 SPA 清单模式、Manual / Playwright 辅助模式、完整 CLI 流程(规范 8 步,从 `/career-ops apply <company>` 到 `Submitted.` 并自动完成 `Evaluated → Applied` 状态转移);批量评估子段新增 TSV schema 表 + 全部 4 个开关说明 + `merge-tracker.mjs --dry-run`;Playwright Setup 子段列出安装命令、MCP 注册、`.claude/settings.local.json` 备选方案,并标注 headless-by-default。
- **保持 16 个 H2 区段同构**(CI 测试 `help-ui.test.mjs::section-parity` 断言全部 8 个语言版本恰好包含 16 个 H2 区段)。
- **5 个规范 URL 每一个在资源包中至少出现 2 次**(由 CI 测试 `canonical-docs-coverage.test.mjs` 强制约束)。v1.24 后逐 URL 出现次数:`what-is-career-ops` × 4、`scan-job-portals` × 5、`apply-for-a-job` × 3、`batch-evaluate-offers` × 5、`set-up-playwright` × 3。
- **`docs(help): translate the v1.24 deepening to 7 non-EN locales`** — 调度 7 个并行翻译代理。每个目标语言(es / pt-BR / ko-KR / ja / ru / zh-CN / zh-TW)收到一份与 EN 结构逐节对应的刷新版资源包,代码块、URL、文件路径、按钮文案(📁 Upload CV / 🌐 Scan now / ▶ Evaluate / 📄 Generate PDF / 💾 Save)以及英文缩写(CSP、SSRF、TOCTOU、WCAG、ATS、JD、SSE、REST、API)按原文保留,新增内容以目标语言的出版级技术风格落地。

### 🧪 QA 场景 31 — 线上执行(6/6 PASS)

- **`docs(qa): append last-verified live-execution log to qa/claude-cowork-browser-test-prompt.md`** — v1.24 之前场景 31 仅文档化但从未在运行中的服务器上跑过(原记为 "需浏览器代理 + LLM 凭据")。v1.24 将 6 个子测试一次性跑通,目标 `http://127.0.0.1:4317`:

  | 子项 | 描述 | 状态 |
  |---|---|---|
  | 31.1 | 帮助资源包中的分数阈值 | ✅ PASS(`docs/help/en.md` 中 4.5 × 3、4.0 × 9、3.5 × 6 次提及) |
  | 31.2 | 扫描工作流端点 | ✅ PASS(`/api/stream/scan-{en,ru}` + `/api/scan-ru/config` → 404;`/api/scan/regional/config` → 200) |
  | 31.3 | `/api/apply-helper` 清单 | ✅ PASS(响应正文包含 `career-ops apply` 与 `auto-submit` 警示) |
  | 31.4 | `/api/batch` 端点 | ✅ PASS(响应键为 `[exists, runnerExists, raw, rows, additions]`) |
  | 31.5 | Playwright 可用性 | ✅ PASS(`/api/health` 上报 `Playwright (parent node_modules) ok: true, value: installed`) |
  | 31.6 | 帮助资源包 URL 覆盖(5 个 URL × 8 个语言版本) | ✅ PASS(**40 / 40 ✓**) |

  仅可视化的子测试(需浏览器)在 QA prompt 中单独标注 — 可经 Claude Cowork 或 `npm run test:e2e:browser` 触达。

### 🌐 RU CHANGELOG 端到端译文(M-9 后续)

- **`docs(translate): CHANGELOG.ru.md retry agent — full body translation`** ([`CHANGELOG.ru.md`](CHANGELOG.ru.md)) — v1.23.0 交付时 RU CHANGELOG 重试代理仍在执行(首次曾因 socket 错误失败,经重新调度)。v1.24 接收该代理 1542 行的完整译文:从 v1.23.0 到 v1.6.0 的每一条目均落地为出版级俄语正文,EN 原文性质的占位说明全部清除。文体纪律对齐 v1.22.0 README 质量复核:以 "функциональность" / "возможности" / "поведение" 替换生硬的 "функционал";以 "через" / "с помощью" 替换 "при помощи";主动语态优先;"эндпоинт"、"лимит запросов"、"состояние гонки"、"санитайзинг" 为规范术语;英文缩写(TOCTOU、CSP、SSRF、WCAG、ATS、JD、SSE、REST、API)按原文保留。

### 🧪 测试

- **474 / 474** 单元 + 20 / 20 烟囱 E2E + 32 / 32 Playwright。零行为差异;帮助资源包的全部 CI 断言(16 H2 区段 × 8 个语言版本、5 URL × ≥ 2 次提及、内容底线)继续通过。

### 验证

```bash
$ npm test                            # 474 / 474

# 帮助资源包深化:
$ wc -l docs/help/en.md
# ~1270 行(此前为 1113 — 加深而非膨胀)

$ for url in what-is-career-ops scan-job-portals apply-for-a-job \
             batch-evaluate-offers set-up-playwright; do
    echo -n "$url: "
    grep -c "$url" docs/help/en.md
  done
# what-is-career-ops: 4
# scan-job-portals: 5
# apply-for-a-job: 3
# batch-evaluate-offers: 5
# set-up-playwright: 3

# 场景 31.6 — 40/40 URL 覆盖:
$ for lang in en es pt-BR ko ja ru zh-CN zh-TW; do
    echo -n "$lang: "
    for url in what-is-career-ops scan-job-portals apply-for-a-job \
               batch-evaluate-offers set-up-playwright; do
      curl -sS "http://127.0.0.1:4317/api/help/$lang" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('markdown',''))" \
        | grep -q "$url" && echo -n "✓ " || echo -n "✗ "
    done
    echo
  done
```

### 破坏性变更

无。

### 范围之外(v1.25+)

| 项目 | 备注 |
|---|---|
| 场景 31 **可视化** 子测试的线上执行 | 需浏览器驱动代理(Claude Cowork 或 `npm run test:e2e:browser`)。仅 curl 执行无法覆盖;已由 Playwright 烟囱测试补足。 |
| RU CHANGELOG **更早条目**(v1.5.x 及以下)的正文翻译 | 重试代理仅覆盖 v1.6.0 起的条目。v1.6 之前的条目(若曾存在)仍为既有内容。 |
| 后续 SPA 变更后仪表盘截图的可视回归 | `scripts/capture-dashboard-screenshots.mjs` 可重新生成各语言 PNG;目前尚无自动化 diff。 |

---

## [1.23.0] — 2026-05-14

**i18n 拆分 + 连接横幅 CI 修复 + 本地化仪表盘截图 + 全部既有遗留项闭环。** 一次性交付 v1.22.0 "范围之外" 表标注给 v1.23 的三项工作(M-9 各语言 CHANGELOG 正文翻译、N-1 `i18n.js` 行数拆分、帮助资源包内容审计),并附带一项让 v1.22.0 主干 CI 转红的烟囱 E2E 热修复。

### 🚑 CI 热修复 — 连接横幅恢复

- **`fix(client): reset health-poll cadence + visibilitychange eager re-check`** ([`public/js/api.js:21-91`](public/js/api.js#L21-L91)) — v1.22.0 的 M-6 指数退避方向正确(3 s → 6 s → 12 s → cap 15 s,自原 60 s 上限下调),但在飞中的 `setTimeout` 仍锁定了上一次设置的延迟。若服务器在 t=0.1 被杀且首次 ping 落在 t=3,该次会失败,延迟翻倍到 6,下一次恢复探测要拖到 t=9 才发出。烟囱 E2E 中 "Flow 2a:服务器宕机时连接横幅出现、恢复后隐藏" 仅等 4 s,因此在 `main` 上转红。

    v1.23.0 重塑轮询循环:

    - 跟踪 `_healthHandle`,使 `setConnectionState(lost=true)` 能调用 `clearTimeout` 并以 `_HEALTH_MIN` 重新调度。首次恢复探测在宕机后 3 s 内一定发出,不再受先前排队延迟影响。
    - `_HEALTH_MAX` 由 60 s 下调至 15 s。即便标签页在后台、服务器仍处于死掉状态,用户回到标签页时也能在一个轮询周期内恢复;带宽节省仍然显著。
    - `document.addEventListener('visibilitychange')` 在标签页重获焦点且 `connectionLost === true` 时立即重检 — Cmd-Tab 切回不再等待下一次退避节拍。

### 🧹 N-1 — i18n.js 拆分(此前超过 400 行目标)

- **`refactor(client): split DICT into i18n-dict.js (data) + i18n.js (logic)`** — v1.23 之前 `public/js/lib/i18n.js` 共 639 行。其中绝大部分(23–586 行)是 `DICT` 翻译表 — 纯结构化数据。v1.23.0 将其抽出为 [`public/js/lib/i18n-dict.js`](public/js/lib/i18n-dict.js)(578 行,按 CLAUDE.md "Exempt from these limits: generated files, migrations, test fixtures, lock files, vendored code" 条款豁免行数约束 — 翻译表归入 fixtures),余下 [`public/js/lib/i18n.js`](public/js/lib/i18n.js) 缩至 86 行的纯模块逻辑(远低于 400 行目标)。
- **加载契约:**`i18n-dict.js` 向 `window.__I18N_DICT = { … }` 写入数据,随后 `i18n.js` 在既有 IIFE 中读取。[`public/index.html`](public/index.html) 按顺序加载二者 — `i18n-dict.js` 先于 `i18n.js` — 确保 IIFE 构造时 DICT 已完全填充。缺失字典的兜底:任一 `t()` 调用回退至内联 fallback 或原始 key,将配置异常显式暴露而不导致 SPA 崩溃。
- **测试管道同步更新:**[`tests/i18n-coverage.test.mjs`](tests/i18n-coverage.test.mjs)、[`tests/help-ui.test.mjs`](tests/help-ui.test.mjs)、[`tests/canonical-docs-coverage.test.mjs`](tests/canonical-docs-coverage.test.mjs) 现在将两份文件一同载入测试 VM 上下文(或拼接源文本供正则扫描),保留全部既有断言。

### 🌐 M-9 — 各语言 CHANGELOG 正文翻译

- **`docs(translate): 7 non-EN CHANGELOG files end-to-end`** — v1.23 之前 `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` 自 v1.13.0 起每个条目都仅有 EN 正文性质的占位说明,并在末尾提示读者参考 EN 规范版。v1.23.0 调度 7 个并行翻译代理(每语言一个),将每条正文以目标语言的出版级技术风格重写。占位说明清除。代码块、文件路径、URL、提交信息字符串(`fix(security): B-1 — …`)、环境变量与链接文案在所有语言版本中按原文保留。

### 🖼️ 各语言 README 中的本地化仪表盘截图

- **`docs(readme): wire each locale README at its locale-specific PNG`** — v1.23 之前仅 `README.pt-BR.md` 引用了 `dashboard-pt-BR.png`,其余 6 个非英文 README 仍指向 `dashboard-en.png`。截图已由 v1.22.0 周期中的 [`scripts/capture-dashboard-screenshots.mjs`](scripts/capture-dashboard-screenshots.mjs) 生成并落于 `images/`,但未投入使用。v1.23.0 将每份 `README.{es,ja,ko-KR,ru,zh-CN,zh-TW}.md` 第 14 行指向其本地化 `dashboard-<locale>.png`。

### 🧪 测试

- 单元 474 / 474、Playwright 32 / 32 与 v1.22.0 持平。**烟囱 E2E 恢复至 20 / 20**(v1.22.0 主干因横幅恢复回归曾报 19/1 fail;v1.23.0 的重排调度修复将其闭环)。
- 三个既有测试已为 i18n 拆分调通配线。零新增测试文件,零既有断言删除。

### 验证

```bash
$ npm test
# 474 / 474

$ npm run test:e2e
# passed: 20    failed: 0    (v1.22.0 main 曾为 19/1)

$ wc -l public/js/lib/i18n.js public/js/lib/i18n-dict.js
#       86 public/js/lib/i18n.js          ← 逻辑,低于目标
#      578 public/js/lib/i18n-dict.js     ← 数据 fixture,豁免

$ grep -h 'dashboard-' README*.md | sed -E 's/.*(dashboard-[^)]+).*/\1/' | sort -u
# dashboard-en.png    (仅 README.md)
# dashboard-es.png    dashboard-ja.png
# dashboard-ko-KR.png dashboard-pt-BR.png
# dashboard-ru.png    dashboard-zh-CN.png  dashboard-zh-TW.png

# CHANGELOG 翻译完整性核验:每个语言文件正文行数 > 200
$ wc -l CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md | grep -v total
```

### 破坏性变更

无。`public/index.html` 现在加载两个脚本(原为一个) — 任何通过 CDN 分发 SPA 的部署都需要补上 `i18n-dict.js`;脚本加载顺序由 `index.html` 中 `<script src>` 标签的顺序保证。运行期兜底(DICT 为空 → `t()` 返回内联 EN fallback)可避免新文件缺失时硬崩溃。

### 范围之外(v1.24+)

| 项目 | 备注 |
|---|---|
| 基于 career-ops.org/docs 的帮助资源包内容深度刷新(对应 URL 覆盖) | 5 个规范 URL 自 v1.11.x 起已出现在每个语言版本的帮助资源包中,QA prompt 中场景 31.6 验证覆盖。正文深度刷新为 v1.24+ 候选项。 |
| QA 场景 31 在运行中服务器上的线上执行 | 需浏览器代理 + 线上 LLM 凭据。v1.24 候选。 |
| 新增 mode-page 提示段在所有语言下的逐组件 touch-target 复查 | v1.22.0 M-1 新增的 `<p class="field-hint">` 元素尚未在全部 8 个语言版本下针对 WCAG 2.5.5 最小高度做核验。 |

---

## [1.22.0] — 2026-05-14

**清理 M/L/N 优先级遗留项 + 文档对齐 + 翻译质量复核。** `v1.20.1-BACKLOG.md` 中所有中等及以下优先级条目在单次发布中一次性解决:9 个 M 项、5 个 L 项、2 个细节项。此外完成了一次与 [career-ops.org/docs](https://career-ops.org/docs) 五份官方指南的文档对齐审计,刷新了 `.claude/` 与 `.github/` 下的系统提示,并对全部 7 个非英文 README 进行了出版级质量重译。

### 🛡️ 安全加固(纵深防御)

- **`fix(security): M-4 — 支持 HTML 实体识别的 stripDangerousMarkdown`** ([`server/lib/security.mjs`](server/lib/security.mjs)) — v1.22 之前的正则将 `<script>`、`javascript:`、`on*=` 作为字面子串匹配,因此 `&lt;script&gt;`、`java&#115;cript:` 以及 `<img src="data:image/svg+xml,<svg onload=…>">` 可以绕过。新版本会在执行剥离正则之前,先解码 `&lt;`、`&gt;`、`&amp;`、`&quot;`,以及十进制(`&#NN;`)和十六进制(`&#xHH;`)字符引用。[`tests/cv-xss-bypasses.test.mjs`](tests/cv-xss-bypasses.test.mjs) 中 11 个用例验证此行为。真正的防线仍然是客户端 `UI.md` 先转义再渲染的管道;此项强化的是静态文件层。

- **`fix(security): L-2 — 批处理运行器使用 bash --noprofile --norc`** ([`server/lib/routes/batch.mjs:108`](server/lib/routes/batch.mjs#L108)) — `spawn('bash', [PATHS.batchRunner, ...])` 此前会继承用户的 `~/.bashrc`。恶意 rc 文件可能影响执行。改为 `spawn('bash', ['--noprofile', '--norc', PATHS.batchRunner, ...])`。

### 🔒 韧性

- **`fix(client): M-6 — 健康探测使用指数退避`** ([`public/js/api.js:22-48`](public/js/api.js#L22-L48)) — 断连状态下的轮询此前会在一夜之间对死掉的服务器发起 28,800 次请求。现改为 3s → 6s → 12s → 24s → 60s,首次返回 2xx 后重置为 3s。实现采用 `setTimeout` 链(而非 `setInterval`),以便每一步都能采用新的延迟。

- **`fix(client): M-5 — Safari 隐私模式 localStorage 守卫`** ([`public/js/lib/i18n.js:572-583`](public/js/lib/i18n.js#L572-L583)) — Safari 隐私模式会对每次 `localStorage.getItem/setItem` 抛出 `SecurityError`。加载期间的 IIFE 此前会让整个 i18n 模块崩溃,导致 SPA 渲染原始键名。现已为两处调用都包了 try/catch,并回落到 `detect()` 浏览器语言检测。

- **`fix(server): M-2 — 预览出站请求的响应体大小上限(测试 + 验证)`** — v1.21.0 的 `safeGet` 已经流式读取分块并在 `opts.maxBytes` 处截断。v1.22 在 [`tests/ssrf-redirect-rebind.test.mjs`](tests/ssrf-redirect-rebind.test.mjs) 中新增一条回归测试以锁定契约:上游 100 KB + 上限 4 KB → 响应 ≤ 4 KB。

- **`fix(client): L-5 — scan.js 在 hashchange 时清除 setTimeout`** ([`public/js/views/scan.js:6-22, :113-120`](public/js/views/scan.js#L6-L22)) — 扫描完成后 300 ms 的 `refreshResults()` 计时器此前会在用户于该窗口期内离开 `#/scan` 时泄漏。现在句柄已被捕获并在 `__cancelActiveScanPoll` 中清理。

- **`fix(client): L-4 — 多行 SSE data: 拼接器`** ([`public/js/lib/auto-pipeline.js:158-176`](public/js/lib/auto-pipeline.js#L158-L176)) — SSE 解析器此前使用 `match()`(单行)。根据规范,一个事件可携带多行 `data:`,消费方需用 `\n` 拼接。服务器当前发送的是单行 JSON,所以旧代码尚能工作 — 但对未来任何多行负载都是脆弱的。

### ♿ 无障碍

- **`feat(a11y): M-3 — WCAG 1.4.1 在分数胶囊与连接横幅上补充冗余视觉提示`** ([`public/css/app.css:602-625, :812-822`](public/css/app.css#L602-L625)) — score-high / score-mid / score-low 此前仅靠色相(红/琥珀/绿)传达状态,无法感知色相的用户没有备用提示。每个分级现在通过 `::before` 获得冗余字形(✓ / ◐ / ○)。连接横幅在离线状态下增加前导 `⚠` 字形。渲染位置未动 — 纯 CSS 加固。

- **`feat(a11y): M-1 — 每个 mode-page 字段都有内联提示段落`** ([`public/js/views/mode-page.js`](public/js/views/mode-page.js)、[`public/js/lib/i18n.js`](public/js/lib/i18n.js)) — v1.20.0 为每个 mode-page 字段接通了 `htmlFor → id`,但没有携带内联提示文案;仅 README 教程说明了字段意图。v1.22.0 新增 19 个提示 i18n 键 × 8 个语言 = **152 条新译文**,并让 `field()` 构造器为每个字段渲染一个 `<p id="…-hint">` 并通过 `aria-describedby` 关联。屏幕阅读器用户在输入聚焦时能听到提示。

- **`fix(a11y): M-7 — UI.el() 的 htmlFor 别名空值守卫`** ([`public/js/api.js:194-198`](public/js/api.js#L194-L198)) — `htmlFor: null` 此前会渲染成字面量 `for="null"`。一行修复,镜像缺省分支的 `v != null && v !== false` 守卫。

### 🧹 质量 / 可移植性

- **`fix(server): L-1 — 在 health.mjs + bin/start.sh + bin/setup.sh 中为 parseInt 指定基数`** — `parseInt(process.versions.node)` 未指定基数会触发 lint 警告,且若 Node 未来发布十六进制版本号将不稳。各处均补充了 `10`。

- **`fix(server): L-3 — Windows 安全的入口点检查`** ([`server/index.mjs:159-163`](server/index.mjs#L159-L163)) — `import.meta.url === \`file://${process.argv[1]}\`` 在 Windows 上对盘符和反斜杠处理有误。替换为 `fileURLToPath(import.meta.url) === path.resolve(process.argv[1])`。

- **`refactor(client): N-2 — 移除 Element.prototype.also 猴子补丁`** ([`public/js/views/cv.js:188-201`](public/js/views/cv.js#L188-L201)) — 全局 DOM 原型污染。替换为局部变量持有树根。

- **`test(canary): M-8 — 已退役 /api/scan-ru/config 的 404 回归测试`** ([`tests/scan-consolidated.test.mjs`](tests/scan-consolidated.test.mjs)) — v1.20.0 退役了该别名但未加守护测试。新增三行,与 v1.18 退役测试保持一致。

### 📚 文档 + 系统提示

- **`docs(architecture): 为 v1.21+ 表面刷新 OVERVIEW + DATA-FLOWS`** — 在 OVERVIEW.md 中新增 `safe-fetch.mjs`(DNS 锁定的 GET)、`file-lock.mjs`(按路径互斥)、`rate-limit.mjs`(LLM 流控)及 `sanitizePathName`。DATA-FLOWS.md 新增两节:"出站 URL 抓取(防 DNS-rebind)"与 "LLM 端点速率限制"。

- **`docs(readme): 安全护栏章节刷新`** — README.md "Security notes" 现已说明 v1.21+ 安全护栏的全部辅助模块(sanitizePathName、safeGet、withFileLock、llmRateLimit、支持实体识别的 stripDangerousMarkdown)。

- **`docs(qa): scenario 31 — career-ops.org/docs 对齐`** ([`qa/claude-cowork-browser-test-prompt.md`](qa/claude-cowork-browser-test-prompt.md)) — 6 个新子测试(31.1–31.6)验证 UI 与 career-ops.org/docs 五份官方指南所述行为一致:分数阈值、扫描流程(单按钮)、申请流程(清单而非自动提交)、批量流程(TSV 编辑器)、Playwright 安装(优雅降级)、帮助文档覆盖(5 个 URL × 8 个语言)。

- **`docs(translate): 7 个非英文 README 的质量重译`** — 每一个非英文 README 均以原生语言重写为出版级技术风格。替换了常见的生硬直译;补充了 v1.21/v1.22 安全护栏的说明;徽章版本号同步。

- **`docs(system): .claude/PROJECT-CONTEXT.md + .github/copilot-instructions.md`** — 为加入会话的代理提供单文件定位指南。压缩了 CLAUDE.md,点名 v1.21+ 辅助模块,列出常见陷阱。

- **`docs(bin): 同步 start.sh / setup.sh / run_all.sh 注释`** — "two deps" → "three deps"(express + js-yaml + multer);"298 tests" → "474+ tests";`parseInt` 基数补齐。

### 🧪 测试

- **461 → 474 单元**(+13)+ 32/32 Playwright 不变。
- 新增测试文件:`cv-xss-bypasses.test.mjs`(M-4,11 个用例)。
- 扩展:`ssrf-redirect-rebind.test.mjs`(M-2 响应体上限 +1)、`scan-consolidated.test.mjs`(M-8 别名守护 +1)。
- 既有套件零行为差异 — 每项修复都是增量或由新守护测试覆盖。

### 验证

```bash
npm test                          # 474 / 474
npm run test:e2e:browser          # 32 / 32

# 实体编码的 XSS 剥离:
node -e "import('./server/lib/security.mjs').then(({stripDangerousMarkdown}) => console.log(stripDangerousMarkdown('&lt;script&gt;alert(1)&lt;/script&gt;')))"
# → '' (no <script> survives)

# 健康探测退避(打开 devtools,杀掉服务器,观察网络面板):
#   3 s → 6 s → 12 s → 24 s → 60 s,首次成功探测后重置

# 分数胶囊字形(在浅色和深色主题下打开 #/reports):
#   .score-high 显示 ✓ + 数值分数
#   .score-mid  显示 ◐ + 数值分数
#   .score-low  显示 ○ + 数值分数

# Mode-page 提示(#/contacto 等):
#   <input aria-describedby="mode-contacto-recipient-hint">  ← targets <p id="…">

# 已退役的别名:
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/scan-ru/config
# → 404
```

### 破坏性变更

无。所有修复都是增量,既有端点契约保留。

### 范围外(v1.23+)

| 项目 | 说明 |
|---|---|
| M-9 — 各语言 CHANGELOG 正文翻译 | `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` v1.13+ 条目此前为英文权宜版。发布节奏放缓后批量翻译。 |
| N-1 — `public/js/lib/i18n.js` 超出 400 行目标 | 按语言拆分会在无构建步骤的情况下增加 HTTP 开销。推迟到构建步骤决策落地。 |
| 帮助文档内容随 career-ops.org/docs 刷新 | 五个权威 URL 已经出现在每个语言的帮助文档中(自 v1.11.x 起)。QA 提示中的 Scenario 31.6 验证覆盖。内容深度刷新作为 v1.23 候选项。 |

---

## [1.21.0] — 2026-05-14

**两次独立代码评审带来的安全 + 并发 + 无障碍打磨。** [`docs/specs/V1.20.1-BACKLOG.md`](docs/specs/V1.20.1-BACKLOG.md) 中的 7 个发现一次性发布:1 个阻塞项(DNS-rebind TOCTOU)、6 个高严重度缺陷(路径遍历净化分散、LAN 部署的流控空缺、并发写入竞态、i18n 覆盖漏洞、悬空的 aria-describedby、缺失的 label 关联)。新增 34 个测试;基线从 427 → 461 单元 + 32/32 Playwright。每项修复都附带一条命名的回归测试。

### 🛡️ 安全

- **`fix(security): B-1 — 通过 safe-fetch.mjs 关闭 DNS-rebind TOCTOU`** ([`server/lib/safe-fetch.mjs`](server/lib/safe-fetch.mjs)) — 此前的模式是做一次显式 `dnsLookup` 用于校验,然后让 `fetch()` 自己再做一次独立的解析。掌握 TTL=0 的 DNS-rebind 攻击者可以在第 1 次解析返回公网 IP、第 2 次解析返回 `127.0.0.1` / `169.254.169.254` 或某个 LAN 地址,从而绕过 `isPrivateOrLoopbackHost`。新的 `safeGet` 只解析一次,通过 node:http(s) 把 TCP 连接锁定到那个具体 IP,并设置 SNI/Host 让证书校验仍指向原始主机名。被 `/api/pipeline/preview` 和 `/api/auto-pipeline` 使用。解析失败时 fail-CLOSE(逆转了此前 `try { … } catch { /* fall through */ }` 的语义)。由 [`tests/ssrf-redirect-rebind.test.mjs`](tests/ssrf-redirect-rebind.test.mjs) 中 8 个新测试验证。

- **`fix(security): H-4 — 在 10 条路由间统一 sanitizePathName`** ([`server/lib/security.mjs`](server/lib/security.mjs)) — 裸正则 `replace(/[^\w\-.]/g, '')` 在 `jds.mjs`、`content.mjs`、`reports.mjs`、`llm.mjs`、`runners.mjs` 中被复制了多份且保留了 `.` 字符,所以 `..pdf`、`....md`、以点开头的文件名都能存活。只有 `reports.mjs::sanitizeSlug` 是正确的。v1.21.0 将正确版本(`sanitizePathName`)提升到 `security.mjs`,删除了 10 处错误副本,并对空结果返回 400。由 [`tests/path-traversal.test.mjs`](tests/path-traversal.test.mjs) 中 12 个测试验证。

- **`fix(security): H-5 — 在公开绑定时对 LLM 端点进行速率限制`** ([`server/lib/rate-limit.mjs`](server/lib/rate-limit.mjs)) — `/api/evaluate`、`/api/deep`、`/api/mode/:slug`、`/api/auto-pipeline` 之前没有按 IP 的限流。Loopback 用户不受影响;LAN 暴露的部署(`HOST=0.0.0.0`)每 IP 每分钟 10 次请求,溢出时携带 `Retry-After` 与 `X-RateLimit-*` 头。通过 `LLM_RATE_LIMIT="N/Ws"` 配置。这是 v2.0 P-12 鉴权门之前廉价的过渡防御。由 [`tests/rate-limit.test.mjs`](tests/rate-limit.test.mjs) 中 6 个测试验证。

### 🔒 并发

- **`fix(data): H-6 — applications.md / pipeline.md 的按文件互斥锁**`** ([`server/lib/file-lock.mjs`](server/lib/file-lock.mjs)) — 并发的 `POST /api/tracker`(或 auto-pipeline 与手动添加竞争)此前会两边都读到 `num=42`、两边都写入 `num=43`,导致较早的一行被静默丢弃。`withFileLock(path, fn)` 按路径串行化读-改-写;不同路径仍然并行。已接入 `tracker.mjs`、`pipeline.mjs`(POST + DELETE)以及 `auto-pipeline.mjs` 的 tracker 步骤。由 [`tests/concurrent-tracker-write.test.mjs`](tests/concurrent-tracker-write.test.mjs) 中 5 个测试验证,包括一个 20 并发 POST 的集成检查,断言 001..020 行依次写入。

### ♿ 无障碍

- **`fix(a11y): H-1 — batch.js 提示段落补上 id="batch-tsv-hint"`** ([`public/js/views/batch.js`](public/js/views/batch.js)) — v1.20.0 给 TSV 文本框加了 `aria-describedby="batch-tsv-hint"`,但从未给提示 `<p>` 配上对应的 `id`。屏幕阅读器无可朗读。已修复。

- **`fix(a11y): H-2 — batch-parallel / batch-min-score 标签的 htmlFor`** ([`public/js/views/batch.js`](public/js/views/batch.js)) — v1.20.0 给 4 个输入新增了 id,但 label 与之并未以编程方式关联。WCAG 3.3.2 现已满足。

- 在 [`tests/a11y-form-wires.test.mjs`](tests/a11y-form-wires.test.mjs) 中新增静态分析守护测试 — 遍历所有视图文件,断言每个 `aria-describedby` / `htmlFor` IDREF 都指向同级的 `id:` 声明。CI 期可捕获笔误级别的回归。

### 🌐 i18n

- **`fix(i18n): H-3 — v1.20.0 引入的 13 个键对 7 种语言静默回退到 EN`** ([`public/js/lib/i18n.js`](public/js/lib/i18n.js)) — `pipe.filter`、`pipe.count`、`pipe.preview*`、`pipe.openTab`、`pipe.evaluateAll*`、`eval.jdHint`、`batch.parallelAria`、`batch.minScoreAria`,以及 `common.delete`、`config.group{Core,Runtime,Regional}`、`config.profileEmpty`、`config.viewProfile`、`scan.atsBadge`、`scan.regionalBadge` 通过 `t('key', 'EN fallback')` 引用却从未加入 DICT。俄语、日语、中文屏幕阅读器用户听到的 `aria-label` 是英文 — 直接抵消了 v1.20.0 宣称的 WCAG 3.3.2 收益。v1.21.0 添加了全部 19 个键 × 8 个语言(约 150 条新译文),并在 [`tests/i18n-coverage.test.mjs`](tests/i18n-coverage.test.mjs) 中扩展静态分析,扫描 `public/js/**/*.js` 中每一次 `t('key', …)` 调用并断言键存在于 DICT。未来漂移在 CI 期捕获。

### 🧪 测试

- **427 → 461 单元**(+34)+ 32/32 Playwright 不变。
- 新增测试文件:`ssrf-redirect-rebind`、`path-traversal`、`concurrent-tracker-write`、`rate-limit`、`a11y-form-wires`。
- 既有 `pipeline-preview.test.mjs` 从 `globalThis.fetch` mock 改接到 `safe-fetch.mjs` 中的新 `_setTransport` 注入点 — SSRF 路径不再经过 fetch,旧 mock 被静默绕过。

### 验证

```bash
npm test                              # 461 / 461
npm run test:e2e:browser              # 32 / 32
node --test tests/ssrf-redirect-rebind.test.mjs tests/path-traversal.test.mjs \
  tests/concurrent-tracker-write.test.mjs tests/rate-limit.test.mjs \
  tests/a11y-form-wires.test.mjs      # 34 new tests, all green

# 路径遍历:任何遍历形态的 :name 都返回 400 / 404
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/jds/..pdf
# → 400

# 公开绑定下的速率限制:
HOST=0.0.0.0 LLM_RATE_LIMIT=3/60s npm start &
for i in 1 2 3 4; do
  curl -sS -o /dev/null -w '%{http_code} ' -X POST -H 'Content-Type: application/json' \
    -d '{"jd":"…"}' http://0.0.0.0:4317/api/evaluate
done
# → 200 200 200 429

# 并发 tracker 写入:20 个并行 POST,20 行依次落盘:
node tests/concurrent-tracker-write.test.mjs
# 20 sequential rows 001..020

# Aria 关联完整性:
grep -r 'aria-describedby' public/js/views/ | wc -l
# 所有匹配的 `id:` 都能解析(a11y-form-wires.test.mjs 守护)
```

### 范围外(v1.22+)

| 项目 | 说明 |
|---|---|
| `pipeline-preview` 响应体流式上限(M-2) | `await upstream.text()` 在 8 KB 截断前会读取完整 body;恶意 1 GB 流可能耗尽内存。需以流式读 + 字节计数器 + abort 实现。 |
| WCAG 1.4.1 — `.connection-banner` 与分数胶囊的纯色状态(M-3) | 仅靠色相传达状态;需要加图标前缀(✓ / ◐ / ○)或文字后缀。 |
| `stripDangerousMarkdown` 通过 HTML 实体绕过(M-4) | `&lt;script&gt;`、`java&#115;cript:`、`<img src="data:image/svg+xml,<svg onload=…>">` 可绕过正则。客户端 UI.md 的纵深防御仍然有效;通过新测试集统一封堵 + 锁定。 |
| Safari 隐私模式 `localStorage` 访问未加 try/catch(M-5) | `i18n.js:544/571` 抛出 → SPA 渲染原始键名。用 try/catch 包裹并默认 `'en'`。 |
| `setInterval(checkHealth, 3000)` 永不退避(M-6) | 指数 3s → 6s → 12s → 上限 60s。 |
| `htmlFor` 别名缺失空值守卫(M-7) | 一行 `if (v != null && v !== false)` 防御。 |
| 退役 `/api/scan-ru/config` 的 404 守护测试(M-8) | 三行测试,镜像 v1.18 先例。 |
| 各语言 CHANGELOG 正文翻译(M-9) | 发布节奏放缓后批量翻译。 |
| 每个 mode-page 字段的内联提示段落(M-1) | 约 168 个 i18n 键 × 8 个语言;作为打磨项推迟。 |
| L-1 到 L-5 的细节项 | parseInt 基数、bash --noprofile、Windows 安全的 fileURLToPath、多行 SSE、scan.js 计时器清理。 |

---

## [1.20.0] — 2026-05-13

**按组件无障碍打磨 + 非英文 README 对等 + 退役 `/api/scan-ru/config` 别名。** 关闭 v1.19.0 "Out of scope" 表中标记为 v1.20 的四项。

### ♿ WCAG 2.5.5 / 2.5.8 — 按组件触控目标审计

- **`a11y(touch-target): chip 最小高度 28 px + 8 px 间距(2.5.8 间距目标例外)`** — `.chip` 此前是 24 × 约 50 px(垂直 24,高度未达 2.5.5 对密集控件 24 px 的下限);2.5.8 的间距目标例外要求 ≥ 24 × 24 px 或 24 px 间隙。`.chip` 升级为 `min-height: 28px; padding: 6px 12px;`,包裹用的 `.chip-row` 升级为 `gap: 8px;`,两条件同时满足。
- **`a11y(touch-target): 侧栏 nav-item 最小高度 44 px`** — `.nav-item` 此前内边距仅 `10px 14px`,大多数视口下计算高度约 36 px。现为 `padding: 12px 14px; min-height: 44px; box-sizing: border-box;`,与 `.btn` 一致。
- **`a11y(touch-target): tab-btn 最小高度 44 px`** — Reports、Tracker、Scan 结果页的可排序表头 / 分类标签按钮同等处理。

### ♿ WCAG 1.3.1 / 3.3.2 — 内联表单提示的 `aria-describedby`

SPA 内每个表单控件现在都拥有稳定 `id`,其 `<label>` 通过 `htmlFor` 指向它,内联提示段落则通过 `aria-describedby` 关联。共 5 个视图文件被重新接线:

- **`a11y(forms): config.js`** — 按键 `id` + 提示关联(`cfg-<key>` / `cfg-<key>-hint`)。
- **`a11y(forms): evaluate.js`** — `eval-jd` 文本框 + `eval-jd-hint` 段落,说明净化后 50 字符的下限。
- **`a11y(forms): batch.js`** — `batch-tsv` / `batch-tsv-hint`,以及 `batch-parallel`、`batch-min-score`、`batch-dry-run`、`batch-retry` 的 `aria-label`。
- **`a11y(forms): pipeline.js`** — `pipe-filter` + `pipe-new-url` / `pipe-new-url-hint`。
- **`a11y(forms): mode-page.js`** — 7 个通用 mode(`project`、`training`、`followup`、`batch-prompt`、`contacto`、`interview-prep`、`patterns`)的每个字段都获得 `mode-<slug>-<name>` id 以及 `htmlFor` 标签。

`UI.el()` 学会了 React 风格的 `htmlFor` 别名,让视图代码保持声明式 — 它会设置底层的 `for` 属性(因为 `for` 在 JS 中是保留字)。

### 🌍 非英文 README 对等

- **`docs(readme): 7 个语言对齐到 EN 主版本 585 行`** — `README.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` 此前为 306–316 行(覆盖了主要章节但跳过了营销重的教程和大部分 API 参考)。7 个语言现已全面镜像 EN 结构:About → 一键安装 → Why? → Quick start(3 个编号步骤) → Requirements → 功能表 → Scan → Architecture(完整目录树) → API reference(每条路由表) → Tests → Configuration → Security notes → Limitations → Contributing → 🌍 Getting Started 5 步教程 → License。

### 🧹 退役 `/api/scan-ru/config` 别名

- **`feat!(scan): 移除 /api/scan-ru/config 兼容别名(v1.20 sunset)`** — v1.19 中作为单版本兼容别名保留。规范的 `/api/scan/regional/config` 现在是唯一路径。移除项:`server/lib/routes/scan.mjs` 中的路由注册、`README.md` 与 `docs/architecture/{OVERVIEW,SERVER,API}.md` 中的文档引用。测试已经覆盖规范路径 — 无需测试调整。

### 🧪 测试

- 套件与 v1.19 一致。**427 / 427** 单元 + 20/20 smoke + 23/23 comprehensive + 32/32 Playwright。所有无障碍接线都是增量(增加 `id` / `for` / `aria-describedby` 属性) — 没有行为变化,无测试差异。

### 验证

```bash
npm test                              # 427 / 427
npm run test:e2e:browser              # 32 / 32

# 触控目标 — 所有 chip / nav-item / tab-btn ≥ 28 / 44 / 44 px:
#   Chrome DevTools → Computed → height/min-height on .chip, .nav-item, .tab-btn

# 表单标签 — 每个输入都有 label[for=…] 关联:
#   document.querySelectorAll('input,textarea,select').forEach(el =>
#     console.assert(el.labels?.length || el.getAttribute('aria-label'), el))

# 别名已移除:
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/scan-ru/config
# → 404

# 规范端点仍然有效:
curl -s http://127.0.0.1:4317/api/scan/regional/config | jq '.'
```

### 破坏性变更

- `DELETE /api/scan-ru/config` — 已移除。请使用 `/api/scan/regional/config`。已在 v1.19.0 的 CHANGELOG 和验证脚本中宣告 sunset。

### 范围外(v1.21+)

| 项目 | 说明 |
|---|---|
| 每个 mode-page 字段的内联提示段落 | 目前只接通了 `<label for=…>` 关联;每字段的可见提示文案在 SPA 中仍仅为英文。README 教程对每个语言都说明了字段意图,因此这是打磨项而非阻塞项。 |
| `.connection-banner` 和仪表板分数胶囊的非颜色状态(WCAG 1.4.1) | 横幅依赖红/琥珀/绿;对无法感知色相的用户,需要图标或文字后缀。 |
| 各语言 CHANGELOG 正文翻译 | `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` 仍保留英文权宜版。v1.x 发布节奏放缓后再翻译。 |

---

## [1.19.0] — 2026-05-13

**WCAG 1.4.3 对比度 + 扫描统一(收尾) + 从 UI 移除 HH_USER_AGENT。** 关闭 v1.18 范围外的对比度审计,完成 v1.18 启动的 EN/RU 拆分清理,并按用户指示从 UI 移除 `HH_USER_AGENT` 配置项(服务器内置的合理默认已能满足非俄罗斯 IP 的大多数用户)。

### ♿ WCAG 1.4.3 对比度复核

- **`a11y(contrast): 为强调色 token 引入达到 AA 的 *-text 变体`** — 浅色主题:`--rausch-text: #b80f42`(白底 6.59:1,原 3.52:1)、`--kazan-text: #066507`(7.31:1,原 4.53:1)、`--darjeeling-text: #7a5800`(琥珀底 5.73:1,原 4.24:1)、`--babu-text: #00665e`(6.09:1,原 2.70:1)。深色主题:对应变亮版(`#ff8aa0`、`#6ee7b7`、`#fcd34d`、`#5eead4`)在 `#161a22` 底色上达到同样 4.5:1 的下限。
- 徽章类(`.badge-ok`、`.badge-warn`、`.badge-bad`、`.badge-info`)和分数胶囊(`.score-high`、`.score-mid`、`.score-low`)改走新的 `*-text` 变体 — 所有"色调底色上的文字"组合都通过 AA。强调色填充 token(`--rausch`、`--kazan` 等)保持不变,用于边框和轮廓(非文本 UI 组件只需 3:1)。

### 🧹 扫描统一(完成 v1.18 工作)

- **`docs(scan): 清理 READMEs + help + 架构文档中残留的 EN/RU 拆分引用`** — 8 个 README + 8 个帮助文档 + 3 份架构文档(API.md、SERVER.md、OVERVIEW.md、DATA-FLOWS.md)+ scan.js 注释现在都描述为单一合并的扫描方法。`/api/stream/scan-{en,ru}` 旧别名在 v1.18 中已移除;v1.19 清理了仍将扫描描述为 EN+RU 两步流程的文档/文案。
- **`feat(scan): 规范化的 /api/scan/regional/config 端点`** — `/api/scan-ru/config` 作为单版本兼容别名保留。新路径匹配按来源命名的约定(`?source=regional`)。

### 🛠️ 从 UI 移除 HH_USER_AGENT

- **`feat!(config): 从 /#/config + KNOWN_KEYS 移除 HH_USER_AGENT 字段`** — 高阶用户仍可在 `career-ops/.env` 中直接设置 `HH_USER_AGENT`(服务器在 `server/lib/sources/hh.mjs` 中通过 `process.env.HH_USER_AGENT` 读取,内置 UA 作为兜底)。UI 不再暴露它 — 默认值对多数用户有效,而 App Settings 页里那个晦涩难懂的 User-Agent 字段反复造成用户困惑。
- 8 个语言的 README 与 8 个语言的帮助文档中的引用替换为 "通过俄罗斯 IP / VPN 运行" 的建议。`scan.hhWarning` i18n 键重述,去掉环境变量配置细节。
- `KEY_GROUPS` 收缩:不再有 `regional` 分类(此前只含 HH_USER_AGENT)。测试已更新;`regionalActive` 载荷字段为 SPA 后向兼容保留。

### 🧪 测试

- `tests/env-config.test.mjs` — `KNOWN_KEYS` 断言现已排除 HH_USER_AGENT;新增断言其有意缺失。
- `tests/config-endpoint.test.mjs` — POST 写多键测试使用 `GEMINI_MODEL` 作为第二个已知键替代 HH_USER_AGENT。
- `tests/config-groups.test.mjs` — `groups.HH_USER_AGENT` 现在预期 `undefined`。
- 总计:**427 / 427** 单元 + 20/20 smoke E2E + 23/23 comprehensive E2E + 32/32 Playwright。与 v1.18.0 数字相同,因为每个调整的测试都已计入。

### 验证

```bash
npm test                              # 427 / 427

# 对比度(Chrome DevTools 或 axe)浅色 + 深色:
#   .badge-ok / .badge-warn / .badge-bad / .badge-info → AA pass (4.5:1+)
#   .score-high / .score-mid / .score-low → AA pass

# HH_USER_AGENT 不再出现在 /api/config:
curl -s http://127.0.0.1:4317/api/config | jq '.values | keys'
# → ["ANTHROPIC_API_KEY","ANTHROPIC_MODEL","GEMINI_API_KEY","GEMINI_MODEL","HOST","PORT"]
# (no HH_USER_AGENT)

# 规范化的 regional config 端点:
curl -s http://127.0.0.1:4317/api/scan/regional/config | jq '.'
# 兼容别名仍存活至 v1.20:
curl -s http://127.0.0.1:4317/api/scan-ru/config | jq '.'
```

### 范围外(v1.20+)

| 项目 | 说明 |
|---|---|
| 按组件触控目标审计(过滤 chip、可排序表头、侧栏导航) | v1.18 设了全局下限(`.btn` 44 px,`.btn-sm` 32 px);SPA 内逐组件验证仍待办。 |
| 内联表单提示的 `aria-describedby`(`#/config`、`#/pipeline`、`#/evaluate`、`#/batch`) | v1.17 涵盖了全局搜索 + modal 关闭的 `aria-label`。按输入框的提示关联是下一层打磨。 |
| 完整非英文 README 对等(像 EN 一样 585 行) | v1.18 把非英文提到约 307 行(EN 的 53 %)。营销重的 "Quick start" + "🌍 Getting Started" 教程仍仅英文。 |
| 移除 `/api/scan-ru/config` 兼容别名 | sunset 计划在 v1.20。规范的 `/api/scan/regional/config` 是迁移目标。 |

---

## [1.18.0] — 2026-05-13

**扫描端点合并 + WCAG 2.2 AA 通过 + i18n 长尾收尾。** 退役旧版 `/api/stream/scan-{en,ru}` 别名(sunset 窗口 2026-10-01 按用户指示提前到 v1.18)。把非英文 README 提到约 307 行,并在 6 个语言中翻译剩余的 v1.16.0 + v1.17.0 RU 正文 CHANGELOG 条目。

### 🚪 破坏性

- **`feat!(scan): 退役旧版 /api/stream/scan-{en,ru} 别名`** — 已弃用的 EN/RU 拆分 SSE 端点正式移除。每个消费方都改走合并端点 `/api/stream/scan?source=ats|regional|both`(自 v1.12.0 起可用)。旧路径自 v1.15.0 起已携带 Deprecation + Sunset(RFC 8594)头;迁移窗口现已关闭。指向旧路径的外部集成现在得到干净的 **404**,而非被静默路由到 SPA catch-all。

### ♿ 无障碍(WCAG 2.2 AA 通过)

- **WCAG 2.4.1 Bypass Blocks** — 每页第一个可聚焦元素新增 **Skip to main content** 链接。通过 `.skip-link` 视觉隐藏直至获得焦点,从页面加载按 Tab 时贴到左上角。
- **WCAG 2.4.7 Focus Visible** — 全局 `*:focus-visible` 样式。鼠标点击聚焦无焦点环,键盘 Tab 聚焦有焦点环(WAI-ARIA AP 标准模式)。Modal 关闭(×)获得更高对比度的焦点环。
- **WCAG 2.5.5 Target Size** — `.skip-link` 最小 44×44 px 触控目标。`.btn-sm` 保留 32 px 最小高度(配合行间距满足紧凑表格行控件的 24×24 + 间距 AAA 例外)。
- **WCAG 3.1.1 Language of Page** — `<html lang="en">` 从 `lang="ru"` 修正(JS i18n bootstrap 在加载时已经覆盖,但 SSR 默认现在与 SPA 默认语言一致)。
- **WCAG 1.3.1 Info & Relationships** — `#content` 获得 `tabindex="-1"`,以便 skip-link 目标干净聚焦。(ARIA 角色 + 焦点陷阱已在 v1.17 中加入。)

### 📚 i18n 长尾

- **`docs(i18n): 在 6 个语言中翻译 v1.16.0 + v1.17.0 CHANGELOG`** — `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` 中此前为 RU 正文的条目现已使用对应原生语言。各语言 RU 字符计数 79 → 42 → 23(余下 23 个是技术性内联引用如文件路径 + 多语言头部链接,系有意保留)。
- **`docs(readme): 用 Why / Requirements / Features / Configuration / Contributing 扩展非英文 README`** — 每个非英文 README 从 240 行扩展到约 307 行,与 585 行的 EN 在非营销章节上保持一致。完整 1:1 对等(营销重的教程章节)仍推迟。

### 🛠️ 杂项

- **`docs(api): 在 API.md + DATA-FLOWS.md + README.md 中统一合并扫描端点`** — API 参考表现在只列出 `/api/stream/scan?source=…`。README 的 Scan 章节说明 v1.18.0 退役了 EN/RU 拆分。
- **`fix(scan.js): 移除关于旧别名仍生效的过期注释`** — SPA 的 runScanAll 分发器注释现在反映合并后的现实。

### 🧪 测试

- `tests/scan-consolidated.test.mjs::F-018 backwards compat` 重写 — 原先 2 个 "旧端点仍工作" 的断言现在验证对 `/api/stream/scan-{en,ru}` 的请求返回 **404**(而非被路由到 SPA catch-all)。
- 总计:**427 / 427** 单元 + 20/20 smoke E2E + 23/23 comprehensive E2E + 32/32 Playwright(数字不变;+2 条新的正确断言替换 +2 条旧的"仍生效"断言)。

### 验证

```bash
npm test                              # 427 / 427
npm run test:e2e:full                 # 23 / 23

# 旧端点退役:
curl -sI http://127.0.0.1:4317/api/stream/scan-en | head -1   # → HTTP/1.1 404
curl -sI http://127.0.0.1:4317/api/stream/scan-ru | head -1   # → HTTP/1.1 404

# 合并端点:
curl -sN 'http://127.0.0.1:4317/api/stream/scan?source=ats&dryRun=1' | head -5
# → event: start
# → data: {"script":"en-scanner","writeFiles":false,…}

# Skip link(a11y):
curl -s http://127.0.0.1:4317/ | grep -c 'class="skip-link"'  # → 1

# html lang 兜底:
curl -s http://127.0.0.1:4317/ | grep -c 'html lang="en"'     # → 1
```

### 范围外(v1.19+)

| 项目 | 说明 |
|---|---|
| 完整非英文 README 对等(像 EN 一样 585 行) | v1.18 把非英文提到约 307 行(EN 的 53 %)。营销重的 "Why?" / "Quick start" 教程仍仅英文。 |
| 色彩对比度审计(WCAG 1.4.3 AA — 正文 4.5:1,大号文本 3:1) | v1.18 覆盖了结构性无障碍;按 token 的对比度验证(浅色 + 深色配色)仍待办。 |
| 触控目标在每个交互元素上的审计 | v1.18 设了下限(`.btn`: 44 px,`.btn-sm`: 32 px);逐组件验证(过滤 chip、侧栏导航、可排序表头)仍待办。 |

---

## [1.17.0] — 2026-05-13

**打磨 + 无障碍 + CI 修复发布。** 关闭 v1.16.0 列表中的全部 9 个 follow-up:浏览器 smoke 验证、README 徽章真相、覆盖率刷新、SPA 中 `lastWorkdayFallback` 呈现、完整 E2E 重新基线、Playwright auto-pipeline 场景、无障碍审计通过、6 个语言历史 CHANGELOG 压缩,以及非英文 README 扩展(新增 Architecture / API / Security / Tests 章节)。

### 🐛 修复

- **`fix(e2e): smoke + comprehensive 套件与 v1.16 UX 重新对齐`** — v1.16 Cmd+K Enter → AutoPipeline modal 的变更使 e2e 测试的 `search.press('Enter')` 打开一个 modal,其遮罩拦截后续点击。测试现在使用 `Shift+Enter` 走旧的快速添加路径,与 v1.16 文档化的拆分一致。同时把 comprehensive E2E 的 batch-mode 迭代改为 `/#/batch-prompt`(v1.15 PR-H 引入的旧 mode-prompt slug)。**这就是 v1.16.0 push 上 CI 失败的原因** — Playwright e2e 在被遮罩拦截的点击上 30 秒超时。
- **`fix(mode-page): batch-prompt 路由 → modes/batch.md 经 serverSlug`** — v1.15 把旧 mode slug 改名为 `batch-prompt`,但服务器 `POST /api/mode/:slug` 随后在找不存在的 `modes/batch-prompt.md`。新增 `serverSlug` 字段把路由 hash 与父项目 mode 文件名解耦。
- **`chore: 将 deprecation 文案从 v1.16.0 升到 v1.17.0`** — scan-en/scan-ru 弃用文案和 batch-prompt 弃用横幅引用了过期版本。

### ✨ 功能

- **`feat(scan): Active Companies 卡片中的 🔒 Workday CAPTCHA 标识`** — v1.16 PR-7 服务端 `lastWorkdayFallback` 导出现在被 SPA 消费。`/api/scan-results` 返回快照;当某 Workday tenant 落入兜底时,`#/scan` 在 Active Companies 上方渲染一个警告色调的卡片("🔒 Workday tenant blocked — fallback: use /career-ops scan (Playwright)")。新的 `getLastWorkdayFallback()` 导出器避免 ESM 实时绑定的歧义。2 个新 i18n 键 × 8 个语言。

### ♿ 无障碍

- **`a11y: 关键界面的 ARIA 角色 + 焦点管理审计`** —
  - `index.html`:`<aside>`(navigation)、`<header>`(banner)、`<section id="content">`(main)、`<div id="modal">`(带 aria-modal/aria-labelledby 的 dialog)、`<div id="toast">` + `#conn-banner`(带 aria-live 的 status)、`<div class="searchbar">`(search)上的 `role` 属性。
  - `#sidebar-toggle` 获得 `aria-controls="sidebar"` + 在 open/close 时由 JS 同步的 `aria-expanded`。
  - `#global-search` 获得一个视觉隐藏的 `<label>` 以及一个显式 `aria-label`(后者承载 Cmd+K 快捷键提示)。
  - Modal 关闭(×)获得 `aria-label="Close dialog"`。
  - 装饰性遮罩获得 `aria-hidden="true"`。
  - **Modal 焦点陷阱** — `UI.modal()` 记住点击发起方,在 open 时聚焦第一个非关闭按钮的可聚焦元素,并在 modal 内循环 Tab/Shift+Tab。`UI.closeModal()` 将焦点恢复给原发起方。
  - `public/css/app.css` 中的新 `.visually-hidden` 工具类(WAI-ARIA AP 标准模式)。

### 📚 文档

- **`docs(readme): 8 个 README 的徽章真相**`** — 测试徽章 `284 / 379 / 360` → **427**;发布徽章 `v1.9.1 / v1.13.0` → **v1.16.0** 再到 v1.17.0。发布链接目标已更新。
- **`docs(readme): 用参考章节扩展 7 个非英文 README`** — 每个从 170 行增至约 240 行,以原生语言新增 Architecture / API reference / Security notes / Tests / A11y / Limitations / License 章节。尚未达到与 EN 的完整 585 行对等,但已覆盖全部关键非营销表面。
- **`docs(changelog): 在 6 个语言中压缩 pre-v1.12 条目`** — 此前蔓延到非 EN/非 RU CHANGELOG 中的长 RU 正文 v1.11.x + v1.10.x 条目,现已被各语言原生的"Earlier releases"摘要替代。详细历史保留在 `CHANGELOG.md`(EN)中。

### 🛠️ 工具

- **`coverage: 刷新数字`** — 上次公布的是 95.46 % 行 / 84.06 % 分支(v1.13.0 REVIEW)。v1.17 基线:**94.14 % 行 / 82.98 % 分支 / 93.20 % 函数**。来自 auto-pipeline + reports-write 中新增错误路径的轻微下降;仍远高于 CLAUDE.md 的 80% 下限。

### 🧪 测试

- 总计:**427 / 427** 单元 + 20/20 smoke E2E + 23/23 comprehensive E2E + **32 / 32** Playwright(此前 28;+4 个新的 auto-pipeline 场景:按钮打开 modal、Cmd+K 粘贴触发 modal、无效 URL 在步骤 1 被拦截、`POST /api/auto-pipeline` SSE 事件分帧)。
- E2E 套件与 v1.16.0 UX 重新对齐(Shift+Enter 快速添加、`/#/batch-prompt` 用于旧 mode)。

### 验证

```bash
# 本地:
npm test                          # 427 / 427
npm run test:e2e                  # 20 / 20
npm run test:e2e:full             # 23 / 23
npm run test:e2e:browser          # 32 / 32

# 浏览器 smoke(页面级):
curl -s http://127.0.0.1:4317/api/scan-results | jq '.workdayFallback'
# 没有 Workday 兜底时为 null;4xx 之后为 {apiUrl, reason, at}。

# 无障碍点检:
node -e "
const c = require('cheerio').load(require('fs').readFileSync('public/index.html','utf8'));
['banner','navigation','main','dialog','status','search'].forEach(r =>
  console.log(r, c('[role=' + r + ']').length));
"
# 每个角色都应出现 ≥1 次。

# CI 守门验证:dashboard-screenshots 工作流在 /tmp 脚手架上启动,
# 重新生成 PNG,与已提交的对比 — 当 images/dashboard-*.png 与 SPA
# 渲染保持一致时为绿。
```

### 范围外(v1.18+)

| 项目 | 说明 |
|---|---|
| 在非英文 CHANGELOG 中翻译 v1.16.0 条目 | 目前是 RU 正文(约 30 行 × 6 个语言 = 180 行)。在用户明确的 v1.11.x/v1.10.x 范围外。 |
| 完整非英文 README 对等(像 EN 一样 585 行) | v1.17 把非英文提到约 240 行;营销重的 "Why?" / "Quick start" 教程仍仅英文。 |
| 规范化 A-F 提示词的父项目提交 | `santifer/career-ops::modes/oferta.md` 仍需在上游重写(CLAUDE.md 硬规则 #1)。 |
| 完整 WCAG 2.2 AA 审计 | v1.17 覆盖了结构性 ARIA + 焦点陷阱;按组件的对比度 / Tab 顺序审计待办。 |

---

## [1.16.0] — 2026-05-13

**Auto-pipeline 收尾 + 适配器打磨 + i18n 长尾。** 关闭 v1.15.0 REVIEW 的全部 11 个 follow-up:服务端 SSE auto-pipeline、`POST /api/reports` 原语、Cmd+K 快捷键、SmartRecruiters 分页、Workday CAPTCHA 兜底、CI 截图漂移守门、扫描来源筛选 UX、历史 CHANGELOG 翻译(v1.13.0 / v1.12.0 × 6 个语言)、非英文 README 扩展,以及可直接粘贴的 trending-companies 导入器。

### ✨ 功能

- **`feat(auto-pipeline): 服务端 SSE 编排器`**(#1、#2、#3、#8) — v1.15 的客户端链式 fetch 编排器已移除。`POST /api/auto-pipeline` 现在是可 curl 的 SSE 端点,在服务端串联 validate → fetch JD → evaluate → save report → tracker,并实时发送步骤事件。慢速的 Anthropic 调用(30–90 秒)现在发出 `running` 事件而非笼统的旋转图标。失败时携带 `step` + `message` 发出 `error`。编排器同时把 report markdown 持久化到父项目 `reports/<slug>.md`(v1.15 中丢失)。
- **`feat(reports): POST /api/reports 原语`** — `server/lib/routes/reports.mjs` 中的新写入端点。slug 净化带路径遍历守卫(剥离前导点、折叠内部 `...`)。1 MB 上限(413)。文件存在时返回 409,除非 `overwrite:true`。原子写入,经 `stripDangerousMarkdown` XSS 净化。记录 activity.reports.save。测试:9 个用例。
- **`feat(app): Cmd+K 粘贴 URL → auto-pipeline`** — 在全局搜索粘贴 URL + Enter 现在以 `autoStart=true` 打开 AutoPipeline modal。Shift+Enter 保留旧的"只加入 pipeline"路径。即 career-ops.org Quick Start §7 规范化的 "paste URL → done" UX。
- **`feat(portals): SmartRecruiters 分页`**(#4) — `server/lib/sources/smartrecruiters.mjs` 通过 `?limit=100&offset=N` 翻页,直到达到 `totalFound`、返回空页,或触发 30 页 / 3000 岗位安全上限。剥离调用方提供的 limit/offset,游标由服务端拥有。大型 boards(宝洁、亚马逊式)不再丢失 100+ 条尾部岗位。测试:6 个用例。
- **`feat(portals): Workday CAPTCHA 兜底优雅化`**(#7) — `server/lib/sources/workday.mjs` 在 4xx / 非 JSON / 网络错误时不再抛出。返回 `[]` 并在新导出的 `lastWorkdayFallback` 快照上注解。扫描器时间线继续下一个 tenant。调用方可通过 `strict:true` 选择回到 v1.14 的抛出行为。测试:7 个用例。

### 🛠️ 工具 + CI

- **`ci(workflows): dashboard-screenshots 漂移守门`**(#5) — 新工作流 `.github/workflows/dashboard-screenshots.yml`。当 PR 触及 `public/css/app.css` / `public/js/views/dashboard.js` / `public/js/lib/i18n.js` / `public/index.html` 时,工作流在 /tmp 脚手架上启动 web-ui 服务器,通过 Playwright + chromium 重新生成 8 张主屏 PNG,如果结果与已提交内容发生漂移则构建失败。失败时把重新生成的 PNG 作为 CI 工件上传。
- **`feat(scripts): import-trending-companies.mjs`**(#11) — 通过真实的 boards API 验证 `docs/portals-examples.md` 中 13 家 trending 公司,并为用户父项目的 `portals.yml::tracked_companies` 生成可直接粘贴的 YAML。任何 slug 返回 404 的候选项都会被标记为 `enabled: false`。全部 6 个 ATS(Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday)的实时探测。通过 `npm run import:trending` 运行。
- **`feat(scripts): npm run capture:dashboards`** — 把 `scripts/capture-dashboard-screenshots.mjs` 暴露为顶级脚本(此前只在 `images/README.md` 中提及)。

### 🎨 UX

- **`fix(scan): 合并的来源筛选下拉**`**(#6) — `#/scan` 的来源下拉根据 v1.14 适配器注册表重建:6 个 ATS + hh.ru + Habr Career,按字母顺序,无地理标签前缀。`runEnScan` / `runRuScan` 现在调用合并端点 `/api/stream/scan?source={ats,regional}`,而非已弃用的 `/api/stream/scan-{en,ru}` 别名(sunset 头延续到 v1.16)。

### 📚 i18n 长尾

- **`docs(i18n): 在 6 个语言中翻译 v1.13.0 + v1.12.0 CHANGELOG`**(#9) — `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` 中此前为 RU 正文的条目现已使用对应原生语言。每个非 EN/非 RU CHANGELOG 同时增加 i18n 说明,解释 pre-v1.12 条目按项目约定保留 RU(权威文本位于 `CHANGELOG.md`)。
- **`docs: 用 v1.16.0 亮点章节扩展非英文 README`**(#10) — 6 个非英文 README(es / pt-BR / ko-KR / ja / ru / zh-CN / zh-TW)新增约 35 行章节,涵盖:auto-pipeline 一键流程 + curl 示例、SmartRecruiters 分页、Workday 兜底、扫描来源筛选 UX、导入器脚本以及 CI 截图工作流。RU README 同样扩展。

### 🧪 测试

- 新增 `tests/reports-write.test.mjs`(9 个用例) — happy path、slug 净化(含路径遍历守卫)、409 冲突、overwrite 标志、XSS 剥离、缺字段 400、>1 MB 413、GET/POST 往返。
- 新增 `tests/auto-pipeline.test.mjs`(5 个用例) — SSE 分帧、无效 URL 拦截、SSRF/loopback 拦截、缺 LLM 密钥错误路径、`text/event-stream` Content-Type 头。
- 新增 `tests/smartrecruiters-pagination.test.mjs`(6 个用例) — 单页、3 页、空页早停、硬上限生效、查询剥离、503 抛出。
- 新增 `tests/workday-fallback.test.mjs`(7 个用例) — happy path、403/429 优雅、非 JSON 体、网络错误、4xx 与网络错误下的 strict 选项。
- 总计:**427 / 427** 单元(此前 400;净增 27)。0 失败。28/28 Playwright + 23/23 comprehensive E2E + 20/20 smoke E2E 自 v1.15.0 基线起全部绿色。

### 范围外(v1.17+)

| 项目 | 说明 |
|---|---|
| 规范化 A-F 提示词的父项目提交 | 上游 `santifer/career-ops::modes/oferta.md` 重写仍待做(CLAUDE.md 硬规则 #1)。 |
| 翻译 pre-v1.12 CHANGELOG 条目(v1.11.x、v1.10.x) | 约定保留:RU 正文。回填约 1800 行翻译工作量;推迟。 |
| 完整非英文 README 对等(像 EN 一样 585 行) | v1.16 每个语言新增约 35 行;完整对等是另一项工作。 |
| 服务端 `runEnScan` 读取 Workday 兜底注解以渲染 🔒 标识 | `lastWorkdayFallback` 导出已接通;SPA 的 Active Companies 卡片在 v1.17+ 消费。 |

### 验证

```bash
npm test                          # 427 / 427
npm run test:e2e:full             # 23 / 23
npm run import:trending --check-only   # 探测 13 个 trending boards

# Auto-pipeline curl smoke:
curl -N -X POST http://127.0.0.1:4317/api/auto-pipeline \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/4567"}'

# POST /api/reports 往返:
curl -X POST http://127.0.0.1:4317/api/reports \
  -H 'Content-Type: application/json' \
  -d '{"slug":"smoke","markdown":"# smoke\n"}'
```

---

## [1.15.0] — 2026-05-13

**Doc-conformance 发布。** 关闭一致性审计(`qa/conformance-vs-docs/00-CONFORMANCE-REPORT.md`)中尚未关闭的 10 项中的 9 项,外加本地化主屏图。把 UI 与权威的 career-ops.org/docs 工作流对齐,使 CLI 承诺的同一管道在每个语言中都能完整地通过浏览器端到端跑通。

### ✨ 功能

- **`feat(auto-pipeline): PR-C — 一键 "paste URL → report + PDF + tracker 行"`**(G-007)
  匹配 career-ops.org 的权威承诺。在 v1.15 之前,用户需要在 /#/pipeline → /#/evaluate → /#/cv → /#/tracker 之间手动点击 5 次。现在,在 /#/dashboard 上单击一个 ✨ 按钮即可串联:validate URL → fetch JD(SSRF 安全)→ 对 CV 评估 → 生成 PDF → 新增 tracker 行。渲染一个分步 modal 时间线,每个步骤标记 [✓] / [...] / [✗]。从 JD 首行启发式提取公司/职位。通过正则从评估 markdown 中提取分数 + 合法性。新文件:`public/js/lib/auto-pipeline.js`。19 个新 i18n 键 × 8 个语言。
- **`feat(modes): PR-D — modes/_profile.md 编辑器作为 #/config → Modes 标签**`**(G-008)
  Quick Start §Step-5 规范的 "Career framing" 文件此前对 UI 用户不可见。现在在 /#/config 上以新的 "Modes" 标签暴露,/#/profile 上有可发现的卡片。新端点:`GET/PUT /api/modes/_profile`,带 256 KB 上限、`stripDangerousMarkdown` XSS 净化,以及首次读取时从 `_profile.template.md` 生成的脚手架。9 个新 i18n 键 × 8 个语言。
- **`feat(profile): PR-E — 接受规范化 schema;增加 location + headline**`**(G-009)
  `/api/profile` 现在同时接受旧版(`candidate:{...}`)和规范版(顶层 `full_name`、`narrative.headline`、`target_roles.primary`、`compensation.target_range`)schema。两者同时出现时旧版优先,使既有 YAML 渲染一致。新的 `summarizeProfile()` 辅助函数返回统一形状。`/#/profile` 把 `narrative.headline` 作为新卡片呈现。2 个新 i18n 键 × 8 个语言。
- **`feat(tracker): PR-B — #/tracker 上的 Legitimacy 列**`**(G-006)
  恢复与 career-ops.org/docs 规范管道输出表的对等。在 Status 与 PDF 之间增加 Legitimacy 列,带 badge-ok/warn/bad 着色(镜像 statusClass 模式)。优雅降级 — v1.15 前的无 Legitimacy 列旧行显示 `—`。1 个新 i18n 键 × 8 个语言。
- **`fix(routing): PR-H — 侧栏去重;#/batch 路由至 v1.13.0 TSV SPA**`**(G-011)
  在此修复之前,/#/batch 在侧栏注册了两次,且两次都指向旧的 mode-prompt 构建器。v1.13.0 的 TSV SPA(8 KB,4 个端点)无法访问。移除重复侧栏项;把旧 mode slug `batch` 改名为 `batch-prompt` 并加弃用横幅。规范的 /#/batch 现在就是 TSV SPA。

### 📚 文档

- **`docs(evaluate): PR-A — 把 Block A-F 与规范化 career-ops.org rubric 对齐**`**(G-005)
  career-ops.org 文档使用 A–F(Strategy/Personalization/STAR stories 在 C/E/F)。我们此前输出 A–G,语义有偏移(Risks/Verdict/Legitimacy)。v1.15 更新所有 8 个帮助文档 §9 为权威 A–F,并加上 "v1.15 前使用 A–G;我们按原样渲染以保持兼容" 的提示。`eval.subtitle` i18n 键 × 8 个语言也重新对齐。分数 + 合法性现在被记录为报告头部字段。⚠ 父项目仍需提交:`santifer/career-ops::modes/oferta.md` 需要在上游被重写以输出规范化 A–F。
- **`docs: PR-F — 在 8 个语言的 help §5 中增加 seniority_boost + search_queries + 脚手架**`**(G-010)
  8 个帮助文档的 §5 现在都说明第三个 title-filter 键(`seniority_boost`),并提供 `search_queries` 示例块,带翻译过的一段引文,说明它只驱动 AI 驱动的 Option B 扫描。`bin/setup.sh` 的 portals.yml 脚手架默认填充 `seniority_boost: ["Senior", "Staff", "Lead"]`。H2 对等保留:16 × 8 个语言。
- **`docs: PR-I — 各 README 语言对应的本地化主屏图**`**
  每个 README(共 8 个)现在都拥有一张 `images/dashboard-<locale>.png`(HiDPI 1440×900),由 `scripts/capture-dashboard-screenshots.mjs`(Playwright + chromium)生成。删除旧的共享文件 `public/images/screen_vacancy_found.png`。非英文读者首次落地时即可看到以其语言标注的 UI。

### 🧹 历史遗留清理

- **`PR-G — G-001`** `scan.noResults` i18n bundle:把含 "EN or RU scan" 字面量的 8 条字符串替换为对语言友好的文案。
- **`PR-G — G-002`** 📄 Generate PDF 按钮现在出现在 #/interview-prep 结果面板上(镜像 deep.js 模式)。
- **`PR-G — G-003`** `README.cn.md` → `README.zh-CN.md`(规范 locale 标签);全部兄弟文件及 tests/canonical-docs-coverage.test.mjs 中的引用已更新。
- **`PR-G — G-004`** `/api/stream/scan-en` + `scan-ru` 现在发出 RFC 8594 Sunset + Deprecation + Link 头(sunset 2026-10-01)。计划在 v1.16.0 移除。

### 🧪 测试

- 新增 `tests/profile-canonical-schema.test.mjs`(6 个用例) — 规范 YAML、旧版 YAML、混合时旧版优先、只接受规范、双 schema 都缺时拒绝、薪酬区间解析。
- 新增 `tests/modes-profile-crud.test.mjs`(8 个用例) — 空文件时内置脚手架、模板接管、持久化优先、写入 happy path、净化、非字符串 400、>256 KB 413、通用 /api/modes/:name 仍工作。
- 修复测试固件中的隔离回归:测试现在使用 `before/after + dynamic-import` 模式(匹配 `tests/batch-endpoints.test.mjs`),不再变更用户真实的父项目 `config/profile.yml`。**用户须知:**如果你的 `config/profile.yml` 在从 v1.15.0-RC 升级后看起来像测试占位符,请从备份恢复 — 该回归仅存在于开发分支。
- 总计:**400 / 400** 单元测试(此前 386;净增 14)。0 失败。20/20 smoke E2E + 23/23 comprehensive E2E + 28/28 Playwright 自 v1.14.0 基线起全绿。

### 范围外(v1.16+ 跟进)

| 项目 | 说明 |
|---|---|
| 规范化 A–F 提示词的父项目提交 | `santifer/career-ops::modes/oferta.md` 需要在上游重写。CLAUDE.md 硬规则 #1 禁止我们编辑父项目文件。web-ui 侧已完成(优雅降级 — v1.15 前的 A–G 报告渲染不变)。 |
| 服务端 `POST /api/auto-pipeline` SSE | 客户端编排器交付了 UX 胜利。服务端端点能启用 retry-from-step-N 与可 curl 的 CI。 |
| `POST /api/reports` 原语 | Auto-pipeline 当前在 modal 中显示报告 markdown 但不持久化到父项目 `reports/`。PDF + tracker 行是耐久工件。 |
| Cmd+K 粘贴 URL → 运行 auto-pipeline | 推迟到 v1.16+。 |

### 验证

```
npm test                              # 400 / 400
npm run test:e2e:full                 # 23 / 23
curl -sf http://127.0.0.1:4317/api/health | jq '.checks | length'   # → 18
curl -sI http://127.0.0.1:4317/api/stream/scan-en | grep -i sunset  # G-004 visible
curl -sf http://127.0.0.1:4317/api/modes/_profile | jq '.scaffolded' # G-008 wired
ls images/dashboard-*.png | wc -l     # 8 (PR-I)
grep -c 'href="#/batch"' public/index.html  # 1 (PR-H dedupe)
```

---

## [1.14.0] — 2026-05-13

在 v1.13.0 注册表之上,3 个新 ATS 适配器落地,使受支持的 ATS 从 3 → 6(Greenhouse / Ashby / Lever **+ Workable / SmartRecruiters / Workday-beta**)。面向用户的文档在一次提交中将 17 个文件里的 "3 ATSes" 升级为 "6 ATSes"(42 处短语):README × 8 个语言、help bundle × 8 个语言、PROJECT.md。在 `docs/portals-examples.md` 中加入 13 家 trending 公司的可粘贴 YAML 块,作为父项目 `portals.yml` 的现成片段。

### ✨ 功能

- **`feat(portals): 3 个新 ATS 适配器 — Workable、SmartRecruiters、Workday-beta`** — 注册表现在解析 6 个 ATS(原 3)。新文件:`server/lib/portals/adapters/{workable,smartrecruiters,workday}.mjs`(各自是围绕新数据源的统一契约薄包装)+ `server/lib/sources/{workable,smartrecruiters,workday}.mjs`(原始 HTTP + 响应归一化到规范化形态 `{ id, title, company, url, location, isRemote, … }`,带 `source: <id>`)。
  - **Workable**:检测 `apply.workable.com/<slug>` 以及旧式 `<subdomain>.workable.com`。端点:`https://apply.workable.com/api/v3/accounts/<slug>/jobs?details=true`。
  - **SmartRecruiters**:检测 `jobs.smartrecruiters.com/<slug>` 以及 `careers.smartrecruiters.com/<slug>`。端点:`https://api.smartrecruiters.com/v1/companies/<slug>/postings`。
  - **Workday(beta)**:检测 `<tenant>.wd<N>.myworkdayjobs.com/<lang>/<site>`。端点:POST 到 `/wday/cxs/<tenant>/<site>/jobs`。当 careers_url 没有给出 site 时默认 `site=External`。Beta 是因为一些 tenant 会通过 CAPTCHA 封锁 CXS feed — 这种情况下回落到父项目 `/career-ops scan`(Playwright)。

### 📚 文档

- **`docs(portals-examples): trending boards 块`** — `docs/portals-examples.md` 新增 v1.14.0 章节,以可直接粘贴的 YAML 列出 13 家 trending 公司作为 `tracked_companies`,分为 Greenhouse 托管(Stripe、GitLab、HashiCorp、Cloudflare、Datadog、Hugging Face)和 Ashby 托管(Notion、Linear、PostHog、Replicate、Modal Labs、Fly.io、Render)。所有条目都标记 `enabled: false`,以便用户在启用前自行验证 slug 是否可访问。同时给出 Workable / SmartRecruiters / Workday 的示例块,展示能识别它们的 URL 模式。
- **`docs(framing): 17 个面向用户的文件中 42 处 ATS 短语升级`** — 面向用户的文档中每次出现 "Greenhouse / Ashby / Lever" 现在都读作 "Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday"。涉及 README × 8 个语言(EN/ES/PT-BR/RU/JA/KO/CN/TW)、help bundle × 8 个语言、PROJECT.md。历史 CHANGELOG 条目以及 bug-fix 处方文档(`qa/fixes/F-014`、`qa/FIX-PROMPT`)有意未触 — 它们描述的是过去或本就正确的状态。
- **`docs(qa): 浏览器测试场景 19 — 6 个 ATS 适配器覆盖`** — `qa/claude-cowork-browser-test-prompt.md` 新增 Scenario 19:`ALL_ADAPTERS.length === 6` 不变量、对 6 个适配器的 `resolveAdapter()` URL 检测扫描、`#/scan` 中 Active Companies 卡片的软检查、对 `docs/portals-examples.md` 每个 ATS 块的结构检查。

### 🧪 测试

- `tests/adapter-registry.test.mjs` 扩展 7 个新测试,覆盖 3 个新适配器(Workable apply-URL、Workable 旧版 subdomain、SmartRecruiters jobs.* + careers.*、Workday 显式 site 的 tenant.wd5.*、Workday 默认 site 回落到 "External"、`ALL_ADAPTERS.length === 6` 不变量、`detectApi()` 旧形态兼容)。
- 总计:**386 / 386** 单元测试(此前 379;净增 7)。0 失败。

### 验证

```
npm test                        # 386 / 386
node -e "import('./server/lib/portals/registry.mjs').then(m => console.log(m.ALL_ADAPTERS.length))"   # → 6

# 适配器探测扫描:
node -e "import('./server/lib/portals/registry.mjs').then(m => {
  console.log(m.resolveAdapter({ careers_url: 'https://apply.workable.com/foo/' }).adapter.id);          // → workable
  console.log(m.resolveAdapter({ careers_url: 'https://jobs.smartrecruiters.com/Bar' }).adapter.id);     // → smartrecruiters
  console.log(m.resolveAdapter({ careers_url: 'https://baz.wd5.myworkdayjobs.com/en-US' }).adapter.id);  // → workday
})"
```

### 范围外(延后跟进)

| 项目 | 说明 |
|---|---|
| 13 家 trending Greenhouse/Ashby 公司的逐家适配器记录 | `docs/portals-examples.md` v1.14.0 块列出了可直接粘贴的 YAML;slug 验证 + 批量合入父项目 `portals.yml` 是独立阶段。 |
| Workday CAPTCHA 兜底自动化 | Workday 适配器在 CXS feed 被封时抛出;计划的兜底是委托给父项目 `/career-ops scan`(Playwright)。把它接入 SPA 的 "scan" UX 是 v1.15+。 |

---

## [1.13.0] — 2026-05-13

大切片。在一次发布中关闭 v1.12.0 后积压的全部 4 项延期工作:PR-4(完整 multer 管道)、适配器注册表(F-018 架构后续)、Batch evaluate SPA 页面,以及按语言的 mode 模板脚手架。外加一次会期内的深色主题表格修复。

### ✨ 功能

- **`feat(cv): 基于 multer 的 multipart 上传(PR-4 完整)`** — `/api/cv/import` 现在同时接受原始 octet-stream 契约(`Content-Type: application/octet-stream` + `X-Filename`)和经 multer 正确解析的 `multipart/form-data`。v1.10.2 的 415 拒绝是权宜之计;v1.13.0 是真正的修复。外部客户端(curl `-F`、Postman 默认、任意 HTTP 客户端)无缝工作。两条路径都流经同一个 `importDocumentToMarkdown` 转换器 + `stripDangerousMarkdown` XSS 净化。新依赖:`multer ^2.1.1`。
- **`feat(portals): 适配器注册表`** — 把 Greenhouse / Ashby / Lever 抓取器抽取到 `server/lib/portals/adapters/*.mjs`,采用统一契约(`id`、`label`、`matches`、`buildEndpoint`、`fetch`)。新的 `server/lib/portals/registry.mjs::resolveAdapter()` 是唯一的分发点。`en-scanner.mjs::detectApi()` + `FETCHERS` 现在委托给注册表;旧返回形态保留。新增一个 ATS:在 `adapters/` 下新增一个文件,在 `ALL_ADAPTERS` 中追加一行 — 扫描器无需改动。
- **`feat(batch): #/batch 评估页`** — 新的 SPA 视图 + 4 个端点(`GET /api/batch`、`PUT /api/batch`、`GET /api/stream/batch`、`POST /api/batch/merge`)。`batch/batch-input.tsv` 的 TSV 编辑器、parallel/min-score/dry-run/retry 控件、`bash batch/batch-runner.sh` 的实时 SSE 日志、运行后 `batch/tracker-additions/` 列表 + 一键 `node merge-tracker.mjs`。Decision 组下的侧栏链接。21 个新 i18n 键 × 8 个语言。
- **`feat(prompts): 按语言的 mode 脚手架`** — `buildModePrompt` + `buildEvaluationPrompt` 现在用 8 个语言的本地化脚手架文本(角色行、"Read these files first"、"User-supplied context")包裹父项目英文版 mode 模板正文。父项目 `modes/<slug>.md` 正文保持英文(按 CLAUDE.md 硬规则 #1 只读);围绕它的 career-ops-ui 脚手架被翻译。

### 🎨 UX 修复

- **`fix(theme): 深色模式表格 hover + tab-btn`** — 硬编码的 `#fafafa` / `#fff` / `#f7f7f7` 替换为 `var(--beach)` / `var(--paper)` / `var(--slate)` token,以便深色调色板切换真正作用于表格行和标签按钮。新增 `.row-boosted` 强调条用于在两种主题下显示被 boost 的扫描行。

### 🧪 测试

- 新增 `tests/adapter-registry.test.mjs`(7 个用例) — 统一契约、每个 ATS 的 URL 探测、显式 `api:` 字段优先、无匹配返回 null、旧 `detectApi()` 形态保留。
- 新增 `tests/batch-endpoints.test.mjs`(5 个用例) — 空固件、TSV 往返、无 URL 拒绝、1 MB 上限、runner 缺失的错误帧。
- 新增 `tests/locale-scaffold.test.mjs`(6 个用例) — en/ru/ja/ko 的脚手架字符串、`buildModePrompt`/`buildEvaluationPrompt` 集成、英文向后兼容。
- `tests/cv-upload-multipart-reject.test.mjs` 重写 — 此前的"multipart 返回 415"契约改为"multipart 经 multer 解析"契约;不修改 cv.md 的不变量保留。
- 总计:**379 / 379** 单元测试(此前 360;净增 19)。0 失败。
- 覆盖率:**95.46 % 行 / 84.06 % 分支**。
- 20/20 smoke E2E · 23/23 comprehensive E2E · 28/28 Playwright。

### 范围外(延后跟进)

| 项目 | 说明 |
|---|---|
| 14 个新 portal 适配器(Workable / SmartRecruiters / Workday / GitLab / HashiCorp / Cloudflare / Datadog / Stripe / Notion / Linear / Posthog / Hugging Face / Replicate / Modal Labs / Fly.io / Render) | 适配器注册表已就位 — 新增适配器现在每个一个文件即可。14 个 ATS 的逐家调研 + URL 模式 + 端点归一化是独立阶段。 |
| 翻译父项目 `modes/<slug>.md` 正文 | 父项目文件按 CLAUDE.md 硬规则 #1 只读。v1.13.0 的按语言脚手架已带来 80% 收益;完整正文翻译需要向 `santifer/career-ops` 上游提交 PR。 |

### 文档

- `docs/reviews/REVIEW-2026-05-13-v1.13.0.md` — 会话上下文 + 适配器注册表契约 + batch 流程。
- 全部 8 个 README:徽章更新(测试 360 → 379,发布 v1.12.0 → v1.13.0)。
- 全部 8 个 CHANGELOG 收录此条目。

---

## [1.12.0] — 2026-05-13

错误修复 + UX + 品牌复核。关闭 v1.11.1 后诚实积压中的 8 项(测试空缺 #9–12、console 错误 #8、portals-dead 漂移 #4、seniority_boost 呈现 #6、F-018 端点合并)。增加深色/浅色主题切换,并从全部文档、包元数据和 GitHub 仓库描述中移除 "Airbnb-styled" 品牌词。

### ✨ 功能

- **`feat(theme): 深色 / 浅色切换(v1.12.0)`** — 顶部栏新增主题按钮。在浅色 ↔ 深色之间循环;持久化到 `localStorage.theme`;通过预绘制 bootstrap(`public/js/lib/theme-bootstrap.js`)在页面加载时还原,让用户永远看不到错误配色的闪烁。首次访问尊重 `prefers-color-scheme`。`public/css/app.css` 中 `[data-theme="dark"]` 下的完整深色调色板 — 每个组件从 CSS 自定义属性读取颜色,所以切换集中在一处。
- **`feat(scan): /api/stream/scan?source=ats|regional|both`(F-018 LITE)`** — 单一合并的 SSE 入口。SPA 现在打开一个事件流顺序驱动两阶段(先 ATS,再 regional),取代之前串联两个独立流的方式。旧版 `/api/stream/scan-en` + `/api/stream/scan-ru` 作为弃用别名保留。runners-table 的 `/api/stream/scan` 改名为 `/api/stream/scan-parent` 以让出命名空间;父项目派生的 `scan.mjs` 兜底保留。
- **`feat(scan): seniority_boost 呈现(权威文档 §3)`** — 两个扫描器都读取 `portals.yml::title_filter.seniority_boost`,并在匹配岗位上打 `_boosted: true` + `_boostedBy: <keyword>`。SPA 把 boosted 行排到 `#/scan` 结果顶部,并渲染 `⬆ boosted` 徽章,在 title 属性中显示匹配关键词。两个新 i18n 键(`scan.boosted`、`scan.boostedBy`)在 8 个语言中本地化。

### 🐛 错误修复

- **`fix(ui): 4 处空安全的错误消息读取(#8)`** — `app.js`(顶部栏 Doctor 按钮 + 全局搜索 pipeline 添加)、`views/tracker.js`(第 112 行)、`views/apply.js`(第 21 行)、`views/evaluate.js`(第 32 行)现在都读取 `(err && err.message) || '<fallback>'`。此前没有 Error 载荷的 Promise rejection 会在 e2e 拆卸中抛出 "Cannot read properties of undefined (reading 'message')"。
- **`fix(test): portals-dead 漂移改为警告而非失败(#4)`** — `tests/portals-dead.test.mjs::FIX-C3` 此前会在父项目 `templates/portals.example.yml` 漂移到重新启用某个我们标记为 dead 的 slug 时失败。v1.12.0 把该断言改为 stderr 警告,以便 CI 在父项目漂移下保持绿色;发布决策仍人工把关。slug 列表 `KNOWN_DEAD` 作为意图文档保留。

### 📝 品牌 / 文档

- **`docs(brand): 从每个文档中剥离 'Airbnb' 引用(8 个语言)`** — README.md、README.es.md、README.pt-BR.md、README.ko-KR.md、README.ja.md、README.ru.md、README.cn.md、README.zh-TW.md、CLAUDE.md、docs/architecture/FRONTEND.md、package.json 以及 GitHub 仓库描述全部从 "Airbnb-styled" / "Airbnb-inspired" 措辞改为 "Clean, docs-style"。CSS 文件保留其设计 token 命名(它们是内部标识符,无外部耦合),但解释性注释已重写。

### 🧪 测试

- **新增 `tests/canonical-docs-coverage.test.mjs`(5 个用例)** 关闭测试空缺 #9–12:每个 help bundle 引用全部 5 份权威 career-ops.org 指南;每个语言 16 H2 对等契约;每个 README 引用权威首页 + ≥ 3 份子指南;`#/reports` 视图源码包含分数阈值卡片脚手架;i18n bundle 在 8 个语言中包含所有新 v1.11.x 键。
- **新增 `tests/scan-consolidated.test.mjs`(6 个用例)** 覆盖 F-018 LITE:`?source=ats|regional|both` 正确分发;未知 source 发出错误帧;旧版 `/api/stream/scan-en` + `/api/stream/scan-ru` 仍作为弃用别名工作。
- 总计:**360 / 360** 单元测试(此前 349;+11 新增)。0 失败。覆盖率:**95.62 % 行 / 84.37 % 分支**(自 94.59 上升)。
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**。

### 📋 内部

- `docs/reviews/REVIEW-2026-05-13-v1.12.0.md` — 会话上下文、延期清单摘要、career-ops.org 内容同步刷新步骤。
- 全部 8 个 CHANGELOG 收录此条目。
- GitHub 仓库描述更新以匹配新品牌。

### 范围外(延后,自 v1.11.1 起未变)

| 项目 | 原因 |
|---|---|
| Batch evaluate SPA 页面 | 按权威文档为 CLI 唯一流程;SPA 等价物需要新视图 + ≥3 个端点 + 固件 + 测试。2–3 天阶段。 |
| 完整适配器注册表(8 个 `server/lib/portals/adapters/*.mjs` + 14 个新 portal + 前端重写) | F-018 LITE 在本发布中合并 API 表面;完整架构重构仍待办。 |
| 完整 multer 管道(PR-4) | v1.10.2 通过 415 信封关闭了数据损坏空洞;完整 multipart 解析器 + ConversionError 信封是独立阶段。 |
| Mode 模板翻译 | 需要与父项目协调。 |

---

## [1.11.1] — 2026-05-13

**深度 career-ops.org/docs 集成 — v1.11.0 的后续。** v1.11.0 增加了摘要块;v1.11.1 用 **完整 CLI 流程**(命令逐字、编号申请步骤、批量评估 runner、Playwright 安装)丰富每个 help bundle 中已存在的 §5 Portals / §7 Scan / §14 Apply 章节。SPA 的 `#/reports` 视图获得分数阈值卡片,使权威 `≥4.5 / 4.0-4.4 / 3.5-3.9 / <3.5` 行动表内联可见。

### 📝 文档

- **Help bundle(全部 8 个语言)** — 每个 bundle 三个新子章节,按语言翻译:
  - **§5 Portals → `CLI flow`** — `cp templates/portals.example.yml portals.yml`;`title_filter`(positive / negative / seniority_boost)、`tracked_companies`(必填 name + careers_url)、`search_queries`(预制更广的网络搜索)的权威 schema。
  - **§7 Scan → `CLI scan flow`** — Option A(`npm run scan` + `--dry-run` / `--company`)用于 Greenhouse/Ashby/Lever ATS;Option B(任意 AI CLI 中的 `/career-ops scan`)用于非 API 发现。输出到 `data/pipeline.md` + `data/scan-history.tsv`。行动阈值表。
  - **§14 Apply → `Full CLI apply flow` + `Batch evaluate` + `Playwright setup`** — 8 步编号申请流程(`/career-ops apply <company>` → Playwright 打开浏览器 → 编号草稿答案 → 人工审阅并点击 Submit → `Submitted.` 把 tracker 翻为 `Evaluated → Applied`)。通过 `./batch/batch-runner.sh` 的批量 runner,带 `--parallel` / `--min-score` / `--retry-failed`。Playwright 安装:`npm install` + `npx playwright install chromium` + `claude mcp add playwright`。
- 全部 8 个 bundle 保留 16-H2 对等契约(`tests/help-ui.test.mjs::section-parity` 保持绿)。

### ✨ UI

- **`#/reports`** — 列表视图顶部新增可折叠卡片,呈现权威的分数 → 下一步表(`≥ 4.5 → /career-ops apply`、`4.0–4.4 → apply or /career-ops contacto`、`3.5–3.9 → /career-ops deep`、`< 3.5 → skip`)。来源链接到 `career-ops.org/docs/.../scan-job-portals`。8 个语言中 7 个新 i18n 键(`rep.thresholdsTitle`、`rep.thrAction`、`rep.thr45`、`rep.thr40`、`rep.thr35`、`rep.thrLow`、`rep.thresholdsSource`)。

### 📋 QA

- **`qa/claude-cowork-browser-test-prompt.md`** — 新增 **Scenario 17(career-ops.org/docs 覆盖)** 含 5 条子断言(8 个语言的前置说明、§5/§7/§14 中 CLI-flow 子章节、8 个语言的 README 块、`#/apply` Playwright 链接、`#/reports` 分数阈值卡片)+ **Scenario 18(help bundle 对等)** 用于 i18n 对等回归。

### 范围外(延后)

| 项目 | 原因 |
|---|---|
| **Batch evaluate SPA 页面** | 权威文档描述 CLI-only 流程;SPA 等价物 = 新视图 + ≥3 个端点 + 固件。多日阶段。 |
| **F-018 完整适配器注册表** | 仍在队列中;label-only 切片在 v1.10.3 关闭。 |
| **完整 multer 管道** | v1.10.2 通过 415 信封关闭数据损坏空洞;完整解析器是独立阶段。 |

### 测试态势

- **348 / 349** 单元测试(1 个既存父项目数据漂移)。
- 覆盖率:**94.59 % 行 / 84.18 % 分支**。
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**。

### 文档

- `docs/reviews/REVIEW-2026-05-13-v1.11.1.md` — 会话上下文 + 审计。
- 全部 8 个 README:发布徽章 v1.11.0 → v1.11.1。
- 全部 8 个 CHANGELOG 收录此条目。

---

## [1.11.0] — 2026-05-13

**career-ops.org 文档集成。** 次要版本号,因为每项变更都是增量(无 API 破坏、无数据形态变化、无 SPA 路由重命名)。关闭 v1.10.3 的 PR-9 延期。

### 📝 文档

- **`docs/career-ops-canonical.md`(新)** — 从 [career-ops.org/docs](https://career-ops.org/docs) 及其 5 份子指南(What is career-ops、Scan job portals、Apply for a job、Batch-evaluate offers、Set up Playwright)提炼出的单一权威参考。所有语言 help bundle + README 都翻译此文件;当 career-ops.org/docs 变化时,优先重新生成此文件。
- **全部 8 个 help bundle**(`docs/help/{en, ru, es, pt-BR, ko-KR, ja, zh-CN, zh-TW}.md`)在 H1 简介下方获得新的前置 `About career-ops` 章节:原则、关键概念(Mode / Archetype / Pipeline / Tracker / Report / Scan history)、career-ops 与 career-ops-ui 的区分、按分数的行动阈值(≥ 4.5 / 4.0–4.4 / 3.5–3.9 / < 3.5),以及 5 份权威指南的链接。每个语言 H2 数量保持 16(`tests/help-ui.test.mjs` 对等保持绿)。
- **全部 8 个 README** 在安装标题前新增 `About career-ops` 块:同样的原则、分数阈值与 5 份权威指南链接。`What's new in v1.10.x` 历史章节从 README 首页移除(CHANGELOG 保留完整历史)。

### ✨ UI 改进

- **`#/apply`** — 信息横幅现在显式呈现 Playwright 安装指南(`career-ops.org/docs/.../set-up-playwright`)以及权威 Apply 指南的链接。新 i18n 键 `apply.playwrightHint` + `apply.docsLink` 在 8 个语言中本地化。

### 🔧 内部

- README 截图路径仍为 `public/images/screen_vacancy_found.png`(v1.10.1)。
- 无新服务端路由、无 schema 变更、无新测试需要(既有 i18n + help 对等测试覆盖新内容面)。
- `tests/help-ui.test.mjs` 的 `section-parity` 测试继续通过 — 每个语言都有相同的 16 个 H2 标题。

### 审计(空缺已延后,不在本发布)

| 空缺 | 延后原因 |
|---|---|
| **Batch evaluate SPA 页面**(`./batch/batch-runner.sh` 流程) | 权威文档描述 CLI-only 的批量循环(`batch/batch-input.tsv` → 并行 runner → `batch/tracker-additions/`)。SPA 等价物需要新视图、3 个新端点、固件数据和测试。多日阶段;已在 `docs/career-ops-canonical.md §4` 中记录。 |
| **适配器注册表合并**(F-018 / 完整 PR-1) | 仍在队列中;`/api/stream/scan-en` + `/api/stream/scan-ru` 保留。label-only 切片在 v1.10.3 落地。 |
| **Multer 管道**(完整 PR-4) | v1.10.2 通过 415 信封关闭数据损坏空洞;完整 multipart 解析器 + ConversionError 信封重构是独立阶段。 |

### 测试态势

- **348 / 349** 单元测试通过(1 个 `portals-dead.test.mjs` 中的既存父项目数据漂移)。
- 覆盖率:**94.59 % 行 / 84.24 % 分支**。
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**。

### 文档

- `docs/reviews/REVIEW-2026-05-13-v1.11.0.md` — 会话上下文 + UI 审计空缺列表。
- 全部 8 个 README:徽章更新(测试 349 → 348 — 一个测试作为审计清理被移动,无功能变化)、发布 v1.10.3 → v1.11.0。
- 全部 8 个 CHANGELOG 收录此条目。

---

## [1.10.3] — 2026-05-12

关闭 v1.10.0 QA 11 个发现中的 7 个(F-001、F-010 最小化、F-011 最小化、F-013、F-014、F-015、F-019)。剩余 4 个(F-018 — 完整适配器注册表合并;PR-4 完整 multer 管道;PR-7 follow-ups;PR-9 跨 career-ops.org 文档清扫)延后到 v1.11.0。

### ✨ 功能

- **`feat(pdf): 每个长文本面上的 Generate PDF(F-015)`** — 三个新 SSE 端点(`GET /api/stream/pdf/report?slug=`、`GET /api/stream/pdf/deep?name=`、`POST /api/stream/pdf/inline { markdown }`)加上一个共享辅助 `public/js/lib/pdf-generate.js`。**📄 Generate PDF** 按钮现在出现在 `#/reports/:slug`、`#/deep`(手动 + 实时)、`#/evaluate`(手动 + 实时),以及 `#/interview-prep`(通过 deep 端点)。每种类型复用 v1.10.2 的 cv-markdown 转打印 HTML 助手,并把结果落地到 `output/<slug>-<TS>.pdf`,让现有的自动下载流接管。
- **`feat(config): 区域配置分组(F-013)`** — `/api/config` 现在暴露 `groups`(`core | runtime | regional`)和 `regionalActive`(由 `portals.yml::russian_portals.sources` 计算得出的布尔值)。SPA 把三组渲染为可折叠章节;**Regional sources** 默认折叠,仅当配置了区域源时才存在。

### 🐛 错误修复

- **`fix(server): 全局 Express 错误处理器(F-019)`** — `PayloadTooLargeError`(例如向 `/api/cv/import` 上传 11 MB)和来自 `express.json` 的 `SyntaxError` 现在返回 SPA 可本地化的 JSON 信封(HTTP 413 / 400)。此前默认 Express 处理器返回 HTML 栈跟踪,打断 SPA 的 `try { await res.json() }`。
- **`fix(i18n): 英文 token 不再渗入非英文 UI(F-001)`** — 为 `Pipeline`、`Deep research`、`Follow-up`、`Health`、`Outreach`、`Doctor`、`Quick scan` 添加本地化(用户原本看到的是以其语言为壳但内含英文标签的 UI)。
- **`fix(scan): 标签中移除 EN/RU 框架(F-010 最小化)`** — `#/scan` 摘要行、两个 scan-done 徽章以及来源筛选标签现在读作 "ATS adapters" + "Regional portals"。两个 SSE 端点(`/api/stream/scan-en`、`/api/stream/scan-ru`)按原样保留;完整注册表合并在 PR-1 / v1.11.0。
- **`fix(scan): Active Companies 计数器自动刷新(F-011 最小化)`** — 视图在每次 `refreshResults()` 之后派发 `scan:refresh` 事件;计数器从 `/api/scan-results` 实际载荷中重新派生"上次扫描中有命中的公司",不再停留在视图挂载时的快照。
- **`docs(en-ru-framing): 跨 README + help bundle 清扫(F-014)`** — `EN sweep` → `ATS sweep`,`RU sweep` → `regional sweep`,`EN scanner` → `ATS scanner`,`EN: Greenhouse / Ashby / Lever, RU: hh.ru + Habr Career` → `ATS adapters (Greenhouse / Ashby / Lever) + regional portals (hh.ru / Habr Career)`。涉及 `README.md`、`README.ru.md`、`README.ja.md`、`README.ko-KR.md`、`docs/help/en.md`、`docs/help/es.md`、`docs/help/pt-BR.md`。

### 🧪 测试

- 新增 `tests/global-error-handler.test.mjs`(2 个用例):畸形 JSON → 400 JSON;11 MB 上传 → 413 JSON。
- 新增 `tests/config-groups.test.mjs`(2 个用例):`/api/config` 暴露 `groups`;当 portals.yml 获得区域源时 `regionalActive` 翻转为 on。
- 新增 `tests/pdf-extra-routes.test.mjs`(5 个用例):`/report`、`/deep`、`/inline` 各以记录的三个位置参数调用 `generate-pdf.mjs`;缺失 slug 时 404;空 inline markdown 时 400。
- 总计:**349 / 350** 单元测试(`portals-dead.test.mjs` 中 1 个既存父项目数据漂移)。
- 覆盖率:94.59 % 行 / 84.16 % 分支。
- 20 / 20 smoke E2E、23 / 23 comprehensive E2E、**28 / 28 Playwright**。

### 📝 文档

- `docs/reviews/REVIEW-2026-05-12-v1.10.3.md` — 会话上下文 + 范围外清单。
- 全部 8 个 README:徽章更新(测试 340 → 349,发布 v1.10.2 → v1.10.3),每个语言加入 "What's new in v1.10.3" 章节。
- 全部 8 个 CHANGELOG 收录此条目。

### 范围外(延后到 v1.11.0)

- **PR-1** — 完整的与语言无关的适配器注册表(8 个 ATS 适配器文件 + 新的 `/api/stream/scan?source=` 合并现有两个端点 + 新增 14 个 portal + 扫描视图重写)。本次的 label-only 切片在视觉上关闭了 F-010 / F-011;架构性重构是多日阶段。
- **PR-4** — 基于 multer 的 CV 导入管道(用真正的 multipart 解析器 + ConversionError 信封 + 依赖审查替换 v1.10.2 的 415 信封)。
- **PR-9** — 完整 career-ops.org 文档集成:抓取 [career-ops.org/docs](https://career-ops.org/docs) + 4 份子指南(scan-job-portals、apply-for-a-job、batch-evaluate-offers、set-up-playwright),翻译到 7 个非英文语言,相应重写 help bundle + README,对照记录的行为审计 UI 界面。

---

## [1.10.2] — 2026-05-12

**功能回归补丁。** 关闭 v1.10.1 手测中发现的两个 bug;扩展文档表面。

### 🐛 错误修复

- **`fix(cv): /api/cv/import 以 415 拒绝 multipart/form-data(F-016 加固)`** — 任何默认使用 `multipart/form-data` 的外部客户端(curl `-F`、常见 HTTP 客户端)此前会把它的线缆信封(`--boundary…\r\nContent-Disposition: form-data; name="file"; filename="x"…`)作为 `cv.md` 的内容存盘。SPA 实际走的路径(`Content-Type: application/octet-stream` + `X-Filename`)未受影响。该路由现在返回 415,提示指向记录的契约。纵深防御:首 256 字节嗅探为 multipart 的 octet-stream body 同样得到 415。415 时 `cv.md` 绝不被触碰。
- **`fix(pdf): /api/stream/pdf 以正确位置参数调用 generate-pdf.mjs`** — 此前以 `[]` 调用脚本。脚本输出 `Usage:` 行并以代码 1 退出 — SPA 显示绿色 "PDF generated" toast,但从未有文件写盘。该路由现在读取 `cv.md`,通过一个内联的 markdown 转打印 HTML 助手把它渲染为 `output/cv-input-<TIMESTAMP>.html`,然后 spawn `generate-pdf.mjs <input.html> <output.pdf> --format=a4`。可选 `?format=letter` 查询用于美式信纸输出。缺少 `cv.md` 时,发出 `error` 事件 + `done { code: 2 }`,而非伪造 start 帧。

### 🧪 测试

- 新增 `tests/cv-upload-multipart-reject.test.mjs`(5 个用例):SPA happy path 返回 200 与干净 markdown;`multipart/form-data` → 415;看起来像 multipart 的 octet-stream body → 415;空 body → 400;被拒请求不修改 `cv.md`。
- 新增 `tests/pdf-stream-args.test.mjs`(3 个用例):`start` 事件携带 `<input.html> <output.pdf> --format=a4`(绝对路径),HTML 在磁盘存在;`?format=letter` 切换标志;缺失 `cv.md` 发出预期错误帧。
- 总计:**340 个单元测试**(原 318)。`portals-dead.test.mjs` 一个既存失败仍属父项目数据漂移,与 web-ui 无关。
- 覆盖率:94.63 % 行 / 84.94 % 分支。

### 📝 文档

- 新增 `docs/test-scenarios/` — 21 个场景文件(英文,index + 每页契约):
  - 01 smoke / health · 02 CV 上传 · 03 CV 编辑保存 · 04 CV → PDF 下载
  - 05 profile YAML · 06 config env · 07 scan · 08 pipeline
  - 09 evaluate · 10 deep research · 11 modes · 12 apply 清单
  - 13 tracker · 14 reports · 15 activity log · 16 interview prep · 17 JDs
  - 18 i18n · 19 help center · 20 security · 21 完整漏斗
- 每个文件记录:目标、前置条件、输入、预期输出、负面用例、测试覆盖(文件 + 行号范围),以及适用时的手动 Playwright 步骤。
- 新增 `docs/reviews/REVIEW-2026-05-12-v1.10.2.md` — 完整会话上下文、范围外清单、验证命令。
- 全部 8 个 README:徽章更新(测试 318 → 340,发布 v1.10.1 → v1.10.2)+ 每个语言 "What's new in v1.10.2" 章节。
- 全部 8 个 CHANGELOG 收录此条目。

### 范围外(延后到未来 GSD 阶段)

PR-1 与语言无关的适配器注册表(仍在队列中)、PR-4 基于 multer 的 CV 导入与完整转换管道、PR-7 reports / evaluate / deep / interview-prep 上的 Generate-PDF 按钮、PR-8 config UI 重新分组、PR-9 文档清扫、PR-10 逐按钮本地化审计 + jsdom CI 守门、完整韩语重译。

---

## [1.10.1] — 2026-05-09

**关键修复补丁。** 由 v1.10.0 QA 回归运行驱动(`qa/reports/00-FINAL-SUMMARY.md`)。

### 🛡️ 安全

- **`fix(security): 收紧 isValidJobUrl + 增加 DNS-rebind 防御(PR-3 / F-003)`** — `isValidJobUrl` 现在拒绝 RFC1918(`10/8`、`172.16/12`、`192.168/16`)、完整 127/8 loopback、link-local `169.254/16`(含 AWS IMDS)、`0.0.0.0`、CGNAT `100.64/10`,以及 IPv6 ULA / link-local。新辅助 `isPrivateOrLoopbackHost()` 从 `server/lib/security.mjs` 导出,被 `/api/pipeline/preview` 复用,后者在每次重定向跳转上对主机执行 `dns.lookup` 并在解析地址本身为私有时拒绝 — 击败 DNS-rebind。DNS 失败时 fail-open(fetch 报告错误),让测试桩 / 无 DNS 沙箱仍可工作。

### 🐛 错误修复

- **`fix(activity): 只记录成功的状态变更(PR-5 / F-005)`** — 中间件现在在 `res.statusCode >= 400` 时提前返回。被拒的 pipeline / cv / tracker 请求不再污染审计流。
- **`fix(activity): 增加 profile.save / config.save / cv.import 事件映射(F-008)`** — 成功的 `PUT /api/profile` 和 `POST /api/config` 现在出现在 `/api/activity` 中。
- **`fix(help): 把 ko 别名到 ko-KR.md 以提供韩语 Help 正文(F-002)`** — SPA 发送裸 BCP-47 代码(`ko`);磁盘上文件名为 `ko-KR.md`。解析器现在按 4 个候选名行走:精确、region-tag 别名、纯语言基线,然后 `en.md`。
- **`fix(llm): /api/evaluate 尊重 mode:'manual'(F-009)`** — 镜像 `/api/deep`。manual 模式即使配置了密钥也跳过 Anthropic / Gemini 调用,使用户可以把提示词复制到 Claude Code,而不消耗额度。
- **`fix(api): DELETE /api/pipeline 接受 ?url= 和 body.url,未命中返回 404(PR-6 / F-017)`** — 此前仅在 `?url=` 时静默以 200 返回未命中。

### ✨ 功能

- **`feat(llm): 在每个提示词中传递语言(PR-2 / F-012)`** — 新增 `resolveLocale(req)`,按 `body.lang` → `body.locale` → `Accept-Language` → `'en'` 选择语言。新增 `buildLocaleDirective(lang)` 发出一行 "Respond in X" 头。`buildEvaluationPrompt`、`buildDeepPrompt`、`buildModePrompt` 现在接受并嵌入 `lang`。SPA `API.call()` 自动附加 `Accept-Language` 并把 `lang` 合并到 JSON body。
- **`feat(scripts): post-qa-cleanup.mjs(PR-11)`** — 回放 QA 回归清理清单;`--apply` 写入,默认 dry-run,幂等。从 `data/pipeline.md` 清扫 RFC1918 / `nip.io` / `test-cloud-*` URL,并审计 `cv.md` 大小。

### 🧪 测试

- 新增 `tests/critical-fixes.test.mjs`(15 个用例):F-002 ko 别名解析、F-009 manual 模式 opt-out、PR-6 DELETE 形态(body / 404 / 400)、PR-3 辅助单测(IPv4 + IPv6 + bracketed)、PR-2 `resolveLocale` 优先级 + `buildLocaleDirective` + 提示词构造器集成。
- `tests/url-validation.test.mjs` 扩展 5 个新测试用于 RFC1918 / link-local / 0.0.0.0 / 127/8 / CGNAT / IPv6 ULA / link-local。
- `tests/activity-log.test.mjs` 测试 8 更新以断言新的 "4xx 不记录" 契约。
- 总计:**318 个单元测试**(原 298;`portals-dead.test.mjs` 一个既存失败是父项目 `templates/portals.example.yml` 中的数据漂移,与 web-ui 代码无关)。

### 📝 文档

- 新增 `docs/reviews/REVIEW-2026-05-09-v1.10.1.md` — 完整会话上下文 + 范围外清单 + 验证命令。
- 全部 8 个 README:徽章更新(测试数 298 → 318,发布 v1.10.0 → v1.10.1),截图路径迁移到 `public/images/screen_vacancy_found.png`,每个语言新增 "What's new in v1.10.1" 章节(英语、西班牙语、葡萄牙语、韩语、日语、俄语、简体中文、繁体中文)。
- 全部 8 个 CHANGELOG 更新此条目。

### 范围外(延后到未来 GSD 阶段)

PR-1(与语言无关的适配器注册表、+14 个 portal、前端重写)、PR-4(基于 multer 的 CV 导入 + ConversionError + 全局错误处理器)、PR-7(reports / evaluate / deep / interview-prep 上的 Generate-PDF 按钮)、PR-8(config UI 重新分组)、PR-9(完整 README/docs/8-help-bundle EN-RU 框架清扫)、PR-10(逐按钮本地化审计 + jsdom CI 守门)、完整韩语 help 重译(文件已存在;PR 仅修复运行时投递)。

---

## [1.10.0] — 2026-05-08

**CV 导入翻新 + `#/config` 标签 + 规范化 `#/profile` 路由。**

### ✨ 功能

- **`feat(cv): .docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md 的服务端导入`** — 新的 `POST /api/cv/import` 端点把上传文档(任意常见格式)转换为编辑器可直接落入的 markdown。Office 格式经 **pandoc**,PDF 经 Poppler 的 **pdftotext**。结果通过 `stripDangerousMarkdown` 净化(XSS 纵深防御)。硬上限:每次上传 10 MB。前端 `📁 Upload CV` 现在接受完整格式集;主机缺转换器时给出友好错误 toast。
- **`feat(cv): generate-pdf.mjs 完成后自动下载生成的 PDF`** — 流式 Generate-PDF 现在快照输出目录中最新的 PDF,并在 `done` 时为该新文件触发浏览器下载(若运行未产生新工件则空操作)。页面上的已有列表仍显示每个先前 PDF。
- **`feat(config): 两标签布局 — API keys & runtime + Profile`** — `#/config` 现在有标签条。第一标签保留既有的 `.env` 编辑器(API 密钥、模型、扫描器旋钮)。新的 **Profile** 标签是 `config/profile.yml` 的直接 YAML 编辑器:`PUT /api/profile` 校验 YAML(必须是 mapping,必须包含 `candidate`),如缺失则盖印规范化 `# Career-Ops Profile Configuration` 头,然后写文件。保存无需重启即可传播。
- **`feat(routes): 规范化 /#/profile 路由(原为 /#/settings)`** — 侧栏现在指向 `#/profile`。旧的 `#/settings` hash 仍通过路由别名表解析,以便既有书签继续工作。内部路由处理器重命名;测试更新以反映新方向。

### 🧪 测试

- 新增 `tests/cv-import.test.mjs`(7 个用例):`.md` / `.txt` 直通、空 body 400、不支持扩展名 422、超大 413、HTML→markdown 净化(无 pandoc 时跳过)、PDF→文本往返(手工 PDF;无 poppler 时跳过)。
- 新增 `tests/profile-put.test.mjs`(7 个用例):happy path 往返、头部盖印、空 / 无效 YAML / 非对象 / 缺 candidate 400、超大 413。
- `tests/playwright-full-cycle.mjs` 扩展 14 → **16** 个子测试 — 增加 HTML 形式的 CV 导入与 `PUT /api/profile` 往返。
- `tests/router.test.mjs` ALIAS 正则反转以断言新的 `settings → profile` 方向。

### 📚 文档

- `docs/help/{en,ru}.md` — 第 2/3/4 节完整更新:新的 App-settings 标签、只读 Profile 页面上的 "通过 config 编辑" 提示、CV 章节完整上传格式矩阵、PDF 自动下载行为。
- `docs/help/{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` — 新内容块的简明镜像;章节数不变(16),对等测试保持绿。

### 🔧 内部

- 新增 `server/lib/cv-import.mjs` — 格式 → markdown 转换的单一真实来源,带超时 + 缺失转换器检测,呈现可执行的提示而非 500。
- `server/lib/routes/content.mjs` 获得 `POST /api/cv/import` 和 `PUT /api/profile`(上传通过 `express.raw` 二进制安全,YAML PUT 通过 JSON)。

---

## [1.9.1] — 2026-05-08

**生产就绪复核。** 4 项有针对性的 bug 修复(BF-1..BF-4),Playwright smoke 从 5 个扩展到 12 个测试,覆盖 tracker / pipeline / reports / evaluate / config / cv 保存往返。CI 全绿。

### 🐛 错误修复

- **`fix(tracker): 在每个单元格转义竖线 + 折叠换行,不仅在 notes(BF-1)`** — 公司名如 `"Acme | Co"` 此前会破坏 markdown 表布局(解析器把单元格拆成两个)。单元格净化器现在统一应用于 company / role / reportSlug / notes;`parsers.mjs::parseMarkdownTable` 中的伴随修复增加 GFM 合规的 `\|` 转义支持,使往返无损。
- **`fix(config): 用 try/catch 包裹 updateEnvFile(BF-2)`** — `POST /api/config` 此前在权限拒绝 / 只读文件系统上向上抛未处理拒绝。现在返回干净的 500 `{ error: 'failed to write parent .env', details: [...] }`。
- **`fix(llm): Anthropic SDK 调用的拼装提示词软上限(BF-3 + BF-4)`** — `/api/evaluate`、`/api/deep`、`/api/mode/:slug` 的 Anthropic 分支现在在 `bundleProjectContext + prompt` 超过 200 KB(约 50K token)时以 413 提前退出。相比让 API 抱怨 context 大小,节省多秒的往返 + token。该上限远低于任何当前模型上限(Sonnet 4.6 = 1M context)。

### 🧪 Playwright smoke — 覆盖扩展

5 → **12** 个测试。新用例:

- `tracker view renders empty + accepts API-seeded row` — 通过在公司名中写入字面竖线播种一行来运动 BF-1,断言往返保留它。
- `pipeline add-URL form populates the queue` + 无效 URL 拒绝清扫(loopback、`javascript:`、裸字符串)。
- `reports view handles empty state` — 非崩溃断言。
- `evaluate view returns a manual prompt without API key` — 验证兜底链。
- `config GET returns known keys masked` — 密钥永不通过 `/api/config` 泄漏。
- `cv.md PUT round-trips with sanitization` — XSS 片段(script 标签、`javascript:` schema)端到端被剥离。
- `pipeline preview proxy strips scripts` — 无效 URL 拒绝路径。

### 📦 行为变更(无 API 契约变化)

- Tracker 写入现在对含竖线的 company / role 名无损。既有含原始竖线的行将在下次读取时开始正确解析。
- `/api/{evaluate,deep,mode/:slug}` 在提示词过大(200 KB+)时返回 413 而非 502/超时。

### 🧪 测试

- **284 个单元测试**(数量不变;解析器更新后既有测试仍全绿)。
- **12 个 Playwright 浏览器 smoke 测试**(原 5 个)。

---

## [1.9.0] — 2026-05-08

**v1.8.0 backlog 中 P-6 → P-10 在一个发布中全部交付。** 标题:`server/index.mjs` 现在是 130 LOC 的编排器(从 762 降下来,总计 1230 → 130 = -89%);每个路由话题都有自己的模块。`/api/evaluate` 实现 Anthropic 对等、多 CLI 适配垫片、扩展的 i18n 对等测试,以及 Playwright 浏览器 smoke 接入 CI。

### 🏗️ P-6 — 服务端按关注点拆分(第 2 阶段)

P-2 的延续。把剩余 9 个路由话题从 `server/index.mjs` 抽到 `server/lib/routes/<topic>.mjs` 模块中。`index.mjs` 现在是纯编排器:中间件(安全头 + 活动日志 + 静态)、12 个 `register<Topic>Routes(app)` 调用,以及 SPA catch-all。

- `server/lib/routes/activity.mjs` — `/api/activity`。
- `server/lib/routes/config.mjs` — `/api/config` GET/POST(父项目 .env 往返)。
- `server/lib/routes/health.mjs` — `/api/health` + `/api/dashboard`。
- `server/lib/routes/help.mjs` — `/api/help/:lang`。
- `server/lib/routes/jds.mjs` — `jds/*.txt` 的完整 CRUD。
- `server/lib/routes/llm.mjs` — 全部 LLM 端点(evaluate、deep、mode、apply-helper、interview-prep)。
- `server/lib/routes/pipeline.mjs` — `/api/pipeline*` 含 SSRF 安全的 preview 代理,带命名常量 timeout / max-redirects / max-body。
- `server/lib/routes/reports.mjs` — `/api/reports*`。
- `server/lib/routes/tracker.mjs` — `/api/tracker` GET + 去重感知 POST。

行为不变。283/283 单元测试在每一步都保持绿。编排器的 import 表面从 47 行降到 22 行。

### 🔌 P-7 — `/api/evaluate` 的 Anthropic 对等

`/api/evaluate` 此前只支持 Gemini 或 manual。v1.9.0 增加 Anthropic 分支(两个密钥都存在时优先),镜像 `/api/deep` 和 `/api/mode/:slug` 已使用的路由规则。通过 `bundleProjectContext({ modeSlugs: ['_shared', 'oferta'] })` 路由,使模型内联到 cv / profile / mode 模板(REVIEW-A1)。

新端点:**`POST /api/evaluate/test-anthropic`** — `ANTHROPIC_API_KEY` 的 smoke 检查,镜像既有的 Gemini smoke。发送很小的提示(≤256 输出 token),成本几乎为零;返回 200 字符样本。

兜底链现在是:Anthropic → Gemini → manual。

### 🌐 P-8 — Help center i18n 对等(审计 + 测试加固)

审计每个 `docs/help/<lang>.md` 的结构对等。8 个语言已经覆盖同样的 14 个权威 H2 章节。测试升级:

- `tests/help-ui.test.mjs::every help doc covers the same 14 sections` 此前只检查 en + ru。现在迭代 **全部 8 个语言**(en、es、pt-BR、ko-KR、ja、ru、zh-CN、zh-TW)并对每个断言章节数。
- 新测试:`tests/help-ui.test.mjs::every help locale has substantive content` — 通过断言每个非英文语言至少为 `en.md` 字节长度的 30% 来防范语言桩。紧凑翻译自然达到 40-50%;桩会是个位数。

结果:结构对等现在由 CI 强制。

### 🤖 P-9 — Playwright 浏览器 smoke 接入 CI 矩阵

`tests/playwright-smoke.mjs`(v1.8.0 加入,opt-in)现在是 CI 工作流的一部分。既有的 `e2e` 作业已经安装 Playwright + Chromium;新增一步(`npm run test:e2e:browser`)在 comprehensive node E2E 之后运行 5 个浏览器 smoke。

CI 顺序:unit(Node 18/20/22 矩阵) → smoke node E2E → comprehensive node E2E → **Playwright 浏览器 smoke** → 失败时上传截图工件。

### 🌍 P-10 — 多 CLI 兼容

父项目 career-ops v1.7.0 引入了多 CLI / Open Agent Skill 标准支持。UI 子项目沿用同样的约定,使用指向权威 `CLAUDE.md` 的薄垫片:

- `web-ui/AGENTS.md` — Codex / Aider / 通用 CLI 入口。
- `web-ui/GEMINI.md` — Gemini CLI 入口。

两个垫片都重申硬规则与快速参考,但把完整项目级指令委托给 `CLAUDE.md`,以便非 Claude CLI 与 Claude Code 会话获得相同的定位。部署的 UI 本身在运行时仍与 CLI 无关。

### 🧪 测试

- **284 个单元测试**(原 283):+1 个新 help 语言对等测试。
- **5 个 Playwright 浏览器 smoke 测试** — 现在是 CI 的一部分,不再仅 opt-in。
- 覆盖率持平。

### 🔧 修改的文件

```
+ server/lib/routes/activity.mjs              + server/lib/routes/config.mjs
+ server/lib/routes/health.mjs                + server/lib/routes/help.mjs
+ server/lib/routes/jds.mjs                   + server/lib/routes/llm.mjs
+ server/lib/routes/pipeline.mjs              + server/lib/routes/reports.mjs
+ server/lib/routes/tracker.mjs
+ AGENTS.md                                   + GEMINI.md

~ server/index.mjs (762 → 130 LOC, -83%)
~ .github/workflows/ci.yml (Playwright smoke step)
~ tests/help-ui.test.mjs (all-8-locales section parity + content-floor)
~ docs/{ROADMAP,architecture/{OVERVIEW,SERVER}}.md
~ docs/sdd/CONVENTIONS.md
~ CLAUDE.md
~ package.json (1.8.0 → 1.9.0)
```

### 📦 新 REST 端点

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/evaluate/test-anthropic` | `ANTHROPIC_API_KEY` 的 smoke 检查(P-7)。镜像 `/api/evaluate/test-gemini`。 |

### 🤖 新 CLI 入口

| 文件 | CLI | 备注 |
|---|---|---|
| `AGENTS.md` | Codex / Aider / 通用 | 指向 `CLAUDE.md` 获取完整指令。 |
| `GEMINI.md` | Gemini CLI | Gemini 在会话启动时自动加载。 |

---

## [1.8.0] — 2026-05-08

**加固、重构与 SDD 引导。** 3 个高严重度正确性/安全修复(A1、A2、A3)、4 个中等(B1–B4)、6 项清理、对父项目 career-ops v1.7.0 表面的审计、按关注点拆分服务端(P-2 阶段 1)、Playwright 浏览器 smoke 装置,以及 `docs/` 与 `.claude/` 下完整的 SDD 基础。

### 🔥 高严重度修复

- **`fix(deep): 在 Anthropic SDK 调用中内联 cv/profile/mode 文件(REVIEW-A1)`** — `/api/deep` 与 `/api/mode/:slug` 此前告诉模型 "先读这些文件",但 Anthropic SDK 没有文件系统访问。输出空洞。新的 `bundleProjectContext({ modeSlugs })` 读取 `cv.md`、`config/profile.yml`、`modes/_shared.md` 以及 mode 模板,每个截断到 16 KB,并在提示词前置 `<project_context>` 块。已实测:`claude-sonnet-4-6` 的 deep-research 调用返回 26 KB 基于上下文的 markdown。
- **`fix(runner): SIGTERM 宽限期后升级到 SIGKILL(REVIEW-A2)`** — `runNodeScript` 和 `streamNodeScript` 此前在超时 / 客户端断开时只发 `SIGTERM`。卡在 syscall(DNS、阻塞 socket)的子进程会忽略,导致 SSE 连接挂起直到 Node GC 收割。现在每条路径都装备一个 5 秒看门狗,升级到 `SIGKILL`。Promise 总能 resolve。
- **`fix(runner): 流式端点的最大运行时上限(REVIEW-A3)`** — 每个 SSE 脚本 runner(`/api/stream/{scan,liveness,pdf}`)现在有 30 分钟硬天花板。到期:发出 `event: error { message: 'maximum runtime exceeded' }`、通过 A2 看门狗杀子进程、结束响应。

### 🛡️ 中等严重度修复

- **`fix(preview): /api/pipeline/preview 中逐跳重定向校验(REVIEW-B1)`** — 从 `redirect: 'follow'` 改为手动重定向行走。每个 `Location` 头都被 `isValidJobUrl` 重新校验;上限 3 跳。恶意 boards 不能再把我们弹到 loopback / 私有 IP / `file://`。4 个新测试覆盖拒绝路径。
- **`refactor(keys): hasGeminiKey 辅助统一 LLM 密钥检查(REVIEW-B2)`** — 路由处理器中对 `process.env.GEMINI_API_KEY` 的直接读取被替换为 `lib/anthropic.mjs` 的 `hasGeminiKey()`。镜像 `hasAnthropicKey()` 形状以保持一致性,便于 mock。
- **`feat(scanners): 在 hh.ru、Habr、Greenhouse、Ashby、Lever 中传递 AbortSignal(REVIEW-B3)`** — 当 SSE 客户端在扫描中途断开时,正在进行的 HTTP fetch 现在被取消,而不是把每个查询跑完再丢事件。`runRuScan` 和 `runEnScan` 接受 `opts.signal`;`/api/stream/scan-{ru,en}` 中的 SSE 处理器创建 `AbortController` 并在 `res.close` 时 abort。
- **`test(anthropic): 日志守卫测试防止未来通过 console 泄漏 API 密钥(REVIEW-B4)`** — 在 `runAnthropic` happy + 错误路径中捕获每个 `console.{log,info,warn,error,debug}` 调用,断言零输出且金丝雀密钥字符串从未出现。对未来 `console.log(opts)` 回归的纵深防御。

### 🧹 低严重度打磨

- **`fix(parsers): addPipelineUrl 内部 URL 守门的纵深防御(REVIEW-C4)`** — 解析器层面拒绝非 http(s) 值,与路由层 `isValidJobUrl` 互补。可选 `opts.validate` 给希望更严的调用方。
- **`docs(readme): 徽章 "tests-88 passed" → "tests-277 passed"(REVIEW-C3)`** — 此前差一个数量级。
- **`test(i18n): 缺键差异按语言分组(REVIEW-C6)`** — 当 `tests/i18n-coverage.test.mjs` 发现空缺时,输出现在是 `[ru] (3): foo, bar, baz` 而非混合行。
- **`docs(review): C1 在检查后关闭`** — 净化器正则已经是 `\x00-\x08` 十六进制形式;review 条目是工具渲染产物。

### 🏗️ P-2 阶段 1 — 服务端按关注点拆分

`server/index.mjs` 此前是 1230 LOC,远超 800 行天花板。拆分到聚焦模块且行为不变。283 个单元测试在每一步都保持绿。

- `server/lib/security.mjs` — `isValidJobUrl`、`stripDangerousMarkdown`、`sanitizeJobDescription`、`isPubliclyExposed`。从 `index.mjs` 再导出以保持对外部消费者的向后兼容。
- `server/lib/prompts.mjs` — `bundleProjectContext`、`buildEvaluationPrompt`、`buildDeepPrompt`、`buildModePrompt`、`buildApplyChecklist`。
- `server/lib/store.mjs` — `safeReadApps`、`safeReadPipeline`、`safeListReports`、`checkProfileCustomized`、`ensureRussianPortalsDefaults`。
- `server/lib/routes/scan.mjs` — `registerScanRoutes(app)` for `/api/stream/scan-{ru,en}`、`/api/scan-ru/config`、`/api/scan-results`。
- `server/lib/routes/runners.mjs` — `registerRunnerRoutes(app)` for 缓冲 `/api/run/*` 表、流式 `/api/stream/{scan,liveness,pdf}`、生成 PDF 列表/下载。
- `server/lib/routes/content.mjs` — `registerContentRoutes(app)` for CV / Profile / Portals / Modes。

`index.mjs` 现在是 762 LOC(-38%,在 800 上限之下)。阶段 2 将抽出 tracker、pipeline、reports、jds、llm(evaluate/deep/mode)、health 到路由模块。目标编排器 <500 LOC。

### 🔍 父项目 career-ops v1.7.0 审计

用户把父项目升级到 v1.7.0。审计每个被消费的表面 — UI 完全兼容。重点发现记录在 `docs/architecture/DATA-FLOWS.md`:

- Modes 目录从 7 个增长到 19 个。UI 的 `MODE_ALLOWLIST` 有意只暴露 7 个(其他仅 Claude Code 使用)。增加注释解释这一刻意收窄。
- `portals.yml` schema 确认:`tracked_companies`(96 条,87 启用,71 有 API)。EN 扫描器正确读取;旧 `companies` 键仍支持。
- 父项目今天未消费的新表面:`dashboard/`(Go 程序)、`update-system.mjs`、`generate-latex.mjs`、`analyze-patterns.mjs`、`liveness-core.mjs`、`followup-cadence.mjs`、`test-all.mjs`、本地化 mode 子目录(`de/fr/ja/pt/ru`)。
- 实时验证 `/api/dashboard`、`/api/health`、`/api/modes`、`/api/portals`、`/api/profile`、`/api/cv`、`/api/jds`、`/api/reports`、`/api/tracker`、`/api/pipeline`、`/api/evaluate`、`/api/deep`、`/api/stream/scan-en` 全绿。

### 🤖 SDD / GSD 引导

`career-ops-ui` 现在有完整的 Spec-Driven Development 基础,与 GSD 管道对齐(来自 `superpowers@claude-plugins-official` 的 `gsd-*` skill)。

- `CLAUDE.md`(根) — 项目级代理系统提示:技术栈、GSD 管道、硬规则(父项目契约、安全护栏、不使用 `--no-verify`)、约定、父项目边界。
- `.aiignore` — AI 代理排除清单:vendored、二进制、父项目用户数据、`.planning/`、`.env`、locale 复本。
- `.claude/agents/` — 三个项目专属子代理定义:
  - `web-ui-route-reviewer.md` — 对照 SSRF、CSP、净化器、父项目写入契约、约定、测试为新路由把关。
  - `spa-view-reviewer.md` — CSP 安全 DOM、i18n、路由注册、无障碍。
  - `test-isolation-reviewer.md` — 验证测试在 CI 中隔离(无父项目假设、无实时网络、无端口冲突)。
- `.claude/commands/` — 斜杠命令存根:`/sdd-status`、`/codebase-tour`。
- `docs/` 树 — 全英文:
  - `PROJECT.md` — 是什么 / 为何 / 给谁、范围、约束、成功标准。
  - `ROADMAP.md` — 当前里程碑 + 完成历史 + backlog。
  - `sdd/SDD-GUIDE.md` — discuss → spec → plan → execute → verify → review 管道映射到 `gsd-*` skill。
  - `sdd/CONVENTIONS.md` — 模块系统、命名、路由、净化器、客户端模式、i18n、错误、日志、测试、提交、分支、CSS。
  - `architecture/OVERVIEW.md` — 顶层图、分层、启动顺序、不变量、"先看哪里"备忘单。
  - `architecture/SERVER.md` — `server/lib/*.mjs` 的逐文件地图(为 P-2 拆分更新)。
  - `architecture/FRONTEND.md` — SPA 结构、视图目录、全局变量、"如何添加一个视图"。
  - `architecture/API.md` — 每个 `/api/*` 路由的完整清单。
  - `architecture/DATA-FLOWS.md` — 每次父项目读/写,带显式用户操作契约。
  - `reviews/REVIEW-2026-05-07.md` — 产出本变更日志修复的静态评审。

### 🔒 安全与仓库卫生

- **`chore(.gitignore): 全面的纵深防御模式`** — 覆盖 env 变体、IDE 文件夹、GSD 临时(`.planning/`)、每用户代理设置(`.claude/settings.local.json`、`.claude/cache/`、`.claude/state/`、`.claude/memory/`)、Playwright 工件(`playwright-report/`、`test-results/`、`.playwright/`、`trace.zip`)、堆/CPU profile、未发布工具的锁文件、扩展的 macOS Finder 噪声、通用密钥模式(`secrets.json`、`credentials.json`、`*.pem`、`*.key`)。

### 🧪 测试

- **283 个单元测试**(原 277):+6 个新(B1 重定向拒绝 4 个、`hasGeminiKey` 1 个、`runAnthropic` 日志守卫 1 个)。
- **5 个 Playwright 浏览器 smoke 测试**(新增,通过 `npm run test:e2e:browser` opt-in):仪表板渲染 + 版本页脚、仪表板 → scan → pipeline → cv 导航、语言切换持久化、404 视图、health 页面渲染。通过父项目的 `node_modules` 解析 Playwright — 不增加新依赖。
- 覆盖率保持约 93% 行 / 约 83% 分支。

### 📝 新 / 更新的 package.json 脚本

| 脚本 | 用途 |
|---|---|
| `npm run test:e2e:browser` | 在进程内服务器上运行 Playwright smoke 装置(5 个测试)。 |

### 🔧 修改的文件

```
+ CLAUDE.md                                    +  .aiignore
+ docs/PROJECT.md                              +  docs/ROADMAP.md
+ docs/sdd/SDD-GUIDE.md                        +  docs/sdd/CONVENTIONS.md
+ docs/architecture/OVERVIEW.md                +  docs/architecture/SERVER.md
+ docs/architecture/FRONTEND.md                +  docs/architecture/API.md
+ docs/architecture/DATA-FLOWS.md              +  docs/reviews/REVIEW-2026-05-07.md
+ .claude/agents/web-ui-route-reviewer.md      +  .claude/agents/spa-view-reviewer.md
+ .claude/agents/test-isolation-reviewer.md
+ .claude/commands/sdd-status.md               +  .claude/commands/codebase-tour.md
+ server/lib/security.mjs                      +  server/lib/prompts.mjs
+ server/lib/store.mjs
+ server/lib/routes/scan.mjs                   +  server/lib/routes/runners.mjs
+ server/lib/routes/content.mjs
+ tests/playwright-smoke.mjs

~ .gitignore                                   ~  README.md (badge fix)
~ package.json (1.7.2 → 1.8.0)
~ server/index.mjs (1230 → 762 LOC)
~ server/lib/runner.mjs (SIGKILL escalation, max-runtime cap)
~ server/lib/anthropic.mjs (hasGeminiKey)
~ server/lib/parsers.mjs (URL gate in addPipelineUrl)
~ server/lib/ru-scanner.mjs                    ~  server/lib/en-scanner.mjs
~ server/lib/sources/{hh,habr,greenhouse,ashby,lever}.mjs (signal threading)
~ tests/anthropic.test.mjs                     ~  tests/i18n-coverage.test.mjs
~ tests/pipeline-preview.test.mjs
```

---

## [1.7.2] — 2026-05-04

**Help center、UI 内 App 设置、移动侧栏、单一 Scan 按钮,以及每个提示词构造器上的 "Show result" 快捷按钮。**

### ✨ 新功能

- **`feat(help): 应用内用户指南` (`/#/help`)** — 通过新侧栏入口访问的长文本 Markdown 文档。逐页覆盖:快速开始、CV 编辑器、Profile、Scan 过滤器、Pipeline 预览、Evaluate、Deep research、Apply、Tracker、Reports、全部 7 个 mode、Activity log、Health、安装提示。从 `<h2>` 自动构建吸顶目录,DOM 同步构建(无竞态)。在 8 个支持语言中本地化。
- **`feat(config): UI 内 App 设置页` (`/#/config`)** — 在浏览器中编辑 `ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL`、`GEMINI_API_KEY`、`GEMINI_MODEL`、`HH_USER_AGENT`、`PORT`、`HOST`。写入**父项目**的 `.env` 文件,以便 career-ops Node 脚本和 web-ui 的 dotenv 加载器拿到同一来源。密钥在读取时被掩码(前/后 4 个字符)。模型字段是带精选列表的下拉框(claude-sonnet-4-6 / claude-opus-4-7 / claude-haiku-4-5 / gemini-2.0-flash 等)。空值删除该键。值立即应用到运行中的 process.env — 多数设置无需重启。
- **`feat(modes): "⚡ Show result" 按钮与 "Copy prompt" 并列`** — 当 manual 模式生成了提示词,用户不必重新输入即可得到 LLM 结果。新按钮以 `run: true` 重新提交同一表单,无密钥时跌入清晰 toast(`Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env first`)。适用于 `/#/deep`、`/#/project`、`/#/training`、`/#/followup`、`/#/batch`、`/#/contacto`、`/#/interview-prep`、`/#/patterns`。

### 🐛 UX + UI 修复

- **`fix(scan): 单一 Scan 按钮替代三个(Scan all + EN + RU)`** — 选择过多,在 99% 情况下默认一致。统一的 `🌐 Scan` 按钮运行所有启用源。8 个语言的 help 文档更新。
- **`fix(ui): 移动侧栏抽屉`** — 视口 <900px 现在在顶部栏获得汉堡按钮(☰);`body.sidebar-open` 切换一个把侧栏滑入的 CSS transform。背景变暗 + 任意点击关闭。锚点点击 + hashchange 自动关闭,用户落在新页面时抽屉已收起。较大视口不变。
- **`fix(server): 页脚版本反映 web-ui,而非父项目 VERSION`** — `/api/health` 现在读取 web-ui 自己的 `package.json`。页脚不再泄漏来自父项目版本文件的过期 `1.6.0`。父项目 VERSION 仍作为 `parentVersion` 单独提供。

### 📦 新 REST 端点

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET`  | `/api/help/:lang` | 返回所请求语言的 Markdown 用户指南,回落到 `en.md`。路径遍历安全。 |
| `GET`  | `/api/config` | 返回所有已知 env 键的当前值;密钥已掩码。 |
| `POST` | `/api/config` | 把给定键写入父项目的 `.env`,校验每个值,实时应用到 `process.env`。 |

### 🌐 i18n

- 跨 `nav.help`、`nav.config`、`help.*`、`config.*`、`deep.showResult`、`deep.needKey`、`scan.btnRun` 新增 30+ 个键。8 个语言全部填充。

### 🧪 测试

- `tests/help.test.mjs`(12 个用例) — 每个支持语言返回实质 markdown,EN 对每个页面 slug 点检,未知 lang → EN 回落,路径遍历净化,每个语言引用 `cv.md` / `profile.yml` / `.env`。
- `tests/help-ui.test.mjs`(9 个用例) — 视图文件注册、侧栏入口、每个语言存在 i18n 键、每个语言存在 docs 文件、EN/RU help 含 14 个权威章节、每个 #/foo 路由被覆盖、deep + mode-page 上的 Show-result 接线。
- `tests/env-config.test.mjs`(18 个用例) — `parseEnv`、`maskSecret`、`validateConfig`、`updateEnvFile`(初始化、原地重写保留注释、空值删除、必要时加引号)的纯函数测试。
- `tests/config-endpoint.test.mjs`(8 个用例) — GET 掩码密钥 / 返回 env 路径;POST 写入父项目 .env;实时 process.env 应用;空值取消设置;以 400 拒绝未知键 + 畸形 Anthropic 密钥。

### 📊 统计

- **测试:**233 → **277**(跨 4 个新测试文件 +44)。
- **E2E:**20 smoke + 23 comprehensive = 43 个 Playwright 步骤,全绿。
- **覆盖率:**93.5% 行 / 82.6% 分支 / 93.7% 函数(不变 — 新代码完全测试)。

---

## [1.7.1] — 2026-05-04

**补丁发布,叠加 v1.7.0 之后的工作:**pipeline 预览面板、Anthropic API 集成、可滚动侧栏、dotenv 加载器、动态 Active-companies 列表、CI 工作流加固。

### ✨ Pipeline 预览面板

- **`/#/pipeline` 大改** — 左侧列表 + 右侧预览面板。点击任意 URL 获取服务端代理快照(`GET /api/pipeline/preview` 剥离脚本/样式/标签,8 KB 上限,通过 `isValidJobUrl` 校验)。实时筛选输入、"In queue" 计数器、⚡ "Evaluate first" 头部按钮。每行内联 ▶/✕,预览面板上提供完整 Evaluate / Open in tab / Delete。稳定测试选择器:`data-url` + `.pipeline-row` + `.pipeline-row-delete` 类。**`tests/pipeline-preview.test.mjs` 新增 8 个测试**(mock fetch,无需上游绑定)。

### ✨ Anthropic API 集成 — 处处 "Run live"

- **`server/lib/anthropic.mjs`** — Anthropic Messages API 的零依赖客户端(默认 claude-sonnet-4-6,通过 `ANTHROPIC_MODEL` 覆盖)。设置 `ANTHROPIC_API_KEY` 后,每个 mode 页(`/#/deep`、`/#/project`、`/#/training`、`/#/batch`、`/#/contacto`、`/#/interview-prep`、`/#/patterns`)渲染 "⚡ Run live (Anthropic)" 按钮作为**主要**动作 — 点击执行提示词并把 Markdown 渲染回浏览器,而非交给 Claude Code。当只配置 Gemini 密钥时它仍是兜底。manual 模式无密钥也能工作。**`tests/anthropic.test.mjs` 新增 8 个测试**。

### 🐛 CI / 管道修复

- **`fix(api): 收紧 pipeline URL 校验器`(FIX-M7)** — 现在也拒绝 loopback 主机名、长度 <10 或 >2000、URL 中含空白。
- **`fix(server): 真正加载 .env 以便 HH_USER_AGENT / GEMINI_API_KEY 提示生效`** — 在 `server/index.mjs` 顶部接入 `server/lib/dotenv.mjs`(35 行零依赖加载器)。扫描器代码中的运行时提示终于有用了。**6 个新测试**。
- **`fix(ui): 可滚动侧栏`** — 6 组中的 18 个导航项在较短视口溢出。`.sidebar` 现在 `overflow-y: auto`,带细的自定义滚动条样式。
- **`fix(ui): 让 HH_USER_AGENT 横幅可关闭`** — 然后在我们意识到它过度后从 `/scan` 完全移除。Health 页面检查仍呈现。
- **`fix(scan): Active companies 列表现在可折叠 + 可过滤 + 分组`** — 87 个标签平铺过于震撼。现在一个 "▸ Active companies 87/71" 切换展开一个有序列表(✓ API 支持优先,○ websearch 次之)加一个搜索过滤器。
- **`fix(test): api.test.mjs + en-scanner.test.mjs 与父项目隔离`** — 两个都启动临时项目根,以便 CI 在父项目未与 web-ui 并排检出时也能工作。
- **`fix(workflow): publish-package 版本匹配仅在 release 事件**`** — 来自 main 的 `workflow_dispatch` 不再因 tag/version 检查失败。
- **`fix(e2e): pipeline 行删除的稳定选择器`** — 恢复 anchor 包裹 + 增加 `data-url` 属性,e2e 套件选择器稳定。

### 📦 新 REST 端点

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/pipeline/preview?url=…` | 服务端代理:返回 URL 的可见文本快照(脚本/样式剥离,8 KB 上限),由 `isValidJobUrl` 把关。 |

### 📊 本批之后的统计

- **测试:**225 → **233**(在 v1.7.0 之上多 8 个)。
- **测试文件:**25 → **26**。
- **E2E:**20 + 23 = 43 个 Playwright 步骤,全绿。

---

## [1.7.0] — 2026-05-03

**由 QA r5 驱动的 35 提交加固 + UX + 功能完成复核。** 三个安全层落地(XSS 净化、CSP、输入校验),每个缺失的 CRUD 端点都被填上,父项目引导完全自动化,UI 获得 **9 个新页面** — Activity、重设计的 Deep Research,以及 7 个侧栏分组 mode(project / training / followup / batch / outreach / interview-prep / patterns),覆盖父项目 `modes/` 的 100%。Pipeline 获得服务端预览面板。Anthropic API 集成让 "Run live" 跨所有 mode 一键完成。测试覆盖从 **73** → **225**,跨 **25 个测试文件**,加上 **23 个 comprehensive Playwright e2e 步骤**。GitHub Actions 上线 CI / AI review / Release / Publish-Package 工作流。

### 🔒 安全

- **`fix(cv): 净化 CV markdown 以阻断预览中的存储型 XSS`(FIX-C10)** — `PUT /api/cv` 在写入 `cv.md` 之前剥离 `<script>`、`<iframe>`、`<object>`、`<embed>`、`<style>`、`<form>`、`<svg>`、`on*=` 事件处理器,以及 `javascript:`/`vbscript:`/`data:text/html` URI。body 上限 1 MB(溢出 413)。客户端 `UI.md()` 被重写为在任何 markdown 转换前先转义每个字节,使原始 HTML 永远无法到达 `innerHTML`。链接 `href` 属性按安全 schema 白名单校验(`http`/`https`/`mailto`/`tel`/相对 + 仅 `data:image`)。剥离辅助与 HTTP 往返合计 17 个新测试。
- **`fix(server): 增加 CSP 与基础安全头`(FIX-L2)** — 每个响应现在携带 `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: same-origin`。当服务器绑定到 loopback 之外(`HOST` ≠ `127.0.0.1`/`::1`/`localhost`)时,叠加严格的 `Content-Security-Policy`:`default-src 'self'`、`script-src 'self'`(无 `unsafe-inline`)、Google Fonts 白名单、`connect-src 'self'` 阻断 XSS 数据外泄。`index.html` 与 `router.js` 中的内联 `onclick` 处理器迁移到 `addEventListener`,以保持严格 CSP 完整。跨 5 个不同 `HOST` 值守门 CSP 的 8 个新测试。
- **`fix(api): 收紧 pipeline URL 校验器`(FIX-M7)** — `POST /api/pipeline` 此前接受 `"not-a-url"` 并持久化。现在 `isValidJobUrl()` 拒绝裸字符串、输入 <10 或 >2000 字符、含空白的 URL、非 `http(s)` schema,以及 loopback 主机名(`localhost`/`127.0.0.1`/`::1`)。合并 **FIX-M3** + **FIX-M6**(无效返回 400,成功携带 `deduped` 标志)。
- **`fix(server): 真正加载 .env 以便 HH_USER_AGENT / GEMINI_API_KEY 提示生效`** — 运行时此前告诉用户 "在 .env 中设置 HH_USER_AGENT" 但服务器从不读取该文件,所以照做无效。新增 35 行零依赖 dotenv 加载器(`server/lib/dotenv.mjs`),在 `server/index.mjs` 顶部接入。命令行设置的 process-env 值仍然优先,以免遮蔽既有 CI 覆盖。父项目 `.env.example` 现在包含带真实 Chrome User-Agent 示例的 `HH_USER_AGENT` 文档块。6 个新测试。
- **`fix(api): 在提示词组装前净化 JD`(FIX-M5)** — `POST /api/evaluate` 在调用 Gemini 或回显提示词前,剥离 ANSI 转义、控制字节、内联 `<script>` 标签并修剪空白。50 KB 长度上限。50 字符下限对**净化后**的文本运行,因此包含大量转义但表面够长的注入企图会快速 400。
- **`fix(health): 当 HOST!=loopback 时掩码 Node 版本 + 项目根`(FIX-M1)** — `/api/health` 不再在 LAN 暴露的部署上指纹化主机。loopback 响应保留这些值用于本地诊断。

### ✨ 新功能

- **`feat: 7 个新侧栏 mode + 分组侧栏`(FIX-C8)** — 覆盖父项目 `modes/` 目录的 100%,UI 无空缺。新路由:`#/project`(作品集项目顾问)、`#/training`(课程 / 证书评估)、`#/followup`(逐申请节奏)、`#/batch`(并行 URL 处理)、`#/contacto`(LinkedIn 外联草稿器)、`#/interview-prep`(分阶段准备)、`#/patterns`(拒绝模式分析器)。7 个 mode 共用一个配置驱动的视图工厂(`public/js/views/mode-page.js`)以及一个通用端点 `POST /api/mode/:slug` — 未来增加新 mode 是一行配置 + 一块 i18n。侧栏重新组织为 6 组:Sourcing / Decision / Application / Networking / Analytics / Setup。总计 18 个导航项。`tests/modes-endpoints.test.mjs` 新增 12 个测试。
- **`fix: 引导父项目依赖 + russian_portals 默认`(FIX-C4 + C9 + C12 + H2)** — `bin/start.sh` 现在在全新克隆上安装父项目 `node_modules`(js-yaml、playwright、jsdom)以及 `npx playwright install chromium`,使 `/api/stream/scan`、`/pdf`、`/liveness` 开箱即用。`createApp()` 在每次启动时探测 `portals.yml` — 若缺失 `russian_portals:` 块,追加一个带注释的默认。幂等:第二次启动是空操作。3 个新测试。
- **`fix: 在模板与 health-check 脚本中禁用 9 个失效 portal slug`(FIX-C3)** — `templates/portals.example.yml` 现在把 Ada / Factorial / Tinybird / Weights & Biases / Travelperk / Clarity AI / Forto / Vinted / Runway 标为 `enabled: false`(每条带内联原因注释)。新装扫描 **87** 个存活公司而不是 96。新的 `web-ui/scripts/portals-health-check.mjs` HEAD 探测每个启用的 `careers_url`,并以建议补丁列表(`--json` 输出 JSON)报告 DEAD 条目。3 个新测试。
- **`feat(activity): 用户操作日志 + Activity 侧栏页`** — 每个状态改变的 API 请求都被捕获到 `data/activity.jsonl`(时间戳、动作动词、目标、成功标志、可选细节)。新的侧栏入口 **Activity** 带动作前缀 chip 过滤器(pipeline / cv / jd / evaluate / scan / stream / script)、动作 ✓/✗ 徽章以及刷新按钮。5 MB 自动轮转。10 个新测试覆盖中间件、读取过滤、容错坏行,以及 `GET /api/activity` 自身的递归守卫。
- **`feat(deep): 在浏览器中查看 Deep Research + 已存结果归档`** — Deep Research 页面现在 (a) 在 `{ run: true }` 且 `GEMINI_API_KEY` 已设置时通过 Gemini 实时运行提示词,把输出持久化到 `interview-prep/{slug}.md`;(b) 把每个已存的 deep-research 文件列为可点击卡片,带相对时间戳;(c) 把结果渲染为 Markdown,每个结果带 **📋 复制 / ⬇ 下载 .md / ↗ 新标签打开** 动作。新 REST 表面:`GET /api/interview-prep`、`GET /api/interview-prep/:name`、`DELETE /api/interview-prep/:name`。7 个新测试。
- **`feat(cv): 在浏览器中生成 + 下载 PDF,带 PDF 归档`** — CV 页面新增 **📄 Generate PDF** 按钮,在 modal 控制台中流式 `/api/stream/pdf`。遇 `ERR_MODULE_NOT_FOUND` / `playwright` 错误时呈现可复制粘贴的引导命令。新的 "Generated PDFs" 章节在每次成功后自动加载,列出每个 `output/*.pdf`,带 **↗ 打开** 和 **⬇ 下载** 按钮。新 REST 表面:`GET /api/output/pdfs`、`GET /api/output/pdfs/:name`。6 个新测试。
- **`feat(api): POST /api/tracker — 从 UI 追加行`(FIX-H8)** — 从浏览器向 `data/applications.md` 追加规范化行。校验 company + role,按 `templates/states.yml` 归一化 status,自动递增零填充 `#`,按 company+role 去重(大小写无关),为 notes 转义竖线以免 markdown 表破裂。文件为空时初始化表。6 个新测试。
- **`feat(api): DELETE /api/jds/:name`(FIX-H4)** — 在不 shell out 的情况下删除已存 JD。路径遍历字符在任何文件系统操作前被剥离;参数必须以 `.txt` 结尾。5 个新测试,包括 `../../etc/passwd` 拒绝。
- **`feat(api): POST /api/evaluate/test-gemini`(FIX-H7)** — smoke 测试端点,通过 `gemini-eval.mjs` 跑一个 50 字符虚拟 JD,使用户可在不经历真实评估的情况下验证 API 密钥工作。返回 `{ ok, code, sampleLength, sample }`。

### 🐛 错误修复

- **`fix(router): catch-all 404 视图 + i18n 覆盖守卫`(FIX-C7)** — 未知 hash 路由此前静默回落到仪表板,掩盖了笔误和断书签。现在 `#/totally-random-xyz` 渲染专门的 404 页面,引述错误路径并链接到仪表板。404 视图在路由器 IIFE 内部注册,所以不能与任何用户路由冲突。新的 `tests/i18n-coverage.test.mjs` 在 `vm.Context` 内运行 `i18n.js`,带桩 `window`,暴露私有 `DICT`,并断言 173+ 键 × 8 个语言每一个都被填充且非空。4 个新路由器测试。
- **`fix(router): 别名 #/profile → settings`(FIX-C2)** — 内部路由名是 `settings`(`nav.settings` 渲染为 "Profile"),但外部链接和肌肉记忆走 `#/profile`。现在两个地址都到达同一视图,侧栏导航项无论哪种都点亮。2 个新测试。
- **`fix(health): 统一 Health/Doctor + 标记模板 profile`(FIX-C6 + FIX-H6)** — Health 与 Doctor 此前是两个真实来源。现在 `/api/health` 暴露 Doctor 报告的一切(父项目依赖、Playwright、目录、profile 已自定义、`HH_USER_AGENT`)。`Profile customized` 检查侦测占位名(`Jane Smith`、`Alex Doe`、`John Doe`、`Your Name`、`Test User`)以及显式 YAML 解析错误。4 个新测试。
- **`fix(scan): 在 RU 配置中查询 ↔ 否定碰撞时警告`(FIX-H3)** — 当 `portals.yml` 中 `"PHP"` 出现在 `title_filter.negative` 而查询又针对 Senior PHP 时,所有匹配都被过滤,用户看到零结果。`loadConfig()` 现在计算 `warnings` 数组;`runRuScan()` 在扫描启动前把每条警告作为 SSE stderr 行发出。2 个新测试验证开箱默认对 PHP 友好。
- **`fix(scan): 当 HH_USER_AGENT 未设置时警告`(FIX-H1)** — `/scan` 页面探测 `/api/health`,在动作行上方显示黄色警告卡片(当 `HH_USER_AGENT` 为空时),让用户在点击 RU 扫描**之前**知道 hh.ru 的 403。
- **`fix(api): 当 POST /api/jds 的 slug 被剥离不安全字符时警告`(FIX-M2)** — 剥离危险字符的 slug 归一化现在返回 `warning` 字段;纯大小写/空白清理保持静默。净化后为空时返回 400。
- **`fix(ui): 路由变化时清除全局搜索 + 按钮 spinner`(FIX-M4 + FIX-L1)** — 全局搜索输入在 `hashchange` 时清除(对正在输入有守卫)。新的 `UI.withSpinner(button, fn)` 助手把加载状态、ARIA 与双击防御接入每个异步按钮点击。已被 Doctor / Verify / sync-check / Save CV / Normalize / Dedup / Merge 按钮采用。
- **`fix(ui): 让侧栏可滚动,使 18 个导航项总能到达页脚`** — FIX-C8 的分组侧栏在较短视口溢出;底部项(Activity / Health)被裁掉。`.sidebar` 现在 `overflow-y: auto`,带细的自定义滚动条样式(WebKit + Firefox)。页脚通过既有的 `margin-top: auto` 保持钉在底部。
- **`fix(ui): 空 modal 标题占位`(FIX-H9)** — `index.html` 中硬编码英文 `"Title"` 字符串已消失,关闭了 modal 打开期间它短暂可见的竞态窗口。

### 🌐 i18n

- 跨 8 个支持语言(`en`、`es`、`pt-BR`、`ko`、`ja`、`ru`、`zh-CN`、`zh-TW`)的 173+ 翻译键。所有语言新增键用于:404 页、活动日志、deep research、PDF 流、安全警告、tracker 修改、apply 重命名。覆盖率现在由 `tests/i18n-coverage.test.mjs` 强制 — 每个键必须在每个支持语言中有非空值,否则 CI 失败。

### ⚙️ DevOps

- **测试数:**73 → **201**(跨 23 个测试文件 +128 个测试)。剩余的一个失败测试(`runEnScan: dry-run end-to-end across multiple sources`)是依赖 Greenhouse/Ashby/Lever 实时 API 响应的既存 flake。
- **Comprehensive Playwright e2e**(`tests/e2e-comprehensive.mjs`,23 步):走完完整用户旅程 — CV 保存 → 预览 → PDF 生成 → 全部 7 个新 mode → tracker 过滤器 → 活动日志 → 404 → modal ESC → 侧栏滚动 → Ctrl-K 聚焦 → 搜索清除 → profile 别名 → 语言持久化。
- **GitHub Actions**(`.github/workflows/`):
  - `ci.yml` — Node 18/20/22 矩阵上的单元 + 集成测试,以及 i18n 覆盖守门(每键 × 8 个语言必须非空),以及每个 PR 上完整的 Playwright e2e。
  - `ai-review.yml` — 每个 PR 上的 Claude Code AI 评审。维护者保留合并权;Claude 只建议。通过 `skip-ai-review` 标签跳过。
  - `release.yml` — `v*.*.*` tag 推送时自动发布 GitHub Release;release notes 从 `CHANGELOG.md` 切片,使全部 8 个语言版本保持权威来源。
- **CSP 友好 UI:**`index.html` 与 `router.js` 中所有内联 `onclick` 处理器移除。严格 `script-src 'self'` 策略现在可强制执行,任何功能都不破坏。

### 📦 新 REST 端点

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET`    | `/api/activity`                  | 列出用户操作事件,最新优先 |
| `GET`    | `/api/interview-prep`            | 列出已存 Deep Research 文件 |
| `GET`    | `/api/interview-prep/:name`      | 读取单个 Deep Research 文件 |
| `DELETE` | `/api/interview-prep/:name`      | 删除 Deep Research 文件 |
| `GET`    | `/api/output/pdfs`               | 列出生成的 PDF |
| `GET`    | `/api/output/pdfs/:name`         | 作为附件流式 PDF |
| `POST`   | `/api/tracker`                   | 向 `applications.md` 追加行 |
| `DELETE` | `/api/jds/:name`                 | 删除已存 JD |
| `POST`   | `/api/evaluate/test-gemini`      | smoke 测试 Gemini API 密钥 |
| `POST`   | `/api/mode/:slug`                | 7 个新 mode 的通用提示词构造器(project / training / followup / batch / contacto / interview-prep / patterns) |

---

## [1.6.0] — 2026-05-02

**Web UI 的初版公开发布。** 该基线的功能清单见 `README.md`。
