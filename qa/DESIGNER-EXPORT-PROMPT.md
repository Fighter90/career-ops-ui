# SENIOR DESIGNER — KEY-FLOWS EXPORT & DESIGN-QUALITY PROMPT (perennial)

> Paste verbatim to an agent (or run it as a senior product/UX
> designer, 10+ yrs). Produces a **design-quality audit + a
> structured design export** of the whole product — every page, every
> component, every key user flow, all **17 locales** — judged against
> the canonical product intent at **<https://career-ops.org/docs>**.
>
> Output **one** file: `qa/reports/<YYYY-MM-DD>-DESIGN-EXPORT.md`.
>
> Current baseline **v1.137.0** (32 route modules · 79 scan sources =
> 74 EN + 5 RU · 17 locales). The active design roadmap is
> **`docs/UX-ROADMAP.md`** — treat its Phase 2–4 items as planned work,
> not findings. Dark-mode contrast is guarded from v1.137.0 (theme-aware
> alias tokens — see Part 1 §1).
>
> Sibling prompts: `REGRESSION-FINAL.md` proves *nothing regressed*,
> `FUNCTIONALITY-CHECK.md` proves *it works*, `UX-AUDIT-PROMPT.md`
> critiques *UX heuristically*. **This** one is the **design-system
> export + key-flow craft review**: it captures the product's actual
> visual/interaction system so a designer (or a rebuild) can work from
> reality, and grades the craft of every key flow.
>
> No `code/` directory exists in this repo — perennial prompts live in
> `qa/`. This is that prompt.

---

## Who you are

A senior product designer doing a **design-system extraction** and a
**flow-craft critique**. You think in tokens, components, states,
flows, and the gap between the docs' promise and the screen. You cite
evidence (route, screenshot, exact copy, computed style, locale) for
every claim. Read-only. Never edit parent career-ops files. Never
weaken the security envelope. Judge against the docs' intent; when you
disagree with the docs, say so separately from findings.

Pre-flight: read `package.json::version` → that is `vX`. Confirm the
server is on `vX` (`/api/health.version`) before you start; if not,
say so and stop.

---

## Part 1 — DESIGN-SYSTEM EXPORT (capture reality, no opinion yet)

Produce a faithful spec of what currently exists. For each, give the
exact value + where it's defined (`public/css/app.css`,
`public/index.html`, `public/js/api.js::UI`).

1. **Design tokens** — every CSS custom property: colour (light + dark
   `[data-theme="dark"]`), spacing scale, radius, shadow, typography
   (family, size ramp, weight, line-height), z-index layers, motion
   (durations, easings). Tabulate token → value → usage. **Include the
   v1.137.0 alias tokens** — `--fg`/`--panel`/`--panel-2`/`--line`/
   `--surface-elev1`/`--ok`/`--go`/`--err`/`--error`/`--danger`/`--warn`/
   `--muted`/`--ink`/`--card`/`--border` are declared on `:root` as
   `var(--real-token)` aliases (→ `--hof`/`--paper`/`--slate`/
   `--kazan-text`/`--rausch-text`/`--darjeeling-text`/`--foggy`), so they
   follow the theme with no per-block override; note this indirection in
   the token table (a view referencing `--panel-2` gets `--slate`).
2. **Grid & layout** — app shell (sidebar width, content max-width,
   header/footer), breakpoints actually used, page-header pattern
   (`.page-header` / `.page-title` / `.page-subtitle`).
3. **Component inventory** — for EACH reusable UI primitive in
   `UI.*` and the views: button (every variant: primary / ghost /
   danger / sm / icon, + states: rest / hover / focus-visible /
   active / disabled / busy-`aria-busy`), input / textarea / select,
   tab (WAI-ARIA), modal (focus-trap), toast (success / info / error,
   dwell, wrap), confirm dialog, paginator, chip / badge, card,
   table, SSE console, cost-hint, kbd-shortcut, connection banner,
   404. Per component: anatomy, all states, tokens consumed,
   a11y contract (role, name, keyboard), the file + line.
4. **Iconography & emoji** — every glyph used as UI affordance, where,
   and whether it has a text/`aria-label` equivalent.
5. **Content & i18n surface** — the 17 locales (`en es pt-BR ko ja ru
   zh-CN zh-TW fr pl uk da ar de it tr hi`; Arabic is RTL — `<html
   dir="rtl">` + the `[dir="rtl"]` mirror block in `app.css`); how
   `t()` + the per-locale `i18n-dict.<lang>.js` files + the assembler
   + `<html lang>` work; the per-route `document.title` pattern.

Deliver Part 1 as copy-pasteable tables — this is the "export" a
designer/rebuild consumes.

---

## Part 2 — KEY-FLOW CRAFT REVIEW (the docs' core journeys)

Walk each end-to-end **as the target user the docs describe**, in
**en + 3 spot locales incl. one CJK and `ru`**. For every step grade
**craft 1–5** (visual hierarchy, affordance, feedback, error
recovery, momentum) with evidence + a concrete fix.

Flows (cite the score→action thresholds from the docs where relevant):

1. **First-run / onboarding** — fresh load → language auto-detect →
   `#/config` set a provider key → `#/health` green → first action.
2. **Paste-a-JD → decide** — `#/evaluate` (empty / `<50` / valid) →
   score → the doc's action threshold → next step.
3. **One-URL auto-pipeline** — `#/auto` paste → stepper
   (validate→fetch→evaluate→save→track) → artifact deep-links →
   invalid-URL inline failure.
4. **Scan → triage → pipeline → evaluate → track** — `#/scan`
   (sources, Advanced filters, Stop) → `#/pipeline` (add / dup /
   invalid / delete) → evaluate → `#/tracker` (funnel, pagination).
5. **Deep-research → saved brief → PDF** — `#/deep` run-live → the
   **rendered brief must be a clean, sectioned document** (no
   `<tool_call>`/`<tool_response>`/`<thinking>`/`<invoke>` leakage,
   markdown formatted incl. blockquote-bold) → Saved research
   (incl. an older pre-clean file, cleaned on serve) → Copy /
   Download .md / Generate PDF.
6. **Edit CV / Profile / Modes** — `#/cv` (upload / sync-check /
   preview / save / dirty-state), `#/config` Profile + Modes tabs
   (field-form + array editors + confirm-gated raw escape hatch).
7. **Maintenance** — Doctor / Verify / Normalize / Dedup / Merge:
   progress feedback → result modal (progress toast dismissed;
   localized chrome; English CLI body by design) → effect.
8. **AI career surface** (the newer pages — same craft bar) —
   `#/two-pager` (build → AI-fill → save → the `◎` fit badge on
   scan), `#/mock-interview` (turn-by-turn rehearsal → save → resume
   a saved session), `#/networking` (plan → who-to-contact + intro
   path + outreach draft + dossier → save), `#/cv-studio` (résumé
   diagnostics score → in-browser PII privacy mask → make-it-human
   voice match), `#/memory` (edit the about-me note → confirm it's
   inlined into later AI requests), `#/stats` (3 tabs: AI market
   report + My pipeline analytics + Target-role trend; currency
   selector; Markdown/PDF export), `#/career-plan` (horizon + focus
   → generate → save → MD/PDF export), `#/orientation` (archetype
   vectors / roles / strengths, framed reflection-not-test → MD/PDF
   export). Grade each for the manual-vs-live honesty and export
   craft.
9. **v1.98–v1.137 surface** (same craft bar) — the in-app **bug
   reporter** (notifications drawer → 🐞 → preview → GitHub issue),
   `#/portals` (health probe → dead-slug flags), `#/two-pager` **export**
   (✨ live auto-fill → review → Preview & export MD/PDF/**DOCX**),
   `#/cv-studio` **Tailor to a job** (JD → résumé + cover letter +
   checklist-gate report), `#/docs-assistant` (Ask the docs — grounded,
   cites sections), `#/config` **AI CLI tools** tab + **Appearance →
   company logos** toggle, `#/usage` (per-provider tokens + estimated
   USD over 24h/7d/30d/all), and the `#/scan` **Exclude** field +
   `#/pipeline` **overview strip**. Grade each for honesty (estimate /
   read-only / never-executes / privacy) and export/craft.

For each flow output: a step table (step · craft 1–5 · evidence ·
fix), the single biggest friction, and whether it **delivers the
docs' promise**.

---

## Part 3 — STATE & EDGE-CASE GRID (every component, every state)

For every interactive element on every route (`#/dashboard #/scan
#/pipeline #/evaluate #/deep #/cv #/tracker #/reports #/activity
#/config #/profile #/health #/help #/auto #/apply #/batch
#/two-pager #/mock-interview #/networking #/cv-studio #/memory
#/stats #/career-plan #/orientation #/funded #/interview-digest` (career-plan/orientation = **Growth** nav
group) + mode slugs `#/project #/training #/followup #/contacto
#/interview-prep #/patterns #/batch-prompt` + aliases `#/settings
#/portals #/outreach` + 404): rest / hover / focus-visible (**must be a
visible ring** — WCAG 2.4.7) / active / disabled / loading / empty /
error / success / long-content / RTL-safe / 320–1920 px / dark theme.
Flag any state that is missing, invisible, inconsistent, or clipped
(CJK + Romance length). One root cause = one finding.

---

## Part 4 — CROSS-CUTTING DESIGN DEBT

Visual consistency (page-header parity incl. `#/cv` H1 — note the
single-`<h1>` WCAG choice is *deliberate*; critique the look, don't
refile as a bug), CTA duplication (Dashboard paths to one
destination), emoji-in-H1 wrapping, frozen example dates, toast vs
fixed-button collision on narrow screens, ASCII dividers from CLI
output, oversized inline prompt blocks, hardcoded cost line vs
`LLM_PROVIDER`, label↔date spacing, dirty-state affordance, motion
respecting `prefers-reduced-motion`, contrast (light **and** dark)
to WCAG 1.4.3, target size ≥ 24×24 (2.5.8).

---

## Part 5 — PRIORITISED EXPORT BACKLOG

Group findings: **Blocker / High / Medium / Low**, each with route,
evidence, the design fix, and the token/component it touches. Map
each to the project's one-fix-ship doctrine (bump + CHANGELOG ×17 +
test + Playwright-verify + AI-review LGTM + CI-watch — never batch,
HIGH→LOW). Cross-reference open items already tracked in
`qa/v158-regression/FIX-PROMPT-v158.md §5` so nothing is re-filed.

---

## Guardrails

Read-only. Cite evidence (route + screenshot + computed style +
locale) for every claim. Judge against the docs' intent. Security
envelope, CSP, `isValidJobUrl`, `UI.md()` escape-first, parent-file
read-only contract — all out of scope to *change*, in scope to
*not break*. Deliver the single dated export file; do not also edit
code.
