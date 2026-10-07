# QA regression — v1.241.0

Hardening release from a 28-agent code review (~190 verified findings) plus the job map
(#381, @bullitt186). Counts unchanged: **109** sources / **104** adapters.

## §0 — Gates

```bash
npm run test:ci                      # 4404 pass, exit 0
npm run test:e2e:browser             # 118 pass
npm run test:coverage:gate           # server coverage >= scripts/coverage-baseline.json
node evals/workflow/run.mjs          # green
node --test tests/request-guard.test.mjs tests/scan-snapshot-safety.test.mjs \
  tests/infra-*.test.mjs tests/llm-*.test.mjs tests/routes-*.test.mjs tests/scan-*.test.mjs tests/ci-*.test.mjs
```

## §1 — What changed (verify each)

1. **Request guard:** `curl -H 'Host: evil.example' 127.0.0.1:4317/api/health` → 421;
   `curl -X POST -H 'Origin: https://evil.example' 127.0.0.1:4317/api/run/doctor` → 403;
   a same-origin UI action works.
2. **No crash on bad bodies:** `POST /api/deep {"company":123}` → 400 and the server stays up.
3. **Scan snapshot:** start a scan, click Stop → `#/scan` still shows the previous results.
4. **Evaluate:** a run includes Blocks A–G (mode file no longer cut at 16 KB).
5. **Job map:** `#/map` renders tiles and markers; no CSP violations in the console.
6. **PDF of a report** succeeds even when the report contains salary figures not in `cv.md`.

## §2 — Manual browser pass

`#/dashboard`, `#/scan` (run + stop), `#/pipeline` (add + delete a row with compensation),
`#/tracker`, `#/evaluate`, `#/map`, `#/config` (save), `#/help` — in en, ru, ar (RTL).

## §3 — Contract / security invariants

`docs/sdd/TRACEABILITY.md` rows R-02, R-03, R-06, R-12 — each gate green.

## §4 — Deploy

The deploy writes `ALLOWED_HOSTS` from the public URL; the public check must answer **401**
(basic auth), never **421**. `/api/health` on the server: `version: 1.241.0`.

## §5 — Sign-off

- [ ] §0 green · [ ] §1 1–6 · [ ] §2 in a real browser · [ ] prod verify passed
