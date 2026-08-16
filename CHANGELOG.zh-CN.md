# 变更日志

**career-ops-ui** 的所有重要变更均记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

翻译版本:[🇬🇧 English](CHANGELOG.md) · [🇪🇸 Español](CHANGELOG.es.md) · [🇧🇷 Português](CHANGELOG.pt-BR.md) · [🇰🇷 한국어](CHANGELOG.ko-KR.md) · [🇯🇵 日本語](CHANGELOG.ja.md) · [🇷🇺 Русский](CHANGELOG.ru.md) · [🇹🇼 繁體中文](CHANGELOG.zh-TW.md) · [🇫🇷 Français](CHANGELOG.fr.md) · [🇵🇱 Polski](CHANGELOG.pl.md) · [🇺🇦 Українська](CHANGELOG.uk.md) · [🇩🇰 Dansk](CHANGELOG.da.md) · [🇸🇦 العربية](CHANGELOG.ar.md) · [🇩🇪 Deutsch](CHANGELOG.de.md) · [🇮🇹 Italiano](CHANGELOG.it.md) · [🇹🇷 Türkçe](CHANGELOG.tr.md) · [🇮🇳 हिन्दी](CHANGELOG.hi.md)

> **说明** — 本文件已完整翻译为出版级简体中文(中国大陆用语规范),包含全部历史版本条目。代码块、提交信息、文件路径、URL、环境变量、命令行片段以及 CSP / SSRF / TOCTOU / WCAG / ATS / JD / SSE / REST / API 等通用英文缩写按原文保留。

---


## [1.207.2] — 2026-08-16

**修复 — AI 计划和职业方向画像不再显示为原始代码转储。**

### 修复
- 有些模型会把整个回答包在 ```markdown … ``` 代码围栏里。发生时，**发展计划**和**方向画像**会显示为等宽代码块，而不是带标题和列表的文档。现在会去掉这层外围栏——仅当它包住整个回答且语言明确为 `markdown`/`md` 时，因此真正的 `python`/`js`/无语言 ``` 代码回答保持不变。

### 说明
- 在共享的 LLM 清理步骤（`cleanLlmMarkdown`）里一次处理，所有 AI 路由都受益，被包住回答内部的代码块也会保留。`tests/llm-output.test.mjs`（+3）。测试套件：**2621**。



## [1.207.1] — 2026-08-16

**修复 — 在小屏手机上着陆页不再向右溢出。**

### 修复
- 在窄屏手机上，首屏（标题、简介行和安装终端）可能被右边缘裁掉，因为过长的安装命令和布局列不会收缩到屏幕。现在它们能适配任意宽度；安装命令在其终端框内横向滚动。

### 说明
- 还加固了一项不稳定的端到端冒烟检查，它可能因资源的瞬时 404 而失败：现在它像相邻检查一样忽略无害的网络噪声（favicon／连接／资源加载失败），同时仍能捕获真正的脚本错误。应用行为未变。测试套件：**2618**。



## [1.207.0] — 2026-08-15

**新增 — 直接在追踪表中记录一次申请的结果。**

### 新增
- 每一行追踪记录都新增了**结果**操作：选择发生了什么（被拒、收到 Offer、录用、拒绝 Offer、无回复、进入面试），加一条可选备注，**预览**结果状态，然后记录。记录会归档已提交的简历和求职信文件，并把追踪表同步到规范状态——一次确定性的操作，而不是手动编辑追踪表。

### 说明
- 新的 `POST /api/outcome` 中继结果 CLI：`dryRun:true` 是只读预览（匹配该行、报告结果状态、不写入任何内容），真实调用才会记录。写入安全：结果类型被限制在已知集合内，且每个文本字段在调用外部命令前都会拒绝控制字符（数组参数、spawn——无 shell）。`tests/outcome-route.test.mjs`。测试套件：**2618**。



## [1.206.0] — 2026-08-15

**文档 — 应用内帮助指南现已用全部 17 种语言覆盖最新的五项功能。**

### 新增
- 内置帮助指南，以及据其作答的「问帮助」助手，现在记录了最近上线的五项功能：**设置体检**（设置 — 检查你的简历与档案是否有缺漏和残留的示例数据）、**发现 ATS 招聘板**（门户 — 自动找到某公司的招聘板）、**「还在招吗?」检查**（追踪 — 职位是否仍开放）、**「复用旧简历?」提示**（简历工作室 — 当已定制的简历适配新职位时提醒）以及**技能日志**（分析 — 记录自评分数）。五个新小节，已翻译为全部 17 种语言。

### 说明
- 帮助结构增至 31 个 H2 / 118 个 H3，各语言均有一致性校验。参考文档已刷新：`docs/architecture/API.md` 记录了这些功能的五个路由，`CLAUDE.md` 与 `docs/sdd/CONVENTIONS.md` 中的路由/版本计数已是最新（36 个路由模块）。测试套件：**2610**。



## [1.205.0] — 2026-08-15

**新增 — 记录练习测试/评估结果的技能日志。**

### 新增
- 新增**技能日志**（分析 → 技能日志），可记录一次自评——公司、平台、技能、分数 % 及可选备注——追加到 `data/assessments.tsv`，并按最新在前列出历史记录。零 token、确定性；文件格式由父项目 CLI 掌管。

### 说明
- 新增 `GET /api/assessments`（中继 `assessment-log.mjs` 的默认 JSON 列表；柔性失败 `{available:false}`）+ `POST /api/assessments`（显式写入：字段作为**数组参数**传给 `assessment-log.mjs add`）。写入安全：任何含控制字符的文本字段都会被拒（TAB 会破坏列、换行会注入行）→ 写入前 400；分数/阈值限定 0–100，长度受限。`tests/assessments-route.test.mjs`。测试套件：**2610**。


## [1.204.0] — 2026-08-15

**新增 — 设置中的"配置体检"面板，标记不完整或残留示例数据的 CV/资料。**

### 新增
- **设置 → 配置体检**现在零 token 检查你的 `cv.md` 和 `config/profile.yml`，列出**阻断问题**（缺失的文件/字段）与**警告**（残留的示例/占位数据、硬编码指标）——让你在不完整的配置削弱扫描与定制之前发现它。只读，一键重跑。

### 说明
- 新增只读的 `GET /api/cv-sync-check`，中继父项目的 `cv-sync-check.mjs`（输出人类可读文本 + 退出码，无 `--json`）；路由对其稳定的 `ERROR:` / `WARN:` 行做轻量解析为 `{ok, errors[], warnings[]}`——由横幅而非退出码判定成功。独立安装时以 `{available:false}` 柔性失败。`tests/cv-sync-check-route.test.mjs`。测试套件：**2602**。


## [1.203.0] — 2026-08-15

**新增 — CV Studio 中的"复用过往简历？"提示。**

### 新增
- 在 **CV Studio** 打开一份已保存的岗位描述时，应用现在会将其与你其他已保存的岗位对比（确定性的词语重叠，**零 token**），并告诉你最相近的一个是否足以**复用**那份定制简历、**改一改再用**，还是**重新定制** —— 免得为已经投过的岗位从头再来。

### 说明
- 新增只读的 `GET /api/jds/:name/reuse`，中继父项目的 `jd-similarity.mjs`（Jaccard 重叠 + 资历守卫；JSON `{decision, score, reason}`），对每个过往岗位各调用一次（扇出上限 25，取最佳匹配）；脚本或过往岗位缺失时以 `{available:false}` 柔性失败。`tests/jd-similarity-reuse-route.test.mjs`。测试套件：**2594**。


## [1.202.0] — 2026-08-15

**新增 — 在 #/portals 中发现公司的 ATS 招聘板并开始追踪。**

### 新增
- 在 **#/portals** 输入公司名，应用会在 **Greenhouse、Ashby、Lever** 探测其公开招聘板——**零 LLM、无浏览器**——并显示存在且当前列有 ≥1 个职位的招聘板。点击一次即可把所选招聘板加入扫描器监视的公司。探测为只读；仅当点击**添加**时才写入 `portals.yml`。

### 说明
- 新增 `server/lib/discover-ats.mjs`（固定主机、字符集校验的 slug 经 DNS 固定的 `safeGet` 探测，每次请求 ≤12 次）+ `POST /api/portals/discover`（只读）与 `POST /api/portals/track`（显式写入：`withFileLock` + 文本拼接 + 重新解析保护 + 原子重命名；仅已知 ATS 主机、幂等）。复用扫描器的适配器注册表确认招聘板并统计职位。i18n ×17。`tests/discover-ats-resolver.test.mjs` + `tests/discover-ats-route.test.mjs`。测试套件：**2588**。


## [1.201.0] — 2026-08-15

**修复 — 使用本地化或变体列标题的跟踪器不再显示为空白。**

### 修复
- 如果你的 `data/applications.md` 使用非英文或变体标题——西班牙语 `empresa` / `puesto` / `estado` / `fecha` / `enlace`，或 `position` / `stage` / `link`——跟踪器会用错误的键读取，导致 **公司 / 职位 / 状态 / 日期 / 链接列为空**。现在这些标题会折叠到规范字段名，跟踪器正常显示。全英文跟踪器的解析与之前完全一致。

### 说明
- 在 `parseApplications`（`server/lib/parsers.mjs`）中新增 `HEADER_ALIASES` 映射与规范化折叠；未知或已规范的标题原样通过。`tests/tracker-header-aliases.test.mjs`。测试套件：**2563**。


## [1.200.0] — 2026-08-15

**新增 — 在跟踪器中一键查看 ATS 招聘岗位"是否仍在招"。**

### 新增
- 在 **#/tracker** 中，URL 为 Greenhouse / Lever / Ashby / Workday / SmartRecruiters 岗位的申请现在会显示 **"是否仍在招？"** 按钮。点击一次即查询该 ATS 自己的公开 JSON——**零 token、无浏览器**——并显示 **在招 / 已下线 / 未知**，让你无需逐个打开就能发现失效岗位。保守设计：仅明确的 404/410 判为*已下线*，含糊情况保持*未知*（绝不误报*已下线*）。

### 说明
- 新增 `server/lib/liveness-core.mjs` + `liveness-api.mjs`，以及只读的 `GET /api/liveness?url=`（不写入、无 LLM）。防 SSRF：URL 先经 `isValidJobUrl` 校验，ATS API 仅通过 DNS 固定的 `safeGet` 以固定主机 + 字符集校验的路径段访问。`tests/liveness-core.test.mjs` + `tests/liveness-route.test.mjs`。测试套件：**2557**。


## [1.199.0] — 2026-08-15

**修复 — 过宽的表格现在可横向滚动，而不再被截断。**

### 修复
- 在 **Scan** 页面（以及其他所有表格 — 跟踪器、统计、用量、仪表盘）中，比窗口更宽的表格会**被截断且没有滚动条**，导致最右侧的列无法访问。现在过宽的表格会按需显示**横向滚动条**，因此在任何宽度下每一列都可访问。

### 说明
- `public/css/components.css` 中的 `.table-wrap` 由 `overflow: hidden` 改为 `overflow-x: auto`（与现有的 `.reports-scroll` 容器一致）；圆角边框保持不变。`tests/table-wrap-scroll.test.mjs`。测试套件：**2540**。


## [1.198.0] — 2026-08-15

**新增 —— 扫描重试现在采用指数退避、抖动，并尊重限流方的 `Retry-After`。**

### 新增
- 当招聘板在扫描途中短暂限流或出错（HTTP 429 / 5xx）时，重试现在以**指数退避 + 抖动**等待，而非固定的短延迟 —— 这样繁忙的招聘板不会被以相同节奏反复敲打，并发重试也不会同步再次冲撞。招聘板发来的 `Retry-After` 会被**尊重**（但有上限，使恶意的 `Retry-After: 86400` 无法拖住整次扫描）。永久性错误（404、被拒绝的重定向）仍然立即失败 —— 无变化。

### 说明
- 在 `server/lib/http-json.mjs` 中新增 `parseRetryAfterMs()` 与纯函数 `computeRetryDelayMs()`；`fetchJson` 现在在非 ok 响应上捕获 `.retryAfter`，`fetchJsonWithRetry` 接受可选的 `maxDelayMs`（默认 8000）。`tests/http-json.test.mjs` (+9)。测试套件：**2536**。


## [1.197.0] — 2026-08-14

**新增 — 仅凭 `careers_url` 即可追踪 Getro 的 VC 招聘板，集合 id 会自动解析。**

### 新增
- 被追踪的 Getro 招聘板（b2venture、Earlybird、Point Nine …）不再需要手工查找的数字 `getro_collection`。只需提供招聘板自己的 `careers_url`，首次扫描时 id 便会从该页面**自动解析** —— 一次防 SSRF 的安全 GET 直接从页面内嵌数据中读取数字 `network.id`。显式的 `getro_collection` 仍然优先，并会完全跳过该抓取。

### 说明
- 在 `server/lib/sources/getro.mjs` 中新增 `httpsCareersUrl()`、`extractCollectionId()` 与异步的 `resolveCollectionId()`；招聘板页面通过 DNS 固定、大小受限的 `safeGet` 抓取，解析出的 id 仍由 `assertGetroUrl` 将主机锁定为 `api.getro.com`。适配器现在即使没有 id，也能匹配携带 https `careers_url` 的 `provider: getro` 条目。`tests/sources-getro.test.mjs` (+8)。测试套件：**2527**。


## [1.196.0] — 2026-08-14

**修复 (安全) — Workday 适配器按主机名而非子串校验 `api` 端点。**

### 修复
- `portals.yml` 中的 Workday `api:` 值现在只有在其**主机名**为 `myworkdayjobs.com`（或 `.myworkdayjobs.com` 子域）时才被接受。旧检查是子串匹配，因此任何仅包含该字符串的 URL——例如 `https://example.com/?x=myworkdayjobs.com`——都会通过并被当作端点使用。真实的 Workday 端点不受影响。（由 CodeQL 报告，#443。）

### 说明
- 新增 `isWorkdayApi()` 解析 URL 并检查主机（`server/lib/portals/adapters/workday.mjs`）。`tests/workday-adapter-endpoint.test.mjs`（+1）。测试套件：**2522**。


## [1.195.0] — 2026-08-14

**性能 (扫描器) — 在大扫描历史上重复职位检测依然很快。**

### 性能
- 在大的 `scan-history.tsv` 上，重复职位检测不再退化为 O(N²)。此前按公司的标题分组是一个嵌套循环，对每一对都执行完整的 `roleFuzzyMatch`；现在改为倒排索引——一次遍历按精确标题分桶，然后仅对共享判别性（非基线）词元的不同桶做模糊匹配。**输出完全相同**——相同的重复职位聚类——通过对旧算法在 200+ 随机历史上的差分测试证明。

### 说明
- `server/lib/detect-reposts.mjs` 中的 `groupRowsByTitle`（为差分测试导出）。`tests/detect-reposts-grouping.test.mjs`（+2）。测试套件：**2521**。


## [1.194.0] — 2026-08-14

**修复 (扫描器) — 单段 URL 的 Workday 招聘页面现在能正确扫描。**

### 修复
- Workday 适配器现在能解析路径为单个段的招聘 URL——例如 `https://parsons.wd5.myworkdayjobs.com/Search`、`.../KBR_Careers`、`.../Careers`。此前站点会退回 `External`，适配器打到错误的 CXS 端点，探测看似正常却什么都不返回。现在取路径第一个非空段作为站点（丢弃 `en-US` 之类的语言前缀）；文档中的 `/en-US/External` 情形不变。（见 #255。）

### 说明
- `server/lib/portals/adapters/workday.mjs` 中的结构化路径解析。`tests/workday-adapter-endpoint.test.mjs`（+5）。测试套件：**2519**。


## [1.193.0] — 2026-08-14

**新增 (统计) — 一个显示值得提醒的面试的“面试后无回应”标签。**

### 新增
- `#/stats` 中的**面试后无回应**标签：超过礼貌等待期（默认 30 天）后陷入沉默的面试，汇总你进行中的面试与跟踪表——附上每个已沉默多久、最近一次面试日期和原因。一份温和的提醒/收尾清单；仅为建议，绝不断言被拒。零 token。

### 说明
- 新增 `GET /api/stats/rejection-latency` 中继（脚本缺失时 `{available:false}`）。`tests/stats-rejection-latency-route.test.mjs`（+2）。i18n 键 +10 ×17；`#/stats` help-hint 由 7→8 个标签。测试套件：**2510**。


## [1.192.0] — 2026-08-14

**新增 (cv-studio) — 一个抓出你从未有过的数字的“核对简历事实”关卡。**

### 新增
- `#/cv-studio` 中的**核对你的简历事实**卡片：粘贴适配的简历或求职信，将其中每个断言的指标和事实与你真实的简历、档案和 two-pager 核对。你会得到 **pass / warn / block** 判定，以及确切的编造指标、无据事实和禁用/警示短语——让生成的简历无法悄悄宣称一个不属于你的数字。零 LLM；不写入任何内容。

### 说明
- 新增 `POST /api/cv-studio/verify-facts` 中继：将文本写入一次性临时文件并运行 `verify-cv-facts.mjs`，即便脚本在 block 时以 1 退出也信任 JSON 判定。`tests/cv-studio-verify-facts-route.test.mjs`（+4）。i18n 键 +15 ×17。测试套件：**2508**。


## [1.191.0] — 2026-08-14

**新增 (统计) — “接下来学什么”标签，为优先学习的技能排序。**

### 新增
- `#/stats` 中的**接下来学什么**标签：跨整个跟踪表的技能缺口汇总——最常拖垮低匹配的缺失技能，按加权（每份评估报告的 5−匹配分）与 **Critical / High / Medium** 层级排序——外加你 CV/档案已覆盖的技能。只读、仅建议、零 token。

### 说明
- 新增 `GET /api/stats/upskill` 中继（数据不足时带 `{ error }` 字段；脚本缺失时 `{available:false}`）。`tests/stats-upskill-route.test.mjs`（+3）。i18n 键 +15 ×17。测试套件：**2504**。


## [1.190.0] — 2026-08-14

**新增 (跟踪表) — “公司历史”面板，告诉你哪些公司真的会回应你。**

### 新增
- `#/tracker` 上的**公司历史**卡片：选择一家公司即可获得只读证据——它对你的回应程度（**对你无回应** / **混合** / **此前有回应**），以及同一职位是否反复**重新发布**——汇总你的跟踪表、跟进与扫描历史。零 token；不调用扫描器。

### 说明
- 新增 `GET /api/stats/company-history[?company=]` 中继（脚本缺失时 `{available:false}`）。`tests/stats-company-history-route.test.mjs`（+3）。i18n 键 +18 ×17。测试套件：**2501**。


## [1.189.0] — 2026-08-14

**修复 (扫描器) — 用罗马数字表示的资历等级现在在非拉丁标题中也能识别。**

### 修复
- `skip_tiers` 背后的层级分类器现在能在**任何文字系统**中读取职位词后的罗马数字等级后缀（I / II / III / IV / V）——"Инженер III"、"エンジニア I"、"Ingénieur IV"——不仅限于 ASCII 词之后。此前，非拉丁词后的等级数字会被忽略，职位落入 **mid**，因此 `skip_tiers: [senior]` 或 `[entry]` 会漏掉这些职位。

### 说明
- `server/lib/classify-tier.mjs` 中与文字系统无关的后行断言；移除了一个无效的重复 `Sr.` 匹配器。`tests/classify-tier.test.mjs`（+1）。测试套件：**2498**。


## [1.188.0] — 2026-08-14

**修复 (UI) — 主要操作按钮不再紧贴页面副标题。**

### 修复
- **每周面试摘要**、**已融资公司**、**门户**、**职业规划** 和 **职业定位** 页面的主要操作/控件行现在有了合适的上边距，按钮在副标题下方留有空间，而不是紧贴其上。

### 说明
- 回归护栏 `tests/lead-row-top-margin.test.mjs`（+5）。测试套件：**2497**。

## [1.187.0] — 2026-08-14

**修复(扫描器)——`skip_tiers` 设置重新生效:你要求按资历跳过的职位会被剔除。**

### 修复
- `portals.yml` 中的 `skip_tiers:` 列表(如 `skip_tiers: [intern, entry]`)现在会被扫描采纳。每个职位标题被分类为资历层级(intern / entry / mid / senior),若其层级在列表中则被剔除。此前扫描运行标题 / 地点 / 内容 / 可信度过滤,但没有层级过滤,因此 `skip_tiers` 被默默忽略。没有明确级别词的标题归入 **mid**(所以 `skip_tiers: [mid]` 也会剔除大多数普通职位),分类器读取最左侧的级别词。

### 说明
- 新增纯模块 `server/lib/classify-tier.mjs`(`classifyTier` + `buildTierFilter`),接入 EN 与 RU 扫描器的过滤链。`tests/classify-tier.test.mjs`(+7)。套件:**2492**。

## [1.186.0] — 2026-08-14

**新增(CV 工作室)——"技能差距"面板:职位要求的技能中,你的简历已列出、隐含或缺失的部分。**

### 新增
- **CV 工作室**中新增的**技能差距**面板。选择一份已保存的职位描述,它会把每项要求技能分类为**简历已列出**、**简历中隐含**或**缺失**——无 LLM 的词语比较,不写入任何内容。若职位没有明确的要求部分,会出现低置信度提示。

### 说明
- 新增 `GET /api/jds/:name/skill-gap`(职位名先经路径清洗并确认位于 `jds/` 下,才作为参数;无脚本时软回退为 `{available:false}`)。i18n 键 +13 ×17。测试:`tests/jds-skill-gap-route.test.mjs`(+4,含路径穿越拒绝)。套件:**2485**。

## [1.185.0] — 2026-08-14

**新增(统计)——"漏斗与速度"标签页:你的漏斗与市场相比如何,以及你在各阶段间推进的速度。**

### 新增
- **统计**中新增的**漏斗与速度**标签页,在市场基准区间旁显示你的**回复率**与**面试率**(保留小样本与选择偏差提示)、超过典型首次回复窗口的进行中申请的**等待列表**,以及每阶段**中位天数**(申请 → 回复 → 面试 → Offer)——推进慢的行做右删失,以免拉偏中位数。只读、零 token;仅读取你自己的跟踪器。

### 说明
- 新增 `GET /api/stats/funnel`(无脚本时软回退为 `{available:false}`)。i18n 键 +18 ×17。测试:`tests/stats-funnel-route.test.mjs`(+2)。套件:**2481**。

## [1.184.0] — 2026-08-14

**修复(UI)——仪表盘的快捷操作磁贴现在排成整齐的网格。**

### 修复
- 在仪表盘(指挥中心)中,3 个磁贴的一组比 4 个的一组更宽,使各区块右边缘参差不齐。现在每组都使用等宽列(宽屏 4 列,窗口变窄时降为 3 / 2 / 1),因此所有磁贴大小一致、右边缘对齐。

### 说明
- 仅 CSS(`.qa-grid`:用固定的 `repeat(N, minmax(0,1fr))` 取代 `auto-fill`)。由 `tests/dashboard-grid-align.test.mjs` 守护(+2)。套件:**2479**。

## [1.183.0] — 2026-08-14

**新增(扫描器)——更智能的去重:带跟踪链接重新发布的同一职位不再出现两次。**

### 新增
- 扫描器现在通过**规范化 URL 键**识别职位,因此带跟踪参数(`?utm_…`、`gclid` 等)、`http` 与 `https`、或带末尾斜杠 / `#片段`重新发布的同一职位会被当作同一个——扫描结果和管道中不再有重复行,也不会对已看过的职位浪费一次评估。真正不同的职位(保留的功能性 id 如 `gh_jid`)仍分别计数。

### 说明
- 新增 `server/lib/url-key.mjs`,接入两个扫描器的去重与管道写入。刻意欠规范化——绝不合并两个不同职位。测试:`tests/url-key.test.mjs`(+5)、`tests/parsers.test.mjs`(+1)。套件:**2477**(+6)。

## [1.182.0] — 2026-08-14

**修复(扫描器)——薪资区间现在在所有语言下显示一致。**

### 修复
- 扫描和跟踪器行中的薪资数字改用地区中立符号 **≥** 与 **≤**(如 `≥ 120000 EUR`、`≤ 90000`),取代未翻译泄漏到非英文界面的英文词 "from" / "up to"。适用于所有报告单边区间的看板(Getro、Remotli、Manfred、Agentic Jobs、JustJoin、Jobicy);双边区间(`100000–150000 USD`)本就中立。

### 说明
- 仅显示——客户端薪资过滤器无视前缀解析数字,过滤不变。套件:**2471**。

## [1.181.0] — 2026-08-14

**新增(扫描器)——Getro 招聘板现在显示薪资、全部地点和远程职位。**

### 新增
- **Getro** 扫描器(基金人才网络招聘板)现在为每个职位显示**薪资**(年薪范围 + 币种),列出**全部**地点而非仅第一个,并标记**远程**职位。扫描和跟踪器中的 Getro 职位现在拥有与其他招聘板相同的薪资 + 地点信息。

### 说明
- 仅扫描器;无新依赖,无路由 / CSP / SSRF 变更。测试:`tests/sources-getro.test.mjs`(+5)。套件:**2470**(+5)。

## [1.180.0] — 2026-08-14

**修复(中,报告)——`#/reports` 列表现在是表格,并恢复了被 Machine Summary 占位符隐藏的真实评分。**

### 修复
- **`#/reports` 列表是一个表格(报告 · 日期 · 可信度 · 评分),而不是 4 卡片网格。** 过长的“未检测到评分”标签会把标题列挤到接近零,卡片标题的 `overflow-wrap: anywhere` 随即把报告名逐字符换行。现在每个字段都有自己的列,名称单元格按词换行,窄屏时表格横向滚动(新增 `.reports-scroll` 容器)。新增 i18n 键 `rep.colReport` ×17。
- **正文中的真实评分(`**Итоговый балл:** 1.8 / 5`)不再被 Machine Summary 占位符(`score: —`)隐藏。** 当 `## Machine Summary` 块带有非数字或超出范围的评分时,它会占据已解析评分的位置并阻断粗体值形式回退,于是即便正文有真实的 `X / 5`,报告仍显示“未检测到评分”。现在只要没有可用数字残留,`parseReportHeader` 就会恢复正文的值形式(步骤 4.5)。

### 说明
- 仅客户端 + 解析器;无路由 / CSP / SSRF / 父写入变更。测试:`tests/reports-table.test.mjs`(+5)、`tests/report-header-locale.test.mjs`(+2)。套件:**2465**(+7)。

## [1.179.0] — 2026-08-13

**变更 (LOW, 扫描器) — 将 20 个重复的 HTML 实体解码器合并到共享模块(对齐后续,关闭 worklist)。**

### 变更
- 20 个抓取型扫描源各自带有 `decodeEntities`/`decodeXmlEntities`(+ `fromCodePoint` 助手)——这些副本已漂移(其中三个可能抛出 `RangeError`,已在 v1.172.0 修复;其余允许 NUL/C0 或错误解析 `&#1a2;`)。现在全部经由单一的 `server/lib/html-entities.mjs`(符合 XML 1.0 Char 的安全解码器),移除约 237 行重复。8 个 RSS 型源新增 `&nbsp;` 解码(此前只处理 5 个实体);cryptocurrencyjobs 有意的双重解码通过别名保留。`hh` 保留自有解码器(处理 `&mdash;`/`&ndash;`,在共享 6 个之外)。新的守护测试在任何源重建本地解码器时失败。

### 说明
- 保持行为的重构;无路由 / CSP / SSRF / 父写入变更。测试:`tests/decoder-consolidation.test.mjs`(+2)。套件:**2458**(+2)。

## [1.178.0] — 2026-08-13

**修复 (LOW, 父项目对齐) — 将两个过时常量更新为与父项目一致(PARENT-SYNC GAP #4 + #5)。**

### 修复
- **浏览器 User-Agent(GAP #4)** — `BROWSER_LIKE_USER_AGENT`(workable/workday/oraclecloud/a16z/eightfold 用于通过 WAF/机器人门)从 Chrome 131 升到 **151**,与父项目 `user-agent.mjs` 一致;过时版本更易被拦截。由 `Chrome major ≥ 151` 测试守护。
- **追踪器状态 FALLBACK(GAP #5)** — `states.mjs` 的最后备用 `FALLBACK`(仅当实时 `templates/states.yml` 不可读时使用 — 全新克隆 / CI 隔离根)新增父项目的土耳其语状态别名(#2615):değerlendirildi、başvuruldu、yanıt verildi、mülakat、teklif、reddedildi、iptal edildi、uygun değil、kabul edildi/işe alındı。生产中实时文件已提供这些。

### 说明
- 仅两个常量;无路由 / CSP / SSRF / 父写入变更。测试:`tests/http-json.test.mjs`(+1) + `tests/states.test.mjs`(+1)。套件:**2456**(+2)。

## [1.177.0] — 2026-08-13

**修复 (MEDIUM, 扫描器) — 对用会话 Cookie 保护搜索 API 的租户,csod(Cornerstone)返回 0 个职位(parent #2769,PARENT-SYNC GAP #1)。**

### 修复
- 部分 Cornerstone 租户在引导招聘站点首页设置会话 Cookie,若这些 Cookie 不随匿名 bearer 令牌一起回传,搜索 API 就返回 `401 CSOD Unauthorized`。`sources/csod.mjs` 现在用新的 `fetchResponse` 助手读取引导页,从其 `Set-Cookie` 值构建 `Cookie` 头(`cookieHeaderFrom` — 仅 name=value,jar 语义)并在搜索 POST 上重放。仅同源(主机固定 + `redirect:'error'`),会话 Cookie 绝不会到达第三方;不设置 Cookie 的租户与之前完全相同。

### 说明
- 新增 `server/lib/http-json.mjs::fetchResponse`(纯新增;不影响现有源)。无路由 / CSP / SSRF / 父写入变更。测试:`tests/sources-parity-v1118a.test.mjs`(+1)。套件:**2454**(+1)。

## [1.176.0] — 2026-08-13

**修复 (MEDIUM, 报告) — RU 表未列出的粗体标签下的评分仍显示 "Score not detected"(FIND-5)。**

### 修复
- 两份 RU 报告把评分写成 `**Итоговый балл:** 1.8 / 5` / `**Скор:** 1.8 / 5` — 这是 `REPORT_LABELS.ru` 未枚举的粗体标签(只识别 "Оценка"/"Балл"),故评分未被解析。`parseReportHeader` 不再扩充同义词列表,而是回退到**值的形态**:任意粗体标签下按 /5 量表的分数。它与语言无关,对标题免疫(无 `**`、无 `/5` 值),并拒绝像 `5/5/2026` 这样的日期(对分母做否定前瞻)。

### 说明
- 仅服务器解析器;无路由 / CSP / SSRF / 父写入变更。测试:`tests/report-header-locale.test.mjs`(+2)。套件:**2453**(+2)。

## [1.175.0] — 2026-08-13

**修复 (LOW, 加固) — 为 FIND-3 SEO 描述加回归护栏 + 空值安全的合法性剥离(AI 评审跟进)。**

### 修复
- **SEO 描述一致性护栏** — v1.174.0 将各语言 `meta.desc` 中硬编码的 "~55" 换成注册表派生的 `{adapters}` 占位符,但没有测试,下次编辑某个语言时可能悄悄回退。新的 CI 隔离测试 `tests/site-meta-desc-parity.test.mjs` 在 17 个 `site/src/i18n/*.json` 中任一丢失占位符、重新硬编码计数,或 `Landing.astro` 停止把它插入三个描述元标签时失败。
- **空值安全的合法性剥离** — `stripEmphasis` 对空值输入返回 `''` 而非字符串 "undefined"(字段以字符串初始化,属纵深防御)。

### 说明
- 测试 + 解析器一行护栏;无路由 / CSP / SSRF / 父写入变更。测试:`tests/site-meta-desc-parity.test.mjs`(+3)。套件:**2451**(+3)。

## [1.174.0] — 2026-08-13

**修复 (HIGH, 报告) — 本地化报告显示 "Score not detected";SEO 描述过时。**

### 修复
- **评分解析 (FIND-1)** — H1 中包含评分标签词的非英文报告(`# Оценка вакансии: <标题>`)不再把该标题误当作评分。`parseReportHeader` 现在锚定到本地化的**粗体**标签(`**Оценка:** 1.5 / 5`),跳过标题行,并要求标签紧邻冒号 — 因此显示 "Score not detected" 的 RU 报告会展示真实评分。
- **合法性徽标 (FIND-2)** — 从值中剥离 Markdown 强调,徽标显示 "High Confidence" 而非 "** High Confidence"。
- **评分溢出** — 带尾随状态文本的评分行("1.8, Status: Evaluated, …")被压缩为仅评分;`.score-pill` 增加了不换行/溢出上限,标题列可收缩,因此彩色徽标不会溢出卡片边缘。
- **SEO 描述 (FIND-3)** — cvstart.org 的 meta / OG / Twitter 描述(全部 17 种语言)硬编码 "Scan ~55 job boards",而正文按真实注册表计数("~75")。描述现在插入注册表派生的计数,不会再漂移。

### 说明
- 服务器解析器 + 客户端渲染/CSS + 站点 i18n;无路由 / CSP / SSRF / 父写入变更。测试:`tests/report-header-locale.test.mjs`(+4)。套件:**2448**(+4)。

## [1.173.0] — 2026-08-13

**新增 (LOW, 配置) — Hermes 加入被检测的 AI CLI 列表 (career-ops 对齐)。**

### 新增
- `#/config` → "AI CLI 工具"选项卡现在会探测 **Hermes**(Nous Research),即父项目新支持的代理运行时(二进制 `hermes`)。`server/lib/routes/cli-detect.mjs` 的固定白名单从 10 个扩展到 11 个工具;检测仍为只读 PATH 扫描(绝不执行任何二进制)。

### 说明
- 无 i18n / 路由 / CSP / SSRF / 父写入变更;该列表为固定白名单,绝非输入。套件:**2444**(cli-detect 金丝雀更新 10 → 11)。

## [1.172.0] — 2026-08-13

**修复 (MEDIUM, 扫描器) — 格式错误的 HTML 实体可能使扫描源崩溃 (career-ops #2150 对齐)。**

### 修复
- `oraclecloud`、`gem` 和 `dassault` 源在 `String.fromCodePoint` 之前仅用简单的 `Number.isFinite` 检查来解码数字 HTML 实体 — 超过 `0x10FFFF` 的引用(例如格式错误或恶意源中的 `&#99999999;`)会抛出未捕获的 `RangeError`,中止该源的整个解析。共享模块 `server/lib/html-entities.mjs`(镜像父项目的 `_html-entities.mjs`)现在将数字引用限制在 XML 1.0 §2.2 Char 集合内,使 `String.fromCodePoint` 永不抛出,并分别匹配十六进制与十进制,因此 `&#1a2;` 不再被错误解析。三个源都导入它。

### 说明
- 对有效源无行为变化;无 JS / i18n / 路由 / CSP / SSRF / 父写入变更。合并其余约 20 个源内解码器副本的工作记录在 `qa/PARENT-SYNC-WORKLIST-v1.26.0.md`。
- 测试:`tests/html-entities.test.mjs`(+7)。套件:**2444**(+7)。

## [1.171.0] — 2026-08-13

**变更 (LOW,设计系统) — 字号刻度 + z-index 层令牌(D-4,第一步)。** 尺寸和堆叠此前按组件写成字面量。

### 变更
- **z-index 层** — 引入 `--z-*` 令牌(`--z-topbar` … `--z-skiplink`),并**迁移所有 z-index 字面量**。值保持不变,堆叠一致;新的探针禁止新的魔法数字。
- **字号刻度** — `--font-size-*` 刻度(`xs 11` … `2xl 28`,base = Inter 15px);迁移组件已用的核心字号(无视觉变化)。刻度外的值逐步迁移(`docs/UX-ROADMAP.md`)。

### 说明
- 仅 CSS 令牌;无行为/JS/i18n/路由/CSP/SSRF/写入变更。无像素变化。`tests/design-tokens-scale.test.mjs`(+3)。套件:**2437** (+3)。

## [1.170.0] — 2026-08-13

**新增 (LOW) — 长 AI 生成的诚实 ETA 提示(P4-ETA)。** 繁重的生成(职业规划 ~40 秒、定位 / 市场 / 人脉 ~30 秒、two-pager ~20 秒)只显示"生成中…",没有时长感知。

### 新增
- 每个长生成按钮旁现在显示柔和的 **`⏱ ~N秒`** 提示(与 `#/auto` 的 ETA 一致)。共享 `.eta-hint` 样式 + 两个通用键(`common.eta` `~{n}s`、`common.etaTitle`)。

### 说明
- 仅客户端;无路由/CSP/SSRF/写入变更。i18n 键 +2 ×17(快照 1219 → 1221)。`tests/generation-eta-hint.test.mjs`(+2)。套件:**2434** (+2)。

## [1.169.0] — 2026-08-13

**新增 (LOW) — 内联 PDF 预览(D-5)。** `GET /api/output/pdfs/:name` 强制 `Content-Disposition: attachment`,因此连 `#/cv` 的"打开"链接也是下载而非显示。

### 新增
- **`?inline=1`** 以 `Content-Disposition: inline` 提供同一个经过校验的文件,让浏览器在新标签中渲染为 **👁 预览**。默认(无参数)仍为下载。无新路由;相同的名称防护。
- `#/cv` PDF 列表的第一个按钮现为 **👁 预览**(在下载旁边)。`cv.openPdf` "打开" → "预览" ×17。

### 说明
- 无 CSP/SSRF 变更 — 相同的 `sanitizePathName`。重写 1 个现有 i18n 键 ×17(快照 1219)。`tests/output-pdfs.test.mjs`(+3)。套件:**2432** (+3)。

## [1.168.0] — 2026-08-13

**修复 (LOW, a11y) — 复选框行现在满足 WCAG 2.5.8 的 24×24 最小目标尺寸(D-2)。** `#/scan`、`#/config`、`#/evaluate`、`#/cv-studio` 上的复选框/单选标签处于 ~22 px 的条带中。

### 修复
- 限定规则 `label:has(> input[type="checkbox"/"radio"]) { min-height: 24px }` 保证 ≥24 px 的条带。仅 `min-height` — 标签本就是 flex,无位移;`.apply-checklist`(32 px)已合规。

### 说明
- 仅 CSS;无行为/JS/i18n/路由/CSP/SSRF/写入变更。`tests/checkbox-target-size.test.mjs`(+1)。套件:**2429** (+1)。

## [1.167.0] — 2026-08-13

**修复 (LOW,设计系统) — 抬升表面现在与分隔线区分开(D-3)。** `--panel-2` / `--surface-elev1` 解析为 `--slate`,与分隔线 `--line` / `--border` 相同,没有视觉区分。

### 修复
- 专用的主题感知令牌 **`--elev`**(浅色 `#eef1f6` / 深色 `#1e232e`,在两种主题下都与 `--slate` 不同)现在支撑抬升表面;分隔线保持 `--slate`。其余发现(D-2、D-4、D-5、P4-ETA)记入 `docs/UX-ROADMAP.md` 待办。

### 说明
- 仅 CSS 令牌;无行为/JS/i18n/路由/CSP/SSRF/写入变更。`tests/elevation-token.test.mjs`(+2)。套件:**2428** (+2)。

## [1.166.0] — 2026-08-13

**修复 (LOW) — 评分标准术语现在与规范文档一致。** career-ops.org/docs 描述为"五个维度加上一个整体综合评分",但 Web UI、cvstart.org 和 wiki 都说"六维度评分标准"(5 + 1 = 6,但用词不一致)。

### 修复
- 采用文档措辞 — **"五个维度加上综合评分"** — 一致应用于 README ×17、cvstart.org 站点 ×17、帮助指南 ×17、`docs/career-ops-canonical.md` 和 wiki(Home ×17 + Features)。

### 说明
- 仅文档/营销文案;无代码/i18n 键/路由/CSP/SSRF/写入变更。`tests/rubric-terminology.test.mjs`(+2)。套件:**2426** (+2)。

## [1.165.0] — 2026-08-13

**修复 (LOW) — "Two-pager" 术语现在在每种语言内保持一致。** 阿拉伯语侧边栏显示拉丁文 "Two-pager",而 `<h1>` 已完全本地化 — 是在其他方面镜像的 RTL 导航中唯一的拉丁文字符串。

### 修复
- **已落实决策:** 每种语言的 `nav.twoPager` 与 `twoPager.title` 使用一致术语(要么都用拉丁文,要么都本地化)。只有阿拉伯语不一致;其导航标签现已本地化("الصفحتان")。新的探针测试会在任何语言再次分裂时失败。

### 说明
- 仅文案;无路由/CSP/SSRF/写入变更。更改 1 个 i18n 值(ar);无新增键(快照 1219)。`tests/two-pager-term-consistency.test.mjs`(+2)。套件:**2424** (+2)。

## [1.164.0] — 2026-08-13

**修复 (LOW) — 顶栏搜索占位符在任何语言下都不再溢出。** "Find a company, role or URL…" 在搜索栏收缩时被截断,"…or URL" 部分从未显示。

### 修复
- `top.search`(×17)现为简短的 **"搜索或粘贴 URL"**(每种语言 ≤24 字符),即使在窄栏也能容纳并保留 URL 提示。`index.html` 回退一致;`aria-label` 保留完整说明。

### 说明
- 仅文案;无路由/CSP/SSRF/写入变更。重写 1 个现有 i18n 键 ×17(无新增;快照 1219)。`tests/search-placeholder-fit.test.mjs`(+2)。套件:**2422** (+2)。

## [1.163.0] — 2026-08-13

**修复 (LOW) — 应用内"询问文档"助手现在涵盖将报告导出为 PDF。** 尽管 `#/reports/:slug` 有可用的 📄 Generate PDF 控件,它此前却回答指南未涵盖此内容。

### 修复
- 在**全部 17 个帮助包**的 §10 报告下新增 **"将报告导出为 PDF"** H3(按钮位置、文件写入 `output/*.pdf`、需要 Playwright、发送前检查)。助手检索现在会显示报告章节。

### 说明
- 仅文档/帮助;无代码/路由/CSP/SSRF/写入变更。帮助阈值 **112 → 113 H3**(31 H2 不变)。`tests/help-reports-pdf-section.test.mjs`(+2)。套件:**2420** (+2)。

## [1.162.0] — 2026-08-13

**修复 (MEDIUM) — 帮助 "?" 现在是 ≥24×24 的指针目标 (WCAG 2.5.8)。** `.help-hint` 在每个标题上为 `padding:0` 的 18×18 px,低于最小值。

### 修复
- `.help-hint` 盒子现在为 **24×24**(可测量目标),而**可见圆环仍为 18px** — 由居中的 `::before` 绘制,字形和 `<h1>` 基线不变。hover/激活/焦点状态随圆环移动;外边距 6→3px 保持间距。

### 说明
- 仅 CSS;无 JS/i18n/路由/CSP/SSRF/写入变更。`tests/help-hint-target-size.test.mjs`(+2)。套件:**2418** (+2)。

## [1.161.0] — 2026-08-13

**修复 (MEDIUM) — `#/reports` 显示"未检测到评分"标签而非空白。** 在 v1.159.0 的多语言解析器之后,仍无法解析评分的报告显示空白区域,与失败无法区分。

### 修复
- 评分单元格现在分支:有评分 → 色调药丸;无评分 → **`.score-muted`** 标签("未检测到评分",×17)+"打开报告…"提示。卡片仍是可键盘操作的 `role="link"`,日期照常显示。
- 复用现有中性令牌;无新颜色。

### 说明
- 仅客户端;无路由/CSP/SSRF/写入变更。i18n 键 +2 ×17(快照 1217 → 1219)。套件:**2416** (+3)。

## [1.160.0] — 2026-08-13

**修复 (HIGH) — 提供方文案不再与 7 家提供方的承诺矛盾。** `#/config` 称实时评估"使用你的 Anthropic 或 Gemini 密钥",OpenAI 密钥"不被 Web UI 使用";仪表盘写"Anthropic-first scoring" — 自 7 提供方级联(v1.157.0)起皆为错误。

### 修复
- `config.providerModelNote`(×17):现声明 ⚡ 实时评估以无头方式在七个提供方密钥(Anthropic · Gemini · OpenAI · Qwen · OpenRouter · GitHub Models · Hermes)中任意一个上运行,自动排序并回退。删除关于 OpenAI 的错误句子。
- `dash.quick.evaluateSub`(×17):提供方中立("0–5 匹配评分")。`Keys: N / 5` → `N / 7`。

### 说明
- 仅文案;无路由/CSP/SSRF/写入变更。无新增 i18n 键(快照 1217)。套件:**2413** (+3)。

## [1.159.0] — 2026-08-13

**修复 (HIGH) — 报告元数据不再与语言耦合。** 以非英语语言生成的报告在 `#/reports` 上显示空白元数据条(无评分/日期/合法性),因为 `parseReportHeader` 只识别英文粗体标签。

### 修复
- `parseReportHeader` 现在解析语言无关的 `## Machine Summary` YAML 块(`score:` / `legitimacy:` / `date:` — 与 `auto-pipeline` 已读取的来源相同)。优先级:英文标签 → Machine Summary → 本地化标签(`REPORT_LABELS`,17 种语言)。英文报告逐字节一致。
- 数字解析容错(`1.5/5`、`1,5/5`、`1.5 из 5`、`4.5 out of 5`);正文无日期时回退到文件 mtime。

### 说明
- 仅读取/解析;无路由、CSP、SSRF 或父级写入变更。无新增 i18n 键。套件:**2410** (+8)。

## [1.158.0] — 2026-08-12

**修复 — 两个显示层面的小问题(标签标题中泄漏的 «?» 以及着陆页错误的提供商数量)。** 仅显示,无行为、安全或数据流变更。

### 修复
- HelpHint 的 «?» 不再泄漏到 `document.title`。路由器从未处理的 `h1.textContent` 派生标签标题,导致显示为「Vacancy search?」而非「Vacancy search」。现在 `router.js::focusNewView` 克隆标题、移除 `.help-hint` 后再读取文本;页面上可见的 «?» 保持不变。
- cvstart.org 显示「17 AI providers」而非「7」。`Features.astro` 的 `sub()` 在按卡片替换前就把所有 `{n}` 改为语言数(17);现在 `{n}` 按卡片解析(提供商 → 7,语言 → 17)。

### 说明
- 无服务器、路由、CSP、SSRF 或 i18n 键变更。套件:**2402** 项测试(+1)。

## [1.157.0] — 2026-08-12

**修复 —— 实时评估现在可用任意已配置的提供方运行,不再仅限 Anthropic/Gemini。** 仅设置 `OPENROUTER_API_KEY` 的用户被错误地强制进入手动模式。

### 修复
- **根本原因:** 无密钥的 `LLM_PROVIDER` 固定(如 `init` 写入的 `LLM_PROVIDER=claude`)会走进死胡同;现在会在已配置的提供方之间按 auto 顺序回退(在 `selectActiveProvider` 与两条派发级联中)。
- 客户端门控(`#/deep` 与 mode-page 视图)现改用 `window.ProviderStatus`(`/api/status/providers`,全部 7 个),不再用过时的 Anthropic/Gemini 探测;重写文案(deep/eval × 17)+ 仪表盘「实时评估」徽章 + `config.llmProviderHint`。

### 说明
- 无安全变更。套件:**2401** 项测试(+5)。

## [1.156.0] — 2026-08-12

**重构 —— 将 `scan.js` 拆分到大小上限以下(P-16)+ 一个 CodeQL 修复。** `scan.js` 原有 **906 行**;提取了两个保持行为的工厂 → **648 行**。完成 P-15/P-16 视图拆分。

### 变更
- 新增 `scan/runner.js`(扫描执行引擎)和 `scan/filters.js`(过滤状态机),通过 `ctx`/`refs` 包;`scan.js` 连接两者。

### 修复
- CodeQL `js/useless-assignment-to-local`(#428)于 `config/tab-controller.js`:`let n = i;` → `let n;`。

### 说明
- 纯重构,行为不变;4 个读取源码的测试已改指向。两个大视图现均低于 800(P-15/P-16 完成)。套件:**2396** 项测试。

## [1.155.0] — 2026-08-12

**重构 —— 将 `config.js` 拆分到大小上限以下(P-15)。** `config.js` 原有 **1030 行**(超过 800 行上限);提取了两个保持行为的模块,降到 **783 行**。

### 变更
- 新增 `config/field-specs.js`(字段数据 + 模型列表)和 `config/tab-controller.js`(选项卡栏工厂);`config.js` 引用它们,渲染逻辑不变。

### 说明
- 纯重构,行为不变;6 个读取源码的测试已改指向。`scan.js`(906)保持原样(已部分拆分;核心耦合过重,机械拆分反而更糟)。套件:**2396** 项测试。

## [1.154.0] — 2026-08-12

**新指南 —— “在云端运行整个技术栈”。** career-ops 自身没有云/服务器说明,故新增一份:把父级 **career-ops** 流水线、此 **career-ops-ui** 查看器与 AI **引擎**(通过 Claude Code 的 **Claude 订阅**、本地 **Hermes**,或 API 密钥)放到一台常开小型服务器上的分步指南。以 17 种语言的**帮助 §31**、README 章节和 wiki 页面提供。

### 新增
- **帮助 §31 “在云端运行整个技术栈”**(× 17)—— 三个部分、开通 + 安装、选择引擎、安全暴露(HTTPS 反向代理 + 认证 + CSP/SSRF/XSS/无密钥不变式)。帮助包扩展到 **31 H2 / 112 H3**。
- **README** —— “在云端运行整个技术栈”章节(× 17)+ wiki 的 **Cloud-Deployment** 页面。

### 说明
- **仅文档** —— 无路由、服务器或客户端改动;无新增 i18n 键。帮助的 4 个测试改为 31 H2 / 112 H3 契约。套件:**2396** 项测试(不变)。

## [1.153.0] — 2026-08-12

**Jobvite 扫描器迁移到公开 XML 源(父项目同步)。** 父项目下线了 Jobvite JSON API(现在返回零职位);web-ui 的 source 用的正是这个失效端点,因此任何被跟踪的 Jobvite 公司都静默扫描为空。移植父项目修复(`#2623`):现在读取以 `companyEId` 为键的公开按租户 **XML 源**。

### 修复
- source 调用已下线的 JSON API 并返回零职位;现改为调用 `https://app.jobvite.com/CompanyJobs/Xml.aspx?c={companyEId}` 并解析 XML `<result><job>…`(CDATA + 实体解码,`detail-url` 优先于 `apply-url`)。

### 变更
- `companyEId` 解析:(1) 门户的 `company_eid:`,(2) 显式 `api:` 的 `c=` 参数,(3) 看板页发现。`fetchText`(`http-json.mjs`)在 non-ok 错误上附加 `.location`/`.retryAfter`(只读,向后兼容)。

### 说明
- **安全** — 两个主机(`jobs.jobvite.com`、`app.jobvite.com`)在每次请求前由 `assertJobviteUrl` 固定:仅 https、严格白名单、**从不跟随重定向**。`companyEId` 仅为 `?c=` 值;source 数量不变。
- 套件:**2396** 项测试(+4)。

## [1.152.0] — 2026-08-12

**Hermes 提供方 — 接线完成 + 文档同步。** 对 v1.151.0 Hermes 集成的代码评审发现两处真实缺口和四项完整性事项,已全部在此修复;并将全应用的 LLM 提供方列表在所有文档面和 17 种语言中补齐为完整的七个。

### 修复
- **`#/config` 无法强制 Hermes** — `LLM_PROVIDER` 下拉仅列出六个提供方,因此可设置 `HERMES_API_KEY` 却无法在 UI 中强制 Hermes。现在 `hermes` 是第 8 个选项,新增的一致性测试可防止下拉再次与 `LLM_PROVIDERS` 偏离。
- **较短的自托管密钥被静默拒绝** — `isUsableKey` 的 20 字符下限是按云端密钥校准的;`hasHermesKey` 现改用放宽的 8 字符下限(Hermes 文档示例为 19 字符)。

### 变更
- 提供方列表在 README(× 17)、应用内帮助(× 17)、`config.llmProviderHint` 字典(× 17)和 `docs/sdd` 中统一为完整七个;`hermesChatUrl` 会补全无路径的主机;手动回退文案点名 Hermes。

### 说明
- **安全性不变** — 无新路由、无 SSRF/CSP 改动;health/doctor 新增一行 `HERMES_API_KEY`。
- 套件:**2392** 项测试(+2)。

## [1.151.0] — 2026-08-12

**Hermes 现已成为已接入的 LLM 提供方（Phase 5）** — Phase 5 的调研确认 Nous Research 的 Hermes 提供一个 **兼容 OpenAI 的 API Server**（`hermes gateway` → `POST /v1/chat/completions`),因此 career-ops-ui 现在像 OpenAI/Qwen 一样通过本地 Hermes 运行实时评估。在 **应用设置** 中设置 `HERMES_API_KEY`,它便加入 auto 顺序(最后一个)。收尾路线图最后一个未决项 —— **Phase 5, Shape A**。

### 新增
- **Hermes LLM 提供方（Shape A）** — 共享 `runOpenAICompatible` 客户端之上的 `runHermes`(`server/lib/openai.mjs`),在 **两个** 级联(`llm-dispatch.mjs` + `routes/llm.mjs`)中设门,auto 顺序末尾 + `LLM_PROVIDER=hermes` 固定项、`/api/status/providers`、`llm-pricing.mjs`。以 Bearer 认证访问可配置的本地 base URL(默认 `http://127.0.0.1:8642/v1`)—— 这是 **已配置** 的提供方端点(如 OpenRouter/Qwen),而非用户提供的职位 URL,因此不经过 SSRF 防护。
- **`#/config` 字段** — `HERMES_API_KEY`(密钥) + `HERMES_BASE_URL` + `HERMES_MODEL`(默认 `hermes-agent`),6 个新 i18n 键 × **17 种语言**(快照 1208 → 1214)。

### 变更
- 调研已解决:`docs/integrations/HERMES.md`、应用内帮助 §30（× 17）、README 预告（× 14）、`hermes-bridge` 技能与路线图,从「计划中 / 尚未接入」转为 **已接入（Shape A）**。无需 Shape B(定制的代理运行时 relay)。

### 说明
- **安全:** 提供方的 fetch 是一个已配置端点,与其它兼容 OpenAI 的提供方同类 —— 无新增 SSRF 面,无 CSP/清洗器改动。`HERMES_API_KEY` 是 `SECRET_KEY`(绝不回显)。
- 测试(CI 隔离、桩传输):`tests/hermes-provider.test.mjs`(+5);v1.146.0 的「无 Hermes 分支」哨兵被 **反转**,改为断言其已接入;提供方面测试更新为 7 提供方顺序。
- 套件:**2390** 项测试(+5)。

## [1.150.0] — 2026-08-12

**一致的空状态(Phase 4 打磨)** — 每个"暂无内容"面板现在都通过唯一的共享 `.empty` 样式渲染,而不再由个别视图用魔法数字 `40px` 内联重复声明外观。一次小的视觉一致性修复;`#/activity`、`#/cv-studio`、`#/stats`、`#/usage` 的空状态现在与其它所有面板一致(令牌化的 48px 内边距 + 虚线边框)。

### 变更
- **`#/activity`、`#/cv-studio`、`#/stats`、`#/usage`** 移除了空面板上的内联 `style: { padding: '40px', textAlign: 'center', color: 'var(--foggy)' }` —— 这三个属性共享的 `.empty` 类已经提供(`--space-7` = 48px、居中、淡色、虚线边框)。于是这四个与其它约 25 个 `.empty` 面板渲染完全一致。
- 各视图正当的覆盖(`#/dashboard` `width:100%`、`#/pipeline` `border:none`)未动 —— 仅移除纯冗余的重复声明。

### 说明
- **仅客户端 CSS 用法清理** —— 无路由、服务器、i18n 键或 CSS 规则改动(`.empty` 类本身不变);字典快照 1208。已在浏览器验证(`#/usage` 空面板计算为 48px 内边距 + 虚线边框,0 控制台错误)。
- 新哨兵测试 `tests/empty-state-consistency.test.mjs` 让 `.empty` 保持唯一真实来源。Phase 5(Hermes 提供方)仍被阻塞。
- 套件:**2385** 项测试(+2:`tests/empty-state-consistency.test.mjs`)。

## [1.149.0] — 2026-08-12

**门户已移入设置(Phase 4)** — `#/portals` 现位于 **Setup** 导航分组中、*应用设置* 旁,而不再在 *Sourcing* 下。自 v1.144.0 起它就是一个设置界面(启用/停用被追踪的公司 + ATS 健康探测),而非 sourcing 操作 —— 所以这才是它该在的位置。仅导航调整;页面与路由不变。

### 变更
- **`#/portals` 导航项 → Setup 分组**(位于 `public/index.html`),紧随 *应用设置* 之后。已从 *Sourcing* 分组移除(该分组保留 Scan / Pipeline / Auto-pipeline / 已融资公司)。`#/portals` 路由、视图与 `nav.portals` 标签均不变 —— 仅侧边栏位置移动。

### 说明
- **仅导航标记** —— 无路由、视图、i18n 键或服务器改动。已在浏览器验证(0 控制台错误);由 `tests/portals-nav-placement.test.mjs` 保护。
- 套件:**2383** 项测试(+2:`tests/portals-nav-placement.test.mjs`)。

## [1.148.0] — 2026-08-12

**更清爽的扫描筛选(Phase 4)—— 筛选面板现已改为整洁的网格** —— `#/scan` 的筛选面板从宽度参差、由刚性方框组成的 flex-wrap 改为响应式网格,「应用 / 重置」操作现在独占一行并右对齐。筛选项与行为不变 —— 只是更易阅读。一次设计打磨(无 parent-sync)。

### 变更
- **`#/scan` 筛选面板 → 响应式网格** —— `.scan-filters` 现为 `display: grid`,列为 `repeat(auto-fill, minmax(180px, 1fr))`,间距均匀,使 11 个带标签的筛选项在任意宽度下都对齐成整洁的列,而不再参差地换行。
- **应用 / 重置操作** 横跨整个网格独占一行,以一条细线分隔并右对齐。移除了 `scan.js` 中旧的隐藏标签技巧 + 内部 flex 包裹。

### 说明
- **仅 CSS + 一点 DOM 清理** —— 每个筛选项 id(`#scan-filter-*`、`#scan-apply`)与 `SR.render()` 的接线均未改动,因此 Playwright 流程不受影响。无新增 i18n 键。
- 已在浏览器验证(0 控制台错误);由 `tests/scan-filters-grid.test.mjs` 保护。
- 套件:**2381** 项测试(+3:`tests/scan-filters-grid.test.mjs`)。

## [1.147.0] — 2026-08-12

**Hermes & Telegram —— 应用内帮助章节 + cvstart.org 界面(Phase 5b，第 2 部分)** —— Hermes 文档工作的第二部分,也是最后一部分:操作说明现已放入应用自己的帮助指南中,覆盖全部 17 种语言,应用内文档助手也据此回答 Hermes 相关问题。仍然仅限文档 —— Hermes LLM 提供方路径仍处于 **计划中 / 尚未接入**(Phase 5)。

### 新增
- **应用内帮助 §30「Hermes & Telegram」× 17 种语言** —— 新的指南章节(Hermes 是什么 + 两种集成形态;在云服务器上运行;经 Hermes 转发到 Telegram + 「不该暴露什么」规则),可从 `#/help` 访问。`docs-assistant` / `DocsFab` 的 grounding 会自动获取它(两者都读取 `docs/help/<lang>.md`)。
- **cvstart.org —— 指向 Hermes 指南的链接**,跳转到 GitHub 文档。

### 变更
- 帮助包门槛提升至 **29 → 30 H2 / 105 → 108 H3**(`canonical-docs-coverage`、`help-ui`、`help-ru-config-section`);§30 新增 3 个 H3。

### 说明
- **目前仍没有任何代码调用 Hermes。** 新哨兵测试 `tests/help-hermes-section.test.mjs` 断言每种语言都包含带有语言无关锚点(`docs/integrations/HERMES.md`、`hermes-bridge`、`#/help`、`127.0.0.1`、Telegram)的 §30。该提供方仍卡在 Phase 5 的 API 契约调研上。
- 这就收尾了 Phase 5b 的 **文档 + 技能** 交付物;提供方集成(Phase 5)仍是一个独立且被阻塞的事项。
- 套件:**2378** 项测试(+2:`tests/help-hermes-section.test.mjs`)。

## [1.146.0] — 2026-08-12

**Hermes 代理 + Telegram——集成指南 + 一个 skill（Phase 5b，第 1 部分）** — 你可以在云服务器上运行 career-ops-ui,并通过 Nous Research 的 Hermes 代理把它的事件(一次完成的扫描、一份新报告、一次紧急跟进)桥接到 Telegram。本次发布提供了设计 + 部署文档和一个 hermes-bridge skill;Hermes LLM 提供方路径仍处于计划中/尚未接入状态(卡在 Phase 5 的 API 契约调研上)。这是刻意让文档先行于代码。

### 新增
- **`docs/integrations/HERMES.md`** — 深度指南:两种集成形态(兼容 OpenAI 的 endpoint 与代理运行时)、云服务器部署(reverse proxy + HTTPS + systemd,在无头服务器上对 parent 的只读约定)、经 Hermes 转发到 Telegram,以及一份威胁模型「不能暴露什么」清单(不向频道暴露简历/薪资/报告正文/密钥)。
- README 中的 **`## Hermes agent + Telegram`** 预告 — 英文 README 中的简短指引 + 链接,并同步到已完整翻译的各语言 README。
- 一个让指南可落地执行的 **`hermes-bridge` skill**(`.claude/skills/hermes-bridge/`)——前置条件与范围门检查(Node ≥ 18、密钥是否存在、通过 SSRF 安全路径确认 endpoint 可达),从不把密钥写入磁盘/日志,并拒绝臆造 Hermes 的 endpoint 或声称该提供方已接入。
- `docs/architecture/OVERVIEW.md` 中新增 **Integrations** 小节链接到该指南。

### 说明
- **目前还没有任何代码调用 Hermes。** 一个哨兵测试(`tests/hermes-docs.test.mjs`)断言「计划中/尚未接入」的诚实标记仍然存在,并确认 `llm-dispatch.mjs` 中没有 Hermes/Nous 分支——因此以后接入该提供方时,必须在同一次改动里同步更新文档 + roadmap。
- **推迟到 v1.147.0**（Phase 5b，第 2 部分）:应用内帮助中的「Hermes & Telegram」H2 小节 × 17 种语言,以及 cvstart.org 的营销页面。
- 套件:**2376** 项测试(+4:`tests/hermes-docs.test.mjs`)。

## [1.145.0] — 2026-08-12

**有洞察力的统计（续）：可重建图表** — `#/stats` 的「目标职位趋势」标签页新增 **构建图表** 小部件：选择指标 × 维度即可实时重绘。用户提出的 UX 需求（无 parent-sync）。

### 新增
- **指标 × 维度可重建图表** — 选择**指标**（职位数 / 薪资中位数 / 平均薪资）和**维度**（按国家/地区 / 按职位），柱状图即时重绘。薪资类指标遵循货币 + 每年 ⇄ 每月切换；职位数为简单计数。
- 8 个新 i18n 键 × **17 种语言**；快照 1200 → 1208。

### 说明
- 已在浏览器验证（0 控制台错误）。套件：**2372** 项测试（+2）。

## [1.144.0] — 2026-08-12

**设置与过滤（阶段 4，第 1 部分）：启用/停用被跟踪的门户** — 现在可以在 `#/portals` 打开或关闭一个被监视的公司，扫描器会遵循此设置。用户提出的 UX 需求（无 parent-sync）。

### 新增
- **`#/portals` 上按公司的启用/停用开关** — 一键关闭某门户（EN 扫描器已跳过 `enabled: false` 的公司，因此停用的门户会从此后所有扫描中移除）或重新开启，并带乐观提示。
- **`POST /api/portals/toggle`** — 一次显式的用户写入，外科式且经解析校验地切换 `portals.yml` 中某公司的 `enabled` 标志（注释、顺序及其他字段均保留）。5 个新 i18n 键 × **17 种语言**；快照 1195 → 1200。

### 说明
- 扫描器改动为**零** — `en-scanner.mjs` 已按 `enabled !== false` 过滤。套件：**2370** 项测试（+3）。

## [1.143.0] — 2026-08-12

**更易理解（续）：核心工作流页面的 `?` 提示** — 帮助 `?` 现在覆盖九个主要操作页面，支持所有语言。用户反馈的 UX 改进（无 parent-sync）。

### 新增
- **再为 9 个视图标题加上 `?` 帮助提示** — `#/scan`, `#/evaluate`, `#/cv-studio`, `#/tracker`, `#/config`, `#/deep`, `#/batch`, `#/auto`, `#/apply` 均获得内联 `?`（通过 `HelpHint.title`），点击打开本地化的「这是什么 / 如何使用 / 会得到什么」弹出框 — 与 v1.139.0 相同的 CSP 安全组件。
- 9 个新 i18n 键 × **17 种语言**（`help.hint.scan`/…/`apply`）；快照 1186 → 1195。

### 说明
- 已在浏览器验证（0 控制台错误）。套件：**2365** 项测试（+1）。

## [1.142.0] — 2026-08-12

**修正：不再出现「Unknown」职业原型** — `#/orientation` 现在始终从八个命名的职业向量中排名，而不是偶尔回答「Unknown」并建议你在其上「加倍投入」。用户反馈的修正（无 parent-sync）。

### 修复
- **`#/orientation` — AI 提示现在禁止集合之外的原型。** 模型必须从恰好八个命名向量中排出前三，且**绝不**回答「Unknown」/「N/A」/「数据不足」或臆造标签。简历单薄时仍以较低置信度指出最接近的三个并说明缺少哪些证据，而非拒答。

### 说明
- 仅服务端提示变更（`buildOrientationPrompt`）；无 i18n/架构变更。套件：**2364** 项测试（+1）。

## [1.141.0] — 2026-08-12

**有洞察力的统计（续）：融资公司信息增强** — `#/funded` 更具可视化：公司徽标、按融资额的图表，以及包含轮次 / 金额 / 发现评分 / 建议操作的卡片。用户反馈的 UX 改进（无 parent-sync）。

### 变更
- **`#/funded` — 扁平表格 → 卡片网格。** 每家近期融资的公司现在都是一张卡片，含**徽标**（由公司名推导，失败时用字母头像）、**轮次**+**金额**标签、上级项目的**发现评分**与**建议操作**，以及融资新闻链接与日期。
- **融资额可视化** — 按已披露金额排名的头部公司横向条形图；"$120M"/"€1.5B" 等自由文本金额由新的 `parseAmount` 解析为量级。3 个新 i18n 键 × **17 种语言**。

### 说明
- 仍为 `GET /api/company-funded` 之上的**只读**；简介与薪资范围不在融资信息源中。套件：**2363** 项测试（+2）。

## [1.140.0] — 2026-08-12

**有洞察力的统计：更丰富的薪资数字** — `#/stats` 的「我的管道」薪资细分现在显示**平均值**（不只是中位数）、**每年 ⇄ 每月**切换，以及按国家的**最低 · 平均 · 中位数 · 最高**表格。Phase 3 的第一部分。用户反馈的 UX 改进（无 parent-sync）。

### 新增
- **平均薪资** — `RoleStats.salaryStats` 现在在 `minUsd`/`medianUsd`/`maxUsd` 之外返回 `avgUsd`。中位数抗离群值，平均值暴露偏斜，两者结合便读作一个分布。
- 薪资部分的**每年 ⇄ 每月切换**与按国家的**最低 · 平均 · 中位数 · 最高表格**（联动货币与周期选择器）。8 个新 i18n 键 × **17 种语言**。

### 说明
- 数字仍仅来自可解析薪资的岗位并归一化为 USD（仅供参考）。套件：**2361** 项测试（+1）。

## [1.139.0] — 2026-08-12

**更易理解：`?` 帮助提示** — 一个可复用且符合 CSP 的 `?` 按钮，点击后用您的语言说明「这是什么 / 如何运作 / 会得到什么」。用户反馈的 UX 改进（无 parent-sync）。

### 新增
- **`?` 帮助提示弹出框**（`window.HelpHint`）——标题旁的圆形 `?` 会打开一个轻量、随主题变化并在 RTL 下镜像的弹出框，通过 `UI.md()` 渲染本地化说明；具备可访问性（`role="tooltip"`、`aria-expanded`、按 Esc 或点击外部关闭、焦点回归）且符合 CSP。
- 在 **`#/stats` 的 5 个标签页**和 **8 个 AI／分析视图标题**（career-plan、定位、two-pager、人脉、模拟面试、记忆、funded、每周汇总）上新增 `?` —— 14 个新 i18n 键 × **17 种语言**。

### 说明
- 所有视图原本就有一行副标题；`?` 在此基础上按需提供更深入的说明，也让空状态自解释。套件：**2360** 项测试（+4）。

## [1.138.0] — 2026-08-12

**按界面语言生成** — 所有 AI 生成现在都以你在界面中选择的语言回复，并含评审驱动的测试加固。用户反馈的 UX 改进（无 parent-sync）。

### 变更
- **AI 生成现在遵循界面语言。** 当界面设为俄语、西班牙语、日语……时，生成文本会以**该**语言返回，而不再总是英语。输出语言指令已贯穿**所有**生成端点——职业规划、定位、市场报告、模拟面试、人脉计划、「向文档提问」、记忆便笺建议以及 two-pager 草稿。代码与标识符保持英文（如 two-pager 的 YAML 键），仅正文、标题与要点被本地化。

### 修复
- **CSS 颜色角色守卫**（`tests/css-role-tokens.test.mjs`）——一个静态金丝雀，断言 v1.137.0 暗色模式别名令牌绝不反转角色：文本角色令牌（`--fg`/`--danger`/`--ok`/…）绝不用作 `background`，表面角色令牌（`--card`/`--panel`/`--line`/…）绝不用作文本 `color`，覆盖全部 CSS 与 SPA 内联样式。
- **`UI.md()` XSS 加载器自检** ——从 `api.js` 加载 `md()` 的测试现在在提取后立即用 `md('<script>…')` 探测，若转义缺失即抛错，使未来的错误切片**响亮地**失败，而不是让安全套件在被截断的函数上变绿。
- **`#/career-plan` 滚动守卫** ——生成后的 `scrollIntoView` 仅在预览仍连接到文档时执行。

### 说明
- `docs/UX-ROADMAP.md` 已更新：`?` 帮助提示 + 页面说明 + 空状态改为 **v1.139.0**；**Nous Research / Hermes** 提供方（含云服务器 + Telegram 部署指南与 Hermes 技能）记为 **阶段 5 / 5b**。
- 套件：**2356** 项测试（+5）。

## [1.137.0] — 2026-08-11

**可读性与渲染修复** —— 暗色模式对比度、图表标签与职业规划页。一次用户反馈驱动的 UX 修复(非父项目同步)。

### 修复
- **多个界面出现暗色模式下的白底白字／黑底黑字** —— 多个视图引用的十五个 CSS 自定义属性(`--fg`、`--panel`、`--panel-2`、`--ok`、`--danger`、`--card` 等)从未被声明,因而回退到硬编码的浅色/黑色取值:浅色模式下没问题,暗色模式下则完全无法辨认(`#/pipeline` 概览芯片、`#/stats` 激活标签页、`#/config` 的 "Active / Keys" 与 "✓ set"、`#/two-pager` 各分区、`#/mock-interview` 的问题气泡、错误文字)。现已将它们别名到真正随主题变化的 token,因此会自动跟随主题切换 —— 经自动化审计工具验证,**全部 29 个视图 0 处 WCAG-AA 对比度不合格**;`#/config` 的激活标签页也改为可读的着色样式。新增的回归测试(`tests/dark-theme-tokens.test.mjs`)确保它们始终保持别名关联。
- **`#/stats` 图表标签会在单词中间被截断**("Senior Backend Engineer" → "…Enginee")—— 现在改为省略号截断,完整标签则保留在悬停提示中。
- **`#/career-plan` 此前将生成的规划以原始 Markdown 形式展示** —— 现在会自动渲染为格式化的可读文本(可编辑的 Markdown 仍保留在文本框中;可通过「预览」切换显示)。

### 说明
- `#/career-plan`、`#/two-pager`、`#/stats` 以及每周面试摘要并未出现故障 —— 在你生成规划／产生数据之前,它们只是展示空状态。后续计划提供更清晰的页面内引导与 `?` 帮助提示(`docs/UX-ROADMAP.md`)。

## [1.136.0] — 2026-08-11

父项目 career-ops **v1.26.x** 对齐(v1.26.0 主线之后)—— 一个新的零鉴权来源,以及对 web-ui 镜像所做的一波质量与健壮性移植。注册表现为 **79 个来源 = 74 个英文 + 5 个俄文**(`ALL_ADAPTERS` 74)。

### 新增
- **`eightfold`**(Eightfold AI,#2684)—— 通过零鉴权的 `https://<tenant>.eightfold.ai/api/apply/v2/jobs` API 获取人才招聘板,主机锁定至 `*.eightfold.ai`(故意拒绝品牌化的 `careers.<company>.com` CNAME);分页并设有安全上限、失效招聘板抛出异常、URL 去重。新增来源 + 适配器 + 一套 CI 隔离测试套件;已出现在 `#/scan` 的 Source 筛选器与落地页中。

### 修复
- **Unicode 感知的去重与角色键**(#2569 / #2587 / #2667)—— 新增共享的 `normalizeTextKey`(NFKC,保留任意文字体系的字母/符号/数字),取代了此前仅支持 ASCII 的键:`detect-reposts` 现在能够聚类全角/半角与标点变体的公司名(例如 "Acme, Inc." ≡ "Acme Inc"),且绝不会把不同的非拉丁字符雇主误合并;`role-matcher` 则会折叠全角职位名称,并保留非拉丁字符的职位词元,而不是将其抹除。
- **`fetchJsonWithRetry` 不再重试被拒绝的重定向**(#2657)—— `redirect:'error'` 守卫遇到 3xx 响应时行为是确定性的,因此现在将其判定为不可重试,直接快速失败,而不再耗尽重试预算。
- **`title_filter.positive` 的 AND 分组**(#2552)—— positive 条目中以空白分隔的 ` + ` 现在要求标题中必须出现全部词项(顺序不限)。
- **`oraclecloud` 现已支持带编号的租户顶级域名** `oraclecloud1.com … oraclecloud99.com`(#2683)—— 这是一个有限的域名族(不允许前导零,至多 2 位数字),绝非通配顶级域名。
- **`workable` 加固**(#2675)—— 针对 Cloudflare 前置的主机,增加了重试、类浏览器请求头,以及请求串行化。
- **`personio` 现在会回退到 HTML 抓取**,当 XML 信息流被禁用时不再返回空结果。
- **`states` 的 FALLBACK 别名已与父项目重新同步**(#2615)。

### 说明
- 未移植(未被 web-ui 镜像,或仅限 CLI):`reply-matcher`(#2672)、`jd-similarity`(#2661)、`jd-skill-gap`(#2686)、scan 的环境变量路径(#2568)/ `--flag=value` 解析(#2589),以及封面信 / CV 模板 / `doctor` / `ollama` / 生成 PDF 相关改动。Web 端的 `js-yaml`/`nanoid` HIGH 级安全公告已在 web-ui v1.135.0 中修复。

## [1.135.0] — 2026-08-11

父项目 career-ops **v1.26.0** 对齐 —— 五个新的零鉴权扫描来源,以及对 web-ui 已有的四块招聘板所做的正确性修复。注册表现为 **78 个来源 = 73 个英文 + 5 个俄文**(`ALL_ADAPTERS` 73)。

### 新增
- **五个新的扫描来源**(每个均含来源 + 适配器 + 一套 CI 隔离测试套件;均已出现在 `#/scan` 的 Source 筛选器与 cvstart.org 落地页中):
  - **`join`**(JOIN)—— 从 `join.com/companies/<slug>` 页面的 Next.js `__NEXT_DATA__` 中读取某公司的 JOIN 招聘板(主机锁定、页数封顶)。
  - **`getro`**(Getro)—— 通过公开的 `api.getro.com` POST API 获取风投「人才网络」投资组合招聘板,按最新优先分页;每个职位归属于投资组合中的雇主公司,而非基金本身。
  - **`consider`**(Consider)—— 通过同源 POST 请求获取 getconsider.com 的风投投资组合招聘板;配置驱动的主机由结构化 SSRF 守卫锁定(仅限公开 HTTPS 主机)。
  - **`joinup`**(JOINUP)—— 瑞士招聘板 joinup.ch,读取服务端渲染的最新一页;抓取逻辑一旦失效即快速失败(fail-closed)。
  - **`remotli`**(Remotli)—— remotli.ch,瑞士公司的远程职位(瑞士法郎薪资);输出雇主自身的 ATS 投递 URL,以便交叉列表能够去重。

### 修复
- **a16z Speedrun 不再因短暂波动而中止整块招聘板** —— 各页请求现在统一通过共享的 `fetchJsonWithRetry`(仅对短暂性的 429/5xx/超时做有限次重试,绝不重试永久性的 4xx),并针对单页 50 条职位重新调整了页数预算。
- **arbeitsagentur 已迁移至 v6 Jobsuche API**(`/pc/v6/jobs`)—— 旧版 v4 接口已返回 404;响应结构已更名,且远程职位过滤现改为在服务端完成。
- **thehub 已迁移至 v2 `jobsandfeatured` API**—— 各条记录不再携带发布日期,已从「时效性过滤」中豁免。
- **hackernews 现通过筛选 Algolia 查询中的 `author_whoishiring` 账号标签、而非自由文本查询,来可靠地定位每月「Who is hiring?」帖子**。

### 说明
- 未移植(web-ui 已足够安全、已由中继吸收、或仅限 CLI):Unicode 角色去重/公司匹配相关的键(web-ui 的重复投递分组本就对公司名按纯小写字符串做键,因此不同的非拉丁字符雇主永远不会被误合并);跟进环节的拒信延迟信号 + 获投公司相关的小幅修正(均为只读中继,故障自降级);扫描的环境变量可覆写路径与 `--flag=value` 解析(web-ui 的扫描器是进程内运行的);User-Agent 整合重构(web-ui 早已集中处理);以及仅限 CLI 的条目(不可信内容名单、oferta/offer-prep、doctor、封面信/简历模板改动)。

## [1.134.1] — 2026-08-05

验证加固 —— 本次修复源自一次全项目审计。

### 修复
- **`successfactors` 在扫描中途失败时不再丢弃已抓取的职位**（v1.134.0 移植「失效招聘板抛出异常」逻辑时引入的回归）——其翻页循环此前没有 `try/catch`，因此第 2 页及之后的请求一旦失败（此前第 1 页已成功获取），就会抛出异常并丢弃全部已收集的结果；若该失败恰好是一次 `404`（`startrow` 超出范围），`en-scanner` 便会把一个存活的租户误判为失效，并将其隔离数天。现已与 `phenom`／`radancy` 保持一致：第 0 页失败仍会抛出异常（判定为失效招聘板），但后续页面的失败会保留已取得的部分结果。
- **`#/scan` 筛选芯片现在支持键盘操作**（符合 WCAG 2.1.1）——此前分面芯片（以及「清除」芯片）只是带点击事件处理器的 `span`，没有 `tabindex`／role，键盘用户与屏幕阅读器用户都无法聚焦或切换它们。现在它们带有 `role="button"`、`tabindex="0"`、`aria-pressed`，并支持 Enter／Space 键激活。
- **三处硬编码的英文字符串现已完成本地化**——`#/scan` 的信任徽章提示文字、`#/scan` 的搬迁列表头，以及 `#/dashboard` 的评分列表头此前均为裸字面量，i18n 一致性检查无法识别它们（它们从未被登记为键），因此在所有非英文语言环境中都一直显示英文。现已改用 `scan.trustTip` + `scan.col.reloc`（2 个新键）以及复用现有的 `track.col.score`，并配有源码静态断言加以锁定。

## [1.134.0] — 2026-08-05

父项目 career-ops **v1.25.0** 对齐。

### 新增
- **新增扫描来源:getManfred**(`manfred`)—— 面向西班牙/欧盟科技职位、含公开薪资的全板块信息流,来自 `www.getmanfred.com/api/v2/public/offers`(零鉴权,主机锁定 + 仅限 HTTPS,单次请求获取完整目录)。新增来源 + 适配器 + 一套 CI 隔离测试套件(`tests/sources-manfred.test.mjs`);注册表现为 **73 个来源 = 68 个英文 + 5 个俄文**(`ALL_ADAPTERS` 68)。已出现在 `#/scan` 的 Source 筛选器与 cvstart.org 落地页中。

### 修复
- **a16z Speedrun 信息流曾悄悄截断为 50 条职位**(#2404)—— 该信息流单页上限为 50 条,但该来源请求的是 `PER_PAGE = 100`,导致翻页在第一页之后就停止。已更正为 50。
- **失效招聘板现在会抛出异常,而不再被误读为「存活但为空」**(#2379)—— `cryptocurrencyjobs`、`phenom`、`radancy`、`successfactors`:当没有任何请求成功返回时,现在会抛出异常(以便 `#/portals` 健康检查与扫描记录到真实的失败),而不再被悄悄吞掉、返回空列表;若失败发生在至少一次成功之后,扫描仍会保留已取得的部分结果。
- **workable 现在使用公开的 widget API**(#5ab8425)—— 已切换为 `apply.workable.com/api/v1/widget/accounts/<slug>`,该接口能一次性返回大账号的完整职位列表,因此大账号不再被截断。

### 说明
- 未移植(仅限 CLI 或未被 web-ui 镜像):`detect-reposts` #2389 的标题分桶性能重写;Unicode 公司键修复(web-ui 自身的跟踪器去重本就对非拉丁字符安全);`scan --since`;`cv-facts`;CV 模板 / PDF 审计流程;`doctor`;modes 的不可信内容指令。

## [1.133.1] — 2026-08-02

### 修复
- **`#/funded`(获投公司)现在能够正确渲染结果** — 两个 bug 导致该表格即使父项目的 `company-funded.mjs` 已经返回完整列表,也始终显示「暂无获投公司」。(1) 视图此前从 `res.candidates` 读取结果,但父项目实际以 `companies` 输出(每条记录形如 `{ company, amount, round, funding: { sources: [{ source, url, observed_date }] } }`);客户端现在读取正确的键,并按真实的证据结构进行映射。(2) 结果表此前把单元格以变长参数的形式传给 `UI.el('tr', {}, …)`,但 `UI.el(tag, attrs, children)` 的 `children` 参数只接受单个节点或数组,因此此前只有第一列(Company)会被渲染 —— 单元格现在以数组形式传入。已在真实浏览器中验证:四个信息流共 11 家公司渲染出 Company / Funding signal / Source / Date 四列,证据链接可正常点击,控制台零报错。结果为空时现在也会展示各信息源的诊断信息,以便区分「今日无新闻」与「信息流被屏蔽」两种情况。
- **`tests/parity-routes-v1133.test.mjs`** 中新增回归防护:伪造的父项目脚本现在会产出真实的 `companies` 输出结构(此前的 fixture 错误地照搬了 `candidates` 结构 —— 这正是该 bug 能够绿灯发布的原因),并新增源码静态断言(canary),确认 `funded.js` 读取的是 `res.companies`(绝不是 `res.candidates`),且构建表格行时以数组形式传入子节点(+1 → **2144**)。

## [1.133.0] — 2026-08-01

### 新增
- **获投公司发现(`#/funded`,与父项目 #2117 对齐)** — 新增一个只读视图,通过 `GET /api/company-funded` 中继父项目 career-ops 的 `company-funded.mjs`:这是一份供你先行审阅的近期获投公司列表,数据来自公开的、主机锁定的融资信息流(TechCrunch、PR Newswire、The Guardian、Hacker News)。该中继以 `--json --dry-run` 方式运行脚本(JSON 输出到 stdout,不写入任何文件),绝不会把用户输入透传进 `--sources`,自带限流,并且由用户主动触发(一个 Discover 按钮,绝不会在挂载时自动运行)。新增路由模块 `server/lib/routes/funded.mjs` + `public/js/views/funded.js`,归入 Sourcing 分组。
- **每周面试摘要(`#/interview-digest`,与父项目 #2129/#2130 对齐)** — 新增一个只读视图,通过 `GET /api/interview/weekly-digest` 中继父项目零 LLM 的 `weekly-digest.mjs`:对面试环节记录做机械式汇总 —— 本周与哪些公司、在哪些轮次进行了面试、反复出现的能力项,以及尽力而为得出的待补差距。可选的 `?from=&to=` 区间仅在两者均为合法的 `YYYY-MM-DD` 时才会被透传;空区间同样是合法的 `available:true` 摘要。新增至 `server/lib/routes/interview.mjs` + `public/js/views/interview-digest.js`,归入 Analytics 分组。
- 当父项目脚本不存在时(CI、独立安装),两个中继均遵循既有的故障自降级 `available:false` 约定。新增 26 个 i18n 键 ×17;CI 隔离测试套件 `tests/parity-routes-v1133.test.mjs`(+5 → **2143**)。

### 说明
- 父项目 career-ops 已推进到 v1.24.0 之后,带来了 Next.js **web/** 应用的**跟进跟踪器页面**(#1422)与**后端 PDF 渲染**(#2182)—— **未移植**:web-ui 已有自己的跟进中继与 PDF 运行器,底层 `followup-cadence.mjs` 的加固会通过外壳调用中继自动生效、无需额外改动。`set-status.mjs` / `tracker-utils.mjs` 的改动属于 CLI 内部实现,未做镜像。

## [1.132.0] — 2026-07-31

### 变更
- **`#/scan` 结果渲染子系统提取到 `public/js/lib/scan-results.js`**(文件体积契约技术债 — `public/js/views/scan.js` 已膨胀至约 1254 行)。该子系统 — `renderResults`、`buildChipRow`、行构建器与分面构建器、选项绘制器,以及 `FALLBACK_SOURCES` 注册表镜像 — 移入一个 `window.ScanResults.create(ctx)` 工厂函数,该工厂闭包捕获由视图提供的上下文对象。**行为无变化** — 这些函数被逐字移动,闭包变量改接到 `ctx.*`;`scan.js` 现为约 906 行(计划进行第二轮提取以达到 800 行目标)。
- **新增浏览器内回归门** — `tests/playwright-scan-filters.mjs` 预置一份规范的 `data/last-scan.json`,并驱动每一个 `#/scan` 筛选项,断言精确的行数,从而针对真实浏览器行为验证此次拆分。
- **README 横幅精简** — 冗长的逐版本"最新版本"叙述墙被撤下,改为一行摘要 + 指向完整变更日志(本文件)的链接。

## [1.131.2] — 2026-07-31

### 变更
- **`app.css` 拆分为三个有序样式表**(文件体积契约技术债 — 单文件已膨胀至约 1990 行,远超 800 行的硬性上限)。现拆分为 `app.css`(约 672 行 — 无障碍、设计令牌/主题、侧边栏、主区域、按钮、内容外壳)、**`components.css`**(约 595 行 — 卡片、栅格、分页器、徽章、表格、表单、日志/控制台、markdown、语言切换器、芯片筛选器、连接横幅)与 **`overlays.css`**(约 737 行 — toast、通知抽屉、模态框、杂项/响应式、`[dir="rtl"]` 镜像、docs-fab、usage-hud),三者均在硬性上限之内。
  - 本次拆分**连续且按原顺序进行**,因此级联结果与拆分前的文件**逐字节完全一致**;`index.html` 按顺序加载这三个 `<link>`。**行为、标记与 i18n 均无变化。**
  - 断言 CSS 的测试现通过共享的 `tests/helpers/css.mjs::loadAppCss()` 辅助函数读取拼接结果。新增的 `tests/css-modularization.test.mjs` 锁定此次拆分(文件存在 · 每个文件 ≤ 800 行 · index.html 的 link 顺序)→ 套件 **2138**。已在浏览器中验证:三个样式表均能正确解析,且其规则均生效。

## [1.131.1] — 2026-07-31

### 修复
- **两个 v1.130.0 来源的适配器主机锁定一致性**(代码评审跟进,纵深防御;对合法输入无行为变化):
  - **`a16z-speedrun-talent` 适配器**现在会在 `buildEndpoint` 处重新校验 `api:` / `a16z-speedrun-talent:` 覆盖值(HTTPS + 精确匹配主机 `speedrun-talent-network.com`),校验失败时回退到规范信息流 — 与 `cryptocurrencyjobs` 适配器保持一致,因此越权主机值永远不会到达抓取环节(此前仅依赖抓取时的 `assertSpeedrunUrl` 守卫)。精确主机校验现为单一导出的 `SPEEDRUN_TALENT_HOST_RE`,由守卫与适配器共用。
  - **`cryptocurrencyjobs` 解析器** — `cleanUrl` 现在使用与 `assertCryptocurrencyJobsUrl` 及适配器覆盖值相同的精确匹配主机守卫(此前为 `endsWith`,会接受子域名)。解析器的宽松度永远不会超过 SSRF 守卫:`sub.cryptocurrencyjobs.co` 的条目链接会被丢弃。
  - +2 个测试 → 套件 **2135**。

## [1.131.0] — 2026-07-31

### 新增
- **`#/tracker` CRM 阶段标签看板**(从父项目 Web 应用的 `/pipeline` 视图移植而来)。跟踪器原有的漏斗筹码栏 + 状态下拉菜单被替换为**阶段标签条**:一个 **All** 标签加上每个规范状态各一个标签 — **Evaluated · Applied · Responded · Interview · Offer · Rejected · Discarded · SKIP · Hired** — 每个标签都显示实时的全历史计数,**包括零计数阶段**,以便完整漏斗始终可见(CRM 风格)。当前激活的标签驱动过滤;再次点击它会清除回 All。行仍保留分数色调、合规性、PDF 与报告的可操作项,当徽标功能启用时(默认关闭 → 零额外请求),公司单元格现在会显示品牌徽标。
  - 新增只读路由 **`GET /api/tracker/stages`**,返回规范漏斗(按顺序排列的标签)+ 别名折叠映射,来源于 `server/lib/states.mjs`(`templates/states.yml`,并有内置回退)— 因此客户端**永远不会硬编码状态白名单**。旧版无参数 `GET /api/tracker` 响应保持不变(仅 `{ rows }`)。
  - 新增纯函数、已做单元测试的客户端库 **`public/js/lib/tracker-stages.js`**,依据服务器返回的阶段对行进行分桶,可容忍杂散的 markdown 加粗标记与本地化别名(例如 `aplicado` → `Applied`)。标签具备无障碍支持(role tablist/tab、aria-selected、≥44 px 点击区域,计数包含在每个标签的无障碍名称中)。无新增 i18n 键。测试套件 **2133**。

## [1.130.0] — 2026-07-31

### 新增
- **从父项目 career-ops v1.24.0 移植两个新扫描来源**(均为进程内实现,无新增依赖;两者均出现在 `#/scan` 来源筛选与 cvstart.org 落地页中):
  - **a16z Speedrun**(`a16z-speedrun-talent`,#2231)— a16z Speedrun *人才网络*板块的全站点 JSON 信息流。主机锁定为 `speedrun-talent-network.com`,仅限 HTTPS,0 起始分页并设页数上限,按公司透传 `q`/配置,故障自降级。
  - **Cryptocurrency Jobs**(`cryptocurrencyjobs`)— Web3 招聘板 `cryptocurrencyjobs.co`,通过其公开 RSS 2.0 订阅源接入(零鉴权)。两轮 XML 实体解码,仅远程职位,雇主名从标题结尾的 `"… at <Company>"` 中解析得出。
  - 注册表总数现为 **72 个来源 = 67 个英文 + 5 个俄文**(`ALL_ADAPTERS` = 67 个英文门户适配器)。

### 修复
- **`echojobs` —— 混合职位与远程职位保持可区分**(镜像父项目 #2258)。大小写不敏感的 `hybrid` 标记现会生成 `"<城市> · Hybrid"`(若无城市则为单纯的 `Hybrid`)以及 `workplaceType: 'Hybrid'`,而不再被折叠为 `Remote`。
- **`radancy` —— 旧版 TalentBrew 标记 + JSON 结果片段传输**(镜像父项目 `a3e6df9`),由可注入的 `opts.fetchJson` 把关。

### 说明
- **未移植 —— 仅限 CLI 的父项目功能。** career-ops v1.24.0 庞大的 CLI/模式层未进入 web-ui(web-ui 是查看器 + 轻量直写层,而非模式宿主):合规/司法辖区表格、联系人电话簿 + vCard、面试转录复盘 / 通话平台检测、ledger 状态设置、结果记录、两轮分诊、jd-similarity、带版本的投递 CV 产物模式、doctor 的 Playwright-MCP 检测,以及 `portals/fix-slugs.mjs`。存在于父项目 `scan.mjs` 中的扫描编排改动不适用 —— Interamt.de 的 Playwright 扫描器、iCIMS 反向 ATS 全量扫描、国家资格远程筛选、DNS 查询节流、StepStone 的 `rltr` 去重,以及扫描历史的规范化公司列:web-ui 是进程内运行 EN/RU 扫描器,不会调用父项目的 `scan.mjs`。
- **已覆盖。** `role-matcher` 的重音折叠修复(#2209)已在 v1.127.0 移植,此处为空操作。

## [1.129.1] — 2026-07-29

### 修复
- **对 v1.128/v1.129 web 移植的 AI 评审跟进**(均为咨询性,源头修复):`job-facets.js` 级别优先级(显式修饰词现在胜过管理词 — `Senior Engineering Manager` → `senior`,原为 `lead`);`states.mjs` 回退不再被固定(成功读取仍记忆化,回退不缓存返回 — 启动时父项目短暂不可用会在下次调用重读)+ 对存在但损坏的文件 `console.warn`;`score-tone.js` — 无评分的行为中性(`muted`)而非红色;`domainFromName()` 在 `/api/logo` 前跳过非 ASCII slug;+`tests/states.test.mjs` 隔离守卫。+4 个测试 → **2073**。

## [1.129.0] — 2026-07-29

### 新增
- **`#/scan` 级别分面 + 时长列** — v1.128.0 的 `job-facets.js` 库现已接入扫描 UI(此前仅逻辑)。新的**级别**下拉将每条职位标题归入 lead/staff/senior/mid/junior/intern(`JobFacets.seniorityFromTitle`),并按结果中实际存在的项自动填充(与国家分面一致);无级别词的标题始终通过。可在已保存搜索、重置与应用中保持。结果表新增**级别**徽章列与零 token 的**时长**列(`今天`/`N天`,来自 `JobFacets.daysSince`)。12 个 i18n 键 ×17,+3 个测试 → **2069**。

## [1.128.0] — 2026-07-29

### 新增
- **从父项目自有 Web 应用(`../web/`,Next.js)移植四项解决方案** — 以原生 JS/ESM 重新实现,无新依赖:(1)`server/lib/states.mjs` 实时读取 `templates/states.yml` 作为跟踪器状态词汇的唯一来源(含 CI 回退)— 免除每次发布的手动白名单重新同步;POST 将别名(西班牙语/旧版)折叠为规范标签,GET 漏斗按规范状态分桶;(2)ATS 托管行的公司徽标 — `domainFromName()`(约 90 个品牌→域名);(3)`score-tone.js` — 4 级评分色调(≥4.2/3.8/3.0 + 字母回退);(4)`job-facets.js` — seniority/source/days 分面。+21 个测试。

### 说明
- 未移植(仅概念):父项目的智能体动作层(`actions/registry.ts` + `api/assistant/route.ts`)— 供 `docs-fab` 升级为副驾时的蓝图。无新来源(注册表 **70**),无 i18n/help 变更。

## [1.127.0] — 2026-07-29

### 新增
- **三个新扫描来源(career-ops v1.23.0 一致性)** — 注册表现提供 **70 个适配器(65 EN + 5 RU)**:**Flowxtra**(免鉴权全站聚合器)、**VDAB**(佛兰德公共就业服务关键词 API)、**iCIMS**(`careers-<tenant>.icims.com` 门户,区别于 `jibeapply`)。此外 **Cursor** 回归 CLI 名单(parent #2115):`cli-detect` 现检测 `cursor`(**10 个工具**),并在 help/README/config ×17 恢复名单。

### 修复
- **agenticjobs** 从 HTML 抓取改为 REST API(#2167);当 `location.name` 仅为工作模式时,**Greenhouse** 从 `/offices` 恢复城市(#2104);**role-matcher** 一致性(#1933/#2164/#2009:MTS 前缀、`product` 基线、重音折叠、次基线分歧)。

### 说明
- **未移植。** v1.23.0 大部分为 web-ui 不调用的 CLI/仪表盘界面(batch-tailor、discover-ats、NL/PT 模式、PDF 主题、Go 仪表盘、updater/doctor);中继脚本无需改动。父项目 VERSION → **1.23.0**。

## [1.126.1] — 2026-07-25

### 修复
- **v1.126.0 重新同步遗漏的两处 CLI 名单漂移** — (1) `#/config` 的 **API keys** 标签页导语(`config.providerModelNote`,i18n ×17)只列出 7 个 CLI — 现在 **Antigravity** 与 **Grok Build** 已插入 OpenCode 之后;(2) 帮助指南(×17)的第二个对比表行以及 CI 构建的站点 help 仍写着 `Inside Claude Code / Codex / Cursor / Gemini CLI`(含过时的 **Cursor**)— 现为完整名单。两处使用了 v1.126.0 扫描模式未覆盖的斜杠/间隔号分隔符。i18n 快照已重新生成;套件仍为 **1969**。

## [1.126.0] — 2026-07-25

### 新增
- **AI CLI 工具选项卡现在检测 career-ops 全部 8 个一级 CLI** — `#/config` 名单已与父项目 `docs/SUPPORTED_CLIS.md` 同步:`server/lib/routes/cli-detect.mjs` 新增 **Grok Build CLI**(`grok`)与 **Kimi CLI**(`kimi`),Antigravity 现在优先探测其规范二进制 `agy`。只读 PATH 扫描现报告 **9 个工具**,仍然从不执行找到的二进制。

### 变更
- **与 career-ops.org/docs 的文档重新同步** — 已将每个文档面与父项目的实时页面(全部 31 页已读)核对。规范 AI 助手名单(help ×17 + README ×17)现列出 8 个一级 CLI — Claude Code、Codex、OpenCode、Antigravity CLI、Grok Build CLI、Qwen Code、Kimi、GitHub Copilot CLI — 外加 Gemini CLI(旧版包装)。帮助包保持 29 H2 / 105 H3 结构。

## [1.125.4] — 2026-07-23

### 变更
- **site 依赖**(dependabot #151–#153)— `site/` 中 `sharp` 0.34.5→0.35.3、`svgo` 4.0.1→4.0.2、`fast-uri`(dev)3.1.3→3.1.4;Astro 构建通过,对 SPA/服务器无影响。

### 说明
- **父项目一致性巡检(career-ops `37d17ec..254764a`,v1.22.0 之后)** — 无需移植: `set-status` 错行防护(#2108)仅限 CLI(web-ui 的跟踪器行在 UI 中显式选择,且没有路由调用 `set-status.mjs`);本地化模式的 Risk Summary(#2109)涉及 web-ui 从不读取的 `modes/<lang>/` 文件(仅读取顶层 `modes/*.md`);`update-system` 清单校验(#2111)仅限更新器;其余为父项目文档(土耳其语 README、SIGNATURES ×4、SCRIPTS.md、es 重音)。父项目 VERSION 保持 **1.22.0** — `parentVersion` 不变。

## [1.125.3] — 2026-07-23

### 修复
- **丹麦语和印地语的 LLM 提示词以英文回答**(用户报告)— `server/lib/prompts.mjs` 中的 `LOCALE_NAMES` 和五个 `SCAFFOLD_STRINGS` 块从未扩展到 `da` 和 `hi`,导致 `resolveLocale()` 回退到 `en`,深度研究(实时与手动)、模式运行、评估、面试、人脉、CV Studio 等所有 AI 提示词在这两个语言下都丢失了 `# Output language` 指令。现在两者均为一等公民: 语言指令 + 本地化脚手架。`tests/locale-scaffold.test.mjs` 的回归门现在遍历规范的 17 语言列表而非硬编码的 12 个,新的结构一致性门会让任何回退到英文的脚手架键失败 — 未来遗漏 `prompts.mjs` 的语言无法再发布(+12 个测试,套件现为 **1969** 个)。

## [1.125.2] — 2026-07-22

### 修复
- **Gemini 深度研究:HTTP 502(`MALFORMED_FUNCTION_CALL`)**(#145,由 [@Alien10140](https://github.com/Alien10140) 贡献)——实时 `/api/deep` 提示词要求模型"Use WebFetch / WebSearch"并把简报保存到文件,但无工具的 API 提供方没有工具通道;Gemini 以函数调用而非文本作答,表现为空的 HTTP 502。`buildDeepPrompt` 与 `bundleProjectContext` 新增 `headless` 标志:实时运行(Anthropic/Gemini/回退级联)获得无工具提示词,仅凭内联上下文撰写简报;供 Claude Code 复制粘贴的提示词则保留工具指令。`tests/critical-fixes.test.mjs` 新增 1 个测试。

### 变更
- **Gemini 默认模型越过已弃用的 `gemini-2.0-flash`**(#144,由 [@Alien10140](https://github.com/Alien10140) 贡献)——配置下拉框、`gemini.mjs` 的服务端回退(此前与提示悄然不一致)、OpenRouter 回退链、`config.geminiModelHint` ×17 以及帮助指南 ×17 现统一指向 **`gemini-3.6-flash`**。新的防漂移门 `tests/gemini-default-model.test.mjs`(+5 个测试)把所有表面钉在同一字面量上——套件现为 **1957 个测试**。

## [1.125.1] — 2026-07-21

### 修复
- **SuccessFactors:多品牌 RMK 租户保留其品牌路径**(父项目 #2099,v1.22.0 之后)—— 运营多个收购品牌、共用同一套 RMK 实例的控股公司通过路径片段来区分品牌(`careers.nemetschek.com/Bluebeam/` vs `…/Vectorworks/`);该适配器此前会将配置的 URL 折叠为其 origin,从而悄悄地只扫描母品牌的职位。现在该端点会保留品牌前缀,仅剥离末尾的 `/search/` 或 `/tile-search-results/` 片段,确保扫描绝不会自我重复;单一域名的租户逐字节不变。新增导出的 `resolveTenantBase` 辅助函数,并在 `tests/sources-successfactors.test.mjs` 中移植 1 个测试代码块。

## [1.125.0] — 2026-07-21

### 新增
- **cvstart.org:「求职来源」落地页板块** — 在截图与对比列表之间新增一个板块,将**全部 67 个扫描来源以可点击标签的形式列出**(62 个英文招聘板/ATS,外加单独归在一个小标题下的 5 个俄文招聘板),每个标签都链接到该来源的公开网站。该列表在构建时从实际的适配器注册表(`sync-assets.mjs` → `facts.sources`)同步而来,因此永远不会与应用本身产生偏差;`Sources.astro` 中人工整理的链接映射由新增的 `tests/site-sources.test.mjs` 把关。头部导航新增了 **Sources** 锚点;新增 4 个站点 i18n 键 × 17 种语言。同时修复了落地页 JSON-LD 中 `inLanguage` 列表此前遗漏 `hi` 的问题。

## [1.124.0] — 2026-07-21

### 新增
- **五个扫描来源**(与父项目 v1.22.0 对齐,#1808/#1572/#2024/#2055)—— **Welcome to the Jungle**(全站点 JSON API)、**Agentic Engineering Jobs**(智能体/AI 工程板块)、**Jobvite**(零认证按租户 ATS)、**Gem**(按租户 ATS)以及 **Alibaba Group**(招聘 JSON API,与美团/腾讯模式相同)。每个来源都是主机锁定、CI 隔离的“来源 + 适配器”文件对;注册表现已提供 **67 个适配器(62 个英文 + 5 个俄文)**;`#/scan` 来源下拉框的回退列表及其漂移检测已同步更新;新增五个测试套件 `tests/sources-{wttj,agenticjobs,jobvite,gem,alibaba}.test.mjs`。

### 修复
- **Arbeitsagentur:仅当 `homeofficetyp` 为 `VOLLSTAENDIG` 时才判定为全国范围远程**(父项目 #1981)—— `homeoffice=nv_true` 查询同时会返回混合办公职位,因此远程判定环节现会以小批量方式对照职位详情接口逐一核实每条命中结果,并在核实失败时安全降级(保留该职位的真实所在城市,使地区筛选功能继续生效)。
- **SmartRecruiters:公开职位链接构建时缺少 `/postings/`**(父项目 #2047)—— 对于公开站点省略该路径段的租户,链接现在会指向公开职位页面,而不再是 404。

### 说明
- 父项目 v1.22.0 还发布了一些 web UI 不会调用或已自行覆盖的 CLI 侧改动:zh-CN 简历模板与 PDF 排版、`/expand` 模式、提供方提示缓存微调(Gemini/OpenAI/Ollama)、按步骤的 token 明细(web UI 有自己的用量计量表)、tracker 写入锁串行化(web UI 自 v1.21 起已通过 `withFileLock` 路由写入操作)、扫描 `visa_filter` 与绝对发布日期 CLI 参数(web UI 有自己的“发布时间”年龄筛选)、以及已见来源去重种子(web UI 扫描器保留自有的扫描历史去重)。

## [1.123.0] — 2026-07-17

### 新增
- **Oracle Recruiting Cloud 扫描源**(与父项目 v1.21.0 对齐,#1929)—— 面向 Oracle Fusion/ORC 招聘官网站(摩根大通、甲骨文、纽约梅隆银行、美国运通、霍尼韦尔等)的零认证 `recruitingCEJobRequisitions` REST API:主机锁定为 `*.fa[.<region>][.ocs].oraclecloud.com`,站点编号从每家被跟踪公司的 `careers_url` 中解析得出,采用带硬性页数上限的偏移量分页,并使用可规避 WAF 检测的类浏览器请求头。注册表现已提供 **62 个适配器(57 个英文 + 5 个俄文)**;`#/scan` 来源下拉框的回退列表及其漂移检测已同步更新;新增 CI 隔离测试套件 `tests/sources-oraclecloud.test.mjs`。

### 修复
- **重复发布检测器:基础职位标题与带专项后缀的同类标题保持区分**(父项目 #1922)—— 「Senior Analytics Engineer」不再与「Senior Analytics Engineer, People Analytics」被归并为同一职位:当一个标题的词元是另一个标题词元的严格子集,且多出的词元是真实的专项方向(而非基础通用词)时,二者将被视为可分别投递的独立职位。重复发布的标注(如「(Repost)」「relisted」)现已作为元噪声被列入停用词表。`tests/detect-reposts.test.mjs` 新增 2 条断言。

### 说明
- 父项目 v1.21.0 还发布了一些 web UI 不会调用或已自行覆盖的 CLI 侧改动:重复投递同一家公司的重新申请提醒(web UI 自 v1.84.0 起已有重新投递冷却期)、求职信的 `--format`/`--report` 参数、面试红旗信号/面板情报/未到场邮件提示模式,以及扫描信任信号与门户健康持久化(web UI 通过内置的 `trust-validator` 运行自有的进程内扫描器,并配有「门户健康」页面)、统计/薪资差距扩展功能(以只读、故障自降级方式转发)。

## [1.122.0] — 2026-07-16

### 新增
- **印地语(हिन्दी)——第 17 种语言** —— 完整的界面词典(约 1,110 个键)、完整的应用内帮助指南(29 个 H2 / 105 个 H3 对等)、`README.hi.md`、新增的 `CHANGELOG.hi.md`(从 v1.122.0 起记录,沿用 de/it/tr 的先例)、cvstart.org 落地页 + 方法论/许可证/更新日志/帮助页面、语言切换器(🇮🇳)、浏览器语言自动检测,以及本地化的仪表盘截图。目前全部 ×16 对等闸门均已升级为 ×17:i18n 词典对等 + 快照、帮助指南 H2/H3 闸门、CHANGELOG 对等、网站 `check-i18n`,以及 Playwright 语言环境全量测试。

## [1.121.0] — 2026-07-16

### 新增
- **cvstart.org:方法论、许可证与更新日志页面** —— 落地页在全部 16 种语言中新增三个板块,与现有的对比板块并列:**/methodology/**(六维度 0.0–5.0 评分标准、4.0 分投递门槛与绝不去做的规则——是 [career-ops.org/methodology](https://career-ops.org/methodology) 的本地化摘要版本)、**/license/**(权威 MIT 文本,并指向 NOTICE.md)以及 **/changelog/**(即本文件,按语言环境从仓库的 16 份翻译版更新日志渲染而成)。页头导航新增「方法论」条目,页脚「资源」区块新增相应链接;`sync-assets.mjs` 现在会在构建时把 ×16 更新日志与 LICENSE 同步进落地页,确保这些页面绝不会与仓库内容脱节。
- **文档中新增方法论链接** —— README(全部 16 种语言)、应用内帮助指南 §1 的权威指南列表(全部 16 种语言)以及 wiki,现在都在既有的 [career-ops.org/docs](https://career-ops.org/docs) 指南旁,链接到 [career-ops.org/methodology](https://career-ops.org/methodology)(以及 FAQ 与术语表)。

### 变更
- README 发布横幅与徽章已刷新(测试数 1850,发布版本 v1.121.0)—— 此前横幅仍停留在宣布 v1.119.5。

## [1.120.0] — 2026-07-16

### 新增
- **CareerOps 宣言**(与父项目 v1.20.0 对齐)—— 父项目发布了 CareerOps 宣言(`MANIFESTO.md` · [career-ops.org/manifesto](https://career-ops.org/manifesto))，并已在其 README、更新器与 Go 仪表盘中呈现。Web UI 随之跟进:侧边栏页脚新增一个链接以打开宣言页面(全部 16 个语言新增 `footer.manifesto` i18n 键)，应用内帮助指南在全部 16 种语言中新增 §29「CareerOps 宣言」，README 讲解了宣言是什么以及如何签署，cvstart.org 落地页页脚也链接到了它。

### 说明
- 父项目 v1.20.0 还修复了 `upskill` 定向模式下已掌握技能的抑制逻辑、静音了 dotenv 以使 `scan --json` 的 stdout 保持可解析，并修复了 HTML 简历模板中职位标题与其要点分离的问题——这些均为 CLI 侧的改动，web UI 不会调用它们，因此本次无需修改 web-ui 代码。

## [1.119.5] — 2026-07-13

### 修复
- **落地页语言按钮不再折行** — v1.119.2 加入旗帜后,页头切换器标签(如「🇷🇺 Русский」)在较窄的桌面宽度下可能折成三行;切换器标签及下拉菜单所有选项现在均为 `whitespace-nowrap` —— 旗帜 + 语言名始终一行。 页脚语言列表也从固定两列栅格改为可换行的一行式条目——「🇧🇷 Português (Brasil)」同样不再从名称中间断开。

## [1.119.4] — 2026-07-13

### 变更
- **LICENSE 写明作者** — 版权行现为 *Sergei Emelianov (Fighter90) <https://sergey-cv.com> and career-ops-ui contributors*(MIT 规范正文未动)。新增 **NOTICE.md** 详细阐述许可:版权归属、MIT 授权确切涵盖什么(代码、文档、翻译、落地页、wiki)、不涵盖什么(你的运行时数据、父项目、招聘板块内容、商标)、第三方组件表(express/js-yaml — MIT;Astro/Tailwind — MIT;Figtree 与 JetBrains Mono 字体 — SIL OFL 1.1;sharp — Apache-2.0)以及可选的署名行。

## [1.119.3] — 2026-07-13

### 新增
- **SECURITY.md** — CONTRIBUTING 指向的安全政策现在真的存在了:支持的版本、私密报告流程(仓库已**启用 GitHub 私密漏洞报告** — Security 标签 →「Report a vulnerability」)、绑定 localhost 的单用户应用威胁模型(范围内:恶意职位内容的 XSS / SSRF / 路径穿越 / 密钥泄露 / 削弱 CSP;范围外:对自己 localhost 的 DoS 与父项目的问题),以及面向审阅者的加固基线。

## [1.119.2] — 2026-07-13

### 新增
- **CONTRIBUTING.md** — 落地页和 README 一直链接的贡献者指南现在真的存在了:安装、项目地图、安全/免构建硬规则、测试层级、添加扫描源的「双注册表」演练、×16 i18n 契约、提交/PR 规范与发布流程。
- **落地页语言旗帜** — cvstart.org 的语言切换器、页脚语言栅格和「用你的语言阅读」横幅现在在每个语言的自称旁显示其旗帜(与应用语言 `<select>` 相同的区域指示符集;在缺少旗帜字形的平台上退化为区域字母)。
- **落地页页脚修复** — 失效的 Discussions 链接(仓库未启用该功能)现指向项目 **wiki**,页脚新增作者署名:**Sergei Emelianov**([sergey-cv.com](https://sergey-cv.com/) · [LinkedIn](https://www.linkedin.com/in/sergey-emelyanov-in-job/))。

## [1.119.1] — 2026-07-13

### 修复
- **`#/scan` 的来源筛选器追上了注册表** — Source 下拉框背后的静态 `FALLBACK_SOURCES` 列表(仅在 `GET /api/scan/sources` 不可达时使用)自 v1.87.0 起悄悄落后:离线回退中缺少 20 个提供方(Amazon、Avature、SAP SuccessFactors、Get on Board、Dassault Systèmes、beesite、HigherEdJobs、JibeApply (iCIMS)、softgarden、Cornerstone、Phenom、Radancy、Deutsche Bahn、EchoJobs、TKMS、Heckler & Koch、Rheinmetall、LaraJobs 以及新增的 Meituan / 腾讯)。现已与全部 **61** 个同步,并由一个漂移测试守护——只要客户端列表与服务器注册表出现分歧(值和标签),CI 即失败。+1 个测试(**1845**)。

## [1.119.0] — 2026-07-13

父项目 career-ops **v1.19.0** 对齐 + cvstart.org 落地页焕新。

### 新增
- **2 个新扫描提供方** — 美团(`zhaopin.meituan.com`)与腾讯(`careers.tencent.com`):中国科技公司招聘板块的免认证公开 JSON API,按主机自动检测或通过显式 `provider:` 选择,支持按关键词的服务端搜索、分页与按 URL 去重 — 现共 **61 个适配器**(56 个英文 + 5 个俄文)。+20 个测试(**1844**)。
- **落地页贡献者板块** — cvstart.org 展示所有贡献过代码者的头像(构建时调用 GitHub `/contributors` API,过滤机器人),已本地化到全部 16 种语言,并链接到完整贡献者图谱。
- **落地页实时 GitHub 星标计数** — 页头徽章现在每次访问都从 GitHub API 在客户端刷新(构建时快照作为回退),每周定时的 Pages 重建保持快照与贡献者列表新鲜;CI 中的 API 调用已使用令牌认证。

### 修复
- **Workday CXS 请求携带浏览器式请求头**(父项目 #1813)— Cloudflare 保护的租户(实测:geico)对缺少常规 UA/`accept-language`/`origin`/`referer` 的请求返回 500;抓取器现从 CXS URL 本身推导 origin 与站点 slug。Glints 请求也获得了同样的浏览器 UA + origin/referer,二者均来自 `http-json.mjs` 中共享的 `BROWSER_LIKE_USER_AGENT` 常量。

## [1.118.4] — 2026-07-10

### 修复
- **从俄罗斯 IP 扫描 hh.ru 返回 0 条结果(区域子域名链接)** — 从俄罗斯住宅 IP,hh.ru 会把搜索 302 重定向到区域子域名(`sochi.hh.ru`、`spb.hh.ru` 等),并在该子域名上返回职位链接。解析器按固定主机 `https://hh.ru/vacancy/` 查找标题链接,与区域链接**一个都不**匹配,因此完全可用的扫描默默记录为 0。现在它接受任意 `*.hh.ru` 主机(`adsrv.hh.ru/click?…` 广告仍被排除 —— 它们没有 `/vacancy/<id>` 路径),并将每个结果 URL 规范化为 `https://hh.ru/vacancy/<id>`。已实地验证:此前返回 0 的 `sochi.hh.ru` 页面现在解析出 17 条真实职位。+1 个测试(**1824**)。

## [1.118.3] — 2026-07-10

### 修复
- **hh.ru 无任何报错地返回 0 条结果(VPN 检测中间页)** — hh.ru 现在会把它判定为 VPN/代理的网络(数据中心 IP)302 重定向到 `/vpncheeck` 中间页(“VPN мешает работе сайта”),该页以 **HTTP 200** 响应且不含任何职位卡片,因此扫描在毫无报错的情况下报告 0 条。扫描器现在通过响应的最终 URL 检测该重定向,在本次运行的剩余时间内禁用 hh.ru,并输出诚实提示:流量必须真正从住宅 IP 出口 — 即使浏览器开关已关闭,系统级 VPN/代理仍可能处于开启状态。+1 个测试(**1823**)。

## [1.118.2] — 2026-07-10

### 维护
- **落地页跟进(#118)** — `site/README.md` 与 Astro 7(#116 的安全升级)保持一致,移除未使用的 import,并为落地页构建脚本新增 **4 个可执行守卫**: i18n 对齐门在字典损坏时可证明地失败,`sync-assets` 绝不写入 `site/` 之外 — 套件 **1822**。解决 2 个 CodeQL 警报(1 个在源码修复,1 个作为预期构建行为予以驳回)。

## [1.118.1] — 2026-07-10

### 修复
- **在俄罗斯境外扫描 hh.ru** — hh.ru 现在对非俄罗斯 IP 的公开搜索页面返回 **HTTP 451**(区域性法律封锁)。扫描器将 451 与 403 同等处理: 首次封锁后,本次运行剩余时间内停用 hh.ru,并在日志中如实提示需要俄罗斯 IP / VPN 出口,不再浪费剩余查询和其他 RU 来源。帮助 §7 已在 16 种语言中更新。测试 +1(**1818**)。

## [1.118.0] — 2026-07-09

父项目 career-ops **v1.18.0** 对齐包。

### 新增
- **9 个新扫描提供方** — Cornerstone OnDemand (`csod`), Phenom (`phenom`), Radancy (`radancy`), Deutsche Bahn (`deutschebahn`), EchoJobs (`echojobs`), TKMS (`tkms`), Heckler & Koch (`hecklerkoch`), Rheinmetall (`rheinmetall`), LaraJobs (`larajobs`) — 现共 **54 个适配器**。Lever 适配器还可识别 EU 租户面板(`jobs.eu.lever.co`)。
- **跟踪器 `Hired` 状态**(与父项目 `states.yml` 对齐): 已接受的 offer 拥有独立的规范状态、庆祝徽章及 `#/tracker` 上的「拿到工作」横幅;漏斗与转化图表将其计为已通过所有阶段。
- **`#/stats` 的累计标签页** — 只读中继父项目的 `stats.mjs`(累计跟踪器汇总、累计漏斗比率、扫描器总数、门户覆盖)及 `salary-gap.mjs` 的薪酬观察(期望 vs 职位标注 vs 实际,按申请)。新路由 `GET /api/stats/lifetime` 与 `GET /api/stats/salary-gap` — 零 token 外壳调用,无父项目时安全降级为 `{available:false}`。
- 16 个语言全部新增 28 个 i18n 键;帮助指南 §14/§26 已在所有语言更新。

### 测试
- 新增 38 个单元测试(三个提供方对齐套件 + 中继/状态路由) — 共 **1817** 个。

## [1.117.2] — 2026-07-06

**对齐外壳调用的空跟踪器修复。** 当跟踪器还没有申请时,父脚本以代码 1 和结构化 `{error}` JSON 退出;跟进节奏板和拒绝模式标签页把它显示为"script-error"。两条路由现在将其转达为健康的空状态(`available:true, empty:true`),UI 显示诚实的"暂无内容"消息。已对真实父项目实时验证。

新增:无。


## [1.117.1] — 2026-07-06

**v1.117.0 加固(CodeQL 分诊)。** 三个外壳调用端点(`GET /api/followup`、`POST /api/followup/seed`、`GET /api/stats/patterns`)现在带有共享的按 IP 限流器(每个请求生成子进程;环回时为 no-op)。添加到 CV 的 URL 文本提取将标签剥离到不动点,然后删除所有剩余的 `<`/`>`——对 LLM 提示词文本而言可证明完整的净化。有效输入行为不变。

新增:无。


## [1.117.0] — 2026-07-06

**父项目对齐包——把父 career-ops 的六项能力带进 UI。** (1) `#/followup` 的**跟进节奏板**:来自 `followup-cadence.mjs` 的每申请紧急度(🔴/🟠/🟡/🔵)+ **播种跟进日期**按钮(`followup-seed.mjs --backfill`)。(2) **拒绝模式**:统计的第四个标签页运行 `analyze-patterns.mjs`(只读)——结果构成、建议、各 ATS 供应商推进率。(3) **添加到 CV**:CV Studio 卡片把 URL 或粘贴文本变成仅基于该来源的 ATS 要点(仅建议、不写入;URL 抓取有 SSRF 防护)。(4) **4 个新扫描提供方** — beesite、HigherEdJobs(RSS)、JibeApply(iCIMS)、softgarden——注册表现有 **50 个适配器(45 EN + 5 RU)**,全部出现在 Scan 下拉框。(5) Apply 清单新增**淘汰项预扫描**步骤。(6) **reconcile 运行器**(`/api/run/reconcile`)。外壳调用路由在无父脚本时诚实降级。

- 新路由模块 `server/lib/routes/followup.mjs`(第 31 个)+ 新路由 + 8 个 source/adapter 文件。测试:新增 6 + 7;套件 1737 → 1750。新增 41 个 i18n 键 ×16。帮助 §13/§17/§24/§26 扩充 ×16。

新增:`GET /api/followup`、`POST /api/followup/seed`、`GET /api/stats/patterns`、`POST /api/cv-studio/add-entry`、`POST /api/run/reconcile`。


## [1.116.0] — 2026-07-06

**用量计量重做 + 首个端到端组件测试。** AI 用量计量(v1.114.0)已正确固定:现在**固定在左侧边栏底部**(占满侧边栏宽度,与侧边栏同一表面),并在侧边栏底部预留与自身等高的空间,使**菜单永不被遮挡**——导航与版本页脚始终在其上方自由滚动。它**实时刷新**(每 15 秒,以及标签聚焦和路由切换时),每个窗口行现在显示真实的 **`<令牌> · <预估费用>`**(进度条按 30 天窗口缩放),而非始终 100% 的"占比"。此外:CV 导入器中一个持久的 `typeof` 屏障从根源关闭了反复出现的 CodeQL 类型混淆误报,新的 Playwright **端到端测试**在真实浏览器中驱动两个常驻组件。

- `public/js/lib/usage-hud.js` + `app.css`、`server/lib/cv-import.mjs`。测试:`tests/playwright-widgets.mjs`(2 E2E)+ `tests/usage-hud.test.mjs`(10)。帮助 §6 扩充 ×16。

新增:无。


## [1.115.0] — 2026-07-06

**设计打磨(保守,保留珊瑚色品牌)。** 对共享设计系统的一次轻量精修——不重构、不改调色板。仪表盘指标卡片现在在悬停时轻微抬起并带上珊瑚色边框(与快捷操作磁贴一致);内容卡片轻微抬起;primary / dark / danger 按钮获得静止阴影与柔和的悬停抬升以增加层次;大数字用 tabular-nums 对齐;交互控件在 2px 键盘环后获得柔和的珊瑚色聚焦光晕。所有动效都尊重 `prefers-reduced-motion`,光晕仅限于控件——绝非全局 `*:focus-visible`。

- 仅 CSS(`public/css/app.css`);无标记、i18n、路由或 CSP 改动。测试:`tests/design-polish-v1115.test.mjs`(5)。已用 Playwright 实时验证。

新增:无。


## [1.114.0] — 2026-07-06

**侧边栏中的 AI 用量与费用计量(左下)。** 一个紧凑的**用量**区块现在位于每个页面侧边栏底部(无侧边栏时为左下角固定卡片;RTL 中为右下角)。它按 **24h / 7d / 30d** 窗口展示 LLM 令牌用量——每个为 `<令牌> · <占比%>`(占全时段比例)配绿色进度条——并附 24 小时预估费用页脚。数据来自 `data/llm-usage.jsonl` 的只读 `GET /api/usage` 汇总(仅本地),与 `#/usage` 页面同源;费用为估算,手动模式运行免费且不计入。可折叠——点击标题切换,状态会保存。

- 新客户端组件 `public/js/lib/usage-hud.js`,从 `index.html` 加载,挂载到版本页脚上方的侧边栏(固定角落回退)。CSP 安全;主题感知 + RTL 镜像。无新服务器路由。测试:`tests/usage-hud.test.mjs`(8)。新增 3 个 i18n 键 ×16。

新增:无。


## [1.113.0] — 2026-07-06

**每个页面上浮动的"询问帮助"助手。** 一个渐变机器人聊天按钮现在浮动在每个页面的右下角(RTL 中在左下角)。点击即可打开一个紧凑聊天,它仅根据你语言的应用内帮助指南回答使用类问题——与 `#/docs-assistant` 页面相同的端点(`POST /api/docs-assistant/ask`),因此从不读取你的简历、资料或跟踪器。有 LLM 密钥时实时回答;无密钥则给出可直接运行的提示词。标题显示机器人头像 + 在线状态;起始徽章填入常见问题;Esc 或点击外部关闭;在 `#/docs-assistant` 页面上自动隐藏。

- 新客户端组件 `public/js/lib/docs-fab.js`,从 `index.html` 全局挂载;CSP 安全;`app.css` 中主题感知 + RTL 镜像样式。无新服务器路由。测试:`tests/docs-fab.test.mjs`(8)。新增 6 个 i18n 键 ×16。帮助 §1 就地扩充。

新增:无。


## [1.112.0] — 2026-07-06

**文档与 QA 整合。** 无用户可见的代码改动。SDD 约定文档(`docs/sdd/CONVENTIONS.md`)更新到当前的 **30 个路由模块**(此前 24 个)和当前测试基线;全项目权威 QA 提示词(`qa/QA-REGRESSION-PROMPT.md`)已整合——发布流程去陈旧化(v1.111、parentVersion 1.17.0、由发布事件触发的发布),§14 新增表修正(Scan 排除重新标注为 v1.109.0)并补入 v1.111 的 CodeQL 收尾——因而可独立作为覆盖所有功能的单一回归提示词。新增一个针对超大上传分支的覆盖测试。

新增:无。


## [1.111.0] — 2026-07-06

**安全 — 清理 CodeQL 待办。** 三项纵深防御强化,从根源关闭剩余的静态分析发现,而非将其忽略(dismiss)。`stripDangerousMarkdown` 现在会转义任何*被截断*的危险标签开头(以 `<script`/`<iframe`/… 结尾的载荷)的 `<`,从而可证明其输出不含任何存活的危险标签。CV 导入通过显式 `Number()` 强制转换读取上传缓冲区的大小——一道类型混淆屏障。模式角色行现在是用 `String.replace` 插值的模板**字符串**,而非存储的函数,彻底移除了动态派发调用。用户可见行为无变化。

- `server/lib/security.mjs`、`server/lib/cv-import.mjs`、`server/lib/prompts.mjs`。测试:`tests/security-hardening-v1111.test.mjs`(7)+ 更新的 v1108 守卫测试。无 i18n/帮助/路由改动。

新增:无。


## [1.110.0] — 2026-07-06

**文档与 QA 刷新(所有语言)。** 无代码改动。全项目 QA 提示词刷新至 v1.109.0,新增涵盖 v1.98→v1.109 的 §14,常驻 UX 审计与设计导出提示词纳入当前页面集。v1.100–v1.109 新增的每个帮助段落现已翻译为**全部 16 种语言**。

新增: 无.


## [1.109.0] — 2026-07-06

**Scan 排除筛选 + 流水线概览(Web 布局对齐)。** 在 `#/scan` 上,**搜索**框现在把逗号视为**或**("要找的职位"),新增的**排除**字段会隐藏公司/职位/地点包含任一逗号分隔词(如 `senior, staff`)的行;两者都会记入你的已保存搜索。在 `#/pipeline` 上,一个紧凑的**概览条**一眼展示流水线——**收件箱 N**、**已跟踪 N**,以及来自跟踪器的 **Applied / Responded / Interview / Offer** 计数,每个徽章链接到 `#/tracker`。

- 仅客户端(无新路由/写入)。`public/js/views/scan.js` + `public/js/views/pipeline.js`。测试:`tests/scan-pipeline-ui-v1109.test.mjs`(2)。新增 4 个 i18n 键 ×16。帮助 §7 + §8 就地扩充。

新增:无。


## [1.108.0] — 2026-07-06

**安全加固(CodeQL 分诊第 2 轮)。** 又修复三处低危问题:模式提示构建器按**自有键 + `typeof === function`**解析语言角色行,使被篡改的语言无法分派到原型方法(unvalidated-dynamic-method-call);PDF 文件名 slug 在**正则之前限制为 200 字符**,使全连字符输入无法回溯(多项式 ReDoS);文档导入将**数组 `filename`**(重复标头)强制转换为字符串(type-confusion)。对有效输入无行为变化。

- `server/lib/prompts.mjs`、`server/lib/routes/runners.mjs`、`server/lib/cv-import.mjs` + `tests/security-hardening-v1108.test.mjs`(3)。v1.106–v1.108 期间静态分析积压从 167 降至约 14,所有真正与安全相关的发现均已修复,其余(有防护/已净化的误报 + 注释级 lint)已附理由驳回。

新增:无。


## [1.107.0] — 2026-07-06

**净化器加固(静态 XSS 纵深防御)。** `stripDangerousMarkdown`——中和已存储的简历/职位 markdown 中的危险 HTML,使任何绕过渲染时转义客户端的消费者仍然安全——现在会将标签清除运行**至不动点**(重复直到稳定),以便捕获会*重构*载荷的清除(如 `<scr<script></script>ipt>`),匹配**末尾带杂物**的 script/style 等结束标签(`</script foo>`),并清除**未闭合**的可执行开标签(`<script …>`)。对有效 markdown 的行为不变——只会清除更多。

- `server/lib/security.mjs`:不动点循环(限 8 轮)+ `[^>]*>` 结束标签模式 + 未闭合开标签清除。`tests/cv-xss-bypasses.test.mjs` +3 回归用例。权威的 XSS 边界仍是输出转义(`UI.md`);这加强了静态保证并关闭了相应的 CodeQL 发现。

新增:无。


## [1.106.0] — 2026-07-06

**安全加固(CodeQL 分诊)。** 梳理静态分析积压后修复了三处真实(尽管低危)问题:路由渲染的错误路径现在会**在错误消息到达 DOM 之前进行转义**(服务器错误可能回显用户输入,故视为不可信——XSS 边界),档案/配置的属性写入会**拒绝 `__proto__` / `constructor` / `prototype` 键**(以防万一的原型污染防护——键来自固定字段规格,而非原始请求输入)。其余告警多为对扫描器合法读写 `data/*` 以及已带自有限流器的路由的误报,已附理由驳回。

- `public/js/router.js` 在 `innerHTML` 之前用 `UI.escapeHtml` 转义 `err.message`;`server/lib/routes/content.mjs` 和 `server/lib/routes/config.mjs` 防护原型键。对有效输入无行为变化。测试:`tests/security-hardening-v1106.test.mjs`(3)。无新增 i18n 键。

新增:无。


## [1.105.0] — 2026-07-06

**AI 用量与成本页面。** 新的**AI 用量**页面(侧边栏,健康旁边)显示你在**实时** AI 生成(评估、报告、对话)上花费的代币,按**提供方**分列,涵盖最近 24 小时、7 天、30 天和全部时间,并附**预计 USD** 成本。每次实时调用都会向 `data/llm-usage.jsonl` 追加一条小记录 `{provider, in, out}`(不向任何地方发送);无密钥运行(手动模式)不产生费用,也不记录。

- 新路由模块(第 30 个) `server/lib/routes/usage.mjs` — `GET /api/usage`(只读聚合) + `server/lib/llm-usage.mjs`(`recordUsage` 归一化 Anthropic/OpenAI/Gemini 的用量结构并尽力追加;`readUsage`/`aggregate` 按 24h/7d/30d/全部窗口 × 提供方聚合) + `server/lib/llm-pricing.mjs`(**可编辑**的各提供方 `$/1M` 代币价格表——代币数精确,美元为可修改的近似标价,不计费)。记录挂接在分发点(`runActiveProvider` + `routes/llm.mjs`)。
- 新视图 `public/js/views/usage.js`(`#/usage`,时间窗标签)。测试:`tests/usage-routes.test.mjs`。新增 17 个 i18n 键 ×16(`usage.*` + `nav.usage`)。帮助 §6 就地扩充。

新增:`server/lib/routes/usage.mjs`;`server/lib/llm-usage.mjs`;`server/lib/llm-pricing.mjs`;`public/js/views/usage.js`。


## [1.104.0] — 2026-07-06

**扫描表中的公司徽标(保护隐私)。** **应用设置**中新增的**外观**开关——**在扫描表中显示公司徽标**(默认关闭)——会在 `#/scan` 的公司名称旁绘制其徽标。徽标是**从公司自己域名获取的 favicon**,并在服务端代理(`GET /api/logo`),因此**没有任何第三方徽标服务能得知你在查看哪些雇主**。位于共享招聘门户(Greenhouse、Lever、Ashby 等)的职位会显示彩色**字母徽章**而非门户图标,任何加载失败的徽标也回退到同一徽章。

- 新路由模块(第 29 个) `server/lib/routes/logos.mjs` — `GET /api/logo?domain=`。它校验域名(无协议/路径/回环),通过 **SSRF 安全的 `safeGet`**(新的 `binary` 模式返回原始字节 + content-type;DNS 固定、重定向校验和大小上限不变)获取 `/favicon.ico`,进行**图像魔数嗅探**以绝不把 HTML 错误页当作图像返回,将命中**与**未命中都缓存在内存 LRU 中,并**不向磁盘写入任何内容**。
- 新客户端库 `public/js/lib/company-logo.js`(`window.CompanyLogo`):通过 localStorage 标志默认关闭;跳过共享 ATS 主机改用确定性字母头像;CSP 安全的 `img.onerror` 回退。测试:`tests/logo-routes.test.mjs`。新增 5 个 i18n 键 ×16(`appear.*`)。帮助 §2 就地扩充。

新增:`server/lib/routes/logos.mjs`;`public/js/lib/company-logo.js`。


## [1.103.0] — 2026-07-06

**设置："AI CLI 工具"——已安装哪些。** career-ops 以 Claude Code 驱动，但可与任何遵循开放技能标准的智能体 CLI 配合。**应用设置**(`#/config`)中的新**AI CLI 工具**标签页显示 Claude Code、Codex、Gemini CLI、OpenCode、GitHub Copilot CLI、Qwen、Antigravity 中哪些安装在运行服务器的机器上及其路径。这是**只读的 PATH 扫描**：只检查每个二进制是否存在，**绝不运行它**(无 `--version`，不执行)，不写入任何内容，也不触碰用户数据。

- 新路由模块(第 28 个) `server/lib/routes/cli-detect.mjs` — `GET /api/cli-detect`。检测从固定的 7 项白名单出发，沿 `process.env.PATH` 解析二进制路径(Windows 的 `.cmd/.exe/.bat` 垫片；POSIX 的可执行位);PATH 上的恶意文件绝不会被此路由执行。
- `public/js/views/config.js` 中的新"AI CLI 工具"标签页(懒加载,可通过 `#/config?tab=cli` 深链)。测试:`tests/cli-detect-routes.test.mjs`。新增 8 个 i18n 键 ×16(`cli.*` + `config.tabCli`)。帮助 §2 就地扩充。

新增:`server/lib/routes/cli-detect.mjs`。


## [1.102.0] — 2026-07-05

**"向文档提问"——基于应用内帮助指南的对话。** 新增**向文档提问 💬**页面(侧边栏，帮助下方)：输入"如何扫描招聘门户？"这类问题，即可获得**仅**来自你所用语言的应用帮助指南的答案——它会显示所用章节，且**绝不读取你的简历、档案或求职信息**。这是关于如何使用应用，而非关于你。有 LLM 密钥时实时作答；无密钥时提供一个已填入相关帮助章节的现成提示词。

- 新路由模块(第 27 个) `server/lib/routes/docs-assistant.mjs` — `POST /api/docs-assistant/ask`。**零依赖检索：** 将你语言的帮助文档拆分为 `##` 章节，按与问题的关键词重叠打分；置顶章节被内联，模型须据此作答或说明指南未涵盖(不杜撰功能/路由)。共享提供方级联、手动回退、限速、**不写入**、不读取用户数据。
- 新视图 `public/js/views/docs-assistant.js`。测试：`tests/docs-assistant-routes.test.mjs`。新增 14 个 i18n 键 ×16(`docs.*` + `nav.docsAssistant`)。帮助 §1 就地扩充。

新增：`server/lib/routes/docs-assistant.mjs`；`public/js/views/docs-assistant.js`。


## [1.101.0] — 2026-07-05

**CV Studio：针对特定职位定制简历并撰写求职信——由招聘官检查清单把关。** `#/cv-studio` 新增**针对职位定制**卡片：粘贴职位描述(可选填目标职位/标题)，CV Studio 即生成**为该职位定制的简历以及匹配的求职信**，并在交付前让两者通过**检查清单门禁**——`error` 拦截(在你看到结果前已修正)，`warn` 提示。该机制把职业辅导实践提炼为**通用**规则——招聘官几秒内读完，因此相关经验置顶、标题匹配职位角色、成果带具体数字、求职信保持简短且只含一条"要求↔你匹配的事实"的桥接。仅基于你自己的简历、档案和两页纸，**绝不杜撰**——不硬编码公司、角色或经历。

- 新端点 `POST /api/cv-studio/tailor`(扩展现有 cv-studio 模块——没有第 27 个模块)：`buildTailorPrompt` + 通用 `TAILOR_INSTRUCTIONS` 门禁，基于 `bundleProjectContext`，共享提供方级联，无密钥时手动提示词，限速，**不写入**。结果通过共享 `report-export.js` 工具栏导出为 Markdown / PDF / **DOCX**。
- 测试：`tests/cv-studio-routes.test.mjs` +3。新增 10 个 i18n 键 ×16(`cvs.tailor*`)。通用参考 `docs/prompts/resume-cover.md`。帮助 §24 就地扩充。

新增：`docs/prompts/resume-cover.md`。


## [1.100.0] — 2026-07-05

**两页纸：基于简历的 AI 自动填充 + 预览 + 导出为 PDF/DOCX/Markdown。** 两页纸(`#/two-pager`)记录你对下一份工作真正想要的东西，但此前每个字段都得手动撰写，或把提示词复制到别的工具里。现在**✨ AI 填充助手**会用你配置的提供方实时运行——*只*读取你的简历 + 档案(经由 `bundleProjectContext`，绝不杜撰)，起草所有字段(我是谁 / 喜欢 / 必备 / 讨厌 / 硬性排除 / 不可妥协 / 目标环境)并填入表单，供你检查、编辑并保存。没有 API 密钥时，会像以前一样回退到复制提示词的弹窗。新的**👁 预览并导出**按钮把两页纸渲染为带格式的文档，并提供**下载 .md / 另存为 PDF / 另存为 DOCX / 复制**工具栏。

- **零依赖 `.docx` 导出。** 新增 `server/lib/docx.mjs`，生成一个最小但有效的 Office Open XML `.docx`(四个 OOXML 部件的 DEFLATE ZIP，逐条 CRC-32)——不引入新的运行时依赖(依赖仍为 `express` + `js-yaml`)。新路由 `POST /api/export/docx`(`server/lib/routes/export.mjs`，第 26 个路由模块；无状态，限制 200 KB，不写入 / 不调用 LLM / 不抓取 URL)。已接入共享的 `public/js/lib/report-export.js`，因此**市场报告、职业规划和职业定位报告也获得 DOCX 导出**。
- 实时自动填充使用共享的提供方级联(`runActiveProvider` / `providerAvailable`)；返回的 YAML 会被解析并强制转换回受限的两页纸结构(`parseYamlFields` + `normalizeTwoPager`)——丢弃未知键，数组/字符串设上限。保留手动模式。
- 测试：`tests/export-routes.test.mjs`。新增 4 个 i18n 键 ×16(`export.saveDocx`、`twoPager.preview`、`twoPager.aiFilling`、`twoPager.aiFilled`)。

新增：`server/lib/docx.mjs`；`server/lib/routes/export.mjs`。


## [1.99.0] — 2026-07-05

**门户健康页面**（`#/portals`）。扫描器监视 `portals.yml` 中的一组公司；ATS slug 可能悄然失效，该雇主便从此后所有扫描中无声消失。新的 **Portals** 页面列出每个受监视的公司，点击 **Check portal health** 时通过 DNS 固定的 `safeGet`（防 SSRF）探测每个 `careers_url` 并标记失效者（404 = 被无声丢弃）——只读。同时按评审加固 v1.98.0 的错误报告器：错误环形缓冲区现在会捕获网络层 fetch 失败，清理器会遮蔽无标签的提供商密钥。

新增： `server/lib/routes/portals.mjs`; `public/js/views/portals.js`.


## [1.98.0] — 2026-07-05

**应用内错误报告器**（与父项目 `web-v0.2.0` Web 端对齐）。通知抽屉中的 **🐞 Report a bug** 按钮会收集一份遵循隐私底线的诊断快照——版本、你的屏幕、浏览器、`/api/health` 检查摘要，以及来自新的客户端环形缓冲区的最近 20 条错误——外加一个确定性的去重指纹（`co-web-<base36>`），让你审阅确切的 Markdown，然后打开一个预填的 GitHub issue。不会自动提交；绝不携带你的简历、档案、回答、职位 URL 或密钥。新库 `logbuf.js` + `bug-report.js`；11 个 i18n 键 ×16；`tests/bug-report.test.mjs`。

新增： `public/js/lib/logbuf.js`; `public/js/lib/bug-report.js`.


## [1.97.1] — 2026-07-05

**评审驱动的加固与文档一致性（v1.97.0 的后续）。** 梳理 AI 评审日志后浮现出若干真实修复:

- **`fit-score.js`（扫描 `◎` 适合度徽章）。** `salaryFloor()` 不再将低于年薪口径的费率抬升为虚假的年薪下限——“at least 500 EUR/day”“$80/hr”“6000 monthly”现在返回 `null`,而非一个 500k/80k 的一票否决项。国家匹配现在按整词进行(`\b…\b`),因此“Germany”不再匹配形容词“German”(也不再让“Nigerian”里的“Nigeria”命中),从而不会触发错误的“必须在别处”违规。`tests/fit-score.test.mjs` 新增 3 个测试。
- **文档一致性。** 现在每个本地化 README 都一致地标注 **16 种语言**——Help 行的计数/列表(×13)与本地化章节正文 + “把键加到所有 N 个文件”提示(×8)此前仍停留在 v1.85 之前的计数(8/9)。应用内帮助 §17 的适配器计数已在全部 16 个语言包中更正为 **46 个适配器——41 个英语 + 5 个俄语**。

除适合度徽章启发式外无行为变更;无新增路由、键或 i18n 条目。

## [1.97.0] — 2026-07-05

**Dassault Systèmes 扫描器来源 + 三线并进的质量整顿。**

- **新增扫描来源 — Dassault Systèmes（与父级 career-ops 对齐,#1498）。** `server/lib/sources/dassault.mjs` + `server/lib/portals/adapters/dassault.mjs` 复刻了父项目零 token 的 Exalead“卡片搜索”提供方（`3ds.com/careers/jobs` 背后的公开数据源）。它是单一全局端点,因此通过提供方选择（`provider: dassault`）或从 `3ds.com` 主机自动检测,并以 `redirect:'error'` 将 SSRF 主机固定为 `www.3ds.com`。XML 在不使用 DOM 的情况下解析（按 `<Hit>` 构建 `<Meta>` 映射）,城市/国家从本地化的类别字符串中提取,只有当职位的公开 URL 位于 `*.3ds.com` 上时才保留。注册表现在提供 **46 个适配器**（41 个 EN + 5 个 RU）;`ALL_ADAPTERS` 计数、已排序 id 以及 `/api/scan/sources` 的 EN 集合断言从 40 → 41。测试套件 `tests/sources-dassault.test.mjs`(10 个用例)。
- **移植父项目的健壮性修复。** Avature 解析器现在容忍两种线上租户标记变体（带位置索引后缀的 `article--result` + 无类名的 JobDetail 标题锚点,#1541);Get on Board 会防御 `0`/负值的 `published_at`(不再出现错误的 1970 日期);SuccessFactors 会对最后一页设上限,使其不会超出 `MAX_JOBS`(#1528)。
- **服务器审计修复。** `safe-fetch` 在超出上限的响应上不再挂起——大小上限路径现在直接兑现 promise,而不是等待一个已销毁的流永远不会发出的 `'end'` 事件（修复大页面的 `/api/pipeline/preview` + 自动流水线抓取）。SSE `stream.*` 活动日志再次可达（`/api/stream/` 检查移到了笼统的“跳过 GET”守卫之上）。
- **SPA 审计修复。** `#/stats` 标签切换器可防御异步渲染竞态——慢速标签的结果不再会覆盖用户已切换到的更新标签。mock interview 与人脉拓展的删除确认现在会传入正确的标题 + 正文(不再有正文为空的对话框)。
- **翻译修复。** 修正未翻译的词典值——乌克兰语 `config.modes*`(Adaptive Framing / Exit Narrative / Location Policy)、俄语 `eval.jdLbl`（“Job Description”）、意大利语 `dash.quick.contactoSub`（“referral” → “segnalazione”）——以及在 ru/uk/ja/ko/zh-CN/zh-TW 的 CHANGELOG 中将英文 **16 种语言** 的样板文案本地化。

新增: `server/lib/sources/dassault.mjs`; `server/lib/portals/adapters/dassault.mjs`.

## [1.96.0] — 2026-07-04

**职业方向（Epic 27）。** 全新的 **`#/orientation`** 页面回答“哪些方向真正适合我？”——就像职业测评能给你的那种解读,但不是靠问卷,而是从你自己的 CV 和档案中推断。点击 **生成画像**,模型会返回你的 **最契合的职业向量**（八种原型——功能主义者、管理者、沟通者、专家、分析者、创新者、经理、创业者——中哪一种契合,并附上证据）、一种职业类型倾向、推荐职位、与 CV 相关联的职业优势、工作风格倾向,以及发展建议。这是 **对你的 CV 读起来如何的一种 AI 反思——而非心理测验**:它不会虚构成就,也绝不会把数值分数当作实测结果来报告。可导出为 Markdown 或 PDF;不会向磁盘写入任何内容。

- 新增路由 `server/lib/routes/orientation.mjs`（第 24 个路由模块）—— `POST /api/orientation/generate` 通过共享的提供方级联,从 CV+档案+两页纸+记忆构建画像提示词,并提供可复制粘贴的手动回退与 **不写入任何文件**。
- 在 **Growth** 导航分组下,复用 `report-export.js` 实现 Markdown/PDF/复制。
- 测试:`tests/orientation-routes.test.mjs`（反思式表述 / 无捏造分数,以 CV/档案为种子的手动模式）。7 个新 i18n 键 ×16 个语言环境,帮助 **§28** ×16。

新增:`#/orientation`；`server/lib/routes/orientation.mjs`。

## [1.95.0] — 2026-07-04

**职业规划(Epic 26)。** 全新的 **`#/career-plan`** 页面会把你的 CV 与档案转化为一份具体、个性化的发展规划。选择一个 **周期**(6/12/24 个月)和一个可选的 **聚焦方向**,模型 —— 读取你的 CV、档案、双页简介和记忆笔记 —— 便会写出起点快照、优势/成长 SWOT、以 SMART / OKR / WOOP 形式呈现的目标、备选发展轨迹、硬技能/软技能规划、一份 **逐月路线图**、进度追踪方法、常见陷阱与支持性举措。它从你的材料真正体现出的内容向前规划,绝不虚构你的过往经历。可就地编辑,**保存** 到用户层(`config/career-plan.md`),并 **导出** 为 Markdown 或 PDF。

- 新增路由 `server/lib/routes/career-plan.mjs`(第 23 个路由模块)—— `GET`/`PUT /api/career-plan`(写入 `config/career-plan.md`)+ `POST /api/career-plan/generate`(共享的提供商级联、手动回退、不作虚构)。`PATHS.careerPlan`。
- 复用共享的 `report-export.js`(v1.94.0)用于 Markdown/PDF/复制,并新增一个 **成长** 导航分组。
- 测试: `tests/career-plan-routes.test.mjs`(边界处理、GET/PUT 往返、感知周期并以 CV/档案预填的提示词)。在全部 **16 种语言** 中新增 20 个 i18n 键,帮助文档 **§27** ×16。

新增: `#/career-plan`;`server/lib/routes/career-plan.mjs`;`PATHS.careerPlan`。

## [1.94.0] — 2026-07-04

**统计功能,焕然一新(Epic 25)。** `#/stats` 页面现在是一个三标签页的 **统计** 版块,配有真实图表和多得多的数据。全新的 **市场报告** 标签页会请模型对你目标职位在你所选地区与货币下的薪资与劳动力市场进行分析 —— 执行摘要、按职级并含 P10/P25/P75/P90 百分位的薪资、头部雇主、热门技能表、福利出现频率、办公室/混合/远程的占比、12–24 个月的趋势,以及谈判指导。每一项数字都标注为 **来自模型知识的方向性估计**,绝不作为抓取数据呈现。全新的 **我的管线** 标签页会绘制你自己的追踪器:评分分布、状态漏斗、头部公司与职位、随时间变化的申请量,以及转化率。原有的目标职位视图(按国家的职位/薪资 + 已保存快照的趋势)移入第三个标签页,现在带有 **货币选择器** 和 **按职位的招聘数** 概览。

- **导出任意报告** 为 Markdown 或 PDF,或直接复制它 —— 通过共享的 `report-export.js` 助手实现(Markdown 以 blob 下载;PDF 通过现有的内联 PDF 运行器)。
- 新增路由 `server/lib/routes/market.mjs`(第 22 个路由模块)—— `POST /api/stats/market` 会依据你的 CV/档案(因此它知道你的目标职位)、地区和货币构建一段市场分析提示词,通过共享的提供商级联运行,并在没有密钥时回退为一段可复制粘贴的提示词。不写入任何文件。
- 测试: `tests/market-routes.test.mjs`(地区/货币边界、诚实标注的提示词、以 CV/档案预填的手动模式)。在全部 **16 种语言** 中新增 36 个 i18n 键,帮助文档 **§26** ×16。

新增: `#/stats` 重构为标签页;`server/lib/routes/market.mjs`;`public/js/lib/report-export.js`。

## [1.93.0] — 2026-07-04

**记忆层(Epic 24)。** 全新的 `#/memory` 页面保存一条简短、可编辑的「关于我请记住这些」的备注,助手会在 **每一项** 任务中将其牢记于心:

- **一条备注,处处生效** — 由于它被内联进 `bundleProjectContext`,该备注会自动抵达每一次 AI 请求(评估、模拟面试、人脉拓展、CV Studio),并横跨 **所有** 提供商。写一次,它就会引导一切。
- **引导,而非事实** — 它捕捉你的偏好以及你喜欢的工作方式(语气、格式、deal-breaker、节奏),绝不引入关于你经历的新事实主张 —— 那些仍只存在于你的 CV、档案和 two-pager 中。保存到用户层的 `config/memory.md`,绝不会被更新覆盖。
- **从你的数据中提议** — `POST /api/memory/suggest` 会从你自己的申请追踪器中挖掘行为模式,并为你草拟条目供你审阅和编辑。它读取你的追踪器;绝不臆造事实,也不发起实时调用。

新增: `server/lib/routes/memory.mjs`(第 21 个路由模块 —— `GET`/`PUT /api/memory` + `POST /api/memory/suggest`)、`public/js/views/memory.js`、`PATHS.memory`,以及添加进 `bundleProjectContext` 的 `config/memory.md` 块。在全部 **16 种语言** 中新增 11 个 i18n 键。测试: `tests/memory-routes.test.mjs`。

## [1.92.0] — 2026-07-04

**CV Studio(Epic 21)。** 全新的 `#/cv-studio` 页面为你的简历提供三个诚实、基本本地运行的工具:

- **简历诊断** — 一个确定性的 0–100 分,并附带逐项检查的说明(量化影响、无力动词、套话、长度、核心章节、联系方式)。纯客户端(`window.CvDiagnostics`)—— 无 LLM、绝不臆造,每一处发现都有解释,由*你*决定要改什么。
- **隐私脱敏** — 在将简历作为样本或截图分享之前,遮蔽 PII(邮箱、电话、链接/账号、街道地址,以及可选的姓名 → 首字母缩写)。完全在浏览器中运行(`window.CvPrivacy`);它会准确报告遮蔽了什么,且绝不存储原文。
- **Make it human / 语气匹配** — 粘贴一句生硬的话或一段文字,它会以*你的*语气重写,在服务端以 `voice-dna.md` 和 `writing-samples/` 为依据。硬性护栏:它可以重排、精简和重塑语气,但绝不引入文本中尚不存在的事实、指标或成就。通过共享提供商级联实时运行,或在无密钥时回传一段可复制粘贴的提示词。

新增: `server/lib/routes/cv-studio.mjs`(第 20 个路由模块 —— `POST /api/cv-studio/humanize`)、`public/js/views/cv-studio.js`、`public/js/lib/cv-diagnostics.js`、`public/js/lib/cv-privacy.js`、`PATHS.voiceDna` + `PATHS.writingSamplesDir`。在全部 **16 种语言** 中新增 29 个 i18n 键。测试: `tests/cv-diagnostics.test.mjs`、`tests/cv-studio-routes.test.mjs`。(模板库、Word 导出和职位 PDF 归档作为 CV Studio 的后续工作进行跟踪。)

## [1.91.0] — 2026-07-04

**人脉拓展与深度公司调研(Epic 16)。** 全新的 `#/networking` 页面将一家公司转化为一份争取面试的可执行计划,并以你的简历、档案和 two-pager 为依据:

- **公司档案** — 一份精炼的简报,说明公司做什么、值得引用的近期动态,以及从你真实背景中提炼出的「我为何契合」的切入点。
- **该联系谁** — 3–5 个目标人物画像(招聘经理、内部招聘官、团队中的资深 IC、一位有温度的/校友人脉),并为每一位提供具体的 LinkedIn 搜索字符串。绝不编造真实姓名。
- **最温暖的引荐路径** — 针对*你的*背景最现实的温暖切入路径(共同的雇主/学校/社区、二度人脉路径,或一条信号强烈的冷启动私信)及其原因。
- **触达草稿** — 面向头部人物画像的简短、具体的消息,以你真实的证据要点为依据。
- **实时或手动** — 使用任意密钥通过共享的提供商级联实时运行,或回传一段可复制粘贴的提示词(诚实回退,绝不臆造)。**保存计划**会将完成的计划持久化到用户层(`networking/net-{company}-{role}-{date}.md`);该页面可列出、打开并删除已保存的计划。

新增:`server/lib/routes/networking.mjs`(第 19 个路由模块)、`public/js/views/networking.js`、`PATHS.networkingDir`。复用 v1.90.0 的 `server/lib/llm-dispatch.mjs` 级联。**16 个 locales** 全部新增 24 个 i18n 键。测试:`tests/networking-routes.test.mjs`。

## [1.90.0] — 2026-07-04

**Mock Interview 2.0(Epic 15)。** 新的 `#/mock-interview` 页面把你的简历、档案、two-pager 和故事库变成逐轮进行的面试演练:

- **对话式练习** — 设定一个目标岗位(可选填公司 / JD),面试官会以一个聚焦的问题开场。你发送的每个回答都会得到结构化的回复:**Feedback**(优势 + STAR+R 缺口)、**Score**(`N/5`),以及一个探究你上一个回答最薄弱部分的 **Next question**。在服务端以你的真实材料为依据 —— 绝不编造你没有的经历。
- **感知故事库** — `interview-prep/story-bank.md` 会内联进提示词(与 `cv.md` 同等信任级别),因此反馈可以指引你使用自己最好的故事。
- **实时或手动** — 有提供商密钥时,该轮次会通过共享提供商级联(Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models)实时运行;没有密钥时,你会得到一个可直接复制粘贴运行的提示词(诚实回退,不编造答案)。
- **已保存会话** — 点击 **Save transcript** 可将一场完成的面试持久化到用户层(`interview-prep/mock-{company}-{role}-{date}.md`);该页面可列出、打开并删除已保存的会话。

新增: `server/lib/routes/interview.mjs`(第 18 个路由模块)、`public/js/views/mock-interview.js`、`server/lib/llm-dispatch.mjs`(共享提供商级联)、`PATHS.storyBank`、`bundleProjectContext({ extraFiles })`。在全部 **16 种语言** 中新增 30 个 i18n 键。测试: `tests/interview-routes.test.mjs`。

## [1.89.0] — 2026-07-04

**候选人与市场契合 —— two-pager（Epic 14）。** 新增的 `#/two-pager` 页面让你记录 *你自己* 对下一份工作真正想要的东西,借鉴自 *Never Search Alone* 中的「Mnookin two-pager」:

- **引导式构建器** —— 第一人称「我是谁」叙述、「目标环境」备注,以及五个 chip 列表编辑器:**loves**、**must-haves**、**hates**、**deal-breakers** 和 **non-negotiables**。通过 `PUT /api/two-pager` 保存到父项目的 **用户层**(`config/two-pager.yml`)—— 绝不会被系统更新覆盖。
- **AI 填充助手**(`POST /api/two-pager/draft`)—— 生成一个内联了你的 CV + 档案、可直接运行的 Mnookin 提示词,供你在任意 LLM 中运行并把结果粘贴回来。它只使用你自己的材料;绝不编造。
- **与你所想的契合徽章** —— `#/scan` 上的每个职位现在都显示一个 `◎ N` 契合分(客户端,经由 `window.FitScore`),将职位的工作类型、国家、最低薪资和搬迁与你的 two-pager 进行比对。设计上诚实:当职位没有可比对的信号时,**不显示徽章**(绝不编造数字)。deal-breaker 的违背比轻度的不喜欢权重更高。
- **馈入每一次评估** —— 保存的 two-pager 会被内联进 `bundleProjectContext`,因此所有下游 LLM 评估都会将你陈述的偏好与 CV-对-JD 的匹配结合起来。

新增:`server/lib/routes/two-pager.mjs`、`public/js/views/two-pager.js`、`public/js/lib/fit-score.js`、`PATHS.twoPager`。全部 **16 个区域设置**新增 27 个 i18n 键。测试:`tests/two-pager-routes.test.mjs`、`tests/fit-score.test.mjs`。

## [1.88.0] — 2026-07-04

**Issue #29 收尾 —— 扫描 i18n 缺口 + API 卫生。**

- **本地化最后残留的硬编码扫描字符串**（路线图 v1.69.4）：来源汇总徽标（`N 个新增 / M 个匹配`）、`N 个新职位` 提示以及 `reloc` 徽章现在均通过 `t()` 流转 —— 全部 **16 个区域设置**新增 4 个键（`scan.pillNew`、`scan.pillMatching`、`scan.newOffers`、`scan.relocBadge`）。非英语用户不再在核心扫描流程中看到零散的英文。
- **禁用 `X-Powered-By` 响应头**（路线图 v1.69.5）：`createApp()` 中的 `app.disable('x-powered-by')` —— 服务器不再对外声明使用 Express。（该主线的其余部分此前已交付：`parentVersion` 去除其 release-please 注释、亮色模式主题切换、切换路由时关闭模态框，以及报告页“Score”（`rep.score`）的本地化。）

测试：`tests/scan-i18n-gaps.test.mjs` + `tests/security-headers.test.mjs` 中的 `X-Powered-By` 缺失断言。

## [1.87.0] — 2026-07-04

**4 个新增的免鉴权扫描来源（与父项目 career-ops v1.16.0 对齐）。** 扫描器注册表从 **41 → 45 个适配器**（40 EN + 5 RU）—— 全部为公开、免鉴权、主机锁定、`redirect:'error'`（SSRF 安全），且各自带一套 CI 隔离测试:

- **Get on Board**（`getonbrd`）—— 全站公开 JSON:API（LATAM/远程技术岗位），按来源选择，支持分页。`server/lib/sources/getonbrd.mjs`。
- **Amazon**（`amazon`）—— `amazon.jobs` 公开搜索 JSON，按主机检测或 `provider: amazon`，按偏移量分页。`server/lib/sources/amazon.mjs`。
- **Avature**（`avature`）—— 按租户的 `*.avature.net` ATS，解析 HTML，按主机检测或 `provider: avature`。`server/lib/sources/avature.mjs`。
- **SAP SuccessFactors**（`successfactors`）—— 按租户的 RMK 磁贴列表（`*.successfactors.eu/.com`、`jobs2web.com`），解析 HTML。`server/lib/sources/successfactors.mjs`。

每个来源都提供一个 `sources/<slug>.mjs`（自动发现的 `meta` → `#/scan` 下拉菜单）**以及** `ALL_ADAPTERS` 中的一个 `portals/adapters/<slug>.mjs`（双注册表规则）+ `tests/sources-<slug>.test.mjs`。`ALL_ADAPTERS` 计数以及排序 id 与 `/api/scan/sources` EN 集断言从 36→40；`GET /api/scan/sources` 现在列出 45 个。

## [1.86.0] — 2026-07-03

**按目标职位统计（`#/stats`）—— 针对你的目标职位的市场职位与薪资统计。** 新增的分析页面读取你的**个人资料中的目标职位**（`config/profile.yml` → 非硬编码）以及最近一次扫描的职位，然后按职位和国家显示：

- **各国职位数**与**各国薪资中位数（USD）** —— 在客户端从扫描器已经收集的稀疏数据聚合而成（`public/js/lib/role-stats.js`，复用 `window.Countries`）。任意币种的薪资通过一个明确标注为近似值的 FX 汇率表归一化为 USD，并附带样本量提示 —— 绝不捏造。
- **职位与国家筛选器**以及手写的内联 SVG 柱状图与趋势图（无新增依赖，CSP 安全 —— 仅使用 `addEventListener`）。
- **保存快照**（`POST /api/stats/snapshot`）将当前聚合结果持久化到 `data/role-stats.jsonl`；**趋势图**（`GET /api/stats/trend`）跟踪职位数随时间的变化 —— 即“动态”视图。诚实的混合方案：快照来自本地扫描数据，按需刷新。
- 已在全部 **16 个区域设置**中完整本地化（26 个新增 i18n 键）。

新增：`server/lib/routes/stats.mjs`（第 16 个路由模块）、`public/js/lib/role-stats.js`、`public/js/views/stats.js`、`PATHS.roleStats`；测试 `role-stats.test.mjs`（7）+ `stats-routes.test.mjs`（5）。

## [1.85.0] — 2026-07-03

**德语、意大利语和土耳其语区域设置（与上游 career-ops v1.16.0 区域设置对齐）。** 界面现在提供 **16 种语言** —— `de` 🇩🇪、`it` 🇮🇹 和 `tr` 🇹🇷 加入现有的 13 种。

- **完整界面翻译** —— 全部 730 个 i18n 键均在 `public/js/lib/locales/i18n-dict.{de,it,tr}.js` 中翻译；语言切换器列出 Deutsch / Italiano / Türkçe，浏览器语言自动检测可识别 `de`/`it`/`tr`（`public/js/lib/i18n.js`）。
- **应用内帮助指南** —— `docs/help/{de,it,tr}.md` 已翻译（完整的 19 个 H2 / 75 个 H3 结构），由 `GET /api/help/:lang` 提供。
- **文档** —— 新增 `README.{de,it,tr}.md` 和 `CHANGELOG.{de,it,tr}.md`；CHANGELOG 区域设置对齐校验现在覆盖 15 个非 EN 区域设置。
- **提示脚手架** —— `server/lib/prompts.mjs`（`LOCALE_NAMES` + `SCAFFOLD_STRINGS`）已针对三个新区域设置本地化，使 LLM 输出遵循界面语言。

所有对齐校验（`i18n-locale-files`、`i18n-coverage`、`check-changelog-parity`、`lang-switcher-rtl`）均扩展至 16 个区域设置集合。

## [1.84.0] — 2026-06-30

**重复投递冷却期 + pipeline.md 薪资信息（与上游 career-ops v1.15.0 对齐）。** 两项扫描器升级：

- **重复投递冷却期** (#1201)：EN 扫描现在会跳过你近期已投递公司的职位，使结果聚焦于**新**的招聘信息。可在 `config/profile.yml` 的 `re_apply_windows:` 下为每家公司配置时间窗口（`last_apply_date`、`same_role_days`、`applied_to: [roles]`、可选 `cross_role_bucket`）；公司匹配不区分标点符号 + 按词边界（`server/lib/cooldown.mjs`）。未配置键时关闭；扫描日志显示 `Cooldown skipped: N`。
- **pipeline.md 薪资信息** (#1017)：扫描到的职位现在将薪资作为可选的尾部列（`url | <salary>`）持久化到 `data/pipeline.md`。URL 仍是去重键（读取时 `| comp` 列会被剥离），单元格经过清洗（无行/列注入，公式前缀被中和），纯 URL 流水线保持向后兼容。

附带 `tests/cooldown.test.mjs` 及 pipeline 薪资测试。来源数量维持 41 个不变 —— 两项均为扫描逻辑升级，而非新增看板。

## [1.83.0] — 2026-06-30

**重复发布 / 幽灵职位检测器（与上游 career-ops v1.15.0 对齐）。** `#/scan` 新增 **🔁 重复发布 / 幽灵职位** 面板，标记在 90 天滚动窗口内以不同 URL 重复发布的公司+职位集群 —— 这是过时招聘流水线和幽灵职位的信号。基于模糊职位标题匹配器（`server/lib/role-matcher.mjs`）和针对 `data/scan-history.tsv` 的只读检测器（`server/lib/detect-reposts.mjs`），通过 `GET /api/scan/reposts` 暴露。此外：`/api/health` 的 `parentVersion` 现在只返回语义化版本号（去除了 release-please 的 `# x-release-please-version` 注释）。附带 `tests/detect-reposts.test.mjs`。来源数量维持 41 个不变 —— 重复发布检测是分析功能，而非新增看板。

## [1.82.0] — 2026-06-30

**NoDesk 扫描源（与上游 career-ops v1.15.0 对齐）。** NoDesk 全站远程职位 RSS 源现已成为一级扫描源 —— 添加 `provider: nodesk` 条目后即出现在 `#/scan` 的 **Source** 下拉中（共 **41 个适配器**：EN 36 + RU 5）。主机锁定为 `nodesk.co` 并使用 `redirect:'error'`（防 SSRF）；标题按 `Role at Company` 拆分（NoDesk 无位置标签，因此地点保持为空）；所有条目均为远程。附带 CI 隔离的 `tests/sources-nodesk.test.mjs` 测试套件；完整单元测试套件绿灯 1523。

## [1.81.0] — 2026-06-29

**与上游 career-ops 对齐 — 13 个新的求职板扫描来源。** 将 [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) `main` 的最新提供方批次移植到进程内扫描器。**全站公开 API**（由提供方选择）：**Arbeitnow**、**Himalayas**、**Jobicy**、**Landing.jobs**、**4 Day Week**、**The Muse**、**The Hub**、**Jobspresso**（RSS）以及 **Hacker News "Who is hiring?"**（Algolia 两步）。**波兰求职板**（按主机或 `provider:` 识别）：**JustJoin.it** 和 **NoFluffJobs**（POST 搜索）。**按租户的 ATS**（从 `careers_url` 自动识别）：**Pinpoint**（`<slug>.pinpointhq.com/postings.json`）和 **Rippling**（`ats.rippling.com/<slug>` → `api.rippling.com` 板）。所有来源均以 `redirect:'error'` 锁定主机（防 SSRF），并可在 `#/scan` 的 **Source** 下拉中选择 —— 注册表现在提供 **40 个扫描器适配器**（EN 35 + RU 5）。新增 13 套 CI 隔离的按来源测试套件；完整单元测试套件绿灯 1513。

## [1.80.0] — 2026-06-28

**五项扫描升级（源自 job-crawler 的思路，已重写实现）。** (1) **Teamtailor** 源——通过其公开 `/jobs.rss` 源抓取 `<slug>.teamtailor.com` 的按租户站点，从 `careers_url` 自动识别（主机锁定 + `redirect:'error'`）；注册表现有 **27 个适配器**。(2) **源隔离**——返回永久 404/410 的源会写入 `data/scan-quarantine.json` 并在后续扫描中跳过（自愈：14 天后重试）。(3) **每来源上限**——`#/scan` 上的可选字段，限制每个 board 的职位数（默认 ∞）。(4) **发布时间**——客户端的时效过滤（24 小时 / 7 天 / 30 天）。(5) **已保存搜索 + ★ 收藏**——为筛选集合命名并复用、给职位加星；保存在 `localStorage` 并带防御性校验（损坏缓存会干净重置）；结果缓存在每次扫描前重置并实时回填。

## [1.79.0] — 2026-06-28

**WeWorkRemotely 扫描源（与上游 career-ops v1.14.0 对齐）。** [We Work Remotely](https://weworkremotely.com) 全站远程职位 RSS 源现已成为一级扫描源——添加 `provider: weworkremotely` 条目后即出现在 `#/scan` 的 **Source** 下拉中（共 **26 个适配器**）。主机锁定为 weworkremotely.com 并使用 `redirect:'error'`（防 SSRF）；标题按 `Company: Role` 拆分。此外，`title_filter` 关键词现在会在长度检查**之前修剪**（parent #1261）。

## [1.78.2] — 2026-06-27

**i18n 与 UX 加固（v1.78.1 的后续修复）。** 品牌 Logo 的无障碍名称现已在全部 13 种语言本地化（`nav.logoHome`）。在已处于 `#/scan` 时按全局搜索 **Enter** 会强制重渲染，避免丢失预填关键词（同路由守卫）。`health.title` 现已翻译为波兰语（`Kondycja`）和丹麦语（`Systemtilstand`）——此前为英文。测试 1235 → 1238。

## [1.78.1] — 2026-06-27

**Scan 体验修复。** `#/scan` 结果表现在会在扫描期间实时自动刷新，并在结束后再刷新一次，无需手动重载。顶栏全局搜索显示 **Enter** 提示；对于非 URL 查询，会跳转到 `#/scan` 并预填搜索框（此前为 `#/tracker`）。Logo 现在链接到仪表盘（首页）。

## [1.78.0] — 2026-06-27

**Scan 页面新增地理筛选 —— 按国家筛选职位（带国旗）。** `#/scan` 中新的 **国家** 下拉框列出在结果中识别到的每个国家（国旗表情 + 数量），可仅保留与特定国家相关的职位 —— 与 Remote/Hybrid/Onsite 工作方式筛选并用，既能找绑定国家的工作，也能找远程。由新的 `countries.js` 助手支持，将职位的自由文本地点（国家名、别名及约 100 个主要城市）映射到 ISO 国家 + 国旗；识别保守，绝不臆测。

## [1.77.0] — 2026-06-27

**新增丹麦语（Dansk）作为第 13 种界面语言。** 完整翻译 UI、应用内帮助指南（19 H2 / 75 H3）、README 和 CHANGELOG。丹麦语加入带国旗的语言选择器；i18n 机制（汇编器、审计、对等校验、快照）现已覆盖 13 个语言环境。

## [1.76.0] — 2026-06-26

**与上游 career-ops v1.13.0 对齐 —— 新增 6 个职位源、加固扫描器、结果表取消上限。**

### 新增
- **6 个按租户的 ATS 源** —— BambooHR、Breezy HR、Comeet、Personio、Recruitee、SolidJobs。从 `careers_url` 主机自动识别（Comeet 需完整 `api:`）；每个主机用锚定正则 + `redirect:'error'` 锁定（防 SSRF）。可在 `#/scan` 的 **Source** 下拉中选择 —— 注册表现有 **25 个适配器**（EN 20 + RU 5）。为 Personio 的 XML 源新增 `fetchText` 辅助函数。
- **`trust_filter`** —— 可选的信任评分（0–100，级别 high/medium/low，标记），仅标注。低于 `high` 的行在 `#/scan` 显示语言中立的 ⚠ 徽章；绝不丢弃职位。
- **Arbeitsagentur `remoteMatch` + `remoteMaxPages`** —— 由配置驱动的远程识别：`title`、`filter`（服务端 `homeoffice=nv_true` + 分页）或 `off`。

### 变更
- **扫描结果不再设上限。** 移除显示上限 `MAX_STORED_RESULTS`（2000）—— 存储所有匹配项，`#/scan` 表格分页显示（200/页）。
- **标题过滤更稳健** —— 短缩写（COO、SDR…）按词边界匹配；格式错误的 `title_filter` 不再导致扫描崩溃。ATS 与区域扫描器均适用。

### 测试
- +32 用例（1190 → **1222**）：`sources-ats-providers`、`title-filter`、`arbeitsagentur-remote`、`trust-validator`，以及重写的 `scan-result-cap`「无上限」守卫。

## [1.75.2] — 2026-06-19

**docs：在全部 12 个语言环境中为 v1.75.0 的扫描器聚合器提供完整的文档对等。** 无代码改动 — 将面向用户的文档与 v1.75.0 中落地的七个来源对齐:

- **帮助指南（12 个语言环境）。** §5 新增一个 `content_filter` 块（按描述/摘要关键词门控,是 `location_filter` 的同类项）以及一条关于聚合器的说明;§7 在一键扫描的遍历和完整的 **Source** 下拉枚举中列出这七个新来源;§17 的适配器计数从过时的 "11 adapters" 更正为 "19 adapters — 14 English + 5 Russian"。没有新增 `##`/`###` 标题,因此受门控的 19 H2 / 75 H3 结构保持不变。
- **README（9 个完整语言环境）。** 在扫描来源下新增 "Aggregator boards (v1.75.0)" 条目,并将发布徽章提升至 v1.75.2。（精简版的 pl/uk/ar README 没有按来源的列表,该处刻意不作改动。）
- **参考文档。** `docs/portals-examples.md` 新增一个可复制粘贴的 "Aggregator boards" 章节,为这七个来源提供准确的 `provider:` / `<provider>:` 配置块;`docs/PROJECT.md` 更新为 **19 adapters**;`docs/sdd/CONVENTIONS.md` 记录了两个注册表的区分（用于下拉的 `sources/registry.mjs` 对用于抓取的 `portals/registry.mjs`）、以 `opts.company` 形式传递的基于 `provider:` 的聚合器选择、扫描写入清洗器（`scan-sanitize.mjs`）以及 v1.75.1 的测试数量（1190）。
- **QA。** 新增 `qa/QA-REGRESSION-PROMPT-v1.75.2-FULL.md` — 全表面发布闸驱动器,已为 v1.75.x 扫描聚合器周期翻新。

---



## [1.75.1] — 2026-06-19

**fix(scan): 对 v1.75.0 配置驱动来源的健壮性打磨。** 来自发布后复盘的三处小型加固修复(正常扫描下行为不变):

- **支持中止的分页延迟。** Glints(300 ms)与 Jobstreet/SEEK(200 ms)的翻页礼貌等待现在会在扫描的 `AbortSignal` 触发时立即结束,这通过 `server/lib/http-json.mjs` 中新增的 `delay(ms, signal)` 辅助函数实现,因此已断开的客户端无法让一个正在分页的扫描多占用一段等待时间。
- **描述性的非 JSON 错误。** `fetchJson` 现在会将非 JSON 的 `2xx` 响应体(例如以状态码 200 返回的 HTML 维护页)包装为 `non-JSON 2xx response from <url>`,而不是暴露一个裸的 `SyntaxError`,因此扫描器按来源记录的错误日志会指明行为异常的端点。
- **更强的扫描写入归一化。** `normalizeScanScalar` 现在除了 `\r \n \t` 之外,还会折叠垂直制表符、换页符以及 Unicode 行/段分隔符(`\v \f U+2028 U+2029`)——这是一个严格的超集,因此任何电子表格或查看器可能识别的记录/行分隔符都不会残留进 `scan-history.tsv`。

---


## [1.75.0] — 2026-06-19

**feat(scan)：移植父级 career-ops v1.12.0 — 七个新的招聘来源、内容过滤以及安全/质量修复。** web-ui 运行自己的进程内扫描器（不会向父级的 `scan.mjs` 进行 shell out），因此父级 v1.12.0 的提供方与扫描改动不会自动流入 — 本次发布将其中适用的部分按 web-ui 的适配器契约重新实现。

- **七个新的扫描器来源。** 三个覆盖整个招聘板的远程聚合器 — **RemoteOK**、**Remotive**、**Working Nomads** — 接入自动发现的 `server/lib/sources/*.mjs` 模式（用 `provider: remoteok` / `remotive` / `workingnomads` 选择）。四个由配置驱动的区域聚合器 — **IBM** careers、**Arbeitsagentur**（德国联邦劳动局）、**Glints**（东南亚）、**Jobstreet / SEEK** — 读取按条目的 `<provider>:` 配置块；en-scanner 现在会将解析后的公司条目一路传递到每个 fetcher，以便它们能够读取。这七个来源都会自动出现在 `#/scan` 的来源下拉菜单中。
- **`content_filter`（父级 #974）。** 可选的 `portals.yml` 块（`positive` / `negative` 关键词列表），根据职位的描述/摘要文本对其进行门控 — 沿用 `location_filter` 的语义；没有描述的职位始终通过。已接入 EN 与 RU 两个扫描器。
- **扫描写入加固（父级 #1098）。** 外部信息流元数据现在会在落入 `data/scan-history.tsv` 和 `data/pipeline.md` 之前进行清洗：控制字符被折叠（公司名/职位标题中的换行不再能注入一行 TSV），开头的 `= + - @` 被中和以防电子表格公式注入。
- **Ashby `secondaryLocations`（父级 #1073）。** Ashby 来源现在会将每个次要位置的地区标签连同邮政 `addressLocality` / `addressCountry` 折叠进位置字符串（去重），因此主标签显示为例如 "Canada" 的可在欧盟工作的职位会被 `location_filter` 浮现出来。
- **评估报告形状校验（父级 #819）。** `/api/evaluate` 的进程内提供方（Anthropic / OpenAI / Qwen / OpenRouter / GitHub Models）现在会将格式错误的 A–G / `SCORE_SUMMARY` 报告标记为非致命的 `warnings` 数组；Gemini 评估路径已从父级的 `gemini-eval.mjs` 继承该防护。
- **docs：** 在全部 12 个 README 的受支持助手列表中加入 Antigravity CLI（映射到 Gemini 提供方）。

从父级 `git pull` 免费继承（web-ui 会向这些 shell out）：日语 CJK PDF 字体回退（#1053）、ATS 安全的 PDF 字体（#1074）、LaTeX CJK 防护（#1054）、tracker/merge/followup/dashboard 修复，以及 `modes/zh` 中文模式（web-ui 会动态列出模式）。

---


## [1.74.3] — 2026-06-18

**docs(parent-source): 将父 `career-ops` 仓库指向 [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) 分叉。** web-ui 现在在所有作为实际来源的位置都将维护者的分叉作为父项目引用:`bin/setup.sh` 安装脚本的 `CAREER_OPS_REPO` 克隆默认值、12 个 README 中的每个 `git clone` /“构建于其上”/ 入门链接,以及代理文档(`CLAUDE.md`、`AGENTS.md`、`GEMINI.md`、`.github/copilot-instructions.md`、`docs/`)。对作者 santifer 的署名(以及非官方 UI 免责声明)保持不变 —— 仅移动了来源/克隆 URL。`tests/sh-files.test.mjs` 现在断言安装脚本克隆的是分叉。

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
