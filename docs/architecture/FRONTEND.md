# Frontend Map — career-ops-ui

> SPA architecture. Vanilla JS, hash-routed, no framework, no build step. Pair with `OVERVIEW.md` and `API.md`.

## Entry point

`public/index.html` (~520 LOC) is the only HTML file. Loads, in order:

1. An inline theme bootstrap `<script>` that sets `data-theme` on `<html>` **before** any stylesheet (no theme flash).
2. **CSS** — three ordered base stylesheets, then the per-feature v2 sheets, then `map.css` and the v3 design tokens:
   `css/app.css` → `css/components.css` → `css/overlays.css` → `css/v2-pipeline.css` → `css/v2-reports.css` → `css/v2-llm.css` → `css/v2-nav.css` → `css/v2-dash.css` → `css/map.css` → `css/tokens-v3.css` → vendored `vendor/leaflet/leaflet.css`. Order is load-bearing (the v2 sheets override the base cascade); `tests/css-modularization.test.mjs` locks the base-three order and per-file size caps.
3. **JS** — the 19 per-locale dictionaries (`js/lib/locales/i18n-dict.<lang>.js`) → `i18n-dict.aliases.js` → `i18n-dict.js` (assembler) → `i18n.js` (defines `window.I18n`) → the lib modules (`window.*` helpers) → each `js/views/*.js` (registers itself with `Router.register`) → `js/app.js` (boot script, last).

The SPA mounts inside `#content`. Sidebar nav, top-bar, and footer are static in `index.html` — they don't re-render per route.

## Globals (the entire client state)

| Global | Type | Defined in |
|---|---|---|
| `window.Router` | `{ register, render, go, current }` | `router.js` |
| `window.API` | `{ get, post, put, delete, stream }` | `api.js` |
| `window.UI` | toast, modal, spinner, DOM helpers | `api.js` (extended by `lib/skills.js`) |
| `window.I18n` | `{ t, getLang, setLang, getLangs, onChange }` | `lib/i18n.js` |

Views must not introduce new globals. Lib modules **may** expose one `window.<Namespace>` each (`ScanResults`, `TrackerStages`, `NavV2`, `HelpHint`, …) — that is the established extension pattern; `index.html` wires them as plain `<script>`s.

## Router

Hash-based: `#/dashboard`, `#/scan`, `#/pipeline/<param>`, `#/mode/:slug`, etc. Aliases in `router.js` keep URL stability across renames (e.g. `#/profile` → `settings`). Unknown routes render the `__not_found__` view (registered inside `router.js` to guarantee availability).

`Router.register(name, async (params) => Node|string)`. The router clears `#content` to a loading state, awaits the renderer, swaps in the result, and toasts on render error (with a network-aware message and a retry button). `mode-page.js` registers its mode routes dynamically from its config table.

Navigation chrome beyond the raw router lives in `lib/nav-v2.js` (CAR-122): collapsible sidebar groups (persisted in `localStorage career-ops-ui:nav-v2`, an untouched group follows the active route), favorites (star-pinned, reorderable), recents (last 5 sections), and the **Cmd/Ctrl+K command palette** — a fuzzy filter over every route plus actions, an ARIA combobox/listbox inside a modal dialog with a focus trap. It derives its registry from the static `<nav>` DOM at boot (zero drift) and consumes the Cmd+K chord before `app.js`'s legacy fallback.

## Views (`public/js/views/`)

32 top-level view files (plus `config/` and `scan/` sub-modules):

| File | Route | Purpose |
|---|---|---|
| `dashboard.js` | `#/dashboard` (default) | KPI cards, recent applications, last report (v2 stylesheet `v2-dash.css`, CAR-114). |
| `scan.js` | `#/scan` | Live SSE scanner UI; results rendering extracted to `lib/scan-results.js`, engine to `scan/runner.js`, filter state machine to `scan/filters.js`. |
| `pipeline.js` | `#/pipeline` | Pipeline v2: enriched cards, grouped view, bulk discard with undo (CAR-116, `v2-pipeline.css`). |
| `reports.js` | `#/reports` | Reports v2: search/filters/sort/card view (CAR-118, `v2-reports.css`). |
| `evaluate.js` | `#/evaluate` | Paste a JD → save / run live / manual prompt. |
| `deep.js` | `#/deep` | Deep research per company; live (any configured provider) or manual. |
| `apply.js` | `#/apply` | Apply helper view. |
| `tracker.js` | `#/tracker` | CRM-style stage-tab board over `data/applications.md` (`lib/tracker-stages.js`). |
| `cv.js` | `#/cv` | Side-by-side CV markdown editor + sanitized preview. |
| `cv-studio.js` | `#/cv-studio` | CV humanize / tailor / diagnostics / privacy mask. |
| `config.js` | `#/config` | App Settings — parent `.env` keys, providers, appearance; split into `config/field-specs.js` + `config/tab-controller.js`. |
| `settings.js` | `#/profile` (alias `#/settings`) | Profile YAML viewer. |
| `health.js` | `#/health` | `/api/health` checks rendered with traffic-light icons. |
| `mode-page.js` | `#/mode/:slug` (+ per-mode routes) | Generic mode runner over `modes/<slug>.md` (LLM-page kit). |
| `auto.js` | `#/auto` | Auto-pipeline SSE (fetch → evaluate → PDF → tracker). |
| `batch.js` | `#/batch` | Batch runner UI. |
| `two-pager.js` | `#/two-pager` | Candidate two-pager builder + AI draft. |
| `interview-digest.js` | `#/interview-digest` | Weekly interview digest. |
| `mock-interview.js` | `#/mock-interview` | Mock interview chat (turn-by-turn). |
| `networking.js` | `#/networking` | Networking plans. |
| `career-plan.js` | `#/career-plan` | AI career development plan. |
| `orientation.js` | `#/orientation` | Career orientation profile. |
| `memory.js` | `#/memory` | About-me note (inlined into every AI request). |
| `stats.js` | `#/stats` | Statistics: AI market report / own pipeline / target-role trend / lifetime tabs. |
| `usage.js` | `#/usage` | LLM token & cost rollups (`lib/usage-hud.js` paints the sidebar HUD). |
| `activity.js` | `#/activity` | Activity log viewer. |
| `assessments.js` | `#/assessments` | Skills-assessment log. |
| `funded.js` | `#/funded` | Funded-company discovery cards. |
| `portals.js` | `#/portals` | Tracked companies + ATS health (v2, CAR-121, `v2-portals.css`). |
| `docs-assistant.js` | `#/docs-assistant` | Grounded help-guide chat (`lib/docs-fab.js` floats it on other pages). |
| `help.js` | `#/help` | Renders `docs/help/<lang>.md` from the API. |
| `map.js` | `#/map` | Leaflet job map (`map.css`, `lib/map-prefs.js`, geocode via `/api/geocode`). |

Each view file:

1. Starts with `Router.register('<name>', async (params) => { ... })`.
2. Builds DOM with `document.createElement` (preferred) or static `innerHTML` for trusted templates.
3. Wires events via `addEventListener` — never inline `onclick=`.
4. Calls `API.*` for network. Never raw `fetch`.
5. Translates user-facing strings via `I18n.t('key', 'fallback')` or `data-i18n="key"` attribute.

## Lib modules (`public/js/lib/`)

39 modules. The most load-bearing:

| Module | Exposes | Purpose |
|---|---|---|
| `i18n.js` + `i18n-dict.js` + `i18n-dict.aliases.js` + `locales/i18n-dict.<lang>.js` (×19) | `window.I18n` | Locale loading, `t()`, `data-i18n` walker, RTL flip. |
| `nav-v2.js` / `nav-v2-core.js` | `window.NavV2` | Sidebar v2 + Cmd/Ctrl+K palette (core = pure state machine, unit-tested). |
| `scan-results.js` | `window.ScanResults` | `#/scan` results rendering (rows, facets, pagination) extracted from the view. |
| `tracker-stages.js` | `window.TrackerStages` | Canonical stage funnel: `foldStatus` + `stageCounts` from `GET /api/tracker/stages`. |
| `job-facets.js` | `window.JobFacets` | Seniority/source/age facets for scan rows. |
| `score-tone.js` | `window.ScoreTone` | 4-tier score colour tone (null-safe). |
| `fit-score.js` | `window.FitScore` | Client-side ◎ fit heuristic (two-pager vs posting). |
| `company-logo.js` / `provider-logo.js` | `window.CompanyLogo` / `window.ProviderLogo` | CSP-safe SVG monograms/brand logos for companies and the 18 LLM providers. |
| `provider-status.js` | `window.ProviderStatus` | Which LLM providers have keys (`GET /api/status/providers`). |
| `status-class.js` | `window.StatusClass` | Canonical tracker status → CSS badge class. |
| `report-labels.js` / `report-ops.js` | `window.ReportLabels` / `window.ReportOps` | Localized report labels; `#/reports` v2 client ops. |
| `skeleton.js` | `window.Skeleton` | Skeleton loading rows (instant h1 pattern, CAR-112). |
| `llm-page-kit.js` | `window.LlmPageKit` | Shared template for the 12 AI-tool pages (CAR-119, `v2-llm.css`). |
| `focus-preserve.js` | `window.FocusPreserve` | Focus preservation across re-renders (search/filters). |
| `pipeline-view.js` / `followup-view.js` | `window.*` | Pipeline card rendering; follow-up cadence board. |
| `modes-form.js` | `window.ModesForm` | Structured editor over `modes/_profile.md` blocks. |
| `role-stats.js` | `window.RoleStats` | Client salary/role aggregation (currency parsing, USD conversion). |
| `skills.js` | `window.UI` extensions | Skill-chip helpers (Unicode-safe keyword matching). |
| `countries.js` | `window.Countries` | Free-text location → ISO country/flag detection (memoized). |
| `cv-diagnostics.js` / `cv-privacy.js` | `window.CvDiagnostics` / `window.CvPrivacy` | Deterministic CV score; in-browser PII masking. |
| `pdf-generate.js` / `report-export.js` | `window.*` | SSE PDF generation; MD/PDF/DOCX export bar. |
| `auto-pipeline.js` | `window.AutoPipeline` | Client side of the auto-pipeline SSE flow. |
| `scan-prefs.js` / `map-prefs.js` | `window.*` | Saved searches + favorites (localStorage); map preferences. |
| `theme-bootstrap.js` | — | Pre-stylesheet `data-theme` application (inlined `data-*` in index.html). |
| `logbuf.js` / `bug-report.js` | `window.LogBuf` / `window.BugReport` | Error ring buffer → pre-filled GitHub issue (privacy-floored). |
| `help-hint.js` | `window.HelpHint` | Reusable `?` popover on view titles. |
| `docs-fab.js` | `window.DocsFab` | Floating docs-assistant button. |
| `usage-hud.js` | `window.UsageHud` | Sidebar LLM-usage HUD. |
| `url-key.js` | `window.UrlKey` | Client mirror of posting-URL normalization (dedup keys). |

## i18n

`public/js/lib/i18n.js`:

- Locales: **19** — `en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr, pl, uk, da, ar, de, it, tr, hi, ta, vi` (Arabic is RTL via `<html dir>`; `vi` is Latin-script LTR).
- Persistent: language choice stored in `localStorage`.
- Keys live one-file-per-locale under `public/js/lib/locales/i18n-dict.<lang>.js` (I18N-SPLIT v1.60.0); `i18n-dict.js` is a small assembler that merges them into `window.__I18N_DICT`; `i18n-dict.aliases.js` maps `@alias` keys onto canonical ones.
- `I18n.onChange(handler)` re-renders on switch — `app.js` re-applies `data-i18n` attrs and re-renders the active route.

`tests/i18n-coverage.test.mjs` enforces parity: every key present in `en` must exist in every other locale.

## API client (`public/js/api.js`)

`API.<verb>(path, body?)`:

- Adds `Content-Type: application/json` automatically when `body` is an object.
- Throws on non-2xx. Errors carry `{ message, status, network: boolean }`.
- Network errors flip a global "no connection" banner (`#conn-banner`); successful calls clear it.
- `API.stream(path, onEvent)` — the shared SSE consumer; auto-closes the `EventSource` on `done`. Long-running views (scan, auto-pipeline, batch, pdf-generate) must attach to it or to the per-view runners and must close the stream on navigation-away.

`UI.withSpinner(buttonEl, fn)` — disables the button, shows a spinner, runs `fn`, restores. Used by long-running buttons (Doctor, Evaluate, scans).

`UI.toast(text, kind?)` — top-right toast with auto-dismiss. Kinds: `info` (default), `success`, `error`. The renderer parses any trailing `(METHOD /path · HTTP NNN)` postfix out of the headline and stashes it inside a collapsed `<details class="toast-detail">` (localized `toast.details` summary), so the human sentence reads cleanly while the technical detail stays reachable (BUG-006 invariant).

`UI.modal(title, contentNode)` — show modal. `UI.closeModal()` to dismiss; click on backdrop or `data-close` triggers it. Destructive confirmations go through `UI.confirm(...)`, a focus-trapped promise-based dialog — never native `confirm()`.

`UI.getToastHistory()` *(v1.58.33 / U-13)* — returns a shallow copy of the in-memory toast journal (cap 50, oldest dropped). `UI.onToast(fn)` *(v1.58.34)* — subscribe to every toast push; subscribers are guarded by try/catch so a buggy listener can never break the toast pipeline. These power the notifications drawer (see below).

### Notifications drawer (v1.58.34, hardened v1.58.35)

A right-slide `<aside id="notif-drawer" role="dialog" aria-modal="false" aria-labelledby="notif-title" hidden>` that opens **only** when the user clicks the 🔔 in the top-bar (or activates it via keyboard with Enter / Space). The bell carries `aria-haspopup="dialog"` + `aria-controls="notif-drawer"` + `aria-expanded` that toggles `false ↔ true` on open/close. A red badge counts unread toasts since the last open; opening clears it.

The drawer body lists entries from `UI.getToastHistory()` newest-first; each `<li class="notif-item notif-item--{success|error|info}">` shows a `<time datetime=ISO>localeTime</time>`, the message, and (when present) the U-4 technical postfix in monospace. The empty-state `<p class="notif-drawer__empty">` shows when the journal is empty.

The explicit `.notif-drawer[hidden] { display: none }` override keeps `hidden` a no-op-proof attribute despite author `display: flex` rules. A static guard locks **one** `open()` call site in `app.js` (the bell-click ternary) so no future edit can introduce an auto-open path.

Help **§18 Notifications** in `docs/help/*.md` documents the 3 categories (Success / Error / Info-progress), what is NOT a notification (modals, SSE log lines, spinner-only loading), and the keyboard contract.

## CSS

Eleven own stylesheets in `public/css/`, loaded in a fixed order (see *Entry point*):

| Sheet | Owns |
|---|---|
| `app.css` | Design tokens/theme, a11y base, sidebar, main shell, buttons, content shell (~740 LOC). |
| `components.css` | Cards, grids, paginator, badges, tables, forms, log, markdown, language switcher, chip filters (~730 LOC). |
| `overlays.css` | Toast, notifications drawer, modal, misc/responsive, the `[dir="rtl"]` mirror, docs-fab, usage HUD (~740 LOC). |
| `tokens-v3.css` | The v3 design-token layer — loaded last so token overrides win over everything above. |
| `v2-pipeline.css` | `#/pipeline` v2 (CAR-116). |
| `v2-reports.css` | `#/reports` v2 (CAR-118). |
| `v2-llm.css` | Shared template for the 12 AI-tool pages (CAR-119). |
| `v2-nav.css` | Sidebar v2 + command palette (CAR-122). |
| `v2-dash.css` | Dashboard v2 tail (CAR-114). |
| `v2-portals.css` | `#/portals` v2 + calm `#/health` (CAR-121). |
| `map.css` | `#/map` Leaflet layout (dark tiles, controls, peek card). |

Plus the vendored `vendor/leaflet/leaflet.css` (no CDN — CSP `connect-src 'self'`).

The UX-epic pattern (CAR-114…122): a redesigned feature owns its stylesheet — it loads **after** the base three and uses `v2-*` class prefixes, so the base cascade stays untouched and the feature can be reverted by dropping one `<link>`. `tests/css-modularization.test.mjs` caps each base sheet at ≤ 800 LOC and locks the three-sheet order; CSS-asserting tests read the concatenation via `tests/helpers/css.mjs::loadAppCss()`.

Mobile-first. `@media (max-width: 900px)` toggles the sidebar drawer (off-canvas) — `body.sidebar-open` is the open state, set/cleared by hamburger button + backdrop in `app.js`.

## Adding a new view

1. Pick a route name. Update `index.html` sidebar `<a data-route="...">` if the route deserves nav placement.
2. Add `public/js/views/<name>.js` with a single `Router.register(...)` call.
3. Add the script tag to `index.html` (after `router.js`, before `app.js`). If the view is a v2-style feature, add a `v2-<name>.css` sheet in the same PR instead of growing the base sheets.
4. Add i18n keys to **all 19** per-locale files under `public/js/lib/locales/i18n-dict.<lang>.js`, then regenerate `tests/fixtures/i18n-dict.snapshot.json` (parity is gated by CI).
5. Add an E2E step in `tests/e2e-comprehensive.mjs` covering the happy path.
6. If the view fetches a new endpoint, document it in `API.md` and (if it writes parent files) `DATA-FLOWS.md`.

## What NOT to do

- Don't introduce ES module imports on the client until a build step is adopted (a roadmap-level decision).
- Don't add a global except via the existing four (`Router`, `API`, `UI`, `I18n`) or a single-namespaced lib window.
- Don't bypass the markdown sanitizer for user content (`UI.md()` is the XSS boundary).
- Don't hardcode strings — use `I18n.t`.
- Don't set `window.location.hash` directly outside `router.js` — call `Router.go(...)`.
- Don't grow the base stylesheets with feature-specific rules — a feature sheet (`v2-*.css`) or a token (`tokens-v3.css`) is the pattern.
