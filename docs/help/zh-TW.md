# 說明 — career-ops-ui

從首次啟動應用程式到拿到面試機會的每個頁面的完整指南。下方每個
`##` 標題對應側邊欄項目或工作流程的一個階段。首次執行請從上到下
閱讀;之後可透過說明側邊欄中的目錄跳轉到特定章節。

> **適用對象:** 剛把這個 UI 放進 `career-ops` checkout 中並執行
> `bash bin/start.sh` 的任何人。不預設你了解 career-ops。

### 關於 career-ops

[career-ops](https://career-ops.org) 是一個開源求職系統,以 slash
指令的形式運作於任何 AI 編碼 CLI 內(Claude Code、Gemini CLI、Codex、Qwen Code、OpenCode、GitHub Copilot CLI — 其他 Claude 相容 CLI 也透過相同的斜線指令介面運作)。模型無關。它以六維 0.0–5.0 評分
量表將每個職缺與你的 CV 進行配對,產生客製化 PDF 履歷,並在本機
追蹤每一次申請。

**正式參考文件**(初次安裝請依序閱讀):

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — 系統、原則與概念清單總覽。
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — 發掘職缺;填入 Pipeline。
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — 完整投遞流程,搭配 Playwright 表單讀取。
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — 透過 `batch-runner.sh` 一次為 10 個以上 JD 評分。
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — 安裝 Chromium 並註冊 MCP,以支援 PDF 與表單填寫。

**核心原則**(出自
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

- **真正的開源** — MIT 授權,無付費方案,無候補名單,無遙測,
  無帳號。整個系統不依賴任何付費階層、帳號或遙測機制運作。所有
  程式碼貢獻皆需通過社群審查才會發行。
- **資料主權** — `cv.md`、`config/profile.yml`、`data/`、
  `reports/`、`interview-prep/` 絕不離開你的筆電,除非你主動推送。
  你在自己的機器本地執行整個系統,完整保有資料主權。
- **AI 不可知架構** — career-ops 並 **不** 內建任何模型。它以指令
  形式運行於既有的 AI 編碼 CLI 內。切換供應商(Anthropic ↔ Gemini
  ↔ OpenAI)時,你的評估歷史依然保持一致。
- **由人類控制投遞** — career-ops 起草答案並開啟表單,但 **由你
  按下 Submit**。系統 **絕不** 自動投遞。系統提供結構與評估,
  最終投遞決策權保留在人類手中。
- **結構化求職** — 為主動、有目的、會大量投遞的求職而設計;
  並非單次投遞工具,也不是推薦引擎。完整設定約需 15 分鐘,且
  假設你熟悉終端機操作。

**career-ops 不是什麼**(明確的非目標):

- 不是自動申請工具。它不會替你送出表單。
- 不是履歷再造器。它依 JD 量身調整內容,但不會無中生有捏造經歷。
- 不是 LinkedIn 個人檔案優化器。你的個人檔案由你自己負責。
- 不是躲在 SaaS 介面後面的試算表替代品。資料就是檔案系統上的
  純文字 markdown。

**重要概念**(完整清單 — career-ops 接觸的所有產物):

| 概念 | 含義 |
|---|---|
| **Mode** | `modes/<slug>.md` 下的提示模板。內建項目:`oferta`、`deep`、`apply`、`pipeline`、`batch`、`contacto`、`followup`、`interview-prep`、`patterns`、`project`、`training`、`ofertas`、`auto-pipeline`、`pdf`、`latex`、`scan`、`tracker`。 |
| **Archetype** | `config/profile.yml` 中的目標角色畫像。評分量表會依目前作用中的 archetype 對技能匹配加權 — **整份設定中最重要的單一欄位**。 |
| **Pipeline** | `data/pipeline.md` — 等待評估的 JD URL 收件匣。 |
| **Tracker** | `data/applications.md` — 所有評估與申請狀態的歷史 GFM 表格。 |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — 每個 JD 的完整 A–F 評估,標頭內含 score 與合法性。 |
| **Scan history** | `data/scan-history.tsv` — 僅追加日誌;防止跨次掃描重複。 |
| **Proof points** | 由 `cv.md` 抽出的 STAR+R 證據區塊,重複用於評估、申請答覆、面試準備。 |
| **JD store** | `jds/jd-<date>-<ts>.txt` — 評估期間原樣保存的職缺描述,供稽核軌跡使用。 |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — 深度研究摘要與面試輪次一頁式重點。 |
| **Batch additions** | `batch/tracker-additions/*.tsv` — `batch-runner.sh` 排隊待合併進追蹤表的列。 |

### career-ops vs career-ops-ui(本應用)

| | career-ops (CLI) | career-ops-ui (本應用) |
|---|---|---|
| 運行位置 | Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI 內 | 瀏覽器中的 `http://127.0.0.1:4317` |
| 介面 | `/career-ops <mode>` slash 指令 | 側邊欄,每個工作流一個頁面 |
| 表單填寫 | 有,經 Playwright MCP | 無 — 產生檢查清單,你在 CLI 完成 |
| PDF | `generate-pdf.mjs` | `📄 Generate PDF`,出現在 `#/cv`、`#/reports/:slug`、`#/evaluate`、`#/deep`、`#/interview-prep` |
| 資料檔案 | 與 career-ops-ui 共用 | 與 career-ops 共用 |

career-ops-ui 是 **純附加** 的工具。`career-ops/` 內部的任何東西
都不會被改動。兩個介面共用同一份 `cv.md`、`config/profile.yml`、
`portals.yml`、`data/`、`reports/`、`interview-prep/`、`modes/`。

### 依 Score 的行動門檻

一旦 JD 有了評估,score 會決定下一步該做什麼(正式表格出自
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

| Score | 下一步 |
|---|---|
| **≥ 4.5** | 執行 `/career-ops apply` — 配對度高,立刻投遞。 |
| **4.0 – 4.4** | 申請,或先用 `/career-ops contacto` 做暖場介紹。 |
| **3.5 – 3.9** | 執行 `/career-ops deep` — 在決定前先研究公司/角色。 |
| **< 3.5** | 除非你有特定的個人理由,否則跳過。 |

career-ops-ui 的 `#/dashboard` 與 `#/tracker` 會把分數達 4.0 以上
的每一列都標亮,讓你不必重跑任何指令就能挑選下一步行動。

### 外部文件

底層 career-ops 引擎的完整參考(掃描、評估量表、批次處理、申請
流程、Playwright 設定)位於
[career-ops.org/docs](https://career-ops.org/docs):

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. 快速上手 — 從「建立 CV」到「已投遞並聯繫」的完整步驟

這是按鈕對按鈕的正式操作手冊。第一次使用請依序執行。每一步都會
指出確切的路由、確切的按鈕,以及成功時你會看到的畫面。第 2–16
節會深入說明每個階段。

> **一條指令完成啟動與初始化。** 在終端機中,你無需開啟介面即可
> 完成整個引導流程:
>
> ```bash
> career-ops-ui setup      # 安裝相依套件 → doctor → 啟動伺服器
> career-ops-ui init       # 選擇 LLM 供應商 + 貼上其金鑰(不回顯)
> career-ops-ui doctor     # 隨時重新驗證(結束碼 0 ⇔ 所有必要項目皆為綠色)
> career-ops-ui run        # 僅在 http://127.0.0.1:4317 啟動伺服器
> career-ops-ui open       # 開啟並將瀏覽器中的儀表板分頁帶到最前
> ```
>
> `setup`/`run` 之後,瀏覽器分頁會自動開啟**並被帶到最
> 前面**(v1.43.0);`career-ops-ui open` 可隨需執行相同動作,
> 因此你再也不必翻找儀表板分頁。`NO_OPEN=1` 可在 headless/CI
> 啟動時停用自動開啟。
>
> `setup` 會自行執行整條鏈路。`init` 透過 `#/config` API 金鑰
> 分頁所用的同一條已驗證路徑,將金鑰寫入父層
> `career-ops/.env`,並設定 `LLM_PROVIDER`
> (`auto` | `claude` | `gemini`),即時的 evaluate / deep / mode /
> 自動流水線路由都會遵循它。CI 形式:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`。
> 比較喜歡用介面?繼續下面的步驟即可。

### A. 環境設定(只做一次,約 5 分鐘)

**career-ops-ui 必須位於 `career-ops/web-ui/`**（嵌套在父專案 career-ops 中）。它透過 `../` 讀取父目錄中的 `cv.md`、`config/` 和 `data/`，無法單獨運行。若 `git pull` 後找不到 `career-ops-ui init`，請執行 `cd career-ops/web-ui && npm install && npx career-ops-ui init`。

**第 1 步 — 在 `http://127.0.0.1:4317` 開啟應用程式。** 若伺服器
未啟動,在終端機從專案根目錄執行 `bash bin/start.sh`。儀表板
(`#/dashboard`)會載入。

**第 2 步 — 點側邊欄的 `❤ Health`。** 每一項必要檢查都必須是綠色:

- `cv.md`、`config/profile.yml`、`portals.yml` 存在
- 已設定 API 金鑰(`ANTHROPIC_API_KEY` / `GEMINI_API_KEY` 至少一個)
- 已安裝 Playwright(僅在你要使用 Generate PDF 時必要)

若任一項為紅色,頁面會明確告訴你要修哪個檔案或環境變數。在
Health 全綠之前不要繼續往下做。

**第 3 步 — 點側邊欄的 `⚒ App settings`。** 你會落在 **API keys
& runtime** 分頁。
- 貼上 `ANTHROPIC_API_KEY`(首選 — 對長文評分品質更好)以及/或
  `GEMINI_API_KEY`。可在 <https://console.anthropic.com/settings/keys>
  或 <https://aistudio.google.com/apikey> 取得金鑰。
- 點 **💾 Save**。接著點 **▶ Test Anthropic**(或 Gemini)— 一次
  極小的往返請求,可以幾乎零成本地確認金鑰已生效。

**第 4 步 — 切換到同一頁的 `Profile` 分頁。** 這是
`config/profile.yml` 的直接 YAML 編輯器。至少要編輯:
- `candidate.full_name` — 將任何佔位字串(如 "Jane Smith")替換成
  你的真實姓名
- `candidate.email`、`linkedin`、`github` — 求職信中會用到
- `target.roles` — 你會去投遞的職稱
- `target.comp_total_min_usd` — 最低總薪資;低於此值的職缺會在
  每份評估的 D 段被標記
- `target.archetypes` — 你接受的職涯模式(影響力最大的單一欄位)

點 **💾 Save**。伺服器會驗證 YAML 並蓋上正式的
`# Career-Ops Profile Configuration` 標頭。

### B. CV(只做一次,約 10 分鐘)

**第 5 步 — 點側邊欄的 `✎ CV`。** 兩欄版面:左邊是編輯器,右邊
是即時預覽。

**第 6 步 — 選一種方式填入編輯器:**
- **上傳既有履歷** — 點 **📁 Upload CV**,挑選任一個
  `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md` 檔案。
  伺服器會透過 pandoc 或 pdftotext 轉成 markdown,做 XSS 淨化,
  並將結果放進編輯器。**請檢查轉換結果** — 尤其是 PDF,版面常會
  失真。
- **直接貼上 markdown** — 文字區是 markdown 編輯器;右側面板就是
  LLM(以及未來的招募人員)會看到的內容。
- **語氣建議:** 一個項目符號 = 一個有量化指標的成就。保持在 1500
  字以內。章節順序:Summary、Experience、Projects、Education、
  Skills。

**第 7 步 — 點 `💾 Save`(CV 頁面右上角)。** 伺服器會做淨化
(剝除 `<script>` / `javascript:` / 行內事件處理器)後寫入 `cv.md`。
吐司提示:*「Saved」*。

**第 8 步(選用)— 點 `📄 Generate PDF`。** 會在父專案執行
`generate-pdf.mjs`(需要 Playwright),完成時 **新的 PDF 會自動
下載** 到瀏覽器。頁面底部的清單會保留每一份先前產生的檔案。

### C. 尋找職缺(每次掃描約 2 分鐘)

**第 9 步 — 點側邊欄的 `🌐 Scan`。** 確認 `portals.yml` 已列出
你關心的職缺板(請參考本說明的第 5 節)。按下 **🌐 Scan now**
按鈕。掃描器在巡訪 Greenhouse / Ashby / Lever / Workable /
SmartRecruiters / Workday(英文板)以及 hh.ru / Habr Career / Trudvsem / GetMatch / GeekJob
(若啟用俄文板)時,即時 SSE 日誌會串流呈現。

**第 10 步 — 掃描結束後檢視結果。** 點任一公司標籤可進行篩選;
點 ↗ 圖示則在新分頁開啟該公司的職涯頁面。每一個通過職稱過濾的
職缺都會排入 Pipeline。

### D. 為職缺評分(每個 JD 約 30 秒)

**第 11 步 — 點側邊欄的 `Pipeline`。** 你會看到掃描器排隊的
所有 URL。點任一項可在行內預覽 JD。

**第 12 步 — 點任一個 JD 旁的 `▶ Evaluate`。** 會跳到 `#/evaluate`。
若已設定 API 金鑰,會直接線上執行;否則會給你一段手動提示供你
貼到自己的 LLM 使用。線上模式會在 A–G 各段(Role / Company /
Compensation / Risk / Stretch / Cultural fit / Verdict)針對你的
CV 給出一個 **0–5 score**。儲存的結果會落到
`reports/<date>-<slug>.md`。

**第 13 步 — 點側邊欄的 `Reports`**,檢視最新的評估報告。任何
低於你 `comp_total_min_usd` 的職缺都會在 D 段被標紅。任何
`Verdict: pursue` 的就是你的候選清單。

### E. 決策並深入研究入圍公司(約 3 分鐘)

**第 14 步 — 挑一個值得追的職缺。點側邊欄的 `Deep research`。**
輸入公司名稱與角色。模型會產生 7 段公司簡報(使命、近期新聞、
技術棧、招聘訊號、薪資基準、風險、建議的切入角度)。儲存的
結果會落到 `interview-prep/<company>-<role>.md`。

### F. 申請(每件申請約 5 分鐘)

**第 15 步 — 點側邊欄的 `Apply checklist`。** 貼上職缺 URL 與
JD。輔助器會生成逐步的投遞檢查清單:
- 客製化的求職信草稿(使用你的 `cv.md` + `profile.yml`)
- 應該鏡射的 JD 關鍵字
- 應該附上的檔案(CV PDF — 見第 8 步)
- 該在哪裡投遞(該公司官方職涯 URL,不是聚合網站的轉址)
- 提醒:**絕對不要自動投遞** — 最終審閱與送出永遠是手動的。

**第 16 步 — 在新分頁打開職涯頁面。** 把申請檢查清單當作你的待辦
清單。透過公司實際的表單投遞。附上你在第 8 步產生的 PDF。

**第 17 步 — 主動聯絡真人。** 開啟 **Outreach** 模式
(側邊欄的 `#/contacto`)。模型會根據第 14 步的公司簡報草擬一則
簡短的 LinkedIn / 電子郵件訊息。請個人化開場白(從你的深度研究
摘要中挑一個具體細節)。發出去。

### G. 追蹤與後續跟進(持續進行)

**第 18 步 — 點側邊欄的 `Tracker`**,為這次申請新增一列:公司、
角色、score、狀態 `Applied`、連到 report 的連結、連到深度研究
摘要的連結。日期會自動填入。

**第 19 步 — 一週後:打開 `Follow-up` 模式**(`#/followup`)。
草擬一封禮貌的關懷信,引用原本的申請內容。寄出。把追蹤表狀態
更新為 `Followed up`。

**第 20 步 — 收到面試邀請時,執行 `Interview prep` 模式**
(`#/interview-prep`)。會針對特定公司 + 階段(系統設計 / 行為 /
程式設計)產生客製化準備內容。自動從深度研究摘要中拉取資料。

**第 21 步 — 拿到 offer 了?把 Tracker 狀態更新為 `Offer`**,
然後回頭看你評估報告的薪資段 — 你的最低可接受數字就在那裡。

### TL;DR — 側邊欄順序就是工作流順序

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

就這樣。21 個按鈕對按鈕的步驟,從零到 offer。

### 一鍵 Auto-pipeline(`#/auto`)—— 21 步捷徑

只想快速為某個職缺評分?跳過手動流程。**側欄 → ✨ Auto-pipeline**(或 Dashboard 的 ✨ 按鈕):貼上 URL,按 **Enter** 或 **▶ 執行完整流程** —— 伺服端一趟可觀察地跑完整條鏈:

1. **驗證 URL** —— SSRF 安全檢查(`isValidJobUrl`)。
2. **擷取 JD** —— `safeGet`(DNS 固定)下載 + 清洗。
3. **對照 CV 評估** —— Anthropic → Gemini → 無 key 則手動 prompt。
4. **儲存報告** —— 寫入 `reports/<slug>.md`(分數 + 可信度)。
5. **加入追蹤器** —— 向 `data/applications.md` 追加一列。

回饋是縱向 **stepper**(有序清單,作用中步驟帶 `aria-current`,螢幕閱讀器即時區域)。完成後卡片深連到報告(**檢視報告 · N/5**)與 **追蹤器**。失敗步驟標紅,按鈕重新啟用,免重新整理即可重試。**無 API key?** 手動模式:3–5 步收合,給出可複製 prompt。可連結:`#/auto?url=<enc>&go=1` 自動開始。
> **CLI(v1.38.0)。** 一條命令完成整鏈:`career-ops-ui setup`。動詞:`career-ops-ui doctor`(env/金鑰/工具檢查 —— 與 Health 同引擎;必需項失敗 exit 1)、`career-ops-ui run`、`career-ops-ui init`(供應商+金鑰精靈,v1.39.0)。


---

## 2. 應用設定與 API 金鑰(`#/config`)

> **v1.55 → v1.56 新功能。** 未設定 LLM 金鑰時,每螢幕的紅色橫幅說明 ⚡ 即時執行處於手動提示模式並連結至此;設定金鑰後變為顯示作用中提供方的低調徽章。每個 ⚡ 即時執行按鈕(`#/auto`、`#/evaluate`、`#/deep`、模式)前顯示誠實的預估費用(如「預估費用:OpenAI gpt-5-codex · ~$0.04/eval」,手動模式則無 API 費用)。`#/scan` 將次要篩選收入**進階篩選**摺疊區;`#/tracker` 新增可點擊漏斗晶片 + 可選伺服器端分頁;`#/pipeline` 超過 1000 列時虛擬化。

兩個分頁:

1. **API keys & runtime** — 從瀏覽器編輯父專案的 `.env`(就是
   career-ops 的 Node 腳本啟動時讀取的同一份檔案)。此分頁也提供
   按供應方的模型選擇器 —— 在 `ANTHROPIC_MODEL`、`GEMINI_MODEL`
   旁新增 `OPENAI_MODEL`(OpenAI/Codex)。
2. **Profile** — `config/profile.yml` 的直接 YAML 編輯器。儲存
   時會蓋上正式的 `# Career-Ops Profile Configuration` 標頭。

任一分頁儲存後皆立即生效 — 無需重啟伺服器。

**設定你的 LLM 供應方(逐步)。** web UI 的 ⚡ 即時評估以*無頭*方式執行,使用一個 API 金鑰。它透過 "OR" 運作 —— 設定其中**任意一個**即可正常運作;設定多個時,`auto` 按此順序優先:Anthropic → Gemini → OpenAI → Qwen。(career-ops 本身是 CLI 無關的 —— 你也可以在 Claude Code、Codex、Gemini、OpenCode、Qwen、Copilot 或 Kimi 內執行它;那與此無頭金鑰無關。)

1. 開啟 `#/config` → **API keys & runtime** 分頁。
2. 在 **`LLM_PROVIDER`** 中選擇你的供應方:`auto`(使用已設定的金鑰),或用 `claude` / `gemini` / `openai` / `qwen` 強制指定一個。
3. 填寫你所選供應方的金鑰 + 模型:
   - **Anthropic** —— 設定 `ANTHROPIC_API_KEY`(console.anthropic.com),選擇性 `ANTHROPIC_MODEL`(預設 `claude-sonnet-4-6`)。
   - **Gemini** —— 設定 `GEMINI_API_KEY`(aistudio.google.com/apikey),選擇性 `GEMINI_MODEL`(預設 `gemini-2.0-flash`)。
   - **OpenAI** —— 設定 `OPENAI_API_KEY`(platform.openai.com),選擇性 `OPENAI_MODEL`(預設 `gpt-5-codex`)。
   - **Qwen** —— 設定 `QWEN_API_KEY`(阿里雲百鍊 / DashScope,dashscope.console.aliyun.com),選擇性 `QWEN_MODEL`(預設 `qwen-max`)。中國大陸端點請在 raw `.env` 中設定 `QWEN_BASE_URL`。
4. 點擊 **Save**。金鑰寫入父專案的 `.env`;變更立即生效 —— 無需重啟伺服器。
5. 在 `#/evaluate` 上驗證:貼上一個職缺 URL/描述並按 **⚡ Run live**。結果標頭會顯示執行了哪個供應方(`anthropic` / `gemini` / `openai` / `qwen`)。任何地方都未設定金鑰 → 則得到複製貼上的手動 prompt。

密鑰在儲存後被遮罩且從不記錄。模型 id 欄位(`*_MODEL`)不是機密。

### Profile 分頁

> **v1.32.0 —— 逐欄位表單。** Profile 分頁不再是原始 YAML 文字框,而是帶 **候選人 / 敘述 / 薪酬** 可折疊分區的表單。儲存時僅送出建模的 14 個純量路徑;伺服端**合併**進 `config/profile.yml`,因此 `archetypes`、`proof_points` 與自訂鍵**原樣保留**。權衡:逐欄位儲存會重新序列化 YAML 並**遺失 `#` 註解** —— 如需保留或編輯巢狀陣列,請用分頁底部的 **Advanced: edit raw YAML** 折疊區。
> **v1.35.0 —— 陣列編輯器。** 為 **Target roles**、**Superpowers**(字串清單)、**Archetypes**(name/level/fit)、**Proof points**(name/url/hero-metric)新增增刪列編輯器。相同的 merge-not-replace 保證;清空清單會乾淨地移除該鍵。
> **v1.54.3 —— Modes 分頁結構化表單。** `modes/_profile.md` 不再是按區塊的原始 markdown 編輯器,而是從已文件化的 schema 衍生的欄位表單。清單型區塊 —— **Target Roles / Adaptive Framing / Comp Targets** —— 渲染為可重複的逐列輸入(增刪列);散文區塊 —— **Exit Narrative / Location Policy** —— 渲染為帶標籤的 textarea;任何未知或非清單區塊回退為帶標籤的逐字 textarea。儲存**仍按區塊合併** —— 前言、未更動區塊與自訂區塊按位元組保留。*Advanced: raw markdown* 折疊區保留,用於整檔編輯:增刪區塊或編輯前言。
> **供應方(v1.39.0)。** API-keys 分頁新增 `LLM_PROVIDER` 選擇(`auto`=Anthropic→Gemini · `claude` · `gemini`)與 `OPENAI_API_KEY` 欄位(Codex/OpenCode CLI 端)。`career-ops-ui init` 為互動精靈。
>
> **供應方(v1.57.0）。** 無頭即時評估現涵蓋 **Anthropic → Gemini → OpenAI → Qwen → OpenRouter**（`auto` 順序；`LLM_PROVIDER` 固定其一）。**OpenRouter** —— 一個 `OPENROUTER_API_KEY` 即接入 300+ 模型；`OPENROUTER_MODEL` 下拉從 OpenRouter 即時目錄載入（伺服器端代理，離線時精選回退）。另修復：帶換行/空白貼上的 key 在驗證前被修剪，`/#/config` 不再對任何供應方顯示「validation failed」。





- 文字區會原樣顯示目前的 `config/profile.yml`。
- 編輯完點 **💾 Save**。伺服器會驗證 YAML(必須是 mapping、必須
  包含 `candidate`)後寫入檔案。
- 若缺少 `# Career-Ops Profile Configuration` 標頭,會自動補上。
- `#/profile` 的唯讀摘要是它的視覺輔助頁。

### 已知金鑰

| Key | 作用 | 取得方式 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 啟用 Anthropic SDK 即時呼叫。同時設定 Anthropic 與 Gemini 時為首選 — JD 評分與深度研究的長文結構化輸出更好。 | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | 覆寫預設的 `claude-sonnet-4-6`。需要更強推理可試 `claude-opus-4-7`;追求便宜快用 `claude-haiku-4-5-20251001`。 | — |
| `GEMINI_API_KEY` | 沒有 Anthropic 金鑰時的備援。`gemini-eval.mjs` 在 `oferta` 模式下會用到。低流量下免費額度即可。 | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | 覆寫預設的 Gemini 模型。 | — |
| `(伺服器使用預設 UA)` | 在俄羅斯境外執行 `hh.ru` 掃描時必要(該 API 對普通 User-Agent 會回 403)。在 <https://dev.hh.ru/admin> 註冊一個應用程式並使用其 UA 字串。 | dev.hh.ru |
| `PORT` | Express 綁定的連接埠。預設 4317。 | — |
| `HOST` | 綁定位址。預設 `127.0.0.1`。設為 `0.0.0.0` 會把 UI 暴露在區域網路上 — **目前沒有驗證閘**,參閱 Production-readiness 文件。 | — |

### 行為

- **讀取**(`GET /api/config`)會回傳每一個已知金鑰。機密金鑰
  (`ANTHROPIC_API_KEY`、`GEMINI_API_KEY`)會被 **遮罩** — 你看到的
  是 `sk-ant•••••••a1b2`,永遠看不到完整值。
- **儲存**(`POST /api/config`)會驗證每個值,寫入 `<parent>/.env`,
  並立即套用到正在執行的程序。無需重啟。
- **空值會刪除** 該金鑰。當你想停用某個俄羅斯 IP / VPN 時很有用。

### 煙霧測試按鈕

儲存後點 **▶ Test Anthropic** 或 **▶ Test Gemini** — 兩者皆會送出
極小的提示(輸出 ≤256 tokens),所以在確認金鑰正確連接的同時幾乎
不會花錢。成功時會回傳大約 200 字元的樣本。

---

## 3. 個人資料(`#/profile`,也可由 `#/settings` 到達)

`config/profile.yml` 的唯讀摘要卡片視圖。**要編輯** 請去
**App settings → Profile 分頁**(`#/config` → Profile)。儲存後
寫入同一個檔案;此頁會在重新載入時重新解析。

最關鍵的欄位:

- `candidate.full_name` — 每個提示都會用到。**在真正掃描任何
  職缺之前,務必把樣板的 `Jane Smith` 替換掉**,否則你產生的
  求職信會以佔位姓名寄出去。
- `candidate.email`、`linkedin`、`github` — 求職信生成與申請
  檢查清單都會引用。
- `target.roles` — 你能接受的職稱。掃描器的正向過濾隱含使用此
  欄位(透過 `portals.yml::title_filter`)。
- `target.comp_total_min_usd` — 最低總薪資。每份評估的 D 段會
  標記低於此值的職缺。
- `target.archetypes` — *最重要的欄位*。這些是你能接受的職涯
  模式(例如 `Tech-Lead-Backend`、`Founding-Engineer`、
  `Data-Platform`)。每個 JD 都會跟它們比對,最佳匹配的 archetype
  會出現在報告標頭。

Health 頁面有一項 **Profile customized** 檢查,只要
`full_name` 還是已知的佔位姓名就會失敗。

---

## 4. 履歷(`#/cv`)

每次評估、深度研究、求職信的唯一真實來源。檔案位於父專案根目錄
的 `cv.md`。

### 編輯選項

- **直接貼上** — 左邊的文字區是 markdown 編輯器。右側面板會鏡射
  LLM(以及未來的招募人員)會看到的樣子。
- **📁 Upload CV** — 挑選任一以下格式的本機檔案,伺服器會替你
  轉成 markdown:
  - **純文字格式** — `.md`、`.markdown`、`.txt`、`.html`、`.htm`
    直接傳遞(HTML 經 pandoc → GFM markdown)。
  - **Office 格式** — `.docx`、`.doc`、`.odt`、`.rtf` 透過
    **pandoc** 轉換(macOS 上 `brew install pandoc`,Linux 上
    `apt install pandoc`)。
  - **PDF** — `.pdf` 透過 Poppler 的 **pdftotext** 抽取
    (`brew install poppler` / `apt install poppler-utils`)。
  - 轉換後的 markdown 會落到編輯器;點 **💾 Save** 即可持久化。
    結果經過淨化(與貼上時相同的 XSS 剝除)。
  - 硬上限:每次上傳 **10 MB**。超過會回 413。
- **從 LinkedIn** — 最簡單的方式:在父專案開啟 Claude Code,
  執行 `/career-ops`,貼上你的 LinkedIn URL,然後請它
  `extract my CV from this and write it to cv.md`。

### 哪些內容會被淨化

伺服器端,每個 PUT `/api/cv` 都會經過 `stripDangerousMarkdown`:

- `<script>`、`<iframe>`、`<object>`、`<embed>`、`<svg>`、
  `<style>`、`<form>` 標籤 — 完全移除。
- 行內事件處理器(`onclick=`、`onerror=` 等)— 剝除。
- `javascript:`、`vbscript:`、`data:text/html` URI 協定 — 失效化。

只要上述任何一項被移除,回應就會包含 `sanitized: true`,讓你知道
原始來源中是否有可疑內容。

請求主體上限:1 MB。超過會回 413。

### 其他按鈕

- **sync-check** — 在父專案執行 `cv-sync-check.mjs`。標記不一致
  (CV 中列出但不在 `data/applications.md` archetypes 中的專案等)。
- **📄 Generate PDF** — 串流執行 `generate-pdf.mjs`。輸出落在
  `output/*.pdf`。需要 Playwright(Health 頁面顯示父專案的
  `node_modules` 中是否已安裝)。產生完成時,**最新的** PDF
  會自動下載到你預設的 Downloads 資料夾;頁面上的清單會保留
  每一份先前產生的檔案。

### 語氣 / 格式建議

- 一個項目符號 = 一個有量化指標的成就。對任何評估量表來說,
  *「將 p99 延遲降低 38%」* 都優於 *「改善了效能」*。
- 章節順序如下:**Summary**(3–5 行)、**Experience**(倒敘
  時間順序)、**Projects**(最多 5 個)、**Education**、
  **Skills**(去重,不要塞滿時髦詞)。
- 控制在 1500 字以內。評分量表使用的是高密度資訊;冗長雜亂的
  CV 會因為雜訊被扣分。

---

## 5. 招聘版面與來源(`portals.yml`)

掃描器設定檔位於父專案根目錄的 `portals.yml`。三個區塊很重要。
SPA 的三個區塊(下方)與
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
中 career-ops.org 的正式 schema 一一對應。

> **捷徑:** `#/portals` URL 現在會直接解析到 **App settings**,
> 並且(在已設定區域來源時)跳轉到 **Regional sources** 群組 —
> 因此書籤或手動輸入的 `#/portals` 連結不再回傳 404(v1.42.0)。

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

被掃描的職缺,當其職稱包含 **至少一個 positive** 關鍵字 **且**
**不含任何 negative** 關鍵字時就會通過。兩個都要調整。關鍵字皆為
大小寫不敏感的子字串。

`seniority_boost` 是第三個 title-filter 鍵。這裡列出的關鍵字不會
過濾掉任何東西 — 它會把符合的職缺在結果中往上推,讓「Senior
Backend Engineer」排在「Engineer」之前。預設值:
`["Senior", "Staff", "Lead"]`。調整以符合你目標角色的命名方式。

一開始用 3–5 個 positive 關鍵字以保持清晰;之後再擴展。

**`content_filter`(可選 —— web-ui 1.75.0,parent #974)。** 與 `location_filter`
平級的頂層鍵,擁有相同的 `positive` / `negative` 關鍵字清單,但比對的是職缺的
**描述 / 摘要** 文字,而非其地點:

```yaml
content_filter:
  positive: ["python", "machine learning"]
  negative: ["security clearance", "on-site only"]
```

語義與 `location_filter` 完全一致:無該鍵 → 全部通過;描述 **為空 / 缺失** 的
職缺通過(缺失資料不受懲罰);`negative` 命中 → 拒絕;`positive` 為空 → 通過;
`positive` 非空 → 必須命中至少一個關鍵字(不分大小寫的子字串)。ATS 掃描與
區域掃描皆會套用。只有攜帶描述 / 摘要的來源(如 RSS)會受影響 —— 其餘職缺
一律通過 —— 因此啟用它絕不會悄悄丟棄不帶內文的來源的列。可用它丟棄標題已
通過、但內文暴露出決定性硬傷的職缺。

### `location_filter`(可選 —— web-ui 1.33.0,parent #570)

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

依職缺**地點**字串(不分大小寫的子字串)過濾掃描結果,ATS 掃描與區域掃描皆生效。語義與正規的 career-ops `scan.mjs` 完全一致:

- 無 `location_filter` → 所有地點通過(預設)。
- 地點為空/缺失 → 通過(缺失資料不懲罰)。
- 命中 `block` → **拒絕**(block 優先於 allow)。
- `allow` 為空 → 通過(block 已過濾)。
- `allow` 非空 → 必須符合**至少一個**關鍵字。

`portals.yml` 頂層鍵(與 `title_filter` 平級,不巢狀於 `russian_portals` 下)。

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

`search_queries` 驅動 AI 動力的 Option B 掃描(在 Claude Code /
Codex 內執行 `/career-ops scan`)。它們 **不會** 被行內的
`npm run scan` 執行(後者僅打公開職缺板 API)。當你想要在尚未
進入 `tracked_companies` 的公司發掘角色時才用。設 `enabled: false`
可保留條目但不執行。

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

每個條目必填欄位:`name` 與 `careers_url`。選填:`api`
(明確的 Greenhouse / Ashby / Lever / Workable / SmartRecruiters /
Workday 端點)、`enabled: true|false` 可在不刪除條目的情況下
包含/排除。ATS 掃描器會從 URL 樣式偵測 ATS
(`job-boards.greenhouse.io/<slug>` → Greenhouse 等),並直接取得每家
公司公開的 boards-api。無法辨識 ATS 的公司會被略過(`/#/scan`
上的 **Active Companies** 卡片會以灰色 `○` 顯示它們)。

### `rss` (RSS / Atom boards)

```yaml
tracked_companies:
  - { name: LaraJobs, enabled: true, provider: rss, rss: https://larajobs.com/feed }
  - { name: WeWorkRemotely, enabled: true, provider: rss, rss: https://weworkremotely.com/remote-jobs.rss }
```

只需在 `portals.yml` 中加入一筆帶 `provider: rss` 與 `rss:`(或 `feed_url:`)鍵的項目,即可讓掃描器對接任何發佈 RSS/Atom 來源的徵才看板(LaraJobs、WeWorkRemotely、RemoteOK、golangprojects 等)—— **無需改動程式碼**。RSS 轉接器解析每個 `<item>`(CDATA + HTML 實體,標題/公司名去除標籤),將其正規化為職缺,並執行與 ATS 來源相同的 `title_filter` / `location_filter` + 去重 + 附加到 pipeline 的流程。隨後 **RSS** 會作為可選來源出現在 `#/scan` 的篩選下拉選單中。(web-ui v1.62.x)


### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # 或只填一個
  area: 113                 # 1=莫斯科, 2=聖彼得堡, 113=俄羅斯, 1001=remote
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries` 是大小寫不敏感的子字串比對,對應到 hh.ru 與 Habr Career
上的職缺標題。**注意與 negative 列表的重疊** — 若 `queries` 中有
`"Senior PHP"`,但 `title_filter.negative` 中又出現 `"php"`,
掃描會回傳零結果,主控台會警告你這個衝突。


### 設定俄文入口網站 — 詳細設定指南

v1.29.0 內建 5 個俄文 adapter。兩個無需預設 UA 以外的額外設定(`habr-career` HTML 抓取;`trudvsem` 政府開放資料 API — 無 key、無地理閘)。兩個是科技板塊的 HTML 抓取(`getmatch`、`geekjob` — 同樣無 key)。一個是 hh.ru 標準 API,從非俄羅斯 IP 可能回傳 403,除非透過 **App settings → API keys & runtime** 設定 `HH_USER_AGENT` 環境變數(或從俄羅斯 IP / VPN 執行)。

#### 來源清單

| 鍵 | 顯示名稱 | 類型 | 驗證 | 地理限制 |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | 可選 `HH_USER_AGENT` | 非俄 IP 可能 403 |
| `habr` | Habr Career | HTML | 無 | 無 |
| `trudvsem` | Trudvsem | JSON API(開放資料) | 無 | 無 |
| `getmatch` | GetMatch | HTML | 無 | 無 |
| `geekjob` | GeekJob | HTML | 無 | 無 |

#### 步驟 1 — 開啟 `portals.yml`

該檔案位於父專案 `career-ops/` 根目錄(不在 `web-ui/` 內)。若尚未存在,請從父專案複製範本:

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### 步驟 2 — 啟用 5 個來源

新增或更新 `russian_portals` 區塊,列出你想掃描的所有來源。陣列順序無關緊要 — 掃描器按 registry 順序呼叫。

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

#### 步驟 3 — 調整查詢與篩選

`queries` 是掃描器在每個來源中用來搜尋的字串。每個查詢會在每個來源上執行一次 — 4 個查詢 × 5 個來源 = 每次掃描 20 次呼叫。為了讓掃描在一分鐘內完成,保持列表聚焦(3–7 個查詢)。`area` 是 hh.ru 的地區代碼(其他來源會忽略)。`per_page` 限制每個來源每個查詢回傳的職位數。`only_remote: true` 在 adapter 層級過濾為遠端(結果表中仍有獨立的 Remote 篩選)。

#### 常見陷阱

**負面列表衝突。** 如果查詢中的字(`"php"`、`"senior"`)也出現在 `title_filter.negative` 中,所有結果會在你看到之前被篩掉。掃描器會在掃描時輸出 stderr 警告 — 尋找 `⚠ config: query "Senior PHP" contains "php" which is in the negative list` 這列。修復方式是從 `negative` 中移除衝突字:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### 臨時停用某個來源

要停用某個來源而不刪除其資料,只需從 `sources` 陣列中移除其鍵即可:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### 驗證設定

儲存 `portals.yml` 之後:

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

### CLI bootstrap 流程([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

career-ops 的正式設定流程(從父專案根目錄執行一次):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

整個 bootstrap 就這樣。編輯三個區塊
(`title_filter`、`tracked_companies`、`search_queries`,
選填 `russian_portals`),儲存,你就準備好可以掃描了。

### SPA bootstrap 行為

首次啟動時,若 `portals.yml` 缺少 `russian_portals:` 區塊,
伺服器會附加一段有文件註解的 `russian_portals:` 區塊 — 此操作具
冪等性(第二次啟動為 no-op,因為 `russian_portals:` 那行已經存在)。
英文區塊 **不會** 被自動注入;它們來自你按上面正式 bootstrap 複製
過去的 `templates/portals.example.yml`。

---

## 6. 健康(`#/health`)

所有設定關卡,以 OK / OPTIONAL / FAIL 徽章呈現。在提交任何
「不能用」issue 之前請先讀這頁。

### 必要檢查(沒有就無法運作)

- `Node version` ≥ 18 — 伺服器使用原生 `fetch` 與 `node:test`。
- `Project root` — `CAREER_OPS_ROOT`(env 或自動偵測)指向的目錄
  存在。
- `cv.md`、`config/profile.yml`、`portals.yml`、
  `data/applications.md`、`data/pipeline.md`、`modes/oferta.md`。

### 選用檢查(僅警告)

- `Profile customized` — `candidate.full_name` 不再是模板佔位
  名稱。
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — 已在 `.env` 中設定。
- `(伺服器使用預設 UA)` — 只有在俄羅斯境外掃描 hh.ru 才會在意。
- `Playwright (parent node_modules)` — PDF 生成與
  `check-liveness.mjs` 需要。安裝指令:
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`。
- `Parent project dependencies` — 缺失時執行
  `cd $CAREER_OPS_ROOT && npm install`。
- `data/`、`reports/`、`output/`、`jds/` 目錄 — 第一次寫入時自動
  建立。

當伺服器暴露到 loopback 之外(`HOST=0.0.0.0`)時,回應中的絕對
路徑與確切 Node 版本會被替換成 `"hidden"`,以免好奇的鄰居能辨識
你的安裝指紋。

### 執行按鈕

- **▶ Doctor** 執行 `node doctor.mjs` 並在 modal 中顯示輸出。
- **▶ Verify pipeline** 執行 `node verify-pipeline.mjs`。

---

## 7. 搜尋(`#/scan`)

掃描器會爬遍每個啟用的職缺板,與你的歷史去重,並把命中寫入
`data/last-scan.json` 與 `data/pipeline.md`。

### 一鍵掃描(SPA)

**🌐 Scan** 會在單次掃描中執行每個啟用來源:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
  (ATS 大掃描)針對 `tracked_companies` 中每家能辨識 ATS URL 的
  公司。
- v1.75.0 聚合器,針對每個選擇啟用其一的 `tracked_companies` 條目:RemoteOK / Remotive / Working Nomads(全板塊遠端訂閱源,`provider: <slug>`)以及 IBM / Arbeitsagentur / Glints / Jobstreet · SEEK(設定驅動,每條目一個 `<provider>:` 區塊)。
- hh.ru API + Habr Career + Trudvsem + GetMatch + GeekJob,針對 `russian_portals` 中的每個
  query。

**一鍵兩階段(v1.29.2)。** 唯一的 🌐 Scan 按鈕在單一 SSE 串流中同時驅動 ATS 與區域兩次掃描。日誌會按順序出現兩個階段標題:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — EN ATS 板塊。
2. `▶ Regional scan (hh.ru + Habr Career)` — 來自 registry 的 5 個 RU 來源。

每階段以 `✓ done · NEW=N` 摘要結束。若只看到 ATS 階段,代表 stand 仍是 v1.29.2 之前的版本 — 請升級。v1.29.2 之前,SSE 客戶端在第一個 `done` 就關閉了,區域階段會被靜默丟棄。

掃描執行期間,即時 SSE 日誌會串流到右側面板。點 **Stop**(或直接
切換頁面)即可中止 — 伺服器會透過 `AbortController` 取消執行中的
HTTPS 請求。

### 結果篩選

日誌下方的結果表格會渲染 `data/last-scan.json` 的列。

篩選器:

- **自由文字** — 對職稱 / 公司做子字串比對。
- **Source** 下拉 — Arbeitsagentur / Ashby / GeekJob / Glints / Greenhouse / GetMatch / Habr Career / hh.ru / IBM / Jobstreet · SEEK / Lever / RemoteOK / Remotive / RSS / SmartRecruiters / Trudvsem / Workable / Workday / Working Nomads(從 `GET /api/scan/sources` 自動填入)。
- **Remote / Hybrid / Onsite** 下拉。
- **Stack chips**(PHP / Go / Backend / Senior / …)— 由
  `Skills.detectTech` 與 `Skills.detectLevel` 自動偵測每一列。
  多選為交集 — 選 `PHP + Senior` 只會顯示同時具備兩者的列。
- **動態 chips** 位於靜態 stack 那組下方 — 來自職稱的前 25 個最
  常見大寫詞,讓 UI 能依你實際掃描的角色(行銷、設計、財務…)
  自我調整,而不會被鎖在後端工程師的詞彙裡。

### Active Companies 卡片

一張可摺疊的卡片,列出 `portals.yml` 中每家公司及其掃描狀態:

- ✓ 綠色標籤 — 直接支援 API(Greenhouse / Ashby / Lever /
  Workable / SmartRecruiters / Workday)。
- ○ 灰色標籤 — 退回到網頁搜尋提示(無 API 匹配)。

**點公司名稱** → 把該名稱填入上方的結果篩選器。**點 ↗ 圖示** →
在新分頁開啟該公司的 `careers_url`。

### CLI 掃描流程([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

從 CLI 端有兩種掃描方式(兩者都會把 URL 放進 SPA 讀取的同一個
`data/pipeline.md`):

**Option A — 直接腳本(約 30 秒,零 AI tokens):**

```bash
npm run scan                          # 所有 Greenhouse/Ashby/Lever 板
npm run scan -- --dry-run             # 預覽但不持久化
npm run scan -- --company Anthropic   # 收斂到單一追蹤公司
```

只支援 Greenhouse / Ashby / Lever / Workable / SmartRecruiters /
Workday(可辨識的 ATS URL)。不消耗 AI tokens — 直接打公開的
boards API。

**Option B — AI 動力的瀏覽器掃描:**

```
/career-ops scan
```

在 Claude Code / Codex / Cursor / Gemini CLI 中執行。會用到模型
tokens。直接造訪每個 `tracked_companies` 頁面,並能發掘非 API
的職缺板(職涯頁面、客製化 ATS、區域入口)。較慢但範圍更廣。
當 ATS 大掃描對你知道正在招人的目標公司毫無收穫時非常有用。

**輸出(兩種路徑共通)** — 新的 JD URL 會附加到
`data/pipeline.md`,每個造訪過的 URL 都記錄到
`data/scan-history.tsv`(跨所有未來掃描去重),並列印摘要:掃描
的公司數 · 找到的職缺數 · 因職稱被過濾掉的數 · 跳過的重複數 ·
新增的職缺數。

**依 Score 的行動門檻**(在 `/career-ops pipeline` 為新 URL 進行
批次評分後套用):

| Score | 建議的下一步 |
|---|---|
| **≥ 4.5** | `/career-ops apply` — 配對度高,立刻投遞 |
| **4.0 – 4.4** | 申請,或 `/career-ops contacto` 做暖場介紹 |
| **3.5 – 3.9** | `/career-ops deep` — 先做研究 |
| **< 3.5** | 除非你有特定的個人理由,否則跳過 |

SPA 的 `#/dashboard` 與 `#/tracker` 會標亮每一列 score ≥ 4.0
的條目,讓你不必重跑任何指令就能挑選行動。

### 後續指令

評分完成後,正式的後續流程是:

- `/career-ops apply` — 以客製化答案填寫申請
- `/career-ops contacto` — 起草 LinkedIn / 電子郵件外聯
- `/career-ops deep` — 深入研究公司 / 角色
- `/career-ops tracker` — 檢視 pipeline 狀態

---
### hh.ru — 從網站抓取（無需設定與代理）

hh.ru 透過讀取其公開搜尋網站（`hh.ru/search/vacancy`）來掃描，與 Habr Career 相同：**任何 IP 皆可用，無需金鑰、代理或設定。** 刻意*不*使用 JSON API（`api.hh.ru`）：它現在無論 IP 或 User-Agent 都會對所有程式化用戶端回傳 `403 forbidden`（這是邊緣反爬封鎖，而非文件化的 API 錯誤），而網站會向任何類瀏覽器用戶端回傳完整結果。因此 hh.ru 與 Habr、Trudvsem 完全一樣——只需在 `russian_portals.sources` 中保留並掃描即可。

## 8. 流水線(`#/pipeline`)

等待評估的 URL 收件匣。位於 `data/pipeline.md`。

### 加入 URL

三種方式:

- 在輸入欄輸入/貼上 URL,點 **+ Add**。
- 按 **Ctrl+K**(或 **Cmd+K**)聚焦全域搜尋,貼上任一
  `http(s)://…` 連結,按 **Enter** — URL 立刻進 pipeline。
- 執行 Scan(見上節)— 新命中會自動進入 pipeline。

每個 URL 都會在伺服器端通過 `isValidJobUrl()`。loopback
(`localhost`、`127.0.0.1`)、`file://`、`javascript:`、IP 字面值、
含模板字元(`<`、`>`、`"`)的字串全部會被擋下回 400。

### 伺服器端預覽面板

點任一 pipeline 列即可在右側載入預覽。多數 ATS 職缺板不傳送 CORS
標頭,瀏覽器無法直接取得;伺服器會代理該請求,剝除 `<script>` /
`<style>` / HTML 標籤,並回傳最多 8 KB 的純文字。

預覽代理會手動跟隨轉址,並做 **逐跳 SSRF 驗證** — 每個
`Location` 標頭都會再經過 `isValidJobUrl()`,所以惡意的職缺板無法
把你彈到 loopback / 私有 IP / `file://`。最多跟 3 跳,逾時 15 秒。

### 列上動作

- **▶** — 跳到 `#/evaluate?url=…`,URL 已預填。
- **✕** — 從 `data/pipeline.md` 移除該 URL。

### 右上按鈕

- **⚡ Evaluate first** — 在 Evaluate 頁面開啟第一個排隊的 URL,
  準備評分。
- **Scan** — 回到掃描器,如果你想取得更多 URL。

---

## 9. 評估(`#/evaluate`)

針對單一職缺描述,以 `cv.md` 與 `config/profile.yml` 作為依據
進行評分。回傳按 `modes/oferta.md` 結構化的 A–F 評估與 0–5 score。

### 輸入

把 JD 貼到文字區,或從 `#/pipeline` 帶著 `?url=<href>` 過來 —
頁面會透過與 pipeline 預覽相同的 SSRF 安全代理取得 URL,並預填
文字區。

點 **💾 Save JD** 可把 JD 持久化到 `jds/jd-<date>-<ts>.txt`
作為稽核軌跡(或在 API 呼叫中傳 `save: true` — 同樣效果)。

### Fallback 鏈

1. **Anthropic** — 設定 `ANTHROPIC_API_KEY` 時為首選。伺服器會
   把 `cv.md`、`config/profile.yml`、`modes/_shared.md`、
   `modes/oferta.md` 打包進 `<project_context>` 區塊再放到提示前
   (每個檔案限制 16 KB,完整提示軟上限 200 KB)。直接回傳有
   依據的 markdown 到頁面。
2. **Gemini** — 只有設定 `GEMINI_API_KEY` 時。伺服器會 spawn
   `gemini-eval.mjs`,把 JD 當作暫存檔傳入。免費模型
   (`gemini-2.0-flash`)對例行評分綽綽有餘。
3. **手動** — 完全沒有金鑰。頁面會給你一段完整成形的提示,你可以
   貼到 Claude Code、ChatGPT 或任何其他 LLM。

### 輸出段落(正式 career-ops.org A–F)

> **v1.15.0 重新對齊。** 區塊字母現在對應到
> [正式 career-ops.org schema](https://career-ops.org/docs)。
> v1.15 之前的報告用 A–G(`C=Risks`、`F=Verdict`、`G=Legitimacy`);
> 我們仍會原樣呈現以維持向後相容,但新報告會以下面的正式語意
> 輸出 A–F。Score 與 Legitimacy 現在改寫在報告標頭
> (`score: 4.2/5`、`legitimacy: High|Medium|Low`)。

A. **Role Summary** — 3 個項目符號的摘要(風險直接在行內標出)。
B. **CV Match** — 命中的前 3 個技能 + 缺少的前 3 個。
C. **Strategy** — 建議:立刻申請 / 先 contacto / 先 deep / 跳過。
v1.15 之前叫 `Risks`。
D. **Compensation** — 相對於你的
`target.comp_total_min_usd`(legacy)或 `compensation.target_range`
(正式)。
E. **Personalization** — 應該主打的角度、依 archetype 的框架、
求職信 / 外聯中應提到的鉤子。v1.15 之前叫 `Application
Strategy`。
F. **STAR stories** — 1–3 段可直接貼上的 S-T-A-R 區塊,針對該
角色客製。v1.15 之前叫 `Verdict`(原始 score);score 現在會
與 `legitimacy` 一起出現在報告標頭。

### 儲存報告

點 **💾 Save report**(或在 API 呼叫中使用 save 切換)把 markdown
持久化到 `reports/<date>-<company>-<role>.md`。報告解析出的標頭
(Score / Legitimacy / URL)會出現在 **Reports** 頁面和
**Dashboard**。

### 有 10 個以上 JD 時用批次評估

對單一 JD,`#/evaluate` 頁面是正確的工具。當 pipeline 排隊有 10
個以上 URL 時,逐一點擊就不切實際 — 請跳到第 14 節的 **Batch
evaluate** 子節(在父專案執行 `./batch/batch-runner.sh`),讓它
整夜跑,然後回到 `#/reports` / `#/tracker` 看結果。完整流程:
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)。

---

## 10. 報告(`#/reports`)

瀏覽每份儲存的評估。卡片顯示標題、日期、合法性旗標、score
(顏色編碼:綠 ≥ 4.0,黃 ≥ 3.0,紅低於)。

點卡片即可閱讀完整 markdown。分頁:每頁 12 份;控制項位於底部。

單份報告檢視也有:

- **← All reports** — 回到網格。
- **🔗 Open JD** — 在新分頁開啟原始職缺貼文。

---

## 11. 追蹤器(`#/tracker`)

CRM。每件申請一列;存於 `data/applications.md` 作為
GitHub-Flavored Markdown 表格。

### 狀態流轉

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Rejected` / `Discarded` / `SKIP`。

狀態白名單由伺服器端強制執行;`POST /api/tracker` 傳入其他值
會預設為 `Evaluated`。當你在 `/career-ops apply` 結尾確認
`Submitted.` 時(見第 14 節),`Evaluated → Applied` 的正式轉換
會自動發生。

### 欄位版面

| 欄位 | 含義 |
|---|---|
| `#` | 自動編號,前導補零(`001`、`002`、…)。 |
| `Date` | ISO 日期(`YYYY-MM-DD`)。預設今天。 |
| `Company` | 自由文字。**豎線(`\|`)與換行會被自動跳脫。** |
| `Role` | 同上。 |
| `Score` | `N/5` 格式(例如 `4.2/5`)。 |
| `Status` | 白名單列舉。 |
| `PDF` | 該列 `generate-pdf.mjs` 成功後變 ✅。 |
| `Report` | 連到對應 `reports/*.md` 的 markdown 連結。 |
| `Notes` | 自由文字,上限 200 字元。 |

### 篩選器

- **Status** 下拉。
- **Score** 下拉 — `≥ 4.0`(高)、`≥ 3.0`(中)、`< 3.0`(低)。
- **Search** — 跨公司 + 角色的子字串比對。

每個篩選器都會把分頁器重設到第 1 頁。每頁 25 列。

### 維護按鈕

- **▶ Normalize** 執行 `normalize-statuses.mjs` — 重新正規化
  狀態拼寫(`applied` → `Applied`、`interview` → `Interview`)。
- **▶ Dedup** 執行 `dedup-tracker.mjs` — 以
  `(company, role)` 大小寫不敏感地移除重複。
- **▶ Merge** 執行 `merge-tracker.mjs` — 從
  `batch/tracker-additions/*.tsv` 拉入待處理條目(父專案的批次
  流程會把透過 Apply 輔助器送出的申請丟在那裡)。會去重並把
  已處理的檔案歸檔到 `batch/tracker-additions/merged/`。上游批次
  流程詳見
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)。

### 新增列

`POST /api/tracker` — 主體 `{ company, role, score?, status?, url?,
reportSlug?, notes?, date? }`。以 `(company, role)` 大小寫不敏感
去重。從 UI 端,Evaluate 頁面在評分成功後會提供「Add to
tracker」按鈕。

---

## 12. 深度研究(`#/deep`)

產生結構化的公司簡報:快照、工程文化、近期新聞、Glassdoor 觀感、
面試流程、議價籌碼、可以問招募人員的三個聰明問題。

### 輸入

兩個欄位 — 公司名稱與(選填)角色。塑造結構的模板是
(`modes/deep.md`)。

### 輸出路徑

與 Evaluate 相同的 fallback 鏈:

1. **Anthropic live**(首選)— `bundleProjectContext` 內嵌
   cv + profile + `_shared.md` + `deep.md`。輸出:10–30 KB 的
   有依據 markdown,儲存到 `interview-prep/<company>-<role>.md`。
2. **Gemini live** — `gemini-eval.mjs` 呼叫。同樣的儲存目標。
3. **手動提示** — 頁面遞給你一段為 Claude Code 準備好的提示
   (Claude Code 有 WebFetch + WebSearch,可做真正的研究)。

### 提示

- Anthropic 用 `claude-sonnet-4-6` 通常每次呼叫在 1–3 分鐘內回
  約 13 KB 的有用文字。
- Anthropic SDK 沒有內建的網頁搜尋。如果該角色需要新鮮新聞 +
  Glassdoor 觀感,請把手動提示貼到 Claude Code,讓它用 WebFetch
  工具。
- 即時執行會計費;一次 Sonnet 4.6 深度研究呼叫成本約
  $0.30–0.50 USD。

---

## 13. 模式提示(七個 `/#/<mode>` 頁面)

七個提示產生器:**Project** 想法、**Training** 計畫、
**Follow-up** 郵件、**Batch** 評估、**Outreach** 給招募人員、
**Interview prep** 一頁式重點、**Patterns** 回顧。每個都包裝一個
特定的 `modes/<slug>.md` 模板:

| 頁面 | Slug | 用途 |
|---|---|---|
| `#/project` | `project` | 為目標角色客製化作品集專案。 |
| `#/training` | `training` | 技能缺口分析 → 課程。 |
| `#/followup` | `followup` | 面試後郵件草稿。 |
| `#/batch` | `batch` | 多 JD 批次評估提示。 |
| `#/contacto` | `contacto` | 對招募人員 / 推薦人的外聯訊息。 |
| `#/interview-prep` | `interview-prep` | 特定面試輪次的一頁式準備。 |
| `#/patterns` | `patterns` | 「哪些模式讓我成功?」的反思分析。 |

### 共用樣板

每個頁面都有一個小表單(欄位視 mode 而定)、一顆 **▶
Generate prompt** 按鈕(手動),以及 — 當有 Anthropic 或 Gemini
金鑰時 — 一顆會晉升為主按鈕的 **⚡ Run live**。

點 **▶ Generate prompt** 會回傳組合好的提示,把你的表單值
JSON 字串化後塞入 `User-supplied context:` 區塊,後面接原樣的
`modes/<slug>.md` 模板。複製貼到你選擇的 LLM。

點 **⚡ Run live** 會把同一個提示送到 Anthropic(或 Gemini),
並透過 `bundleProjectContext` 內嵌 `cv.md` + `profile.yml` +
`_shared.md`。結果在頁面上渲染、可複製,也可下載為 `.md`。

這七個頁面是明確的允許清單 — 有專屬路由的 modes(`oferta` →
Evaluate、`deep` → Deep research),以及父專案只在 Claude Code
裡支援的 modes(`apply`、`scan`、`pipeline`、`tracker`、`pdf`、
`latex`、`ofertas`、`auto-pipeline`)刻意不放進這個 UI。

---

## 14. 申請清單(`#/apply`)

決定要申請後,這個 Apply 輔助頁會為實際的申請步驟產生一份投遞
檢查清單。它 **不會** 自動填表 — 那個流程仍留在 Claude Code 的
`/career-ops apply`,後者在父專案中使用 Playwright。

### SPA 檢查清單模式(`#/apply`)

SPA 的檢查清單是給偏好手動填表、不想啟動 Playwright 的使用者
用的。它涵蓋:

0. 在 Claude Code 中執行 `/career-ops apply <url>`,透過
   Playwright 讀取表單(如果你要手動填,跳過此步)。
1. 確認職缺仍上線(`check-liveness.mjs`)。
2. 確認 CV 是最新版(`cv-sync-check.mjs`,若 score ≥ 4.0 就再
   產生 PDF)。
3. 使用 `cv.md` 的 STAR+R 證據點客製化求職信 / 「Why us?」答覆。
4. 誠實回答 EEO / 簽證贊助 / 到職日問題。
5. 投遞前把填好的答覆儲存到
   `interview-prep/{company}-{role}.md`。
6. **絕對不要自動投遞** — 由你(人類)按下最後的按鈕。
7. 投遞後:在 `data/applications.md` 新增一列(或寫 TSV 到
   `batch/tracker-additions/`)。

### 手動填寫 vs Playwright 輔助

實際投遞有兩條路徑:

- **手動** — 在一般瀏覽器分頁開啟職涯頁面,照上面的 SPA 檢查
  清單,複製貼上答覆。不需要 Playwright。表單很短或你沒裝
  Chromium 時用這個。
- **Playwright 輔助** — 在 Claude Code(父專案)執行
  `/career-ops apply <company>`。Playwright 會自己開瀏覽器、
  讀取每個表單欄位、回傳編號的草稿答覆。你仍然要自己按 Submit。
  表單很長、動態,或你想要稽核軌跡(誰回答了哪題)時用這個。

### 完整 CLI 申請流程([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**前置條件:**

1. 先執行 `/career-ops pipeline`,這樣 JD 才會在 `reports/` 底下
   有評估報告。apply 指令依賴既有的評估;沒有的話,先跑 pipeline。
2. 報告與 profile 已載入。
3. **建議:** 已安裝 Playwright
   (`npx playwright install chromium` — 見下方 Playwright Setup)。
   未安裝時會退回 WebFetch(僅文字表單預覽,無點擊填寫)。

**編號流程**(正式 8 步):

1. **執行指令** 並帶上公司名稱:

   ```
   /career-ops apply <company>
   ```

   範例:`/career-ops apply Anthropic`。沒有參數時,下一輪請提供
   表單截圖、貼上的表單文字,或申請 URL。

2. **定位報告。** 系統會在 `reports/` 中找到匹配的評估
   (先前由 `/career-ops pipeline` 或 `#/evaluate` 建立的那份)。

3. **開啟表單。** Playwright **自動** 啟動一個瀏覽器視窗 — 你
   不要自己開。

4. **讀取欄位。** 系統會讀取並解析每一個表單欄位
   (標籤、類型、是否必填、select 的選項)。

5. **產生答覆。** career-ops 會根據你的 profile、證據點與該角色
   為每個欄位產出客製化答覆。

6. **回傳編號清單。** 你會收到依表單版面排序的答覆 — 簡單欄位
   (姓名、電子郵件)在前,自由文字欄位(求職信、「Why us?」)
   在後。被標記的條目指向需要人工注意的地方 — 薪資錨點、缺失的
   履歷細節、選填問題。

7. **手動填寫。** 你把每個答覆複製貼到對應欄位。此步是手動的、
   不自動。先審閱每個答覆。

8. **使用者送出。** 你自己按下 Submit。career-ops **絕不** 按
   Submit。在聊天中輸入以下文字確認完成:

   ```
   Submitted.
   ```

**在 `Submitted.` 時的自動更新:**

- 在 `data/applications.md` 中狀態從 `Evaluated → Applied`。
- 填好的答覆會持續保存在報告的 Section G 供日後參考。

**交接給 tracker:**

```
/career-ops tracker
```

監看整個 pipeline 的狀態,不論角色 score 高低。

### Batch evaluate([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

當你有 10 個以上 JD 要一次評分時(SPA 的逐一 `#/evaluate` 對該
量級不切實際),請從 CLI 使用批次執行器。

**輸入檔案 — `batch/batch-input.tsv`**(以 tab 分隔):

| 欄位 | 用途 |
|---|---|
| `id` | 唯一序號 |
| `url` | 職缺貼文完整連結 |
| `source` | 來源平台(LinkedIn、Greenhouse 等) |
| `notes` | 選填的脈絡細節 |

範例列:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**`./batch/batch-runner.sh` 旗標:**

- `--dry-run` — 預覽待處理的職缺但不評估。請務必先跑這個來驗證
  TSV。
- `--parallel N` — 同時跑 N 個 worker(建議 1、2 或 3)。
- `--min-score X.X` — 跳過低於門檻的職缺,不持久化。當你只想保留
  高配對角色的報告時很有用。
- `--retry-failed` — 只重跑上一次執行時失敗的職缺(網路失敗、
  速率限制)。
- `--max-retries N` — 失敗職缺最多嘗試 N 次(預設:2)。
- `--model NAME` — 傳給 `claude -p --model` 的 Claude 模型(career-ops 1.8.0,#504)。未設定 = Claude Max 訂閱預設模型。大批次用較便宜的,如 `claude-sonnet-4-6`。在 `#/batch` 中顯示為 **模型** 輸入(web-ui 1.31.0)。
- `--start-from N` — 跳過低於 N 的 offer ID(繼續部分處理的批次)。在 `#/batch` 中顯示為 **起始 #** 輸入(web-ui 1.31.0)。

**標準執行順序:**

1. **編輯** `batch/batch-input.tsv` — 每個 JD 一列。

2. **Dry-run**(建議先跑):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **執行** — 循序或平行:

   ```bash
   ./batch/batch-runner.sh                       # 一次一個
   ./batch/batch-runner.sh --parallel 2          # 兩個並行
   ./batch/batch-runner.sh --parallel 3          # 三個並行
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # 只持久化高配對
   ```

4. **重試失敗**(網路 / 速率限制):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **報告** 會落到 `reports/`,命名為
   `{id}-{company}-{YYYY-MM-DD}.md`。摘要列附加到
   `batch/tracker-additions/`。

6. **合併進 tracker:**

   ```bash
   node merge-tracker.mjs                 # 套用批次新增
   node merge-tracker.mjs --dry-run       # 預覽合併
   ```

   合併指令會去重條目,並把已處理的檔案歸檔到
   `batch/tracker-additions/merged/`。

SPA 會把產生的報告呈現在 `#/reports`(分頁,score-pill 顏色),
追蹤表列則呈現在 `#/tracker` — 完全就像你透過 `#/evaluate` 一個
個加進去那樣。如果你不想下指令到 CLI,可配合 `#/tracker` 上的
**▶ Merge** 維護按鈕使用。

### Playwright setup([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

兩個 career-ops 功能需要它:

- **表單填寫** 在 `/career-ops apply`(上方第 3 步 — Playwright
  開啟瀏覽器、讀取欄位標籤、建議答覆)。
- **PDF 生成** 透過 `/career-ops pdf`,以及 SPA 的
  **📄 Generate PDF** 按鈕(出現在 `#/cv` / `#/reports/:slug` /
  `#/evaluate` / `#/deep` / `#/interview-prep`)。

**Playwright 未安裝時的退回行為:** apply 流程會退回到 WebFetch
(僅文字表單預覽,無點擊填寫)。PDF 生成則會直接錯誤。

**核心設定**(從 career-ops 父專案根目錄執行):

```bash
# 為 Playwright 安裝 Chromium
npm install
npx playwright install chromium

# 註冊 Playwright MCP,讓 Claude Code 能操作表單
claude mcp add playwright npx @playwright/mcp@latest

# 驗證三個元件都到位(Chromium、Playwright lib、MCP)
npm run doctor
```

**替代 MCP 註冊方式** — 加到
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

**行為說明:**

- **預設 headless。** Playwright 預設靜默運作。要看到瀏覽器動作,
  請告訴 Claude `open up with playwright the browser and fill out
  the entire form.`
- **一個套件三種角色** — 安裝 Playwright npm 套件後你會同時得到
  瀏覽器自動化函式庫、`/career-ops pdf` 用的 PDF 渲染引擎,以及
  (透過 MCP)Claude Code 內的表單填寫工作流。
- **依賴前先驗證** — `npm run doctor` 會確認三者皆可運作。SPA
  的 Health 頁面有一項 `Playwright (parent node_modules)` 檢查,
  缺失時會快速失敗。

---

## 15. 面試準備

這是研究之後、面試之前的階段。本應用中三項產物會在此匯流:

1. **儲存的深度研究檔案** 位於 `interview-prep/`,你跑過的每對
   公司-角色一份。可從 **Deep research** 頁面瀏覽,或直接透過
   `/api/interview-prep` 取得。
2. **Patterns 模式**(`#/patterns`)— 產生自我反思的提示:
   「綜觀我最近 N 次面試 / offer / 拒信,哪些模式成立?」累積
   5 列以上 tracker 後特別有用。
3. **Interview-prep 模式**(`#/interview-prep`)— 預先填好特定
   即將到來輪次(行為、技術、系統設計)的一頁式重點。輸出落在
   同一個 `interview-prep/` 資料夾。

### 建議工作流

對於你已經排定的每場面試:

1. **重跑 Deep**(或開啟已儲存的檔案)在前一天。
2. **`#/interview-prep`** — 為該輪次產一份一頁式重點。貼到你的
   筆記。
3. **系統設計 / 程式設計輪次** — 開 `#/training`,要求對 JD
   強調的特定子系統做 30 分鐘的針對性複習。
4. **薪資輪次** — 開深度研究檔案,跳到「Negotiation leverage
   points」。準備 2–3 個具體資料點(Glassdoor 區間、近期募資、
   另一家公司的對標 offer)。
5. **行為輪次** — 從你的 `cv.md` 拉出 STAR+R 故事,這些故事
   會落在原始 Evaluate 報告的 B 段。

面試結束後,立即:

1. 更新 tracker 列:狀態 → `Responded`(然後 `Interview`、
   `Offer` 等等)。
2. 執行 `#/followup` 起草感謝信。
3. 如果你獲得新情報(薪資區間、團隊組成、技術棧驚喜),編輯
   已儲存的 `interview-prep/<company>-<role>.md`,加上
   `## Post-round notes`,讓未來的你看得到。

---

## 16. Activity log + 疑難排解

### Activity log(`#/activity`)

伺服器收到的每個狀態變更請求的稽核軌跡。記錄項目:pipeline 新增、
tracker 寫入、CV 儲存、JD 儲存、evaluate 執行、深度研究執行、
scan 執行、設定變更、mode 執行。

機密(`ANTHROPIC_API_KEY`、`GEMINI_API_KEY`)在進入時就被遮罩;
你永遠不會在 `data/activity.jsonl` 看到真實金鑰值。

依動作前綴篩選(`pipeline.`、`cv.`、`evaluate`、`scan.` 等)。
每頁 25 列;伺服器最多回傳 500 筆最近的事件。

### 疑難排解

| 症狀 | 可能原因 | 修復方式 |
|---|---|---|
| Health 頁面在 `cv.md` 顯示紅色 | 第一次執行,檔案尚未存在 | `touch $CAREER_OPS_ROOT/cv.md` 後重新整理。 |
| Health 在 `Profile customized` 顯示紅色 | `candidate.full_name` 仍是 `Jane Smith` | 編輯 `config/profile.yml`。 |
| 掃描日誌出現 `hh.ru: HTTP 403` | 非俄羅斯 IP,沒有 `(伺服器使用預設 UA)` | 在 `dev.hh.ru/admin` 註冊,設定俄羅斯 IP / VPN。 |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | 父專案依賴未安裝 | `cd $CAREER_OPS_ROOT && npm install`。 |
| Generate PDF 出錯 | 父專案未安裝 Playwright | `cd $CAREER_OPS_ROOT && npx playwright install chromium`。 |
| `/career-ops apply` 顯示「no report found」 | Pipeline 從未為此 JD 評分 | 先執行 `/career-ops pipeline`(或 `#/evaluate`);見第 14 節前置條件。 |
| `batch-runner.sh: no such file` | 在錯誤的目錄執行 | 在叫用 `./batch/batch-runner.sh` 前先 `cd $CAREER_OPS_ROOT`。 |
| 伺服器報 `EADDRINUSE: 4317` | 舊實例仍在執行 | `pkill -f 'node server/index.mjs'` 後重啟。 |
| Live LLM 呼叫掛起 > 2 分鐘 | 提示太大或 Anthropic 慢 | 檢查 `/api/health` 的 Anthropic 旗標;伺服器對提示有 200 KB 軟上限並回 413。 |
| Pipeline 預覽顯示 `(unsafe redirect)` | 貼文被轉址到私有 IP / loopback | 這是安全功能(REVIEW-B1)。轉址目標被拒絕,原 URL 不變。 |
| Tracker 列文字撐破表格 | v1.9.1 之前公司名稱含豎線 | 升級到 v1.9.1+ — 豎線已端到端跳脫(BF-1)。 |
| `npm test` 在新 clone 上失敗 | 測試假設父專案版面 | 使用 `CAREER_OPS_ROOT=$(mktemp -d)` 並 bootstrap fixtures。 |

更深入的診斷:在 Health 頁面執行 **▶ Doctor**,複製輸出,並到
<https://github.com/Fighter90/career-ops-ui/issues> 搜尋 issue
追蹤。


---

## 17. 如何新增職位入口網站來源

career-ops-ui 將每個職位網站視為 **adapter** — [`server/lib/sources/<slug>.mjs`](../../server/lib/sources/) 下的單一檔案,知道如何取得並正規化某個站點的結果。截至 v1.75.0,`server/lib/sources/` 註冊表內建 **19** 個 adapter —— 14 個英文(Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday 等 ATS、RSS,以及 v1.75.0 聚合器 RemoteOK / Remotive / Working Nomads / IBM / Arbeitsagentur / Glints / Jobstreet · SEEK)和 5 個俄文板塊。v1.75.0 新增的 7 個聚合器並非按公司的 ATS,而是全板塊或設定驅動的來源:三個遠端訂閱源以 `provider: remoteok|remotive|workingnomads` 選擇,四個區域來源(IBM / Arbeitsagentur / Glints / Jobstreet · SEEK)讀取每條目的 `<provider>:` 設定區塊 —— YAML 見 §5,可複製貼上的條目見 `docs/portals-examples.md`。

> **v1.69.0 (P-14) — 直接放入即自動探索。** 新增第 12 個來源現在只需**純粹的檔案放入**。registry
> ([`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs))
> 不再維護手動清單 — 啟動時它會掃描此資料夾
> (`readdirSync` + dynamic `import()`) 並從每個 `*.mjs` 收集 `export const meta`
> 區塊。寫好 adapter、宣告其 `meta`,它就會立刻出現在掃描器、`#/scan` 篩選下拉框和 RU
> dispatcher 中 — **無需編輯 `registry.mjs`**。(RU 來源仍需在父專案的 `portals.yml` 中加入一行;參見步驟 5。)

### 步驟 1 — 編寫 adapter

建立 `server/lib/sources/<slug>.mjs`。依據來源是否提供 JSON API,有兩種模式可用:

**API 型來源**(最簡潔 — 只要網站有開放資料端點就優先選這個):

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

**HTML 抓取型來源**(當沒有 API 時 — 完整範例請參閱
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

每個 adapter 必須遵守三項契約:

- **匯出有效的 `meta` 區塊**(參見步驟 2)。沒有它,registry
  會靜默跳過該檔案(啟動時發出一條 `console.warn`),該來源永遠不會出現。
- **在 `opts` 中接受 `{ onlyRemote, fetchImpl, signal }`。** `fetchImpl`
  讓 adapter 在無需網路的情況下可測試;`signal` 是用戶端斷線傳播所必需的(REVIEW-B3)。
- **回傳具有通用形狀的記錄** —
  `{ id, title, company, url, salary, location, isRemote, workplaceType,
  relocates, date, snippet, source }`,其中 `source` 必須匹配
  `meta.value`。

### 步驟 2 — 宣告 adapter 的 `meta`(自動註冊)

這就是完整的註冊步驟。**你不需要編輯 `registry.mjs`。**
只需確保 adapter 匯出了 `meta` 區塊 — registry 會在啟動時自動探索它:

```js
// at the top of server/lib/sources/example.mjs
export const meta = {
  value: 'example',          // job.source value AND #/scan option.value
  label: 'Example.com',      // display label in the dropdown
  region: 'ru',              // 'en' | 'ru'
  configKey: 'example',      // RU only — key in portals.yml::russian_portals.sources
};
```

探索時的驗證規則(任一規則不符的檔案會被跳過,並發出一條
`[sources/registry]` 警告,讓部分遷移的分支仍可診斷):

- `value` — 非空字串。必須與 adapter 中的 `job.source` 一致。
- `label` — 非空字串。
- `region` — 必須是 `'en'` 或 `'ru'`;其他值一律拒絕。
- `configKey` — `region: 'ru'` 時**必填**;`'en'` 時忽略。

`region: 'en'` 會加入 ATS 掃描(從 `tracked_companies` URL 模式自動探索);`region: 'ru'` 會加入區域 dispatcher。公開 API
(`SOURCES`、`SOURCES_BY_REGION`、`RU_CONFIG_KEYS`、`getRegionalSources`) 從所有已探索的 `meta` 重新建構,順序為 `en` 優先再 `ru`,各區域內依 label 字母排序 — 確保下拉框順序對使用者保持穩定。

### 步驟 3 — 接入 dispatcher(僅 RU)

EN ATS 來源從 `tracked_companies` URL 模式自動探索 —
無需進一步接線。對於 RU 來源,開啟
[`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs),找到
`RU_DISPATCH` 表,並新增一列:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

dispatcher 迴圈會為 `cfg.sources` 中出現的每個鍵呼叫 `entry.search(query, opts)`。不需要其他程式碼變更。

### 步驟 4 — 測試(mock,嚴禁真實網路)

在 `tests/sources-<slug>.test.mjs` 下放置一個測試檔案。測試中**禁止**
真實網路(CI-isolation 契約):

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

### 步驟 5 — 在你的 `portals.yml` 中啟用

父專案的 `portals.yml` 是使用者所有的設定。把新來源的 `configKey` 加到陣列裡:

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

在瀏覽器中重新載入 `#/scan`。來源篩選下拉框會自動取得新條目(單一事實來源:
[`GET /api/scan/sources`](../../server/lib/routes/scan.mjs) →
[`registry.mjs`](../../server/lib/sources/registry.mjs))。
🌐 掃描按鈕現在會在每次區域掃描時包含新來源。

### 參考 adapter(新來源請鏡像這些)

| adapter 檔案 | 類型 | 說明 |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | 標準 RU API adapter;地理感知 UA 回退。 |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | 俄羅斯政府開放資料;無 IP 閘門。 |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML 抓取 | 俄羅斯技術板;基於正規表示式的卡片解析器。 |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML 抓取 | 防禦式解析器,解析失敗時回傳 `[]`。 |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML 抓取 | 與 GetMatch 相同的防禦式風格。 |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | 標準 EN ATS adapter;使用 `tracked_companies` URL 模式。 |

### 常見陷阱

- **遺漏 `meta` 匯出。** 自 v1.69.0 起,`meta` 區塊是
  *唯一*能註冊來源的途徑。沒有 `meta`(或格式錯誤)=
  檔案在啟動時被靜默跳過,並發出一條
  `[sources/registry] <file> has no valid \`export const meta\` — skipped`
  警告,該來源永遠不會出現在下拉框中。如果全新的 adapter 沒有顯示,請檢查伺服器日誌。
- **`source` 欄位不匹配。** 你的 adapter 寫入的字串必須
  與 `meta.value` 完全一致。一旦漂移,
  `#/scan` 篩選下拉框會顯示該來源,但選取它會
  濾掉每一列(因為相等性檢查是 `r.source === fs`)。
- **解析失敗時拋出例外。** HTML 抓取器在解析不出卡片的
  健康 200 時必須回傳 `[]`。拋出例外會破壞多來源
  dispatcher 迴圈 —— 一個糟糕的 HTML 結構會害死同一查詢的
  其他所有來源。
- **遺漏 `fetchImpl` / `signal`。** 沒有它們,你的 adapter
  無法在不存取真實網路的情況下做單元測試,用戶端
  斷線也不會傳播(使用者關閉分頁後背景
  fetch 仍然存活)。
- **為 RU 信任 `tracked_companies`。** 該清單僅用於 EN ATS
  來源。RU adapter 改為從
  `russian_portals.queries` 自驅動 —— 沒有按公司的條目。

---

## 18. 通知(頂列的 🔔)

> v1.58.34 — 右下角的所有 toast 同時被記錄到記憶體日誌(上限 50,溢出刪除最舊)。點擊頂列的 🔔 開啟右側 **通知** 抽屜,重新檢視錯過的訊息。日誌按分頁/作業階段存在 — 關閉分頁即清空。

抽屜**僅在點擊鈴鐺時開啟**(或鍵盤聚焦 + Enter / Space)。不會自動開啟。紅色徽章顯示自上次開啟以來未讀條數;開啟後歸零。

### 類別

| 類別 | 觸發條件 | 視覺提示 |
|---|---|---|
| **成功** | `Saved`、`Copied`、`Refreshed`、掃描完成、CV 匯入、apply-checklist 操作、個人資料儲存 | 左側綠色邊;綠色 toast 背景 |
| **錯誤** | URL 驗證失敗、帶 `(METHOD /path · HTTP NNN)` 後綴的 API 錯誤、網路失敗、pipeline-400 重複、doctor/verify 非零退出 | 左側紅色邊;紅色 toast 背景;技術後綴塞入 `詳細資訊` `<details>`(U-4) |
| **資訊 / 進度** | `Running doctor.mjs…`、`Refreshing…`、`Loading…`、掃描進度 | 左側灰色邊 |

每條顯示:本地時間、人類可讀訊息、(若有)`(METHOD /path · HTTP NNN)` 等技術細節(等寬字型)。

### 不屬於通知

- Doctor / verify 結果視窗(視窗,不是 toast)。
- `#/scan` / `#/auto` 的 SSE 日誌行(直接寫入頁面內文)。
- 不帶 toast 的純 spinner 載入狀態。

### 鍵盤

- 鈴鐺**點擊**或聚焦後 **Enter / Space** → 開啟。
- **Esc**、**×**、再次點擊鈴鐺 → 關閉;焦點回到鈴鐺。


## 19. 將應用在地化為你的語言

介面提供 9 種語言(English、Español、Français、Português、한국어、日本語、Русский、简体中文、繁體中文)。畫面上的每個文案都來自翻譯字典,你無需改動應用邏輯即可新增或修正某種語言。

**翻譯檔案在哪裡。** 自 v1.60.0 起,每種語言都是 `public/js/lib/locales/` 下的獨立檔案 —— `i18n-dict.en.js`、`i18n-dict.es.js`、`i18n-dict.ru.js` 等 —— 一份簡單的 `'鍵': '文案'` 清單。共用的 `i18n-dict.aliases.js` 讓必須保持一致的鍵(側欄標籤與其頁面標題)指向同一筆翻譯。`i18n-dict.js` 在載入時將它們組裝起來,你無需編輯它。

**修正或新增文案。** 開啟你語言的檔案,找到鍵(如 `'nav.scan'`)並修改文案。要新增一個標籤,把同一個鍵與譯文加入**全部 8 個**語言檔案,然後在頁面中用 `t('your.key')` 引用。執行 `npm test` —— 若任何語言缺少該鍵就會失敗,因此不會發布半成品翻譯。

**新增一種語言。** 把 `i18n-dict.en.js` 複製為 `i18n-dict.<code>.js` 並翻譯每個值,然後在 `i18n.js`(語言清單 + 瀏覽器自動偵測)、`i18n-dict.js` 組裝器中註冊該代碼,並在 `index.html` 增加一行 `<script>`。包含測試快照與說明 / README 配套檔案的完整清單見 `docs/LOCALIZATION.md`。

**提示。** 語言切換器在側欄底部,你的選擇會依瀏覽器記住。伺服器診斷訊息刻意保持英文(讓日誌保持一致)—— 只有畫面介面會被翻譯。

完整的逐步在地化指南請見儲存庫中的 **`docs/LOCALIZATION.md`**。
