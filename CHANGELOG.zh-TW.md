# 變更日誌

**career-ops-ui** 的所有重要變更記錄於此。格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),版本號遵循 [Semantic Versioning](https://semver.org/)。

翻譯版本: [🇬🇧 English](CHANGELOG.md) · [🇪🇸 Español](CHANGELOG.es.md) · [🇧🇷 Português](CHANGELOG.pt-BR.md) · [🇰🇷 한국어](CHANGELOG.ko-KR.md) · [🇯🇵 日本語](CHANGELOG.ja.md) · [🇷🇺 Русский](CHANGELOG.ru.md) · [🇨🇳 简体中文](CHANGELOG.zh-CN.md) · [🇵🇱 Polski](CHANGELOG.pl.md) · [🇺🇦 Українська](CHANGELOG.uk.md) · [🇩🇰 Dansk](CHANGELOG.da.md) · [🇸🇦 العربية](CHANGELOG.ar.md) · [🇩🇪 Deutsch](CHANGELOG.de.md) · [🇮🇹 Italiano](CHANGELOG.it.md) · [🇹🇷 Türkçe](CHANGELOG.tr.md) · [🇮🇳 हिन्दी](CHANGELOG.hi.md)

> **i18n 註記** — 本檔案已完整翻譯為繁體中文(臺灣慣用語)。規範英文正文仍以 [🇬🇧 CHANGELOG.md](CHANGELOG.md) 為準。

---

## [1.212.1] — 2026-08-21

**修復 — cvstart.org 到達頁少算了掃描器的職缺來源（顯示 80 並遺漏 Job Bank（加拿大））；現在重新與應用的 81 一致，若兩者不符，網站建置會大聲失敗。**

### 修復
- **到達頁的「職缺來源」計數重新與應用同步。** 在 v1.212.0 之後，cvstart.org 顯示 **80** 個職缺板並缺少新的 **Job Bank（加拿大）** 晶片，而應用、掃描下拉選單與說明指南都列出 **81**。到達頁透過載入即時掃描器登錄來建立清單，而某個來源因其引入 YAML 相依的方式在該建置中載入失敗，於是被悄悄丟棄。現在 Job Bank 以延遲載入方式引入該相依，與應用其餘部分在掃描時的做法一致，所以它一定會出現。
- **網站建置現在拒絕發佈不相符的來源計數。** 若登錄列舉出的來源少於磁碟上實際存在的數量（來源載入失敗的特徵），建置會以清楚的訊息失敗，而不是悄悄發佈錯誤的數字。

### 說明
- 應用行為不變——掃描器始終擁有全部 81 個來源，只有到達頁受影響。掃描來源：**81** 個（英文 76 + 俄文 5）—— 不變。測試套件：**2687**。



## [1.212.0] — 2026-08-21

**新增 — Job Bank（加拿大）聯邦國家職缺板。移除 — EchoJobs（其來源已被反爬攔截）。修復 — 基於 Consider 的職缺板重新回傳結果，多地點 Lever 職缺不再隱藏一半地點。**

### 新增
- **Job Bank（加拿大）**（jobbank.gc.ca）— 面向加拿大聯邦國家就業服務的新零 token 掃描來源，這是任何聚合器都覆蓋不好的高流量職缺板。在 `#/scan` 的**來源**篩選中選取，或新增 `provider: jobbankca` 的公司並附選用的 `keywords` 清單（省略時回退到你個人檔案的目標角色）。讀取公開 ATOM 來源，釘選主機，不需金鑰。

### 移除
- **EchoJobs** — 已退役。其公開來源現已位於反爬保護之後，不回傳任何內容，保留它只會浪費一個掃描槽。

### 修復
- **基於 Consider 的職缺板重新回傳結果。** Consider 現在要求在接受搜尋請求前進行匿名交握（一次 GET，用於種下工作階段 cookie + CSRF token）；沒有它，請求會被悄然拒絕，職缺板看起來是空的。
- **多地點 Lever 職缺不再隱藏一半地點。** Lever 把一個主要城市放在 `location`，其餘放在 `allLocations`；只讀主要城市會讓一個同時在巴塞隆納與蒙特維多開放的職缺看起來只在巴塞隆納（並被地點篩選錯誤丟棄）。現在兩者合併。

### 說明
- 分頁職缺板的翻頁間隔更溫和（由 150 ms 提高到 250 ms），以禮待單主機招聘網站。掃描來源：**81** 個（英文 76 + 俄文 5）—— 不變（Job Bank 加入、EchoJobs 移除）。測試套件：**2685**。



## [1.211.0] — 2026-08-19

**新增 — 台灣科技職缺板 Yourator。修復 — 標題/公司名中的重音實體現在處處都能解碼，名稱含重音的公司不再被誤標。**

### 新增
- **Yourator**（yourator.co）— 面向台灣科技與數位職缺市場的新零 token 掃描來源。在 `#/scan` 的**來源**篩選中選取，或新增 `provider: yourator` 的公司。它讀取公開 JSON API（不需金鑰、不需瀏覽器），走訪職缺板每一頁，並輸出每筆職缺的真實雇主連結（其自有 ATS），去除追蹤參數。

### 修復
- **重音命名實體現在處處都能解碼。** 共享 HTML 解碼器新增了 Latin-1 字母（`&eacute;` → é、`&ccedil;` → ç、……），因此書寫 `D&eacute;veloppeur` 或 `Fran&ccedil;ais` 的歐洲職缺板不再把該字面量留在標題、追蹤器或產生的文件中。（大寫保持大寫——`&Eacute;` 是 É 而非 é——像 `&constructor;` 這樣的查找現在解析為其自身。）
- **名稱含重音的公司不再因位於自有網域而被誤標。** 「Işık」現在摺疊為「isik」並比對 isik.com.tr；「Société Générale」比對 societegenerale.com。舊檢查會刪除重音字母，而非將其摺疊為 ASCII 基字母。

### 說明
- 掃描來源：**81** 個（英文 76 + 俄文 5）。測試套件：**2667**。



## [1.210.1] — 2026-08-19

**修復 — 含「&」或引號的 Habr Career 職缺標題與公司名不再亂碼。**

### 修復
- Habr Career 來源現在會在**標題**與**公司名**繼續往下流轉之前解碼 HTML 實體。伺服器渲染的卡片以轉義形式抵達（"Changellenge &gt;&gt;"、"Demand Forecasting &amp; Inventory Optimization"、"ООО &quot;М-ТЕХ&quot;"），因此未解碼的「&」會悄然通不過你自己的「&」標題篩選（正是上個版本在另外五個板塊上關閉的症狀），公司名也會以亂碼形式抵達追蹤器與報告。實體解碼現已在全部六個受影響來源上完成。

### 說明
- 測試套件：**2644**。



## [1.210.0] — 2026-08-19

**新增 — Senjob，掃描器的首個非洲職位板（塞內加爾）；另有五個職位板的標題比對更精準。**

### 新增
- **Senjob**（senjob.com）— 面向塞內加爾的新零 token 掃描來源，也是掃描器的首個非洲職位板。在 `#/scan` 的**來源**篩選中選取，或新增 `provider: senjob` 的公司。它以純 HTTP 讀取公開清單（不需金鑰、不需瀏覽器），將每個請求釘選到 senjob.com，並且——因為解析 HTML——把突然解析為空的清單視為損壞的職位板（顯式錯誤），而非一個沒有職缺的國家。

### 修復
- **含「&」的標題不再於五個職位板上遺失職缺** — 在 beesite、Cornerstone（csod）、Hacker News「Who is hiring」、Phenom 與 TKMS 上，標題以 HTML 轉義形式抵達，因此像 "R&D Engineer" 這類職位中被轉義的「&」無法通過你自己的 "r&d" 關鍵字，職缺便悄然消失（"sales & marketing" 的否定篩選也從未觸發）。現在標題——以及 Phenom 的地點——會在篩選前解碼。

### 說明
- 掃描來源：**80** 個（英文 75 + 俄文 5）。測試套件：**2643**。



## [1.209.0] — 2026-08-17

**新增 —— 應用內說明現在講解如何記錄應徵結果，「問問文件」也能帶你過去。**

### 新增
- 追蹤器說明（§11）在全部 17 種語言中新增了「記錄結果」小節，講解 **結果** 按鈕：選擇發生了什麼（被拒 / offer / 錄取 / 拒絕 / 已讀不回 / 進入面試），預覽它將做什麼，然後記錄 —— 這會記下結果、歸檔你送出的履歷和求職信，並替你同步該列的狀態。浮動的「問問文件」助手會讀取該指南，所以現在會把你引到那個按鈕，而不再只是建議你手動編輯狀態。

### 說明
- 每個說明套件現在為 31 H2 / 119 H3（原為 118）；已同步提升一致性守衛。僅文件 —— 無程式碼或行為變更。測試套件：**2625**。



## [1.208.2] — 2026-08-16

**修復 — 手機上通知與主題按鈕不再蓋在搜尋框上。**

### 修復
- v1.208.1 已讓頂列按鈕不再蓋住頁面標題，但在不算最窄的窄螢幕上——尤其是按鈕文字較長的語言——整條頂列仍會擠在一列，導致 🔔 與 🌙 按鈕蓋到搜尋框上。現在動作按鈕（通知、主題、診斷、開啟 Scan）在手機上一律換到自己整寬的第二列，搜尋框完整可見，互不重疊。

### 說明
- 手機上頂列動作按鈕移到整寬的第二列，消除了脆弱的「幾乎佔滿一列」區段——先前版面會把剩餘的負空間當成重疊來分配。Playwright 守衛現在重現了確切的觸發條件——長文字語言 × 565–640px 區段——並斷言頂列控制項絕不共用像素。測試套件：**2621**。



## [1.208.1] — 2026-08-16

**修復 — 手機上頂列按鈕不再蓋住頁面。**

### 修復
- v1.208.0 在窄螢幕上把頂列動作按鈕（診斷、開啟 Scan、通知、主題）換到第二列，但頂列高度固定，導致換行的一列溢出並壓在頁面標題上。現在頂列會**隨內容長高**，內容排在其下方。

### 說明
- 頂列固定的 `height` 改為 `min-height`，因此在任意寬度都會隨內容長高（桌面不變）。Playwright 守衛現在也檢查頂列不會溢出到頁面上。測試套件：**2621**。



## [1.208.0] — 2026-08-16

**修復 — 應用程式現在能適配手機螢幕：不再左右橫向捲動。**

### 修復
- 在窄螢幕上整個應用程式會向右溢出——頂列、表格、說明文章和設定分頁都超出右邊緣。現在每個頁面都能適配任意寬度：頂列按鈕換到第二列，寬表格和程式碼區塊在各自的框內捲動，說明把目錄疊在文章上方，按鈕/分頁列換行，長路徑或 URL 會換行而不是撐大頁面。

### 說明
- 根因是經典的 flex/grid **min-width: auto** 陷阱，加上幾個未包裹的寬元素；透過給網格項加 `min-width: 0`、給 markdown/標題加 `overflow-wrap`、可捲動的 markdown 表格，以及在行動斷點處讓說明網格縱向堆疊來修復。Playwright 守衛在主要路由上驗證 **375px 時 0 橫向溢出**。`tests/playwright-smoke.mjs`。測試套件：**2621**。



## [1.207.2] — 2026-08-16

**修復 — AI 計畫和職涯方向輪廓不再顯示為原始程式碼傾印。**

### 修復
- 有些模型會把整個回答包在 ```markdown … ``` 程式碼圍欄裡。發生時，**發展計畫**和**方向輪廓**會顯示為等寬程式碼區塊，而不是帶標題和清單的文件。現在會移除這層外圍欄——僅當它包住整個回答且語言明確為 `markdown`/`md` 時，因此真正的 `python`/`js`/無語言 ``` 程式碼回答保持不變。

### 說明
- 在共用的 LLM 清理步驟（`cleanLlmMarkdown`）裡一次處理，所有 AI 路由都受益，被包住回答內部的程式碼區塊也會保留。`tests/llm-output.test.mjs`（+3）。測試套件：**2621**。



## [1.207.1] — 2026-08-16

**修復 — 在小螢幕手機上著陸頁不再向右溢出。**

### 修復
- 在窄螢幕手機上，首屏（標題、簡介行和安裝終端）可能被右邊緣裁掉，因為過長的安裝指令和版面欄位不會縮小到螢幕。現在它們能適配任意寬度；安裝指令在其終端框內橫向捲動。

### 說明
- 也加固了一項不穩定的端對端冒煙檢查，它可能因資源的瞬時 404 而失敗：現在它像相鄰檢查一樣忽略無害的網路雜訊（favicon／連線／資源載入失敗），同時仍能捕捉真正的腳本錯誤。應用行為未變。測試套件：**2618**。



## [1.207.0] — 2026-08-15

**新增 — 直接在追蹤表中記錄一次應徵的結果。**

### 新增
- 每一列追蹤記錄都新增了**結果**動作：選擇發生了什麼（被拒、收到 Offer、錄用、拒絕 Offer、無回覆、進入面試），加一則選填備註，**預覽**結果狀態，然後記錄。記錄會封存已提交的履歷與求職信檔案，並把追蹤表同步到規範狀態——一次確定性的動作，而不是手動編輯追蹤表。

### 說明
- 新的 `POST /api/outcome` 中繼結果 CLI：`dryRun:true` 是唯讀預覽（比對該列、回報結果狀態、不寫入任何內容），實際呼叫才會記錄。寫入安全：結果類型被限制在已知集合內，且每個文字欄位在呼叫外部命令前都會拒絕控制字元（陣列參數、spawn——無 shell）。`tests/outcome-route.test.mjs`。測試套件：**2618**。



## [1.206.0] — 2026-08-15

**文件 — 應用程式內說明指南現已用全部 17 種語言涵蓋最新的五項功能。**

### 新增
- 內建說明指南，以及據其作答的「問說明」助手，現在記錄了最近上線的五項功能：**設定體檢**（設定 — 檢查你的履歷與檔案是否有缺漏和殘留的範例資料）、**探索 ATS 招募板**（入口 — 自動找到某公司的招募板）、**「還在招嗎?」檢查**（追蹤 — 職缺是否仍開放）、**「重用舊履歷?」提示**（履歷工作室 — 當已客製的履歷適配新職缺時提醒）以及**技能日誌**（分析 — 記錄自評分數）。五個新小節，已翻譯為全部 17 種語言。

### 說明
- 說明結構增至 31 個 H2 / 118 個 H3，各語言均有一致性檢查。參考文件已更新：`docs/architecture/API.md` 記錄了這些功能的五個路由，`CLAUDE.md` 與 `docs/sdd/CONVENTIONS.md` 中的路由/版本計數已是最新（36 個路由模組）。測試套件：**2610**。



## [1.205.0] — 2026-08-15

**新增 — 記錄練習測驗/評估結果的技能日誌。**

### 新增
- 新增**技能日誌**（分析 → 技能日誌），可記錄一次自評——公司、平台、技能、分數 % 及可選備註——附加到 `data/assessments.tsv`，並依最新在前列出歷史記錄。零 token、確定性；檔案格式由父專案 CLI 掌管。

### 說明
- 新增 `GET /api/assessments`（中繼 `assessment-log.mjs` 的預設 JSON 清單；柔性失敗 `{available:false}`）+ `POST /api/assessments`（顯式寫入：欄位作為**陣列參數**傳給 `assessment-log.mjs add`）。寫入安全：任何含控制字元的文字欄位都會被拒（TAB 會破壞欄、換行會注入列）→ 寫入前 400；分數/門檻限定 0–100，長度受限。`tests/assessments-route.test.mjs`。測試套件：**2610**。


## [1.204.0] — 2026-08-15

**新增 — 設定中的「設定體檢」面板，標記不完整或殘留範例資料的 CV/資料。**

### 新增
- **設定 → 設定體檢**現在零 token 檢查你的 `cv.md` 與 `config/profile.yml`，列出**阻斷問題**（缺少的檔案/欄位）與**警告**（殘留的範例/佔位資料、硬編碼指標）——讓你在不完整的設定削弱掃描與客製之前發現它。唯讀，一鍵重跑。

### 說明
- 新增唯讀的 `GET /api/cv-sync-check`，中繼父專案的 `cv-sync-check.mjs`（輸出人類可讀文字 + 結束碼，無 `--json`）；路由對其穩定的 `ERROR:` / `WARN:` 行做輕量解析為 `{ok, errors[], warnings[]}`——由橫幅而非結束碼判定成功。獨立安裝時以 `{available:false}` 柔性失敗。`tests/cv-sync-check-route.test.mjs`。測試套件：**2602**。


## [1.203.0] — 2026-08-15

**新增 — CV Studio 中的「重用過往履歷？」提示。**

### 新增
- 在 **CV Studio** 開啟一份已儲存的職缺描述時，應用現在會將其與你其他已儲存的職缺比對（確定性的詞語重疊，**零 token**），並告訴你最相近的一個是否足以**重用**那份客製履歷、**改一改再用**，還是**重新客製** —— 免得為已投過的職缺從頭再來。

### 說明
- 新增唯讀的 `GET /api/jds/:name/reuse`，中繼父專案的 `jd-similarity.mjs`（Jaccard 重疊 + 資歷守衛；JSON `{decision, score, reason}`），對每個過往職缺各呼叫一次（扇出上限 25，取最佳匹配）；指令碼或過往職缺缺失時以 `{available:false}` 柔性失敗。`tests/jd-similarity-reuse-route.test.mjs`。測試套件：**2594**。


## [1.202.0] — 2026-08-15

**新增 — 在 #/portals 中發現公司的 ATS 招聘板並開始追蹤。**

### 新增
- 在 **#/portals** 輸入公司名，應用會在 **Greenhouse、Ashby、Lever** 探測其公開招聘板——**零 LLM、無瀏覽器**——並顯示存在且目前列有 ≥1 個職缺的招聘板。點一下即可把所選招聘板加入掃描器監視的公司。探測為唯讀；僅當點擊**新增**時才寫入 `portals.yml`。

### 說明
- 新增 `server/lib/discover-ats.mjs`（固定主機、字元集驗證的 slug 經 DNS 固定的 `safeGet` 探測，每次請求 ≤12 次）+ `POST /api/portals/discover`（唯讀）與 `POST /api/portals/track`（顯式寫入：`withFileLock` + 文字拼接 + 重新解析保護 + 原子重新命名；僅已知 ATS 主機、冪等）。複用掃描器的配接器註冊表確認招聘板並統計職缺。i18n ×17。`tests/discover-ats-resolver.test.mjs` + `tests/discover-ats-route.test.mjs`。測試套件：**2588**。


## [1.201.0] — 2026-08-15

**修復 — 使用在地化或變體欄標題的追蹤器不再顯示為空白。**

### 修復
- 如果你的 `data/applications.md` 使用非英文或變體標題——西班牙文 `empresa` / `puesto` / `estado` / `fecha` / `enlace`，或 `position` / `stage` / `link`——追蹤器會用錯誤的鍵讀取，導致 **公司 / 職位 / 狀態 / 日期 / 連結欄為空**。現在這些標題會摺疊到規範欄位名，追蹤器正常顯示。全英文追蹤器的解析與先前完全一致。

### 說明
- 在 `parseApplications`（`server/lib/parsers.mjs`）中新增 `HEADER_ALIASES` 對應與正規化摺疊；未知或已規範的標題原樣通過。`tests/tracker-header-aliases.test.mjs`。測試套件：**2563**。


## [1.200.0] — 2026-08-15

**新增 — 在追蹤器中一鍵查看 ATS 職缺「是否仍在招」。**

### 新增
- 在 **#/tracker** 中，URL 為 Greenhouse / Lever / Ashby / Workday / SmartRecruiters 職缺的應徵現在會顯示 **「是否仍在招？」** 按鈕。點一下即查詢該 ATS 自己的公開 JSON——**零 token、無瀏覽器**——並顯示 **在招 / 已下架 / 未知**，讓你無需逐一開啟就能發現失效職缺。保守設計：僅明確的 404/410 判為*已下架*，含糊情況保持*未知*（絕不誤報*已下架*）。

### 說明
- 新增 `server/lib/liveness-core.mjs` + `liveness-api.mjs`，以及唯讀的 `GET /api/liveness?url=`（不寫入、無 LLM）。防 SSRF：URL 先經 `isValidJobUrl` 驗證，ATS API 僅透過 DNS 固定的 `safeGet` 以固定主機 + 字元集驗證的路徑段存取。`tests/liveness-core.test.mjs` + `tests/liveness-route.test.mjs`。測試套件：**2557**。


## [1.199.0] — 2026-08-15

**修復 — 過寬的表格現在可橫向捲動，而不再被截斷。**

### 修復
- 在 **Scan** 頁面（以及其他所有表格 — 追蹤器、統計、用量、儀表板）中，比視窗更寬的表格會**被截斷且沒有捲軸**，導致最右側的欄位無法存取。現在過寬的表格會依需要顯示**橫向捲軸**，因此在任何寬度下每一欄都可存取。

### 說明
- `public/css/components.css` 中的 `.table-wrap` 由 `overflow: hidden` 改為 `overflow-x: auto`（與現有的 `.reports-scroll` 容器一致）；圓角邊框保持不變。`tests/table-wrap-scroll.test.mjs`。測試套件：**2540**。


## [1.198.0] — 2026-08-15

**新增 —— 掃描重試現在採用指數退避、抖動，並尊重限流方的 `Retry-After`。**

### 新增
- 當徵才看板在掃描途中短暫限流或出錯（HTTP 429 / 5xx）時，重試現在以**指數退避 + 抖動**等待，而非固定的短延遲 —— 這樣繁忙的看板不會被以相同節奏反覆敲打，並行重試也不會同步再次衝撞。看板送來的 `Retry-After` 會被**尊重**（但有上限，使惡意的 `Retry-After: 86400` 無法拖住整次掃描）。永久性錯誤（404、被拒絕的重新導向）仍然立即失敗 —— 無變化。

### 說明
- 在 `server/lib/http-json.mjs` 中新增 `parseRetryAfterMs()` 與純函式 `computeRetryDelayMs()`；`fetchJson` 現在在非 ok 回應上擷取 `.retryAfter`，`fetchJsonWithRetry` 接受可選的 `maxDelayMs`（預設 8000）。`tests/http-json.test.mjs` (+9)。測試套件：**2536**。


## [1.197.0] — 2026-08-14

**新增 — 僅憑 `careers_url` 即可追蹤 Getro 的 VC 徵才看板，集合 id 會自動解析。**

### 新增
- 被追蹤的 Getro 看板（b2venture、Earlybird、Point Nine …）不再需要手動查找的數字 `getro_collection`。只需提供看板自己的 `careers_url`，首次掃描時 id 便會從該頁面**自動解析** —— 一次防 SSRF 的安全 GET 直接從頁面內嵌資料中讀取數字 `network.id`。明確的 `getro_collection` 仍然優先，並會完全跳過該抓取。

### 說明
- 在 `server/lib/sources/getro.mjs` 中新增 `httpsCareersUrl()`、`extractCollectionId()` 與非同步的 `resolveCollectionId()`；看板頁面透過 DNS 固定、大小受限的 `safeGet` 抓取，解析出的 id 仍由 `assertGetroUrl` 將主機鎖定為 `api.getro.com`。轉接器現在即使沒有 id，也能比對帶有 https `careers_url` 的 `provider: getro` 項目。`tests/sources-getro.test.mjs` (+8)。測試套件：**2527**。


## [1.196.0] — 2026-08-14

**修復 (安全) — Workday 轉接器以主機名而非子字串驗證 `api` 端點。**

### 修復
- `portals.yml` 中的 Workday `api:` 值現在只有在其**主機名**為 `myworkdayjobs.com`（或 `.myworkdayjobs.com` 子網域）時才被接受。舊檢查是子字串比對，因此任何僅包含該字串的 URL——例如 `https://example.com/?x=myworkdayjobs.com`——都會通過並被當作端點使用。真實的 Workday 端點不受影響。（由 CodeQL 回報，#443。）

### 說明
- 新增 `isWorkdayApi()` 解析 URL 並檢查主機（`server/lib/portals/adapters/workday.mjs`）。`tests/workday-adapter-endpoint.test.mjs`（+1）。測試套件：**2522**。


## [1.195.0] — 2026-08-14

**效能 (掃描器) — 在大掃描歷史上重複職位偵測依然很快。**

### 效能
- 在大的 `scan-history.tsv` 上，重複職位偵測不再退化為 O(N²)。此前按公司的標題分組是一個巢狀迴圈，對每一對都執行完整的 `roleFuzzyMatch`；現在改為倒排索引——一次遍歷按精確標題分桶，然後僅對共享判別性（非基線）詞元的不同桶做模糊比對。**輸出完全相同**——相同的重複職位叢集——透過對舊演算法在 200+ 隨機歷史上的差分測試證明。

### 說明
- `server/lib/detect-reposts.mjs` 中的 `groupRowsByTitle`（為差分測試匯出）。`tests/detect-reposts-grouping.test.mjs`（+2）。測試套件：**2521**。


## [1.194.0] — 2026-08-14

**修復 (掃描器) — 單段 URL 的 Workday 招聘頁面現在能正確掃描。**

### 修復
- Workday 轉接器現在能解析路徑為單一段的招聘 URL——例如 `https://parsons.wd5.myworkdayjobs.com/Search`、`.../KBR_Careers`、`.../Careers`。此前站點會退回 `External`，轉接器打到錯誤的 CXS 端點，探測看似正常卻什麼都不回傳。現在取路徑第一個非空段作為站點（丟棄 `en-US` 之類的語言前綴）；文件中的 `/en-US/External` 情形不變。（見 #255。）

### 說明
- `server/lib/portals/adapters/workday.mjs` 中的結構化路徑解析。`tests/workday-adapter-endpoint.test.mjs`（+5）。測試套件：**2519**。


## [1.193.0] — 2026-08-14

**新增 (統計) — 一個顯示值得提醒的面試的「面試後無回應」分頁。**

### 新增
- `#/stats` 中的**面試後無回應**分頁：超過禮貌等待期（預設 30 天）後陷入沉默的面試，彙整你進行中的面試與追蹤表——附上每個已沉默多久、最近一次面試日期和原因。一份溫和的提醒/收尾清單；僅為建議，絕不斷言被拒。零 token。

### 說明
- 新增 `GET /api/stats/rejection-latency` 中繼（指令稿缺失時 `{available:false}`）。`tests/stats-rejection-latency-route.test.mjs`（+2）。i18n 鍵 +10 ×17；`#/stats` help-hint 由 7→8 個分頁。測試套件：**2510**。


## [1.192.0] — 2026-08-14

**新增 (cv-studio) — 一個抓出你從未有過的數字的「核對履歷事實」關卡。**

### 新增
- `#/cv-studio` 中的**核對你的履歷事實**卡片：貼上適配的履歷或求職信，將其中每個斷言的指標和事實與你真實的履歷、檔案和 two-pager 核對。你會得到 **pass / warn / block** 判定，以及確切的編造指標、無據事實和禁用/警示片語——讓產生的履歷無法悄悄宣稱一個不屬於你的數字。零 LLM；不寫入任何內容。

### 說明
- 新增 `POST /api/cv-studio/verify-facts` 中繼：將文字寫入一次性暫存檔並執行 `verify-cv-facts.mjs`，即便指令稿在 block 時以 1 退出也信任 JSON 判定。`tests/cv-studio-verify-facts-route.test.mjs`（+4）。i18n 鍵 +15 ×17。測試套件：**2508**。


## [1.191.0] — 2026-08-14

**新增 (統計) — 「接下來學什麼」分頁，為優先學習的技能排序。**

### 新增
- `#/stats` 中的**接下來學什麼**分頁：跨整個追蹤表的技能缺口彙整——最常拖垮低匹配的缺失技能，按加權（每份評估報告的 5−匹配分）與 **Critical / High / Medium** 層級排序——外加你 CV/檔案已涵蓋的技能。唯讀、僅建議、零 token。

### 說明
- 新增 `GET /api/stats/upskill` 中繼（資料不足時帶 `{ error }` 欄位；指令稿缺失時 `{available:false}`）。`tests/stats-upskill-route.test.mjs`（+3）。i18n 鍵 +15 ×17。測試套件：**2504**。


## [1.190.0] — 2026-08-14

**新增 (追蹤表) — 「公司歷史」面板，告訴你哪些公司真的會回應你。**

### 新增
- `#/tracker` 上的**公司歷史**卡片：選擇一家公司即可取得唯讀證據——它對你的回應程度（**對你無回應** / **混合** / **此前有回應**），以及同一職位是否反覆**重新發布**——彙整你的追蹤表、跟進與掃描歷史。零 token；不呼叫掃描器。

### 說明
- 新增 `GET /api/stats/company-history[?company=]` 中繼（指令稿缺失時 `{available:false}`）。`tests/stats-company-history-route.test.mjs`（+3）。i18n 鍵 +18 ×17。測試套件：**2501**。


## [1.189.0] — 2026-08-14

**修復 (掃描器) — 用羅馬數字表示的資歷等級現在在非拉丁標題中也能辨識。**

### 修復
- `skip_tiers` 背後的層級分類器現在能在**任何文字系統**中讀取職位詞後的羅馬數字等級後綴（I / II / III / IV / V）——「Инженер III」、「エンジニア I」、「Ingénieur IV」——不僅限於 ASCII 詞之後。此前，非拉丁詞後的等級數字會被忽略，職位落入 **mid**，因此 `skip_tiers: [senior]` 或 `[entry]` 會漏掉這些職位。

### 說明
- `server/lib/classify-tier.mjs` 中與文字系統無關的後行斷言；移除了一個無效的重複 `Sr.` 匹配器。`tests/classify-tier.test.mjs`（+1）。測試套件：**2498**。


## [1.188.0] — 2026-08-14

**修復 (UI) — 主要操作按鈕不再緊貼頁面副標題。**

### 修復
- **每週面試摘要**、**已募資公司**、**入口**、**職涯規劃** 和 **職涯定位** 頁面的主要操作/控制列現在有了適當的上邊距，按鈕在副標題下方留有空間，而非緊貼其上。

### 說明
- 回歸護欄 `tests/lead-row-top-margin.test.mjs`（+5）。測試套件：**2497**。

## [1.187.0] — 2026-08-14

**修復(掃描器)——`skip_tiers` 設定重新生效:你要求按資歷跳過的職位會被剔除。**

### 修復
- `portals.yml` 中的 `skip_tiers:` 清單(如 `skip_tiers: [intern, entry]`)現在會被掃描採納。每個職位標題被分類為資歷層級(intern / entry / mid / senior),若其層級在清單中則被剔除。此前掃描執行標題 / 地點 / 內容 / 可信度過濾,但沒有層級過濾,因此 `skip_tiers` 被默默忽略。沒有明確級別詞的標題歸入 **mid**(所以 `skip_tiers: [mid]` 也會剔除大多數普通職位),分類器讀取最左側的級別詞。

### 說明
- 新增純模組 `server/lib/classify-tier.mjs`(`classifyTier` + `buildTierFilter`),接入 EN 與 RU 掃描器的過濾鏈。`tests/classify-tier.test.mjs`(+7)。套件:**2492**。

## [1.186.0] — 2026-08-14

**新增(CV 工作室)——「技能差距」面板:職位要求的技能中,你的履歷已列出、隱含或缺失的部分。**

### 新增
- **CV 工作室**中新增的**技能差距**面板。選擇一份已儲存的職位描述,它會把每項要求技能分類為**履歷已列出**、**履歷中隱含**或**缺失**——無 LLM 的詞語比較,不寫入任何內容。若職位沒有明確的要求部分,會出現低信心提示。

### 說明
- 新增 `GET /api/jds/:name/skill-gap`(職位名先經路徑清洗並確認位於 `jds/` 下,才作為參數;無腳本時軟回退為 `{available:false}`)。i18n 鍵 +13 ×17。測試:`tests/jds-skill-gap-route.test.mjs`(+4,含路徑穿越拒絕)。套件:**2485**。

## [1.185.0] — 2026-08-14

**新增(統計)——「漏斗與速度」分頁:你的漏斗與市場相比如何,以及你在各階段間推進的速度。**

### 新增
- **統計**中新增的**漏斗與速度**分頁,在市場基準區間旁顯示你的**回覆率**與**面試率**(保留小樣本與選擇偏差提示)、超過典型首次回覆視窗的進行中申請的**等待清單**,以及每階段**中位天數**(申請 → 回覆 → 面試 → Offer)——推進慢的列做右設限,以免拉偏中位數。唯讀、零 token;僅讀取你自己的追蹤器。

### 說明
- 新增 `GET /api/stats/funnel`(無腳本時軟回退為 `{available:false}`)。i18n 鍵 +18 ×17。測試:`tests/stats-funnel-route.test.mjs`(+2)。套件:**2481**。

## [1.184.0] — 2026-08-14

**修復(UI)——儀表板的快捷操作磁貼現在排成整齊的格線。**

### 修復
- 在儀表板(指揮中心)中,3 個磁貼的一組比 4 個的一組更寬,使各區塊右邊緣參差不齊。現在每組都使用等寬欄(寬螢幕 4 欄,視窗變窄時降為 3 / 2 / 1),因此所有磁貼大小一致、右邊緣對齊。

### 說明
- 僅 CSS(`.qa-grid`:用固定的 `repeat(N, minmax(0,1fr))` 取代 `auto-fill`)。由 `tests/dashboard-grid-align.test.mjs` 守護(+2)。套件:**2479**。

## [1.183.0] — 2026-08-14

**新增(掃描器)——更聰明的去重:帶追蹤連結重新發布的同一職位不再出現兩次。**

### 新增
- 掃描器現在透過**正規化 URL 鍵**辨識職位,因此帶追蹤參數(`?utm_…`、`gclid` 等)、`http` 與 `https`、或帶結尾斜線 / `#片段`重新發布的同一職位會被當作同一個——掃描結果與管道中不再有重複列,也不會對已看過的職位浪費一次評估。真正不同的職位(保留的功能性 id 如 `gh_jid`)仍分別計數。

### 說明
- 新增 `server/lib/url-key.mjs`,接入兩個掃描器的去重與管道寫入。刻意欠正規化——絕不合併兩個不同職位。測試:`tests/url-key.test.mjs`(+5)、`tests/parsers.test.mjs`(+1)。套件:**2477**(+6)。

## [1.182.0] — 2026-08-14

**修復(掃描器)——薪資區間現在在所有語言下顯示一致。**

### 修復
- 掃描與追蹤器列中的薪資數字改用地區中立符號 **≥** 與 **≤**(如 `≥ 120000 EUR`、`≤ 90000`),取代未翻譯洩漏到非英文介面的英文詞 "from" / "up to"。適用於所有回報單邊區間的看板(Getro、Remotli、Manfred、Agentic Jobs、JustJoin、Jobicy);雙邊區間(`100000–150000 USD`)本就中立。

### 說明
- 僅顯示——用戶端薪資過濾器無視前綴解析數字,過濾不變。套件:**2471**。

## [1.181.0] — 2026-08-14

**新增(掃描器)——Getro 招聘板現在顯示薪資、全部地點和遠端職位。**

### 新增
- **Getro** 掃描器(基金人才網絡招聘板)現在為每個職位顯示**薪資**(年薪範圍 + 幣別),列出**全部**地點而非僅第一個,並標記**遠端**職位。掃描與追蹤器中的 Getro 職位現在擁有與其他招聘板相同的薪資 + 地點資訊。

### 說明
- 僅掃描器;無新依賴,無路由 / CSP / SSRF 變更。測試:`tests/sources-getro.test.mjs`(+5)。套件:**2470**(+5)。

## [1.180.0] — 2026-08-14

**修復(中,報告)——`#/reports` 清單現在是表格,並復原了被 Machine Summary 佔位符隱藏的真實評分。**

### 修復
- **`#/reports` 清單是一個表格(報告 · 日期 · 可信度 · 評分),而不是 4 卡片格線。** 過長的「未偵測到評分」標籤會把標題欄擠到接近零,卡片標題的 `overflow-wrap: anywhere` 隨即把報告名逐字元換行。現在每個欄位都有自己的欄,名稱儲存格依詞換行,窄螢幕時表格橫向捲動(新增 `.reports-scroll` 容器)。新增 i18n 鍵 `rep.colReport` ×17。
- **內文中的真實評分(`**Итоговый балл:** 1.8 / 5`)不再被 Machine Summary 佔位符(`score: —`)隱藏。** 當 `## Machine Summary` 區塊帶有非數字或超出範圍的評分時,它會佔據已解析評分的位置並阻斷粗體值形式回退,於是即使內文有真實的 `X / 5`,報告仍顯示「未偵測到評分」。現在只要沒有可用數字殘留,`parseReportHeader` 就會復原內文的值形式(步驟 4.5)。

### 說明
- 僅用戶端 + 解析器;無路由 / CSP / SSRF / 父寫入變更。測試:`tests/reports-table.test.mjs`(+5)、`tests/report-header-locale.test.mjs`(+2)。套件:**2465**(+7)。

## [1.179.0] — 2026-08-13

**變更 (LOW, 掃描器) — 將 20 個重複的 HTML 實體解碼器合併到共用模組(對齊後續,關閉 worklist)。**

### 變更
- 20 個抓取型掃描來源各自帶有 `decodeEntities`/`decodeXmlEntities`(+ `fromCodePoint` 輔助)——這些副本已漂移(其中三個可能擲出 `RangeError`,已在 v1.172.0 修復;其餘允許 NUL/C0 或錯誤解析 `&#1a2;`)。現在全部經由單一的 `server/lib/html-entities.mjs`(符合 XML 1.0 Char 的安全解碼器),移除約 237 行重複。8 個 RSS 型來源新增 `&nbsp;` 解碼(此前只處理 5 個實體);cryptocurrencyjobs 刻意的雙重解碼透過別名保留。`hh` 保留自有解碼器(處理 `&mdash;`/`&ndash;`,在共用 6 個之外)。新的守護測試在任何來源重建本地解碼器時失敗。

### 說明
- 保持行為的重構;無路由 / CSP / SSRF / 父寫入變更。測試:`tests/decoder-consolidation.test.mjs`(+2)。套件:**2458**(+2)。

## [1.178.0] — 2026-08-13

**修復 (LOW, 父專案對齊) — 將兩個過時常數更新為與父專案一致(PARENT-SYNC GAP #4 + #5)。**

### 修復
- **瀏覽器 User-Agent(GAP #4)** — `BROWSER_LIKE_USER_AGENT`(workable/workday/oraclecloud/a16z/eightfold 用於通過 WAF/機器人門)從 Chrome 131 升到 **151**,與父專案 `user-agent.mjs` 一致;過時版本更易被攔截。由 `Chrome major ≥ 151` 測試守護。
- **追蹤器狀態 FALLBACK(GAP #5)** — `states.mjs` 的最後備用 `FALLBACK`(僅當即時 `templates/states.yml` 不可讀時使用 — 全新克隆 / CI 隔離根)新增父專案的土耳其語狀態別名(#2615):değerlendirildi、başvuruldu、yanıt verildi、mülakat、teklif、reddedildi、iptal edildi、uygun değil、kabul edildi/işe alındı。生產中即時檔案已提供這些。

### 說明
- 僅兩個常數;無路由 / CSP / SSRF / 父寫入變更。測試:`tests/http-json.test.mjs`(+1) + `tests/states.test.mjs`(+1)。套件:**2456**(+2)。

## [1.177.0] — 2026-08-13

**修復 (MEDIUM, 掃描器) — 對用工作階段 Cookie 保護搜尋 API 的租戶,csod(Cornerstone)回傳 0 個職缺(parent #2769,PARENT-SYNC GAP #1)。**

### 修復
- 部分 Cornerstone 租戶在啟動招聘網站首頁設定工作階段 Cookie,若這些 Cookie 不隨匿名 bearer 權杖一起回傳,搜尋 API 就回傳 `401 CSOD Unauthorized`。`sources/csod.mjs` 現在用新的 `fetchResponse` 輔助函式讀取啟動頁,從其 `Set-Cookie` 值建立 `Cookie` 標頭(`cookieHeaderFrom` — 僅 name=value,jar 語意)並在搜尋 POST 上重放。僅同源(主機固定 + `redirect:'error'`),工作階段 Cookie 絕不會到達第三方;不設定 Cookie 的租戶與之前完全相同。

### 說明
- 新增 `server/lib/http-json.mjs::fetchResponse`(純新增;不影響現有來源)。無路由 / CSP / SSRF / 父寫入變更。測試:`tests/sources-parity-v1118a.test.mjs`(+1)。套件:**2454**(+1)。

## [1.176.0] — 2026-08-13

**修復 (MEDIUM, 報告) — RU 表未列出的粗體標籤下的評分仍顯示 "Score not detected"(FIND-5)。**

### 修復
- 兩份 RU 報告把評分寫成 `**Итоговый балл:** 1.8 / 5` / `**Скор:** 1.8 / 5` — 這是 `REPORT_LABELS.ru` 未列舉的粗體標籤(只識別 "Оценка"/"Балл"),故評分未被解析。`parseReportHeader` 不再擴充同義詞清單,而是回退到**值的形態**:任意粗體標籤下按 /5 量表的分數。它與語言無關,對標題免疫(無 `**`、無 `/5` 值),並拒絕像 `5/5/2026` 這樣的日期(對分母做否定前瞻)。

### 說明
- 僅伺服器解析器;無路由 / CSP / SSRF / 父寫入變更。測試:`tests/report-header-locale.test.mjs`(+2)。套件:**2453**(+2)。

## [1.175.0] — 2026-08-13

**修復 (LOW, 加固) — 為 FIND-3 SEO 描述加回歸護欄 + 空值安全的合法性剝離(AI 評審跟進)。**

### 修復
- **SEO 描述一致性護欄** — v1.174.0 將各語言 `meta.desc` 中硬編碼的 "~55" 換成註冊表衍生的 `{adapters}` 佔位符,但沒有測試,下次編輯某個語言時可能悄悄回退。新的 CI 隔離測試 `tests/site-meta-desc-parity.test.mjs` 在 17 個 `site/src/i18n/*.json` 中任一遺失佔位符、重新硬編碼計數,或 `Landing.astro` 停止把它插入三個描述中繼標籤時失敗。
- **空值安全的合法性剝離** — `stripEmphasis` 對空值輸入回傳 `''` 而非字串 "undefined"(欄位以字串初始化,屬縱深防禦)。

### 說明
- 測試 + 解析器一行護欄;無路由 / CSP / SSRF / 父寫入變更。測試:`tests/site-meta-desc-parity.test.mjs`(+3)。套件:**2451**(+3)。

## [1.174.0] — 2026-08-13

**修復 (HIGH, 報告) — 本地化報告顯示 "Score not detected";SEO 描述過時。**

### 修復
- **評分解析 (FIND-1)** — H1 中包含評分標籤詞的非英文報告(`# Оценка вакансии: <標題>`)不再把該標題誤當作評分。`parseReportHeader` 現在錨定到本地化的**粗體**標籤(`**Оценка:** 1.5 / 5`),跳過標題行,並要求標籤緊鄰冒號 — 因此顯示 "Score not detected" 的 RU 報告會展示真實評分。
- **合法性徽章 (FIND-2)** — 從值中移除 Markdown 強調,徽章顯示 "High Confidence" 而非 "** High Confidence"。
- **評分溢出** — 帶尾隨狀態文字的評分行("1.8, Status: Evaluated, …")被壓縮為僅評分;`.score-pill` 新增不換行/溢出上限,標題欄可收縮,因此彩色徽章不會溢出卡片邊緣。
- **SEO 描述 (FIND-3)** — cvstart.org 的 meta / OG / Twitter 描述(全部 17 種語言)硬編碼 "Scan ~55 job boards",而內文依真實註冊表計數("~75")。描述現在插入註冊表衍生的計數,不會再漂移。

### 說明
- 伺服器解析器 + 用戶端渲染/CSS + 網站 i18n;無路由 / CSP / SSRF / 父寫入變更。測試:`tests/report-header-locale.test.mjs`(+4)。套件:**2448**(+4)。

## [1.173.0] — 2026-08-13

**新增 (LOW, 設定) — Hermes 加入被偵測的 AI CLI 清單 (career-ops 對齊)。**

### 新增
- `#/config` → 「AI CLI 工具」分頁現在會偵測 **Hermes**(Nous Research),即父專案新支援的代理執行環境(二進位 `hermes`)。`server/lib/routes/cli-detect.mjs` 的固定白名單從 10 個擴充到 11 個工具;偵測仍為唯讀 PATH 掃描(絕不執行任何二進位)。

### 說明
- 無 i18n / 路由 / CSP / SSRF / 父寫入變更;此清單為固定白名單,絕非輸入。套件:**2444**(cli-detect 金絲雀更新 10 → 11)。

## [1.172.0] — 2026-08-13

**修復 (MEDIUM, 掃描器) — 格式錯誤的 HTML 實體可能使掃描來源崩潰 (career-ops #2150 對齊)。**

### 修復
- `oraclecloud`、`gem` 與 `dassault` 來源在 `String.fromCodePoint` 之前僅以簡單的 `Number.isFinite` 檢查來解碼數字 HTML 實體 — 超過 `0x10FFFF` 的參照(例如格式錯誤或惡意來源中的 `&#99999999;`)會擲出未捕捉的 `RangeError`,中止該來源的整個解析。共用模組 `server/lib/html-entities.mjs`(鏡射父專案的 `_html-entities.mjs`)現在將數字參照限制在 XML 1.0 §2.2 Char 集合內,使 `String.fromCodePoint` 永不擲出,並分別比對十六進位與十進位,因此 `&#1a2;` 不再被錯誤解析。三個來源皆匯入它。

### 說明
- 對有效來源無行為變化;無 JS / i18n / 路由 / CSP / SSRF / 父寫入變更。合併其餘約 20 個來源內解碼器副本的工作記錄於 `qa/PARENT-SYNC-WORKLIST-v1.26.0.md`。
- 測試:`tests/html-entities.test.mjs`(+7)。套件:**2444**(+7)。

## [1.171.0] — 2026-08-13

**變更 (LOW,設計系統) — 字級刻度 + z-index 層權杖(D-4,第一步)。** 尺寸和堆疊此前按元件寫成字面量。

### 變更
- **z-index 層** — 引入 `--z-*` 權杖(`--z-topbar` … `--z-skiplink`),並**遷移所有 z-index 字面量**。值保持不變,堆疊一致;新的探針禁止新的魔法數字。
- **字級刻度** — `--font-size-*` 刻度(`xs 11` … `2xl 28`,base = Inter 15px);遷移元件已用的核心字級(無視覺變化)。刻度外的值逐步遷移(`docs/UX-ROADMAP.md`)。

### 說明
- 僅 CSS 權杖;無行為/JS/i18n/路由/CSP/SSRF/寫入變更。無像素變化。`tests/design-tokens-scale.test.mjs`(+3)。套件:**2437** (+3)。

## [1.170.0] — 2026-08-13

**新增 (LOW) — 長 AI 生成的誠實 ETA 提示(P4-ETA)。** 繁重的生成(職涯規劃 ~40 秒、定位 / 市場 / 人脈 ~30 秒、two-pager ~20 秒)只顯示「生成中…」,沒有時長感知。

### 新增
- 每個長生成按鈕旁現在顯示柔和的 **`⏱ ~N秒`** 提示(與 `#/auto` 的 ETA 一致)。共享 `.eta-hint` 樣式 + 兩個通用鍵(`common.eta` `~{n}s`、`common.etaTitle`)。

### 說明
- 僅用戶端;無路由/CSP/SSRF/寫入變更。i18n 鍵 +2 ×17(快照 1219 → 1221)。`tests/generation-eta-hint.test.mjs`(+2)。套件:**2434** (+2)。

## [1.169.0] — 2026-08-13

**新增 (LOW) — 內聯 PDF 預覽(D-5)。** `GET /api/output/pdfs/:name` 強制 `Content-Disposition: attachment`,因此連 `#/cv` 的「開啟」連結也是下載而非顯示。

### 新增
- **`?inline=1`** 以 `Content-Disposition: inline` 提供同一個經過驗證的檔案,讓瀏覽器在新分頁中算繪為 **👁 預覽**。預設(無參數)仍為下載。無新路由;相同的名稱防護。
- `#/cv` PDF 清單的第一個按鈕現為 **👁 預覽**(在下載旁邊)。`cv.openPdf`「開啟」→「預覽」×17。

### 說明
- 無 CSP/SSRF 變更 — 相同的 `sanitizePathName`。重寫 1 個現有 i18n 鍵 ×17(快照 1219)。`tests/output-pdfs.test.mjs`(+3)。套件:**2432** (+3)。

## [1.168.0] — 2026-08-13

**修復 (LOW, a11y) — 核取方塊列現在符合 WCAG 2.5.8 的 24×24 最小目標尺寸(D-2)。** `#/scan`、`#/config`、`#/evaluate`、`#/cv-studio` 上的核取方塊/單選標籤處於 ~22 px 的帶中。

### 修復
- 限定規則 `label:has(> input[type="checkbox"/"radio"]) { min-height: 24px }` 保證 ≥24 px 的帶。僅 `min-height` — 標籤本就是 flex,無位移;`.apply-checklist`(32 px)已合規。

### 說明
- 僅 CSS;無行為/JS/i18n/路由/CSP/SSRF/寫入變更。`tests/checkbox-target-size.test.mjs`(+1)。套件:**2429** (+1)。

## [1.167.0] — 2026-08-13

**修復 (LOW,設計系統) — 抬升表面現在與分隔線區分開(D-3)。** `--panel-2` / `--surface-elev1` 解析為 `--slate`,與分隔線 `--line` / `--border` 相同,沒有視覺區分。

### 修復
- 專用的主題感知權杖 **`--elev`**(淺色 `#eef1f6` / 深色 `#1e232e`,在兩種主題下都與 `--slate` 不同)現在支撐抬升表面;分隔線保持 `--slate`。其餘發現(D-2、D-4、D-5、P4-ETA)記入 `docs/UX-ROADMAP.md` 待辦。

### 說明
- 僅 CSS 權杖;無行為/JS/i18n/路由/CSP/SSRF/寫入變更。`tests/elevation-token.test.mjs`(+2)。套件:**2428** (+2)。

## [1.166.0] — 2026-08-13

**修復 (LOW) — 評分標準術語現在與規範文件一致。** career-ops.org/docs 描述為「五個維度加上整體綜合評分」,但 Web UI、cvstart.org 和 wiki 都說「六維度評分標準」(5 + 1 = 6,但用詞不一致)。

### 修復
- 採用文件措辭 — **「五個維度加上綜合評分」** — 一致套用於 README ×17、cvstart.org 網站 ×17、說明指南 ×17、`docs/career-ops-canonical.md` 和 wiki(Home ×17 + Features)。

### 說明
- 僅文件/行銷文案;無程式碼/i18n 鍵/路由/CSP/SSRF/寫入變更。`tests/rubric-terminology.test.mjs`(+2)。套件:**2426** (+2)。

## [1.165.0] — 2026-08-13

**修復 (LOW) — 「Two-pager」術語現在在每種語言內保持一致。** 阿拉伯語側邊欄顯示拉丁文「Two-pager」,而 `<h1>` 已完全在地化 — 是在其他方面鏡像的 RTL 導航中唯一的拉丁文字串。

### 修復
- **已落實決策:** 每種語言的 `nav.twoPager` 與 `twoPager.title` 使用一致術語(要麼都用拉丁文,要麼都在地化)。只有阿拉伯語不一致;其導覽標籤現已在地化(「الصفحتان」)。新的探針測試會在任何語言再次分裂時失敗。

### 說明
- 僅文案;無路由/CSP/SSRF/寫入變更。更改 1 個 i18n 值(ar);無新增鍵(快照 1219)。`tests/two-pager-term-consistency.test.mjs`(+2)。套件:**2424** (+2)。

## [1.164.0] — 2026-08-13

**修復 (LOW) — 頂欄搜尋佔位符在任何語言下都不再溢出。** 「Find a company, role or URL…」在搜尋欄收縮時被截斷,「…or URL」部分從未顯示。

### 修復
- `top.search`(×17)現為簡短的 **「搜尋或貼上 URL」**(每種語言 ≤24 字元),即使在窄欄也能容納並保留 URL 提示。`index.html` 回退一致;`aria-label` 保留完整說明。

### 說明
- 僅文案;無路由/CSP/SSRF/寫入變更。重寫 1 個現有 i18n 鍵 ×17(無新增;快照 1219)。`tests/search-placeholder-fit.test.mjs`(+2)。套件:**2422** (+2)。

## [1.163.0] — 2026-08-13

**修復 (LOW) — 應用內「詢問文件」助手現在涵蓋將報告匯出為 PDF。** 儘管 `#/reports/:slug` 有可用的 📄 Generate PDF 控制項,它此前卻回答指南未涵蓋此內容。

### 修復
- 在**全部 17 個說明包**的 §10 報告下新增 **「將報告匯出為 PDF」** H3(按鈕位置、檔案寫入 `output/*.pdf`、需要 Playwright、傳送前檢查)。助手檢索現在會顯示報告章節。

### 說明
- 僅文件/說明;無程式碼/路由/CSP/SSRF/寫入變更。說明門檻 **112 → 113 H3**(31 H2 不變)。`tests/help-reports-pdf-section.test.mjs`(+2)。套件:**2420** (+2)。

## [1.162.0] — 2026-08-13

**修復 (MEDIUM) — 說明 "?" 現在是 ≥24×24 的指標目標 (WCAG 2.5.8)。** `.help-hint` 在每個標題上為 `padding:0` 的 18×18 px,低於最小值。

### 修復
- `.help-hint` 盒子現在為 **24×24**(可測量目標),而**可見圓環仍為 18px** — 由置中的 `::before` 繪製,字形和 `<h1>` 基線不變。hover/啟用/焦點狀態隨圓環移動;外邊距 6→3px 保持間距。

### 說明
- 僅 CSS;無 JS/i18n/路由/CSP/SSRF/寫入變更。`tests/help-hint-target-size.test.mjs`(+2)。套件:**2418** (+2)。

## [1.161.0] — 2026-08-13

**修復 (MEDIUM) — `#/reports` 顯示「未偵測到評分」標籤而非空白。** 在 v1.159.0 的多語言解析器之後,仍無法解析評分的報告顯示空白區域,與失敗無法區分。

### 修復
- 評分儲存格現在分支:有評分 → 色調藥丸;無評分 → **`.score-muted`** 標籤(「未偵測到評分」,×17)+「開啟報告…」提示。卡片仍是可鍵盤操作的 `role="link"`,日期照常顯示。
- 複用現有中性權杖;無新顏色。

### 說明
- 僅用戶端;無路由/CSP/SSRF/寫入變更。i18n 鍵 +2 ×17(快照 1217 → 1219)。套件:**2416** (+3)。

## [1.160.0] — 2026-08-13

**修復 (HIGH) — 供應方文案不再與 7 家供應方的承諾矛盾。** `#/config` 稱即時評估「使用你的 Anthropic 或 Gemini 金鑰」,OpenAI 金鑰「不被 Web UI 使用」;儀表板寫「Anthropic-first scoring」 — 自 7 供應方級聯(v1.157.0)起皆為錯誤。

### 修復
- `config.providerModelNote`(×17):現聲明 ⚡ 即時評估以無頭方式在七個供應方金鑰(Anthropic · Gemini · OpenAI · Qwen · OpenRouter · GitHub Models · Hermes)中任意一個上執行,自動排序並回退。刪除關於 OpenAI 的錯誤句子。
- `dash.quick.evaluateSub`(×17):供應方中立(「0–5 匹配評分」)。`Keys: N / 5` → `N / 7`。

### 說明
- 僅文案;無路由/CSP/SSRF/寫入變更。無新增 i18n 鍵(快照 1217)。套件:**2413** (+3)。

## [1.159.0] — 2026-08-13

**修復 (HIGH) — 報告中繼資料不再與語言耦合。** 以非英語語言產生的報告在 `#/reports` 上顯示空白中繼資料列(無評分/日期/合法性),因為 `parseReportHeader` 只辨識英文粗體標籤。

### 修復
- `parseReportHeader` 現在解析語言無關的 `## Machine Summary` YAML 區塊(`score:` / `legitimacy:` / `date:` — 與 `auto-pipeline` 已讀取的來源相同)。優先順序:英文標籤 → Machine Summary → 在地化標籤(`REPORT_LABELS`,17 種語言)。英文報告逐位元組一致。
- 數字解析容錯(`1.5/5`、`1,5/5`、`1.5 из 5`、`4.5 out of 5`);內文無日期時回退到檔案 mtime。

### 說明
- 僅讀取/解析;無路由、CSP、SSRF 或父層寫入變更。無新增 i18n 鍵。套件:**2410** (+8)。

## [1.158.0] — 2026-08-12

**修復 — 兩個顯示層面的小問題(分頁標題中洩漏的 «?» 以及著陸頁錯誤的供應商數量)。** 僅顯示,無行為、安全或資料流變更。

### 修復
- HelpHint 的 «?» 不再洩漏到 `document.title`。路由器從未處理的 `h1.textContent` 衍生分頁標題,導致顯示為「Vacancy search?」而非「Vacancy search」。現在 `router.js::focusNewView` 複製標題、移除 `.help-hint` 後再讀取文字;頁面上可見的 «?» 保持不變。
- cvstart.org 顯示「17 AI providers」而非「7」。`Features.astro` 的 `sub()` 在按卡片替換前就把所有 `{n}` 改為語言數(17);現在 `{n}` 按卡片解析(供應商 → 7,語言 → 17)。

### 說明
- 無伺服器、路由、CSP、SSRF 或 i18n 鍵變更。套件:**2402** 項測試(+1)。

## [1.157.0] — 2026-08-12

**修復 —— 即時評估現在可用任一已設定的供應方執行,不再僅限 Anthropic/Gemini。** 僅設定 `OPENROUTER_API_KEY` 的使用者被錯誤強制進入手動模式。

### 修復
- **根本原因:** 無金鑰的 `LLM_PROVIDER` 釘選(如 `init` 寫入的 `LLM_PROVIDER=claude`)會走進死胡同;現在會在已設定的供應方之間按 auto 順序回退(在 `selectActiveProvider` 與兩條派發級聯中)。
- 用戶端門控(`#/deep` 與 mode-page 檢視)現改用 `window.ProviderStatus`(`/api/status/providers`,全部 7 個),不再用過時的 Anthropic/Gemini 探測;重寫文案(deep/eval × 17)+ 儀表板「即時評估」徽章 + `config.llmProviderHint`。

### 說明
- 無安全變更。套件:**2401** 項測試(+5)。

## [1.156.0] — 2026-08-12

**重構 —— 將 `scan.js` 拆分到大小上限以下(P-16)+ 一個 CodeQL 修復。** `scan.js` 原有 **906 行**;提取了兩個保持行為的工廠 → **648 行**。完成 P-15/P-16 檢視拆分。

### 變更
- 新增 `scan/runner.js`(掃描執行引擎)與 `scan/filters.js`(過濾狀態機),透過 `ctx`/`refs` 包;`scan.js` 連接兩者。

### 修復
- CodeQL `js/useless-assignment-to-local`(#428)於 `config/tab-controller.js`:`let n = i;` → `let n;`。

### 說明
- 純重構,行為不變;4 個讀取原始碼的測試已改指向。兩個大檢視現均低於 800(P-15/P-16 完成)。套件:**2396** 項測試。

## [1.155.0] — 2026-08-12

**重構 —— 將 `config.js` 拆分到大小上限以下(P-15)。** `config.js` 原有 **1030 行**(超過 800 行上限);提取了兩個保持行為的模組,降到 **783 行**。

### 變更
- 新增 `config/field-specs.js`(欄位資料 + 模型清單)與 `config/tab-controller.js`(分頁列工廠);`config.js` 引用它們,渲染邏輯不變。

### 說明
- 純重構,行為不變;6 個讀取原始碼的測試已改指向。`scan.js`(906)維持原樣(已部分拆分;核心耦合過重,機械拆分反而更糟)。套件:**2396** 項測試。

## [1.154.0] — 2026-08-12

**新指南 —— 「在雲端執行整個技術棧」。** career-ops 自身沒有雲/伺服器說明,故新增一份:把父級 **career-ops** 流水線、此 **career-ops-ui** 檢視器與 AI **引擎**(透過 Claude Code 的 **Claude 訂閱**、本機 **Hermes**,或 API 金鑰)放到一台常開小型伺服器上的分步指南。以 17 種語言的**說明 §31**、README 章節和 wiki 頁面提供。

### 新增
- **說明 §31 「在雲端執行整個技術棧」**(× 17)—— 三個部分、開通 + 安裝、選擇引擎、安全暴露(HTTPS 反向代理 + 認證 + CSP/SSRF/XSS/無金鑰不變式)。說明包擴展到 **31 H2 / 112 H3**。
- **README** —— 「在雲端執行整個技術棧」章節(× 17)+ wiki 的 **Cloud-Deployment** 頁面。

### 說明
- **僅文件** —— 無路由、伺服器或用戶端改動;無新增 i18n 鍵。說明的 4 個測試改為 31 H2 / 112 H3 契約。套件:**2396** 項測試(不變)。

## [1.153.0] — 2026-08-12

**Jobvite 掃描器遷移到公開 XML 來源(父專案同步)。** 父專案下線了 Jobvite JSON API(現在回傳零職缺);web-ui 的 source 用的正是這個失效端點,因此任何被追蹤的 Jobvite 公司都靜默掃描為空。移植父專案修復(`#2623`):現在讀取以 `companyEId` 為鍵的公開按租戶 **XML 來源**。

### 修復
- source 呼叫已下線的 JSON API 並回傳零職缺;現改為呼叫 `https://app.jobvite.com/CompanyJobs/Xml.aspx?c={companyEId}` 並解析 XML `<result><job>…`(CDATA + 實體解碼,`detail-url` 優先於 `apply-url`)。

### 變更
- `companyEId` 解析:(1) 入口的 `company_eid:`,(2) 明確 `api:` 的 `c=` 參數,(3) 看板頁探索。`fetchText`(`http-json.mjs`)在 non-ok 錯誤上附加 `.location`/`.retryAfter`(唯讀,向後相容)。

### 說明
- **安全** — 兩個主機(`jobs.jobvite.com`、`app.jobvite.com`)在每次請求前由 `assertJobviteUrl` 固定:僅 https、嚴格白名單、**從不跟隨重新導向**。`companyEId` 僅為 `?c=` 值;source 數量不變。
- 套件:**2396** 項測試(+4)。

## [1.152.0] — 2026-08-12

**Hermes 供應方 — 接線完成 + 文件同步。** 對 v1.151.0 Hermes 整合的程式碼審查發現兩處真實缺口與四項完整性事項,皆於此修正;並將全應用的 LLM 供應方清單在所有文件面與 17 種語言中補齊為完整的七個。

### 修復
- **`#/config` 無法強制 Hermes** — `LLM_PROVIDER` 下拉僅列出六個供應方,因此可設定 `HERMES_API_KEY` 卻無法在 UI 中強制 Hermes。現在 `hermes` 是第 8 個選項,新增的一致性測試可防止下拉再次與 `LLM_PROVIDERS` 偏離。
- **較短的自架金鑰被靜默拒絕** — `isUsableKey` 的 20 字元下限是按雲端金鑰校準的;`hasHermesKey` 現改用放寬的 8 字元下限(Hermes 文件範例為 19 字元)。

### 變更
- 供應方清單在 README(× 17)、應用內說明(× 17)、`config.llmProviderHint` 字典(× 17)與 `docs/sdd` 中統一為完整七個;`hermesChatUrl` 會補全無路徑的主機;手動回退文案點名 Hermes。

### 說明
- **安全性不變** — 無新路由、無 SSRF/CSP 變動;health/doctor 新增一列 `HERMES_API_KEY`。
- 套件:**2392** 項測試(+2)。

## [1.151.0] — 2026-08-12

**Hermes 現已成為已接上的 LLM 供應方（Phase 5）** — Phase 5 的調查確認 Nous Research 的 Hermes 提供一個 **相容 OpenAI 的 API Server**（`hermes gateway` → `POST /v1/chat/completions`),因此 career-ops-ui 現在像 OpenAI/Qwen 一樣透過本機 Hermes 執行即時評估。在 **應用設定** 中設定 `HERMES_API_KEY`,它便加入 auto 順序(最後一個)。收尾路線圖最後一個未決項 —— **Phase 5, Shape A**。

### 新增
- **Hermes LLM 供應方（Shape A）** — 共享 `runOpenAICompatible` 客戶端之上的 `runHermes`(`server/lib/openai.mjs`),在 **兩個** 級聯(`llm-dispatch.mjs` + `routes/llm.mjs`)中設閘,auto 順序尾端 + `LLM_PROVIDER=hermes` 固定項、`/api/status/providers`、`llm-pricing.mjs`。以 Bearer 認證存取可設定的本機 base URL(預設 `http://127.0.0.1:8642/v1`)—— 這是 **已設定** 的供應方端點(如 OpenRouter/Qwen),而非使用者提供的職缺 URL,因此不經過 SSRF 防護。
- **`#/config` 欄位** — `HERMES_API_KEY`(機密) + `HERMES_BASE_URL` + `HERMES_MODEL`(預設 `hermes-agent`),6 個新 i18n 鍵 × **17 種語言**(快照 1208 → 1214)。

### 變更
- 調查已解決:`docs/integrations/HERMES.md`、應用內說明 §30（× 17）、README 預告（× 14）、`hermes-bridge` 技能與路線圖,從「規劃中 / 尚未接上」轉為 **已接上（Shape A）**。無需 Shape B(客製的代理執行環境 relay)。

### 說明
- **安全:** 供應方的 fetch 是一個已設定端點,與其它相容 OpenAI 的供應方同類 —— 無新增 SSRF 面,無 CSP/清洗器改動。`HERMES_API_KEY` 是 `SECRET_KEY`(絕不回顯)。
- 測試(CI 隔離、樁傳輸):`tests/hermes-provider.test.mjs`(+5);v1.146.0 的「無 Hermes 分支」哨兵被 **反轉**,改為斷言其已接上;供應方面測試更新為 7 供應方順序。
- 套件:**2390** 項測試(+5)。

## [1.150.0] — 2026-08-12

**一致的空狀態(Phase 4 打磨)** — 每個「尚無內容」面板現在都透過唯一的共享 `.empty` 樣式繪製,而不再由個別視圖用魔法數字 `40px` 行內重複宣告外觀。一次小的視覺一致性修正;`#/activity`、`#/cv-studio`、`#/stats`、`#/usage` 的空狀態現在與其它所有面板一致(權杖化的 48px 內距 + 虛線邊框)。

### 變更
- **`#/activity`、`#/cv-studio`、`#/stats`、`#/usage`** 移除了空面板上的行內 `style: { padding: '40px', textAlign: 'center', color: 'var(--foggy)' }` —— 這三個屬性共享的 `.empty` 類別已經提供(`--space-7` = 48px、置中、淡色、虛線邊框)。於是這四個與其它約 25 個 `.empty` 面板繪製完全一致。
- 各視圖正當的覆寫(`#/dashboard` `width:100%`、`#/pipeline` `border:none`)未動 —— 僅移除純冗餘的重複宣告。

### 說明
- **僅用戶端 CSS 用法清理** —— 無路由、伺服器、i18n 鍵或 CSS 規則改動(`.empty` 類別本身不變);字典快照 1208。已在瀏覽器驗證(`#/usage` 空面板計算為 48px 內距 + 虛線邊框,0 主控台錯誤)。
- 新哨兵測試 `tests/empty-state-consistency.test.mjs` 讓 `.empty` 保持唯一真實來源。Phase 5(Hermes 供應方)仍被阻擋。
- 套件:**2385** 項測試(+2:`tests/empty-state-consistency.test.mjs`)。

## [1.149.0] — 2026-08-12

**入口已移入設定(Phase 4)** — `#/portals` 現位於 **Setup** 導覽分組中、*應用設定* 旁,而不再在 *Sourcing* 下。自 v1.144.0 起它就是一個設定介面(啟用/停用追蹤的公司 + ATS 健康探測),而非 sourcing 操作 —— 所以這才是它該在的位置。僅導覽調整;頁面與路由不變。

### 變更
- **`#/portals` 導覽項 → Setup 分組**(位於 `public/index.html`),緊接 *應用設定* 之後。已從 *Sourcing* 分組移除(該分組保留 Scan / Pipeline / Auto-pipeline / 已融資公司)。`#/portals` 路由、視圖與 `nav.portals` 標籤均不變 —— 僅側邊欄位置移動。

### 說明
- **僅導覽標記** —— 無路由、視圖、i18n 鍵或伺服器改動。已在瀏覽器驗證(0 主控台錯誤);由 `tests/portals-nav-placement.test.mjs` 保護。
- 套件:**2383** 項測試(+2:`tests/portals-nav-placement.test.mjs`)。

## [1.148.0] — 2026-08-12

**更清爽的掃描篩選(Phase 4)—— 篩選面板現已改為整潔的網格** —— `#/scan` 的篩選面板從寬度參差、由剛性方框組成的 flex-wrap 改為響應式網格,「套用 / 重設」操作現在獨佔一列並靠右對齊。篩選項與行為不變 —— 只是更易閱讀。一次設計打磨(無 parent-sync)。

### 變更
- **`#/scan` 篩選面板 → 響應式網格** —— `.scan-filters` 現為 `display: grid`,欄為 `repeat(auto-fill, minmax(180px, 1fr))`,間距均勻,使 11 個帶標籤的篩選項在任意寬度下都對齊成整潔的欄,而不再參差地換行。
- **套用 / 重設操作** 橫跨整個網格獨佔一列,以一條細線分隔並靠右對齊。移除了 `scan.js` 中舊的隱藏標籤技巧 + 內部 flex 包裹。

### 說明
- **僅 CSS + 少量 DOM 清理** —— 每個篩選項 id(`#scan-filter-*`、`#scan-apply`)與 `SR.render()` 的接線均未改動,因此 Playwright 流程不受影響。無新增 i18n 鍵。
- 已在瀏覽器驗證(0 主控台錯誤);由 `tests/scan-filters-grid.test.mjs` 保護。
- 套件:**2381** 項測試(+3:`tests/scan-filters-grid.test.mjs`)。

## [1.147.0] — 2026-08-12

**Hermes & Telegram —— 應用內說明章節 + cvstart.org 介面(Phase 5b，第 2 部分)** —— Hermes 文件工作的第二部分,也是最後一部分:操作說明現已放入應用自己的說明指南中,涵蓋全部 17 種語言,應用內文件助理也據此回答 Hermes 相關問題。仍僅限文件 —— Hermes LLM 供應方路徑仍處於 **規劃中 / 尚未接上**(Phase 5)。

### 新增
- **應用內說明 §30「Hermes & Telegram」× 17 種語言** —— 新的指南章節(Hermes 是什麼 + 兩種整合形態;在雲端伺服器上執行;經 Hermes 轉發到 Telegram + 「不該公開什麼」規則),可從 `#/help` 存取。`docs-assistant` / `DocsFab` 的 grounding 會自動取得它(兩者都讀取 `docs/help/<lang>.md`)。
- **cvstart.org —— 指向 Hermes 指南的連結**,跳轉到 GitHub 文件。

### 變更
- 說明套件門檻提升至 **29 → 30 H2 / 105 → 108 H3**(`canonical-docs-coverage`、`help-ui`、`help-ru-config-section`);§30 新增 3 個 H3。

### 說明
- **目前仍沒有任何程式碼呼叫 Hermes。** 新哨兵測試 `tests/help-hermes-section.test.mjs` 斷言每種語言都包含帶有語言無關錨點(`docs/integrations/HERMES.md`、`hermes-bridge`、`#/help`、`127.0.0.1`、Telegram)的 §30。該供應方仍卡在 Phase 5 的 API 合約調查上。
- 這就收尾了 Phase 5b 的 **文件 + 技能** 交付物;供應方整合(Phase 5)仍是一個獨立且被阻擋的事項。
- 套件:**2378** 項測試(+2:`tests/help-hermes-section.test.mjs`)。

## [1.146.0] — 2026-08-12

**Hermes 代理 + Telegram——整合指南 + 一個 skill（Phase 5b，第 1 部分）** — 你可以在雲端伺服器上執行 career-ops-ui,並透過 Nous Research 的 Hermes 代理把它的事件(一次完成的掃描、一份新報告、一次緊急跟進)串接到 Telegram。本次發布提供設計 + 部署文件與一個 hermes-bridge skill;Hermes LLM 供應方路徑仍處於規劃中/尚未接上的狀態(卡在 Phase 5 的 API 契約調查上)。這是刻意讓文件先行於程式碼。

### 新增
- **`docs/integrations/HERMES.md`** — 深度指南:兩種整合形態(相容 OpenAI 的 endpoint 與代理執行環境)、雲端伺服器部署(reverse proxy + HTTPS + systemd,在無頭伺服器上對 parent 的唯讀約定)、經 Hermes 轉發到 Telegram,以及一份威脅模型「不可暴露的內容」清單(不向頻道暴露履歷/薪資/報告內文/金鑰)。
- README 中的 **`## Hermes agent + Telegram`** 預告 — 英文 README 中的簡短指引 + 連結,並同步到已完整翻譯的各語言 README。
- 一個讓指南可落實執行的 **`hermes-bridge` skill**(`.claude/skills/hermes-bridge/`)——前提條件與範圍檢查(Node ≥ 18、金鑰是否存在、透過 SSRF 安全路徑確認 endpoint 可連通),絕不將金鑰寫入磁碟/日誌,並拒絕捏造 Hermes 的 endpoint 或宣稱該供應方已接上。
- `docs/architecture/OVERVIEW.md` 中新增 **Integrations** 小節連結到該指南。

### 說明
- **目前還沒有任何程式碼呼叫 Hermes。** 一個哨兵測試(`tests/hermes-docs.test.mjs`)斷言「規劃中/尚未接上」的誠實標記仍然存在,並確認 `llm-dispatch.mjs` 中沒有 Hermes/Nous 分支——因此日後接上該供應方時,必須在同一次變更中同步更新文件 + roadmap。
- **延後至 v1.147.0**（Phase 5b，第 2 部分):應用內說明中的「Hermes & Telegram」H2 小節 × 17 種語言,以及 cvstart.org 的行銷頁面。
- 套件:**2376** 項測試(+4:`tests/hermes-docs.test.mjs`)。

## [1.145.0] — 2026-08-12

**有洞察力的統計（續）：可重建圖表** — `#/stats` 的「目標職位趨勢」分頁新增 **建立圖表** 小工具：選擇指標 × 維度即可即時重繪。使用者提出的 UX 需求（無 parent-sync）。

### 新增
- **指標 × 維度可重建圖表** — 選擇**指標**（職缺數 / 薪資中位數 / 平均薪資）和**維度**（依國家/地區 / 依職位），長條圖即時重繪。薪資類指標遵循貨幣 + 每年 ⇄ 每月切換；職缺數為簡單計數。
- 8 個新 i18n 鍵 × **17 種語言**；快照 1200 → 1208。

### 說明
- 已在瀏覽器驗證（0 主控台錯誤）。套件：**2372** 項測試（+2）。

## [1.144.0] — 2026-08-12

**設定與過濾（階段 4，第 1 部分）：啟用/停用追蹤的入口** — 現在可在 `#/portals` 開啟或關閉受監看的公司，掃描器會遵循此設定。使用者提出的 UX 需求（無 parent-sync）。

### 新增
- **`#/portals` 上依公司的啟用/停用開關** — 一鍵關閉某入口（EN 掃描器已略過 `enabled: false` 的公司，因此停用的入口會從此後所有掃描中移除）或重新開啟，並帶樂觀提示。
- **`POST /api/portals/toggle`** — 一次明確的使用者寫入，外科式且經解析驗證地切換 `portals.yml` 中某公司的 `enabled` 旗標（註解、順序及其他欄位均保留）。5 個新 i18n 鍵 × **17 種語言**；快照 1195 → 1200。

### 說明
- 掃描器改動為**零** — `en-scanner.mjs` 已依 `enabled !== false` 過濾。套件：**2370** 項測試（+3）。

## [1.143.0] — 2026-08-12

**更易理解（續）：核心工作流頁面的 `?` 提示** — 說明 `?` 現在涵蓋九個主要操作頁面，支援所有語言。使用者回報的 UX 改進（無 parent-sync）。

### 新增
- **再為 9 個檢視標題加上 `?` 說明提示** — `#/scan`, `#/evaluate`, `#/cv-studio`, `#/tracker`, `#/config`, `#/deep`, `#/batch`, `#/auto`, `#/apply` 均獲得內聯 `?`（透過 `HelpHint.title`），點擊開啟在地化的「這是什麼 / 如何使用 / 會得到什麼」彈出框 — 與 v1.139.0 相同的 CSP 安全元件。
- 9 個新 i18n 鍵 × **17 種語言**（`help.hint.scan`/…/`apply`）；快照 1186 → 1195。

### 說明
- 已在瀏覽器驗證（0 主控台錯誤）。套件：**2365** 項測試（+1）。

## [1.142.0] — 2026-08-12

**修正：不再出現「Unknown」職業原型** — `#/orientation` 現在始終從八個具名的職業向量中排名，而非偶爾回答「Unknown」並建議你在其上「加倍投入」。使用者回報的修正（無 parent-sync）。

### 修復
- **`#/orientation` — AI 提示現在禁止集合之外的原型。** 模型必須從恰好八個具名向量中排出前三，且**絕不**回答「Unknown」/「N/A」/「資料不足」或臆造標籤。履歷單薄時仍以較低信心指出最接近的三個並說明缺少哪些證據，而非拒答。

### 說明
- 僅伺服器端提示變更（`buildOrientationPrompt`）；無 i18n/架構變更。套件：**2364** 項測試（+1）。

## [1.141.0] — 2026-08-12

**有洞察力的統計（續）：募資公司資訊強化** — `#/funded` 更具視覺化：公司標誌、依募資額的圖表，以及含輪次 / 金額 / 發現評分 / 建議操作的卡片。使用者回報的 UX 改進（無 parent-sync）。

### 變更
- **`#/funded` — 扁平表格 → 卡片網格。** 每家近期募資的公司現在都是一張卡片，含**標誌**（由公司名推導，失敗時用字母頭像）、**輪次**+**金額**標籤、上層專案的**發現評分**與**建議操作**，以及募資新聞連結與日期。
- **募資額視覺化** — 依已揭露金額排名的頭部公司橫向長條圖；"$120M"/"€1.5B" 等自由文字金額由新的 `parseAmount` 解析為量級。3 個新 i18n 鍵 × **17 種語言**。

### 說明
- 仍為 `GET /api/company-funded` 之上的**唯讀**；簡介與薪資範圍不在募資資訊來源中。套件：**2363** 項測試（+2）。

## [1.140.0] — 2026-08-12

**有洞察力的統計：更豐富的薪資數字** — `#/stats` 的「我的管道」薪資細分現在顯示**平均值**（不只是中位數）、**每年 ⇄ 每月**切換，以及依國家的**最低 · 平均 · 中位數 · 最高**表格。Phase 3 的第一部分。使用者回報的 UX 改進（無 parent-sync）。

### 新增
- **平均薪資** — `RoleStats.salaryStats` 現在於 `minUsd`/`medianUsd`/`maxUsd` 之外回傳 `avgUsd`。中位數抗離群值，平均值揭示偏斜，兩者結合便讀作一個分佈。
- 薪資部分的**每年 ⇄ 每月切換**與依國家的**最低 · 平均 · 中位數 · 最高表格**（連動貨幣與週期選擇器）。8 個新 i18n 鍵 × **17 種語言**。

### 說明
- 數字仍僅來自可解析薪資的職缺並正規化為 USD（僅供參考）。套件：**2361** 項測試（+1）。

## [1.139.0] — 2026-08-12

**更易理解：`?` 說明提示** — 一個可重複使用且符合 CSP 的 `?` 按鈕，點擊後以您的語言說明「這是什麼 / 如何運作 / 會得到什麼」。使用者回報的 UX 改進（無 parent-sync）。

### 新增
- **`?` 說明提示彈出框**（`window.HelpHint`）——標題旁的圓形 `?` 會開啟一個輕量、隨主題變化並在 RTL 下鏡像的彈出框，透過 `UI.md()` 顯示在地化說明；具可存取性（`role="tooltip"`、`aria-expanded`、按 Esc 或點擊外部關閉、焦點回歸）且符合 CSP。
- 在 **`#/stats` 的 5 個分頁**和 **8 個 AI／分析檢視標題**（career-plan、定位、two-pager、人脈、模擬面試、記憶、funded、每週彙總）上新增 `?` —— 14 個新 i18n 鍵 × **17 種語言**。

### 說明
- 所有檢視原本就有一行副標題；`?` 在此基礎上按需提供更深入的說明，也讓空狀態自我說明。套件：**2360** 項測試（+4）。

## [1.138.0] — 2026-08-12

**依介面語言生成** — 所有 AI 生成現在都以你在介面中選擇的語言回覆，並含評審驅動的測試加固。使用者回報的 UX 改進（無 parent-sync）。

### 變更
- **AI 生成現在遵循介面語言。** 當介面設為俄語、西班牙語、日語……時，生成文字會以**該**語言返回，而不再總是英語。輸出語言指令已貫穿**所有**生成端點——職涯規劃、定位、市場報告、模擬面試、人脈計畫、「向文件提問」、記憶便箋建議以及 two-pager 草稿。程式碼與識別碼保持英文（如 two-pager 的 YAML 鍵），僅正文、標題與要點被在地化。

### 修復
- **CSS 顏色角色守衛**（`tests/css-role-tokens.test.mjs`）——一個靜態金絲雀，斷言 v1.137.0 暗色模式別名權杖絕不反轉角色：文字角色權杖（`--fg`/`--danger`/`--ok`/…）絕不用作 `background`，表面角色權杖（`--card`/`--panel`/`--line`/…）絕不用作文字 `color`，涵蓋全部 CSS 與 SPA 內聯樣式。
- **`UI.md()` XSS 載入器自檢** ——從 `api.js` 載入 `md()` 的測試現在在擷取後立即用 `md('<script>…')` 探測，若跳脫缺失即拋錯，使未來的錯誤切片**響亮地**失敗，而不是讓安全套件在被截斷的函式上變綠。
- **`#/career-plan` 捲動守衛** ——生成後的 `scrollIntoView` 僅在預覽仍連接到文件時執行。

### 說明
- `docs/UX-ROADMAP.md` 已更新：`?` 說明提示 + 頁面說明 + 空狀態改為 **v1.139.0**；**Nous Research / Hermes** 供應方（含雲端伺服器 + Telegram 部署指南與 Hermes 技能）記為 **階段 5 / 5b**。
- 套件：**2356** 項測試（+5）。

## [1.137.0] — 2026-08-11

**可讀性與呈現修復** — 深色模式對比、圖表標籤，以及職涯規劃。一次由使用者回報驅動的 UX 修正（非父專案同步）。

### 修復
- **深色模式下多個畫面出現白底白字／黑底黑字** — 多個檢視所參照的十五個 CSS 自訂屬性（`--fg`、`--panel`、`--panel-2`、`--ok`、`--danger`、`--card`、……）從未宣告，因此退回為硬編碼的淺色／黑色數值：淺色模式下無妨，深色模式下卻無法閱讀（`#/pipeline` 概覽晶片、`#/stats` 的活動分頁、`#/config` 的 "Active / Keys" ＋ "✓ set"、`#/two-pager` 各區段、`#/mock-interview` 的問題泡泡、錯誤文字）。現已將其別名指向真正會隨主題變化的 token，因此會自動跟隨主題切換 —— 經自動化稽核工具驗證，**全部 29 個檢視共 0 項 WCAG-AA 對比失敗**；`#/config` 的活動分頁已改為易讀的淡色徽章樣式。一項回歸防護（`tests/dark-theme-tokens.test.mjs`）確保它們持續維持別名對應。
- **`#/stats` 的圖表標籤原本會在單字中間被截斷**（"Senior Backend Engineer" → "…Enginee"）— 現在會以省略號結尾，完整標籤則保留在滑鼠停留提示中。
- **`#/career-plan` 原本將產生的規劃以未經處理的 Markdown 顯示** — 現在會自動渲染為格式化、易讀的文字（可編輯的 Markdown 仍保留在文字框中；Preview 可切換顯示方式）。

### 備註
- `#/career-plan`、`#/two-pager`、`#/stats` 與每週面試摘要並非故障 — 在你產生規劃／取得資料之前，它們會顯示空白狀態。更清楚的頁面內說明與 `?` 說明提示已排入下一步計畫（`docs/UX-ROADMAP.md`）。

## [1.136.0] — 2026-08-11

對齊父專案 career-ops **v1.26.x**（v1.26.0 主線之後）— 一個新的零驗證來源，加上對 web-ui 鏡像程式碼的一系列品質與穩健性移植。註冊表現有 **79 個來源 = 74 個英文 + 5 個俄文**（`ALL_ADAPTERS` 74）。

### 新增
- **`eightfold`**（Eightfold AI，#2684）— 透過零驗證的 `https://<tenant>.eightfold.ai/api/apply/v2/jobs` API 讀取人才招募看板，主機固定為 `*.eightfold.ai`（品牌化的 `careers.<company>.com` CNAME 則刻意予以拒絕）；採分頁讀取，並設有安全上限、失效看板拋出、URL 去重。含來源 + adapter + CI 隔離測試套件；已出現在 `#/scan` 的 Source 篩選器與首頁。

### 修復
- **支援 Unicode 的去重與職稱鍵**（#2569 / #2587 / #2667）— 新的共用 `normalizeTextKey`（NFKC，保留任何文字系統的字母／符號／數字）取代了僅限 ASCII 的鍵：`detect-reposts` 現在能將全形／半形與標點差異的公司變體歸為同一群（"Acme, Inc." 等同於 "Acme Inc"），且絕不會把不同的非拉丁文雇主誤併；而 `role-matcher` 會折合全形職稱，並保留非拉丁文職稱字詞，而非將其抹除。
- **`fetchJsonWithRetry` 不再對遭拒的重新導向進行重試**（#2657）— `redirect:'error'` 防護遇上 3xx 屬於確定性結果，因此現已標記為不可重試，會直接快速失敗，而不會白白耗盡重試預算。
- **`title_filter.positive` 的 AND 群組**（#2552）— positive 項目中以空白分隔的 ` + ` 現在會要求每個詞彙皆須出現在職稱中，不論順序。
- **`oraclecloud` 現已接受帶編號的租戶頂級網域** `oraclecloud1.com … oraclecloud99.com`（#2683）— 一個有界的網域家族（不含前導零、至多 2 位數字），絕非萬用字元頂級網域。
- **`workable` 強化**（#2675）— 針對由 Cloudflare 代管的主機加入重試、類瀏覽器標頭與請求序列化。
- **`personio` 在 XML 動態消息被停用時會改用 HTML 爬取作為後備方案**，而不是直接回傳空結果。
- **`states` 的 FALLBACK 別名已與父專案重新同步**（#2615）。

### 備註
- 未移植（web-ui 未鏡像該功能，或僅限 CLI）：`reply-matcher`（#2672）、`jd-similarity`（#2661）、`jd-skill-gap`（#2686）、掃描的環境變數路徑（#2568）／`--flag=value`（#2589）解析，以及求職信／CV 範本／doctor／ollama／generate-pdf 相關變更。網頁版的 `js-yaml`／`nanoid` HIGH 級別安全公告已於 web-ui v1.135.0 修補。

## [1.135.0] — 2026-08-11

對齊父專案 career-ops **v1.26.0** — 五個新的零驗證掃描來源，加上對 web-ui 既有四個看板的正確性修復。註冊表現有 **78 個來源 = 73 個英文 + 5 個俄文**（`ALL_ADAPTERS` 73）。

### 新增
- **五個新掃描來源**（各自為一個來源 + adapter + CI 隔離測試套件；皆已出現在 `#/scan` 的 Source 篩選器與 cvstart.org 首頁）：
  - **`join`**（JOIN）— 透過 `join.com/companies/<slug>` 中 Next.js 的 `__NEXT_DATA__` 讀取公司自己的 JOIN 看板（主機固定、頁數上限）。
  - **`getro`**（Getro）— 透過公開的 `api.getro.com` POST API 讀取創投「人才網絡」投資組合看板，依最新優先排序分頁；每筆職缺皆歸屬於投資組合中的雇主，而非基金本身。
  - **`consider`**（Consider）— 透過同源 POST 讀取 getconsider.com 的創投投資組合看板；設定驅動的主機由結構化 SSRF 防護把關（僅限公開 HTTPS 主機）。
  - **`joinup`**（JOINUP）— 瑞士看板 joinup.ch，讀取伺服器端渲染（SSR）後的最新頁面；爬蟲邏輯故障時採失敗封閉策略。
  - **`remotli`**（Remotli）— remotli.ch，瑞士公司的遠端職缺（瑞士法郎薪資）；會發出雇主自身的 ATS 投遞連結，使跨站重複刊登得以去重。

### 修復
- **a16z Speedrun** 不會再因暫時性異常而中止整個看板 — 頁面擷取現已改用共用的 `fetchJsonWithRetry`（僅對暫時性的 429／5xx／逾時進行有限次數重試，永不重試永久性的 4xx），並已重新調整頁數上限以配合單頁 50 筆職缺。
- **arbeitsagentur** 已改用 v6 版 Jobsuche API（`/pc/v6/jobs`）— 舊版 v4 端點已回傳 404；回應結構已重新命名，遠端篩選現已改為伺服器端縮限。
- **thehub** 已改用 v2 版 `jobsandfeatured` API；各列不再附帶刊登日期，並排除於時效篩選之外。
- **hackernews** 現能可靠找到每月的「Who is hiring?」討論串 — 已將 Algolia 查詢改為以 `author_whoishiring` 帳號標籤過濾，取代原本的自由文字查詢。

### 備註
- 未移植（web-ui 已屬安全、由中繼吸收，或僅限 CLI）：Unicode 角色去重／公司比對鍵（web-ui 的轉發分組本就以純小寫字串作為公司鍵，因此不同的非拉丁文雇主名稱永遠不會被誤併）；跟進的拒絕延遲訊號 + 獲投公司微調（皆以唯讀方式中繼，失敗自動降級）；掃描的環境變數可覆寫路徑與 `--flag=value` 解析（web-ui 以同進程執行掃描器）；User-Agent 整併重構（web-ui 已將其集中管理）；以及僅限 CLI 的項目（未受信任內容名單、oferta／offer-prep、doctor、求職信／CV 範本變更）。

## [1.134.1] — 2026-08-05

驗證強化 — 本次修復源自一次全專案稽核。

### 修復
- **`successfactors` 現在不會在掃描中途失敗時捨棄已擷取的職缺**（v1.134.0 死板拋出邏輯移植所致的回歸）— 其分頁迴圈原本沒有 `try/catch`，因此第 2 頁起（第 1 頁已成功）發生失敗即會拋出錯誤並捨棄所有已收集的結果；而若該次失敗是 `404`（超出範圍的 `startrow`），`en-scanner` 便會將一個仍在運作的租戶誤判為失效長達數日。現已對齊 `phenom`／`radancy`：第 0 頁失敗仍會拋出錯誤（判定為失效看板），但較晚頁面的失敗會保留已取得的部分結果。
- **`#/scan` 篩選晶片現已可用鍵盤操作**（WCAG 2.1.1）— 面向晶片（以及「清除」晶片）原本是帶有點擊事件處理器的 `span`，卻沒有 `tabindex`／角色，導致鍵盤與螢幕閱讀器使用者無法聚焦或切換它們。現在皆已附上 `role="button"`、`tabindex="0"`、`aria-pressed`，並支援 Enter／Space 鍵啟用。
- **三個硬編碼的英文字串現已完成本地化** — `#/scan` 信任徽章提示、`#/scan` 搬遷欄位標頭，以及 `#/dashboard` 評分標頭原本皆為裸露字面值，i18n 對應完整性檢查機制看不到它們（因為它們從未被定義為鍵），因此在所有非英文語系中始終顯示英文。現已改用 `scan.trustTip` + `scan.col.reloc`（2 個新鍵）以及重複使用既有的 `track.col.score`，並附上原始碼靜態測試把關。

## [1.134.0] — 2026-08-05

對齊父專案 career-ops v1.25.0。

### 新增
- **新增掃描來源:getManfred**(`manfred`)—— 一個橫跨全站的西班牙／歐盟科技職缺消息來源,附帶公開薪資,取自 `www.getmanfred.com/api/v2/public/offers`(零驗證、主機固定 + 僅限 HTTPS、單一請求取得完整目錄)。新增來源 + adapter,以及一套 CI 隔離測試套件(`tests/sources-manfred.test.mjs`);註冊表現有 **73** 個來源 = 68 個英文 + 5 個俄文(`ALL_ADAPTERS` 68)。已出現在 `#/scan` 的 Source 篩選器,以及 cvstart.org 首頁。

### 修復
- **a16z Speedrun 消息來源會靜默截斷至 50 筆職缺**(#2404)—— 該消息來源每頁上限為 50 筆,但此來源原本請求 `PER_PAGE = 100`,導致第一頁後分頁即中止。已修正為 50。
- **失效的職缺板現在會拋出錯誤,而非誤判為「正常但空白」**(#2379)—— `cryptocurrencyjobs`、`phenom`、`radancy`、`successfactors`:當沒有任何一次請求成功解析時,現在會拋出錯誤(使 `#/portals` 健康檢查與掃描能記錄真實的失敗),而非將其吞噬為一份空清單;掃描過程中若在至少一次成功之後才失敗,仍會保留部分結果。
- **workable 現已改用公開 widget API**(#5ab8425)—— 已切換至 `apply.workable.com/api/v1/widget/accounts/<slug>`,可於單一請求中取得大型帳號的完整職缺清單,大型帳號因此不再遭到截斷。

### 備註
- 未移植(僅限 CLI 或未鏡射至 web-ui):detect-reposts #2389 的標題分組效能重寫;Unicode 公司鍵修復(web-ui 自身的追蹤器去重機制已對非拉丁字元安全);`scan --since`;`cv-facts`;CV 範本／PDF 稽核工作;`doctor`;modes 未受信任內容指令。

## [1.133.1] — 2026-08-02

### 修復
- **`#/funded`（獲投公司）現在會渲染結果** — 兩個錯誤讓此表格即使在父專案的 `company-funded.mjs` 已回傳完整清單時，仍一律顯示查無獲投公司。(1)檢視原本從 `res.candidates` 讀取結果，但父專案實際發出的鍵是 `companies`(每筆為 `{ company, amount, round, funding: { sources: [{ source, url, observed_date }] } }`);客戶端現在讀取正確的鍵，並對映至真實的證據結構。(2)結果表格先前以可變參數方式將儲存格傳入 `UI.el('tr', {}, …)`，但 `UI.el(tag, attrs, children)` 的 `children` 參數僅接受單一節點或陣列，因此只有第一欄（公司）會被渲染 — 儲存格現在改以陣列傳入。已在真實瀏覽器中驗證：四個消息來源共 11 間公司皆已正確渲染，涵蓋公司／募資訊號／來源／日期四欄，證據連結可正常運作，0 主控台錯誤。空結果現在也會一併顯示各來源的診斷資訊，讓「今日無新聞」與「來源被封鎖」得以區分。
- `tests/parity-routes-v1133.test.mjs` 新增回歸測試把關：假父專案指令稿現在會發出真實的 `companies` 輸出結構（原始測試固件鏡射了錯誤的 `candidates` 結構 — 這正是此錯誤能夠綠燈上線的原因），並新增原始碼靜態測試哨兵，斷言 `funded.js` 讀取的是 `res.companies`（絕非 `res.candidates`），且以陣列形式建構表格列的子節點（+1 → **2144**）。

## [1.133.0] — 2026-08-01

### 新增
- **獲投公司探索（`#/funded`，對齊父專案 #2117）** — 一個新的唯讀檢視，透過 `GET /api/company-funded` 中繼父專案 career-ops 的 `company-funded.mjs`：一份「先審閱、後採用」的近期獲得資金公司清單，發掘自公開、且主機固定的資金動態消息來源（TechCrunch、PR Newswire、The Guardian、Hacker News）。此中繼以 `--json --dry-run` 執行腳本（JSON 輸出至 stdout，不寫入任何檔案），絕不將使用者輸入納入 `--sources`，附帶速率限制，並由使用者觸發（一個 **Discover** 按鈕，絕不在掛載時自動執行）。新增路由模組 `server/lib/routes/funded.mjs` + `public/js/views/funded.js`，歸類於 Sourcing 之下。
- **每週面試摘要（`#/interview-digest`，對齊父專案 #2129/#2130）** — 一個新的唯讀檢視，透過 `GET /api/interview/weekly-digest` 中繼父專案零 LLM 的 `weekly-digest.mjs`：機械式彙整面試場次筆記——本週與哪些公司、哪些輪次進行了面試、重複出現的職能，以及盡力而為的待補缺口。選用的 `?from=&to=` 範圍僅在兩者皆為合法 `YYYY-MM-DD` 時才會被納入；空範圍屬於合法的 `available:true` 摘要。新增至 `server/lib/routes/interview.mjs` + `public/js/views/interview-digest.js`，歸類於 Analytics 之下。
- 兩個中繼皆遵循既有的失敗自動降級 `available:false` 契約，適用於父專案腳本缺席時（CI、獨立安裝）。新增 26 個 i18n 鍵 ×17 語系；CI 隔離測試套件 `tests/parity-routes-v1133.test.mjs`（+5 → **2143**）。

### 備註
- 父專案 career-ops 已推進超過 v1.24.0，帶來 Next.js `web/` 應用的 Follow-up Tracker 頁面（#1422）與後端 PDF 渲染（#2182）——未移植：web-ui 已有自己的跟進中繼與 PDF 執行器，而底層的 `followup-cadence.mjs` 強化透過外殼呼叫中繼即可免費取得。`set-status.mjs` / `tracker-utils.mjs` 的變更屬於 CLI 內部，未鏡像移植。

## [1.132.0] — 2026-07-31

### 變更
- **`#/scan` 結果渲染子系統抽取至 `public/js/lib/scan-results.js`**(檔案大小規範債務攤還 — `public/js/views/scan.js` 已成長至 ~1254 行)。該子系統(`renderResults`、`buildChipRow`、`getRows`、列/面向建構器、選項繪製器,以及 `FALLBACK_SOURCES` 註冊表鏡像)已移入一個 `window.ScanResults.create(ctx)` 工廠函式,其閉包捕捉檢視所提供的情境物件。**無行為變化** — 函式原封不動搬移,閉包變數改接至 `ctx.*`;`scan.js` 現為 ~906 行(第二輪抽取以邁向 800 行目標,現正規劃中)。
- 原始碼靜態測試透過 `tests/helpers/scan-src.mjs::loadScanSrc()` 讀取這兩個檔案;`tests/scan-fallback-sources.test.mjs` 現在改為從 `scan-results.js` 讀取註冊表鏡像。
- **新增瀏覽器內回歸測試把關** — `tests/playwright-scan-filters.mjs` 植入一份固定的 `data/last-scan.json`,並驅動每一個 `#/scan` 篩選器,斷言精確的列數(`npm run test:e2e:browser`);並新增了穩定的篩選控制項 ID(`#scan-filter-*`、`#scan-apply`)。
- README「最新版本」橫幅精簡為單行摘要 + 完整變更日誌連結(冗長的多版本敘事牆已退役)。已套用至全部 17 個語系。

## [1.131.2] — 2026-07-31

### 變更
- **`app.css` 拆分為三個依序載入的樣式表**(檔案大小規範債務 — 單一檔案已成長至約 1990 行,遠超 800 行的硬性上限)。現分為 `app.css`(約 672 行 — 無障礙、設計權杖/主題、側邊欄、主內容區、按鈕、內容外殼)、**`components.css`**(約 595 行 — 卡片、格線、分頁器、徽章、表格、表單、紀錄/主控台、markdown、語言切換器、篩選晶片、連線橫幅),以及 **`overlays.css`**(約 737 行 — 提示訊息、通知抽屜、彈窗、雜項/響應式、`[dir="rtl"]` 鏡像、docs-fab、usage-hud),每個檔案皆在硬性上限之內。
  - 切分方式為**連續且依原順序**,因此串接結果與拆分前的檔案**逐位元組完全相同**;`index.html` 依序以三個 `<link>` 載入。**無任何行為、標記或 i18n 變更。**
  - 斷言 CSS 的測試現在透過共用的 `tests/helpers/css.mjs::loadAppCss()` 輔助函式讀取串接結果。新增 `tests/css-modularization.test.mjs` 鎖定此拆分(檔案存在 · 各檔案 ≤ 800 行 · `index.html` 連結順序)→ 測試套件 **2138**。已於瀏覽器中驗證:三個樣式表皆能正確解析且其規則正確生效。

## [1.131.1] — 2026-07-31

### 修復
- **兩個 v1.130.0 來源的配接器主機固定一致性**(程式碼審查跟進項目,縱深防禦;對合法輸入無行為變化):
  - **`a16z-speedrun-talent` 配接器**現在會在 `buildEndpoint` 重新驗證 `api:` / `a16z-speedrun-talent:` 覆寫值(HTTPS + 精確主機 `speedrun-talent-network.com`),失敗時降級回退至規範動態消息 — 與 `cryptocurrencyjobs` 配接器一致,確保非法主機值永遠不會進入擷取槽位(先前僅依賴擷取時的 `assertSpeedrunUrl` 把關)。精確主機檢查現已整併為單一匯出的 `SPEEDRUN_TALENT_HOST_RE`,由把關函式與配接器共用。
  - **`cryptocurrencyjobs` 解析器** — `cleanUrl` 現在使用與 `assertCryptocurrencyJobsUrl` 及配接器覆寫值相同的精確比對主機把關(原為 `endsWith`,會誤放行子網域)。解析器絕不會比 SSRF 把關更寬鬆:`sub.cryptocurrencyjobs.co` 的項目連結會被捨棄。
  - +2 個測試 → **2135**。

## [1.131.0] — 2026-07-31

### 新增
- **`#/tracker` CRM 階段分頁看板**(移植自父專案 web app 的 `/pipeline` 檢視)。追蹤器原本的漏斗晶片列 + 狀態下拉選單,已由**階段分頁列**取代:一個 **All** 分頁,外加每個規範狀態各一個分頁 — **Evaluated · Applied · Responded · Interview · Offer · Rejected · Discarded · SKIP · Hired** — 每個分頁都顯示即時的全歷史計數,**包含零計數的階段**,讓完整漏斗隨時可見(CRM 風格)。使用中的分頁驅動篩選;再次點擊會清除回到 All。各列仍保有其分數色調、合法性、PDF 與報告等操作項,且啟用標誌後,公司欄現在會顯示品牌標誌(預設關閉 → 零額外請求)。
  - 新增唯讀路由 **`GET /api/tracker/stages`**,回傳規範漏斗(依序排列的標籤)+ 別名摺疊對映表,來源為 `server/lib/states.mjs`(`templates/states.yml`,並附內建回退)— 因此客戶端**永不硬編碼狀態白名單**。舊版無參數的 `GET /api/tracker` 回應維持不變(僅 `{ rows }`)。
  - 新增純函式、附單元測試的客戶端函式庫 **`public/js/lib/tracker-stages.js`**,依伺服器的階段將各列分類,並容許零散的 markdown 粗體與在地化別名(例如 `aplicado` → `Applied`)。分頁具備無障礙支援(role tablist/tab、aria-selected、≥44 px 命中區域、計數包含在每個分頁的無障礙名稱中)。無新增 i18n 鍵。測試套件現為 **2133** 個。

## [1.130.0] — 2026-07-31

### 新增
- **兩個新掃描來源,移植自父專案 career-ops v1.24.0**(同進程,無新相依;皆出現於 `#/scan` 的 Source 篩選器與 cvstart.org 落地頁):
  - **a16z Speedrun**(`a16z-speedrun-talent`,#2231)— a16z Speedrun *人才網絡*(talent-network)全站 JSON 動態消息。主機固定為 `speedrun-talent-network.com`,僅限 HTTPS,0 起始分頁並附頁數上限,依公司貫穿 `q`/設定,失敗自動降級。
  - **Cryptocurrency Jobs**(`cryptocurrencyjobs`)— Web3 職缺看板 `cryptocurrencyjobs.co`,透過其公開 RSS 2.0 動態消息擷取(零驗證)。兩階段 XML 實體解碼,僅列出遠端職缺,雇主名稱從標題尾端的「"… at <Company>"」解析而得。
  - 註冊表總數現為 **72 個來源 = 67 個英文 + 5 個俄文**(`ALL_ADAPTERS` = 67 個英文入口配接器)。

### 修復
- **`echojobs` — 混合制職缺與遠端職缺保持可區分**(鏡像父專案 #2258)。不分大小寫的 `hybrid` 標記現在會產生 `"<City> · Hybrid"`(無城市時則為單純的 `Hybrid`)與 `workplaceType: 'Hybrid'`,而不再被併入 `Remote`。
- **`radancy` — 舊版 TalentBrew 標記語言 + JSON 結果片段傳輸**(鏡像父專案 a3e6df9),以可注入的 `opts.fetchJson` 把關。

### 備註
- **未移植 — 僅限 CLI 的父專案功能。** career-ops v1.24.0 龐大的 CLI/模式面向仍不進入 web-ui(它是檢視器 + 輕量寫入通道,不是模式主機):合規/管轄區資料表、聯絡人電話簿 + vCard、面試逐字稿覆盤 / 通話平台偵測、ledger set-status、結果紀錄、兩階段篩選、jd-similarity、具版本的申請-CV artifact schema、doctor 的 Playwright-MCP 偵測,以及 `portals/fix-slugs.mjs`。存在於父專案 `scan.mjs` 中的掃描編排變更 — Interamt.de 的 Playwright 掃描器、iCIMS 反向 ATS 全面掃描、國家資格遠端篩選、DNS 查詢節流、StepStone 的 `rltr` 去重,以及掃描歷史的正規化公司欄位 — 皆不適用:web-ui 以同進程執行 EN/RU 掃描器,不會 shell 呼叫 `scan.mjs`。
- **已涵蓋。** `role-matcher` 的重音摺疊修復(#2209)已於 v1.127.0 移植,此處為 no-op。

## [1.129.1] — 2026-07-29

### 修復
- **對 v1.128/v1.129 web 移植的 AI 審查跟進**(均為諮詢性,源頭修復):`job-facets.js` 級別優先序(顯式修飾詞現在勝過管理詞 — `Senior Engineering Manager` → `senior`,原為 `lead`);`states.mjs` 回退不再被固定(成功讀取仍記憶化,回退不快取回傳 — 啟動時父專案短暫不可用會在下次呼叫重讀)+ 對存在但損毀的檔案 `console.warn`;`score-tone.js` — 無評分的列為中性(`muted`)而非紅色;`domainFromName()` 在 `/api/logo` 前跳過非 ASCII slug;+`tests/states.test.mjs` 隔離守衛。+4 個測試 → **2073**。

## [1.129.0] — 2026-07-29

### 新增
- **`#/scan` 級別面向 + 時長欄** — v1.128.0 的 `job-facets.js` 函式庫現已接入掃描 UI(先前僅邏輯)。新的**級別**下拉將每筆職缺標題歸入 lead/staff/senior/mid/junior/intern(`JobFacets.seniorityFromTitle`),並依結果中實際存在的項自動填入(與國家面向一致);無級別詞的標題一律通過。可在已儲存搜尋、重設與套用中保持。結果表新增**級別**徽章欄與零 token 的**時長**欄(`今天`/`N天`,來自 `JobFacets.daysSince`)。12 個 i18n 鍵 ×17,+3 個測試 → **2069**。

## [1.128.0] — 2026-07-29

### 新增
- **從父專案自有 Web 應用(`../web/`,Next.js)移植四項解決方案** — 以原生 JS/ESM 重新實作,無新相依:(1)`server/lib/states.mjs` 即時讀取 `templates/states.yml` 作為追蹤器狀態詞彙的唯一來源(含 CI 回退)— 免除每次發佈的手動白名單重新同步;POST 將別名(西班牙語/舊版)摺疊為規範標籤,GET 漏斗按規範狀態分桶;(2)ATS 託管列的公司標誌 — `domainFromName()`(約 90 個品牌→網域);(3)`score-tone.js` — 4 級評分色調(≥4.2/3.8/3.0 + 字母回退);(4)`job-facets.js` — seniority/source/days 面向。+21 個測試。

### 備註
- 未移植(僅概念):父專案的代理動作層(`actions/registry.ts` + `api/assistant/route.ts`)— 供 `docs-fab` 升級為副駕時的藍圖。無新來源(註冊表 **70**),無 i18n/help 變更。

## [1.127.0] — 2026-07-29

### 新增
- **三個新掃描來源(career-ops v1.23.0 一致性)** — 註冊表現提供 **70 個配接器(65 EN + 5 RU)**:**Flowxtra**(免驗證全站聚合器)、**VDAB**(法蘭德斯公共就業服務關鍵字 API)、**iCIMS**(`careers-<tenant>.icims.com` 入口,區別於 `jibeapply`)。此外 **Cursor** 回歸 CLI 名單(parent #2115):`cli-detect` 現偵測 `cursor`(**10 個工具**),並在 help/README/config ×17 還原名單。

### 修復
- **agenticjobs** 從 HTML 抓取改為 REST API(#2167);當 `location.name` 僅為工作模式時,**Greenhouse** 從 `/offices` 還原城市(#2104);**role-matcher** 一致性(#1933/#2164/#2009:MTS 前綴、`product` 基線、重音摺疊、次基線分歧)。

### 備註
- **未移植。** v1.23.0 大部分為 web-ui 不呼叫的 CLI/儀表板介面(batch-tailor、discover-ats、NL/PT 模式、PDF 主題、Go 儀表板、updater/doctor);中繼腳本無需改動。父專案 VERSION → **1.23.0**。

## [1.126.1] — 2026-07-25

### 修復
- **v1.126.0 重新同步遺漏的兩處 CLI 名單漂移** — (1) `#/config` 的 **API keys** 分頁導語(`config.providerModelNote`,i18n ×17)只列出 7 個 CLI — 現在 **Antigravity** 與 **Grok Build** 已插入 OpenCode 之後;(2) 說明指南(×17)的第二個對比表列以及 CI 建置的網站 help 仍寫著 `Inside Claude Code / Codex / Cursor / Gemini CLI`(含過時的 **Cursor**)— 現為完整名單。兩處使用了 v1.126.0 掃描模式未涵蓋的斜線/間隔號分隔符。i18n 快照已重新生成;套件仍為 **1969**。

## [1.126.0] — 2026-07-25

### 新增
- **AI CLI 工具分頁現在偵測 career-ops 全部 8 個一級 CLI** — `#/config` 名單已與父專案 `docs/SUPPORTED_CLIS.md` 同步:`server/lib/routes/cli-detect.mjs` 新增 **Grok Build CLI**(`grok`)與 **Kimi CLI**(`kimi`),Antigravity 現在優先探測其規範二進位 `agy`。唯讀 PATH 掃描現回報 **9 個工具**,仍然從不執行找到的二進位。

### 變更
- **與 career-ops.org/docs 的文件重新同步** — 已將每個文件面與父專案的即時頁面(全部 31 頁已讀)核對。規範 AI 助手名單(help ×17 + README ×17)現列出 8 個一級 CLI — Claude Code、Codex、OpenCode、Antigravity CLI、Grok Build CLI、Qwen Code、Kimi、GitHub Copilot CLI — 外加 Gemini CLI(舊版包裝)。說明包保持 29 H2 / 105 H3 結構。

## [1.125.4] — 2026-07-23

### 變更
- **site 相依套件**(dependabot #151–#153)— `site/` 中 `sharp` 0.34.5→0.35.3、`svgo` 4.0.1→4.0.2、`fast-uri`(dev)3.1.3→3.1.4;Astro 建置通過,對 SPA/伺服器無影響。

### 備註
- **父專案一致性巡檢(career-ops `37d17ec..254764a`,v1.22.0 之後)** — 無需移植: `set-status` 錯列防護(#2108)僅限 CLI(web-ui 的追蹤器列在 UI 中明確選取,且沒有路由呼叫 `set-status.mjs`);在地化模式的 Risk Summary(#2109)涉及 web-ui 從不讀取的 `modes/<lang>/` 檔案(僅讀取頂層 `modes/*.md`);`update-system` 資訊清單驗證(#2111)僅限更新器;其餘為父專案文件(土耳其語 README、SIGNATURES ×4、SCRIPTS.md、es 重音)。父專案 VERSION 維持 **1.22.0** — `parentVersion` 不變。

## [1.125.3] — 2026-07-23

### 修復
- **丹麥語與印地語的 LLM 提示詞以英文回答**(使用者回報)— `server/lib/prompts.mjs` 中的 `LOCALE_NAMES` 與五個 `SCAFFOLD_STRINGS` 區塊從未擴充到 `da` 與 `hi`,導致 `resolveLocale()` 回退至 `en`,深度研究(即時與手動)、模式執行、評估、面試、人脈、CV Studio 等所有 AI 提示詞在這兩個語言下都遺失了 `# Output language` 指令。現在兩者皆為一等公民: 語言指令 + 在地化鷹架。`tests/locale-scaffold.test.mjs` 的迴歸閘門現在遍歷正規的 17 語言清單而非硬編碼的 12 個,新的結構一致性閘門會使任何回退到英文的鷹架鍵失敗 — 未來遺漏 `prompts.mjs` 的語言無法再出貨(+12 個測試,套件現為 **1969** 個)。

## [1.125.2] — 2026-07-22

### 修復
- **Gemini 深度研究:HTTP 502(`MALFORMED_FUNCTION_CALL`)**(#145,由 [@Alien10140](https://github.com/Alien10140) 貢獻)— 即時 `/api/deep` 提示詞要求模型「Use WebFetch / WebSearch」並將簡報存檔,但無工具的 API 供應方沒有工具通道;Gemini 以函式呼叫而非文字回應,呈現為空白的 HTTP 502。`buildDeepPrompt` 與 `bundleProjectContext` 新增 `headless` 旗標:即時執行(Anthropic/Gemini/備援串接)取得無工具提示詞,僅憑內嵌上下文撰寫簡報;供 Claude Code 複製貼上的提示詞則保留工具指示。`tests/critical-fixes.test.mjs` 新增 1 個測試。

### 變更
- **Gemini 預設模型越過已棄用的 `gemini-2.0-flash`**(#144,由 [@Alien10140](https://github.com/Alien10140) 貢獻)— 設定下拉選單、`gemini.mjs` 的伺服器備援(先前與提示悄悄不一致)、OpenRouter 備援鏈、`config.geminiModelHint` ×17 及說明指南 ×17 現統一指向 **`gemini-3.6-flash`**。新的防漂移閘門 `tests/gemini-default-model.test.mjs`(+5 個測試)將所有表面釘在同一字面值上 — 套件現為 **1957 個測試**。

## [1.125.1] — 2026-07-21

### 修復
- **SuccessFactors:多品牌 RMK 租戶保留其品牌路徑**(父專案 #2099,v1.22.0 之後)— 同時經營多個收購品牌、共用同一套 RMK 執行個體的控股公司,以路徑片段來區分品牌(`careers.nemetschek.com/Bluebeam/` vs `…/Vectorworks/`);此轉接器先前會將設定的 URL 收斂為其 origin,因而悄悄地只掃描母品牌的職缺。現在該端點會保留品牌前綴,只剝除結尾的 `/search/` 或 `/tile-search-results/` 區段,確保掃描絕不會自我重複;單一網域的租戶逐位元組不變。新增匯出的 `resolveTenantBase` 輔助函式,並在 `tests/sources-successfactors.test.mjs` 中移植 1 個測試區塊。

## [1.125.0] — 2026-07-21

### 新增
- **cvstart.org:「求職來源」登陸頁區塊** — 在截圖與比較清單之間新增一個區塊,將**全部 67 個掃描來源以可點擊標籤的形式列出**(62 個英文求職看板/ATS,外加獨立列在小標題下的 5 個俄文看板),每個標籤都連結到該來源的公開網站。此清單於建置時從實際的轉接器登錄檔(`sync-assets.mjs` → `facts.sources`)同步而來,因此永遠不會與應用程式本身出現落差;`Sources.astro` 中人工整理的連結對照表由新增的 `tests/site-sources.test.mjs` 把關。頁首導覽新增了 **Sources** 錨點;新增 4 個網站 i18n 鍵 × 17 種語言。同時修正了登陸頁 JSON-LD 中 `inLanguage` 清單先前遺漏 `hi` 的問題。

## [1.124.0] — 2026-07-21

### 新增
- **五個掃描來源**(與父專案 v1.22.0 對齊,#1808/#1572/#2024/#2055)— **Welcome to the Jungle**(全站 JSON API)、**Agentic Engineering Jobs**(agentic／AI 工程看板)、**Jobvite**(零認證按租戶 ATS)、**Gem**(按租戶 ATS),以及 **Alibaba Group**(求職 JSON API,美團／騰訊模式)。每一個都是主機固定、CI 隔離的來源 + 轉接器組合;註冊表現在提供 **67 個轉接器(62 個英文 + 5 個俄文)**;`#/scan` 的 Source 下拉選單後備清單及其漂移關卡已同步更新;新增五個測試套件 `tests/sources-{wttj,agenticjobs,jobvite,gem,alibaba}.test.mjs`。

### 修復
- **Arbeitsagentur:僅當 `homeofficetyp` 為 `VOLLSTAENDIG` 時才判定為全國遠端**(與父專案 #1981 對齊)— `homeoffice=nv_true` 查詢也會回傳混合辦公的職缺,因此遠端判定現在會以小批次方式對照職缺詳情端點逐一確認每筆結果,並採取失敗封閉策略(查詢失敗時保留該職缺原本的城市,讓地點篩選器仍能正常運作)。
- **SmartRecruiters:公開職缺網址建置時未帶 `/postings/`**(與父專案 #2047 對齊)— 對於公開網站省略該區段的租戶,連結現在會導向公開職缺頁面,而非導致 404。

### 備註
- 父專案 v1.22.0 同時出貨了一些 CLI 端變更,網頁介面並不透過命令列呼叫它們,或已自行涵蓋對應功能:簡體中文 CV 模板 + PDF 排版、`/expand` 模式、供應方 prompt 快取微調(Gemini／OpenAI／Ollama)、逐步 token 明細(網頁介面有自己的用量計量器)、追蹤器寫入鎖序列化(網頁介面自 v1.21 起已透過 `withFileLock` 進行寫入路由)、掃描的 `visa_filter` + 絕對刊登日期 CLI 旗標(網頁介面有自己的「刊登於…之內」時效篩選器),以及已見來源去重種子(網頁介面掃描器維持自有的掃描歷史去重機制)。

## [1.123.0] — 2026-07-17

### 新增
- **Oracle Recruiting Cloud 掃描來源**(與父專案 v1.21.0 對齊,#1929)— Oracle Fusion／ORC 求職網站的零認證 `recruitingCEJobRequisitions` REST API(JPMorgan Chase、Oracle、BNY Mellon、American Express、Honeywell 等公司採用):主機固定為 `*.fa[.<region>][.ocs].oraclecloud.com`,站點編號從每間受追蹤公司的 `careers_url` 解析而得,採用附硬性頁數上限的位移分頁,並附上具備 WAF 意識的類瀏覽器標頭。註冊表現在提供 **62 個轉接器(57 個英文 + 5 個俄文)**;`#/scan` 的 Source 下拉選單後備清單及其漂移關卡已同步更新;新增 CI 隔離測試套件 `tests/sources-oraclecloud.test.mjs`。

### 修復
- **重複刊登偵測器:基礎職稱與專門後綴變體保持區分**(與父專案 #1922 對齊)— 「Senior Analytics Engineer」不再與「Senior Analytics Engineer, People Analytics」歸入同一群組:當某職稱的詞元是另一職稱詞元的嚴格子集,且多出的詞元屬於真正的專門化用語(而非基礎詞彙)時,兩者會被視為各自獨立、可分別刊登的職缺。重複刊登註記(如「(Repost)」、「relisted」)現已被列為中繼雜訊並納入停用詞。`tests/detect-reposts.test.mjs` 新增 2 項斷言。

### 備註
- 父專案 v1.21.0 同時出貨了一些 CLI 端變更,網頁介面並不透過命令列呼叫它們,或已自行涵蓋對應功能:重複投遞同一公司的警示(網頁介面自 v1.84.0 起已內建再投遞冷卻機制)、求職信的 `--format`／`--report` 旗標、面試紅旗訊號／面板情報／未出席通知信的提示模式、掃描信任訊號與入口網站健康狀態持久化(網頁介面以自有的 in-process 掃描器搭配 `trust-validator` 與 Portals 健康頁面運作),以及統計／薪資落差擴充功能(以唯讀、失敗自動降級的方式轉發)。

## [1.122.0] — 2026-07-16

### 新增
- **印地語(हिन्दी)— 第 17 種語言** — 完整的 UI 詞典(約 1,110 個鍵)、完整的應用程式內說明指南(29 個 H2／105 個 H3 對齊)、`README.hi.md`、全新的 `CHANGELOG.hi.md`(依循 de／it／tr 先例，自 v1.122.0 起開始)、cvstart.org 落地頁與方法論／授權／更新日誌／說明頁面、語言切換器(🇮🇳)、瀏覽器語言自動偵測，以及在地化的儀表板截圖。每一道 ×16 對齊關卡現在都改為 ×17 執行：i18n 詞典對齊與快照、說明指南 H2／H3 關卡、更新日誌對齊、網站的 `check-i18n`，以及 Playwright 語系巡檢。

## [1.121.0] — 2026-07-16

### 新增
- **cvstart.org:方法論、授權與更新日誌頁面** — 落地頁在全部 16 種語言中新增三個章節,與既有的比較區塊並列:**/methodology/**(六維度 0.0–5.0 評分準則、4.0 分投遞門檻,以及絕不做的規則 — 這是 [career-ops.org/methodology](https://career-ops.org/methodology) 的在地化摘要)、**/license/**(標準 MIT 授權文字並附 NOTICE.md 指引),以及 **/changelog/**(即本檔案,依語系從儲存庫 16 份翻譯後的 CHANGELOG 渲染)。新增頁首「Methodology」項目與頁尾 Resources 連結;`sync-assets.mjs` 現在會在建置時同步 CHANGELOG ×16 與 LICENSE 至落地頁,讓這些頁面永遠不會與儲存庫失去同步。
- **跨文件的方法論連結** — README(全部 16 個)、應用程式內說明指南 §1 的正式指南清單(全部 16 種語言),以及 wiki,現在都連結到 [career-ops.org/methodology](https://career-ops.org/methodology)(FAQ 與詞彙表亦同),與既有的 [career-ops.org/docs](https://career-ops.org/docs) 指南並列。

### 變更
- 更新 README 發布橫幅與徽章(測試數 1850,發布版本 v1.121.0)— 橫幅先前仍停留在宣布 v1.119.5。

## [1.120.0] — 2026-07-16

### 新增
- **CareerOps 宣言**(父專案 v1.20.0 對齊)— 父專案發布了 CareerOps 宣言(`MANIFESTO.md` · [career-ops.org/manifesto](https://career-ops.org/manifesto))，現已在其 README、更新程式與 Go 儀表板中呈現。網頁介面同步跟進:新的側邊欄頁尾連結會開啟宣言頁面(全部 16 個語言區域新增 `footer.manifesto` i18n 鍵)，應用程式內說明指南在全部 16 種語言中新增了 §29「CareerOps 宣言」，README 解說了宣言是什麼、如何簽署，cvstart.org 落地頁頁尾也連結至該頁面。

### 備註
- 父專案 v1.20.0 同時修復了 `upskill` 目標模式下已知技能的抑制邏輯、讓 dotenv 靜默以使 `scan --json` 的 stdout 保持可解析，並修正 HTML 履歷範本讓職稱標頭與其條列項目保持在一起——這些皆為 CLI 端表面，網頁介面並不透過命令列呼叫它們，因此無需變更網頁介面程式碼。

## [1.119.5] — 2026-07-13

### 修復
- **落地頁語言按鈕不再折行** — v1.119.2 加入旗幟後,頁首切換器標籤(如「🇷🇺 Русский」)在較窄的桌面寬度下可能折成三行;切換器標籤及下拉選單所有選項現在均為 `whitespace-nowrap` —— 旗幟 + 語言名始終一行。 頁尾語言清單也從固定兩欄網格改為可換行的一行式項目——「🇧🇷 Português (Brasil)」同樣不再從名稱中間斷開。

## [1.119.4] — 2026-07-13

### 變更
- **LICENSE 載明作者** — 版權行現為 *Sergei Emelianov (Fighter90) <https://sergey-cv.com> and career-ops-ui contributors*(MIT 規範本文未動)。新增 **NOTICE.md** 詳細闡述授權:版權歸屬、MIT 授權確切涵蓋什麼(程式碼、文件、翻譯、落地頁、wiki)、不涵蓋什麼(你的執行期資料、父專案、職缺看板內容、商標)、第三方元件表(express/js-yaml — MIT;Astro/Tailwind — MIT;Figtree 與 JetBrains Mono 字型 — SIL OFL 1.1;sharp — Apache-2.0)以及可選的署名行。

## [1.119.3] — 2026-07-13

### 新增
- **SECURITY.md** — CONTRIBUTING 指向的安全政策現在真的存在了:支援的版本、私密回報流程(儲存庫已**啟用 GitHub 私密漏洞回報** — Security 標籤 →「Report a vulnerability」)、綁定 localhost 的單一使用者應用威脅模型(範圍內:惡意職缺內容的 XSS / SSRF / 路徑穿越 / 金鑰洩漏 / 削弱 CSP;範圍外:對自己 localhost 的 DoS 與父專案的問題),以及給審閱者的強化基線。

## [1.119.2] — 2026-07-13

### 新增
- **CONTRIBUTING.md** — 落地頁與 README 一直連結的貢獻者指南現在真的存在了:安裝、專案地圖、安全/免建置硬規則、測試層級、新增掃描來源的「雙註冊表」演練、×16 i18n 契約、提交/PR 規範與發布流程。
- **落地頁語言旗幟** — cvstart.org 的語言切換器、頁尾語言網格和「用你的語言閱讀」橫幅現在在每個語言的自稱旁顯示其旗幟(與應用語言 `<select>` 相同的區域指示符集;在缺少旗幟字形的平台上退化為區域字母)。
- **落地頁頁尾修復** — 失效的 Discussions 連結(儲存庫未啟用該功能)現指向專案 **wiki**,頁尾新增作者署名:**Sergei Emelianov**([sergey-cv.com](https://sergey-cv.com/) · [LinkedIn](https://www.linkedin.com/in/sergey-emelyanov-in-job/))。

## [1.119.1] — 2026-07-13

### 修復
- **`#/scan` 的來源篩選器追上了註冊表** — Source 下拉選單背後的靜態 `FALLBACK_SOURCES` 清單(僅在 `GET /api/scan/sources` 無法連線時使用)自 v1.87.0 起悄悄落後:離線後備中缺少 20 個提供方(Amazon、Avature、SAP SuccessFactors、Get on Board、Dassault Systèmes、beesite、HigherEdJobs、JibeApply (iCIMS)、softgarden、Cornerstone、Phenom、Radancy、Deutsche Bahn、EchoJobs、TKMS、Heckler & Koch、Rheinmetall、LaraJobs 以及新增的 Meituan / 騰訊)。現已與全部 **61** 個同步,並由漂移測試守護——只要用戶端清單與伺服器註冊表出現分歧(值與標籤),CI 即失敗。+1 個測試(**1845**)。

## [1.119.0] — 2026-07-13

父專案 career-ops **v1.19.0** 對齊 + cvstart.org 落地頁煥新。

### 新增
- **2 個新掃描提供方** — 美團(`zhaopin.meituan.com`)與騰訊(`careers.tencent.com`):中國科技公司職缺板塊的免認證公開 JSON API,依主機自動偵測或以明確 `provider:` 選擇,支援按關鍵字的伺服器端搜尋、分頁與按 URL 去重 — 現共 **61 個轉接器**(56 個英文 + 5 個俄文)。+20 個測試(**1844**)。
- **落地頁貢獻者區塊** — cvstart.org 展示所有貢獻過程式碼者的頭像(建置時呼叫 GitHub `/contributors` API,過濾機器人),已在地化至全部 16 種語言,並連結到完整貢獻者圖譜。
- **落地頁即時 GitHub 星標計數** — 頁首徽章現在每次造訪都從 GitHub API 在用戶端重新整理(建置時快照作為後備),每週排程的 Pages 重建保持快照與貢獻者清單新鮮;CI 中的 API 呼叫已使用權杖認證。

### 修復
- **Workday CXS 請求攜帶瀏覽器式標頭**(父專案 #1813)— Cloudflare 保護的租戶(實測:geico)對缺少常規 UA/`accept-language`/`origin`/`referer` 的請求回應 500;擷取器現從 CXS URL 本身推導 origin 與站點 slug。Glints 請求也獲得同樣的瀏覽器 UA + origin/referer,兩者皆來自 `http-json.mjs` 中共享的 `BROWSER_LIKE_USER_AGENT` 常數。

## [1.118.4] — 2026-07-10

### 修復
- **從俄羅斯 IP 掃描 hh.ru 回傳 0 筆結果(區域子網域連結)** — 從俄羅斯住宅 IP,hh.ru 會將搜尋 302 重新導向到區域子網域(`sochi.hh.ru`、`spb.hh.ru` 等),並在該子網域上回傳職缺連結。解析器以固定主機 `https://hh.ru/vacancy/` 尋找標題連結,與區域連結**一個都不**匹配,因此完全可用的掃描默默記錄為 0。現在它接受任意 `*.hh.ru` 主機(`adsrv.hh.ru/click?…` 廣告仍被排除 —— 它們沒有 `/vacancy/<id>` 路徑),並將每個結果 URL 正規化為 `https://hh.ru/vacancy/<id>`。已實地驗證:先前回傳 0 的 `sochi.hh.ru` 頁面現在解析出 17 筆真實職缺。+1 個測試(**1824**)。

## [1.118.3] — 2026-07-10

### 修復
- **hh.ru 毫無錯誤地回傳 0 筆結果(VPN 檢查中介頁)** — hh.ru 現在會把它判定為 VPN/代理的網路(資料中心 IP)以 302 重新導向到 `/vpncheeck` 中介頁(「VPN мешает работе сайта」),該頁以 **HTTP 200** 回應且不含任何職缺卡片,因此掃描在完全沒有錯誤的情況下回報 0 筆。掃描器現在透過回應的最終 URL 偵測此重新導向,在本次執行的剩餘時間停用 hh.ru,並輸出誠實提示:流量必須真正經由住宅 IP 出口 — 即使瀏覽器開關已關閉,系統層級的 VPN/代理仍可能保持啟用。+1 個測試(**1823**)。

## [1.118.2] — 2026-07-10

### 維護
- **著陸頁跟進(#118)** — `site/README.md` 與 Astro 7(#116 的安全升級)保持一致,移除未使用的 import,並為著陸頁建置指令碼新增 **4 個可執行守衛**: i18n 對齊門在字典損壞時可證明地失敗,`sync-assets` 絕不寫入 `site/` 之外 — 套件 **1822**。解決 2 個 CodeQL 警報(1 個在原始碼修復,1 個作為預期建置行為予以駁回)。

## [1.118.1] — 2026-07-10

### 修復
- **在俄羅斯境外掃描 hh.ru** — hh.ru 現在對非俄羅斯 IP 的公開搜尋頁面回傳 **HTTP 451**(區域性法律封鎖)。掃描器將 451 與 403 同等處理: 首次封鎖後,本次執行剩餘時間內停用 hh.ru,並在日誌中如實提示需要俄羅斯 IP / VPN 出口,不再浪費剩餘查詢和其他 RU 來源。說明 §7 已在 16 種語言中更新。測試 +1(**1818**)。

## [1.118.0] — 2026-07-09

父專案 career-ops **v1.18.0** 對齊包。

### 新增
- **9 個新掃描提供方** — Cornerstone OnDemand (`csod`), Phenom (`phenom`), Radancy (`radancy`), Deutsche Bahn (`deutschebahn`), EchoJobs (`echojobs`), TKMS (`tkms`), Heckler & Koch (`hecklerkoch`), Rheinmetall (`rheinmetall`), LaraJobs (`larajobs`) — 現共 **54 個轉接器**。Lever 轉接器還可識別 EU 租戶看板(`jobs.eu.lever.co`)。
- **追蹤器 `Hired` 狀態**(與父專案 `states.yml` 對齊): 已接受的 offer 擁有獨立的正規狀態、慶祝徽章及 `#/tracker` 上的「拿到工作」橫幅;漏斗與轉換圖表將其計為已通過所有階段。
- **`#/stats` 的累計分頁** — 唯讀中繼父專案的 `stats.mjs`(累計追蹤器彙總、累計漏斗比率、掃描器總數、入口覆蓋)及 `salary-gap.mjs` 的薪酬觀察(期望 vs 職缺標註 vs 實際,依申請)。新路由 `GET /api/stats/lifetime` 與 `GET /api/stats/salary-gap` — 零 token 外殼呼叫,無父專案時安全降級為 `{available:false}`。
- 16 個語系全部新增 28 個 i18n 鍵;說明指南 §14/§26 已在所有語言更新。

### 測試
- 新增 38 個單元測試(三個提供方對齊套件 + 中繼/狀態路由) — 共 **1817** 個。

## [1.117.2] — 2026-07-06

**對齊外殼呼叫的空追蹤器修復。** 當追蹤器還沒有申請時,父腳本以代碼 1 和結構化 `{error}` JSON 退出;跟進節奏板和拒絕模式分頁把它顯示為「script-error」。兩條路由現在將其轉達為健康的空狀態(`available:true, empty:true`),UI 顯示誠實的「暫無內容」訊息。已對真實父專案即時驗證。

新增:無。


## [1.117.1] — 2026-07-06

**v1.117.0 加固(CodeQL 分診)。** 三個外殼呼叫端點(`GET /api/followup`、`POST /api/followup/seed`、`GET /api/stats/patterns`)現在帶有共享的按 IP 限流器(每個請求產生子行程;環回時為 no-op)。新增到 CV 的 URL 文字擷取將標籤剝離到不動點,然後刪除所有剩餘的 `<`/`>`——對 LLM 提示詞文字而言可證明完整的淨化。有效輸入行為不變。

新增:無。


## [1.117.0] — 2026-07-06

**父專案對齊包——把父 career-ops 的六項能力帶進 UI。** (1) `#/followup` 的**跟進節奏板**:來自 `followup-cadence.mjs` 的每申請緊急度(🔴/🟠/🟡/🔵)+ **播種跟進日期**按鈕(`followup-seed.mjs --backfill`)。(2) **拒絕模式**:統計的第四個分頁執行 `analyze-patterns.mjs`(唯讀)——結果構成、建議、各 ATS 供應商推進率。(3) **新增到 CV**:CV Studio 卡片把 URL 或貼上文字變成僅基於該來源的 ATS 要點(僅建議、不寫入;URL 擷取有 SSRF 防護)。(4) **4 個新掃描提供方** — beesite、HigherEdJobs(RSS)、JibeApply(iCIMS)、softgarden——註冊表現有 **50 個轉接器(45 EN + 5 RU)**,全部出現在 Scan 下拉選單。(5) Apply 清單新增**淘汰項預掃描**步驟。(6) **reconcile 執行器**(`/api/run/reconcile`)。外殼呼叫路由在無父腳本時誠實降級。

- 新路由模組 `server/lib/routes/followup.mjs`(第 31 個)+ 新路由 + 8 個 source/adapter 檔案。測試:新增 6 + 7;套件 1737 → 1750。新增 41 個 i18n 鍵 ×16。說明 §13/§17/§24/§26 擴充 ×16。

新增:`GET /api/followup`、`POST /api/followup/seed`、`GET /api/stats/patterns`、`POST /api/cv-studio/add-entry`、`POST /api/run/reconcile`。


## [1.116.0] — 2026-07-06

**用量計量重做 + 首個端到端元件測試。** AI 用量計量(v1.114.0)已正確固定:現在**固定在左側邊欄底部**(佔滿側邊欄寬度,與側邊欄同一表面),並在側邊欄底部預留與自身等高的空間,使**選單永不被遮擋**——導覽與版本頁尾始終在其上方自由捲動。它**即時刷新**(每 15 秒,以及分頁聚焦和路由切換時),每個視窗列現在顯示真實的 **`<權杖> · <預估費用>`**(進度條按 30 天視窗縮放),而非始終 100% 的「占比」。此外:CV 匯入器中一個持久的 `typeof` 屏障從根源關閉了反覆出現的 CodeQL 型別混淆誤報,新的 Playwright **端到端測試**在真實瀏覽器中驅動兩個常駐元件。

- `public/js/lib/usage-hud.js` + `app.css`、`server/lib/cv-import.mjs`。測試:`tests/playwright-widgets.mjs`(2 E2E)+ `tests/usage-hud.test.mjs`(10)。說明 §6 擴充 ×16。

新增:無。


## [1.115.0] — 2026-07-06

**設計打磨(保守,保留珊瑚色品牌)。** 對共享設計系統的一次輕量精修——不重構、不改調色盤。儀表板指標卡片現在在懸停時輕微抬起並帶上珊瑚色邊框(與快捷操作磁貼一致);內容卡片輕微抬起;primary / dark / danger 按鈕獲得靜止陰影與柔和的懸停抬升以增加層次;大數字用 tabular-nums 對齊;互動控件在 2px 鍵盤環後獲得柔和的珊瑚色聚焦光暈。所有動效都尊重 `prefers-reduced-motion`,光暈僅限於控件——絕非全域 `*:focus-visible`。

- 僅 CSS(`public/css/app.css`);無標記、i18n、路由或 CSP 改動。測試:`tests/design-polish-v1115.test.mjs`(5)。已用 Playwright 即時驗證。

新增:無。


## [1.114.0] — 2026-07-06

**側邊欄中的 AI 用量與費用計量(左下)。** 一個精簡的**用量**區塊現在位於每個頁面側邊欄底部(無側邊欄時為左下角固定卡片;RTL 中為右下角)。它按 **24h / 7d / 30d** 視窗展示 LLM 權杖用量——每個為 `<權杖> · <占比%>`(占全時段比例)配綠色進度條——並附 24 小時預估費用頁尾。資料來自 `data/llm-usage.jsonl` 的唯讀 `GET /api/usage` 彙總(僅本地),與 `#/usage` 頁面同源;費用為估算,手動模式執行免費且不計入。可折疊——點擊標題切換,狀態會保存。

- 新用戶端元件 `public/js/lib/usage-hud.js`,從 `index.html` 載入,掛載到版本頁尾上方的側邊欄(固定角落回退)。CSP 安全;主題感知 + RTL 鏡像。無新伺服器路由。測試:`tests/usage-hud.test.mjs`(8)。新增 3 個 i18n 鍵 ×16。

新增:無。


## [1.113.0] — 2026-07-06

**每個頁面上浮動的「詢問說明」助手。** 一個漸層機器人聊天按鈕現在浮動在每個頁面的右下角(RTL 中在左下角)。點擊即可開啟一個精簡聊天,它僅根據你語言的應用內說明指南回答使用類問題——與 `#/docs-assistant` 頁面相同的端點(`POST /api/docs-assistant/ask`),因此從不讀取你的履歷、資料或追蹤器。有 LLM 金鑰時即時回答;無金鑰則給出可直接執行的提示詞。標題顯示機器人頭像 + 線上狀態;起始徽章填入常見問題;Esc 或點擊外部關閉;在 `#/docs-assistant` 頁面上自動隱藏。

- 新用戶端元件 `public/js/lib/docs-fab.js`,從 `index.html` 全域掛載;CSP 安全;`app.css` 中主題感知 + RTL 鏡像樣式。無新伺服器路由。測試:`tests/docs-fab.test.mjs`(8)。新增 6 個 i18n 鍵 ×16。說明 §1 就地擴充。

新增:無。


## [1.112.0] — 2026-07-06

**文件與 QA 整合。** 無使用者可見的程式碼改動。SDD 慣例文件(`docs/sdd/CONVENTIONS.md`)更新到目前的 **30 個路由模組**(先前 24 個)和目前測試基準;全專案權威 QA 提示詞(`qa/QA-REGRESSION-PROMPT.md`)已整合——發布流程去陳舊化(v1.111、parentVersion 1.17.0、由發布事件觸發的發布),§14 新增表修正(Scan 排除重新標註為 v1.109.0)並補入 v1.111 的 CodeQL 收尾——因而可獨立作為涵蓋所有功能的單一回歸提示詞。新增一個針對超大上傳分支的覆蓋測試。

新增:無。


## [1.111.0] — 2026-07-06

**安全 — 清理 CodeQL 待辦。** 三項縱深防禦強化,從根源關閉剩餘的靜態分析發現,而非將其忽略(dismiss)。`stripDangerousMarkdown` 現在會逸出任何*被截斷*的危險標籤開頭(以 `<script`/`<iframe`/… 結尾的載荷)的 `<`,從而可證明其輸出不含任何存活的危險標籤。CV 匯入透過明確的 `Number()` 強制轉換讀取上傳緩衝區的大小——一道型別混淆屏障。模式角色行現在是用 `String.replace` 插值的範本**字串**,而非儲存的函式,徹底移除了動態派發呼叫。使用者可見行為無變化。

- `server/lib/security.mjs`、`server/lib/cv-import.mjs`、`server/lib/prompts.mjs`。測試:`tests/security-hardening-v1111.test.mjs`(7)+ 更新的 v1108 守衛測試。無 i18n/說明/路由改動。

新增:無。


## [1.110.0] — 2026-07-06

**文件與 QA 刷新(所有語言)。** 無程式碼改動。全專案 QA 提示詞刷新至 v1.109.0,新增涵蓋 v1.98→v1.109 的 §14,常駐 UX 稽核與設計匯出提示詞納入目前頁面集。v1.100–v1.109 新增的每個說明段落現已翻譯為**全部 16 種語言**。

新增: 無.


## [1.109.0] — 2026-07-06

**Scan 排除篩選 + 流水線概覽(Web 版面對齊)。** 在 `#/scan` 上,**搜尋**框現在把逗號視為**或**(「要找的職位」),新增的**排除**欄位會隱藏公司/職位/地點包含任一逗號分隔詞(如 `senior, staff`)的列;兩者都會記入你的已儲存搜尋。在 `#/pipeline` 上,一個精簡的**概覽列**一眼展示流水線——**收件匣 N**、**已追蹤 N**,以及來自追蹤器的 **Applied / Responded / Interview / Offer** 計數,每個徽章連結到 `#/tracker`。

- 僅用戶端(無新路由/寫入)。`public/js/views/scan.js` + `public/js/views/pipeline.js`。測試:`tests/scan-pipeline-ui-v1109.test.mjs`(2)。新增 4 個 i18n 鍵 ×16。說明 §7 + §8 就地擴充。

新增:無。


## [1.108.0] — 2026-07-06

**安全強化(CodeQL 分診第 2 輪)。** 又修復三處低危問題:模式提示建構器按**自有鍵 + `typeof === function`**解析語言角色行,使被竄改的語言無法分派到原型方法(unvalidated-dynamic-method-call);PDF 檔名 slug 在**正規式之前限制為 200 字元**,使全連字號輸入無法回溯(多項式 ReDoS);文件匯入將**陣列 `filename`**(重複標頭)強制轉換為字串(type-confusion)。對有效輸入無行為變化。

- `server/lib/prompts.mjs`、`server/lib/routes/runners.mjs`、`server/lib/cv-import.mjs` + `tests/security-hardening-v1108.test.mjs`(3)。v1.106–v1.108 期間靜態分析積壓從 167 降至約 14,所有真正與安全相關的發現均已修復,其餘(有防護/已淨化的誤報 + 註解級 lint)已附理由駁回。

新增:無。


## [1.107.0] — 2026-07-06

**淨化器強化(靜態 XSS 縱深防禦)。** `stripDangerousMarkdown`——中和已儲存的履歷/職缺 markdown 中的危險 HTML,使任何繞過渲染時跳脫用戶端的消費者仍然安全——現在會將標籤清除執行**至不動點**(重複直到穩定),以便捕捉會*重構*酬載的清除(如 `<scr<script></script>ipt>`),匹配**末尾帶雜物**的 script/style 等結束標籤(`</script foo>`),並清除**未閉合**的可執行開標籤(`<script …>`)。對有效 markdown 的行為不變——只會清除更多。

- `server/lib/security.mjs`:不動點迴圈(限 8 輪)+ `[^>]*>` 結束標籤模式 + 未閉合開標籤清除。`tests/cv-xss-bypasses.test.mjs` +3 迴歸用例。權威的 XSS 邊界仍是輸出跳脫(`UI.md`);這加強了靜態保證並關閉了相應的 CodeQL 發現。

新增:無。


## [1.106.0] — 2026-07-06

**安全強化(CodeQL 分診)。** 梳理靜態分析積壓後修復了三處真實(儘管低危)問題:路由渲染的錯誤路徑現在會**在錯誤訊息到達 DOM 之前進行跳脫**(伺服器錯誤可能回顯使用者輸入,故視為不可信——XSS 邊界),檔案/設定的屬性寫入會**拒絕 `__proto__` / `constructor` / `prototype` 鍵**(以防萬一的原型汙染防護——鍵來自固定欄位規格,而非原始請求輸入)。其餘警示多為對掃描器合法讀寫 `data/*` 以及已帶自有限流器的路由的誤報,已附理由駁回。

- `public/js/router.js` 在 `innerHTML` 之前用 `UI.escapeHtml` 跳脫 `err.message`;`server/lib/routes/content.mjs` 和 `server/lib/routes/config.mjs` 防護原型鍵。對有效輸入無行為變化。測試:`tests/security-hardening-v1106.test.mjs`(3)。無新增 i18n 鍵。

新增:無。


## [1.105.0] — 2026-07-06

**AI 用量與成本頁面。** 新的**AI 用量**頁面(側邊欄,健康旁邊)顯示你在**即時** AI 生成(評估、報告、對話)上花費的權杖,按**供應商**分列,涵蓋最近 24 小時、7 天、30 天和全部時間,並附**預計 USD** 成本。每次即時呼叫都會向 `data/llm-usage.jsonl` 追加一條小記錄 `{provider, in, out}`(不向任何地方傳送);無金鑰執行(手動模式)不產生費用,也不記錄。

- 新路由模組(第 30 個) `server/lib/routes/usage.mjs` — `GET /api/usage`(唯讀彙總) + `server/lib/llm-usage.mjs`(`recordUsage` 正規化 Anthropic/OpenAI/Gemini 的用量結構並盡力追加;`readUsage`/`aggregate` 按 24h/7d/30d/全部視窗 × 供應商彙總) + `server/lib/llm-pricing.mjs`(**可編輯**的各供應商 `$/1M` 權杖價格表——權杖數精確,美元為可修改的近似標價,不計費)。記錄掛接在分發點(`runActiveProvider` + `routes/llm.mjs`)。
- 新檢視 `public/js/views/usage.js`(`#/usage`,時間窗分頁)。測試:`tests/usage-routes.test.mjs`。新增 17 個 i18n 鍵 ×16(`usage.*` + `nav.usage`)。說明 §6 就地擴充。

新增:`server/lib/routes/usage.mjs`;`server/lib/llm-usage.mjs`;`server/lib/llm-pricing.mjs`;`public/js/views/usage.js`。


## [1.104.0] — 2026-07-06

**掃描表中的公司標誌(保護隱私)。** **應用設定**中新增的**外觀**開關——**在掃描表中顯示公司標誌**(預設關閉)——會在 `#/scan` 的公司名稱旁繪製其標誌。標誌是**從公司自己網域取得的 favicon**,並在伺服器端代理(`GET /api/logo`),因此**沒有任何第三方標誌服務能得知你在查看哪些雇主**。位於共享徵才入口(Greenhouse、Lever、Ashby 等)的職缺會顯示彩色**字母徽章**而非入口圖示,任何載入失敗的標誌也回退到同一徽章。

- 新路由模組(第 29 個) `server/lib/routes/logos.mjs` — `GET /api/logo?domain=`。它驗證網域(無協定/路徑/回環),透過 **SSRF 安全的 `safeGet`**(新的 `binary` 模式回傳原始位元組 + content-type;DNS 固定、重新導向驗證和大小上限不變)取得 `/favicon.ico`,進行**影像魔數嗅探**以絕不把 HTML 錯誤頁當作影像回傳,將命中**與**未命中都快取在記憶體 LRU 中,並**不向磁碟寫入任何內容**。
- 新客戶端庫 `public/js/lib/company-logo.js`(`window.CompanyLogo`):透過 localStorage 旗標預設關閉;跳過共享 ATS 主機改用確定性字母頭像;CSP 安全的 `img.onerror` 回退。測試:`tests/logo-routes.test.mjs`。新增 5 個 i18n 鍵 ×16(`appear.*`)。說明 §2 就地擴充。

新增:`server/lib/routes/logos.mjs`;`public/js/lib/company-logo.js`。


## [1.103.0] — 2026-07-06

**設定:「AI CLI 工具」——已安裝哪些。** career-ops 以 Claude Code 驅動，但可與任何遵循開放技能標準的代理 CLI 搭配。**應用設定**(`#/config`)中的新**AI CLI 工具**分頁顯示 Claude Code、Codex、Gemini CLI、OpenCode、GitHub Copilot CLI、Qwen、Antigravity 中哪些安裝在執行伺服器的機器上及其路徑。這是**唯讀的 PATH 掃描**:只檢查每個二進位是否存在,**絕不執行它**(無 `--version`,不執行),不寫入任何內容,也不觸碰使用者資料。

- 新路由模組(第 28 個) `server/lib/routes/cli-detect.mjs` — `GET /api/cli-detect`。偵測從固定的 7 項白名單出發,沿 `process.env.PATH` 解析二進位路徑(Windows 的 `.cmd/.exe/.bat` 墊片;POSIX 的可執行位元);PATH 上的惡意檔案絕不會被此路由執行。
- `public/js/views/config.js` 中的新「AI CLI 工具」分頁(延遲載入,可透過 `#/config?tab=cli` 深連結)。測試:`tests/cli-detect-routes.test.mjs`。新增 8 個 i18n 鍵 ×16(`cli.*` + `config.tabCli`)。說明 §2 就地擴充。

新增:`server/lib/routes/cli-detect.mjs`。


## [1.102.0] — 2026-07-05

**「向文件提問」——基於應用內說明指南的對話。** 新增**向文件提問 💬**頁面(側邊欄，說明下方)：輸入「如何掃描徵才入口？」這類問題，即可獲得**僅**來自你所用語言的應用說明指南的答案——它會顯示所用章節，且**絕不讀取你的履歷、檔案或求職資訊**。這是關於如何使用應用，而非關於你。有 LLM 金鑰時即時作答；無金鑰時提供一個已填入相關說明章節的現成提示詞。

- 新路由模組(第 27 個) `server/lib/routes/docs-assistant.mjs` — `POST /api/docs-assistant/ask`。**零相依檢索：** 將你語言的說明文件拆分為 `##` 章節，按與問題的關鍵字重疊評分；置頂章節被內聯，模型須據此作答或說明指南未涵蓋(不杜撰功能/路由)。共享供應商級聯、手動回退、限速、**不寫入**、不讀取使用者資料。
- 新檢視 `public/js/views/docs-assistant.js`。測試：`tests/docs-assistant-routes.test.mjs`。新增 14 個 i18n 鍵 ×16(`docs.*` + `nav.docsAssistant`)。說明 §1 就地擴充。

新增：`server/lib/routes/docs-assistant.mjs`；`public/js/views/docs-assistant.js`。


## [1.101.0] — 2026-07-05

**CV Studio：針對特定職缺客製履歷並撰寫求職信——由招募人員檢查清單把關。** `#/cv-studio` 新增**針對職缺客製**卡片：貼上職缺描述(可選填目標職位/標題)，CV Studio 即產生**為該職缺客製的履歷以及相符的求職信**，並在交付前讓兩者通過**檢查清單關卡**——`error` 攔截(在你看到結果前已修正)，`warn` 提示。此機制把職涯輔導實務提煉為**通用**規則——招募人員幾秒內讀完，因此相關經驗置頂、標題符合職缺角色、成果帶具體數字、求職信保持簡短且只含一條「要求↔你相符的事實」的橋接。僅根據你自己的履歷、檔案和兩頁紙，**絕不杜撰**——不硬編碼公司、角色或經歷。

- 新端點 `POST /api/cv-studio/tailor`(擴充現有 cv-studio 模組——沒有第 27 個模組)：`buildTailorPrompt` + 通用 `TAILOR_INSTRUCTIONS` 關卡，基於 `bundleProjectContext`，共享供應商級聯，無金鑰時手動提示詞，限速，**不寫入**。結果透過共享 `report-export.js` 工具列匯出為 Markdown / PDF / **DOCX**。
- 測試：`tests/cv-studio-routes.test.mjs` +3。新增 10 個 i18n 鍵 ×16(`cvs.tailor*`)。通用參考 `docs/prompts/resume-cover.md`。說明 §24 就地擴充。

新增：`docs/prompts/resume-cover.md`。


## [1.100.0] — 2026-07-05

**兩頁紙：基於履歷的 AI 自動填入 + 預覽 + 匯出為 PDF/DOCX/Markdown。** 兩頁紙(`#/two-pager`)記錄你對下一份工作真正想要的東西，但先前每個欄位都得手動撰寫，或把提示詞複製到別的工具裡。現在**✨ AI 填入助手**會用你設定的供應商即時執行——*只*讀取你的履歷 + 檔案(透過 `bundleProjectContext`，絕不杜撰)，起草所有欄位(我是誰 / 喜歡 / 必備 / 討厭 / 硬性排除 / 不可妥協 / 目標環境)並填入表單，供你檢查、編輯並儲存。沒有 API 金鑰時，會像以前一樣回退到複製提示詞的彈窗。新的**👁 預覽並匯出**按鈕把兩頁紙渲染為帶格式的文件，並提供**下載 .md / 另存為 PDF / 另存為 DOCX / 複製**工具列。

- **零相依 `.docx` 匯出。** 新增 `server/lib/docx.mjs`，產生一個最小但有效的 Office Open XML `.docx`(四個 OOXML 部件的 DEFLATE ZIP，逐條 CRC-32)——不引入新的執行階段相依(相依仍為 `express` + `js-yaml`)。新路由 `POST /api/export/docx`(`server/lib/routes/export.mjs`，第 26 個路由模組；無狀態，限制 200 KB，不寫入 / 不呼叫 LLM / 不抓取 URL)。已接入共享的 `public/js/lib/report-export.js`，因此**市場報告、職涯規劃與職涯定位報告也獲得 DOCX 匯出**。
- 即時自動填入使用共享的供應商級聯(`runActiveProvider` / `providerAvailable`)；回傳的 YAML 會被解析並強制轉換回受限的兩頁紙結構(`parseYamlFields` + `normalizeTwoPager`)——丟棄未知鍵，陣列/字串設上限。保留手動模式。
- 測試：`tests/export-routes.test.mjs`。新增 4 個 i18n 鍵 ×16(`export.saveDocx`、`twoPager.preview`、`twoPager.aiFilling`、`twoPager.aiFilled`)。

新增：`server/lib/docx.mjs`；`server/lib/routes/export.mjs`。


## [1.99.0] — 2026-07-05

**入口網站健康頁面**（`#/portals`）。掃描器監看 `portals.yml` 中的一組公司；ATS slug 可能悄然失效，該雇主便從此後所有掃描中無聲消失。新的 **Portals** 頁面列出每個受監看的公司，點擊 **Check portal health** 時透過 DNS 釘選的 `safeGet`（防 SSRF）探測每個 `careers_url` 並標記失效者（404 = 被無聲丟棄）——唯讀。同時依審查加固 v1.98.0 的錯誤回報器：錯誤環形緩衝區現在會捕捉網路層 fetch 失敗，清理器會遮蔽無標籤的供應商金鑰。

新增： `server/lib/routes/portals.mjs`; `public/js/views/portals.js`.


## [1.98.0] — 2026-07-05

**應用程式內錯誤回報器**（與父專案 `web-v0.2.0` Web 端對齊）。通知抽屜中的 **🐞 Report a bug** 按鈕會收集一份遵循隱私底線的診斷快照——版本、你的畫面、瀏覽器、`/api/health` 檢查摘要，以及來自新的用戶端環形緩衝區的最近 20 條錯誤——外加一個確定性的去重指紋（`co-web-<base36>`），讓你審閱確切的 Markdown，然後開啟一個預先填好的 GitHub issue。不會自動送出；絕不攜帶你的履歷、檔案、回答、職缺 URL 或金鑰。新程式庫 `logbuf.js` + `bug-report.js`；11 個 i18n 鍵 ×16；`tests/bug-report.test.mjs`。

新增： `public/js/lib/logbuf.js`; `public/js/lib/bug-report.js`.


## [1.97.1] — 2026-07-05

**評審驅動的強化與文件一致性（v1.97.0 的後續）。** 梳理 AI 評審記錄後浮現出若干真實修正:

- **`fit-score.js`（掃描 `◎` 適合度徽章）。** `salaryFloor()` 不再將低於年薪口徑的費率抬升為虛假的年薪下限——「at least 500 EUR/day」「$80/hr」「6000 monthly」現在回傳 `null`,而非一個 500k/80k 的一票否決項。國家比對現在以整詞進行(`\b…\b`),因此「Germany」不再比對到形容詞「German」(也不再讓「Nigerian」裡的「Nigeria」命中),從而不會觸發錯誤的「必須在別處」違規。`tests/fit-score.test.mjs` 新增 3 個測試。
- **文件一致性。** 現在每個在地化 README 都一致地標註 **16 個 locales**——Help 列的計數/清單(×13)與在地化章節內文 + 「把鍵加到所有 N 個檔案」提示(×8)先前仍停留在 v1.85 之前的計數(8/9)。應用程式內說明 §17 的轉接器計數已在全部 16 個語言包中更正為 **46 個轉接器——41 個英語 + 5 個俄語**。

除適合度徽章啟發式外無行為變更;無新增路由、鍵或 i18n 條目。

## [1.97.0] — 2026-07-05

**Dassault Systèmes 掃描器來源 + 三線並進的品質整頓。**

- **新增掃描來源 — Dassault Systèmes（與父層 career-ops 對齊,#1498）。** `server/lib/sources/dassault.mjs` + `server/lib/portals/adapters/dassault.mjs` 複刻了父專案零 token 的 Exalead「卡片搜尋」提供者（`3ds.com/careers/jobs` 背後的公開資料來源）。它是單一全域端點,因此透過提供者選擇（`provider: dassault`）或從 `3ds.com` 主機自動偵測,並以 `redirect:'error'` 將 SSRF 主機固定為 `www.3ds.com`。XML 在不使用 DOM 的情況下解析（依 `<Hit>` 建立 `<Meta>` 對應）,城市/國家從在地化的類別字串中擷取,只有當職缺的公開 URL 位於 `*.3ds.com` 上時才保留。註冊表現在提供 **46 個轉接器**（41 個 EN + 5 個 RU）;`ALL_ADAPTERS` 計數、已排序 id 以及 `/api/scan/sources` 的 EN 集合斷言從 40 → 41。測試套件 `tests/sources-dassault.test.mjs`(10 個案例)。
- **移植父專案的健壯性修正。** Avature 解析器現在容忍兩種線上租戶標記變體（帶位置索引後綴的 `article--result` + 無類別名稱的 JobDetail 標題錨點,#1541);Get on Board 會防禦 `0`/負值的 `published_at`(不再出現錯誤的 1970 日期);SuccessFactors 會對最後一頁設上限,使其不會超出 `MAX_JOBS`(#1528)。
- **伺服器稽核修正。** `safe-fetch` 在超出上限的回應上不再卡住——大小上限路徑現在直接兌現 promise,而非等待一個已銷毀的串流永遠不會發出的 `'end'` 事件（修正大頁面的 `/api/pipeline/preview` + 自動流水線抓取）。SSE `stream.*` 活動記錄再次可達（`/api/stream/` 檢查移到了籠統的「跳過 GET」防護之上）。
- **SPA 稽核修正。** `#/stats` 分頁切換器可防禦非同步繪製競態——慢速分頁的結果不再會覆蓋使用者已切換到的較新分頁。mock interview 與人脈拓展的刪除確認現在會傳入正確的標題 + 內文(不再有內文為空的對話框)。
- **翻譯修正。** 修正未翻譯的字典值——烏克蘭語 `config.modes*`(Adaptive Framing / Exit Narrative / Location Policy)、俄語 `eval.jdLbl`（「Job Description」）、義大利語 `dash.quick.contactoSub`（「referral」→「segnalazione」）——以及在 ru/uk/ja/ko/zh-CN/zh-TW 的 CHANGELOG 中將英文 **16 個 locales** 的樣板文案在地化。

新增: `server/lib/sources/dassault.mjs`; `server/lib/portals/adapters/dassault.mjs`.

## [1.96.0] — 2026-07-04

**職業方向（Epic 27）。** 全新的 **`#/orientation`** 頁面回答「哪些方向真正適合我？」——就像職業測評能給你的那種解讀,但不是靠問卷,而是從你自己的 CV 和檔案中推斷。點擊 **生成畫像**,模型會回傳你的 **最契合的職業向量**（八種原型——功能主義者、管理者、溝通者、專家、分析者、創新者、經理、創業者——中哪一種契合,並附上證據）、一種職業類型傾向、推薦職位、與 CV 相關聯的職業優勢、工作風格傾向,以及發展建議。這是 **對你的 CV 讀起來如何的一種 AI 反思——而非心理測驗**:它不會虛構成就,也絕不會把數值分數當作實測結果來回報。可匯出為 Markdown 或 PDF;不會向磁碟寫入任何內容。

- 新增路由 `server/lib/routes/orientation.mjs`（第 24 個路由模組）—— `POST /api/orientation/generate` 透過共享的提供者級聯,從 CV+檔案+兩頁紙+記憶建構畫像提示詞,並提供可複製貼上的手動回退與 **不寫入任何檔案**。
- 在 **Growth** 導覽分組下,複用 `report-export.js` 實現 Markdown/PDF/複製。
- 測試:`tests/orientation-routes.test.mjs`（反思式表述 / 無捏造分數,以 CV/檔案為種子的手動模式）。7 個新 i18n 鍵 ×16 個語言環境,說明 **§28** ×16。

新增:`#/orientation`；`server/lib/routes/orientation.mjs`。

## [1.95.0] — 2026-07-04

**職涯規劃(Epic 26)。** 全新的 **`#/career-plan`** 頁面會把你的 CV 與檔案轉化為一份具體、個人化的發展規劃。選擇一個 **週期**(6/12/24 個月)與一個可選的 **聚焦方向**,模型 —— 讀取你的 CV、檔案、雙頁簡介與記憶筆記 —— 便會寫出起點快照、優勢/成長 SWOT、以 SMART / OKR / WOOP 形式呈現的目標、替代發展軌跡、硬技能/軟技能規劃、一份 **逐月路線圖**、進度追蹤方法、常見陷阱與支援性舉措。它從你的素材真正體現出的內容向前規劃,絕不虛構你的過往經歷。可就地編輯,**儲存**到使用者層(`config/career-plan.md`),並**匯出**為 Markdown 或 PDF。

- 新增路由 `server/lib/routes/career-plan.mjs`(第 23 個路由模組)—— `GET`/`PUT /api/career-plan`(寫入 `config/career-plan.md`)+ `POST /api/career-plan/generate`(共享的供應商級聯、手動回退、不作虛構)。`PATHS.careerPlan`。
- 複用共享的 `report-export.js`(v1.94.0)用於 Markdown/PDF/複製,並新增一個**成長**導覽分組。
- 測試:`tests/career-plan-routes.test.mjs`(邊界處理、GET/PUT 往返、感知週期並以 CV/檔案預填的提示詞)。全部 **16 個 locales** 新增 20 個 i18n 鍵,說明文件 **§27** ×16。

新增:`#/career-plan`;`server/lib/routes/career-plan.mjs`;`PATHS.careerPlan`。

## [1.94.0] — 2026-07-04

**統計功能,全面翻新(Epic 25)。** `#/stats` 頁面現在是一個三頁籤的**統計**版塊,配有真實圖表與多得多的資料。全新的**市場報告**頁籤會請模型針對你目標職務在你所選地區與貨幣下的薪資與勞動力市場進行分析 —— 執行摘要、依職級並含 P10/P25/P75/P90 百分位的薪資、頂尖雇主、熱門技能表、福利出現頻率、辦公室/混合/遠端的占比、12–24 個月的趨勢,以及談判指引。每一項數字都標註為**來自模型知識的方向性估計**,絕不以抓取資料的形式呈現。全新的**我的管線**頁籤會繪製你自己的追蹤器:評分分布、狀態漏斗、頂尖公司與職務、隨時間變化的申請量,以及轉換率。原有的目標職務檢視(依國家的職缺/薪資 + 已儲存快照的趨勢)移入第三個頁籤,現在帶有**貨幣選擇器**與**依職務的刊登數**概覽。

- **匯出任意報告**為 Markdown 或 PDF,或直接複製它 —— 透過共享的 `report-export.js` 輔助工具實作(Markdown 以 blob 下載;PDF 透過既有的內嵌 PDF 執行器)。
- 新增路由 `server/lib/routes/market.mjs`(第 22 個路由模組)—— `POST /api/stats/market` 會依據你的 CV/檔案(因此它知道你的目標職務)、地區與貨幣建構一段市場分析提示詞,透過共享的供應商級聯執行,並在沒有金鑰時回退為一段可複製貼上的提示詞。不寫入任何檔案。
- 測試:`tests/market-routes.test.mjs`(地區/貨幣邊界、誠實標註的提示詞、以 CV/檔案預填的手動模式)。全部 **16 個 locales** 新增 36 個 i18n 鍵,說明文件 **§26** ×16。

新增:`#/stats` 重構為頁籤;`server/lib/routes/market.mjs`;`public/js/lib/report-export.js`。

## [1.93.0] — 2026-07-04

**記憶層(Epic 24)。** 全新的 `#/memory` 頁面存放一則簡短、可編輯的「關於我要記住的事」筆記,助手在**每一項**任務中都會將其納入考量:

- **一則筆記,處處生效** — 由於它會內嵌進 `bundleProjectContext`,這則筆記會自動抵達每一次 AI 請求(評估、模擬面試、人脈拓展、CV Studio),橫跨**所有**供應商。寫一次;它就能引導一切。
- **引導,而非事實** — 它捕捉的是你的偏好與你偏好的工作方式(語調、格式、不可退讓的底線、節奏),絕不包含關於你經歷的新事實聲明 —— 那些仍只存放在你的履歷、檔案與 two-pager 中。儲存於使用者層的 `config/memory.md`,絕不會被更新覆寫。
- **從你的資料提出建議** — `POST /api/memory/suggest` 會從你自己的求職追蹤器中挖掘行為模式,並草擬條目供你審閱與編輯。它會讀取你的追蹤器;它絕不捏造事實,也不會發出任何即時呼叫。

新增:`server/lib/routes/memory.mjs`(第 21 個路由模組 —— `GET`/`PUT /api/memory` + `POST /api/memory/suggest`)、`public/js/views/memory.js`、`PATHS.memory`,以及新增至 `bundleProjectContext` 的 `config/memory.md` 區塊。全部 **16 個 locales** 新增 11 個 i18n 鍵。測試:`tests/memory-routes.test.mjs`。

## [1.92.0] — 2026-07-04

**CV Studio(Epic 21)。** 全新的 `#/cv-studio` 頁面為你的履歷提供三項誠實、且多在本機運行的工具:

- **履歷診斷** — 一個確定性的 0–100 分數,並附各項檢查的逐一說明(量化影響、無力的動詞、行話術語、篇幅、核心區塊、聯絡資訊)。純用戶端(`window.CvDiagnostics`)—— 不使用 LLM,絕不捏造,每一項發現都有解釋,由*你*決定要更動什麼。
- **隱私遮罩** — 在把履歷作為範本或截圖分享之前,先遮蔽 PII(電子郵件、電話、連結/帳號、街道地址,並可選擇性地將你的姓名 → 縮寫)。完全在瀏覽器中執行(`window.CvPrivacy`);它會準確回報遮蔽了哪些內容,且絕不儲存原始資料。
- **讓文字更像人味 / 語調匹配** — 貼上一句生硬的句子或段落,並以*你*的語調重寫,於伺服器端以 `voice-dna.md` 和 `writing-samples/` 為依據。硬性護欄:它可以重新排序、精簡並重新賦予語調,但絕不引入文中尚未存在的事實、指標或成就。可透過共享的供應商級聯即時執行,或在沒有金鑰時回傳一段可複製貼上的提示詞。

新增:`server/lib/routes/cv-studio.mjs`(第 20 個路由模組 —— `POST /api/cv-studio/humanize`)、`public/js/views/cv-studio.js`、`public/js/lib/cv-diagnostics.js`、`public/js/lib/cv-privacy.js`、`PATHS.voiceDna` + `PATHS.writingSamplesDir`。全部 **16 個 locales** 新增 29 個 i18n 鍵。測試:`tests/cv-diagnostics.test.mjs`、`tests/cv-studio-routes.test.mjs`。(範本庫、Word 匯出與刊登 PDF 封存皆列為 CV Studio 的後續工作。)

## [1.91.0] — 2026-07-04

**人脈拓展與深度公司研究(Epic 16)。** 全新的 `#/networking` 頁面將一家公司轉化為一份爭取面試的可執行計畫,並以你的履歷、檔案與 two-pager 為依據:

- **公司檔案** — 一份精煉的簡報,說明公司做什麼、值得引用的近期動態,以及從你真實背景中提煉出的「我為何契合」的切入點。
- **該聯繫誰** — 3–5 個目標人物誌(招募經理、內部招募人員、團隊中的資深 IC、一位有溫度的/校友人脈),並為每一位提供具體的 LinkedIn 搜尋字串。絕不捏造真實姓名。
- **最溫暖的引薦路徑** — 針對*你的*背景最實際的溫暖切入路徑(共同的雇主/學校/社群、二度人脈路徑,或一則訊號強烈的冷啟動私訊)及其原因。
- **觸達草稿** — 面向頭部人物誌的簡短、具體訊息,以你真實的佐證要點為依據。
- **即時或手動** — 使用任意金鑰透過共享的供應商級聯即時執行,或回傳一段可複製貼上的提示詞(誠實回退,絕不臆造)。**儲存計畫**會將完成的計畫持久化到使用者層(`networking/net-{company}-{role}-{date}.md`);該頁面可列出、開啟並刪除已儲存的計畫。

新增:`server/lib/routes/networking.mjs`(第 19 個路由模組)、`public/js/views/networking.js`、`PATHS.networkingDir`。重用 v1.90.0 的 `server/lib/llm-dispatch.mjs` 級聯。**16 個 locales** 全部新增 24 個 i18n 鍵。測試:`tests/networking-routes.test.mjs`。

## [1.90.0] — 2026-07-04

**Mock Interview 2.0(Epic 15)。** 全新的 `#/mock-interview` 頁面將你的履歷、檔案、two-pager 與故事庫變成逐輪進行的面試演練:

- **對話式練習** — 設定一個目標職位(可選填公司 / JD),面試官會以一個聚焦的問題開場。你送出的每個回答都會得到結構化的回覆:**Feedback**(優勢 + STAR+R 缺口)、**Score**(`N/5`),以及一個探究你上一個回答最薄弱之處的 **Next question**。在伺服器端以你的真實素材為依據 —— 絕不捏造你沒有的經歷。
- **感知故事庫** — `interview-prep/story-bank.md` 會內嵌進提示詞(與 `cv.md` 同等信任等級),因此回饋能指引你運用自己最好的故事。
- **即時或手動** — 有供應商金鑰時,該輪次會透過共享供應商級聯(Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models)即時執行;沒有金鑰時,你會得到一個可直接複製貼上執行的提示詞(誠實回退,不捏造答案)。
- **已儲存的工作階段** — 點擊 **Save transcript** 可將一場完成的面試持久化到使用者層(`interview-prep/mock-{company}-{role}-{date}.md`);該頁面可列出、開啟並刪除已儲存的工作階段。

新增: `server/lib/routes/interview.mjs`(第 18 個路由模組)、`public/js/views/mock-interview.js`、`server/lib/llm-dispatch.mjs`(共享供應商級聯)、`PATHS.storyBank`、`bundleProjectContext({ extraFiles })`。在全部 **16 種語言** 中新增 30 個 i18n 鍵。測試: `tests/interview-routes.test.mjs`。

## [1.89.0] — 2026-07-04

**候選人與市場契合 —— two-pager（Epic 14）。** 新增的 `#/two-pager` 頁面讓你記錄 *你自己* 對下一份工作真正想要的東西,借鑑自 *Never Search Alone* 中的「Mnookin two-pager」:

- **引導式建構器** —— 第一人稱「我是誰」敘述、「目標環境」備註,以及五個 chip 清單編輯器:**loves**、**must-haves**、**hates**、**deal-breakers** 與 **non-negotiables**。透過 `PUT /api/two-pager` 儲存到父專案的 **使用者層**(`config/two-pager.yml`)—— 絕不會被系統更新覆寫。
- **AI 填充助手**(`POST /api/two-pager/draft`)—— 產生一個內聯了你的 CV + 檔案、可直接執行的 Mnookin 提示詞,供你在任意 LLM 中執行並把結果貼回來。它只使用你自己的素材;絕不捏造。
- **與你所想的契合徽章** —— `#/scan` 上的每個職缺現在都顯示一個 `◎ N` 契合分(用戶端,經由 `window.FitScore`),將職缺的工作型態、國家、最低薪資與搬遷跟你的 two-pager 進行比對。設計上誠實:當職缺沒有可比對的訊號時,**不顯示徽章**(絕不捏造數字)。deal-breaker 的違背比輕度的不喜歡權重更高。
- **餵入每一次評估** —— 儲存的 two-pager 會被內聯進 `bundleProjectContext`,因此所有下游 LLM 評估都會將你陳述的偏好與 CV-對-JD 的比對結合起來。

新增:`server/lib/routes/two-pager.mjs`、`public/js/views/two-pager.js`、`public/js/lib/fit-score.js`、`PATHS.twoPager`。全部 **16 個語言環境**新增 27 個 i18n 鍵。測試:`tests/two-pager-routes.test.mjs`、`tests/fit-score.test.mjs`。

## [1.88.0] — 2026-07-04

**Issue #29 收尾 —— 掃描 i18n 缺口 + API 衛生。**

- **在地化最後殘留的硬編碼掃描字串**（路線圖 v1.69.4）：來源彙整標籤（`N 個新增 / M 個相符`）、`N 個新職缺` 提示以及 `reloc` 徽章現在皆透過 `t()` 流轉 —— 全部 **16 個語言環境**新增 4 個鍵（`scan.pillNew`、`scan.pillMatching`、`scan.newOffers`、`scan.relocBadge`）。非英語使用者不再於核心掃描流程中看到零散的英文。
- **停用 `X-Powered-By` 回應標頭**（路線圖 v1.69.5）：`createApp()` 中的 `app.disable('x-powered-by')` —— 伺服器不再對外宣告使用 Express。（該主線的其餘部分先前已交付：`parentVersion` 去除其 release-please 註解、亮色模式主題切換、切換路由時關閉互動視窗，以及報告頁「Score」（`rep.score`）的在地化。）

測試：`tests/scan-i18n-gaps.test.mjs` + `tests/security-headers.test.mjs` 中的 `X-Powered-By` 缺失斷言。

## [1.87.0] — 2026-07-04

**4 個新增的免驗證掃描來源（與父專案 career-ops v1.16.0 對齊）。** 掃描器註冊表從 **41 → 45 個轉接器**（40 EN + 5 RU）—— 全部為公開、免驗證、主機鎖定、`redirect:'error'`（SSRF 安全），且各自附一套 CI 隔離測試:

- **Get on Board**（`getonbrd`）—— 全站公開 JSON:API（LATAM/遠端技術職缺），依來源選擇，支援分頁。`server/lib/sources/getonbrd.mjs`。
- **Amazon**（`amazon`）—— `amazon.jobs` 公開搜尋 JSON，依主機偵測或 `provider: amazon`，依位移分頁。`server/lib/sources/amazon.mjs`。
- **Avature**（`avature`）—— 依租戶的 `*.avature.net` ATS，解析 HTML，依主機偵測或 `provider: avature`。`server/lib/sources/avature.mjs`。
- **SAP SuccessFactors**（`successfactors`）—— 依租戶的 RMK 磚塊列表（`*.successfactors.eu/.com`、`jobs2web.com`），解析 HTML。`server/lib/sources/successfactors.mjs`。

每個來源都提供一個 `sources/<slug>.mjs`（自動探索的 `meta` → `#/scan` 下拉選單）**以及** `ALL_ADAPTERS` 中的一個 `portals/adapters/<slug>.mjs`（雙註冊表規則）+ `tests/sources-<slug>.test.mjs`。`ALL_ADAPTERS` 計數以及排序 id 與 `/api/scan/sources` EN 集斷言從 36→40；`GET /api/scan/sources` 現在列出 45 個。

## [1.86.0] — 2026-07-03

**依目標職位統計（`#/stats`）—— 針對你的目標職位的市場職缺與薪資統計。** 新增的分析頁面讀取你的**個人檔案中的目標職位**（`config/profile.yml` → 非硬編碼）以及最近一次掃描的職缺，然後依職位與國家顯示：

- **各國職缺數**與**各國薪資中位數（USD）** —— 於用戶端從掃描器已收集的稀疏資料彙整而成（`public/js/lib/role-stats.js`，重用 `window.Countries`）。任意幣別的薪資透過一個明確標註為近似值的 FX 匯率表正規化為 USD，並附上樣本數提醒 —— 絕不捏造。
- **職位與國家篩選器**以及手寫的內嵌 SVG 長條圖與趨勢圖（無新增相依套件，CSP 安全 —— 僅使用 `addEventListener`）。
- **儲存快照**（`POST /api/stats/snapshot`）將目前的彙整結果持久化至 `data/role-stats.jsonl`；**趨勢圖**（`GET /api/stats/trend`）追蹤職缺數隨時間的變化 —— 即「動態」檢視。誠實的混合方案：快照來自本機掃描資料，依需求重新整理。
- 已在全部 **16 個語言環境**中完整在地化（26 個新增 i18n 鍵）。

新增：`server/lib/routes/stats.mjs`（第 16 個路由模組）、`public/js/lib/role-stats.js`、`public/js/views/stats.js`、`PATHS.roleStats`；測試 `role-stats.test.mjs`（7）+ `stats-routes.test.mjs`（5）。

## [1.85.0] — 2026-07-03

**德語、義大利語和土耳其語語言環境（與父層 career-ops v1.16.0 語言環境對齊）。** 介面現在提供 **16 種語言** —— `de` 🇩🇪、`it` 🇮🇹 和 `tr` 🇹🇷 加入既有的 13 種。

- **完整介面翻譯** —— 全部 730 個 i18n 鍵皆在 `public/js/lib/locales/i18n-dict.{de,it,tr}.js` 中翻譯；語言切換器列出 Deutsch / Italiano / Türkçe，瀏覽器語言自動偵測可辨識 `de`/`it`/`tr`（`public/js/lib/i18n.js`）。
- **應用程式內說明指南** —— `docs/help/{de,it,tr}.md` 已翻譯（完整的 19 個 H2 / 75 個 H3 結構），由 `GET /api/help/:lang` 提供。
- **文件** —— 新增 `README.{de,it,tr}.md` 和 `CHANGELOG.{de,it,tr}.md`；CHANGELOG 語言環境對齊檢查現在涵蓋 15 個非 EN 語言環境。
- **提示鷹架** —— `server/lib/prompts.mjs`（`LOCALE_NAMES` + `SCAFFOLD_STRINGS`）已針對三個新語言環境在地化，使 LLM 輸出遵循介面語言。

所有對齊檢查（`i18n-locale-files`、`i18n-coverage`、`check-changelog-parity`、`lang-switcher-rtl`）皆擴展至 16 個語言環境集合。

## [1.84.0] — 2026-06-30

**重新申請冷卻 + pipeline.md 中的薪酬欄位（與父層 career-ops v1.15.0 對齊）。** 兩項掃描器升級：

- **重新申請冷卻**（#1201）：EN 掃描現在會略過你近期已投遞過的公司職缺，讓結果聚焦於全新機會。在 `config/profile.yml` 的 `re_apply_windows:` 下按公司設定冷卻視窗（`last_apply_date`、`same_role_days`、`applied_to: [roles]`，選填 `cross_role_bucket`）；公司比對採去標點 + 詞界模糊比對（`server/lib/cooldown.mjs`）。未設定該鍵時自動停用；掃描日誌顯示 `Cooldown skipped: N`。
- **pipeline.md 中的薪酬欄位**（#1017）：掃描到的職缺現在會以選填尾欄（`url | <salary>`）的形式將薪資持久化至 `data/pipeline.md`。URL 仍為去重鍵（讀取時會剝除 `| comp` 欄位），儲存格已做清理（無列/欄注入，以公式起始的內容會被中和），純 URL 格式的 pipeline 維持向下相容。

隨附 `tests/cooldown.test.mjs` 及 pipeline 薪酬測試。來源總數維持 41（兩項均為掃描邏輯升級，並非新看板）。

## [1.83.0] — 2026-06-30

**重複刊登 / 幽靈職缺偵測器（與父層 career-ops v1.15.0 對齊）。** `#/scan` 頁面新增 **🔁 重複刊登 / 幽靈職缺** 面板，標記同一公司＋職位組合在 90 天滾動視窗內以不同 URL 重複刊登的情形——此為招募管線停滯與幽靈職缺的信號。底層由模糊職稱比對器（`server/lib/role-matcher.mjs`）和針對 `data/scan-history.tsv` 的唯讀偵測器（`server/lib/detect-reposts.mjs`）支援，透過 `GET /api/scan/reposts` 公開。另：`/api/health` 的 `parentVersion` 現在僅回傳語意化版本號（已去除 release-please 的 `# x-release-please-version` 註解）。隨附 `tests/detect-reposts.test.mjs`。來源總數維持 41——重複刊登為分析功能，並非新看板。

## [1.82.0] — 2026-06-30

**NoDesk 掃描來源（與父層 career-ops v1.15.0 對齊）。** 全站 NoDesk 遠端職缺 RSS 來源現已成為一級掃描來源——加入 `provider: nodesk` 條目後即出現在 `#/scan` 的 **Source** 下拉中（共 **41 個轉接器**：36 EN + 5 RU）。主機鎖定為 `nodesk.co` 並使用 `redirect:'error'`（防 SSRF）；標題以 `Role at Company` 拆分（NoDesk 無地點標籤，地點欄位留空）；所有職缺標記為遠端。隨附 CI 隔離的 `tests/sources-nodesk.test.mjs` 測試套件；完整單元測試套件綠燈，共 1523 個。

## [1.81.0] — 2026-06-29

**與父層 career-ops 對齊 — 13 個全新職缺看板掃描來源。** 將 Fighter90/career-ops `main` 的最新提供者批次移植至 in-process 掃描器。**全站公開 API**（provider 選擇）：**Arbeitnow**、**Himalayas**、**Jobicy**、**Landing.jobs**、**4 Day Week**、**The Muse**、**The Hub**、**Jobspresso**（RSS），以及 **Hacker News "Who is hiring?"**（Algolia 兩步驟）。**波蘭看板**（主機或 `provider:` 偵測）：**JustJoin.it** 和 **NoFluffJobs**（POST 搜尋）。**按租戶 ATS**（從 `careers_url` 自動辨識）：**Pinpoint**（`<slug>.pinpointhq.com/postings.json`）和 **Rippling**（`ats.rippling.com/<slug>` → `api.rippling.com` board）。每個來源均以 `redirect:'error'` 鎖定主機（防 SSRF），並可在 `#/scan` 的 **Source** 下拉中選取 —— 註冊表現已提供 **40 個掃描器轉接器**（35 EN + 5 RU）。新增 13 個 CI 隔離的逐來源測試套件；完整單元測試套件綠燈，共 1513 個。

## [1.80.0] — 2026-06-28

**五項掃描升級（源自 job-crawler 的想法，已重新實作）。** (1) **Teamtailor** 來源——透過其公開 `/jobs.rss` 來源抓取 `<slug>.teamtailor.com` 的按租戶站點，從 `careers_url` 自動辨識（主機鎖定 + `redirect:'error'`）；註冊表現有 **27 個轉接器**。(2) **來源隔離**——回傳永久 404/410 的來源會寫入 `data/scan-quarantine.json` 並在後續掃描中略過（自我修復：14 天後重試）。(3) **每來源上限**——`#/scan` 上的選用欄位，限制每個 board 的職缺數（預設 ∞）。(4) **發佈時間**——用戶端的時效篩選（24 小時 / 7 天 / 30 天）。(5) **已儲存搜尋 + ★ 收藏**——為篩選組合命名並重用、為職缺加星；儲存在 `localStorage` 並具防禦性驗證（損壞的快取會乾淨重設）；結果快取在每次掃描前重設並即時回填。

## [1.79.0] — 2026-06-28

**WeWorkRemotely 掃描來源（與上游 career-ops v1.14.0 對齊）。** [We Work Remotely](https://weworkremotely.com) 全站遠端職缺 RSS 來源現已成為一級掃描來源——加入 `provider: weworkremotely` 條目後即出現在 `#/scan` 的 **Source** 下拉中（共 **26 個轉接器**）。主機鎖定為 weworkremotely.com 並使用 `redirect:'error'`（防 SSRF）；標題以 `Company: Role` 拆分。此外，`title_filter` 關鍵字現在會在長度檢查**之前修剪**（parent #1261）。

## [1.78.2] — 2026-06-27

**i18n 與 UX 強化（v1.78.1 的後續修復）。** 品牌 Logo 的無障礙名稱現已在全部 13 種語言在地化（`nav.logoHome`）。在已位於 `#/scan` 時按全域搜尋 **Enter** 會強制重新渲染，避免遺失預填關鍵字（同路由守衛）。`health.title` 現已翻譯為波蘭語（`Kondycja`）與丹麥語（`Systemtilstand`）——先前為英文。測試 1235 → 1238。

## [1.78.1] — 2026-06-27

**Scan 體驗修復。** `#/scan` 結果表現在會在掃描期間即時自動重新整理，並在結束後再刷新一次，無需手動重新載入。頂列全域搜尋顯示 **Enter** 提示；對於非 URL 查詢，會跳轉到 `#/scan` 並預先填入搜尋框（先前為 `#/tracker`）。Logo 現在連結到儀表板（首頁）。

## [1.78.0] — 2026-06-27

**Scan 頁面新增地理篩選 —— 依國家篩選職缺（帶國旗）。** `#/scan` 中新的 **國家** 下拉選單列出在結果中辨識到的每個國家（國旗表情 + 數量），可僅保留與特定國家相關的職缺 —— 與 Remote/Hybrid/Onsite 工作方式篩選並用，既能找綁定國家的工作，也能找遠端。由新的 `countries.js` 輔助程式支援，將職缺的自由文字地點（國家名、別名及約 100 個主要城市）對應到 ISO 國家 + 國旗；辨識保守，絕不臆測。

## [1.77.0] — 2026-06-27

**新增丹麥語（Dansk）作為第 13 種介面語言。** 完整翻譯 UI、應用內說明指南（19 H2 / 75 H3）、README 與 CHANGELOG。丹麥語加入帶國旗的語言選擇器；i18n 機制（組譯器、稽核、對等檢查、快照）現已涵蓋 13 個語言環境。

## [1.76.0] — 2026-06-26

**與上游 career-ops v1.13.0 對齊 —— 新增 6 個職缺來源、強化掃描器、結果表取消上限。**

### 新增
- **6 個按租戶的 ATS 來源** —— BambooHR、Breezy HR、Comeet、Personio、Recruitee、SolidJobs。從 `careers_url` 主機自動辨識（Comeet 需完整 `api:`）；每個主機以錨定正規表示式 + `redirect:'error'` 鎖定（防 SSRF）。可在 `#/scan` 的 **Source** 下拉選單中選擇 —— 註冊表現有 **25 個轉接器**（EN 20 + RU 5）。為 Personio 的 XML 來源新增 `fetchText` 輔助函式。
- **`trust_filter`** —— 選用的信任評分（0–100，等級 high/medium/low，旗標），僅標註。低於 `high` 的列在 `#/scan` 顯示語言中立的 ⚠ 徽章；絕不丟棄職缺。
- **Arbeitsagentur `remoteMatch` + `remoteMaxPages`** —— 由設定驅動的遠端辨識：`title`、`filter`（伺服器端 `homeoffice=nv_true` + 分頁）或 `off`。

### 變更
- **掃描結果不再設上限。** 移除顯示上限 `MAX_STORED_RESULTS`（2000）—— 儲存所有相符項，`#/scan` 表格分頁顯示（200/頁）。
- **標題篩選更穩健** —— 短縮寫（COO、SDR…）依詞界比對；格式錯誤的 `title_filter` 不再使掃描崩潰。ATS 與區域掃描器皆適用。

### 測試
- +32 案例（1190 → **1222**）：`sources-ats-providers`、`title-filter`、`arbeitsagentur-remote`、`trust-validator`，以及重寫的 `scan-result-cap`「無上限」守衛。

## [1.75.2] — 2026-06-19

**docs：在全部 12 個語言環境中為 v1.75.0 的掃描器彙整器提供完整的文件對等。** 無程式碼改動 — 將面向使用者的文件與 v1.75.0 中落地的七個來源對齊:

- **說明指南（12 個語言環境）。** §5 新增一個 `content_filter` 區塊（依描述/摘要關鍵字門控,是 `location_filter` 的同類項）以及一則關於彙整器的說明;§7 在一鍵掃描的巡覽與完整的 **Source** 下拉列舉中列出這七個新來源;§17 的轉接器計數從過時的 "11 adapters" 更正為 "19 adapters — 14 English + 5 Russian"。沒有新增 `##`/`###` 標題,因此受門控的 19 H2 / 75 H3 結構保持不變。
- **README（9 個完整語言環境）。** 在掃描來源下新增 "Aggregator boards (v1.75.0)" 條目,並將發布徽章提升至 v1.75.2。（精簡版的 pl/uk/ar README 沒有依來源的清單,該處刻意不作改動。）
- **參考文件。** `docs/portals-examples.md` 新增一個可複製貼上的 "Aggregator boards" 章節,為這七個來源提供準確的 `provider:` / `<provider>:` 設定區塊;`docs/PROJECT.md` 更新為 **19 adapters**;`docs/sdd/CONVENTIONS.md` 記錄了兩個註冊表的區分（用於下拉的 `sources/registry.mjs` 對用於抓取的 `portals/registry.mjs`）、以 `opts.company` 形式傳遞的基於 `provider:` 的彙整器選擇、掃描寫入清理器（`scan-sanitize.mjs`）以及 v1.75.1 的測試數量（1190）。
- **QA。** 新增 `qa/QA-REGRESSION-PROMPT-v1.75.2-FULL.md` — 全表面發布閘驅動器,已為 v1.75.x 掃描彙整器週期翻新。

---



## [1.75.1] — 2026-06-19

**fix(scan): 對 v1.75.0 組態驅動來源的健全性打磨。** 來自發布後檢討的三處小型強化修正(正常掃描下行為不變):

- **支援中止的分頁延遲。** Glints(300 ms)與 Jobstreet/SEEK(200 ms)的翻頁禮貌等待現在會在掃描的 `AbortSignal` 觸發時立即結束,這透過 `server/lib/http-json.mjs` 中新增的 `delay(ms, signal)` 輔助函式實現,因此已斷線的用戶端無法讓一個正在分頁的掃描多佔用一段等待時間。
- **描述性的非 JSON 錯誤。** `fetchJson` 現在會將非 JSON 的 `2xx` 回應主體(例如以狀態碼 200 回傳的 HTML 維護頁)包裝為 `non-JSON 2xx response from <url>`,而非暴露一個裸的 `SyntaxError`,因此掃描器依來源記錄的錯誤日誌會指明行為異常的端點。
- **更強的掃描寫入正規化。** `normalizeScanScalar` 現在除了 `\r \n \t` 之外,還會折疊垂直定位字元、換頁字元以及 Unicode 行/段分隔符(`\v \f U+2028 U+2029`)——這是一個嚴格的超集,因此任何試算表或檢視器可能辨識的記錄/行分隔符都不會殘留進 `scan-history.tsv`。

---


## [1.75.0] — 2026-06-19

**feat(scan)：移植父層 career-ops v1.12.0 — 七個新的職缺來源、內容過濾以及安全/品質修正。** web-ui 執行自己的程序內掃描器（不會向父層的 `scan.mjs` 進行 shell out），因此父層 v1.12.0 的提供者與掃描變更不會自動流入 — 本次發布將其中適用的部分按 web-ui 的轉接器契約重新實作。

- **七個新的掃描器來源。** 三個涵蓋整個職缺板的遠端彙整器 — **RemoteOK**、**Remotive**、**Working Nomads** — 接入自動探索的 `server/lib/sources/*.mjs` 模式（以 `provider: remoteok` / `remotive` / `workingnomads` 選擇）。四個由設定驅動的區域彙整器 — **IBM** careers、**Arbeitsagentur**（德國聯邦勞動局）、**Glints**（東南亞）、**Jobstreet / SEEK** — 讀取依條目的 `<provider>:` 設定區塊；en-scanner 現在會將解析後的公司條目一路傳遞到每個 fetcher，以便它們能夠讀取。這七個來源都會自動出現在 `#/scan` 的來源下拉選單中。
- **`content_filter`（父層 #974）。** 可選的 `portals.yml` 區塊（`positive` / `negative` 關鍵字清單），依職缺的描述/摘要文字對其進行門控 — 沿用 `location_filter` 的語意；沒有描述的職缺一律通過。已接入 EN 與 RU 兩個掃描器。
- **掃描寫入強化（父層 #1098）。** 外部資訊來源的中繼資料現在會在落入 `data/scan-history.tsv` 與 `data/pipeline.md` 之前進行清理：控制字元會被摺疊（公司名/職稱中的換行不再能注入一列 TSV），開頭的 `= + - @` 會被中和以防試算表公式注入。
- **Ashby `secondaryLocations`（父層 #1073）。** Ashby 來源現在會將每個次要地點的地區標籤連同郵政 `addressLocality` / `addressCountry` 摺疊進地點字串（去重），因此主標籤顯示為例如 "Canada" 的可在歐盟工作的職缺會被 `location_filter` 浮現出來。
- **評估報告形狀驗證（父層 #819）。** `/api/evaluate` 的程序內提供者（Anthropic / OpenAI / Qwen / OpenRouter / GitHub Models）現在會將格式錯誤的 A–G / `SCORE_SUMMARY` 報告標記為非致命的 `warnings` 陣列；Gemini 評估路徑已從父層的 `gemini-eval.mjs` 繼承該防護。
- **docs：** 在全部 12 個 README 的受支援助手清單中加入 Antigravity CLI（對應到 Gemini 提供者）。

從父層 `git pull` 免費繼承（web-ui 會向這些 shell out）：日語 CJK PDF 字型回退（#1053）、ATS 安全的 PDF 字型（#1074）、LaTeX CJK 防護（#1054）、tracker/merge/followup/dashboard 修正，以及 `modes/zh` 中文模式（web-ui 會動態列出模式）。

---


## [1.74.3] — 2026-06-18

**docs(parent-source): 將父 `career-ops` 儲存庫指向 [`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) 分叉。** web-ui 現在在所有作為實際來源的位置都將維護者的分叉作為父專案引用:`bin/setup.sh` 安裝腳本的 `CAREER_OPS_REPO` clone 預設值、12 個 README 中的每個 `git clone` /「建構於其上」/ onboarding 連結,以及代理文件(`CLAUDE.md`、`AGENTS.md`、`GEMINI.md`、`.github/copilot-instructions.md`、`docs/`)。對作者 santifer 的署名(以及非官方 UI 免責聲明)保持不變 —— 僅移動了來源/clone URL。`tests/sh-files.test.mjs` 現在斷言安裝腳本 clone 的是分叉。

---


## [1.74.2] — 2026-06-17

**fix(health): 在 `#/health` 與 `/api/status/providers` 中將 `GITHUB_MODELS_API_KEY` 作為可選檢查項目呈現。** v1.74.0 的 GitHub Models 提供商可在 `#/config` 中設定，但在 Health 頁面上沒有對應列，且在 `keysConfigured` 提供商表面中缺失。新增了可選檢查項目（與其他五個線上評估提供商相同的 "set / unset (manual mode)" 措辭），並將 `github`（及其 `GITHUB_MODELS_MODEL`）新增至 `/api/status/providers`，因此活動提供商路由與 Health 頁面現在均反映全部六個。`tests/api.test.mjs` 的健康列測試已擴展到全部六個提供商。

---



## [1.74.1] — 2026-06-17

**docs + test: README「安裝 AI 助手」章節；Gemini 連接器的完整分支覆蓋。** 在 README 中新增安裝/登入對照表——Claude Code / Gemini CLI / Codex / Qwen Code / OpenCode / GitHub Copilot CLI 的安裝連結 + 各自的 `#/config` 提供商對應 + 「繼續前請先登入」（與 career-ops.org/docs 快速入門保持一致；說明 web-ui 是無需 CLI 的獨立替代方案）。新增 `tests/gemini-connector.test.mjs`（8 個案例），涵蓋 `runGemini` 的每個分支——無金鑰、成功、API 錯誤、空/被封鎖的補全、格式錯誤的回應主體、逾時、網路錯誤、`hasGeminiKey`——使 `server/lib/gemini.mjs` 語句覆蓋率達到 100%。整體覆蓋率：96% 行 / 88% 分支 / 96% 函式。測試套件 1126 → 1134。

---



## [1.74.0] — 2026-06-17

**feat(llm): GitHub Models (Copilot) 作為第6個提供商 + 6個助手的規範對齊。** career-ops.org/docs 列出了六個AI程式設計助手 — Claude Code, Gemini CLI, Codex, Qwen Code, OpenCode, GitHub Copilot CLI。web-ui 現在支援全部六個：五個對應到現有的線上提供商（Anthropic / Gemini / OpenAI / Qwen / OpenRouter），GitHub Copilot CLI 獲得了專用的 GitHub Models 連接器 — `runGitHubModels`（OpenAI-compatible；具有 `models` 權限範圍的 GitHub PAT），可在 `#/config` 中設定（`GITHUB_MODELS_API_KEY` + `GITHUB_MODELS_MODEL`），並可透過 `LLM_PROVIDER=github` 選擇；在 auto 順序中排第6位。說明套件和 README 現在列出了規範的六個（將 Qwen CLI 重新命名為 Qwen Code；新增了 Gemini CLI + GitHub Copilot CLI），README 還新增了完整的模式參考和入口網站介面卡連結表，指向 career-ops.org/docs，使每個功能都可以追溯到父專案。`tests/llm-provider-context.test.mjs` 將擷取邊界矩陣擴展到所有六個提供商（`cv.md` + `profile.yml` 內嵌 + 傳回的構件）；新的 `GITHUB_MODELS_*` 鍵已新增至所有 12 個語言區域字典中。測試套件 1125 → 1126。

---



## [1.73.0] — 2026-06-17

**feat(llm): 通用 Gemini 連接器 + 跨所有提供商驗證的履歷/設定檔上下文。** 新增 `server/lib/gemini.mjs`（`runGemini`）——一個無外部依賴的 Gemini `generateContent` 客戶端，回傳與 Anthropic / OpenAI 相容客戶端相同的 `{markdown, usage, error}` 結構。修正：`/api/mode/:slug` 與 `/api/deep` 先前將提示詞路由至僅用於職缺評估的 `gemini-eval.mjs`，導致 Gemini **Run live** 回傳評估結果而非請求的產物（求職信、外聯信、簡報）。現在它們透過 `bundleProjectContext` 呼叫 `runGemini`，因此 `cv.md` + `config/profile.yml` 對 Gemini 的內嵌方式與其他所有提供商完全一致——信件和簡報更加詳盡且個人化。新增的 `tests/llm-provider-context.test.mjs` 模擬每個提供商的 HTTP 邊界，並驗證全部五個提供商（Anthropic / Gemini / OpenAI / Qwen / OpenRouter）均內嵌 `cv.md` + `profile.yml` 並回傳產物（mode + deep + evaluate 矩陣，9 個案例）。`/api/evaluate` 保留其針對職缺調優的 `gemini-eval.mjs`。Suite 1116 → 1125。

---



## [1.72.0] — 2026-06-17

**feat(modes): **Run live** 現在直接傳回最終產出物（單次執行輸出契約）。** 父模板 `modes/<slug>.md` 是為 Claude Code 的互動式工作階段所撰寫的——其中幾個（cover、contacto 等）在產生結果前會暫停以詢問釐清問題，導致 Web UI 的 **Run live** 輸出問卷而非產出物。`buildModePrompt` 現在將每個模式包裹在非互動式輸出契約中：靜默執行分析（職缺說明拆解、公司備註、ATS 關鍵字、個人檔案↔職缺差距、語氣/角度選擇），從 `cv.md` / `config/profile.yml` 為模板通常會詢問的內容選取合理的預設值，並僅輸出最終產出物——以每種模式的「output ONLY {the cover letter / outreach message / …}」提示作為結尾。因此，在 `#/cover` 上點擊 **Run live** 現在將直接傳回求職信本身；相同的修正適用於所有通用模式（cover、contacto、interview-prep、project、training、followup、patterns）的全部 12 個語言環境（產出物透過語言環境指令以 UI 語言撰寫）。Suite 1103 → 1116。

---



## [1.71.2] — 2026-06-17

**docs(i18n):** 發布文件一致性整理結果。每個 README 的 "Translations of this guide" 區塊現在列出了全部 11 種同級語言（此前部分語言遺漏了 English/Français 或存在自連結），並恢復了節分隔符前的空行。完整的 QA 回歸提示詞已重命名為目前版本，文件（`CLAUDE.md`、`CONVENTIONS`、`LOCALIZATION`、`PROJECT-CONTEXT`）已與目前版本和測試數量（1103）同步。無程式碼或行為變更——僅文件變更，因此說明/UI 翻譯及 1.70.0–1.71.1 中的所有功能均保持不變。

---



## [1.71.1] — 2026-06-17

**fix(i18n): 應用程式內的說明指南現已完整翻譯為全部 12 種語言。** 新增 `docs/help/{pl,uk,ar}.md`（每個檔案均包含經過驗證的 19 H2 / 75 H3 結構），使 `#/help` 能夠為波蘭語、烏克蘭語和阿拉伯語提供原生語言包，而不再退回英語 — `GET /api/help/{pl,uk,ar}` 現在會回傳各自的語言區域內容。已串接至所有說明檢查項（`help-ui`、`help.test`、`help-ru-config-section`、`canonical-docs-coverage`）。同時完成了所有 12 種語言的翻譯清單：README 中的 «Translations of this guide» 區塊（9 個 README）、本地化 CHANGELOG 中的 «Translations:» 標題（8 個檔案），並更新了過時的文件計數。Suite 1100 → 1103。

---



## [1.71.0] — 2026-06-16

**feat(cover): 直接從 `#/cover` 產生求職信 PDF。** v1.70.0 新增的 cover 模式可產生信件內文；結果頁面現在提供 **Generate PDF** 按鈕，透過共用的內嵌 markdown→PDF 管線（`POST /api/stream/pdf/inline` → `generate-pdf.mjs`）進行渲染，與 interview-prep 使用的路徑相同。現在無需離開 SPA 即可撰寫信件並產生 PDF 傳送。

**test/docs: v1.70.0 審查強化。** 為 cover 模式（允許清單 + 提示詞組裝）、國旗 `<select>` 切換器 + 阿拉伯語 RTL（`dirFor`/`<html dir>`）、每個語言環境的 `top.langLabel`、求職信 PDF 連接，以及 `prompts.mjs` 語言環境指令 + fr/pl/uk/ar 鷹架新增了 CI 隔離覆蓋率。更新了 `docs/sdd/CONVENTIONS.md` 和完整專案 QA 迴歸提示中過時的「全部 8 個」→ 12 個語言環境參照。

---



## [1.70.0] — 2026-06-16

**feat(i18n): 新增三種 UI 語言——波蘭語（pl）、烏克蘭語（uk）和阿拉伯語（ar，含完整 RTL 支援）——將 SPA 擴展至 12 個語言區域，與父專案 career-ops README 中的所有語言保持一致。** 每種新語言區域均附帶包含 697 個鍵的完整詞典（`public/js/lib/locales/i18n-dict.{pl,uk,ar}.js`），並通過現有的奇偶校驗 / 覆蓋率 / 無拉丁字母洩漏 / 無個人資料測試套件驗證。阿拉伯語新增真正的由右至左支援：`i18n.js` 為 RTL 語言區域設定 `<html dir="rtl">`，`app.css` 中有範圍的 `[dir="rtl"]` 區塊鏡像頁面外殼（側邊欄、通知抽屜、markdown 表格/區塊引用、行內間距）——LTR 語言區域的位元組內容完全不變。新增 `top.langLabel` 鍵（×12）為螢幕閱讀器命名語言選擇器。

**feat(ui): 帶國旗圖示的 `<select>` 語言切換器取代了原本會換行的按鈕列。** 有 12 個語言區域時，舊的 `.lang-btn` 列在側邊欄中會換行為三列；原生 `<select>`（每個選項以國旗 emoji 為前綴）能夠整潔地擴展，開箱即用地支援鍵盤和螢幕閱讀器，並且對 CSP 安全（透過 `addEventListener` 處理變更事件，無內嵌 JS）。在平台缺少國旗字形的情況下，國旗會降級為地區字母，因此語言標籤始終是關鍵識別符。

**feat(cover): 將父專案的求職信模式（career-ops v1.10.0 + v1.11.0 問候語）移植到 SPA。** 在「申請」導航群組下新增 `#/cover` 頁面，基於通用模式執行器建構：職位描述 + 公司/職位 + 可選問候語 → 從 `cv.md` / `modes/_profile.md` 生成的客製化求職信。將 `cover` 新增至伺服器 `MODE_ALLOWLIST` 和 `cover.*` i18n 區塊（×12 個語言區域）。

**chore(compat): 追蹤父專案 career-ops v1.11.0。** 已驗證讀寫契約完好無損——`data/applications.md` 仍是 markdown 真實資料來源（v1.11.0 SQLite 追蹤器索引是派生快取），追蹤器欄位仍按標題映射。`parentVersion` 現在回報 1.11.0。

**fix(i18n): 修復了一個潛在缺陷，即法語（在 v1.61.0 中新增）缺失於 `server/lib/prompts.mjs` 的 `LOCALE_NAMES` 和 `SCAFFOLD_STRINGS` 中**——法語 LLM 呼叫靜默回退至英語輸出和英語鷹架。fr/pl/uk/ar 現已全部接入提示語言區域路徑。

> 已知後續工作：應用程式內說明指南（`docs/help/`）對 pl/uk/ar 回退至英語（UI 外殼本身已完全在地化）；父專案的互動式面試引導、反向 ATS 探索以及較新的掃描提供商尚未在 SPA 中呈現。

---




## [1.69.2] — 2026-06-12

**fix(test)：修復一處測試隔離洩漏，此前 `npm test` 會覆寫你真實的 `config/profile.yml` 和 `data/scan-history.tsv`。** `tests/critical-fixes.test.mjs` 在檔案頂部匯入了 `prompts.mjs`（→ `paths.mjs`），導致在 `before()` 將 `CAREER_OPS_ROOT` 設為暫存目錄之前，`PROJECT_ROOT` 就解析到了真實的父目錄 —— 於是 `PUT /api/profile` 每次執行都會把「Acceptance Test」夾具寫入你的真實檔案。修復：在 `before()` 內透過動態 `import()` 載入 `prompts.mjs`。新增 `tests/test-root-isolation.test.mjs`（2 個案例）保護整個測試套件免受該模式影響。無正式環境程式碼變更。測試套件 1084 → 1086。

---



## [1.69.1] — 2026-06-12

**fix(scan):`#/scan` 不再靜默截斷大型區域掃描。** 每個區域的顯示集被硬限制為 500 筆（真實的 RU 掃描有 1352 筆相符，卻只顯示 500 筆，隱藏 852 筆 —— 即「掃描 2000、僅顯示約 600」的症狀）。兩個掃描器現在使用共用且可經環境變數覆寫的常數 `MAX_STORED_RESULTS`（預設 2000，可透過 `SCAN_MAX_RESULTS` 覆寫）。僅影響顯示 —— 寫入 `pipeline.md` / `scan-history.tsv` 早已使用未截斷的集合。**fix(health/ui):`#/health` 檢查卡片不再溢位。** 過長的名稱/值會與 **Fix →** 按鈕和狀態徽章重疊；該列現在透過 `.health-check-row` 收縮並換行。新增測試 `scan-result-cap` + `health-card-overflow`。測試套件 1079 → 1084。

---



## [1.69.0] — 2026-06-12

**feat(scan)：掃描器轉接器自動發現 (P-14)——只需在 `server/lib/sources/` 中放入一個 `.mjs` 檔案即可註冊新資料源。** 在 v1.69 之前，`server/lib/sources/registry.mjs` 中的資料源清單是手動維護的靜態陣列：新增轉接器需要同時修改 `<id>.mjs` 和 `registry.mjs`。完成路線圖項目 P-14（`docs/ROADMAP.md`）的剩餘部分。現在 `server/lib/sources/` 中的每個 `*.mjs` 在模組啟動時動態載入，每個轉接器透過自描述區塊 `export const meta = { value, label, region, configKey? }` 宣告自身。已發布的 12 個轉接器（ashby / greenhouse / lever / rss / smartrecruiters / workable / workday + geekjob / getmatch / habr / hh / trudvsem）各自獲得 `meta`；`registry.mjs` 透過 top-level await 解析 `readdirSync` + 動態 `import()`（Node 18+ ESM 標準）。公開 API（`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`, `getRegionalSources`）保持不變——所有現有匯入繼續運作。格式錯誤的 `meta` 會被拒絕，每個問題檔案都會輸出一次 `console.warn`。新增 `tests/sources-registry-discovery.test.mjs`，包含 14 個測試案例。套件 1065 → 1079。

---



## [1.68.2] — 2026-06-07

**fix(bin)：透過 `npx` / `npm link` 呼叫的 CLI 動詞先前已損壞——現在 bin 路徑會沿符號連結解析。** npm 與 npx 會將 `career-ops-ui` 公開為 `node_modules/.bin/` 下的符號連結，而舊的 `dirname "${BASH_SOURCE[0]}"` 指向的是 `.bin` 而非套件根目錄，於是 `npx career-ops-ui init` 會執行 `node node_modules/scripts/init.mjs` 並以 `MODULE_NOT_FOUND` 崩潰（本機 `npm install` 執行不受影響，因而掩蓋了該缺陷）。現在 `bin/career-ops-ui.sh` 與 `bin/start.sh` 會沿符號連結鏈正規化 `SCRIPT_DIR`（`readlink` 迴圈 + `cd -P`），因此每個動詞都能從儲存庫、透過 `npm link` 以及透過 `npx` 正常運作。在 `tests/sh-files.test.mjs` 中新增一個回歸鎖，透過 `.bin` 風格的符號連結執行動詞。套件 1065/1065。

---



## [1.68.1] — 2026-05-29

**fix(scan)：各來源抓取逾時 10s → 60s。** v1.67.1 的 10s 快速失敗也會切掉只是需要更多時間的「緩慢但存活」的 Ashby 看板。把預設值提高到一分鐘，讓它們有機會回傳。權衡：真正死掉/掛起的來源現在會占用並行槽整整 60s（最壞情況掃描更慢），而長期掛起者（Perplexity、Supabase、Resend 等）很可能仍會逾時——要真正解決需按來源處理 / 降低 Ashby 並行。可用 `SCAN_FETCH_TIMEOUT_MS` 覆寫。套件 1063/1063。

---



## [1.68.0] — 2026-05-29

**feat(scan)：重做結果篩選面板 —— 帶標籤的欄位、套用按鈕、現場辦公選項，以及真正生效的薪資篩選。** `#/scan` 的每個篩選現在都是帶標籤的欄位（標籤在控制項**上方**，而非佔位符）：搜尋 · 工作類型 · 薪資下限 · 薪資上限 · 來源 · 範圍。明確的**套用**按鈕（外加**重設**，以及在任意欄位按 Enter）會重新執行篩選；頁面提示說明用法。**薪資區間現在真正生效** —— 一旦設定下限/上限，薪酬超出區間的職缺**以及未標註薪資的職缺**都會被移除（區間重疊；忽略幣別）。工作類型篩選在 遠端 / 混合 / 搬遷 之外新增**現場辦公**選項。新增 i18n 鍵 ×9；`salaryInRange` 改為嚴格；套件 1063/1063。

---



## [1.67.1] — 2026-05-29

**fix(scan)：各來源抓取逾時 30s → 10s（快速失敗）。** v1.67.0 提到 30s 只挽回約一半的緩慢 Ashby 看板；其餘（Perplexity、Supabase、Resend、DeepL、Ramp 等）無論期限都會掛起，因此更長的逾時只是讓整次掃描在等待死槽時停滯。10s 對長期掛起者快速失敗並保持掃描的回應性。可用 `SCAN_FETCH_TIMEOUT_MS` 覆寫。套件 1060/1060。

---



## [1.67.0] — 2026-05-29

**feat(scan)：`#/scan` 新增薪資區間（下限／上限）篩選，並延長各來源的抓取逾時。** 結果表在文字與遠端篩選旁新增兩個數字輸入（薪資 **下限** ／ **上限**）。每列的自由文字薪資（`от 100 000 до 200 000 ₽`、`120000-150000 USD`、`$120K–$150K` 等）會被解析為數字區間，並依區間重疊進行比對；未標註薪資的列會保留，因此篩選只是縮小清單而非清空（比較不分幣別——不做匯率換算）。同時**將各來源掃描的抓取逾時從 15s → 30s**（可用 `SCAN_FETCH_TIMEOUT_MS` 覆寫）：Ashby 的 `includeCompensation` 負載在 ×8 並發下經常超過 15s，導致每次掃描約有 30 個 Ashby 看板逾時。新增 `window.Skills.parseSalaryRange`／`salaryInRange` + i18n ×9；新增 13 項測試；套件 1060/1060。

---



## [1.66.0] — 2026-05-28

**feat(scan)：RU 來源現在遍歷全部結果頁，而非僅第一頁。** hh.ru、Habr Career 與 Trudvsem 先前每次查詢只取前 ~50 筆；現在會翻到最後一頁——hh.ru/Habr 用 `&page=N`，Trudvsem 用 `offset`/`meta.total`——跨頁去重，並在某頁沒有新結果時（或到 50 頁安全上限）停止。像「Backend разработчик」這樣的查詢現在回傳完整結果而非一頁（如 hh.ru PHP 17 → 3 頁 55+ 筆；Trudvsem 回傳全部 72 筆）。逐頁請求保留既有的逾時 + AbortSignal。新增 4 項測試；套件 1045/1045。

---



## [1.65.0] — 2026-05-28

**feat(scan)：hh.ru 改為從其公開網站抓取，而非 JSON API——任何 IP 皆可用,無需代理。** `api.hh.ru` 開始無論 IP 或 User-Agent 都對所有程式化用戶端回傳 `403 forbidden`（邊緣反爬封鎖）。而網站（`hh.ru/search/vacancy`）會向任何類瀏覽器用戶端回傳完整結果，因此配接器現在解析該 HTML（與 Habr Career 相同）。**移除 1.64.0 的 `HH_PROXY` 變數與 `undici` 相依**——無需代理、金鑰或 User-Agent。測試改寫為 HTML 解析；套件 1041/1041。

---



## [1.64.0] — 2026-05-27

**feat(scan)：透過 `HH_PROXY` 將 hh.ru 請求經俄羅斯代理轉發。** hh.ru 以 **IP**（而非 User-Agent）封鎖其 API，因此單靠 `HH_USER_AGENT` 無法解除來自非俄羅斯出口節點的 403。將 `HH_PROXY` 設為俄羅斯 HTTP/HTTPS 代理 URL（如 `http://user:pass@ru-host:port`），則**僅** hh.ru 請求經該代理轉發，其餘來源維持直連。基於 `undici` 的 `ProxyAgent`（新增執行階段相依）；未設定 `HH_PROXY` 時完全不附加 dispatcher。新增 3 項測試；套件 1041/1041。

---



## [1.63.2] — 2026-05-27

**feat(scan):`#/scan` 主控台即時顯示 % 進度 + 依來源的詳細日誌。** 進度條現為**確定式** —— 掃描器發出進度事件(EN:依公司;RU:依查詢)經 SSE 轉發,進度條帶 **"Scanning… NN%"** 標籤填充(動畫條紋僅持續到首個事件)。每個來源的首次失敗(逾時 / 403 / 網路)會在主控台詳細輸出,之後的重複予以抑制。新增 1 項測試;套件 1040/1040。

---



## [1.63.1] — 2026-05-27

**style(scan):讓 `#/scan` 進度條更醒目。** 為執行中指示器加上可見的 **"Scanning…"** 文字,並將進度條加高到 **8px**(原為細 4px),掃描時清晰可見。行為無變化。

---



## [1.63.0] — 2026-05-27

**feat(scan):依請求逾時 + `#/scan` 進度條。** 來源請求沒有截止時間,因此卡住的上游(例如來自被封 IP 的 `api.hh.ru`)可能**讓整個掃描掛起**。新增 `server/lib/fetch-timeout.mjs` 包裝掃描器的 `fetchImpl`(`makeTimeoutFetch`,預設 **15 秒**,可用 `SCAN_FETCH_TIMEOUT_MS` 覆寫),為每個請求設定硬性截止;逾時來源記為非致命錯誤,掃描繼續。`#/scan` 在掃描期間顯示進度條(全部 9 個語系的 `scan.progress`)。新增 7 項測試;套件 1039/1039。

---



## [1.62.3] — 2026-05-27

**docs:釐清安裝方式(career-ops-ui 執行於 `career-ops/web-ui/` 內)+ `init` 疑難排解,涵蓋全部 9 個語系。** 將安裝小節重寫為 **Option 1**(一條 curl)/ **Option 2**(在既有 career-ops 專案內以 `web-ui` 複製 UI)+ CLI 指令 + 供應商設定 + **Troubleshooting `init`** 區塊。巢狀結構說明亦加入 `/help` §1 Setup;README 重點處彙總整個 v1.62.* 系列。僅文件,無程式碼改動。

---



## [1.62.2] — 2026-05-27

**fix(help):`#/help` 篩選現已支援全文檢索(可找到像 RSS 這樣的 H3 子小節)。** 說明頁的搜尋/目錄篩選此前僅比對 H2 小節標題,因此 v1.62.x 的 RSS 文件(§5 Portals & sources 下的 H3)無法被找到。現在每個小節的內文也會被索引到篩選中,因此搜尋如「RSS」即可定位到 §5。純前端改動,無 API 變更。

---



## [1.62.1] — 2026-05-27

**feat(scan)：來源篩選器加入 RSS + 修正 RSS 地點。** `#/scan` 的來源篩選下拉選單現在會列出 **RSS**(已加入 `server/lib/sources/registry.mjs` 與 SPA 後備清單),因此 RSS 徵才看板(LaraJobs、WeWorkRemotely 等)的結果可像任何 ATS 來源一樣篩選。RSS 轉接器不再將來源的 `<category>` 標籤對應到 `location` —— 這些非地點標籤會讓 `location_filter` 誤刪遠端職缺;現在 `location` 留空,來源即可通過地點篩選。掃描按鈕的提示/標籤與來源清單 i18n 文字已於全部 9 個語系中更新(Workable / SmartRecruiters / Workday / RSS)。已更新 i18n 快照與來源端點測試(EN 6 → 7)。

---



## [1.62.0] — 2026-05-27

**feat(scan)：用於非 ATS 徵才看板的通用 RSS 轉接器。** 新增 `rss` 轉接器（`server/lib/portals/adapters/rss.mjs` + `server/lib/sources/rss.mjs`），讓掃描器能從任意 RSS 來源擷取職缺 —— LaraJobs、WeWorkRemotely、RemoteOK、golangprojects 以及 Greenhouse/Ashby/Lever 以外的其他看板。無新增相依套件：以正規表示式解析來源，支援 CDATA 與 HTML 實體（標題/公司名去除標籤，星位碼點安全解碼）。透過 `portals.yml` 的 `provider: rss` / `rss:` / `feed_url:` 依公司啟用，不會攔截已比對到 ATS 的公司。`ALL_ADAPTERS` 由 6 增至 7。新增 29 項測試；已於全部 9 個 README 語系中記載。

---



## [1.61.1] — 2026-05-22

**fix(i18n)：在全部 9 種語言中在地化主題切換按鈕的 title 與 aria-label（MINOR-001）。** 明/暗主題按鈕(`#theme-toggle`)在 `index.html` 中硬編碼了 `title="Toggle theme"` 和 `aria-label="Toggle theme"` —— 所有語言下工具提示與螢幕閱讀器文字都未翻譯。新增 `top.themeToggle` 鍵 + `applyI18n()` 中的 `data-i18n-title` 處理器(沿用 v1.58.15 搜尋 aria-label 修復的模式),在啟動時及每次切換語言時在地化這兩個屬性。由 `tests/playwright-theme-toggle-i18n.mjs`(9 語言 + 執行階段切換)與兩個靜態守衛鎖定。v1.61.0 法語簽收中唯一的 LOW 項。(MINOR-001)

---



## [1.61.0] — 2026-05-22

**feat(i18n)：新增法語作為第 9 種介面語言。** 新的依語言字典 `public/js/lib/locales/i18n-dict.fr.js`（`window.__I18N_DICT_FR`）與英語完全對等（**668 個鍵**）；新的說明包 `docs/help/fr.md`（**19 H2 / 73 H3**，與 `en` 結構完全對等）。`fr` 已註冊至語言切換器與瀏覽器自動偵測（`i18n.js`）、組裝器（`i18n-dict.js`）、`index.html`（位於組裝器之前的 `<script>` 標籤）、測試快照以及所有測試語言清單中。初始翻譯表來自 **PR #9**（社群貢獻）。邏輯無變更：`t()` 與所有視圖保持不變。單元測試 **1001 / 1001**；Playwright 語言巡覽擴充為 9 個子測試。(FR-LOCALE)

---



## [1.60.0] — 2026-05-22

**refactor(i18n): 將 8 語言合一的大檔案拆分為按語言的檔案 (I18N-SPLIT).** 翻譯字典原先位於單一 `public/js/lib/i18n-dict.js`；現改為 `public/js/lib/locales/` 下**每種語言一個檔案**外加共用的 `i18n-dict.aliases.js`，讓譯者可以獨立編輯單一語言（i18next / OpenWA 佈局）。`i18n-dict.js` 現在是一個**組裝器**，把各語言表重新合併成完全相同的 `window.__I18N_DICT`，因此 `t()` 與所有視圖保持不變。透過 `<script src>` 同步載入——無建置、無 fetch。快照證明遷移無損（678 個鍵）。工具與約 25 個測試已適配拆分；新增 `tests/i18n-locale-files.test.mjs` 與 `tests/playwright-locale-sweep.mjs`（在真實 Chromium 中逐頁 × 8 語言驗證）。994 → **1000** 單元 · 62 → **70** Playwright。無行為變化。(I18N-SPLIT)

---



## [1.59.13] — 2026-05-21

**fix(i18n): 用 @alias 合併真正重複的鍵 + 個人資料最終清理.** 從測試夾具/QA 報告中移除維護者真實姓名(→ `Jane Doe`),`LICENSE`/`package.json` 改為 `Fighter90` 帳號。`@alias` 機制合併 8 個語言完全相同的 10 個鍵。`nav.config`/`config.title` 因西班牙語不同而不合併。991 → **994** 測試。(I18N-CL3)

---



## [1.59.12] — 2026-05-21

**fix(i18n): i18n-dict.js 清理 — fr 語言前 (I18N-CL1, I18N-CL2, I18N-CL4).** 將 `training.coursePh` 中的個人資料替換為通用佔位符,`followup.lastPh` 由固定日期改為格式提示,新增 `npm run audit:i18n`。重複值分組是有意為之(不同 UI 角色)—— 見字典標頭。(I18N-CL1, I18N-CL2, I18N-CL4)

---



## [1.59.11] — 2026-05-21

**fix(test): v1.59.11 — e2e-comprehensive 套件現在 23/23 通過(之前 11/23)。** Playwright 的 `page.goto` 對僅改變 hash 的 URL 是 no-op,這是根因。新的 `goRoute(hash)` 輔助函式透過 `about:blank` 反彈以強制真實導航。(e2e-harness-r1)

---



## [1.59.10] — 2026-05-21

**fix(api): NEW-F1-sub-r1 (v1.59.10) — 原始 `..` 守衛上移到所有 `/api` 路由註冊之前。** v1.59.8 的位置在 `app.all` 之後,從未觸發。現在它在 Express 規範化之前執行。(NEW-F1-sub-r1)

---



## [1.59.9] — 2026-05-21

**fix(ux): UX-A5-r4 (v1.59.9) — Help TOC 捲動監聽偵錯標記 `data-toc-spy="active"` + 行為鎖測試。** 第 6 個週期。同步初始繪製 + 雙 rAF 重新計算 + resize 監聽器 + hashchange 清理。(UX-A5-r4)

---



## [1.59.8] — 2026-05-21

**fix(ux+api): v1.59.8 — UX-A5-r3 + NEW-F1-sub (HIGH + LOW 合併)。** FINAL-REGRESSION-v1.59.7 報告授權的 doctrine 例外。UX-A5-r3: `#/help` 將 IntersectionObserver 替換為帶 rAF 節流的 `scroll` 監聽器。NEW-F1-sub: 中介軟體將 `/api/*` 的原始 `..` 以 404 JSON 拒絕。(UX-A5-r3 · NEW-F1-sub)

---



## [1.59.7] — 2026-05-20

**fix(api): NEW-D3-cache (v1.59.7) — `GET /api/cv` 傳送 `Cache-Control: no-store`。** CV 是使用者主要工件,始終重新驗證。(NEW-D3-cache)

---



## [1.59.6] — 2026-05-20

**feat(a11y): NEW-D2-motion (v1.59.6) — 尊重 `prefers-reduced-motion: reduce`。** 新 `@media` 區塊停用動畫、過渡和 `scroll-behavior`。(NEW-D2-motion)

---



## [1.59.5] — 2026-05-20

**fix(api): NEW-F1 (v1.59.5) — 未知 `/api/*` 在任何 HTTP 動詞上都回傳 JSON 404。** `app.get` → `app.all`。(NEW-F1)

---



## [1.59.4] — 2026-05-20

**fix(ui): NEW-OR1 (v1.59.4) — `#/config` Active/Keys 晶片消除競態。** 原子 replaceChildren + 在途權杖 + 上次良好狀態快取。(NEW-OR1)

---



## [1.59.3] — 2026-05-20

**fix(ux): UX-A5-r2 (v1.59.3) — 強化 `#/help` 滾動監聽。** rootMargin 可見帶從 10 % 擴展到 25 % + 掛載時計算初始狀態。(UX-A5-r2)

---



## [1.59.2] — 2026-05-20

**fix(ui): v1.59.2 — Active/Keys 晶片:計數正確、供應方名稱大寫、不再重疊。** (post-v1.59.1 hotfix)

---



## [1.59.1] — 2026-05-20

**fix(test): v1.59.1 — NEW-D1 守衛接受 UX-A11 打磨過的 ES 文案。** (v1.59.1)

---



## [1.59.0] — 2026-05-20

**feat(ui): UX-A14 (v1.59.0) — 行動裝置(≤ 420 px)稽核通過。** 新的 `@media (max-width: 420px)` 區塊中包含 5 項修復。(UX-A14)

---



## [1.58.65] — 2026-05-20

**test(ui): UX-A2 (v1.58.65) — Modes 結構化欄位表單回歸鎖測試。** 新測試保護 v1.54.3 實作免受回歸。(UX-A2)

---



## [1.58.64] — 2026-05-20

**fix(i18n): UX-A11 (v1.58.64) — es/pt-BR 文案打磨。** 英語借用詞替換為母語等價表達。(UX-A11)

---



## [1.58.63] — 2026-05-20

**fix(ui): UX-A15 (v1.58.63) — Dashboard Pipeline 磁貼獲得視覺主要強調。** Pipeline 磁貼現在帶有強調邊框、更大的圖示和加粗的標籤。(UX-A15)

---



## [1.58.62] — 2026-05-20

**feat(ui): UX-A9 (v1.58.62) — API keys 分頁頂部的 sticky 摘要晶片。** `#/config → API keys` 分頁頂部新增 sticky 晶片,顯示活動供應方和已配置金鑰數量。(UX-A9)

---



## [1.58.61] — 2026-05-20

**docs(readme): UX-A8 (v1.58.61) — 在所有 8 個 README 中新增首次執行清理章節。** 現在記錄了在首次掃描前清理兩個 QA 測試夾具 URL 的 `make clean-test-fixtures` 步驟。(UX-A8)

---



## [1.58.60] — 2026-05-20

**feat(ui): UX-A12 (v1.58.60) — 通知抽屜支援全部清除 + 單條關閉。** 通知面板新增全域清除按鈕和每條 × 按鈕。(UX-A12)

---



## [1.58.59] — 2026-05-20

**feat(ui): UX-A13 (v1.58.59) — `#/health` 失敗行的可執行 "Fix →" CTA。** FAIL/OPTIONAL 行現在顯示直接跳轉到相應配置選項卡的 ghost 按鈕。(UX-A13)

---



## [1.58.58] — 2026-05-20

**fix(ux): UX-A10 (v1.58.58) — 防止 `#/cv` 未儲存的編輯遺失。** 瀏覽器關閉(`beforeunload`)和 SPA 內導航(`hashchange`)在髒緩衝區時顯示本地化確認對話框。(UX-A10)

---



## [1.58.57] — 2026-05-20

**test(ui): UX-A7 (v1.58.57) — cost-line 自動刷新契約的回歸鎖測試。** 新增靜態測試,確保 `providers-changed` 事件被派發、被訂閱,以及所有 advisor 視圖都呼叫 `UI.providerCostHint`。(UX-A7)

---



## [1.58.56] — 2026-05-20

**fix(a11y): UX-A4 (v1.58.56) — `.lang-btn` 達到 WCAG 2.5.8 最小觸控目標尺寸。** 修復前語言按鈕高 23–25 px,低於 24×24 px 標準。現在透過 `min-height: 28px` + `min-width: 28px` 達到 WCAG 2.2 AA 合規。(UX-A4)

---



## [1.58.55] — 2026-05-20

**feat(ui): UX-A3 (v1.58.55) — Dashboard 活動供應方晶片。** `#/dashboard` 主區現在顯示當前活動的 LLM 供應方(`⚡ Live evals: Anthropic claude-sonnet-4-6` 或 `📋 Manual prompt mode`)。在 `#/config` 變更 `LLM_PROVIDER` 或分頁重新獲得焦點時自動更新。(UX-A3)

---



## [1.58.54] — 2026-05-20

**fix(ux): UX-A1 (v1.58.54) — Deep 簡報結構防禦性警告。** 當儲存的簡報缺少 6 個標準章節(Company snapshot / Engineering culture / Recent news / Glassdoor / Interview process / Negotiation leverage)中至少 3 個時,`public/js/views/deep.js` 會在內容前顯示一個非阻塞警告並連結到參考文件。這是 UI 層防護;根本的提示層修復位於父專案。(UX-A1)

---



## [1.58.53] — 2026-05-20

**fix(ux): UX-A6 — 所有 saved-card 通過單一 `renderSavedCard()` 輔助函式渲染。** 保證任何渲染路徑下都有 `<span>+<time>` 結構。948 → **949** 單元。(UX-A6)

---

## [1.58.52] — 2026-05-20

**fix(ux): UX-A5 — `#/help` TOC 捲動追蹤現在能正確觸發。** v1.58.45 的 setTimeout(0) 在路由掛載前就執行了。修正:直接參照 `headings` + 雙重 `requestAnimationFrame`。947 → **948** 單元。(UX-A5)

---

## [1.58.51] — 2026-05-20

**chore(docs): v1.58.51 — v1.58.37 → v1.58.50 週期(14 個版本)的最終清理。** 不改程式碼。qa/ 重新整理(所有版本固定文件移到 `archive/v158-cycle/`);6 個 perennial 留在根目錄。`REGRESSION-FINAL §13` 記錄 v1.58.37→.50 的全部不變量。基線不變(947/947)。(housekeeping)

---

## [1.58.50] — 2026-05-20

**docs: DOC-1 — `qa/REGRESSION-FINAL.md` 新增 §5a(伺服器錯誤本文按設計保持英文政策)。** 關閉 NEW-D4 為 `not-a-finding`。**完成 FIX-PROMPT-FINAL-EXHAUSTIVE.md 的 v1.58.37 → v1.58.50 佇列(14 個版本)。** 946 → **947** 單元。(DOC-1)

---

## [1.58.49] — 2026-05-20

**chore(tooling): TOOL-1 — 新增 `make clean-test-fixtures` 與腳本,用於從父專案 `data/pipeline.md` 移除 example.com 行。** 支援 `--dry-run`。4 個 CI-isolated 測試。942 → **946** 單元。(TOOL-1)

---

## [1.58.48] — 2026-05-20

**fix(ux/onboarding): UX-D-B — 當使用者仍使用預設範本資料時,`#/dashboard` 頂部顯示全域警告橫幅。** /api/health 偵測到 `Profile customized: false` 時顯示 `.hero-banner--warning`。新 i18n 鍵 `onboarding.fixtureWarning` + `onboarding.fixProfile` × 8。941 → **942** 單元。(UX-D-B)

---

## [1.58.47] — 2026-05-20

**fix(ux/naming): UX-D-C — 頂列 "Quick scan" 重新命名為 `開啟 Scan`(它只是導航,並不真正啟動掃描)。** 8 語言更新。940 → **941** 單元。(UX-D-C)

---

## [1.58.46] — 2026-05-20

**fix(ux): UX-D-D — `#/apply` 清單將 `{company}-{role}` 替換為從 URL/JD 推導的 slug。** 此前占位符按字面顯示。新 `extractSlugs` + `substitutePlaceholders` 辨識 Greenhouse/Lever/Ashby/Workable/SmartRecruiters/Workday。退回 `[company]/[role]`。939 → **940** 單元。(UX-D-D)

---

## [1.58.45] — 2026-05-20

**fix(ux): UX-D-K — `#/help` 的 TOC 捲動追蹤高亮目前章節。** `IntersectionObserver` 把 `.toc-current` 套用到目前可見 H2 對應的 TOC 連結。938 → **939** 單元。(UX-D-K)

---

## [1.58.44] — 2026-05-20

**fix(ux): UX-D-L — `#/deep` 中開啟的 Saved-research 簡報新增內聯 × 關閉按鈕。** 此前只能捲動或離開頁面才能關閉。新 i18n 鍵 `deep.closeBrief` × 8。937 → **938** 單元。(UX-D-L)

---

## [1.58.43] — 2026-05-20

**fix(ux): UX-D-F — `#/evaluate` 空白送出時顯示專用的在地化 toast。** 之前與「過短」是同一條訊息。新 i18n 鍵 `eval.emptyJd` × 8。936 → **937** 單元。(UX-D-F)

---

## [1.58.42] — 2026-05-20

**fix(ux): UX-D-J — 所有 advisor 頁面的 ETA 晶片一致性。** 此前僅 `#/auto` 顯示 "⏱ ~1–2 min"。現 `#/evaluate`、`#/deep` 與 5 個 mode 頁面同樣顯示 `⏱ ~30s`(新 i18n 鍵 `advisor.eta` × 8)。935 → **936** 單元。(UX-D-J)

---

## [1.58.41] — 2026-05-20

**fix(ux/truthfulness): UX-D-I — 費用提示在分頁重新可見 + `providers-changed` 事件時重新拉取。** 之前僅取一次,在另一分頁變更提供者後舊值會持續顯示。934 → **935** 單元。(UX-D-I)

---

## [1.58.40] — 2026-05-20

**fix(ux/docs): UX-D-H — 回歸鎖:每個可見的 `career-ops.org/docs/...` 深層連結必須保持可點擊。** 新 `tests/external-doc-links.test.mjs` 校驗 views/*.js 與 docs/help/*.md。932 → **934** 單元。(UX-D-H)

---

## [1.58.39] — 2026-05-20

**fix(ux): NEW-D2 — 儀表板頂部新增 Refresh 按鈕並提供明確的回饋 toast。** 與連線橫幅的 Refresh 不同;就地重新取數 + 重新渲染,不重新整理頁面。2 個新 i18n 鍵。931 → **932** 單元。(NEW-D2)

---

## [1.58.38] — 2026-05-20

**fix(a11y): NEW-D3 (WCAG 4.1.2) — `#/tracker` 搜尋輸入獲得與 placeholder 不同的在地化 `aria-label`。** 此前僅有 placeholder,螢幕閱讀器無法聽到用途。新 i18n 鍵 `track.searchAria` × 8 語言,與 placeholder 不同。930 → **931** 單元。(NEW-D3)

---

## [1.58.37] — 2026-05-20

**fix(i18n): NEW-D1 — `#/pipeline` H1 在 es/pt-BR/ru 上在地化 + 修正 2 處 RU 標題洩漏。** 新 `tests/i18n-no-latin-leaks.test.mjs` 同時抓出 `contacto.title` 與 `health.title` 的 RU 洩漏。928 → **930** 單元。(NEW-D1)

---

## [1.58.36] — 2026-05-20

**chore(docs): v1.58.36 — v1.58.x 週期收尾的完整文件清理。** 不改程式碼。(1) qa/:3 個版本固定快照(`REGRESSION-END-TO-END-v1.58.16/33/35.md`)移至 `qa/archive/v158-cycle/`。(2) `REGRESSION-FINAL.md` 新增 **§12**(v1.58.4 → v1.58.35 全部不變量)。(3) `UX-AUDIT-PROMPT.md` 新增 30 行已關閉條目。(4) docs/architecture/ 更新(FRONTEND 抽屜、TESTING 合計 928/62/20/23)。(5) CLAUDE.md 新增「v1.58.x 週期的硬經驗教訓」章節。(6) README ×8 新增「通知 🔔」行 + 修正過時的測試計數。基線無變化。(housekeeping)

---

## [1.58.35] — 2026-05-20

**fix(ui): v1.58.35 — 通知抽屜不再自動開啟 + 說明新增 §18「通知」(使用者回報)。** v1.58.34 bug:`.notif-drawer { display: flex }` 戰勝了 UA 的 `[hidden] { display: none }`。修正:顯式新增 `.notif-drawer[hidden] { display: none }`。抽屜僅在點擊鈴鐺時開啟。8 種語言的說明新增 §18(類別表 + 鍵盤)。927 → **928** 單元。(使用者回報)

---

## [1.58.34] — 2026-05-20

**feat(ui): v1.58.34 — 通知抽屜(完全收口 U-13)。** 在 v1.58.33 擷取之上:新 `UI.onToast(fn)`、頂列 🔔 + 未讀徽章、右側 `<aside role="dialog">`,在地化標題 / 空狀態 / 條目(`notif.* × 8`)。Esc + 關閉 + 再次點擊鈴鐺關閉。926 → **927** 單元。(U-13 follow-up)

---

## [1.58.33] — 2026-05-20

**fix(ux): U-13 + U-14 + U-15 — toast 日誌(上限 50 + `UI.getToastHistory()`)+ `.page-header h1 + p` 兜底規則 + `#/cv` 未儲存指示器。** 收尾 v1.58.x 系列。新增 i18n 鍵 `cv.unsaved` × 8 語言。925 → **926** 單元。(U-13/U-14/U-15)

---

## [1.58.32] — 2026-05-20

**fix(ux): U-12 — `#/help` TOC 過濾輸入框獲得 `min-width: 16ch` 以避免 KO/JA 預留位被截斷。** 新增 `.help-toc__filter` 類別。924 → **925** 單元。(U-12)

---

## [1.58.31] — 2026-05-20

**fix(ux): U-11 — Tracker `Legitimacy` 欄表頭新增在地化資訊 ⓘ + tooltip 解釋 High/Caution/Suspicious 等級。** 新增 i18n 鍵 `track.col.legitimacy.help` × 8 語言。923 → **924** 單元。(U-11)

---

## [1.58.30] — 2026-05-20

**fix(ux): U-10 — `data/applications.md` 為空時,Tracker 的 Normalize / Dedup / Merge 按鈕停用。** 在地化提示 (`track.fixEmpty` × 8 語言) 說明原因。922 → **923** 單元。(U-10)

---

## [1.58.29] — 2026-05-20

**fix(ux): U-9 — `#/pipeline` 計數 ↔ 過濾列在窄螢幕垂直堆疊。** 新 `.pipeline-controls` 類別配合 `@media (max-width: 720px)` 把過濾拉伸到 100% 寬度。921 → **922** 單元。(U-9)

---

## [1.58.28] — 2026-05-20

**fix(ux): U-8 — 7 個 mode 頁面的生成提示詞區塊預設折疊。** 包裹在 `<details class="prompt-block">` 中;摘要顯示在地化的 "Show prompt (N lines)"(`prompt.show` / `prompt.lines` × 8)。Copy + Run-live 仍可見。920 → **921** 單元。(U-8)

---

## [1.58.27] — 2026-05-20

**fix(ux): U-7 — `verify-pipeline.mjs` 的 `===` ASCII 分隔線從結果視窗中移除。** 在處理函式內透過正則 `^={10,}$` 預先剝離。919 → **920** 單元。(U-7)

---

## [1.58.26] — 2026-05-20

**fix(ux): U-6 — `#/scan` 的 "Active companies N/M" 晶片透過 tooltip + aria-label 解釋 N 與 M。** 新增 i18n 鍵 `scan.activeCo.help` × 8 語言。918 → **919** 單元。(U-6)

---

## [1.58.25] — 2026-05-20

**fix(ux/ia): U-5 — 儀表板 CTA 去重(移除 header 的 `Open Pipeline` 按鈕和 Quick-action 中 `Scan all sources` 卡片)。** 側邊欄與 hero 已涵蓋兩條路由;v1.58.3 QA 的 4× Pipeline / 4× Scan 減為各 2×。917 → **918** 單元。(U-5)

---

## [1.58.24] — 2026-05-20

**fix(ux): U-4 — 錯誤 toast 把 "(METHOD /path · HTTP NNN)" 後綴塞入折疊的 `<details>` 中。** 技術細節仍保留在 DOM 中(BUG-006 不變量),但標題更清爽。新增 i18n 鍵 `toast.details` × 8 語言。916 → **917** 單元。(U-4)

---

## [1.58.23] — 2026-05-20

**fix(ux): U-3 — `#/followup` 的 `lastContact` 預留位文字改為今日 − 14 天動態計算。** 固定 `2026-04-21` 會隨時間老化;現在在渲染時透過 `new Date()` + `setDate(getDate() - 14)` 產生 ISO YYYY-MM-DD。915 → **916** 單元。(U-3)

---

## [1.58.22] — 2026-05-20

**fix(ux): U-2 — `#/auto` 的 H1 不再因前導 `✨` 而換行至兩行。** 把 `✨` 從 `auto.title` 拆出到獨立 `<span class="page-icon" aria-hidden="true">`;`.page-header--icon` 用 CSS grid 為圖示設獨立欄。914 → **915** 單元。(U-2)

---

## [1.58.21] — 2026-05-20

**fix(ux): U-1 — `#/cv` 的 H1 + 副標題與其它頁面統一(按設計撤回 v1.56.0 UX-9 chip)。** 移除 `.cv-breadcrumb` chip,改用 `<h1 class="page-title">` + `<p class="page-subtitle">`。單 `<h1>` 不變量保留。913 → **914** 單元。(U-1)

---

## [1.58.20] — 2026-05-20

**fix(i18n/platform): I-6 — 側欄底部快捷鍵提示在 Mac 上顯示 ⌘K、其它系統顯示 Ctrl+K,動詞在地化。** 之前在任何平台和語言下都顯示英文字面 `CTRL+K — search`。`top.langhint` 現採 `{hotkey} — 搜尋` 形式;`applyFooterHotkey()` 依 `navigator.platform` 取代 `{hotkey}`。915 → **916** 單元。(I-6)

---

## [1.58.19] — 2026-05-20

**fix(i18n): I-4 — 俄語 `#/followup` 不再洩漏 `cadence` / `follow-up`。** RU followup 字串(H1、提示)中混有 `cadence`、`follow-up`、`scope`、`timeline`。已替換為俄語在地表達。914 → **915** 單元。(I-4)

---

## [1.58.18] — 2026-05-20

**fix(i18n): I-3 — 說明 TOC 項目 2/5/13/14 在非拉丁語言下消除英文殘留。** 修正前部分本地化說明文件中仍含有 `## 2. App settings & API keys`、`## 5. Portals & Sources`、`## 13. Mode prompts`、`## 14. Apply checklist`。現 8 種語言全部完全本地化。913 → **914** 單元。(I-3)

---

## [1.58.17] — 2026-05-20

**fix(i18n): I-2 — Saved-research 卡片日期改用 `Intl.RelativeTimeFormat` 按語言在地化。** [public/js/views/deep.js](public/js/views/deep.js#L57-L82) 的 `formatRelative()` 之前在任何語言下都硬寫英文 `today` / `1d ago` / `Nd ago`。改為 `Intl.RelativeTimeFormat(I18n.getLang(), { numeric: 'auto' })` — 瀏覽器原生本地化字串(「今天/昨天/N 天前」、「сегодня/вчера」等)。超過 7 天的日期回退到 `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`。912 → **913** 單元。(I-2)

---

## [1.58.16] — 2026-05-20

**fix(ui): 品牌按鈕滑鼠停留閃爍(使用者回報)。** 原因:`.btn-primary` / `.btn-danger` 預設背景為 `linear-gradient(...)`,`:hover` 換成純色 `var(--rausch-dark)`。CSS 無法在漸層↔純色間補間,180ms `transition: background` 會「跳動」,使用者看到白/粉色閃光。修正 [public/css/app.css](public/css/app.css):懸停時保留漸層,改用 `filter: brightness(0.92)` 加深 — `filter` 在所有瀏覽器都能平滑補間。`.btn` 的 `transition` 清單新增 `filter var(--transition)`,讓加深帶動畫效果。911 → **912** 單元。(使用者回報)

---

## [1.58.15] — 2026-05-20

**fix(a11y/i18n): I-1 — 頂列搜尋的 `aria-label` 和視覺隱藏 `<label>` 現已本地化。** 此前所有 8 種語言下,螢幕閱讀器聽到的都是英文 aria-label。[public/js/app.js](public/js/app.js#L4-L29) 新增通用 `data-i18n-aria-label` 鉤子 — `applyI18n()` 在每次語言切換時更新 `aria-label`,與 `data-i18n` / `data-i18n-placeholder` 對稱。新增 2 個 i18n 鍵(`top.search.aria`, `top.search.label`)覆蓋 8 種語言。鉤子可被任何未來控制元件重複使用。910 → **911** 單元。(I-1)

---

## [1.58.14] — 2026-05-20

**fix(ux): M-9 — 連線橫幅的「重新整理」按鈕現在提供回饋(之前為靜默重新載入)。** 在 v1.58.13 之前,處理器直接呼叫 `location.reload()`。現在點擊會立即彈出「重新整理中…」的 toast,設定 `sessionStorage['refreshedToast']`,把按鈕設為 `disabled` 防止雙擊堆疊,並把 reload 延遲 200ms 讓 toast 繪製。下次啟動時 app.js 偵測到旗標,彈出成功 toast「已重新整理」。在 8 種語言中新增 2 個 i18n 鍵(`common.refreshing`, `common.refreshed`)。909 → **910** 單元。(M-9)

---

## [1.58.13] — 2026-05-20

**fix(ux): M-8 — `#/apply` 清單變為可互動。** 在 v1.58.13 之前,「▶ 產生清單」把 0…7 號項目以等寬 `<pre>` 區塊呈現 — 唯讀、無法勾選。現在每個項目渲染為真正的 `<input type="checkbox">`,外層包裹 `<label>`(點擊區域為整行,WCAG 2.5.5)。狀態依 URL 持久化至 `localStorage['applyChecklist:'+slug]` — 勾選 3 項 → 重新整理 → 3 項仍維持。按鈕:**複製未勾選項**(將尚未完成的項目以 `- markdown` 條列輸出)與 **重設**。在 8 種語言中新增 5 個 i18n 鍵(`apply.checklist.copyUnchecked`, `resetBtn`, `copied`, `copyFailed`, `reset`)。解析器找不到項目時有防禦性退路。908 → **909** 單元。(M-8)

---

## [1.58.12] — 2026-05-20

**fix(ux): M-7 — 成本提示跟隨當前活躍提供者(OpenRouter 不再回退到偽造數字)。** `UI.providerCostHint()` 已透過 `/api/status/providers` 達成 provider-aware,但 [public/js/api.js](public/js/api.js#L623-L676) 的對映只列出 `anthropic`/`gemini`/`openai`/`qwen`。v1.57.0 加入 OpenRouter 為第 5 個提供者後,會落到通用回退 0.03 並顯示小寫字面值 `openrouter`。現在 EST 加入 `openrouter: null`(由路由選擇模型,費用因此而異),`=== null` 分支輸出本地化的「cost varies (router picks)」,而非誤導性的 `~$0.03/eval`。NAME 加入 `openrouter: 'OpenRouter'`。新增 i18n 鍵 `cost.varies` 覆蓋 8 種語言。907 → **908** 單元。(M-7)

---

## [1.58.11] — 2026-05-20

**fix(ux): M-4 — 已儲存研究卡片的標題↔日期間距改為結構化 CSS(原為內聯 margin)。** v1.58.3 MASTER 回歸確認部分卡片顯示為 `software-engineer-generaltoday`(標題與日期之間無空格),其餘正常。原因:舊程式依賴兩個裸 `<span>` 間的 `style="margin-left: 8px"`,在某些項目中崩塌。修正:[public/js/views/deep.js](public/js/views/deep.js#L34-L55) — 將兩個 `<span>` 替換為 `.saved-card__title` + 語義化 `<time class="saved-card__date" datetime="…">`,外層包裹 `.saved-card` flex 容器。間距由 `gap: var(--space-2, 8px)` 控制 → 不再崩塌,同時取得 `<time>` 的 a11y/SEO 語義。906 → **907** 單元。(M-4)

---

## [1.58.10] — 2026-05-20

**fix(ux): M-2 — 在開啟任何結果模態框前先清空進度 toast。** 在 `#/cv` 點擊 `sync-check` 時,「Running cv-sync-check.mjs…」toast 仍留在右下角,而結果模態框已經打開 — 二者搶奪注意,在窄螢幕上視覺重疊。Health 頁的 Doctor / verify-pipeline 按鈕原本就在 `UI.modal()` 前明確呼叫 `UI.dismissToast()`;cv.js 的 sync-check 是唯一遺漏的入口。修正:[public/js/api.js](public/js/api.js#L272) — `UI.modal()` 現在將 `dismissToast()` 作為首個可執行陳述呼叫(邊界處的縱深防禦)。同時把 cv.js 中硬編碼的英文字串改為 `t('cv.syncCheckRunning')` / `t('cv.syncCheck')`,滿足 BUG-008 不變量(模態框標題 == 本地化按鈕標籤)。在 8 種語言中新增兩個 i18n 鍵。905 → **906** 單元。(M-2)

---

## [1.58.9] — 2026-05-20

**fix(a11y): M-1 — 在表單欄位上恢復可見的 `:focus-visible` 焦點環(WCAG 2.4.7 Level AA)。** v1.58.3 MASTER 回歸確認 `getComputedStyle(focusedInput)` 回傳 `outline: rgb(255,255,255) none 1.5px` — `none` 關鍵字將每個欄位的焦點環寬度塌陷為 0 px。根因:`.input, .textarea, .select { outline: none }` 與 `.searchbar input { outline: none }` 的基礎規則優先級高於全域 `*:focus-visible`,悄悄消除了每頁 88 個可聚焦元素的鍵盤焦點環。修正於 [public/css/app.css](public/css/app.css) — 明確新增 `.input:focus-visible/.textarea:focus-visible/.select:focus-visible` 與 `.searchbar input:focus-visible` 規則,使用 `outline: 2px solid var(--rausch)` + 半透明 box-shadow;滑鼠焦點(`:focus`)保持乾淨。904 → **905** 單元(靜態契約守衛);Playwright **60 → 61**(Tab 遍歷)。(M-1)

---

## [1.58.8] — 2026-05-20

**feat(health): 在 `#/health` 顯示 `OPENAI_API_KEY` / `QWEN_API_KEY` / `OPENROUTER_API_KEY`(與 `GEMINI_API_KEY` 類似)。** v1.57.0 加入 OpenRouter 為第 5 個 headless live-eval 供應商;v1.55.3(UX-2)上線 4 供應商引導。但 `#/health` 頁僅顯示 `GEMINI_API_KEY` 與 `ANTHROPIC_API_KEY` — 其餘三個雖然 `/api/status/providers` 已路由,在 Health 卻不可見。使用者要求:將「set / unset (manual mode)」列模式擴充到所有 headless 供應商。[server/lib/routes/health.mjs](server/lib/routes/health.mjs#L57-L71) 新增 3 個可選檢查列,接入與 `/api/status/providers` 相同的 `isUsableKey` 閘。Health 視圖逐項處理 `body.checks`,因此無需新增 8 語言字串。903 → **904** 單元。(使用者請求)

---

## [1.58.7] — 2026-05-20

**fix(security): NEW-2 — `isValidJobUrl` 現在拒絕成對的模板佔位符語法(`${…}`、`{{…}}`),與錯誤訊息一致。** `POST /api/pipeline` 的 400 回應聲稱 *「contain no script or template characters」*,但 v1.58.3 MASTER 回歸確認:實際僅 ASP/EJS 形式的 `<%…%>` 被 `[<>"'`\\\s]` 守衛順帶攔截。JS 模板字面值 `${TEST}` 與 Mustache/Handlebars `{{TEST}}` 直接通過 — 正則與錯誤訊息的語意不一致。fix-prompt 選項 A(將正則收緊以匹配訊息):在 [server/lib/security.mjs](server/lib/security.mjs) 新增 `TEMPLATE_PATTERNS` 陣列,經 `hasTemplatePlaceholder(url)` 在 `new URL(…)` 前檢查。**僅拒絕成對** 的佔位符(`{normal}` 等單括號 ATS 路徑繼續接受)。901 → **903** 單元。(NEW-2)

---

## [1.58.6] — 2026-05-20

**fix(a11y/i18n): BUG-008-tb — 頂列 `Doctor` 模態框標題現在與本地化按鈕標籤一致。** v1.58.0 已關閉的台帳 BUG-008(*「模態框標題 == 本地化按鈕標籤」*)只涵蓋了 Health 頁面入口。v1.58.3 MASTER 回歸發現**頂列**入口仍違反不變量:無論 UI 語言為何,點擊頂列 `Doctor` 開啟的模態框標題始終為 `doctor`(小寫英文)。修正:[public/js/app.js:118](public/js/app.js#L118) 將字面值 `'doctor'` 替換為 `I18n.t('top.doctor', 'Doctor')`。`top.doctor` 鍵在 8 種語言中皆已存在(EN `Doctor` · ES/pt-BR `Diagnóstico` · KO `진단` · JA `診断` · RU `Диагностика` · zh-CN `诊断` · zh-TW `診斷`),與按鈕透過 `data-i18n="top.doctor"` 宣告的鍵相同。`tests/qa-report-fixes.test.mjs` 新增靜態契約守衛。900 → **901** 單元;Playwright 60/60。(BUG-008-tb)

---

## [1.58.5] — 2026-05-20

**fix(ui): NEW-3 — `#/followup` Run-live 雙重 POST 判定為 *無法重現*;以 Playwright 回歸守衛鎖定。** v1.58.3 MASTER 回歸透過 monkey-patched `window.fetch` 觀察到:在 `#/followup` 上單擊 Run live 一次(公司/角色/備註已填、日期故意留空)後,~2 秒內出現兩次對 `/api/mode/followup` 的相同 POST。依 fix-prompt 的「先重現」原則,對 `public/js/views/mode-page.js::submit()` 做了原始碼審查:(a) Run live 與 Generate prompt 均為普通 `<button>`,各自只有單一 `onClick`,既沒有父 `<form>` 也沒有 `addEventListener('submit')`,因此不存在雙重觸發路徑;(b) `UI.withSpinner()`(FIX-L1)在請求進行中將 `button.disabled = true`,從源頭阻斷第二次物理點擊。在 `tests/playwright-smoke.mjs` 新增還原回歸劇本的測試 — 填入公司/角色/備註、留空日期、點擊與 Run live 共用 `submit()` 的手動按鈕,於 3 秒視窗內斷言 `POST /api/mode/followup` **恰好 1 次**。選擇器與語言無關(8 種語言中 `▶` 字形相同),並透過 `addInitScript` 預先寫入 `career-ops-ui:lang=en`,避免同一瀏覽器內前一個語言切換測試影響欄位選擇器。Playwright **59 → 60**。原 QA 觀察以劇本形式存檔,無需產品程式碼修改。(NEW-3)

---

## [1.58.4] — 2026-05-19

**fix(security): NEW-1 — 在每個回應上發送 `Content-Security-Policy`(此前僅在非 loopback 綁定時發送)。** 在 v1.58.4 之前,僅當 `isPubliclyExposed()` 為真(HOST 綁定至 loopback 之外)時才附加 CSP 標頭;在 `127.0.0.1` 上,`/` 與 `/api/health` 皆**無** CSP 回應,`UI.md()` 的 escape-first 契約成為唯一的 XSS 防線。v1.58.3 MASTER 回歸(§5)將其標記為 stop-ship 不變量。現在 CSP 為**無條件**,無論綁定位址為何,在每個回應上皆相同:`default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`。`script-src` 絕不允許 `'unsafe-inline'`/`'unsafe-eval'`。指令集相對此前的「僅對外暴露」策略未變(已適配 SPA — 為 Inter 將 Google Fonts 加入允許清單),無視覺或功能回歸。`tests/security-headers.test.mjs` 已重寫;Playwright 路由巡檢(en/ru/ja/zh-TW × 7 條路由)驗證 **0 次 CSP 違規**。900 單元 · Playwright 58→59 · e2e 20/20+23/23。後續 fix-prompt 項目依專案原則作為後續 one-fix 版本發佈。(NEW-1)

---

## [1.58.3] — 2026-05-19

**fix(deep)：R-2 / FIX-C1 — 從研究輸出剝除孤立/不平衡的代理鷹架標籤。** v1.58.0 的 `cleanLlmMarkdown` 僅移除*成對*區塊與*末尾開*標籤。v1.58.2 深度回歸發現某模型產生不平衡軌跡——無開標籤的孤立 `</tool_response>`（及 `</thinking>`）殘留並字面渲染進已儲存的 `#/deep` 簡報。最終保守掃描現移除**任何**單獨鷹架標記（開/閉、平衡與否）、Anthropic 工具 XML（`<invoke>`/`<parameter>`/`antml:*`）與 ```tool_*``` 圍欄。純函式·冪等；真實 `<https://…>` 自動連結與程式碼保留。**FIX-C2** 三聯判定**不可重現**（i18n.js 已設 `<html lang>` 並偵測 `navigator.language`）。二者皆加回歸守衛。896 → **900** 單元 · Playwright 58/58。v1.58.3 fix-prompt 其餘項按單修發布排隊（不批次）。

---

## [1.58.2] — 2026-05-19

**fix(i18n)：I18N-011 — 在 7 個非 EN 語言中在地化 `#/help` 目錄。** TOC 由 `docs/help/<lang>.md` 的 `##` 標題生成。第 3/4/6/7/8/9/10/11/12 節在 es/pt-BR/ko/ja/ru/zh-CN/zh-TW 仍是**英文**標題，導致側欄已翻譯而 TOC 仍英文。現將每個標題在地化為與側欄 `nav.*` 鍵**完全相同的術語**（單一事實源 — TOC 與側欄一致），保留節號與 `(#/route …)` 原文。EN 不變。關閉 v1.58 QA 唯一的 i18n 待辦。僅文件；896/896 單元 · 33/33 help · Playwright 58/58。

---

## [1.58.1] — 2026-05-19

**fix(test)：CI 隔離的 `checkProfileCustomized` 守衛（v1.58.0 修補）。** v1.58.0 通過了（建議性）pre-commit 但在 `ci.yml`（Node 18/20/22）失敗：測試使用 cache-bust 動態 import + 改寫 `PATHS`，但 `paths.mjs` **每行程只解析一次**專案根。改為健全的**靜態守衛**（allow-list + `^(…)$/i` 錨定正則；含 "test" 的真實姓名絕不誤判）。無生產程式碼改動；同時解除 `publish-package.yml`。896/896 單元 · Playwright 58/58。見 `qa/v158-regression/`。

---

## [1.58.0] — 2026-05-19

**fix(qa)：外部 QA 報告 bug 清掃 + 整潔、格式化的研究輸出。** 修復：**BUG-001** `#/followup` 在用戶端依 ISO `YYYY-MM-DD` 驗證可選日期；**BUG-003** 區塊引用內的 `**粗體**`/`` `程式碼` ``/連結現已渲染（所有說明頁）；**BUG-005** 重複 URL 顯示「已在佇列中 — 已略過」；**BUG-006** 無效 URL 文案人性化（`(POST /api/pipeline · HTTP 400)` 脈絡按設計保留）；**BUG-007/008**「Running doctor.mjs…」toast 在彈窗前關閉（新增 `UI.dismissToast()`），彈窗標題=按鈕本地化文案；**BUG-010** `#/reports` 空狀態補副標題；**BUG-002/UX-032** `checkProfileCustomized()` 將測試夾具名判為「未自訂」（不動父專案 `profile.yml`/`cv.md` — 規則 #1）；**I18N-012/013** 俄語 Deep research 真正翻譯。**新增：** `cleanLlmMarkdown()` 從 `#/deep` 與已儲存研究中剝除代理鷹架（`<tool_call>{…}</tool_call>`、`<tool_response>`、`<thinking>` …），涵蓋所有提供方及已儲存檔案讀取；`#/outreach`→`#/contacto` 別名（BUG-004）；用戶端網路錯誤經 `I18n.t()` 本地化（8 語言；伺服器 `details` 按設計為英文診斷）。**測試：** 新增 `tests/qa-report-fixes.test.mjs`（10）、`tests/llm-output.test.mjs`（5），881 → 896 單元，Playwright 58/58。**未改（含理由）：** BUG-009（`#/cv` H1 按設計，WCAG single-h1）、父資料（parent-owned）、minor i18n/UX 長尾列入待辦。完整細節見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.57.2] — 2026-05-19

**fix(config)：`/#/config`「validation failed」的真正根因 —— SPA 注入的 `lang` 欄位。** `public/js/api.js` 會給*每個* JSON POST 內文自動附加 `lang`（讓 LLM 路由取得 UI 語言）。`/api/config` 不是 LLM 路由，`lang` 也不是設定鍵，因此 `validateConfig` 的（正確且與安全相關的）未知鍵拒絕對**每次儲存**回傳 400：`validation failed — lang: not a known config key`。這只在瀏覽器出現：curl/行程內重現從不送 `lang`，所以 v1.57.0/.1 改善了*訊息*卻未除*根因*。設定路由現在在驗證前剝除傳輸用的 `lang`；`KNOWN_KEYS` 寫入過濾仍丟棄任何真正未知的鍵 —— 注入防護不變。由點擊真實儲存按鈕的新 Playwright 表單巡檢發現。**測試：** 新增 `tests/playwright-forms.mjs`（26，納入 `npm run test:e2e:browser`）巡檢**所有表單**；`config-endpoint` 增加瀏覽器等價用例。879 → 881 單元，Playwright 32 → 58。完整細節見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.57.1] — 2026-05-19

**fix(ux)：每個 API 錯誤現在都說明「什麼失敗、在哪裡、為什麼」；輸入錯誤文案盡可能詳盡。** 伺服器早已回傳 `{ error, details: ["欄位: 原因", …] }`，但各表單只顯示首行（「validation failed」），因此在 `/#/config`（及各處）無法得知哪個欄位有誤。`api.js` 現在**全站**將逐欄位 `details` 併入訊息（改一處，所有表單受益），附加請求上下文 `(方法 /路徑 · HTTP NNN)`（在哪裡），非 JSON 回應顯示原始內文片段，網路錯誤也帶方法+路徑；並暴露 `err.details`。`validateConfig` 訊息改為盡可能詳盡（哪裡錯、如何修）。**密鑰欄位絕不回顯輸入值**（僅字元數）——輸錯的真實 key 不會洩漏到 toast/日誌。PORT 範圍現真正驗證（`99999` 被拒）。`/#/config` 的 PORT/HOST 預填真實預設值（`4317` / `127.0.0.1`）。錯誤 toast 停留更久（9–20 秒）且換行/捲動而非截斷。**測試：** 新增 `tests/config-validation-detail.test.mjs`（12），874 → 879。完整細節見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.57.0] — 2026-05-19

**feat(provider): OpenRouter 作為第 5 個無頭即時評估提供方 + fix(config): 儲存任意 API key 時出現「validation failed」的修復。** 貼上的 key 常帶有尾端換行或空白（作業系統剪貼簿、提供方主控台的「複製」按鈕）——1.57 之前這會觸發 **所有** 提供方的換行守衛，且以 `$` 結尾錨定的 `ANTHROPIC_API_KEY` 正則會誤拒真實的 Anthropic key。現在 `validateConfig` 在驗證 **之前** 正規化（trim）每個值，路由持久化已修剪的值（執行期認證成功，不會因 `\n` 破壞 `.env`），Anthropic 檢查改為健全的 `sk-ant-` 前綴 + 長度（共用的 `isUsableKey()` ≥ 20 字元仍是真正的「是否真實 key」門檻）。內部換行仍被拒絕（`.env` 注入守衛）。**OpenRouter** 現為一等提供方：`/#/config` 的 `OPENROUTER_API_KEY` 一個 key 即可接入 300+ 模型。它是 `auto` 順序的**最後一位**（Anthropic → Gemini → OpenAI → Qwen → **OpenRouter**），因此既有設定絕不會被靜默改道；`LLM_PROVIDER=openrouter` 可固定。透過與 OpenAI/Qwen 相同的 `_tailProvider()` 路徑接入 `/api/evaluate`、`/api/deep`、`/api/mode/:slug`，並在 `/api/status/providers` 與 Health 儀表板中呈現。OpenAI 相容用戶端（無新相依——直接 `fetch`、`AbortController` 逾時、key 不記錄），帶建議的 `HTTP-Referer`/`X-Title` 標頭。模型下拉是即時的：`OPENROUTER_MODEL` 由 **`GET /api/openrouter/models`**（OpenRouter 公開目錄的伺服器端代理——保持 CSP `connect-src 'self'`）填充，目錄不可用時回退精選清單，10 分鐘記憶體快取。8 種語言新增 i18n key（`config.openrouter*`）。**測試：** 新增 `tests/openrouter-route.test.mjs`、`tests/openrouter-model-selector.test.mjs`，擴充 `env-config`/`openai`/`provider-selector`。831 → 855。完整細節見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.56.4] — 2026-05-19

**feat(ui):UX-N2 — 全域搜尋輸入框上隨平台變化的可見 ⌘K / Ctrl K 提示。** Cmd/Ctrl+K(聚焦搜尋)快捷鍵此前只存在於 `aria-label`/原始碼,視力使用者無從發現,應用顯得比實際慢。現在搜尋膠囊末端出現一個低調的 `<kbd class="kbd-shortcut">`,啟動時依平台判定(`navigator.platform`/`userAgent`)從 `data-mac`/`data-other` 填入:macOS/iOS 為 **⌘K**,其餘為 **Ctrl K**。它 `aria-hidden="true"`(既有 `aria-label` 已向輔助技術播報——徽章不應重複)且 `pointer-events:none`(裝飾)。既有 Cmd/Ctrl+K 綁定不變。無新增 i18n 鍵(字形通用);徽章是既有 `.searchbar` 的 flex 子元素(無需包裹/絕對定位——input 已 `flex:1`)。**測試:** 新增 CI 隔離原始碼靜態套件 `tests/cmdk-hint-visible.test.mjs`(5):`<kbd class="kbd-shortcut">` 位於 `.searchbar` 內;`aria-hidden="true"` 且含 `data-mac`/`data-other` 兩個變體;`app.js` 經 `navigator` 判定填入;`(e.ctrlKey||e.metaKey)&&e.key==='k'` → `search.focus()` 綁定健在(回歸保護);`app.css` 為 `.kbd-shortcut` 設樣式且非 `display:none`。826 → 831。`feat(ui)` · `test: tests/cmdk-hint-visible.test.mjs`。詳情見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.56.3] — 2026-05-19

**fix(reliability):提供者金鑰偵測拒絕佔位符 / 過短值,而不僅是空字串。** 父 `.env` 中的佔位符 `GEMINI_API_KEY` 被報告為「✓ set」,並被選為作用中提供者而非有效的 `ANTHROPIC_API_KEY`。`effectiveEnv()` 僅拒絕 `undefined`/`''`,故 10 字元垃圾被當作真實金鑰:導覽橫幅顯示 *GEMINI ✓ set*,`GET /api/status/providers` 回傳 `activeProvider: "gemini"`,所有即時 ⚡ 評估會對著死金鑰靜默失敗,而忽略有效的 108 字元 Anthropic 金鑰。新純函式 `isUsableKey()`(`env-config.mjs`)僅當金鑰 ≥ 20 字元(受支援提供者金鑰無更短者 — Gemini `AIza…` ≈ 39、Anthropic `sk-ant-…` ≈ 100+、OpenAI ≥ 40、Qwen ≈ 35)且非已知佔位符(`your_*_here`、`changeme`、`placeholder`、`<…>`、單字元重複…)時才視為已設定。統一套用於 `hasAnthropicKey()`/`hasGeminiKey()`(`anthropic.mjs`)、`hasOpenAIKey()`/`hasQwenKey()`(`openai.mjs`)及 `GET /api/health` 的 `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` 列(從原始 `process.env` 遷移至同一 effective+plausible 視圖)——健康頁、提供者端點與 OR 路由現始終一致。`selectActiveProvider()` 不變(僅接收正確的 `keysConfigured`)。**測試:** 新增 CI 隔離套件 `tests/key-detection-rejects-placeholder.test.mjs`(5):`isUsableKey` 單元 + in-process `createApp()` 重現所報場景(暫存 `.env` 含 10 字元 `GEMINI_API_KEY` + 真實 `ANTHROPIC_API_KEY`)——`gemini` 不在 `keysConfigured`,`activeProvider === "anthropic"`,`/api/health` 列一致。四個既有 effective-env 分層測試將過短樁值加長(契約不變)。821 → 826。`fix(reliability)` · `test: tests/key-detection-rejects-placeholder.test.mjs`。詳情見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.56.2] — 2026-05-19

**feat(a11y):UX-N1 — 依路由的在地化 `document.title`(多分頁辨識 + 螢幕閱讀器頁面變更播報)。** 修正前 24 個路由都維持 `index.html` 的靜態 `<title>`(「career-ops — command center」)——分頁同名、書籤通用、每次「頁面已變更」播報相同。`public/js/router.js` 的 `focusNewView()` 現從檢視自身在地化的 `<h1 class="page-title">` 衍生標題——「檢視 — career-ops」——因此標題自動翻譯(無需新 i18n 鍵)且每路由唯一。在首次繪製 guard **之前**設定,使初始分頁也有標題(與 v1.56.0 UX-12 的 `tabindex` 設定順序一致)。檢視無標題時回退為 `career-ops — command center`。**測試:** 新增 CI 隔離的原始碼靜態套件 `tests/document-title-per-route.test.mjs`(4):`focusNewView` 指派 `document.title`;標題源自 `<h1>`(依路由 + 在地化,非單一字面值);指派先於 `!firstPaintDone`;存在產品預設值。817 → 821。`feat(a11y)` · `test: tests/document-title-per-route.test.mjs`。詳情見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.56.1] — 2026-05-19

**fix(a11y):消除路由託管的 `tabindex="-1"` 標題聚焦時出現的虛假品牌聚焦環。** `public/js/router.js` 在每次用戶端導覽時為目標檢視標題加上 `tabindex="-1"` 並 `.focus()`(讓螢幕閱讀器播報新頁面)。`tabindex="-1"` 元素無法以鍵盤抵達,但 Chromium 的 `:focus-visible` 啟發式仍繪製全域品牌環(`*:focus-visible { outline: 2px solid var(--rausch) }`)——每次導覽在**頁面標題周圍出現紅色矩形**(如 `#/dashboard` 的「Command Center」),且已烘焙進 `images/dashboard-*.png` 主視覺截圖。修正為一條限定範圍的規則 `[tabindex="-1"]:focus, [tabindex="-1"]:focus-visible { outline: none }`(WAI-ARIA APG 託管聚焦模式)。互動控制項上真正的鍵盤聚焦保留全域 `*:focus-visible` 環(WCAG 2.4.7 不變);skip-link 的環不受影響(它是 `<a>`,非 `tabindex="-1"`,特異度更高)。8 個 `images/dashboard-*.png` 已重新產生——紅框消失。**測試:** 新增 CI 隔離的原始碼靜態套件 `tests/managed-focus-no-ring.test.mjs`(4):全域 `*:focus-visible` 環仍定義(WCAG 2.4.7 無回歸);`[tabindex="-1"]:focus,:focus-visible` ⇒ `outline:none`;抑制規則位於全域規則之後(層疊安全);修正具範圍(無全域 `*:focus{outline:none}`)。與 `tests/dashboard-initial-focus.test.mjs` 配對。813 → 817。`fix(a11y)` · `test: tests/managed-focus-no-ring.test.mjs`。詳情見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.56.0] — 2026-05-19

**feat(ux):LOW 打磨合集 —— UX-9 / UX-10 / UX-11 / UX-12(一個分組的次要發佈)。** **UX-9** `#/cv`:頁面標題降級為安靜的 `.cv-breadcrumb` 麵包屑晶片,吵鬧的副標題移入 `<h1>` 的 `title` 提示 —— 讓使用者的履歷(預覽中的姓名)佔據視覺層級。F-V54-A 不變量保持 —— 仍是**恰好一個 `<h1>`**,仍為 `.page-title`。**UX-10** 新增共享輔助 `UI.providerCostHint(t)`,置於 `#/auto`、`#/evaluate`、`#/deep` 及每個 `#/<mode>` 的 ⚡ 即時執行旁;復用 `GET /api/status/providers`(v1.55.3):有金鑰時顯示 *「預估費用:OpenAI gpt-5-codex · ~$0.04/eval」*(數量級,"~");無金鑰時說明 ⚡ 複製手動提示(無 API 費用);fail-soft。**UX-11** `#/help`:當 TOC 過濾縮小到**恰好一個**區段時,300ms 閒置後捲動至該處(防抖;0 或 >1 不觸發)。**UX-12** `#/dashboard`:首次繪製時將 `<h1>` 設為可聚焦(`tabindex="-1"`),`#content` 保持 `aria-live="polite"`(啟動時朗讀)—— **不**搶佔焦點(避免與跳過連結衝突,v1.41.0 決定)。新增 i18n 鍵 `cost.estimate`、`cost.manual` ×8;新增 `.cv-breadcrumb`/`.cost-hint` CSS。**測試:**4 個新源靜態 CI 隔離套件(cv-breadcrumb 3、run-cost-line 4、help-toc-autoscroll 4、dashboard-initial-focus 3);更新既有 `cv-single-h1`/`help-nav-a11y` 鎖(不變量保留)。800 → 813。4 項即時 Playwright 探針,0 主控台錯誤。`feat(ux)` · 4 test suites。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.8] — 2026-05-19

**feat(tracker):伺服器端分頁 + 可點擊的漏斗晶片(UX-8)。** **伺服器:**`GET /api/tracker` 新增**可選** `?page` / `?pageSize` / `?status` 查詢參數。不帶參數時,回應與舊的 `{ rows: [...] }` 逐位元組一致(所有現有呼叫方/測試不受影響)。帶參數時回傳 `{ rows: slice, total, page, pageSize, funnel }` —— `pageSize` 箝制到 `[1,500]`,`page` 箝制到 `≥1`,`status` 過濾 `rows`+`total`,`funnel` 是**整個歷史**的狀態→計數細分(與頁/過濾無關,故晶片始終準確)。**`#/tracker`:**頂部新增**可點擊漏斗晶片列** —— *「所有狀態 · N · Applied · N · Interview · N …」*(順序 Applied → Responded → Interview → Offer → Rejected → Discarded → Evaluated → SKIP)。點擊晶片設定 Status 過濾(再次點擊作用中晶片則清除);作用中晶片為 `aria-pressed` 且高亮。8 個語言新增 i18n 鍵 `track.funnelAria`;新增 `.tracker-funnel`/`.tracker-chip`/`.tracker-chip--active` CSS。**`test: tests/tracker-server-paged.test.mjs`**(新增,7 個案例,CI 隔離,臨時埠行程內 Express + 臨時 `CAREER_OPS_ROOT` applications.md —— CLAUDE.md #2/#8):back-compat(無參數 ⇒ 恰為 `{rows}`);`?page&pageSize` 切片 + total/page/pageSize/funnel 合計 N;最後部分頁無重疊;越界頁 ⇒ 空 rows + 有效 total;`?status=` 過濾 total/rows 而 funnel 為整個歷史;pageSize 上限;+ 晶片列源靜態鎖定。793 → 800。`feat(tracker)` · `test: tests/tracker-server-paged.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.7] — 2026-05-19

**feat(pipeline):>1000 列時的 vanilla-JS 列虛擬化(UX-7)。** `#/pipeline` 此前渲染**每一**列(`filtered.forEach(list.appendChild(urlRow))`)—— 一次掃描會用數千個 URL 填滿佇列,於是數千個列節點(每個是 flex div + `<a>` + 兩個按鈕)在每次篩選按鍵時同步建構,淹沒 DOM 與無障礙樹。新增 **vanilla-JS 虛擬化**(react-window 等價,無相依):超過 `VIRTUALIZE_THRESHOLD = 1000` 時 `#/pipeline` 變為固定高度(`70vh`)捲動視口,配一個不可壓縮的佔位墊(`flex:0 0 auto`,`height = 列數 × 56px`)以保留**整個清單的真實捲軸**,rAF 節流的捲動監聽只渲染視口 ± 5 列緩衝(一次約 16–19 個節點而非 N 個)。閾值及以下保持原始簡單渲染**逐位元組不變**,故典型管道與所有現有測試/e2e 不受影響。每個虛擬化列保留按 URL 區分的 ▶/✕ `aria-label`(F-V54-B 回歸鎖定)。視窗計算為純函式 `computeWindow()`。**`test: tests/pipeline-virtualize.test.mjs`**(新增,5 個案例,CI 隔離,源靜態):~1000 數值閾值;≤閾值分支保持 `forEach`→`appendChild`;>閾值分支以 rAF 捲動監聽 + 佔位墊渲染 `slice(start,end)`;`computeWindow()` 在 `[0,total]` ± 緩衝內箝制;列保留 ▶/✕ aria-label。788 → 793。即時 Playwright 探針(1200-URL 夾具):`scrollHeight≈67248`,DOM 中僅約 16–19 個節點,視窗端到端跟隨捲動,0 主控台錯誤。`feat(pipeline)` · `test: tests/pipeline-virtualize.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.6] — 2026-05-19

**feat(scan):將次要篩選收納進「進階篩選」摺疊區(UX-4)。** `#/scan` 此前把所有篩選 —— 自由文字、遠端/混合/現場、範圍、來源,以及掃描後的 stack/level/dynamic facet 晶片 —— 等權堆疊,形成控制項之牆。現在**日常篩選保持可見**(自由文字 + 遠端/混合/現場;🌐 掃描按鈕已在控制項卡中單列),**次要篩選摺疊進 `<details class="scan-advanced"><summary>進階篩選</summary>`**:範圍 + 來源下拉,以及單獨的 facet 晶片簇(現在新結果集以表格而非晶片牆開頭,且僅在至少有一列晶片時渲染)。8 個語言新增 i18n 鍵 `scan.advancedFilters`;新增 `.scan-advanced` 摘要樣式(安靜的 ⚙ 提示、無標記、展開時加粗)。**`test: tests/scan-advanced-disclosure.test.mjs`**(新增,6 個案例,CI 隔離,源靜態):帶 `.scan-advanced` 鉤子與 `scan.advancedFilters` 標籤的 `<details>`/`<summary>` 存在;自由文字 + 遠端保持可見;範圍 + 來源在摺疊區內;`chipsContainer` 為 `<details>`;`.scan-advanced summary` 有樣式;`scan.advancedFilters` ×8。782 → 788。`feat(scan)` · `test: tests/scan-advanced-disclosure.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.5] — 2026-05-19

**feat(dashboard):2 個 P0 CTA + 聚焦近期活動提示的 hero(UX-3)。** `#/dashboard` 此前以約 30 個等權重節點開啟 —— 沒有清晰的「下一步做什麼」。新增 `.dash-hero` 區塊現位於頁首正下方:兩個 P0 旅程 —— **✨ URL 自動管道** 與 **🌐 立即掃描** —— 提升為大號 `.btn-hero` 按鈕;單一**聚焦近期活動提示**(「最近評估: `<分數>` — `<標題>`」,連結至報告;冷啟動時經 `dash.heroNoEval` 顯示引導空狀態)告訴回訪使用者停在何處、告訴新使用者唯一重要的動作。兩個主按鈕已從頁首移除(僅保留次要的「📋 開啟管道」)以避免動作重複。狀態計數從醒目的 `.badge` 降級為安靜的 `.dash-chip` 膠囊。8 個語言新增 i18n 鍵 `dash.lastEval`、`dash.heroNoEval`;新增 `.dash-hero`/`.btn-hero`/`.dash-chip` CSS。**`test: tests/dashboard-hero.test.mjs`**(新增,5 個案例,CI 隔離,源靜態):`.dash-hero` 存在且先於 Quick-actions 網格;兩個 P0 CTA 為帶 `/auto`+`/scan` 路由的 `.btn-hero`;聚焦 `dash.lastEval` + 空狀態 `dash.heroNoEval`;桶使用 `.dash-chip`;CSS 存在;`dash.lastEval`+`dash.heroNoEval` ×8。777 → 782。`feat(dashboard)` · `test: tests/dashboard-hero.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.4] — 2026-05-19

**feat(ux):Run 旁的誠實 auto-pipeline ETA + 掃描時醒目的 Stop(UX-6)。** `#/auto`:新增 `.auto-eta` 提示 —— *"⏱ 約 1–2 分鐘"*(鍵 `auto.eta`,`title` 經 `auto.etaTitle`)—— 現位於 Run 按鈕旁,使一鍵承諾在使用者決定*之前*就對耗時誠實;文案與 career-ops.org/docs(「貼上 URL → 1–2 分鐘內完整報告」)一致。`#/scan`:在數分鐘爬取執行中(`aria-busy`)時,**Stop** 從低對比幽靈按鈕提升為醒目的破壞性按鈕(新增 `.btn-danger` —— 填充,高對比白字配珊瑚色,字重 600)。`setScanRunning(running)` 在 `btn-danger`(執行中)與 `btn-ghost`(閒置,反正隱藏)之間切換 `scan-stop-btn`,使使用者在負載下也能找到並信任 Stop。8 個語言新增 i18n 鍵 `auto.eta`、`auto.etaTitle`;新增 `.btn-danger`/`.auto-eta` CSS。**`test: tests/auto-eta-stop.test.mjs`**(新增,4 個案例,CI 隔離,源靜態):`#/auto` 在 `runBtn` 旁以 `.auto-eta` 類渲染 `t('auto.eta')`;`auto.eta` ×8;`setScanRunning(running)` 將 Stop 提升為 `btn-danger`;`.btn-danger` 存在且為高對比白字。773 → 777。`feat(ux)` · `test: tests/auto-eta-stop.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.3] — 2026-05-19

**feat(onboarding):畫面上的 4 提供方 OR 狀態 —— 冷啟動橫幅 + 活躍提供方徽章(UX-2,HIGH)。** 新增唯讀端點 **`GET /api/status/providers`** → `{ activeProvider, activeModel, keysConfigured }`。`keysConfigured` 使用與 `llm.mjs` 閘門相同的有效 env 視圖(process.env ∨ 父 `.env`);`activeProvider` 是 OR 路由器實際會選的 —— `env-config.mjs` 中的新純函式 `selectActiveProvider()` 走訪 `providerOrder()`(無對應金鑰的 `LLM_PROVIDER` 鎖定回傳 `null`)。不回傳任何機密 —— 僅提供方名稱 + 模型 id。SPA 外殼現在渲染全域引導區域(`#onboarding-banner`,由 `app.js` 填充,僅 CSP 安全 DOM):**0 金鑰 → 紅色橫幅** + 指向 `#/config?tab=api-keys` 的 CTA;**≥1 金鑰 → 低調徽章** 顯示活躍提供方+模型。讓招牌差異點(「Anthropic / Gemini / OpenAI / Qwen 之一,自動排序」)在畫面上可發現,而非靠試錯。8 個語言新增 `onboarding.*` i18n 鍵;新增 `.onboarding-warn`/`.onboarding-ok` CSS。**`test: tests/onboarding-key-banner.test.mjs`**(新增,9 個案例,CI 隔離):`selectActiveProvider` 語意;`GET /api/status/providers` 行程內(臨時埠 + 臨時 `CAREER_OPS_ROOT` `.env`,絕不讀取真實父金鑰 —— CLAUDE.md #2/#8);靜態 SPA 接線 + `onboarding.*` ×8 覆蓋。764 → 773。`feat(onboarding)` · `test: tests/onboarding-key-banner.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.2] — 2026-05-18

**fix(cv):為 `#/cv` markdown 編輯器賦予描述性、自含的可存取名稱(F-V55-H / UX-5)。** `#/cv` 主編輯器 `<textarea id="cv-editor">` 現在透過新鍵 `cv.editorAria` 帶有描述性 `aria-label` —— *"CV Markdown 編輯器 —— 你的 markdown 格式專業履歷"* —— 取代它從可見的「Markdown」區段標題繼承的簡略名稱。註:與 F-V55-H 症狀(僅檢查 `aria-label`/`labels`)相反,該欄位**並非**無名 —— v1.47.0(WS2 #16)早已透過 `aria-labelledby` → `<h3 id="cv-md-heading">Markdown</h3>` 綁定,故螢幕閱讀器播報「Markdown,編輯,多行」。v1.55.2 將該簡略「Markdown」升級為自含標籤。冗餘的 `aria-labelledby` 被移除(否則即死標記 —— 按 ARIA 優先級 `aria-label` 勝出);可見的 `<h3>Markdown</h3>` 為視力正常使用者保留。WCAG 1.3.1 + 4.1.2;與 v1.54.5 batch-tsv 修復(F-V54-C)平行。**`test: tests/cv-editor-a11y.test.mjs`**(新增,3 個案例,CI 隔離,如 `auto-stepper-prerender.test.mjs` 的源靜態):`#cv-editor` 透過 `t('cv.editorAria', …)` 自命名且回退非空;`cv.editorAria` 在全部 8 個語言存在且非空;元素上無冗餘 `aria-labelledby`。761 → 764。`fix(cv)` · `test: tests/cv-editor-a11y.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.1] — 2026-05-18

**fix(auto):在 `#/auto` 掛載時預先渲染 5 階段流程步進器(F-V55-E / UX-1,資深觀察 S-4 重新開啟)。** `#/auto` 現在在畫面掛載的那一刻就顯示文件化的五階段概要 —— **驗證 → 擷取 → 評估 → 儲存報告 → 加入追蹤器** —— 而不再在首個 SSE 事件前保持空白。此前 `<ol class="auto-stepper">` 以 `display:none` 建立,且 `renderStepper()` 僅從 `setStep()` / `run()` 到達,因此冷啟動使用者在點擊 Run 之前從未看過文件承諾的流程。步進器現在在掛載時即可見,五個階段皆為 `pending` 狀態,並帶有 `aria-label`(`auto.stepperAria`)以便輔助技術朗讀該區域。關閉 F-V55-E(a11y/靜態保證視角)與 UX-1(承諾保真視角)—— 同一修復,兩個視角。**`test: tests/auto-stepper-prerender.test.mjs`**(新增,4 個案例,CI 隔離,如 `router.test.mjs` 的源靜態):`STEPS` 陣列恰好是 5 個規範階段且按序;`stepperEl` 掛載時非 `display:none` 且帶 `auto.stepperAria`;掛載作用域的 `renderStepper()` 呼叫先於 `function setStep(`;`auto.stepperAria` 存在於全部 8 個語言。757 → 761。`fix(auto)` · `test: tests/auto-stepper-prerender.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.55.0] — 2026-05-18

**feat(llm):無頭即時評估透過 "OR" 運作 —— Anthropic | Gemini | OpenAI | Qwen,依設定了哪個金鑰自動選擇。** 應使用者請求,web-ui 的 ⚡ 即時評估現在使用**任何已設定的 API 金鑰**運作,而不僅是 Anthropic/Gemini。`LLM_PROVIDER` 新增 `openai` 與 `qwen`;`auto`(預設)使用第一個存在金鑰的提供方,優先順序為 **Anthropic → Gemini → OpenAI → Qwen**。明確值固定為一個;強制指定但無金鑰的提供方仍回退到手動提示路徑。新增 `server/lib/openai.mjs` —— 一個零相依的 OpenAI 相容 Chat Completions 用戶端(與 `anthropic.mjs` 相同的安全直連 HTTPS 模式:`AbortController` 逾時、金鑰從不記錄、`effectiveEnv()` 金鑰解析使父 `.env` 的金鑰無需重啟即生效)。單一核心(`runOpenAICompatible`)支撐 **`runOpenAI`**(api.openai.com)與 **`runQwen`**(阿里雲 DashScope 的 OpenAI 相容模式;中國大陸主機在 raw `.env` 中用 `QWEN_BASE_URL` 覆寫端點)。無 SDK、**無任意 CLI 執行** —— 父專案保持 CLI 無關(Claude Code · Codex · Gemini · OpenCode · Qwen · Copilot · Kimi);這僅擴充*無頭* API 金鑰路徑。OpenAI/Qwen 尾部已接入所有評估面:`/api/evaluate`、`/api/deep`、`/api/mode/:slug` 以及 `/api/auto-pipeline` SSE —— 在 Anthropic(內聯)+ Gemini(子行程)分支之後被查詢以保留 auto 偏好,並使用與 Anthropic 相同的打包上下文內聯。`env-config.mjs`:`QWEN_API_KEY`(機密)+ `QWEN_MODEL`(非機密)加入 `KNOWN_KEYS`/`KEY_GROUPS.core`;`LLM_PROVIDERS` 與 `providerOrder()` 擴充;`OPENAI_API_KEY` 現為一級無頭提供方金鑰(此前僅儲存)。`#/config` API 金鑰標籤頁:`LLM_PROVIDER` 選擇器新增 `openai`/`qwen`;新增 `QWEN_API_KEY` + `QWEN_MODEL` 欄位(精選 `qwen-max`/`qwen-plus`/`qwen-turbo`/`qwen2.5-*` 清單);標籤頁頂部的新說明解釋 CLI 無關的父專案 vs web-ui 無頭評估及 OR 順序。8 個語言全部新增 i18n 鍵。**`test: tests/openai.test.mjs`**(新增,9 個案例,CI 隔離):OpenAI/Qwen 成功 + 區塊陣列內容、Bearer 認證、預設及 `QWEN_BASE_URL` 覆寫端點、4xx/5xx/格式錯誤、`max_tokens` 鉗制、逾時、`effectiveEnv` 金鑰偵測、金鑰無洩漏金絲雀。`tests/provider-selector.test.mjs` 已更新以涵蓋 v1.55.0 的 `providerOrder`/`LLM_PROVIDERS`/SECRET 面 + OpenAI/Qwen 尾部接線。748 → 757。`feat(llm)` · `test: tests/openai.test.mjs` · `test: tests/provider-selector.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.10] — 2026-05-18

**fix(auto-pipeline):SSE 用戶端斷線衛生 —— 消除不穩定的 Playwright e2e 作業。** Playwright e2e 作業間歇性變紅(32/32 個單項測試通過,但 `not ok 2 - tests/playwright-smoke.mjs`):在 `#/auto` SSE 串流進行中關閉頁面,會使伺服器下一次 `res.write()` 以 `EPIPE`/`"aborted"` 被拒絕,而 —— 由於回應上沒有 `'error'` 監聽器 —— Node 將其升級為 uncaughtException,node:test 報告為 "asynchronous activity after the test ended"。`auto-pipeline.mjs` 中的 `openSse()` 現在註冊一個 no-op 的 `res.on('error')`,並以 `res.writableEnded || res.destroyed` 保護 `send()`(以 try/catch 包裹)—— 消失的用戶端是預期的,而非異常。這是正確的生產 SSE 衛生,不只是測試修復。`tests/playwright-smoke.mjs`:Cmd+K 測試使用了真實的外送 URL(`https://example.com/jobs/123`),但只等待模態出現,因此 `closePage()` 在測試結束後中止了伺服器進行中的 `safeGet()`。現在它等待管線到達終態(以便 fetch 在關閉前正常解析)。共用的 `closePage()` 輔助函式(`window.stop()` 然後關閉)和 `after` 鉤子的 `server.closeAllConnections()` 作為縱深防禦保留。已驗證:連續 8/8 綠色執行(6× `node --test` + 2× browser-smoke),此前約每 2 次有 1 次紅。`tests/auto-pipeline.test.mjs` +1 個靜態案例,鎖定 `openSse` 斷線衛生契約(`res.on('error')` 監聽器 + `writableEnded||destroyed` 守衛 + try 包裹的寫入)。747 → 748。`fix(auto-pipeline)` · `test: tests/auto-pipeline.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.9] — 2026-05-18

**fix(llm):在請求時尊重父專案 `.env` 的 LLM 金鑰 —— 停止錯誤路由到過期/無效的提供方。** 即便 `ANTHROPIC_API_KEY` 是已設定的提供方,即時評估也可能以 *"Gemini API error: API key not valid"* 失敗。根本原因:`hasAnthropicKey()` / `hasGeminiKey()`(以及 `runAnthropic` 的金鑰/模型查找)**只讀取啟動時的 `process.env` 快照**。如果在伺服器啟動後才把 Anthropic 金鑰加入父 `.env`,執行中的行程永遠看不到它 → Anthropic 偵測為 false,評估隨後回退到 `process.env` 中*確實*存在的任何過期金鑰(通常是舊的、無效的 `GEMINI_API_KEY`)。Gemini 執行路徑(父 Node 子行程)已經讀取父專案的即時 `.env`,因此兩個提供方解析金鑰的方式不一致。`env-config.mjs` 新增 `effectiveEnv(key, envFilePath)`:非空的 `process.env` 值優先(涵蓋 shell export 與 `POST /api/config` 的即時套用),否則查閱**目前父 `.env` 檔案**。`anthropic.mjs` 現在透過它解析 `ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL` 和 Gemini 金鑰檢查,因此設定在父 `.env` 的金鑰**無需重啟伺服器**即被尊重,且金鑰偵測始終與請求實際送出的金鑰一致。提供方順序不變(`auto` → Anthropic-然後-Gemini);這只修復偵測。金鑰從不被記錄或回傳(REVIEW-B4 無洩漏測試仍通過)。`tests/anthropic.test.mjs` 重寫為 CI 隔離(temp `CAREER_OPS_ROOT`、動態 import),含 2 個重現確切 bug 的新案例(金鑰僅在父 `.env` → 被偵測到;`process.env` 未設定時 `runAnthropic` 送出父 `.env` 的金鑰 + 模型)。`tests/env-config.test.mjs` +3 個 `effectiveEnv` 案例(`process.env` 優先、含空字串視為未設定的 `.env` 回退、檔案缺失 / 金鑰缺失 / 無路徑 → undefined)—— 新分支 100%。742 → 747。`fix(llm)` · `test: tests/anthropic.test.mjs` · `test: tests/env-config.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.8] — 2026-05-18

**feat(config):Modes 欄位表單始終渲染規範結構描述(即便在空/樁檔案上),並帶 career-ops.org 欄位指引。** v1.54.3 的 Modes 欄位表單只為已存在的 `##` 小節渲染欄位 —— 因此在全新、空或非結構描述的 `modes/_profile.md`(例如常見的 1 行樁)上,它會回退到 *"No ## sections found — use the raw editor below."*,使用者拿不到任何欄位。應使用者請求(*"разбей по полям … описание полей возьми из career-ops.org/docs"*),表單現在**始終按文件化順序渲染 5 個規範欄位**(Target Roles、Adaptive Framing、Exit Narrative、Comp Targets、Location Policy),存在時從檔案預填,不存在時為空但可編輯 —— 因此全新的 profile 可完全透過表單填寫。每個欄位顯示一段**來自規範 career-ops.org Quick Start §Step-5 的描述**(在 Target Roles / Adaptive Framing / Exit Narrative / Comp Targets / Location Policy 中分別填什麼),透過 `aria-describedby` 接入供螢幕閱讀器使用。容忍標題變體:範本的 `## Your Target Roles`(等)對應到與 `## Target Roles` 相同的規範欄位,因此範本與伺服端鷹架慣例都不會破壞表單。`collect()` 現在是帶標籤的酬載:當渲染的標題與檔案既有標題完全一致時進行非破壞性的 **`{ sections }` 合併**(前言 + 未觸碰 + 自訂小節按位元組穩定保留),或當檔案缺少結構描述時進行 **`{ markdown }` 全檔案重建**,引導/正規化一份符合結構描述的文件。重建路徑在 `config.js` 中**經確認閘控**(它替換父檔案 —— WS2 #4 破壞性儲存不變量),保留既有前言(或文件化的預設值),並按 verbatim 保留非規範小節。8 個語言環境新增 6 個 i18n 鍵(`config.modesDescTargetRoles` … `config.modesDescLocationPolicy` + `config.modesFormRebuildBody`)。`tests/modes-form.test.mjs` 按 v1.54.8 契約重寫:結構描述 + 規範順序、`config.js` 酬載/確認接線、8 個語言環境中每個欄位來自文件的描述存在、`canonicalKey` "Your X" 容忍、清單往返穩定性、引導始終渲染保證,以及帶資料安全的帶標籤 sections-vs-markdown `collect()`。已針對真實父樁檔案線上驗證(5 個欄位 + 描述出現,0 主控台錯誤)和隔離樁夾具(填寫 → 經確認閘控儲存 → 5 個規範小節全部持久化)。`feat(config)` · `test: tests/modes-form.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.7] — 2026-05-18

**fix: W-001 — 程式碼/樣式資源 + SPA 外殼以 `Cache-Control: no-store` 提供(部署衛生)。** SPA 透過不帶版本查詢字串的純 `<script src>` 載入 `api.js` / `router.js` / 每個視圖,且沒有建置步驟(無內容雜湊),因此部署後瀏覽器可能**繼續提供快取的舊 bundle 達數小時** —— 在查詢字串路由上出現 stale-cache 404(於 v1.29.2 回歸期間線上觀察到;回歸執行 W-001)。`server/index.mjs` 現在透過 `express.static` 的 `setHeaders` 掛鉤在 `.js` / `.mjs` / `.css` / `.html` 上設定 `Cache-Control: no-store`,並在 SPA 外殼 catch-all(它使用 `sendFile` 並繞過 `setHeaders`)上明確設定,使瀏覽器始終重新驗證驅動路由的程式碼。非程式碼靜態資源保留 `express.static` 的預設快取。安全標頭(CSP / nosniff / frame-deny / referrer-policy)不變 —— 由既有的 `security-headers` 套件(8 個案例)與新測試並行跑綠驗證。新增 1 個測試檔 `tests/asset-cache-control.test.mjs` —— 4 個案例(JS 資源 `no-store`、CSS `no-store`、靜態 `index.html` `no-store`、SPA catch-all 深層路由外殼 `no-store`),針對隔離的 `CAREER_OPS_ROOT` 啟動真實應用。另加 `tests/playwright-smoke.mjs` 中的 flaky teardown 修復(單獨的 `test(e2e)` 提交):auto-pipeline 的 SSE 冒煙測試現在於 `finally` 中取消 reader + 中止 fetch,且 `after` 掛鉤強制關閉殘留 socket,消除了使 v1.54.6 Playwright e2e 作業變紅的 teardown 後 "Error: aborted"。738 → 742。`fix` · `test: tests/asset-cache-control.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.6] — 2026-05-18

**fix(a11y): S-7 — `#/help` 的 back-to-top 按鈕攜帶規範選擇器類別 `back-to-top`。** `#/help` 的浮動 back-to-top 按鈕運作正常(已線上驗證),但其類別清單(`btn btn-primary help-back-top`)位於 spec §2 #28 測試所瞄準的 `.back-to-top` 選擇器慣例之外 —— 收緊後的選擇器本會出現 flaky(回歸執行 S-7,「輕鬆取勝」)。該按鈕現在也攜帶規範的 `back-to-top` 類別。純粹增量且為 CSS no-op:`help-back-top`(既有的 CSS 掛鉤)未變,而 `back-to-top` 沒有 CSS 規則 —— 它只是一個穩定的測試/自動化控柄。已線上驗證:`document.querySelector('.back-to-top')` 解析到該按鈕,`aria-label` 完整,0 主控台錯誤。於 `tests/help-nav-a11y.test.mjs` 中擴展了既有的 #12 案例,新增一條斷言:back-to-top 按鈕的類別清單包含規範的 `back-to-top` 選擇器(無新檔)。`fix(a11y)` · `test: tests/help-nav-a11y.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.5] — 2026-05-18

**fix(a11y): F-V54-C — `#/batch` TSV 編輯器擁有可存取名稱。** `#/batch` 的 TSV `<textarea>` 此前有一個透過 `aria-describedby` 接線的提示,但**沒有可存取名稱** —— 無 `<label htmlFor>`,無 `aria-label`/`aria-labelledby`(回歸執行 F-V54-C;WCAG 1.3.1 Info & Relationships / 4.1.2 Name, Role, Value)。`aria-describedby` 提供的是*描述*而非*名稱*,因此螢幕閱讀器讀出的是無標籤的「edit text」。該 textarea 現在透過新增 i18n 鍵 `batch.tsvAria` 攜帶 `aria-label`,與已使用 `*Aria` 鍵的同級執行控制輸入保持一致;既有的 describedby 提示得以保留。已線上驗證:`aria-label` 存在且已本地化,`aria-describedby` 完整,0 主控台錯誤。新增 i18n 鍵 `batch.tsvAria` 於全部 8 個語言區。新增 1 個測試檔 `tests/batch-tsv-accessible-name.test.mjs`(2 個案例:`batch-tsv` 區塊在保留其 describedby 提示的同時透過 `t(batch.tsvAria)` 擁有 `aria-label`;`batch.tsvAria` 在全部 8 個語言區中定義);736 → 738。`fix(a11y)` · `test: tests/batch-tsv-accessible-name.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.4] — 2026-05-18

**fix(a11y): F-V54-B — `#/pipeline` 列操作按鈕擁有可存取名稱。** `#/pipeline` 上每列的 `▶`(評估)和 `✕`(刪除)按鈕此前是僅含 `title` 屬性的純圖示按鈕(回歸執行 F-V54-B;WCAG 4.1.2 Name, Role, Value)。`title` 不是可靠的可存取名稱,因此螢幕閱讀器使用者聽到的是一長串無法區分的「button」,無法判斷刪除會命中哪一列。兩個按鈕現在都帶有明確的 `aria-label`,透過新增的 `shortUrl()` 輔助函式以精簡 URL 消歧(`host` + `…/` + 最後 2 個路徑區段;不可剖析輸入回退為尾端切片),因此 a11y 樹讀出如 *「Delete: hh.ru/…/vacancy/12345」*。無新增 i18n 鍵 —— 重用 `common.delete` / `pipe.evaluateBtn` + URL。已線上驗證:1385 列,每個按鈕名稱按列唯一,0 主控台錯誤。新增 1 個測試檔 `tests/pipeline-row-action-names.test.mjs`(4 個案例:兩個按鈕均以 `shortUrl(url)` 接線 + 恰好兩個此類標籤,`shortUrl` 在使用前宣告,同主機不同職缺的 URL 不會合併,裸主機 / 不可剖析 / 空回退);732 → 736。`fix(a11y)` · `test: tests/pipeline-row-action-names.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.3] — 2026-05-18

**feat(config): `#/config` "Modes" 分頁的結構化欄位表單(不再是原始 markdown)。** "Modes" 分頁此前將 `modes/_profile.md` 按每個 `##` 區塊編輯為單個原始 `<textarea>`(v1.36.0 的區塊級粒度)。應使用者要求,現在改為算繪**從文件化結構描述衍生的結構化欄位表單**(career-ops.org Quick Start §Step-5):`Target Roles` / `Adaptive Framing` / `Comp Targets` → **可增刪的可重複帶標籤行輸入**(每個欄位一行 role/angle/comp,`＋ Add line` / 每行帶 `aria-label` 的 `✕`);`Exit Narrative` / `Location Policy` → 單個帶標籤的散文 `<textarea>`。每個欄位都是透過 `<label htmlFor>` 繫結、帶 i18n 區塊名的真實控制項。新增 `public/js/lib/modes-form.js`(`window.ModesForm`)持有 parse → render → `collect()` 邏輯;它饋入**既有**的 `PUT /api/modes/_profile { sections }` 合併路徑,因此前導文字、順序以及表單未觸及的任何區塊都保持位元組穩定(合併而非取代,由伺服端強制)。**資料安全:** 正文不是純項目符號清單的正規清單區塊(使用者在此放入了散文)以及任何非正規 `##` 區塊,會回退為帶說明註記的帶標籤原樣 `<textarea>` —— 任意內容原樣 round-trip,絕不會被靜默重構或遺失。Round-trip 穩定性已驗證:`serialise(parse(body))` 重新剖析完全一致。整檔原始 markdown 編輯器仍作為帶確認門的 **Advanced** 摺疊區保留,用於增刪區塊及編輯前導文字(WS2 #4 破壞性儲存門不變)。8 個語言區新增 10 個 i18n 鍵(`config.modesTargetRoles` … `config.modesUnknownNote`)。新增 1 個測試檔 `tests/modes-form.test.mjs`(7 個案例);725 → 732。已針對隔離的 `CAREER_OPS_ROOT` fixture 線上驗證:5 個正規區塊算繪為欄位 + 1 個自訂區塊作為帶標籤回退,編輯並儲存的 round-trip 保留了前導文字 + 自訂區塊,0 主控台錯誤。`feat(config)` · `test: tests/modes-form.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.2] — 2026-05-18

**feat(config): `#/config` 中的 OpenAI / Codex 模型選擇器。** `#/config` 此前無法選擇 OpenAI / Codex 模型 —— 儘管 `OPENAI_API_KEY` 已為父專案多 CLI(Codex / OpenCode)流程公開,卻只有 `ANTHROPIC_MODEL` 與 `GEMINI_MODEL` 有下拉選單。現在 `OPENAI_MODEL` 成為一等環境變數鍵:已加入 `env-config.mjs` 的 `KNOWN_KEYS`(排在 `OPENAI_API_KEY` 之後)及 `core` 鍵群組,並**刻意不**納入 `SECRET_KEYS` —— 它是模型 id 而非憑證,故永不遮罩。`config.js` 新增一份精選 `OPENAI_MODELS` 清單(預設 `gpt-5-codex`,其後為 `gpt-5` / `gpt-5-mini` / `gpt-4.1` / `o4-mini` / `o3`),以及在 OpenAI 鍵之後算繪的 `OPENAI_MODEL` `<select>` 欄位,完全鏡像 Anthropic/Gemini 模型欄位。8 個語言區新增 i18n 鍵 `config.openaiModel` + `config.openaiModelHint`。新增 1 個測試檔 `tests/openai-model-selector.test.mjs`(4 個案例);721 → 725。已線上驗證:`#/config` → 含 6 個選項的 `OPENAI_MODEL` select,預設 `gpt-5-codex`,已繫結標籤,0 主控台錯誤。`feat(config)` · `test: tests/openai-model-selector.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.1] — 2026-05-18

**fix(a11y): F-V54-A —— `#/cv` 單一 `<h1>`。** CV markdown 自身的 `# Name` 算繪成了頁面標題 `<h1>CV</h1>` 旁的**第二個**頂層 `<h1>`(回歸執行 F-V54-A;WCAG 1.3.1 資訊與關係 / 2.4.6 標題)。`cv.js` 現將 CV 預覽的每個注入點(初次算繪、檔案匯入時重新整理、編輯器即時同步)經由作用域受限的 `cvMd()` 統一處理,將標題下移一級(h1→h2 … h6→`role="heading" aria-level="7"`),使頁面恰好保留一個 `<h1>`。刻意將作用域限定於 `cv.js` —— `UI.md` 由 help/reports/deep/evaluate 共用,各自以自有方式管理標題。新增 1 個測試檔 `tests/cv-single-h1.test.mjs`(4 個案例);717 → 721。已線上驗證:`#/cv` → 1 個 `<h1>`,使用者的 `# Name` 現為 `<h2>`,0 主控台錯誤。`fix(a11y): F-V54-A` · `test: tests/cv-single-h1.test.mjs`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.54.0] — 2026-05-18

**WS10 —— canonical-docs 再驗證 + help 套件 H3 對等(最終收斂版本)。** CHANGELOG/結構 CI 閘門只檢查 H2,因此 `docs/help/en.md` 已悄然漂移至 70 個 H3 子節,而 7 個本地化套件仍停在 68 —— 差距在 §17(「Reference adapters」表 + 「Common pitfalls」清單,僅英文)。兩者現已譯入全部 7 種語言(轉接器檔名 / 連結 / 識別碼保持逐位元組一致);8 個套件現均為 17 H2 / 70 H3。`help-ru-config-section.test.mjs` 中新的 H3 對等閘門鎖定之(716 → 717)。`canonical-docs-coverage.test.mjs` 7/7 確認 help 仍鏡像 `career-ops.org/docs` 的全部 5 篇指南;WS2 的 UX 稽核(v1.41→v1.52 的 40 項)對每個畫面與 docs 進行校驗 —— 無背離。`docs/sdd/CONVENTIONS.md` 更新至 v1.54.0(測試合計、H3 對等閘門、檔案尺寸離群項、新增無障礙約定章節)。WS0–WS10 完成;僅餘 WS11。`fix(docs): WS10 canonical re-validation + H3 parity` · `test(help): H3-parity gate`。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.53.0] — 2026-05-18

**WS9 —— shell 表面測試金字塔(最後一個未測層)。** 4 個 `bin/*.sh` 指令稿與 `.githooks/pre-commit` 掛鉤此前覆蓋率為**零**;新增的 `tests/sh-files.test.mjs` 加入 10 個案例,鎖定 `bash -n`/`sh -n` 語法、shebang + 可執行位,以及其他 workstream 所依賴的行為契約:`career-ops-ui.sh` —— `help` 以 0 結束且無 shell-source 洩漏(v1.40.0 回歸守衛),未知 verb 以 2 結束,`usage()` 為 heredoc;`start.sh` —— 尊重 `NO_OPEN`、要求 Node ≥ 18,並將瀏覽器前置委派給 `scripts/open-dashboard.mjs`(v1.43.0 守衛);`setup.sh` —— 嚴格模式、`SKIP_START`、克隆兩個儲存庫;`run_all.sh` —— `--quick`/`--no-e2e` 解析與 4 個套件;`.githooks/pre-commit` exec WS7 評審器,且**沒有任何 shell 檔案呼叫 `git --no-verify`**(CLAUDE.md 硬規則 #7 守衛);`install-hooks.mjs` 接線 `core.hooksPath`。`docs/architecture/TESTING.md` —— 在金字塔圖中加入 shell 表面基礎層 + v1.53.0 合計註記(716 個 `node --test` 案例 / 90 個檔案 + 4 個 E2E 表面)。706 → 716。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.52.0] — 2026-05-18

**WS2 LOWs #33–#40 —— 批次打磨清掃(收尾 UX 稽核佇列)。** 八項低嚴重度發現。`fix(a11y/i18n): WS2 LOW batch` —— #33:`#/dashboard` —— 頁首的 3 個 CTA 不一致(僅 2 個有前導圖示);「Open Pipeline」現帶 `📋`,三者齊整。#34:`#/profile` —— 原型的 `fit`/`level` 算繪為兩個含糊的 chip;現加前綴(`Fit:` / `Level:`)並配對應的 `aria-label`。#35:`#/health` —— Run-doctor / verify 的 toast 顯示 `doctor.mjs` 的原始字串;現已 i18n 鍵化。#36:`#/health` —— 檢查結果原是扁平的 `<div>` 串;現為 `role=list` 的 `<ul>`/`<li>`,狀態徽章帶 `aria-label="<check>: <status>"`。#37:`#/reports` —— 報告卡原是僅滑鼠的 `<div onClick>`;現為 `role=link` + `tabindex` + Enter/Space 處理器 + `aria-label`。#38:`#/activity` —— 分頁器註解寫「200」而程式碼請求 500;已對齊到 `CAP` 常數,且當 500 上限截斷舊歷史時浮現 `role=note` 通知。#39:`#/batch` —— prose 佔位符為英文硬編碼而其 `aria-label` 已 localized;四個現已 i18n 鍵化。#40:模式頁在非同步探測後靜默重新命名主按鈕;現由禮貌的 `role=status` 區域播報。新增 10 個 i18n 鍵 × 8 個語系(`{n}` 保留);測試 +9:`test: tests/low-sweep.test.mjs`。697 → 706。收尾 WS2 的 UX 稽核佇列(v1.41→v1.52 的 #1–#40);接下來 WS9 → WS10 → WS11。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.51.0] — 2026-05-18

**WS2 #13 + #14 + #18 + #19 + #20 —— `#/auto` 與 `#/evaluate` 的 feedback/i18n 清掃。** UX 稽核的五項發現。`fix(a11y/ux): auto+evaluate — busy state, actionable HTTP errors, clipboard fallback, aria-live result, spinner-guarded submit` —— #13:`#/auto` 的 Run 按鈕現在顯示忙碌狀態(`is-loading` + `aria-busy` +「Running…」),而非僅停用。#14:失敗的 HTTP 請求現在於步驟上浮現可操作的 i18n 訊息並附帶 toast(帶 `{n}` 的 `auto.httpFail`),不再是乾巴巴的「HTTP 500」。#18:手動模式的「Copy prompt」現在使用非同步 Clipboard API 並帶 `execCommand` 回退,真正失敗時 toast 提示,而非虛假的「Copied」。#19:evaluate 結果容器現為 `role=status` `aria-live=polite`,使漫長的 LLM 呼叫向螢幕閱讀器播報。#20:Evaluate 按鈕以 `UI.withSpinner` 包裹(原先為樸素的 `onClick: run`,允許重複送出)。新增 3 個 i18n 鍵 × 8 個語系;測試 +6:691 → 697。另有一處僅測試的修正(提交 `7f8e250`):e2e pipeline-delete 的拆卸位於 v1.48 之前的原生 confirm 路徑上;改為 API DELETE(`fix(test): …` —— CI 的 Playwright-e2e 為紅;並非產品回歸)。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.50.0] — 2026-05-18

**WS2 #12 + #27 + #28 —— help 導覽無障礙。** 一份 17 個章節、90+ 個標題的指南中,`#/help` 上 UX 稽核的三項發現,於 `help.js` 中修正。`fix(a11y): help — single h1, labelled+filterable TOC, focus-on-anchor, back-to-top` —— #28:文件 markdown 以自帶的 `# Title` 開頭,在頁首已提供規範 h1 的頁面上又產生了第二個 `<h1>`;現已剝除文章的所有 `<h1>`,使全頁恰有一個 h1,層級從 `<h2>` 章節乾淨起始。#27:TOC 的 `<nav>` 是無名地標(頁面上有兩個無標籤 `<nav>`);現帶 `aria-label`(`help.toc`),點擊 TOC 項目時焦點移至章節標題(`tabindex=-1` + `focus()`),而非僅捲動視口。#12:長文件中無從查找;TOC 上方的 `type=search` 篩選器依標題文字即時收窄項目,捲動後出現帶 `aria-label` 的浮動「Back to top」按鈕,返回頂部並把焦點移回頁面 `<h1>`;其 scroll 監聽器在離開 `#/help` 的 `hashchange` 時移除。新增 2 個 i18n 鍵 × 8 個語系 —— `help.tocFilter`、`help.backToTop`;測試 +6:`test: tests/help-nav-a11y.test.mjs`。685 → 691。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.49.0] — 2026-05-18

**WS2 #10 + #11 + #25 + #26 —— tracker 表格無障礙與排序。** `#/tracker` 上 UX 稽核的四項發現,於 `tracker.js` 中修正。`fix(a11y): tracker headers, sortable table, localized fix labels, empty state` —— #10:動作欄表頭是空字串,每列的 Report 按鈕缺少脈絡;現每個 `<th>` 皆帶 `scope=col`,動作表頭與 `Score`/`PDF` 表頭改為 i18n 鍵(原先為空或硬編碼英文),Report 按鈕取得帶公司名的 `aria-label`(`<report> — <company>`)。#11:tracker 沒有排序方式;Date / Score / Status 表頭現為 `<th>` 內可鍵盤操作的排序按鈕,帶 `aria-sort`(`none`/`ascending`/`descending`);`sorted()` 比較器(score 按數值,date/status 按 locale 比較)在分頁前執行,點擊切換方向並重置分頁器。#25:`track.normalize/dedup/merge` 是風險最高的破壞性控制項,卻在全部 8 個語系為同一英文(原地重寫 `data/applications.md`)—— 現已正確在地化,並新增 `title` 提示。#26:零列首次執行顯示與過度篩選清單相同的「no match」訊息;`rows.length === 0` 現渲染獨立的空狀態(標題 + 內文 +「Open pipeline」CTA)。新增 7 個 i18n 鍵 × 8 個語系 + 3 個重新在地化;測試 +6:`test: tests/tracker-a11y-sort.test.mjs`。677 → 683。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.48.0] — 2026-05-18

**WS2 #8 + #22 —— pipeline:焦點陷阱確認 + 預覽無障礙。** `#/pipeline` 上 UX 稽核的兩項發現,於 `pipeline.js` 中修正。`fix(a11y): pipeline UI.confirm() + live preview region` —— #8:`#/pipeline` 的三個動作皆使用原生 `confirm()`(未做焦點陷阱):預覽面板的 Delete、每列的 `✕` 刪除、以及「Evaluate first」;現全部改走帶焦點陷阱的 `UI.confirm()`(v1.44.0 基礎設施)—— 兩個刪除 `danger:true`(Cancel 為預設),「Evaluate first」`danger:false`;`pipeline.js` 中已無任何原生 `confirm()`。#22:`previewPane` 沒有 live 角色,且 fetch 失敗被塞進 `previewBody`,渲染成誤導性的 `<pre>`「preview」;現為帶 `aria-label` 的 `role=region` `aria-live=polite`,失敗時另設 `previewError` 並渲染為獨立的 `role=alert` 區塊((重新)選擇時及刪除當前列時清除)。新增 4 個 i18n 鍵 × 8 個語系;測試 +5:`test: tests/pipeline-confirm-preview.test.mjs`。672 → 677。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.47.0] — 2026-05-18

**WS2 #7 + #30 + #31 + #16 —— 未綁定標籤無障礙清掃。** UX 稽核的四項發現:表單控制項缺少程式化標籤(WCAG 1.3.1 / 3.3.2 / 4.1.2),現已全部綁定。`fix(a11y): bind every swept form control to an accessible name` —— #7 `scan.js`:`dry-run` 核取方塊與 `company-select` 下拉選單的標籤缺少 `for`;依既有 `id` 加上 `htmlFor`。#30 `deep.js`:`company` / `role` 輸入框存在未綁定標籤;加上 `id` + `htmlFor`(`deep-company`、`deep-role`)。#31 `apply.js`:`url` / `jd` 存在未綁定標籤;加上 `id` + `htmlFor`(`apply-url`、`apply-jd`)。#16 `cv.js`:主 markdown `<textarea>` 無可存取名稱;透過 `aria-labelledby` 綁定到可見的「Markdown」標題 —— 螢幕閱讀器名稱與螢幕標題一致,無新增 i18n 鍵。沿用 `batch.js` / `mode-page.js` 中已為標準的明確 `label[for]`↔`control[id]` 模式;無新增 i18n 鍵;行為零變更。測試 +5:`test:` 667 → 672。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.46.0] — 2026-05-18

**WS2 #5 + #6 + #21 + #24 —— scan SSE 無障礙。** `#/scan` 上 UX 稽核的四項發現,於 `scan.js` 中修正。`fix(a11y): scan SSE — live-log region, Stop, run-state, error banner` —— #5:串流主控台現為 `role=log` `aria-live=polite`(+ `aria-label`、`tabindex=0`、可鍵盤捲動),並有一個獨立的視覺隱藏 assertive `role=status` 區域播報終態事件(完成 / 失敗 / 已停止)。#6:Stop 按鈕關閉進行中的 `EventSource`(`es.close()`),取消結果輪詢並重設狀態;僅在 scan 執行時顯示。#21:scan 執行時 Scan 按鈕被停用 + 置 `aria-busy` 並顯示 Stop,兩條串流路徑皆如此(單階段 `streamTo` 與多階段 `runScanAll` —— 後者僅在終態 `done`、`final !== false` 時結束本次執行)。#24:SSE 失敗不再只是 3.5 秒提示列;現由持久的 `role=alert` 橫幅顯示錯誤並附帶重試操作(重新呼叫上次的執行函式),下次執行時清除。新增 8 個 i18n 鍵 × 8 個語系;測試 +7:`test: tests/scan-sse-a11y.test.mjs`。660 → 667。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.45.0] — 2026-05-18

**WS2 #3 —— #/config 分頁:完整的 WAI-ARIA Tabs 模式。** #/config 的三個分頁(API keys / Profile / Modes)曾是僅靠點擊啟用的樸素 `<button class="tab-btn">`:無 `role`、無 `aria-selected`、無鍵盤模型(UX 稽核 HIGH #3,WCAG 4.1.2 / 2.1.1)。`fix(a11y): config.js tabs implement role=tablist/tab/tabpanel` —— 現為帶 `aria-label` 的 `role=tablist` 容器;每個分頁 `role=tab` + `id` + `aria-controls` + `aria-selected`(於 `activate()` 中同步)+ 漫遊 `tabindex`(啟用 0 / 其餘 -1);面板 `role=tabpanel` + `tabindex=0` + 跟隨啟用分頁的 `aria-labelledby`。完整鍵盤導覽:←/→/↑/↓(環繞)+ Home/End 既移動焦點又啟用。遺留 `.tab-btn.is-active` CSS 掛勾予以保留。新增 1 個 i18n 鍵 × 8 個語系(`config.tablistLabel`);測試 +7:`test: tests/config-tabs-aria.test.mjs`。另有一處僅測試的修正:`fix(test): retarget 2 stale auto-pipeline smoke tests` —— 兩個 v1.34 之前的 Playwright-e2e smoke 測試斷言一個儀表板「Auto-pipeline」按鈕在 v1.34.0 起不再開啟的瞬態模態(→ `Router.go('/auto')`);它們在獨立的 Playwright-e2e CI 作業中一直為紅。重新指向 #/auto 畫面。653 → 660。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.44.0] — 2026-05-18

**WS2 #4 + #9 —— 父專案檔案破壞性覆寫前的焦點陷阱確認。** UX 稽核兩項 HIGH,皆為資料遺失:(#4)`config.js` 的 `saveProfileRaw`/`saveModesRaw` 未經確認即整體取代父層 `config/profile.yml` / `_profile.md`;(#9)`tracker.js` 的 Normalize/Dedup/Merge 未經確認即原地重寫父層 `data/applications.md`。`fix(a11y/safety): UI.confirm() gate before whole-file parent overwrites` —— 在 `public/js/api.js` 新增 `UI.confirm()`,一個重用既有 WAI-ARIA 模態基建的焦點陷阱對話框(`_onClose` 掛勾使 Esc / backdrop / × / Cancel 所有關閉路徑皆 resolve `false`;焦點預設落在 Cancel;回傳 `Promise<boolean>`;非原生 `confirm()`)。三處破壞性呼叫現已在寫入前全部加上閘門。新增 8 個 i18n 鍵 × 8 個語系(`{op}` 佔位符逐字保留);測試 +8:`test: tests/confirm-gate.test.mjs`,644 → 652。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.43.0] — 2026-05-18

**使用者要求 —— `career-ops-ui open` + autostart 將瀏覽器帶到前景。** 在 `setup`/`run` 之後,當瀏覽器已在執行時,裸 `open`/`xdg-open` 會讓儀表板分頁停留在背景,使用者得自行尋找。`feat(cli): career-ops-ui open — open AND raise the dashboard tab` —— 新的 `scripts/open-dashboard.mjs` 從 HOST/PORT 建構 URL(將 `0.0.0.0` 綁定改寫為 loopback),可選地等待 `/api/health`,開啟預設瀏覽器,然後**強制將其帶到前景** —— macOS 以 `osascript` 啟用 Chrome/Brave/Edge/Safari/Arc/Firefox 中正在執行的那個,Linux 以 `xdg-open`+`wmctrl`,Windows 以 `start`。作為 `career-ops-ui open` 動詞公開(別名 `dash`、`focus`)。`bin/start.sh` 的 autostart 現委派給它,因此分頁會自動帶到前景;`NO_OPEN=1` 在 headless/CI 啟動時停用 auto-open。README ×8 + help §1 ×8 已更新;測試 +8:`test: tests/open-dashboard.test.mjs`,636 → 644。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.42.0] — 2026-05-18

**WS2 修正 #2 —— 死路由 `#/portals` → config 深層連結。** `#/portals` 是一條未註冊路由,會渲染 404 檢視,儘管它是管理入口來源時合理的書籤/手動輸入 URL(UX 稽核 HIGH 第 2 項)。`fix(router): #/portals 404 → alias to config + Regional-sources deep-link` —— 在 `router.js` 的 `ALIASES` 中新增 `portals: 'config'`(與 `settings→profile` 相同的書籤穩定性模式),現在它解析為 config 檢視且 **config** 導覽項處於啟用狀態。當存在 Regional-sources 群組時,檢視(`config.js`)偵測 `#/portals` 雜湊,強制展開該 `<details>` 群組、捲動至可見區並將焦點移至其 summary(覆寫預設的 h1 焦點),使使用者恰好落在入口來源控制項上;絕不會僅憑別名渲染空的地區群組。help-bundle §5 × 8 新增一條快捷鍵提示;router 測試 +1:`test(router): portals→config alias guarantee` 加入 `router.test.mjs`,635 → 636。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.41.0] — 2026-05-18

**WS2 —— 資深 UX/可用性稽核 + 橫切焦點管理修正。** 一次 10 年以上經驗的啟發式稽核(Nielsen × WCAG 2.2 AA × 專案慣例)檢視全部 17 條路由,產出一份依嚴重度排序的 40 項發現佇列(`.planning/.../UX-AUDIT.md`);HIGH→MEDIUM→LOW 現按每次發行一項修正逐一交付。本次發行落地橫切 HIGH 第 1 名。修正:`fix(a11y): move focus to the new view on every route change` —— `router.js render()` 在每次 hashchange 替換 `#content` 卻從不移動焦點,因此鍵盤/螢幕閱讀器使用者停留在被銷毀的節點上而失去位置(WCAG 2.4.3 Focus Order / 4.1.3 Status Messages —— 橫切,影響全部 17 個畫面);新的 `focusNewView(content)` 聚焦新檢視首個 `h1`/`.page-title`(簡潔的 SR 播報 + 正確的焦點順序),必要時令標題可聚焦(`tabindex=-1`)並回退到 `#content`;跳過最初一次繪製以免與 skip-link 衝突;在成功與錯誤兩條渲染路徑皆接線;已即時驗證:導覽後 `document.activeElement` 為新檢視的 `H1.page-title`。測試:`test(router): focus-management static guarantees` —— `router.test.mjs` 新增 4 個案例(輔助函式已定義、標題目標 + content 回退、首繪跳過守衛、≥2 個呼叫點);631 → 635。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.40.0] — 2026-05-18

**WS8.3 —— docs 實態化掃描 + `career-ops-ui help` 修正 + `askSecret` 強化。** 修正:`fix(cli): career-ops-ui help no longer leaks shell source` —— 調度器以 `sed -n '2,12p'` 印出其標頭註解,但第 12 行(`set -euo pipefail`)是程式碼而非註解,因此 `career-ops-ui help`(以及未知動詞的用法文字)以一行多餘的 `set -euo pipefail` 結尾;在 `help` 與 `*)` 兩種情形下收窄為 `2,11p`(註解區塊);`help` 以 exit 0 結束,未知動詞以 exit 2 結束 —— 已驗證。`fix(cli): scripts/init.mjs key entry never echoes` —— v1.39.0 的後續將裝飾性的 readline 覆寫遮罩替換為真實的 raw 模式讀取器:`setRawMode(true)` + 帶緩衝的行,使輸入/貼上的金鑰位元組根本不會到達終端機(無 scrollback / tmux / 螢幕分享外洩);完整的 VT 跳脫 FSM 消化每個 CSI/SS3/OSC/DCS/SOS/PM/APC 序列,使方向鍵與功能鍵無法破壞密鑰;`stdin` 透過相依注入,因此非 TTY 退路在不碰觸全域的情況下做單元測試;反覆迭代至 AI 審查乾淨 LGTM。文件:README ×8 —— 舊的「一條命令安裝」章節替換為醒目的 **「一條命令啟動並初始化」** 章節(curl 單行加上顯式的 `career-ops-ui` CLI 鏈:clone → `npm link` → `setup` → `init` → `doctor` → `run` → `help`,供應方精靈說明,CI 形式 `--provider --anthropic-key --yes`,以及 `LLM_PROVIDER` 註記);8 個 README 徽章從陳舊的 v1.22–v1.24 / tests-461–474 實態化為 **v1.40.0 / tests-631**(e2e 徽章改為非數字以避免杜撰計數);help-bundle ×8 §1 —— 在快速上手手冊頂部(「A. Setup」之前)向全部 8 個語言新增「一條命令啟動 & init」標註;H2 章節配平保持(各 17 —— CI 閘門綠)。測試:`test(init): non-TTY askSecret fallback` —— `provider-selector.test.mjs` 新增一個 DI-stdin 案例,斷言 `askSecret` 在非 TTY 下委派給普通 `ask()`(trim 配平)且不更動共享全域;629 → 631。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.39.0] — 2026-05-18

**WS8.2 —— LLM 供應方選擇器 + OpenAI/Codex 金鑰 + 互動式 `init` 精靈。** env-config 新增 `LLM_PROVIDER`(auto|claude|gemini)+`OPENAI_API_KEY`(密鑰)。llm.mjs 全部 6 個 gate-site 經 `_provGate()` 用 `providerOrder()`;auto 行為不變。#/config 新增 select+欄位。`scripts/init.mjs` 現為真實精靈(經驗證路徑寫 parent .env)。7 測試。622 → 629。README ×8/規範文件 fold = WS8.3/WS10。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.38.0] — 2026-05-17

**WS8.1 —— 統一 CLI 調度器 + `doctor` 動詞。** `bin/career-ops-ui.sh` 路由 setup/run/doctor/init/help。`scripts/doctor.mjs` 重用確切的 `/api/health` 引擎(createApp 程序內 → 終端報告);僅當所有必需檢查通過才 exit 0。docs/sdd + help §1 ×8。6 測試。616 → 622。README ×8 = WS8.3。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.37.0] — 2026-05-17

**WS7 —— git 工作流 pre-commit AI 審查。** 確定性底線(fail-HARD):攔截 staged `.env`/金鑰、diff 中金鑰模式、staged 視圖中的 `.also(`、`node --check` 失敗。AI 層(fail-SOFT):CLI 可用且 `AI_REVIEW != off` 時跑 `claude -p`。`.githooks/pre-commit` + `prepare` 接 `core.hooksPath`。禁用 `--no-verify`。docs/sdd。6 測試。610 → 616。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.36.0] — 2026-05-17

**WS6.3 —— Modes 分頁:原始區塊 → 分區編輯器。WS6 完成。** `modes/_profile.md` 按 `##` 區塊編輯(每標題一個可折疊 textarea)。伺服端 `splitProfileSections` 位元組精確;`PUT { sections }` 僅合併指定區塊 —— 前言+其他區塊+順序按位元組保留。未知標題 → 400。raw 路徑不變。i18n 5 鍵 ×8。help §2 ×8。新增 6 測試。604 → 610。WS6 收尾。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.35.0] — 2026-05-17

**WS6.4 —— Profile 陣列編輯器 + WS6.2 API-keys 稽核。** `PUT /api/profile` 接受 `{ arrays }`(可與 `{ fields }` 組合):Target roles/Superpowers(清單)、Archetypes(name/level/fit)、Proof points(name/url/hero-metric)。相同 merge-not-replace;空列丟棄;空清單刪除鍵。#/config 新增 4 個增刪編輯器。i18n 6 鍵 ×8。稽核:KNOWN_KEYS ≡ FIELDS,無 gap。新增 7 測試。597 → 604。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.34.0] — 2026-05-17

**WS5 —— 一鍵 Auto-pipeline 頁面(`#/auto`)。** 模態升級為獨立可連結頁面。一鍵執行 驗證→擷取→評估→儲存報告→追蹤器(SSE)。無障礙 stepper、深連、無 key 手動模式、可連結 `#/auto?url=…&go=1`。側欄入口;dashboard ✨ 按鈕改到此處。i18n 14 鍵 ×8。help §1 ×8 + README ×8。新增 8 測試。589 → 597。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.33.0] — 2026-05-17

**WS4 —— career-ops 1.8.0 對等稽核 + `location_filter`。** 父 `scan.mjs` 新增 `location_filter`(#570);web-ui 的程序內 scanner 不委派給它,故未流通。新增 `server/lib/location-filter.mjs` 逐字複製語義,接入兩個 scanner。help §5 ×8。新增 8 測試。581 → 589。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.32.0] — 2026-05-17

**`#/config` Profile 分頁 —— 原始 YAML 區塊 → 逐欄位表單(WS1)。** 3 個可折疊分區(候選人/敘述/薪酬),14 個純量路徑。逐欄位儲存**合併**進 `config/profile.yml`:archetype、proof point 與自訂鍵原樣保留。*Advanced* 保留 raw-YAML 退路(保留註解)。23 個 i18n 鍵 ×8。新增 7 測試。574 → 581。詳見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.31.0] — 2026-05-17

**與 career-ops 1.8.0 同步 — `#/batch` 暴露 `--model` + `--start-from`。** 父專案 1.7.1 → 1.8.0;`batch-runner.sh` 新增 `--model NAME`(#504)與 `--start-from N`。web-ui 在 `#/batch` 暴露(**模型**、**起始 #** 輸入)並在伺服端做 defense-in-depth 驗證。i18n ×8。新增 7 個測試。567 → 574。完整詳情見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.30.0] — 2026-05-14

**`#/scan` 結果分頁器 — 取代 v1.12 的「顯示前 200(共 N)」截斷。**

v1.30 之前,掃描結果表會被硬截斷為前 200 列過濾後的資料,底部一行「Showing first 200 of N」提示,201..N 列無法從 UI 存取。v1.30.0 將上限替換為 `UI.paginate`(與 `#/tracker` / `#/reports` / `#/activity` 同一 helper)。`PAGE_SIZE = 200` 保持原有視覺密度;boost-to-top 排序在跨頁時仍穩定(先對完整集合排序,再分頁);任意篩選變化時自動重置為第 1 頁。已棄用的 i18n key `scan.shownTop` 被移除(8 個語系)。`tests/scan-paginator.test.mjs` 新增 9 個案例(7 個靜態 canary + 含 6 個邊界條件的純邏輯表 1 個 + 摘要計算 1 個)。**558 → 567** 單元 + 驗收測試(+9)。完整細節見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.29.2] — 2026-05-14

**熱修復:`🌐 Scan` 在 `source=both` 模式下只跑了 EN 階段,RU 階段被靜默丟棄。**

SSE 客戶端(`public/js/api.js:156`)在第一個 `done` 事件就關閉了 `EventSource`,但伺服器在 `source=both` 模式下每階段各發一個 `done`。RU 階段剛啟動就被取消。修復:伺服器在每個 `done` 上標記 `final: true|false`,客戶端僅在 `final !== false` 時關閉。向後相容 — 不設定 `final` 的單階段生產者繼續保持原行為。**547 → 558** 單元 + 驗收測試(+11 新增)。完整細節見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.29.1] — 2026-05-14

**為 help-bundle §5 的 8 個語系全部加入面向使用者的 5 個 RU 入口網站設定詳盡指南。**

在 §5(Portals & sources)內新增 ### 子節「設定俄文入口網站 — 詳細設定指南」:5 個來源的清單表(含驗證與地理限制)、定位與編輯 `portals.yml` 的分步說明、完整的 5 來源 YAML 範例、與 negative 清單的衝突及其修復範例、臨時停用某個來源的方法、透過 🌐 Scan 與 SSE 記錄驗證設定的方法。§17(v1.29.0 上線)涵蓋開發者流程,§5 v1.29.1 涵蓋最終使用者流程。**540 → 547** 單元 + 驗收測試(+7 新增)。完整細節見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.29.0] — 2026-05-14

**俄文職位入口網站掃描器從 2 個來源擴展到 5 個;registry + 動態下拉框;新增 §17「如何新增新入口網站」。**

- **3 個新 RU adapter:** `Trudvsem`(政府 open-data API,無認證、無地理閘),`GetMatch` 與 `GeekJob`(HTML 抓取,防禦式解析器 — 解析失敗回傳 `[]`,健康 200 絕不 throw)。
- **Source registry** 位於 `server/lib/sources/registry.mjs` — 由 dispatcher + endpoint + dropdown 共同消費的單一事實來源。v1.29 之前列表硬編碼在三處。
- **新增 endpoint** `GET /api/scan/sources`(`Cache-Control: max-age=60`)— SPA 在掛載 `#/scan` 時動態重繪來源篩選下拉。
- **新增 §17** 覆蓋 8 個語系:「如何新增職位入口網站來源」(adapter 範本、registry 條目、dispatcher、mock 測試、`portals.yml`)。
- **`russian_portals.sources` 預設值**從 `["hh", "habr"]` 改為 5 個來源;如果你的 `portals.yml` 已明示列出 `sources:`,需手動加入 3 個新條目。
- 測試:**520 → 540**(+20)。完整細節見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.28.1] — 2026-05-14

**熱修復:`?query` 雜湊導致 router 404;從 health 移除 HH_USER_AGENT 列。**

v1.28.1 之前,`Router.go('/evaluate?url=…')` 產生的 hash 經 `split('/')` 後第一段是字面量 `"evaluate?url=…"`,永遠不會比對到已註冊路由 → `__not_found__`(404)。一行修復:在依名稱拆分前先 `hash.split('?')[0]`。覆蓋兩個已回報的點擊:`#/pipeline → ▶` 與「App settings → Modes」。`/api/health` 中可選的 `HH_USER_AGENT` 列被移除(俄羅斯境外 403 提示仍保留在 help-bundle §16 中,掃描時 stderr 也仍會提示)。**515 → 520** 單元 + 驗收測試(+5 新增)。完整細節見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.28.0] — 2026-05-14

**文件對齊 + `#/batch` 新增 `--max-retries N` 控制項。**關閉 `qa/QA-PROMPT-docs-vs-app.md` 中提出的兩個未決 issue。

- **Issue #2** — `#/batch` 現在提供「Max retries」數字輸入(1–10),僅在勾選「Retry failed」時啟用。伺服器端使用 `parseInt` 並驗證 1≤N≤10,超出範圍的值會靜默丟棄;未啟用 `--retry-failed` 時 `--max-retries` 旗標被忽略。`tests/batch-max-retries.test.mjs` 中 7 個測試案例。新增 2 個 i18n key × 8 語系。
- **Issue #1** — 8 個 help-bundle 與 8 個 README 的 AI CLI 列表與 career-ops.org/docs 正典(Claude Code · Codex · OpenCode · Qwen CLI)對齊,並附本地化一句:*「其他 Claude 相容 CLI 也透過相同的斜線指令介面運作」*。README 中關於 web-ui 自身 shim 檔案的「Multi-CLI」項目保持不變(那是另一種 surface)。`tests/canonical-docs-coverage.test.mjs` 中新增 2 個回歸 canary。
- **506 → 515** 單元 + 驗收測試(+9 新增)。Playwright 32/32 無變化。完整細節見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.27.0] — 2026-05-14

**外觀 + 無障礙打磨：去重側邊欄 `#/dashboard` 入口。**

側邊欄中，品牌標誌（`<a class="logo" href="#/dashboard">`）與第一個導覽項目指向同一路由。螢幕閱讀器重複念出「Dashboard」兩次，鍵盤使用者多出一個無意義的 tab 焦點。標誌區塊現在改為普通的 `<div class="logo">`，唯有導覽項目保留為 `#/dashboard` 的唯一連結。**506 / 506** 單元 + **32 / 32** Playwright — 無變化。完整細節見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.26.1] — 2026-05-14

**WCAG 2.5.5 熱修復 — 恢復 `.btn` 最小高度 44 px.**

v1.26.0 中 `.btn` 的 `min-height: 44px` 宣告遺失,標頭按鈕渲染為 39-41 px(違反 WCAG 2.5.5)。v1.26.1 恢復 44 px 下限 + `flex-shrink: 0` + `line-height: 1.2`。**502 → 506** unit,Playwright 32/32 不變。詳細見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## [1.26.0] — 2026-05-14

**測試金字塔 + 行覆蓋率 ≥ 93 %.**

依 v1.25 待辦事項採用四級測試金字塔(unit → functional → acceptance → e2e)。新增 22 個測試,涵蓋 v1.25 的最大空白(jds.mjs 61.64 % → 100 %,auto-pipeline 拒絕路徑)。新增 `tests/acceptance/` 目錄用於跨端點使用者旅程測試。**480 → 502** unit + acceptance,Playwright 32/32 不變。完整細節見 [`CHANGELOG.md`](CHANGELOG.md) 和 [`docs/architecture/TESTING.md`](docs/architecture/TESTING.md)。

---

## [1.25.0] — 2026-05-14

**Auto-pipeline 手動模式短路 + 儀表板外觀微修 + CHANGELOG 對齊回填。** 一次解決 G-014(auto-pipeline 忽略 `mode: 'manual'`)、G-012(CHANGELOG 對齊漂移 — 6 個 locale 落後兩個版本),以及儀表板 `✨ ✨` 雙字符外觀問題。G-003(`README.cn.md` 重新命名)其實已自然關閉 — 此版本庫只存在 `README.zh-CN.md`。G-005(A-G → A-F 報表區塊重排)需要父專案協同提交,本版本持續延後。

### 🛡️ G-014 — Auto-pipeline `mode: 'manual'` 短路

- **`fix(auto-pipeline): G-014 — honour mode:'manual' short-circuit`** ([`server/lib/routes/auto-pipeline.mjs:158-195`](server/lib/routes/auto-pipeline.mjs#L158-L195)) — v1.25 之前,該路由不論如何都會呼叫 LLM。傳入 `mode: 'manual'`(自 v1.10.2 起 `/api/evaluate` 已支援的旗標)被靜默忽略,請求會在 Anthropic 端卡住 1–3 分鐘。新版 handler:
  - 同時接受 `mode` 與 `evalMode` 以維持向後相容。任一參數值為 `'manual'` 即觸發短路。
  - 仍會發出全部 5 個 SSE 階段,但 `status` 為 `'done'` 或 `'skipped'`。不發 fetch、不呼叫 LLM、每次請求 0.05 美元的開銷也省下。
  - `done` 事件 payload 攜帶 `{ mode: 'manual', prompt: <buildEvaluationPrompt scaffold>, message }` — SPA 可比照既有 `/api/evaluate` 的手動提示卡片渲染。
- **同步關閉 `HOST=0.0.0.0` 下的 DoS 風險**:過去即使有 `llmRateLimit` 限制每 IP 每 60 秒 10 次,10 名攻擊者 × 10 次 = 每分鐘 50 美元的 Anthropic 燒帳。短路在進入速率限制計數之前就先生效。
- **測試** — [`tests/auto-pipeline-manual-mode.test.mjs`](tests/auto-pipeline-manual-mode.test.mjs):3 個測試確認(1)`mode: 'manual'` 在 2 秒內回傳並包含全部 5 個 step key、(2)即使設定了 `ANTHROPIC_API_KEY` 短路依然生效(這正是原始症狀)、(3)傳統 `evalMode: 'manual'` 呼叫端持續運作。

### 📝 G-012 — CHANGELOG 對齊回填(6 個 locale × 2 個遺漏版本)

- **`docs(changelog): backfill v1.23.0, v1.24.0, v1.24.1, v1.25.0 in 6 lagging locales`** — v1.25 之前只有 EN 包含 v1.23–v1.24;RU 落後 1 個版本,其餘 6 個 locale 落後 2 個版本。v1.25 派發平行翻譯 agent(沿用 v1.23 的模式)將四個條目同時落入 `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md`。RU 補上 v1.24.0 + v1.24.1 + v1.25.0(它在 v1.23 週期已取得 v1.23.0)。
- **`feat(ci): scripts/check-changelog-parity.mjs gate`** — 若任何 locale CHANGELOG 的最新條目舊於 EN 規範版,即視為建置失敗。已串接至 `npm run test:ci`。此前的 G-012 漂移在跨越 EN 邊界的當下就會自我攔截。

### ✨ 外觀微修 — 儀表板雙字符去重

- **`fix(dashboard): dedup ✨ glyph in auto-pipeline button label`** ([`public/js/lib/i18n-dict.js:219`](public/js/lib/i18n-dict.js#L219)) — `dash.autoPipeline` 在每個 locale 字串裡都帶了開頭的 `✨`,而 `public/js/views/dashboard.js:58` 又額外加了一個 `✨`。結果:按鈕渲染成 `✨ ✨ Auto-pipeline …`。v1.25 移除每個 locale DICT entry 的開頭字符;view 端的前綴成為唯一來源。同次稽核掃過剩餘的 i18n 資料,未發現其他雙字符模式。

### 🚫 延後至未來版本

- **G-005 — 報表區塊 A-G → A-F 對齊規範 career-ops.org/docs** — 需要在父專案 `santifer/career-ops` 協同提交(改寫 `modes/oferta.md`,輸出 A=Role、B=CV-match、C=Strategy、D=Comp、E=Personalization、F=STAR — 將 C-Risks/G-Legitimacy 從獨立區塊移除)。v1.25.0 已讓 web-ui 端準備好接收新 schema(`reports.js` 自 v1.13 起即接受任意區塊字母)。等待父專案 + 子專案能同步出貨的下個發版視窗。
- **G-003 — `README.cn.md` → `README.zh-CN.md` 重新命名** — v1.25 整備期已驗證:此版本庫實際只有 `README.zh-CN.md`(worktree 任何位置都不存在孤兒 `README.cn.md`)。G-003 的觀察已過時。

### 🧪 測試

- **477 → 480** 個單元測試(+3 來自 PR-B 的 `auto-pipeline-manual-mode.test.mjs`)。
- 32/32 Playwright 不變。
- `npm run test:ci` 現在執行 `npm test` + `check-no-also-leftovers.mjs` + `check-changelog-parity.mjs`。

### 驗證

```bash
$ npm run test:ci
# 480 / 480
# ✓ no .also( leftovers in views/
# ✓ CHANGELOG parity: all 8 locales at v1.25.0

# G-014 — 即使設定 ANTHROPIC_API_KEY,manual 模式仍於 2 秒內回傳:
$ ANTHROPIC_API_KEY=sk-ant-test PORT=4317 npm start &
$ sleep 3
$ time curl -sS -X POST -H 'Content-Type: application/json' \
    -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/x","mode":"manual"}' \
    http://127.0.0.1:4317/api/auto-pipeline | head -20
# real  0m0.1xx s  (此前為 1-3 分鐘)
# event: start … event: step (×5) … event: done {"mode":"manual","prompt":"…"}

# G-012 — 每個 locale 的 CHANGELOG 都帶有 v1.25.0 條目:
$ grep -c '^## \[1.25.0\]' CHANGELOG*.md
# 8 個檔案,每個 → 1

# 外觀微修 — 儀表板字符:
$ grep "dash.autoPipeline" public/js/lib/i18n-dict.js
# 任何 locale 的值皆已無開頭 ✨(view 提供唯一字符)
```

### 破壞性變更

無。`mode: 'manual'` 為 opt-in;傳統 `evalMode: 'manual'` 呼叫端維持原狀運作。

### 範圍外(v1.26+)

| 項目 | 備註 |
|---|---|
| G-005 — A-F 報表區塊重排 | 需父專案協同提交(`santifer/career-ops` 改寫 `modes/oferta.md`)。 |
| QA 場景 31 **視覺** 子測試的實機執行 | 需瀏覽器驅動 agent(Claude Cowork)。Playwright smoke 已部分涵蓋。 |
| `i18n-dict.js` 超過 400-LOC 目標 | 屬翻譯 fixture — 依政策豁免。在無 bundler 的情境下拆分只會新增 HTTP 請求。 |

---

## [1.24.1] — 2026-05-14

**Hot-fix:8 個 locale 的 `#/config` 全數崩潰(G-015)。**

### 🚑 緊急 hot-fix

- **`fix(config): G-015 — replace removed Element.prototype.also call in config.js`** ([`public/js/views/config.js:371`](public/js/views/config.js#L371)) — v1.22.0 的 N-2 移除了 `Element.prototype.also` 全域 monkey-patch 並將 `cv.js` 改為 free-statement 寫法,但**漏掉了 `config.js`**。後果:每個 locale 首次進入 `#/config` 時都會以 `c(...).also is not a function` 崩潰。v1.24.1 套用與 `cv.js:188-201` 相同的遷移模式 — 將樹根抽至 `const root = c(...)`,獨立執行 activation 區塊,最後 `return root;`。

### 🛡️ CI 守門

- **`feat(ci): scripts/check-no-also-leftovers.mjs sweep`** — 走訪 `public/js/views/` 下的每個檔案,只要還存在 `.also(` 呼叫點(允許註解中的引用),即視為建置失敗。已串接至新增的 `npm run test:ci` script。日後若有人意外撤回 monkey-patch 移除動作,也無法靜默重現同一個迴歸。

### 🧪 測試

- **`test: tests/config-view-syntax.test.mjs`** — 三道防線:
  - 透過 `node:vm.Script` 解析 `config.js`(不需 Playwright 即可捕捉語法層級迴歸)
  - 斷言註解之外無 `.also(` 殘留
  - 斷言 `const root = c(...)` / `return root;` 的遷移錨點存在
- **474 → 477** 個單元測試(+3)+ 32/32 Playwright 不變。

### 驗證

```bash
$ npm run test:ci
# 477 / 477
# ✓ no .also( leftovers in views/

# 瀏覽器 smoke:
$ open http://127.0.0.1:4317/#/config
# → 正常渲染,無 "is not a function" 卡片。每個 locale 等同。
```

### 範圍外(延至 v1.25)

- G-014、G-012、G-005、G-003 — 詳見下方 v1.25.0 條目的批次處理。

---

## [1.24.0] — 2026-05-14

**Help-bundle 內容深度刷新 + QA 場景 31 實機執行 + RU CHANGELOG 全文翻譯。** 一次關閉 v1.23.0「範圍外」表格延後至 v1.24 的兩項:依 5 個規範 career-ops.org/docs URL 對全部 8 個 help bundle 做完整內容深度刷新(自 v1.11.x 以來只覆蓋了 URL 出現位置),以及在實機伺服器上執行 QA 場景 31(原列為「需瀏覽器 agent + LLM 憑證」 — 實測發現 6/6 子測試可用 curl + grep 達成,只有視覺類子測試需要瀏覽器)。

### 📖 Help-bundle 內容深度刷新

- **`docs(help): refresh en.md from 5 canonical career-ops.org/docs URLs`** ([`docs/help/en.md`](docs/help/en.md)) — v1.24 之前 EN bundle 共 1113 行,在 front-matter 列出 5 個規範 URL,卻未於主文展開。v1.24 透過 WebFetch 取得全部 5 個 URL,並深化對應的 H2 區段:
  - **About career-ops(front-matter)** — 補上原則(data sovereignty、AI-agnostic、human-controlled)、「What career-ops is NOT」區塊;概念清單從 6 列擴增至 10 列(新增 Proof points、JD store、Interview-prep、Batch additions)。
  - **§5 Portals** — 補入規範 bootstrap `cp templates/portals.example.yml portals.yml`,釐清 `tracked_companies` 各筆的必填 vs 選填欄位。
  - **§7 Scan** — 為 Option A 加上「無 AI token 消耗」標註,後續指令清單(`apply` / `contacto` / `deep` / `tracker`)。
  - **§14 Apply checklist** — 拆分為 SPA checklist 模式 vs Manual-vs-Playwright-assisted vs Full CLI flow(規範的 8 步驟,從 `/career-ops apply <company>` 到 `Submitted.` 並含 `Evaluated → Applied` 自動轉移);batch evaluate 子節新增 TSV schema 表格 + 4 個旗標完整說明 + `merge-tracker.mjs --dry-run`;Playwright Setup 子節列出安裝指令、MCP 註冊、替代 `.claude/settings.local.json`、預設 headless 註記。
- **保留 16-H2 區段對等**(CI 測試 `help-ui.test.mjs::section-parity` 斷言全部 8 個 locale 皆精確有 16 個 H2 區段)。
- **5 個規範 URL 各自至少出現 2 次**(由 CI 測試 `canonical-docs-coverage.test.mjs` 強制執行)。v1.24 後逐 URL 計數:`what-is-career-ops` × 4、`scan-job-portals` × 5、`apply-for-a-job` × 3、`batch-evaluate-offers` × 5、`set-up-playwright` × 3。
- **`docs(help): translate the v1.24 deepening to 7 non-EN locales`** — 派發 7 個平行翻譯 agent。每個目標 locale(es / pt-BR / ko-KR / ja / ru / zh-CN / zh-TW)取得與 EN 逐節對齊的刷新版 bundle,逐字保留程式碼區塊 / URL / 檔案路徑 / 按鈕標籤(📁 Upload CV / 🌐 Scan now / ▶ Evaluate / 📄 Generate PDF / 💾 Save)與英文縮寫(CSP、SSRF、TOCTOU、WCAG、ATS、JD、SSE、REST、API),並以目標語言的出版品級技術風格翻譯深化內容。

### 🧪 QA 場景 31 — 實機執行(6/6 PASS)

- **`docs(qa): append last-verified live-execution log to qa/claude-cowork-browser-test-prompt.md`** — v1.24 之前,場景 31 已寫成文件但從未對實機伺服器跑過(列為「需瀏覽器 agent + LLM 憑證」)。v1.24 對 `http://127.0.0.1:4317` 執行全部 6 個子測試:

  | 子測試 | 描述 | 狀態 |
  |---|---|---|
  | 31.1 | help bundle 中的 score thresholds | ✅ PASS(`docs/help/en.md` 中 4.5 × 3、4.0 × 9、3.5 × 6 次) |
  | 31.2 | Scan workflow 端點 | ✅ PASS(`/api/stream/scan-{en,ru}` + `/api/scan-ru/config` → 404;`/api/scan/regional/config` → 200) |
  | 31.3 | `/api/apply-helper` checklist | ✅ PASS(回應含 `career-ops apply` + `auto-submit` 警示) |
  | 31.4 | `/api/batch` 端點 | ✅ PASS(keys 為 `[exists, runnerExists, raw, rows, additions]`) |
  | 31.5 | Playwright 可用性 | ✅ PASS(`/api/health` 回報 `Playwright (parent node_modules) ok: true, value: installed`) |
  | 31.6 | help bundle URL 覆蓋率(5 個 URL × 8 個 locale) | ✅ PASS(**40 / 40 ✓**) |

  視覺類子測試(需瀏覽器)在 QA prompt 中另行標註 — 仍可透過 Claude Cowork 或 `npm run test:e2e:browser` 執行。

### 🌐 RU CHANGELOG 全文翻譯(M-9 後續)

- **`docs(translate): CHANGELOG.ru.md retry agent — full body translation`** ([`CHANGELOG.ru.md`](CHANGELOG.ru.md)) — v1.23.0 出貨時,RU CHANGELOG 的重試 agent 仍在進行中(它曾因 socket 錯誤崩潰一次並被重新派發)。v1.24 收下 agent 產出的 1542 行全文翻譯:每個條目 v1.23.0 → v1.6.0 皆有出版品級的俄文正文,不再保留 EN 過渡填補。風格規範比照 v1.22.0 README 品質刷新:以 "функциональность" / "возможности" / "поведение" 取代生硬的 "функционал";以 "через" / "с помощью" 取代 "при помощи";主動語態優於被動;以 "эндпоинт"、"лимит запросов"、"состояние гонки"、"санитайзинг" 作為規範用詞;英文縮寫(TOCTOU、CSP、SSRF、WCAG、ATS、JD、SSE、REST、API)保留原文。

### 🧪 測試

- **474 / 474** 單元 + 20 / 20 smoke E2E + 32 / 32 Playwright。零行為差異;每一項 help-bundle 的 CI 斷言(16 個 H2 區段 × 8 個 locale、5 個 URL × ≥ 2 次提及、內容下限)持續綠燈。

### 驗證

```bash
$ npm test                            # 474 / 474

# Help-bundle 深化:
$ wc -l docs/help/en.md
# ~1270 行(原 1113 — 深化,不膨脹)

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

# 場景 31.6 — 40/40 URL 覆蓋率:
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

### 破壞性變更

無。

### 範圍外(v1.25+)

| 項目 | 備註 |
|---|---|
| 場景 31 **視覺** 子測試的實機執行 | 需瀏覽器驅動 agent(Claude Cowork 或 `npm run test:e2e:browser`)。curl 單一執行模式不在範圍內;Playwright smoke 已涵蓋。 |
| RU CHANGELOG **舊條目**(v1.5.x 及之前)的正文翻譯 | 重試 agent 僅覆蓋 v1.6.0 起。pre-v1.6 條目(`v1.5.x` 等)— 若曾經存在 — 仍維持既有內容。 |
| 未來 SPA 變更後對儀表板截圖的視覺迴歸 | `scripts/capture-dashboard-screenshots.mjs` 可重新產生各 locale 的 PNG;目前尚未有自動 diff。 |

---

## [1.23.0] — 2026-05-14

**i18n 拆分 + 連線橫幅 CI hot-fix + 各 locale 儀表板截圖 + 既有 backlog 完整收尾。** 出貨 v1.22.0「範圍外」表格列為 v1.23 的三項(M-9 各 locale CHANGELOG 正文、N-1 `i18n.js` LOC 拆分、help-bundle 內容稽核),並包含修補 v1.22.0 之後讓 main 分支 CI 變紅的 smoke E2E hot-fix。

### 🚑 CI hot-fix — 連線橫幅恢復

- **`fix(client): reset health-poll cadence + visibilitychange eager re-check`** ([`public/js/api.js:21-91`](public/js/api.js#L21-L91)) — v1.22.0 的 M-6 指數退避方向正確(3 秒 → 6 秒 → 12 秒 → 上限 15 秒,原始上限為 60 秒),但飛行中的 `setTimeout` 被鎖定在上一次設定的 delay。當伺服器於 t=0.1 被殺、第一次 ping 在 t=3 失敗,delay 會加倍為 6,下一次恢復探測要等到 t=9 才會發出。smoke E2E 的「Flow 2a: connection banner appears on server down, hides on recovery」只等 4 秒,於 `main` 上轉紅。

    v1.23.0 重塑輪詢迴圈:

    - 追蹤 `_healthHandle`,讓 `setConnectionState(lost=true)` 能 `clearTimeout` 並以 `_HEALTH_MIN` 重新排程。第一次恢復探測現在保證在離線 3 秒內發出,不受先前排入的 delay 影響。
    - `_HEALTH_MAX` 從 60 秒降至 15 秒。後臺分頁面對已死伺服器,使用者切回時仍可在一個輪詢週期內恢復;頻寬節省依然顯著。
    - `document.addEventListener('visibilitychange')` 於分頁重獲焦點且 `connectionLost === true` 時積極重檢 — Cmd-Tab 回來不必等下個退避 tick。

### 🧹 N-1 — i18n.js 拆分(超過 400-LOC 目標)

- **`refactor(client): split DICT into i18n-dict.js (data) + i18n.js (logic)`** — v1.23 之前 `public/js/lib/i18n.js` 共 639 LOC。大宗(23-586 行)是 `DICT` 翻譯表 — 純結構化資料。v1.23.0 將其抽至 [`public/js/lib/i18n-dict.js`](public/js/lib/i18n-dict.js)(578 LOC,依 CLAUDE.md「豁免於上述限制:generated files、migrations、test fixtures、lock files、vendored code」— 翻譯表屬 fixture 性質,符合豁免),留下 [`public/js/lib/i18n.js`](public/js/lib/i18n.js) 為 86 LOC 的純模組邏輯(遠低於 400-LOC 目標)。
- **載入契約:**`i18n-dict.js` 寫入 `window.__I18N_DICT = { … }`,接著 `i18n.js` 在既有 IIFE 內讀取。[`public/index.html`](public/index.html) 依序載入 — 先 `i18n-dict.js` 再 `i18n.js` — 確保 IIFE 在建構時即看到填妥的 DICT。Missing-dict fallback:每一次 `t()` 呼叫都會回傳 inline fallback 或裸 key,讓設定錯誤大聲浮現但不至於讓 SPA 崩潰。
- **測試管線更新:**[`tests/i18n-coverage.test.mjs`](tests/i18n-coverage.test.mjs)、[`tests/help-ui.test.mjs`](tests/help-ui.test.mjs)、[`tests/canonical-docs-coverage.test.mjs`](tests/canonical-docs-coverage.test.mjs) 現皆於測試 VM context 中執行兩個檔案(或在正則掃描時串接兩者原始碼),保留所有既有斷言。

### 🌐 M-9 — 各 locale CHANGELOG 正文翻譯

- **`docs(translate): 7 non-EN CHANGELOG files end-to-end`** — v1.23 之前,`CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` 自 v1.13.0 起的每個條目都帶著 EN 正文的過渡填補與引導讀者去看 EN 規範版的 footer。v1.23.0 派發 7 個平行翻譯 agent — 每個 locale 一個 — 將每個正文改寫為目標語言的出版品級技術風格。移除過渡填補。各 locale 一律逐字保留程式碼區塊、檔案路徑、URL、commit-message 字串(`fix(security): B-1 — …`)、環境變數與連結標籤。

### 🖼️ 各 locale README 對接專屬儀表板截圖

- **`docs(readme): wire each locale README at its locale-specific PNG`** — v1.23 之前只有 `README.pt-BR.md` 指向 `dashboard-pt-BR.png`,其餘 6 個非 EN README 仍指向 `dashboard-en.png`。v1.22.0 週期由 [`scripts/capture-dashboard-screenshots.mjs`](scripts/capture-dashboard-screenshots.mjs) 產出的截圖已置於 `images/` 但未被引用。v1.23.0 將每個 `README.{es,ja,ko-KR,ru,zh-CN,zh-TW}.md` 第 14 行更新為對應的 `dashboard-<locale>.png`。

### 🧪 測試

- 與 v1.22.0 同為 474 / 474 單元 + 32 / 32 Playwright。**Smoke E2E 現為 20 / 20**(v1.22.0 後在 `main` 上曾因橫幅恢復迴歸成 19/1 fail;v1.23.0 的重排程修復收尾)。
- 為了 i18n 拆分重接三個既有測試。零新增測試檔案;零刪除斷言。

### 驗證

```bash
$ npm test
# 474 / 474

$ npm run test:e2e
# passed: 20    failed: 0    (v1.22.0 main 時為 19/1)

$ wc -l public/js/lib/i18n.js public/js/lib/i18n-dict.js
#       86 public/js/lib/i18n.js          ← 邏輯,低於目標
#      578 public/js/lib/i18n-dict.js     ← 資料 fixture,豁免

$ grep -h 'dashboard-' README*.md | sed -E 's/.*(dashboard-[^)]+).*/\1/' | sort -u
# dashboard-en.png    (僅 README.md)
# dashboard-es.png    dashboard-ja.png
# dashboard-ko-KR.png dashboard-pt-BR.png
# dashboard-ru.png    dashboard-zh-CN.png  dashboard-zh-TW.png

# CHANGELOG 翻譯 sanity check:每個 locale 檔案均 > 200 行原生語言內容
$ wc -l CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md | grep -v total
```

### 破壞性變更

無。`public/index.html` 現在載入兩個 script(原本一個)— 任何透過 CDN 提供 SPA 的部署需同步取得 `i18n-dict.js`;載入順序由 `index.html` 的 `<script src>` 標籤順序強制。執行階段 fallback(空 DICT → `t()` 回傳 inline EN fallback)可避免新檔案缺失時硬崩潰。

### 範圍外(v1.24+)

| 項目 | 備註 |
|---|---|
| 依 career-ops.org/docs 對 help-bundle 做內容深度刷新(相對於僅 URL 覆蓋) | 5 個規範 URL 自 v1.11.x 起已在每個 locale 的 help bundle 中出現,QA prompt 場景 31.6 驗證了覆蓋率。內容深度刷新為 v1.24+ 候選。 |
| 對實機伺服器執行 QA 場景 31 | 需瀏覽器 agent + 實機 LLM 憑證。v1.24 候選。 |
| 新增 mode-page hint 段落的逐元件觸控目標掃描 | v1.22.0 M-1 新增的 `<p class="field-hint">` 元素尚未在全部 8 個 locale 對 WCAG 2.5.5 最小高度做驗證。 |

---

## [1.22.0] — 2026-05-14

**M / L / N 級待辦清空 + 文件對齊 + 翻譯品質 pass。** 整個 v1.20.1-BACKLOG.md 中的 medium 及以下層級全部於一次發布中交付:九項 M、五項 L、兩項 nits。另對五份規範 [career-ops.org/docs](https://career-ops.org/docs) 指南進行了文件對齊稽核,刷新 `.claude/` 與 `.github/` 下的系統提示,並對 7 個非英文 locale 的 README 進行了品質刷新。

### 🛡️ 安全性強化(深度防禦)

- **`fix(security): M-4 — 具實體感知能力的 stripDangerousMarkdown`** ([`server/lib/security.mjs`](server/lib/security.mjs)) — v1.22 之前的正規表達式僅將 `<script>`、`javascript:`、`on*=` 視為字面子字串匹配。`&lt;script&gt;`、`java&#115;cript:` 與 `<img src="data:image/svg+xml,<svg onload=…>">` 都能繞過。新版淨化流程會在執行 strip 正規表達式**之前**先解碼 `&lt;`、`&gt;`、`&amp;`、`&quot;`、數值實體(`&#NN;`)與十六進位實體(`&#xHH;`)。由 [`tests/cv-xss-bypasses.test.mjs`](tests/cv-xss-bypasses.test.mjs) 中 11 個測試驗證。真正的防禦仍仰賴客戶端 `UI.md` escape-first 流程;此處強化的是靜態儲存的檔案。

- **`fix(security): L-2 — batch runner 使用 bash --noprofile --norc`** ([`server/lib/routes/batch.mjs:108`](server/lib/routes/batch.mjs#L108)) — `spawn('bash', [PATHS.batchRunner, ...])` 過去會繼承使用者 `~/.bashrc`。惡意 rc 檔案可能影響執行結果。現改為 `spawn('bash', ['--noprofile', '--norc', PATHS.batchRunner, ...])`。

### 🔒 韌性

- **`fix(client): M-6 — 健康檢查 ping 採用指數退避`** ([`public/js/api.js:22-48`](public/js/api.js#L22-L48)) — 離線狀態下的 poller 過去一夜會對失效伺服器發出 28,800 次 fetch。現改為 3 秒 → 6 秒 → 12 秒 → 24 秒 → 60 秒;首次 2xx 恢復後重置為 3 秒。設定採用 `setTimeout` 鏈(非 `setInterval`),確保每一步都能套用新的延遲。

- **`fix(client): M-5 — Safari 私密模式 localStorage 防護`** ([`public/js/lib/i18n.js:572-583`](public/js/lib/i18n.js#L572-L583)) — Safari 私密模式對任何 `localStorage.getItem/setItem` 呼叫都會拋出 `SecurityError`。載入期間的 IIFE 過去會讓整個 i18n 模組失敗,導致 SPA 渲染出原始鍵名。已將兩處呼叫包進 try/catch,並以 `detect()` 之瀏覽器語系作為後備。

- **`fix(server): M-2 — preview 外連 fetch 的回應大小上限(測試 + 驗證)`** — v1.21.0 的 `safeGet` 已實作分塊串流並依 `opts.maxBytes` 設限。v1.22 在 [`tests/ssrf-redirect-rebind.test.mjs`](tests/ssrf-redirect-rebind.test.mjs) 中新增明確的迴歸測試以鎖定契約:上游 100 KB + 4 KB 上限 → 回應 ≤ 4 KB。

- **`fix(client): L-5 — 在 scan.js 的 hashchange 時清除 setTimeout`** ([`public/js/views/scan.js:6-22, :113-120`](public/js/views/scan.js#L6-L22)) — 掃描完成後 300 ms 的 `refreshResults()` 計時器,過去在使用者於該時間窗離開 `#/scan` 時會洩漏。現於 `__cancelActiveScanPoll` 中捕捉並清除 handle。

- **`fix(client): L-4 — SSE 多行 data: 串接`** ([`public/js/lib/auto-pipeline.js:158-176`](public/js/lib/auto-pipeline.js#L158-L176)) — SSE 解析器原先使用 `match()`(單行)。依據規範,一個事件可帶多行 `data:`,消費端應以 `\n` 串接。伺服器目前送的是單行 JSON,所以舊程式碼可運作 — 但對未來任何多行 payload 都很脆弱。

### ♿ 無障礙

- **`feat(a11y): M-3 — WCAG 1.4.1 score pill 與連線橫幅的冗餘提示`** ([`public/css/app.css:602-625, :812-822`](public/css/app.css#L602-L625)) — score-high / score-mid / score-low 過去僅以色相(紅 / 琥珀 / 綠)傳達狀態。無法辨識色相的使用者沒有任何後備。各層級現在透過 `::before` 取得冗餘字符(✓ / ◐ / ○)。連線橫幅在離線狀態取得前置 `⚠` 字符。渲染端不動 — 純 CSS 強化。

- **`feat(a11y): M-1 — 每個 mode-page 欄位的行內提示段落`** ([`public/js/views/mode-page.js`](public/js/views/mode-page.js)、[`public/js/lib/i18n.js`](public/js/lib/i18n.js)) — v1.20.0 為每個 mode-page 欄位接好了 `htmlFor → id`,但未帶入行內提示文案;僅 README walkthroughs 文件說明了各欄位用途。v1.22.0 新增 19 個提示 i18n 鍵 × 8 locale = **152 條新翻譯**,並讓 `field()` builder 為每個欄位渲染一個 `<p id="…-hint">` 並串接 `aria-describedby`。螢幕閱讀器使用者在 input 取得焦點時即可聽見提示。

- **`fix(a11y): M-7 — UI.el() htmlFor 別名的 null 防護`** ([`public/js/api.js:194-198`](public/js/api.js#L194-L198)) — `htmlFor: null` 過去會渲染出字面 `for="null"`。一行式地對齊 fallthrough 分支的 `v != null && v !== false` 防護。

### 🧹 品質 / 可攜性

- **`fix(server): L-1 — health.mjs + bin/start.sh + bin/setup.sh 的 parseInt 加上 radix`** — `parseInt(process.versions.node)` 沒帶 radix 會觸發 lint 警告,並在 Node 若改以十六進位版本號發布時變脆。各處統一補上 `10`。

- **`fix(server): L-3 — Windows 友善的進入點檢查`** ([`server/index.mjs:159-163`](server/index.mjs#L159-L163)) — `import.meta.url === \`file://${process.argv[1]}\`` 在 Windows 上會錯誤處理磁碟機代號與反斜線。改為 `fileURLToPath(import.meta.url) === path.resolve(process.argv[1])`。

- **`refactor(client): N-2 — 移除 Element.prototype.also monkey-patch`** ([`public/js/views/cv.js:188-201`](public/js/views/cv.js#L188-L201)) — 屬於全域 DOM 原型污染。改以區域變數承接樹根。

- **`test(canary): M-8 — 退役 /api/scan-ru/config 的 404 迴歸測試`** ([`tests/scan-consolidated.test.mjs`](tests/scan-consolidated.test.mjs)) — v1.20.0 退役該別名但未加 canary。三行式新增,鏡像 v1.18 的退役測試。

### 📚 文件 + 系統提示

- **`docs(architecture): 為 v1.21+ 介面刷新 OVERVIEW + DATA-FLOWS`** — 於 OVERVIEW.md 中加入 `safe-fetch.mjs`(DNS-pinned GET)、`file-lock.mjs`(per-path mutex)、`rate-limit.mjs`(LLM 節流)與 `sanitizePathName`。DATA-FLOWS.md 新增兩節:「Outbound URL fetches (DNS-rebind-safe)」與「LLM endpoint rate-limiting」。

- **`docs(readme): 安全範圍說明刷新`** — README.md 的「Security notes」現在記載 v1.21+ 安全範圍中的每個 helper(sanitizePathName、safeGet、withFileLock、llmRateLimit、entity-aware stripDangerousMarkdown)。

- **`docs(qa): 場景 31 — career-ops.org/docs 對齊`** ([`qa/claude-cowork-browser-test-prompt.md`](qa/claude-cowork-browser-test-prompt.md)) — 六個新子測試(31.1–31.6)用以驗證 UI 行為與五份規範 career-ops.org/docs 指南一致:score thresholds、scan workflow(單一按鈕)、apply workflow(checklist,而非自動送出)、batch workflow(TSV 編輯器)、Playwright 設定(優雅失敗)、help-bundle 覆蓋率(5 個 URL × 8 個 locale)。

- **`docs(translate): README 品質刷新 × 7 個非英文 locale`** — 每個非英文 README 都以該語言之出版品級技術風格重寫。替換常見生硬計算式翻譯;補入 v1.21 / v1.22 安全範圍說明;發布與測試徽章同步更新。

- **`docs(system): .claude/PROJECT-CONTEXT.md + .github/copilot-instructions.md`** — 給加入工作階段的 agent 的單檔定位資料。壓縮的 CLAUDE.md,點名 v1.21+ helper,列出常見陷阱。

- **`docs(bin): 更新 start.sh / setup.sh / run_all.sh 註解`** — 「two deps」→「three deps」(express + js-yaml + multer);「298 tests」→「474+ tests」;`parseInt` 補上 radix。

### 🧪 測試

- **461 → 474 個單元測試**(+13)+ 32/32 Playwright 不變。
- 新測試檔案:`cv-xss-bypasses.test.mjs`(M-4,11 個測試)。
- 延伸:`ssrf-redirect-rebind.test.mjs`(+1 對應 M-2 body cap)、`scan-consolidated.test.mjs`(+1 對應 M-8 alias canary)。
- 既有套件零行為差異 — 每個修復都是 additive 或由新 canary 覆蓋。

### 驗證

```bash
npm test                          # 474 / 474
npm run test:e2e:browser          # 32 / 32

# 實體編碼 XSS strip:
node -e "import('./server/lib/security.mjs').then(({stripDangerousMarkdown}) => console.log(stripDangerousMarkdown('&lt;script&gt;alert(1)&lt;/script&gt;')))"
# → '' (no <script> survives)

# 健康檢查退避(打開 devtools,kill 伺服器,觀察 network panel):
#   3 秒 → 6 秒 → 12 秒 → 24 秒 → 60 秒,首次成功 ping 後重置

# Score-pill 字符(在淺色 + 深色主題下開啟 #/reports):
#   .score-high 顯示 ✓ + 數值分數
#   .score-mid  顯示 ◐ + 數值分數
#   .score-low  顯示 ○ + 數值分數

# Mode-page 提示(#/contacto 等):
#   <input aria-describedby="mode-contacto-recipient-hint">  ← 指向 <p id="…">

# 退役別名:
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/scan-ru/config
# → 404
```

### 破壞性變更

無。所有修復皆為 additive 或保留既有端點契約。

### 範圍外(v1.23+)

| 項目 | 說明 |
|---|---|
| M-9 — locale CHANGELOG 內文翻譯 | 所有 `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` 自 v1.13+ 的條目皆為英文內文的權宜方案。在發布節奏放緩後可作為批次翻譯候選。 |
| N-1 — `public/js/lib/i18n.js` 超過 400 LOC 目標 | 依 locale 拆分會在沒有 bundler 的情況下增加 HTTP 成本。延後到 build-step 決策落定為止。 |
| 由 career-ops.org/docs 刷新 help-bundle 內容 | 五個規範 URL 自 v1.11.x 起已出現在每個 locale 的 help bundle。QA prompt 的場景 31.6 會驗證覆蓋率。內容深度刷新為 v1.23 候選。 |

---

## [1.21.0] — 2026-05-14

**安全性 + 並行性 + 無障礙拋光,來自兩次獨立的程式碼審查。** [`docs/specs/V1.20.1-BACKLOG.md`](docs/specs/V1.20.1-BACKLOG.md) 中的七項發現於一次發布中交付:一個 blocker(DNS-rebind TOCTOU)、六個 high-severity 缺陷(路徑遍歷淨化散落、LAN 部署的速率限制缺口、並行寫入競爭條件、i18n 覆蓋率破口、懸空的 aria-describedby、標籤關聯缺失)。34 個新測試;基準從 427 → 461 個單元測試 + 32/32 Playwright。每項修復都搭配命名迴歸測試。

### 🛡️ 安全性

- **`fix(security): B-1 — 透過 safe-fetch.mjs 關閉 DNS-rebind TOCTOU`** ([`server/lib/safe-fetch.mjs`](server/lib/safe-fetch.mjs)) — 先前模式是先做一次明確的 `dnsLookup` 驗證,再讓 `fetch()` 自行做獨立查詢。具有 TTL=0 的 DNS rebind 攻擊者可在查詢 1 回傳公開 IP,在查詢 2 回傳 `127.0.0.1` / `169.254.169.254` / LAN 位址,藉此繞過 `isPrivateOrLoopbackHost`。新的 `safeGet` 只解析一次,透過 node:http(s) 將 TCP 連線釘到該確切 IP,並設定 SNI/Host 讓憑證驗證仍對準原主機名。由 `/api/pipeline/preview` 與 `/api/auto-pipeline` 使用。查詢失敗時 fail-CLOSED(反轉先前的 `try { … } catch { /* fall through */ }`)。由 [`tests/ssrf-redirect-rebind.test.mjs`](tests/ssrf-redirect-rebind.test.mjs) 中 8 個新測試驗證。

- **`fix(security): H-4 — 跨 10 條路由整合 sanitizePathName`** ([`server/lib/security.mjs`](server/lib/security.mjs)) — 裸的 `replace(/[^\w\-.]/g, '')` 正規表達式重複出現在 `jds.mjs`、`content.mjs`、`reports.mjs`、`llm.mjs`、`runners.mjs` 中,而且保留了 `.` 字元,所以 `..pdf`、`....md`、開頭點號的名稱都能存活。只有 `reports.mjs::sanitizeSlug` 做對。v1.21.0 將正確版本(`sanitizePathName`)提升至 `security.mjs`,刪除 10 處損壞副本,並對空結果以 400 拒絕。由 [`tests/path-traversal.test.mjs`](tests/path-traversal.test.mjs) 中 12 個測試驗證。

- **`fix(security): H-5 — 公開繫結時對 LLM 端點施加速率限制`** ([`server/lib/rate-limit.mjs`](server/lib/rate-limit.mjs)) — `/api/evaluate`、`/api/deep`、`/api/mode/:slug`、`/api/auto-pipeline` 之前沒有 per-IP 節流。Loopback 使用者不受影響;LAN 暴露的部署(`HOST=0.0.0.0`)得到 10 req/min/IP,過載時帶 `Retry-After` 與 `X-RateLimit-*` 標頭。可透過 `LLM_RATE_LIMIT="N/Ws"` 設定。在 v2.0 P-12 認證閘到位之前的廉價過渡防禦。由 [`tests/rate-limit.test.mjs`](tests/rate-limit.test.mjs) 中 6 個測試驗證。

### 🔒 並行性

- **`fix(data): H-6 — applications.md / pipeline.md 採用 per-file mutex`** ([`server/lib/file-lock.mjs`](server/lib/file-lock.mjs)) — 並行的 `POST /api/tracker`(或 auto-pipeline 與手動新增競賽)過去會同時讀到 `num=42`,雙方都寫入 `num=43`,並無聲丟失較早那筆。`withFileLock(path, fn)` 依路徑序列化 read-modify-write;不同路徑仍可並行。已接入 `tracker.mjs`、`pipeline.mjs`(POST + DELETE),以及 `auto-pipeline.mjs` 的 tracker 步驟。由 [`tests/concurrent-tracker-write.test.mjs`](tests/concurrent-tracker-write.test.mjs) 中 5 個測試驗證,包含一個 20-concurrent-POST 整合檢查,斷言 001..020 列依序落地。

### ♿ 無障礙

- **`fix(a11y): H-1 — batch.js 的提示段落補上 id="batch-tsv-hint"`** ([`public/js/views/batch.js`](public/js/views/batch.js)) — v1.20.0 為 TSV textarea 加上了 `aria-describedby="batch-tsv-hint"`,但提示 `<p>` 從未獲得對應的 `id`。螢幕閱讀器沒有任何內容可朗讀。已修正。

- **`fix(a11y): H-2 — batch-parallel / batch-min-score 標籤的 htmlFor`** ([`public/js/views/batch.js`](public/js/views/batch.js)) — v1.20.0 的四個 input 得到新 id,但其 label 未以程式方式關聯。WCAG 3.3.2 現已滿足。

- 於 [`tests/a11y-form-wires.test.mjs`](tests/a11y-form-wires.test.mjs) 中新增靜態分析 canary — 走訪每個 view 檔案,斷言每個 `aria-describedby` / `htmlFor` IDREF 都指向同層級的 `id:` 宣告。可在 CI 階段攔截錯字型迴歸。

### 🌐 i18n

- **`fix(i18n): H-3 — v1.20.0 的 13 個鍵在 7 個 locale 中無聲 fallback 至英文`** ([`public/js/lib/i18n.js`](public/js/lib/i18n.js)) — `pipe.filter`、`pipe.count`、`pipe.preview*`、`pipe.openTab`、`pipe.evaluateAll*`、`eval.jdHint`、`batch.parallelAria`、`batch.minScoreAria`,以及 `common.delete`、`config.group{Core,Runtime,Regional}`、`config.profileEmpty`、`config.viewProfile`、`scan.atsBadge`、`scan.regionalBadge` 是透過 `t('key', 'EN fallback')` 引用,卻從未加入 DICT。俄文、日文、中文螢幕閱讀器使用者聽到的是英文 `aria-label` — 直接抵銷了 v1.20.0 宣稱的 WCAG 3.3.2 勝利。v1.21.0 補齊全部 19 個鍵 × 8 個 locale(約 150 條新翻譯),並延伸 [`tests/i18n-coverage.test.mjs`](tests/i18n-coverage.test.mjs):新增的靜態分析 pass 會掃描 `public/js/**/*.js` 內每個 `t('key', …)` 呼叫,斷言每個鍵都存在於 DICT。未來的漂移將於 CI 階段攔截。

### 🧪 測試

- **427 → 461 個單元測試**(+34)+ 32/32 Playwright 不變。
- 新測試檔案:`ssrf-redirect-rebind`、`path-traversal`、`concurrent-tracker-write`、`rate-limit`、`a11y-form-wires`。
- 既有 `pipeline-preview.test.mjs` 從 `globalThis.fetch` mock 改接 `safe-fetch.mjs` 中新的 `_setTransport` 注入點 — SSRF 路徑不再走 fetch,所以舊 mock 早就被無聲繞過。

### 驗證

```bash
npm test                              # 461 / 461
npm run test:e2e:browser              # 32 / 32
node --test tests/ssrf-redirect-rebind.test.mjs tests/path-traversal.test.mjs \
  tests/concurrent-tracker-write.test.mjs tests/rate-limit.test.mjs \
  tests/a11y-form-wires.test.mjs      # 34 個新測試全綠

# 路徑遍歷:所有 traversal 形式的 :name 都回傳 400 / 404
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/jds/..pdf
# → 400

# 公開繫結下的速率限制:
HOST=0.0.0.0 LLM_RATE_LIMIT=3/60s npm start &
for i in 1 2 3 4; do
  curl -sS -o /dev/null -w '%{http_code} ' -X POST -H 'Content-Type: application/json' \
    -d '{"jd":"…"}' http://0.0.0.0:4317/api/evaluate
done
# → 200 200 200 429

# 並行 tracker 寫入:20 個 parallel POST,20 列落地:
node tests/concurrent-tracker-write.test.mjs
# 20 個依序排列的 001..020 列

# Aria wires 健全性:
grep -r 'aria-describedby' public/js/views/ | wc -l
# 對應的 `id:` 查找全部解析(a11y-form-wires.test.mjs canary)
```

### 範圍外(v1.22+)

| 項目 | 說明 |
|---|---|
| `pipeline-preview` body-size streaming 上限 (M-2) | `await upstream.text()` 在 8 KB 切片前讀入整個 body;惡意 1 GB 串流可能耗盡記憶體。需 stream-read 加 byte counter + abort。 |
| WCAG 1.4.1 — `.connection-banner` 與 score pill 的純色狀態 (M-3) | 僅以色相傳達狀態;新增圖示前綴(✓ / ◐ / ○)或文字後綴。 |
| `stripDangerousMarkdown` 透過 HTML 實體繞過 (M-4) | `&lt;script&gt;`、`java&#115;cript:`、`<img src="data:image/svg+xml,<svg onload=…>">` 仍可通過正規表達式。透過 UI.md 的深度防禦仍成立;以測試掃描方式記錄並鎖定繞過。 |
| Safari 私密模式 `localStorage` 存取未加 try/catch (M-5) | `i18n.js:544/571` 拋例外 → SPA 渲染原始鍵名。以 try/catch 包覆並以 `'en'` 為預設。 |
| `setInterval(checkHealth, 3000)` 永遠輪詢且無退避 (M-6) | 指數 3 秒 → 6 秒 → 12 秒 → 上限 60 秒。 |
| `htmlFor` 別名缺少 null 防護 (M-7) | 一行 `if (v != null && v !== false)` 防禦。 |
| 退役 `/api/scan-ru/config` 的 404 canary (M-8) | 三行測試,鏡像 v1.18 先例。 |
| Locale CHANGELOG 內文翻譯 (M-9) | 在發布節奏放緩後可作為批次翻譯候選。 |
| 每個 mode-page 欄位的行內提示段落 (M-1) | 約 168 個 i18n 鍵 × 8 個 locale;暫列為 polish 項目。 |
| L-1 至 L-5 nits | parseInt radix、bash --noprofile、Windows-safe fileURLToPath、多行 SSE、scan.js 計時器清理。 |

---

## [1.20.0] — 2026-05-13

**逐元件無障礙拋光 + 非英文 README 對等 + 退役 `/api/scan-ru/config` 別名。** 關閉 v1.19.0「Out of scope」表中為 v1.20 標記的四項。

### ♿ WCAG 2.5.5 / 2.5.8 — 逐元件觸控目標稽核

- **`a11y(touch-target): chip min-height 28 px + 8 px gap(2.5.8 spaced-target 例外)`** — `.chip` 過去為 24 × ~50 px(垂直 24,高度未達 2.5.5 之 24 px 群集控件底線);2.5.8 的 spaced-target 例外要求 ≥ 24 × 24 px 或 24 px 間距其一。將 `.chip` 調為 `min-height: 28px; padding: 6px 12px;`,並把外層 `.chip-row` 調為 `gap: 8px;`,使兩個條件同時成立。
- **`a11y(touch-target): sidebar nav-item min-height 44 px`** — `.nav-item` 之前 padding 僅 `10px 14px`,在多數 viewport 下計算高度約 36 px。現為 `padding: 12px 14px; min-height: 44px; box-sizing: border-box;`,與 `.btn` 底線一致。
- **`a11y(touch-target): tab-btn min-height 44 px`** — Reports、Tracker、Scan 結果裡的 Sortable Headers / 類別頁籤同樣處理。

### ♿ WCAG 1.3.1 / 3.3.2 — 行內表單提示的 `aria-describedby`

SPA 中每個表單控件現在都擁有穩定 `id`,其 `<label>` 透過 `htmlFor` 指向它,任何行內提示段落都以 `aria-describedby` 關聯。五個 view 檔案完成接線:

- **`a11y(forms): config.js`** — 每個鍵的 `id` + 提示關聯(`cfg-<key>` / `cfg-<key>-hint`)。
- **`a11y(forms): evaluate.js`** — `eval-jd` textarea 與 `eval-jd-hint` 段落,說明淨化後 50 字元最小限制。
- **`a11y(forms): batch.js`** — `batch-tsv` / `batch-tsv-hint`,並為 `batch-parallel`、`batch-min-score`、`batch-dry-run`、`batch-retry` 補上 `aria-label`。
- **`a11y(forms): pipeline.js`** — `pipe-filter` 與 `pipe-new-url` / `pipe-new-url-hint`。
- **`a11y(forms): mode-page.js`** — 7 個 generic mode(`project`、`training`、`followup`、`batch-prompt`、`contacto`、`interview-prep`、`patterns`)中每個欄位皆取得 `mode-<slug>-<name>` id 與 `htmlFor` label。

`UI.el()` 學會了 React 風格的 `htmlFor` 別名,讓 view 程式碼保持宣告式 — 它會設定底層 `for` 屬性(在 JS 中 `for` 為保留字無法作為 property 名稱)。

### 🌍 非英文 README 對等

- **`docs(readme): 將 7 個 locale 翻譯至與英文主版 585 列對等`** — `README.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md` 過去為 306–316 列(涵蓋標題但略過行銷重的 walkthrough 與大部分 API 參考)。七個版本現在端對端鏡像英文結構:About → One-command install → Why? → Quick start(3 步驟) → Requirements → What you get 表格 → Scan → Architecture(完整目錄樹) → API reference(每條路由表) → Tests → Configuration → Security notes → Limitations → Contributing → 🌍 Getting Started 5 步驟 walkthrough → License。

### 🧹 `/api/scan-ru/config` 別名退役

- **`feat!(scan): 移除 /api/scan-ru/config 舊別名(於 v1.20 sunset)`** — v1.19 中以單次發布之向後相容別名保留。規範路徑 `/api/scan/regional/config` 現為唯一路徑。移除:`server/lib/routes/scan.mjs` 的路由註冊、`README.md` 與 `docs/architecture/{OVERVIEW,SERVER,API}.md` 中的文件引用。測試已涵蓋規範路徑,毋需異動。

### 🧪 測試

- 與 v1.19 套件相同。**427 / 427** 單元 + 20/20 smoke + 23/23 comprehensive + 32/32 Playwright。所有無障礙接線皆為 additive(更多 `id` / `for` / `aria-describedby` 屬性) — 無行為變動,無測試差異。

### 驗證

```bash
npm test                              # 427 / 427
npm run test:e2e:browser              # 32 / 32

# 觸控目標 — 每個 chip / nav-item / tab-btn ≥ 28 / 44 / 44 px:
#   Chrome DevTools → Computed → 對 .chip、.nav-item、.tab-btn 檢視 height/min-height

# 表單標籤 — 每個 input 都有 label[for=…] 關聯:
#   document.querySelectorAll('input,textarea,select').forEach(el =>
#     console.assert(el.labels?.length || el.getAttribute('aria-label'), el))

# 別名已退役:
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4317/api/scan-ru/config
# → 404

# 規範路徑仍可用:
curl -s http://127.0.0.1:4317/api/scan/regional/config | jq '.'
```

### 破壞性變更

- `DELETE /api/scan-ru/config` — 已移除。改用 `/api/scan/regional/config`。已在 v1.19.0 的 CHANGELOG 與驗證腳本中宣告 sunset。

### 範圍外(v1.21+)

| 項目 | 說明 |
|---|---|
| 每個 mode-page 欄位的行內提示段落 | 目前僅 `<label for=…>` 關聯就位;可見的逐欄位提示文案在 SPA 仍只有英文。README walkthrough 已以各 locale 說明欄位用途,故此為 polish 而非 blocker。 |
| `.connection-banner` 與儀表板 score pill 的純色狀態(WCAG 1.4.1) | 橫幅僅靠紅 / 琥珀 / 綠;需為無法辨識色相者新增圖示或文字後綴。 |
| Locale 特定的 CHANGELOG 內文翻譯 | 英文內文之權宜方案仍存在於 `CHANGELOG.{es,pt-BR,ko-KR,ja,ru,zh-CN,zh-TW}.md`。等 v1.x 發布節奏放緩後再翻譯。 |

---

## [1.19.0] — 2026-05-13

**WCAG 1.4.3 對比 + scan 整合(最終) + UI 移除 HH_USER_AGENT。** 關閉 v1.18 範圍外的對比稽核,結束 v1.18 啟動的 EN/RU 拆分剷除,並依使用者指示將 `HH_USER_AGENT` 設定旋鈕從 UI 移除(伺服器內建合理預設值,可滿足非俄羅斯 IP 的多數使用者)。

### ♿ WCAG 1.4.3 對比 pass

- **`a11y(contrast): 為 accent token 引入符合 AA 的 *-text 變體`** — 淺色主題:`--rausch-text: #b80f42`(白底 6.59:1,原本 3.52:1)、`--kazan-text: #066507`(7.31:1,原本 4.53:1)、`--darjeeling-text: #7a5800`(琥珀底 5.73:1,原本 4.24:1)、`--babu-text: #00665e`(6.09:1,原本 2.70:1)。深色主題:亮化鏡像(`#ff8aa0`、`#6ee7b7`、`#fcd34d`、`#5eead4`)在 `#161a22` 紙底達到同樣 4.5:1 底線。
- 徽章類別(`.badge-ok`、`.badge-warn`、`.badge-bad`、`.badge-info`)與 score pill(`.score-high`、`.score-mid`、`.score-low`)現在都走新的 `*-text` 變體 — 每組文字+著色底的組合都過 AA。Accent 填充 token(`--rausch`、`--kazan` 等)保留不動,用於邊框與輪廓(非文字 UI 元件僅需 3:1)。

### 🧹 Scan 整合(完成 v1.18 工作)

- **`docs(scan): 跨 README + help + architecture 文件清除 EN/RU 拆分殘留`** — 八個 README + 八個 help bundle + 三份 architecture 文件(API.md、SERVER.md、OVERVIEW.md、DATA-FLOWS.md)+ scan.js 註解,現在皆描述單一整合的掃描方法。舊 `/api/stream/scan-{en,ru}` 別名已於 v1.18 移除;v1.19 處理那些仍以兩步 EN+RU 描述掃描的文件與文案。
- **`feat(scan): 規範 /api/scan/regional/config 端點`** — `/api/scan-ru/config` 作為薄別名保留一個版本以維持向後相容。新路徑符合來源命名約定(`?source=regional`)。

### 🛠️ UI 移除 HH_USER_AGENT

- **`feat!(config): 從 /#/config + KNOWN_KEYS 移除 HH_USER_AGENT 欄位`** — 進階使用者仍可直接在 `career-ops/.env` 中設定 `HH_USER_AGENT`(伺服器於 `server/lib/sources/hh.mjs` 透過 `process.env.HH_USER_AGENT` 讀取,並以內建 UA 為後備)。UI 不再揭露此欄位,因為預設值已可滿足多數使用者,而 App Settings 頁面上的神秘 User-Agent 欄位是長期混淆來源。
- 跨 8 個 locale 的 README 與 help bundle 中,相關提及已替換為「透過俄羅斯 IP / VPN 執行」之建議。`scan.hhWarning` i18n 鍵已改寫,移除 env-var 設定細節。
- `KEY_GROUPS` 收斂:不再有 `regional` 分類(原本只含 HH_USER_AGENT)。測試已更新;`regionalActive` payload 欄位保留以維持 SPA 向後相容。

### 🧪 測試

- `tests/env-config.test.mjs` — `KNOWN_KEYS` 斷言現在排除 HH_USER_AGENT;新增斷言確保該鍵是刻意缺席。
- `tests/config-endpoint.test.mjs` — POST-write 多鍵測試改用 `GEMINI_MODEL` 作為第二個已知鍵(取代 HH_USER_AGENT)。
- `tests/config-groups.test.mjs` — `groups.HH_USER_AGENT` 現在期望為 `undefined`。
- 總計:**427 / 427** 單元 + 20/20 smoke E2E + 23/23 comprehensive E2E + 32/32 Playwright。計數與 v1.18.0 相同,因為每個調整過的測試早已計入。

### 驗證

```bash
npm test                              # 427 / 427

# 對比(Chrome DevTools 或 axe)於淺色 + 深色:
#   .badge-ok / .badge-warn / .badge-bad / .badge-info → AA 通過(4.5:1+)
#   .score-high / .score-mid / .score-low → AA 通過

# /api/config 不再含 HH_USER_AGENT:
curl -s http://127.0.0.1:4317/api/config | jq '.values | keys'
# → ["ANTHROPIC_API_KEY","ANTHROPIC_MODEL","GEMINI_API_KEY","GEMINI_MODEL","HOST","PORT"]
# (沒有 HH_USER_AGENT)

# 規範 regional config 端點:
curl -s http://127.0.0.1:4317/api/scan/regional/config | jq '.'
# 舊別名於 v1.20 前仍存活:
curl -s http://127.0.0.1:4317/api/scan-ru/config | jq '.'
```

### 範圍外(v1.20+)

| 項目 | 說明 |
|---|---|
| 逐元件觸控目標稽核(filter chips、sortable headers、sidebar nav) | v1.18 設定了全域底線(`.btn` 44 px、`.btn-sm` 32 px);跨 SPA 的逐元件驗證仍待辦。 |
| 行內表單提示的 `aria-describedby`(`#/config`、`#/pipeline`、`#/evaluate`、`#/batch`) | v1.17 覆蓋了全域搜尋 + modal 關閉的 `aria-label`。逐欄位的提示關聯為下一層拋光。 |
| 完整非英文 README 對等(像英文一樣 585 列) | v1.18 將非英文提升至約 307(英文 53 %)。行銷重的「Quick start」+「🌍 Getting Started」walkthrough 仍僅英文。 |
| 移除 `/api/scan-ru/config` 舊別名 | sunset 計畫於 v1.20。規範 `/api/scan/regional/config` 為遷移目標。 |

---

## [1.18.0] — 2026-05-13

**Scan 端點整合 + WCAG 2.2 AA 通過 + i18n long-tail 收尾。** 退役舊版 `/api/stream/scan-{en,ru}` 別名(Sunset 視窗 2026-10-01 依使用者指示提前至 v1.18)。將非英文 README 帶到約 307 列,並於 6 個 locale 翻譯剩餘的 v1.16.0 + v1.17.0 RU 內文 CHANGELOG 條目。

### 🚪 破壞性變更

- **`feat!(scan): 退役 /api/stream/scan-{en,ru} 舊別名`** — 已棄用的 EN/RU 拆分 SSE 端點已移除。每個消費端皆透過整合的 `/api/stream/scan?source=ats|regional|both` 端點(自 v1.12.0 起上線)。舊路徑自 v1.15.0 起便帶 Deprecation + Sunset(RFC 8594)標頭;遷移視窗現已關閉。仍使用舊路徑的外部整合會得到乾淨的 **404**,而非被無聲導向 SPA catch-all。

### ♿ 無障礙(WCAG 2.2 AA 通過)

- **WCAG 2.4.1 Bypass Blocks** — 新的 **Skip to main content** 連結作為每頁第一個 focusable。透過 `.skip-link` 視覺隱藏,直到取得焦點;頁面載入後按 Tab 即彈至左上。
- **WCAG 2.4.7 Focus Visible** — 全域 `*:focus-visible` 樣式。滑鼠點擊焦點環關閉,鍵盤 Tab 焦點環開啟(WAI-ARIA AP 標準模式)。Modal 關閉(×)取得更高對比焦點環。
- **WCAG 2.5.5 Target Size** — `.skip-link` 最小 44×44 px 觸控目標。`.btn-sm` 保持 32 px min-height(結合列距,可符合 24×24 + 間距之 AAA 例外,用於緊湊表格列控件)。
- **WCAG 3.1.1 Language of Page** — `<html lang="en">` 自 `lang="ru"` 修正(JS i18n bootstrap 載入時已覆寫,但 SSR 預設現在與 SPA 預設 locale 一致)。
- **WCAG 1.3.1 Info & Relationships** — `#content` 取得 `tabindex="-1"`,使 skip-link 目標可乾淨聚焦。(ARIA roles + focus-trap 已在 v1.17 加入。)

### 📚 i18n long-tail

- **`docs(i18n): 於 6 個 locale 翻譯 v1.16.0 + v1.17.0 CHANGELOG`** — 過去在 `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` 中以 RU 內文呈現的條目,現以原生語言呈現。各 locale 的 RU 字元數從 79 → 42 → 23(剩 23 個是檔案路徑等技術行內參考,以及多 locale 標頭連結,屬刻意保留)。
- **`docs(readme): 以 Why / Requirements / Features / Configuration / Contributing 擴展非英文 README`** — 每個非英文 README 從 240 增長至約 307 列。現在涵蓋與 585 列英文版相同的非行銷段落。完整 1:1 對等(行銷重的 walkthrough 段落)仍延後。

### 🛠️ 雜項

- **`docs(api): 在 API.md + DATA-FLOWS.md + README.md 統一整合 scan 端點`** — API 參考表現在僅列出 `/api/stream/scan?source=…`。README 的 Scan 章節解釋 v1.18.0 對 EN/RU 拆分的退役。
- **`fix(scan.js): 移除有關舊別名仍存活的過期註解`** — SPA 的 runScanAll dispatcher 註解現在反映整合後的現實。

### 🧪 測試

- `tests/scan-consolidated.test.mjs::F-018 backwards compat` 已重寫 — 原本兩個「舊端點仍可用」斷言,現在驗證對 `/api/stream/scan-{en,ru}` 的請求回傳 **404**(而非被導向 SPA catch-all)。
- 總計:**427 / 427** 單元 + 20/20 smoke E2E + 23/23 comprehensive E2E + 32/32 Playwright(計數不變;+2 個新的「舊端點移除」斷言取代 +2 個「舊端點仍可用」斷言)。

### 驗證

```bash
npm test                              # 427 / 427
npm run test:e2e:full                 # 23 / 23

# 舊端點退役:
curl -sI http://127.0.0.1:4317/api/stream/scan-en | head -1   # → HTTP/1.1 404
curl -sI http://127.0.0.1:4317/api/stream/scan-ru | head -1   # → HTTP/1.1 404

# 整合端點:
curl -sN 'http://127.0.0.1:4317/api/stream/scan?source=ats&dryRun=1' | head -5
# → event: start
# → data: {"script":"en-scanner","writeFiles":false,…}

# Skip link(無障礙):
curl -s http://127.0.0.1:4317/ | grep -c 'class="skip-link"'  # → 1

# html lang fallback:
curl -s http://127.0.0.1:4317/ | grep -c 'html lang="en"'     # → 1
```

### 範圍外(v1.19+)

| 項目 | 說明 |
|---|---|
| 完整非英文 README 對等(像英文一樣 585 列) | v1.18 將非英文帶到約 307(英文 53 %)。行銷重的「Why?」/「Quick start」walkthrough 仍僅英文。 |
| 色彩對比稽核(WCAG 1.4.3 AA — 文字 4.5:1、大字 3:1) | v1.18 涵蓋結構性無障礙;跨淺色 + 深色色盤的逐 token 對比驗證仍待。 |
| 跨所有互動元素之觸控目標稽核 | v1.18 設定底線(`.btn`:44 px、`.btn-sm`:32 px);逐元件驗證(filter chips、sidebar nav、sortable headers)仍待。 |

---

## [1.17.0] — 2026-05-13

**拋光 + 無障礙 + CI 修復發布。** 關閉 v1.16.0 清單中 9 項後續:瀏覽器 smoke 驗證、README 徽章真實性、覆蓋率刷新、SPA 中 `lastWorkdayFallback` 呈現、完整 E2E 重新基線、Playwright auto-pipeline 場景、無障礙稽核通過、6 個 locale 中歷史 CHANGELOG 壓縮、以及帶 Architecture / API / Security / Tests 段落的非英文 README 擴展。

### 🐛 修復

- **`fix(e2e): smoke + comprehensive 套件重新對齊 v1.16 UX`** — v1.16 的 Cmd+K Enter → AutoPipeline modal 變動,使 e2e 測試的 `search.press('Enter')` 開啟一個 modal,其 backdrop 攔截後續點擊。測試現在使用 `Shift+Enter` 走舊版 quick-add 路徑,呼應 v1.16 記載的拆分。Comprehensive E2E 的 batch-mode iteration 也改用 `/#/batch-prompt`(v1.15 PR-H 引入的舊版 mode-prompt slug)。**這就是 v1.16.0 push 上的 CI 失敗** — Playwright e2e 在 backdrop 攔截的點擊上等待 30 秒逾時。
- **`fix(mode-page): batch-prompt 路由 → modes/batch.md 透過 serverSlug`** — v1.15 將舊版 mode slug 改名為 `batch-prompt`,但伺服器 `POST /api/mode/:slug` 之後在尋找不存在的 `modes/batch-prompt.md`。新 `serverSlug` 欄位將路由 hash 與父專案的 mode 檔名解耦。
- **`chore: 將 deprecation 訊息從 v1.16.0 升至 v1.17.0`** — scan-en/scan-ru deprecation 文案與 batch-prompt deprecation 橫幅引用了過去版本。

### ✨ 功能

- **`feat(scan): Active Companies 卡片中的 🔒 Workday CAPTCHA chip`** — v1.16 PR-7 的伺服器端 `lastWorkdayFallback` export 現在被 SPA 消費。`/api/scan-results` 回傳該 snapshot;當 Workday tenant 落入 fallback 時,`#/scan` 在 Active Companies 上方渲染警示色卡(「🔒 Workday tenant blocked — fallback: 使用 /career-ops scan (Playwright)」)。新 `getLastWorkdayFallback()` exporter 避免 ESM live-binding 模糊。2 個新 i18n 鍵 × 8 個 locale。

### ♿ 無障礙

- **`a11y: 對關鍵介面進行 ARIA roles + 焦點管理 pass`** —
  - `index.html`:`<aside>`(navigation)、`<header>`(banner)、`<section id="content">`(main)、`<div id="modal">`(帶 aria-modal/aria-labelledby 的 dialog)、`<div id="toast">` + `#conn-banner`(帶 aria-live 的 status)、`<div class="searchbar">`(search) 之 `role` 屬性。
  - `#sidebar-toggle` 取得 `aria-controls="sidebar"` 與由 JS 於 open/close 時同步的 `aria-expanded`。
  - `#global-search` 取得 visually-hidden `<label>` 加上明確 `aria-label`,後者揭露 Cmd+K 快捷鍵提示。
  - Modal 關閉(×)取得 `aria-label="Close dialog"`。
  - 裝飾性 backdrop 取得 `aria-hidden="true"`。
  - **Modal 焦點陷阱** — `UI.modal()` 記住點擊擁有者,於開啟時聚焦第一個非關閉的 focusable,並於 modal 內循環 Tab/Shift+Tab。`UI.closeModal()` 將焦點還給先前擁有者。
  - `public/css/app.css` 新增 `.visually-hidden` utility 類別(WAI-ARIA AP 標準模式)。

### 📚 文件

- **`docs(readme): 跨 8 個 README 的徽章真實性`** — tests 徽章 `284 / 379 / 360` → **427**;release 徽章 `v1.9.1 / v1.13.0` → **v1.16.0**,而後由 v1.17 bump → v1.17.0。Release 連結目標已更新。
- **`docs(readme): 以參考段落擴展 7 個非英文 README`** — 每個從 170 增長至約 240 列,以原生語言新增 Architecture / API reference / Security notes / Tests / A11y / Limitations / License 段落。尚未達 585 列完整對等,但涵蓋所有關鍵的非行銷介面。
- **`docs(changelog): 於 6 個 locale 壓縮 pre-v1.12 條目`** — 過去溢入非英文 / 非俄文 CHANGELOG 的長篇 RU 內文 v1.11.x + v1.10.x 條目,現以各 locale 原生語言之精簡「Earlier releases」執行摘要取代。詳細歷史保留於 `CHANGELOG.md`(英文)。

### 🛠️ 工具

- **`coverage: 刷新數字`** — 最後發布的數值為 95.46 % line / 84.06 % branch(v1.13.0 REVIEW)。v1.17 基線:**94.14 % line / 82.98 % branch / 93.20 % function**。auto-pipeline + reports-write 中新錯誤路徑導致輕微下降;仍遠高於 CLAUDE.md 的 80 % 下限。

### 🧪 測試

- 總計:**427 / 427** 單元 + 20/20 smoke E2E + 23/23 comprehensive E2E + **32 / 32** Playwright(原為 28;+4 個新 auto-pipeline 場景:按鈕開啟 modal、Cmd+K 貼上觸發 modal、無效 URL 阻擋步驟 1、`POST /api/auto-pipeline` SSE 事件 framing)。
- E2E 套件已與 v1.16.0 UX 重新對齊(Shift+Enter quick-add、`/#/batch-prompt` 走舊版 mode)。

### 驗證

```bash
# 本地端:
npm test                          # 427 / 427
npm run test:e2e                  # 20 / 20
npm run test:e2e:full             # 23 / 23
npm run test:e2e:browser          # 32 / 32

# 瀏覽器 smoke(頁面層級):
curl -s http://127.0.0.1:4317/api/scan-results | jq '.workdayFallback'
# 無 Workday fallback 時為 null;4xx 後為 {apiUrl, reason, at}。

# 無障礙抽查:
node -e "
const c = require('cheerio').load(require('fs').readFileSync('public/index.html','utf8'));
['banner','navigation','main','dialog','status','search'].forEach(r =>
  console.log(r, c('[role=' + r + ']').length));
"
# 每個 role 應出現 ≥1。

# CI gate 驗證:dashboard-screenshots workflow 啟動 /tmp scaffold,
# 重新產生 PNG,對 commit 結果比對 — 當 images/dashboard-*.png 與已渲染 SPA 同步時為綠。
```

### 範圍外(v1.18+)

| 項目 | 說明 |
|---|---|
| 翻譯非英文 CHANGELOG 中的 v1.16.0 條目 | 目前為 RU 內文(約 30 列 × 6 locale = 180 列)。在使用者明確的 v1.11.x/v1.10.x 範圍之外。 |
| 完整非英文 README 對等(像英文一樣 585 列) | v1.17 將非英文帶到約 240;行銷重的「Why?」/「Quick start」walkthrough 仍僅英文。 |
| 規範 A-F prompt 的父專案 commit | 仍需要 `santifer/career-ops::modes/oferta.md` 在上游重寫(CLAUDE.md 硬規則 #1)。 |
| 完整 WCAG 2.2 AA 稽核 | v1.17 涵蓋結構性 ARIA + 焦點陷阱;逐元件對比 / Tab 順序稽核仍待。 |

---

## [1.16.0] — 2026-05-13

**Auto-pipeline 收尾 + 適配器拋光 + i18n long-tail。** 關閉 v1.15.0 REVIEW 中 11 項後續:伺服器端 SSE auto-pipeline、`POST /api/reports` primitive、Cmd+K 快捷鍵、SmartRecruiters 分頁、Workday CAPTCHA-fallback、CI 截圖漂移閘、scan 來源篩選 UX、歷史 CHANGELOG 翻譯(v1.13.0/v1.12.0 × 6 locale)、非英文 README 擴展、以及一個 paste-ready 的 trending companies 匯入器。

### ✨ 功能

- **`feat(auto-pipeline): 伺服器端 SSE orchestrator`** (#1, #2, #3, #8) — v1.15 的客戶端鏈式 fetch orchestrator 已移除。`POST /api/auto-pipeline` 現在是一個可用 curl 呼叫的 SSE 端點,於伺服器端串接 validate → fetch JD → evaluate → save report → tracker,並帶即時 step 事件。慢速的 Anthropic 呼叫(30–90 秒)現在發出 `running` 事件而非通用 spinner。失敗時發出帶 `step` + `message` 的 `error`。orchestrator 也將 report markdown 持久化至父 `reports/<slug>.md`(v1.15 曾遺失此行為)。
- **`feat(reports): POST /api/reports primitive`** — `server/lib/routes/reports.mjs` 中的新 writer 端點。Slug 淨化帶路徑遍歷防護(去除前置點、收斂內部 `...`)。1 MB 上限(413)。`overwrite:true` 之外,既存檔案回傳 409。經 `stripDangerousMarkdown` XSS pass 進行 atomic write。記錄 activity.reports.save。測試:9 案例。
- **`feat(app): Cmd+K 貼上 URL → auto-pipeline`** — 在全域搜尋框貼上 URL + Enter,現在以 `autoStart=true` 開啟 AutoPipeline modal。Shift+Enter 保留舊版「只加入 pipeline」路徑。即 career-ops.org Quick Start §7「貼上 URL → 完成」之規範 UX。
- **`feat(portals): SmartRecruiters 分頁`** (#4) — `server/lib/sources/smartrecruiters.mjs` 透過 `?limit=100&offset=N` 逐頁走訪,直到達到 `totalFound`、回傳空頁、或觸發 30 頁 / 3000 jobs 安全上限。將呼叫端提供的 limit/offset 去除以讓 cursor 由伺服器掌控。大型 boards(Procter & Gamble、Amazon 風格)不再遺失尾端 100+ 筆 postings。測試:6 案例。
- **`feat(portals): Workday CAPTCHA-fallback 優雅化`** (#7) — `server/lib/sources/workday.mjs` 不再於 4xx / non-JSON / 網路錯誤時拋例外。回傳 `[]` 並於新匯出的 `lastWorkdayFallback` snapshot 中標註。掃描器時間線會繼續處理下一個 tenant。呼叫端可透過 `strict:true` 回到 v1.14 拋例外行為。測試:7 案例。

### 🛠️ 工具 + CI

- **`ci(workflows): dashboard-screenshots 漂移閘`** (#5) — 新增 `.github/workflows/dashboard-screenshots.yml`。當 PR 觸及 `public/css/app.css` / `public/js/views/dashboard.js` / `public/js/lib/i18n.js` / `public/index.html` 時,workflow 會在 /tmp scaffold 啟動 web-ui 伺服器,透過 Playwright + chromium 重新產生 8 張 hero PNG,並在結果與 commit 漂移時讓 build 失敗。失敗時將重新產生的 PNG 上傳為 CI artifact。
- **`feat(scripts): import-trending-companies.mjs`** (#11) — 透過真實 boards API 驗證 `docs/portals-examples.md` 中的 13 家 trending 公司,並輸出可貼入使用者父 `portals.yml::tracked_companies` 的 YAML。對 slug 404 的候選會打上 `enabled: false`。同時對所有 6 個 ATS 進行 live probe(Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday)。透過 `npm run import:trending` 執行。
- **`feat(scripts): npm run capture:dashboards`** — 將 `scripts/capture-dashboard-screenshots.mjs` 公開為頂層 script(先前僅在 `images/README.md` 文件化)。

### 🎨 UX

- **`fix(scan): 整合的來源篩選下拉選單`** (#6) — `#/scan` 來源下拉選單以 v1.14 adapter registry 重建:6 個 ATS + hh.ru + Habr Career,字母順序,無 geo-tag 前綴。`runEnScan` / `runRuScan` 現在打整合的 `/api/stream/scan?source={ats,regional}` 端點,而非已棄用的 `/api/stream/scan-{en,ru}` 別名(Sunset 標頭於 v1.16 內仍存活)。

### 📚 i18n long-tail

- **`docs(i18n): 於 6 個 locale 翻譯 v1.13.0 + v1.12.0 CHANGELOG`** (#9) — 過去在 `CHANGELOG.{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` 中以 RU 內文呈現的條目,現以實際 locale 呈現。每個非英文 / 非俄文 CHANGELOG 也新增 i18n 註記,說明 pre-v1.12 條目按專案慣例保留 RU(規範文字位於 `CHANGELOG.md`)。
- **`docs: 以 v1.16.0 highlights 段落擴展非英文 README`** (#10) — 6 個非英文 README(es / pt-BR / ko-KR / ja / ru / zh-CN / zh-TW)新增約 35 列段落,涵蓋:auto-pipeline 一鍵流程 + curl 範例、SmartRecruiters 分頁、Workday fallback、scan 來源篩選 UX、匯入器腳本、CI 截圖 workflow。RU README 也同步擴展。

### 🧪 測試

- 新 `tests/reports-write.test.mjs`(9 案例) — happy path、slug 淨化(含路徑遍歷防護)、409 衝突、覆寫旗標、XSS strip、欄位缺失 400、>1 MB 413、GET/POST round-trip。
- 新 `tests/auto-pipeline.test.mjs`(5 案例) — SSE framing、無效 URL 阻擋、SSRF/loopback 阻擋、無 LLM key 錯誤路徑、`text/event-stream` Content-Type 標頭。
- 新 `tests/smartrecruiters-pagination.test.mjs`(6 案例) — 單頁、3 頁、空頁提早停止、硬上限遵守、query 去除、503 拋出。
- 新 `tests/workday-fallback.test.mjs`(7 案例) — happy path、403/429 優雅、non-JSON body、網路錯誤、對 4xx 與網路錯誤的 strict opt-in。
- 總計:**427 / 427** 單元(原 400;+27 淨)。0 失敗。28/28 Playwright + 23/23 comprehensive E2E + 20/20 smoke E2E 自 v1.15.0 基線起綠。

### 範圍外(v1.17+)

| 項目 | 說明 |
|---|---|
| 規範 A-F prompt 的父專案 commit | 仍待上游 `santifer/career-ops::modes/oferta.md` 重寫(CLAUDE.md 硬規則 #1)。 |
| 翻譯 pre-v1.12 CHANGELOG 條目(v1.11.x、v1.10.x) | 慣例保留:RU 內文。回填約需 1800 列翻譯;延後。 |
| 完整非英文 README 對等(像英文一樣 585 列) | v1.16 每 locale 新增約 35 列;完整對等為獨立工程。 |
| 伺服器端 `runEnScan` 讀取 Workday fallback 註記以渲染 🔒 chip | `lastWorkdayFallback` export 已接線;SPA 的 Active Companies 卡片於 v1.17+ 消費。 |

### 驗證

```bash
npm test                          # 427 / 427
npm run test:e2e:full             # 23 / 23
npm run import:trending --check-only   # probe 13 個 trending boards

# Auto-pipeline curl smoke:
curl -N -X POST http://127.0.0.1:4317/api/auto-pipeline \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/4567"}'

# POST /api/reports round-trip:
curl -X POST http://127.0.0.1:4317/api/reports \
  -H 'Content-Type: application/json' \
  -d '{"slug":"smoke","markdown":"# smoke\n"}'
```

---

## [1.15.0] — 2026-05-13

**Doc-conformance 發布。** 關閉 conformance 稽核(`qa/conformance-vs-docs/00-CONFORMANCE-REPORT.md`)中尚未關閉的 10 項中之 9 項,再加上本地化 hero 圖。讓 UI 與 career-ops.org/docs 規範工作流一致 — CLI 承諾的同一條 pipeline 現在於每個 locale 都可端對端透過瀏覽器運作。

### ✨ 功能

- **`feat(auto-pipeline): PR-C — 一鍵「貼上 URL → report + PDF + tracker 列」`** (G-007)
  對齊 career-ops.org 規範承諾。v1.15 之前,使用者要跨 /#/pipeline → /#/evaluate → /#/cv → /#/tracker 做 5 次手動點擊。現在 /#/dashboard 上的一顆 ✨ 按鈕串接:validate URL → fetch JD(SSRF-safe) → evaluate against CV → generate PDF → 新增 tracker 列。渲染逐步 modal 時間線,每步 [✓]/[…]/[✗]。從 JD 首列做啟發式公司 / role 擷取。score + legitimacy 透過 regex 從評估 markdown 擷取。新檔案:`public/js/lib/auto-pipeline.js`。19 個新 i18n 鍵 × 8 個 locale。
- **`feat(modes): PR-D — modes/_profile.md 編輯器以 #/config → Modes 頁籤呈現`** (G-008)
  Quick Start §Step-5 的規範「Career framing」檔案先前對 UI 使用者不可見。現於 /#/config 新增「Modes」頁籤,並於 /#/profile 提供可被發現的卡片。新端點:`GET/PUT /api/modes/_profile`,256 KB 上限、`stripDangerousMarkdown` XSS pass、首次讀取時以 `_profile.template.md` scaffold。9 個新 i18n 鍵 × 8 個 locale。
- **`feat(profile): PR-E — 接受規範 schema;新增 location + headline`** (G-009)
  `/api/profile` 現同時接受舊版(`candidate:{...}`)與規範(top-level `full_name`、`narrative.headline`、`target_roles.primary`、`compensation.target_range`)schema。兩者同時存在時舊版優先,讓既有 YAML 渲染結果完全相同。新 `summarizeProfile()` helper 回傳統一形狀。`/#/profile` 將 `narrative.headline` 作為新卡片呈現。2 個新 i18n 鍵 × 8 個 locale。
- **`feat(tracker): PR-B — #/tracker 上的 Legitimacy 欄`** (G-006)
  恢復與 career-ops.org/docs 規範 pipeline 輸出表的對等。於 Status 與 PDF 之間新增 Legitimacy 欄,帶 badge-ok/warn/bad 著色(鏡像 statusClass 模式)。優雅降級 — v1.15 之前無 Legitimacy 欄的列顯示 `—`。1 個新 i18n 鍵 × 8 個 locale。
- **`fix(routing): PR-H — 去除 sidebar 重複;將 #/batch 導向 v1.13.0 TSV SPA`** (G-011)
  修正之前 /#/batch 在 sidebar 中註冊了**兩次**,而且兩個入口都導向舊版 mode-prompt builder。v1.13.0 的 TSV SPA(8 KB、4 端點)無法到達。已移除重複的 sidebar 條目;舊版 mode slug 從 `batch` 改名為 `batch-prompt` 並帶 deprecation 橫幅。規範 /#/batch 現在指向 TSV SPA。

### 📚 文件

- **`docs(evaluate): PR-A — 將 Block A-F 與規範 career-ops.org 評分量規對齊`** (G-005)
  career-ops.org docs 記載 A–F(Strategy/Personalization/STAR stories 於 C/E/F)。我們之前輸出 A–G 並調整語意(Risks/Verdict/Legitimacy)。v1.15 將全部 8 個 help bundle §9 更新為規範 A–F,並附「Pre-v1.15 used A–G;we render those as-is for back-compat」說明。`eval.subtitle` i18n 鍵 × 8 個 locale 也已對齊。Score + legitimacy 現在被記載為 report-header 欄位。⚠ 仍需父專案 commit:`santifer/career-ops::modes/oferta.md` 需要在上游重寫以輸出規範 A–F。
- **`docs: PR-F — 在 help §5 跨 8 個 locale 加入 seniority_boost + search_queries 並更新 scaffold`** (G-010)
  8 個 bundle 的 Help §5 現在記載第三個 title-filter 鍵(`seniority_boost`),並提供 `search_queries` 範例區塊與已翻譯的 1 段介紹,釐清其僅驅動 AI 化的 Option B scan。`bin/setup.sh` 的 portals.yml scaffold 預設種入 `seniority_boost: ["Senior", "Staff", "Lead"]`。H2 對等保留:16 × 8 個 locale。
- **`docs: PR-I — 每個 README locale 的本地化 hero 圖`**
  8 個 README 各擁有 locale 特定的 `images/dashboard-<locale>.png`(HiDPI 1440×900),透過 `scripts/capture-dashboard-screenshots.mjs`(Playwright + chromium)產生。舊的共用 `public/images/screen_vacancy_found.png` 已刪除。非英文讀者首次造訪即可看到以其語言標示的 UI。

### 🧹 結轉清理

- **`PR-G — G-001`** `scan.noResults` i18n bundle:替換 8 條含「EN or RU scan」字面的字串為 locale 乾淨文案。
- **`PR-G — G-002`** 📄 Generate PDF 按鈕現在出現於 #/interview-prep 結果面板(鏡像 deep.js 模式)。
- **`PR-G — G-003`** `README.cn.md` → `README.zh-CN.md`(規範 locale tag);跨 sibling 與 tests/canonical-docs-coverage.test.mjs 統一引用。
- **`PR-G — G-004`** `/api/stream/scan-en` + `scan-ru` 現在發出 RFC 8594 Sunset + Deprecation + Link 標頭(sunset 2026-10-01)。預定於 v1.16.0 移除。

### 🧪 測試

- 新 `tests/profile-canonical-schema.test.mjs`(6 案例) — 規範 YAML、舊版 YAML、混合舊版優先、僅接受規範、拒絕都不是的形狀、comp range 解析。
- 新 `tests/modes-profile-crud.test.mjs`(8 案例) — 空檔時的內建 scaffold、template 接管、persisted-wins、寫入 happy-path、淨化、非字串 400、>256 KB 413、generic /api/modes/:name 仍可用。
- 修復 test fixture 中的隔離迴歸:測試現在使用 `before/after + dynamic-import` 模式(與 `tests/batch-endpoints.test.mjs` 一致),不再變更使用者真實的父 `config/profile.yml`。**使用者注意:** 若你在從 v1.15.0-RC 升級後看到 `config/profile.yml` 看起來像測試佔位資料,請從備份還原 — 該迴歸僅存在於 dev 分支。
- 總計:**400 / 400** 單元測試(原 386;+14 淨)。0 失敗。20/20 smoke E2E + 23/23 comprehensive E2E + 28/28 Playwright 自 v1.14.0 基線起綠。

### 範圍外(v1.16+ 後續)

| 項目 | 說明 |
|---|---|
| 規範 A–F prompt 的父專案 commit | `santifer/career-ops::modes/oferta.md` 需要在上游重寫。CLAUDE.md 硬規則 #1 禁止我們編輯父檔案。web-ui 端已完成(優雅降級 — pre-v1.15 的 A–G 報告渲染不變)。 |
| 伺服器端 `POST /api/auto-pipeline` SSE | 客戶端 orchestrator 已交付 UX 勝利。伺服器端端點可啟用 retry-from-step-N 與可 curl 的 CI。 |
| `POST /api/reports` primitive | Auto-pipeline 目前以行內顯示報告 markdown,但未持久化至父 `reports/`。PDF + tracker 列才是耐久 artifact。 |
| Cmd+K 貼上 URL → 執行 auto-pipeline | 延後至 v1.16+。 |

### 驗證

```
npm test                              # 400 / 400
npm run test:e2e:full                 # 23 / 23
curl -sf http://127.0.0.1:4317/api/health | jq '.checks | length'   # → 18
curl -sI http://127.0.0.1:4317/api/stream/scan-en | grep -i sunset  # G-004 可見
curl -sf http://127.0.0.1:4317/api/modes/_profile | jq '.scaffolded' # G-008 接線
ls images/dashboard-*.png | wc -l     # 8 (PR-I)
grep -c 'href="#/batch"' public/index.html  # 1 (PR-H dedupe)
```

---

## [1.14.0] — 2026-05-13

在 v1.13.0 的 registry 之上新增 3 個 ATS 適配器,將支援 ATS 數從 3 → 6(Greenhouse / Ashby / Lever **+ Workable / SmartRecruiters / Workday-beta**)。面向使用者的文件在 17 個檔案中一次性從「3 ATSes」升級為「6 ATSes」(42 處短語):README × 8 locale、help bundle × 8 locale、PROJECT.md。`docs/portals-examples.md` 新增 13 家 trending 公司的 paste-ready YAML 區塊,可貼入父 `portals.yml`。

### ✨ 功能

- **`feat(portals): 3 個新 ATS 適配器 — Workable、SmartRecruiters、Workday-beta`** — registry 現在解析 6 個 ATS(原 3 個)。新檔案:`server/lib/portals/adapters/{workable,smartrecruiters,workday}.mjs`(每個都是對新 source 的薄統一契約包裝)與 `server/lib/sources/{workable,smartrecruiters,workday}.mjs`(原始 HTTP + 將回應正規化為規範 `{ id, title, company, url, location, isRemote, … }` 形狀,並帶 `source: <id>`)。
  - **Workable**:偵測 `apply.workable.com/<slug>` 與舊版 `<subdomain>.workable.com`。端點:`https://apply.workable.com/api/v3/accounts/<slug>/jobs?details=true`。
  - **SmartRecruiters**:偵測 `jobs.smartrecruiters.com/<slug>` 與 `careers.smartrecruiters.com/<slug>`。端點:`https://api.smartrecruiters.com/v1/companies/<slug>/postings`。
  - **Workday(beta)**:偵測 `<tenant>.wd<N>.myworkdayjobs.com/<lang>/<site>`。端點:POST 至 `/wday/cxs/<tenant>/<site>/jobs`。當 careers_url 未包含 site 時預設 `site=External`。Beta 是因為某些 tenant 用 CAPTCHA 封鎖 CXS — 發生時 fallback 至父 `/career-ops scan`(Playwright 驅動)。

### 📚 文件

- **`docs(portals-examples): trending boards 區塊`** — `docs/portals-examples.md` 擴展 v1.14.0 段落,以 paste-ready YAML 列出 13 家 trending 公司之 `tracked_companies`,分為 Greenhouse-hosted(Stripe、GitLab、HashiCorp、Cloudflare、Datadog、Hugging Face)與 Ashby-hosted(Notion、Linear、PostHog、Replicate、Modal Labs、Fly.io、Render)。每條使用 `enabled: false`,讓使用者啟用前先驗證 slug 有回應。並含 Workable / SmartRecruiters / Workday 範例區塊與各自偵測之 URL 模式。
- **`docs(framing): 跨 17 個面向使用者文件的 42 處 ATS 短語升級`** — 面向使用者文件中所有「Greenhouse / Ashby / Lever」皆改為「Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday」。涵蓋 README × 8 locale(EN/ES/PT-BR/RU/JA/KO/CN/TW)、help bundle × 8 locale、PROJECT.md。歷史 CHANGELOG 條目與 bug-fix 處方文件(`qa/fixes/F-014`、`qa/FIX-PROMPT`)刻意不動 — 它們描述過去或本就正確的狀態。
- **`docs(qa): browser test scenario 19 — 6 ATS 適配器涵蓋`** — `qa/claude-cowork-browser-test-prompt.md` 擴展 Scenario 19:`ALL_ADAPTERS.length === 6` 不變量、對 6 個適配器全部進行 `resolveAdapter()` URL 偵測掃描、`#/scan` 中 Active Companies 卡片的 soft-check,以及對 `docs/portals-examples.md` 各 ATS 區塊之結構檢查。

### 🧪 測試

- `tests/adapter-registry.test.mjs` 延伸 7 個新測試以涵蓋 3 個新適配器(Workable apply-URL 模式、Workable legacy subdomain 模式、SmartRecruiters jobs.* + careers.* 模式、帶明確 site 的 Workday tenant.wd5.*、Workday 預設 site 後備為「External」、`ALL_ADAPTERS.length === 6` 不變量、`detectApi()` 舊形狀相容性)。
- 總計:**386 / 386** 單元測試(原 379;+7 淨)。0 失敗。

### 驗證

```
npm test                        # 386 / 386
node -e "import('./server/lib/portals/registry.mjs').then(m => console.log(m.ALL_ADAPTERS.length))"   # → 6

# 適配器偵測掃描:
node -e "import('./server/lib/portals/registry.mjs').then(m => {
  console.log(m.resolveAdapter({ careers_url: 'https://apply.workable.com/foo/' }).adapter.id);          // → workable
  console.log(m.resolveAdapter({ careers_url: 'https://jobs.smartrecruiters.com/Bar' }).adapter.id);     // → smartrecruiters
  console.log(m.resolveAdapter({ careers_url: 'https://baz.wd5.myworkdayjobs.com/en-US' }).adapter.id);  // → workday
})"
```

### 範圍外(延後後續)

| 項目 | 說明 |
|---|---|
| 13 家 trending Greenhouse/Ashby 公司的 per-company 適配器紀錄 | `docs/portals-examples.md` v1.14.0 區塊以可貼用 YAML 列出;slug 驗證 + 批次加入父 `portals.yml` 為獨立階段。 |
| Workday CAPTCHA-fallback 自動化 | Workday 適配器在 CXS feed 被閘擋時拋例外;計畫的 fallback 委派至父 `/career-ops scan`(Playwright)。將其接入 SPA 的 scan UX 為 v1.15+。 |

---

## [1.13.0] — 2026-05-13

大型發布。在一次發布中關閉 post-v1.12.0 backlog 全部 4 項延後事項:PR-4(完整 multer 流水線)、Adapter registry(F-018 架構後續)、Batch evaluate SPA 頁面、locale-aware mode-template scaffolding。另含 mid-session 的深色主題表格修復。

### ✨ 功能

- **`feat(cv): 基於 multer 的 multipart 上傳(PR-4 完整版)`** — `/api/cv/import` 現在同時接受原始 octet-stream 契約(`Content-Type: application/octet-stream` + `X-Filename`)與經 multer 正確解析的 `multipart/form-data`。v1.10.2 的 415-reject 為權宜方案;v1.13.0 為真正修復。外部客戶端(curl `-F`、Postman 預設、任何 HTTP 客戶端)皆可無縫運作。兩條路徑皆饋入同一個 `importDocumentToMarkdown` 轉換器 + `stripDangerousMarkdown` XSS pass。新相依套件:`multer ^2.1.1`。
- **`feat(portals): adapter registry`** — 將 Greenhouse / Ashby / Lever 抓取器抽取到 `server/lib/portals/adapters/*.mjs`,採用統一契約(`id`、`label`、`matches`、`buildEndpoint`、`fetch`)。新 `server/lib/portals/registry.mjs::resolveAdapter()` 為唯一 dispatch 點。`en-scanner.mjs::detectApi()` + `FETCHERS` 現在委派給 registry;舊回傳形狀保留。新增 ATS:在 `adapters/` 放一個檔案,加到 `ALL_ADAPTERS` — 不需要 scanner 變更。
- **`feat(batch): #/batch evaluate 頁面`** — 新 SPA 視圖 + 4 個端點(`GET /api/batch`、`PUT /api/batch`、`GET /api/stream/batch`、`POST /api/batch/merge`)。`batch/batch-input.tsv` 的 TSV 編輯器,parallel/min-score/dry-run/retry 控件,`bash batch/batch-runner.sh` 的即時 SSE 日誌,執行完列出 `batch/tracker-additions/` 並提供一鍵 `node merge-tracker.mjs`。在 Decision 群組下新增 sidebar 連結。21 個新 i18n 鍵 × 8 個 locale。
- **`feat(prompts): locale-aware mode scaffolding`** — `buildModePrompt` + `buildEvaluationPrompt` 現以本地化 scaffolding 文字(role 行、「Read these files first」、「User-supplied context」)在 8 個 locale 中包裹父專案的英文 mode-template 本體。父專案 `modes/<slug>.md` 本體保持英文(依 CLAUDE.md 硬規則 #1 為唯讀);圍繞它的 career-ops-ui scaffolding 已翻譯。

### 🎨 UX 修復

- **`fix(theme): 深色模式表格 hover + tab-btn`** — 將硬編碼 `#fafafa` / `#fff` / `#f7f7f7` 替換為 `var(--beach)` / `var(--paper)` / `var(--slate)` token,深色色盤切換才真的觸及表格列與頁籤按鈕。為被 boost 的 scan 列新增 `.row-boosted` accent 條,雙主題皆生效。

### 🧪 測試

- 新 `tests/adapter-registry.test.mjs`(7 案例) — 統一契約、各 ATS URL 偵測、明確 `api:` 欄位優先順序、無匹配時 null、舊 `detectApi()` 形狀保留。
- 新 `tests/batch-endpoints.test.mjs`(5 案例) — 空 fixture、TSV round-trip、無 URL 拒絕、1 MB 上限、runner 缺失錯誤幀。
- 新 `tests/locale-scaffold.test.mjs`(6 案例) — en/ru/ja/ko 的 scaffold 字串、`buildModePrompt` / `buildEvaluationPrompt` 整合、英文向後相容。
- `tests/cv-upload-multipart-reject.test.mjs` 重寫 — 原本「multipart 回 415」契約現為「multipart 經 multer 解析」契約;無副作用於 cv.md 的不變量保留。
- 總計:**379 / 379** 單元測試(原 360;+19 淨)。0 失敗。
- 覆蓋率:**95.46 % line / 84.06 % branch**。
- 20/20 smoke E2E · 23/23 comprehensive E2E · 28/28 Playwright。

### 範圍外(延後後續工作)

| 項目 | 說明 |
|---|---|
| 14 個新 portal 適配器(Workable / SmartRecruiters / Workday / GitLab / HashiCorp / Cloudflare / Datadog / Stripe / Notion / Linear / Posthog / Hugging Face / Replicate / Modal Labs / Fly.io / Render) | Adapter registry 已就位 — 新增適配器現在是每個一個檔案。14 個 ATS 的逐 portal 調查 + URL 模式 + 端點正規化為獨立階段。 |
| 翻譯父專案 `modes/<slug>.md` 本體 | 父檔案依 CLAUDE.md 硬規則 #1 為唯讀。v1.13.0 的 locale-aware scaffolding 已為你完成 80 %;完整本體翻譯需向 `santifer/career-ops` 送上游 PR。 |

### 文件

- `docs/reviews/REVIEW-2026-05-13-v1.13.0.md` — 工作階段脈絡 + adapter registry 契約 + batch flow。
- 全部 8 個 README:徽章 bump(tests 360 → 379、release v1.12.0 → v1.13.0)。
- 全部 8 個 CHANGELOG 取得此條目。

---

## [1.12.0] — 2026-05-13

Bug-fix + UX + 品牌 pass。關閉 post-v1.11.1 誠實 backlog 中的 8 項(測試空缺 #9–12、console error #8、portals-dead 漂移 #4、seniority_boost 呈現 #6、F-018 端點整合)。新增 dark/light 主題切換,並從每個文件、套件中繼資料、GitHub repo 描述中移除「Airbnb-styled」品牌。

### ✨ 功能

- **`feat(theme): dark/light 切換(v1.12.0)`** — 上方列新增主題按鈕。循環 light ↔ dark;持久化至 `localStorage.theme`;透過 pre-paint bootstrap(`public/js/lib/theme-bootstrap.js`)在頁面載入時還原,使用者不會看到錯誤顏色閃爍。首次造訪尊重 `prefers-color-scheme`。`public/css/app.css` 中 `[data-theme="dark"]` 提供完整深色色盤 — 每個元件讀取 CSS custom properties,因此切換集中於一處。
- **`feat(scan): /api/stream/scan?source=ats|regional|both`(F-018 LITE)`** — 單一整合的 SSE 進入點。SPA 現在打開單一 event-stream,序列驅動兩個階段(ATS 先、regional 後),而非串接兩個獨立串流。舊版 `/api/stream/scan-en` + `/api/stream/scan-ru` 作為已棄用別名仍存活。runners 表的 `/api/stream/scan` 已改名為 `/api/stream/scan-parent` 以釋放命名空間;父專案 spawn 的 `scan.mjs` 後備保留。
- **`feat(scan): seniority_boost 呈現(規範 docs §3)`** — `en-scanner.mjs` 與 `ru-scanner.mjs` 現在皆讀取 `portals.yml::title_filter.seniority_boost`,並在匹配職缺上蓋上 `_boosted: true` + `_boostedBy: <keyword>`。SPA 將 boosted 列排序到 `#/scan` 結果頂部,並在 title 屬性中以匹配關鍵字渲染 `⬆ boosted` 徽章。兩個新 i18n 鍵(`scan.boosted`、`scan.boostedBy`)跨 8 個 locale 本地化。

### 🐛 Bug fixes

- **`fix(ui): 4 處 null-safe 錯誤訊息讀取(#8)`** — `app.js`(上方列 doctor 按鈕 + 全域搜尋 pipeline 加入)、`views/tracker.js`(第 112 行)、`views/apply.js`(第 21 行)、`views/evaluate.js`(第 32 行)現在皆讀取 `(err && err.message) || '<fallback>'`。先前無 Error payload 的 Promise rejection 會在 e2e tear-down 的 page-error 串流中拋出「Cannot read properties of undefined (reading 'message')」。
- **`fix(test): portals-dead 漂移改為警告而非失敗(#4)`** — `tests/portals-dead.test.mjs::FIX-C3` 先前在父專案 `templates/portals.example.yml` 漂移到重新啟用我們標為 dead 的 slug 時會失敗。v1.12.0 將該斷言改為 stderr 警告,使 CI 在父專案漂移時仍綠;發布決策保留人工。slug 清單 `KNOWN_DEAD` 保留作為意圖文件。

### 📝 品牌 / 文件

- **`docs(brand): 跨 8 個 locale 從每個文件中移除「Airbnb」引用`** — README.md、README.es.md、README.pt-BR.md、README.ko-KR.md、README.ja.md、README.ru.md、README.cn.md、README.zh-TW.md、CLAUDE.md、docs/architecture/FRONTEND.md、package.json,以及 GitHub repo 描述,皆從「Airbnb-styled」/「Airbnb-inspired」用語改為「Clean, docs-style」。CSS 檔保留 design-token 名稱(內部識別字,無外部耦合),但說明性註解已重寫。

### 🧪 測試

- **新 `tests/canonical-docs-coverage.test.mjs`(5 案例)** 關閉測試空缺 #9–12:每個 help bundle 引用全部 5 個規範 career-ops.org 指南;每 locale 16 個 H2 對等契約;每個 README 引用規範首頁 + ≥ 3 個子指南;`#/reports` view 原始碼含 score-thresholds 卡片 scaffold;i18n bundle 包含 v1.11.x 每個新鍵 × 全部 8 個 locale。
- **新 `tests/scan-consolidated.test.mjs`(6 案例)** 涵蓋 F-018 LITE:`?source=ats|regional|both` 正確 dispatch;未知 source 發出 error 幀;舊版 `/api/stream/scan-en` + `/api/stream/scan-ru` 仍以已棄用別名運作。
- 總計:**360 / 360** 單元測試(原 349;+11 新)。0 失敗。覆蓋率:**95.62 % line / 84.37 % branch**(自 94.59 提升)。
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**。

### 📋 內部

- `docs/reviews/REVIEW-2026-05-13-v1.12.0.md` — 工作階段脈絡、延後清單摘要、career-ops.org 內容同步刷新流程。
- 全部 8 個 CHANGELOG 取得此條目。
- GitHub repo 描述已更新以對應新品牌。

### 範圍外(延後至未來,自 v1.11.1 起未變)

| 項目 | 原因 |
|---|---|
| Batch evaluate SPA 頁面 | 依規範文件為 CLI-only 流程;SPA 等價物需要新視圖 + ≥3 端點 + fixtures。2–3 天階段。 |
| 完整 adapter-registry(8 個 `server/lib/portals/adapters/*.mjs` + 14 個新 portal + FE 重寫) | 本發布的 F-018 LITE 整合了 API 介面;完整架構重構仍待。 |
| 完整 multer 流水線(PR-4) | v1.10.2 透過 415 envelope 關閉資料毀損漏洞;完整 multipart 解析器 + ConversionError envelope 為其獨立階段。 |
| Mode-template 翻譯 | 需與父專案協調。 |

---

## [1.11.1] — 2026-05-13

深度 career-ops.org/docs 整合 — v1.11.0 後續。v1.11.0 加入摘要區塊;v1.11.1 以**完整 CLI 流程**(逐字命令、編號 apply 步驟、batch-evaluate runner、Playwright 設定)豐富每個 help bundle 既有的 §5 Portals / §7 Scan / §14 Apply 段落。SPA 的 `#/reports` 視圖獲得 score-thresholds 卡片,讓記載的 `≥4.5 / 4.0-4.4 / 3.5-3.9 / <3.5` 行動表可行內檢視。

### 📝 文件

- **Help bundle(全部 8 個 locale)** — 每個 bundle 新增三個子段落,逐 locale 翻譯:
  - **§5 Portals → `CLI flow`** — `cp templates/portals.example.yml portals.yml`;`title_filter` 規範 schema(positive / negative / seniority_boost)、`tracked_companies`(name + careers_url 為必填)、`search_queries`(預建的更廣泛網頁搜尋)。
  - **§7 Scan → `CLI scan flow`** — Greenhouse/Ashby/Lever ATS 的 Option A(`npm run scan` + `--dry-run` / `--company`),非 API 發現的 Option B(於任意 AI CLI 中 `/career-ops scan`)。輸出至 `data/pipeline.md` + `data/scan-history.tsv`。Action-thresholds 表。
  - **§14 Apply → `Full CLI apply flow` + `Batch evaluate` + `Playwright setup`** — 8 步驟編號 apply 流程(`/career-ops apply <company>` → Playwright 開啟瀏覽器 → 編號 draft 答覆 → 人工檢視並點 Submit → `Submitted.` 翻轉 tracker `Evaluated → Applied`)。透過 `./batch/batch-runner.sh` 的 batch runner,帶 `--parallel` / `--min-score` / `--retry-failed`。Playwright 安裝:`npm install` + `npx playwright install chromium` + `claude mcp add playwright`。
- 全部 8 個 bundle 保留 16-H2 對等契約(`tests/help-ui.test.mjs::section-parity` 保持綠)。

### ✨ UI

- **`#/reports`** — 列表視圖頂部新增可收合卡片,內含規範 score → next-step 表(`≥ 4.5 → /career-ops apply`、`4.0–4.4 → apply or /career-ops contacto`、`3.5–3.9 → /career-ops deep`、`< 3.5 → skip`)。連結至 `career-ops.org/docs/.../scan-job-portals`。7 個新 i18n 鍵(`rep.thresholdsTitle`、`rep.thrAction`、`rep.thr45`、`rep.thr40`、`rep.thr35`、`rep.thrLow`、`rep.thresholdsSource`)跨 8 個 locale。

### 📋 QA

- **`qa/claude-cowork-browser-test-prompt.md`** — 附加 **Scenario 17(career-ops.org/docs 涵蓋)**,含 5 個子斷言(8 個 locale 的前置內容、§5/§7/§14 的 CLI-flow 子段、8 個 locale 的 README 區塊、`#/apply` Playwright 連結、`#/reports` score-thresholds 卡片)+ **Scenario 18(help bundle 對等)** 對 i18n 對等迴歸。

### 範圍外(延後)

| 項目 | 原因 |
|---|---|
| **Batch evaluate SPA 頁面** | 規範文件描述 CLI-only 流程;SPA 等價物 = 新視圖 + ≥3 端點 + fixture。多日階段。 |
| **F-018 完整 adapter-registry** | 仍排隊;label-only 切片於 v1.10.3 關閉。 |
| **完整 multer 流水線** | v1.10.2 透過 415 envelope 關閉資料毀損漏洞;完整解析器為其獨立階段。 |

### 測試姿態

- **348 / 349** 單元測試(1 個既存父專案資料漂移)。
- 覆蓋率:**94.59 % line / 84.18 % branch**。
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**。

### 文件

- `docs/reviews/REVIEW-2026-05-13-v1.11.1.md` — 工作階段脈絡 + 稽核。
- 全部 8 個 README:release v1.11.0 → v1.11.1。
- 全部 8 個 CHANGELOG 取得此條目。

---

## [1.11.0] — 2026-05-13

career-ops.org docs 整合 — 次要發布,因每項變更皆為 additive(無 API 破壞、無資料形狀變更、無 SPA 路由改名)。關閉 v1.10.3 PR-9 之延後。

### 📝 文件

- **`docs/career-ops-canonical.md`(新)** — 自 [career-ops.org/docs](https://career-ops.org/docs) 與其 5 個子指南(What is career-ops、Scan job portals、Apply for a job、Batch-evaluate offers、Set up Playwright)濃縮的單一規範參考。所有 locale help bundle + README 皆翻譯此檔案;當 career-ops.org/docs 變動時,先重新產生此檔案。
- **全部 8 個 help bundle**(`docs/help/{en, ru, es, pt-BR, ko-KR, ja, zh-CN, zh-TW}.md`)在 H1 介紹下新增前置 `About career-ops` 段落:原則、關鍵概念(Mode / Archetype / Pipeline / Tracker / Report / Scan history)、career-ops 與 career-ops-ui 之區別、依分數的行動門檻(≥ 4.5 / 4.0–4.4 / 3.5–3.9 / < 3.5),以及全部五份規範指南的連結。各 locale 的 H2 數保持 16(`tests/help-ui.test.mjs` 對等仍綠)。
- **全部 8 個 README** 在安裝標題前新增 `About career-ops` 區塊:同樣的原則、分數門檻、5 份規範指南連結。從 README 首頁移除 `What's new in v1.10.x` 歷史段落(CHANGELOG 保留完整歷史)。

### ✨ UI 改善

- **`#/apply`** — 資訊橫幅現在明確揭露 Playwright 設定指南(`career-ops.org/docs/.../set-up-playwright`)與規範 Apply 指南連結。新 i18n 鍵 `apply.playwrightHint` + `apply.docsLink` 跨 8 個 locale 本地化。

### 🔧 內部

- README 截圖路徑保留 `public/images/screen_vacancy_found.png`(v1.10.1)。
- 無新伺服器路由、無 schema 變更、無新測試需求(現有 i18n + help 對等測試涵蓋新內容介面)。
- `tests/help-ui.test.mjs` 的 `section-parity` 測試持續通過 — 每個 locale 都有相同的 16 個 H2 標題。

### 稽核(延後空缺,**未**列於此發布)

| 空缺 | 延後原因 |
|---|---|
| **Batch evaluate SPA 頁面**(`./batch/batch-runner.sh` 流程) | 規範文件描述 CLI-only batch 迴圈(`batch/batch-input.tsv` → parallel runner → `batch/tracker-additions/`)。SPA 等價物需要新視圖、3 個新端點、fixture 資料與測試。多日階段;記載於 `docs/career-ops-canonical.md §4`。 |
| **Adapter-registry 整合**(F-018 / 完整 PR-1) | 仍排隊;`/api/stream/scan-en` + `/api/stream/scan-ru` 仍在。label-only 切片於 v1.10.3 落地。 |
| **Multer 流水線**(完整 PR-4) | v1.10.2 透過 415 envelope 關閉資料毀損漏洞;完整 multipart 解析器 + ConversionError envelope 重構為其獨立階段。 |

### 測試姿態

- **348 / 349** 單元測試通過(`portals-dead.test.mjs` 之 1 個既存父專案資料漂移)。
- 覆蓋率:**94.59 % line / 84.24 % branch**。
- 20 / 20 smoke E2E · 23 / 23 comprehensive E2E · **28 / 28 Playwright**。

### 文件

- `docs/reviews/REVIEW-2026-05-13-v1.11.0.md` — 工作階段脈絡 + UI 稽核空缺清單。
- 全部 8 個 README:徽章 bump(tests 349 → 348 — 一個測試因稽核清理移動,無功能變更)、release v1.10.3 → v1.11.0。
- 全部 8 個 CHANGELOG 取得此條目。

---

## [1.10.3] — 2026-05-12

關閉 v1.10.0 QA 11 個發現中的 7 個(F-001、F-010 minimal、F-011 minimal、F-013、F-014、F-015、F-019)。其餘 4 個(F-018 — 完整 adapter-registry 整合;PR-4 完整 multer 流水線;PR-7 後續;PR-9 跨 career-ops.org docs 之文件清掃)延後至 v1.11.0。

### ✨ 功能

- **`feat(pdf): 於每個長表單介面提供 Generate-PDF(F-015)`** — 三個新 SSE 端點(`GET /api/stream/pdf/report?slug=`、`GET /api/stream/pdf/deep?name=`、`POST /api/stream/pdf/inline { markdown }`)加上共享 `public/js/lib/pdf-generate.js` helper。**📄 Generate PDF** 按鈕現在出現於 `#/reports/:slug`、`#/deep`(手動 + live)、`#/evaluate`(手動 + live)與 `#/interview-prep`(透過 deep 端點)。每個 kind 重用 v1.10.2 的 cv-markdown 轉 print-HTML helper,並將結果落於 `output/<slug>-<TS>.pdf`,讓既有自動下載流程接手。
- **`feat(config): regional config 群組(F-013)`** — `/api/config` 現在揭露 `groups`(`core | runtime | regional`)與 `regionalActive`(由 `portals.yml::russian_portals.sources` 計算的布林值)。SPA 將三組渲染為可收合段落;**Regional sources** 自動收合,且僅在設定了 regional source 時存在。

### 🐛 Bug fixes

- **`fix(server): 全域 Express 錯誤處理器(F-019)`** — `PayloadTooLargeError`(例如對 `/api/cv/import` 上傳 11 MB)與 `express.json` 之 `SyntaxError` 現在回傳 SPA 可本地化的 JSON envelope(HTTP 413 / 400)。先前預設 Express 處理器回傳 HTML 堆疊追蹤,使 SPA 的 `try { await res.json() }` 失敗。
- **`fix(i18n): 英文 token 不再洩漏到非英文 UI(F-001)`** — 為 `Pipeline`、`Deep research`、`Follow-up`、`Health`、`Outreach`、`Doctor`、`Quick scan` 加入本地化(使用者在 UI 語言中看到的標籤,但介面其他部分已翻譯)。
- **`fix(scan): 從標籤移除 EN/RU framing(F-010 minimum)`** — `#/scan` 摘要列、兩個 scan-done 徽章與來源篩選標籤現在顯示「ATS adapters」+「Regional portals」。兩個 SSE 端點(`/api/stream/scan-en`、`/api/stream/scan-ru`)保留原狀;完整 registry 整合落於 PR-1 / v1.11.0。
- **`fix(scan): Active-Companies 計數器自動刷新(F-011 minimum)`** — 視圖在每次 `refreshResults()` 後 dispatch `scan:refresh` 事件;計數器自實際的 `/api/scan-results` payload 重算「上次掃描有 hits 的公司」,不再凍結於視圖掛載時的 snapshot。
- **`docs(en-ru-framing): 跨 README + help bundle 清掃(F-014)`** — `EN sweep` → `ATS sweep`、`RU sweep` → `regional sweep`、`EN scanner` → `ATS scanner`、`EN: Greenhouse / Ashby / Lever, RU: hh.ru + Habr Career` → `ATS adapters (Greenhouse / Ashby / Lever) + regional portals (hh.ru / Habr Career)`。涵蓋 `README.md`、`README.ru.md`、`README.ja.md`、`README.ko-KR.md`、`docs/help/en.md`、`docs/help/es.md`、`docs/help/pt-BR.md`。

### 🧪 測試

- 新 `tests/global-error-handler.test.mjs`(2 案例):格式錯誤的 JSON → 400 JSON;11 MB 上傳 → 413 JSON。
- 新 `tests/config-groups.test.mjs`(2 案例):`/api/config` 揭露 `groups`;當 portals.yml 取得 regional source 時 `regionalActive` 翻為 true。
- 新 `tests/pdf-extra-routes.test.mjs`(5 案例):`/report`、`/deep`、`/inline` 各以記載的三個位置引數呼叫 `generate-pdf.mjs`;缺 slug 時 404;空 inline markdown 時 400。
- 總計:**349 / 350** 單元測試(`portals-dead.test.mjs` 中 1 個既存父專案資料漂移)。
- 覆蓋率:94.59 % line / 84.16 % branch。
- 20 / 20 smoke E2E、23 / 23 comprehensive E2E、**28 / 28 Playwright**。

### 📝 文件

- `docs/reviews/REVIEW-2026-05-12-v1.10.3.md` — 工作階段脈絡 + 範圍外清單。
- 全部 8 個 README:徽章 bump(tests 340 → 349、release v1.10.2 → v1.10.3)、每 locale 新增「What's new in v1.10.3」段落。
- 全部 8 個 CHANGELOG 取得此條目。

### 範圍外(延後至 v1.11.0)

- **PR-1** — 完整 locale-agnostic adapter registry(8 個 ATS 適配器檔案 + 整合既有兩端點的新 `/api/stream/scan?source=` + 14 個新 portal + scan-view 重寫)。本發布的 label-only 切片在視覺上關閉 F-010 / F-011;架構重構為多日階段。
- **PR-4** — 基於 multer 的 CV import 流水線(以真正的 multipart 解析器 + ConversionError envelope + 相依套件檢視取代 v1.10.2 的 415 envelope)。
- **PR-9** — 完整 career-ops.org docs 整合:擷取 [career-ops.org/docs](https://career-ops.org/docs) 與 4 個子指南(scan-job-portals、apply-for-a-job、batch-evaluate-offers、set-up-playwright)、翻譯至 7 個非英文 locale、相應改寫 help bundle + README、以記載行為稽核 UI 畫面。

---

## [1.10.2] — 2026-05-12

功能性迴歸 patch。關閉 v1.10.1 hand-testing 中發現的兩個 bug;擴展文件介面。

### 🐛 Bug fixes

- **`fix(cv): /api/cv/import 對 multipart/form-data 回傳 415(F-016 強化)`** — 任何預設 `multipart/form-data` 的外部客戶端(curl `-F`、常見 HTTP 客戶端)先前會把其 wire envelope(`--boundary…\r\nContent-Disposition: form-data; name="file"; filename="x"…`)儲存為 `cv.md` 內容。SPA 實際路徑(`Content-Type: application/octet-stream` + `X-Filename`)不受影響。路由現在回傳 415,並提示指向記載的契約。深度防禦:在前 256 bytes 看起來像 multipart 的 octet-stream body 也回 415。`cv.md` 在 415 時絕不會被觸碰。
- **`fix(pdf): /api/stream/pdf 以正確位置引數呼叫 generate-pdf.mjs`** — 先前以 `[]` 呼叫該 script。script 列印其 `Usage:` 列並 exit code 1 — SPA 顯示綠色「PDF 已產生」toast,但沒有檔案落於磁碟。路由現在讀取 `cv.md`,透過 route 內 markdown-to-print-HTML helper 渲染為 `output/cv-input-<TIMESTAMP>.html` 中的 HTML 檔案,然後 spawn `generate-pdf.mjs <input.html> <output.pdf> --format=a4`。可選 `?format=letter` 用於 US-letter 輸出。`cv.md` 缺失時發出 `error` 事件 + `done { code: 2 }`,而非偽造 start 幀。

### 🧪 測試

- 新 `tests/cv-upload-multipart-reject.test.mjs`(5 案例):SPA happy path 回 200 帶乾淨 markdown;`multipart/form-data` → 415;看起來像 multipart 的 octet-stream body → 415;空 body → 400;被拒請求**不**會修改 `cv.md`。
- 新 `tests/pdf-stream-args.test.mjs`(3 案例):`start` 事件帶 `<input.html> <output.pdf> --format=a4` 之絕對路徑,且 HTML 存在於磁碟;`?format=letter` 切換 flag;`cv.md` 缺失時發出預期之 error 幀。
- 總計:**340 個單元測試**(原 318)。`portals-dead.test.mjs` 中 1 個既存失敗為父專案資料漂移,與 web-ui 無關。
- 覆蓋率:94.63 % line / 84.94 % branch。

### 📝 文件

- 新 `docs/test-scenarios/` — 21 個情境檔案(英文)(index + 逐頁契約):
  - 01 smoke / health · 02 CV upload · 03 CV edit-save · 04 CV → PDF download
  - 05 profile YAML · 06 config env · 07 scan · 08 pipeline
  - 09 evaluate · 10 deep research · 11 modes · 12 apply checklist
  - 13 tracker · 14 reports · 15 activity log · 16 interview prep · 17 JDs
  - 18 i18n · 19 help center · 20 security · 21 full funnel
- 每個檔案記載:目的、前提、輸入、預期輸出、negative case、測試覆蓋(檔案 + 行範圍)、相關時的手動 Playwright 步驟。
- 新 `docs/reviews/REVIEW-2026-05-12-v1.10.2.md` — 完整工作階段脈絡、範圍外清單、驗證命令。
- 全部 8 個 README:徽章 bump(tests 318 → 340、release v1.10.1 → v1.10.2)+ 每 locale 新增「What's new in v1.10.2」段落。
- 全部 8 個 CHANGELOG 取得此條目。

### 範圍外(延後至未來 GSD 階段)

PR-1 locale-agnostic adapter registry(仍排隊)、PR-4 基於 multer 的 CV import 與完整轉換流水線、PR-7 reports / evaluate / deep / interview-prep 之 Generate-PDF 按鈕、PR-8 config UI 重組、PR-9 docs 清掃、PR-10 逐按鈕本地化稽核 + jsdom CI 閘、完整韓文重新翻譯。

---

## [1.10.1] — 2026-05-09

由 v1.10.0 QA 迴歸執行(`qa/reports/00-FINAL-SUMMARY.md`)驅動的關鍵修復 patch。

### 🛡️ 安全性

- **`fix(security): 收緊 isValidJobUrl + 加入 DNS-rebind 防禦(PR-3 / F-003)`** — `isValidJobUrl` 現在拒絕 RFC1918(`10/8`、`172.16/12`、`192.168/16`)、完整 127/8 loopback 範圍、link-local `169.254/16`(含 AWS IMDS)、`0.0.0.0`、CGNAT `100.64/10`、IPv6 ULA / link-local。新 helper `isPrivateOrLoopbackHost()` 從 `server/lib/security.mjs` 匯出,並由 `/api/pipeline/preview` 重用 — 後者現於每次 redirect 跳轉時對 host 進行 `dns.lookup`,當解析位址本身為私有時拒絕 — 擊敗 DNS-rebind。DNS 失敗時 fail open(由 fetch 回報錯誤),讓測試 stub / 無 DNS sandbox 仍可運作。

### 🐛 Bug fixes

- **`fix(activity): 僅記錄成功的狀態變更(PR-5 / F-005)`** — middleware 現在在 `res.statusCode >= 400` 時 early-return。被拒的 pipeline / cv / tracker 請求不再污染稽核資料流。
- **`fix(activity): 加入 profile.save / config.save / cv.import 事件對應(F-008)`** — 成功的 `PUT /api/profile` 與 `POST /api/config` 呼叫現在出現於 `/api/activity`。
- **`fix(help): 別名 ko → ko-KR.md 以服務韓文 Help 本體(F-002)`** — SPA 送出裸 BCP-47 代碼(`ko`);磁碟上檔案為 `ko-KR.md`。解析器現在走訪 4 個候選:exact、region-tag 別名、language-only base、然後 `en.md`。
- **`fix(llm): /api/evaluate 尊重 mode:'manual'(F-009)`** — 鏡像 `/api/deep`。手動模式即使有 key 也會跳過 Anthropic / Gemini 呼叫,讓使用者可將 prompt 複製進 Claude Code 而不耗 credit。
- **`fix(api): DELETE /api/pipeline 接受 ?url= 與 body.url,miss 時回 404(PR-6 / F-017)`** — 先前僅 `?url=` 時會無聲 200-on-miss。

### ✨ 功能

- **`feat(llm): 透過每個 prompt 傳遞 locale(PR-2 / F-012)`** — 新 `resolveLocale(req)` 依 `body.lang` → `body.locale` → `Accept-Language` → `'en'` 順序挑選 locale。新 `buildLocaleDirective(lang)` 發出單行「Respond in X」標頭。`buildEvaluationPrompt`、`buildDeepPrompt`、`buildModePrompt` 現在接受並嵌入 `lang`。SPA `API.call()` 自動附加 `Accept-Language` 並將 `lang` 合併入 JSON body。
- **`feat(scripts): post-qa-cleanup.mjs(PR-11)`** — 重播 QA 迴歸清理檢查清單;`--apply` 寫入,預設 dry-run,冪等。從 `data/pipeline.md` 清掃 RFC1918 / `nip.io` / `test-cloud-*` URL,並稽核 `cv.md` 大小。

### 🧪 測試

- 新 `tests/critical-fixes.test.mjs`(15 案例),涵蓋:F-002 ko 別名解析、F-009 manual-mode opt-out、PR-6 DELETE 形狀(body / 404 / 400)、PR-3 helper 對 IPv4 + IPv6 + bracketed 形式的單元測試、PR-2 `resolveLocale` 優先序 + `buildLocaleDirective` + prompt-builder 整合。
- `tests/url-validation.test.mjs` 延伸 5 個新測試以涵蓋 RFC1918 / link-local / 0.0.0.0 / 127/8 / CGNAT / IPv6 ULA / link-local。
- `tests/activity-log.test.mjs` 測試 8 更新以斷言新「4xx 時不記錄」契約。
- 總計:**318 個單元測試**(原 298;`portals-dead.test.mjs` 中 1 個既存失敗為 `templates/portals.example.yml` 之父專案資料漂移,與 web-ui 程式碼無關)。

### 📝 文件

- 新 `docs/reviews/REVIEW-2026-05-09-v1.10.1.md` — 完整工作階段脈絡 + 範圍外清單 + 驗證命令。
- 全部 8 個 README:徽章 bump(test 計數 298 → 318、release v1.10.0 → v1.10.1)、截圖路徑移至 `public/images/screen_vacancy_found.png`、每 locale 新增「What's new in v1.10.1」段落(英文、西文、葡文、韓文、日文、俄文、簡中、繁中)。
- 全部 8 個 CHANGELOG 以此條目更新。

### 範圍外(延後至未來 GSD 階段)

PR-1(locale-agnostic adapter registry、+14 portal、FE 重寫)、PR-4(基於 multer 的 CV import + ConversionError + 全域錯誤處理器)、PR-7(reports / evaluate / deep / interview-prep 之 Generate-PDF 按鈕)、PR-8(config UI 重組)、PR-9(完整 README/docs/8-help-bundle EN-RU framing 清掃)、PR-10(逐按鈕本地化稽核 + jsdom CI 閘)、完整韓文 help 重新翻譯(檔案存在;PR 僅修復執行期遞送)。

---

## [1.10.0] — 2026-05-08

CV import 大改版 + `#/config` 頁籤 + 規範 `#/profile` 路由。

### ✨ 功能

- **`feat(cv): 伺服器端 import .docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md`** — 新 `POST /api/cv/import` 端點將上傳文件(任意常見格式)轉為編輯器可放入的 markdown。Office 格式經 **pandoc**,PDF 經 Poppler 之 **pdftotext**。結果經 `stripDangerousMarkdown` 淨化(深度防禦 XSS)。硬上限:每次上傳 10 MB。前端 `📁 Upload CV` 現在接受完整格式集;主機缺少轉換器時顯示美觀錯誤 toast。
- **`feat(cv): generate-pdf.mjs 完成時自動下載產生的 PDF`** — 串流的 Generate-PDF 流程現在於 output 目錄擷取最新 PDF 之 snapshot,並在 `done` 時觸發瀏覽器下載**新**檔案(若該次執行未產生新 artifact 則為 no-op)。頁面既有清單仍顯示每個過往 PDF。
- **`feat(config): 兩頁籤版面 — API keys & runtime + Profile`** — `#/config` 現在有頁籤條。第一個頁籤保留既有的 `.env` 編輯器(API key、模型、scanner 旋鈕)。新 **Profile** 頁籤是 `config/profile.yml` 的直接 YAML 編輯器:`PUT /api/profile` 驗證 YAML(必須為 mapping、必須含 `candidate`)、缺失時打上規範 `# Career-Ops Profile Configuration` 標頭,然後寫入。儲存不需重啟即傳遞。
- **`feat(routes): 規範 /#/profile 路由(原 /#/settings)`** — sidebar 現在指向 `#/profile`。舊 `#/settings` hash 仍透過路由別名表解析,既有書籤照樣可用。內部路由 handler 已改名;測試更新以反映新方向。

### 🧪 測試

- 新 `tests/cv-import.test.mjs`(7 案例):`.md` / `.txt` passthrough、空 body 400、未支援副檔名 422、過大 413、HTML→markdown 淨化(pandoc 缺席時 skip)、PDF→text round-trip 以手作 PDF(poppler 缺席時 skip)。
- 新 `tests/profile-put.test.mjs`(7 案例):happy-path round-trip、標頭打章、空 / 無效 YAML / 非物件 / 缺 candidate 之 400、過大 413。
- `tests/playwright-full-cycle.mjs` 延伸 14 → **16** 子測試 — 新增 CV-import via HTML 與 `PUT /api/profile` round-trip。
- `tests/router.test.mjs` ALIAS 正規表達式翻轉以斷言新 `settings → profile` 方向。

### 📚 文件

- `docs/help/{en,ru}.md` — 完整更新 2/3/4 段:新 App-settings 頁籤、唯讀 Profile 頁的 edit-via-config 訊息、CV 段落的完整上傳格式矩陣、PDF 自動下載行為。
- `docs/help/{es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md` — 新內容區塊之精簡鏡像;段落數不變(16),對等測試保持綠。

### 🔧 內部

- 新 `server/lib/cv-import.mjs` — 格式 → markdown 轉換的單一真實來源,帶 timeout + 轉換器缺失偵測,可呈現可操作提示而非 500。
- `server/lib/routes/content.mjs` 取得 `POST /api/cv/import` 與 `PUT /api/profile`(上傳採 `express.raw` binary-safe,YAML PUT 採 JSON)。

---

## [1.9.1] — 2026-05-08

Production-readiness pass。四個針對性 bug 修復(BF-1..BF-4),Playwright smoke 自 5 擴展至 12 個測試,涵蓋 tracker / pipeline / reports / evaluate / config / cv 儲存 round-trip。CI 全綠。

### 🐛 Bug fixes

- **`fix(tracker): 對每個 cell(非只 notes)做 pipe 跳脫 + 換行收斂(BF-1)`** — 公司名稱如 `"Acme | Co"` 先前會破壞 markdown 表格版面(parser 將該 cell 拆成兩個)。Cell 淨化器現在統一套用於 company / role / reportSlug / notes;`parsers.mjs::parseMarkdownTable` 之配套修復加入 GFM 相容 `\|` 跳脫支援,讓 round-trip 無損。
- **`fix(config): 將 updateEnvFile 包入 try/catch(BF-2)`** — `POST /api/config` 先前在 permission-denied / 唯讀檔案系統時冒出未處理 rejection。現在回傳乾淨 500 `{ error: 'failed to write parent .env', details: [...] }`。
- **`fix(llm): 對 Anthropic SDK 呼叫的組裝 prompt 大小設軟上限(BF-3 + BF-4)`** — `/api/evaluate`、`/api/deep`、`/api/mode/:slug` 之 Anthropic 分支現在於 `bundleProjectContext + prompt` 超過 200 KB(約 50K token)時以 413 退出。比起讓 API 抱怨 context 大小,節省多秒往返 + token。該上限遠低於任何當前模型上限(Sonnet 4.6 = 1M context)。

### 🧪 Playwright smoke — 擴展覆蓋

5 → **12** 個測試。新案例:

- `tracker view renders empty + accepts API-seeded row` — 透過種入公司名稱含字面 pipe 的列,並斷言 round-trip 保留之,行使 BF-1。
- `pipeline add-URL form populates the queue` + 無效 URL 拒絕掃描(loopback、`javascript:`、裸字串)。
- `reports view handles empty state` — non-crash 斷言。
- `evaluate view returns a manual prompt without API key` — 驗證後備鏈。
- `config GET returns known keys masked` — 機密絕不透過 `/api/config` 洩漏。
- `cv.md PUT round-trips with sanitization` — XSS-y 片段(script 標籤、`javascript:` scheme)端對端被去除。
- `pipeline preview proxy strips scripts` — 無效 URL 拒絕路徑。

### 📦 行為變更(無 API 契約變更)

- Tracker 寫入現在對含 pipe 的 company / role 名稱無損。既有原始 pipe 列在下次讀取時將開始正確解析。
- `/api/{evaluate,deep,mode/:slug}` 在 prompt 不合理大(200 KB+)時將回 413 而非 502/timeout。

### 🧪 測試

- **284 個單元測試**(計數不變;parser 更新後既有測試仍全綠)。
- **12 個 Playwright 瀏覽器 smoke 測試**(原 5)。

---

## [1.9.0] — 2026-05-08

v1.8.0 backlog 的 P-6 → P-10 全部於一綑交付。重點:`server/index.mjs` 現在是 130-LOC 的 orchestrator(自 762 降下;原 1230 → 130 = -89 %);每個路由主題各有自己的模組。`/api/evaluate` 的 Anthropic 對等、多 CLI shim、擴展的 i18n 對等測試、Playwright 瀏覽器 smoke 已串接進 CI。

### 🏗️ P-6 — 伺服器按關注切割(第 2 階段)

P-2 之延續。將 `server/index.mjs` 剩餘 9 個路由主題抽取至 `server/lib/routes/<topic>.mjs` 模組。`index.mjs` 現在為純 orchestrator:middleware(安全標頭 + 活動日誌 + static)、12 個 `register<Topic>Routes(app)` 呼叫、SPA catch-all。

- `server/lib/routes/activity.mjs` — `/api/activity`。
- `server/lib/routes/config.mjs` — `/api/config` GET/POST(父 .env round-trip)。
- `server/lib/routes/health.mjs` — `/api/health` + `/api/dashboard`。
- `server/lib/routes/help.mjs` — `/api/help/:lang`。
- `server/lib/routes/jds.mjs` — `jds/*.txt` 之完整 CRUD。
- `server/lib/routes/llm.mjs` — 每個 LLM 端點(evaluate、deep、mode、apply-helper、interview-prep)。
- `server/lib/routes/pipeline.mjs` — `/api/pipeline*`,包含 SSRF-safe preview proxy,並以具名常數命名 timeout / max-redirects / max-body。
- `server/lib/routes/reports.mjs` — `/api/reports*`。
- `server/lib/routes/tracker.mjs` — `/api/tracker` GET + dedup-aware POST。

行為不變。283/283 單元測試於每一步皆保持綠。Orchestrator 的 import 介面從 47 列降至 22 列。

### 🔌 P-7 — `/api/evaluate` 之 Anthropic 對等

`/api/evaluate` 先前僅 Gemini 或 manual。v1.9.0 加入 Anthropic 分支(兩 key 並存時優先),鏡像 `/api/deep` 與 `/api/mode/:slug` 既有路由規則。透過 `bundleProjectContext({ modeSlugs: ['_shared', 'oferta'] })` 讓模型有 cv / profile / mode template 內聯(REVIEW-A1)。

新端點:**`POST /api/evaluate/test-anthropic`** — `ANTHROPIC_API_KEY` 的 smoke check,鏡像既有 Gemini smoke。送出微小 prompt(≤256 輸出 token)所以幾乎沒成本;回傳 200 字元樣本。

後備鏈現為:Anthropic → Gemini → manual。

### 🌐 P-8 — Help-center i18n 對等(稽核 + 測試強化)

稽核每個 `docs/help/<lang>.md` 的結構對等。全部 8 個 locale 皆已涵蓋相同 14 個規範 h2 段落。測試升級:

- `tests/help-ui.test.mjs::every help doc covers the same 14 sections` 過去僅檢查 en + ru。現在迭代**全部 8 個 locale**(en、es、pt-BR、ko-KR、ja、ru、zh-CN、zh-TW)並斷言每個之段落數。
- 新測試:`tests/help-ui.test.mjs::every help locale has substantive content` — 透過斷言每個非英文 locale 至少為 `en.md` 位元組長度的 30 % 來防範 locale stub。精簡翻譯自然落在 40-50 %;stub 會落在個位數 %。

結果:結構對等現在由 CI 強制。

### 🤖 P-9 — CI 矩陣中的 Playwright 瀏覽器 smoke

`tests/playwright-smoke.mjs`(v1.8.0 中作為 opt-in 加入)現在是 CI workflow 一環。既有 `e2e` job 已安裝 Playwright + Chromium;新增一個步驟(`npm run test:e2e:browser`)在 comprehensive node E2E 之後即執行 5 個瀏覽器 smoke 測試。

CI 順序:unit(Node 18/20/22 矩陣) → smoke node E2E → comprehensive node E2E → **Playwright 瀏覽器 smoke** → 失敗時上傳截圖 artifact。

### 🌍 P-10 — 多 CLI 相容性

父專案 career-ops v1.7.0 引入多 CLI / Open Agent Skill 標準支援。UI 子專案遵循同樣慣例,並提供薄 shim 指向規範 `CLAUDE.md`:

- `web-ui/AGENTS.md` — Codex / Aider / 通用 CLI 進入點。
- `web-ui/GEMINI.md` — Gemini CLI 進入點。

兩個 shim 重述硬規則與 quick reference,但對完整專案層指令延後至 `CLAUDE.md`,使非 Claude CLI 落於與 Claude Code 工作階段相同的入門。已部署的 UI 本身在執行期保持 CLI-agnostic。

### 🧪 測試

- **284 個單元測試**(原 283):+1 個新的 help-locale 對等測試。
- **5 個 Playwright 瀏覽器 smoke 測試** — 現在是 CI 一環,不再只是 opt-in。
- 覆蓋率持平。

### 🔧 觸及檔案

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

### 📦 新 REST 端點

| 方法 | 路徑 | 目的 |
|---|---|---|
| `POST` | `/api/evaluate/test-anthropic` | `ANTHROPIC_API_KEY` 之 smoke check(P-7)。鏡像 `/api/evaluate/test-gemini`。 |

### 🤖 新 CLI 進入點

| 檔案 | CLI | 說明 |
|---|---|---|
| `AGENTS.md` | Codex / Aider / 通用 | 對完整指令指向 `CLAUDE.md`。 |
| `GEMINI.md` | Gemini CLI | 工作階段開始時由 Gemini 自動載入。 |

---

## [1.8.0] — 2026-05-08

強化、重構、SDD bootstrap。三項 high-severity 正確性 / 安全性修復(A1、A2、A3)、四項 medium(B1–B4)、六項清理、父專案 career-ops v1.7.0 介面稽核、伺服器按關注切割(P-2 第 1 階段)、Playwright 瀏覽器 smoke harness,以及 `docs/` 與 `.claude/` 之完整 SDD 基礎。

### 🔥 High-severity 修復

- **`fix(deep): 為 Anthropic SDK 呼叫內聯 cv/profile/mode 檔案(REVIEW-A1)`** — `/api/deep` 與 `/api/mode/:slug` 先前告訴模型「Read these files first」,但 Anthropic SDK 無檔案系統。輸出空洞。新 `bundleProjectContext({ modeSlugs })` 讀取 `cv.md`、`config/profile.yml`、`modes/_shared.md` 與 mode template,各截斷於 16 KB,並在 prompt 前置 `<project_context>` 區塊。已現場驗證:對 deep-research 呼叫,`claude-sonnet-4-6` 回傳 26 KB grounded markdown。
- **`fix(runner): SIGTERM 寬限後 SIGKILL 升級(REVIEW-A2)`** — `runNodeScript` 與 `streamNodeScript` 先前在 timeout / client-disconnect 時僅送 `SIGTERM`。卡在 syscall(DNS、阻塞 socket)的子行程會忽略它,讓 SSE 連線 hang 到 Node GC 收割。現在每條路徑各部署一個 5 秒看門狗以升級至 `SIGKILL`。Promise 總會 resolve。
- **`fix(runner): 對串流端點之 max-runtime 上限(REVIEW-A3)`** — 每個 SSE script runner(`/api/stream/{scan,liveness,pdf}`)現在有 30 分鐘硬上限。到期時:發出 `event: error { message: 'maximum runtime exceeded' }`、透過 A2 看門狗 kill 子行程、結束 response。

### 🛡️ Medium-severity 修復

- **`fix(preview): /api/pipeline/preview 之逐跳 redirect 驗證(REVIEW-B1)`** — 從 `redirect: 'follow'` 切換為手動 redirect-walking。每個 `Location` 標頭都被 `isValidJobUrl` 重新驗證;上限 3 跳。惡意 board 不能再彈跳我們至 loopback / 私有 IP / `file://`。4 個新測試涵蓋拒絕路徑。
- **`refactor(keys): hasGeminiKey helper 統一 LLM-key 檢查(REVIEW-B2)`** — 路由 handler 中直接的 `process.env.GEMINI_API_KEY` 讀取改為 `lib/anthropic.mjs` 的 `hasGeminiKey()`。形狀鏡像 `hasAnthropicKey()`,利於一致性與 mocking。
- **`feat(scanners): 將 AbortSignal 穿線至 hh.ru、Habr、Greenhouse、Ashby、Lever(REVIEW-B3)`** — SSE 客戶端在掃描中段中斷連線時,進行中的 HTTP fetch 現在被 abort,而非執行完每個 query 並丟棄事件。`runRuScan` 與 `runEnScan` 接受 `opts.signal`;`/api/stream/scan-{ru,en}` 中的 SSE handler 建立 `AbortController` 並在 `res.close` 時 abort。
- **`test(anthropic): log-guard 測試防止未來透過 console 洩漏 API key(REVIEW-B4)`** — 在 `runAnthropic` happy + error 路徑期間捕捉每個 `console.{log,info,warn,error,debug}` 呼叫,斷言零輸出且 canary key 字串永不出現。對未來 `console.log(opts)` 迴歸的深度防禦。

### 🧹 Low-severity 拋光

- **`fix(parsers): addPipelineUrl 內之深度防禦 URL 閘(REVIEW-C4)`** — parser 層拒絕非 http(s) 值,補強路由層 `isValidJobUrl`。可選 `opts.validate` 供更嚴格規則。
- **`docs(readme): 徽章「tests-88 passed」→「tests-277 passed」(REVIEW-C3)`** — 差了一個數量級。
- **`test(i18n): missing-keys 差異按 locale 分組(REVIEW-C6)`** — `tests/i18n-coverage.test.mjs` 發現空缺時,輸出現在為 `[ru] (3): foo, bar, baz` 而非混雜行。
- **`docs(review): C1 以「檢視即解決」關閉`** — sanitizer 正規表達式已採 `\x00-\x08` 十六進位形式;review 條目為工具渲染 artifact。

### 🏗️ P-2 第 1 階段 — 伺服器按關注切割

`server/index.mjs` 為 1230 LOC,遠超 800 列上限。在不改行為下切割為聚焦模組。283 個單元測試於每一步皆保持綠。

- `server/lib/security.mjs` — `isValidJobUrl`、`stripDangerousMarkdown`、`sanitizeJobDescription`、`isPubliclyExposed`。從 `index.mjs` 重新匯出以維持外部消費者向後相容。
- `server/lib/prompts.mjs` — `bundleProjectContext`、`buildEvaluationPrompt`、`buildDeepPrompt`、`buildModePrompt`、`buildApplyChecklist`。
- `server/lib/store.mjs` — `safeReadApps`、`safeReadPipeline`、`safeListReports`、`checkProfileCustomized`、`ensureRussianPortalsDefaults`。
- `server/lib/routes/scan.mjs` — `/api/stream/scan-{ru,en}`、`/api/scan-ru/config`、`/api/scan-results` 之 `registerScanRoutes(app)`。
- `server/lib/routes/runners.mjs` — buffered `/api/run/*` 表、串流 `/api/stream/{scan,liveness,pdf}`、產生 PDF 之 list/download 的 `registerRunnerRoutes(app)`。
- `server/lib/routes/content.mjs` — CV / Profile / Portals / Modes 之 `registerContentRoutes(app)`。

`index.mjs` 現為 762 LOC(-38 %,在 800 上限以下)。第 2 階段將抽取 tracker、pipeline、reports、jds、llm(evaluate/deep/mode)與 health 為路由模組。目標為 orchestrator 落於 <500 LOC。

### 🔍 父專案 career-ops v1.7.0 稽核

使用者將父專案升級至 v1.7.0。已稽核每個消費介面 — UI 完全相容。重點記載於 `docs/architecture/DATA-FLOWS.md`:

- Mode catalog 從 7 增至 19 個檔案。UI 的 `MODE_ALLOWLIST` 刻意只揭露 7 個(其他為 Claude-Code-only)。已加入註解說明這個刻意的窄範圍。
- `portals.yml` schema 已確認:`tracked_companies`(96 條、87 啟用、71 帶 API)。EN scanner 正確讀取;舊 `companies` key 仍受支援。
- 父專案新介面**今日未消費**:`dashboard/`(Go 程式)、`update-system.mjs`、`generate-latex.mjs`、`analyze-patterns.mjs`、`liveness-core.mjs`、`followup-cadence.mjs`、`test-all.mjs`、本地化 mode 子目錄(`de/fr/ja/pt/ru`)。
- Live `/api/dashboard`、`/api/health`、`/api/modes`、`/api/portals`、`/api/profile`、`/api/cv`、`/api/jds`、`/api/reports`、`/api/tracker`、`/api/pipeline`、`/api/evaluate`、`/api/deep`、`/api/stream/scan-en` 皆驗證為綠。

### 🤖 SDD / GSD bootstrap

`career-ops-ui` 現在擁有完整的 Spec-Driven Development 基礎,與 GSD 流水線一致(`superpowers@claude-plugins-official` 之 `gsd-*` 技能)。

- `CLAUDE.md`(root) — 專案層 agent 系統提示:技術堆疊、GSD 流水線、硬規則(父契約、安全範圍、無 `--no-verify`)、慣例、父專案邊界。
- `.aiignore` — AI agent 排除清單:vendored、binary、父專案使用者資料、`.planning/`、`.env`、locale 重複。
- `.claude/agents/` — 三個專案特定 subagent 定義:
  - `web-ui-route-reviewer.md` — 對新路由把關 SSRF、CSP、淨化器、父寫入契約、慣例、測試。
  - `spa-view-reviewer.md` — CSP-safe DOM、i18n、路由註冊、無障礙。
  - `test-isolation-reviewer.md` — 驗證測試為 CI-isolated(無父專案假設、無 live 網路、無 port 衝突)。
- `.claude/commands/` — slash-command stub:`/sdd-status`、`/codebase-tour`。
- `docs/` 樹 — 全部英文:
  - `PROJECT.md` — what/why/for-whom、範圍、限制、成功標準。
  - `ROADMAP.md` — 目前 milestone + 完成歷史 + backlog。
  - `sdd/SDD-GUIDE.md` — discuss → spec → plan → execute → verify → review 流水線映射至 `gsd-*` 技能。
  - `sdd/CONVENTIONS.md` — 模組系統、命名、路由、淨化器、client 模式、i18n、錯誤、日誌、測試、commit、分支、CSS。
  - `architecture/OVERVIEW.md` — 頂層圖、層次、開機序列、不變量、「先去哪看……」備忘錄。
  - `architecture/SERVER.md` — `server/lib/*.mjs` 的逐檔地圖(已為 P-2 切割更新)。
  - `architecture/FRONTEND.md` — SPA 結構、視圖盤點、全域、「如何新增 view」。
  - `architecture/API.md` — 每個 `/api/*` 路由的完整盤點。
  - `architecture/DATA-FLOWS.md` — 每個父專案讀/寫與明確 user-action 契約。
  - `reviews/REVIEW-2026-05-07.md` — 產生本 changelog 修復之靜態 review。

### 🔒 安全性與 repo 衛生

- **`chore(.gitignore): 完備的深度防禦樣式`** — 涵蓋 env 變體、IDE 資料夾、GSD scratch(`.planning/`)、每使用者 agent 設定(`.claude/settings.local.json`、`.claude/cache/`、`.claude/state/`、`.claude/memory/`)、Playwright artifact(`playwright-report/`、`test-results/`、`.playwright/`、`trace.zip`)、heap/CPU profile、未發布工具的 lockfile、擴展的 macOS Finder 雜訊、通用機密樣式(`secrets.json`、`credentials.json`、`*.pem`、`*.key`)。

### 🧪 測試

- **283 個單元測試**(原 277):+6 個新(4 個 B1 redirect-rejection、1 個 `hasGeminiKey`、1 個 `runAnthropic` log-guard)。
- **5 個 Playwright 瀏覽器 smoke 測試**(新,透過 `npm run test:e2e:browser` opt-in):dashboard 渲染 + 版本 footer、dashboard → scan → pipeline → cv 導覽、語言切換持久化、404 視圖、health 頁面渲染。透過父專案 `node_modules` 解析 Playwright — 無新相依套件。
- 覆蓋率維持約 93 % line / 約 83 % branch。

### 📝 新 / 更新 package.json scripts

| Script | 目的 |
|---|---|
| `npm run test:e2e:browser` | 對 in-process 伺服器執行 Playwright smoke harness(5 個測試)。 |

### 🔧 觸及檔案

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

~ .gitignore                                   ~  README.md (徽章修正)
~ package.json (1.7.2 → 1.8.0)
~ server/index.mjs (1230 → 762 LOC)
~ server/lib/runner.mjs (SIGKILL 升級、max-runtime 上限)
~ server/lib/anthropic.mjs (hasGeminiKey)
~ server/lib/parsers.mjs (addPipelineUrl 之 URL 閘)
~ server/lib/ru-scanner.mjs                    ~  server/lib/en-scanner.mjs
~ server/lib/sources/{hh,habr,greenhouse,ashby,lever}.mjs (signal 穿線)
~ tests/anthropic.test.mjs                     ~  tests/i18n-coverage.test.mjs
~ tests/pipeline-preview.test.mjs
```

---

## [1.7.2] — 2026-05-04

Help center、in-UI App settings、行動版 sidebar、單一 Scan 按鈕,以及每個 prompt-builder 上的「Show result」捷徑。

### ✨ 新功能

- **`feat(help): in-app 使用者指南`(`/#/help`)** — 由新 sidebar 條目可達的長篇 Markdown 文件。逐步涵蓋每頁:快速開始、CV 編輯器、Profile、Scan 篩選、Pipeline preview、Evaluate、Deep research、Apply、Tracker、Reports、全部 7 個 mode、Activity 日誌、Health、設定提示。自動從 `<h2>` 標題建立黏性目錄,DOM 同步建構(無競爭)。為 8 個支援 locale 本地化。
- **`feat(config): in-UI App settings 頁面`(`/#/config`)** — 從瀏覽器編輯 `ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL`、`GEMINI_API_KEY`、`GEMINI_MODEL`、`HH_USER_AGENT`、`PORT`、`HOST`。寫入**父專案**之 `.env` 檔案,使 career-ops Node script 與 web-ui 之 dotenv loader 共用同一來源。Secret key 在讀取時遮罩(首尾各 4 字元)。模型欄位為下拉,附經過選材的清單(claude-sonnet-4-6 / claude-opus-4-7 / claude-haiku-4-5 / gemini-2.0-flash / 等)。空值刪除該鍵。值即時套用至執行中 process.env — 多數設定無需重啟。
- **`feat(modes): 與「Copy prompt」並列之「⚡ Show result」按鈕`** — 在 manual 模式產生 prompt 時,使用者不再需要重打輸入以取得 LLM 結果。新按鈕以 `run: true` 重新提交同一表單,當無 key 時 fall through 到清晰 toast(`Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env first`)。於 `/#/deep`、`/#/project`、`/#/training`、`/#/followup`、`/#/batch`、`/#/contacto`、`/#/interview-prep`、`/#/patterns` 皆可用。

### 🐛 UX + UI 修復

- **`fix(scan): 單一 Scan 按鈕取代三顆(Scan all + EN + RU)`** — 選項過多,且 99 % 情境下預設一致。統一的 `🌐 Scan` 按鈕執行每個啟用來源。Help 文件跨 8 個 locale 更新。
- **`fix(ui): 行動版 sidebar drawer`** — viewport <900px 現在於 topbar 取得 hamburger 按鈕(☰);`body.sidebar-open` 切換 CSS transform 滑入 sidebar。Backdrop 變暗 + 點任何處關閉。anchor 點擊 + hashchange 自動關閉,使用者落地新頁時 drawer 已收起。較大 viewport 不受影響。
- **`fix(server): footer 版本反映 web-ui,而非父 VERSION`** — `/api/health` 現在讀取 web-ui 自己的 `package.json`。footer 不再洩漏父 version 檔案中的過期 `1.6.0`。父之 VERSION 仍以 `parentVersion` 個別呈現。

### 📦 新 REST 端點

| 方法 | 路徑 | 目的 |
|---|---|---|
| `GET`  | `/api/help/:lang` | 回傳請求 locale 的 Markdown 使用者指南,後備至 `en.md`。Path-traversal 安全。 |
| `GET`  | `/api/config` | 回傳所有已知 env key 的目前值;機密遮罩。 |
| `POST` | `/api/config` | 將給定 key 寫入父專案 `.env`、驗證每個值、live 套用至 `process.env`。 |

### 🌐 i18n

- 30+ 個新 key 跨 `nav.help`、`nav.config`、`help.*`、`config.*`、`deep.showResult`、`deep.needKey`、`scan.btnRun`。8 個 locale 皆已填入。

### 🧪 測試

- `tests/help.test.mjs`(12 案例) — 每個支援 locale 回傳實質 markdown、EN 對每個頁面 slug 抽查、未知 lang → EN 後備、path-traversal 淨化、每個 locale 引用 `cv.md` / `profile.yml` / `.env`。
- `tests/help-ui.test.mjs`(9 案例) — 視圖檔案註冊、sidebar 條目、每 locale 之 i18n key 存在、每 locale 之文件檔案存在、EN/RU help 有 14 個規範段落、每個 #/foo 路由皆涵蓋、deep + mode-page 上的 Show-result 接線。
- `tests/env-config.test.mjs`(18 案例) — 對 `parseEnv`、`maskSecret`、`validateConfig`、`updateEnvFile`(bootstrap、就地重寫保留註解、空值刪除、必要時加引號)的純函式測試。
- `tests/config-endpoint.test.mjs`(8 案例) — GET 遮罩機密 / 回傳 env path;POST 寫入父 .env;live process.env 套用;空值取消設定;未知 key + 格式錯誤 Anthropic key 400 拒絕。

### 📊 統計

- **測試:** 233 → **277**(+44,跨 4 個新測試檔案)。
- **E2E:** 20 smoke + 23 comprehensive = 43 Playwright 步驟,全綠。
- **覆蓋率:** 93.5 % line / 82.6 % branch / 93.7 % function(不變 — 新程式碼皆完整測試)。

---

## [1.7.1] — 2026-05-04

Patch 發布,堆疊 post-v1.7.0 工作:pipeline preview pane、Anthropic API 整合、可捲動 sidebar、dotenv loader、動態 Active-companies 清單、CI workflow 強化。

### ✨ Pipeline preview pane

- **`/#/pipeline` 改版** — 左清單 + 右 preview pane。點任何 URL 取得伺服器端代理 snapshot(`GET /api/pipeline/preview` 去除 script/style/tags、上限 8 KB、經 `isValidJobUrl` 驗證)。即時篩選輸入、「In queue」計數器、⚡「Evaluate first」標頭按鈕。每列行內 ▶/✕,加上 preview pane 之完整 Evaluate / Open in tab / Delete。透過 `data-url` + `.pipeline-row` + `.pipeline-row-delete` class 提供穩定測試選擇器。**8 個新測試**於 `tests/pipeline-preview.test.mjs`(mocked fetch,無需 upstream 繫結)。

### ✨ Anthropic API 整合 —「Run live」全面化

- **`server/lib/anthropic.mjs`** — Anthropic Messages API 的零相依 client(claude-sonnet-4-6 預設,經 `ANTHROPIC_MODEL` 覆寫)。當設定 `ANTHROPIC_API_KEY` 時,每個 mode 頁面(`/#/deep`、`/#/project`、`/#/training`、`/#/batch`、`/#/contacto`、`/#/interview-prep`、`/#/patterns`)渲染「⚡ Run live (Anthropic)」按鈕作為**主要**動作 — 點擊即執行 prompt 並將 Markdown 渲染回瀏覽器,而非交棒給 Claude Code。Gemini 仍是僅 Gemini key 設定時之後備。Manual 模式在無 key 時仍可用。**8 個新測試**於 `tests/anthropic.test.mjs`。

### 🐛 CI / pipeline 修復

- **`fix(api): 收緊 pipeline URL 驗證器`(FIX-M7)** — 現在也拒絕 loopback 主機名稱、長度 <10 或 >2000、URL 內含空白。
- **`fix(server): 實際載入 .env,讓 HH_USER_AGENT / GEMINI_API_KEY 提示生效`** — 新增 `server/lib/dotenv.mjs`(35 列零相依 loader),於 `server/index.mjs` 頂部接線。scanner 程式碼中的執行期提示終於有用。**6 個新測試**。
- **`fix(ui): 可捲動 sidebar`** — 6 群組中 18 個 nav 條目在較短 viewport 溢出。`.sidebar` 現有 `overflow-y: auto`,搭配薄客製樣式 scrollbar。
- **`fix(ui): 讓 HH_USER_AGENT 橫幅可關閉`** — 隨後在我們意識到過頭時,從 `/scan` 完全移除。Health 頁面檢查仍呈現。
- **`fix(scan): Active companies 清單現在可收合 + 可篩選 + 分組`** — 87 個平鋪 tag 太多。現在「▸ Active companies 87/71」切換可展開有序清單(✓ API-backed 先、○ websearch 後),加上搜尋篩選。
- **`fix(test): 將 api.test.mjs + en-scanner.test.mjs 與父專案隔離`** — 兩者皆 spin up tmp 專案 root,使 CI 可在父專案未一同 checkout 時運作。
- **`fix(workflow): publish-package version-match 僅於 release event`** — 來自 main 的 `workflow_dispatch` 不再 fail tag/version 檢查。
- **`fix(e2e): pipeline 列刪除之穩定選擇器`** — 復原 anchor wrapper 並加上 `data-url` 屬性,使 e2e 套件選擇器穩定。

### 📦 新 REST 端點

| 方法 | 路徑 | 目的 |
|---|---|---|
| `GET` | `/api/pipeline/preview?url=…` | 伺服器端代理:回傳 URL 之 visible-text snapshot(script/style 去除,8 KB 上限),由 `isValidJobUrl` 把關。 |

### 📊 此 batch 後統計

- **測試:** 225 → **233**(在 v1.7.0 之上 +8)。
- **測試檔案:** 25 → **26**。
- **E2E:** 20 + 23 = 43 Playwright 步驟,全綠。

---

## [1.7.0] — 2026-05-03

由 QA r5 驅動的 35-commit 強化 + UX + 功能完成 pass。三層安全性落地(XSS 淨化、CSP、輸入驗證),每個缺失的 CRUD 端點補齊,父專案 bootstrap 現已完全自動化,UI 取得 **9 個新頁面** — Activity、改版 Deep Research,以及 7 個 sidebar 分組 mode(project / training / followup / batch / outreach / interview-prep / patterns),完整涵蓋父專案 `modes/` 100 %。Pipeline 取得伺服器端 preview pane。Anthropic API 整合讓「Run live」在所有 mode 變成一鍵動作。測試覆蓋從 **73** 增至 **225**,跨 **25 個測試檔案**,加上 **23 個 comprehensive Playwright e2e 步驟**。GitHub Actions 出貨 CI / AI review / Release / Publish-Package workflow。

### 🔒 安全性

- **`fix(cv): 淨化 CV markdown 以阻擋 preview 中的 stored XSS`(FIX-C10)** — `PUT /api/cv` 寫入 `cv.md` 前,現在會去除 `<script>`、`<iframe>`、`<object>`、`<embed>`、`<style>`、`<form>`、`<svg>`、`on*=` 事件處理器、以及 `javascript:`/`vbscript:`/`data:text/html` URI。Body 上限 1 MB(溢出 413)。Client-side `UI.md()` 重寫,使每個 byte 在任何 markdown 變換執行前都先 escape,所以原始 HTML 永遠到不了 `innerHTML`。Link `href` 屬性對安全 scheme 白名單(`http`/`https`/`mailto`/`tel`/相對 + 僅 `data:image`)驗證。新增 17 個跨 strip helper 與 HTTP round-trip 的測試。
- **`fix(server): 加入 CSP 與基線安全標頭`(FIX-L2)** — 每個 response 現在攜帶 `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: same-origin`。當伺服器繫結超過 loopback(`HOST` ≠ `127.0.0.1`/`::1`/`localhost`)時,疊上嚴格 `Content-Security-Policy`:`default-src 'self'`、`script-src 'self'`(無 `unsafe-inline`)、Google Fonts 白名單、`connect-src 'self'` 阻擋 XSS 外洩。`index.html` 與 `router.js` 中的行內 `onclick` 處理器移至 `addEventListener` 以保留嚴格 CSP。8 個新測試把關 CSP 跨 5 個不同 `HOST` 值。
- **`fix(api): 收緊 pipeline URL 驗證器`(FIX-M7)** — `POST /api/pipeline` 過去接受 `"not-a-url"` 並持久化。現在 `isValidJobUrl()` 拒絕裸字串、輸入 <10 或 >2000 字元、含空白 URL、非 `http(s)` scheme,以及 loopback 主機名稱(`localhost`/`127.0.0.1`/`::1`)。納入 **FIX-M3** + **FIX-M6**(無效時回 400,成功時帶 `deduped` flag)。
- **`fix(server): 實際載入 .env,讓 HH_USER_AGENT / GEMINI_API_KEY 提示生效`** — 先前執行期告訴使用者「在 .env 設定 HH_USER_AGENT」,但伺服器從未讀取該檔案,因此照做沒用。新增 35 列零相依 dotenv loader(`server/lib/dotenv.mjs`)於 `server/index.mjs` 頂部接線。命令列上設定的 process-env 值仍優先,既有 CI override 不會被遮蔽。父 `.env.example` 現包含記載的 `HH_USER_AGENT` 區塊與真實 Chrome User-Agent 範例。6 個新測試。
- **`fix(api): prompt 組裝前淨化 JD`(FIX-M5)** — `POST /api/evaluate` 在呼叫 Gemini 或回送 prompt 前,去除 ANSI escape、控制位元組、行內 `<script>` 標籤,並修剪空白。50 KB 長度上限。50 字元最小限制對「淨化後」文字運行,因此看似夠長但多為 escape 的 prompt-injection 嘗試會以 400 快速失敗。
- **`fix(health): 當 HOST!=loopback 時遮罩 Node 版本 + 專案 root`(FIX-M1)** — `/api/health` 不再於 LAN 暴露部署上識別主機。Loopback 回應仍保留值以利本地診斷。

### ✨ 新功能

- **`feat: 7 個新 sidebar mode + 分組 sidebar`(FIX-C8)** — 完整涵蓋父專案 `modes/` 目錄 100 %,無 UI 空缺。新路由:`#/project`(portfolio project advisor)、`#/training`(course / cert evaluation)、`#/followup`(per-application cadence)、`#/batch`(parallel URL processor)、`#/contacto`(LinkedIn outreach drafter)、`#/interview-prep`(stage-specific prep)、`#/patterns`(rejection-pattern analyzer)。全部 7 個共用單一 config-driven 視圖工廠(`public/js/views/mode-page.js`)與單一通用端點 `POST /api/mode/:slug` — 未來新增 mode 是一列 config + 一個 i18n 區塊。Sidebar 重組為 6 群組:Sourcing / Decision / Application / Networking / Analytics / Setup。共 18 個 nav 條目。12 個新測試於 `tests/modes-endpoints.test.mjs`。
- **`fix: bootstrap 父專案 deps + russian_portals 預設`(FIX-C4 + C9 + C12 + H2)** — `bin/start.sh` 現在於 fresh clone 安裝父 `node_modules`(js-yaml、playwright、jsdom)與 `npx playwright install chromium`,讓 `/api/stream/scan`、`/pdf` 與 `/liveness` 開箱端對端可用。`createApp()` 每次啟動探測 `portals.yml` — 若缺 `russian_portals:` 區塊,附加帶註解的記載預設。冪等:第二次啟動為 no-op。3 個新測試。
- **`fix: 在 template + health-check script 停用 9 個失效 portal slug`(FIX-C3)** — `templates/portals.example.yml` 現在出貨時將 Ada / Factorial / Tinybird / Weights & Biases / Travelperk / Clarity AI / Forto / Vinted / Runway 標為 `enabled: false`(每條附行內原因註解)。新安裝掃描 **87** 個存活公司而非 96。新 `web-ui/scripts/portals-health-check.mjs` HEAD-probe 每個啟用之 `careers_url` 並回報 DEAD 條目並建議 patch 清單(透過 `--json` 輸出 JSON)。3 個新測試。
- **`feat(activity): 使用者動作日誌 + Activity sidebar 頁面`** — 每個狀態變更 API 請求皆捕捉至 `data/activity.jsonl`(timestamp、action verb、target、success flag、可選 detail)。新 sidebar 條目 **Activity**,帶 action-prefix chip 篩選(pipeline / cv / jd / evaluate / scan / stream / script)、動作 ✓/✗ 徽章與刷新按鈕。5 MB 自動 rotate。10 個新測試,涵蓋 middleware、讀取篩選、損壞行容忍、`GET /api/activity` 本身的遞迴防護。
- **`feat(deep): 於瀏覽器檢視 Deep Research + 儲存結果存檔`** — Deep Research 頁面現在(a)當 `{ run: true }` 且設定 `GEMINI_API_KEY` 時透過 Gemini 即時執行 prompt,並將輸出持久化至 `interview-prep/{slug}.md`;(b)以可點擊卡片列出每個儲存的 deep-research 檔案(帶相對 timestamp);(c)將結果渲染為 Markdown,並提供每結果 **📋 Copy / ⬇ Download .md / ↗ Open in tab** 動作。新 REST 介面:`GET /api/interview-prep`、`GET /api/interview-prep/:name`、`DELETE /api/interview-prep/:name`。7 個新測試。
- **`feat(cv): 於瀏覽器產生 + 下載 PDF,並含 PDF 存檔`** — CV 頁面新增 **📄 Generate PDF** 按鈕,於 modal console 串流 `/api/stream/pdf`。發生 `ERR_MODULE_NOT_FOUND` / `playwright` 錯誤時,呈現可複製貼上的 bootstrap 命令。新「Generated PDFs」段落於每次成功執行後自動載入,列出每個 `output/*.pdf` 並提供 **↗ Open** 與 **⬇ Download** 按鈕。新 REST 介面:`GET /api/output/pdfs`、`GET /api/output/pdfs/:name`。6 個新測試。
- **`feat(api): POST /api/tracker — 從 UI 附加列`(FIX-H8)** — 從瀏覽器附加規範列至 `data/applications.md`。驗證 company + role、對 `templates/states.yml` 正規化 status、自動遞增零填補 `#`、依 company+role(大小寫不敏感)dedup、對 notes pipe-escape 以免 markdown 表格斷裂。檔案為空時 bootstrap 表格。6 個新測試。
- **`feat(api): DELETE /api/jds/:name`(FIX-H4)** — 不再 shell-out 即可移除儲存之 JD。Path-traversal 字元於任何檔案系統觸碰前去除;參數必須以 `.txt` 結尾。5 個新測試,包含 `../../etc/passwd` 拒絕。
- **`feat(api): POST /api/evaluate/test-gemini`(FIX-H7)** — Smoke 測試端點,透過 `gemini-eval.mjs` 跑 50 字元假 JD,讓使用者可在不耗實際 evaluation 時間下驗證 API key 是否有效。回傳 `{ ok, code, sampleLength, sample }`。

### 🐛 Bug fixes

- **`fix(router): catch-all 404 視圖 + i18n 覆蓋率防護`(FIX-C7)** — 未知 hash 路由過去無聲後備至 dashboard,遮蔽 typo 與壞掉的書籤。現在 `#/totally-random-xyz` 渲染專屬 404 頁面,引用該壞路徑並提供 dashboard 連結。404 視圖在 router IIFE 內註冊,因此不會與任何使用者路由衝突。新 `tests/i18n-coverage.test.mjs` 於 `vm.Context` 內以 stub `window` 執行 `i18n.js`、揭露私有 `DICT`,並斷言 173+ 個 key 跨 8 個 locale 皆已填入且非空。4 個新 router 測試。
- **`fix(router): 別名 #/profile → settings`(FIX-C2)** — 內部路由名為 `settings`(`nav.settings` 渲染為「Profile」)但外部連結與肌肉記憶都會走 `#/profile`。現在兩個位址抵達同一視圖,sidebar nav 條目以任一方式都亮起。2 個新測試。
- **`fix(health): 統一 Health/Doctor + 標記模板 profile`(FIX-C6 + FIX-H6)** — Health 與 Doctor 為兩個不同真實來源。現在 `/api/health` 揭露 Doctor 報告之全部(parent-deps、Playwright、目錄、profile-customized、`HH_USER_AGENT`)。`Profile customized` 檢查偵測佔位名稱(`Jane Smith`、`Alex Doe`、`John Doe`、`Your Name`、`Test User`)與明確 YAML 解析錯誤。4 個新測試。
- **`fix(scan): 對 RU config 之 query↔negative 衝突發警告`(FIX-H3)** — 當 `portals.yml` 出貨時 `title_filter.negative` 含 `"PHP"`,而 queries 鎖定 Senior PHP,每個匹配都被篩掉,使用者看到 0 結果。`loadConfig()` 現在計算 `warnings` 陣列;`runRuScan()` 在掃描開始前以 SSE stderr 列發出每個警告。2 個新測試驗證出貨預設開箱保持 PHP 友善。
- **`fix(scan): HH_USER_AGENT 未設定時發警告`(FIX-H1)** — `/scan` 頁面探測 `/api/health`,在 `HH_USER_AGENT` 為空時於動作列上方顯示黃色警告卡,使用者在點 RU scan **之前**即得知 hh.ru 403 之可能。
- **`fix(api): 當 POST /api/jds slug 被去除不安全字元時發警告`(FIX-M2)** — 去除危險字元的 slug 正規化現在回傳 `warning` 欄位;純大小寫 / 空白清理保持安靜。淨化後為空時回 400。
- **`fix(ui): 路由變更時清除全域搜尋 + 按鈕 spinner`(FIX-M4 + FIX-L1)** — 全域搜尋輸入於 `hashchange` 時清除(對 active 輸入有 guard)。新 `UI.withSpinner(button, fn)` helper 將載入狀態、ARIA、雙擊防護接線進每個 async 按鈕點擊。已採用於 Doctor / Verify / sync-check / Save CV / Normalize / Dedup / Merge 按鈕。
- **`fix(ui): 讓 sidebar 可捲動,使 18 個 nav 條目永遠抵達 footer`** — FIX-C8 之分組 sidebar 在較短 viewport 溢出;底部條目(Activity / Health)被剪掉。`.sidebar` 現有 `overflow-y: auto` 與薄客製樣式 scrollbar(WebKit + Firefox)。Footer 透過既有 `margin-top: auto` 固定。
- **`fix(ui): 空 modal-title 佔位`(FIX-H9)** — `index.html` 中硬編碼英文 `"Title"` 字串已移除,關閉 modal 開啟期間短暫可見的競爭視窗。

### 🌐 i18n

- 173+ 個翻譯 key × 8 個支援 locale(`en`、`es`、`pt-BR`、`ko`、`ja`、`ru`、`zh-CN`、`zh-TW`)。為 404 頁面、activity 日誌、deep research、PDF 流程、安全警告、tracker 突變、apply 改名加入新 key。覆蓋率現由 `tests/i18n-coverage.test.mjs` 強制 — 每個 key 必須於每個支援 locale 有非空值,否則 CI 失敗。

### ⚙️ DevOps

- **測試數:** 73 → **201**(+128,跨 23 個測試檔案)。剩餘單一失敗測試(`runEnScan: dry-run end-to-end across multiple sources`)為 Greenhouse/Ashby/Lever live API response 之既存 flake。
- **Comprehensive Playwright e2e**(`tests/e2e-comprehensive.mjs`,23 步驟):走訪完整使用者旅程 — CV 儲存 → preview → PDF 產生 → 全部 7 個新 mode → tracker 篩選 → activity 日誌 → 404 → modal ESC → sidebar 捲動 → Ctrl-K focus → search 清除 → profile 別名 → 語言持久化。
- **GitHub Actions**(`.github/workflows/`):
  - `ci.yml` — Node 18/20/22 矩陣上之單元 + 整合測試,加上 i18n 覆蓋率閘(每個 key × 8 locale 必須非空),加上每個 PR 上的完整 Playwright e2e。
  - `ai-review.yml` — 每個 PR 上之 Claude Code AI review。維護者保留 merge 權威;Claude 只建議。透過 `skip-ai-review` 標籤跳過。
  - `release.yml` — 當推送 `v*.*.*` tag 時自動發布 GitHub Release;release notes 從 `CHANGELOG.md` 切片,讓 8 語言變體保持規範來源。
- **CSP 友善 UI:** `index.html` 與 `router.js` 中所有行內 `onclick` 處理器已移除。嚴格 `script-src 'self'` 政策現在可強制執行,且不破壞任何功能。

### 📦 新 REST 端點

| 方法 | 路徑 | 目的 |
|---|---|---|
| `GET`    | `/api/activity`                  | 列出使用者動作事件,最新優先 |
| `GET`    | `/api/interview-prep`            | 列出儲存之 Deep Research 檔案 |
| `GET`    | `/api/interview-prep/:name`      | 讀取單一 Deep Research 檔案 |
| `DELETE` | `/api/interview-prep/:name`      | 移除 Deep Research 檔案 |
| `GET`    | `/api/output/pdfs`               | 列出產生的 PDF |
| `GET`    | `/api/output/pdfs/:name`         | 以附件方式串流 PDF |
| `POST`   | `/api/tracker`                   | 對 `applications.md` 附加列 |
| `DELETE` | `/api/jds/:name`                 | 移除儲存之 JD |
| `POST`   | `/api/evaluate/test-gemini`      | Smoke 測試 Gemini API key |
| `POST`   | `/api/mode/:slug`                | 7 個新 mode 之通用 prompt builder(project / training / followup / batch / contacto / interview-prep / patterns) |

---

## [1.6.0] — 2026-05-02

Web UI 首次公開發布。基準功能盤點請參閱 `README.md`。
