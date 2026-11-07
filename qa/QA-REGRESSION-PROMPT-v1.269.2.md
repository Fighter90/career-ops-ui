# QA Regression Prompt — v1.269.2 (review-fix patch on v1.269.1)

> Release: **v1.269.2** (2026-11-07) · patch — saveReportExclusive (wx on both paths + behavioral race contract), `POST /api/reports` exclusive 409, EN README banner chain fix
> Prod target: resumecraft.ru = **1.269.2**, parent 1.38.0 (fork unchanged — no parent-sync in this release)
> Basis: v1.269.1 shipped & deployed (docs + perf-paging). Nothing from the v1.269.1 contract changes; this release closes the review findings on the report-save write path.

## §0 Local gates (HEAD — real numbers, no re-derivation by hand)

| Gate | Expected |
|---|---|
| npm run test:ci | **7704 tests · 7701 pass · 0 fail · 3 skip** |
| npm run test:e2e:browser | **201 pass · 0 fail · 1 opt-in skip** |
| npm run test:coverage:gate | **98.55 line / 90.42 branch** (above ratchet) |
| node evals/workflow/run.mjs | **0 ✗** — 16 pass, 1 skip |
| changelog parity | **✓ ×19 at 1.269.2, 490 releases each** |
| /api/health | **1.269.2 / parent 1.38.0** |

A red §0 gate is a finding, not a sweep item: triage before touching the manual checklist.

## §1 What shipped (verify these first)

1. **`saveReportExclusive` (`server/lib/report-save.mjs`) — wx on BOTH paths.** The first write attempt uses exclusive-create (`wx`), AND the epoch-suffix dedup path uses `wx` too. Verify with the behavioral race suite: a fresh write creates the file; a concurrent second writer NEVER clobbers the first (fails instead of overwriting); two distinct slugs write independently; a ~512KB report round-trips intact.

2. **`POST /api/reports` exclusive-wx + same 409.** The route saves through the same exclusive path: a duplicate slug answers **409** (not a silent overwrite); `overwrite: true` in the body replaces the file as before. Spot-check both responses from the API.

3. **EN README banner chain fixed.** The English `README.md` banner chain was stale (lead still v1.268.0); it now shows the **v1.269.2** lead with v1.269.1 as previous and v1.269.0 dropped (the standard 3-deep chain). Verify on GitHub, not just locally.

## §2 Manual spot checks

- [ ] **Two parallel evaluations of the same JD slug → both reports exist, neither clobbered.** Run the same job (same company+role slug) through two concurrent evaluations → both report files exist under distinct epoch-suffixed names, neither content overwrote the other, and each tracker row's Report link points at ITS OWN file (row A → report A, row B → report B).
- [ ] **`POST /api/reports` duplicate slug → 409; with `overwrite: true` → replaces.** POST the same slug twice → second call answers 409 and the file is untouched; repeat with `overwrite: true` → the file content is replaced, 200.
- [ ] **README.md on GitHub shows the v1.269.2 lead.** Open the repo on github.com (rendered view, not raw) → the banner names v1.269.2; the chain below carries v1.269.1 → v1.269.0 and no older entry.

## Locale sweep

All 19 UI locales render unchanged from v1.269.1 — this release touches no user-visible chrome; only a one-locale sanity render (en + ru on `#/reports`) to confirm nothing regressed.

## remote-QA (standard)

remote-QA on prod (routes ×19, site ×19, links, live scan + LLM `save:false`) green; findings → Linear immediately.
