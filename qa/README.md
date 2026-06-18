# QA artifacts — career-ops-ui

Tracks regressions, fix-prompts, and live evidence across releases.

## LATEST single-pass FULL driver — v1.69.2

> **[`QA-REGRESSION-PROMPT-v1.69.2-FULL.md`](./QA-REGRESSION-PROMPT-v1.69.2-FULL.md)**
> is the current whole-project, single-pass regression driver (as of
> `package.json` **1.69.2**, 2026-06-12). It folds the v1.59→v1.69 surface the
> perennial ledger predates — including **P-14 plug-in scanner auto-discovery**
> (`registry.mjs` now dynamically discovers `sources/*.mjs` via each adapter's
> `export const meta` block; lock: `tests/sources-registry-discovery.test.mjs`).
> Baselines: **≥1086** `node --test` · **≥70** Playwright · **≥20** smoke E2E ·
> **≥23** comprehensive E2E · help parity **19 H2 / 75 H3** across 9 locales.
> Prior FULL drivers (`…-v1.68.1-FULL.md`, `…-v1.61.0-FULL.md`) are diff-only.

## CURRENT — four perennial, version-agnostic prompts

> v1.59.8 (2026-05-21) closed the final polish cycle with a doctrine-
> exception bundle (UX-A5-r3 HIGH + NEW-F1-sub LOW) authorised by the
> FINAL REGRESSION-v1.59.7 report. The IntersectionObserver-based help
> TOC scroll-spy is gone — replaced by a scroll listener after 4
> failed IO cycles. 23 releases total v1.58.52 → v1.59.8. See
> [`REGRESSION-PROMPT-FINAL.md`](./REGRESSION-PROMPT-FINAL.md) for the
> post-cycle verification ladder, live-smoke checklist, and the 24
> regression-locked invariants. The 2026-05-20 FINAL REGRESSION report
> and the FIX-PROMPT-FINAL-CONSOLIDATED handoff (both closed by
> v1.59.8) are archived in
> [`archive/v159-cycle/`](./archive/v159-cycle/).

## CURRENT — perennial, version-agnostic prompts

Run on every release; each reads `package.json::version` and
validates the current `HEAD`. Save run reports under
`qa/v54-regression/<date>-{REGRESSION,UX-AUDIT,FUNCTIONALITY}.md`.

1. **[`REGRESSION-FINAL.md`](./REGRESSION-FINAL.md)** — the single
   authoritative full-project regression prompt (§0 hard-gate → §12:
   routes, a11y, config/model selectors, the Modes canonical-schema
   field-form, deploy-hygiene, LLM-key routing, SSE disconnect
   hygiene, SSRF, i18n/docs parity, the test pyramid, **§11** the
   consolidated v1.55.x→v1.56.4 UX-fix invariants, **§12** the
   v1.58.4→v1.58.35 cycle invariants (32 single-fix releases: NEW-1
   CSP + 13 M/I items + 15 U items + notifications drawer) — all
   CLOSED-IN with their lock-test).
2. **[`UX-AUDIT-PROMPT.md`](./UX-AUDIT-PROMPT.md)** — a Senior
   UX-designer heuristic + task-based audit judged against the
   canonical product intent at <https://career-ops.org/docs> (12
   lenses, 2 task scenarios, promise-fidelity ledger, and a baseline
   ledger of already-closed findings — do not re-file those).
3. **[`FUNCTIONALITY-CHECK.md`](./FUNCTIONALITY-CHECK.md)** — an
   exhaustive functional-correctness walkthrough: every route + the
   7 `#/<mode>` pages, every API contract, the 4-provider OR matrix,
   SSE/SSRF/sanitizer gates, the parent read-only write-through
   contract, deploy hygiene, and the pre-commit→CI→push AI-review
   pipeline. Pass/fail per item; "does the whole app work, correctly
   and clearly?".

They supersede the version-pinned specs below, which stay for
historical diff only.

| File | Status | Purpose |
|---|---|---|
| **[`REGRESSION-FINAL.md`](./REGRESSION-FINAL.md)** | **CURRENT** | Perennial full-project regression — run on every release. |
| **[`UX-AUDIT-PROMPT.md`](./UX-AUDIT-PROMPT.md)** | **CURRENT** | Perennial Senior-UX-designer audit vs career-ops.org/docs. |
| **[`FUNCTIONALITY-CHECK.md`](./FUNCTIONALITY-CHECK.md)** | **CURRENT** | Perennial exhaustive functional-correctness walkthrough. |
| [`archive/REGRESSION-v1.54.9.md`](./archive/REGRESSION-v1.54.9.md) | Archived | v1.54.1→v1.54.9 cycle spec. Superseded by FINAL; diff-only. |
| [`archive/REGRESSION-v1.54.md`](./archive/REGRESSION-v1.54.md) | Archived | v1.54.0 FINAL end-to-end spec (P-31 WS0–WS10). Diff-only. |
| [`archive/REGRESSION-v1.29.2.md`](./archive/REGRESSION-v1.29.2.md) | Archived | Prior bottom-up spec (baseline v1.6.0→v1.29.2). Diff-only. |
| [`archive/DOCS-COVERAGE-v1.29.md`](./archive/DOCS-COVERAGE-v1.29.md) | Archived | Prior top-down docs-coverage. Diff-only. |
| `archive/REGRESSION-v1.27.md`, `archive/DOCS-COVERAGE-v1.28.md` | Archived | Older frozen specs. |
| `archive/v{24,26,27,28,29}-regression/`, `archive/docs-coverage-runs/` | Archived (v1.56.0) | Past-cycle live-run evidence. Read-only. |
| `v14-regression/`, `v54-regression/` | Historical / current | v14 = old evidence; v54 = the active v1.54→v1.56 run-report dir. |

> Only the three **CURRENT** perennial prompts + `G-005-closure-kit.md`
> live at `qa/` root; every version-pinned spec and past-cycle
> run-dir is under `qa/archive/` (consolidated v1.55.0 → v1.56.0).

## P-31 program — shipped (v1.31 → v1.54)

The senior-UX + parent-sync + test-pyramid program ran as one
fix-per-release loop, every release CI-green, each through pre-commit
AI-review to LGTM:

| Workstream | Releases | Outcome |
|---|---|---|
| WS0 parent-sync | v1.31 | batch `--model`/`--start-from` parity |
| WS1 #/config field-forms | v1.32 | per-field profile/config editors, merge-not-replace invariant |
| WS4 parity · WS5 #/auto · WS6 settings-decomposition · WS7 pre-commit AI-review · WS8 CLI (setup/init/doctor/run/open + provider selector) | v1.33–1.40 | feature parity + bootstrap |
| **WS2 senior UX-audit** | **v1.41–v1.52** | **40 findings (HIGH→LOW) all fixed**, one ship each, every screen Playwright-verified — see `REGRESSION-FINAL.md §2` |
| Post-final hardening + multi-provider | v1.54.1–v1.55.0 | 3 MEDIUM regression fixes, Modes canonical-schema field-form, deploy-hygiene, SSE disconnect hygiene, LLM-key live-`.env` routing, **headless OR eval (Anthropic\|Gemini\|OpenAI\|Qwen)** |
| WS9 test pyramid | v1.53 | shell-surface tests (`bin/*.sh` + `.githooks`); 717 `node --test` + 4 E2E + TESTING.md |
| WS10 canonical re-validation | v1.54 | help-bundle H3-parity closed (all 8 → 17 H2 / 70 H3) + gate; `docs/sdd/` refreshed |
| **Consolidated UX fix-prompt** | **v1.55.1 → v1.56.0** | **all 12 UX findings + F-V55-E/F-V55-H shipped** one-per-release, each test-locked + CI-green + AI-review-LGTM; AI-reviewer workflow rebuilt to run on push→main; `docs/` + `qa/` actualized. 757 → **813** `node --test` / 110 files. See `REGRESSION-FINAL.md §11`. |

## Open backlog

| ID | Severity | Title | Target |
|---|---|---|---|
| G-005 | Minor (cross-repo) | `oferta.md` report blocks A-G vs canonical career-ops.org A-F | [`G-005-closure-kit.md`](./G-005-closure-kit.md) |

**The single open item** across the whole project, unchanged since
v1.27 and **blocked on a cross-repo parent commit** (CLAUDE.md hard
rule #1 forbids editing the parent from here). The full
ready-to-apply plan is in
**[`G-005-closure-kit.md`](./G-005-closure-kit.md)**: STEP 1 = a
parent `Fighter90/career-ops` commit rewriting `modes/oferta.md`
A-G → A-F; STEP 2 = a one-line web-ui `prompts.mjs` follow-up
(help §9 ×8 already canonical A-F since v1.15.0 — no change);
STEP 3 = a lock test. STEP 2/3 must land **only after** STEP 1, or
`prompts.mjs` (which says "A-G per modes/oferta.md") and the parent
mode file contradict each other — strictly worse drift (kit §
"Why it isn't shipped pre-emptively"). The renderer is
schema-tolerant, so this is nomenclature drift, not a functional
break. Every other finding — 31 from the v1.10 baseline, 40 from
the WS2 UX-audit, and all 14 from the v1.55.x→v1.56.0 consolidated
fix-prompt — is shipped and regression-locked by a `tests/*.test.mjs`.

## Folder layout

```text
qa/
├── README.md                 ← you are here
├── REGRESSION-FINAL.md       ← CURRENT perennial regression (§0→§11)
├── UX-AUDIT-PROMPT.md        ← CURRENT perennial Senior-UX audit
├── FUNCTIONALITY-CHECK.md    ← CURRENT perennial functional-correctness
├── G-005-closure-kit.md      ← the single open backlog item (cross-repo)
├── v54-regression/           ← live run reports for the current spec
├── v14-regression/           ← old historical evidence (read-only)
├── conformance-vs-docs/ · functional-vs-docs/   ← reserved for new runs
└── archive/                  ← closed; do not act on without checking HEAD
    ├── REGRESSION-v1.54.9.md · REGRESSION-v1.54.md
    ├── REGRESSION-v1.29.2.md · REGRESSION-v1.27.md
    ├── DOCS-COVERAGE-v1.29.md · DOCS-COVERAGE-v1.28.md
    ├── v{24,26,27,28,29}-regression/ · docs-coverage-runs/  (v1.56.0)
    └── v1.10-fixes/ · v1.14-reports/ · v1.15-fix-prompts/
        · v1.25-fix-prompts/ · v1.26-fix-prompts/
```

## How to use this folder

**Running the next regression cycle:** walk
[`REGRESSION-FINAL.md`](./REGRESSION-FINAL.md) §0→§11. §0 (`npm run
test:ci` + e2e + sh-files + doctor) gates everything. §2 is the WS2
a11y matrix and §11 the consolidated v1.55.x→v1.56.0 UX-fix
invariants — every row has a static test plus a live spot-check.
Then run [`UX-AUDIT-PROMPT.md`](./UX-AUDIT-PROMPT.md) and
[`FUNCTIONALITY-CHECK.md`](./FUNCTIONALITY-CHECK.md). Save reports
under `qa/v54-regression/<YYYY-MM-DD>-{REGRESSION,UX-AUDIT,FUNCTIONALITY}.md`.

**Filing a finding:** one finding = one fix-ship (bump + CHANGELOG ×8 +
test + Playwright-verify + pre-commit AI-review to LGTM). Never batch
unrelated fixes; never `--no-verify`.

**Reading history:** everything in `archive/` and the `v{14..29}-`
dirs is closed/historical. Check the source tree against the v1.54
implementation before re-filing any old ID.
