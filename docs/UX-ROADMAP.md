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
- [ ] **Next wave** — extend the `?` hint to the remaining view headers (config, scan, tracker, cv-studio, apply, …) so the affordance is truly on *every* page.

## Phase 3 — "Insightful stats" (in progress)

Make the numbers correct, detailed, and visual.

- [x] **Richer salary stats** (v1.140.0) — **average** (mean) added alongside min/median/max; **per-year ⇄ per-month** toggle; a **min·avg·median·max table per country** on `#/stats` "My pipeline".
- [ ] **Interactive, rebuildable charts** on `#/stats` (choose metric/dimension/period, re-render) — next.
- [ ] **Correctness** — fix the "Unknown" archetype bucketing so recommendations aren't nonsensical ("double down on Unknown"). Note: "Unknown" is **LLM output** from `#/orientation`, not a code literal — this is a prompt-quality fix (constrain the archetype vocabulary + handle an out-of-vocab archetype gracefully client-side).
- [x] **Funded companies** enrichment (v1.141.0) — company **logo** + **funding-amount visualization** + **discovery-score / suggested-action** cards. (Description + salary range aren't in the public funding feed, so they're out of scope for this source; revisit if an enrichment source is added.)

## Phase 5 — Nous Research / Hermes provider

Add **Nous Research (Hermes)** as an LLM provider in the OR-router, per <https://hermes-agent.nousresearch.com/docs>.

- [ ] **Scope first (blocked on API details).** The Hermes docs describe an *autonomous agent product* (tool-calling, skills, voice, 20+ messaging platforms) that "works with Nous Portal / OpenRouter / OpenAI / any endpoint" — **not** a documented hosted chat-completions API. Before coding, confirm the actual endpoint + auth from **Nous Portal** and/or the [`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent) repo: base URL, API-key header, whether it's OpenAI-`/chat/completions`-compatible, model ids, streaming, tool-calling shape.
- [ ] **If a Nous Portal endpoint is OpenAI-compatible** — the light path: add it like the existing providers — a `NOUS_API_KEY` (`server/lib/env-config.mjs` + `#/config`), a dispatch branch in `server/lib/llm-dispatch.mjs::runActiveProvider` / `providerAvailable`, a row in the provider-order cascade, the model catalogue + hint, `cli-detect`/help/README roster, and `server/lib/llm-pricing.mjs`. Mirror the OpenAI/Qwen branch (they're already `/chat/completions`-shaped).
- [ ] **If it's the agent runtime (not a plain API)** — heavier: decide whether web-ui shells to a locally-run Hermes agent or calls a Nous Portal agent endpoint; likely a new relay route rather than a `runActiveProvider` branch. Revisit scope once the API contract is known.
- [ ] Tests (CI-isolated, stubbed transport) + i18n for any new `#/config` strings + docs.

*Standalone item — independent of Phases 2–4; do the scoping spike before committing to an approach.*

### Phase 5b — Hermes docs, cloud + Telegram deployment guide, and a Hermes skill

A **documentation-and-skill deliverable** that can ship independently of (and ahead of) the provider-integration code above — it explains what Hermes is, how to run career-ops-ui on a **cloud server**, and how to wire the pipeline to **Telegram through Hermes**, then packages that flow as a reusable skill.

- [ ] **README — new "Hermes agent + Telegram" section.** In the primary `README.md` (and mirrored ×17 with the changelog-parity discipline): who Hermes is (Nous Research autonomous agent), why you'd bridge career-ops-ui to it, and a linked pointer to the full deep-dive under `docs/`. Keep the README entry short — a teaser + link, not the whole guide.
- [ ] **`docs/` — dedicated deep-dive** (`docs/integrations/HERMES.md`, linked from `docs/architecture/OVERVIEW.md` and the docs index): (1) Hermes overview + the two integration shapes from Phase 5 (OpenAI-compatible endpoint vs. agent runtime); (2) **cloud-server deployment** — provisioning a small VPS, Node ≥18, `.env` with the provider key(s), running the server behind a reverse proxy over HTTPS, process-manager/systemd, the read-only parent-career-ops contract in a headless box, security-header/CSP invariants that must survive the move off `127.0.0.1`; (3) **Telegram via Hermes** — connecting a Telegram bot to a running Hermes agent, and how career-ops-ui events/reports reach that channel (relay route vs. Hermes tool-call), with the SSRF/`isValidJobUrl` + no-secrets-in-logs guards called out. Threat-model note + explicit "what NOT to expose" list.
- [ ] **In-app help guide — new H2 section ×17.** Add a "Hermes & Telegram" H2 to `docs/help/<lang>.md` for all 17 locales (gated H2/H3 counts bumped in the coverage tests), plus the `docs-assistant`/`DocsFab` grounding picks it up automatically. Reachable from `#/help`.
- [ ] **cvstart.org site — landing/docs surface.** A short marketing-side explainer (Astro `site/`, Node-22 CI build) that mirrors the README teaser and deep-links to the GitHub docs page; keep prose drift in sync with the ×17 wording.
- [ ] **A Hermes skill (to be created).** Author a `.claude/skills/<hermes-*>/SKILL.md` that operationalizes the guide: given the user's intent ("connect career-ops to Telegram via Hermes" / "deploy this to a cloud box"), it walks the documented steps, checks prerequisites (keys, endpoint reachability via the SSRF-safe path, Node version), and never writes secrets to disk/logs. Register it in the skill list; its body cross-links `docs/integrations/HERMES.md` as the single source of truth so the two never drift.
- [ ] **Consistency gate.** One scoped version/section-count sweep across README ×17 + help ×17 + CONVENTIONS + architecture + site + wiki, and a canary test asserting the new help H2 exists in every locale (parity-gated, snapshot regenerated).

*The docs + skill can land before the provider code — but keep them honest: mark anything blocked on the Phase 5 API-contract spike as "planned / not-yet-wired" rather than documenting an endpoint that doesn't exist yet.*

## Phase 4 — v1.142.0 "Settings & filters"

Consolidate configuration; make filters beautiful.

- [ ] **Portals → Settings** — move `#/portals` into the settings area; enable/disable each portal; sync the enabled set with the source list, the `#/scan` filter selects, and what actually gets scanned.
- [ ] **Scan filters redesign** — cleaner, more readable, more attractive filter panel.
- [ ] **Overall visual polish** — senior-designer pass on spacing, hierarchy, and consistency across all pages.

---

*Each phase updates docs (help ×17, README ×17, CHANGELOG ×17, CONVENTIONS, architecture), the cvstart.org site, and the wiki, and is browser-verified across all 17 locales before ship.*
