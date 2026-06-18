# REGRESSION — career-ops-ui · FINAL (perennial, run on every release)

> **This is the single authoritative, version-agnostic regression
> prompt.** Paste it verbatim to a QA agent (or run it yourself) on
> every release. It always validates *the current `HEAD`* — read
> `package.json::version` first and treat that as "the version under
> test" (vX) everywhere below. Record the run in
> `qa/v54-regression/<YYYY-MM-DD>-REGRESSION.md`.
>
> Lineage: supersedes `REGRESSION-v1.54.9.md` (cycle-specific) and
> `REGRESSION-v1.54.md` (P-31 final). Those stay for historical diff.
>
> **Doctrine.** A check that needs a code change → open it as ONE
> one-fix ship: bump + CHANGELOG ×9 (parity-gated) + a test +
> Playwright-verify + pre-commit AI-review to LGTM + CI-watch to
> green. Never batch. Never `--no-verify`. HIGH → MEDIUM → LOW.

---

## §0 — Pre-flight (HARD GATE — nothing below runs until this is green)

```bash
vX=$(node -p "require('./package.json').version")
npm ci && npm run test:ci          # MUST: N/N pass · ✓ no .also( · ✓ CHANGELOG parity all 9 @ vX
node tests/e2e.mjs                 # MUST: failed: 0
node tests/e2e-comprehensive.mjs   # MUST: 0 failed
npm run test:e2e:browser           # MUST: 81/81 (v1.61.1 baseline) · NO "generated asynchronous activity" / "not ok 2"
node --test tests/sh-files.test.mjs        # MUST: green
node scripts/check-changelog-parity.mjs    # MUST: all 9 locales @ vX
node scripts/check-no-also-leftovers.mjs   # MUST: ✓
career-ops-ui doctor               # MUST: exit 0
```

- `package.json::version` == footer `/api/health.version` == every
  `CHANGELOG*.md` top entry == README ×9 `release-vX` badge ==
  `docs/architecture/TESTING.md` totals version.
- README ×9 `tests-N%20passed` badge == the `npm run test:ci` count ==
  `TESTING.md` totals count.
- `git status` clean · HEAD has tag `vX` on `origin/main` · the
  latest CI run on `origin/main` is green on **all 4 jobs**
  (Unit+integration node 18/20/22 + Playwright e2e).
- `.claude/settings.json` untracked (gitignored).
- **Parent-project safety:** `git log --stat -20` shows zero writes
  outside `web-ui/`. The server only writes parent files on explicit
  user POST/PUT/DELETE — never at rest, never from a code path.

## §1 — Every SPA route renders clean

For each hash route: navigate, assert exactly one `<h1.page-title>`
in `#content`, **zero console errors**, no unhandled rejection, no
network 4xx/5xx for first-paint assets (all `.js/.css` →
`Cache-Control: no-store`).

`#/dashboard #/scan #/pipeline #/auto #/evaluate #/batch #/deep
#/apply #/tracker #/reports #/cv #/profile #/settings(alias) #/config
#/health #/activity #/help` + the 7 `#/<mode>` pages + `#/portals`
(MUST alias → `#/config`, never the 404 view).

## §2 — Accessibility invariants (WCAG, regression-locked)

Every row below has a dedicated `tests/*.test.mjs` static guarantee —
none may regress. Spot-verify the starred ones live with a screen
reader / the accessibility tree:

- ★ Route change moves focus to the new view's `<h1>`.
- `#/config`: WAI-ARIA Tabs (`role=tablist/tab/tabpanel`,
  `aria-selected` synced, ←/→/Home/End, roving tabindex).
- Destructive parent-file writes (`#/config` raw save, modes
  full-rebuild, `#/tracker` fix, `#/pipeline` delete) go through the
  focus-trapped `UI.confirm()` (Cancel-default; Esc/backdrop/× ⇒
  false). **No native `confirm()` anywhere.**
- ★ `#/cv`: exactly one `<h1>` (page title). A CV body `# Name`
  renders `<h2>` (heading-shift); h6 → `role=heading aria-level=7`.
- `#/scan`: console `role=log aria-live=polite` + assertive
  done/error status; Stop closes the EventSource; `aria-busy` on the
  multi-minute crawl; SSE failure = persistent `role=alert` + Retry.
- ★ `#/pipeline`: every per-row `▶`/`✕` has a URL-disambiguated
  `aria-label`; preview is a labelled `role=region aria-live`;
  fetch-fail is a distinct `role=alert`.
- `#/tracker`: `th scope=col`; Date/Score/Status sortable buttons +
  `aria-sort` (reset scoped to sortable headers); localized
  destructive labels with no trailing dash on empty company/role.
- `#/help`: single `<h1>`; labelled + filterable TOC; focus-on-anchor;
  back-to-top carries the canonical `.back-to-top` class.
- ★ `#/batch`: the TSV `<textarea>` has an `aria-label` (a
  description via `aria-describedby` is **not** a name).
- `#/auto`, `#/evaluate`: run-button busy state + `aria-busy`;
  HTTP-fail surfaces an actionable message both inline AND as a
  toast; clipboard has an async fallback; eval result is `role=status`.

## §3 — Config: API-keys, providers & the "OR" model (v1.55.0)

`#/config` → API-keys tab: structured field-form over the parent
`.env`, opening with a note explaining career-ops is CLI-agnostic
(Claude Code · Codex · Gemini · OpenCode · Qwen · Copilot · Kimi)
while the web-ui ⚡ eval is headless and key-driven.

- `LLM_PROVIDER` select MUST offer `auto · claude · gemini · openai ·
  qwen`. `auto` = first provider whose key is set, preferring
  **Anthropic → Gemini → OpenAI → Qwen** (`providerOrder()`); an
  explicit value pins exactly one; forced + no key ⇒ manual prompt.
- Per-provider model `<select>`s for Anthropic, Gemini, OpenAI
  (`OPENAI_MODEL`, default `gpt-5-codex`) and Qwen (`QWEN_MODEL`,
  default `qwen-max`). `*_API_KEY` ∈ `SECRET_KEYS` (masked, never
  logged); `*_MODEL` and `LLM_PROVIDER` are **not** secret.
- `KNOWN_KEYS` includes `ANTHROPIC_*`, `GEMINI_*`, `OPENAI_*`,
  `QWEN_*`, `LLM_PROVIDER`, `PORT`, `HOST`; all LLM keys are
  `KEY_GROUPS.core`. Saving applies live — honoured **without a
  server restart** (see §6).
- The "works via OR" contract: with ONLY one of the four keys set,
  `#/evaluate` ⚡ run-live MUST succeed via that provider; the result
  header reports which (`anthropic`/`gemini`/`openai`/`qwen`). Same
  for `#/deep`, `#/mode/:slug`, and the `#/auto` pipeline. No key
  anywhere ⇒ the copy-paste manual prompt, never a hard error.

## §4 — Config: Modes canonical-schema field-form

`#/config` → Modes tab MUST render the **5 canonical career-ops.org
§Step-5 fields in documented order** — Target Roles / Adaptive
Framing / Comp Targets (repeatable labelled line-inputs), Exit
Narrative / Location Policy (labelled prose textareas) — **even when
the parent `modes/_profile.md` is empty, a stub, or non-schema**
(there must be NO "no sections — use raw editor" dead end). Each field
shows a description sourced from the canonical docs, wired via
`aria-describedby`. `## Your Target Roles` ≡ `## Target Roles`.
Save is tagged: existing-schema ⇒ non-destructive `{ sections }`
merge (preamble + untouched + custom sections byte-stable);
missing-schema ⇒ confirm-gated `{ markdown }` full rebuild. Raw
full-file editor remains the confirm-gated **Advanced** disclosure.
Verify a stub fixture round-trips: stub → 5 fields → fill → confirm →
all 5 canonical sections persisted, preamble + custom kept.

## §5 — Deploy hygiene

`GET` of any `.js`/`.mjs`/`.css`, static `index.html`, and the SPA
catch-all shell ⇒ `Cache-Control: no-store`. Non-code assets keep
default caching. Security headers unchanged: CSP (only when bound
beyond loopback) excludes `'unsafe-inline'`/`'unsafe-eval'`,
`frame-ancestors 'none'`; `X-Content-Type-Options: nosniff`;
`X-Frame-Options: DENY`; `Referrer-Policy: same-origin`.

## §5a — Server error bodies are English-by-policy (DOC-1 / v1.58.50)

The server's `4xx`/`5xx` JSON bodies (`{ error, details, hint, … }`)
are emitted in English on **every** locale. The SPA wraps them with
**localized chrome** — the toast severity colour, the `Details`
summary label that hides the technical postfix (U-4 / v1.58.24), the
help banners that link to docs — so the end-user never sees raw
English at the surface unless they expand the `<details>`. The
endpoint payload itself is the **debuggability boundary** and must
stay English so:

1. Bug reports paste cleanly across locales (a Russian user'\''s
   stack trace doesn'\''t need translation when they file an issue).
2. CI fixtures that match on error strings stay stable.
3. The server-side test surface (`tests/*.test.mjs` parses
   `e.message`) doesn'\''t need a parallel locale fixture set.
4. `Accept-Language` is **not** read by the API layer — the SPA-side
   `lang` storage is stripped from any payload before `validateConfig`
   sees it (v1.57.2 invariant).

i18n tests exempt server-error strings from locale-key parity —
`tests/i18n-coverage.test.mjs` walks `public/js/lib/i18n-dict.js`,
not server-side strings.

**If you ever need localized server errors:** that'\''s a v1.59
feature (DOC-1 option B). Spec: server reads `Accept-Language`,
returns `{ error: <localized>, error_en: <fallback>, code: <stable> }`
with EN as the immutable `code`/`error_en` lookup key. Until then,
the policy above is intentional, not a defect.

## §6 — LLM routing honours the live parent `.env`

With a key ONLY in the parent `.env` (NOT in the server's boot
`process.env`): `#/evaluate` run-live MUST route to that provider —
never error on a different/stale one. `effectiveEnv()` resolves
keys/model as: non-empty `process.env` wins, else current parent
`.env`; detection (`hasAnthropicKey`/`hasGeminiKey`/`hasOpenAIKey`/
`hasQwenKey`) matches the key actually sent; no restart needed after
a `.env` / `POST /api/config` change. Walk the OR matrix: for each of
the 4 providers, set ONLY its key in `.env` and confirm a live eval
runs via exactly that provider (`anthropic`/`gemini`/`openai`/`qwen`
in the response). Keys are never logged or echoed — the no-leak
canary is green in `tests/anthropic.test.mjs` and
`tests/openai.test.mjs`.

## §7 — Streaming / disconnect hygiene

Every SSE endpoint (`/api/auto-pipeline`, `/api/stream/*`,
`/api/stream/scan-*`) survives a mid-stream client disconnect with
**no uncaughtException / unhandled rejection** server-side: `res`
has an `'error'` listener, writes are guarded on
`writableEnded||destroyed`, and `res.on('close')` aborts in-flight
`safeGet()` cleanly. The Playwright e2e job MUST be green with no
"asynchronous activity after the test ended".

## §8 — SSRF / input safety

`/api/pipeline`, `/api/pipeline/preview`, `/api/auto-pipeline` reject
loopback / `file://` / script-char / non-http(s) URLs via
`isValidJobUrl`, and fetch only through `safeGet` (DNS-pinned,
per-redirect re-validated, byte-capped). All CV/markdown ingress
routes through `stripDangerousMarkdown`. CV import rejects
non-allowed binary envelopes (415).

## §9 — i18n & docs parity (top-down vs career-ops.org)

- Every i18n key present in all 9 locales (`tests/i18n-coverage`).
- CHANGELOG ×9 at vX (`check-changelog-parity`); README ×9 badges
  at vX/N; `TESTING.md` totals at vX/N/files.
- Help bundles ×9: 19 H2 / 73 H3 parity gate green; the
  "App settings & API keys" section describes the Modes **field-form**
  + the OpenAI/Codex model selector (not raw markdown).
- `CLAUDE.md` (route-module count, version) and
  `.claude/PROJECT-CONTEXT.md` (repo-state + test baseline) reflect
  reality.
- Spot-check each in-scope screen against its career-ops.org/docs
  page (Quick Start, What-is, Scan, Apply, Batch, Playwright + the
  Reference nav: Modes, auto-pipeline, pipeline, oferta(s), contacto,
  deep, interview-prep, pdf, training, project, tracker, patterns,
  followup, Portals). Any divergence in *documented behaviour* → a
  one-fix ship.

## §10 — Pyramid & shell surface

`bin/*.sh`, `.githooks/*`, `scripts/*.mjs` covered by
`tests/sh-files.test.mjs`. Coverage floor ≥ 80 % line / branch on
non-trivial logic (`npm run test:coverage`). unit → integration →
acceptance → e2e all green.

## §11 — v1.55.x→v1.56.4 consolidated UX-fix invariants (regression-locked)

The 2026-05-14→18 audit's 12 UX findings + 2 v1.55.0 a11y findings
shipped one-fix-per-release (v1.55.1→v1.56.0); the follow-on
`qa/FIX-PROMPT-FINAL.md` cycle then closed an a11y focus-ring
regression (v1.56.1), UX-N1 (v1.56.2), a reported key-detection
trust bug (v1.56.3) and UX-N2 (v1.56.4). Each has a dedicated
`tests/*.test.mjs` static guarantee — none may regress. Spot-verify
the ★ ones live.

- ★ **`#/auto` stepper pre-render** (F-V55-E/UX-1, **CLOSED v1.55.1**):
  `<ol.auto-stepper>` shows the 5 documented stages (validate → fetch
  → evaluate → save report → add tracker) in `pending` state **on
  mount**, before any Run click; labelled `auto.stepperAria`.
  `tests/auto-stepper-prerender.test.mjs`.
- ★ **`#/cv` editor accessible name** (F-V55-H/UX-5, **CLOSED
  v1.55.2**): `#cv-editor` has a descriptive `aria-label`
  (`cv.editorAria` ×9); no redundant `aria-labelledby`.
  `tests/cv-editor-a11y.test.mjs`.
- ★ **4-provider OR onboarding** (UX-2, **CLOSED v1.55.3**):
  `GET /api/status/providers` → `{activeProvider, activeModel,
  keysConfigured}`; SPA `#onboarding-banner` shows a red banner (0
  keys, CTA → `#/config?tab=api-keys`) or a quiet active-provider
  chip (≥1). `selectActiveProvider()` honors the `LLM_PROVIDER` pin.
  `tests/onboarding-key-banner.test.mjs`.
- **`#/auto` ETA + `#/scan` Stop prominence** (UX-6, **CLOSED
  v1.55.4**): `.auto-eta` "~1–2 min" next to Run; `setScanRunning`
  flips Stop `btn-ghost`↔`btn-danger` while `aria-busy`.
  `tests/auto-eta-stop.test.mjs`.
- **`#/dashboard` hero** (UX-3, **CLOSED v1.55.5**): `.dash-hero`
  with the 2 P0 CTAs (`.btn-hero`) + a focal last-eval hint precedes
  the Quick-actions grid; status buckets are `.dash-chip`.
  `tests/dashboard-hero.test.mjs`.
- **`#/scan` Advanced-filters disclosure** (UX-4, **CLOSED
  v1.55.6**): free-text + remote stay visible; scope + source + the
  post-scan facet chips collapse behind a `<details.scan-advanced>`.
  `tests/scan-advanced-disclosure.test.mjs`.
- **`#/pipeline` virtualization** (UX-7, **CLOSED v1.55.7**): at
  `>VIRTUALIZE_THRESHOLD` (1000) rows the list is a 70vh scroll
  viewport with a `flex:0 0 auto` spacer (full scroll range) +
  rAF-throttled window (≤threshold keeps the simple render
  byte-for-byte); rows keep URL-disambiguated ▶/✕ aria-labels.
  `tests/pipeline-virtualize.test.mjs`.
- **`#/tracker` server-side pagination + funnel** (UX-8, **CLOSED
  v1.55.8**): `GET /api/tracker` with no params ⇒ exactly `{rows}`
  (back-compat); `?page&pageSize&status` ⇒ `{rows,total,page,
  pageSize,funnel}` (pageSize≤500, whole-history funnel); clickable
  `.tracker-chip` funnel bar drives the Status filter.
  `tests/tracker-server-paged.test.mjs`.
- **LOW polish bundle** (**CLOSED v1.56.0**): UX-9 `#/cv` title is a
  single-`<h1>` `.cv-breadcrumb` chip (F-V54-A intact);
  UX-10 shared `UI.providerCostHint(t)` cost ballpark next to ⚡ Run
  live on auto/evaluate/deep/`<mode>` (reuses
  `/api/status/providers`; `cost.estimate`/`cost.manual` ×9);
  UX-11 `#/help` TOC filter → exactly-1-match 300ms-debounced
  autoscroll; UX-12 first-paint `<h1>` is `tabindex=-1` + `#content`
  `aria-live=polite` **without** stealing focus (v1.41.0 skip-link
  contract preserved). `tests/{cv-breadcrumb,run-cost-line,
  help-toc-autoscroll,dashboard-initial-focus}.test.mjs`.
- **a11y focus-ring fix** (**CLOSED v1.56.1**): router-managed
  `tabindex="-1"` heading focus no longer paints the brand
  `*:focus-visible` ring (a red box around every view's `<h1>`,
  baked into the dashboard screenshots). Scoped rule
  `[tabindex="-1"]:focus,[tabindex="-1"]:focus-visible{outline:none}`;
  global keyboard ring intact (WCAG 2.4.7).
  `tests/managed-focus-no-ring.test.mjs`.
- **UX-N1 per-route title** (**CLOSED v1.56.2**): `router.js`
  `focusNewView()` sets a per-route, locale-aware `document.title`
  from the view `<h1>` before the first-paint guard (multi-tab /
  bookmarks / SR page-change). `tests/document-title-per-route.test.mjs`.
- **key-detection plausibility** (**CLOSED v1.56.3**): a placeholder /
  too-short secret in a parent `.env` is no longer reported "✓ set"
  or mis-selected as the active provider. New pure `isUsableKey()`
  (≥20 chars + not a known placeholder) gates
  `has{Anthropic,Gemini,OpenAI,Qwen}Key()` and the `/api/health`
  key rows (now on the same effective+plausible view as
  `/api/status/providers`). `tests/key-detection-rejects-placeholder.test.mjs`.
  *(Field note: if `career-ops/.env` pins `LLM_PROVIDER` to a
  provider with no real key, `activeProvider` is correctly `null` —
  that is honest, not a regression; it is the user's `.env` to fix.)*
- **UX-N2 ⌘K hint** (**CLOSED v1.56.4**): a visible, platform-aware
  `<kbd class="kbd-shortcut">` (⌘K macOS/iOS · Ctrl K else) inside
  the `.searchbar`; `aria-hidden` (aria-label already announces it),
  keybinding unchanged. `tests/cmdk-hint-visible.test.mjs`.
- **Pipeline AI-review** (workflow, regression-locked by file): the
  `.github/workflows/ai-review.yml` `push-review` job runs on every
  push to `main` and posts an advisory commit comment (fail-soft;
  needs the `ANTHROPIC_API_KEY` repo secret to post — without it it
  logs a clear skip and stays green). ci.yml remains the hard gate;
  `scripts/ai-precommit-review.mjs` is the local advisory layer.
- **Senior obs ledger:** S-7 closed v1.54.6 · W-001 closed v1.54.7 ·
  S-1→UX-3 (v1.55.5) · S-2→UX-7 (v1.55.7) · S-3→UX-4 (v1.55.6) ·
  S-4→F-V55-E/UX-1 (v1.55.1) · S-5→UX-9 (v1.56.0) · S-6→UX-8
  (v1.55.8).
- **G-005** (cross-repo, **OPEN — blocked on parent**): the only
  remaining backlog item. `server/lib/prompts.mjs` still references
  the A-G `modes/oferta.md` schema *because the parent still emits
  A-G*; the web-ui A-F flip must land **after** the parent
  `Fighter90/career-ops` commit (see `qa/G-005-closure-kit.md`
  STEP 1) or the model gets contradictory instructions. Renderer is
  schema-tolerant; help §9 ×9 already canonical A-F (v1.15.0).

---

## §12 — v1.58.x cycle invariants (regression-locked at v1.58.4 → v1.58.35)

The 32 single-fix releases v1.58.4 → v1.58.35 closed the FIX-PROMPT
§1 backlog (post-MASTER regression). Every row below has a dedicated
static guard in `tests/qa-report-fixes.test.mjs` (plus a Playwright
contract for the notifications drawer). None may regress.

**Security envelope (HIGH / stop-ship):**

- ★ **CSP unconditional** (NEW-1, **CLOSED v1.58.4**): every response
  (including loopback `/api/health`) ships
  `Content-Security-Policy: default-src 'self'; script-src 'self';
  frame-ancestors 'none'; …`. No `'unsafe-inline'` / `'unsafe-eval'`.
  Playwright route-walk over en/ru/ja/zh-TW × 7 routes asserts zero
  CSP violations in the console.
- **`isValidJobUrl` template-placeholder rejection** (NEW-2, **CLOSED
  v1.58.7**): paired `${T}` / `{{T}}` / `<%T%>` are rejected with the
  exact "contain no script or template characters" message;
  single-brace `{normal}` ATS paths preserved.

**Provider surface:**

- **5 provider rows on `#/health`** (user feat, **CLOSED v1.58.8**):
  `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `QWEN_API_KEY`, `OPENROUTER_API_KEY` — same `isUsableKey` gate.
- **Cost hint tracks OpenRouter** (M-7, **CLOSED v1.58.12**):
  `EST.openrouter = null` → localized `cost varies (router picks)`
  via the new `cost.varies` i18n key × 9.

**A11y / WCAG (Level AA):**

- ★ **`:focus-visible` ring on form fields** (M-1, **CLOSED v1.58.9**):
  explicit `.input/.textarea/.select/.searchbar input:focus-visible`
  rules paint the brand ring on keyboard focus only; the base
  `outline: none` no longer wins via higher specificity.
- **Top-bar search aria-label localized** (I-1, **CLOSED v1.58.15**):
  new generic `data-i18n-aria-label` hook in `applyI18n()` swaps
  `aria-label` on every language change. Reusable for any future
  control.
- **Theme-toggle title + aria-label localized** (MINOR-001, **CLOSED
  v1.61.1**): the dark/light `#theme-toggle` hardcoded `title="Toggle
  theme"` + `aria-label="Toggle theme"` in `index.html` — never
  translated on any locale. Fix mirrors I-1: a new generic
  `data-i18n-title` hook in `applyI18n()` + the `top.themeToggle` key in
  all 9 locales, both attributes re-applied on boot and every language
  switch. Locked by `tests/playwright-theme-toggle-i18n.mjs` (9 locales
  + runtime-switch) + 2 static guards in `tests/qa-report-fixes.test.mjs`.
  The lone LOW finding from the v1.61.0 French (9th-locale) sign-off.
  Verify: switch to `fr` → tooltip reads "Changer de thème".

**i18n parity (9 locales):**

- **Saved-research relative time** (I-2, **CLOSED v1.58.17**):
  `formatRelative()` uses `Intl.RelativeTimeFormat(I18n.getLang(),
  { numeric: 'auto' })` — `today` / `yesterday` / `N days ago` in the
  active locale. Older dates fall back to `Intl.DateTimeFormat`.
- **Help TOC items 2/5/13/14** (I-3, **CLOSED v1.58.18**): no English
  bleed in `ru/ja/ko-KR/zh-CN/zh-TW` (negative match: no
  `App|settings|Apply|checklist|Portals|Sources|Mode|prompts`).
- **RU `#/followup` H1 + hints** (I-4, **CLOSED v1.58.19**): no Latin
  `cadence` / `follow-up` / `scope` / `timeline` leakage.
- **Footer hotkey per platform** (I-6, **CLOSED v1.58.20**):
  `top.langhint` uses a `{hotkey}` placeholder; `applyFooterHotkey()`
  substitutes ⌘K (macOS/iOS) vs Ctrl+K (else); localized verb stays.

**UX (one-fix-per-release, all M-* / U-* and follow-ups):**

- **`UI.modal()` drains progress toast** (M-2, **CLOSED v1.58.10**):
  auto-dismisses any in-flight toast as the first executable
  statement; defence-in-depth at the boundary.
- **Saved-research card title↔date gap** (M-4, **CLOSED v1.58.11**):
  structural `.saved-card { display: inline-flex; gap: var(--space-2) }`
  + semantic `<time datetime="…">`.
- **Apply checklist interactive** (M-8, **CLOSED v1.58.13**): real
  `<input type=checkbox>` per item, per-URL `localStorage`
  persistence, Copy-unchecked + Reset buttons. 5 new i18n keys × 9.
- **Connection-banner Refresh feedback** (M-9, **CLOSED v1.58.14**):
  synchronous `Refreshing…` toast + `sessionStorage['refreshedToast']`
  bridge → localized `Refreshed` success toast on next boot.
- **Top-bar Doctor modal title** (BUG-008-tb, **CLOSED v1.58.6**):
  `UI.modal(I18n.t('top.doctor', 'Doctor'), …)` matches the button's
  visible label across all 9 locales.
- **Brand-button hover-flicker** (user-reported, **CLOSED v1.58.16**):
  `.btn-primary` / `.btn-danger` keep gradient on hover, dim via
  `filter: brightness(0.92)`; `.btn` transition list adds `filter`.
  No more gradient↔solid CSS swap that the browser couldn't
  interpolate.
- **`#/cv` H1 + subtitle** (U-1, **CLOSED v1.58.21**): supersedes
  v1.56.0 UX-9 chip by-design; standard `.page-title` / `.page-subtitle`
  pair restored. Single-`<h1>` invariant unchanged (F-V54-A still
  shifts the preview's `# Name` to `<h2>`).
- **`#/auto` H1 emoji-wrap** (U-2, **CLOSED v1.58.22**): ✨ moved to
  a sibling `<span class="page-icon" aria-hidden="true">`;
  `.page-header--icon` uses CSS grid (`auto 1fr`) so the H1 never
  wraps because of the emoji.
- **`#/followup` `lastContact` placeholder** (U-3, **CLOSED
  v1.58.23**): computed at render time as `today − 14 days`; the
  frozen `2026-04-21` is gone.
- **Toast detail in `<details>`** (U-4, **CLOSED v1.58.24**): the
  `(METHOD /path · HTTP NNN)` postfix is parsed out of the headline
  and rendered in a collapsible `<details class="toast-detail">`
  with localized `toast.details` summary × 9 locales. BUG-006
  invariant preserved — postfix still reachable in DOM.
- **Dashboard CTA dedupe** (U-5, **CLOSED v1.58.25**): removed
  `Open Pipeline` header button + `Scan all sources` Quick-action
  tile (both were duplicates of sidebar/hero entry-points).
- **Scan Active-companies tooltip** (U-6, **CLOSED v1.58.26**):
  localized `title` + `aria-label` from new `scan.activeCo.help` × 9
  explain N (active) vs M (total in portals.yml).
- **verify-pipeline modal `===` strip** (U-7, **CLOSED v1.58.27**):
  `.replace(/^={10,}$/gm, '')` removes the 50-char ASCII dividers
  that pushed the modal body wider than necessary.
- **Generate-prompt block collapsed by default** (U-8, **CLOSED
  v1.58.28**): `showPrompt()` wraps the `<pre>` in
  `<details class="prompt-block">`; summary `Show prompt (N lines)`
  (`prompt.show` / `prompt.lines` × 9). Copy / Run-live stay above
  the fold.
- **Pipeline counter↔filter responsive stack** (U-9, **CLOSED
  v1.58.29**): `.pipeline-controls` class + `@media (max-width: 720px)`
  rule stacks vertically and stretches the filter to 100%.
- **Tracker Normalize/Dedup/Merge disabled when empty** (U-10,
  **CLOSED v1.58.30**): each button gets `disabled` + `aria-disabled`
  + localized `track.fixEmpty` tooltip when `data/applications.md`
  is empty.
- **Tracker Legitimacy header info chip** (U-11, **CLOSED v1.58.31**):
  `<span class="th-info" tabindex="0" role="img">ⓘ</span>` with
  `title` + `aria-label` from `track.col.legitimacy.help` × 9;
  keyboard-reachable (WCAG 2.4.7).
- **Help TOC filter min-width** (U-12, **CLOSED v1.58.32**):
  `.help-toc__filter { min-width: 16ch }` so KO `섹션 필터` /
  JA `セクションをフィルター` never clip.
- **Toast journal capture API** (U-13, **CLOSED v1.58.33**):
  per-tab in-memory `toastHistory` (cap 50) + `UI.getToastHistory()`
  exposed.
- **Page-header safety-net spacing** (U-14, **CLOSED v1.58.33**):
  `.page-header h1 + p { margin-block-start: var(--space-2); color: var(--foggy) }`
  catches any page that uses raw `<h1>+<p>` without `.page-subtitle`.
- **CV editor dirty-state** (U-15, **CLOSED v1.58.33**): Save button
  gets `.btn-dirty` + localized `cv.unsaved` tooltip when textarea
  diverges from baseline; reset on successful Save.

**v1.58.34 — Notifications drawer (closes U-13 chrome):**

- ★ **Bell + drawer behavior** (**CLOSED v1.58.34**): `🔔` button in
  the top-bar with red unread badge; right-slide `<aside role="dialog">`
  lists every captured toast (newest first) with localized timestamp,
  message, and (when present) the U-4 technical postfix. `UI.onToast(fn)`
  pub/sub layered on top of the v1.58.33 capture so subscribers
  receive the entry just appended (try/catch-guarded; subscriber
  throws never break the toast pipeline). 4 new i18n keys ×9
  (`notif.{title,empty,bellAria,closeAria}`).

**v1.58.35 — Drawer auto-open fix + help §18 (user-reported):**

- ★ **Drawer hidden at boot; opens ONLY via bell** (**CLOSED v1.58.35**):
  user-reported bug: `.notif-drawer { display: flex }` shadowed UA
  `[hidden] { display: none }` (author-level cascade wins over UA),
  so the drawer was visible on every page load and clicking × did
  nothing. Fix: explicit `.notif-drawer[hidden] { display: none }` +
  `.notif-badge[hidden] { display: none }`. Static guard locks
  exactly **one** `open()` call site in `app.js` (the bell click
  ternary) so no future edit can introduce another auto-open path.
  **Playwright contract** (`tests/playwright-smoke.mjs`):
  drawer hidden at boot · `aria-expanded === 'false'` at boot ·
  click bell → opens · click × → closes · Esc closes · toast while
  closed bumps unread badge → opening drawer lists the entry and
  resets the badge.
- ★ **Help §18 Notifications** (**CLOSED v1.58.35**): new H2 in all
  9 locales of `docs/help/*.md` documents the 3 toast categories
  (Success / Error / Info-progress) — what triggers each, visual
  cues, what is **NOT** a notification (Doctor/verify modals, SSE
  log lines, spinner-only states), and the keyboard contract
  (Click / Enter / Space / Esc / × / re-click bell). H2 parity lock
  in `tests/{canonical-docs-coverage,help-ru-config-section,help-ui}.test.mjs`
  lifted 17 → **18**; H3 lock 70 → **73**.

**Lessons captured for future ships:**

- `[hidden]` is a no-op against an author-level `display:` rule on
  the same element. Always pair an explicit `[hidden] { display: none }`
  override or toggle via class instead.
- `npm test 2>&1 | grep …` masks the test process exit code (`grep`
  returns 0 on match even when `npm test` exited non-zero). Always
  split: run `npm test` first, capture `$?`, then grep separately.
  Two ships (v1.58.27 / v1.58.30) shipped failing tests because of
  this pattern; both were repaired in the next release.
- `cleanLlmMarkdown` is NOT an XSS sanitizer. `stripDangerousMarkdown`
  is the CV ingress boundary; `UI.md()` is the SPA render boundary.
  Adding the LLM declutter step to either is a category error.

---

## §13 — v1.58.37 → v1.58.50 cycle invariants (closes FIX-PROMPT-FINAL-EXHAUSTIVE)

The post-v1.58.36 audit produced two consolidated fix-prompts
(`qa/archive/v158-cycle/FIX-PROMPT-CONSOLIDATED.md` and
`FIX-PROMPT-FINAL-EXHAUSTIVE.md`) cataloguing 14 actionable items
across i18n, a11y, UX feedback, content fidelity, tooling, and docs.
All shipped as single-fix releases v1.58.37 → v1.58.50; each
regression-locked in `tests/qa-report-fixes.test.mjs` (or its own
dedicated file). None may regress.

**i18n & promise fidelity:**

- ★ **`pipe.title` localized on es/pt-BR/ru** (NEW-D1, **CLOSED v1.58.37**):
  `Pipeline de vacantes` / `Pipeline de vagas` / `Воронка вакансий`;
  page-title now matches the sidebar `nav.pipeline` term (closes the
  v1.58.18 I-3 doctrine gap). New `tests/i18n-no-latin-leaks.test.mjs`
  parses the DICT and fails on any Latin-only `*.title` value on the
  5 non-Latin locales outside a small whitelist (proper nouns / acronyms
  / product names). The guard caught two extra stray RU leaks
  (`contacto.title`, `health.title`) — both also fixed in the same
  release.

**A11y:**

- ★ **Tracker search aria-label** (NEW-D3, **CLOSED v1.58.38**, WCAG
  4.1.2): the `#/tracker` `<input>` declared only `placeholder`; SR
  read "edit text" with no purpose. Now declares `type="search"` +
  `aria-label: t('track.searchAria', …)`, distinct from the
  placeholder in every locale.

**UX feedback / honesty:**

- **Dashboard Refresh button** (NEW-D2, **CLOSED v1.58.39**): explicit
  `↻ Refresh` in the dashboard header, distinct from the
  connection-banner Refresh (M-9 v1.58.14 which does `location.reload()`).
  In-place refetch via `Router.go('/dashboard')` + toast pipeline
  (`Refreshing…` → `Dashboard refreshed`).
- **External doc-links regression lock** (UX-D-H, **CLOSED v1.58.40**):
  new `tests/external-doc-links.test.mjs` asserts every visible
  `career-ops.org/docs/<path>` URL in `views/*.js` and `docs/help/*.md`
  is either inside an `<a href>` or markdown-linked. Bare brand
  mentions tolerated.
- ★ **Cost-hint live re-fetch** (UX-D-I, **CLOSED v1.58.41**, M-7
  follow-up): `providerCostHint()` extracts a named `refreshCostLine()`
  and binds it to `document.visibilitychange` + new `providers-changed`
  `CustomEvent`. `#/config` Save dispatches the event after a
  successful POST so every cost-hint in the tab refreshes without
  a page reload.
- **Advisor ETA parity** (UX-D-J, **CLOSED v1.58.42**): the
  `<span class="advisor-eta">⏱ ~30s</span>` chip appears next to the
  cost-hint on `#/evaluate`, `#/deep`, and the 5 mode pages. CSS rule
  extended; only `#/auto` stays at `~1–2 min` (multi-step SSE).
- **Empty Evaluate submit toast** (UX-D-F, **CLOSED v1.58.43**):
  empty-JD branch precedes the `<50 chars` branch; new
  `eval.emptyJd` × 9 + `jdInput.focus()` on the error.
- **Deep brief close button** (UX-D-L, **CLOSED v1.58.44**): `×`
  button in the saved-research opened-brief header clears `out.innerHTML`;
  new `deep.closeBrief` × 9.

**Orientation:**

- ★ **Help TOC scroll-spy** (UX-D-K, **CLOSED v1.58.45**):
  `IntersectionObserver` on every `.help-article h2[id]` applies
  `.toc-current` to the matching TOC `<a>` link as the user scrolls
  (`rootMargin: "-30% 0% -60% 0%"`). Observer disconnects on
  hashchange.

**Content fidelity:**

- ★ **Apply checklist `{company}-{role}` substitution** (UX-D-D,
  **CLOSED v1.58.46**): `extractSlugs(url, jd)` recognises Greenhouse
  / Lever / Ashby / Workable / SmartRecruiters / Workday hosts;
  `substitutePlaceholders()` runs before `parseChecklist` so the live
  checklist and Copy-unchecked output stay coherent. Fallback
  `[company]` / `[role]` (square-bracket convention).

**Labels & onboarding:**

- **Top-bar Quick scan rename** (UX-D-C, **CLOSED v1.58.47**):
  `top.quickscan` is now `Open Scan` (and localized equivalents) in
  all 9 locales — matches actual nav-only behavior, not the implied
  instant-action.
- **Dashboard fixture-profile banner** (UX-D-B, **CLOSED v1.58.48**):
  `profileFixtureBanner()` renders a `.hero-banner.hero-banner--warning`
  at the top of the route when `/api/health` returns
  `Profile customized: false`. CTA links to `#/config`. Two new i18n
  keys (`onboarding.fixtureWarning`, `onboarding.fixProfile`) × 9.

**Tooling:**

- **`make clean-test-fixtures`** (TOOL-1, **CLOSED v1.58.49**): new
  `scripts/clean-test-fixtures.mjs` + `Makefile` target strip
  `example.com` lines from `${CAREER_OPS_ROOT}/data/pipeline.md` (1252+
  entries accumulated during regression runs). `--dry-run` mode for
  rehearsal. 4 new CI-isolated tests in
  `tests/clean-test-fixtures.test.mjs` (uses `mkdtempSync` — no
  real-file writes).

**Docs / doctrine:**

- **Server error bodies English-by-policy** (DOC-1, **CLOSED v1.58.50**):
  new §5a (above) documents that 4xx/5xx JSON bodies stay English
  intentionally — debuggability boundary, CI fixture stability,
  server-test simplicity, v1.57.2 `lang` stripping invariant.
  v1.59 option B (localized errors with `{ error, error_en, code }`)
  is the future gate. NEW-D4 closed as `not-a-finding`.

**Two new lessons captured for the doctrine:**

1. **Lock-test regex with markdown bolding** (v1.58.50): an `\s+`
   between two words in a regex breaks when the docs use bold —
   `**not** read` doesn't match `not\s+read`. Use `[\s\S]{0,40}?` or
   `\W*` when the documented text could be wrapped in `**…**`.
2. **`Publish to GitHub Packages` runs tests against the TAGGED ref**,
   not `main`. If a lock-test fix lands on `main` AFTER the tag,
   Publish still fails on the broken tag. v1.58.48 / v1.58.50 both
   tripped this. Pre-tag local sweep is the only defense.

---

### Exit criteria

§0 gate green · §1–§11 every MUST satisfied · §A exhaustive matrix
swept · `git status` clean · tag `vX` on `origin/main` with the
latest CI green on all 4 jobs · no open MEDIUM/HIGH finding (the
consolidated v1.55.x→v1.56.0 fix-prompt AND the follow-on
`qa/FIX-PROMPT-FINAL.md` cycle — a11y focus-ring v1.56.1, UX-N1
v1.56.2, key-detection trust fix v1.56.3, UX-N2 v1.56.4 — are all
fully closed; **G-005** is the sole open item, MINOR, cross-repo,
blocked on the parent commit). New findings → one-fix ships
(HIGH→MEDIUM→LOW), each fully shipped (bump + CHANGELOG ×9 + test +
Playwright-verify + AI-review LGTM + CI-watch) before the next.

---

## §14 — v1.58.52 → v1.59.0 maturity-10 cycle invariants (regression-locked)

The 15-release cycle that closed the audit (UX-A1 → UX-A15). Each row
below has a static guard in `tests/qa-report-fixes.test.mjs`. See
`qa/REGRESSION-PROMPT-MATURITY-10.md` for the verification ladder and
live-smoke checklist.

| Release | Ticket | Lock-test asserts |
|---|---|---|
| v1.58.52 | UX-A5 | `help.js` uses `mountTocSpy()` + double `requestAnimationFrame` (not `setTimeout(0)` + `document.querySelectorAll`) |
| v1.58.53 | UX-A6 | Every saved-research card flows through `renderSavedCard(f)` · `.saved-card__title` + `<time class="saved-card__date">` |
| v1.58.54 | UX-A1 | `looksLikeStructuredBrief()` checks ≥ 3 of 6 canonical H2s · `.brief-warning` rendered when below threshold · 3 i18n keys × 9 |
| v1.58.55 | UX-A3 | `providerChip()` on `#/dashboard` · subscribes to `providers-changed` + `visibilitychange` · `hashchange` cleanup detaches both |
| v1.58.56 | UX-A4 | `.lang-btn` `min-height: 28px` + `min-width: 28px` + `padding: 6px 10px` (WCAG 2.5.8) |
| v1.58.57 | UX-A7 | `config.js` Save dispatches `providers-changed` · `UI.providerCostHint` subscribes · all 4 advisor views call `UI.providerCostHint(t)` |
| v1.58.58 | UX-A10 | `cv.js` registers `beforeunload` + `hashchange` guards · `isDirty()` reads live · `cv.unsavedConfirm` i18n × 9 |
| v1.58.59 | UX-A13 | `health.js` `FIX_TARGETS` map · `_API_KEY$` regex fallback → `#/config?tab=api-keys` · `.health-fix` ghost button |
| v1.58.60 | UX-A12 | `UI.clearToastHistory()` + `UI.dismissToastHistory(ts)` · `notif-clear-all` + per-item `×` · purge sentinels skip unread bump |
| v1.58.61 | UX-A8 | All 8 READMEs reference `make clean-test-fixtures` + `qa-fixture-*` |
| v1.58.62 | UX-A9 | `.api-keys__summary` sticky chip · `Active` + `Keys: N/5` · subscribes to `providers-changed` |
| v1.58.63 | UX-A15 | `qa()` 7th `primary` flag · Pipeline tile = `true` · `.qa-tile--primary` label `font-weight: 600` |
| v1.58.64 | UX-A11 | es `eval.subtitle` uses `ajuste del CV` / `Puntaje` / `cabecera` / `informe`; pt-BR equivalents · es `pipe.title` = `Pipeline de candidaturas` |
| v1.58.65 | UX-A2 | `modes-form.js` CANON has 5 fields · 3 list-kind + 2 prose-kind · × remove + + add row · `mode: 'sections'\|'markdown'` collect() |
| v1.59.0 | UX-A14 | `@media (max-width: 420px)` block · `.card-row` 1fr · `.dash-hero-cta` column + full-width · `.page-header` column · `.qa-grid` minmax(160px, 1fr) |

**Cycle stats:** 15 single-fix releases + 1 verification patch (v1.59.1, NEW-D1 guard relaxation) · 962 unit tests at v1.59.1 (was 949 at v1.58.51) · 100% CI-green · all AI-review LGTM · zero rollbacks.

---

## §15 — v1.59.2 → v1.59.7 final polish cycle invariants (regression-locked)

The 7-release cycle that closed the FIX-PROMPT-FINAL-CONSOLIDATED queue. Each row has a static or behavioural guard in `tests/qa-report-fixes.test.mjs` or `tests/api-404-json.test.mjs`. See `qa/REGRESSION-PROMPT-FINAL.md` for the post-cycle verification ladder.

| Release | Ticket | Lock-test asserts |
|---|---|---|
| v1.59.2 | chip hotfix | Provider chips read `Array.isArray(keysConfigured).length`; NAME map keyed by `anthropic` (server contract); `.api-keys__summary` NOT `position: sticky` |
| v1.59.3 | UX-A5-r2 | `help.js` TOC `rootMargin: '-20% 0% -55% 0%'` (25 % band) · explicit `root: null` · `applyCurrent(id)` initial-state computation |
| v1.59.4 | NEW-OR1 | `refreshApiSummary` race-safe: `inFlight` token drops stale resolves · atomic `replaceChildren()` swap · `lastGoodSt` cache survives transient null |
| v1.59.5 | NEW-F1 | `app.all('/api/*', …)` JSON-404 on GET/POST/PUT/DELETE (was GET-only) · new test suite `tests/api-404-json.test.mjs` (5 cases) |
| v1.59.6 | NEW-D2-motion | `@media (prefers-reduced-motion: reduce)` block · `animation-duration: 0.01ms` + `transition-duration: 0.01ms` + `scroll-behavior: auto` |
| v1.59.7 | NEW-D3-cache | `GET /api/cv` sends `Cache-Control: no-store` |

**Cycle stats:** 7 releases · 971 unit tests at v1.59.7 (was 962 at v1.59.1) · 1 chip hotfix (v1.59.2, user-reported visual + count bug) · all CI-green · all AI-review LGTM.

**Carry-over lessons added to the doctrine recap (`qa/REGRESSION-PROMPT-FINAL.md` §0):**

- Server contract reminder: `keysConfigured` is an ARRAY, `activeProvider` is the resolved NAME (`anthropic`, not the env value `claude`).
- `position: sticky` + `z-index: <N>` creates a stacking context that overlaps anything below it on scroll — only use sticky when overlap is intentional.
- `app.get('/api/*', …)` is GET-only — use `app.all` for JSON-404 fallback across all verbs.
- DOM refresh races during Save: build new nodes first, then `replaceChildren()` atomically.
- `IntersectionObserver` `rootMargin` too tight = scroll skips the trigger zone (10 % band → 25 % band).

**Carry-over lessons added to `CLAUDE.md` § Hard-won lessons:**

- `saveBtn.onclick =` is a footgun on `c()`-built elements — they register handlers via `addEventListener`. v1.58.58 patch.
- Lifecycle listeners must scope to the route via `hashchange` cleanup. Same pattern repeated 4× this cycle (v1.58.36/52/55/58).
- The CHANGELOG.md prose count of i18n keys must match the actual diff — reviewer caught v1.58.55 saying "Three" when only "Two" shipped.
- Author cascade rule for `[hidden]` — third repeat (after v1.58.34/35). Codified as §4 of `qa/REGRESSION-PROMPT-MATURITY-10.md`.

---

## §A — EXHAUSTIVE MATRIX (every page × every control × 9 locales)

> Run **after** §0–§11 pass. This is the brute-force sweep: every
> route, every button, every input, every API, every locale, every
> error path. Mark each cell **PASS / FAIL / PARTIAL / N/A** with
> evidence (route, exact copy, screenshot, response body, log line).
> A cell is PASS only if the behaviour is correct **and** legible.

### §A.0 — Locale sweep protocol (do EVERY page in ALL 8)

Locales (exact `i18n` keys): **`en` · `es` · `pt-BR` · `ko` · `ja` ·
`ru` · `zh-CN` · `zh-TW`**. For each locale:

1. Switch via the header language selector → reload → confirm choice
   persists (localStorage) and `document.title` updates per route.
2. On every page below check: **(a)** no untranslated key / raw
   `key.path` / leftover English in a localized string (e.g. the old
   "smart questions", `Deep research` H1 on RU — I18N-012/013);
   **(b)** no clipped/overflowing label (CJK + DE-length: `ko`/`ja`
   placeholders, `zh` buttons, the `#/help` "Filter sections" box —
   UX-031); **(c)** `⌘K`/`Ctrl K` hint platform-correct;
   **(d)** numerals/dates localized where the design localizes them;
   **(e)** the `(METHOD /path · HTTP NNN)` diagnostic stays literal
   (by design) while the human sentence around it is localized.
3. Toasts: trigger at least one success + one error toast per page
   and confirm the message is localized, wraps (does not clip), and
   the error dwell is long enough to read.

### §A.1 — Every route renders (incl. aliases & mode slugs)

Canonical: `#/dashboard #/scan #/pipeline #/evaluate #/deep #/cv
#/tracker #/reports #/activity #/config #/profile #/health #/help
#/auto #/apply #/batch`. Mode slugs: `#/project #/training #/followup
#/batch-prompt #/contacto #/interview-prep #/patterns`. Aliases:
`#/settings`→profile, `#/portals`→config (opens Regional group),
`#/outreach`→contacto (BUG-004). Unknown route `#/zzz-nope` → 404
page with a working "Back to Dashboard".

For EACH (× 9 locales): no console error, no `pageerror`, `#content`
non-empty, exactly one `<h1>` (or the deliberate `#/cv` breadcrumb
chip — BUG-009 is **by design**, do not refile), page-title +
descriptive subtitle present (incl. `#/reports` empty state —
BUG-010), sidebar item highlighted (incl. when reached via a direct
alias URL — UX-026).

### §A.2 — Every control / button (per page)

For each: keyboard-reachable (Tab), visible focus ring (no spurious
brand ring on router-managed headings), `aria-label`/label wired,
`Enter`/`Space` activates, disabled state honoured, double-click /
in-flight re-entrancy guarded (spinner + disabled), success **and**
failure both produce a visible localized toast/inline message (no
silent failure).

- **Global:** sidebar nav (every item), language selector, theme
  toggle (light/dark — `<html data-theme>` flips instantly, all
  pages legible), global search (`⌘K`/`Ctrl K` focuses; cleared on
  route change), connection-lost banner + auto-recovery, modal
  (Esc / backdrop / × / Cancel all close & restore focus; Tab
  trapped).
- **#/dashboard:** every Quick-action / hero CTA (note duplicate
  paths to Pipeline/Scan — UX-030, verify each actually navigates),
  Doctor + Verify buttons → progress toast **dismissed** before the
  result modal (BUG-007), modal title == localized button label
  (BUG-008), `pre.console` scrollable, modal closes clean.
- **#/scan:** source checkboxes, Advanced-filters disclosure, **Scan
  now** (live SSE log streams; per-source rows incl. honest `HTTP
  404` for dead portals — UX-022 is parent-config, not a code FAIL),
  prominent **Stop** aborts mid-stream, results table populates.
- **#/pipeline:** add URL — valid → "Added"; **duplicate → "Already
  in the queue — skipped" info toast, queue count unchanged**
  (BUG-005); invalid (`not-a-url`, `javascript:`, `<script>`,
  loopback) → 400 + humanized sentence-cased message + `(POST
  /api/pipeline · HTTP 400)` context (BUG-006), security unchanged;
  row select → preview; delete → focus-trapped confirm (verb in
  title == verb in body — UX-024) → row gone; >1000 rows virtualized
  & scroll smooth; filter; "Evaluate first".
- **#/evaluate:** empty submit → "JD is required" (UX-023); `<50`
  chars → "min 50"; `<script>` (25 chars) → rejected by length gate
  after sanitization; valid → manual prompt OR live result (provider
  honoured); Save JD; cost hint reflects the **actual** active
  provider/model (UX-028).
- **#/deep:** empty company → required; valid → manual prompt OR
  live brief; **rendered brief is clean** (no `<tool_call>{json}`,
  `<tool_response>`, `<thinking>` — cleanLlmMarkdown), markdown
  formatted (headings/tables/bold/links/blockquote-bold — BUG-003);
  saved to interview-prep; Copy / Download .md / Generate PDF.
- **Saved research / #/interview-prep list:** open a brief saved
  *before* v1.58 (had scaffolding) → renders clean (cleaned on
  serve); delete one → confirm → gone; `today`/date chips localized
  (I18N-016).
- **#/cv:** Upload CV (multipart; bad file rejected, no corruption),
  sync-check, Generate PDF (SSE), Save (XSS payloads in 6 forms all
  stripped via `stripDangerousMarkdown`; side-by-side preview safe).
- **#/tracker:** funnel chips filter; server-side pagination
  (first/prev/next/last, clamps when filtered); Dedup / Normalize /
  Merge TSV → focus-trapped confirm (the quoted action word is
  English by design — UX-025) → applications.md rewritten via
  `withFileLock`; row actions accessible-named.
- **#/config (3 tabs):** API-keys — every field; **PORT/HOST
  prefilled `4317`/`127.0.0.1`**; save valid → success; save bad
  PORT/HOST/Anthropic-key → 400 with **per-field** detail
  (`FIELD: reason — how to fix`) + request context; **secret fields
  never echo the typed value** (length only); a key pasted with
  surrounding spaces/newlines saves trimmed; `lang` auto-injected by
  api.js must NOT 400 (v1.57.2); LLM_PROVIDER select incl.
  `openrouter`; OPENROUTER_MODEL select loads live catalogue (≥300)
  with curated offline fallback (never empty). Profile tab — field
  form + array editors + raw-YAML escape-hatch (destructive →
  confirm). Modes tab — section form + raw markdown (destructive →
  confirm). Tab a11y: roving tabindex, ←/→/Home/End, `aria-selected`.
- **#/auto:** paste URL → stepper (validate→fetch→evaluate→save→
  track); invalid URL → step 1 fails inline with ✗; Stop; ETA hint;
  artifact deep-links resolve.
- **#/batch / #/batch-prompt:** URLs textarea required; merge TSV;
  `--max-retries N` (1–10) honoured.
- **Mode pages** (`project/training/followup/contacto/interview-prep/
  patterns`): required fields enforced; **`#/followup` Last contact
  optional but if filled must be ISO `YYYY-MM-DD`** (BUG-001 —
  junk blocked client-side, localized error, no network/credit
  burn); Generate prompt → output + Copy; Run-live promoted when a
  key is set.
- **#/health:** ≥13 checks; **"Profile customized" = NOT-ok for a
  test-fixture name** (`Acceptance Test`/`Real Person`/… — BUG-002/
  UX-032) while a real name passes; provider rows match
  `/api/status/providers`; footer `vX`.
- **#/help:** TOC filter; every `##`/`>` block renders markdown
  (bold/code/links inside blockquotes — BUG-003); canonical
  career-ops.org links present ×9; TOC item labels localized
  (I18N-011 — CLOSED v1.58.2: TOC headings now localized to the sidebar nav.* term in all 7 locales; verify TOC ↔ sidebar match, do not refile).
- **#/reports / #/activity:** list renders; chip/type filters change
  the URL + list; empty states have subtitle + guidance.

### §A.3 — Every API endpoint (happy + empty + invalid + boundary + security)

GET (read-only, must never write parent): `/api/health`
`/api/dashboard` `/api/status/providers` `/api/config` `/api/cv`
`/api/profile` `/api/portals` `/api/reports[/:slug]` `/api/jds[/:name]`
`/api/tracker` `/api/pipeline` `/api/pipeline/preview`
`/api/interview-prep[/:name]` `/api/modes[/:name|_profile]`
`/api/activity` `/api/openrouter/models` `/api/scan-results`
`/api/scan/sources` `/api/scan/regional/config` `/api/output/pdfs[/:name]`
`/api/help/:lang`. SSE: `/api/stream/{scan,scan-parent,batch,liveness,
pdf,pdf/deep,pdf/report}`. Mutations (only on explicit user action):
POST `/api/pipeline|tracker|evaluate[/test-*]|deep|mode/:slug|
apply-helper|auto-pipeline|reports|batch/merge|config|stream/pdf/inline`,
PUT `/api/cv|profile|modes/_profile|batch`, DELETE
`/api/pipeline|jds/:name|interview-prep/:name`.

Per endpoint: happy 2xx shape correct; empty/missing body → 400 with
useful message (not 500); invalid type/oversize(>4000)/newline →
400 per-field; `:name`/`:slug` traversal (`../`, encoded) → sanitized
404/400; URL-fetching endpoints reject loopback/`file:`/`javascript:`/
script-chars (isValidJobUrl + safeGet DNS-pin); unknown route → 404
JSON; no secret in any body/log; `lang` tolerated everywhere.

### §A.4 — Cross-cutting invariants (must hold every release)

CSP (no `unsafe-inline`/`unsafe-eval`, `frame-ancestors 'none'`) ·
`X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy` set ·
`UI.md()` escape-first remains the XSS boundary (`cleanLlmMarkdown`
is a declutter step, NOT a sanitizer) · parent files only written on
explicit user action · `.env` never committed · 8-locale i18n parity
(`tests/i18n-coverage.test.mjs`) · a11y form wires
(`tests/a11y-form-wires.test.mjs`) · `PATHS` resolves once per
process (test path-coupled helpers statically) · pre-commit AI review
is advisory, **`ci.yml` is the gate** — confirm CI + Release +
Publish conclusions after every tag push.
