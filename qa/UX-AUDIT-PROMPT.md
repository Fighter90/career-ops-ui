# SENIOR UX-DESIGNER AUDIT — career-ops-ui

> **Baseline: v1.231.2** (37 route modules · 31 views · **17 locales** ·
> help bundles **32 H2 / 122 H3** — §31 "Running the whole stack in the cloud"
> added v1.154.0 · **92 scanner sources = 87 EN + 5 RU** ·
> **18 LLM providers**, headless eval order Anthropic → Gemini → OpenAI → Qwen →
> OpenRouter → GitHub Models → Hermes, auto-ordered — and as of v1.157.0 a
> forced `LLM_PROVIDER` with no key falls back to any configured provider, so
> live evals run on ANY key, not just Anthropic/Gemini).
> The UX roadmap **`docs/UX-ROADMAP.md`** (Phases 1–5) is fully shipped;
> treat any residual Phase items as done, not findings.
> The oversized views were split under the 800-line limit (config.js P-15,
> scan.js P-16, v1.155–v1.156) — a pure refactor, no UX change.
> Dark-mode contrast is guarded from v1.137.0 (theme-aware alias tokens;
> 0 WCAG-AA text failures across all views) — judge the dark theme against
> that baseline, not as broken.
> Re-verify the live `package.json` version before you start — features
> land continuously.
>
> Paste this verbatim to an agent (or run it as a senior UX
> designer). It produces a **prioritised, evidence-based UX audit of
> the whole product**, judged against the canonical product intent
> documented at **https://career-ops.org/docs**. Output a single
> `qa/reports/<YYYY-MM-DD>-UX-AUDIT.md` findings file (the current
> reports home; the older `qa/v54-regression/` path is retired).
>
> This is a *design-critique* prompt, not a regression prompt. It
> assumes the app already works (run `FUNCTIONALITY-CHECK.md` first if in
> doubt). Your job: judge whether it works *well for the user the docs
> describe*, and whether it faithfully delivers the docs' promise.

---

## Who you are

A senior product/UX designer doing a heuristic + task-based
evaluation. You think in user goals, flows, friction, and trust — not
in code. You cite evidence (screenshot, route, exact copy) for every
finding and you rank by user impact, not by ease of fixing.

## Ground truth: read the canonical docs FIRST

Before touching the app, read and internalise the product intent from
**https://career-ops.org/docs** — every page in the nav:

- **Introduction / What is career-ops** — the core promise and value
  proposition. What does the product claim to do for the user?
- **Quick Start** — the canonical first-run journey (Steps 1–7),
  including the `profile.yml` fields and the `modes/_profile.md`
  §Step-5 schema (Target Roles / Adaptive Framing / Exit Narrative /
  Comp Targets / Location Policy) and how each is *described to the
  user*.
- **Guides:** Scan Job Portals · Apply For a Job · Batch Evaluate
  Offers · Set up Playwright.
- **Reference:** Modes, auto-pipeline, pipeline, oferta, ofertas,
  contacto, deep, interview-prep, pdf, training, project, tracker,
  patterns, followup, Portals.

Build a one-paragraph "intended user + intended outcome" statement
from the docs. Every UX finding is judged against THAT, not against
generic taste. (career-ops-ui is the web front-end onto this exact
pipeline; it must make the documented journey *easier*, never alter
or contradict it.)

## The product surface to evaluate

Run the app locally (`npm start`, http://127.0.0.1:4317). Walk every
screen as the documented user would. Map each screen to the doc
concept it serves:

| Screen | Doc concept | Judge |
|---|---|---|
| `#/dashboard` | entry / overview | Does a new user know what to do next? |
| `#/config` (API keys / Profile / Modes) | Quick Start Steps 3–5 | Is the §Step-5 schema legible *as fields*? Do field descriptions match the docs' wording? Is "what do I put here" answered in-context? Is the provider model honest — does the user understand the CLI-agnostic parent (Claude Code · Codex · Gemini · OpenCode · Qwen · Copilot · Kimi) vs the headless web-ui eval that runs on **any one** of the seven provider keys — Anthropic/Gemini/OpenAI/Qwen/OpenRouter/GitHub Models/Hermes ("OR", auto-ordered)? Can a user with only ONE provider key tell it will work, pick it, save, and succeed without reading code? |
| `#/auto`, Cmd+K | the auto-pipeline promise ("paste a URL → full report in 1–2 min") | Is the 1-click promise visible, trustworthy, and honest about progress/cost? |
| `#/scan` | Scan Job Portals guide | Is a multi-minute crawl legible (progress, stop, results)? |
| `#/pipeline` | pipeline reference | Triage clarity at 100s of rows. |
| `#/evaluate`, `#/batch` | Apply / Batch Evaluate guides | Does the score + A–F report read the way the docs frame it? |
| `#/deep`, `#/apply`, `#/<mode>` | deep / contacto / oferta(s) refs | Is the manual-vs-live distinction clear? |
| `#/tracker` | tracker reference | Is the funnel state understandable at a glance? |
| `#/reports`, `#/cv` | reports / pdf | Review-before-send trust. |
| `#/two-pager` | candidate two-pager (v1.89.0) | Is the builder + AI-fill legible? Does the `◎` fit badge on scan read clearly? |
| `#/mock-interview` | mock interview (v1.90.0) | Is turn-by-turn rehearsal + saved sessions momentum clear? |
| `#/networking` | networking planner (v1.91.0) | Who-to-contact + intro path + outreach + dossier — is the plan actionable? |
| `#/cv-studio` | CV Studio (v1.92.0) | Résumé diagnostics + in-browser PII mask + make-it-human voice match — trustworthy? |
| `#/memory` | about-me note (v1.93.0) | Is it clear this note is inlined into every AI request? |
| `#/stats` | Statistics (v1.94.0) | 3 tabs (AI market report · My pipeline analytics · Target-role trend); currency selector; MD/PDF export — legible? |
| `#/career-plan`, `#/orientation` | Growth nav group (v1.95.0 / v1.96.0) | Career development plan (horizon + focus) + career-orientation profile (archetype vectors/roles/strengths; reflection-not-test); MD/PDF/**DOCX** export. |
| `#/portals` | portals health (v1.99.0) | Is the dead-slug flag actionable? Does "Check portal health" read as safe/read-only? |
| `#/two-pager` (export) | two-pager export + AI auto-fill (v1.100.0) | Is the live ✨ auto-fill's "review before Save" clear? Is Preview & export (MD/PDF/DOCX) discoverable? |
| `#/cv-studio` (Tailor) | CV Doctor (v1.101.0) | Does the JD → tailored résumé + cover letter + **checklist-gate report** read as trustworthy (errors-block / warnings-advise)? Never-fabricate obvious? |
| `#/docs-assistant` | Ask the docs (v1.102.0) | Is it clear answers come only from the help guide (not the user's data)? Are the cited sections useful? |
| `#/config` (AI CLI tools + Appearance) | v1.103.0 / v1.104.0 | Is "never executes a binary" reassuring? Is the company-logos toggle's privacy note clear? |
| `#/usage` | AI usage & cost (v1.105.0) | Are the token/USD windows legible? Is "estimate, not billed; editable prices" honest and clear? |
| `#/scan` (Exclude), `#/pipeline` (overview) | v1.109.0 | Is the Search-OR / Exclude pair obvious? Does the pipeline overview strip aid triage at a glance? |
| docs FAB (every page) | Ask-the-docs FAB (v1.113.0) | Is the gradient launcher discoverable but not intrusive? Do the starter chips help? Is "help-guide only, never your data" clear? Does it stay clear of the toast stack (DES-1)? |
| sidebar USAGE meter | usage HUD (v1.114.0/v1.116.0) | Is the 24h/7d/30d token + cost meter legible at the sidebar bottom? Does it read as "estimate, local-only"? Never covers the nav? |
| `#/followup` | follow-up cadence board (v1.117.0) | Are the 🔴 urgent / 🟠 overdue / 🟡 waiting / 🔵 cold chips understandable at a glance? Is "Seed follow-up dates" clearly a write action? Is the empty-tracker state honest ("nothing yet", not "error")? |
| `#/stats` (Rejection patterns) | patterns tab (v1.117.0) | Does the outcome mix + per-ATS-vendor advance rate read clearly? Small-sample caveat visible? Honest empty state? |
| `#/cv-studio` (Add to CV) | add-entry (v1.117.0) | Is "suggestions only, never writes" clear? Does the URL/paste → ATS-bullets flow read as grounded (no fabrication)? |
| `#/apply` (knock-out pre-scan) | v1.117.0 | Are visa/degree/salary disqualifiers surfaced *before* form-filling, legibly? |
| `#/funded` | funded-company discovery (v1.133.0) | Is "recently funded → fresh targets, review-first, never an endorsement" honest? Is the read-only "nothing is saved" framing clear? Is the empty/sparse state legible? |
| `#/interview-digest` | weekly interview digest (v1.133.0) | Is the zero-LLM roll-up's purpose + expected result clear *before* loading? Is "No sessions in this range" an honest empty state (not "broken")? |
| `#/help` | the docs, in-app | Does it answer the questions the journey raises, in the user's language? |

## Heuristic lenses (apply all; cite evidence per finding)

1. **Promise fidelity** — does the UI deliver what career-ops.org/docs
   says it does? Flag anything where the app under-delivers,
   over-promises, or silently diverges from the documented behaviour.
2. **First-run / onboarding** — a brand-new user with empty parent
   files (no `cv.md`, stub `modes/_profile.md`). Can they get to a
   first evaluation following only on-screen affordances? Where do
   they get stuck or have to leave for the terminal/docs?
3. **Information scent & next-step clarity** — on every screen, is the
   single most valuable next action obvious?
4. **Feedback & system status** — long operations (scan, auto-
   pipeline, PDF, batch): progress, time expectation, cancelability,
   honest cost/credit signalling.
5. **Error recovery** — are failures (bad URL, missing key, wrong
   provider, network) explained in the user's terms with a clear
   recovery path? (e.g. the LLM-provider/key story.)
6. **Forms & data entry** — `#/config` Profile & Modes especially: is
   the documented schema expressed as well-labelled fields with
   doc-sourced guidance, sensible defaults, and safe (non-destructive,
   confirmed) saves? Is anything still "raw text the user must format
   correctly"?
7. **Trust, safety & reversibility** — destructive parent-file writes,
   "review before send", masked secrets, no surprise external calls.
8. **Consistency** — interaction patterns, terminology (match the
   docs' vocabulary exactly), iconography, empty/loading/error states.
9. **Accessibility as UX** — keyboard-only completion of the core
   journey; screen-reader sensibility of names/roles/status (not just
   WCAG box-ticking — does it make sense *aurally*?).
10. **i18n integrity** — switch through all 17 locales on the core
    flow (en · es · pt-BR · ko · ja · ru · zh-CN · zh-TW · fr · pl ·
    uk · da · ar · de · it · tr · hi; Arabic is RTL): truncation,
    untranslated leakage, RTL/character issues, terminology drift
    from the docs.
11. **Cognitive load & progressive disclosure** — is power kept
    available but not in the beginner's way (Advanced disclosures,
    defaults, sane modes)?
12. **Aesthetic & visual hierarchy** — does the design earn trust for
    a tool handling someone's job search and salary data?

## Method

1. Read the docs → write the intended-user/outcome statement.
2. Run two end-to-end task scenarios *as the user*, narrating
   friction at each step:
   - **Scenario A — cold start:** empty parent files → set up exactly
     ONE provider key (try each of Anthropic / Gemini / OpenAI / Qwen
     in separate passes — the "OR" promise) → configure profile +
     Modes fields → first auto-pipeline on a real job URL → read the
     report → find the PDF. Note every moment you'd consult the docs
     or terminal, and whether the UI made the single-key path obvious.
   - **Scenario B — returning power user:** refine Modes fields, batch-
     evaluate several offers, triage `#/pipeline`, check `#/tracker`.
3. Sweep every screen through the 12 lenses.
4. Compare 2–3 screens side-by-side with their career-ops.org/docs
   page for promise fidelity & terminology.

## Output — `qa/reports/<DATE>-UX-AUDIT.md`

- **Intended user & outcome** (1 paragraph, from the docs).
- **Top 5 user-impact findings** (the executive summary).
- **Findings table:** `ID · Screen · Lens · Severity
  (HIGH/MEDIUM/LOW) · Evidence (route + screenshot + exact copy) ·
  User impact · Recommended change · Doc reference`.
  Severity = *user impact*, not fix effort. Be specific and
  actionable; no vague "improve UX".
- **Promise-fidelity ledger:** every place the app diverges from
  career-ops.org/docs (behaviour, terminology, or omission).
- **What's genuinely good** (call out strengths honestly — a credible
  audit is balanced).
- **Recommended ship order:** HIGH → MEDIUM → LOW, each as a single
  one-fix ship per the project doctrine (bump + CHANGELOG ×16 + test +
  Playwright-verify + AI-review LGTM + CI-watch). Do **not**
  implement here — this prompt only produces the audit; fixes are
  separate ships.

## Baseline — already-closed findings (do NOT re-file these)

The 2026-05-14→18 audit cycle produced 12 UX findings + 2 a11y
findings (v1.55.1→v1.56.0); the follow-on `qa/FIX-PROMPT-FINAL.md`
cycle then closed an a11y focus-ring regression (v1.56.1), UX-N1
(v1.56.2), a reported key-detection trust bug (v1.56.3) and UX-N2
(v1.56.4). **All shipped and regression-locked** (v1.55.1→v1.56.4).
A fresh audit must treat these as the *current* baseline — only
re-open one with concrete live evidence that it regressed:

| Finding | Closed in | Locked by |
|---|---|---|
| F-V55-E / UX-1 — `#/auto` stepper pre-render | v1.55.1 | `auto-stepper-prerender.test.mjs` |
| F-V55-H / UX-5 — `#/cv` editor accessible name | v1.55.2 | `cv-editor-a11y.test.mjs` |
| UX-2 — 4-provider OR onboarding banner/chip | v1.55.3 | `onboarding-key-banner.test.mjs` |
| UX-6 — `#/auto` ETA + `#/scan` Stop prominence | v1.55.4 | `auto-eta-stop.test.mjs` |
| UX-3 — `#/dashboard` hero-CTA + focal hint | v1.55.5 | `dashboard-hero.test.mjs` |
| UX-4 — `#/scan` Advanced-filters disclosure | v1.55.6 | `scan-advanced-disclosure.test.mjs` |
| UX-7 — `#/pipeline` >1000-row virtualization | v1.55.7 | `pipeline-virtualize.test.mjs` |
| UX-8 — `#/tracker` server pagination + funnel | v1.55.8 | `tracker-server-paged.test.mjs` |
| UX-9 — `#/cv` breadcrumb title | v1.56.0 | `cv-breadcrumb.test.mjs` |
| UX-10 — ⚡ Run-live cost hint | v1.56.0 | `run-cost-line.test.mjs` |
| UX-11 — `#/help` TOC 1-match autoscroll | v1.56.0 | `help-toc-autoscroll.test.mjs` |
| UX-12 — `#/dashboard` first-paint a11y | v1.56.0 | `dashboard-initial-focus.test.mjs` |
| a11y — managed-focus ring suppressed (no red `<h1>` box) | v1.56.1 | `managed-focus-no-ring.test.mjs` |
| UX-N1 — per-route locale-aware `document.title` | v1.56.2 | `document-title-per-route.test.mjs` |
| key-detection — placeholder/short keys rejected (no false "✓ set", no mis-route) | v1.56.3 | `key-detection-rejects-placeholder.test.mjs` |
| UX-N2 — visible platform-aware ⌘K / Ctrl K hint | v1.56.4 | `cmdk-hint-visible.test.mjs` |
| NEW-1 — CSP unconditional on every response | v1.58.4 | `tests/playwright-smoke.mjs` (zero CSP violations on en/ru/ja/zh-TW × 7 routes) |
| BUG-008-tb — top-bar Doctor modal title parity ×8 locales | v1.58.6 | `qa-report-fixes.test.mjs` |
| NEW-2 — `isValidJobUrl` rejects paired `${…}` / `{{…}}` | v1.58.7 | `qa-report-fixes.test.mjs` |
| (user feat) — OPENAI / QWEN / OPENROUTER rows on `#/health` | v1.58.8 | `qa-report-fixes.test.mjs` |
| M-1 — `:focus-visible` ring on form fields (WCAG 2.4.7) | v1.58.9 | `qa-report-fixes.test.mjs` + Playwright Tab-traversal |
| M-2 — `UI.modal()` auto-dismisses progress toast | v1.58.10 | `qa-report-fixes.test.mjs` |
| M-4 — saved-research card title↔date structural gap | v1.58.11 | `qa-report-fixes.test.mjs` |
| M-7 — cost hint follows OpenRouter (`cost varies`) | v1.58.12 | `qa-report-fixes.test.mjs` |
| M-8 — interactive Apply checklist + per-URL persist | v1.58.13 | `qa-report-fixes.test.mjs` |
| M-9 — connection-banner Refresh feedback toast | v1.58.14 | `qa-report-fixes.test.mjs` |
| I-1 — top-bar search aria-label localized | v1.58.15 | `qa-report-fixes.test.mjs` |
| (user-reported) — brand-button hover-flicker | v1.58.16 | `qa-report-fixes.test.mjs` |
| I-2 — `Intl.RelativeTimeFormat` for saved-research dates | v1.58.17 | `qa-report-fixes.test.mjs` |
| I-3 — help TOC items 2/5/13/14 English-bleed strip | v1.58.18 | `qa-report-fixes.test.mjs` (negative match) |
| I-4 — RU `#/followup` no Latin `cadence`/`follow-up` | v1.58.19 | `qa-report-fixes.test.mjs` |
| I-6 — footer hotkey ⌘K (Mac) vs Ctrl+K (else) localized | v1.58.20 | `qa-report-fixes.test.mjs` |
| U-1 — `#/cv` H1 + subtitle (supersedes UX-9 chip by design) | v1.58.21 | `qa-report-fixes.test.mjs` + updated `cv-single-h1.test.mjs` |
| U-2 — `#/auto` H1 emoji-wrap (page-icon span + grid) | v1.58.22 | `qa-report-fixes.test.mjs` |
| U-3 — `#/followup` date placeholder = today − 14 d | v1.58.23 | `qa-report-fixes.test.mjs` |
| U-4 — toast endpoint postfix in `<details>` | v1.58.24 | `qa-report-fixes.test.mjs` |
| U-5 — Dashboard CTA dedupe | v1.58.25 | `qa-report-fixes.test.mjs` |
| U-6 — `#/scan` Active-companies tooltip | v1.58.26 | `qa-report-fixes.test.mjs` |
| U-7 — verify-pipeline modal `===` divider strip | v1.58.27 | `qa-report-fixes.test.mjs` |
| U-8 — Generate-prompt block collapsed by default | v1.58.28 | `qa-report-fixes.test.mjs` |
| U-9 — `#/pipeline` controls stack ≤720 px | v1.58.29 | `qa-report-fixes.test.mjs` |
| U-10 — Tracker actions disabled when empty | v1.58.30 | `qa-report-fixes.test.mjs` |
| U-11 — Tracker Legitimacy info chip + aria | v1.58.31 | `qa-report-fixes.test.mjs` |
| U-12 — Help TOC filter min-width 16ch | v1.58.32 | `qa-report-fixes.test.mjs` |
| U-13 + U-14 + U-15 — toast journal capture + page-header safety + CV dirty-state | v1.58.33 | `qa-report-fixes.test.mjs` |
| Notifications drawer chrome (closes U-13) — bell + slide-in `<aside role="dialog">` | v1.58.34 | `qa-report-fixes.test.mjs` |
| Drawer `[hidden]` CSS override + help §18 Notifications ×8 | v1.58.35 | `qa-report-fixes.test.mjs` + `playwright-smoke.mjs` end-to-end (9 assertions) |
| NEW-D1 — `pipe.title` localized on es/pt-BR/ru + Latin-leak guard | v1.58.37 | `qa-report-fixes.test.mjs` + `tests/i18n-no-latin-leaks.test.mjs` |
| NEW-D3 — Tracker search `aria-label` × 8 (WCAG 4.1.2) | v1.58.38 | `qa-report-fixes.test.mjs` |
| NEW-D2 — Dashboard header Refresh button + toast pipeline | v1.58.39 | `qa-report-fixes.test.mjs` |
| UX-D-H — External `career-ops.org/docs/*` links lock | v1.58.40 | `tests/external-doc-links.test.mjs` |
| UX-D-I — Cost-hint live re-fetch (visibility + `providers-changed`) | v1.58.41 | `qa-report-fixes.test.mjs` |
| UX-D-J — Per-advisor ETA chip parity (`#/evaluate` / `#/deep` / 5 mode pages) | v1.58.42 | `qa-report-fixes.test.mjs` |
| UX-D-F — Empty Evaluate submit → distinct `eval.emptyJd` toast | v1.58.43 | `qa-report-fixes.test.mjs` |
| UX-D-L — `#/deep` saved-research opened brief inline × close button | v1.58.44 | `qa-report-fixes.test.mjs` |
| UX-D-K — Help TOC scroll-spy via IntersectionObserver | v1.58.45 | `qa-report-fixes.test.mjs` |
| UX-D-D — Apply checklist `{company}-{role}` slug substitution | v1.58.46 | `qa-report-fixes.test.mjs` |
| UX-D-C — Top-bar Quick scan → Open Scan (label honesty) | v1.58.47 | `qa-report-fixes.test.mjs` |
| UX-D-B — Dashboard fixture-profile warning banner | v1.58.48 | `qa-report-fixes.test.mjs` |
| TOOL-1 — `make clean-test-fixtures` + script + 4 CI-isolated tests | v1.58.49 | `tests/clean-test-fixtures.test.mjs` |
| DOC-1 — Server English-by-policy doctrine § (archived REGRESSION-FINAL §5a) | v1.58.50 | `qa-report-fixes.test.mjs` |
| DES-1 — toast stack lifted above the docs FAB (no truncation under launcher) | v1.117.x audit | `tests/toast-fab-clearance.test.mjs` |
| SPA-H1 — `.btn[hidden]{display:none}` (scan Stop no longer visible when idle) | v1.117.x audit | `tests/btn-hidden-override.test.mjs` |
| SPA-M4 — placeholder-only inputs got aria-labels (memory/networking/career-plan/two-pager) | v1.117.x audit | `tests/a11y-form-wires.test.mjs` |
| SPA-L1/L2 — tracker "Output" modal title + settings "LinkedIn" label localized | v1.117.x audit | `tests/i18n-*` |

**v1.117.x audit cycle (this doc's baseline):** the audit's server/SPA
findings are all shipped and locked — SSRF `timeoutMs` honored, batch +
key-smoke routes rate-limited, router render-epoch guard, empty-tracker
relay keyed to exact messages + stderr path-stripping, memory/career-plan
markdown sanitized, raw `fetch()` routed through `API.*`, usage-HUD
backoff, CI i18n step at 17 locales. Do **not** re-file these; re-open
only with concrete live regression evidence. The **open design backlog**
(P4 report) — token-enforcement gate, skeletons, spacing/shadow/radius/
type/color consolidation, motion system, IA regroup + `#/about` — is
*design work*, not UX defects; treat those as roadmap, not findings.

Senior-obs ledger: S-7→v1.54.6, W-001→v1.54.7, S-1→UX-3, S-2→UX-7,
S-3→UX-4, S-4→UX-1, S-5→UX-9, S-6→UX-8. The **only open backlog
item** is **G-005** (cross-repo nomenclature, MINOR): the parent
`Fighter90/career-ops :: modes/oferta.md` still emits the legacy
7-block A-G report vs the canonical 6-block A-F; the renderer is
schema-tolerant so both display correctly. It is blocked on a
parent commit (see `qa/G-005-closure-kit.md`) — not a web-ui UX
defect; do not re-file it as one.

### Guardrails

Read-only. Never edit parent career-ops files. Never weaken the
security envelope. Judge against the docs' intent, not personal
preference — when you disagree with the docs, say so explicitly and
separately from findings. Cite evidence for every claim.

---

## §UX-A — EXHAUSTIVE UX MATRIX (every page × every control × 17 locales)

> Sweep this in full. For every cell, rate **GOOD / FRICTION /
> BROKEN** with evidence (screenshot, route, exact copy, locale).
> "It works" is not enough — judge whether it works *well for the
> user career-ops.org describes*. One root cause = one finding.

### §UX-A.0 — The 17-locale lens (apply to EVERY page below)

Locales: **en · es · pt-BR · ko · ja · ru · zh-CN · zh-TW · fr · pl ·
uk · da · ar · de · it · tr · hi** (Arabic is RTL — `<html dir="rtl">`;
the chrome mirrors via the `[dir="rtl"]` block in `app.css`). Per page,
per locale, judge:

1. **Completeness** — zero untranslated strings / raw `key.path` /
   leftover English inside a localized sentence (regression class:
   I18N-012/013 "smart questions"/`Deep research` RU; I18N-011
   help-TOC CLOSED v1.58.2 — TOC now matches the sidebar `nav.*`
   term in all 17 locales, verify it stays so). Mixed-language UI is
   a trust defect, file it.
2. **Fit & truncation** — CJK (`ko`/`ja`/`zh`) and longer Romance
   (`es`/`pt-BR`) strings must not clip, wrap mid-word, overflow
   buttons, or collide (placeholders, tabs, chips, the `#/help`
   "Filter sections" box, sidebar group headers, toast width).
3. **Naturalness** — translations read like a native product wrote
   them, not literal/MT ("Связь/звонок" for Outreach, transliterated
   section headers). Note awkward copy as FRICTION.
4. **Consistency** — the same concept uses the same word everywhere
   (button label == modal title == sidebar item == help section);
   route URLs stable & bookmarkable (`#/outreach` alias);
   `document.title` localized per route and updates on lang switch.
5. **Locale-aware formatting** — dates ("today" → localized), numbers,
   the `⌘K`/`Ctrl K` hint platform-correct; placeholders that are
   examples (ISO date) stay neutral but labels around them localize.

### §UX-A.1 — Per-page heuristic pass (all pages, all 17 locales)

For **every** route — `#/dashboard #/scan #/pipeline #/evaluate
#/deep #/cv #/tracker #/reports #/activity #/config #/profile
#/health #/help #/auto #/apply #/batch #/two-pager #/mock-interview
#/networking #/cv-studio #/memory #/stats #/career-plan #/orientation
#/usage #/docs-assistant #/funded #/interview-digest` + mode pages `#/project #/training #/followup
#/contacto #/interview-prep #/patterns #/batch-prompt` + aliases
`#/settings #/portals #/outreach` + the 404 — plus the two page-agnostic
widgets on every route (the **docs FAB**, bottom-right, and the
**USAGE meter**, sidebar bottom) — assess: visual hierarchy (one clear H1 + descriptive subtitle;
note the `#/cv` breadcrumb-chip is a *deliberate* single-H1 WCAG
choice — critique only the UX, not as a bug), scan-ability, primary
action obvious & above the fold, empty states teach the next step
(incl. `#/reports` empty), loading states honest (spinner + ETA, not
a frozen screen), error states actionable & legible, no duplicate/
competing CTAs (the `#/dashboard` Quick-actions vs hero overlap),
responsive 420 px → 1920 px (toasts must not cover Save on narrow —
UX-027), dark theme parity on every page.

### §UX-A.2 — Per-control interaction quality

For every button / input / select / link / modal / toast / tab:
affordance (looks actionable), focus visible & logical Tab order,
hit-target ≥ 44 px, disabled/busy states clear, double-submit
impossible, **every outcome legible** — success AND failure produce a
visible localized message the user can actually read in time (error
toast dwell scales with length; wraps not clips); destructive actions
are confirm-gated with the *same verb* in title & body & button;
progress toasts clear before their result modal (doctor/verify);
copy-to-clipboard confirms; deep-links resolve.

### §UX-A.3 — Trust & content quality (the product's promise)

Judge the *output*, not just the chrome: a Deep-research / Saved
brief must read as a clean, well-formatted document — **no raw
`<tool_call>{json}` / `<tool_response>` / `<thinking>` leakage**,
correct markdown (headings, tables, bold incl. inside blockquotes),
sectioned per the docs' intent. The active-provider / cost hint must
reflect the *actual* provider+model (not a hardcoded one). Health
must not call a test-fixture profile "customized". Error copy must
say what went wrong, where, and how to fix it — never an opaque
"validation failed" or a bare stack/endpoint.

### §UX-A.4 — End-to-end task journeys (the docs' core flows)

Walk each as the target user, 17 locales spot-checked: (a) paste a JD
→ score → decide (the score→action thresholds from the docs);
(b) `#/auto` one-URL pipeline end-to-end; (c) scan portals → triage
→ pipeline → evaluate → track; (d) deep-research a company → saved
brief → PDF; (e) configure a provider key from zero → first live
eval; (f) edit CV / profile / modes and see it reflected. Rate
friction per step; cite where the flow contradicts or under-delivers
the career-ops.org promise.
