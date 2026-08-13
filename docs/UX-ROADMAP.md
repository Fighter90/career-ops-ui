# UX Roadmap — readability, clarity, insight, polish

Consolidated from user feedback (2026-08-11). Executed as a sequence of focused releases; each ships fully (code + tests + docs ×17 + site + wiki) before the next starts.

## Phase 1 — v1.137.0 "Readability" ✅ (shipping)

Fix what's outright unreadable/broken.

- [x] **Dark-mode contrast** — white-on-white / black-on-black across `#/pipeline`, `#/stats` tabs, `#/config`, `#/two-pager`, `#/mock-interview`, `✓ set` / error text. Root cause: 15 CSS tokens (`--fg`, `--panel`, `--panel-2`, `--line`, `--surface-elev1`, `--ok`, `--err`, `--danger`, `--warn`, `--muted`, `--ink`, `--card`, `--border`, `--go`, `--error`) were never declared → fell back to hardcoded light/black. Now aliased to theme-aware tokens. **0 WCAG-AA failures** verified across 29 views by an automated contrast auditor. Regression guard added.
- [x] **Chart labels** hard-cut mid-word → ellipsis + full-text tooltip, wider column.
- [x] **Career plan** rendered raw Markdown → auto-renders formatted, readable text.
- [x] **Config active tab** low-contrast pink pill → readable tinted-badge pattern.

## Phase 2a — v1.138.0 "Generation in your language" ✅ (shipped)

- [x] **Generation language** — every AI generation now outputs in the selected UI language. The `# Output language` directive (`resolveLocale` + `buildLocaleDirective`) is threaded through **all 8** generation endpoints (career-plan, orientation, market, mock-interview, networking, docs-assistant, memory-suggest, two-pager) and the client sends the active `lang` on all 8 generate POSTs. Code + identifiers (e.g. two-pager YAML keys) stay English; only prose is localized. **cv-studio is deliberately excluded** — a résumé/cover letter must follow the CV/JD target-market language, not the UI chrome. +2 canaries. Shipped with review-driven hardening: a source-static CSS colour-role guard, a `UI.md()` XSS-loader self-probe, and a `#/career-plan` scroll guard.

## Phase 2b — v1.139.0 "Understandable" ✅ (shipped, first wave)

Make every page self-explanatory, in every language. (Split out of the original Phase 2; generation-language shipped first as v1.138.0.)

- [x] Reusable **`?` help-hint** component (`window.HelpHint` — CSP-safe popover via `UI.md()`, accessible `role="tooltip"`/`aria-expanded`/Escape, RTL, theme-aware) — shipped and wired to the 5 `#/stats` tabs (the "Rejection patterns (?)" pattern) + 8 AI/analytics view titles.
- [x] **Page descriptions** — already present: every one of the 30 views carries a one-line `page-subtitle`; the `?` adds the deeper on-demand explanation on top.
- [x] **Clearer empty states** — the `?` on `#/career-plan`, the weekly digest, and `#/funded` explains how to populate them (directly answers the "seems broken / unclear what this is for" reports).
- [x] i18n fan-out ×17 (14 keys) for the first wave.
- [~] **Next wave** — v1.143.0 added the `?` to the 9 core workflow views (scan, evaluate, cv-studio, tracker, config, deep, batch, auto, apply). Remaining lighter views (dashboard, cv, reports, usage, pipeline, portals, activity, docs-assistant) are a final wave.

## Phase 3 — "Insightful stats" (in progress)

Make the numbers correct, detailed, and visual.

- [x] **Richer salary stats** (v1.140.0) — **average** (mean) added alongside min/median/max; **per-year ⇄ per-month** toggle; a **min·avg·median·max table per country** on `#/stats` "My pipeline".
- [~] **Interactive, rebuildable charts** on `#/stats` (v1.145.0) — a **Build a chart** widget on the Target-role trend tab: metric (vacancies / median / average salary) × dimension (by country / by role) selects that re-render live, honoring the currency + period. More metrics/dimensions + export can follow.
- [x] **Correctness** (v1.142.0) — the `#/orientation` AI prompt now MUST rank the top-3 from exactly the 8 named vectors and may NEVER answer "Unknown"/"N/A"/invent a label (a thin CV still gets the 3 closest at lower confidence). Server-only prompt constraint; no more "double down on Unknown".
- [x] **Funded companies** enrichment (v1.141.0) — company **logo** + **funding-amount visualization** + **discovery-score / suggested-action** cards. (Description + salary range aren't in the public funding feed, so they're out of scope for this source; revisit if an enrichment source is added.)

## Phase 5 — Nous Research / Hermes provider

Add **Nous Research (Hermes)** as an LLM provider in the OR-router, per <https://hermes-agent.nousresearch.com/docs>. **✅ SHIPPED v1.151.0 (Shape A).**

- [x] **Scope done.** The scoping spike found that while Hermes is an autonomous-agent runtime, its `hermes gateway` **API Server** exposes an **OpenAI-compatible** `POST /v1/chat/completions` (base `http://127.0.0.1:8642/v1`, Bearer `API_SERVER_KEY`, streaming, `GET /v1/models`) — so Shape A applies. Confirmed from the [API Server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server) docs + the [`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent) repo.
- [x] **Shape A — OpenAI-compatible endpoint (v1.151.0).** Added like the existing providers: `HERMES_API_KEY` + `HERMES_BASE_URL` + `HERMES_MODEL` (`server/lib/env-config.mjs` + `#/config` fields ×17), `runHermes` on the shared `runOpenAICompatible` client (`server/lib/openai.mjs`), dispatch branches in **both** `server/lib/llm-dispatch.mjs` and `routes/llm.mjs` (`runActiveProvider` / gate / tail), the provider-order cascade tail + `LLM_PROVIDER=hermes` pin, `/api/status/providers`, and a `server/lib/llm-pricing.mjs` row. (`cli-detect` intentionally unchanged — Hermes is a *provider*, not a coding-agent CLI.)
- [~] **Shape B (agent runtime)** — not needed; the API Server made Shape A sufficient. Retained in `docs/integrations/HERMES.md` as the alternative had the contract been runtime-only.
- [x] **Tests + i18n + docs (v1.151.0).** CI-isolated stubbed-transport tests (`tests/hermes-provider.test.mjs` + updated provider-surface tests + the inverted `hermes-docs` canary), 6 new `#/config` i18n keys ×17 (snapshot 1208→1214), and `HERMES.md`/help/README updated from "planned" to "wired".

*Standalone item — independent of Phases 2–4. The cloud-deploy + Telegram bridge (Phase 5b docs) remain operator how-to, not app features.*

### Phase 5b — Hermes docs, cloud + Telegram deployment guide, and a Hermes skill

A **documentation-and-skill deliverable** that can ship independently of (and ahead of) the provider-integration code above — it explains what Hermes is, how to run career-ops-ui on a **cloud server**, and how to wire the pipeline to **Telegram through Hermes**, then packages that flow as a reusable skill.

- [x] **README — new "Hermes agent + Telegram" section** *(v1.146.0)*. A short `## Hermes agent + Telegram` teaser (who Hermes is, why you'd bridge, the not-yet-wired honesty marker) + a link to the deep-dive, in `README.md` and mirrored across the fully-translated locale READMEs. Kept short — a teaser + link, not the whole guide.
- [x] **`docs/` — dedicated deep-dive** *(v1.146.0)* (`docs/integrations/HERMES.md`, linked from `docs/architecture/OVERVIEW.md`'s new **Integrations** section): (1) Hermes overview + the two integration shapes from Phase 5 (OpenAI-compatible endpoint vs. agent runtime); (2) **cloud-server deployment** — a small VPS, Node ≥18, `.env` with the provider key(s), reverse proxy over HTTPS, systemd/pm2, the read-only parent contract on a headless box, and the CSP/SSRF/markdown/no-secrets invariants that must survive the move off `127.0.0.1`; (3) **Telegram via Hermes** — connecting a Telegram bot to a running Hermes agent (push vs. tool-call), with the SSRF + no-secrets-in-logs guards and an explicit "what NOT to expose" threat-model list.
- [x] **In-app help guide — new H2 section ×17** *(v1.147.0)*. Added `## 30. Hermes & Telegram` to `docs/help/<lang>.md` for all 17 locales (gated H2/H3 counts bumped **29→30 / 105→108** in `canonical-docs-coverage`/`help-ui`/`help-ru-config-section`); the `docs-assistant`/`DocsFab` grounding picks it up automatically (both read `docs/help/<lang>.md`). Reachable from `#/help`. Canary `tests/help-hermes-section.test.mjs`.
- [x] **cvstart.org site — landing/docs surface** *(v1.147.0)*. The /help pages auto-render §30 ×17 at build, and a **Resources footer deep-link** (`footer.hermes` ×17) points to the GitHub guide — a docs pointer, not a features-grid claim (a planned feature doesn't belong in the shipped-features grid).
- [x] **A Hermes skill** *(v1.146.0)* — `.claude/skills/hermes-bridge/SKILL.md` operationalizes the guide: given "connect career-ops to Telegram via Hermes" / "deploy to a cloud box", it walks the documented steps, runs a **scoping gate** before any provider code, checks prerequisites (keys, endpoint reachability via the SSRF-safe path, Node version), and never writes secrets to disk/logs. Registered in the skill list; its body cross-links `docs/integrations/HERMES.md` as the single source of truth.
- [x] **Consistency gate.** v1.146.0 did the README + CONVENTIONS + OVERVIEW + PROJECT-CONTEXT sweep and a `tests/hermes-docs.test.mjs` canary (docs/skill exist, honesty markers, `llm-dispatch.mjs` has no Hermes branch). v1.147.0 completed it: the help-H2 ×17 fan-out + the `tests/help-hermes-section.test.mjs` canary + the version/count sweep (2376→2378, 29→30 H2 / 105→108 H3) + the site footer link. **Phase 5b (docs + skill) is complete;** only the Phase 5 provider integration remains, blocked on the API-contract spike.

*The docs + skill can land before the provider code — but keep them honest: mark anything blocked on the Phase 5 API-contract spike as "planned / not-yet-wired" rather than documenting an endpoint that doesn't exist yet.*

## Phase 4 — v1.144.0 "Settings & filters"

Consolidate configuration; make filters beautiful.

- [x] **Portals → Settings** — v1.144.0 added **enable/disable per portal** on `#/portals` (`POST /api/portals/toggle`, surgical portals.yml write; the scanner already honors `enabled: false`); **v1.148.0** redesigned the scan-filter panel into a responsive grid; **v1.149.0** moved the `#/portals` nav item out of *Sourcing* into the *Setup* (settings) group next to *App settings* (`tests/portals-nav-placement.test.mjs`).
- [x] **Scan filters redesign** *(v1.148.0)* — the `#/scan` result-filter panel moved from a ragged `flex-wrap` of rigid 160–240px boxes to a responsive `grid` (`repeat(auto-fill, minmax(180px, 1fr))`, even gutters), with Apply/Reset on a separated, right-aligned full-width row. CSS + a small `scan.js` cleanup only — all `#scan-filter-*` ids + `SR.render()` wiring preserved. Guarded by `tests/scan-filters-grid.test.mjs`.
- [x] **Overall visual polish** *(cumulative, through v1.150.0)* — delivered incrementally across the cycle: dark-mode contrast root-fix + WCAG-AA audit (v1.137.0), the reusable `?` help-hint on 30 views (v1.139.0/v1.143.0), chart-label ellipsize + rebuildable charts + richer salary tables (v1.140.0/v1.145.0), the `#/funded` card grid (v1.141.0), the `#/scan` filter-panel grid redesign (v1.148.0), the Portals→Settings nav move (v1.149.0), and empty-state consistency (v1.150.0 — every `.empty` panel renders through one tokenized style, guarded by `tests/empty-state-consistency.test.mjs`). *Visual polish is an ongoing quality bar, not a finite task; further taste-driven refinement is welcome with specific direction.*

---

## Known design-system debt (tracked, from the post-v1.158.0 design-export audit)

Restated here so it is not re-filed. Shipped items are checked; the rest are
deliberate, tracked backlog (each its own future release — behaviour changes are
never bundled into a token-only ship).

- [x] **D-3 — elevation token** *(v1.167.0)* — `--panel-2` / `--surface-elev1` resolved to `--slate`, the same value as the `--line` / `--border` hairlines, so an elevated panel had no separation from a bordered card. A dedicated theme-aware `--elev` token (`#eef1f6` light / `#1e232e` dark) now backs the raised surfaces; hairlines stay on `--slate`. Guarded by `tests/elevation-token.test.mjs`.
- [ ] **D-2 — checkbox target size** — the native checkbox rows in `#/batch`, `#/config`, `#/scan`, `#/evaluate`, `#/cv-studio` sit in a ~22 px label band, 2 px under the WCAG 2.5.8 24×24 floor (`.apply-checklist` at 32 px is already compliant). Fix is per-view (each checkbox needs a ≥24 px label band), so it is NOT a single-file token change — a small dedicated release, not part of the D-3 token ship.
- [ ] **D-4 — type-scale & z-index tokens** — sizes/weights/line-heights and layering are literal per component; the system cannot be fully reproduced from tokens alone. Introduce `--font-size-*` / `--z-*` ramps and migrate incrementally. This is the standing P4 token-system backlog (restated, not re-filed).
- [ ] **D-5 — inline PDF preview** — PDF exports are served `Content-Disposition: attachment` (download only). Offer an inline "Preview PDF" alongside Download (same route, `inline` disposition variant). Behaviour change → its own release.
- [ ] **P4-ETA — long-generation ETA** — heavy AI generations (e.g. career-plan ~40 s) show "Generating…" with no ETA/percentage. Reuse the `#/auto` ETA/cost-hint component on the long-running AI pages. Behaviour change → its own release.

---

*Each phase updates docs (help ×17, README ×17, CHANGELOG ×17, CONVENTIONS, architecture), the cvstart.org site, and the wiki, and is browser-verified across all 17 locales before ship.*
