# 帮助 — career-ops-ui

从启动应用到拿到面试机会,本指南完整覆盖每一个页面。每个 `##` 标题对
应侧边栏条目或工作流的一个阶段。首次运行请自上而下通读;之后通过帮
助侧边栏的目录跳转到具体小节。

> **适用对象:** 任何刚把这套 UI 放进 `career-ops` checkout 目录、运
> 行了 `bash bin/start.sh` 的人。不假设你已了解 career-ops。

### 关于 career-ops

[career-ops](https://career-ops.org) 是一个开源求职系统,以 slash 命
令的形式在任意 AI 编码 CLI(Claude Code、Gemini CLI、Codex、Qwen Code、OpenCode、GitHub Copilot CLI — 其他 Claude 兼容 CLI 也通过相同的斜杠命令接口运行)中运行。它与具体模型无关。系统按六维 0.0–5.0 评
分体系将每个职位与你的 CV 匹配,生成定制化的 PDF 简历,并在本地机器
上追踪每一次申请记录。

**权威参考文档(首次安装请按顺序阅读):**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — 系统总览、核心原则、概念清单。
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — 发现职位空缺;填充 Pipeline。
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — 完整的申请提交流程,含 Playwright 表单读取。
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — 通过 `batch-runner.sh` 一次性评分 10 个以上 JD。
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — 安装 Chromium 并注册用于 PDF 与表单填写的 MCP。

**核心原则**(摘自
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

- **认真的开源** — MIT 协议,无付费层级,无候补名单,无遥测,无账
  号体系。系统不依赖任何付费层级、账号或遥测运行。代码贡献需经社区
  审查后才能发布。
- **数据主权** — `cv.md`、`config/profile.yml`、`data/`、`reports/`、
  `interview-prep/` 这些文件绝不会离开你的笔记本电脑,除非你显式地
  推送它们。你在本地机器上运行整个系统,保留对数据的完全主权。
- **AI 无关架构** — career-ops **不**捆绑任何模型。它是嵌在已有 AI
  编码 CLI 中的一组命令。在 Anthropic ↔ Gemini ↔ OpenAI 之间切换提
  供商,你的评估历史依然保持一致。
- **由人控制的提交** — career-ops 起草答案、打开表单,但 **由你点
  击 Submit 按钮**。系统绝不会自动申请。系统负责提供结构与评估,人
  类保留最终提交权。
- **结构化求职** — 为多次投递的主动、有意识的求职而设计;不是一次
  性投递工具,也不是推荐引擎。安装大约耗时 15 分钟,假设你熟悉终端
  操作。

**career-ops 不是什么**(明确的非目标):

- 不是自动投递器。它不会替你提交表单。
- 不是简历重写器。它针对每个 JD 做微调,但不会捏造经历。
- 不是 LinkedIn 优化器。你的个人主页归你自己管理。
- 不是一个躲在 SaaS UI 后面的电子表格替代品。所有数据都是文件系统
  上的纯 markdown。

**关键概念**(完整清单 — career-ops 涉及的所有产物):

| 概念 | 含义 |
|---|---|
| **Mode** | `modes/<slug>.md` 下的提示模板。内置: `oferta`、`deep`、`apply`、`pipeline`、`batch`、`contacto`、`followup`、`interview-prep`、`patterns`、`project`、`training`、`ofertas`、`auto-pipeline`、`pdf`、`latex`、`scan`、`tracker`。 |
| **Archetype** | `config/profile.yml` 中的目标角色画像。评分体系按当前 archetype 加权技能匹配 — **最重要的单一字段**。 |
| **Pipeline** | `data/pipeline.md` — 等待评估的 JD URL 收件箱。 |
| **Tracker** | `data/applications.md` — 历史 GFM 表格,记录每次评估与申请状态。 |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — 每个 JD 的完整 A–F 评估,头部含 score 与合法性。 |
| **Scan history** | `data/scan-history.tsv` — 仅追加日志,跨扫描去重。 |
| **Proof points** | 从 `cv.md` 提取的 STAR+R 证据块,在评估、apply 答题、面试准备之间复用。 |
| **JD store** | `jds/jd-<date>-<ts>.txt` — 评估期间保存的原始职位描述,用于审计跟踪。 |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — 深度调研简报与轮次单页。 |
| **Batch additions** | `batch/tracker-additions/*.tsv` — `batch-runner.sh` 排队等待并入 tracker 的行。 |

### career-ops 与 career-ops-ui(本应用)的关系

| | career-ops(CLI) | career-ops-ui(本应用) |
|---|---|---|
| 运行位置 | Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI 内部 | 浏览器中的 `http://127.0.0.1:4317` |
| 界面形式 | `/career-ops <mode>` slash 命令 | 侧边栏,每个工作流对应一页 |
| 表单填写 | 支持,通过 Playwright MCP | 不支持 — 生成清单,你在 CLI 中完成填写 |
| PDF | `generate-pdf.mjs` | `📄 Generate PDF` 按钮位于 `#/cv`、`#/reports/:slug`、`#/evaluate`、`#/deep`、`#/interview-prep` |
| 数据文件 | 与 career-ops-ui 共享 | 与 career-ops 共享 |

career-ops-ui 是 **纯增量** 项目。`career-ops/` 内部的任何文件都不会
被修改。两套界面共享同一份 `cv.md`、`config/profile.yml`、
`portals.yml`、`data/`、`reports/`、`interview-prep/`、`modes/`。

### 按 score 划分的行动阈值

一旦某个 JD 有了评估,score 决定下一步动作(摘自
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
的权威表):

| Score | 下一步 |
|---|---|
| **≥ 4.5** | 运行 `/career-ops apply` — 高匹配,立即推进。 |
| **4.0 – 4.4** | 申请,或先用 `/career-ops contacto` 做温和推荐接触。 |
| **3.5 – 3.9** | 运行 `/career-ops deep` — 先调研公司/角色再决定。 |
| **< 3.5** | 除非有具体的个人理由,否则跳过。 |

career-ops-ui 的 `#/dashboard` 与 `#/tracker` 会高亮每一条 ≥ 4.0 的
记录,无需重新运行任何命令即可挑选行动对象。

### 外部文档

底层 career-ops 引擎(扫描、评估体系、批量处理、申请流程、Playwright
配置)的完整参考位于
[career-ops.org/docs](https://career-ops.org/docs):

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. 快速上手 — 从「创建 CV」到「投递并联系」的完整步骤

这是按钮级的权威操作手册。首次使用请按顺序执行。每一步都明确指出
路由名、按钮名以及成功时你将看到什么。2–16 节会深入展开各阶段细节。

> **一条命令完成启动与初始化。** 在终端中,你无需打开界面即可
> 完成整个引导流程:
>
> ```bash
> career-ops-ui setup      # 安装依赖 → doctor → 启动服务器
> career-ops-ui init       # 选择 LLM 提供方 + 粘贴其密钥(不回显)
> career-ops-ui doctor     # 随时重新校验(退出码 0 ⇔ 所有必需项均为绿色)
> career-ops-ui run        # 仅在 http://127.0.0.1:4317 启动服务器
> career-ops-ui open       # 打开并将浏览器中的仪表盘标签页置于最前
> ```
>
> `setup`/`run` 之后,浏览器标签页会自动打开**并被带到最
> 前面**(v1.43.0);`career-ops-ui open` 可按需执行相同操作,
> 因此你再也不必去翻找仪表盘标签页。`NO_OPEN=1` 可在
> headless/CI 启动时禁用自动打开。
>
> `setup` 会自行执行整条链路。`init` 通过 `#/config` API 密钥
> 选项卡所用的同一条已验证路径,将密钥写入父级
> `career-ops/.env`,并设置 `LLM_PROVIDER`
> (`auto` | `claude` | `gemini`),实时的 evaluate / deep / mode /
> 自动流水线路由都会遵循它。CI 形式:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`。
> 更喜欢用界面?继续下面的步骤即可。

### A. 一次性安装(只需做一次,约 5 分钟)

**career-ops-ui 必须位于 `career-ops/web-ui/`**（嵌套在父项目 career-ops 中）。它通过 `../` 读取父目录中的 `cv.md`、`config/` 和 `data/`，无法单独运行。如果 `git pull` 后找不到 `career-ops-ui init`，请执行 `cd career-ops/web-ui && npm install && npx career-ops-ui init`。

**第 1 步 — 在 `http://127.0.0.1:4317` 打开应用。** 如果尚未启动,
在仓库根目录的终端执行 `bash bin/start.sh`。Dashboard
(`#/dashboard`)会加载出来。

**第 2 步 — 在左侧边栏点击 `❤ Health`。** 所有必需检查项必须为绿色:

- `cv.md`、`config/profile.yml`、`portals.yml` 存在
- 已设置 API key(至少有一个 `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`)
- Playwright 已安装(仅在你使用 Generate PDF 时必需)

如有红色项,页面会精确指出需要修复的文件或环境变量。在 Health 全绿
之前不要继续后续步骤。

**第 3 步 — 在侧边栏点击 `⚒ App settings`。** 进入
**API keys & runtime** 选项卡。
- 粘贴 `ANTHROPIC_API_KEY`(首选 — 长文本评分质量更高)
  和/或 `GEMINI_API_KEY`。从
  <https://console.anthropic.com/settings/keys> 或
  <https://aistudio.google.com/apikey> 获取 key。
- 点击 **💾 Save**。然后点击 **▶ Test Anthropic**(或 Gemini)— 一次
  小往返调用确认 key 配置正确。

**第 4 步 — 切换到同一页的 `Profile` 选项卡。** 这是
`config/profile.yml` 的直接 YAML 编辑器。至少修改以下字段:
- `candidate.full_name` — 把任何占位符("Jane Smith")替换为你的真
  实姓名
- `candidate.email`、`linkedin`、`github` — 用于求职信
- `target.roles` — 你打算申请的职位头衔
- `target.comp_total_min_usd` — 最低总薪;低于此值的 offer 会在每份
  评估的 D 节被标红
- `target.archetypes` — 你接受的职业模式(影响最大的单一字段)

点击 **💾 Save**。服务器验证 YAML 并写入权威头部
`# Career-Ops Profile Configuration`。

### B. CV(只需做一次,约 10 分钟)

**第 5 步 — 在侧边栏点击 `✎ CV`。** 两栏布局:左侧编辑器,右侧实时
预览。

**第 6 步 — 选择一条路径填充编辑器:**
- **上传已有简历** — 点击 **📁 Upload CV**,选择任一格式:
  `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`。服务器
  会通过 pandoc 或 pdftotext 转换为 markdown,净化 XSS 内容,并将结
  果放入编辑器。**请检查转换结果** — 尤其是 PDF,可能丢失版面信息。
- **直接粘贴 markdown** — 文本框就是 markdown 编辑器;右侧面板呈现
  的是 LLM(以及未来的招聘者)看到的内容。
- **行文建议:** 一个 bullet = 一项可量化的成绩。控制在 1500 字以
  内。章节顺序: Summary、Experience、Projects、Education、Skills。

**第 7 步 — 点击 `💾 Save`(CV 页右上角)。** 服务器执行净化(剥离
`<script>` / `javascript:` / 内联事件处理器)后写入 `cv.md`。Toast
提示: *"Saved"*。

**第 8 步(可选)— 点击 `📄 Generate PDF`。** 在父项目运行
`generate-pdf.mjs`(需要 Playwright),完成后 **新 PDF 会自动下载**
到浏览器。页面底部列表会保留所有历史生成文件。

### C. 发现职位空缺(每次扫描约 2 分钟)

**第 9 步 — 在侧边栏点击 `🌐 Scan`。** 确认 `portals.yml` 列出了你
关心的招聘版面(详见本帮助第 5 节)。按下 **🌐 Scan now** 按钮。实
时 SSE 日志会流式输出,扫描器会遍历 Greenhouse / Ashby / Lever /
Workable / SmartRecruiters / Workday(英文版面)以及启用情况下的
hh.ru / Habr Career / Trudvsem / GetMatch / GeekJob(俄罗斯版面)。

**第 10 步 — 扫描完成后查看结果。** 点击公司标签可过滤;点击 ↗
图标在新标签页打开公司招聘主页。所有通过标题过滤器的空缺都会进入
Pipeline 队列。

### D. 给 offer 打分(每个 JD 约 30 秒)

**第 11 步 — 在侧边栏点击 `Pipeline`。** 你会看到扫描器排队的所有
URL。点击任一条目可在右侧预览 JD。

**第 12 步 — 点击任一 JD 旁的 `▶ Evaluate`。** 跳转到 `#/evaluate`。
如果配置了 API key,会实时运行;否则会得到可粘贴到自己 LLM 中的手工
提示。实时模式针对你的 CV 在 A–G 各节(Role / Company / Compensation
/ Risk / Stretch / Cultural fit / Verdict)产出 **0–5 分**。保存路径
为 `reports/<date>-<slug>.md`。

**第 13 步 — 在侧边栏点击 `Reports`** 查阅最新评估。任何低于
`comp_total_min_usd` 的项会在 D 节标红。任何 `Verdict: pursue` 的项
就是你的入围短名单。

### E. 决策并对入围公司做深度调研(约 3 分钟)

**第 14 步 — 选择一个值得追的职位,点击侧边栏 `Deep research`。**
输入公司名和角色。模型会产出包含 7 节的公司简报(使命、近期新闻、
技术栈、招聘信号、薪酬基准、风险、建议切入角度)。保存路径为
`interview-prep/<company>-<role>.md`。

### F. 投递申请(每份申请约 5 分钟)

**第 15 步 — 在侧边栏点击 `Apply checklist`。** 粘贴职位 URL + JD。
助手会生成逐步提交清单:
- 定制的求职信草稿(使用你的 `cv.md` + `profile.yml`)
- 需要从 JD 镜像的具体关键词
- 需附上的文件(CV PDF — 见第 8 步)
- 投递地点(公司权威招聘 URL,而非聚合站的重定向)
- 提醒: **绝不自动提交** — 最终审查与提交始终是手工操作。

**第 16 步 — 在新标签页打开招聘页面。** 把 Apply 清单当作待办列表。
通过公司的真实表单提交。附上你在第 8 步生成的 PDF。

**第 17 步 — 联系真实的人类。** 打开 **Outreach** 模式
(侧边栏的 `#/contacto`)。模型基于第 14 步的公司简报起草一条简短的
LinkedIn / 邮件消息。把开场白个性化(嵌入一条来自深度调研的具体细节)。
发送出去。

### G. 跟踪与跟进(持续进行)

**第 18 步 — 在侧边栏点击 `Tracker`** 为这次申请添加一行: 公司、
角色、score、状态 `Applied`、报告链接、深度调研简报链接。日期自动
填充。

**第 19 步 — 一周后:打开 `Follow-up` 模式**(`#/followup`)。它会起
草一封礼貌的跟进邮件,引用原申请。发送后,把 tracker 状态更新为
`Followed up`。

**第 20 步 — 收到面试邀请后,运行 `Interview prep` 模式**
(`#/interview-prep`)。会为具体公司 + 轮次(系统设计 / 行为面 / 编
码面)生成针对性准备材料。自动从深度调研简报中拉取信息。

**第 21 步 — 拿到 offer 后:把 Tracker 状态更新为 `Offer`**,并回看
评估报告的薪酬章节 — 你的最低接受数字就在那里。

### TL;DR — 侧边栏顺序即工作流顺序

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

就是这样。21 步,按钮接按钮,从零到 offer。

### 一键 Auto-pipeline(`#/auto`)—— 21 步捷径

只想快速给某个职位打分?跳过手动流程。**侧栏 → ✨ Auto-pipeline**(或 Dashboard 的 ✨ 按钮):粘贴 URL,按 **Enter** 或 **▶ 运行完整流水线** —— 服务端一趟可观察地跑完整条链:

1. **校验 URL** —— SSRF 安全检查(`isValidJobUrl`)。
2. **抓取 JD** —— `safeGet`(DNS 固定)下载 + 清洗。
3. **对照 CV 评估** —— Anthropic → Gemini → 无 key 则手动 prompt。
4. **保存报告** —— 写入 `reports/<slug>.md`(分数 + 可信度)。
5. **加入跟踪器** —— 向 `data/applications.md` 追加一行。

反馈是纵向 **stepper**(有序列表,活动步骤带 `aria-current`,屏幕阅读器实时区域)。完成后卡片深链到报告(**查看报告 · N/5**)与 **跟踪器**。失败步骤标红,按钮重新启用,无需刷新即可重试。**无 API key?** 手动模式:3–5 步折叠,给出可复制 prompt。可链接:`#/auto?url=<enc>&go=1` 自动开始。
> **CLI(v1.38.0)。** 一条命令完成整链:`career-ops-ui setup`。动词:`career-ops-ui doctor`(env/密钥/工具检查 —— 与 Health 同引擎;必需项失败 exit 1)、`career-ops-ui run`、`career-ops-ui init`(供应商+密钥向导,v1.39.0)。


---

## 2. 应用设置与 API 密钥(`#/config`)

> **v1.55 → v1.56 新功能。** 未设置 LLM 密钥时,每屏的红色横幅说明 ⚡ 实时运行处于手动提示模式并链接至此;设置密钥后变为显示活动提供方的低调徽标。每个 ⚡ 实时运行按钮(`#/auto`、`#/evaluate`、`#/deep`、模式)前显示诚实的预计费用(如“预计费用:OpenAI gpt-5-codex · ~$0.04/eval”,手动模式则无 API 费用)。`#/scan` 将次要筛选收入**高级筛选**折叠区;`#/tracker` 新增可点击漏斗芯片 + 可选服务端分页;`#/pipeline` 超过 1000 行时虚拟化。

两个选项卡:

1. **API keys & runtime** — 在浏览器中编辑父项目的 `.env` 文件(career-ops
   Node 脚本启动时读取的同一文件)。该选项卡还提供按供应方的模型
   选择器 —— 在 `ANTHROPIC_MODEL`、`GEMINI_MODEL` 旁新增
   `OPENAI_MODEL`(OpenAI/Codex)。
2. **Profile** — `config/profile.yml` 的直接 YAML 编辑器。保存时会
   写入权威头部 `# Career-Ops Profile Configuration`。

两个选项卡的任意保存都会立即生效 — 无需重启服务器。

**设置你的 LLM 供应方(分步)。** web UI 的 ⚡ 实时评估以*无头*方式运行,使用一个 API 密钥。它通过 "OR" 工作 —— 设置其中**任意一个**即可正常工作;设置多个时,`auto` 按此顺序优先:Anthropic → Gemini → OpenAI → Qwen。(career-ops 本身是 CLI 无关的 —— 你也可以在 Claude Code、Codex、Gemini、OpenCode、Qwen、Copilot 或 Kimi 内运行它;那与此无头密钥无关。)

1. 打开 `#/config` → **API keys & runtime** 选项卡。
2. 在 **`LLM_PROVIDER`** 中选择你的供应方:`auto`(使用已设置的密钥),或用 `claude` / `gemini` / `openai` / `qwen` 强制指定一个。
3. 填写你所选供应方的密钥 + 模型:
   - **Anthropic** —— 设置 `ANTHROPIC_API_KEY`(console.anthropic.com),可选 `ANTHROPIC_MODEL`(默认 `claude-sonnet-4-6`)。
   - **Gemini** —— 设置 `GEMINI_API_KEY`(aistudio.google.com/apikey),可选 `GEMINI_MODEL`(默认 `gemini-2.0-flash`)。
   - **OpenAI** —— 设置 `OPENAI_API_KEY`(platform.openai.com),可选 `OPENAI_MODEL`(默认 `gpt-5-codex`)。
   - **Qwen** —— 设置 `QWEN_API_KEY`(阿里云百炼 / DashScope,dashscope.console.aliyun.com),可选 `QWEN_MODEL`(默认 `qwen-max`)。中国大陆端点请在 raw `.env` 中设置 `QWEN_BASE_URL`。
4. 点击 **Save**。密钥写入父项目的 `.env`;更改立即生效 —— 无需重启服务器。
5. 在 `#/evaluate` 上验证:粘贴一个职位 URL/描述并按 **⚡ Run live**。结果头部会显示运行了哪个供应方(`anthropic` / `gemini` / `openai` / `qwen`)。任何地方都未设置密钥 → 则得到复制粘贴的手动 prompt。

密钥在保存后被掩码且从不记录。模型 id 字段(`*_MODEL`)不是机密。

### Profile 选项卡

> **v1.32.0 —— 逐字段表单。** Profile 选项卡不再是原始 YAML 文本框,而是带 **候选人 / 叙述 / 薪酬** 可折叠分区的表单。保存时仅发送建模的 14 个标量路径;服务端**合并**进 `config/profile.yml`,因此 `archetypes`、`proof_points` 与自定义键**原样保留**。权衡:逐字段保存会重新序列化 YAML 并**丢失 `#` 注释** —— 如需保留或编辑嵌套数组,请用选项卡底部的 **Advanced: edit raw YAML** 折叠区。
> **v1.35.0 —— 数组编辑器。** 为 **Target roles**、**Superpowers**(字符串列表)、**Archetypes**(name/level/fit)、**Proof points**(name/url/hero-metric)新增增删行编辑器。同样的 merge-not-replace 保证;清空列表会干净地移除该键。
> **v1.54.3 —— Modes 选项卡结构化表单。** `modes/_profile.md` 不再是按区块的原始 markdown 编辑器,而是从已文档化的 schema 派生的字段表单。列表型区块 —— **Target Roles / Adaptive Framing / Comp Targets** —— 渲染为可重复的逐行输入(增删行);散文区块 —— **Exit Narrative / Location Policy** —— 渲染为带标签的 textarea;任何未知或非列表区块回退为带标签的逐字 textarea。保存**仍按区块合并** —— 前言、未改动区块与自定义区块按字节保留。*Advanced: raw markdown* 折叠区保留,用于整文件编辑:增删区块或编辑前言。
> **提供方(v1.39.0)。** API-keys 选项卡新增 `LLM_PROVIDER` 选择(`auto`=Anthropic→Gemini · `claude` · `gemini`)与 `OPENAI_API_KEY` 字段(Codex/OpenCode CLI 端)。`career-ops-ui init` 为交互向导。
>
> **提供方(v1.57.0）。** 无头实时评估现覆盖 **Anthropic → Gemini → OpenAI → Qwen → OpenRouter**（`auto` 顺序；`LLM_PROVIDER` 固定其一）。**OpenRouter** —— 一个 `OPENROUTER_API_KEY` 即接入 300+ 模型；`OPENROUTER_MODEL` 下拉从 OpenRouter 实时目录加载（服务端代理，离线时精选回退）。另修复：带换行/空格粘贴的 key 在校验前被修剪，`/#/config` 不再对任何提供方显示「validation failed」。





- 文本框原样显示当前的 `config/profile.yml`。
- 编辑后点击 **💾 Save**。服务器验证 YAML(必须是 mapping,必须包含
  `candidate`)并写入文件。
- 若缺失,会自动添加 `# Career-Ops Profile Configuration` 头部。
- `#/profile` 上的只读摘要是其可视化对照视图。

### 识别的键

| Key | 用途 | 获取地址 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 启用实时 Anthropic SDK 调用。在 Anthropic + Gemini 同时配置时优先 — 对 JD 评分与深度调研的长文本结构化输出更好。 | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | 覆盖默认的 `claude-sonnet-4-6`。复杂推理可尝试 `claude-opus-4-7`,廉价高速可用 `claude-haiku-4-5-20251001`。 | — |
| `GEMINI_API_KEY` | 没有 Anthropic key 时的后备。`oferta` 模式由 `gemini-eval.mjs` 调用。免费层适合小批量。 | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | 覆盖默认 Gemini 模型。 | — |
| `(server uses default UA)` | 在俄罗斯境外扫描 `hh.ru` 时必需(默认 UA 会返回 403)。在 <https://dev.hh.ru/admin> 注册一个应用并使用其 UA 字符串。 | dev.hh.ru |
| `PORT` | Express 绑定端口。默认 4317。 | — |
| `HOST` | 绑定地址。默认 `127.0.0.1`。设为 `0.0.0.0` 会把 UI 暴露到局域网 — **目前没有鉴权门**,参见 Production-readiness 文档。 | — |

### 行为

- **读取**(`GET /api/config`)返回所有识别到的键。秘密 key
  (`ANTHROPIC_API_KEY`、`GEMINI_API_KEY`)会被 **掩码** — 你只会看
  到 `sk-ant•••••••a1b2`,绝不会暴露完整值。
- **保存**(`POST /api/config`)逐项验证,写入 `<parent>/.env`,并
  立即应用到运行中的进程。无需重启。
- **空值即删除该键**。在你想不再使用某个配置时很有用。

### 烟雾测试按钮

保存后点击 **▶ Test Anthropic** 或 **▶ Test Gemini** — 两者都会触发
一个极小的提示(输出 ≤256 tokens),花费几乎为零,但能确认 key 是否
连通。成功时返回约 200 字符的样本。

---

## 3. 个人资料(`#/profile` — 也可以通过 `#/settings` 访问)

`config/profile.yml` 的只读摘要卡片视图。**要编辑** 请前往
**App settings → Profile 选项卡**(`#/config` → Profile)。保存写入
的是同一文件;本页在刷新时会重新解析。

最重要的字段:

- `candidate.full_name` — 每个提示都会用到。**在正式扫描前必须替换
  模板中的 `Jane Smith`**,否则生成的求职信会以占位符姓名发送出去。
- `candidate.email`、`linkedin`、`github` — 求职信生成与 apply 清单
  中会引用。
- `target.roles` — 接受的职位头衔。扫描器的正向过滤器会隐式使用
  (通过 `portals.yml::title_filter`)。
- `target.comp_total_min_usd` — 最低总薪。每份评估的 D 节会把低于此
  值的 offer 标出。
- `target.archetypes` — *最重要字段*。这些是你接受的职业模式(例如
  `Tech-Lead-Backend`、`Founding-Engineer`、`Data-Platform`)。每个
  JD 都会针对它们做匹配,最佳 archetype 会进入报告头部。

Health 页面会暴露一项 **Profile customized** 检查,只要
`full_name` 还是已知占位名,这一项就不通过。

---

## 4. 简历(`#/cv`)

每次评估、深度调研与求职信的唯一真相来源。文件位于父项目根目录的
`cv.md`。

### 编辑方式

- **直接粘贴** — 左侧文本框就是 markdown 编辑器。右侧面板镜像 LLM
  (以及你未来的招聘者)看到的内容。
- **📁 Upload CV** — 选择任一以下格式的本地文件,服务器会为你转换
  成 markdown:
  - **文本格式** — `.md`、`.markdown`、`.txt`、`.html`、`.htm` 直
    通(HTML 经 pandoc → GFM markdown)。
  - **Office 格式** — `.docx`、`.doc`、`.odt`、`.rtf` 经 **pandoc**
    转换(macOS 用 `brew install pandoc`,Linux 用
    `apt install pandoc`)。
  - **PDF** — `.pdf` 经 Poppler 的 **pdftotext** 提取
    (`brew install poppler` / `apt install poppler-utils`)。
  - 转换后的 markdown 落入编辑器;点击 **💾 Save** 持久化。结果会被
    净化(与粘贴同样的 XSS 剥离)。
  - 硬上限: 每次上传 **10 MB**。更大的文件返回 413。
- **从 LinkedIn 导入** — 最简路径: 在父项目打开 Claude Code,运行
  `/career-ops`,粘贴你的 LinkedIn URL,并要求
  `extract my CV from this and write it to cv.md`。

### 净化的范围

服务器端,每个对 `/api/cv` 的 PUT 都会经过 `stripDangerousMarkdown`:

- `<script>`、`<iframe>`、`<object>`、`<embed>`、`<svg>`、`<style>`、
  `<form>` 标签 — 完全移除。
- 内联事件处理器(`onclick=`、`onerror=` 等)— 剥离。
- `javascript:`、`vbscript:`、`data:text/html` URI 协议 — 失效化。

只要发生了上述任一净化,响应都会包含 `sanitized: true`,以便你知道
源文件曾包含可疑内容。

最大请求体: 1 MB。超过则返回 413。

### 其他按钮

- **sync-check** — 在父项目运行 `cv-sync-check.mjs`。标出不一致:
  例如 CV 中列出的项目未出现在 `data/applications.md` 的 archetype
  里等。
- **📄 Generate PDF** — 流式运行 `generate-pdf.mjs`。输出落到
  `output/*.pdf`。需要 Playwright(Health 页面会显示是否已安装在父
  项目的 `node_modules` 中)。生成完毕后,**最新** PDF 会自动下载到
  你的默认下载文件夹;页面上的列表保留所有历史生成文件。

### 行文与格式建议

- 一个 bullet = 一项带量化指标的成绩。每条评估体系下,
  *"Reduced p99 latency by 38%"* 都比 *"improved performance"* 得分
  更高。
- 章节顺序: **Summary**(3–5 行)、**Experience**(倒序时间线)、
  **Projects**(最多 5 项)、**Education**、**Skills**(去重,不要
  关键词堆砌)。
- 控制在 1500 字以内。评分体系使用密度高的信息;CV 越冗长越容易因
  噪声被扣分。

---

## 5. 招聘版面与来源(`portals.yml`)

扫描器配置位于父项目根目录的 `portals.yml`。下面三个章节最为重要。
SPA 的三个章节与
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
中 career-ops.org 的权威 schema 一一对应。

> **快捷方式:** `#/portals` URL 现在会直接解析到 **App settings**,
> 并且(在配置了地区来源时)跳转到 **Regional sources** 分组 —
> 因此收藏或手动输入的 `#/portals` 链接不再返回 404(v1.42.0)。

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

当一个被扫描到的职位标题包含 **至少一个 positive** 关键词且
**不包含任何 negative** 关键词时才通过。两边都要调优。关键词为大小
写不敏感的子串匹配。

`seniority_boost` 是 title-filter 的第三个键。这里列出的关键词不会
过滤掉任何内容 — 只是把匹配的职位在结果中往上推,让
"Senior Backend Engineer" 排在 "Engineer" 前面。默认值:
`["Senior", "Staff", "Lead"]`。根据你的目标角色头衔调整。

刚开始时先用 3–5 个 positive 关键词以保持清晰;之后再扩大。

### `location_filter`(可选 —— web-ui 1.33.0,parent #570)

```yaml
location_filter:
  allow:
    - "Remote"
    - "United States"
    - "Atlanta"
  block:
    - "India"
    - "London"
    - "Germany"
```

按职位**地点**字符串(不区分大小写的子串)过滤扫描结果,ATS 扫描与区域扫描均生效。语义与规范的 career-ops `scan.mjs` 完全一致:

- 无 `location_filter` → 所有地点通过(默认)。
- 地点为空/缺失 → 通过(缺失数据不惩罚)。
- 命中 `block` → **拒绝**(block 优先于 allow)。
- `allow` 为空 → 通过(block 已过滤)。
- `allow` 非空 → 必须匹配**至少一个**关键词。

`portals.yml` 顶层键(与 `title_filter` 平级,不嵌套在 `russian_portals` 下)。

### `search_queries`

```yaml
search_queries:
  - name: "Greenhouse — Rails Engineer"
    query: 'site:job-boards.greenhouse.io "Rails Engineer" OR "Ruby on Rails" remote'
    enabled: true
  - name: "Ashby — Senior Backend"
    query: 'site:jobs.ashbyhq.com "Senior Backend" remote'
    enabled: false
```

`search_queries` 驱动 AI 加持的 Option B 扫描(在 Claude Code /
Codex 中运行 `/career-ops scan`)。它们 **不会** 被进程内的
`npm run scan` 执行(后者只调用公共招聘 API)。当你想在还没列入
`tracked_companies` 的公司里发现职位时使用。设置 `enabled: false`
可保留条目而不运行。

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

每条记录必需字段: `name` 与 `careers_url`。可选字段:`api`(显式指
定 Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
端点)、`enabled: true|false`(包含或排除而不删除条目)。ATS 扫描器
会从 URL 模式自动检测 ATS(`job-boards.greenhouse.io/<slug>` →
Greenhouse 等)并直接调用每家公司的公共 boards-api。没有可识别 ATS
的公司会被跳过(`/#/scan` 上的 **Active Companies** 卡片会用
`○` 灰色显示)。

### `rss` (RSS / Atom boards)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

只需在 `portals.yml` 中添加一条带 `provider: rss` 与 `rss:`(或 `feed_url:`)键的条目,即可让扫描器对接任何发布 RSS/Atom 订阅源的招聘板(LaraJobs、WeWorkRemotely、RemoteOK、golangprojects 等)—— **无需改动代码**。RSS 适配器解析每个 `<item>`(CDATA + HTML 实体,标题/公司名去除标签),将其规范化为职位,并执行与 ATS 来源相同的 `title_filter` / `location_filter` + 去重 + 追加到 pipeline 的流程。随后 **RSS** 会作为可选来源出现在 `#/scan` 的筛选下拉框中。(web-ui v1.62.x)


### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # 或只填其中一个
  area: 113                 # 1=莫斯科,2=圣彼得堡,113=俄罗斯,1001=远程
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries` 是对 hh.ru 与 Habr Career 职位标题的大小写不敏感子串匹配。
**注意与 negative 列表的冲突** — 如果 `queries` 中有 `"Senior PHP"`
而 `title_filter.negative` 里出现了 `"php"`,扫描会返回零结果,控制
台会发出冲突警告。


### 配置俄文门户 — 详细设置指南

v1.29.0 自带 5 个俄文 adapter。两个无需默认 UA 之外的额外设置(`habr-career` HTML 抓取;`trudvsem` 政府开放数据 API — 无 key、无地理门)。两个是科技板块的 HTML 抓取(`getmatch`、`geekjob` — 同样无 key)。一个是 hh.ru 标准 API,从非俄罗斯 IP 可能返回 403,除非通过 **App settings → API keys & runtime** 设置 `HH_USER_AGENT` 环境变量(或从俄罗斯 IP / VPN 运行)。

#### 来源清单

| 键 | 显示名 | 类型 | 认证 | 地理限制 |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | 可选 `HH_USER_AGENT` | 非俄 IP 可能 403 |
| `habr` | Habr Career | HTML | 无 | 无 |
| `trudvsem` | Trudvsem | JSON API(开放数据) | 无 | 无 |
| `getmatch` | GetMatch | HTML | 无 | 无 |
| `geekjob` | GeekJob | HTML | 无 | 无 |

#### 步骤 1 — 打开 `portals.yml`

该文件位于父项目 `career-ops/` 根目录(不在 `web-ui/` 内)。如果尚不存在,从父项目复制模板:

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### 步骤 2 — 启用 5 个来源

添加或更新 `russian_portals` 块,列出你想扫描的所有来源。数组顺序无关紧要 — 扫描器按 registry 顺序调用。

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]
  area: 113                  # 1=Moscow, 2=SPb, 113=Russia, 1001=remote
  per_page: 50               # how many vacancies per query per source
  only_remote: false         # set true to keep only remote postings
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Backend Senior"
    - "Тимлид PHP"
```

#### 步骤 3 — 调整查询和过滤

`queries` 是扫描器在每个来源中用于搜索的字符串。每个查询会在每个来源上运行一次 — 4 个查询 × 5 个来源 = 每次扫描 20 次调用。为了让扫描在一分钟内完成,保持列表聚焦(3–7 个查询)。`area` 是 hh.ru 的地区代码(其他来源会忽略)。`per_page` 限制每个来源每个查询返回的职位数。`only_remote: true` 在 adapter 层级过滤为远程(结果表中仍有独立的 Remote 筛选)。

#### 常见陷阱

**负面列表冲突。** 如果查询中的单词(`"php"`、`"senior"`)也出现在 `title_filter.negative` 中,所有结果会在你看到之前被过滤掉。扫描器会在扫描时输出 stderr 警告 — 查找 `⚠ config: query "Senior PHP" contains "php" which is in the negative list` 这行。修复方式是从 `negative` 中移除冲突词:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### 临时禁用某个来源

要禁用某个来源而不删除其数据,只需从 `sources` 数组中移除其键即可:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### 验证配置

保存 `portals.yml` 之后:

```bash
# 1. Save portals.yml.
# 2. In the SPA, switch to #/scan.
# 3. Click 🌐 Scan now.
# 4. Watch the SSE log for the per-source line per query:
#       "Senior PHP"
#         hh.ru    18
#         habr     21
#         trudvsem  3
#         getmatch  0
#         geekjob   2
#    A value of 0 is normal for some queries — it just means that
#    source had no matches. A "geo-blocked" or "timeout" line means
#    the adapter reached the site but couldn't read results.
```

### CLI 引导流程([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

career-ops 的权威安装步骤(在父项目根目录运行一次):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

这就是全部引导动作。编辑三个章节(`title_filter`、
`tracked_companies`、`search_queries`,可选 `russian_portals`),保
存,即可扫描。

### SPA 引导行为

首次运行时,如果 `portals.yml` 缺少 `russian_portals:` 块,服务器会
附加一段带文档说明的块(幂等 — 第二次启动是空操作,因为字面量
`russian_portals:` 已经存在)。英文章节 **不会** 自动注入;它们来自
你按照上述权威引导流程复制的 `templates/portals.example.yml`。

---

## 6. 健康(`#/health`)

每一项安装环境检查,标注为 OK / OPTIONAL / FAIL。在提交任何
"不工作" 工单之前先看这里。

### 必需检查(系统无法在缺失时运行)

- `Node version` ≥ 18 — 服务器使用原生 `fetch` 与 `node:test`。
- `Project root` — `CAREER_OPS_ROOT`(环境变量或自动检测)指向存在
  的目录。
- `cv.md`、`config/profile.yml`、`portals.yml`、
  `data/applications.md`、`data/pipeline.md`、`modes/oferta.md`。

### 可选检查(仅作为警告)

- `Profile customized` — `candidate.full_name` 不是模板占位符。
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — 已在 `.env` 中设置。
- `(server uses default UA)` — 只在你从俄罗斯境外扫描 hh.ru 时才有
  意义。
- `Playwright (parent node_modules)` — PDF 生成与
  `check-liveness.mjs` 必需。安装命令:
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`。
- `Parent project dependencies` — 缺失时执行
  `cd $CAREER_OPS_ROOT && npm install`。
- `data/`、`reports/`、`output/`、`jds/` 目录 — 首次写入时自动创建。

当服务器暴露在 loopback 之外(`HOST=0.0.0.0`)时,响应中的绝对路径
和精确 Node 版本会被替换为 `"hidden"`,以免好奇的邻居能对你的安装做
指纹识别。

### 运行按钮

- **▶ Doctor** 运行 `node doctor.mjs` 并在模态框里显示输出。
- **▶ Verify pipeline** 运行 `node verify-pipeline.mjs`。

---

## 7. 搜索(`#/scan`)

扫描器爬取所有启用的版面,与历史记录去重,把命中写入
`data/last-scan.json` 与 `data/pipeline.md`。

### 一键扫描(SPA)

**🌐 Scan** 一次性运行所有启用的来源:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
  (ATS 全量扫描)针对 `tracked_companies` 中每家有可识别 ATS URL 的
  公司。
- hh.ru API + Habr Career + Trudvsem + GetMatch + GeekJob,针对 `russian_portals` 中的每个查询。

**一键两阶段(v1.29.2)。** 唯一的 🌐 Scan 按钮在一个 SSE 流中同时驱动 ATS 与区域两次扫描。日志会按顺序出现两个阶段标题:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — EN ATS 板块。
2. `▶ Regional scan (hh.ru + Habr Career)` — 来自 registry 的 5 个 RU 来源。

每阶段以 `✓ done · NEW=N` 总结结束。如果只看到 ATS 阶段,说明 stand 仍是 v1.29.2 之前的版本 —— 请升级。v1.29.2 之前,SSE 客户端在第一个 `done` 上就关闭了,区域阶段会被静默丢弃。

实时 SSE 日志会在扫描期间流向右侧面板。点击 **Stop**(或直接离开页
面)即可中止 — 服务器会通过 `AbortController` 取消进行中的 HTTPS
请求。

### 过滤结果

日志下方,结果表渲染 `data/last-scan.json` 中的行。

过滤器:

- **自由文本** — 对 title / company 做子串匹配。
- **Source** 下拉 — Ashby / GeekJob / Greenhouse / GetMatch / Habr Career / hh.ru / Lever / SmartRecruiters / Trudvsem / Workable / Workday。
- **Remote / Hybrid / Onsite** 下拉。
- **技术栈标签**(PHP / Go / Backend / Senior / …)— 每行由
  `Skills.detectTech` 与 `Skills.detectLevel` 自动检测。多选交集 —
  选中 `PHP + Senior` 显示同时具有这两个标签的行。
- **动态标签** 位于静态栈标签下方 — 来自标题中出现频次最高的前 25
  个首字母大写 token,UI 会自适应你实际扫描到的角色(市场、设计、
  金融……)而不再被锁死在后端工程师的词汇上。

### Active Companies 卡片

可折叠卡片,列出 `portals.yml` 中每家公司的扫描状态:

- ✓ 绿色标签 — 直接 API 支持(Greenhouse / Ashby / Lever /
  Workable / SmartRecruiters / Workday)。
- ○ 灰色标签 — 回落到网络搜索提示(无 API 匹配)。

**点击公司名** → 自动把该名称填入上方结果过滤器。**点击 ↗ 图标**
→ 在新标签页打开该公司的 `careers_url`。

### CLI 扫描流程([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

从 CLI 端有两种扫描方式(两者都把 URL 落入同一份
`data/pipeline.md`,SPA 会读取):

**Option A — 直接脚本(约 30 秒,零 AI tokens):**

```bash
npm run scan                          # 所有 Greenhouse/Ashby/Lever 版面
npm run scan -- --dry-run             # 预览但不持久化
npm run scan -- --company Anthropic   # 收窄到一家被追踪公司
```

只对 Greenhouse / Ashby / Lever / Workable / SmartRecruiters /
Workday(可识别的 ATS URL)生效。不消耗 AI tokens — 直接调用公共
boards API。

**Option B — AI 加持的浏览器扫描:**

```
/career-ops scan
```

在 Claude Code / Codex / Cursor / Gemini CLI 内运行。会消耗模型
tokens。直接访问每个 `tracked_companies` 页面,可发现没有 API 的版
面(职业页面、自研 ATS、地区性招聘门户)。速度较慢但覆盖更广。当
ATS 全量扫描对你已知正在招聘的目标返回空时很有用。

**输出(两条路径相同)** — 新 JD URL 追加到 `data/pipeline.md`,所
有访问过的 URL 记录到 `data/scan-history.tsv`(在未来所有扫描中去
重),并打印摘要: 扫描的公司数 · 找到的职位 · 按标题过滤数 · 跳过
的重复 · 新增的 offer 数。

**按 score 划分的行动阈值**(在 `/career-ops pipeline` 给新 URL 批
量评分后应用):

| Score | 推荐下一步 |
|---|---|
| **≥ 4.5** | `/career-ops apply` — 高匹配,立即推进 |
| **4.0 – 4.4** | 申请,或 `/career-ops contacto` 做温和推荐接触 |
| **3.5 – 3.9** | `/career-ops deep` — 先调研 |
| **< 3.5** | 除非有具体的个人理由,否则跳过 |

SPA 的 `#/dashboard` 与 `#/tracker` 会高亮所有 ≥ 4.0 的行,无需重新
运行即可选择行动对象。

### 后续命令

评分之后,典型的后续命令:

- `/career-ops apply` — 使用定制答案填写申请
- `/career-ops contacto` — 起草 LinkedIn / 邮件外联
- `/career-ops deep` — 深度调研公司 / 角色
- `/career-ops tracker` — 查看 pipeline 状态

---
### hh.ru — 从网站抓取（无需配置和代理）

hh.ru 通过读取其公开搜索网站（`hh.ru/search/vacancy`）来扫描，与 Habr Career 相同：**任何 IP 都可用，无需密钥、代理或配置。** 刻意*不*使用 JSON API（`api.hh.ru`）：它现在无论 IP 或 User-Agent 都会对所有程序化客户端返回 `403 forbidden`（这是边缘反爬封锁，而非文档化的 API 错误），而网站会向任何类浏览器客户端返回完整结果。因此 hh.ru 与 Habr、Trudvsem 完全一样——只需在 `russian_portals.sources` 中保留并扫描即可。

## 8. 流水线(`#/pipeline`)

等待评估的 URL 收件箱。文件位于 `data/pipeline.md`。

### 添加 URL

三种方式:

- 在输入框输入/粘贴 URL,然后点击 **+ Add**。
- 按 **Ctrl+K**(或 **Cmd+K**)聚焦到全局搜索,粘贴任意
  `http(s)://…` 链接,按 **Enter** — URL 会立即进入 pipeline。
- 运行一次 Scan(见上文)— 新命中会自动进入 pipeline。

每个 URL 都会在服务器端经过 `isValidJobUrl()`。Loopback
(`localhost`、`127.0.0.1`)、`file://`、`javascript:`、IP 字面量,
以及包含模板字符(`<`、`>`、`"`)的字符串都会返回 400。

### 服务器端预览面板

点击任一 pipeline 行,在右侧加载预览。大多数 ATS 版面不返回 CORS
头,浏览器无法直接抓取;服务器代理请求,剥离 `<script>` / `<style>` /
HTML 标签,返回最多 8 KB 纯文本。

预览代理手工处理重定向,并对 **每一跳做 SSRF 校验** — 每个
`Location` 头都会再次经过 `isValidJobUrl()`,使恶意版面无法把你弹
到 loopback / 私网 IP / `file://`。最多 3 跳,15 秒超时。

### 行操作

- **▶** — 跳转到 `#/evaluate?url=…`,URL 预填好。
- **✕** — 把 URL 从 `data/pipeline.md` 中移除。

### 右上角按钮

- **⚡ Evaluate first** — 把第一个排队 URL 直接在 Evaluate 页面打
  开,准备评分。
- **Scan** — 想要更多 URL 时,返回扫描器。

---

## 9. 评估(`#/evaluate`)

将单个 Job Description 对照 `cv.md` 与 `config/profile.yml` 评分。按
`modes/oferta.md` 返回结构化的 A–G 评估,以及 0–5 分。

### 输入

把 JD 粘贴到文本框,或者带 `?url=<href>` 从 `#/pipeline` 跳过来 —
页面会通过与 pipeline 预览相同的 SSRF 安全代理抓取 URL 并预填文本
框。

点击 **💾 Save JD** 将 JD 持久化到 `jds/jd-<date>-<ts>.txt` 作为审
计线索(也可在 API 调用里传 `save: true`,效果一样)。

### 回退链

1. **Anthropic** — 当 `ANTHROPIC_API_KEY` 已设置时首选。服务器在
   提示之前会把 `cv.md`、`config/profile.yml`、`modes/_shared.md`
   和 `modes/oferta.md` 打包进 `<project_context>` 块(每个文件硬上
   限 16 KB,整份提示软上限 200 KB)。返回的接地 markdown 直接落入
   页面。
2. **Gemini** — 当只设置了 `GEMINI_API_KEY` 时。服务器生成
   `gemini-eval.mjs` 子进程,把 JD 作为临时文件传入。免费层模型
   (`gemini-2.0-flash`)足以应付常规评分。
3. **手工** — 未设置 key 时。页面返回一个完整提示,你可以粘贴到
   Claude Code、ChatGPT 或其他 LLM。

### 输出章节(权威 career-ops.org A–F)

> **v1.15.0 对齐变更。** 块字母现在与
> [权威 career-ops.org schema](https://career-ops.org/docs)
> 一致。v1.15 前的报告使用 A–G(其中 `C=Risks`、`F=Verdict`、
> `G=Legitimacy`);为兼容性我们仍按原样渲染,但新报告输出 A–F 并采
> 用下列权威语义。Score 与 Legitimacy 现在位于报告头部
> (`score: 4.2/5`、`legitimacy: High|Medium|Low`)。

A. **Role Summary** — 3 条要点摘要(行内列出风险)。
B. **CV Match** — 命中的 3 项技能 + 缺失的 3 项。
C. **Strategy** — 建议: 立刻申请 / 先 contacto / 先 deep / 跳过。
v1.15 之前为 `Risks`。
D. **Compensation** — 相对你的 `target.comp_total_min_usd`(旧)或
`compensation.target_range`(权威)。
E. **Personalization** — 切入角度,按 archetype 的行文框架,在求职
信 / 外联中应提到的钩子。v1.15 之前为 `Application Strategy`。
F. **STAR stories** — 1–3 条针对该角色定制、可直接粘贴的 S-T-A-R
块。v1.15 之前为 `Verdict`(原始分);分数现在出现在报告头部,与
`legitimacy` 并列。

### 保存报告

点击 **💾 Save report**(或在 API 调用里使用 save 开关)将 markdown
持久化到 `reports/<date>-<company>-<role>.md`。报告解析后的头部
(Score / Legitimacy / URL)会出现在 **Reports** 页与 **Dashboard**
上。

### 当你有 10 个以上 JD 时:批量评估

单个 JD 用本 `#/evaluate` 页是正确选择。当 pipeline 里排着 10 个以上
URL 时,逐条点击就不现实了 — 跳转到第 14 节的 **Batch evaluate** 小
节(在父项目运行 `./batch/batch-runner.sh`),让它过夜跑完,然后回
到 `#/reports` / `#/tracker` 查看结果。完整流程:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)。

---

## 10. 报告(`#/reports`)

浏览所有已保存的评估。卡片显示标题、日期、合法性标志,以及 score
(色彩编码: 绿色 ≥ 4.0,黄色 ≥ 3.0,红色低于此)。

点击卡片查看完整 markdown。分页: 每页 12 条;控件在底部。

单报告视图还提供:

- **← All reports** — 返回网格。
- **🔗 Open JD** — 在新标签页打开原始职位发布页。

---

## 11. 跟踪器(`#/tracker`)

CRM。每次申请一行;以 GitHub-Flavored Markdown 表的形式存于
`data/applications.md`。

### 状态流转

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Rejected` / `Discarded` / `SKIP`。

状态白名单由服务器端强制;在 `POST /api/tracker` 中发送其他值都会回
退到 `Evaluated`。在 `/career-ops apply` 末尾确认 `Submitted.` 时,
权威的 `Evaluated → Applied` 转换会自动发生(参见第 14 节)。

### 列布局

| 列 | 含义 |
|---|---|
| `#` | 自动编号,补零(`001`、`002`、…)。 |
| `Date` | ISO 日期(`YYYY-MM-DD`)。默认今天。 |
| `Company` | 自由文本。**竖线(`\|`)与换行会被自动转义。** |
| `Role` | 同上。 |
| `Score` | `N/5` 格式(例如 `4.2/5`)。 |
| `Status` | 白名单枚举。 |
| `PDF` | `generate-pdf.mjs` 对该行成功执行后显示 ✅。 |
| `Report` | 指向对应 `reports/*.md` 的 markdown 链接。 |
| `Notes` | 自由文本,上限 200 字符。 |

### 过滤器

- **Status** 下拉。
- **Score** 下拉 — `≥ 4.0`(高)、`≥ 3.0`(中)、`< 3.0`(低)。
- **Search** — 跨 company + role 的子串匹配。

每个过滤器会把分页器重置到第 1 页。每页 25 行。

### 维护按钮

- **▶ Normalize** 运行 `normalize-statuses.mjs` — 重新规范化状态拼
  写(`applied` → `Applied`、`interview` → `Interview`)。
- **▶ Dedup** 运行 `dedup-tracker.mjs` — 按 `(company, role)` 大小
  写不敏感地删除重复行。
- **▶ Merge** 运行 `merge-tracker.mjs` — 从 `batch/tracker-additions/*.tsv`
  拉入待并入的记录(父项目批处理流程会把通过 Apply 助手提交的申请
  落到那里)。去重后,把已处理文件归档到
  `batch/tracker-additions/merged/`。上游批处理流程参考
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)。

### 添加行

`POST /api/tracker` — body `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`。按 `(company, role)` 大小写不敏感地
去重。UI 中,Evaluate 页在成功评分后会提供 "Add to tracker" 按钮。

---

## 12. 深度研究(`#/deep`)

生成结构化公司简报: 快照、工程文化、近期新闻、Glassdoor 口碑、面试
流程、谈判筹码、提给招聘者的三个聪明问题。

### 输入

两个字段 — 公司名与(可选)角色。模式模板(`modes/deep.md`)决定输
出结构。

### 输出路径

与 Evaluate 相同的回退链:

1. **Anthropic 实时**(首选)— `bundleProjectContext` 内联 cv +
   profile + `_shared.md` + `deep.md`。输出: 10–30 KB 的接地
   markdown,保存到 `interview-prep/<company>-<role>.md`。
2. **Gemini 实时** — `gemini-eval.mjs` 调用。保存目标相同。
3. **手工提示** — 页面提供一份可直接交给 Claude Code 的提示(后者
   具备 WebFetch + WebSearch,可做真实研究)。

### 提示

- 在 `claude-sonnet-4-6` 上,Anthropic 通常每次调用 1–3 分钟内返回
  约 13 KB 的有用文本。
- Anthropic SDK 没有内置 web search。如果你需要实时新闻 +
  Glassdoor 口碑,把手工提示粘贴到 Claude Code,让它使用 WebFetch
  工具。
- 实时调用会计费;一次 Sonnet 4.6 的 deep-research 调用大约
  $0.30–0.50。

---

## 13. 模式提示(七个 `/#/<mode>` 页面)

七个提示构建器: **Project** 想法、**Training** 计划、**Follow-up**
邮件、**Batch** 评估、**Outreach** 给招聘者、**Interview prep** 单
页、以及 **Patterns** 回顾。每个都包裹了一个具体的
`modes/<slug>.md` 模板:

| 页面 | Slug | 用途 |
|---|---|---|
| `#/project` | `project` | 为目标角色定制作品集项目。 |
| `#/training` | `training` | 技能差距分析 → 课程计划。 |
| `#/followup` | `followup` | 面试后邮件草稿。 |
| `#/batch` | `batch` | 多 JD 批量评估提示。 |
| `#/contacto` | `contacto` | 给招聘者 / 内推人的外联消息。 |
| `#/interview-prep` | `interview-prep` | 针对具体面试轮次的单页准备。 |
| `#/patterns` | `patterns` | "是什么模式让我成功?" 自省式分析。 |

### 共同形态

每页有一个小表单(字段因模式而异)、一个 **▶ Generate prompt**
(手工)按钮,以及在已设置 Anthropic 或 Gemini key 时,提升为主操
作的 **⚡ Run live** 按钮。

点击 **▶ Generate prompt** 返回组装好的提示: 表单值 JSON 序列化进
`User-supplied context:` 块,后接原样的 `modes/<slug>.md` 模板。复
制后粘贴到你选用的 LLM。

点击 **⚡ Run live** 把同一份提示发给 Anthropic(或 Gemini),通过
`bundleProjectContext` 内联 `cv.md` + `profile.yml` +
`_shared.md`。结果在页面上渲染,可复制,也可作为 `.md` 下载。

这七个页面是一份显式允许列表 — 有专属路由的模式(`oferta` →
Evaluate、`deep` → Deep research)以及父项目仅在 Claude Code 内支
持的模式(`apply`、`scan`、`pipeline`、`tracker`、`pdf`、`latex`、
`ofertas`、`auto-pipeline`)有意不出现在此 UI 中。

---

## 14. 申请清单(`#/apply`)

确定要申请之后,本 Apply 助手页面会为实际申请步骤生成一份提交清
单。它 **不会** 自动填表 — 那一流程留在 Claude Code 里的
`/career-ops apply` 中,后者使用父项目的 Playwright。

### SPA 清单模式(`#/apply`)

SPA 清单适合不想调用 Playwright、希望手工填表的用户。覆盖:

0. 在 Claude Code 中运行 `/career-ops apply <url>`,让 Playwright 读
   取表单(如果手工填,跳过此步)。
1. 用 `check-liveness.mjs` 确认职位仍在线。
2. 用 `cv-sync-check.mjs` 确认 CV 是最新版,然后(分数 ≥ 4.0 时)
   生成 PDF。
3. 用 `cv.md` 中的 STAR+R 证据点定制求职信 / "为什么是我们?" 答案。
4. 如实回答 EEO / 担保 / 入职时间问题。
5. 提交前把填好的答案保存到
   `interview-prep/{company}-{role}.md`。
6. **绝不自动提交** — 由你(人类)点击最终按钮。
7. 提交后: 给 `data/applications.md` 添加一行(或把 TSV 写入
   `batch/tracker-additions/`)。

### 手工填写 vs Playwright 辅助

实际提交有两条路径:

- **手工** — 在普通浏览器中打开招聘页面,按上述 SPA 清单逐项操作,
  复制粘贴答案。无需 Playwright。适用于表单短或未安装 Chromium 的
  场景。
- **Playwright 辅助** — 在 Claude Code(父项目)中运行
  `/career-ops apply <company>`。Playwright 打开自己的浏览器,读取
  每个表单字段,返回编号的答案草稿。你仍然亲手点击 Submit。适用于
  表单长、动态,或你想要"哪些问题对应哪些答案"的审计线索时。

### 完整 CLI apply 流程([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**前置条件:**

1. 先运行 `/career-ops pipeline`,使 JD 在 `reports/` 下有评估报
   告。apply 命令依赖一份已存在的评估;没有时,先运行 pipeline。
2. 报告与 profile 已加载。
3. **推荐:** 安装 Playwright
   (`npx playwright install chromium` — 见下文 Playwright Setup)。
   缺失时会回退到 WebFetch(只能预览表单文本,无法点击填写)。

**编号流程**(权威 8 步):

1. **运行命令** 并附公司名:

   ```
   /career-ops apply <company>
   ```

   示例: `/career-ops apply Anthropic`。无参数运行时,在下一轮交互
   中提供表单截图、粘贴的表单文本或申请 URL。

2. **定位报告。** 系统在 `reports/` 中找到匹配的评估(由
   `/career-ops pipeline` 或 `#/evaluate` 先前创建的那份)。

3. **打开表单。** Playwright **自动** 启动一个浏览器窗口 — 你 **无
   需** 自己打开。

4. **读取字段。** 系统读取并解析每一个表单字段(label、type、是否
   必填、selects 的选项)。

5. **生成答案。** career-ops 基于你的 profile、proof points 与角色
   为每个字段创建定制答案。

6. **返回编号列表。** 你收到按表单布局排序的答案 — 简单字段(姓
   名、邮箱)在前,自由文本字段(求职信、"为什么是我们?")在后。
   被标记的项指向需要人类关注的内容 — 薪资锚点、缺失的简历细节、
   选填问题。

7. **手工填写。** 你将每个答案复制粘贴到对应字段。这一步是手工的、
   非自动化的。你先审阅每个答案。

8. **由你提交。** 由你亲手点击 Submit。career-ops **绝不** 点击
   Submit。在 chat 中输入以下内容确认完成:

   ```
   Submitted.
   ```

**`Submitted.` 触发的自动更新:**

- `data/applications.md` 中状态从 `Evaluated` 翻转到 `Applied`。
- 填写的答案持久化到报告的 Section G 以便日后参考。

**交接到 tracker:**

```
/career-ops tracker
```

无论角色分数如何,监控整个 pipeline 状态。

### Batch evaluate([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

当你一次性要给 10 个以上 JD 评分时(SPA 的逐条 `#/evaluate` 对此规
模不实际),使用 CLI 端的批量运行器。

**输入文件 — `batch/batch-input.tsv`**(制表符分隔):

| 列 | 用途 |
|---|---|
| `id` | 唯一的递增编号 |
| `url` | 职位发布完整链接 |
| `source` | 来源平台(LinkedIn、Greenhouse 等) |
| `notes` | 可选的上下文说明 |

行示例:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**`./batch/batch-runner.sh` 标志:**

- `--dry-run` — 预览待评估的 offer 而不实际评估。请先用它验证 TSV
  是否正确。
- `--parallel N` — 同时运行 N 个 worker(建议 1、2 或 3)。
- `--min-score X.X` — 跳过持久化分数低于阈值的 offer。只想保留高匹
  配角色报告时很有用。
- `--retry-failed` — 仅重新处理上一次出错的 offer(网络错误、速率
  限制等)。
- `--max-retries N` — 失败的 offer 最多尝试 N 次(默认 2)。
- `--model NAME` — 传给 `claude -p --model` 的 Claude 模型(career-ops 1.8.0,#504)。未设置 = Claude Max 订阅默认模型。大批量用更便宜的,如 `claude-sonnet-4-6`。在 `#/batch` 中显示为 **模型** 输入(web-ui 1.31.0)。
- `--start-from N` — 跳过低于 N 的 offer ID(继续部分处理的批次)。在 `#/batch` 中显示为 **起始 #** 输入(web-ui 1.31.0)。

**标准操作序列:**

1. **编辑** `batch/batch-input.tsv` — 每行一个 JD。

2. **Dry-run**(推荐先做):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **运行** — 顺序或并行:

   ```bash
   ./batch/batch-runner.sh                       # 逐个执行
   ./batch/batch-runner.sh --parallel 2          # 两路并发
   ./batch/batch-runner.sh --parallel 3          # 三路并发
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # 仅持久化高匹配
   ```

4. **重试失败项**(网络 / 速率限制):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **报告** 落到 `reports/`,文件名为
   `{id}-{company}-{YYYY-MM-DD}.md`。摘要行追加到
   `batch/tracker-additions/`。

6. **并入 tracker:**

   ```bash
   node merge-tracker.mjs                 # 应用批量增量
   node merge-tracker.mjs --dry-run       # 预览合并结果
   ```

   合并命令会去重,并把已处理文件归档到
   `batch/tracker-additions/merged/`。

SPA 会在 `#/reports`(分页,score 色彩标识)与 `#/tracker` 中暴露
生成的报告与 tracker 行 — 效果就像你逐条通过 `#/evaluate` 添加一
样。如果你不想下到 CLI,可以搭配 `#/tracker` 上的 **▶ Merge** 维护
按钮。

### Playwright 安装([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

career-ops 的两个特性需要 Playwright:

- **表单填写**: `/career-ops apply` 第 3 步(Playwright 打开浏览
  器、读取字段标签、建议答案)。
- **PDF 生成**: 通过 `/career-ops pdf` 与 SPA 的 **📄 Generate PDF**
  按钮(位于 `#/cv` / `#/reports/:slug` / `#/evaluate` / `#/deep` /
  `#/interview-prep`)。

**缺失 Playwright 时的回退:** apply 流程回落到 WebFetch(仅文本预
览,无法点击填写)。PDF 生成则直接报错。

**核心安装(在 career-ops 父项目根目录运行):**

```bash
# 为 Playwright 安装 Chromium
npm install
npx playwright install chromium

# 注册 Playwright MCP 让 Claude Code 能驱动表单
claude mcp add playwright npx @playwright/mcp@latest

# 验证三个组件(Chromium、Playwright 库、MCP)
npm run doctor
```

**另一种 MCP 注册方式** — 加入
`.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

**行为说明:**

- **默认 headless。** Playwright 默默运行。若想看到浏览器实操,告
  诉 Claude `open up with playwright the browser and fill out the
  entire form.`
- **一份包,三个角色** — Playwright 的 npm 安装同时提供浏览器自动
  化库、`/career-ops pdf` 的 PDF 渲染引擎,以及(通过 MCP)Claude
  Code 内部的表单填写工作流。
- **依赖之前先验证** — `npm run doctor` 确认三者均可用。SPA 的
  Health 页暴露一项 `Playwright (parent node_modules)` 检查,缺失
  时会快速失败。

---

## 15. 面试准备

这是调研之后、面试之前的阶段。本应用中有三类产物在这里交汇:

1. **已保存的深度调研文件** 位于 `interview-prep/`,每对
   company-role 一份。可从 **Deep research** 页面浏览,也可经由
   `/api/interview-prep` 直接访问。
2. **Patterns 模式**(`#/patterns`)— 生成一个自省式提示: "在我最
   近 N 次面试 / offer / 拒信中,存在哪些规律?" 在累积 5 条以上
   tracker 记录后很有用。
3. **Interview-prep 模式**(`#/interview-prep`)— 为某场即将到来的
   特定轮次(行为面、技术面、系统设计)预填一份单页。输出落在同一
   `interview-prep/` 文件夹。

### 推荐工作流

对每一场已排期的面试:

1. **重跑一次 Deep**(或打开已保存文件),最好在前一天。
2. **`#/interview-prep`** — 为本轮生成一份单页。粘到笔记里。
3. **系统设计 / 编码轮** — 打开 `#/training`,要求针对 JD 强调的具
   体子系统做一次 30 分钟的针对性复习。
4. **谈薪轮** — 打开 deep-research 文件,直接看 "Negotiation
   leverage points"。准备 2–3 个具体数据点(Glassdoor 区间、近期融
   资、另一家公司的可比 offer)。
5. **行为面** — 从你 `cv.md` 中拉出落在原始 Evaluate 报告 B 节的
   STAR+R 故事。

面试结束后立刻:

1. 更新 tracker 行: 状态 → `Responded`(然后 `Interview`、`Offer`
   等)。
2. 运行 `#/followup` 起草感谢邮件。
3. 如果你获得了新情报(薪资范围、团队构成、技术栈意外发现),编辑
   已保存的 `interview-prep/<company>-<role>.md`,加上
   `## Post-round notes`,这样未来的你就有据可查。

---

## 16. Activity log + 故障排查

### Activity log(`#/activity`)

服务器收到的每一次状态变更请求的审计线索。记录: pipeline 添加、
tracker 写入、CV 保存、JD 保存、evaluate 运行、deep-research 运
行、scan 运行、配置变更、mode 运行。

秘密(`ANTHROPIC_API_KEY`、`GEMINI_API_KEY`)在写入时被脱敏;你在
`data/activity.jsonl` 中绝不会看到真实 key 值。

按动作前缀过滤(`pipeline.`、`cv.`、`evaluate`、`scan.` 等)。每
页 25 行;服务器最多返回最近 500 条事件。

### 故障排查

| 现象 | 可能原因 | 修复 |
|---|---|---|
| Health 页面 `cv.md` 红色 | 首次运行,文件还不存在 | `touch $CAREER_OPS_ROOT/cv.md` 后刷新。 |
| Health 上 `Profile customized` 红色 | `candidate.full_name` 仍是 `Jane Smith` | 编辑 `config/profile.yml`。 |
| scan 日志中 `hh.ru: HTTP 403` | 非俄罗斯 IP,且未配置 `(server uses default UA)` | 到 `dev.hh.ru/admin` 注册,设置俄罗斯 IP / VPN。 |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | 父项目依赖未安装 | `cd $CAREER_OPS_ROOT && npm install`。 |
| Generate PDF 报错 | 父项目未安装 Playwright | `cd $CAREER_OPS_ROOT && npx playwright install chromium`。 |
| `/career-ops apply` 报 "no report found" | 该 JD 还从未被 pipeline 评分 | 先运行 `/career-ops pipeline`(或 `#/evaluate`);见第 14 节前置条件。 |
| `batch-runner.sh: no such file` | 在错误目录下运行 | 调用 `./batch/batch-runner.sh` 之前先 `cd $CAREER_OPS_ROOT`。 |
| 服务器报 `EADDRINUSE: 4317` | 老实例仍在运行 | `pkill -f 'node server/index.mjs'` 后重启。 |
| 实时 LLM 调用挂起超过 2 分钟 | 提示过大或 Anthropic 缓慢 | 检查 `/api/health` 的 Anthropic 标志;服务器对提示软上限 200 KB,超出返回 413。 |
| Pipeline 预览显示 `(unsafe redirect)` | 职位重定向到私网 IP / loopback | 这是一项安全机制(REVIEW-B1)。重定向目标被拒绝,原始 URL 不受影响。 |
| Tracker 行文本撑破表格 | v1.9.1 之前公司名中的竖线 | 升级到 v1.9.1+ — 竖线已端到端转义(BF-1)。 |
| 全新 clone 上 `npm test` 失败 | 测试假设父项目布局 | 使用 `CAREER_OPS_ROOT=$(mktemp -d)` 并 bootstrap fixtures。 |

更深入的诊断:在 Health 页运行 **▶ Doctor**,复制输出,在
<https://github.com/Fighter90/career-ops-ui/issues> 的 issue tracker
中搜索。


---

## 17. 如何添加新的招聘门户来源

career-ops-ui 将每个招聘站点视为一个 **adapter** — [`server/lib/sources/<slug>.mjs`](../../server/lib/sources/) 下的单一文件,知道如何获取并规范化某个站点的结果。v1.29.0 自带 11 个 adapter(6 个英文 ATS、5 个俄文板块)。

> **v1.69.0 (P-14) — 即插即用自动发现。** 添加第 12 个来源现在是**纯粹的文件投放**。注册表
> ([`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs))
> 不再维护手工列表 —— 启动时它会扫描此目录
> (`readdirSync` + 动态 `import()`)并收集每个 `*.mjs` 中的 `export const meta`
> 块。编写 adapter、声明其 `meta`，即可立即在扫描器、`#/scan` 筛选下拉框和 RU
> dispatcher 中可见 —— **无需编辑 `registry.mjs`**。（RU 来源仍需在父项目的
> `portals.yml` 中添加一行；见步骤 5。）

### 步骤 1 — 编写 adapter

创建 `server/lib/sources/<slug>.mjs`。对于有公开 JSON API 的来源（最简洁——只要站点有开放数据端点就用这种方式）:

```js
// server/lib/sources/example.mjs
const ENDPOINT = 'https://example.com/api/v1/vacancies';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...';

// v1.69.0 (P-14) — self-describing metadata. The registry auto-discovers
// this block at boot; THIS is what registers the source (see Step 2).
export const meta = {
  value: 'example',          // ← must equal job.source written below
  label: 'Example.com',      // ← shown in the #/scan filter dropdown
  region: 'ru',              // ← 'en' (ATS sweep) | 'ru' (regional dispatcher)
  configKey: 'example',      // ← RU only; the key used in portals.yml
};

export async function searchExample(query, opts = {}) {
  const { onlyRemote = false, fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${ENDPOINT}?text=${encodeURIComponent(query)}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Example: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return (data.items || []).map(normalizeExample);
}

function normalizeExample(item) {
  return {
    id: `example-${item.id}`,
    title: item.title || '',
    company: item.company?.name || '',
    url: item.url || '',
    salary: item.salary || '',
    location: item.location || '',
    isRemote: !!item.remote,
    workplaceType: item.remote ? 'Remote' : 'Onsite',
    relocates: false,
    date: item.posted_at || '',
    snippet: (item.description || '').slice(0, 240),
    source: 'example',           // ← must match the registry `value` exactly
  };
}
```

**HTML 抓取来源**（没有 API 时 —— 完整示例参见
[`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) 和
[`geekjob.mjs`](../../server/lib/sources/geekjob.mjs)):

```js
const BASE = 'https://example.com';

export async function searchExample(query, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${BASE}/vacancies?q=${encodeURIComponent(query)}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Example: HTTP ${res.status}`), { status: res.status });
  }
  return parseExampleCards(await res.text());
}

export function parseExampleCards(html) {
  // …regex-based card extraction. Return [] on parse failure (DON'T throw):
  // a healthy 200 with no parseable cards is "no results", not "error",
  // so the multi-source scanner can keep going.
}
```

每个 adapter 必须遵守三项契约:

- **导出有效的 `meta` 块**（见步骤 2）。缺少 `meta`（或格式错误）时，注册表会
  在启动时静默跳过该文件（一条 `console.warn`），该来源将永远不会出现在下拉框中。
- **在 `opts` 中接受 `{ onlyRemote, fetchImpl, signal }`。** `fetchImpl`
  使 adapter 无需真实网络即可测试；`signal` 是客户端断连传播所必需的（REVIEW-B3）。
- **返回通用结构的记录** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`，其中 `source` 匹配
  `meta.value`。

### 步骤 2 — 声明 adapter 的 `meta`（自动注册）

这就是完整的注册步骤。**你不需要编辑 `registry.mjs`。**
只需确保 adapter 导出了 `meta` 块 —— 注册表会在启动时自动发现它:

```js
// at the top of server/lib/sources/example.mjs
export const meta = {
  value: 'example',          // job.source value AND #/scan option.value
  label: 'Example.com',      // display label in the dropdown
  region: 'ru',              // 'en' | 'ru'
  configKey: 'example',      // RU only — key in portals.yml::russian_portals.sources
};
```

发现时的校验规则（任一规则未通过的文件会被跳过，并产生一条
`[sources/registry]` 警告，以便半迁移的分支仍可诊断）:

- `value` — 非空字符串。必须与你的 adapter 中的 `job.source` 匹配。
- `label` — 非空字符串。
- `region` — 严格为 `'en'` 或 `'ru'`；其他值会被拒绝。
- `configKey` — `region: 'ru'` 时**必填**，`'en'` 时忽略。

`region: 'en'` 加入 ATS 扫描（从 `tracked_companies` URL 模式自动发现）；`region: 'ru'` 加入区域 dispatcher。公共 API
（`SOURCES`、`SOURCES_BY_REGION`、`RU_CONFIG_KEYS`、`getRegionalSources`）从每个发现的 `meta` 重建，`en` 优先，然后 `ru`，
每个区域内按 label 字母顺序排列 —— 因此下拉框顺序对用户保持稳定。

### 步骤 3 — 接入 dispatcher(仅 RU)

EN ATS 来源自动从 `tracked_companies` URL 模式发现 ——
无需进一步接线。对于 RU 来源，打开
[`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs)，找到
`RU_DISPATCH` 表，并添加一行:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

dispatcher 循环为 `cfg.sources` 中的每个键调用 `entry.search(query, opts)`。无需进一步修改代码。

### 步骤 4 — 测试(mock,严禁真实网络)

在 `tests/sources-<slug>.test.mjs` 下新建文件。测试中**禁止**
真实网络（CI-isolation 契约）:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchExample } from '../server/lib/sources/example.mjs';

test('searchExample normalizes one record', async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({ items: [{ id: 1, title: 'Backend Engineer' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  const out = await searchExample('q', { fetchImpl });
  assert.equal(out.length, 1);
  assert.equal(out[0].source, 'example');
});
```

### 步骤 5 — 在你的 `portals.yml` 中启用

父项目的 `portals.yml` 是用户所有的配置。把新来源的 `configKey` 加到数组里:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob", "example"]
  area: 113
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
```

在浏览器中刷新 `#/scan`。来源筛选下拉框会自动加载新条目（单一事实来源:
[`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs)）。
🌐 扫描按钮在每次区域扫描时都会包含新来源。

### 参考 adapter(新来源请镜像这些)

| adapter 文件 | 类型 | 说明 |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | 标准 RU API adapter;地理感知 UA 回退。 |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | 俄罗斯政府开放数据;无 IP 闸门。 |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML 抓取 | 俄罗斯技术板;基于正则的卡片解析器。 |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML 抓取 | 防御式解析器,解析失败时返回 `[]`。 |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML 抓取 | 与 GetMatch 相同的防御式风格。 |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | 标准 EN ATS adapter;使用 `tracked_companies` URL 模式。 |

### 常见坑

- **忘记导出 `meta`。** 自 v1.69.0 起，`meta` 块是注册来源的**唯一**方式。没有 `meta`（或格式错误）=
  该文件在启动时被静默跳过，并产生一条
  `[sources/registry] <file> has no valid \`export const meta\` — skipped`
  警告，来源永远不会出现在下拉框中。如果全新的 adapter 没有显示，请检查服务器日志。
- **`source` 字段不匹配。** 你的 adapter 写入的字符串必须
  与 `meta.value` 完全一致。一旦漂移,
  `#/scan` 筛选下拉框会显示该来源,但选中它会
  滤掉每一行(因为相等性检查是 `r.source === fs`)。
- **解析失败时抛出异常。** HTML 抓取器在解析不出卡片的
  健康 200 时必须返回 `[]`。抛出异常会破坏多来源
  dispatcher 循环 —— 一个糟糕的 HTML 结构会害死同一查询的
  其他所有来源。
- **遗漏 `fetchImpl` / `signal`。** 没有它们,你的 adapter
  无法在不访问真实网络的情况下做单元测试,客户端
  断连也不会传播(用户关闭标签页后后台
  fetch 仍然存活)。
- **为 RU 信任 `tracked_companies`。** 该列表仅用于 EN ATS
  来源。RU adapter 改为从
  `russian_portals.queries` 自驱动 —— 没有按公司的条目。

---

## 18. 通知(顶栏的 🔔)

> v1.58.34 — 右下角的所有 toast 同时被记录到内存日志(上限 50,溢出删除最旧)。点击顶栏的 🔔 打开右侧 **通知** 抽屉,重新查看错过的消息。日志按标签页/会话存在 — 关闭标签即清空。

抽屉**仅在点击铃铛时打开**(或键盘聚焦 + Enter / Space)。不会自动打开。红色徽章显示自上次打开以来未读条数;打开后清零。

### 类别

| 类别 | 触发条件 | 视觉提示 |
|---|---|---|
| **成功** | `Saved`、`Copied`、`Refreshed`、扫描完成、CV 导入、apply-checklist 操作、个人资料保存 | 左侧绿色边;绿色 toast 背景 |
| **错误** | URL 校验失败、带 `(METHOD /path · HTTP NNN)` 后缀的 API 错误、网络失败、pipeline-400 重复、doctor/verify 非零退出 | 左侧红色边;红色 toast 背景;技术后缀塞入 `详细信息` `<details>`(U-4) |
| **信息 / 进度** | `Running doctor.mjs…`、`Refreshing…`、`Loading…`、扫描进度 | 左侧灰色边 |

每条显示:本地时间、人类可读消息、(若有)`(METHOD /path · HTTP NNN)` 等等技术细节(等宽字体)。

### 不属于通知

- Doctor / verify 结果模态(模态,不是 toast)。
- `#/scan` / `#/auto` 的 SSE 日志行(直接写入页面正文)。
- 不带 toast 的纯 spinner 加载状态。

### 键盘

- 铃铛**点击**或聚焦后 **Enter / Space** → 打开。
- **Esc**、**×**、再次点击铃铛 → 关闭;焦点回到铃铛。


## 19. 将应用本地化为你的语言

界面提供 9 种语言(English、Español、Français、Português、한국어、日本語、Русский、简体中文、繁體中文)。屏幕上的每个文案都来自翻译词典,你无需改动应用逻辑即可新增或修正某种语言。

**翻译文件在哪里。** 自 v1.60.0 起,每种语言都是 `public/js/lib/locales/` 下的独立文件 —— `i18n-dict.en.js`、`i18n-dict.es.js`、`i18n-dict.ru.js` 等 —— 一份简单的 `'键': '文案'` 列表。共享的 `i18n-dict.aliases.js` 让必须保持一致的键(侧栏标签与其页面标题)指向同一条翻译。`i18n-dict.js` 在加载时把它们装配起来,你无需编辑它。

**修正或新增文案。** 打开你语言的文件,找到键(如 `'nav.scan'`)并修改文案。要新增一个标签,把同一个键和译文加入**全部 8 个**语言文件,然后在页面中用 `t('your.key')` 引用。运行 `npm test` —— 若任何语言缺少该键就会失败,因此不会发布半成品翻译。

**新增一种语言。** 把 `i18n-dict.en.js` 复制为 `i18n-dict.<code>.js` 并翻译每个值,然后在 `i18n.js`(语言列表 + 浏览器自动检测)、`i18n-dict.js` 装配器中注册该代码,并在 `index.html` 增加一行 `<script>`。包含测试快照与帮助 / README 配套文件的完整清单见 `docs/LOCALIZATION.md`。

**提示。** 语言切换器在侧栏底部,你的选择按浏览器记忆。服务器诊断信息有意保持英文(让日志保持一致)—— 只有屏幕界面会被翻译。

完整的分步本地化指南请见仓库中的 **`docs/LOCALIZATION.md`**。
