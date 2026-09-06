# QA artifacts — career-ops-ui

Regression drivers, design/UX prompts, and dated run evidence.

**Baselines as of v1.231.4** — **3013** `node --test` · **101** Playwright ·
**21** smoke E2E · **23** comprehensive E2E · **92** scan sources (87 EN + 5 RU) ·
**37** route modules · **31** views · **17** locales · help parity
**32 H2 / 122 H3** · **18** LLM providers.

## Layout

```text
qa/
├── README.md                          ← you are here
├── QA-REGRESSION-PROMPT-v1.231.4.md   ← the CURRENT release's delta driver
├── FUNCTIONALITY-CHECK.md             ← perennial: does it actually work?
├── UX-AUDIT-PROMPT.md                 ← perennial: is it good UX?
├── DESIGNER-EXPORT-PROMPT.md          ← perennial: design-system + key-flow export
├── reports/                           ← dated run evidence
└── archive/                           ← closed; historical diff only
    └── superseded-prompts/            ← every retired prompt
```

Exactly one version-pinned prompt lives at the top level: the **current**
release's delta. **Archiving the previous one is part of shipping a release**,
not a periodic clean-up — the point of this layout is that "which prompt is
current" needs no thought.

That rule was written at v1.137.0 and then not applied for 95 releases: by
v1.231.1 the top level held 98 superseded prompts. They were archived in
v1.231.2, along with five prompts that had outlived their own claims — see
below.

## The four drivers

| File | Scope | When |
|---|---|---|
| **[`QA-REGRESSION-PROMPT-v1.231.4.md`](./QA-REGRESSION-PROMPT-v1.231.4.md)** | This release's delta: §0 exact `node --test` gates, what changed, the manual browser pass, contract/security invariants, what was deliberately not ported | Every release, before merge |
| **[`FUNCTIONALITY-CHECK.md`](./FUNCTIONALITY-CHECK.md)** | Every route + the 7 `#/<mode>` pages, every API contract, the OR provider matrix, SSE/SSRF/sanitizer gates, the parent read-only write-through contract, deploy hygiene. Pass/fail per item | Every release, or before a risky refactor |
| **[`UX-AUDIT-PROMPT.md`](./UX-AUDIT-PROMPT.md)** | Senior-UX heuristic + task-based audit against the product intent at <https://career-ops.org/docs>. Carries a ledger of already-closed findings — do not re-file those | On demand; assumes the app already works |
| **[`DESIGNER-EXPORT-PROMPT.md`](./DESIGNER-EXPORT-PROMPT.md)** | Design-quality audit + a structured design-system export: every page, component and key flow, all 17 locales | On demand |

The three perennial prompts read `package.json::version` and validate the
current `HEAD`. Save run reports under
`qa/reports/<YYYY-MM-DD>-{FUNCTIONALITY,UX-AUDIT,DESIGN-EXPORT}.md`.

## What v1.231.2 retired, and why

Five prompts at the top level described themselves as current and were not:

| File | It claimed | It actually was |
|---|---|---|
| `REGRESSION-FINAL.md` | "the single authoritative, version-agnostic regression prompt" | §§11–15 are five closed cycle ledgers (v1.55.x → v1.59.7); its stated help baseline was **28 H2 / 103 H3 across 16 locales** against 32 / 122 and 17 today, so §9 failed on the first step. Its §5a English-by-policy doctrine is still doctrine and is still gated by `tests/qa-report-fixes.test.mjs` (DOC-1), now against the archived copy |
| `QA-REGRESSION-PROMPT.md` | unversioned name; this README called it "as of `package.json` 1.231.2" | pinned to **v1.226.0** — 2066 tests, 85 sources, 37 route modules |
| `QA-REGRESSION-PROMPT-v1.76.0-FULL.md` | "parent-parity CI gate driver" | pinned to v1.76.0, 155 releases back |
| `REGRESSION-PROMPT-FINAL.md` | "canonical post-cycle handoff" | closes the v1.58.52 → v1.59.10 cycle, baseline 1258 unit tests |
| `QA-FULL-REGRESSION.md` | "standing whole-project checklist" | baseline v1.131.1 / 2135 tests / 72 sources; duplicated the above |

All five are in [`archive/superseded-prompts/`](./archive/superseded-prompts/),
readable for historical diff. `PARENT-SYNC-WORKLIST-v1.26.0.md` (a one-off for
parent 1.26.0; the parent is now 1.32.0) went with them, and the dated
`UX-AUDIT-2026-07-06.md` moved to `reports/` where run evidence belongs.

## How to use this folder

**Shipping a release.** Walk the release's own
`QA-REGRESSION-PROMPT-v<version>.md` — §0 gates everything else. Write the next
release's prompt before merging it, and `git mv` the previous one into
`archive/superseded-prompts/`.

**Filing a finding.** One finding = one fix-ship: bump + CHANGELOG ×17 + a test
that locks it + Playwright verification + pre-commit AI-review to LGTM. Never
batch unrelated fixes; never `--no-verify`.

**Reading history.** Everything under `archive/` is closed. Check it against the
current source tree before re-filing any old ID — most were fixed years of
releases ago and are regression-locked by a `tests/*.test.mjs`.

## Open backlog

| ID | Severity | Title |
|---|---|---|
| G-005 | Minor (cross-repo) | `oferta.md` report blocks A–G vs canonical career-ops.org A–F |

The single open item across the project, unchanged since v1.27 and blocked on a
cross-repo parent commit (CLAUDE.md hard rule #1 forbids editing the parent from
here). The ready-to-apply plan is in
[`archive/superseded-prompts/G-005-closure-kit.md`](./archive/superseded-prompts/G-005-closure-kit.md):
a parent commit rewriting `modes/oferta.md` A–G → A–F must land **first**, or
`prompts.mjs` and the parent mode file contradict each other — strictly worse
drift. The renderer is schema-tolerant, so this is nomenclature drift, not a
functional break.
