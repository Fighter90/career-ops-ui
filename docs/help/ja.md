# ヘルプ — career-ops-ui

アプリを起動した瞬間から面接獲得までの、すべてのページの完全ウォークスルー
です。以下の各 `##` 見出しは、サイドバーの項目またはワークフローのフェーズ
に対応しています。初回は上から下へ読み、後で特定のセクションへはヘルプ
サイドバーの目次からジャンプしてください。

> **対象読者:** この UI を `career-ops` チェックアウト内に置いて
> `bash bin/start.sh` を実行したばかりの方。career-ops の予備知識は
> 不要です。

### career-ops について

[career-ops](https://career-ops.org) は、任意の AI コーディング CLI
(Claude Code、Codex、OpenCode、Qwen CLI — 同じスラッシュコマンド・サーフェスで他の Claude 互換 CLI も動作します) 内で
スラッシュコマンドとして動作するオープンソースの求職システムです。
モデル非依存です。各求人をあなたの CV と照らし合わせ、6 次元
0.0–5.0 のルーブリックで評価し、ロールに合わせた PDF レジュメを生成し、
すべての応募をあなたのマシン上にローカルで記録します。

**正規リファレンス (初回インストール時はこの順で読んでください):**

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
  — システム、原則、概念インベントリ。
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
  — 求人を発見し、Pipeline に投入します。
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
  — Playwright のフォーム読込を伴う完全な応募フロー。
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  — `batch-runner.sh` で 10 件以上の JD をまとめて採点します。
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)
  — Chromium のインストールと、PDF・フォーム入力用 MCP の登録。

**基本原則** (出典:
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)):

- **オープンソース、本気で** — MIT ライセンス、有料ティアなし、
  ウェイトリストなし、テレメトリなし、アカウントなし。本システムは
  有料層・アカウント・テレメトリなしで運用されます。コードへの貢献は
  リリース前にコミュニティレビューを経ます。
- **データ主権** — `cv.md`、`config/profile.yml`、`data/`、
  `reports/`、`interview-prep/` は、明示的にプッシュしない限り
  あなたのノート PC を離れません。ローカルマシンで実行し、データ主権を
  完全に保持します。
- **AI 非依存アーキテクチャ** — career-ops はモデルを同梱しません。
  既存の AI コーディング CLI 内のコマンドとして機能します。
  プロバイダ (Anthropic ↔ Gemini ↔ OpenAI) を切り替えても評価履歴は
  一貫して保たれます。
- **人間が制御する送信** — career-ops は回答を起草しフォームを
  開きますが、**Submit はあなたがクリックします**。本システムは
  自動応募を行いません。システムは構造と評価を提供し、最終的な送信
  権限は人間が保持します。
- **構造化された検索** — 多数の応募を伴う能動的・意図的な求職を
  想定した設計です。単発応募ツールでもレコメンドエンジンでも
  ありません。セットアップは約 15 分、ターミナル操作に慣れていることを
  前提とします。

**career-ops が「やらないこと」** (明示的な非ゴール):

- 自動応募ツールではありません。フォームを代わりに送信しません。
- レジュメ自動再構築ツールではありません。JD ごとに調整しますが、
  存在しない経験を捏造しません。
- LinkedIn 最適化ツールではありません。あなたのプロフィールは
  あなたの責任です。
- SaaS UI の裏に隠れたスプレッドシート代替品ではありません。
  データはファイルシステム上のプレーンな markdown です。

**主要概念** (career-ops が扱うすべての成果物):

| 概念 | 内容 |
|---|---|
| **Mode** | `modes/<slug>.md` 配下のプロンプトテンプレート。組込み: `oferta`、`deep`、`apply`、`pipeline`、`batch`、`contacto`、`followup`、`interview-prep`、`patterns`、`project`、`training`、`ofertas`、`auto-pipeline`、`pdf`、`latex`、`scan`、`tracker`。 |
| **Archetype** | `config/profile.yml` のターゲットロールプロファイル。ルーブリックはアクティブな archetype に対してスキル一致を重み付けします — **単一で最重要のフィールド**です。 |
| **Pipeline** | `data/pipeline.md` — 評価待ちの JD URL の受信箱。 |
| **Tracker** | `data/applications.md` — すべての評価 + 応募ステータスの履歴的な GFM テーブル。 |
| **Report** | `reports/<NNN>-<company>-<DATE>.md` — JD ごとの完全な A–F 評価。ヘッダに score と legitimacy を含みます。 |
| **Scan history** | `data/scan-history.tsv` — 追記専用ログ。スキャン間で重複を防止します。 |
| **Proof points** | `cv.md` から抽出した STAR+R 形式の根拠ブロック。評価・apply 回答・面接準備で再利用されます。 |
| **JD store** | `jds/jd-<date>-<ts>.txt` — 評価時に保存された求人説明の原文。監査証跡用です。 |
| **Interview-prep** | `interview-prep/<company>-<role>.md` — 深掘りリサーチのブリーフとラウンドごとの 1 ページ資料。 |
| **Batch additions** | `batch/tracker-additions/*.tsv` — `batch-runner.sh` によりキューされた、tracker へのマージ待ち行。 |

### career-ops と career-ops-ui (本アプリ)

| | career-ops (CLI) | career-ops-ui (本アプリ) |
|---|---|---|
| 実行場所 | Claude Code / Codex / OpenCode / Qwen CLI 内 | ブラウザの `http://127.0.0.1:4317` |
| 表面 | `/career-ops <mode>` スラッシュコマンド | サイドバー、ワークフローごとに 1 ページ |
| フォーム入力 | あり、Playwright MCP 経由 | なし — チェックリスト生成、CLI で仕上げ |
| PDF | `generate-pdf.mjs` | `📄 Generate PDF` (`#/cv`、`#/reports/:slug`、`#/evaluate`、`#/deep`、`#/interview-prep`) |
| データファイル | career-ops-ui と共有 | career-ops と共有 |

career-ops-ui は **純粋な追加** です。`career-ops/` 内には一切変更が
ありません。両表面は同じ `cv.md`、`config/profile.yml`、
`portals.yml`、`data/`、`reports/`、`interview-prep/`、`modes/` を
共有します。

### Score 別のアクション閾値

JD に評価が付くと、score によって次のステップが決まります (正規表は
[career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
より):

| Score | 次のステップ |
|---|---|
| **≥ 4.5** | `/career-ops apply` を実行 — 高フィット、即応募。 |
| **4.0 – 4.4** | 応募する、または `/career-ops contacto` で先にウォームイントロ。 |
| **3.5 – 3.9** | `/career-ops deep` を実行 — 決定前に会社・ロールを調査。 |
| **< 3.5** | 特別な個人的理由がなければスキップ。 |

career-ops-ui の `#/dashboard` と `#/tracker` は 4.0 以上の行を
ハイライトするので、何も再実行することなくアクションを選べます。

### 外部ドキュメント

スキャン、評価ルーブリック、batch 処理、apply フロー、Playwright
セットアップを含む career-ops エンジンの完全リファレンスは
[career-ops.org/docs](https://career-ops.org/docs) にあります:

- [What is career-ops](https://career-ops.org/docs/introduction/what-is-career-ops)
- [Scan job portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
- [Apply for a job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
- [Batch-evaluate offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
- [Set up Playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright)

---

## 1. クイックスタート — 「CV 作成」から「応募 + メッセージ送信」まで完全ステップ

ボタン単位の正規プレイブックです。初回は順番通りに進めてください。
各ステップは正確なルート、正確なボタン、成功時に表示される内容を
明示しています。第 2 章以降は各フェーズをより詳しく説明します。

> **ワンコマンドで起動と初期化。** ターミナルから、UI に触れずに
> ブートストラップ一式を実行できます:
>
> ```bash
> career-ops-ui setup      # 依存関係のインストール → doctor → サーバー起動
> career-ops-ui init       # LLM プロバイダーを選択し、そのキーを貼り付け (エコーは抑制)
> career-ops-ui doctor     # いつでも再検証 (終了コード 0 ⇔ 必須項目がすべて緑)
> career-ops-ui run        # http://127.0.0.1:4317 でサーバーを起動するだけ
> career-ops-ui open       # ブラウザのダッシュボードタブを開いて最前面に表示
> ```
>
> `setup`/`run` の後、ブラウザタブは自動的に開かれ**最前面に
> 表示**されます (v1.43.0)。`career-ops-ui open` はオンデマンドで
> 同じ動作をするので、ダッシュボードタブを探し回る必要はありません。
> `NO_OPEN=1` でヘッドレス/CI 起動時の自動オープンを無効化できます。
>
> `setup` はチェーン全体を自分で実行します。`init` は `#/config` の
> API キータブが使うのと同じ検証済みパスを通じて、親の
> `career-ops/.env` にキーを書き込み、`LLM_PROVIDER`
> (`auto` | `claude` | `gemini`) を設定します。これはライブの
> evaluate / deep / mode / 自動パイプラインのルートが従います。CI
> 形式:
> `career-ops-ui init --provider claude --anthropic-key sk-ant-… --yes`。
> UI のほうがよいですか? 以下の手順を続けてください。

### A. セットアップ (一度のみ、約 5 分)

**ステップ 1 — `http://127.0.0.1:4317` でアプリを開きます。**
起動していない場合は、リポジトリのルートで `bash bin/start.sh` を
実行します。Dashboard (`#/dashboard`) が読み込まれます。

**ステップ 2 — 左サイドバーの `❤ Health` をクリックします。**
必須チェックがすべて緑である必要があります:

- `cv.md`、`config/profile.yml`、`portals.yml` が存在
- API キーが設定済み (`ANTHROPIC_API_KEY` / `GEMINI_API_KEY` の
  少なくとも一方)
- Playwright がインストール済み (Generate PDF を使う場合のみ必須)

赤がある場合、ページは修正すべき正確なファイル名または環境変数名を
示します。Health が緑になるまで先に進まないでください。

**ステップ 3 — サイドバーの `⚒ App settings` をクリックします。**
**API keys & runtime** タブが開きます。
- `ANTHROPIC_API_KEY` (推奨 — 長文採点の品質が高い) かつ/または
  `GEMINI_API_KEY` を貼り付けます。キーは
  <https://console.anthropic.com/settings/keys> または
  <https://aistudio.google.com/apikey> から取得します。
- **💾 Save** をクリック。続いて **▶ Test Anthropic**
  (または Gemini) をクリック — 小さな往復通信でキーが動作することを
  確認します。

**ステップ 4 — 同じページの `Profile` タブに切り替えます。**
これは `config/profile.yml` の直接 YAML エディタです。
少なくとも以下を編集します:
- `candidate.full_name` — プレースホルダ ("Jane Smith") を
  あなたの実名に置き換える
- `candidate.email`、`linkedin`、`github` — カバーレターで使用
- `target.roles` — 応募する職種タイトル
- `target.comp_total_min_usd` — 最低総報酬。これを下回るオファーは
  全評価のセクション D でフラグされます
- `target.archetypes` — 受け入れるキャリアパターン (最も影響の
  大きいフィールド)

**💾 Save** をクリック。サーバは YAML を検証し、正規の
`# Career-Ops Profile Configuration` ヘッダを刻印します。

### B. CV (一度のみ、約 10 分)

**ステップ 5 — サイドバーの `✎ CV` をクリックします。**
2 カラム: 左にエディタ、右にライブプレビュー。

**ステップ 6 — エディタを埋める方法を 1 つ選びます:**
- **既存のレジュメをアップロード** — **📁 Upload CV** をクリックし、
  `.docx / .doc / .odt / .rtf / .pdf / .html / .txt / .md` の
  いずれかを選択。サーバは pandoc または pdftotext で markdown に
  変換し、XSS をサニタイズしてエディタに挿入します。**変換結果を
  必ずレビュー**してください — 特に PDF はレイアウト忠実度が
  落ちがちです。
- **markdown を直接貼り付け** — テキストエリアは markdown エディタ
  です。右ペインは LLM (および将来のリクルータ) が見る内容です。
- **トーンのコツ:** 箇条書き 1 つ = メトリクス付きの実績 1 つ。
  1500 ワード以内。セクション順: Summary、Experience、Projects、
  Education、Skills。

**ステップ 7 — `💾 Save` をクリック (CV ページの右上)。**
サーバはサニタイズ (`<script>` / `javascript:` / インラインハンドラを
除去) して `cv.md` に書き込みます。トースト: *"Saved"*。

**ステップ 8 (任意) — `📄 Generate PDF` をクリック。** 親プロジェクトの
`generate-pdf.mjs` を実行し (Playwright 必須)、**新規 PDF が完了時に
ブラウザへ自動ダウンロード**されます。ページ下部のリストは過去に
生成されたファイルもすべて保持します。

### C. 求人を探す (スキャンあたり約 2 分)

**ステップ 9 — サイドバーの `🌐 Scan` をクリックします。**
`portals.yml` に関心のあるボードが列挙されていることを確認します
(本ヘルプの第 5 章)。**🌐 Scan now** ボタンを押します。
スキャナーが Greenhouse / Ashby / Lever / Workable / SmartRecruiters
/ Workday (英語圏ボード) と、有効化されていれば hh.ru / Habr
Career (ロシア圏ボード) を巡回する間、ライブ SSE ログがストリーム
表示されます。

**ステップ 10 — スキャン完了後、結果をレビューします。**
任意の会社タグをクリックでフィルタ、↗ アイコンで会社の採用ページを
新規タブで開きます。タイトルフィルタを通過したすべての求人が
Pipeline にキューされます。

### D. オファーを採点する (JD あたり約 30 秒)

**ステップ 11 — サイドバーの `Pipeline` をクリックします。**
スキャナーがキューしたすべての URL が表示されます。エントリを
クリックすると JD がインラインでプレビューされます。

**ステップ 12 — 任意の JD 横の `▶ Evaluate` をクリック。**
`#/evaluate` にジャンプします。API キーが設定されていればライブ実行、
されていなければ手動プロンプトが返り、自分の LLM に貼り付けます。
ライブモードはあなたの CV に対する A–G セクション
(Role / Company / Compensation / Risk / Stretch / Cultural fit /
Verdict) で **0–5 の score** を生成します。Save 先は
`reports/<date>-<slug>.md`。

**ステップ 13 — サイドバーの `Reports` をクリック**して最新の
評価をレビューします。`comp_total_min_usd` 未満のものはセクション D
で赤くフラグされます。`Verdict: pursue` のものがショートリストです。

### E. ショートリスト企業を決定し深掘りリサーチ (約 3 分)

**ステップ 14 — 検討する求人を選びます。サイドバーの `Deep research`
をクリック。** 会社名とロールを入力します。モデルが 7 セクションの
企業ブリーフ (ミッション、最近のニュース、技術スタック、採用
シグナル、報酬ベンチマーク、リスク、推奨アングル) を生成します。
Save 先は `interview-prep/<company>-<role>.md`。

### F. 応募する (応募あたり約 5 分)

**ステップ 15 — サイドバーの `Apply checklist` をクリック。**
求人 URL と JD を貼り付けます。ヘルパーが段階的な送信
チェックリストを生成します:
- ロールに合わせたカバーレター下書き (あなたの `cv.md` +
  `profile.yml` を使用)
- JD からミラーすべき具体的キーワード
- 添付すべきファイル (CV の PDF — ステップ 8 参照)
- 応募先 (アグリゲータのリダイレクトではなく、正規の採用ページ URL)
- リマインダ: **絶対に自動送信しない** — 最終レビューと送信は
  常に手動。

**ステップ 16 — 採用ページを新規タブで開きます。** apply
チェックリストを ToDo リストとして使います。会社の実際のフォームから
送信します。ステップ 8 で生成した PDF を添付します。

**ステップ 17 — 実在の人間に連絡します。**
サイドバーで **Outreach** モード (`#/contacto`) を開きます。
モデルがステップ 14 の会社ブリーフに合わせた短い LinkedIn / メール
メッセージを起草します。冒頭をパーソナライズ (深掘りブリーフからの
具体的な詳細を 1 つ) して送信します。

### G. 追跡とフォローアップ (継続)

**ステップ 18 — サイドバーの `Tracker` をクリック**して応募の
行を追加します: company、role、score、status `Applied`、レポートへの
リンク、深掘りブリーフへのリンク。日付は自動入力されます。

**ステップ 19 — 1 週間後、`Follow-up` モード** (`#/followup`)
**を開きます。** 元の応募を参照する丁寧な確認メールを下書きします。
送信して、tracker のステータスを `Followed up` に更新します。

**ステップ 20 — 面接案内が届いたら、`Interview prep` モード**
(`#/interview-prep`) **を実行します。** 特定の会社 + ステージ
(システム設計 / 行動 / コーディング) 向けの的を絞った準備を生成します。
深掘りブリーフから自動で情報を引いてきます。

**ステップ 21 — オファー獲得? Tracker ステータスを `Offer` に更新**
し、評価レポートの報酬セクションを再確認 — あなたの最低受諾額が
そこに記載されています。

### TL;DR — サイドバーの順序 = ワークフローの順序

`Health → App settings → Profile → CV → Scan → Pipeline → Evaluate
→ Reports → Deep research → Apply checklist → Outreach → Tracker
→ Follow-up → Interview prep → Activity log`

以上です。21 ステップ、ボタン単位で、ゼロからオファーまで。

### ワンクリック Auto-pipeline (`#/auto`) — 21 ステップの近道

特定の求人を素早く採点したいだけなら手動手順を飛ばせます。**サイドバー → ✨ Auto-pipeline**(またはダッシュボードの ✨ ボタン):URL を貼り、**Enter** または **▶ フルパイプライン実行** — サーバが全チェーンを 1 パスで観察可能に実行:

1. **URL 検証** — SSRF 安全チェック(`isValidJobUrl`)。
2. **JD 取得** — `safeGet`(DNS 固定)でダウンロード + サニタイズ。
3. **CV 照合評価** — Anthropic → Gemini → キーなしは手動プロンプト。
4. **レポート保存** — `reports/<slug>.md`(スコア + 正当性)を書き込み。
5. **トラッカー追加** — `data/applications.md` に行を追加。

フィードバックは縦型 **ステッパー**(順序リスト、アクティブ手順に `aria-current`、スクリーンリーダー用ライブ領域)。完了時カードがレポート(**レポート表示 · N/5**)と **トラッカー** へディープリンク。失敗手順はマークされ、ボタン再有効化でリロードなし再試行。**API キーなし?** 手動モード:手順 3–5 が折りたたまれコピー用プロンプト。リンク可:`#/auto?url=<enc>&go=1` で自動開始。
> **CLI (v1.38.0)。** 1 コマンドで全チェーン:`career-ops-ui setup`。動詞:`career-ops-ui doctor`(env/キー/ツール検査 — Health と同一エンジン;必須失敗で exit 1)、`career-ops-ui run`、`career-ops-ui init`(プロバイダ+キーウィザード、v1.39.0)。
> **プロバイダ (v1.39.0)。** API-keys タブに `LLM_PROVIDER` セレクト(`auto`=Anthropic→Gemini · `claude` · `gemini`)と `OPENAI_API_KEY` フィールド(Codex/OpenCode CLI 側)を追加。`career-ops-ui init` が対話ウィザード。
>
> **プロバイダ (v1.57.0)。** ヘッドレス・ライブ評価が **Anthropic → Gemini → OpenAI → Qwen → OpenRouter**（`auto` 順序、`LLM_PROVIDER` で固定）に拡張。**OpenRouter** — `OPENROUTER_API_KEY` 一つで 300+ モデルにアクセス。`OPENROUTER_MODEL` ドロップダウンは OpenRouter のライブカタログを読み込み（サーバ側プロキシ、オフライン時は厳選フォールバック）。さらに修正: 改行/空白付きで貼り付けたキーを検証前にトリムするため、`/#/config` でどのプロバイダでも「validation failed」が出なくなりました。



---

## 2. アプリ設定と API キー (`#/config`)

> **v1.55 → v1.56 の新機能。** LLM キー未設定時は各画面の赤いバナーが ⚡ ライブ実行が手動プロンプトモードであることを示しここへ誘導;キー設定後はアクティブなプロバイダを示す控えめなチップになります。各 ⚡ ライブ実行ボタン(`#/auto`、`#/evaluate`、`#/deep`、モード)の前に正直な推定コストを表示(例:「推定コスト: OpenAI gpt-5-codex · ~$0.04/eval」、手動モードは API コストなし)。`#/scan` は副次フィルタを **詳細フィルター** ディスクロージャへ、`#/tracker` はクリック可能なファネルチップ + 任意のサーバーページネーション、`#/pipeline` は 1000 行超で仮想化。

2 つのタブ:

1. **API keys & runtime** — ブラウザから親プロジェクトの `.env` を
   編集 (career-ops の Node スクリプトが起動時に読むのと同じファイル)。
   このタブはプロバイダ別のモデルセレクタも提供します — `ANTHROPIC_MODEL`・
   `GEMINI_MODEL` と並んで `OPENAI_MODEL`(OpenAI/Codex)。
2. **Profile** — `config/profile.yml` の直接 YAML エディタ。Save 時に
   正規の `# Career-Ops Profile Configuration` ヘッダを刻印します。

どちらのタブでも、保存は即時に反映されます — サーバ再起動は不要です。

**LLM プロバイダのセットアップ(ステップバイステップ)。** web UI の ⚡ ライブ評価は*ヘッドレス*で実行され、1 つの API キーを使用します。"OR" で動作します — これらの**いずれか 1 つ**を設定すればそれだけで動作し、複数設定した場合は `auto` がこの順で優先します:Anthropic → Gemini → OpenAI → Qwen。(career-ops 自体は CLI 非依存です — Claude Code、Codex、Gemini、OpenCode、Qwen、Copilot または Kimi の中でも実行でき、それはこのヘッドレスキーとは別です。)

1. `#/config` → **API keys & runtime** タブを開きます。
2. **`LLM_PROVIDER`** でプロバイダを選びます:`auto`(設定されているキーを使用)、または `claude` / `gemini` / `openai` / `qwen` で 1 つに固定。
3. 選んだプロバイダのキー + モデルを入力します:
   - **Anthropic** — `ANTHROPIC_API_KEY`(console.anthropic.com)を設定、任意で `ANTHROPIC_MODEL`(既定 `claude-sonnet-4-6`)。
   - **Gemini** — `GEMINI_API_KEY`(aistudio.google.com/apikey)を設定、任意で `GEMINI_MODEL`(既定 `gemini-2.0-flash`)。
   - **OpenAI** — `OPENAI_API_KEY`(platform.openai.com)を設定、任意で `OPENAI_MODEL`(既定 `gpt-5-codex`)。
   - **Qwen** — `QWEN_API_KEY`(Alibaba Model Studio / DashScope、dashscope.console.aliyun.com)を設定、任意で `QWEN_MODEL`(既定 `qwen-max`)。中国本土エンドポイントは raw `.env` で `QWEN_BASE_URL` を設定します。
4. **Save** をクリックします。キーは親プロジェクトの `.env` に書き込まれます;変更は即時に反映されます — サーバ再起動は不要です。
5. `#/evaluate` で検証します:求人の URL/説明を貼り付けて **⚡ Run live** を押します。結果ヘッダにどのプロバイダが実行されたか(`anthropic` / `gemini` / `openai` / `qwen`)が表示されます。どこにもキーが設定されていない場合 → 代わりにコピー&ペーストの手動プロンプトが得られます。

シークレットは保存後にマスクされ、決してログ出力されません。モデル id フィールド(`*_MODEL`)はシークレットではありません。

### Profile タブ

> **v1.32.0 — 項目別フォーム。** Profile タブは生 YAML の textarea ではなく、**候補者 / ナラティブ / 報酬** の折りたたみセクションを持つフォームになりました。保存時はモデル化された 14 のスカラーパスのみ送信し、サーバが `config/profile.yml` に **マージ** するため、`archetypes`・`proof_points`・独自キーは **そのまま保持** されます。トレードオフ: 項目保存は YAML を再シリアライズするため **`#` コメントは失われます** — 保持や入れ子配列の編集にはタブ下部の **Advanced: edit raw YAML** を使用してください。
> **v1.35.0 — 配列エディタ。** **Target roles**・**Superpowers**(文字列リスト)、**Archetypes**(name/level/fit)、**Proof points**(name/url/hero-metric)の add/remove エディタを追加。merge-not-replace は同一保証;リストを空にするとキーがクリーンに削除されます。
> **v1.54.3 — Modes タブの構造化フォーム。** `modes/_profile.md` はセクション別の生 markdown エディタではなくなり、文書化されたスキーマから派生したフィールドフォームになりました。リスト型セクション — **Target Roles / Adaptive Framing / Comp Targets** — は繰り返し可能な行項目入力(行の追加/削除)、散文セクション — **Exit Narrative / Location Policy** — はラベル付き textarea としてレンダリングされ、未知または非リストのセクションはラベル付きの逐語 textarea にフォールバックします。保存は **依然としてセクション単位でマージ** — プリアンブル・未編集セクション・カスタムセクションをバイト単位で保持。ファイル全体の編集(セクション追加/削除・プリアンブル編集)用の *Advanced: raw markdown* はそのまま残ります。




- テキストエリアには現在の `config/profile.yml` がそのまま表示
  されます。
- 編集して **💾 Save** をクリック。サーバが YAML を検証し
  (マッピングであること、`candidate` を含むこと) ファイルに
  書き込みます。
- 不足していれば `# Career-Ops Profile Configuration` ヘッダが
  追加されます。
- `#/profile` の読み取り専用サマリは視覚的なコンパニオンです。

### 認識されるキー

| キー | 動作 | 取得元 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic SDK へのライブコールを有効化。Anthropic と Gemini が両方設定されている場合に優先 — JD 採点と深掘りリサーチでの長文構造化出力の品質が高い。 | <https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | デフォルトの `claude-sonnet-4-6` を上書き。難しい推論には `claude-opus-4-7`、安価で高速な用途には `claude-haiku-4-5-20251001` を試してください。 | — |
| `GEMINI_API_KEY` | Anthropic キーがない場合のフォールバック。`gemini-eval.mjs` が `oferta` モードで使用。少量なら無料ティアで動作。 | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | デフォルトの Gemini モデルを上書き。 | — |
| `(server uses default UA)` | ロシア国外から `hh.ru` をスキャンする際に必須 (API は素の User-Agent に対し 403 を返します)。<https://dev.hh.ru/admin> でアプリを登録し、その UA 文字列を使います。 | dev.hh.ru |
| `PORT` | Express のバインドポート。デフォルト 4317。 | — |
| `HOST` | バインドアドレス。デフォルト `127.0.0.1`。`0.0.0.0` を設定すると UI が LAN に公開されます — **まだ認証ゲートはありません**。Production-readiness ドキュメントを参照してください。 | — |

### 動作

- **読取り** (`GET /api/config`) はすべての認識キーを返します。
  シークレットキー (`ANTHROPIC_API_KEY`、`GEMINI_API_KEY`) は
  **マスク**されます — `sk-ant•••••••a1b2` のように見え、完全な値は
  決して表示されません。
- **保存** (`POST /api/config`) は各値を検証し、`<parent>/.env` に
  書き込み、実行中のプロセスに即時適用します。再起動不要。
- **空値で削除** されます。ロシア IP / VPN を使わなくする場合などに
  便利です。

### スモークテストボタン

保存後、**▶ Test Anthropic** または **▶ Test Gemini** をクリック
すると、いずれも小さなプロンプト (出力 ≤256 トークン) を発射し、
ほとんどコストをかけずにキーの結線を確認できます。成功時は約 200 字の
サンプルが返ります。

---

## 3. プロフィール (`#/profile` — `#/settings` でも到達可能)

`config/profile.yml` の読み取り専用サマリカードビューです。
**編集には** **App settings → Profile タブ** (`#/config` → Profile)
へ移動してください。Save は同じファイルに書き込まれ、このページは
リロード時に再パースします。

特に重要なフィールド:

- `candidate.full_name` — すべてのプロンプトで使用されます。
  実運用前に **テンプレートの `Jane Smith` を必ず置き換えて**
  ください。さもないと生成されるカバーレターがプレースホルダ名で
  送信されてしまいます。
- `candidate.email`、`linkedin`、`github` — カバーレター生成と
  apply チェックリストで参照されます。
- `target.roles` — 受け入れる職種タイトル。スキャナーのポジティブ
  フィルタが暗黙にこれを利用します (`portals.yml::title_filter` 経由)。
- `target.comp_total_min_usd` — 最低総報酬。各評価のセクション D で
  これを下回るオファーがフラグされます。
- `target.archetypes` — *最も重要なフィールド*。これらは受け入れる
  キャリアパターン (例: `Tech-Lead-Backend`、`Founding-Engineer`、
  `Data-Platform`) です。各 JD はこれらに照合され、最適な archetype が
  レポートヘッダに記載されます。

Health ページは **Profile customized** チェックを表示し、
`full_name` が既知のプレースホルダ名と一致する限り失敗します。

---

## 4. 履歴書 (`#/cv`)

すべての評価、深掘りリサーチ、カバーレターの唯一の真実源です。
親プロジェクトルートの `cv.md` に保存されます。

### 編集オプション

- **直接貼り付け** — 左のテキストエリアは markdown エディタです。
  右ペインは LLM (および将来のリクルータ) が見る内容を反映します。
- **📁 Upload CV** — 以下のいずれかの形式のローカルファイルを選択
  すると、サーバが markdown に変換します:
  - **テキスト形式** — `.md`、`.markdown`、`.txt`、`.html`、`.htm`
    はそのままパススルー (HTML は pandoc → GFM markdown)。
  - **Office 形式** — `.docx`、`.doc`、`.odt`、`.rtf` は
    **pandoc** で変換 (macOS は `brew install pandoc`、Linux は
    `apt install pandoc`)。
  - **PDF** — `.pdf` は Poppler の **pdftotext** で抽出
    (`brew install poppler` / `apt install poppler-utils`)。
  - 変換された markdown がエディタに挿入されます。**💾 Save** を
    クリックして永続化します。結果はサニタイズされます
    (貼り付けと同じ XSS 除去)。
  - ハード上限: アップロードあたり **10 MB**。それ以上は 413 で
    拒否されます。
- **LinkedIn から** — 最も簡単な経路: 親プロジェクトで Claude Code
  を開き `/career-ops` を実行、LinkedIn URL を貼り付けて
  `extract my CV from this and write it to cv.md` と依頼します。

### サニタイズ対象

サーバ側で、`/api/cv` への各 PUT は `stripDangerousMarkdown` を
通過します:

- `<script>`、`<iframe>`、`<object>`、`<embed>`、`<svg>`、`<style>`、
  `<form>` タグ — すべて完全に除去。
- インラインイベントハンドラ (`onclick=`、`onerror=` など) — 除去。
- `javascript:`、`vbscript:`、`data:text/html` の URI スキーム —
  無害化。

上記のいずれかが除去された場合、レスポンスには `sanitized: true` が
含まれ、ソースに危険な要素があったことを把握できます。

最大ボディサイズ: 1 MB。それ以上は 413 を返します。

### その他のボタン

- **sync-check** — 親プロジェクトで `cv-sync-check.mjs` を実行
  します。不整合をフラグ: CV に記載されているプロジェクトが
  `data/applications.md` の archetypes にない、など。
- **📄 Generate PDF** — `generate-pdf.mjs` をストリーミングで
  実行します。出力先は `output/*.pdf`。Playwright が必要です
  (Health ページが親の `node_modules` でインストール済みかを
  表示します)。生成完了時に **最新の** PDF がデフォルトの
  Downloads フォルダへ自動ダウンロードされ、ページ上のリストは
  過去に生成されたファイルもすべて保持します。

### トーン / フォーマットのコツ

- 箇条書き 1 つ = メトリクス付きの実績 1 つ。
  *"Reduced p99 latency by 38%"* は *"improved performance"* より
  あらゆる評価ルーブリックで優位です。
- セクション順: **Summary** (3–5 行)、**Experience**
  (新→旧の逆時系列)、**Projects** (最大 5)、**Education**、
  **Skills** (重複排除、バズワードの羅列禁止)。
- 1500 ワード以内に抑えてください。採点ルーブリックは情報密度を
  重視し、冗長な CV はノイズとしてペナルティを受けます。

---

## 5. ポータルとソース (`portals.yml`)

スキャナー設定は親ルートの `portals.yml` にあります。重要な
セクションは 3 つです。SPA の 3 セクション (下記) は
[scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals)
の正規スキーマと 1:1 で対応します。

> **ショートカット:** `#/portals` URL は **App settings** に直接
> 解決されるようになり、(地域ソースが設定されている場合は)
> **Regional sources** グループへジャンプします — ブックマークや
> 手入力した `#/portals` リンクはもう 404 になりません (v1.42.0)。

### `title_filter`

```yaml
title_filter:
  positive: [backend, engineer, senior, tech lead, golang, php]
  negative: [junior, intern, frontend, ios, android, java]
  seniority_boost: [Senior, Staff, Lead, Principal]
```

スキャンされた求人は、タイトルに **少なくとも 1 つのポジティブ**
キーワードを含み、かつ **ネガティブキーワードを 1 つも含まない**
場合に通過します。両方を調整してください。キーワードは大文字小文字を
区別しない部分文字列です。

`seniority_boost` は 3 つ目のタイトルフィルタキーです。ここに
列挙されたキーワードは何もフィルタしませんが — マッチした求人を結果の
上位に押し上げ、"Senior Backend Engineer" が "Engineer" より上に
来るようにします。デフォルト: `["Senior", "Staff", "Lead"]`。
ターゲットロールのタイトル付けに合わせて調整してください。

明確化のため、最初は 3–5 個のポジティブキーワードで始め、後で広げます。

### `location_filter` (任意 — web-ui 1.33.0, parent #570)

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

スキャンした求人を **勤務地** 文字列(大文字小文字を区別しない部分一致)でフィルタし、ATS スイープと地域スイープの両方に適用されます。正規の career-ops `scan.mjs` と同一のセマンティクス:

- `location_filter` なし → すべての勤務地が通過(既定)。
- 勤務地が空/欠落 → 通過(欠損データは不利にしない)。
- `block` 一致 → **却下**(block が allow より優先)。
- `allow` 空 → 通過(block で既に除去済み)。
- `allow` 非空 → **少なくとも 1 つ** のキーワードに一致が必要。

`portals.yml` のトップレベルキー(`title_filter` の兄弟、`russian_portals` の下ではない)。

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

`search_queries` は AI 駆動の Option B スキャン (`/career-ops scan` を
Claude Code / Codex 内で実行) を駆動します。インプロセスの
`npm run scan` (パブリックなボード API のみを叩く) では実行
**されません**。`tracked_companies` にまだ含まれていない企業の
ロールを発見したいときに使います。`enabled: false` でエントリを
削除せずに実行を停止できます。

### `tracked_companies`

```yaml
tracked_companies:
  - { name: Stripe,     enabled: true, careers_url: https://job-boards.greenhouse.io/stripe }
  - { name: Linear,     enabled: true, careers_url: https://jobs.ashbyhq.com/linear }
  - { name: JetBrains,  enabled: true, careers_url: https://jobs.lever.co/jetbrains }
```

エントリごとの必須フィールド: `name` と `careers_url`。任意:
`api` (明示的な Greenhouse / Ashby / Lever / Workable /
SmartRecruiters / Workday のエンドポイント)、`enabled: true|false`
で削除せずに含める/除外する。ATS スキャナーは URL パターン
(`job-boards.greenhouse.io/<slug>` → Greenhouse など) から ATS を
検出し、各社のパブリック boards-api を直接取得します。認識可能な
ATS を持たない企業はスキップされます (`/#/scan` の **Active
Companies** カードがグレー `○` で表示します)。

### `russian_portals`

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob"]      # またはいずれか一方
  area: 113                 # 1=モスクワ、2=サンクトペテルブルク、113=ロシア、1001=リモート
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "Senior Go"
    - "Тимлид PHP"
```

`queries` は hh.ru と Habr Career の求人タイトルに対する大文字小文字
非依存の部分文字列マッチです。**ネガティブリストとの重複に注意して
ください** — `"Senior PHP"` が `queries` にあり、`"php"` が
`title_filter.negative` にある場合、スキャンは結果ゼロになり、
コンソールに競合状態の警告が出ます。


### ロシア系ポータルの構成 — 詳細セットアップガイド

v1.29.0 は 5 つのロシア向けアダプタを同梱しています。2 つはデフォルト UA 以上の設定不要(`habr-career` HTML スクレイプ、`trudvsem` 政府オープンデータ API — キーなし、地域制限なし)。2 つはテック系ポータルの HTML スクレイプ(`getmatch`、`geekjob` — キーなし)。1 つは hh.ru 標準 API で、ロシア国外 IP からは **App settings → API keys & runtime** で `HH_USER_AGENT` を設定しないと 403 を返す可能性があります(あるいはロシア IP / VPN を経由)。

#### ソース一覧

| キー | 表示名 | タイプ | 認証 | 地域制限 |
|---|---|---|---|---|
| `hh` | hh.ru | JSON API | 任意 `HH_USER_AGENT` | RU 外 IP は 403 の可能性 |
| `habr` | Habr Career | HTML | なし | なし |
| `trudvsem` | Trudvsem | JSON API(オープンデータ) | なし | なし |
| `getmatch` | GetMatch | HTML | なし | なし |
| `geekjob` | GeekJob | HTML | なし | なし |

#### ステップ 1 — `portals.yml` を開く

ファイルは親プロジェクト `career-ops/` のルートに存在します(`web-ui/` の中ではない)。まだ無い場合は、親プロジェクト同梱のテンプレートをコピーしてください:

```bash
# from the parent career-ops/ root (NOT web-ui/)
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

#### ステップ 2 — 5 ソースを有効化

`russian_portals` ブロックを追加/更新し、スキャンしたい全ソースをリストします。配列順は問いません — スキャナはレジストリ順に呼び出します。

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

#### ステップ 3 — クエリとフィルタの調整

`queries` は、スキャナが各ソースに対して検索する文字列です。各クエリはソースごとに 1 回実行されます — 4 クエリ × 5 ソース = 1 スキャン 20 回呼び出し。スキャン時間を 1 分以内に保つため、リストは 3–7 個に絞ってください。`area` は hh.ru のリージョンコード(他ソースは無視)。`per_page` はクエリあたりの返却件数上限。`only_remote: true` はアダプタレベルでリモートのみフィルタ(結果テーブルにも別途 Remote チップあり)。

#### よくある落とし穴

**Negative リスト衝突。** クエリ内の単語(`"php"`、`"senior"`)が `title_filter.negative` にもある場合、表示前に全結果がフィルタされます。スキャナはスキャン時に stderr 警告を出します — `⚠ config: query "Senior PHP" contains "php" which is in the negative list` の行を 探してください。`negative` から該当語を外して解決します:

```yaml
title_filter:
  positive: [backend, senior, lead, php, go, golang, python]
  negative: [junior, intern, frontend, ios, android]
russian_portals:
  queries:
    - "Senior PHP"     # OK — "php" no longer in negative list
    - "Senior Go"
```

#### 1 ソースを一時的に無効化する

データを削除せずソースを無効化するには、`sources` から該当キーを外すだけです:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem"]   # only 3 of 5 sources will run
```

#### 設定の確認

`portals.yml` を保存後:

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

### CLI ブートストラップフロー ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

正規の career-ops セットアップ (親ルートで一度だけ実行):

```bash
cp templates/portals.example.yml portals.yml
$EDITOR portals.yml
```

これがブートストラップのすべてです。3 つのセクション
(`title_filter`、`tracked_companies`、`search_queries`、任意で
`russian_portals`) を編集し、保存すれば、スキャン準備完了です。

### SPA のブートストラップ動作

初回起動時、`portals.yml` に存在しなければサーバはドキュメント済みの
`russian_portals:` ブロックを追記します — 冪等です (2 回目の起動は
文字列 `russian_portals:` が既にあるため no-op)。英語圏セクションは
**自動注入されません**。上記の正規ブートストラップに従って
`templates/portals.example.yml` をコピーして取得します。

---

## 6. ヘルス (`#/health`)

すべてのセットアップゲートを OK / OPTIONAL / FAIL バッジで表示
します。「動かない」issue を立てる前にこのページを読んでください。

### 必須チェック (これらなしではシステムは機能しません)

- `Node version` ≥ 18 — サーバはネイティブの `fetch` と
  `node:test` を使用します。
- `Project root` — `CAREER_OPS_ROOT` (環境変数または自動検出) が
  存在すること。
- `cv.md`、`config/profile.yml`、`portals.yml`、
  `data/applications.md`、`data/pipeline.md`、`modes/oferta.md`。

### 任意チェック (警告のみ)

- `Profile customized` — `candidate.full_name` がテンプレート
  プレースホルダではないこと。
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — `.env` に設定済み。
- `(server uses default UA)` — ロシア国外から hh.ru をスキャンする
  場合のみ重要。
- `Playwright (parent node_modules)` — PDF 生成と
  `check-liveness.mjs` に必要。
  `cd $CAREER_OPS_ROOT && npm install && npx playwright install chromium`
  でインストール。
- `Parent project dependencies` — 不足していれば
  `cd $CAREER_OPS_ROOT && npm install`。
- `data/`、`reports/`、`output/`、`jds/` ディレクトリ — 初回書込み時に
  自動作成。

サーバがループバック外に公開されている場合 (`HOST=0.0.0.0`)、
レスポンス中の絶対パスと正確な Node バージョンは `"hidden"` に
置き換えられ、好奇心旺盛な隣人があなたのインストールをフィンガープリント
できないようにします。

### 実行ボタン

- **▶ Doctor** は `node doctor.mjs` を実行し、モーダルに出力を
  表示します。
- **▶ Verify pipeline** は `node verify-pipeline.mjs` を実行します。

---

## 7. 検索 (`#/scan`)

スキャナーは有効化されたすべてのボードをクロールし、履歴に対して
重複排除し、ヒットを `data/last-scan.json` と `data/pipeline.md` に
書き出します。

### ワンクリックスキャン (SPA)

**🌐 Scan** はすべての有効ソースを 1 回のスイープで実行します:

- Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
  (ATS スイープ) を、認識可能な ATS URL を持つ `tracked_companies`
  のすべての企業に対して実行。
- hh.ru API + Habr Career + Trudvsem + GetMatch + GeekJob を、`russian_portals` の各クエリに
  対して実行。

**1 クリックで 2 フェーズ(v1.29.2)。** 単一の 🌐 Scan ボタンが ATS スイープと地域スイープの両方を、1 つの SSE ストリーム上で実行します。ログには 2 つのフェーズ見出しが順番に現れます:

1. `▶ ATS scan (Greenhouse + Ashby + Lever)` — EN ATS ボード。
2. `▶ Regional scan (hh.ru + Habr Career)` — レジストリの 5 つの RU ソース。

各フェーズは `✓ done · NEW=N` のサマリで終わります。ATS フェーズしか見えない場合、stand は v1.29.2 より前のビルドです — アップグレードしてください。v1.29.2 より前は SSE クライアントが最初の `done` でクローズし、地域フェーズが静かに失われていました。

ライブ SSE ログがスキャン中に右ペインへストリーム表示されます。
**Stop** をクリック (または単に離脱) すると中断します — サーバは
`AbortController` 経由で進行中の HTTPS リクエストをキャンセルします。

### 結果のフィルタリング

ログの下、結果テーブルは `data/last-scan.json` の行をレンダリング
します。

フィルタ:

- **フリーテキスト** — タイトル / 会社名に対する部分一致。
- **Source** ドロップダウン — Ashby / GeekJob / Greenhouse / GetMatch /
  Habr Career / hh.ru / Lever / SmartRecruiters / Trudvsem / Workable /
  Workday(全 11 件、レジストリから動的構築)。
- **Remote / Hybrid / Onsite** ドロップダウン。
- **スタックチップ** (PHP / Go / Backend / Senior / …) — 行ごとに
  `Skills.detectTech` と `Skills.detectLevel` で自動検出。複数選択は
  積集合 — `PHP + Senior` を選択すると両方を持つ行が表示されます。
- **動的チップ** (静的スタックチップの下) — タイトルから抽出した
  頻出大文字トークンの上位 25。バックエンドエンジニア向けの語彙に
  固定されず、実際にスキャンするロール (マーケティング、デザイン、
  ファイナンス…) に UI が適応します。

### Active Companies カード

`portals.yml` のすべての企業と、そのスキャンステータスを表示する
折り畳み可能なカードです:

- ✓ 緑タグ — 直接 API サポート (Greenhouse / Ashby / Lever /
  Workable / SmartRecruiters / Workday)。
- ○ 灰タグ — ウェブ検索プロンプトへフォールバック (API マッチなし)。

**会社名クリック** → 上の結果フィルタにその名前を入れる。
**↗ アイコンクリック** → 会社の `careers_url` を新規タブで開く。

### CLI スキャンフロー ([scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals))

CLI 側からスキャンする方法は 2 つあります (どちらも SPA が読むのと
同じ `data/pipeline.md` に URL を投入します):

**Option A — ダイレクトスクリプト (約 30 秒、AI トークンゼロ):**

```bash
npm run scan                          # すべての Greenhouse/Ashby/Lever ボード
npm run scan -- --dry-run             # 永続化せずプレビュー
npm run scan -- --company Anthropic   # 1 社の tracked company に絞る
```

Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday
(認識可能な ATS URL) でのみ動作します。AI トークン消費なし —
パブリックボード API を直接叩きます。

**Option B — AI 駆動のブラウザスキャン:**

```
/career-ops scan
```

Claude Code / Codex / Cursor / Gemini CLI 内で実行。モデルトークンを
使います。各 `tracked_companies` のページを直接訪問し、API のない
ボード (採用ページ、カスタム ATS、地域ポータル) も発見できます。
低速ですが広範囲。ATS スイープで結果ゼロでも、採用していると分かって
いるターゲットに対して有用です。

**出力 (両経路共通)** — 新規 JD URL が `data/pipeline.md` に追記され、
訪問済み URL は `data/scan-history.tsv` にログ (今後のすべての
スキャンで重複排除)、サマリ出力: スキャンした企業 · 発見した求人 ·
タイトルでフィルタされた件数 · 重複スキップ · 新規追加オファー。

**Score 別のアクション閾値** (`/career-ops pipeline` が新規 URL を
バッチ採点した後に適用):

| Score | 推奨される次のステップ |
|---|---|
| **≥ 4.5** | `/career-ops apply` — 高フィット、即応募 |
| **4.0 – 4.4** | 応募、または `/career-ops contacto` でウォームイントロ |
| **3.5 – 3.9** | `/career-ops deep` — まず調査 |
| **< 3.5** | 特別な個人的理由がなければスキップ |

SPA の `#/dashboard` と `#/tracker` は 4.0 以上の行をハイライト
するので、何も再実行することなくアクションを選べます。

### フォローアップコマンド

採点後、正規のフォローアップは以下のとおりです:

- `/career-ops apply` — ロールに合わせた回答で応募フォームを記入
- `/career-ops contacto` — LinkedIn / メールアウトリーチを下書き
- `/career-ops deep` — 会社 / ロールを深く調査
- `/career-ops tracker` — pipeline のステータスを表示

---

## 8. パイプライン (`#/pipeline`)

評価待ち URL の受信箱です。`data/pipeline.md` に保存されます。

### URL の追加

3 通り:

- 入力欄に URL を入力 / 貼り付けて **+ Add** をクリック。
- **Ctrl+K** (または **Cmd+K**) でグローバル検索にフォーカス、
  `http(s)://…` リンクを貼り付けて **Enter** — URL は即座に
  pipeline に追加されます。
- スキャンを実行 (上記) — 新規ヒットは自動で pipeline に追加。

すべての URL はサーバ側で `isValidJobUrl()` を通ります。ループバック
(`localhost`、`127.0.0.1`)、`file://`、`javascript:`、IP リテラル、
テンプレート文字 (`<`、`>`、`"`) を含む文字列はすべて 400 で
拒否されます (SSRF 対策)。

### サーバサイドプレビューペイン

任意の pipeline 行をクリックすると、右にプレビューがロードされます。
ほとんどの ATS ボードは CORS ヘッダを送らないため、ブラウザは直接
取得できません。サーバがリクエストをプロキシし、`<script>` /
`<style>` / HTML タグを除去して、最大 8 KB のプレーンテキストを
返します。

プレビュープロキシはリダイレクトを手動で辿り、**ホップごとに SSRF
検証** を実施します — 各 `Location` ヘッダは再度
`isValidJobUrl()` を通るので、敵対的なボードがあなたをループバック
/ プライベート IP / `file://` へ跳ね返すことはできません。3 ホップ、
15 秒のタイムアウトでキャップされています (TOCTOU と再バインド攻撃
対策)。

### 行アクション

- **▶** — URL を事前入力した `#/evaluate?url=…` へジャンプ。
- **✕** — `data/pipeline.md` から URL を削除。

### 右上ボタン

- **⚡ Evaluate first** — キューの最初の URL を Evaluate ページで
  採点可能な状態で開きます。
- **Scan** — さらに URL が欲しい場合にスキャナーへ戻ります。

---

## 9. 評価 (`#/evaluate`)

1 件の求人説明 (JD) を `cv.md` と `config/profile.yml` に対して
採点します。`modes/oferta.md` に従って構造化された A–G 評価と
0–5 score を返します。

### 入力

JD をテキストエリアに貼り付けるか、`#/pipeline` から `?url=<href>`
付きで到達した場合 — ページが pipeline プレビューと同じ SSRF セーフな
プロキシを通して URL を取得し、テキストエリアに事前入力します。

**💾 Save JD** をクリックすると JD を `jds/jd-<date>-<ts>.txt` に
永続化します (監査証跡用)。API 呼び出しで `save: true` を渡しても
同じ効果が得られます。

### フォールバックチェーン

1. **Anthropic** — `ANTHROPIC_API_KEY` が設定されている場合に優先。
   サーバはプロンプトの前に `cv.md`、`config/profile.yml`、
   `modes/_shared.md`、`modes/oferta.md` を `<project_context>`
   ブロックに束ねます (各ファイル 16 KB でキャップ、フルプロンプトは
   200 KB のソフトキャップ)。グラウンディングされた markdown を
   直接ページに返します。
2. **Gemini** — `GEMINI_API_KEY` のみが設定されている場合。
   サーバが JD を一時ファイルとして `gemini-eval.mjs` を spawn
   します。無料ティアモデル (`gemini-2.0-flash`) は通常の採点には
   十分です。
3. **手動** — キー未設定。ページは Claude Code、ChatGPT、または
   他の任意の LLM に貼り付けられる完全な形のプロンプトを返します。

### 出力セクション (正規 career-ops.org A-F)

> **v1.15.0 リアラインメント。** ブロックレターは
> [正規 career-ops.org スキーマ](https://career-ops.org/docs)
> と一致するようになりました。v1.15 以前のレポートは A–G
> (`C=Risks`、`F=Verdict`、`G=Legitimacy`) を使っていました。
> 後方互換性のためそのまま描画しますが、新規レポートは以下の
> 正規セマンティクスで A–F を出力します。Score と Legitimacy は
> レポートヘッダに移動しました (`score: 4.2/5`、
> `legitimacy: High|Medium|Low`)。

A. **Role Summary** — 3 つの箇条書きで要約 (リスクはインラインで明示)。
B. **CV Match** — 上位 3 つの一致スキル + 上位 3 つの不足スキル。
C. **Strategy** — 推奨: 即応募 / 先に contacto / 先に deep /
スキップ。v1.15 以前は `Risks` でした。
D. **Compensation** — `target.comp_total_min_usd` (レガシー)
または `compensation.target_range` (正規) に対する相対評価。
E. **Personalization** — リードするアングル、archetype ごとの
フレーミング、カバーレター / アウトリーチで触れるフック。v1.15
以前は `Application Strategy` でした。
F. **STAR stories** — ロールに合わせた、貼り付け可能な S-T-A-R
ブロック 1–3 件。v1.15 以前は `Verdict` (生 score) でした。
score は現在 `legitimacy` と並んでレポートヘッダに表示されます。

### レポートの保存

**💾 Save report** をクリック (または API 呼び出しの save トグル) で
markdown を `reports/<date>-<company>-<role>.md` に永続化します。
レポートのパース済みヘッダ (Score / Legitimacy / URL) は
**Reports** ページと **Dashboard** に表示されます。

### 10 件以上の JD があるならバッチ評価

単一 JD には `#/evaluate` ページが最適ツールですが、pipeline に
キューされた 10 件以上の URL に対しては JD ごとのクリックスルーは
非現実的です — 第 14 章の **Batch evaluate** サブセクション (親で
`./batch/batch-runner.sh` を実行) にジャンプして一晩回し、結果を
`#/reports` / `#/tracker` で確認してください。完全フローは
[batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)。

---

## 10. レポート (`#/reports`)

保存されたすべての評価をブラウズします。カードはタイトル、日付、
legitimacy フラグ、score (色分け: 緑 ≥ 4.0、黄 ≥ 3.0、それ未満は赤)
を表示します。

カードをクリックすると完全な markdown を読めます。ページネーション:
1 ページ 12 件、下部にコントロール。

単一レポートビューにはさらに:

- **← All reports** — グリッドに戻る。
- **🔗 Open JD** — 元の求人投稿を新規タブで開く。

---

## 11. トラッカー (`#/tracker`)

CRM です。応募 1 件 = 1 行。`data/applications.md` に GitHub
Flavored Markdown テーブルとして保存されます。

### ステータスフロー

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` /
`Rejected` / `Discarded` / `SKIP`。

ステータスのホワイトリストはサーバサイドで強制されます。
`POST /api/tracker` に他の値を送ると `Evaluated` にデフォルト
されます。正規の `Evaluated → Applied` 遷移は、`/career-ops apply`
の最後で `Submitted.` を確認した時点で自動的に発生します (第 14 章
参照)。

### 列レイアウト

| 列 | 内容 |
|---|---|
| `#` | 自動採番、ゼロパディング (`001`、`002`、…)。 |
| `Date` | ISO 日付 (`YYYY-MM-DD`)。デフォルトは当日。 |
| `Company` | フリーテキスト。**パイプ (`\|`) と改行は自動エスケープされます。** |
| `Role` | 同上。 |
| `Score` | `N/5` 形式 (例: `4.2/5`)。 |
| `Status` | ホワイトリスト化された列挙型。 |
| `PDF` | 該当行で `generate-pdf.mjs` が成功すると ✅。 |
| `Report` | 対応する `reports/*.md` への markdown リンク。 |
| `Notes` | フリーテキスト、200 文字でキャップ。 |

### フィルタ

- **Status** ドロップダウン。
- **Score** ドロップダウン — `≥ 4.0` (高)、`≥ 3.0` (中)、
  `< 3.0` (低)。
- **Search** — company + role に対する部分一致。

すべてのフィルタは paginator を 1 ページ目にリセットします。
1 ページ 25 行。

### メンテナンスボタン

- **▶ Normalize** は `normalize-statuses.mjs` を実行 — ステータスの
  綴りを正規化 (`applied` → `Applied`、`interview` → `Interview`)。
- **▶ Dedup** は `dedup-tracker.mjs` を実行 — `(company, role)` を
  キーに大文字小文字非依存で重複行を削除。
- **▶ Merge** は `merge-tracker.mjs` を実行 —
  `batch/tracker-additions/*.tsv` (親の batch フローが Apply ヘルパー
  経由で投入した応募を置く場所) からペンディングエントリを取り込み
  ます。重複排除し、処理済みファイルは
  `batch/tracker-additions/merged/` にアーカイブします。上流の
  batch フローは
  [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers)
  を参照してください。

### 行の追加

`POST /api/tracker` — ボディ `{ company, role, score?, status?,
url?, reportSlug?, notes?, date? }`。`(company, role)` を
大文字小文字非依存で重複排除します。UI からは、Evaluate ページが
採点成功後に "Add to tracker" ボタンを提供します。

---

## 12. 深掘りリサーチ (`#/deep`)

構造化された企業ブリーフを生成します: スナップショット、エンジニア
リング文化、最近のニュース、Glassdoor センチメント、面接プロセス、
交渉のレバレッジポイント、リクルータに尋ねるべき賢い質問 3 つ。

### 入力

2 つのフィールド — 会社名と (任意) ロール。構造はモードテンプレート
(`modes/deep.md`) によって形作られます。

### 出力経路

Evaluate と同じフォールバックチェーン:

1. **Anthropic ライブ** (推奨) — `bundleProjectContext` が
   cv + profile + `_shared.md` + `deep.md` をインライン化します。
   出力: グラウンディングされた 10–30 KB の markdown を
   `interview-prep/<company>-<role>.md` に保存。
2. **Gemini ライブ** — `gemini-eval.mjs` の呼び出し。保存先は同じ。
3. **手動プロンプト** — ページが Claude Code (WebFetch +
   WebSearch を持ち実リサーチが可能) 向けの即使用可能なプロンプトを
   返します。

### コツ

- `claude-sonnet-4-6` での Anthropic は通常、呼び出しあたり 1–3 分で
  約 13 KB の有用なテキストを返します。
- Anthropic SDK には組込みのウェブ検索がありません。最新ニュースや
  Glassdoor センチメントが必要なロールでは、手動プロンプトを Claude
  Code に貼り付け、その WebFetch ツールを使ってください。
- ライブ実行は課金されます。Sonnet 4.6 の深掘りリサーチ 1 回で
  約 $0.30–0.50 です。

---

## 13. モードプロンプト (7 つの `/#/<mode>` ページ)

7 つのプロンプトビルダー: **Project** アイデア、**Training**
プラン、**Follow-up** メール、**Batch** 評価、リクルータへの
**Outreach**、**Interview prep** 1 ページ資料、**Patterns**
レトロスペクティブ。それぞれが特定の `modes/<slug>.md` テンプレートを
ラップします:

| ページ | Slug | 目的 |
|---|---|---|
| `#/project` | `project` | ターゲットロール向けのポートフォリオプロジェクトを調整。 |
| `#/training` | `training` | スキルギャップ分析 → カリキュラム。 |
| `#/followup` | `followup` | 面接後のメール下書き。 |
| `#/batch` | `batch` | 複数 JD のバッチ評価プロンプト。 |
| `#/contacto` | `contacto` | リクルータ / リファラルへのアウトリーチメッセージ。 |
| `#/interview-prep` | `interview-prep` | 特定の面接ラウンド向けの 1 ページ準備資料。 |
| `#/patterns` | `patterns` | 「成功パターンは何か?」の内省分析。 |

### 共通の形

各ページは小さなフォーム (フィールドはモード固有)、**▶ Generate
prompt** ボタン (手動)、そして — Anthropic または Gemini キーがあれば
— プライマリに昇格する **⚡ Run live** ボタンを持ちます。

**▶ Generate prompt** をクリックすると、フォーム値を JSON
シリアライズした `User-supplied context:` ブロックに、その後に
`modes/<slug>.md` テンプレートを逐語的に付けた組み立て済みプロンプトを
返します。コピーして好みの LLM に貼り付けます。

**⚡ Run live** をクリックすると同じプロンプトを Anthropic
(または Gemini) に送ります。`bundleProjectContext` 経由で `cv.md` +
`profile.yml` + `_shared.md` をインライン化します。結果はページに
描画され、コピー可能、`.md` としてダウンロード可能です。

7 つのページは明示的なホワイトリストです。専用ルートを持つモード
(`oferta` → Evaluate、`deep` → Deep research) と、親プロジェクトが
Claude Code 内でのみサポートするモード (`apply`、`scan`、
`pipeline`、`tracker`、`pdf`、`latex`、`ofertas`、`auto-pipeline`)
は意図的にこの UI から外されています。

---

## 14. 応募チェックリスト (`#/apply`)

応募を決めたら、この Apply ヘルパーページが実際の応募ステップ用の
送信チェックリストを生成します。フォームの自動入力は **行いません**
— そのフローは親プロジェクトの Playwright を使う Claude Code 内の
`/career-ops apply` に残されています。

### SPA チェックリストモード (`#/apply`)

SPA のチェックリストは、Playwright を起動せず手動でフォームを
埋めたいユーザ向けです。以下を含みます:

0. Claude Code で `/career-ops apply <url>` を実行し、Playwright で
   フォームを読み取り (手動入力なら本ステップはスキップ)。
1. 投稿がまだ有効かを確認 (`check-liveness.mjs`)。
2. CV が最新かを確認 (`cv-sync-check.mjs`、score ≥ 4.0 なら PDF)。
3. `cv.md` の STAR+R 根拠点を使い、カバーレター / "Why us?" 回答を
   ロールに合わせる。
4. EEO / スポンサーシップ / 開始日の質問に正直に回答。
5. 入力済み回答を `interview-prep/{company}-{role}.md` に送信前に
   保存。
6. **絶対に自動送信しない** — 最終ボタンは人間 (あなた) がクリック。
7. 送信後: `data/applications.md` に行を追加 (または TSV を
   `batch/tracker-additions/` に書く)。

### 手動入力 vs Playwright 支援

実送信には 2 つのルート:

- **手動** — 通常のブラウザタブで採用ページを開き、上記の SPA
  チェックリストに従い、回答をコピペします。Playwright 不要です。
  フォームが短いか、Chromium をインストールしていない場合に使用。
- **Playwright 支援** — Claude Code (親プロジェクト) で
  `/career-ops apply <company>` を実行。Playwright が独自のブラウザを
  開き、すべてのフォームフィールドを読み、番号付きの下書き回答を
  返します。Submit はあなたがクリックします。フォームが長い、
  動的、またはどの質問にどう答えたかの監査証跡が欲しい場合に使用。

### 完全な CLI apply フロー ([apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job))

**前提条件:**

1. まず `/career-ops pipeline` を実行し、JD が `reports/` 配下に
   評価レポートを持っている状態にします。apply コマンドは既存の
   評価に依存します。なければ最初に pipeline を実行してください。
2. レポートとプロフィールがロード済み。
3. **推奨:** Playwright がインストール済み
   (`npx playwright install chromium` — 下記 Playwright Setup
   参照)。なければ WebFetch (テキストのみのフォームプレビュー、
   クリック入力なし) にフォールバックします。

**番号付きフロー** (正規 8 ステップ):

1. **コマンドを実行**、会社名を指定:

   ```
   /career-ops apply <company>
   ```

   例: `/career-ops apply Anthropic`。引数なしの場合、次のターンで
   フォームのスクリーンショット、フォームテキストの貼り付け、または
   応募 URL を供給します。

2. **レポートを特定。** システムは `reports/` 内の対応する評価
   (`/career-ops pipeline` または以前の `#/evaluate` で作成された
   もの) を見つけます。

3. **フォームを開く。** Playwright がブラウザウィンドウを
   **自動的に**起動 — 自分で開く必要はありません。

4. **フィールドを読む。** システムはすべてのフォームフィールド
   (ラベル、型、required、select の選択肢) を読み取りパースします。

5. **回答を生成。** career-ops はプロフィール、根拠点、ロールに
   基づいて各フィールド向けにカスタマイズされた回答を作成します。

6. **番号付きリストを返す。** フォームレイアウトに合わせて並べられた
   回答が返ります — シンプルなフィールド (名前、メール) が先、
   フリーテキストフィールド (カバーレター、"Why us?") は後。
   フラグ付きの項目は人間の判断が必要なもの — 給与アンカー、
   レジュメの不足詳細、任意質問 — を指し示します。

7. **手動入力。** あなたが各回答を対応するフィールドにコピペします。
   このステップは手動、自動化されません。各回答を必ず先にレビュー
   してください。

8. **ユーザが送信。** Submit はあなた自身がクリック。career-ops は
   **絶対に** Submit をクリックしません。チャットで以下を入力して
   完了を確認:

   ```
   Submitted.
   ```

**`Submitted.` 時の自動更新:**

- `data/applications.md` でステータスが `Evaluated → Applied` に
  反転。
- 入力済み回答は将来の参照のためレポートのセクション G に
  永続化されます。

**Tracker への引き渡し:**

```
/career-ops tracker
```

ロールの score に関係なく、pipeline 全体のステータスを監視します。

### バッチ評価 ([batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers))

一度に 10 件以上の JD を採点する場合 (SPA の 1 件ずつの
`#/evaluate` はそのボリュームには非現実的)、CLI のバッチランナーを
使います。

**入力ファイル — `batch/batch-input.tsv`** (タブ区切り):

| 列 | 目的 |
|---|---|
| `id` | 一意の連番 |
| `url` | 求人投稿の完全リンク |
| `source` | 出所プラットフォーム (LinkedIn、Greenhouse など) |
| `notes` | 任意のコンテキスト詳細 |

行の例:

```
1<TAB>https://jobs.example.com/senior<TAB>LinkedIn<TAB>
```

**`./batch/batch-runner.sh` のフラグ:**

- `--dry-run` — 評価せずペンディングのオファーをプレビュー。常に
  最初にこれを実行して TSV を検証してください。
- `--parallel N` — N 個のワーカーを同時実行 (推奨は 1、2、または 3)。
- `--min-score X.X` — 閾値未満のオファーは永続化をスキップ。高
  フィットロールのレポートのみ保持したい場合に便利。
- `--retry-failed` — 前回ランでエラーになったオファーのみ再処理
  (ネットワーク失敗、レート制限)。
- `--max-retries N` — 失敗したオファーを N 回まで再試行
  (デフォルト: 2)。
- `--model NAME` — `claude -p --model` に渡す Claude モデル (career-ops 1.8.0, #504)。未設定 = Claude Max サブスクリプションの既定モデル。大規模バッチには安価なモデルを、例: `claude-sonnet-4-6`。`#/batch` では **モデル** 入力として表示 (web-ui 1.31.0)。
- `--start-from N` — N 未満のオファー ID をスキップ (部分処理済みバッチを再開)。`#/batch` では **開始 #** 入力として表示 (web-ui 1.31.0)。

**標準シーケンス:**

1. `batch/batch-input.tsv` を **編集** — JD ごとに 1 行。

2. **ドライラン** (まず推奨):

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **実行** — 逐次または並列:

   ```bash
   ./batch/batch-runner.sh                       # 1 件ずつ
   ./batch/batch-runner.sh --parallel 2          # 同時 2 件
   ./batch/batch-runner.sh --parallel 3          # 同時 3 件
   ./batch/batch-runner.sh --parallel 2 --min-score 4.0  # 高フィットのみ永続化
   ```

4. **失敗の再試行** (ネットワーク / レート制限):

   ```bash
   ./batch/batch-runner.sh --retry-failed --max-retries 3
   ```

5. **レポート** は `reports/` 配下に
   `{id}-{company}-{YYYY-MM-DD}.md` として作成されます。サマリ行は
   `batch/tracker-additions/` に追記されます。

6. **Tracker にマージ:**

   ```bash
   node merge-tracker.mjs                 # バッチ追加を適用
   node merge-tracker.mjs --dry-run       # マージのプレビュー
   ```

   マージコマンドはエントリを重複排除し、処理済みファイルを
   `batch/tracker-additions/merged/` にアーカイブします。

SPA は結果のレポートを `#/reports` (ページネーション、score
ピル色付け) に、tracker 行を `#/tracker` に — `#/evaluate` から
1 件ずつ追加したのと全く同じように — 表面化します。CLI に降りたく
ない場合は `#/tracker` の **▶ Merge** メンテナンスボタンと
ペアで使ってください。

### Playwright セットアップ ([set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright))

career-ops の以下 2 つの機能に必須です:

- **フォーム入力** (`/career-ops apply` の上記ステップ 3 —
  Playwright がブラウザを開き、フィールドラベルを読み、回答を提案)。
- **PDF 生成** (`/career-ops pdf` と SPA の **📄 Generate PDF**
  ボタン: `#/cv` / `#/reports/:slug` / `#/evaluate` / `#/deep` /
  `#/interview-prep`)。

**Playwright がない場合のフォールバック:** apply フローは
WebFetch (テキストのみのフォームプレビュー、クリック入力なし) に
フォールバックします。PDF 生成は単にエラーになります。

**コアセットアップ (career-ops 親ルートで実行):**

```bash
# Playwright 用の Chromium をインストール
npm install
npx playwright install chromium

# Playwright MCP を登録し Claude Code がフォームを駆動できるように
claude mcp add playwright npx @playwright/mcp@latest

# 3 つのコンポーネント (Chromium、Playwright lib、MCP) を検証
npm run doctor
```

**代替の MCP 登録方法** — `.claude/settings.local.json` に追加:

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

**動作の注意点:**

- **デフォルトはヘッドレス。** Playwright は静かに動作します。
  ブラウザの動作を見たい場合は Claude に
  `open up with playwright the browser and fill out the entire form.`
  と伝えてください。
- **1 つのパッケージで 3 役** — Playwright の npm インストールで、
  ブラウザ自動化ライブラリ、`/career-ops pdf` の PDF レンダリング
  エンジン、(MCP 経由で) Claude Code 内のフォーム入力ワークフローが
  揃います。
- **依存する前に検証** — `npm run doctor` で 3 つすべてが動作中で
  あることを確認できます。SPA の Health ページは欠けていれば即時
  失敗する `Playwright (parent node_modules)` チェックを表示します。

---

## 15. 面接準備

これはリサーチ後、面接前のフェーズです。本アプリの 3 つの成果物が
収束します:

1. **保存済み深掘りリサーチファイル** (`interview-prep/` 配下)、
   実行した company-role ペアごとに 1 つ。**Deep research** ページ
   または `/api/interview-prep` エンドポイント経由でブラウズします。
2. **Patterns モード** (`#/patterns`) — 自己内省プロンプトを生成:
   「直近 N 回の面接 / オファー / 不合格を通じて、どんなパターンが
   保たれているか?」 tracker 行が 5 件以上溜まったときに有用。
3. **Interview-prep モード** (`#/interview-prep`) — 特定の今後の
   ラウンド (行動、技術、システム設計) 向けに 1 ページ資料を事前
   入力。出力は同じ `interview-prep/` フォルダへ。

### 推奨ワークフロー

予定されている各面接について:

1. **Deep を再実行** (または保存済みファイルを開く) を前日に。
2. **`#/interview-prep`** — 特定ラウンド向けに 1 ページ資料を
   生成。自分のノートに貼り付けます。
3. **システム設計 / コーディングラウンド** — `#/training` を開き、
   JD が強調する特定サブシステムについて 30 分の的を絞った
   リフレッシュを依頼。
4. **報酬ラウンド** — 深掘りリサーチファイルを開き「Negotiation
   leverage points」へ。具体的なデータポイントを 2–3 件
   (Glassdoor のバンド、最近の資金調達、他社の同等オファー) 持参。
5. **行動ラウンド** — 元の Evaluate レポートのセクション B に
   入った STAR+R ストーリーを `cv.md` から引いてくる。

面接後、すぐに:

1. tracker 行を更新: ステータス → `Responded` (続いて
   `Interview`、`Offer` など)。
2. `#/followup` を実行してお礼メールを下書き。
3. 新しい情報 (報酬レンジ、チーム構成、技術スタックの意外な点) が
   あれば、保存済み `interview-prep/<company>-<role>.md` を
   `## Post-round notes` で編集し、未来の自分が参照できるように
   します。

---

## 16. アクティビティログとトラブルシューティング

### アクティビティログ (`#/activity`)

サーバに到達した、状態を変更するすべてのリクエストの監査証跡です。
記録対象: pipeline 追加、tracker 書込み、CV 保存、JD 保存、
evaluate 実行、deep-research 実行、scan 実行、設定変更、モード
実行。

シークレット (`ANTHROPIC_API_KEY`、`GEMINI_API_KEY`) は受信時に
編集 (redact) されます。`data/activity.jsonl` で実キー値を目に
することはありません。

アクションプレフィックス (`pipeline.`、`cv.`、`evaluate`、
`scan.` など) でフィルタ可能。1 ページ 25 行、サーバは直近最大
500 イベントを返します。

### トラブルシューティング

| 症状 | 想定される原因 | 修正 |
|---|---|---|
| Health ページが `cv.md` で赤 | 初回起動、ファイルがまだ存在しない | `touch $CAREER_OPS_ROOT/cv.md` してリロード。 |
| Health が `Profile customized` で赤 | `candidate.full_name` がまだ `Jane Smith` | `config/profile.yml` を編集。 |
| スキャンログで `hh.ru: HTTP 403` | ロシア国外 IP、`(server uses default UA)` 未設定 | `dev.hh.ru/admin` で登録、ロシア IP / VPN を設定。 |
| `gemini-eval.mjs: ERR_MODULE_NOT_FOUND` | 親プロジェクトの依存が未インストール | `cd $CAREER_OPS_ROOT && npm install`。 |
| Generate PDF がエラー | 親に Playwright が未インストール | `cd $CAREER_OPS_ROOT && npx playwright install chromium`。 |
| `/career-ops apply` が "no report found" | この JD で pipeline がまだ採点していない | まず `/career-ops pipeline` (または `#/evaluate`) を実行; 第 14 章の前提条件を参照。 |
| `batch-runner.sh: no such file` | 間違ったディレクトリで実行 | `cd $CAREER_OPS_ROOT` してから `./batch/batch-runner.sh` を起動。 |
| サーバが `EADDRINUSE: 4317` を報告 | 古いインスタンスがまだ実行中 | `pkill -f 'node server/index.mjs'` してから再起動。 |
| ライブ LLM 呼び出しが 2 分超ハング | プロンプトが巨大、または Anthropic が低速 | `/api/health` の Anthropic フラグを確認; サーバはプロンプトを 200 KB でソフトキャップし 413 を返します。 |
| Pipeline プレビューに `(unsafe redirect)` | 投稿がプライベート IP / ループバックへリダイレクト | これはセキュリティ機能です (REVIEW-B1)。リダイレクト先は拒否され、元の URL は変更されません。 |
| Tracker 行のテキストがテーブルを壊す | v1.9.1 以前で会社名にパイプ | v1.9.1 以上へ更新 — パイプはエンドツーエンドでエスケープされます (BF-1)。 |
| 新規クローンで `npm test` が失敗 | テストが親プロジェクトレイアウトを仮定 | `CAREER_OPS_ROOT=$(mktemp -d)` を使ってフィクスチャをブートストラップ。 |

より詳細な診断には: Health ページで **▶ Doctor** を実行し、出力を
コピーし、issue トラッカー
<https://github.com/Fighter90/career-ops-ui/issues> を検索して
ください。


---

## 17. 新しい求人ポータルソースを追加する方法

career-ops-ui は各求人サイトを **アダプタ** として扱います — [`server/lib/sources/<slug>.mjs`](../../server/lib/sources/) 配下の 1 ファイルが、1 サイトの結果取得と正規化の方法を持ちます。v1.29.0 では 11 個のアダプタ(英語圏 ATS 6 個、ロシア系ボード 5 個)が同梱されています。12 個目を追加するには、本リポジトリ内で短い編集を 3 か所、加えて親プロジェクトの `portals.yml` に 1 行追加すれば完了です。

### ステップ 1 — アダプタを書く

`server/lib/sources/<slug>.mjs` を作成します。JSON API があるソース向け:

```js
// server/lib/sources/example.mjs
const ENDPOINT = 'https://example.com/api/v1/vacancies';

export async function searchExample(query, opts = {}) {
  const { onlyRemote = false, fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(`${ENDPOINT}?text=${encodeURIComponent(query)}`, {
    signal,
    headers: { Accept: 'application/json' },
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
    source: 'example',
  };
}
```

### ステップ 2 — レジストリに 1 行追加

[`server/lib/sources/registry.mjs`](../../server/lib/sources/registry.mjs) を開き、エントリを追加します:

```js
export const SOURCES = [
  // …existing entries…
  { value: 'example', label: 'Example.com', region: 'ru', configKey: 'example' },
];
```

### ステップ 3 — ディスパッチャに配線(RU のみ)

EN アダプタは `tracked_companies` から自動検出されます。RU の場合は [`server/lib/ru-scanner.mjs`](../../server/lib/ru-scanner.mjs) を開き、`RU_DISPATCH` に 1 行追加します:

```js
import { searchExample } from './sources/example.mjs';
// …
const RU_DISPATCH = {
  // …existing…
  example: { label: 'example.com', search: searchExample },
};
```

### ステップ 4 — テスト(モック、ライブネットワーク禁止)

テストにおける実ネットワークは **禁止** されています(CI-isolation 契約)。アダプタにモックの `fetchImpl` を渡してください — [`tests/sources-trudvsem.test.mjs`](../../tests/sources-trudvsem.test.mjs) を参照。

### ステップ 5 — 自分の `portals.yml` で有効化

親プロジェクトの `portals.yml` はユーザ所有の設定です。新しいソースの `configKey` を配列に追加します:

```yaml
russian_portals:
  sources: ["hh", "habr", "trudvsem", "getmatch", "geekjob", "example"]
```

ブラウザで `#/scan` をリロードしてください。ソースフィルタのドロップダウンは新エントリを自動取得します(`GET /api/scan/sources` → `registry.mjs` が単一情報源)。

**完全なコード例(HTML スクレイプアダプタ、よくある落とし穴、参照アダプタ表)は、本セクションの英語版 [docs/help/en.md §17](https://github.com/Fighter90/career-ops-ui/blob/main/docs/help/en.md#17-how-to-add-a-new-job-portal-source) を参照してください。**

### 参照アダプタ(新ソースはこれらをミラーする)

| アダプタファイル | 種別 | 備考 |
|---|---|---|
| [`hh.mjs`](../../server/lib/sources/hh.mjs) | JSON API | 標準 RU API アダプタ。ジオ対応 UA フォールバック。 |
| [`trudvsem.mjs`](../../server/lib/sources/trudvsem.mjs) | JSON API | ロシア政府オープンデータ。IP ゲートなし。 |
| [`habr.mjs`](../../server/lib/sources/habr.mjs) | HTML スクレイプ | ロシアの技術系掲示板。正規表現ベースのカードパーサ。 |
| [`getmatch.mjs`](../../server/lib/sources/getmatch.mjs) | HTML スクレイプ | 防御的パーサ。パース失敗時は `[]`。 |
| [`geekjob.mjs`](../../server/lib/sources/geekjob.mjs) | HTML スクレイプ | GetMatch と同じ防御的スタイル。 |
| [`greenhouse.mjs`](../../server/lib/sources/greenhouse.mjs) | JSON API | 標準 EN ATS アダプタ。`tracked_companies` URL パターンを使用。 |

### よくある落とし穴

- **`source` フィールドの不一致。** アダプタが書き込む文字列は
  `registry.mjs` の `value` と完全に一致しなければなりません。ずれると、
  `#/scan` のフィルタドロップダウンにはソースが表示されますが、選択すると
  すべての行が除外されます(等価チェックが `r.source === fs` のため)。
- **パース失敗時に例外を投げる。** HTML スクレイパは、カードをパースできない
  健全な 200 では `[]` を返さなければなりません。例外を投げるとマルチソース
  ディスパッチャのループが壊れ — 一つの不正な HTML 構造が、同じクエリの
  他のすべてのソースを巻き添えにします。
- **`fetchImpl` / `signal` の忘れ。** これらがないと、アダプタは
  実ネットワークに触れずにユニットテストできず、クライアントの
  切断も伝播しません(ユーザがタブを閉じてもバックグラウンドの
  フェッチが生き続けます)。
- **RU で `tracked_companies` を当てにする。** このリストは EN ATS
  ソース専用です。RU アダプタは代わりに
  `russian_portals.queries` から自走します — 企業ごとのエントリはありません。

---

## 18. 通知 (トップバーの 🔔)

> v1.58.34 — 右下に表示される全ての toast を in-memory ジャーナル(上限 50、古いものは削除)に記録します。トップバーの 🔔 をクリックして右側の **通知** ドロワーを開き、見逃したメッセージを再確認できます。ジャーナルはタブ単位・セッション単位 — タブを閉じるとクリアされます。

ドロワーは **ベルをクリックしたときだけ開きます**(またはキーボード Enter / Space)。自動では開きません。赤いバッジは未読件数を表示し、開くとリセットされます。

### カテゴリ

| カテゴリ | 発火条件 | 視覚的合図 |
|---|---|---|
| **成功** | `保存しました`, `コピー`, `更新しました`, スキャン完了, CV インポート, apply-checklist 操作, プロフィール保存 | 左ボーダー緑; 緑の toast 背景 |
| **エラー** | URL バリデーション失敗、API エラー (`(METHOD /path · HTTP NNN)` 付き)、ネットワーク失敗、pipeline-400 重複、doctor / verify 異常終了 | 左ボーダー赤; 赤の toast 背景; 技術詳細は `詳細` `<details>` に格納 (U-4) |
| **情報 / 進行** | `Running doctor.mjs…`, `Running verify-pipeline.mjs…`, `Refreshing…`, `Loading…`, スキャン進行 | 左ボーダーグレー |

エントリ表示項目: 時刻 (`HH:MM:SS` 言語別)、メッセージ (U-4 で末尾の技術情報を分離後)、必要に応じて `(METHOD /path · HTTP NNN)` 等の技術詳細 (monospace)。

### 通知ではないもの

- Doctor / verify の結果モーダル — モーダルであって toast ではない、ジャーナル外。
- `#/scan` / `#/auto` の SSE ログ行 — ページ本体に直接書かれ、toast パイプラインを経由しない。
- toast を伴わない spinner のみのローディング状態。

### キーボード

- ベルを **クリック** または focus + **Enter / Space** → ドロワー開く。
- **Esc**、**×** ボタン、ベル再クリック → 閉じる; ベルにフォーカス戻る。


## 19. アプリを自分の言語にローカライズする

インターフェースは 8 言語で提供されます(English, Español, Português, 한국어, 日本語, Русский, 简体中文, 繁體中文)。画面上のラベルはすべて翻訳辞書から来ており、アプリのロジックに触れずに言語を追加・修正できます。

**翻訳の場所。** v1.60.0 以降、各言語は `public/js/lib/locales/` 配下の個別ファイルです — `i18n-dict.en.js`、`i18n-dict.es.js`、`i18n-dict.ru.js` など — `'キー': 'テキスト'` の単純な一覧です。共通の `i18n-dict.aliases.js` により、常に同じ表記であるべきキー(サイドバーのラベルとそのページタイトル)を 1 つの翻訳に向けられます。`i18n-dict.js` が読み込み時にまとめます。これは編集しません。

**文言の修正・追加。** 対象言語のファイルを開き、キー(例: `'nav.scan'`)を見つけてテキストを編集します。新しいラベルを追加するには、**8 つ**すべての言語ファイルに同じキーと翻訳値を追加し、ページ内で `t('your.key')` として使います。`npm test` を実行してください — いずれかの言語でキーが欠けると失敗するため、中途半端な翻訳のまま出荷されません。

**新しい言語を追加する。** `i18n-dict.en.js` を `i18n-dict.<code>.js` にコピーしてすべての値を翻訳し、コードを `i18n.js`(言語リスト + ブラウザ自動判定)と `i18n-dict.js` のアセンブラに登録し、`index.html` に `<script>` 行を追加します。テストのスナップショットやヘルプ / README の付随ファイルを含む完全なチェックリストは `docs/LOCALIZATION.md` にあります。

**補足。** 言語切替はサイドバー下部にあり、選択はブラウザごとに記憶されます。サーバーの診断メッセージは意図的に英語のままです(ログの一貫性のため) — 翻訳されるのは画面のインターフェースだけです。

ステップごとの完全なローカライズガイドはリポジトリの **`docs/LOCALIZATION.md`** を参照してください。
