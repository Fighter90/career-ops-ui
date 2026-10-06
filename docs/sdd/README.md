# docs/sdd — Spec-Driven Development for career-ops-ui

This folder is the **map of the SDD system**. The rules live in two documents; the
per-change artifacts live in `specs/` (one folder-level index per release train) and are
tied to executable gates in `TRACEABILITY.md`.

| File | What it holds | Read it when |
|---|---|---|
| [`SDD-GUIDE.md`](SDD-GUIDE.md) | The pipeline every non-trivial change goes through: discuss → spec → plan → execute → verify → review. | Starting any change that touches more than one file. |
| [`CONVENTIONS.md`](CONVENTIONS.md) | Module system, routes, sanitizers, i18n, testing, versioning — and the **current test baseline** per release. | While writing code. |
| [`PLAN.md`](PLAN.md) | The program of work: one release per concern, the agent groups and the findings each owns, status. | Before starting any task, to see where it belongs. |
| [`TRACEABILITY.md`](TRACEABILITY.md) | Requirement → code → test matrix for the invariants this project must never lose (parent read-only, SSRF envelope, source registry contract, counts, i18n parity). | Before changing an invariant; after adding a source, route or locale. |
| [`specs/`](specs/) | **The only specifications folder.** Every feature/release spec, dated `YYYY-MM-DD-<slug>.md` (older `V<x.y.z>-BACKLOG.md` and feature specs from Jul–Sep 2026 included). Format: [`specs/_TEMPLATE.md`](specs/_TEMPLATE.md). | Opening, reviewing or auditing a change. |

## Where the other artifacts are

| Artifact | Location | Relationship to SDD |
|---|---|---|
| Decisions whose reasoning is not in the diff | [`../adr/`](../adr/) | A spec links the ADR it relies on; a spec that needs a *new* decision adds one. |
| Release sign-off checklist | [`../../qa/`](../../qa/) (`QA-REGRESSION-PROMPT-v<version>.md`) | The *verification* step of a spec, as a manual + command checklist. |
| Vocabulary | [`../../CONTEXT.md`](../../CONTEXT.md) | A spec uses CONTEXT's words (`source` vs `adapter`, `mirror` vs `relay`). |
| Working state / abandoned approaches | [`../../PROGRESS.md`](../../PROGRESS.md) | What the next session must know that git cannot say. |
| Release history | [`../../CHANGELOG.md`](../../CHANGELOG.md) ×17 | The *outcome* of a spec, written for users. |

## How a change moves through the folder

1. **Spec first.** Copy `specs/_TEMPLATE.md` to `specs/<date>-<slug>.md`. Fill *Goal*, *Scope*,
   *Out of scope* and *Acceptance criteria* — each criterion names a test or a command that
   will prove it. No code before the criteria exist.
2. **Plan.** Break the spec into tasks with file-level changes and the test each task makes
   green. Parallelisable tasks (one provider each) are marked as such.
3. **Execute with TDD** (red → green → refactor). One commit per coherent task.
4. **Verify.** Fill the spec's *Verification* section with the real commands and counts —
   not "tests pass" but `4056 pass`, `116 Playwright`, and what was checked in a browser.
5. **Trace.** If the change touched an invariant, update `TRACEABILITY.md`.
6. **Close.** Status → `Done`, link the PR and the released version.

A spec is **immutable once Done**, like an ADR: a later change gets a new spec that links
back, so the history of *why* stays readable.

## Index of specs

| Spec | Status | Release |
|---|---|---|
| [`2026-10-06-parent-parity-v1.240.0.md`](specs/2026-10-06-parent-parity-v1.240.0.md) | Done | v1.240.0 |
| [`2026-10-06-test-coverage-90.md`](specs/2026-10-06-test-coverage-90.md) | In progress | v1.241.0 → v1.245.0 |
| [`2026-10-06-scan-page-redesign.md`](specs/2026-10-06-scan-page-redesign.md) | Draft | v1.244.0 |
