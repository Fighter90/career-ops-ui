# QA Regression Prompt — v1.271.2 (map/jobs pipeline cap — perf patch)

> Release: **v1.271.2** (2026-11-08) — the perf patch (CAR-250): the `GET /api/map/jobs` **pipeline section is capped at the newest 1000 rows by default**. A prod-sized `data/pipeline.md` accumulated ~19K rows (674 KB of file) and made the endpoint the heaviest page-load on prod — **4.4 MB post-tracker-slim** (the v1.271.1 tracker slim removed ~300 KB, but the pipeline section was the remaining root of the weight). The cap ships the newest 1000 rows; **`pipelineTotal` reports the true count** so the client still knows the size of the iceberg; **`?pipeline=all`** restores the full list for any caller that needs it; **titleFit is computed only on the shipped section** (the ×19K fit churn is gone with the cap). `/api/pipeline` is deliberately NOT changed (tracked separately as the CAR-250 lazy/paging follow-up's data-owner design question). Test additions: **+2** in the map-jobs-cache suite (cap + `pipelineTotal`; `?pipeline=all` opt-in).
> Prod target: resumecraft.ru = **1.271.2**, parent **1.39.0**.
> Basis: v1.271.1 shipped & deployed (map/jobs tracker slim, CAR-249). Nothing from the v1.271.1 contract changes; this release is a second, pipeline-section-only payload patch on top of it.

## §0 Local gates (HEAD — real numbers, no re-derivation by hand)

| Gate | Expected |
|---|---|
| npm run test:ci | **7925 tests · 7922 pass · 0 fail · 3 skip** |
| npm run test:e2e:browser | **209 pass · 0 fail · 1 opt-in skip** |
| npm run test:coverage:gate | **98.59 line / 90.56 branch** |
| node evals/workflow/run.mjs | **0 ✗** except the known `site-build-after-fanout` (site rebuild follows the fan-out) |
| changelog parity | **✓ ×19 at 1.271.2, 494 releases each** |
| /api/health | **1.271.2 / parent 1.39.0** |

A red §0 gate is a finding, not a sweep item: triage before touching the manual checklist.

## §1 What shipped (verify these first)

1. **Pipeline section capped at the newest 1000 rows by default:** `GET /api/map/jobs` ships at most the newest 1000 `data/pipeline.md` rows; the rest are not fetched into the payload (no silent partial rows — the section is truncated at the row boundary).
2. **`pipelineTotal` reports the true count:** the response carries `pipelineTotal` = the total row count of the pipeline (e.g. **1000** shipped of **19 000+** total on prod), so the client can display an honest "N more on `/api/pipeline`" instead of assuming the cap is the whole board.
3. **`?pipeline=all` opt-in:** the same endpoint with `?pipeline=all` restores the pre-v1.271.2 behaviour — every pipeline row, however many — for any caller that needs the full list.
4. **titleFit only on the shipped section:** the `titleFit` signal is computed for the ≤1000 shipped rows only; the cap removes the ×19K title-fit computation that ran on the whole pipeline on every page-load.
5. **`/api/pipeline` NOT touched:** the pipeline endpoint and `#/pipeline` view behave exactly as before — they keep serving the **full** list (deliberate no-change; the lazy/paging follow-up is tracked as CAR-250 design work, not done in this patch).
6. **Tests:** +2 specs in the map-jobs-cache suite — one pinning the newest-1000 cap + `pipelineTotal` on a >1000-row fixture, one pinning the `?pipeline=all` opt-in (full list restored).

## §2 Manual spot checks

- [ ] **Map page renders the recent pins.** Open `#/map` → the newest pipeline rows are plotted as before; cluster behaviour, the location popover, the score popover and the workplace popover all work on the shipped section exactly as in v1.271.1.
- [ ] **Cap + total on a >1000-row pipeline.** With a `data/pipeline.md` holding more than 1000 rows: `curl -s '127.0.0.1:4317/api/map/jobs'` → the payload carries exactly **1000** pipeline rows and `pipelineTotal` = the true row count (>1000).
- [ ] **`?pipeline=all` returns everything.** `curl -s '127.0.0.1:4317/api/map/jobs?pipeline=all'` → the same endpoint returns **all** pipeline rows (count equals `pipelineTotal`) — pre-v1.271.2 behaviour restored.
- [ ] **`#/pipeline` view unchanged — full list.** The `#/pipeline` view still lists the complete pipeline (no accidental cap or drift on the deliberate no-change endpoint/view; on a big pipeline it stays as slow as it ever was — that is the known, tracked CAR-250 follow-up, not a regression of this patch).
- [ ] **Perf sanity on prod (post-deploy).** Re-run the perf probe (`gh workflow run remote-qa.yml -f perf=true`) — map/jobs should sit well below the **4.4 MB** post-tracker-slim baseline now that the pipeline section holds ≤1000 rows instead of ~19K; no SLOW verdict.

## Locale sweep

Inherited from v1.271.1 unchanged — no new strings ship in this patch: all 19 UI locales render unchanged; one sanity render per locale group (en, ru, ja, ar on `#/map` and `#/pipeline`) is enough. Help bundles untouched (H3 132).

## remote-QA (standard)

remote-QA on prod (routes ×19, site ×19, links, live scan + LLM `save:false`) green; findings → Linear immediately. The **`perf` leg is the point of this release**: run `-f perf=true` once and confirm no SLOW verdict, with map/jobs improved over the 4.4 MB post-tracker-slim baseline (the newest-1000 pipeline cap is the payload win).
