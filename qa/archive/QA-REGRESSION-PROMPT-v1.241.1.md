# QA regression — v1.241.1

Patch on v1.241.0: live evaluations end to end in every locale, long multi-location
postings on the job map, deploy vs. the hourly scan, job map on cvstart.org.
Counts unchanged: **109** sources / **104** adapters.

## §0 — Gates

```bash
npm run test:ci                      # 4419 pass, exit 0
npm run test:e2e:browser             # 118 pass
node --test tests/llm-prompt-hardening.test.mjs tests/eval-validate.test.mjs \
  tests/geocode.test.mjs tests/remote-qa-lang-check.test.mjs tests/ci-workflows.test.mjs
gh workflow run remote-qa.yml --ref main -f live=true -f scan=false   # all 4 jobs green
```

## §1 — What changed (verify each)

1. **Evaluate (any locale):** the report has Blocks A–G and **no** "modes/oferta.md truncated" warning.
2. **Evaluate in hi / ja:** the report is in Hindi / Japanese; English only for names,
   technologies and quoted CV/JD text. A run that takes 2–4 min ends with a report, not 502.
3. **Validator:** `## ए)` … `## जी)` headings and `SCORE: ३.८` / `3,8` produce no warnings.
4. **Job map:** `#/map` → DevTools console has **no** `400 /api/geocode`; a scan row with
   "Berlin Office · Berlin · Germany · …" gets a marker in Berlin.
   `curl '127.0.0.1:4317/api/geocode?q=<2001 chars>'` → 400; a 300-char list → 200.
5. **Deploy during the hourly scan** (≈ :04–:17): the deploy log shows `timers held` /
   `waiting for: career-ops-scan.service`, the scan unit finishes `success`, and
   `systemctl list-timers | grep career-ops` lists both timers again afterwards.
6. **cvstart.org:** `/#job-map` and `/<lang>/#job-map` show that language's screenshot (`images/job-map-<locale>.png`, ×17).
7. **Docs:** every README ×17 has the 🗺️ map section with its own screenshot; help §33 ×17 has "How to use the map" (125 H3 per bundle); the wiki has the [Job map](https://github.com/Fighter90/career-ops-ui/wiki/Job-Map) page linked from the sidebar and every Home.

## §2 — Manual browser pass

`#/evaluate` in en, ru, hi, ja, ar; `#/map` in en and ru; cvstart.org at 1280 px and 390 px.

## §3 — Contract / security invariants

`/api/geocode` still a side-effecting GET under the request guard (same-origin only);
`company` is capped at 200 characters server-side.

## §4 — Deploy

`/api/health` on the server: `version: 1.241.1`. Public check answers **401** (basic auth).

## §5 — Sign-off

- [ ] §0 green · [ ] §1 1–7 · [ ] §2 in a real browser · [ ] prod verify passed
