# QA Full Regression — career-ops-ui (whole-project)

> A complete, standing regression checklist for the **entire** app — not a
> per-release delta. Run before a milestone, a risky refactor, or a
> confidence check. Current baseline: **v1.131.1** · **2135** unit/integration ·
> **72** scan sources (67 EN + 5 RU) · **31** route modules · **17** UI locales.
>
> Golden rules while testing:
> - **Never point a running test/server at the real parent.** Use a throw-away
>   `CAREER_OPS_ROOT=$(mktemp -d)` with a minimal fixture (`cv.md`,
>   `config/profile.yml`, `portals.yml`, `data/applications.md`, `modes/oferta.md`,
>   `templates/states.yml`). The parent may hold a live job search.
> - **Never load real user data into a screenshot or the transcript.**
> - Capture `npm test`'s exit code directly — never `npm test | grep` (grep masks the code).

---

## 0. Preflight / environment

- [ ] Node ≥ 18 (`node -v`). Server runs on `127.0.0.1:4317` (`npm start`).
- [ ] `npm ci` clean; production deps are exactly `express`, `js-yaml`, `multer`.
- [ ] `GET /api/health` → `version` matches `package.json`; `parentVersion` reported separately (they drift independently).
- [ ] No `.env` committed; `.env.example` holds placeholders only.

## 1. Automated gates (all must pass)

- [ ] `npm test` — **2135 / 2135**, exit 0. (Flaky watch: `scan-stream-multi-phase.test.mjs` can race in the full parallel run — re-run in isolation; passes 11/11.)
- [ ] `npm run test:coverage` — keep the ~93 % line / ~83 % branch baseline at or above (80 % line floor per CLAUDE.md).
- [ ] `npm run test:e2e` (smoke, 20) and `npm run test:e2e:full` (comprehensive, 23) — green.
- [ ] `npm run test:e2e:browser` — Playwright smoke + full-cycle + forms + locale-sweep ×17 + theme-toggle + widgets — green.
- [ ] `node tools/i18n-audit.mjs` — no personal data / empty / bare-date / broken-alias; parity across 17 locales.
- [ ] `node scripts/check-changelog-parity.mjs` — all 16 localized CHANGELOGs at the current version.
- [ ] `node scripts/check-no-also-leftovers.mjs` — no `.also(` leftovers in views.
- [ ] `npm run test:ci` — the composite gate green.

## 2. Server / API security envelope (the hard rules)

- [ ] **CSP is unconditional** and excludes `'unsafe-inline'`/`'unsafe-eval'` from `script-src`; `frame-ancestors 'none'`; `object-src 'none'`. Verify response headers on `/`. `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy`, and `X-Powered-By` disabled.
- [ ] **SSRF guard** — every user-URL ingress goes through `isValidJobUrl()` (`/api/pipeline`, `/api/pipeline/preview`) and outbound fetches through `safeGet()` (DNS-pinned, redirect-revalidated). Loopback / `file://` / script chars rejected (`400`).
- [ ] **XSS boundary** — CV/markdown ingress through `stripDangerousMarkdown()` (server) and `UI.md()` (client) only. `cleanLlmMarkdown` is NOT a sanitizer. Confirm `<script>`, `javascript:`, `onerror=` are stripped (`tests/cv-xss-bypasses.test.mjs`).
- [ ] **Prototype-pollution guards** — `content.mjs`/`config.mjs` reject `__proto__`/`constructor`/`prototype` keys.
- [ ] **Scan-source host-pinning** — every source module pins its host (exact-match regex + HTTPS + `redirect: 'error'`), and each adapter's `buildEndpoint` re-validates any `api:` override before it reaches the fetch slot (v1.131.1 parity across a16z-speedrun-talent + cryptocurrencyjobs).
- [ ] **Rate-limit** (`llmRateLimit`) + **file-lock** (`withFileLock`) on the write paths.
- [ ] **Parent is read-only** except explicit user writes: `POST /api/pipeline`, `POST /api/tracker`, `PUT /api/cv`, `POST /api/jds`, `DELETE /api/{jds,interview-prep}/:name`, `POST /api/config`, the streaming runners, and the user-layer writers (`career-plan`, `two-pager`, `memory`, `networking`, `followup/seed`). No other route mutates the parent.
- [ ] All 31 route modules registered in `server/index.mjs` (`register<Topic>Routes(app)`); `GET /api/scan/sources` returns 72 (67 EN + 5 RU).

## 3. Scanners (in-process, zero-token)

- [ ] `GET /api/scan/sources` lists all 72; the EN set includes the newest (a16z-speedrun-talent, cryptocurrencyjobs); RU set is the 5 canonical.
- [ ] `ALL_ADAPTERS.length === 67` (`tests/adapter-registry.test.mjs`) with the exact sorted id list.
- [ ] `FALLBACK_SOURCES` in `public/js/views/scan.js` matches the live registry (drift gate `tests/scan-fallback-sources.test.mjs`).
- [ ] A `dryRun=1` scan against a fixture returns normalized job objects; no real network needed in tests (`fetchImpl` injection).
- [ ] `#/scan`: source dropdown, Advanced-filters disclosure, Country + **Seniority** facets, Remote/Hybrid/Onsite, Exclude keywords, saved searches/★ favorites, per-source cap, "Posted within" age, **Age** freshness column, `◎` fit badge, repost 🔁 panel. Logos toggle-gated.
- [ ] hh.ru note: from a full-tunnel VPN the RU scan may return 0 hits (egress routing) — disconnect VPN when scanning from the UI; not a code bug.

## 4. SPA — every route renders (fixture-backed, 0 console errors)

Boot each route via `#/<route>`; confirm the view renders and the browser console has **0 errors**. (Verified clean at v1.131.1 across all of the below.)

- [ ] **Command center**: `#/dashboard` (today tiles, funnel links).
- [ ] **Search**: `#/scan` (see §3), `#/pipeline` (overview strip + virtualized list), `#/auto` (SSE auto-pipeline), `#/batch`.
- [ ] **Evaluate**: `#/evaluate`, `#/deep`, `#/contacto`, `#/interview-prep`, mode pages.
- [ ] **Tracker (CRM)**: `#/tracker` — **stage-tab strip** shows All + every canonical status with live counts **including zero-count stages**; clicking a stage filters, clicking the active tab returns to All; keyboard focus stays on the active tab; counts are in each tab's accessible name; Hired banner on a Hired row; Normalize/Dedup/Merge gated + confirm-before-write; score-tone + legitimacy + PDF + report columns; optional brand logos.
- [ ] **Reports**: `#/reports` (list + single report render through `UI.md()`).
- [ ] **CV**: `#/cv` (view/edit through `stripDangerousMarkdown`), `#/cv-studio` (humanize / tailor / add-entry / diagnostics / privacy-mask).
- [ ] **Growth**: `#/two-pager`, `#/career-plan`, `#/orientation`, `#/memory`, `#/networking`, `#/mock-interview`.
- [ ] **Stats**: `#/stats` (Market · My pipeline · Target-role trend · Rejection patterns · Lifetime) with MD/PDF/DOCX export.
- [ ] **Utility**: `#/usage` (AI usage & cost windows), `#/portals` (health probe), `#/activity` (journal), `#/health` (checks), `#/config` (Profile / Modes / API-keys / AI-CLI-tools / Appearance tabs), `#/help`, `#/docs-assistant`.
- [ ] **404**: an unknown `#/…` route shows the dedicated 404 view (not a crash).
- [ ] **Persistent widgets**: notifications drawer (toast journal, cap 50), floating "Ask the docs" FAB, USAGE HUD pinned to the sidebar bottom, in-app bug reporter (privacy-floored snapshot → pre-filled GitHub issue; never CV/profile/URLs/keys).

## 5. Client conventions & a11y

- [ ] No inline `onclick=`; every handler via `addEventListener`/`UI.el` `onClick` (CSP-safe). No raw `fetch` in views — only `API.{get,post,put,delete}` / `API.stream`.
- [ ] Navigation via `Router.go`; the router strips `?query` for the route lookup; views read query params themselves.
- [ ] Paginator `pager.reset()` on filter change (deep-page → page 1).
- [ ] Sortable table headers keyboard-operable with `aria-sort`; tab strips use `role=tablist`/`tab` + `aria-selected`, ≥44 px hit area.

## 6. i18n (17 locales)

- [ ] Language picker (flag `<select>`) switches every page live; no missing-key fallbacks visible.
- [ ] **Arabic RTL** — `<html dir="rtl">` set; the `[dir="rtl"]` block mirrors the chrome; LTR locales byte-for-byte unchanged.
- [ ] Help guide (`docs/help/<lang>.md`) present in all 17 with the gated **29 H2 / 105 H3** structure.
- [ ] Server diagnostics stay **English by policy** — no per-locale text in server error bodies.

## 7. Parent integration & isolation

- [ ] Every write action targets the parent only on explicit user action (§2); a code-only path never writes.
- [ ] `PATHS.*` used everywhere; nothing hardcodes `../cv.md`. `paths.mjs` resolves once per process (`tests/paths-once.test.mjs`).
- [ ] Read-only relays (`stats.mjs`, `salary-gap.mjs`, `analyze-patterns.mjs`, `followup-*`) fail soft to `{available:false}` without the parent scripts.
- [ ] Tests bootstrap their own `CAREER_OPS_ROOT`; no test leaks a write into the real parent (`tests/test-root-isolation.test.mjs`).

## 8. Site (cvstart.org) & deployment

- [ ] Site builds (Node ≥ 22 via nvm): `cd site && npm run build`. `facts.json` regenerates from the live registry (version/tests/sources/locales). "Job sources" chips = 72; changelog page reads "all 17 languages".
- [ ] Release flow: tag fires **Release**; **Publish** must be dispatched manually (`gh workflow run publish-package.yml --ref vX.Y.Z`) — never `npm publish` locally. **Pages** is paths-filtered on `site/**`; if only facts changed, dispatch `deploy-pages.yml`.
- [ ] Wiki Home banners ×17 + Scanner-Providers + Testing-and-QA + Release-Process reflect the current version/counts.

## 9. Regression floors (do not regress)

- [ ] Unit/integration ≥ **2135**; smoke E2E ≥ 20; comprehensive E2E ≥ 23; Playwright ≥ its floor.
- [ ] Help bundles exactly **29 H2 / 105 H3** ×17; CHANGELOG parity ×17.
- [ ] Coverage: keep the ~93 % line / ~83 % branch baseline at or above (80 % line floor).
- [ ] Registry 72 sources / `ALL_ADAPTERS` 67; 31 route modules; 17 locales.

## 10. Known traps (don't re-chase)

- [ ] `[hidden]` is a no-op against an author `display:` rule — override with `.selector[hidden]{display:none}` or toggle a class.
- [ ] `cleanLlmMarkdown` ≠ XSS sanitizer (the boundary is `UI.md()` + `stripDangerousMarkdown()`).
- [ ] Pre-commit AI review is advisory; **`ci.yml` is the hard gate** — watch the CI run, not just the local hook.
- [ ] File-size debts (standing): `public/js/views/scan.js` (~1254), `public/js/views/config.js` (~1010), `public/css/app.css` (~1990) are past the 800-LOC hard target — split is ROADMAP-level.
