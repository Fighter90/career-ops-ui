# QA Regression Prompt — v1.271.1 (map/jobs slim — perf patch)

> Release: **v1.271.1** (2026-11-07) — the perf patch (CAR-249): `GET /api/map/jobs` answers **slim by default** — tracker rows are projected to the **11 map-consumed fields** only (the free-text `notes` field is folded server-side into `workplace`), and `?full=1` restores the full payload for any caller that needs it. `/api/pipeline` is deliberately NOT changed. Prod baseline before the fix: the perf probe measured map/jobs at **4.6 MB / 696 ms median**. Test additions: **+2** in the map-jobs-cache suite (slim projection + full opt-in).
> Prod target: resumecraft.ru = **1.271.1**, parent **1.39.0**.
> Basis: v1.271.0 shipped & deployed (Career tasks kanban). Nothing from the v1.271.0 contract changes; this release is a single-endpoint payload patch on top of it.

## §0 Local gates (HEAD — real numbers, no re-derivation by hand)

| Gate | Expected |
|---|---|
| npm run test:ci | **7923 tests · 7920 pass · 0 fail · 3 skip** |
| npm run test:e2e:browser | **209 pass · 0 fail · 1 opt-in skip** |
| npm run test:coverage:gate | **98.59 line / 90.56 branch** |
| node evals/workflow/run.mjs | **0 ✗** except the known `site-build-after-fanout` (site rebuild follows the fan-out) |
| changelog parity | **✓ ×19 at 1.271.1, 493 releases each** |
| /api/health | **1.271.1 / parent 1.39.0** |

A red §0 gate is a finding, not a sweep item: triage before touching the manual checklist.

## §1 What shipped (verify these first)

1. **`GET /api/map/jobs` slim by default:** each tracker row carries exactly the 11 map-consumed fields — **no `notes` key** in the default payload; the notes text survives only as the server-side fold into `workplace`.
2. **`?full=1` opt-in:** the same endpoint with `?full=1` returns the full row payload including `notes` — behaviour identical to pre-v1.271.1.
3. **Map page visually unchanged:** `#/map` renders the same pins, filters, peek and popovers as v1.271.0 — the slim payload must be a pure size win with no client-visible regression.
4. **`/api/pipeline` NOT touched:** the pipeline endpoint and view behave exactly as before (deliberate no-change — verify nothing drifted).
5. **Tests:** +2 specs in the map-jobs-cache suite — one pinning the slim projection (no `notes` key), one pinning the `?full=1` opt-in (notes restored).

## §2 Manual spot checks

- [ ] **Map page renders pins identically to before.** Open `#/map` → pins, cluster behaviour, the location popover, the score popover and the workplace popover all show the same content as v1.271.0 (workplace still carries the folded notes text where notes existed).
- [ ] **Slim payload has no `notes` key.** `curl -s '127.0.0.1:4317/api/map/jobs'` on a row that has notes in `data/applications.md` → the JSON carries NO `notes` field; the 11 map-consumed fields are all present.
- [ ] **`?full=1` restores notes.** `curl -s '127.0.0.1:4317/api/map/jobs?full=1'` → the same row now carries its `notes` value verbatim.
- [ ] **`/api/pipeline` unchanged.** Same response shape as v1.271.0 (no accidental slimming or drift on the deliberate no-change endpoint).
- [ ] **Perf sanity on prod (post-deploy).** Re-run the perf probe (`gh workflow run remote-qa.yml -f perf=true`) — map/jobs should sit well below the **4.6 MB / 696 ms median** baseline; no SLOW verdict.

## Locale sweep

Inherited from v1.271.0 unchanged — no new strings ship in this patch: all 19 UI locales render unchanged; one sanity render per locale group (en, ru, ja, ar on `#/map` and `#/tasks`) is enough. Help bundles untouched (H3 132).

## remote-QA (standard)

remote-QA on prod (routes ×19, site ×19, links, live scan + LLM `save:false`) green; findings → Linear immediately. The **`perf` leg is the point of this release**: run `-f perf=true` once and confirm no SLOW verdict, with map/jobs improved over the 4.6 MB / 696 ms baseline.
