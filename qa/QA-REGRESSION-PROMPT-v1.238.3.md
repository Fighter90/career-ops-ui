# QA regression — v1.238.3

Findings of the live regression on v1.238.2: no 502s any more, but during a scan
the first page load of a locale timed out at 30 s, and `/api/dashboard` /
`/api/reports` took ~3.7 s even when idle. Separately, one remote-QA finding
printed part of the prod hostname into a public log. **Counts:** 98 sources
(93 EN + 5 RU) / 93 adapters — unchanged. **Tests 3488 → 3495.**

## §0 — Gates

```bash
node --test tests/reports-list-cache.test.mjs          # 3 pass — cache hits, change/add/delete
node --test tests/remote-qa-redact.test.mjs            # 4 pass — fails on the old add()
node --test tests/http-keepalive.test.mjs              # still 2 pass
npm run test:ci                                        # 3495 (3492 + 3 skipped), exit 0
npm run test:e2e:browser                               # 116 pass
npm run test:e2e && npm run test:e2e:full              # smoke + 23/23
node evals/workflow/run.mjs                            # 0 fail
```

## §1 — What changed

1. **Report-list cache.** `safeListReports()` (behind `/api/reports` and
   `/api/dashboard`) keeps each report's parsed header keyed by absolute path and
   invalidated on any mtime/size change; deleted reports are evicted. Callers get
   copies. 500 × 28 KB reports locally: 430 ms cold → 3 ms warm.
2. **Remote-QA redaction.** `scripts/remote-qa/redact.mjs`: both prod scripts redact
   the prod host (with or without scheme/port, any case) inside `add()` before
   slicing, and redact the whole printed report.

## §2 — Manual pass

1. On prod, `verify`: `/api/dashboard` and `/api/reports` answer in well under a
   second (the probe timestamps are ~4 s apart on v1.238.2).
2. Write a new report (evaluate with save) → it appears in `#/reports` at once.

## §3 — Invariants

- The report list is still sorted newest first and still skips unreadable files.
- No finding, summary or step log of `remote-qa.yml` contains the prod hostname.

## §5 — Sign-off

- [ ] §0 gates green with the counts above
- [ ] deploy, `verify`: fast dashboard/reports, NRestarts 0, no new 502s
- [ ] remote QA green on prod, including `live: true`
